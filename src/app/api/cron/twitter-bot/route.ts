/**
 * GET /api/cron/twitter-bot
 *
 * Automated @AlphaGapTAO poster — runs 4x daily (7am, 12pm, 5pm, 10pm UTC).
 * Reads data blobs → picks best of 8 approved signal types → posts text tweet.
 */

import { NextRequest, NextResponse } from "next/server";
import { get as blobGet, put as blobPut } from "@vercel/blob";
import { pickBestPost, type BotData } from "@/lib/twitter-content";
import { postTweet, postThread } from "@/lib/twitter-bot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";

// ── Read a private Vercel Blob as JSON ────────────────────────────

async function readBlob<T>(name: string): Promise<T | null> {
  try {
    const b = await blobGet(name, { token: BLOB_TOKEN, access: "private" });
    if (!b?.stream) return null;
    const reader = b.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const all = chunks.reduce((a, b) => {
      const c = new Uint8Array(a.length + b.length);
      c.set(a); c.set(b, a.length);
      return c;
    }, new Uint8Array(0));
    return JSON.parse(Buffer.from(all).toString("utf-8")) as T;
  } catch {
    return null;
  }
}

// ── Posted-IDs tracker (avoids repeating same signal within 48h) ──

interface PostedLog {
  posted: Array<{ id: string; type: string; text: string; tweetUrl: string; postedAt: string }>;
}

async function loadPostedLog(): Promise<PostedLog> {
  const data = await readBlob<PostedLog>("twitter-posted.json");
  return data ?? { posted: [] };
}

async function savePostedLog(log: PostedLog): Promise<void> {
  await blobPut("twitter-posted.json", JSON.stringify(log), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: BLOB_TOKEN,
  });
}

// ── Slot-based idempotency lock ───────────────────────────────────
// Prevents Vercel cron retries (and simultaneous invocations) from
// double-posting. Written to blob BEFORE the tweet is sent; keyed on
// the current UTC hour so it resets naturally each slot.

interface PostLock {
  slotKey: string;   // e.g. "2026-04-30T07"
  lockedAt: string;  // ISO timestamp
}

/** Current UTC-hour slot key, e.g. "2026-04-30T07" */
function currentSlotKey(): string {
  return new Date().toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
}

async function readLock(): Promise<PostLock | null> {
  return readBlob<PostLock>("twitter-post-lock.json");
}

