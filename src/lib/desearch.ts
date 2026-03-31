import { getDb } from "./db";

const DESEARCH_API = "https://api.desearch.ai";
const DESEARCH_KEY = process.env.DESEARCH_API_KEY || "dsr_zUMktfSxGqfTl2sdOJyywg8AlBTtBSvj9cNyGgEj";

// ── Twitter Search ───────────────────────────────────────────────
export interface DesearchTweet {
  user: {
    id: string;
    username: string;
    name: string;
    followers_count: number;
    is_blue_verified: boolean;
  };
  id: string;
  text: string;
  reply_count: number;
  view_count: number;
  retweet_count: number;
  like_count: number;
  quote_count: number;
  url: string;
  created_at: string;
  lang: string;
}

async function fetchTweets(query: string, count: number = 100, sort: "Top" | "Latest" = "Top"): Promise<DesearchTweet[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const params = new URLSearchParams({ query, sort, count: count.toString(), lang: "en" });
    const res = await fetch(`${DESEARCH_API}/twitter?${params}`, {
      headers: { Authorization: DESEARCH_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`Desearch search failed (${res.status}) for: ${query}`);
      return [];
    }
    return await res.json();
  } catch (e) {
    console.warn(`Desearch error for "${query}": ${(e as Error).message}`);
    return [];
  }
}

// ── Bulk social scan — ONE big search, then match to subnets ─────
// Instead of 50+ individual API calls, we do 3-5 broad searches
// and match tweets to subnets by handle/name mention
export interface SubnetSocialData {
  tweets: DesearchTweet[];
  tweetCount: number;
  totalEngagement: number;
  totalViews: number;
  bigAccountMentions: number;
  topTweet?: DesearchTweet;
}

export async function scanAllSubnetsSocial(): Promise<Map<number, SubnetSocialData>> {
  const db = getDb();
  const results = new Map<number, SubnetSocialData>();

  // Build lookup maps: handle -> netuid, name -> netuid
  const handleToNetuid = new Map<string, number>();
  const nameToNetuid = new Map<string, number>();

  const accounts = db.prepare(
    "SELECT netuid, handle FROM social_accounts WHERE platform = 'twitter' AND netuid IS NOT NULL"
  ).all() as Array<{ netuid: number; handle: string }>;

  for (const a of accounts) {
    handleToNetuid.set(a.handle.toLowerCase(), a.netuid);
  }

  const subnets = db.prepare(
    "SELECT netuid, name FROM subnets WHERE netuid > 0 AND name IS NOT NULL AND length(name) >= 4"
  ).all() as Array<{ netuid: number; name: string }>;

  for (const s of subnets) {
    nameToNetuid.set(s.name.toLowerCase(), s.netuid);
  }

  // Helper to match a tweet to a subnet
  function matchTweetToSubnet(tweet: DesearchTweet): number | null {
    const text = tweet.text.toLowerCase();
    const author = tweet.user.username.toLowerCase();

    // Check if author IS a subnet account
    if (handleToNetuid.has(author)) return handleToNetuid.get(author)!;

    // Check for @handle mentions in text
    for (const [handle, netuid] of handleToNetuid) {
      if (text.includes(`@${handle}`)) return netuid;
    }

    // Check for subnet name mentions
    for (const [name, netuid] of nameToNetuid) {
      if (text.includes(name)) return netuid;
    }

    // Check for SN## pattern
    const snMatch = text.match(/\bsn(\d{1,3})\b/);
    if (snMatch) {
      const netuid = parseInt(snMatch[1]);
      if (netuid > 0 && netuid <= 128) return netuid;
    }

    return null;
  }

  // Do 4 broad searches to capture the bittensor social landscape
  // Plus a direct $TAO search to catch KOL posts that omit "bittensor"
  const searches = [
    { query: "bittensor subnet", count: 100, sort: "Top" as const },
    { query: "bittensor subnet", count: 100, sort: "Latest" as const },
    { query: "$TAO subnet", count: 50, sort: "Top" as const },
    { query: "bittensor alpha", count: 50, sort: "Latest" as const },
    { query: "$TAO", count: 50, sort: "Latest" as const },
    { query: "bittensor", count: 50, sort: "Latest" as const },
  ];

  const allTweets = new Map<string, DesearchTweet>();

  for (const search of searches) {
    console.log(`  Desearch: "${search.query}" (${search.sort})...`);
    const tweets = await fetchTweets(search.query, search.count, search.sort);
    console.log(`    Got ${tweets.length} tweets`);

    for (const t of tweets) {
      allTweets.set(t.id, t);
    }

    // Also fetch tweets from known big subnet accounts directly
    await new Promise(r => setTimeout(r, 1000));
  }

  // Fetch recent tweets from Tier 1 + Tier 2 KOLs directly
  // Critical: catches subnet mentions even when the tweet doesn't say "bittensor"
  // e.g. const_reborn posting "404gen is doing amazing work" won't match broad searches
  const { KOL_DATABASE } = await import("./kol-database");
  const topKols = KOL_DATABASE.filter(k => k.tier <= 2);
  console.log(`  Fetching timelines for ${topKols.length} Tier 1+2 KOLs...`);
  for (const kol of topKols) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const params = new URLSearchParams({ username: kol.handle, count: "10" });
      const res = await fetch(`${DESEARCH_API}/twitter/user/posts?${params}`, {
        headers: { Authorization: DESEARCH_KEY },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const tweets: DesearchTweet[] = await res.json();
        for (const t of tweets) allTweets.set(t.id, t);
      }
      await new Promise(r => setTimeout(r, 400));
    } catch { /* skip timeouts */ }
  }

  // Also fetch recent tweets from top subnet accounts
  const topHandles = accounts.slice(0, 20);
  for (const acc of topHandles) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const params = new URLSearchParams({ username: acc.handle, count: "5" });
      const res = await fetch(`${DESEARCH_API}/twitter/user/posts?${params}`, {
        headers: { Authorization: DESEARCH_KEY },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const tweets: DesearchTweet[] = await res.json();
        for (const t of tweets) allTweets.set(t.id, t);
      }
      await new Promise(r => setTimeout(r, 500));
    } catch { /* skip timeouts */ }
  }

  console.log(`  Total unique tweets: ${allTweets.size}`);

  // Match all tweets to subnets
  for (const tweet of allTweets.values()) {
    const netuid = matchTweetToSubnet(tweet);
    if (!netuid) continue;

    if (!results.has(netuid)) {
      results.set(netuid, {
        tweets: [],
        tweetCount: 0,
        totalEngagement: 0,
        totalViews: 0,
        bigAccountMentions: 0,
      });
    }

    const data = results.get(netuid)!;
    const engagement = tweet.like_count + tweet.retweet_count + tweet.reply_count + (tweet.quote_count || 0);

    data.tweets.push(tweet);
    data.tweetCount++;
    data.totalEngagement += engagement;
    data.totalViews += tweet.view_count || 0;

    if (tweet.user.followers_count > 10000) data.bigAccountMentions++;

    if (!data.topTweet || engagement > (data.topTweet.like_count + data.topTweet.retweet_count + data.topTweet.reply_count)) {
      data.topTweet = tweet;
    }
  }

  console.log(`  Matched tweets to ${results.size} subnets`);
  return results;
}
