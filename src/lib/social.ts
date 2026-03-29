import { getDb } from "./db";
import { scanAllSubnetsSocial, type SubnetSocialData } from "./desearch";

// ── Store subnet Twitter handles from TaoStats ───────────────────
export function storeTwitterHandles(
  identities: Array<{ netuid: number; subnet_name: string; twitter: string | null }>
) {
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO social_accounts (netuid, platform, handle, url, account_type)
    VALUES (?, 'twitter', ?, ?, 'subnet')
    ON CONFLICT(platform, handle) DO UPDATE SET
      netuid = excluded.netuid,
      url = excluded.url
  `);

  let count = 0;
  for (const id of identities) {
    if (!id.twitter) continue;
    // Clean handle: remove @ prefix, trim whitespace
    let handle = id.twitter.trim().replace(/^@/, "");
    // Some might be URLs
    if (handle.includes("twitter.com/") || handle.includes("x.com/")) {
      handle = handle.split("/").pop() || handle;
    }
    if (!handle) continue;

    upsert.run(
      id.netuid,
      handle.toLowerCase(),
      `https://x.com/${handle}`
    );
    count++;
  }
  return count;
}

// ── Reddit Scanner ───────────────────────────────────────────────
// Reddit's public JSON API — no auth needed

interface RedditPost {
  title: string;
  selftext: string;
  author: string;
  url: string;
  permalink: string;
  score: number;
  num_comments: number;
  created_utc: number;
  subreddit: string;
}

export async function searchReddit(query: string, limit: number = 25): Promise<RedditPost[]> {
  try {
    const res = await fetch(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=${limit}&t=week`,
      { headers: { "User-Agent": "AlphaGap/1.0" } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data?.children || []).map((c: { data: RedditPost }) => c.data);
  } catch {
    return [];
  }
}

export async function searchSubreddit(subreddit: string, query: string, limit: number = 25): Promise<RedditPost[]> {
  try {
    const res = await fetch(
      `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&sort=new&limit=${limit}&t=week&restrict_sr=on`,
      { headers: { "User-Agent": "AlphaGap/1.0" } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data?.children || []).map((c: { data: RedditPost }) => c.data);
  } catch {
    return [];
  }
}

// ── X/Twitter Scanner (via public endpoints) ─────────────────────
// Use Nitter instances or syndication API for public tweet access

export async function fetchRecentTweets(handle: string): Promise<Array<{
  text: string;
  date: string;
  likes: number;
  retweets: number;
  replies: number;
  url: string;
}>> {
  // Try Twitter syndication API (works without auth for public accounts)
  try {
    const res = await fetch(
      `https://syndication.twitter.com/srv/timeline-profile/screen-name/${handle}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
          Accept: "text/html",
        },
      }
    );
    if (!res.ok) return [];
    const html = await res.text();

    // Extract tweet data from the HTML response
    const tweets: Array<{
      text: string;
      date: string;
      likes: number;
      retweets: number;
      replies: number;
      url: string;
    }> = [];

    // Look for tweet content in the syndication HTML
    const tweetRegex = new RegExp('"tweet-text[^"]*"[^>]*>(.*?)<\\/p>', "gs");
    let match;
    while ((match = tweetRegex.exec(html)) !== null && tweets.length < 10) {
      const text = match[1].replace(/<[^>]+>/g, "").trim();
      if (text) {
        tweets.push({
          text,
          date: new Date().toISOString(),
          likes: 0,
          retweets: 0,
          replies: 0,
          url: `https://x.com/${handle}`,
        });
      }
    }

    return tweets;
  } catch {
    return [];
  }
}

