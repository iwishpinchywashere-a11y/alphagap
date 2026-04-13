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

// ── Post a tweet ──────────────────────────────────────────────────

export async function postTweet(text: string): Promise<{ id: string; url: string } | null> {
  const apiKey     = process.env.TWITTER_API_KEY     || "";
  const apiSecret  = process.env.TWITTER_API_SECRET  || "";
  const accessToken  = process.env.TWITTER_ACCESS_TOKEN  || "";
  const accessSecret = process.env.TWITTER_ACCESS_SECRET || "";

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    console.error("[twitter] Missing credentials — set TWITTER_API_KEY/SECRET/ACCESS_TOKEN/ACCESS_SECRET");
    return null;
  }

  const url = "https://api.twitter.com/2/tweets";
  const body = JSON.stringify({ text });

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
      console.error("[twitter] Post failed:", res.status, err);
      return null;
    }

    const data = await res.json() as { data: { id: string } };
    const tweetId = data.data.id;
    return { id: tweetId, url: `https://x.com/AlphaGapTAO/status/${tweetId}` };
  } catch (e) {
    console.error("[twitter] Error posting tweet:", e);
    return null;
  }
}

// ── Post a thread (array of tweet texts) ─────────────────────────

export async function postThread(tweets: string[]): Promise<string | null> {
  const apiKey     = process.env.TWITTER_API_KEY     || "";
  const apiSecret  = process.env.TWITTER_API_SECRET  || "";
  const accessToken  = process.env.TWITTER_ACCESS_TOKEN  || "";
  const accessSecret = process.env.TWITTER_ACCESS_SECRET || "";

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) return null;

  let replyToId: string | undefined;
  let firstUrl: string | null = null;

  for (const text of tweets) {
    const url = "https://api.twitter.com/2/tweets";
    const bodyObj: Record<string, unknown> = { text };
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
      if (tweets.indexOf(text) < tweets.length - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (e) {
      console.error("[twitter] Thread error:", e);
      return firstUrl;
    }
  }

  return firstUrl;
}
