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
  const seenIds = new Set<string>(existing.seen_ids ?? []);

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

  // Bittensor context gate — tweet must mention one of these to be subnet-related.
  // Prevents KOL timeline tweets about VC/crypto/general topics from being labeled as subnets.
  const BITTENSOR_SIGNALS = [
    "bittensor", "$tao", "#tao", "dtao", "opentensor", "taoshi",
    "macrocosmos", "subnet", "netuid", "metagraph", "yuma",
    "tao alpha", "taomarketcap", "taostats",
  ];
  function hasBittensorContext(text: string): boolean {
    const t = text.toLowerCase();
    if (BITTENSOR_SIGNALS.some(s => t.includes(s))) return true;
    // Explicit SN# notation (e.g. "SN64", "sn3") is Bittensor-specific
    if (/\bsn\d{1,3}\b/i.test(t)) return true;
    return false;
  }

  // Generic English words that happen to be subnet names — block from name-based matching.
  // These only match if the tweet has an explicit SN# or @handle reference instead.
  const GENERIC_NAME_BLOCKLIST = new Set([
    "investing", "vision", "atlas", "apex", "prime", "core", "genesis",
    "nexus", "origin", "signal", "pulse", "oracle", "forge", "bridge",
    "score", "quasar", "synth", "swarm", "beam", "nova", "echo",
  ]);

  // Returns ALL matching netuids for a tweet (supports multi-subnet mentions).
  function matchTweet(tweet: DesearchTweet): number[] {
    const text = tweet.text.toLowerCase();
    const author = tweet.user.username.toLowerCase();
    const matched = new Set<number>();

    // Subnet's own official Twitter handle — high confidence.
    if (handleToNetuid.has(author)) {
      if (hasBittensorContext(text)) matched.add(handleToNetuid.get(author)!);
      else {
        const ownName = netuidToName.get(handleToNetuid.get(author)!)?.toLowerCase() || "";
        if (ownName.length >= 4 && text.includes(ownName)) matched.add(handleToNetuid.get(author)!);
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
    const snMatches = [...text.matchAll(/\bsn(\d{1,3})\b/gi)];
    for (const m of snMatches) {
      const n = parseInt(m[1]);
      if (n > 0 && n <= 128) matched.add(n);
    }

    // Name matches — collect ALL subnet names found (skip generic words)
    const normText = text.replace(/[-_\s]/g, "");
    for (const [name, netuid] of nameToNetuid) {
      if (name.length >= 5 && !GENERIC_NAME_BLOCKLIST.has(name) && text.includes(name)) {
        matched.add(netuid);
      }
    }
    for (const [norm, netuid] of normNameToNetuid) {
      if (norm.length >= 5 && !GENERIC_NAME_BLOCKLIST.has(norm) && normText.includes(norm)) {
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

  // ── Also run a quick "latest bittensor" search for non-KOL viral tweets ──
  let searchTweets: DesearchTweet[] = [];
  try {
    const res = await fetch(
      `https://api.desearch.ai/twitter?query=${encodeURIComponent("bittensor subnet")}&sort=Latest&count=50&lang=en`,
      {
        headers: { Authorization: DESEARCH_KEY },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (res.ok) {
      const data = await res.json();
      searchTweets = Array.isArray(data) ? data : (data.results || data.tweets || []);
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
