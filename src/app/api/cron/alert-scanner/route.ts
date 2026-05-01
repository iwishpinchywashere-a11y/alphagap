/**
 * GET /api/cron/alert-scanner
 *
 * Runs every 5 minutes via cron.
 *
 * Compares latest scan data against the previous snapshot and
 * enqueues Telegram alerts for users whose watchlist subnets
 * have crossed their configured thresholds.
 *
 * Alert types:
 *   scoreChange    — aGap composite score moved by >= threshold pts
 *   emissionChange — emission % changed by >= threshold %
 *   priceMove      — 24h price change >= threshold %
 *   whaleActivity  — whale signal appeared / changed
 *   newSignal      — new alpha signal generated
 *   goingViralX    — new high-heat KOL tweet (heat_score >= 70)
 *   discordEntry   — new high-quality Discord entry (alphaScore >= 70)
 *
 * ── Dedup architecture ────────────────────────────────────────────────────────
 * Metric-based alerts (scoreChange, emissionChange, priceMove, whaleActivity)
 * use a per-user per-subnet per-type 60-minute cooldown stored in scanner state
 * (lastAlertedAt). This is the authoritative dedup — it lives in the scanner
 * itself, is written in a SINGLE state write at the end, and is checked BEFORE
 * any enqueueAlert call. enqueueAlert has its own 15-min subnet-level dedup as
 * a secondary safety net, and the bot has an in-memory 15-min dedup as tertiary.
 *
 * Event-based alerts (newSignal, goingViralX, discordEntry) use processedIds
 * sets — these are one-fire-per-event and don't need the cooldown approach.
 *
 * State is written ONCE — at the end, after all alerts are processed. There is
 * no early partial write, which was the root cause of state corruption.
 */

import { NextRequest, NextResponse } from "next/server";
import { list as blobList, get as blobGet, put as blobPut } from "@vercel/blob";
import {
  enqueueAlert,
  getTelegramConnectionByHash,
} from "@/lib/telegram-alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ── Auth ──────────────────────────────────────────────────────────────────────