// ── Collect Social Data (Bulk Desearch approach) ─────────────────
export async function collectSocial(): Promise<{
  accounts: number;
  redditPosts: number;
  twitterPosts: number;
  signals: number;
}> {
  const db = getDb();
  let twitterPostCount = 0;
  let signalCount = 0;

  const accountCount = (db.prepare("SELECT COUNT(*) as cnt FROM social_accounts WHERE platform = 'twitter'").get() as { cnt: number }).cnt;

  console.log("Starting bulk Desearch social scan...");

  // Bulk scan: few broad searches, match results to subnets
  let socialData: Map<number, SubnetSocialData> = new Map();
  try {
    socialData = await scanAllSubnetsSocial();
  } catch (e) {
    console.error("Desearch bulk scan FAILED:", e);
    return { accounts: accountCount, redditPosts: 0, twitterPosts: 0, signals: 0 };
  }

  // Store tweets and metrics
  const insertPost = db.prepare(`
    INSERT OR IGNORE INTO social_posts
      (netuid, platform, post_id, author, author_type, content, url, likes, retweets, replies, views, posted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  const upsertMetrics = db.prepare(`
    INSERT OR REPLACE INTO social_metrics
      (netuid, timestamp, mentions_24h, mentions_7d, total_engagement_24h, top_post_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const [netuid, data] of socialData) {
    // Store all tweets
    for (const tweet of data.tweets) {
      try {
        insertPost.run(
          netuid, "twitter",
          `desearch:${tweet.id}`,
          tweet.user.username,
          tweet.user.followers_count > 10000 ? "influencer" : "user",
          tweet.text.slice(0, 1000),
          tweet.url,
          tweet.like_count, tweet.retweet_count, tweet.reply_count,
          tweet.view_count || 0,
          tweet.created_at
        );
        twitterPostCount++;
      } catch { /* skip duplicates */ }
    }

    // Update metrics
    upsertMetrics.run(
      netuid, timestamp,
      data.tweetCount,
      data.tweetCount,
      data.totalEngagement,
      data.topTweet?.url || null
    );

    console.log(`  SN${netuid}: ${data.tweetCount} tweets, ${data.totalEngagement} engagement, ${data.totalViews} views`);
  }

  // Generate signals for hot social activity
  const { insertSignal } = await import("./signals");

  for (const [netuid, data] of socialData) {
    if (data.tweetCount >= 5 && data.totalEngagement >= 100) {
      const subnetName = (db.prepare("SELECT name FROM subnets WHERE netuid = ?").get(netuid) as { name: string })?.name || `SN${netuid}`;
      insertSignal({
        netuid,
        signal_type: "social_buzz",
        strength: Math.min(85, 40 + data.tweetCount * 3 + Math.min(data.totalEngagement / 50, 30)),
        title: `Social buzz: ${data.tweetCount} mentions, ${data.totalEngagement} engagement`,
        description: `${subnetName} trending on X with ${data.tweetCount} tweets and ${data.totalEngagement} total engagement. ${data.bigAccountMentions > 0 ? `${data.bigAccountMentions} big accounts (>10K followers) talking about it.` : ""} Top views: ${data.totalViews.toLocaleString()}.`,
        source: "social",
        source_url: data.topTweet?.url,
      });
      signalCount++;
    }
  }

  return { accounts: accountCount, redditPosts: 0, twitterPosts: twitterPostCount, signals: signalCount };
}

// ── Add known Bittensor influencer accounts ──────────────────────
export function seedInfluencerAccounts() {
  const db = getDb();
  const upsert = db.prepare(`
    INSERT OR IGNORE INTO social_accounts (netuid, platform, handle, url, account_type)
    VALUES (?, ?, ?, ?, ?)
  `);

  const influencers = [
    // Major Bittensor ecosystem accounts
    { handle: "opentensor", name: "Opentensor Foundation" },
    { handle: "const_tao", name: "Const (Bittensor founder)" },
    { handle: "baboracles", name: "Bab Oracles" },
    { handle: "taboracles", name: "TAO Oracles" },
    { handle: "bittloser", name: "Bittloser" },
    { handle: "tao_update", name: "TAO Update" },
    { handle: "bittensorhub", name: "Bittensor Hub" },
    { handle: "SimpleTAO_io", name: "SimpleTAO" },
    { handle: "taostats", name: "TaoStats" },
    { handle: "DanielYFocus", name: "Daniel Focus" },
  ];

  for (const inf of influencers) {
    upsert.run(null, "twitter", inf.handle.toLowerCase(), `https://x.com/${inf.handle}`, "influencer");
  }

  // Bittensor subreddits to watch
  const subreddits = [
    { handle: "bittensor_", name: "r/bittensor_" },
    { handle: "bittensor", name: "r/bittensor" },
  ];

  for (const sub of subreddits) {
    upsert.run(null, "reddit", sub.handle, `https://reddit.com/r/${sub.handle}`, "community");
  }
}