async function writeLock(slotKey: string): Promise<void> {
  await blobPut(
    "twitter-post-lock.json",
    JSON.stringify({ slotKey, lockedAt: new Date().toISOString() } satisfies PostLock),
    { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", token: BLOB_TOKEN }
  );
}

// ── Main handler ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth check
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const cronSecret = process.env.CRON_SECRET;
  if (!isVercelCron && cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  console.log("[twitter-bot] Starting bot run...");

  // ── Slot-based idempotency check ──────────────────────────────────
  // Each cron slot (7am / 12pm / 5pm / 10pm UTC) gets a unique key.
  // If a lock already exists for this slot, a concurrent or retry
  // invocation bails out immediately — preventing double-posts.
  //
  // IMPORTANT: read the lock FIRST, claim it IMMEDIATELY after checking,
  // then load everything else. Loading data blobs before writing the lock
  // creates a race window where two concurrent invocations both pass the
  // check and both proceed to post — that was the root cause of duplicates.
  const slotKey = currentSlotKey();
  const lock = await readLock();

  if (lock?.slotKey === slotKey) {
    const minutesSinceLock = (Date.now() - new Date(lock.lockedAt).getTime()) / 60000;
    console.log(`[twitter-bot] Lock exists for slot ${slotKey} (${minutesSinceLock.toFixed(0)}m ago) — skipping`);
    return NextResponse.json({ ok: true, posted: false, reason: `locked (slot ${slotKey}, ${minutesSinceLock.toFixed(0)}m ago)` });
  }

  // Claim the slot NOW — before loading any other data. Any concurrent
  // invocation that reads the lock after this write will see slotKey and bail.
  await writeLock(slotKey);

  // Load all data blobs in parallel now that the slot is claimed
  // Actual blob names and shapes (corrected from original stale names):
  //   signals-history.json  → flat ScanSignal[]  (not {signals:[]} wrapper)
  //   social-hot.json       → { events: HeatEvent[] }  (not {trending:[]})
  //   benchmark-alerts.json → flat array of KOL alert objects  (not {benchmarks:[]})
  //   portfolio.json        → { positions: PortfolioPosition[] }  (not {gains:[]})
  //   analytics-latest.json → DOES NOT EXIST; derived from scan-latest.json leaderboard
  //   performance-latest.json → DOES NOT EXIST; derived from portfolio.json + scan prices
  const [
    postedLog,
    scanRaw,
    discordRaw,
    signalsHistoryRaw,   // flat ScanSignal[]
    socialHotRaw,        // { events: HeatEvent[] }
    portfolioRaw,        // { positions: PortfolioPosition[] }
  ] = await Promise.all([
    loadPostedLog(),
    readBlob<{ leaderboard: Array<Record<string, unknown>> }>("scan-latest.json"),
    readBlob<{ results: unknown[] }>("discord-latest.json"),
    readBlob<Array<Record<string, unknown>>>("signals-history.json"),
    readBlob<{ events: Array<Record<string, unknown>> }>("social-hot.json"),
    readBlob<{ positions: Array<Record<string, unknown>> }>("portfolio.json"),
  ]);

  // ── 3-hour cooldown (belt-and-suspenders) ────────────────────────
  // Slots are ≥5h apart, so 3h = safe guard without blocking valid posts.
  const lastPost = postedLog.posted[postedLog.posted.length - 1];
  if (lastPost) {
    const minutesSinceLast = (Date.now() - new Date(lastPost.postedAt).getTime()) / 60000;
    if (minutesSinceLast < 180) {
      console.log(`[twitter-bot] Last post was ${minutesSinceLast.toFixed(0)}m ago — skipping (cooldown)`);
      return NextResponse.json({ ok: true, posted: false, reason: `cooldown (${minutesSinceLast.toFixed(0)}m since last post)` });
    }
  }

  // Build dedup set (48h window)
  const cutoff = Date.now() - 48 * 3600000;
  const alreadyPostedIds = new Set(
    postedLog.posted
      .filter((p) => new Date(p.postedAt).getTime() > cutoff)
      .map((p) => p.id)
  );

  // ── Map leaderboard fields to SubnetScore interface ────────────────
  // scan-latest.json uses agap_velo (not velo_score) and score_delta_24h
  // (not composite_score_change). Map them here so the content generators work.
  const leaderboard = (scanRaw?.leaderboard ?? []).map((e) => ({
    ...e,
    // field name aliases
    composite_score_change: e.score_delta_24h,
    velo_score:             e.agap_velo,
  })) as BotData["leaderboard"];

  // ── Map signals-history.json (flat ScanSignal[]) → DevSignal[] ────
  // ScanSignal fields: netuid, signal_type, strength, title, description,
  //   source, created_at, signal_date, subnet_name, analysis
  // DevSignal fields: name, netuid, title, description, score, created_at
  const devSignals: BotData["devSignals"] = (Array.isArray(signalsHistoryRaw) ? signalsHistoryRaw : [])
    .filter((s) => s.signal_type === "dev_activity" || s.signal_type === "dev_signal" || String(s.signal_type).startsWith("dev"))
    .map((s) => ({
      name:        String(s.subnet_name ?? s.name ?? "Unknown"),
      netuid:      Number(s.netuid),
      title:       String(s.title ?? ""),
      description: String(s.description ?? s.analysis ?? ""),
      score:       Number(s.strength ?? 0),
      created_at:  String(s.signal_date ?? s.created_at ?? ""),
    }));

  // ── Map social-hot.json HeatEvents → SocialTrendEntry[] ────────────
  // HeatEvent fields: tweet_id, netuid, subnet_name, kol_handle, kol_name,
  //   kol_weight, kol_tier, tweet_url, engagement, heat_score, detected_at
  // Group by subnet, surface top subnets with mention count + top insight
  const hotEvents = Array.isArray(socialHotRaw?.events) ? socialHotRaw!.events : [];
  const cutoff48h = Date.now() - 48 * 3600000;
  const recentHot = hotEvents.filter((e) => new Date(String(e.detected_at ?? 0)).getTime() > cutoff48h);
  const subnetHotMap = new Map<number, { subnetName: string; tweetCount: number; topHeat: number; topInsight: string; scannedAt: string }>();
  for (const e of recentHot) {
    const uid = Number(e.netuid);
    const existing = subnetHotMap.get(uid);
    const heat = Number(e.heat_score ?? 0);
    if (!existing) {
      subnetHotMap.set(uid, {
        subnetName: String(e.subnet_name ?? ""),
        tweetCount: 1,
        topHeat: heat,
        topInsight: String(e.kol_handle ? `@${e.kol_handle}` : ""),
        scannedAt: String(e.detected_at ?? ""),
      });
    } else {
      existing.tweetCount++;
      if (heat > existing.topHeat) {
        existing.topHeat = heat;
        existing.topInsight = String(e.kol_handle ? `@${e.kol_handle}` : "");
        existing.scannedAt = String(e.detected_at ?? existing.scannedAt);
      }
    }
  }
  const socialTrending: BotData["socialTrending"] = [...subnetHotMap.entries()]
    .sort((a, b) => b[1].topHeat - a[1].topHeat)
    .map(([netuid, v]) => ({
      netuid,
      subnetName: v.subnetName,
      tweetCount: v.tweetCount,
      topInsight: v.topInsight,
      scannedAt: v.scannedAt,
    }));

  // ── Derive analytics ratios from leaderboard ───────────────────────
  // Use emission% / (market_cap / totalMcap) as the efficiency ratio.
  // Higher means the subnet earns more emissions per dollar of market cap.
  const totalMcap = leaderboard.reduce((sum, s) => sum + (s.market_cap ?? 0), 0);
  const analyticsRatios: BotData["analyticsRatios"] = leaderboard
    .filter((s) => s.emission_pct && s.emission_pct > 0 && s.market_cap && s.market_cap > 0 && totalMcap > 0)
    .map((s) => {
      const emitShare = Number(s.emission_pct) * 100;          // fraction → %
      const mcapShare = (Number(s.market_cap) / totalMcap) * 100;
      const ratio = emitShare / Math.max(mcapShare, 0.0001);   // emission% per mcap%
      return {
        netuid:          Number(s.netuid),
        name:            String(s.name),
        ratio:           Math.round(ratio * 100) / 100,
        ratioLabel:      "emission/mcap efficiency",
        composite_score: Number(s.composite_score ?? 0),
      };
    })
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 10);

  // ── Derive benchmarkUpdates from raw leaderboard (subnets with benchmark scores) ─
  // Uses scanRaw?.leaderboard (untyped) so we can access benchmark-specific fields:
  //   product_source, benchmark_score, benchmark_category, cost_saving_pct,
  //   vs_provider, benchmark_summary, product_score
  const rawLeaderboard = scanRaw?.leaderboard ?? [];
  const lastScanTs = String((scanRaw as Record<string, unknown> | null)?.lastScan ?? new Date().toISOString());
  const benchmarkUpdates: BotData["benchmarkUpdates"] = rawLeaderboard
    .filter((s) => s.product_source === "benchmark" && s.benchmark_score != null)
    .map((s) => ({
      netuid:           Number(s.netuid),
      subnetName:       String(s.name),
      taskName:         String(s.benchmark_category ?? "AI benchmark"),
      score:            Number(s.benchmark_score ?? s.product_score ?? 0),
      centralizedScore: s.cost_saving_pct != null ? Number(s.benchmark_score ?? 0) - Number(s.cost_saving_pct ?? 0) : undefined,
      centralizedName:  s.vs_provider ? String(s.vs_provider) : undefined,
      delta:            s.cost_saving_pct != null ? Number(s.cost_saving_pct) : undefined,
      updatedAt:        lastScanTs,
      isNew:            false,
    }))
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
    .slice(0, 10);

  // ── Derive performanceGains from portfolio.json + current scan prices ──
  // PortfolioPosition fields: netuid, name, buyDate, buyAGapScore, buyPriceUsd,
  //   amountUsd, alphaTokens, peakPrice, manualPeakPrice
  const priceMap = new Map<number, number>(
    leaderboard
      .filter((s) => s.alpha_price != null)
      .map((s) => [Number(s.netuid), Number(s.alpha_price)])
  );
  const performanceGains: BotData["performanceGains"] = (portfolioRaw?.positions ?? [])
    .filter((p) => p.buyPriceUsd != null && Number(p.buyPriceUsd) > 0)
    .map((p) => {
      const uid = Number(p.netuid);
      const buyPrice = Number(p.buyPriceUsd);
      const priceNow = priceMap.get(uid) ?? buyPrice;
      const peakPrice = Number(p.manualPeakPrice ?? p.peakPrice ?? priceNow);
      const maxGainPct = ((peakPrice - buyPrice) / buyPrice) * 100;
      const currentGainPct = ((priceNow - buyPrice) / buyPrice) * 100;
      return {
        netuid:           uid,
        name:             String(p.name ?? ""),
        agapScoreAtSignal: Number(p.buyAGapScore ?? 0),
        priceAtSignal:    buyPrice,
        priceNow,
        maxPrice:         peakPrice,
        maxGainPct:       Math.round(maxGainPct * 10) / 10,
        currentGainPct:   Math.round(currentGainPct * 10) / 10,
        signalDate:       String(p.buyDate ?? ""),
      };
    })
    .filter((p) => p.maxGainPct >= 15)   // only include meaningful gainers
    .sort((a, b) => b.maxGainPct - a.maxGainPct);

  // Assemble bot data
  const botData: BotData = {
    leaderboard,
    discordAlpha:     (discordRaw?.results ?? []) as BotData["discordAlpha"],
    devSignals,
    socialTrending,
    analyticsRatios,
    benchmarkUpdates,
    performanceGains,
    alreadyPostedIds,
  };

  // Pick best content — pass current UTC hour so slot rotation works
  const post = await pickBestPost(botData, new Date().getUTCHours());
  if (!post) {
    console.log("[twitter-bot] No qualifying content to post this run");
    return NextResponse.json({ ok: true, posted: false, reason: "no qualifying content" });
  }

  console.log(`[twitter-bot] Posting type=${post.type}: ${post.rationale}`);

  // ── Final concurrent-safe dedup check ────────────────────────────
  // Two invocations that both read a null lock within ~100ms of each other
  // can both slip past the lock guard above. Re-read the postedLog fresh
  // here (after AI generation, so we're likely staggered in time) to catch
  // whichever invocation is "second". If the dedupId is already present
  // (written by the first invocation's pending-save below), bail out.
  const freshLog = await loadPostedLog();
  if (freshLog.posted.some(p => p.id === post.dedupId)) {
    console.log(`[twitter-bot] Concurrent dedup: ${post.dedupId} already claimed — skipping`);
    return NextResponse.json({ ok: true, posted: false, reason: `concurrent dedup: ${post.dedupId} already claimed` });
  }

  // ── Write dedup log entry BEFORE posting ──────────────────────────
  // If we post the tweet and then savePostedLog fails (network blip,
  // timeout), the next slot has no record of the post and fires again.
  // Writing first means the dedupId is persisted even if the URL update
  // below fails — preventing a future slot from re-posting the same content.
  const postedAt = new Date().toISOString();
  const logEntry = {
    id: post.dedupId,
    type: post.type,
    text: post.tweets[0].slice(0, 100),
    tweetUrl: "pending",
    postedAt,
  };
  freshLog.posted.push(logEntry);
  freshLog.posted = freshLog.posted.slice(-200);
  await savePostedLog(freshLog);

  // Post the tweet(s)
  let tweetUrl: string | null = null;
  let tweetError: string | undefined;
  if (post.tweets.length === 1) {
    const result = await postTweet(post.tweets[0]);
    tweetUrl = (result?.id && result.id !== "") ? (result.url ?? null) : null;
    tweetError = result?.error;
  } else {
    tweetUrl = await postThread(post.tweets);
  }

  if (!tweetUrl) {
    console.error("[twitter-bot] Failed to post tweet:", tweetError);
    // The dedupId is already persisted above — won't double-post.
    return NextResponse.json({ ok: false, reason: "tweet post failed", error: tweetError, postType: post.type, text: post.tweets[0]?.slice(0, 100) }, { status: 500 });
  }

  // Update the log entry with the real tweet URL (best-effort — dedupId already saved above)
  logEntry.tweetUrl = tweetUrl;
  await savePostedLog(freshLog).catch((e) => {
    console.warn("[twitter-bot] Failed to update postedLog with tweetUrl (non-fatal):", e);
  });

  console.log(`[twitter-bot] Posted: ${tweetUrl}`);
  return NextResponse.json({
    ok: true,
    posted: true,
    type: post.type,
    url: tweetUrl,
    rationale: post.rationale,
  });
}
