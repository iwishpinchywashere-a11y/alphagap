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
 *   whaleActivity  — whale signal appeared / changed OR unusual volume surge
 *   newSignal      — new alpha signal generated
 *   goingViralX    — new high-heat KOL tweet (heat_score >= 40)
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
 * Event-based alerts (newSignal, goingViralX, discordEntry, volumeSurge) use
 * processedIds sets — these are one-fire-per-event and don't need the cooldown.
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
  /** Actual Discord message timestamp — stable across scan cycles */
  lastActivityAt?: string;
  /** True for Const (Bittensor founder) posts — always alert regardless of watchlist */
  founderPost?: boolean;
  channelName?: string;
}

interface DiscordLatest {
  results: DiscordEntry[];
  scannedAt?: string;
}

interface FlowEvent {
  netuid: number;
  name: string;
  type: "accumulating" | "distributing" | "volume_surge" | "yield_spike" | "yield_dip";
  strength: number;
  headline: string;
  detail: string;
  volumeRatio?: number;
  /** "2026-04-30" — calendar-day dedup key */
  dayKey: string;
  detectedAt: string;
}

interface FlowEventsStore {
  events: FlowEvent[];
  updatedAt?: string;
}

interface DeletedMessage {
  id: string;
  netuid: number | null;
  subnetName: string;
  content: string;
  username: string;
  detectedAt: string;
  significant: boolean;
  sinister: boolean;
  significance: string;
}

interface DeletedMessagesBlob {
  updatedAt?: string;
  messages: DeletedMessage[];
}

