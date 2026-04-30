/**
 * GET /api/cron/alert-scanner
 *
 * Runs every 5 minutes (also triggered directly from /api/scan,
 * social-pulse, and discord-scan for near-real-time delivery).
 *
 * Compares latest scan data against the previous snapshot and
 * enqueues Telegram alerts for users whose watchlist subnets
 * have crossed their configured thresholds.
 *
 * Alert types:
 *   scoreChange    — aGap composite score moved by >= threshold pts
 *   emissionChange — emission % moved by >= threshold %
 *   priceMove      — 24h price change >= threshold %
 *   whaleActivity  — whale signal appeared / changed
 *   newSignal      — new alpha signal generated
 *   goingViralX    — new high-heat KOL tweet (heat_score >= 70)
 *   discordEntry   — new high-quality Discord entry (alphaScore >= 70)
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
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function subnetLabel(entry: ScanEntry): string {
  const name = entry.subnet_name || entry.name;
  return name ? `${name} (SN${entry.netuid})` : `SN${entry.netuid}`;
}

const BASE_URL = "https://alphagap.io";

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

  // ── 3-minute cooldown ─────────────────────────────────────────────────────
  // The scanner is triggered by both the 5-min cron AND fire-and-forget calls
  // from /api/scan, social-pulse, and discord-scan. Multiple invocations can
  // overlap. The enqueueAlert dedup (15-min window) is the primary guard, but
  // this cooldown avoids redundant full runs entirely.
  if (prevState?.lastRunAt) {
    const secondsSinceLast = (Date.now() - new Date(prevState.lastRunAt).getTime()) / 1000;
    if (secondsSinceLast < 180) {
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

  const prevSubnets: Record<string, SubnetState> = prevState?.subnets ?? {};
  const processedSignalIds = new Set<number>(prevState?.processedSignalIds ?? []);
  const processedTweetIds = new Set<string>(prevState?.processedTweetIds ?? []);
  const processedDiscordKeys = new Set<string>(prevState?.processedDiscordKeys ?? []);

  // Claim the run immediately — write lastRunAt NOW so any concurrent instance
  // that reads the state after this point will see the cooldown and bail out.
  await writeBlob("alert-scanner-state.json", {
    ...(prevState ?? { subnets: {}, processedSignalIds: [], processedTweetIds: [], processedDiscordKeys: [] }),
    lastRunAt: new Date().toISOString(),
  });

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

    // ── Per-subnet alerts ────────────────────────────────────────────
    for (const netuid of watchlist) {
      const current = scanByNetuid.get(netuid);
      if (!current) continue;

      const prev = prevSubnets[String(netuid)];
      const label = subnetLabel(current);
      const subnetUrl = `${BASE_URL}/subnet/${netuid}`;

      // aGap score change
      if (settings.scoreChange?.enabled && prev) {
        const threshold = settings.scoreChange.threshold ?? 10;
        const delta = current.composite_score - prev.score;
        if (Math.abs(delta) >= threshold) {
          const dir = delta > 0 ? "📈" : "📉";
          const sign = delta > 0 ? "+" : "";
          await enqueueAlert(hash, {
            type: "scoreChange",
            netuid,
            subnetName: label,
            message:
              `${dir} *aGap Score Alert*\n` +
              `*${label}*\n\n` +
              `Score moved ${sign}${delta.toFixed(1)} pts and is now *${current.composite_score.toFixed(1)}/100*\.\n\n` +
              `The aGap score combines on\\-chain flow, dev activity, social signals, emissions, and market momentum\\.\n\n` +
              `[View subnet →](${subnetUrl})`,
          });
          totalAlerts++;
        }
      }

      // Emission change
      if (settings.emissionChange?.enabled && prev && current.emission_pct != null) {
        const threshold = settings.emissionChange.threshold ?? 25;
        const delta = current.emission_pct - prev.emission;
        if (Math.abs(delta) >= threshold) {
          const dir = delta > 0 ? "⬆️" : "⬇️";
          const sign = delta > 0 ? "+" : "";
          const context = delta > 0
            ? "Higher emissions mean more TAO is being distributed to this subnet's miners and validators\\."
            : "Lower emissions mean this subnet is receiving a smaller share of total TAO output\\.";
          await enqueueAlert(hash, {
            type: "emissionChange",
            netuid,
            subnetName: label,
            message:
              `⚡ *Emissions Alert*\n` +
              `*${label}*\n\n` +
              `Emissions moved ${dir} ${sign}${delta.toFixed(2)}% and are now *${current.emission_pct.toFixed(2)}%* of total TAO output\\.\n\n` +
              `${context}\n\n` +
              `[View subnet →](${subnetUrl})`,
          });
          totalAlerts++;
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
            const dir = current.price_change_24h > 0 ? "📈" : "📉";
            const sign = current.price_change_24h > 0 ? "+" : "";
            await enqueueAlert(hash, {
              type: "priceMove",
              netuid,
              subnetName: label,
              message:
                `💰 *Price Alert*\n` +
                `*${label}*\n\n` +
                `The alpha token price moved *${sign}${current.price_change_24h.toFixed(1)}%* in the last 24 hours\\.` +
                `${currentPrice ? `\nCurrent price: $${currentPrice.toFixed(4)}` : ""}\n\n` +
                `[View on flow page →](${BASE_URL}/flow)`,
            });
            totalAlerts++;
          }
        }
      }

      // Whale activity
      if (settings.whaleActivity?.enabled && current.whale_signal) {
        const prevWhale = prev?.whaleSignal ?? null;
        if (current.whale_signal !== prevWhale) {
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
              `Whales are ${action}\\.\n\n` +
              `This is based on large TAO flow movements detected in the last 24h\\.\n\n` +
              `[View on flow page →](${BASE_URL}/flow)`,
          });
          totalAlerts++;
        }
      }
    }

    // ── New signals ──────────────────────────────────────────────────
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
            `${strengthLabel} \\(${signal.strength}/100\\)\n\n` +
            `AlphaGap detected this signal from on\\-chain activity, dev commits, and market data\\.\n\n` +
            `[View all signals →](${BASE_URL}/signals)`,
        });
        totalAlerts++;
      }
    }

    // ── Going viral on X ─────────────────────────────────────────────
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
            `@${event.kol_handle} posted about this subnet and it's picking up traction\\.\n` +
            `Heat score: *${event.heat_score}/100*\n\n` +
            `[View tweet →](${event.tweet_url})\n` +
            `[See all social activity →](${BASE_URL}/social)`,
        });
        totalAlerts++;
      }
    }

    // ── Discord entry ────────────────────────────────────────────────
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
            `Alpha score: *${entry.alphaScore}/100* — meaningful alpha discussion is happening in this subnet's Discord right now\\.\n\n` +
            `[View on social page →](${BASE_URL}/social)`,
        });
        totalAlerts++;
      }
    }
  }

  // Mark processed IDs after all users handled (prevents double-alerting in the same run)
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

  // Save state snapshot (bounded to last 5000 IDs each)
  const newSubnets: Record<string, SubnetState> = {};
  for (const entry of scan.leaderboard) {
    newSubnets[String(entry.netuid)] = {
      score: entry.composite_score,
      emission: entry.emission_pct ?? 0,
      price: entry.alpha_price ?? 0,
      whaleSignal: entry.whale_signal ?? null,
    };
  }

  await writeBlob("alert-scanner-state.json", {
    lastRunAt: new Date().toISOString(),
    subnets: newSubnets,
    processedSignalIds: [...processedSignalIds].slice(-5000),
    processedTweetIds: [...processedTweetIds].slice(-5000),
    processedDiscordKeys: [...processedDiscordKeys].slice(-5000),
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
