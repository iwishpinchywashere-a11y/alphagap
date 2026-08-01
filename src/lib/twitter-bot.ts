// Twitter/X bot utilities for @AlphaGapTAO
// Posts automated alpha signals using OAuth 1.0a

import crypto from "crypto";

// ── OAuth 1.0a signing ────────────────────────────────────────────

function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function oauthSign(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessSecret: string
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
    ...params,
  };

  const allParams = { ...oauthParams };
  const paramStr = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join("&");

  const base = [method.toUpperCase(), percentEncode(url), percentEncode(paramStr)].join("&");
  const key = `${percentEncode(consumerSecret)}&${percentEncode(accessSecret)}`;
  const sig = crypto.createHmac("sha1", key).update(base).digest("base64");

  oauthParams["oauth_signature"] = sig;

  return (
    "OAuth " +
    Object.keys(oauthParams)
      .filter((k) => k.startsWith("oauth_"))
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
      .join(", ")
  );
}

// ── Read our own recent tweets ────────────────────────────────────
//
// This is the duplicate-post guard of last resort, and the only one that can
// actually work. Every blob-based guard (slot lock, dedupId, cooldown) reads
// from Vercel Blob, which is EVENTUALLY CONSISTENT — a second invocation
// arriving seconds later reads stale data, sees no previous post, and tweets
// again. Blob also has no atomic compare-and-swap, so no amount of
// read-check-write can serialise two invocations.
//
// X itself is the system of record: a tweet that exists is visible here
// immediately. Checking it before posting closes the case the blob guards
// structurally cannot.
export async function fetchOwnRecentTweets(
  maxResults = 10
): Promise<Array<{ id: string; text: string; createdAt: string }> | null> {
  const apiKey       = process.env.TWITTER_API_KEY       || "";
  const apiSecret    = process.env.TWITTER_API_SECRET    || "";
  const accessToken  = process.env.TWITTER_ACCESS_TOKEN  || "";
  const accessSecret = process.env.TWITTER_ACCESS_SECRET || "";
  if (!apiKey || !apiSecret || !accessToken || !accessSecret) return null;

  try {
    // Resolve our own user id first (OAuth 1.0a user context).
    const meUrl = "https://api.twitter.com/2/users/me";
    const meAuth = oauthSign("GET", meUrl, {}, apiKey, apiSecret, accessToken, accessSecret);
    const meRes = await fetch(meUrl, { headers: { Authorization: meAuth }, signal: AbortSignal.timeout(10000) });
    if (!meRes.ok) {
      console.error("[twitter] users/me failed:", meRes.status, await meRes.text());
      return null;
    }
    const me = await meRes.json() as { data?: { id?: string } };
    const userId = me.data?.id;
    if (!userId) return null;

    // GET params must be part of the OAuth signature base string.
    const params = { max_results: String(maxResults), "tweet.fields": "created_at" };
    const tlUrl = `https://api.twitter.com/2/users/${userId}/tweets`;
    const tlAuth = oauthSign("GET", tlUrl, params, apiKey, apiSecret, accessToken, accessSecret);
    const qs = new URLSearchParams(params).toString();
    const tlRes = await fetch(`${tlUrl}?${qs}`, { headers: { Authorization: tlAuth }, signal: AbortSignal.timeout(10000) });
    if (!tlRes.ok) {
      console.error("[twitter] timeline fetch failed:", tlRes.status, await tlRes.text());
      return null;
    }

    const tl = await tlRes.json() as { data?: Array<{ id: string; text: string; created_at?: string }> };
    return (tl.data ?? []).map(t => ({ id: t.id, text: t.text, createdAt: t.created_at ?? "" }));
  } catch (e) {
    console.error("[twitter] fetchOwnRecentTweets error:", String(e));
    return null;
  }
}

// ── Post a single tweet ───────────────────────────────────────────

export async function postTweet(
  text: string,
  mediaId?: string
): Promise<{ id: string; url: string; error?: string } | null> {
  const apiKey      = process.env.TWITTER_API_KEY      || "";
  const apiSecret   = process.env.TWITTER_API_SECRET   || "";
  const accessToken  = process.env.TWITTER_ACCESS_TOKEN  || "";
  const accessSecret = process.env.TWITTER_ACCESS_SECRET || "";

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    console.error("[twitter] Missing credentials — set TWITTER_API_KEY/SECRET/ACCESS_TOKEN/ACCESS_SECRET");
    return null;
  }

  const url = "https://api.twitter.com/2/tweets";
  const bodyObj: Record<string, unknown> = { text };
  if (mediaId) bodyObj.media = { media_ids: [mediaId] };
  const body = JSON.stringify(bodyObj);

  const auth = oauthSign("POST", url, {}, apiKey, apiSecret, accessToken, accessSecret);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      const msg = `${res.status}: ${err}`;
      console.error("[twitter] Post failed:", msg);
      return { id: "", url: "", error: msg };
    }

    const data = await res.json() as { data: { id: string } };
    const tweetId = data.data.id;
    return { id: tweetId, url: `https://x.com/AlphaGapTAO/status/${tweetId}` };
  } catch (e) {
    const msg = String(e);
    console.error("[twitter] Error posting tweet:", msg);
    return { id: "", url: "", error: msg };
  }
}

// ── Post a thread (array of tweet texts) ─────────────────────────

export async function postThread(
  tweets: string[],
  mediaId?: string
): Promise<string | null> {
  const apiKey      = process.env.TWITTER_API_KEY      || "";
  const apiSecret   = process.env.TWITTER_API_SECRET   || "";
  const accessToken  = process.env.TWITTER_ACCESS_TOKEN  || "";
  const accessSecret = process.env.TWITTER_ACCESS_SECRET || "";

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) return null;

  let replyToId: string | undefined;
  let firstUrl: string | null = null;

  for (let i = 0; i < tweets.length; i++) {
    const text = tweets[i];
    const url = "https://api.twitter.com/2/tweets";
    const bodyObj: Record<string, unknown> = { text };
    // Attach media to the first tweet only
    if (i === 0 && mediaId) bodyObj.media = { media_ids: [mediaId] };
    if (replyToId) bodyObj.reply = { in_reply_to_tweet_id: replyToId };

    const auth = oauthSign("POST", url, {}, apiKey, apiSecret, accessToken, accessSecret);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj),
      });

      if (!res.ok) {
        console.error("[twitter] Thread post failed:", await res.text());
        return firstUrl;
      }

      const data = await res.json() as { data: { id: string } };
      replyToId = data.data.id;
      if (!firstUrl) firstUrl = `https://x.com/AlphaGapTAO/status/${replyToId}`;

      // Small delay between thread posts to avoid rate limit
      if (i < tweets.length - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (e) {
      console.error("[twitter] Thread error:", e);
      return firstUrl;
    }
  }

  return firstUrl;
}
