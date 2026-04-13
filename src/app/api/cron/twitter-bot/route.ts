/**
 * GET /api/cron/twitter-bot
 *
 * Automated @AlphaGapTAO poster — runs twice daily (9am + 4pm UTC).
 * Reads data blobs → picks best of 8 approved signal types → screenshots the relevant page → posts.
 */

import { NextRequest, NextResponse } from "next/server";
import { get as blobGet, put as blobPut } from "@vercel/blob";
import { pickBestPost, type BotData } from "@/lib/twitter-content";
import { postTweet, postThread } from "@/lib/twitter-bot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
const BROWSERLESS_KEY = process.env.BROWSERLESS_API_KEY || "";

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

// ── Browserless screenshot ────────────────────────────────────────
// Navigates to a page on alphagap.io and takes a screenshot.
// Waits for the main content selector to be visible first.

async function takeScreenshot(path: string): Promise<Buffer | null> {
  if (!BROWSERLESS_KEY) return null;

  const pageUrl = `https://www.alphagap.io${path}`;

  try {
    const res = await fetch(
      `https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: pageUrl,
          viewport: { width: 1440, height: 900 },
          options: {
            type: "png",
            fullPage: false,
            clip: { x: 0, y: 0, width: 1440, height: 900 },
          },
          // Inject CSS to hide the onboarding tour overlay
          addStyleTag: [
            {
              content: `
                .fixed.inset-0.z-\\[9990\\],
                .fixed.inset-0.z-\\[9991\\],
                .fixed.z-\\[9992\\],
                [class*="z-[999"] { display: none !important; }
              `,
            },
          ],
          gotoOptions: {
            waitUntil: "networkidle2",
            timeout: 20000,
          },
        }),
        signal: AbortSignal.timeout(25000),
      }
    );

    if (!res.ok) {
      console.error("[twitter-bot] Browserless error:", res.status, await res.text());
      return null;
    }

    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.error("[twitter-bot] Screenshot failed:", e);
    return null;
  }
}

// ── Upload screenshot to Twitter (media upload v1.1) ─────────────

async function uploadMedia(imageBuffer: Buffer): Promise<string | null> {
  const { createHmac, randomBytes } = await import("crypto");

  const apiKey      = process.env.TWITTER_API_KEY      || "";
  const apiSecret   = process.env.TWITTER_API_SECRET   || "";
  const accessToken  = process.env.TWITTER_ACCESS_TOKEN  || "";
  const accessSecret = process.env.TWITTER_ACCESS_SECRET || "";

  if (!apiKey || !accessToken) return null;

  function pct(s: string) {
    return encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  }

  function sign(method: string, url: string, params: Record<string, string>) {
    const op: Record<string, string> = {
      oauth_consumer_key: apiKey,
      oauth_nonce: randomBytes(16).toString("hex"),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: accessToken,
      oauth_version: "1.0",
      ...params,
    };
    const ps = Object.keys(op).sort().map((k) => `${pct(k)}=${pct(op[k])}`).join("&");
    const base = [method, pct(url), pct(ps)].join("&");
    const key = `${pct(apiSecret)}&${pct(accessSecret)}`;
    op.oauth_signature = createHmac("sha1", key).update(base).digest("base64");
    return "OAuth " + Object.keys(op).filter((k) => k.startsWith("oauth_")).sort().map((k) => `${pct(k)}="${pct(op[k])}"`).join(", ");
  }

  try {
    const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";
    const b64 = imageBuffer.toString("base64");
    const body = new URLSearchParams({ media_data: b64, media_category: "tweet_image" });
    const auth = sign("POST", uploadUrl, {});

    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      console.error("[twitter-bot] Media upload failed:", await res.text());
      return null;
    }
    const data = await res.json() as { media_id_string: string };
    return data.media_id_string;
  } catch (e) {
    console.error("[twitter-bot] Media upload error:", e);
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

  // Load all data blobs in parallel
  const [
    scanRaw,
    discordRaw,
    signalsRaw,
    socialRaw,
    analyticsRaw,
    benchmarksRaw,
    performanceRaw,
    postedLog,
  ] = await Promise.all([
    readBlob<{ leaderboard: unknown[] }>("scan-latest.json"),
    readBlob<{ results: unknown[] }>("discord-latest.json"),
    readBlob<{ signals: unknown[] }>("signals-latest.json"),
    readBlob<{ trending: unknown[]; results?: unknown[] }>("social-latest.json"),
    readBlob<{ ratios: unknown[] }>("analytics-latest.json"),
    readBlob<{ benchmarks: unknown[] }>("benchmarks-latest.json"),
    readBlob<{ gains: unknown[] }>("performance-latest.json"),
    loadPostedLog(),
  ]);

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

  // Take a screenshot of the relevant page
  let mediaId: string | null = null;
  if (post.screenshotPath) {
    const screenshotBuffer = await takeScreenshot(post.screenshotPath);
    if (screenshotBuffer) {
      mediaId = await uploadMedia(screenshotBuffer);
      console.log(`[twitter-bot] Screenshot for ${post.screenshotPath} uploaded, mediaId=${mediaId}`);
    }
  }

  // Post the tweet(s)
  // Media is attached to the first tweet only (v2 API limitation workaround)
  let tweetUrl: string | null = null;

  let tweetError: string | undefined;
  if (post.tweets.length === 1) {
    const result = await postTweet(post.tweets[0], mediaId ?? undefined);
    tweetUrl = (result?.id && result.id !== "") ? (result.url ?? null) : null;
    tweetError = result?.error;
  } else {
    tweetUrl = await postThread(post.tweets, mediaId ?? undefined);
  }

  if (!tweetUrl) {
    console.error("[twitter-bot] Failed to post tweet:", tweetError);
    return NextResponse.json({ ok: false, reason: "tweet post failed", error: tweetError, postType: post.type, text: post.tweets[0]?.slice(0, 100) }, { status: 500 });
  }

  // Log it — ID format matches what pickBestPost checks against alreadyPostedIds
  const logId = `${post.type}_${Date.now()}`;
  postedLog.posted.push({
    id: logId,
    type: post.type,
    text: post.tweets[0].slice(0, 100),
    tweetUrl,
    postedAt: new Date().toISOString(),
  });
  postedLog.posted = postedLog.posted.slice(-200);
  await savePostedLog(postedLog);

  console.log(`[twitter-bot] Posted: ${tweetUrl}`);
  return NextResponse.json({
    ok: true,
    posted: true,
    type: post.type,
    url: tweetUrl,
    rationale: post.rationale,
    screenshot: !!mediaId,
  });
}
