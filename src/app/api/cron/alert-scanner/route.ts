/**
 * GET /api/cron/alert-scanner
 *
 * Runs every 10 minutes. Compares the latest scan data against the previous
 * run's snapshot and enqueues Telegram alerts for users whose watchlist
 * subnets have crossed their configured thresholds.
 *
 * Alert types handled:
 *   scoreChange    — aGap composite score moved by >= threshold pts
 *   emissionChange — emission % moved by >= threshold %
 *   priceMove      — 24h price change >= threshold %
 *   whaleActivity  — whale signal appeared (accumulating / distributing)
 *   newSignal      — new alpha signal generated for a subnet
 *   goingViralX    — new high-heat KOL tweet (heat_score >= 70) on social-hot
 *   discordEntry   — new high-quality Discord entry (alphaScore >= 70) on discord-latest
 */

import { NextRequest, NextResponse } from "next/server";
import { list as blobList, get as blobGet, put as blobPut } from "@vercel/blob";
import {
  enqueueAlert,
  getTelegramConnectionByHash,
  type AlertSettings,
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
  subnets: Record<string, SubnetState>;    // keyed by netuid string
  processedSignalIds: number[];            // signal IDs already alerted
  processedTweetIds: string[];             // tweet_ids already alerted
  processedDiscordKeys: string[];          // "netuid:scannedAt" already alerted
}

// ── Subnet name helper ────────────────────────────────────────────────────────

