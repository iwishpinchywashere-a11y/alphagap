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
  whale_ratio?: number; // avg buy size / avg sell size — higher = stronger signal
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
   */
  lastAlertedAt: Record<string, string>;
  /**
   * The price_change_24h value at the time of the last priceMove alert.
   * Key: "{userHash}:{netuid}"  →  price_change_24h % when we last alerted.
   * Used to prevent re-alerting when the 24h metric barely shifted
   * (e.g. +15% alert → +16% an hour later should NOT fire again).
   */
  lastAlertPriceChange: Record<string, number>;
}

/**
 * Separate lock blob — written immediately at the START of each run.
 * Stored in a different file from ScannerState so claiming the run
 * never corrupts the main state (which is only written at the end).
 */
interface ScannerLock {
  lockedAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** 60-minute hard cooldown per user per subnet per alert type */
const ALERT_COOLDOWN_MS = 60 * 60_000;

/** Minimum seconds between scanner runs — enforced by the lock blob */
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

  // ── Run lock (separate blob, written immediately) ─────────────────────────
  // We read and write a dedicated lock blob BEFORE reading main state.
  // This is the mutex that prevents concurrent scanner runs from racing past
  // the cooldown check. The lock blob is small (just a timestamp) and is
  // written before we do any meaningful work. The main state blob is NEVER
  // written early — only once, at the end, after all alerts are processed.
  //
  // Without this: two concurrent invocations both read prevState.lastRunAt,
  // both see "5 minutes have passed", both proceed, and both send the same
  // alerts. The lock blob is the atomic claim that prevents this.
  const [lock, prevState, scan, socialHot, discordLatest] = await Promise.all([
    readBlob<ScannerLock>("alert-scanner-lock.json"),
    readBlob<ScannerState>("alert-scanner-state.json"),
    readBlob<ScanLatest>("scan-latest.json"),
    readBlob<SocialHot>("social-hot.json"),
    readBlob<DiscordLatest>("discord-latest.json"),
  ]);

  // ── Global run cooldown (enforced by lock blob) ───────────────────────────
  if (lock?.lockedAt) {
    const secondsSinceLast = (Date.now() - new Date(lock.lockedAt).getTime()) / 1000;
    if (secondsSinceLast < RUN_COOLDOWN_SECONDS) {
      console.log(`[alert-scanner] Last run was ${secondsSinceLast.toFixed(0)}s ago — skipping (cooldown)`);
      return NextResponse.json({ ok: true, skipped: `cooldown (${secondsSinceLast.toFixed(0)}s since last run)` });
    }
  }