interface ConstTrackerData {
  events: Array<{
    id: string;
    type: "buy" | "sell";
    wallet: string;
    netuid: number;
    subnetName?: string;
    amountTao: number;
    amountUsd: number;
    detectedAt: string;
  }>;
  updatedAt?: string;
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
  /** Composite dedup keys for newSignal alerts: "{netuid}:{signal_type}:{title[:50]}" */
  processedSignalKeys: string[];
  processedTweetIds: string[];
  processedDiscordKeys: string[];
  /** Dedup keys for volume surge alerts: "{netuid}:volume_surge:{dayKey}" */
  processedVolumeKeys: string[];
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
  processedConstIds: string[];
  processedDeletedIds: string[];
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

/** 60-minute hard cooldown per user per subnet per alert type (general) */
const ALERT_COOLDOWN_MS = 60 * 60_000;

/** 4-hour cooldown for whale activity alerts.
 *  Whale ratios near the 0.5/1.5 threshold frequently oscillate null→distributing→null
 *  across consecutive scans — a 60-min cooldown is too short to absorb that noise.
 *  4 hours ensures one alert per meaningful move, not per oscillation tick. */
const WHALE_COOLDOWN_MS = 4 * 60 * 60_000;

/** 6-hour cooldown for Discord entry alerts — scanner re-scans every ~3h and
 *  the AI rewrites summaries slightly each cycle, causing false "new" entries.
 *  A longer cooldown ensures the same subnet doesn't spam across multiple scan cycles. */
const DISCORD_COOLDOWN_MS = 6 * 60 * 60_000;

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
 * Whale activity has its own longer cooldown to prevent oscillation spam.
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
  const cooldown = alertType === "whaleActivity" ? WHALE_COOLDOWN_MS
    : alertType === "discordEntry" ? DISCORD_COOLDOWN_MS
    : ALERT_COOLDOWN_MS;
  return Date.now() - new Date(lastSent).getTime() < cooldown;
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
 * Prune lastAlertedAt entries older than the longest cooldown window (+ buffer) to
 * keep the blob from growing unboundedly. Keeps at most 2000 entries.
 *
 * IMPORTANT: must use the LONGEST cooldown in the system as the retention window.
 * discordEntry uses DISCORD_COOLDOWN_MS (6h) — if we prune at ALERT_COOLDOWN_MS×2 (2h),
 * the discord cooldown entry disappears before the 6h window expires, allowing
 * the same subnet to fire again when the time bucket rolls over (e.g. 4:59→6:01 AM).
 */
function pruneLastAlertedAt(lastAlertedAt: Record<string, string>): Record<string, string> {
  const longestCooldown = Math.max(ALERT_COOLDOWN_MS, WHALE_COOLDOWN_MS, DISCORD_COOLDOWN_MS); // 6h
  const cutoff = Date.now() - longestCooldown * 2; // keep 12h as buffer
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
  const [lock, prevState, scan, socialHot, discordLatest, flowEvents, constData, deletedData] = await Promise.all([
    readBlob<ScannerLock>("alert-scanner-lock.json"),
    readBlob<ScannerState>("alert-scanner-state.json"),
    readBlob<ScanLatest>("scan-latest.json"),
    readBlob<SocialHot>("social-hot.json"),
    readBlob<DiscordLatest>("discord-latest.json"),
    readBlob<FlowEventsStore>("flow-events.json"),
    readBlob<ConstTrackerData>("const-latest.json"),
    readBlob<DeletedMessagesBlob>("discord-deleted.json"),
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
  const processedSignalKeys = new Set<string>(prevState?.processedSignalKeys ?? []);
  const processedTweetIds = new Set<string>(prevState?.processedTweetIds ?? []);
  const processedDiscordKeys = new Set<string>(prevState?.processedDiscordKeys ?? []);
  const processedVolumeKeys = new Set<string>(prevState?.processedVolumeKeys ?? []);

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
  const processedConstIds = new Set<string>(prevState?.processedConstIds ?? []);
  const processedDeletedIds = new Set<string>(prevState?.processedDeletedIds ?? []);
  const firedDeletedIds = new Set<string>();

  // Track discord keys that actually fired an alert (not just seen).
  // Only fired keys are added to processedDiscordKeys at end-of-run.
  // Avoids marking entries as processed when no user received the alert
  // (e.g. discordEntry disabled), which would block future users from seeing them.
  const firedDiscordKeys = new Set<string>();
  const firedConstIds = new Set<string>();

  for (const hash of connectedHashes) {
    const conn = await getTelegramConnectionByHash(hash);
    if (!conn?.chatId || !conn.settings?.enabled) continue;

    const settings = conn.settings;

    const watchlistData = await readBlob<{ netuids: number[] }>(`watchlists/${hash}.json`);
    const watchlist = watchlistData?.netuids ?? [];
    // NOTE: do NOT early-exit on empty watchlist here. Non-watchlist alerts
    // (discordEntry founder posts, constActivity, walletTracker) must still fire
    // for users who haven't added any subnets. Per-subnet sections handle the
    // empty case naturally — they just iterate over zero items.

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

      // Whale activity — fire for meaningful signals on either side.
      // whale_ratio = avg buy size / avg sell size:
      //   accumulating signal: ratio >= 1.5 (scan threshold), alert at >= 2.0 (quality bar)
      //   distributing signal: ratio <= 0.5 (scan threshold), alert at any distributing signal
      // BUG FIX: old check was `whaleRatio >= 3` which never fired for distributing
      // (ratio ≤ 0.5) and was too high for most accumulation signals (1.5–2.9 range).
      const whaleRatio = current.whale_ratio ?? 0;
      const isAlertableWhale =
        (current.whale_signal === "accumulating" && whaleRatio >= 2.0) ||
        (current.whale_signal === "distributing" && whaleRatio <= 0.5);
      if (
        settings.whaleActivity?.enabled &&
        current.whale_signal &&
        isAlertableWhale
      ) {
        const prevWhale = prev?.whaleSignal ?? null;
        if (current.whale_signal !== prevWhale) {
          if (onCooldown(lastAlertedAt, hash, "whaleActivity", netuid)) {
            console.log(`[alert-scanner] whaleActivity SN${netuid} → ${hash.slice(0, 8)} suppressed (cooldown)`);
          } else {
            const emoji = current.whale_signal === "accumulating" ? "🐋" : "🔴";
            const action = current.whale_signal === "accumulating"
              ? "accumulating — large wallets staking in"
              : "distributing — large wallets unstaking";
            const ratioStr = current.whale_signal === "accumulating"
              ? `Avg buy ${whaleRatio.toFixed(1)}× larger than avg sell`
              : `Avg sell ${(1 / whaleRatio).toFixed(1)}× larger than avg buy`;
            await enqueueAlert(hash, {
              type: "whaleActivity",
              netuid,
              subnetName: label,
              message:
                `${emoji} *Whale Activity — ${label}*\n\n` +
                `Whales are *${action}*.\n` +
                `${ratioStr}.\n\n` +
                `[View on flow page →](${BASE_URL}/flow)`,
            });
            recordAlert(lastAlertedAt, hash, "whaleActivity", netuid);
            totalAlerts++;
          }
        }
      }
    }

    // ── Volume surge (event-based — processedVolumeKeys dedup) ──────
    // Reads from flow-events.json (written by flow-snapshot cron).
    // Fires once per netuid per calendar day (dayKey dedup).
    // Uses the same whaleActivity toggle — it's the "unusual volume spike" half
    // of the "Whale activity / volume spike" alert description.
    if (settings.whaleActivity?.enabled && flowEvents?.events?.length) {
      const watchlistSet = new Set(watchlist);
      for (const event of flowEvents.events) {
        if (event.type !== "volume_surge") continue;
        if (!watchlistSet.has(event.netuid)) continue;
        const volKey = `${event.netuid}:volume_surge:${event.dayKey}`;
        if (processedVolumeKeys.has(volKey)) continue;
        if (onCooldown(lastAlertedAt, hash, "whaleActivity", event.netuid)) {
          console.log(`[alert-scanner] volumeSurge SN${event.netuid} → ${hash.slice(0, 8)} suppressed (cooldown)`);
          continue;
        }

        const r = event.volumeRatio ?? "?";
        await enqueueAlert(hash, {
          type: "whaleActivity",
          netuid: event.netuid,
          subnetName: event.name,
          message:
            `🤑 *Unusual Volume Spike*\n` +
            `*${event.name}*\n\n` +
            `${event.headline}\n` +
            `${event.detail}\n\n` +
            `Strength: *${event.strength}/100* · ${r}x rolling avg volume\n\n` +
            `[View on flow page →](${BASE_URL}/flow)`,
        });
        recordAlert(lastAlertedAt, hash, "whaleActivity", event.netuid);
        totalAlerts++;
      }
    }

    // ── New signals (composite-key dedup) ────────────────────────────
    // Signal IDs auto-increment from 1 on EVERY scan run — useless for dedup.
    // created_at is optional and sometimes absent, so date-only dedup breaks.
    //
    // We use a persistent processedSignalKeys Set (stored in scanner state)
    // keyed by "netuid:signal_type:title[:50]". Each unique signal fires
    // exactly once per user, regardless of whether created_at is present.
    //
    // Only dev/research signals (dev_spike, hf_update) fire here — they
    // represent GitHub commits and HuggingFace updates and link to /signals.
    // Flow-type signals belong on /flow and are covered by whaleActivity above.
    if (settings.newSignal?.enabled && scan.signals?.length) {
      const watchlistSet = new Set(watchlist);
      const newSignalMinScore = settings.newSignal.minScore ?? 0;
      for (const signal of scan.signals) {
        if (!watchlistSet.has(signal.netuid)) continue;

        // Skip flow signals — those belong to the /flow page, not /signals
        if (signal.signal_type?.startsWith("flow_")) continue;

        // Apply user's minimum score threshold FIRST — cheap check, reject early
        if (newSignalMinScore > 0 && signal.strength < newSignalMinScore) continue;

        // Composite dedup key — stable across runs, doesn't depend on created_at
        const sigKey = `${signal.netuid}:${signal.signal_type}:${(signal.title || "").slice(0, 50)}`;
        if (processedSignalKeys.has(sigKey)) continue;

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
        // Mark as processed immediately so subsequent users in this run don't
        // get the same alert fired again (before the end-of-run state write)
        processedSignalKeys.add(sigKey);
        totalAlerts++;
      }
    }

    // ── Going viral on X (event-based — processedIds dedup) ──────────
    if (settings.goingViralX?.enabled && socialHot?.events?.length) {
      const watchlistSet = new Set(watchlist);
      const goingViralMinScore = Math.max(40, settings.goingViralX.minScore ?? 0);
      for (const event of socialHot.events) {
        if (!watchlistSet.has(event.netuid)) continue;
        if (event.heat_score < goingViralMinScore) continue;
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

    // ── Discord entry ─────────────────────────────────────────────────
    // Founder (Const Tracker) posts:
    //   - bypass watchlist gate → fires for ALL users with discordEntry enabled
    //   - bypass minScore gate → EVERY significant founder post fires
    //   - still deduped so the same post only fires once per user
    // Regular entries:
    //   - require subnet on watchlist
    //   - require alphaScore >= discordMinScore (user-set, floor 40)
    //   - require signal === "alpha" or "active" (no quiet/noise alerts)
    //   - 4h cooldown per netuid so the same channel doesn't spam every scan cycle
    //
    // Dedup key uses content fingerprint (summary slice), NOT scannedAt.
    // scannedAt changes every 3h scan cycle, making old entries look "new".
    // Summary is stable for the same actual content, preventing repeat fires.
    if (settings.discordEntry?.enabled && discordLatest?.results?.length) {
      const watchlistSet = new Set(watchlist);
      const discordMinScore = Math.max(40, settings.discordEntry.minScore ?? 0);
      for (const entry of discordLatest.results) {
        const isFounder = entry.founderPost === true;

        // Skip Const thumbs-up/down reaction messages — they fire every scan and carry no signal.
        if (isFounder) {
          const THUMBS_RE = /^[\s👍👎🤙✅❌✔✖+\-1]*$|thumbs\s*(up|down)|\+1|-1/i;
          if (THUMBS_RE.test(entry.summary ?? "")) continue;
        }

        // Signal gate: only alpha and active tier (not quiet/noise)
        if (!isFounder && entry.signal !== "alpha" && entry.signal !== "active") continue;

        // Watchlist gate: skip non-founder entries whose subnet isn't watched
        if (!isFounder && (entry.netuid == null || !watchlistSet.has(entry.netuid))) continue;

        // Score gate: founder posts bypass this — every significant Const post fires
        if (!isFounder && entry.alphaScore < discordMinScore) continue;

        // Dedup key:
        // - Founder: 48-hour epoch bucket keyed on channelName. DO NOT use
        //   lastActivityAt — it changes every discord scan as new messages arrive,
        //   causing the date to roll over midnight and produce a new key that
        //   bypasses the processedDiscordKeys set (root cause of repeated Const alerts).
        //   A 48h bucket means any two fires within 48h of each other are always the same key.
        // - Regular: use lastActivityAt truncated to hour precision ("2026-05-07T12").
        //   This is the ACTUAL Discord message timestamp — stable across scan cycles
        //   even when the AI rewrites summaries. The old approach used a wall-clock
        //   time bucket (0/6/12/18 UTC) which rotated every 6h independent of the
        //   Discord content, so a scanner run at 5:58 and another at 6:02 produced
        //   DIFFERENT keys for the same conversation → duplicate alerts despite the
        //   6h lastAlertedAt cooldown (which would catch it unless state write failed).
        //   Using lastActivityAt means "same Discord thread = same key, always."
        const bucket48h = Math.floor(Date.now() / (48 * 60 * 60 * 1000));
        // Fallback for regular entries: if lastActivityAt is absent, derive a
        // time-bucket from the current run (same behavior as before the fix).
        const now = new Date();
        const datePart = now.toISOString().slice(0, 10);
        const hourBucket = Math.floor(now.getUTCHours() / 6) * 6;
        const fallbackBucket = `${datePart}-${hourBucket}`;
        const key = isFounder
          ? `founder:${entry.channelName ?? "unknown"}:${bucket48h}`
          : `${entry.netuid}:${entry.lastActivityAt?.slice(0, 13) ?? fallbackBucket}`;
        if (processedDiscordKeys.has(key)) continue;

        // Cooldown gate for regular entries (6h) — prevents same subnet re-alerting
        // across scan cycles when the AI generates new summaries of the same discussion.
        // Founder posts bypass.
        if (!isFounder) {
          const dcKey = `${hash}:discordEntry:${entry.netuid ?? 0}`;
          const lastSent = lastAlertedAt[dcKey];
          if (lastSent && Date.now() - new Date(lastSent).getTime() < DISCORD_COOLDOWN_MS) {
            console.log(`[alert-scanner] discordEntry SN${entry.netuid} → ${hash.slice(0, 8)} suppressed (6h cooldown)`);
            continue;
          }
        }

        const scanEntry = entry.netuid != null ? scanByNetuid.get(entry.netuid) : null;
        const label = scanEntry ? subnetLabel(scanEntry) : entry.subnetName || `SN${entry.netuid}`;

        // For per-channel founder entries the channelName is "founder-const-<channelName>"
        const founderChannel = isFounder && (entry.channelName ?? "").startsWith("founder-const-")
          ? `#${entry.channelName!.replace("founder-const-", "")}`
          : null;
        const founderLocation = founderChannel
          ? `Posted in ${founderChannel}`
          : "Posted in Bittensor Discord";

        const message = isFounder
          ? `👑 *Const Tracker Alert*\n` +
            `*${founderLocation}*\n\n` +
            `${entry.summary}\n\n` +
            `Alpha score: *${entry.alphaScore}/100*\n\n` +
            `[View on social page →](${BASE_URL}/social)`
          : `💬 *Discord Activity Alert*\n` +
            `*${label}*\n\n` +
            `${entry.summary}\n\n` +
            `Alpha score: *${entry.alphaScore}/100* — meaningful alpha discussion is happening in this subnet's Discord right now.\n\n` +
            `[View on social page →](${BASE_URL}/social)`;

        await enqueueAlert(hash, {
          type: "discordEntry",
          netuid: entry.netuid ?? undefined,
          subnetName: isFounder ? "Const · Bittensor Founder" : label,
          message,
        });
        if (!isFounder) recordAlert(lastAlertedAt, hash, "discordEntry", entry.netuid ?? 0);
        firedDiscordKeys.add(key);
        totalAlerts++;
      }
    }

    // ── Deleted Discord messages ──────────────────────────────────────
    // Uses the discordEntry toggle — "just like any other Discord message"
    // Only fires for significant deletions on watched subnets
    // 6h cooldown per netuid (same as discordEntry) to prevent spam on reruns
    if (settings.discordEntry?.enabled && deletedData?.messages?.length) {
      const watchlistSet = new Set(watchlist);
      const DELETED_CUTOFF_MS = 12 * 60 * 60 * 1000; // only alert on messages detected < 12h ago
      for (const msg of deletedData.messages) {
        if (!msg.significant) continue;
        if (msg.netuid == null || !watchlistSet.has(msg.netuid)) continue;
        if (processedDeletedIds.has(msg.id)) continue;
        if (Date.now() - new Date(msg.detectedAt).getTime() > DELETED_CUTOFF_MS) continue;

        const dcKey = `${hash}:discordEntry:${msg.netuid}`;
        const lastSent = lastAlertedAt[dcKey];
        if (lastSent && Date.now() - new Date(lastSent).getTime() < DISCORD_COOLDOWN_MS) {
          console.log(`[alert-scanner] deletedMsg SN${msg.netuid} → ${hash.slice(0, 8)} suppressed (6h cooldown)`);
          continue;
        }

        const entry = scanByNetuid.get(msg.netuid);
        const label = entry ? subnetLabel(entry) : msg.subnetName || `SN${msg.netuid}`;
        const emoji = msg.sinister ? "🚨" : "⚠️";
        const truncated = msg.content.length > 200 ? msg.content.slice(0, 200) + "…" : msg.content;

        await enqueueAlert(hash, {
          type: "discordEntry",
          netuid: msg.netuid,
          subnetName: label,
          message:
            `${emoji} *Deleted Discord Message — ${label}*\n\n` +
            `@${msg.username} deleted a message that was flagged as significant.\n\n` +
            `_"${truncated}"_\n\n` +
            `${msg.significance ? `${msg.significance}\n\n` : ""}` +
            `[View on social page →](${BASE_URL}/social)`,
        });
        recordAlert(lastAlertedAt, hash, "discordEntry", msg.netuid);
        firedDeletedIds.add(msg.id);
        totalAlerts++;
      }
    }

    // ── Const founder activity ─────────────────────────────────────
    if (settings.constActivity?.enabled && constData?.events?.length) {
      const CONST_CUTOFF_MS = 6 * 60 * 60 * 1000; // only alert on events < 6h old
      for (const ev of constData.events) {
        if (processedConstIds.has(ev.id)) continue;
        if (Date.now() - new Date(ev.detectedAt).getTime() > CONST_CUTOFF_MS) continue;
        const label = ev.subnetName ?? `SN${ev.netuid}`;
        const amtStr = ev.amountTao >= 1000
          ? `${(ev.amountTao / 1000).toFixed(1)}k TAO`
          : `${ev.amountTao.toFixed(0)} TAO`;
        const usdStr = ev.amountUsd > 0 ? ` (~$${(ev.amountUsd / 1000).toFixed(0)}k)` : "";
        const emoji = ev.type === "buy" ? "👑🟢" : "👑🔴";
        const action = ev.type === "buy" ? "staked into" : "unstaked from";
        await enqueueAlert(hash, {
          type: "constActivity",
          netuid: ev.netuid,
          subnetName: label,
          message:
            `${emoji} *Const Tracker Alert*\n` +
            `*${label}*\n\n` +
            `Const (Bittensor founder) just ${action} *${label}*.\n` +
            `Amount: *${amtStr}*${usdStr}\n\n` +
            `[View on social page →](https://www.alphagap.io/flow)`,
        });
        firedConstIds.add(ev.id);
        totalAlerts++;
      }
    }
  }

  // Mark processed event IDs after all users handled.
  // processedSignalKeys was already populated inline as each signal fired.
  // processedSignalIds is kept for schema compatibility but is no longer used.
  for (const event of socialHot?.events ?? []) {
    if (event.heat_score >= 40) processedTweetIds.add(event.tweet_id);
  }
  // Only persist discord keys that ACTUALLY fired an alert this run.
  // Skipping entries that didn't fire (no user had it enabled, watchlist mismatch,
  // score too low) ensures new users / newly-enabled settings still see them.
  for (const key of firedDiscordKeys) {
    processedDiscordKeys.add(key);
  }
  for (const id of firedConstIds) {
    processedConstIds.add(id);
  }
  for (const id of firedDeletedIds) {
    processedDeletedIds.add(id);
  }
  for (const event of flowEvents?.events ?? []) {
    if (event.type === "volume_surge") {
      processedVolumeKeys.add(`${event.netuid}:volume_surge:${event.dayKey}`);
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
    processedSignalKeys: [...processedSignalKeys].slice(-5000),
    processedTweetIds: [...processedTweetIds].slice(-5000),
    processedDiscordKeys: [...processedDiscordKeys].slice(-5000),
    processedVolumeKeys: [...processedVolumeKeys].slice(-5000),
    lastAlertedAt: pruneLastAlertedAt(lastAlertedAt),
    lastAlertPriceChange,
    processedConstIds: [...processedConstIds].slice(-5000),
    processedDeletedIds: [...processedDeletedIds].slice(-5000),
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