function authOk(req: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return true; // local dev
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ── Blob helpers ──────────────────────────────────────────────────────────────

const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN || "";

async function readBlob<T>(name: string): Promise<T | null> {
  try {
    const result = await blobGet(name, { token: TOKEN(), access: "private" });
    if (!result?.stream) return null;
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch {
    return null;
  }
}

async function writeBlob(name: string, data: unknown): Promise<void> {
  await blobPut(name, JSON.stringify(data), {
    access: "private",
    token: TOKEN(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScanEntry {
  netuid: number;
  name?: string;
  subnet_name?: string;
  composite_score: number;
  emission_pct?: number;
  alpha_price?: number;
  price_change_24h?: number;
  whale_signal?: "accumulating" | "distributing" | null;
}

interface ScanLatest {
  leaderboard: ScanEntry[];
  signals: Array<{
    id?: number;
    netuid: number;
    signal_type: string;
    title: string;
    strength: number;
    created_at?: string;
    subnet_name?: string;
  }>;
  taoPrice?: number;
  lastScan?: string;
}

interface HeatEvent {
  tweet_id: string;
  netuid: number;
  subnet_name: string;
  kol_handle: string;
  heat_score: number;
  tweet_url: string;
  detected_at: string;
}

interface SocialHot {
  events: HeatEvent[];
  updatedAt?: string;
}

interface DiscordEntry {
  netuid: number | null;
  subnetName: string;
  alphaScore: number;
  summary: string;
  signal: string;
  scannedAt: string;
}

interface DiscordLatest {
  results: DiscordEntry[];
  scannedAt?: string;
}

interface SubnetState {
  score: number;
  emission: number;
  price: number;
  whaleSignal: string | null;
}

interface ScannerState {
  lastRunAt: string;
  subnets: Record<string, SubnetState>;
  processedSignalIds: number[];
  processedTweetIds: string[];
  processedDiscordKeys: string[];
  /**
   * Per-user per-subnet per-type cooldown for metric-based alerts.
   * Key: "{userHash}:{alertType}:{netuid}"  →  ISO timestamp of last send.
   * Alerts are suppressed for 60 minutes after each send.
   * Bounded to 2000 entries (pruned by age on each write).
   */
  lastAlertedAt: Record<string, string>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** 60-minute hard cooldown per user per subnet per alert type */
const ALERT_COOLDOWN_MS = 60 * 60_000;

/** Global scanner run cooldown — skip if last run was < 3 minutes ago */
const RUN_COOLDOWN_SECONDS = 180;

// ── Helpers ───────────────────────────────────────────────────────────────────

function subnetLabel(entry: ScanEntry): string {
  const name = entry.subnet_name || entry.name;
  return name ? `${name} (SN${entry.netuid})` : `SN${entry.netuid}`;
}

const BASE_URL = "https://www.alphagap.io";

/**
 * Check whether an alert for this user/type/netuid is within the cooldown window.
 * Returns true if the alert should be SUPPRESSED (sent too recently).
 */
function onCooldown(
  lastAlertedAt: Record<string, string>,
  userHash: string,
  alertType: string,
  netuid: number
): boolean {
  const key = `${userHash}:${alertType}:${netuid}`;
  const lastSent = lastAlertedAt[key];
  if (!lastSent) return false;
  return Date.now() - new Date(lastSent).getTime() < ALERT_COOLDOWN_MS;
}

/**
 * Record that an alert was sent. Mutates the map in place.
 */
function recordAlert(
  lastAlertedAt: Record<string, string>,
  userHash: string,
  alertType: string,
  netuid: number
): void {
  const key = `${userHash}:${alertType}:${netuid}`;
  lastAlertedAt[key] = new Date().toISOString();
}

/**
 * Prune lastAlertedAt entries older than the cooldown window (+ buffer) to
 * keep the blob from growing unboundedly. Keeps at most 2000 entries.
 */
function pruneLastAlertedAt(lastAlertedAt: Record<string, string>): Record<string, string> {
  const cutoff = Date.now() - ALERT_COOLDOWN_MS * 2; // keep 2× window as buffer
  const entries = Object.entries(lastAlertedAt)
    .filter(([, ts]) => new Date(ts).getTime() > cutoff)
    .sort(([, a], [, b]) => new Date(b).getTime() - new Date(a).getTime())
    .slice(0, 2000);
  return Object.fromEntries(entries);
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();

  const [scan, prevState, socialHot, discordLatest] = await Promise.all([
    readBlob<ScanLatest>("scan-latest.json"),
    readBlob<ScannerState>("alert-scanner-state.json"),
    readBlob<SocialHot>("social-hot.json"),
    readBlob<DiscordLatest>("discord-latest.json"),
  ]);

  // ── Global run cooldown ───────────────────────────────────────────────────
  // Prevents redundant full runs from concurrent triggers.
  // NOTE: We do NOT write an early partial state here — that was the bug.
  // The 60-min per-alert cooldown in lastAlertedAt is the real dedup guard.
  if (prevState?.lastRunAt) {
    const secondsSinceLast = (Date.now() - new Date(prevState.lastRunAt).getTime()) / 1000;
    if (secondsSinceLast < RUN_COOLDOWN_SECONDS) {
      console.log(`[alert-scanner] Last run was ${secondsSinceLast.toFixed(0)}s ago — skipping (cooldown)`);
      return NextResponse.json({ ok: true, skipped: `cooldown (${secondsSinceLast.toFixed(0)}s since last run)` });
    }
  }

  if (!scan?.leaderboard?.length) {
    console.log("[alert-scanner] No scan data available, skipping.");
    return NextResponse.json({ ok: true, skipped: "no scan data" });
  }

  const scanByNetuid = new Map<number, ScanEntry>(
    scan.leaderboard.map(e => [e.netuid, e])
  );

  // Previous state — read once, never written early
  const prevSubnets: Record<string, SubnetState> = prevState?.subnets ?? {};
  const processedSignalIds = new Set<number>(prevState?.processedSignalIds ?? []);
  const processedTweetIds = new Set<string>(prevState?.processedTweetIds ?? []);
  const processedDiscordKeys = new Set<string>(prevState?.processedDiscordKeys ?? []);

  // lastAlertedAt starts from previous state; we mutate this map as alerts fire
  const lastAlertedAt: Record<string, string> = { ...(prevState?.lastAlertedAt ?? {}) };

  // List all connected users
  let cursor: string | undefined;
  const connectedHashes: string[] = [];
  do {
    const page = await blobList({
      prefix: "telegram-settings/",
      token: TOKEN(),
      access: "private",
      cursor,
    } as Parameters<typeof blobList>[0]);
    for (const blob of page.blobs) {
      connectedHashes.push(blob.pathname.replace("telegram-settings/", "").replace(".json", ""));
    }
    cursor = page.cursor;
  } while (cursor);

  let totalAlerts = 0;

  for (const hash of connectedHashes) {
    const conn = await getTelegramConnectionByHash(hash);
    if (!conn?.chatId || !conn.settings?.enabled) continue;

    const settings = conn.settings;

    const watchlistData = await readBlob<{ netuids: number[] }>(`watchlists/${hash}.json`);
    const watchlist = watchlistData?.netuids ?? [];
    if (!watchlist.length) continue;

    // ── Per-subnet metric alerts ──────────────────────────────────────
    for (const netuid of watchlist) {
      const current = scanByNetuid.get(netuid);
      if (!current) continue;

      const prev = prevSubnets[String(netuid)];
      const label = subnetLabel(current);
      const subnetUrl = `${BASE_URL}/subnets/${netuid}`;

      // aGap score change
      if (settings.scoreChange?.enabled && prev) {
        const threshold = settings.scoreChange.threshold ?? 10;
        const delta = current.composite_score - prev.score;
        if (Math.abs(delta) >= threshold) {
          if (onCooldown(lastAlertedAt, hash, "scoreChange", netuid)) {
            console.log(`[alert-scanner] scoreChange SN${netuid} → ${hash.slice(0, 8)} suppressed (cooldown)`);
          } else {
            const dir = delta > 0 ? "📈" : "📉";
            const sign = delta > 0 ? "+" : "";
            await enqueueAlert(hash, {
              type: "scoreChange",
              netuid,
              subnetName: label,
              message:
                `${dir} *aGap Score Alert*\n` +
                `*${label}*\n\n` +
                `Score moved ${sign}${delta.toFixed(1)} pts and is now *${current.composite_score.toFixed(1)}/100*.\n\n` +
                `The aGap score combines on-chain flow, dev activity, social signals, emissions, and market momentum.\n\n` +
                `[View subnet →](${subnetUrl})`,
            });
            recordAlert(lastAlertedAt, hash, "scoreChange", netuid);
            totalAlerts++;
          }
        }
      }

      // Emission change
      if (settings.emissionChange?.enabled && prev && current.emission_pct != null) {
        const threshold = settings.emissionChange.threshold ?? 25;
        const delta = current.emission_pct - prev.emission;
        if (Math.abs(delta) >= threshold) {
          if (onCooldown(lastAlertedAt, hash, "emissionChange", netuid)) {
            console.log(`[alert-scanner] emissionChange SN${netuid} → ${hash.slice(0, 8)} suppressed (cooldown)`);
          } else {
            const dir = delta > 0 ? "⬆️" : "⬇️";
            const sign = delta > 0 ? "+" : "";
            const context = delta > 0
              ? "Higher emissions mean more TAO is being distributed to this subnet's miners and validators."
              : "Lower emissions mean this subnet is receiving a smaller share of total TAO output.";
            await enqueueAlert(hash, {
              type: "emissionChange",
              netuid,
              subnetName: label,
              message:
                `⚡ *Emissions Alert*\n` +
                `*${label}*\n\n` +
                `Emissions moved ${dir} ${sign}${delta.toFixed(2)}% and are now *${current.emission_pct.toFixed(2)}%* of total TAO output.\n\n` +
                `${context}\n\n` +
                `[View subnet →](${subnetUrl})`,
            });
            recordAlert(lastAlertedAt, hash, "emissionChange", netuid);
            totalAlerts++;
          }
        }
      }

      // Price movement
      if (settings.priceMove?.enabled && current.price_change_24h != null) {
        const threshold = settings.priceMove.threshold ?? 10;
        if (Math.abs(current.price_change_24h) >= threshold) {
          const prevPrice = prev?.price ?? 0;
          const currentPrice = current.alpha_price ?? 0;
          const priceChanged = Math.abs(currentPrice - prevPrice) / Math.max(prevPrice, 0.000001) > 0.01;
          if (priceChanged) {
            if (onCooldown(lastAlertedAt, hash, "priceMove", netuid)) {
              console.log(`[alert-scanner] priceMove SN${netuid} → ${hash.slice(0, 8)} suppressed (cooldown)`);
            } else {
              const dir = current.price_change_24h > 0 ? "📈" : "📉";
              const sign = current.price_change_24h > 0 ? "+" : "";
              await enqueueAlert(hash, {
                type: "priceMove",
                netuid,
                subnetName: label,
                message:
                  `💰 *Price Alert*\n` +
                  `*${label}*\n\n` +
                  `The alpha token price moved *${sign}${current.price_change_24h.toFixed(1)}%* in the last 24 hours.` +
                  `${currentPrice ? `\nCurrent price: $${currentPrice.toFixed(4)}` : ""}\n\n` +
                  `[View on flow page →](${BASE_URL}/flow)`,
              });
              recordAlert(lastAlertedAt, hash, "priceMove", netuid);
              totalAlerts++;
            }
          }
        }
      }

      // Whale activity
      if (settings.whaleActivity?.enabled && current.whale_signal) {
        const prevWhale = prev?.whaleSignal ?? null;
        if (current.whale_signal !== prevWhale) {
          if (onCooldown(lastAlertedAt, hash, "whaleActivity", netuid)) {
            console.log(`[alert-scanner] whaleActivity SN${netuid} → ${hash.slice(0, 8)} suppressed (cooldown)`);
          } else {
            const emoji = current.whale_signal === "accumulating" ? "🐋" : "🔴";
            const action = current.whale_signal === "accumulating"
              ? "accumulating — large wallets are staking into this subnet"
              : "distributing — large wallets are unstaking from this subnet";
            await enqueueAlert(hash, {
              type: "whaleActivity",
              netuid,
              subnetName: label,
              message:
                `${emoji} *Whale Activity Alert*\n` +
                `*${label}*\n\n` +
                `Whales are ${action}.\n\n` +
                `This is based on large TAO flow movements detected in the last 24h.\n\n` +
                `[View on flow page →](${BASE_URL}/flow)`,
            });
            recordAlert(lastAlertedAt, hash, "whaleActivity", netuid);
            totalAlerts++;
          }
        }
      }
    }

    // ── New signals (event-based — processedIds dedup) ────────────────
    if (settings.newSignal?.enabled && scan.signals?.length) {
      const watchlistSet = new Set(watchlist);
      for (const signal of scan.signals) {
        if (!watchlistSet.has(signal.netuid)) continue;
        const signalId = signal.id;
        if (!signalId || processedSignalIds.has(signalId)) continue;

        const entry = scanByNetuid.get(signal.netuid);
        const label = entry ? subnetLabel(entry) : `SN${signal.netuid}`;
        const strengthLabel = signal.strength >= 80 ? "🔥 Strong signal" : signal.strength >= 60 ? "✅ Medium signal" : "📌 Weak signal";

        await enqueueAlert(hash, {
          type: "newSignal",
          netuid: signal.netuid,
          subnetName: label,
          message:
            `🔮 *New Alpha Signal*\n` +
            `*${label}*\n\n` +
            `*${signal.title}*\n` +
            `${strengthLabel} (${signal.strength}/100)\n\n` +
            `AlphaGap detected this signal from on-chain activity, dev commits, and market data.\n\n` +
            `[View all signals →](${BASE_URL}/signals)`,
        });
        totalAlerts++;
      }
    }

    // ── Going viral on X (event-based — processedIds dedup) ──────────
    if (settings.goingViralX?.enabled && socialHot?.events?.length) {
      const watchlistSet = new Set(watchlist);
      for (const event of socialHot.events) {
        if (!watchlistSet.has(event.netuid)) continue;
        if (event.heat_score < 70) continue;
        if (processedTweetIds.has(event.tweet_id)) continue;

        const entry = scanByNetuid.get(event.netuid);
        const label = entry ? subnetLabel(entry) : event.subnet_name || `SN${event.netuid}`;

        await enqueueAlert(hash, {
          type: "goingViralX",
          netuid: event.netuid,
          subnetName: label,
          message:
            `𝕏 *Going Viral on X*\n` +
            `*${label}*\n\n` +
            `@${event.kol_handle} posted about this subnet and it's picking up traction.\n` +
            `Heat score: *${event.heat_score}/100*\n\n` +
            `[View tweet →](${event.tweet_url})\n` +
            `[See all social activity →](${BASE_URL}/social)`,
        });
        totalAlerts++;
      }
    }

    // ── Discord entry (event-based — processedIds dedup) ─────────────
    if (settings.discordEntry?.enabled && discordLatest?.results?.length) {
      const watchlistSet = new Set(watchlist);
      for (const entry of discordLatest.results) {
        if (entry.netuid == null || !watchlistSet.has(entry.netuid)) continue;
        if (entry.alphaScore < 70) continue;
        const key = `${entry.netuid}:${entry.scannedAt}`;
        if (processedDiscordKeys.has(key)) continue;

        const scanEntry = scanByNetuid.get(entry.netuid);
        const label = scanEntry ? subnetLabel(scanEntry) : entry.subnetName || `SN${entry.netuid}`;

        await enqueueAlert(hash, {
          type: "discordEntry",
          netuid: entry.netuid,
          subnetName: label,
          message:
            `💬 *Discord Activity Alert*\n` +
            `*${label}*\n\n` +
            `${entry.summary}\n\n` +
            `Alpha score: *${entry.alphaScore}/100* — meaningful alpha discussion is happening in this subnet's Discord right now.\n\n` +
            `[View on social page →](${BASE_URL}/social)`,
        });
        totalAlerts++;
      }
    }
  }

  // Mark processed event IDs after all users handled
  for (const signal of scan.signals ?? []) {
    if (signal.id) processedSignalIds.add(signal.id);
  }
  for (const event of socialHot?.events ?? []) {
    if (event.heat_score >= 70) processedTweetIds.add(event.tweet_id);
  }
  for (const entry of discordLatest?.results ?? []) {
    if (entry.netuid != null && entry.alphaScore >= 70) {
      processedDiscordKeys.add(`${entry.netuid}:${entry.scannedAt}`);
    }
  }

  // Build new subnet snapshot
  const newSubnets: Record<string, SubnetState> = {};
  for (const entry of scan.leaderboard) {
    newSubnets[String(entry.netuid)] = {
      score: entry.composite_score,
      emission: entry.emission_pct ?? 0,
      price: entry.alpha_price ?? 0,
      whaleSignal: entry.whale_signal ?? null,
    };
  }

  // ── Single state write — happens ONCE, at the end, after all alerts fired ──
  // This is critical: writing state before processing (the old pattern) caused
  // stale prevWhale/prevScore values to persist when the handler timed out,
  // leading to the same alert firing on every subsequent run.
  await writeBlob("alert-scanner-state.json", {
    lastRunAt: new Date().toISOString(),
    subnets: newSubnets,
    processedSignalIds: [...processedSignalIds].slice(-5000),
    processedTweetIds: [...processedTweetIds].slice(-5000),
    processedDiscordKeys: [...processedDiscordKeys].slice(-5000),
    lastAlertedAt: pruneLastAlertedAt(lastAlertedAt),
  } satisfies ScannerState);

  const duration = Date.now() - t0;
  console.log(`[alert-scanner] Done in ${duration}ms. ${connectedHashes.length} users, ${totalAlerts} alerts enqueued.`);

  return NextResponse.json({
    ok: true,
    users: connectedHashes.length,
    alertsEnqueued: totalAlerts,
    duration_ms: duration,
  });
}
