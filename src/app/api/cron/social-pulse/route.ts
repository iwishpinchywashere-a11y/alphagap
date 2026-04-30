/**
 * GET /api/cron/social-pulse
 *
 * Runs every 10 minutes via Vercel cron.
 * Checks KOL timelines for new subnet-related tweets and stores "heat events"
 * in social-hot.json. The main scan reads this to boost social scores when
 * a big KOL posts about a subnet — score can hit 90-100 for 48h then decays.
 *
 * Heat score formula:
 *   kolBase = kolWeight * 0.70       (weight 100 → 70pts, weight 50 → 35pts)
 *   engBoost = log10(engagement) * 11  (capped 30pts)
 *   heatScore = min(100, kolBase + engBoost)
 *
 * Examples:
 *   const (weight 100) + 200 engagement  → heat = min(100, 70+25) = 95
 *   const (weight 100) + 50 engagement   → heat = min(100, 70+18) = 88
 *   jollygreenmoney (weight 65) + 500    → heat = min(100, 46+28) = 74
 *   cryptozpunisher (weight 65) + 200    → heat = min(100, 46+25) = 71
 */

import { NextResponse } from "next/server";
import { get as blobGet, put } from "@vercel/blob";
import { getSubnetIdentities } from "@/lib/taostats";
import { KOL_DATABASE } from "@/lib/kol-database";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

const DESEARCH_KEY = process.env.DESEARCH_API_KEY || "";

// ── Types ──────────────────────────────────────────────────────────
export interface HeatEvent {
  tweet_id: string;
  netuid: number;
  subnet_name: string;
  kol_handle: string;
  kol_name: string;
  kol_weight: number;
  kol_tier: number;
  tweet_text: string;
  tweet_url: string;
  engagement: number;
  heat_score: number;
  detected_at: string;
}

export interface SocialHot {
  events: HeatEvent[];
  seen_ids: string[];
  last_pulse: string;
}

interface DesearchTweet {
  id: string;
  text: string;
  created_at: string;
  user: { username: string; name: string };
  like_count: number;
  retweet_count: number;
  reply_count: number;
  quote_count?: number;
}

// ── Helpers ────────────────────────────────────────────────────────
function computeHeatScore(kolWeight: number, engagement: number): number {
  // KOL weight: 35 pts max — establishes a credibility floor but doesn't dominate.
  // Engagement: 65 pts max on sqrt scale — gives real dynamic range across typical
  // BT tweet engagements (10–500). sqrt(10)*3.5≈11, sqrt(50)*3.5≈25,
  // sqrt(100)*3.5=35, sqrt(350)*3.5≈65 (cap). Old log10 formula clustered
  // all Tier-1 tweets at 67–70 regardless of actual signal quality.
  const kolBase = Math.round(kolWeight * 0.35);
  const engBoost = Math.min(65, Math.round(Math.sqrt(Math.max(engagement, 1)) * 3.5));
  return Math.min(100, kolBase + engBoost);
}