  // Claim the run — write the lock NOW (before any alert processing).
  // Any concurrent invocation that reads this lock after this write will see
  // a fresh timestamp and bail out. This blob contains NO state data, so
  // writing it here cannot corrupt the main ScannerState.
  await writeBlob("alert-scanner-lock.json", { lockedAt: new Date().toISOString() } satisfies ScannerLock);

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
  // lastAlertPriceChange: tracks the price_change_24h value at last priceMove alert
  const lastAlertPriceChange: Record<string, number> = { ...(prevState?.lastAlertPriceChange ?? {}) };

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
      // Two independent guards must BOTH pass before alerting:
      //
      // 1. Time cooldown:
      //    Normal move (>= threshold, < 2× threshold): 24h cooldown (once per day)
      //    Huge move   (>= 2× threshold, e.g. 20%+ at default 10%): 4h cooldown
      //
      // 2. Value delta guard: the price_change_24h metric must have shifted by
      //    at least MIN_PRICE_CHANGE_DELTA pts since the last alert. This stops
      //    "still up 16% in 24h" re-alerts when the metric barely moved.
      if (settings.priceMove?.enabled && current.price_change_24h != null) {
        const threshold = settings.priceMove.threshold ?? 10;
        const MIN_PRICE_CHANGE_DELTA = 5; // require ≥5 pt shift since last alert
        if (Math.abs(current.price_change_24h) >= threshold) {
          const prevPrice = prev?.price ?? 0;
          const currentPrice = current.alpha_price ?? 0;
          const priceChanged = Math.abs(currentPrice - prevPrice) / Math.max(prevPrice, 0.000001) > 0.01;
          if (priceChanged) {
            const pmKey = `${hash}:priceMove:${netuid}`;
            const pmLastSent = lastAlertedAt[pmKey];
            const pmElapsed = pmLastSent ? Date.now() - new Date(pmLastSent).getTime() : Infinity;
            const isHugeMove = Math.abs(current.price_change_24h) >= threshold * 2;
            const pmCooldownMs = isHugeMove
              ? 4 * 60 * 60_000   // 4 hours for huge moves
              : 24 * 60 * 60_000; // 24 hours for normal moves

            // Value delta guard: how much has price_change_24h shifted since last alert?
            const pcKey = `${hash}:${netuid}`;
            const lastPc = lastAlertPriceChange[pcKey];
            const pcDelta = lastPc != null ? Math.abs(current.price_change_24h - lastPc) : Infinity;

            if (pmElapsed < pmCooldownMs) {
              console.log(
                `[alert-scanner] priceMove SN${netuid} → ${hash.slice(0, 8)} suppressed ` +
                `(${isHugeMove ? "huge-move 4h" : "normal 24h"} cooldown, ` +
                `${(pmElapsed / 3_600_000).toFixed(1)}h elapsed)`
              );
            } else if (pcDelta < MIN_PRICE_CHANGE_DELTA) {
              console.log(
                `[alert-scanner] priceMove SN${netuid} → ${hash.slice(0, 8)} suppressed ` +
                `(24h metric barely shifted: was ${lastPc?.toFixed(1)}% now ${current.price_change_24h.toFixed(1)}%, delta ${pcDelta.toFixed(1)}pt < ${MIN_PRICE_CHANGE_DELTA}pt required)`
              );
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
                  `[View subnet →](${subnetUrl})`,
              });
              recordAlert(lastAlertedAt, hash, "priceMove", netuid);
              lastAlertPriceChange[pcKey] = current.price_change_24h;
              totalAlerts++;
            }
          }
        }
      }

      // Whale activity — only fire for strong signals (whale_ratio >= 3).
      // whale_ratio is avg buy size / avg sell size; 3× means buys are 3x
      // larger than sells (or vice versa), filtering out weak/noisy signals.
      const whaleRatio = current.whale_ratio ?? 0;
      if (
        settings.whaleActivity?.enabled &&
        current.whale_signal &&
        whaleRatio >= 3
      ) {
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

    // ── New signals (time-based dedup via created_at vs lastRunAt) ───
    // NOTE: Signal IDs auto-increment from 1 on EVERY scan run and cannot
    // be used for dedup — every ID immediately collides with the previous
    // run's IDs. Instead we filter by created_at > prevState.lastRunAt so
    // only signals that appeared since the last scanner run are alerted on.
    //
    // Only dev/research signals (dev_spike, hf_update) fire here — they
    // represent GitHub commits and HuggingFace updates and link to /signals.
    // Flow-type signals (flow_spike, flow_inflection, flow_warning) belong
    // on the /flow page and are covered by the whaleActivity alert above.
    if (settings.newSignal?.enabled && scan.signals?.length) {
      const watchlistSet = new Set(watchlist);
      for (const signal of scan.signals) {
        if (!watchlistSet.has(signal.netuid)) continue;

        // Skip flow signals — those belong to the /flow page, not /signals
        if (signal.signal_type?.startsWith("flow_")) continue;

        // Skip signals that already existed in the previous run.
        // If created_at or lastRunAt is absent, allow through (first run / legacy data).
        if (signal.created_at && prevState?.lastRunAt) {
          if (new Date(signal.created_at) <= new Date(prevState.lastRunAt)) continue;
        }

        const entry = scanByNetuid.get(signal.netuid);
        const label = entry ? subnetLabel(entry) : `SN${signal.netuid}`;
        const strengthLabel = signal.strength >= 80 ? "🔥 Strong signal" : signal.strength >= 60 ? "✅ Medium signal" : "📌 Weak signal";
        const sourceLabel = signal.signal_type === "hf_update" ? "HuggingFace model update" : "GitHub dev activity";

        await enqueueAlert(hash, {
          type: "newSignal",
          netuid: signal.netuid,
          subnetName: label,
          message:
            `🔮 *New Alpha Signal*\n` +
            `*${label}*\n\n` +
            `*${signal.title}*\n` +
            `${strengthLabel} (${signal.strength}/100)\n\n` +
            `Source: ${sourceLabel}\n\n` +
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
  // NOTE: processedSignalIds is intentionally NOT updated here — signal IDs
  // auto-increment from 1 on every run and cannot be used for dedup.
  // Signal dedup is handled above via created_at > prevState.lastRunAt.
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
    lastAlertPriceChange,
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
