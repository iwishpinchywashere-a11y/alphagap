import { NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";
import {
  getSubnetIdentities,
  getSubnetPools,
  getTaoFlows,
  getSubnetEmissions,
  getTaoPrice,
  getGithubActivity,
  type SubnetIdentity,
  type SubnetPool,
  type GithubActivity,
} from "@/lib/taostats";

// ── TaoMarketCap API for accurate emission data ──────────────────
const TMC_API_KEY = process.env.TMC_API_KEY || "";
interface TMCSubnet {
  subnet: number;
  name: string;
  emission: number; // actual emission % (e.g. 20.24 for Templar)
  root_prop: number;
  marketcap: number;
  price: number;
  deregistration_risk: boolean;
  miners_tao_per_day: number;
  circulating_supply: number;
  neuron_regs_burned_24h: number;
}
async function fetchTMCSubnets(): Promise<TMCSubnet[]> {
  if (!TMC_API_KEY) return [];
  try {
    const res = await fetch("https://api.taomarketcap.com/public/v1/subnets/table/", {
      headers: { Authorization: TMC_API_KEY },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    console.error("[scan] TMC API failed");
    return [];
  }
}

// Fetch validator counts per subnet from TMC
interface TMCValidator { subnet: number; hotkey: string; coldkey: string }
async function fetchTMCValidators(): Promise<Map<number, number>> {
  if (!TMC_API_KEY) return new Map();
  try {
    const res = await fetch("https://api.taomarketcap.com/public/v1/subnets/validators/?limit=10000", {
      headers: { Authorization: TMC_API_KEY },
    });
    if (!res.ok) return new Map();
    const validators: TMCValidator[] = await res.json();
    // Count per subnet
    const counts = new Map<number, number>();
    for (const v of validators) {
      counts.set(v.subnet, (counts.get(v.subnet) || 0) + 1);
    }
    return counts;
  } catch {
    console.error("[scan] TMC validators API failed");
    return new Map();
  }
}
import { scanAllSubnetGitHub, type GitHubScanResult } from "@/lib/github-scanner";
import { scanAllSubnetsHF, type HFScanResult } from "@/lib/hf-scanner";
import { fetchRecentCommits, fetchRecentPRs, fetchLatestRelease } from "@/lib/context-fetcher";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

const RAO = 1e9;

// ── Desearch fetch (inline, no DB dependency) ─────────────────────
const DESEARCH_API = "https://api.desearch.ai";
const DESEARCH_KEY = process.env.DESEARCH_API_KEY || "";

interface DesearchTweet {
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

async function fetchTweets(
  query: string,
  count: number = 100,
  sort: "Top" | "Latest" = "Top"
): Promise<DesearchTweet[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const params = new URLSearchParams({ query, sort, count: count.toString(), lang: "en" });
    const url = `${DESEARCH_API}/twitter?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: DESEARCH_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[desearch] ${res.status} for query "${query}": ${text}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ── Types ─────────────────────────────────────────────────────────
interface ScanSignal {
  id: number;
  netuid: number;
  signal_type: string;
  strength: number;
  title: string;
  description: string;
  source: string;
  source_url?: string;
  created_at: string;
  signal_date?: string; // actual publish date from GitHub/HF
  subnet_name?: string;
  analysis?: string;
}

interface LeaderboardEntry {
  netuid: number;
  name: string;
  composite_score: number;
  flow_score: number;
  dev_score: number;
  eval_score: number; // Emissions-to-Valuation ratio
  social_score: number;
  signal_count: number;
  top_signal?: string;
  alpha_price?: number;
  market_cap?: number;
  net_flow_24h?: number;
  emission_pct?: number;
  emission_trend?: "up" | "down" | null; // significant change detected
  emission_change_pct?: number; // % change from previous scan
  eval_ratio?: number; // raw emission%/mcap% ratio
  price_change_24h?: number;
  price_change_1h?: number;
  price_change_7d?: number;
  price_change_30d?: number;
  has_campaign?: boolean; // 🔥 Active Stitch3 marketing campaign
  whale_ratio?: number; // avg buy size / avg sell size (>1 = accumulation, <1 = distribution)
  whale_signal?: "accumulating" | "distributing" | null;
}

// ── Stitch3 campaign data (cached in Vercel Blob) ────────────────
interface StitchCampaign {
  id: string;
  subnet: string; // extracted subnet name from campaign ID
  netuid?: number;
  reward: string;
  startDate: string;
  endDate: string;
  tweets: number;
  views: number;
  status: "Active" | "Completed";
}

async function getStitchCampaigns(): Promise<StitchCampaign[]> {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "stitch-campaigns.json", limit: 1 });
    if (!blobs?.length) return getDefaultStitchCampaigns();
    const res = await fetch(blobs[0].downloadUrl, { cache: "no-store" });
    if (!res.ok) return getDefaultStitchCampaigns();
    return await res.json();
  } catch {
    return getDefaultStitchCampaigns();
  }
}

// Fallback: hardcoded from latest Stitch3 scrape (updated 2026-03-30)
function getDefaultStitchCampaigns(): StitchCampaign[] {
  return [
    { id: "033_resilabs", subnet: "RESI", netuid: 46, reward: "$2,000", startDate: "2026-03-29", endDate: "2026-04-08", tweets: 11, views: 6780, status: "Active" },
    { id: "032_targon", subnet: "Targon", netuid: 4, reward: "$1,000", startDate: "2026-03-23", endDate: "2026-03-29", tweets: 43, views: 78970, status: "Active" },
    { id: "031_taostats", subnet: "TaoStats", reward: "$2,500", startDate: "2026-03-15", endDate: "2026-03-30", tweets: 76, views: 167383, status: "Active" },
  ];
}

// ── Main scan handler ─────────────────────────────────────────────
export async function GET() {
  const startTime = Date.now();
  const signals: ScanSignal[] = [];
  let signalId = 1;

  function addSignal(s: Omit<ScanSignal, "id" | "created_at"> & { signal_date?: string }) {
    signals.push({
      ...s,
      id: signalId++,
      strength: Math.round(s.strength), // always integer
      created_at: new Date().toISOString(),
      signal_date: s.signal_date || new Date().toISOString(),
    });
  }

  // ── Step 0: Fetch Stitch3 campaign data ──────────────────────────
  const stitchCampaigns = await getStitchCampaigns();
  const activeCampaigns = stitchCampaigns.filter(c => c.status === "Active" && c.netuid);
  const stitchActiveNetuids = new Set(activeCampaigns.map(c => c.netuid!));
  console.log(`[scan] Stitch3: ${activeCampaigns.length} active campaigns (${[...stitchActiveNetuids].join(", ")})`);

  // ── Step 0b: Load cached Discord scan results ─────────────────────
  type DiscordResult = { channelId: string; channelName: string; netuid: number | null; subnetName: string; signal: "alpha" | "active" | "quiet" | "noise"; summary: string; keyInsights: string[]; messageCount: number; uniquePosters: number; scannedAt: string };
  let discordResults: DiscordResult[] = [];
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { get: getBlob } = await import("@vercel/blob");
      const discordBlob = await getBlob("discord-latest.json", {
        token: process.env.BLOB_READ_WRITE_TOKEN,
        access: "private",
      });
      if (discordBlob?.stream) {
        const reader = discordBlob.stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        discordResults = parsed.results || [];
        console.log(`[scan] Loaded ${discordResults.length} Discord channel results from cache`);
      }
    }
  } catch {
    console.log("[scan] No Discord cache found (run /api/discord-scan first)");
  }

  // ── Step 1: Sequential TaoStats calls to avoid 429 rate limits ──
  // Each call separated by 1s delay. TaoStats enforces strict rate limiting.
  console.log("[scan] Fetching identities...");
  // With upgraded TaoStats API, we can parallelize more aggressively
  // Batch 1: identities + pools + price (all parallel)
  console.log("[scan] Batch 1: identities + pools + price...");
  const [idResult, poolsResult, taoPriceResult] = await Promise.allSettled([
    getSubnetIdentities(),
    getSubnetPools(),
    getTaoPrice(),
  ]);
  let identities = idResult.status === "fulfilled" ? idResult.value : ([] as Awaited<ReturnType<typeof getSubnetIdentities>>);
  const pools = poolsResult.status === "fulfilled" ? poolsResult.value : [];
  const taoPrice = taoPriceResult.status === "fulfilled" ? taoPriceResult.value : 0;
  console.log(`[scan] Batch 1 done: ${identities.length} ids, ${pools.length} pools, TAO=$${taoPrice.toFixed(2)}`);

  await new Promise(r => setTimeout(r, 500));

  // Batch 2: flows + emissions + TaoStats dev (historical 7d/30d) + TMC — all parallel
  // NOTE: TaoStats dev is used for 7d/30d historical context only.
  //       24h commit data comes from the direct GitHub scanner below.
  console.log("[scan] Batch 2: flows + emissions + dev history + TMC...");
  const [flowsResult, emissionsResult, devResult, tmcResult, tmcValResult] = await Promise.allSettled([
    getTaoFlows(),
    getSubnetEmissions(),
    getGithubActivity(),
    fetchTMCSubnets(),
    fetchTMCValidators(),
  ]);
  const flows = flowsResult.status === "fulfilled" ? flowsResult.value : [];
  const emissions = emissionsResult.status === "fulfilled" ? emissionsResult.value : [];
  const devActivity = devResult.status === "fulfilled" ? devResult.value : ([] as Awaited<ReturnType<typeof getGithubActivity>>);
  const tmcSubnets = tmcResult.status === "fulfilled" ? tmcResult.value : [];
  const validatorCounts = tmcValResult.status === "fulfilled" ? tmcValResult.value : new Map<number, number>();
  console.log(`[scan] Batch 2 done: ${flows.length} flows, ${emissions.length} emissions, ${devActivity.length} dev history, ${tmcSubnets.length} TMC`);

  // Build TMC emission map (accurate emission % from TaoMarketCap)
  const tmcMap = new Map<number, TMCSubnet>(tmcSubnets.map(s => [s.subnet, s]));

  // ── Step 2: Build lookup maps ───────────────────────────────────
  const identityMap = new Map<number, SubnetIdentity>(identities.map((i) => [i.netuid, i]));
  const poolMap = new Map<number, SubnetPool>(pools.map((p) => [p.netuid, p]));
  const flowMap = new Map<number, number>(flows.map((f) => [f.netuid, f.tao_flow / RAO]));
  const emissionMap = new Map<number, number>(
    emissions.map((e) => [e.netuid, parseFloat(e.alpha_rewards) / RAO])
  );
  // TaoStats devMap — used for 7d/30d history and repo URLs
  const devMap = new Map<number, GithubActivity>(devActivity.map((d) => [d.netuid, d]));

  // Total emission for share calculation
  let totalEmission = 0;
  for (const v of emissionMap.values()) totalEmission += v;

  // ── Step 3a: Direct GitHub scan — ALL subnets, real-time 24h data ──
  // This is the CORE engine. We query GitHub API directly for every subnet
  // with a registered github_repo. Always fresh — no TaoStats staleness.
  console.log("[scan] Step 3a: Direct GitHub scan (all subnets)...");
  let githubScanMap = new Map<number, GitHubScanResult>();
  try {
    githubScanMap = await scanAllSubnetGitHub(
      identities.map(id => ({ netuid: id.netuid, github_repo: id.github_repo }))
    );
  } catch (e) {
    console.error("[scan] GitHub scanner failed:", e);
  }

  // Merge: override TaoStats commits_1d with direct GitHub data (always fresher)
  for (const [netuid, ghResult] of githubScanMap) {
    const existing = devMap.get(netuid);
    if (existing) {
      existing.commits_1d = ghResult.commits24h;
      existing.unique_contributors_1d = ghResult.contributors24h;
      if (ghResult.commits24h > 0) {
        existing.last_event_at = new Date().toISOString();
      }
    } else if (ghResult.commits24h > 0 || ghResult.hasNewRelease) {
      // Subnet has GitHub activity but wasn't in TaoStats dev data — add it
      devMap.set(netuid, {
        netuid,
        repo_url: ghResult.repoUrl,
        commits_1d: ghResult.commits24h,
        commits_7d: ghResult.commits24h,
        commits_30d: ghResult.commits24h,
        prs_opened_1d: 0,
        prs_merged_1d: 0,
        issues_opened_1d: 0,
        issues_closed_1d: 0,
        reviews_1d: 0,
        comments_1d: 0,
        unique_contributors_1d: ghResult.contributors24h,
        prs_opened_7d: 0,
        prs_merged_7d: 0,
        unique_contributors_7d: ghResult.contributors24h,
        prs_merged_30d: 0,
        unique_contributors_30d: ghResult.contributors24h,
        days_since_last_event: 0,
        last_event_at: new Date().toISOString(),
        as_of_day: new Date().toISOString().slice(0, 10),
      });
    }
  }

  // ── Step 3b: HuggingFace scan — all known orgs + auto-discovery ──
  // Comprehensive scan of ALL subnets with HF presence.
  // Only fires signals for content NEWLY CREATED in last 48h.
  console.log("[scan] Step 3b: HuggingFace scan (all subnets + discovery)...");
  let hfScanMap = new Map<number, HFScanResult>();
  try {
    hfScanMap = await scanAllSubnetsHF(
      identities.map(id => ({ netuid: id.netuid, github_repo: id.github_repo }))
    );
  } catch (e) {
    console.error("[scan] HF scanner failed:", e);
  }

  const elapsed1 = Date.now() - startTime;
  console.log(`[scan] All data fetched in ${elapsed1}ms.`);

  // ── Step 4: Desearch social (4 bulk searches) ───────────────────
  const timeLeftForSocial = 50000 - (Date.now() - startTime);
  const socialMap = new Map<number, { mentions: number; engagement: number }>();

  if (timeLeftForSocial > 5000 && DESEARCH_KEY) {
    console.log("[scan] Fetching Desearch social data...");

    // Build handle->netuid and name->netuid maps from identities
    const handleToNetuid = new Map<string, number>();
    const nameToNetuid = new Map<string, number>();
    for (const id of identities) {
      if (id.twitter) {
        let handle = id.twitter.trim().replace(/^@/, "");
        if (handle.includes("twitter.com/") || handle.includes("x.com/")) {
          handle = handle.split("/").pop() || handle;
        }
        if (handle) handleToNetuid.set(handle.toLowerCase(), id.netuid);
      }
      if (id.subnet_name && id.subnet_name.length >= 4) {
        nameToNetuid.set(id.subnet_name.toLowerCase(), id.netuid);
      }
    }

    function matchTweetToSubnet(tweet: DesearchTweet): number | null {
      const text = tweet.text.toLowerCase();
      const author = tweet.user.username.toLowerCase();
      if (handleToNetuid.has(author)) return handleToNetuid.get(author)!;
      for (const [handle, netuid] of handleToNetuid) {
        if (text.includes(`@${handle}`)) return netuid;
      }
      for (const [name, netuid] of nameToNetuid) {
        if (text.includes(name)) return netuid;
      }
      const snMatch = text.match(/\bsn(\d{1,3})\b/);
      if (snMatch) {
        const netuid = parseInt(snMatch[1]);
        if (netuid > 0 && netuid <= 128) return netuid;
      }
      return null;
    }

    // 8 targeted searches — mix of broad + subnet-specific
    // ~8 credits/scan × 6 scans/day = 48 credits/day → $10 lasts ~200 days
    const searches = [
      { query: "bittensor subnet", count: 100, sort: "Top" as const },
      { query: "bittensor subnet alpha", count: 100, sort: "Latest" as const },
      { query: "$TAO subnet", count: 50, sort: "Latest" as const },
      { query: "templar bittensor", count: 50, sort: "Top" as const },
      { query: "chutes bittensor", count: 50, sort: "Top" as const },
      { query: "ridges basilica grail bittensor", count: 50, sort: "Top" as const },
      { query: "targon vanta ORO bittensor", count: 50, sort: "Top" as const },
      { query: "bittensor alpha SN3 OR SN4 OR SN64 OR SN8", count: 50, sort: "Latest" as const },
    ];

    // Run searches in parallel for speed
    const allTweets = new Map<string, DesearchTweet>();
    try {
      const results = await Promise.allSettled(
        searches.map(s => fetchTweets(s.query, s.count, s.sort))
      );
      for (const r of results) {
        if (r.status === "fulfilled") {
          for (const t of r.value) allTweets.set(t.id, t);
        }
      }
    } catch (e) {
      console.error("[scan] Desearch parallel fetch error:", e);
    }

    // Match tweets to subnets with KOL weighting
    const { getKOLWeight } = await import("@/lib/kol-database");
    for (const tweet of allTweets.values()) {
      const netuid = matchTweetToSubnet(tweet);
      if (!netuid) continue;
      const rawEngagement =
        tweet.like_count + tweet.retweet_count + tweet.reply_count + (tweet.quote_count || 0);

      // KOL weight multiplier: a tweet from const_reborn (weight 100) counts 5x more
      // than a random account (weight 0)
      const kolWeight = getKOLWeight(tweet.user?.username || "");
      const kolMultiplier = kolWeight > 0 ? 1 + (kolWeight / 50) : 1; // max ~3x for top KOLs
      const weightedEngagement = Math.round(rawEngagement * kolMultiplier);

      const existing = socialMap.get(netuid) || { mentions: 0, engagement: 0 };
      existing.mentions++;
      existing.engagement += weightedEngagement;
      socialMap.set(netuid, existing);
    }
    console.log(`[scan] Desearch broad search done. ${allTweets.size} tweets matched to ${socialMap.size} subnets.`);

    // PASS 2: Search for tweets FROM official subnet X handles
    // This captures the subnet's own posting activity + engagement
    const twitterHandleMap = new Map<string, number>(); // handle -> netuid
    for (const id of identities) {
      if (id.twitter) {
        let handle = id.twitter.replace(/https?:\/\/(twitter|x)\.com\//g, "").replace("@", "").replace(/\/$/,"");
        if (handle) twitterHandleMap.set(handle.toLowerCase(), id.netuid);
      }
    }

    // Search for top 15 subnet handles (batch into 3 queries of 5 handles each)
    // Prioritize subnets with high emissions or dev activity
    const priorityNetuids = new Set([
      ...devActivity.filter(a => a.commits_1d > 0).map(a => a.netuid).slice(0, 10),
      ...[...poolMap.entries()].sort((a, b) => parseFloat(b[1].root_prop || "0") - parseFloat(a[1].root_prop || "0")).slice(0, 10).map(([n]) => n),
    ]);

    const handleEntries = [...twitterHandleMap.entries()]
      .filter(([, netuid]) => priorityNetuids.has(netuid))
      .slice(0, 15);

    if (handleEntries.length > 0) {
      // Batch handles into groups of 5 for Desearch "from:" queries
      const handleBatches: string[][] = [];
      for (let i = 0; i < handleEntries.length; i += 5) {
        handleBatches.push(handleEntries.slice(i, i + 5).map(([h]) => h));
      }

      try {
        const handleResults = await Promise.allSettled(
          handleBatches.map(batch => {
            const query = batch.map(h => `from:${h}`).join(" OR ");
            return fetchTweets(query, 50, "Latest");
          })
        );

        for (const r of handleResults) {
          if (r.status !== "fulfilled") continue;
          for (const tweet of r.value) {
            // Match by tweet author handle
            const authorHandle = tweet.user?.username?.toLowerCase() || "";
            const netuid = twitterHandleMap.get(authorHandle);
            if (!netuid) continue;

            const engagement = tweet.like_count + tweet.retweet_count + tweet.reply_count + (tweet.quote_count || 0);
            const existing = socialMap.get(netuid) || { mentions: 0, engagement: 0 };
            existing.mentions++;
            existing.engagement += engagement;
            socialMap.set(netuid, existing);
          }
        }
        console.log(`[scan] Desearch handle search done. ${socialMap.size} subnets with social data.`);
      } catch (e) {
        console.error("[scan] Desearch handle search error:", e);
      }
    }
  }

  // ── Save velocity snapshot from current social data ─────────────
  if (process.env.BLOB_READ_WRITE_TOKEN && socialMap.size > 0) {
    try {
      const { put: putBlob } = await import("@vercel/blob");
      const snapshotData: Record<number, { mentions: number; engagement: number }> = {};
      for (const [netuid, data] of socialMap) {
        snapshotData[netuid] = data;
      }
      // Save timestamped snapshot for velocity comparison
      await putBlob(`social-velocity/${Date.now()}.json`, JSON.stringify({
        timestamp: new Date().toISOString(),
        subnets: snapshotData,
      }), { access: "private", addRandomSuffix: false, contentType: "application/json" });
      console.log(`[scan] Velocity snapshot saved (${socialMap.size} subnets)`);
    } catch (e) {
      console.error("[scan] Failed to save velocity snapshot:", e);
    }
  }

  // ── Step 5: Generate signals (dev + HF ONLY) ───────────────────
  // Flow/price signals REMOVED — this feed is purely about development intelligence

  // ── RICH DEV SIGNALS: AI analysis for EVERY active subnet ───────
  // No cap — every subnet with commits today gets a real analysis, not a placeholder.
  // Commit messages already fetched by github-scanner (no extra GitHub API calls).
  // Top 10 by activity also get PRs + release fetched for richer context.
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  // IMPORTANT: Only use subnets confirmed active by our direct GitHub scanner.
  // Never trust TaoStats commits_1d alone — it's a stale daily snapshot that
  // could make yesterday's (or last week's) commits appear as "today" signals.
  const allActiveDevSubnets = [...devMap.values()]
    .filter(a => {
      const ghResult = githubScanMap.get(a.netuid);
      return ghResult && (ghResult.commits24h > 0 || ghResult.hasNewRelease);
    })
    .sort((a, b) => (b.commits_1d + b.prs_merged_1d * 5) - (a.commits_1d + a.prs_merged_1d * 5));

  console.log(`[scan] ${allActiveDevSubnets.length} active subnets — fetching PR/release context for top 10, commit-only for the rest...`);

  type DevContext = { act: GithubActivity; owner: string; repo: string; commits: string[]; prs: string[]; release: { tag: string; name: string; body: string; date: string } | null };
  const devContexts: DevContext[] = [];

  // All subnets: reuse commit messages from github-scanner
  // Top 10: also fetch PRs + latest release for richer AI context
  const deepResults = await Promise.allSettled(
    allActiveDevSubnets.map(async (act, idx) => {
      let repoPath = act.repo_url || "";
      if (repoPath.includes("github.com/")) repoPath = repoPath.split("github.com/")[1];
      repoPath = repoPath.replace(/^\/|\/$/g, "").replace(/\.git$/, "");
      const parts = repoPath.split("/");
      if (parts.length < 2) return null;
      const [owner, repo] = parts;

      // Always reuse commit messages from github-scanner (already fetched, no extra call)
      const ghScan = githubScanMap.get(act.netuid);
      const commits = ghScan?.commitMessages.length
        ? ghScan.commitMessages
        : await fetchRecentCommits(owner, repo, 8);

      // Top 10 by activity get PRs + release for richer context
      let prs: string[] = [];
      let release: { tag: string; name: string; body: string; date: string } | null = null;
      if (idx < 10) {
        const [prsResult, releaseResult] = await Promise.all([
          fetchRecentPRs(owner, repo, 4),
          fetchLatestRelease(owner, repo),
        ]);
        prs = prsResult;
        release = releaseResult;
      }

      return { act, owner, repo, commits, prs, release };
    })
  );
  for (const r of deepResults) {
    if (r.status === "fulfilled" && r.value) devContexts.push(r.value);
  }

  console.log(`[scan] Context built for ${devContexts.length} subnets. Running AI analysis on all of them...`);

  // AI analysis returns both a description AND a quality-based score (1-100)
  // Score reflects what was actually built, not commit count.
  async function analyzeDevActivity(ctx: DevContext): Promise<{ description: string; score: number }> {
    if (!ANTHROPIC_KEY) return { description: buildFallbackDescription(ctx), score: fallbackScore(ctx) };

    const name = identityMap.get(ctx.act.netuid)?.subnet_name || `SN${ctx.act.netuid}`;
    const pool = poolMap.get(ctx.act.netuid);
    const price = pool ? (parseFloat(pool.price || "0") / RAO * taoPrice).toFixed(2) : "?";
    const mcap = pool ? "$" + (parseFloat(pool.market_cap || "0") / RAO * taoPrice / 1e6).toFixed(1) + "M" : "?";
    const priceChange = pool?.price_change_1_day ? parseFloat(pool.price_change_1_day).toFixed(1) : "?";

    const commitText = ctx.commits.slice(0, 8).join("\n");
    const prText = ctx.prs.slice(0, 4).join("\n");
    const releaseText = ctx.release ? `Latest release: ${ctx.release.name} (${ctx.release.tag})\n${ctx.release.body.slice(0, 500)}` : "";

    const prompt = `You are the AlphaGap intelligence engine — the world's sharpest Bittensor subnet analyst. You read raw GitHub commits and PRs and produce investment-grade intelligence signals.

Your job is to score the INVESTMENT OPPORTUNITY, not just the dev work in isolation. The score answers: "How much should a serious crypto investor care about this right now?"

SUBNET INFO:
Name: ${name} (SN${ctx.act.netuid})
Repo: ${ctx.owner}/${ctx.repo}
Token: $${price} (24h change: ${priceChange}%) | Market Cap: ${mcap}
Today's activity: ${ctx.act.commits_1d} commits, ${ctx.act.prs_merged_1d} merged PRs, ${ctx.act.unique_contributors_1d} contributors

RAW COMMITS (this is the evidence — read carefully):
${commitText || "No commits found"}

MERGED PULL REQUESTS:
${prText || "No PRs found"}

${releaseText}

Write your intelligence report in this EXACT format:

SCORE: [number 1-100]

🔧 What they built:
[Specific features, fixes, models, or improvements. Name actual things. No vague statements.]

📡 Why it matters:
[Why is this significant? What problem does it solve?]

💡 In simple terms:
[Explain to a smart non-technical friend over coffee. Use analogies.]

🎯 The AlphaGap take:
[Your boldest, most direct investment call. Is the market sleeping on this? Is this priced in or not? Be opinionated.]

HOW TO SCORE — the score is INVESTMENT SIGNAL STRENGTH, which is (dev quality) × (market opportunity):

DEV QUALITY alone:
- Routine: dependency bumps, CI fixes, minor bug fixes, config tweaks → base 15-25
- Incremental: small features, refactors, test additions, performance tweaks → base 30-45
- Meaningful: new capabilities, architectural work, notable feature shipping → base 50-65
- Significant: major features, protocol upgrades, model integrations, new releases → base 70-80
- Extraordinary: paradigm shifts, breakthrough capabilities → base 85-95

MARKET OPPORTUNITY multiplier — adjust the base score UP or DOWN:
- Small market cap ($1M-$10M) actively building → strong undervaluation signal, +10 to +20
- Medium market cap ($10M-$50M) with active dev → worth noting, +5 to +10
- Large market cap ($50M+) with routine commits → likely priced in, -5 to -15
- Token down 10%+ while team is building hard → market sleeping, +10 to +15
- Token up 20%+ today → momentum already reflected, -5 to -10
- Multiple contributors (5+) showing up → team is serious, +5

EXAMPLES of calibrated scores:
- Dependency bumps + CI fixes at $50M mcap: 18
- Solid refactor + new test suite at $8M mcap (team building quietly): 52
- New model integration at $15M mcap, token down 8%: 71
- Major protocol upgrade + new release at $20M mcap, token flat: 83
- Routine config change at $200M mcap, token up 30%: 12

Each section: 2-3 sentences MAX. Complete all 4 sections. End with a complete sentence.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return { description: buildFallbackDescription(ctx), score: fallbackScore(ctx) };
      const data = await res.json();
      const text: string = data.content?.[0]?.text || "";

      // Parse SCORE: from first line
      const scoreMatch = text.match(/^SCORE:\s*(\d+)/m);
      const score = scoreMatch ? Math.min(100, Math.max(1, parseInt(scoreMatch[1]))) : fallbackScore(ctx);

      // Strip the SCORE line from the description shown to users
      const description = text.replace(/^SCORE:\s*\d+\s*\n?/m, "").trim();

      console.log(`[scan] AI scored SN${ctx.act.netuid} (${name}): ${score}/100`);
      return { description, score };
    } catch {
      return { description: buildFallbackDescription(ctx), score: fallbackScore(ctx) };
    }
  }

  function buildFallbackDescription(ctx: DevContext): string {
    const commitSummary = ctx.commits.slice(0, 5).map(c => {
      const match = c.match(/\]: .{7}: (.+)/);
      return match ? match[1].split("\n")[0] : c;
    }).join("; ");
    const prSummary = ctx.prs.slice(0, 3).map(p => {
      const match = p.match(/PR: (.+)/);
      return match ? match[1].split("\n")[0] : p;
    }).join("; ");
    let desc = "";
    if (commitSummary) desc += `Recent commits: ${commitSummary}. `;
    if (prSummary) desc += `Merged PRs: ${prSummary}. `;
    if (ctx.release) desc += `Latest release: ${ctx.release.name}. `;
    return desc || `${ctx.act.commits_1d} commits and ${ctx.act.prs_merged_1d} PRs merged today.`;
  }

  // Fallback score when AI is unavailable — conservative, commit-count based
  function fallbackScore(ctx: DevContext): number {
    let s = 20;
    if (ctx.act.commits_1d >= 10) s += 15;
    else if (ctx.act.commits_1d >= 5) s += 10;
    else if (ctx.act.commits_1d >= 1) s += 5;
    if (ctx.act.prs_merged_1d >= 3) s += 15;
    else if (ctx.act.prs_merged_1d >= 1) s += 8;
    if (ctx.release) s += 10;
    return Math.min(60, s); // cap fallback at 60 — AI must judge higher scores
  }

  // Try AI analysis for as many signals as time allows
  const timeLeftForAI = 200000 - (Date.now() - startTime);
  console.log(`[scan] AI analysis: ${devContexts.length} signals, ${(timeLeftForAI/1000).toFixed(0)}s left`);

  const analyzedDevSignals: { ctx: DevContext; description: string; score: number }[] = [];

  if (timeLeftForAI > 8000 && ANTHROPIC_KEY) {
    try {
      const aiResults = await Promise.race([
        Promise.all(devContexts.map(async (ctx) => {
          const { description, score } = await analyzeDevActivity(ctx);
          return { ctx, description, score };
        })),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("AI timeout")), timeLeftForAI - 3000)),
      ]);
      analyzedDevSignals.push(...aiResults);
      console.log(`[scan] AI done: ${aiResults.length} analyzed`);
    } catch {
      console.log("[scan] AI timed out, using fallback for remaining");
      if (analyzedDevSignals.length === 0) {
        for (const ctx of devContexts) {
          analyzedDevSignals.push({ ctx, description: buildFallbackDescription(ctx), score: fallbackScore(ctx) });
        }
      }
    }
  } else {
    for (const ctx of devContexts) {
      analyzedDevSignals.push({ ctx, description: buildFallbackDescription(ctx), score: fallbackScore(ctx) });
    }
  }

  console.log(`[scan] Analyzed ${analyzedDevSignals.length} dev signals with AI.`);

  // Create rich dev signals — score from AI quality assessment, date from real commits
  for (const { ctx, description, score } of analyzedDevSignals) {
    const name = identityMap.get(ctx.act.netuid)?.subnet_name || `SN${ctx.act.netuid}`;
    const ghResult = githubScanMap.get(ctx.act.netuid);

    // Real commit date from "[YYYY-MM-DD] sha: msg" format
    let commitDate = new Date().toISOString();
    if (ctx.commits.length > 0) {
      const m = ctx.commits[0].match(/^\[(\d{4}-\d{2}-\d{2})\]/);
      if (m) commitDate = new Date(m[1]).toISOString();
    } else if (ghResult?.releaseDate) {
      commitDate = ghResult.releaseDate;
    }

    const displayDate = new Date(commitDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const activitySummary = [
      ctx.act.commits_1d > 0 ? `${ctx.act.commits_1d} commits` : "",
      ctx.act.prs_merged_1d > 0 ? `${ctx.act.prs_merged_1d} PRs merged` : "",
      ghResult?.hasNewRelease ? `new release ${ghResult.releaseTag}` : "",
    ].filter(Boolean).join(" & ");

    addSignal({
      netuid: ctx.act.netuid,
      signal_type: "dev_spike",
      strength: score, // AI-assigned quality score, not a commit-count formula
      title: `${name} pushed ${activitySummary} to GitHub (${displayDate})`,
      description,
      source: "github",
      source_url: ctx.act.repo_url,
      subnet_name: name,
      signal_date: commitDate,
    });
  }

  // (No fallback loop — every active subnet is now in devContexts and gets AI analysis)

  // New release signals — from direct GitHub scanner (fires when a release was published in last 24h)
  for (const [netuid, ghResult] of githubScanMap) {
    if (!ghResult.hasNewRelease) continue;
    const name = identityMap.get(netuid)?.subnet_name || `SN${netuid}`;
    const alreadyHasDeepSignal = devContexts.some(ctx => ctx.act.netuid === netuid);
    if (alreadyHasDeepSignal) continue; // deep analysis signal already covers this
    addSignal({
      netuid,
      signal_type: "dev_spike",
      strength: 75, // releases are high-signal
      title: `${name} released ${ghResult.releaseName || ghResult.releaseTag} on GitHub`,
      description: `New release: ${ghResult.releaseTag}${ghResult.releaseBody ? `\n${ghResult.releaseBody.slice(0, 500)}` : ""}`,
      source: "github",
      source_url: `https://github.com/${ghResult.owner}/${ghResult.repo}/releases`,
      subnet_name: name,
      signal_date: ghResult.releaseDate || new Date().toISOString(),
    });
  }

  // HuggingFace update signals — only fires when new content published in last 48h
  // Coverage: ALL subnets tracked by hf-scanner (known orgs + auto-discovered)
  for (const [netuid, hf] of hfScanMap) {
    const newTotal = hf.newModels + hf.newDatasets + hf.newSpaces;
    if (newTotal === 0) continue;

    const name = identityMap.get(netuid)?.subnet_name || `SN${netuid}`;
    const orgsStr = hf.orgs.join(", ");
    const newParts: string[] = [];
    if (hf.newModels > 0) newParts.push(`${hf.newModels} new model${hf.newModels > 1 ? "s" : ""}`);
    if (hf.newDatasets > 0) newParts.push(`${hf.newDatasets} new dataset${hf.newDatasets > 1 ? "s" : ""}`);
    if (hf.newSpaces > 0) newParts.push(`${hf.newSpaces} new space${hf.newSpaces > 1 ? "s" : ""}`);

    const detailParts: string[] = [];
    if (hf.newModelNames.length > 0) detailParts.push(`New models: ${hf.newModelNames.slice(0, 5).join(", ")}`);
    if (hf.newDatasetNames.length > 0) detailParts.push(`New datasets: ${hf.newDatasetNames.slice(0, 5).join(", ")}`);
    if (hf.newSpaceNames.length > 0) detailParts.push(`New spaces: ${hf.newSpaceNames.slice(0, 3).join(", ")}`);
    const contextParts: string[] = [];
    if (hf.totalModels > 0) contextParts.push(`${hf.totalModels} total models`);
    if (hf.totalDatasets > 0) contextParts.push(`${hf.totalDatasets} total datasets`);
    const detailedDesc = `${orgsStr} published ${newParts.join(", ")} on HuggingFace in the last 48h.\n${detailParts.join("\n")}\nLibrary: ${contextParts.join(", ")} (${hf.totalDownloads.toLocaleString()} total downloads)`;

    addSignal({
      netuid,
      signal_type: "hf_update",
      strength: Math.min(85, 40 + hf.newModels * 12 + hf.newDatasets * 8 + hf.newSpaces * 5 + Math.min(hf.totalDownloads / 1000, 20)),
      title: `${name} published ${newParts.join(" & ")} on HuggingFace`,
      description: detailedDesc,
      source: "huggingface",
      source_url: `https://huggingface.co/${hf.orgs[0] || ""}`,
      subnet_name: name,
      signal_date: hf.latestDate || new Date().toISOString(),
    });
  }

  // ── Step 6: Compute leaderboard in-memory ───────────────────────
  // Collect all netuids we have data for
  const allNetuids = new Set<number>();
  for (const id of identities) if (id.netuid > 0) allNetuids.add(id.netuid);
  for (const [n] of poolMap) if (n > 0) allNetuids.add(n);

  // Helper: percentile rank
  function percentileRank(values: number[], value: number): number {
    if (values.length === 0) return 0;
    const below = values.filter((v) => v < value).length;
    const equal = values.filter((v) => v === value).length;
    return Math.round(((below + equal * 0.5) / values.length) * 100);
  }

  // Build raw data per subnet
  interface RawSubnet {
    netuid: number;
    name: string;
    priceChange24h: number;
    priceChange1h: number;
    priceChange1w: number;
    priceChange1m: number;
    alphaPriceUsd: number | null;
    marketCapUsd: number | null;
    volumeUsd: number | null;
    netFlow24h: number | null;
    taoReserve: number | null;
    emissionShare: number; // root_prop (0-1) from TaoStats
    emissionPct: number; // accurate emission % from TaoMarketCap (e.g. 20.27 for Templar)
    // Dev metrics
    ghCommits7d: number;
    ghPRsMerged7d: number;
    ghContributors30d: number;
    ghEvents: number;
    // HF metrics
    hfModels: number;
    hfDatasets: number;
    hfSpaces: number;
    hfDownloads: number;
    // Validator/Miner counts
    validatorCount: number;
    minerCount: number; // estimated as maxNeurons - validatorCount
    regsBurned24h: number; // TAO burned on registrations in 24h (proxy for new miners)
    // Social
    socialMentions: number;
    socialEngagement: number;
  }

  const rawSubnets: RawSubnet[] = [];

  for (const netuid of allNetuids) {
    const identity = identityMap.get(netuid);
    const pool = poolMap.get(netuid);
    const dev = devMap.get(netuid);
    const hf = hfScanMap.get(netuid);
    const social = socialMap.get(netuid);

    const name = identity?.subnet_name || pool?.name || `Subnet ${netuid}`;
    if (name === "Unknown" || name === "") continue;

    const priceChange = pool?.price_change_1_day ? parseFloat(pool.price_change_1_day) : 0;
    const priceChange1h = pool?.price_change_1_hour ? parseFloat(pool.price_change_1_hour) : 0;
    const alphaPriceUsd = pool ? parseFloat(pool.price) * taoPrice : null;
    const marketCapUsd = pool ? (parseFloat(pool.market_cap) / RAO) * taoPrice : null;
    const volumeUsd = pool ? (parseFloat(pool.tao_volume_24_hr) / RAO) * taoPrice : null;
    const buyVol = pool ? parseFloat(pool.tao_buy_volume_24_hr || "0") / RAO : 0;
    const sellVol = pool ? parseFloat(pool.tao_sell_volume_24_hr || "0") / RAO : 0;
    const netFlow24h = pool ? buyVol - sellVol : null;
    const taoReserve = pool ? parseFloat(pool.total_tao) / RAO : null;

    const emission = emissionMap.get(netuid) || 0;
    const emissionShare = totalEmission > 0 ? emission / totalEmission : 0;

    // Dev: parse from TaoStats dev_activity
    const ghCommits7d = dev?.commits_7d || 0;
    const ghPRsMerged7d = dev?.prs_merged_7d || 0;
    const ghContributors30d = dev?.unique_contributors_30d || 0;
    const ghEvents = (dev?.commits_7d || 0) + (dev?.prs_merged_7d || 0);

    const coverageRatio = sellVol > 0 ? buyVol / sellVol : buyVol > 0 ? 10 : 0;

    const priceChange1w = pool?.price_change_1_week ? parseFloat(pool.price_change_1_week) : 0;
    const priceChange1m = pool?.price_change_1_month ? parseFloat(pool.price_change_1_month) : 0;

    rawSubnets.push({
      netuid,
      name,
      priceChange24h: priceChange,
      priceChange1h,
      priceChange1w,
      priceChange1m,
      alphaPriceUsd,
      marketCapUsd,
      volumeUsd,
      netFlow24h,
      taoReserve,
      emissionShare,
      emissionPct: tmcMap.get(netuid)?.emission || 0,
      ghCommits7d,
      ghPRsMerged7d,
      ghContributors30d,
      ghEvents,
      hfModels: hf?.totalModels || 0,
      hfDatasets: hf?.totalDatasets || 0,
      hfSpaces: hf?.totalSpaces || 0,
      hfDownloads: hf?.totalDownloads || 0,
      validatorCount: validatorCounts.get(netuid) || 0,
      minerCount: Math.max(0, 256 - (validatorCounts.get(netuid) || 0)), // max 256 neurons per subnet
      regsBurned24h: tmcMap.get(netuid)?.neuron_regs_burned_24h || 0,
      socialMentions: social?.mentions || 0,
      socialEngagement: social?.engagement || 0,
    });
  }

  // ── Compute absolute dev score (not percentile) ─────────────────
  // Multiple subnets can share the same score. Based on actual activity quality.
  function computeDevScore(d: RawSubnet): number {
    const dev = devMap.get(d.netuid);
    const commits1d = dev?.commits_1d || 0;
    const commits7d = dev?.commits_7d || 0;
    const commits30d = dev?.commits_30d || 0;
    const prs1d = dev?.prs_merged_1d || 0;
    const prs7d = dev?.prs_merged_7d || 0;
    const contributors1d = dev?.unique_contributors_1d || 0;
    const contributors30d = dev?.unique_contributors_30d || 0;

    // Use the BEST timeframe — some subnets push in bursts
    // Score each timeframe independently and take the highest
    let ghScore = 0;

    // --- 7-day score (most balanced view) ---
    let weekly = 0;
    if (commits7d >= 100) weekly += 55;
    else if (commits7d >= 50) weekly += 45;
    else if (commits7d >= 25) weekly += 35;
    else if (commits7d >= 10) weekly += 22;
    else if (commits7d >= 5) weekly += 14;
    else if (commits7d >= 1) weekly += 7;

    if (prs7d >= 10) weekly += 25;
    else if (prs7d >= 5) weekly += 20;
    else if (prs7d >= 3) weekly += 15;
    else if (prs7d >= 1) weekly += 8;

    // --- Today score (freshness bonus — multiplied up) ---
    let daily = 0;
    if (commits1d >= 20) daily += 55;
    else if (commits1d >= 10) daily += 45;
    else if (commits1d >= 5) daily += 32;
    else if (commits1d >= 3) daily += 22;
    else if (commits1d >= 1) daily += 12;

    if (prs1d >= 3) daily += 25;
    else if (prs1d >= 1) daily += 15;

    // Take the better of weekly or daily
    ghScore = Math.max(weekly, daily);

    // Contributor bonus on top (max 15 pts)
    if (contributors30d >= 10) ghScore += 15;
    else if (contributors30d >= 5) ghScore += 10;
    else if (contributors30d >= 3) ghScore += 7;
    else if (contributors30d >= 1) ghScore += 3;

    // Cap GitHub at 90
    ghScore = Math.min(90, ghScore);

    // === HUGGINGFACE bonus (max 20 pts on top) ===
    let hfScore = 0;
    if (d.hfModels >= 5) hfScore += 10;
    else if (d.hfModels >= 3) hfScore += 7;
    else if (d.hfModels >= 1) hfScore += 4;

    if (d.hfDatasets >= 3) hfScore += 5;
    else if (d.hfDatasets >= 1) hfScore += 2;

    if (d.hfDownloads >= 5000) hfScore += 5;
    else if (d.hfDownloads >= 500) hfScore += 3;
    else if (d.hfDownloads >= 50) hfScore += 1;

    return Math.min(100, ghScore + hfScore);
  }

  // ── Flow score formula (multi-timeframe momentum) ───────────────
  // Combines 24h, 7d, and 30d price momentum.
  // High score = strong upward momentum across timeframes.
  // Also detects REVERSALS: down long-term but turning up short-term.
  function computeFlowScore(d: RawSubnet): number {
    const pch24h = d.priceChange24h || 0;
    const pch7d = d.priceChange1w || 0;
    const pch30d = d.priceChange1m || 0;

    // WHALE ACTIVITY (0-15 pts) — avg buy size vs avg sell size
    // If whales are buying (big avg buy), that's a leading flow indicator
    let whaleScore = 0;
    const poolData = poolMap.get(d.netuid);
    if (poolData) {
      const buys = poolData.buys_24_hr || 0;
      const sells = poolData.sells_24_hr || 0;
      const buyVol = parseFloat(poolData.tao_buy_volume_24_hr || "0") / RAO;
      const sellVol = parseFloat(poolData.tao_sell_volume_24_hr || "0") / RAO;
      if (buys > 3 && sells > 3) {
        const avgBuy = buyVol / buys;
        const avgSell = sellVol / sells;
        if (avgSell > 0) {
          const wr = avgBuy / avgSell;
          if (wr >= 3.0) whaleScore = 15;       // Heavy whale accumulation
          else if (wr >= 2.0) whaleScore = 10;  // Clear whale buying
          else if (wr >= 1.5) whaleScore = 6;   // Moderate whale interest
          else if (wr >= 1.0) whaleScore = 3;   // Slight buy-side lean
          else if (wr <= 0.3) whaleScore = -8;  // Whales dumping hard
          else if (wr <= 0.5) whaleScore = -5;  // Whales distributing
        }
      }
    }

    // 24h momentum (0-35 pts) — most weighted for recency (reduced from 40 to make room for whales)
    let score24h = 0;
    if (pch24h >= 15) score24h = 35;
    else if (pch24h >= 8) score24h = 30;
    else if (pch24h >= 4) score24h = 27;
    else if (pch24h >= 2) score24h = 22;
    else if (pch24h >= 0) score24h = 18;
    else if (pch24h >= -3) score24h = 13;
    else if (pch24h >= -8) score24h = 8;
    else if (pch24h >= -15) score24h = 4;
    else score24h = 1;

    // 7d momentum (0-30 pts)
    let score7d = 0;
    if (pch7d >= 30) score7d = 30;
    else if (pch7d >= 15) score7d = 25;
    else if (pch7d >= 5) score7d = 20;
    else if (pch7d >= 0) score7d = 15;
    else if (pch7d >= -10) score7d = 10;
    else if (pch7d >= -25) score7d = 5;
    else score7d = 1;

    // 30d momentum (0-20 pts)
    let score30d = 0;
    if (pch30d >= 50) score30d = 20;
    else if (pch30d >= 20) score30d = 17;
    else if (pch30d >= 5) score30d = 14;
    else if (pch30d >= 0) score30d = 11;
    else if (pch30d >= -20) score30d = 7;
    else if (pch30d >= -50) score30d = 3;
    else score30d = 1;

    // REVERSAL BONUS (0-10 pts) — down long-term but turning up short-term
    // This is the magic: "just starting to perk up" signal
    let reversalBonus = 0;
    if (pch30d <= -20 && pch24h >= 2) reversalBonus = 10;  // Down 20%+ monthly, up 2%+ today
    else if (pch30d <= -15 && pch24h >= 1) reversalBonus = 8;
    else if (pch7d <= -15 && pch24h >= 2) reversalBonus = 7;  // Down 15%+ weekly, up today
    else if (pch7d <= -10 && pch24h >= 1) reversalBonus = 5;
    else if (pch30d <= -10 && pch7d >= 0 && pch24h >= 0) reversalBonus = 3;  // Monthly down but weekly stabilizing

    return Math.max(1, Math.min(100, score24h + score7d + score30d + reversalBonus + whaleScore));
  }

  // ── eVal: Emissions-to-Valuation score ──────────────────────────
  // Finds the gap between network emissions allocated to a subnet
  // and its market cap valuation. High emissions + low mcap = undervalued.
  //
  // Also factors in emission TREND — if emissions are rising but
  // price isn't following, that's a widening value gap.

  // Pre-compute total emission and total mcap for normalization
  const totalEmissionPct = rawSubnets.reduce((sum, d) => sum + d.emissionPct, 0);
  const totalMcapUsd = rawSubnets.reduce((sum, d) => sum + (d.marketCapUsd || 0), 0);

  function computeEvalScore(d: RawSubnet): { score: number; ratio: number } {
    let score = 0;

    // Use accurate emission % from TaoMarketCap
    const emPct = d.emissionPct; // e.g. 20.27 for Templar, 0 for Chutes
    const mcapUsd = d.marketCapUsd || 0;

    // Emission share as fraction of total emissions
    const emShare = totalEmissionPct > 0 ? emPct / totalEmissionPct : 0;
    // Market cap share as fraction of total market cap
    const mcShare = totalMcapUsd > 0 ? mcapUsd / totalMcapUsd : 0;

    // Core eVal ratio: emission share / market cap share
    // > 1 = undervalued (network paying more than market realizes)
    // < 1 = overvalued (market values it more than emissions justify)
    const evalRatio = mcShare > 0.0001 ? emShare / mcShare : 0;

    // 1. EMISSION LEVEL (max 35 pts) — how much is the network emitting to this subnet?
    if (emPct >= 10) score += 35;        // Top tier (Templar 20%, Targon 18%)
    else if (emPct >= 5) score += 30;    // Strong (grail 6%)
    else if (emPct >= 3) score += 25;    // Good (Affine 3.7%, basilica 2.9%)
    else if (emPct >= 1.5) score += 20;  // Moderate
    else if (emPct >= 0.5) score += 15;  // Some
    else if (emPct > 0) score += 8;      // Minimal
    // 0% = no emissions, no points

    // 2. VALUATION GAP (max 40 pts) — emissions outpacing market cap
    if (evalRatio >= 20) score += 40;     // Massively undervalued by emissions
    else if (evalRatio >= 10) score += 35;
    else if (evalRatio >= 5) score += 30;
    else if (evalRatio >= 3) score += 25;
    else if (evalRatio >= 2) score += 20;
    else if (evalRatio >= 1.5) score += 15;
    else if (evalRatio >= 1.0) score += 10; // Fair value
    else if (evalRatio >= 0.5) score += 5;  // Slightly overvalued
    // < 0.5 = overvalued, no points

    // 3. PRICE TREND DIVERGENCE (max 25 pts)
    // If price is DOWN while emissions are high, the gap is WIDENING
    const pch1w = d.priceChange1w || 0;
    const pch1m = d.priceChange1m || 0;

    if (emPct >= 0.3) { // Only matters for subnets with meaningful emissions
      // Weekly: price dropping = gap widening
      if (pch1w <= -20) score += 15;
      else if (pch1w <= -10) score += 12;
      else if (pch1w <= -5) score += 8;
      else if (pch1w <= 0) score += 5;
      else if (pch1w <= 10) score += 2;
      // Price pumping = gap closing, no points

      // Monthly: price not catching up to emission growth
      if (pch1m <= -30) score += 10;
      else if (pch1m <= -10) score += 7;
      else if (pch1m <= 0) score += 4;
      else if (pch1m <= 20) score += 2;
      // Big monthly pump = gap has closed
    }

    // 4. NETWORK PARTICIPATION (max 15 pts)
    // High validators + miners = network confidence
    // Regs burned = demand for slots (new miners joining)
    const vals = d.validatorCount;
    const regs = d.regsBurned24h;

    // Validator count (max 8 pts) — more validators = more confidence
    if (vals >= 60) score += 8;
    else if (vals >= 50) score += 6;
    else if (vals >= 40) score += 5;
    else if (vals >= 30) score += 3;
    else if (vals >= 15) score += 2;

    // Registration burns in 24h (max 7 pts) — new miners joining
    // neuron_regs_burned_24h is in rao (1e9 = 1 TAO)
    const regsTao = regs / 1e9;
    if (regsTao >= 5) score += 7;      // Heavy registration activity
    else if (regsTao >= 2) score += 5;
    else if (regsTao >= 0.5) score += 3;
    else if (regsTao > 0) score += 1;

    // 5. MARKET CAP PENALTY — tiny subnets get inflated ratios
    // A $200K subnet with 0.5% emissions looks like 10x ratio but it's just illiquid
    if (mcapUsd < 100000) score -= 40;        // ghost subnet, ratio is meaningless
    else if (mcapUsd < 300000) score -= 30;   // micro cap, very risky
    else if (mcapUsd < 500000) score -= 20;   // tiny, ratio inflated
    else if (mcapUsd < 1000000) score -= 12;  // small, moderate penalty
    else if (mcapUsd < 3000000) score -= 5;   // emerging, slight discount

    return { score: Math.max(0, Math.min(100, score)), ratio: evalRatio };
  }

  // ── Compute velocity from historical snapshots ──────────────────
  let velocityData: Record<number, { velocityScore: number; acceleration: number; trend: string }> = {};
  if (process.env.BLOB_READ_WRITE_TOKEN && socialMap.size > 0) {
    try {
      const { list: listBlobs } = await import("@vercel/blob");
      const { blobs } = await listBlobs({ prefix: "social-velocity/", limit: 10 });

      if (blobs.length >= 2) {
        // Get oldest snapshot to compare against
        const sorted = blobs.sort((a, b) => a.pathname.localeCompare(b.pathname));
        const oldestBlob = sorted[0]; // oldest

        const oldRes = await fetch(oldestBlob.downloadUrl);
        if (oldRes.ok) {
          const oldest = await oldRes.json();
          const oldTime = new Date(oldest.timestamp).getTime();
          const nowTime = Date.now();
          const timeDiffMin = (nowTime - oldTime) / 60000;

          if (timeDiffMin > 5) {
            for (const [netuid, current] of socialMap) {
              const old = oldest.subnets?.[netuid];
              const mentionsNow = current.mentions;
              const mentionsThen = old?.mentions || 0;
              const engNow = current.engagement;
              const engThen = old?.engagement || 0;

              const mentionVelocity = (mentionsNow - mentionsThen) / timeDiffMin;
              const engVelocity = (engNow - engThen) / timeDiffMin;

              const velocityScore = Math.min(100, Math.round(
                (mentionVelocity * 10) + (engVelocity * 0.5)
              ));

              let trend = "stable";
              if (mentionVelocity > 1) trend = "accelerating";
              else if (mentionVelocity > 0.2) trend = "growing";
              else if (mentionVelocity < -0.2) trend = "cooling";

              if (velocityScore > 0 || trend !== "stable") {
                velocityData[netuid] = { velocityScore: Math.max(0, velocityScore), acceleration: mentionVelocity, trend };
              }
            }
            console.log(`[scan] Velocity computed for ${Object.keys(velocityData).length} subnets (${timeDiffMin.toFixed(0)}min window)`);
          }
        }
      } else {
        console.log("[scan] Need 2+ snapshots for velocity (have " + blobs.length + ")");
      }
    } catch (e) {
      console.log("[scan] Velocity computation skipped:", String(e).slice(0, 100));
    }
  }

  // ── Build Discord signal map for social scoring ─────────────────
  // netuid → { signal, messageCount, uniquePosters }
  const discordMap = new Map<number, { signal: string; messageCount: number; uniquePosters: number }>();
  for (const disc of discordResults) {
    if (disc.netuid && disc.netuid > 0) {
      discordMap.set(disc.netuid, {
        signal: disc.signal,
        messageCount: disc.messageCount,
        uniquePosters: disc.uniquePosters,
      });
    }
  }

  // ── Compute social score ────────────────────────────────────────
  const desearchFailed = socialMap.size === 0;

  function computeSocialScore(netuid: number, mentions: number, engagement: number): number {
    // Stitch3 campaign bonus — active marketing = social boost
    const hasCampaign = stitchActiveNetuids.has(netuid);
    const campaignBonus = hasCampaign ? 15 : 0; // +15 pts for active campaign

    if (mentions <= 0 && engagement <= 0) {
      if (hasCampaign) return Math.min(100, 30 + campaignBonus); // Campaign alone = at least 30
      if (desearchFailed) {
        const identity = identityMap.get(netuid);
        if (identity?.twitter) return 15;
        if (identity?.subnet_name) return 8;
      }
      return 0;
    }

    // Social score v2 — recalibrated so popular subnets don't permanently peg the ceiling
    // Templar/Chutes/Targon were always hitting 100 with old thresholds (30 mentions / 3K eng)
    // New design: absolute volume = max 55 pts, velocity = max 30 pts, campaign = 15 pts
    // To score 80+: need genuinely viral volume OR high volume + accelerating trend
    let score = 0;

    // ── VOLUME (max 55 pts) ──
    // Mentions (max 30 pts) — raised bar: 100+ needed to max out
    if (mentions >= 100) score += 30;
    else if (mentions >= 60) score += 26;
    else if (mentions >= 35) score += 22;
    else if (mentions >= 20) score += 18;
    else if (mentions >= 12) score += 14;
    else if (mentions >= 7) score += 10;
    else if (mentions >= 4) score += 7;
    else if (mentions >= 2) score += 4;
    else if (mentions >= 1) score += 2;

    // Engagement (max 25 pts) — raised bar: 15K+ to max out
    if (engagement >= 15000) score += 25;
    else if (engagement >= 8000) score += 21;
    else if (engagement >= 4000) score += 18;
    else if (engagement >= 2000) score += 15;
    else if (engagement >= 1000) score += 12;
    else if (engagement >= 400) score += 9;
    else if (engagement >= 150) score += 6;
    else if (engagement >= 40) score += 3;
    else if (engagement >= 10) score += 1;

    // ── VELOCITY (max 30 pts) — the real alpha signal ──
    // Is social buzz growing faster than baseline? This rewards heating-up subnets
    const vel = velocityData[netuid];
    if (vel) {
      if (vel.trend === "accelerating") score += 30; // mentions/min surging
      else if (vel.trend === "growing") score += 18; // steady uptrend
      else if (vel.trend === "cooling") score -= 8;  // buzz fading

      // Additional raw velocity bonus (capped at 10)
      score += Math.min(10, Math.round(vel.velocityScore * 0.2));
    }

    // ── CAMPAIGN BONUS (max 15 pts) ──
    score += campaignBonus;

    // ── DISCORD BONUS (max 20 pts) ──
    // Real community chatter in the official Discord is a strong social signal
    // Discord alpha = genuine insider discussion before it hits Twitter/price
    const disc = discordMap.get(netuid);
    if (disc) {
      if (disc.signal === "alpha") {
        // Alpha spotted: genuine insider discussion, dev previews, partnerships
        score += Math.min(20, 15 + Math.min(disc.uniquePosters, 5));
      } else if (disc.signal === "active") {
        // Healthy community engagement — good but not investable intel
        score += Math.min(12, 6 + Math.min(disc.uniquePosters, 6));
      }
      // "quiet" and "noise" contribute nothing
    }

    return Math.min(100, Math.max(0, score));
  }

  // ── Load aGap score history for EMA smoothing ──────────────────
  // Asymmetric EMA: fast up (70% current), slow down (30% current)
  // This rewards subnets that discover alpha quickly, but prevents
  // scores from crashing overnight when one data point changes.
  type AGapHistory = Record<number, { ema: number; lastUpdated: string }>;
  let agapHistory: AGapHistory = {};
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { get: getBlob } = await import("@vercel/blob");
      const histBlob = await getBlob("agap-history.json", {
        token: process.env.BLOB_READ_WRITE_TOKEN,
        access: "private",
      });
      if (histBlob?.stream) {
        const reader = histBlob.stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        agapHistory = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        console.log(`[scan] Loaded aGap history for ${Object.keys(agapHistory).length} subnets`);
      }
    } catch {
      console.log("[scan] No aGap history yet (first run)");
    }
  }

  function smoothAGap(netuid: number, rawScore: number): number {
    const prev = agapHistory[netuid];
    if (!prev) return rawScore; // First time: use raw score

    const prevEma = prev.ema;
    if (rawScore >= prevEma) {
      // RISING: fast reaction (70% current, 30% historical)
      return Math.round(0.7 * rawScore + 0.3 * prevEma);
    } else {
      // FALLING: slow decay (30% current, 70% historical)
      return Math.round(0.3 * rawScore + 0.7 * prevEma);
    }
  }

  // ── Load emission history (needed for aGap formula) ─────────────
  // Must load BEFORE the leaderboard loop so emission momentum can
  // factor into rawAGap calculation.
  type EmissionHistory = { [netuid: string]: { pct: number; timestamp: string }[] };
  let emissionHistory: EmissionHistory = {};
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const histBlob = await blobGet("emission-history.json", {
        token: process.env.BLOB_READ_WRITE_TOKEN!,
        access: "private",
      });
      if (histBlob && histBlob.stream) {
        const reader = histBlob.stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        emissionHistory = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
      }
    }
  } catch {
    // No emission history yet — first scan
  }

  // ── Build leaderboard ───────────────────────────────────────────
  const leaderboard: LeaderboardEntry[] = [];

  // Count signals per subnet
  const signalCountMap = new Map<number, number>();
  const topSignalMap = new Map<number, string>();
  for (const sig of signals) {
    signalCountMap.set(sig.netuid, (signalCountMap.get(sig.netuid) || 0) + 1);
    if (!topSignalMap.has(sig.netuid) || sig.strength > 50) {
      topSignalMap.set(sig.netuid, sig.title);
    }
  }

  for (let i = 0; i < rawSubnets.length; i++) {
    const d = rawSubnets[i];

    const devScore = computeDevScore(d);
    const flowScore = computeFlowScore(d);
    const { score: evalScore, ratio: evalRatio } = computeEvalScore(d);
    const socialScore = computeSocialScore(d.netuid, d.socialMentions, d.socialEngagement);

    // ── THE ALPHA GAP FORMULA v6 ────────────────────────────────
    // THESIS: Find subnets building quality + price hasn't caught up
    //         + smart money signals (emissions, validators, stakers)
    //
    // The GAP = great dev work MINUS market awareness
    // High dev + low price movement + low social = MAXIMUM GAP
    // High dev + price already pumped + everyone talking = NO GAP

    // 1. BUILDING QUALITY (0-50 pts) — are they actually shipping?
    // Dev score IS the quality signal. Scale it to 50.
    const buildingPts = devScore * 0.50;

    // 2. PRICE LAG (0-30 pts) — multi-timeframe gap detection
    // The BEST alpha gap: building hard + down on longer timeframes + just starting to turn
    let priceLag = 0;
    const pch24h = d.priceChange24h || 0;
    const pch7d = d.priceChange1w || 0;
    const pch30d = d.priceChange1m || 0;

    if (devScore >= 20) {
      // 30D price lag (0-12 pts) — long-term underperformance = biggest gap
      if (pch30d <= -40) priceLag += 12;
      else if (pch30d <= -25) priceLag += 10;
      else if (pch30d <= -15) priceLag += 8;
      else if (pch30d <= -5) priceLag += 5;
      else if (pch30d <= 5) priceLag += 2;
      else if (pch30d >= 50) priceLag -= 5;   // mooned = gap gone
      else if (pch30d >= 20) priceLag -= 2;

      // 7D price lag (0-10 pts)
      if (pch7d <= -25) priceLag += 10;
      else if (pch7d <= -15) priceLag += 8;
      else if (pch7d <= -8) priceLag += 6;
      else if (pch7d <= -3) priceLag += 4;
      else if (pch7d <= 3) priceLag += 2;
      else if (pch7d >= 20) priceLag -= 3;

      // 24H price lag (0-8 pts)
      if (pch24h <= -10) priceLag += 8;
      else if (pch24h <= -5) priceLag += 6;
      else if (pch24h <= 0) priceLag += 3;
      else if (pch24h <= 3) priceLag += 1;
      else if (pch24h >= 10) priceLag -= 3;

      // REVERSAL BONUS (0-8 pts) — THE MAGIC
      // Down long-term but turning up short-term = price is waking up
      if (pch30d <= -20 && pch24h >= 3) priceLag += 8;       // Down 20%+ monthly, up 3%+ today!
      else if (pch30d <= -15 && pch24h >= 1) priceLag += 6;
      else if (pch7d <= -15 && pch24h >= 2) priceLag += 5;   // Down 15%+ weekly, turning today
      else if (pch7d <= -10 && pch24h >= 0) priceLag += 3;   // Down weekly, stabilizing

      priceLag = Math.min(30, Math.max(-10, priceLag));
    }

    // 3. SOCIAL GAP (0-15 pts) — is nobody talking about this yet?
    // High dev + low social = undiscovered alpha
    let socialGap = 0;
    if (devScore >= 20) {
      if (d.socialMentions <= 1 && d.socialEngagement < 20) socialGap = 15;
      else if (d.socialMentions <= 3 && d.socialEngagement < 100) socialGap = 12;
      else if (d.socialMentions <= 8 && d.socialEngagement < 300) socialGap = 8;
      else if (d.socialMentions <= 15 && d.socialEngagement < 800) socialGap = 4;
      else if (d.socialMentions > 30 && d.socialEngagement > 2000) socialGap = -3;
      else if (d.socialMentions > 50 && d.socialEngagement > 5000) socialGap = -8;
    }

    // 4. EMISSION VALUE GAP (0-15 pts) — network paying more than market realizes
    // High eVal = emissions outpace valuation = validators know something retail doesn't
    let evalBoost = 0;
    if (evalScore >= 80) evalBoost = 15;
    else if (evalScore >= 60) evalBoost = 12;
    else if (evalScore >= 45) evalBoost = 8;
    else if (evalScore >= 30) evalBoost = 5;
    else if (evalScore >= 15) evalBoost = 2;
    // Net inflow = money flowing in
    if (d.netFlow24h && d.netFlow24h > 0) evalBoost = Math.min(15, evalBoost + 3);

    // 5. MARKET CAP VIABILITY — too small = uninvestable
    const mcap = d.marketCapUsd || 0;
    let viability = 0;
    if (mcap < 50000) viability = -30;        // ghost subnet
    else if (mcap < 100000) viability = -20;
    else if (mcap < 500000) viability = -10;
    else if (mcap < 1000000) viability = -5;
    else if (mcap >= 10000000) viability = 3;  // large enough for serious investment
    else if (mcap >= 50000000) viability = 5;

    // 6. STITCH3 CAMPAIGN BOOST (0-20 pts) — active marketing = incoming social buzz
    // Early campaign = max boost (alpha opportunity before buzz peaks)
    // Late campaign = reduced boost (buzz already peaked)
    let campaignBoost = 0;
    const campaign = activeCampaigns.find(c => c.netuid === d.netuid);
    if (campaign) {
      const now = new Date();
      const start = new Date(campaign.startDate);
      const end = new Date(campaign.endDate);
      const totalDuration = end.getTime() - start.getTime();
      const elapsed = now.getTime() - start.getTime();

      if (elapsed < 0) {
        // Campaign hasn't started yet — MAXIMUM boost (get in early!)
        campaignBoost = 20;
      } else if (elapsed <= totalDuration * 0.5) {
        // First half of campaign — strong boost (buzz building)
        campaignBoost = 15;
      } else if (elapsed <= totalDuration * 0.75) {
        // Third quarter — moderate boost (buzz peaking)
        campaignBoost = 8;
      } else if (elapsed <= totalDuration) {
        // Final quarter — small boost (buzz fading)
        campaignBoost = 4;
      }
      // Campaign over = 0 boost
    }

    // 6. EMISSION MOMENTUM (±10 pts) — are validators routing more/less to this subnet?
    // Rising emissions = validators actively choosing this subnet → strong bullish signal
    // Falling emissions = validators leaving → bearish signal
    // This is one of the most direct "smart money" signals on Bittensor
    let emissionBoost = 0;
    let emissionChangePct: number | undefined;
    let emissionTrend: "up" | "down" | null = null;
    if (d.emissionPct > 0) {
      const emHistKey = String(d.netuid);
      const emHist = emissionHistory[emHistKey];
      if (emHist && emHist.length > 0) {
        // Use longest lookback available (prefer 7-day, fall back to earliest reading)
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const oldest = emHist.find(h => new Date(h.timestamp).getTime() <= sevenDaysAgo) || emHist[0];
        if (oldest.pct > 0) {
          const currentPct = d.emissionPct; // raw % value (same unit as stored history)
          const changePct = ((currentPct - oldest.pct) / oldest.pct) * 100;
          emissionChangePct = Math.round(changePct * 10) / 10;
          if (changePct >= 5) emissionTrend = "up";
          else if (changePct <= -5) emissionTrend = "down";

          // Boost: up to +10 for rising, up to -8 for falling
          if (changePct >= 30) emissionBoost = 10;
          else if (changePct >= 20) emissionBoost = 8;
          else if (changePct >= 10) emissionBoost = 6;
          else if (changePct >= 5) emissionBoost = 3;
          else if (changePct >= 0) emissionBoost = 1;
          else if (changePct <= -30) emissionBoost = -8;
          else if (changePct <= -20) emissionBoost = -6;
          else if (changePct <= -10) emissionBoost = -4;
          else if (changePct <= -5) emissionBoost = -2;
        }
      }
    }

    // 7. WHALE DETECTION from pool buy/sell data
    const poolForWhale = poolMap.get(d.netuid);
    let whaleRatio: number | undefined;
    let whaleSignal: "accumulating" | "distributing" | null = null;
    let whaleBoost = 0;
    if (poolForWhale) {
      const buys = poolForWhale.buys_24_hr || 0;
      const sells = poolForWhale.sells_24_hr || 0;
      const buyVol = parseFloat(poolForWhale.tao_buy_volume_24_hr || "0") / RAO;
      const sellVol = parseFloat(poolForWhale.tao_sell_volume_24_hr || "0") / RAO;
      if (buys > 3 && sells > 3) {
        const avgBuy = buyVol / buys;
        const avgSell = sellVol / sells;
        if (avgSell > 0) {
          whaleRatio = Math.round(avgBuy / avgSell * 100) / 100;
          if (whaleRatio >= 2.0) {
            whaleSignal = "accumulating";
            // Whale accumulation boost — bigger boost if dev is also high
            if (devScore >= 40) whaleBoost = 8;  // whales + dev = strong conviction
            else whaleBoost = 4;                   // whales alone = moderate signal
          } else if (whaleRatio <= 0.5) {
            whaleSignal = "distributing";
            whaleBoost = -5; // whales selling = caution
          }
        }
      }
    }

    const rawAGap = buildingPts + priceLag + socialGap + evalBoost + viability + campaignBoost + whaleBoost + emissionBoost;
    const clampedRaw = Math.max(1, Math.min(100, Math.round(rawAGap)));
    const aGap = smoothAGap(d.netuid, clampedRaw);

    // Update history for next scan
    agapHistory[d.netuid] = { ema: aGap, lastUpdated: new Date().toISOString() };

    leaderboard.push({
      netuid: d.netuid,
      name: d.name,
      composite_score: aGap,
      flow_score: Math.round(flowScore),
      dev_score: Math.round(devScore),
      eval_score: Math.round(evalScore),
      social_score: socialScore,
      signal_count: signalCountMap.get(d.netuid) || 0,
      top_signal: topSignalMap.get(d.netuid),
      alpha_price: d.alphaPriceUsd ?? undefined,
      market_cap: d.marketCapUsd ?? undefined,
      net_flow_24h: d.netFlow24h ?? undefined,
      emission_pct: d.emissionPct > 0 ? d.emissionPct / 100 : undefined,
      emission_change_pct: emissionChangePct,
      emission_trend: emissionTrend,
      eval_ratio: Math.round(evalRatio * 10) / 10,
      price_change_24h: d.priceChange24h,
      price_change_1h: d.priceChange1h,
      price_change_7d: d.priceChange1w,
      price_change_30d: d.priceChange1m,
      has_campaign: stitchActiveNetuids.has(d.netuid) || undefined,
      whale_ratio: whaleRatio,
      whale_signal: whaleSignal,
    });
  }

  leaderboard.sort((a, b) => b.composite_score - a.composite_score);

  // Sort signals by strength desc
  signals.sort((a, b) => b.strength - a.strength);

  // ── Persist signals to rolling history ──────────────────────────
  // Signals are generated fresh each scan from the last 24h of GitHub/HF activity.
  // Without persistence, signals disappear the moment a subnet's window falls outside 24h.
  // We accumulate signals in signals-history.json (14-day rolling window).
  // Dedup key: netuid + signal_type + signal_date (day). New scan always wins on same day.
  let signalHistory: ScanSignal[] = [];
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { get: getBlob } = await import("@vercel/blob");
      const histBlob = await getBlob("signals-history.json", {
        token: process.env.BLOB_READ_WRITE_TOKEN,
        access: "private",
      });
      if (histBlob?.stream) {
        const reader = histBlob.stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
        signalHistory = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        console.log(`[scan] Loaded ${signalHistory.length} signals from history`);
      }
    } catch { console.log("[scan] No signals history yet, starting fresh"); }
  }

  // Keep last 14 days of history
  const histCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const recentHistory = signalHistory.filter(s => (s.signal_date || s.created_at) >= histCutoff);

  // Merge: history is the base, current scan signals override for same netuid+type+day
  // This way old signals persist, and today's re-analysis (with fresh AI) replaces them
  const mergedMap = new Map<string, ScanSignal>();
  for (const s of recentHistory) {
    const day = (s.signal_date || s.created_at).slice(0, 10);
    const key = `${s.netuid}:${s.signal_type}:${day}`;
    const existing = mergedMap.get(key);
    if (!existing || s.strength > existing.strength) mergedMap.set(key, s);
  }
  // Fresh scan signals always override history for their signal_date day
  for (const s of signals) {
    const day = (s.signal_date || s.created_at).slice(0, 10);
    const key = `${s.netuid}:${s.signal_type}:${day}`;
    mergedMap.set(key, s);
  }

  const mergedSignals = [...mergedMap.values()].sort((a, b) => {
    // Sort by signal_date DESC (most recent first), then strength DESC
    const dateDiff = new Date(b.signal_date || b.created_at).getTime() - new Date(a.signal_date || a.created_at).getTime();
    return dateDiff !== 0 ? dateDiff : b.strength - a.strength;
  });

  console.log(`[scan] Merged signals: ${signals.length} new + ${recentHistory.length} history = ${mergedSignals.length} total`);

  // Save merged signals back to history blob
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await put("signals-history.json", JSON.stringify(mergedSignals), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      console.log("[scan] Signals history saved.");
    } catch (e) { console.error("[scan] Failed to save signals history:", e); }
  }

  // ── Append current emissions to history & save ─────────────────
  // (emission_change_pct already computed and factored into aGap above)
  const now = new Date().toISOString();
  for (const entry of leaderboard) {
    if (!entry.emission_pct || entry.emission_pct <= 0) continue;
    const key = String(entry.netuid);
    const currentPct = entry.emission_pct * 100; // convert fraction back to %

    if (!emissionHistory[key]) emissionHistory[key] = [];
    const hist = emissionHistory[key];

    // Append current reading, keep max 7 days of hourly data (~168 entries)
    hist.push({ pct: currentPct, timestamp: now });
    if (hist.length > 168) emissionHistory[key] = hist.slice(-168);
  }

  // Save updated emission history
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      await put("emission-history.json", JSON.stringify(emissionHistory), {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
      });
    }
  } catch (e) {
    console.error("[scan] Failed to save emission history:", e);
  }

  const duration = Date.now() - startTime;
  console.log(`[scan] Complete in ${duration}ms. ${leaderboard.length} subnets, ${mergedSignals.length} signals (${signals.length} new this scan).`);

  const responseData = {
    leaderboard,
    signals: mergedSignals,
    taoPrice,
    lastScan: new Date().toISOString(),
    duration_ms: duration,
    counts: {
      subnets: leaderboard.length,
      signals: mergedSignals.length,
      identities: identities.length,
      pools: pools.length,
      devActivity: devActivity.length,
      hfOrgs: hfScanMap.size,
      socialSubnets: socialMap.size,
    },
  };

  // Cache result to Vercel Blob for instant page loads
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      await put("scan-latest.json", JSON.stringify(responseData), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      console.log("[scan] Cached to Vercel Blob.");

      // Save aGap history for EMA smoothing
      await put("agap-history.json", JSON.stringify(agapHistory), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      console.log(`[scan] aGap history saved (${Object.keys(agapHistory).length} subnets)`);
    }
  } catch (e) {
    console.error("[scan] Failed to cache to Blob:", e);
  }

  // ── Portfolio auto-buy ───────────────────────────────────────────
  // When a subnet's aGap score crosses 80 for the first time, we
  // "buy" $100 of its alpha token and track performance over time.
  // This lets us validate whether aGap signals produce real gains.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { loadPortfolio } = await import("@/app/api/portfolio/route");
      const portfolio = await loadPortfolio();

      const BUY_THRESHOLD = 80;
      const BUY_AMOUNT_USD = 100;
      const today = new Date().toISOString().slice(0, 10);

      let portfolioChanged = false;

      // Auto-buy any subnet that just crossed the threshold
      for (const entry of leaderboard) {
        if (entry.composite_score < BUY_THRESHOLD) continue;
        if (!entry.alpha_price || entry.alpha_price <= 0) continue;
        if (portfolio.positions.some(p => p.netuid === entry.netuid)) continue;

        const alphaTokens = BUY_AMOUNT_USD / entry.alpha_price;
        portfolio.positions.push({
          netuid: entry.netuid,
          name: entry.name,
          buyDate: today,
          buyAGapScore: entry.composite_score,
          buyPriceUsd: entry.alpha_price,
          amountUsd: BUY_AMOUNT_USD,
          alphaTokens,
        });
        console.log(`[scan] Portfolio: bought SN${entry.netuid} ${entry.name} @ $${entry.alpha_price.toFixed(4)} (aGap ${entry.composite_score})`);
        portfolioChanged = true;
      }

      // Update today's portfolio value snapshot (even if no new buys)
      if (portfolio.positions.length > 0) {
        const totalValue = portfolio.positions.reduce((sum, pos) => {
          const liveEntry = leaderboard.find(e => e.netuid === pos.netuid);
          const price = liveEntry?.alpha_price ?? pos.buyPriceUsd;
          return sum + pos.alphaTokens * price;
        }, 0);

        const rounded = Math.round(totalValue * 100) / 100;
        const existingIdx = portfolio.history.findIndex(h => h.date === today);
        if (existingIdx >= 0) {
          portfolio.history[existingIdx].totalValue = rounded;
        } else {
          portfolio.history.push({ date: today, totalValue: rounded });
          if (portfolio.history.length > 90) {
            portfolio.history = portfolio.history.slice(-90);
          }
        }
        portfolioChanged = true;
      }

      if (portfolioChanged) {
        await put("portfolio.json", JSON.stringify(portfolio), {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "application/json",
        });
        console.log(`[scan] Portfolio saved: ${portfolio.positions.length} positions`);
      }
    } catch (e) {
      console.error("[scan] Portfolio update failed:", e);
    }
  }

  return NextResponse.json(responseData);
}