async function fetchKolTimeline(handle: string): Promise<DesearchTweet[]> {
  try {
    const url = `https://api.desearch.ai/twitter/user/posts?username=${encodeURIComponent(handle)}`;
    const res = await fetch(url, {
      headers: { Authorization: DESEARCH_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    // API returns { user: {...}, tweets: [...] }
    return Array.isArray(data) ? data : (data.tweets || data.results || []);
  } catch {
    return [];
  }
}

async function readBlob<T>(name: string, token: string): Promise<T | null> {
  try {
    const result = await blobGet(name, { token, access: "private" });
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

// ── Route ──────────────────────────────────────────────────────────
export async function GET(req: Request) {
  // Vercel cron sends x-vercel-cron header; manual calls need CRON_SECRET
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const cronSecret = process.env.CRON_SECRET;
  if (!isVercelCron && cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!DESEARCH_KEY) {
    return NextResponse.json({ error: "No DESEARCH_API_KEY" }, { status: 500 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  const startTime = Date.now();
  const url = new URL(req.url);
  // ?deep=1 → fetch up to 50 tweets per KOL for a 24h backfill run
  const deep = url.searchParams.get("deep") === "1";

  // ── Load existing hot data ───────────────────────────────────────
  const existing = (await readBlob<SocialHot>("social-hot.json", token)) ?? {
    events: [],
    seen_ids: [],
    last_pulse: "",
  };
  // Only keep seen_ids that are still in active events (same 72h window).
  // Tweets that have aged out of events should be re-discoverable so fresh
  // runs can pick up any new activity from the same tweet_id.
  const activeEventTweetIds = new Set(
    (existing.events ?? []).map(e => e.tweet_id.split("_")[0]) // strip _netuid suffix
  );
  const seenIds = new Set<string>(
    (existing.seen_ids ?? []).filter(id => activeEventTweetIds.has(id))
  );

  // ── Build subnet identity lookup ─────────────────────────────────
  const identities = await getSubnetIdentities().catch(() => []);
  const handleToNetuid = new Map<string, number>();
  const nameToNetuid = new Map<string, number>();
  const normNameToNetuid = new Map<string, number>();
  const netuidToName = new Map<number, string>();

  for (const id of identities) {
    netuidToName.set(id.netuid, id.subnet_name || `SN${id.netuid}`);
    if (id.twitter) {
      const handle = id.twitter.trim().replace(/^@/, "").split("/").pop()?.toLowerCase() || "";
      if (handle) handleToNetuid.set(handle, id.netuid);
    }
    if (id.subnet_name && id.subnet_name.length >= 4) {
      const name = id.subnet_name.toLowerCase();
      nameToNetuid.set(name, id.netuid);
      normNameToNetuid.set(name.replace(/[-_\s]/g, ""), id.netuid);
    }
  }

  // Hard-coded handle overrides for subnets whose handle isn't registered on TaoStats yet
  const HANDLE_OVERRIDES: Record<string, number> = {
    "affine_io": 120,
    "MaxScore": 44,   // Score / Manako founder
  };
  for (const [handle, netuid] of Object.entries(HANDLE_OVERRIDES)) {
    if (!handleToNetuid.has(handle)) handleToNetuid.set(handle, netuid);
    if (!netuidToName.has(netuid)) netuidToName.set(netuid, `SN${netuid}`);
  }

  // Bittensor context gate — tweet must mention one of these to be subnet-related.
  // Prevents KOL timeline tweets about VC/crypto/general topics from being labeled as subnets.
  // Also includes notable subnet names that are unambiguous enough to serve as context.
  const BITTENSOR_SIGNALS = [
    "bittensor", "$tao", "#tao", "dtao", "opentensor", "taoshi",
    "macrocosmos", "subnet", "netuid", "metagraph", "yuma",
    "tao alpha", "taomarketcap", "taostats",
    "affine_io", "affine foundation", // SN120 — going viral, unambiguous
    "maxscore", "manako", "wearescore", // SN44 Score — founder @MaxScore
  ];
  function hasBittensorContext(text: string): boolean {
    const t = text.toLowerCase();
    if (BITTENSOR_SIGNALS.some(s => t.includes(s))) return true;
    // Explicit SN# notation (e.g. "SN64", "sn3") is Bittensor-specific
    if (/\bsn\d{1,3}\b/i.test(t)) return true;
    return false;
  }

  // Generic English/crypto words that happen to be subnet names.
  // These are blocked from name-based matching — a tweet must use SN# or @handle instead.
  const GENERIC_NAME_BLOCKLIST = new Set([
    // English generics
    "investing", "vision", "atlas", "apex", "prime", "core", "genesis",
    "nexus", "origin", "signal", "pulse", "oracle", "forge", "bridge",
    "score", "quasar", "synth", "swarm", "beam", "echo",
    "hone", "grail", "vanta", "soma", "kaito",
    // Common DeFi/crypto words that collide with subnet names
    "swap", "yield", "stake", "pool", "mint", "launch", "flow", "base",
    "liquidity", "leverage", "margin", "trading", "market", "alpha", "delta",
  ]);

  // Word-boundary match: requires the name to appear as a standalone word,
  // not as a substring of another word (e.g. "chutes" must not match "parachutes").
  function wordMatch(text: string, word: string): boolean {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(text);
  }

  // Returns ALL matching netuids for a tweet (supports multi-subnet mentions).
  function matchTweet(tweet: DesearchTweet): number[] {
    const text = tweet.text.toLowerCase();
    const author = tweet.user.username.toLowerCase();
    const matched = new Set<number>();

    // Subnet's own official Twitter handle — high confidence.
    if (handleToNetuid.has(author)) {
      if (hasBittensorContext(text)) {
        matched.add(handleToNetuid.get(author)!);
      } else {
        // No Bittensor context: only credit if they explicitly name their own subnet
        // as a whole word (not a substring). Require >= 5 chars so short names like
        // "hone" don't accidentally match inside words like "phone" or "honest".
        const netuid = handleToNetuid.get(author)!;
        const ownName = netuidToName.get(netuid)?.toLowerCase() || "";
        if (ownName.length >= 5 && wordMatch(text, ownName)) {
          matched.add(netuid);
        }
      }
      return [...matched];
    }

    // All remaining matches require Bittensor context
    if (!hasBittensorContext(text)) return [];

    // @subnet_handle mentions — collect ALL mentioned handles
    for (const [handle, netuid] of handleToNetuid) {
      if (text.includes(`@${handle}`)) matched.add(netuid);
    }

    // SN# explicit mentions — collect ALL SN numbers in the tweet
    // Matches: "SN3", "sn64", "SN 3", "SN#3", "subnet 3", "subnet #3", "subnet3"
    const snPatterns = [
      /\bsn\s*#?\s*(\d{1,3})\b/gi,          // SN3, SN 3, SN#3, sn3
      /\bsubnet\s*#?\s*(\d{1,3})\b/gi,       // subnet 3, subnet #3, subnet3
      /\bnetuid\s*#?\s*(\d{1,3})\b/gi,       // netuid 3, netuid #3
    ];
    for (const pattern of snPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const m of matches) {
        const n = parseInt(m[1]);
        if (n > 0 && n <= 128) matched.add(n);
      }
    }

    // Name matches — whole-word only, skip blocklisted generic words.
    // Minimum 5 chars so short common words don't slip through.
    for (const [name, netuid] of nameToNetuid) {
      if (name.length >= 5 && !GENERIC_NAME_BLOCKLIST.has(name) && wordMatch(text, name)) {
        matched.add(netuid);
      }
    }

    // Normalized name matches (handles hyphenated/spaced variants like "ready-ai" → "readyai").
    // Require >= 8 chars after normalization to avoid short fragments matching inside longer words.
    const normText = text.replace(/[-_\s]/g, "");
    for (const [norm, netuid] of normNameToNetuid) {
      if (norm.length >= 8 && !GENERIC_NAME_BLOCKLIST.has(norm) && normText.includes(norm)) {
        matched.add(netuid);
      }
    }

    return [...matched];
  }

  // ── Fetch KOL timelines ──────────────────────────────────────────
  // Top 100 KOLs by weight — covers all tier 1+2 plus best of tier 3 (weight ≥ 32).
  // Running all 300 at every-10-min cadence costs ~$2,000/mo; top-100 once/hr = ~$4/day.
  const kols = [...KOL_DATABASE].sort((a, b) => b.weight - a.weight).slice(0, 100);

  const kolResults = await Promise.allSettled(
    kols.map(kol => fetchKolTimeline(kol.handle).then(tweets => ({ kol, tweets })))
  );

  // ── Also run broad Bittensor searches to catch fresh tweets ────────
  let searchTweets: DesearchTweet[] = [];
  const searchQueries = [
    "bittensor subnet",
    "$TAO subnet",
    "tao alpha subnet",
    "affine_io bittensor OR affine_io subnet OR affine_io $TAO",
    "MaxScore bittensor OR MaxScore subnet OR MaxScore $TAO OR MaxScore manako",
  ];
  try {
    const searchResults = await Promise.allSettled(
      searchQueries.map(q =>
        fetch(
          `https://api.desearch.ai/twitter?query=${encodeURIComponent(q)}&sort=Latest&count=30&lang=en`,
          { headers: { Authorization: DESEARCH_KEY }, signal: AbortSignal.timeout(10000) }
        ).then(r => r.ok ? r.json() : null)
      )
    );
    for (const r of searchResults) {
      if (r.status === "fulfilled" && r.value) {
        const tweets = Array.isArray(r.value) ? r.value : (r.value.results || r.value.tweets || []);
        searchTweets.push(...tweets);
      }
    }
  } catch { /* best effort */ }

  // ── Process all tweets ───────────────────────────────────────────
  const WINDOW_MS = (deep ? 24 : 48) * 60 * 60 * 1000; // deep: 24h backfill, normal: 48h rolling
  const newEvents: HeatEvent[] = [];

  const processKolTweet = (tweet: DesearchTweet, kolWeight: number, kolTier: number, kolHandle: string, kolName: string) => {
    if (seenIds.has(tweet.id)) return;
    seenIds.add(tweet.id);

    const tweetAge = Date.now() - new Date(tweet.created_at).getTime();
    if (tweetAge > WINDOW_MS) return;

    const netuids = matchTweet(tweet);
    if (netuids.length === 0) return;

    const engagement = tweet.like_count + tweet.retweet_count + tweet.reply_count + (tweet.quote_count ?? 0);
    const heatScore = computeHeatScore(kolWeight, engagement);
    if (heatScore < 25) return;

    // Credit every subnet mentioned — multi-subnet tweets boost all referenced subnets.
    // Use tweet_id + netuid as the dedup key so one tweet can credit multiple subnets.
    for (const netuid of netuids) {
      newEvents.push({
        tweet_id: `${tweet.id}_${netuid}`,
        netuid,
        subnet_name: netuidToName.get(netuid) ?? `SN${netuid}`,
        kol_handle: kolHandle,
        kol_name: kolName,
        kol_weight: kolWeight,
        kol_tier: kolTier,
        tweet_text: tweet.text.slice(0, 280),
        tweet_url: `https://x.com/${kolHandle}/status/${tweet.id}`,
        engagement,
        heat_score: heatScore,
        detected_at: new Date().toISOString(),
      });
    }
  };

  for (const r of kolResults) {
    if (r.status !== "fulfilled") continue;
    const { kol, tweets } = r.value;
    for (const t of tweets) processKolTweet(t, kol.weight, kol.tier, kol.handle, kol.name);
  }

  // For search results: derive KOL weight from KOL_DATABASE lookup
  const kolMap = new Map(KOL_DATABASE.map(k => [k.handle.toLowerCase(), k]));
  for (const tweet of searchTweets) {
    const kol = kolMap.get(tweet.user.username.toLowerCase());
    if (!kol) continue; // ignore non-KOL accounts in search results for heat events
    processKolTweet(tweet, kol.weight, kol.tier, kol.handle, kol.name);
  }

  // ── Scan official subnet accounts for benchmark/revenue posts ───
  // When a subnet's own account posts about benchmarks, revenue, or metrics,
  // we flag it so the benchmarks page can surface it as fresh data.
  const BENCHMARK_KEYWORDS = [
    "benchmark", "revenue", "mrr", "arr", "annual recurring", "monthly recurring",
    "cost saving", "cost reduction", "cheaper than", "vs gpt", "vs openai", "vs claude",
    "vs aws", "vs google", "outperform", "beats", "faster than", "accuracy", "latency",
    "throughput", "tokens/day", "requests/day", "users", "api calls", "live on",
    "mainnet", "production", "launched", "shipping", "released",
  ];

  const benchmarkAlerts: Array<{
    netuid: number; subnet_name: string; handle: string;
    tweet_url: string; tweet_text: string; engagement: number; detected_at: string;
  }> = [];

  // Check all fetched KOL timelines — official subnet accounts are in handleToNetuid
  for (const r of kolResults) {
    if (r.status !== "fulfilled") continue;
    const { kol, tweets } = r.value;
    const netuid = handleToNetuid.get(kol.handle.toLowerCase());
    if (!netuid) continue; // only official subnet accounts
    for (const tweet of tweets) {
      const text = tweet.text.toLowerCase();
      const hasBenchmarkSignal = BENCHMARK_KEYWORDS.some(kw => text.includes(kw));
      if (!hasBenchmarkSignal) continue;
      const tweetAge = Date.now() - new Date(tweet.created_at).getTime();
      if (tweetAge > 7 * 24 * 3600 * 1000) continue; // only last 7 days
      const engagement = tweet.like_count + tweet.retweet_count + tweet.reply_count + (tweet.quote_count ?? 0);
      benchmarkAlerts.push({
        netuid,
        subnet_name: netuidToName.get(netuid) ?? `SN${netuid}`,
        handle: kol.handle,
        tweet_url: `https://x.com/${kol.handle}/status/${tweet.id}`,
        tweet_text: tweet.text.slice(0, 280),
        engagement,
        detected_at: new Date().toISOString(),
      });
    }
  }

  // Save benchmark alerts to blob if any found
  if (benchmarkAlerts.length > 0 && token) {
    try {
      // Load existing alerts, merge, keep last 30 days
      let existing_alerts: typeof benchmarkAlerts = [];
      try {
        const ab = await (await import("@vercel/blob")).get("benchmark-alerts.json", { token, access: "private" });
        if (ab?.stream) {
          const reader = ab.stream.getReader();
          const chunks: Uint8Array[] = [];
          while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
          existing_alerts = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        }
      } catch { /* start fresh */ }
      const cutoff30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const merged = [...existing_alerts.filter(a => a.detected_at >= cutoff30d), ...benchmarkAlerts];
      // Dedup by tweet_url
      const deduped = [...new Map(merged.map(a => [a.tweet_url, a])).values()]
        .sort((a, b) => b.engagement - a.engagement);
      await put("benchmark-alerts.json", JSON.stringify(deduped), { access: "private", addRandomSuffix: false, allowOverwrite: true, token });
      console.log(`[social-pulse] ${benchmarkAlerts.length} new benchmark alerts saved (${deduped.length} total)`);
    } catch (e) { console.error("[social-pulse] benchmark alerts save failed:", e); }
  }

  // ── Subnet own-account activity scan (throttled to once per 4 hours) ──
  // Measures how actively subnets post on their own Twitter — a consistent tweeting
  // team is a genuine signal even if no KOL has mentioned them recently.
  // Scores 0-25 pts saved to subnet-activity.json, read by the main scan.
  interface SubnetActivityEntry {
    netuid: number; handle: string;
    latestTweetAgeHours: number; // hours since most recent tweet
    weeklyTweetCount: number;    // tweets in last 7 days
    avgEngagement7d: number;     // average engagement per tweet last 7 days
    activityScore: number;       // 0-25
    updatedAt: string;
  }
  interface SubnetActivityBlob { subnets: Record<number, SubnetActivityEntry>; updatedAt: string }

  const SUBNET_ACTIVITY_TTL_H = 4;
  let existingActivity: SubnetActivityBlob = { subnets: {}, updatedAt: "" };
  try {
    const saBlob = await (await import("@vercel/blob")).get("subnet-activity.json", { token, access: "private" });
    if (saBlob?.stream) {
      const reader = saBlob.stream.getReader(); const chunks: Uint8Array[] = [];
      while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
      existingActivity = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    }
  } catch { /* first run */ }

  const activityAgeH = existingActivity.updatedAt
    ? (Date.now() - new Date(existingActivity.updatedAt).getTime()) / 3600000
    : 999;

  if (activityAgeH >= SUBNET_ACTIVITY_TTL_H) {
    console.log(`[social-pulse] Subnet activity data ${Math.round(activityAgeH)}h old — refreshing...`);

    function computeActivityScore(ageHours: number, weeklyCount: number, avgEng: number): number {
      let base = 0;
      if      (ageHours < 12) base = avgEng > 100 ? 22 : avgEng > 30 ? 18 : 14;
      else if (ageHours < 24) base = 12;
      else if (ageHours < 48) base = 9;
      else if (ageHours < 72) base = 6;
      else if (ageHours < 168) base = 3;
      const volBonus = weeklyCount >= 7 ? 3 : weeklyCount >= 3 ? 1 : 0;
      return Math.min(25, base + volBonus);
    }

    // Fetch timelines for all subnets with known Twitter handles
    // Exclude handles already covered in KOL timelines (already processed above)
    const kolHandleSet = new Set(kols.map(k => k.handle.toLowerCase()));
    const subnetHandlesToFetch = [...handleToNetuid.entries()]
      .filter(([handle]) => !kolHandleSet.has(handle.toLowerCase()));

    const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;
    const now = Date.now();

    const subnetActivityResults = await Promise.allSettled(
      subnetHandlesToFetch.map(([handle, netuid]) =>
        fetchKolTimeline(handle).then(tweets => ({ handle, netuid, tweets }))
      )
    );

    const newActivity: SubnetActivityBlob = { subnets: { ...existingActivity.subnets }, updatedAt: new Date().toISOString() };

    for (const r of subnetActivityResults) {
      if (r.status !== "fulfilled") continue;
      const { handle, netuid, tweets } = r.value;
      if (!tweets || tweets.length === 0) continue;

      const recent7d = tweets.filter(t => now - new Date(t.created_at).getTime() <= SEVEN_DAYS_MS);
      if (recent7d.length === 0) {
        newActivity.subnets[netuid] = {
          netuid, handle, latestTweetAgeHours: 9999,
          weeklyTweetCount: 0, avgEngagement7d: 0,
          activityScore: 0, updatedAt: new Date().toISOString(),
        };
        continue;
      }

      const sorted = [...tweets].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latestTweetAgeHours = (now - new Date(sorted[0].created_at).getTime()) / 3600000;
      const weeklyTweetCount = recent7d.length;
      const totalEng = recent7d.reduce((s, t) =>
        s + t.like_count + t.retweet_count + t.reply_count + (t.quote_count ?? 0), 0);
      const avgEngagement7d = weeklyTweetCount > 0 ? totalEng / weeklyTweetCount : 0;
      const activityScore = computeActivityScore(latestTweetAgeHours, weeklyTweetCount, avgEngagement7d);

      newActivity.subnets[netuid] = {
        netuid, handle, latestTweetAgeHours,
        weeklyTweetCount, avgEngagement7d,
        activityScore, updatedAt: new Date().toISOString(),
      };
    }

    // Also process KOL-fetched timelines that happen to be official subnet accounts
    for (const r of kolResults) {
      if (r.status !== "fulfilled") continue;
      const { kol, tweets } = r.value;
      const netuid = handleToNetuid.get(kol.handle.toLowerCase());
      if (!netuid) continue;

      const recent7d = tweets.filter(t => now - new Date(t.created_at).getTime() <= SEVEN_DAYS_MS);
      if (recent7d.length === 0) continue;
      const sorted = [...tweets].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latestTweetAgeHours = (now - new Date(sorted[0].created_at).getTime()) / 3600000;
      const weeklyTweetCount = recent7d.length;
      const totalEng = recent7d.reduce((s, t) =>
        s + t.like_count + t.retweet_count + t.reply_count + (t.quote_count ?? 0), 0);
      const avgEngagement7d = weeklyTweetCount > 0 ? totalEng / weeklyTweetCount : 0;
      const activityScore = computeActivityScore(latestTweetAgeHours, weeklyTweetCount, avgEngagement7d);

      newActivity.subnets[netuid] = {
        netuid, handle: kol.handle, latestTweetAgeHours,
        weeklyTweetCount, avgEngagement7d,
        activityScore, updatedAt: new Date().toISOString(),
      };
    }

    try {
      await put("subnet-activity.json", JSON.stringify(newActivity), {
        access: "private", addRandomSuffix: false, allowOverwrite: true, token,
      });
      const scored = Object.values(newActivity.subnets).filter(s => s.activityScore > 0).length;
      console.log(`[social-pulse] Subnet activity refreshed: ${Object.keys(newActivity.subnets).length} subnets, ${scored} with score > 0`);
    } catch (e) { console.error("[social-pulse] subnet-activity.json save failed:", e); }
  } else {
    console.log(`[social-pulse] Subnet activity data fresh (${Math.round(activityAgeH)}h old), skipping refresh`);
  }

  // ── Merge with existing events ───────────────────────────────────
  // Prune events older than 72h (48h full + 24h decay window)
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const pruned = existing.events.filter(e => e.detected_at >= cutoff);

  const eventMap = new Map<string, HeatEvent>();
  for (const e of pruned) eventMap.set(e.tweet_id, e);
  // New events override old ones — engagement may have grown since first detection
  for (const e of newEvents) {
    const prev = eventMap.get(e.tweet_id);
    if (!prev || e.heat_score > prev.heat_score) eventMap.set(e.tweet_id, e);
  }

  const updated: SocialHot = {
    events: [...eventMap.values()].sort((a, b) => b.heat_score - a.heat_score),
    seen_ids: [...seenIds].slice(-6000), // cap to prevent unbounded growth
    last_pulse: new Date().toISOString(),
  };

  await put("social-hot.json", JSON.stringify(updated), {
    access: "private",
    token,
    allowOverwrite: true,
  });

  const duration = Date.now() - startTime;
  console.log(`[social-pulse] Done in ${duration}ms. ${newEvents.length} new events, ${updated.events.length} total, ${kols.length} KOLs checked.`);

  // Trigger alert scanner if there are new high-heat events
  if (newEvents.some(e => e.heat_score >= 70) && process.env.BLOB_READ_WRITE_TOKEN) {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || "http://localhost:3000";
    fetch(`${base}/api/cron/alert-scanner`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET || ""}` },
      signal: AbortSignal.timeout(90_000),
    }).then(r => console.log(`[social-pulse] Alert scanner triggered: ${r.status}`))
      .catch(e => console.warn("[social-pulse] Alert scanner trigger failed:", e));
  }

  return NextResponse.json({
    ok: true,
    deep,
    duration_ms: duration,
    new_events: newEvents.length,
    total_events: updated.events.length,
    kols_checked: kols.length,
    // Surface top new hits for visibility
    top_new: newEvents
      .sort((a, b) => b.heat_score - a.heat_score)
      .slice(0, 5)
      .map(e => ({ subnet: e.subnet_name, kol: e.kol_handle, heat: e.heat_score, engagement: e.engagement })),
  });
}
