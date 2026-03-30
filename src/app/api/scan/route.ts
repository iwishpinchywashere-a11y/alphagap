import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
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
import {
  listModelsByAuthor,
  listDatasetsByAuthor,
  listSpacesByAuthor,
} from "@/lib/huggingface";
import { fetchRecentCommits, fetchRecentPRs, fetchLatestRelease } from "@/lib/context-fetcher";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RAO = 1e9;

// ── Seed HF orgs (same as huggingface.ts) ────────────────────────
const SEED_HF_ORGS: { org: string; netuid?: number }[] = [
  { org: "opentensor" },
  { org: "macrocosm-os", netuid: 1 },
  { org: "RaoFoundation", netuid: 9 },
  { org: "bitmind", netuid: 34 },
  { org: "omegalabsinc", netuid: 24 },
  { org: "BitAgent", netuid: 20 },
  { org: "404-Gen", netuid: 17 },
  { org: "CortexLM", netuid: 18 },
  { org: "tensorplex-labs" },
  { org: "coldint" },
  { org: "borggAI" },
  { org: "NousResearch", netuid: 6 },
  { org: "manifold-inc", netuid: 4 },
  { org: "bitmind-ai", netuid: 34 },
  { org: "SocialTensor" },
];

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
  eval_ratio?: number; // raw emission%/mcap% ratio
  price_change_24h?: number;
  price_change_1h?: number;
  has_campaign?: boolean; // 🔥 Active Stitch3 marketing campaign
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

  // Batch 2: flows + emissions + dev activity + TMC emissions (all parallel)
  console.log("[scan] Batch 2: flows + emissions + dev + TMC...");
  const [flowsResult, emissionsResult, devResult, tmcResult, tmcValResult] = await Promise.allSettled([
    getTaoFlows(),
    getSubnetEmissions(),
    getGithubActivity(),
    fetchTMCSubnets(),
    fetchTMCValidators(),
  ]);
  const flows = flowsResult.status === "fulfilled" ? flowsResult.value : [];
  const emissions = emissionsResult.status === "fulfilled" ? emissionsResult.value : [];
  let devActivity = devResult.status === "fulfilled" ? devResult.value : ([] as Awaited<ReturnType<typeof getGithubActivity>>);
  const tmcSubnets = tmcResult.status === "fulfilled" ? tmcResult.value : [];
  const validatorCounts = tmcValResult.status === "fulfilled" ? tmcValResult.value : new Map<number, number>();
  console.log(`[scan] Batch 2 done: ${flows.length} flows, ${emissions.length} emissions, ${devActivity.length} dev, ${tmcSubnets.length} TMC, ${validatorCounts.size} validator subnets`);

  // Build TMC emission map (accurate emission % from TaoMarketCap)
  const tmcMap = new Map<number, TMCSubnet>(tmcSubnets.map(s => [s.subnet, s]));

  const elapsed1 = Date.now() - startTime;
  console.log(`[scan] All APIs done in ${elapsed1}ms.`);

  // ── Step 2: Build lookup maps ───────────────────────────────────
  const identityMap = new Map<number, SubnetIdentity>(identities.map((i) => [i.netuid, i]));
  const poolMap = new Map<number, SubnetPool>(pools.map((p) => [p.netuid, p]));
  const flowMap = new Map<number, number>(flows.map((f) => [f.netuid, f.tao_flow / RAO]));
  const emissionMap = new Map<number, number>(
    emissions.map((e) => [e.netuid, parseFloat(e.alpha_rewards) / RAO])
  );
  const devMap = new Map<number, GithubActivity>(devActivity.map((d) => [d.netuid, d]));

  // Total emission for share calculation
  let totalEmission = 0;
  for (const v of emissionMap.values()) totalEmission += v;

  // ── Step 3: HuggingFace (parallel, top 15 orgs) ────────────────
  const timeLeftForHF = 50000 - (Date.now() - startTime);
  type HFActivity = { models: number; datasets: number; spaces: number; downloads: number; modelNames: string[]; datasetNames: string[]; spaceNames: string[]; latestDate: string };
  const hfActivityMap = new Map<number, HFActivity>();

  if (timeLeftForHF > 10000) {
    console.log("[scan] Fetching HuggingFace data...");
    const hfOrgsToFetch = SEED_HF_ORGS.slice(0, 15);

    const hfResults = await Promise.allSettled(
      hfOrgsToFetch.map(async ({ org, netuid }) => {
        const [models, datasets, spaces] = await Promise.all([
          listModelsByAuthor(org, 5),
          listDatasetsByAuthor(org, 5),
          listSpacesByAuthor(org, 5),
        ]);
        return { org, netuid, models, datasets, spaces };
      })
    );

    for (const r of hfResults) {
      if (r.status !== "fulfilled") continue;
      const { netuid, models, datasets, spaces } = r.value;
      if (!netuid) continue;
      const totalDownloads = [...models, ...datasets, ...spaces].reduce(
        (sum, item) => sum + (item.downloads || 0),
        0
      );
      const existing = hfActivityMap.get(netuid);
      hfActivityMap.set(netuid, {
        models: (existing?.models || 0) + models.length,
        datasets: (existing?.datasets || 0) + datasets.length,
        spaces: (existing?.spaces || 0) + spaces.length,
        downloads: (existing?.downloads || 0) + totalDownloads,
        modelNames: [...(existing?.modelNames || []), ...models.map(m => `${m.id} (${(m.downloads||0).toLocaleString()} downloads)`)],
        datasetNames: [...(existing?.datasetNames || []), ...datasets.map(d => `${d.id} (${(d.downloads||0).toLocaleString()} downloads)`)],
        spaceNames: [...(existing?.spaceNames || []), ...spaces.map(s => `${s.id}`)],
        latestDate: [...models, ...datasets, ...spaces]
          .map(item => item.lastModified || item.createdAt || "")
          .filter(Boolean)
          .sort()
          .pop() || existing?.latestDate || new Date().toISOString(),
      });
    }
    console.log(`[scan] HuggingFace done. ${hfActivityMap.size} subnets with HF data.`);
  }

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

    // Match tweets to subnets
    for (const tweet of allTweets.values()) {
      const netuid = matchTweetToSubnet(tweet);
      if (!netuid) continue;
      const engagement =
        tweet.like_count + tweet.retweet_count + tweet.reply_count + (tweet.quote_count || 0);
      const existing = socialMap.get(netuid) || { mentions: 0, engagement: 0 };
      existing.mentions++;
      existing.engagement += engagement;
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

  // ── Step 5: Generate signals (dev + HF ONLY) ───────────────────
  // Flow/price signals REMOVED — this feed is purely about development intelligence

  // ── RICH DEV SIGNALS: Fetch actual commits/PRs and analyze with AI ──
  // ALL active subnets get signals. Top ones get deep AI analysis.
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const allActiveDevSubnets = devActivity
    .filter(a => a.commits_1d > 0 || a.prs_merged_1d > 0)
    .sort((a, b) => (b.commits_1d + b.prs_merged_1d * 5) - (a.commits_1d + a.prs_merged_1d * 5));

  // Top 10 get deep commit/PR fetching + AI analysis
  const activeDevSubnets = allActiveDevSubnets.slice(0, 10);

  console.log(`[scan] ${allActiveDevSubnets.length} active subnets. Deep analysis for top ${activeDevSubnets.length}.`);

  // Fetch actual commit messages + PRs for each active subnet (parallel, 5 at a time)
  type DevContext = { act: GithubActivity; owner: string; repo: string; commits: string[]; prs: string[]; release: { tag: string; name: string; body: string; date: string } | null };
  const devContexts: DevContext[] = [];

  // Fetch all in parallel (8 repos × 3 calls = 24 requests, well within GitHub 5K/hr limit)
  const results = await Promise.allSettled(
    activeDevSubnets.map(async (act) => {
      let repoPath = act.repo_url;
      if (repoPath.includes("github.com/")) repoPath = repoPath.split("github.com/")[1];
      repoPath = repoPath.replace(/^\/|\/$/g, "").replace(/\.git$/, "");
      const parts = repoPath.split("/");
      if (parts.length < 2) return null;
      const [owner, repo] = parts;
      const [commits, prs, release] = await Promise.all([
        fetchRecentCommits(owner, repo, 5),
        fetchRecentPRs(owner, repo, 3),
        fetchLatestRelease(owner, repo),
      ]);
      return { act, owner, repo, commits, prs, release };
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) devContexts.push(r.value);
  }

  console.log(`[scan] Got context for ${devContexts.length} repos. Analyzing with AI...`);

  // Analyze with Claude Haiku — batch 5 at a time
  async function analyzeDevActivity(ctx: DevContext): Promise<string> {
    if (!ANTHROPIC_KEY) return buildFallbackDescription(ctx);

    const name = identityMap.get(ctx.act.netuid)?.subnet_name || `SN${ctx.act.netuid}`;
    const pool = poolMap.get(ctx.act.netuid);
    const price = pool ? (parseFloat(pool.price || "0") / RAO * taoPrice).toFixed(2) : "?";
    const mcap = pool ? "$" + (parseFloat(pool.market_cap || "0") / RAO * taoPrice / 1e6).toFixed(1) + "M" : "?";
    const priceChange = pool?.price_change_1_day ? parseFloat(pool.price_change_1_day).toFixed(1) : "?";

    const commitText = ctx.commits.slice(0, 8).join("\n");
    const prText = ctx.prs.slice(0, 4).join("\n");
    const releaseText = ctx.release ? `Latest release: ${ctx.release.name} (${ctx.release.tag})\n${ctx.release.body.slice(0, 500)}` : "";

    const prompt = `You are the AlphaGap intelligence engine — the smartest Bittensor analyst in the world. You read raw GitHub commits and PRs from Bittensor subnets and translate them into clear, compelling intelligence reports that help investors understand what's really happening under the hood.

Your audience: crypto investors who are smart but may not understand technical code. They want to know if this subnet is doing something that will make the token more valuable.

SUBNET INFO:
Name: ${name} (SN${ctx.act.netuid})
Repo: ${ctx.owner}/${ctx.repo}
Token: $${price} (24h change: ${priceChange}%) | Market Cap: ${mcap}
Today's activity: ${ctx.act.commits_1d} commits, ${ctx.act.prs_merged_1d} merged PRs, ${ctx.act.unique_contributors_1d} contributors

RAW COMMITS (read these carefully):
${commitText || "No commits found"}

MERGED PULL REQUESTS:
${prText || "No PRs found"}

${releaseText}

Now write your intelligence report using this EXACT format. Each section should be 1-3 sentences. Be specific — name actual features, algorithms, models. No vague statements.

🔧 What they built:
(What specific features, fixes, models, or improvements did they ship? Be concrete.)

📡 Why it matters:
(Why is this significant for the subnet and the Bittensor ecosystem? What problem does it solve?)

💡 In simple terms:
(Explain this like you're telling your non-technical friend over coffee. Use analogies. Make it dead simple and interesting.)

🎯 The AlphaGap take:
(THIS IS THE MOST IMPORTANT SECTION. Is the market sleeping on this? Does the development activity justify the current price? Is there an alpha gap here — strong building but the price hasn't caught up yet? Give a clear, bold, actionable take. Always include this section.)`;

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
          max_tokens: 700,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return buildFallbackDescription(ctx);
      const data = await res.json();
      return data.content?.[0]?.text || buildFallbackDescription(ctx);
    } catch {
      return buildFallbackDescription(ctx);
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

  // Try AI analysis for as many signals as time allows
  const timeLeftForAI = 57000 - (Date.now() - startTime);
  console.log(`[scan] AI analysis: ${devContexts.length} signals, ${(timeLeftForAI/1000).toFixed(0)}s left`);

  const analyzedDevSignals: { ctx: DevContext; analysis: string }[] = [];

  if (timeLeftForAI > 8000 && ANTHROPIC_KEY) {
    // Analyze ALL in parallel — Haiku is fast (~1-2s per call)
    try {
      const aiResults = await Promise.race([
        Promise.all(devContexts.map(async (ctx) => ({ ctx, analysis: await analyzeDevActivity(ctx) }))),
        // Timeout after available time minus 3s buffer
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("AI timeout")), timeLeftForAI - 3000)),
      ]);
      analyzedDevSignals.push(...aiResults);
      console.log(`[scan] AI done: ${aiResults.length} analyzed`);
    } catch {
      console.log("[scan] AI timed out, using fallback for remaining");
      // Use whatever we have + fallback for the rest
      if (analyzedDevSignals.length === 0) {
        for (const ctx of devContexts) {
          analyzedDevSignals.push({ ctx, analysis: buildFallbackDescription(ctx) });
        }
      }
    }
  } else {
    console.log(`[scan] No time for AI, using fallback descriptions`);
    for (const ctx of devContexts) {
      analyzedDevSignals.push({ ctx, analysis: buildFallbackDescription(ctx) });
    }
  }

  console.log(`[scan] Analyzed ${analyzedDevSignals.length} dev signals with AI.`);

  // Create rich dev signals with dates
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  for (const { ctx, analysis } of analyzedDevSignals) {
    const name = identityMap.get(ctx.act.netuid)?.subnet_name || `SN${ctx.act.netuid}`;
    // Extract latest commit date from commit data
    const lastDate = ctx.act.last_event_at ? new Date(ctx.act.last_event_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : today;
    const activitySummary = [
      ctx.act.commits_1d > 0 ? `${ctx.act.commits_1d} commits` : "",
      ctx.act.prs_merged_1d > 0 ? `${ctx.act.prs_merged_1d} PRs merged` : "",
    ].filter(Boolean).join(" & ");
    addSignal({
      netuid: ctx.act.netuid,
      signal_type: "dev_spike",
      strength: Math.min(95, 30 + ctx.act.commits_1d * 2 + ctx.act.prs_merged_1d * 10 + (ctx.release ? 15 : 0)),
      title: `${name} pushed ${activitySummary} to GitHub (${lastDate})`,
      description: analysis,
      source: "github",
      source_url: ctx.act.repo_url,
      subnet_name: name,
      signal_date: ctx.act.last_event_at || ctx.act.as_of_day || new Date().toISOString(),
    });
  }

  // Also create signals for subnets with dev activity that didn't get deep analysis
  for (const act of devActivity) {
    if (act.commits_1d <= 0 && act.prs_merged_1d <= 0) continue;
    if (analyzedDevSignals.some(s => s.ctx.act.netuid === act.netuid)) continue;
    const name = identityMap.get(act.netuid)?.subnet_name || `SN${act.netuid}`;
    const lastEventDate = act.last_event_at ? new Date(act.last_event_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "today";
    addSignal({
      netuid: act.netuid,
      signal_type: "dev_spike",
      strength: Math.min(70, 20 + act.commits_1d * 2 + act.prs_merged_1d * 8),
      title: `${name} pushed ${act.commits_1d} commits & ${act.prs_merged_1d} PRs (${lastEventDate})`,
      description: `${act.unique_contributors_1d} contributor${act.unique_contributors_1d !== 1 ? "s" : ""} active. 7d trend: ${act.commits_7d} commits, ${act.prs_merged_7d} PRs. Full analysis pending — check back after next scan.`,
      source: "github",
      source_url: act.repo_url,
      subnet_name: name,
      signal_date: act.last_event_at || act.as_of_day || new Date().toISOString(),
    });
  }

  // HuggingFace update signals — also enriched
  for (const { org, netuid } of SEED_HF_ORGS) {
    if (!netuid) continue;
    const hf = hfActivityMap.get(netuid);
    if (!hf) continue;
    if (hf.models + hf.datasets + hf.spaces === 0) continue;
    const name = identityMap.get(netuid)?.subnet_name || `SN${netuid}`;
    const parts: string[] = [];
    if (hf.models > 0) parts.push(`${hf.models} model${hf.models > 1 ? "s" : ""}`);
    if (hf.datasets > 0) parts.push(`${hf.datasets} dataset${hf.datasets > 1 ? "s" : ""}`);
    if (hf.spaces > 0) parts.push(`${hf.spaces} space${hf.spaces > 1 ? "s" : ""}`);
    // Build detailed description with actual model/dataset names for AI analysis
    const detailParts: string[] = [];
    if (hf.modelNames.length > 0) detailParts.push(`Models: ${hf.modelNames.slice(0, 5).join("; ")}`);
    if (hf.datasetNames.length > 0) detailParts.push(`Datasets: ${hf.datasetNames.slice(0, 5).join("; ")}`);
    if (hf.spaceNames.length > 0) detailParts.push(`Spaces: ${hf.spaceNames.slice(0, 3).join("; ")}`);
    const detailedDesc = `${org} has ${parts.join(", ")} on HuggingFace (${hf.downloads.toLocaleString()} total downloads).\n${detailParts.join("\n")}`;

    addSignal({
      netuid,
      signal_type: "hf_update",
      strength: Math.min(80, 25 + hf.models * 8 + hf.datasets * 5 + hf.spaces * 3 + Math.min(hf.downloads / 500, 20)),
      title: `${name}: AI models & datasets on HuggingFace`,
      description: detailedDesc,
      source: "huggingface",
      source_url: `https://huggingface.co/${org}`,
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
    const hf = hfActivityMap.get(netuid);
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
      hfModels: hf?.models || 0,
      hfDatasets: hf?.datasets || 0,
      hfSpaces: hf?.spaces || 0,
      hfDownloads: hf?.downloads || 0,
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

  // ── Flow score formula ──────────────────────────────────────────
  function computeFlowScore(priceChange24h: number): number {
    if (priceChange24h <= -20) return 1;
    if (priceChange24h >= 10) return 100;
    if (priceChange24h < 0) {
      return Math.round(1 + ((priceChange24h + 20) / 20) * 49);
    }
    return Math.round(50 + (priceChange24h / 10) * 50);
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

    return { score: Math.min(100, score), ratio: evalRatio };
  }

  // ── Compute social score ────────────────────────────────────────
  const desearchFailed = socialMap.size === 0;

  function computeSocialScore(netuid: number, mentions: number, engagement: number): number {
    // Stitch3 campaign bonus — active marketing = social boost
    const hasCampaign = stitchActiveNetuids.has(netuid);
    const campaignBonus = hasCampaign ? 20 : 0; // +20 pts for active campaign

    if (mentions <= 0 && engagement <= 0) {
      if (hasCampaign) return Math.min(100, 40 + campaignBonus); // Campaign alone = at least 40
      if (desearchFailed) {
        const identity = identityMap.get(netuid);
        if (identity?.twitter) return 15;
        if (identity?.subnet_name) return 8;
      }
      return 0;
    }

    // Social score calibrated to Desearch data ranges
    // Typical: 1-10 mentions, 50-500 engagement
    // Hot: 10-30 mentions, 500-2000 engagement
    // Viral: 30+ mentions, 2000+ engagement
    let score = 0;

    // Mentions (max 50 pts)
    if (mentions >= 30) score += 50;      // Viral — everyone talking
    else if (mentions >= 20) score += 45;
    else if (mentions >= 12) score += 38;
    else if (mentions >= 8) score += 32;  // Hot
    else if (mentions >= 5) score += 25;
    else if (mentions >= 3) score += 18;
    else if (mentions >= 2) score += 12;
    else if (mentions >= 1) score += 7;

    // Engagement (max 50 pts) — likes, retweets, comments
    if (engagement >= 3000) score += 50;
    else if (engagement >= 1500) score += 42;
    else if (engagement >= 800) score += 35;
    else if (engagement >= 400) score += 28;
    else if (engagement >= 200) score += 22;
    else if (engagement >= 100) score += 16;
    else if (engagement >= 40) score += 10;
    else if (engagement >= 10) score += 6;
    else if (engagement >= 3) score += 3;

    // Add Stitch3 campaign bonus
    score += campaignBonus;

    return Math.min(100, score);
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
    const flowScore = computeFlowScore(d.priceChange24h);
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

    // 2. PRICE LAG (0-25 pts) — is the market sleeping?
    // Positive = price hasn't caught up (gap exists)
    // Negative = price already moved (gap closing)
    let priceLag = 0;
    if (devScore >= 20) { // Only matters if they're actually building
      if (d.priceChange24h <= -15) priceLag = 25;       // down big while building = massive gap
      else if (d.priceChange24h <= -8) priceLag = 20;
      else if (d.priceChange24h <= -3) priceLag = 15;
      else if (d.priceChange24h <= 0) priceLag = 10;     // flat while building = gap
      else if (d.priceChange24h <= 3) priceLag = 5;      // slight up = small gap
      else if (d.priceChange24h <= 8) priceLag = 0;      // moderate up = no gap
      else if (d.priceChange24h <= 15) priceLag = -5;    // pumping = gap closing
      else priceLag = -12;                                // mooned = gap gone
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

    const rawAGap = buildingPts + priceLag + socialGap + evalBoost + viability + campaignBoost;
    const aGap = Math.max(1, Math.min(100, Math.round(rawAGap)));

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
      emission_pct: d.emissionPct > 0 ? d.emissionPct / 100 : undefined, // TMC gives %, store as decimal for frontend
      eval_ratio: Math.round(evalRatio * 10) / 10,
      price_change_24h: d.priceChange24h,
      price_change_1h: d.priceChange1h,
      has_campaign: stitchActiveNetuids.has(d.netuid) || undefined,
    });
  }

  leaderboard.sort((a, b) => b.composite_score - a.composite_score);

  // Sort signals by strength desc
  signals.sort((a, b) => b.strength - a.strength);

  // Step 7 removed — AI analysis now happens during signal generation (step 5)

  const duration = Date.now() - startTime;
  console.log(`[scan] Complete in ${duration}ms. ${leaderboard.length} subnets, ${signals.length} signals.`);

  const responseData = {
    leaderboard,
    signals,
    taoPrice,
    lastScan: new Date().toISOString(),
    duration_ms: duration,
    counts: {
      subnets: leaderboard.length,
      signals: signals.length,
      identities: identities.length,
      pools: pools.length,
      devActivity: devActivity.length,
      hfOrgs: hfActivityMap.size,
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
    }
  } catch (e) {
    console.error("[scan] Failed to cache to Blob:", e);
  }

  return NextResponse.json(responseData);
}
