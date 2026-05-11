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
  const [
    postedLog,
    scanRaw,
    discordRaw,
    signalsRaw,
    socialRaw,
    analyticsRaw,
    benchmarksRaw,
    performanceRaw,
  ] = await Promise.all([
    loadPostedLog(),
    readBlob<{ leaderboard: unknown[] }>("scan-latest.json"),
    readBlob<{ results: unknown[] }>("discord-latest.json"),
    readBlob<{ signals: unknown[] }>("signals-latest.json"),
    readBlob<{ trending: unknown[]; results?: unknown[] }>("social-latest.json"),
    readBlob<{ ratios: unknown[] }>("analytics-latest.json"),
    readBlob<{ benchmarks: unknown[] }>("benchmarks-latest.json"),
    readBlob<{ gains: unknown[] }>("performance-latest.json"),
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

  // Assemble bot data
  const botData: BotData = {
    leaderboard:      (scanRaw?.leaderboard       ?? []) as BotData["leaderboard"],
    discordAlpha:     (discordRaw?.results         ?? []) as BotData["discordAlpha"],
    devSignals:       (signalsRaw?.signals         ?? []) as BotData["devSignals"],
    socialTrending:   (socialRaw?.trending ?? socialRaw?.results ?? []) as BotData["socialTrending"],
    analyticsRatios:  (analyticsRaw?.ratios        ?? []) as BotData["analyticsRatios"],
    benchmarkUpdates: (benchmarksRaw?.benchmarks   ?? []) as BotData["benchmarkUpdates"],
    performanceGains: (performanceRaw?.gains       ?? []) as BotData["performanceGains"],
    alreadyPostedIds,
  };

  // Pick best content — pass current UTC hour so slot rotation works
  const post = await pickBestPost(botData, new Date().getUTCHours());
  if (!post) {
    console.log("[twitter-bot] No qualifying content to post this run");
    return NextResponse.json({ ok: true, posted: false, reason: "no qualifying content" });
  }

  console.log(`[twitter-bot] Posting type=${post.type}: ${post.rationale}`);

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
  postedLog.posted.push(logEntry);
  postedLog.posted = postedLog.posted.slice(-200);
  await savePostedLog(postedLog);

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
  await savePostedLog(postedLog).catch((e) => {
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