function subnetLabel(entry: ScanEntry): string {
  const name = entry.subnet_name || entry.name;
  return name ? `${name} (SN${entry.netuid})` : `SN${entry.netuid}`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();

  // 1. Load all data sources in parallel
  const [scan, prevState, socialHot, discordLatest] = await Promise.all([
    readBlob<ScanLatest>("scan-latest.json"),
    readBlob<ScannerState>("alert-scanner-state.json"),
    readBlob<SocialHot>("social-hot.json"),
    readBlob<DiscordLatest>("discord-latest.json"),
  ]);

  if (!scan?.leaderboard?.length) {
    console.log("[alert-scanner] No scan data available, skipping.");
    return NextResponse.json({ ok: true, skipped: "no scan data" });
  }

  // Build lookup maps
  const scanByNetuid = new Map<number, ScanEntry>(
    scan.leaderboard.map(e => [e.netuid, e])
  );

  const prevSubnets: Record<string, SubnetState> = prevState?.subnets ?? {};
  const processedSignalIds = new Set<number>(prevState?.processedSignalIds ?? []);
  const processedTweetIds = new Set<string>(prevState?.processedTweetIds ?? []);
  const processedDiscordKeys = new Set<string>(prevState?.processedDiscordKeys ?? []);

  // 2. List all Telegram-connected users
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
      const hash = blob.pathname.replace("telegram-settings/", "").replace(".json", "");
      connectedHashes.push(hash);
    }
    cursor = page.cursor;
  } while (cursor);

  // 3. For each user, check their watchlist and enqueue triggered alerts
  let totalAlerts = 0;

  for (const hash of connectedHashes) {
    const conn = await getTelegramConnectionByHash(hash);
    if (!conn?.chatId || !conn.settings?.enabled) continue;

    const settings = conn.settings;

    // Load watchlist
    const watchlistData = await readBlob<{ netuids: number[] }>(`watchlists/${hash}.json`);
    const watchlist = watchlistData?.netuids ?? [];
    if (!watchlist.length) continue;

    // Check each watched subnet against each alert type
    for (const netuid of watchlist) {
      const current = scanByNetuid.get(netuid);
      if (!current) continue;

      const prev = prevSubnets[String(netuid)];
      const label = subnetLabel(current);

      // ── aGap score change ────────────────────────────────────────
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
            message: `${dir} *aGap Score Alert — ${label}*\n\nScore moved ${sign}${delta.toFixed(1)} pts → now *${current.composite_score.toFixed(1)}*`,
          });
          totalAlerts++;
        }
      }

      // ── Emission change ──────────────────────────────────────────
      if (settings.emissionChange?.enabled && prev && current.emission_pct != null) {
        const threshold = settings.emissionChange.threshold ?? 25;
        const delta = current.emission_pct - prev.emission;
        if (Math.abs(delta) >= threshold) {
          const dir = delta > 0 ? "⬆️" : "⬇️";
          const sign = delta > 0 ? "+" : "";
          await enqueueAlert(hash, {
            type: "emissionChange",
            netuid,
            subnetName: label,
            message: `⚡ *Emission Alert — ${label}*\n\nEmissions ${dir} ${sign}${delta.toFixed(2)}% → now *${current.emission_pct.toFixed(2)}%*`,
          });
          totalAlerts++;
        }
      }

      // ── Price movement ───────────────────────────────────────────
      if (settings.priceMove?.enabled && current.price_change_24h != null) {
        const threshold = settings.priceMove.threshold ?? 10;
        if (Math.abs(current.price_change_24h) >= threshold) {
          // Only alert if this is a new price event (price changed since last run)
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
              message: `💰 *Price Alert — ${label}*\n\n24h price change: *${sign}${current.price_change_24h.toFixed(1)}%*${currentPrice ? `\nCurrent price: $${currentPrice.toFixed(4)}` : ""}`,
            });
            totalAlerts++;
          }
        }
      }

      // ── Whale activity ───────────────────────────────────────────
      if (settings.whaleActivity?.enabled && current.whale_signal) {
        const prevWhale = prev?.whaleSignal ?? null;
        if (current.whale_signal !== prevWhale) {
          const emoji = current.whale_signal === "accumulating" ? "🐋" : "🔴";
          const action = current.whale_signal === "accumulating" ? "Whales accumulating" : "Whales distributing";
          await enqueueAlert(hash, {
            type: "whaleActivity",
            netuid,
            subnetName: label,
            message: `${emoji} *Whale Activity — ${label}*\n\n${action} detected on the flow page`,
          });
          totalAlerts++;
        }
      }
    }

    // ── New signals ────────────────────────────────────────────────
    if (settings.newSignal?.enabled && scan.signals?.length) {
      const watchlistSet = new Set(watchlist);
      for (const signal of scan.signals) {
        if (!watchlistSet.has(signal.netuid)) continue;
        const signalId = signal.id;
        if (!signalId || processedSignalIds.has(signalId)) continue;

        const entry = scanByNetuid.get(signal.netuid);
        const label = entry ? subnetLabel(entry) : `SN${signal.netuid}`;
        const strengthLabel = signal.strength >= 80 ? "🔥 Strong" : signal.strength >= 60 ? "✅ Medium" : "📌 Weak";

        await enqueueAlert(hash, {
          type: "newSignal",
          netuid: signal.netuid,
          subnetName: label,
          message: `🔮 *New Signal — ${label}*\n\n*${signal.title}*\n${strengthLabel} (${signal.strength}/100)\n\nView at alphagap.io/signals`,
        });
        totalAlerts++;
      }
    }

    // ── Going viral on X ───────────────────────────────────────────
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
          message: `𝕏 *Going Viral — ${label}*\n\n@${event.kol_handle} posted about this subnet\nHeat score: *${event.heat_score}/100*\n\n[View tweet](${event.tweet_url})`,
        });
        totalAlerts++;
      }
    }

    // ── Discord entry ──────────────────────────────────────────────
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
          message: `💬 *Discord Activity — ${label}*\n\n${entry.summary}\n\nAlpha score: *${entry.alphaScore}/100*\nView at alphagap.io/social`,
        });
        totalAlerts++;
      }
    }
  }

  // 4. Mark newly processed IDs (collect after processing all users so we don't double-alert)
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

  // 5. Save new state snapshot
  const newSubnets: Record<string, SubnetState> = {};
  for (const entry of scan.leaderboard) {
    newSubnets[String(entry.netuid)] = {
      score: entry.composite_score,
      emission: entry.emission_pct ?? 0,
      price: entry.alpha_price ?? 0,
      whaleSignal: entry.whale_signal ?? null,
    };
  }

  // Keep processed ID lists bounded (last 5000)
  const newState: ScannerState = {
    lastRunAt: new Date().toISOString(),
    subnets: newSubnets,
    processedSignalIds: [...processedSignalIds].slice(-5000),
    processedTweetIds: [...processedTweetIds].slice(-5000),
    processedDiscordKeys: [...processedDiscordKeys].slice(-5000),
  };

  await writeBlob("alert-scanner-state.json", newState);

  const duration = Date.now() - t0;
  console.log(`[alert-scanner] Done in ${duration}ms. ${connectedHashes.length} users checked, ${totalAlerts} alerts enqueued.`);

  return NextResponse.json({
    ok: true,
    users: connectedHashes.length,
    alertsEnqueued: totalAlerts,
    duration_ms: duration,
  });
}
