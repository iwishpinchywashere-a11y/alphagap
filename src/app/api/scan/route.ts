import { NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";
import {
  getSubnetIdentities,
  getSubnetPools,
  getTaoFlows,
  getSubnetEmissions,
  getTaoPrice,
  getGithubActivity,
  getBurnedAlpha,
  type SubnetIdentity,
  type SubnetPool,
  type GithubActivity,
} from "@/lib/taostats";

// ── SubnetRadar API (no auth required, CORS-enabled) ────────────────
interface SRSubnet {
  netuid: number;
  taoIn: number;
  healthScore: number;
  healthBreakdown: { liquidity: number; network: number; emission: number; growth: number; development: number };
  status: "active" | "at-risk" | string;
  fearGreed: number;         // subnet sentiment 0-100 (0=extreme fear, 100=extreme greed)
  category: string;          // e.g. "Training", "Inference", "Computing", "Agents", "DeFi" etc.
  sparklinePrices: number[]; // ~100 historical price points for mini chart
}
interface SRWhaleMove {
  type: "stake" | "unstake" | "transfer";
  timestamp: string;
  amount: number;
  netuid: number;
}
async function fetchSRSubnets(): Promise<SRSubnet[]> {
  try {
    const res = await fetch("https://subnetradar.com/api/data/subnets", {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    // Normalize both camelCase and snake_case field names from the API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.subnets || []).map((s: any): SRSubnet => ({
      netuid: s.netuid ?? s.net_uid ?? 0,
      taoIn: s.taoIn ?? s.tao_in ?? 0,
      healthScore: s.healthScore ?? s.health_score ?? 0,
      healthBreakdown: s.healthBreakdown ?? s.health_breakdown ?? { liquidity: 0, network: 0, emission: 0, growth: 0, development: 0 },
      status: s.status ?? "active",
      fearGreed: s.fearGreed ?? s.fear_greed ?? 50,
      category: s.category ?? "",
      sparklinePrices: s.sparklinePrices ?? s.sparkline_prices ?? s.priceHistory ?? s.price_history ?? [],
    }));
  } catch {
    return [];
  }
}
async function fetchSRWhales(): Promise<SRWhaleMove[]> {
  try {
    const res = await fetch("https://subnetradar.com/api/whales", {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.moves || [];
  } catch {
    return [];
  }
}

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
    if (!res.ok) {
      console.error(`[scan] TMC API returned ${res.status}`);
      return [];
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error("[scan] TMC API unexpected response:", JSON.stringify(data).slice(0, 100));
      return [];
    }
    return data;
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
import { computeProductScore, BENCHMARK_MAP, MILESTONE_MAP, type WebsiteSignalData } from "@/lib/benchmarks";
import type { WebsiteProductCache } from "@/app/api/scan-websites/route";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

const RAO = 1e9;

// ── Desearch social cache — avoid calling Desearch on every 10-min scan ──
// Social data is cached for 55 minutes; only the first scan each hour pays API credits.
// social-pulse cron (every hour) handles deeper KOL timeline fetching independently.
const SOCIAL_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
let _socialCache: { data: Map<number, { mentions: number; engagement: number }>; ts: number } | null = null;

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

async function fetchKolTimeline(handle: string, count: number = 15): Promise<DesearchTweet[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const params = new URLSearchParams({ username: handle, count: count.toString() });
    const res = await fetch(`${DESEARCH_API}/twitter/user/posts?${params}`, {
      headers: { Authorization: DESEARCH_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (Array.isArray(data?.posts) ? data.posts : []);
  } catch {
    return [];
  }
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
  miner_burn_pct?: number; // % of miner emissions burned (high = unhealthy)
  tao_locked?: number;     // total TAO staked in subnet pool (from SubnetRadar)
  dereg_risk?: boolean;    // flagged "at-risk" by SubnetRadar deregwatch
  dereg_top3?: boolean;   // one of the 3 subnets most at-risk of deregistration
  fear_greed?: number;     // subnet sentiment 0-100
  category?: string;       // subnet category (Training, Inference, Agents, etc.)
  sparkline_prices?: number[]; // trimmed price history for mini chart
  volume_surge?: boolean;      // unusual buying volume detected (≥2.5x rolling avg)
  volume_surge_ratio?: number; // ratio of current buy vol to rolling avg
  alpha_staked_pct?: number;   // % of total alpha staked (not in DEX pool)
  sector_rotation?: boolean;   // subnet's category is in a sector rotation event
  product_score?: number;        // 0–100 (benchmark→100, website/milestone→80, heuristic→60)
  utility_estimated?: boolean;   // true when score is website, milestone, or heuristic (not benchmarked)
  product_source?: "benchmark" | "website" | "milestone" | "heuristic";
  benchmark_score?: number;
  benchmark_category?: string;
  cost_saving_pct?: number;
  vs_provider?: string;
  benchmark_summary?: string;
  annual_revenue_usd?: number;
  momentum_boost?: number;       // signed MOMENTUM pillar contribution (±15 max)
  agap_velo?: number;            // aGap Velocity score 0-100
  invest_agap?: number;          // Investing (long-term) aGap score 0-100
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

// Fallback: hardcoded from latest Stitch3 scrape (updated 2026-04-03)
// NOTE: active filtering is date-based — status field alone is not trusted.
function getDefaultStitchCampaigns(): StitchCampaign[] {
  return [
    { id: "034_its_ai",   subnet: "It's AI",  netuid: 32, reward: "$2,000", startDate: "2026-03-31", endDate: "2026-04-09", tweets: 6,  views: 9603,   status: "Active" },
    { id: "033_resilabs", subnet: "RESI",      netuid: 46, reward: "$2,000", startDate: "2026-03-29", endDate: "2026-04-08", tweets: 38, views: 35892,  status: "Active" },
    { id: "032_targon",   subnet: "Targon",    netuid: 4,  reward: "$1,000", startDate: "2026-03-23", endDate: "2026-03-29", tweets: 45, views: 84703,  status: "Completed" },
    { id: "031_taostats", subnet: "TaoStats",  netuid: undefined, reward: "$2,500", startDate: "2026-03-15", endDate: "2026-03-30", tweets: 73, views: 161514, status: "Completed" },
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
  const nowMs = Date.now();
  // Active = status is Active AND endDate hasn't passed yet AND startDate has been reached
  const activeCampaigns = stitchCampaigns.filter(c => {
    if (!c.netuid) return false;
    if (c.status !== "Active") return false;
    const end = new Date(c.endDate).getTime() + 24 * 60 * 60 * 1000; // inclusive of end day
    const start = new Date(c.startDate).getTime();
    return nowMs >= start && nowMs <= end;
  });
  const stitchActiveNetuids = new Set(activeCampaigns.map(c => c.netuid!));
  console.log(`[scan] Stitch3: ${activeCampaigns.length} active campaigns (${[...stitchActiveNetuids].join(", ")})`);

  // ── Step 0b: Load cached Discord scan results ─────────────────────
  type DiscordResult = { channelId: string; channelName: string; netuid: number | null; subnetName: string; signal: "alpha" | "active" | "quiet" | "noise"; summary: string; keyInsights: string[]; messageCount: number; uniquePosters: number; scannedAt: string; releaseHint?: boolean };
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

  // Batch 2: flows + emissions + TaoStats dev (historical 7d/30d) + TMC + SubnetRadar + burned alpha
  // NOTE: TaoStats dev is used for 7d/30d historical context only.
  //       24h commit data comes from the direct GitHub scanner below.
  console.log("[scan] Batch 2: flows + emissions + dev history + TMC + SubnetRadar...");
  const [flowsResult, emissionsResult, devResult, tmcResult, tmcValResult, srSubnetsResult, srWhalesResult, burnedAlphaResult] = await Promise.allSettled([
    getTaoFlows(),
    getSubnetEmissions(),
    getGithubActivity(),
    fetchTMCSubnets(),
    fetchTMCValidators(),
    fetchSRSubnets(),
    fetchSRWhales(),
    getBurnedAlpha(),
  ]);
  const flows = flowsResult.status === "fulfilled" ? flowsResult.value : [];
  const emissions = emissionsResult.status === "fulfilled" ? emissionsResult.value : [];
  const devActivity = devResult.status === "fulfilled" ? devResult.value : ([] as Awaited<ReturnType<typeof getGithubActivity>>);
  const tmcSubnets = tmcResult.status === "fulfilled" ? tmcResult.value : [];
  const validatorCounts = tmcValResult.status === "fulfilled" ? tmcValResult.value : new Map<number, number>();
  const srSubnets = srSubnetsResult.status === "fulfilled" ? srSubnetsResult.value : [];
  const srWhaleMoves = srWhalesResult.status === "fulfilled" ? srWhalesResult.value : [];
  const burnedAlphaData = burnedAlphaResult.status === "fulfilled" ? burnedAlphaResult.value : [];
  console.log(`[scan] Batch 2 done: ${flows.length} flows, ${emissions.length} emissions, ${devActivity.length} dev history, ${tmcSubnets.length} TMC, ${srSubnets.length} SR subnets, ${srWhaleMoves.length} whale moves, ${burnedAlphaData.length} burned alpha`);

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

  // ── SubnetRadar maps ──────────────────────────────────────────────
  const srSubnetMap = new Map<number, SRSubnet>(srSubnets.map(s => [s.netuid, s]));

  // Net TAO from large stake/unstake moves (≥50 TAO = "whale" threshold)
  const srWhaleNetFlowMap = new Map<number, number>();
  const WHALE_MIN_TAO = 50;
  for (const move of srWhaleMoves) {
    if (!move.netuid || move.amount < WHALE_MIN_TAO) continue;
    if (move.type === "stake") {
      srWhaleNetFlowMap.set(move.netuid, (srWhaleNetFlowMap.get(move.netuid) || 0) + move.amount);
    } else if (move.type === "unstake") {
      srWhaleNetFlowMap.set(move.netuid, (srWhaleNetFlowMap.get(move.netuid) || 0) - move.amount);
    }
  }

  // Miner burn %: burned_alpha / alpha_rewards * 100
  const minerBurnPctMap = new Map<number, number>();
  for (const b of burnedAlphaData) {
    const alphaRewards = emissionMap.get(b.netuid) || 0;
    if (alphaRewards > 0) {
      const burnedRao = parseFloat(b.burned_alpha) / RAO;
      minerBurnPctMap.set(b.netuid, Math.min(100, Math.round(burnedRao / alphaRewards * 100)));
    }
  }

  // ── GitHub repo overrides ─────────────────────────────────────────
  // Subnets where the on-chain identity registry has no entry or the wrong repo.
  // Values here take precedence over what taostats returns.
  const GITHUB_REPO_OVERRIDES: Record<number, string> = {
    70:  "https://github.com/RendixNetwork/nexisgen",   // NexisGen — missing from registry
    87:  "https://github.com/luminar-network/luminar-sn", // Luminar Network — missing from registry
    99:  "https://github.com/RendixNetwork/leoma",       // Leoma — missing from registry
    105: "https://github.com/Beam-Network/beam",         // Beam — registry had org-page URL, not repo
  };

  // Verified X/Twitter handle overrides — sourced from @PinchyAlpha/following list (Apr 2026).
  // Many subnets have X accounts that are not in the TaoStats identity registry.
  // These supplement (not replace) registry data; registry handle takes priority if set.
  const TWITTER_HANDLE_OVERRIDES: Record<number, string> = {
    1:   "macrocosmosai",   // Macrocosmos (SN1 Apex)
    2:   "omron_ai",        // Omron (zkML / Inference)
    3:   "tplr_ai",         // Templar (τemplar)
    4:   "TargonCompute",   // Targon
    5:   "manifoldlabs",    // Manifold Labs (SN5)
    6:   "numinous_ai",     // Numinous
    7:   "SubVortexTao",    // SubVortex
    8:   "VantaTrading",    // Vanta
    9:   "IOTA_SN9",        // IOTA (Macrocosmos pretraining)
    12:  "ComputeHorde",    // Compute Horde
    13:  "Data_SN13",       // Data Universe
    14:  "taohash",         // TAOHash
    15:  "oroagents",       // ORO
    16:  "bitads_ai",       // BitAds
    17:  "404gen_",         // 404-GEN
    18:  "zeussubnet",      // Zeus
    19:  "nineteen_ai",     // NineteenAI (Rayon Labs)
    20:  "TeamRizzoAI",     // BitAgent / Rizzo (SN20)
    21:  "omegalabsai",     // OMEGA Any-to-Any (Omega Labs)
    22:  "desearch_ai",     // DeSearch
    23:  "trishoolai",      // Trishool
    24:  "QuasarModels",    // Quasar
    26:  "kinitroai",       // Kinitro
    27:  "nodex0_",         // Nodexo
    28:  "FoundryServices", // Foundry S&P 500 Oracle
    32:  "ai_detection",    // It's AI (LLM Detection)
    33:  "ReadyAI_",        // ReadyAI
    34:  "BitMindAI",       // BitMind
    36:  "AutoppiaAI",      // Web Agents - Autoppia
    37:  "AureliusAligned", // Aurelius
    39:  "basilic_ai",      // Basilica
    40:  "chunking_subnet", // Chunking
    42:  "getmasafi",       // Masa (real-time social data)
    43:  "GraphiteSubnet",  // Graphite
    44:  "webuildscore",    // Score (SN44)
    45:  "TeamRizzoAI",     // Talisman AI / SWE-Rizzo (SN45)
    50:  "SynthdataCo",     // Synth
    51:  "lium_io",         // lium.io
    52:  "TensorplexLabs",  // Dojo (SN52)
    54:  "yanez__ai",       // Yanez MIID
    55:  "GenomesDAO",      // NIOME / GenomesDAO
    56:  "gradients_ai",    // Gradients
    57:  "Gaia_AI_",        // Gaia (Geospatial / Weather)
    58:  "handshake_58",    // Handshake
    59:  "babelbit",        // Babelbit
    60:  "bitsecai",        // Bitsec.ai
    61:  "_redteam_",       // RedTeam
    62:  "ridges_ai",       // Ridges
    63:  "qBitTensorLabs",  // qBitTensor (SN63)
    64:  "chutes_ai",       // Chutes
    65:  "TPN_Labs",        // TAO Private Network
    66:  "alpha_core_ai",   // AlphaCore
    68:  "metanova_labs",   // NOVA (MetaNova Labs)
    67:  "Tenex_SN67",      // Tenex (DeFi margin)
    70:  "dFusionAI",       // Vericore / dFusion AI
    71:  "LeadpoetAI",      // Leadpoet
    72:  "NATIXNetwork",    // StreetVision / NATIX
    74:  "gittensor_io",    // Gittensor
    75:  "hippius_subnet",  // Hippius
    78:  "Loosh_ai",        // Loosh (machine consciousness)
    81:  "grail_ai",        // grail
    82:  "HermesSubnet",    // Hermes (SubQuery)
    98:  "CreatorBid",      // Creator (CreatorBid agents)
    85:  "vidaio_",         // Vidaio
    88:  "Investing88ai",   // Investing (SN88)
    91:  "bitstarterAI",    // Bitstarter #1
    93:  "Bitcast_network", // Bitcast
    97:  "arbos_born",      // distil / Arbo (SN97)
    121: "sundaebar_ai",    // sundae_bar
    122: "Bitrecs",         // Bitrecs
    124: "SwarmSubnet",     // Swarm
  };

  // ── Step 3a: Direct GitHub scan — ALL subnets, real-time 24h data ──
  // This is the CORE engine. We query GitHub API directly for every subnet
  // with a registered github_repo. Always fresh — no TaoStats staleness.
  console.log("[scan] Step 3a: Direct GitHub scan (all subnets)...");
  let githubScanMap = new Map<number, GitHubScanResult>();
  try {
    githubScanMap = await scanAllSubnetGitHub(
      identities.map(id => ({
        netuid: id.netuid,
        github_repo: GITHUB_REPO_OVERRIDES[id.netuid] ?? id.github_repo,
      }))
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
      // For repos with overrides: TaoStats data points to old/wrong repo.
      // Trust the direct GitHub scan for ALL metrics when override is active.
      if (GITHUB_REPO_OVERRIDES[netuid] !== undefined) {
        // GitHubScanResult only has 24h data; use it for 7d fields too so stale TaoStats is replaced.
        if (ghResult.commits24h !== undefined) existing.commits_7d = ghResult.commits24h;
        if (ghResult.contributors24h !== undefined) existing.unique_contributors_30d = ghResult.contributors24h;
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
      identities.map(id => ({
        netuid: id.netuid,
        github_repo: GITHUB_REPO_OVERRIDES[id.netuid] ?? id.github_repo,
      }))
    );
  } catch (e) {
    console.error("[scan] HF scanner failed:", e);
  }

  const elapsed1 = Date.now() - startTime;
  console.log(`[scan] All data fetched in ${elapsed1}ms.`);

  // ── Step 4: Desearch social (cached — fires at most once per hour) ──
  // Runs 144×/day without caching = ~5,760 Desearch calls/day. With 55-min cache = ~24/day.
  const timeLeftForSocial = 50000 - (Date.now() - startTime);
  const socialMap = new Map<number, { mentions: number; engagement: number }>();

  const socialCacheHit = _socialCache && (Date.now() - _socialCache.ts) < SOCIAL_CACHE_TTL_MS;
  if (socialCacheHit) {
    for (const [k, v] of _socialCache!.data) socialMap.set(k, v);
    console.log(`[scan] Social data from cache (${socialMap.size} subnets, ${Math.round((Date.now() - _socialCache!.ts) / 60000)}min old). Skipping Desearch.`);
  }

  if (!socialCacheHit && timeLeftForSocial > 5000 && DESEARCH_KEY) {
    console.log("[scan] Cache miss — fetching fresh Desearch social data...");

    // Build handle->netuid and name->netuid maps from identities
    // Twitter handle priority: registry data → TWITTER_HANDLE_OVERRIDES
    const handleToNetuid = new Map<string, number>();
    const nameToNetuid = new Map<string, number>();
    for (const id of identities) {
      // Use override if registry is blank, else prefer registry value
      const registryHandle = id.twitter?.trim().replace(/^@/, "").replace(/https?:\/\/(twitter|x)\.com\//g, "").replace(/\/$/,"") || "";
      const overrideHandle = TWITTER_HANDLE_OVERRIDES[id.netuid] || "";
      const rawHandle = registryHandle || overrideHandle;
      if (rawHandle) {
        const handle = rawHandle.split("/").pop()?.replace(/^@/, "") || "";
        if (handle) handleToNetuid.set(handle.toLowerCase(), id.netuid);
      }
      if (id.subnet_name && id.subnet_name.length >= 4) {
        nameToNetuid.set(id.subnet_name.toLowerCase(), id.netuid);
      }
    }

    // Pre-build normalized name map: strips hyphens/spaces so "404-GEN" matches "404gen" in tweets
    const normalizedNameToNetuid = new Map<string, number>();
    for (const [name, netuid] of nameToNetuid) {
      const norm = name.replace(/[-_\s]/g, "");
      if (norm.length >= 4) normalizedNameToNetuid.set(norm, netuid);
    }

    // Bittensor context gate — same logic as social-pulse to keep scoring consistent.
    const BITTENSOR_SIGNALS_SCAN = [
      "bittensor", "$tao", "#tao", "dtao", "opentensor", "taoshi",
      "macrocosmos", "subnet", "netuid", "metagraph", "yuma",
      "tao alpha", "taomarketcap", "taostats",
    ];
    function hasBTContext(text: string): boolean {
      const t = text.toLowerCase();
      if (BITTENSOR_SIGNALS_SCAN.some(s => t.includes(s))) return true;
      if (/\bsn\d{1,3}\b/i.test(t)) return true;
      return false;
    }

    // Generic English words that happen to be subnet names — skip for name-based matching.
    const GENERIC_NAME_BLOCKLIST_SCAN = new Set([
      "investing", "vision", "atlas", "apex", "prime", "core", "genesis",
      "nexus", "origin", "signal", "pulse", "oracle", "forge", "bridge",
      "score", "quasar", "synth", "swarm", "beam", "echo",
      "liquidity", "leverage", "margin", "trading", "market", "alpha", "delta",
      "hone", "grail", "vanta", "soma", "kaito",
      "swap", "yield", "stake", "pool", "mint", "launch", "flow", "base",
    ]);

    function matchTweetToSubnet(tweet: DesearchTweet): number[] {
      const text = tweet.text.toLowerCase();
      const author = tweet.user.username.toLowerCase();
      const matched = new Set<number>();

      // Official subnet handle — require Bittensor context or own name mention
      if (handleToNetuid.has(author)) {
        const authorNetuid = handleToNetuid.get(author)!;
        if (hasBTContext(text)) matched.add(authorNetuid);
        else {
          const ownName = [...nameToNetuid.entries()].find(([,n]) => n === authorNetuid)?.[0] || "";
          if (ownName.length >= 4 && text.includes(ownName)) matched.add(authorNetuid);
        }
        return [...matched];
      }

      // All other matches require Bittensor context
      if (!hasBTContext(text)) return [];

      // @subnet_handle mentions — collect ALL mentioned handles
      for (const [handle, netuid] of handleToNetuid) {
        if (text.includes(`@${handle}`)) matched.add(netuid);
      }

      // SN# explicit mentions — collect ALL SN numbers in the tweet
      // Matches: "SN3", "SN 3", "SN#3", "subnet 3", "subnet #3", "netuid 3"
      const snPatterns = [
        /\bsn\s*#?\s*(\d{1,3})\b/gi,
        /\bsubnet\s*#?\s*(\d{1,3})\b/gi,
        /\bnetuid\s*#?\s*(\d{1,3})\b/gi,
      ];
      for (const pattern of snPatterns) {
        for (const m of [...text.matchAll(pattern)]) {
          const n = parseInt(m[1]);
          if (n > 0 && n <= 128) matched.add(n);
        }
      }

      // Subnet name — ≥5 chars, skip generic English words
      for (const [name, netuid] of nameToNetuid) {
        if (name.length >= 5 && !GENERIC_NAME_BLOCKLIST_SCAN.has(name) && text.includes(name)) {
          matched.add(netuid);
        }
      }
      const normalizedText = text.replace(/[-_\s]/g, "");
      for (const [normName, netuid] of normalizedNameToNetuid) {
        if (normName.length >= 5 && !GENERIC_NAME_BLOCKLIST_SCAN.has(normName) && normalizedText.includes(normName)) {
          matched.add(netuid);
        }
      }

      return [...matched];
    }

    // 9 targeted searches — mix of broad + subnet-specific
    // ~9 credits/scan × 6 scans/day = 54 credits/day → $10 lasts ~180 days
    const searches = [
      { query: "bittensor subnet", count: 100, sort: "Top" as const },
      { query: "bittensor subnet alpha", count: 100, sort: "Latest" as const },
      { query: "$TAO subnet", count: 50, sort: "Latest" as const },
      { query: "templar bittensor", count: 50, sort: "Top" as const },
      { query: "chutes bittensor", count: 50, sort: "Top" as const },
      { query: "ridges basilica grail bittensor", count: 50, sort: "Top" as const },
      { query: "targon vanta ORO bittensor", count: 50, sort: "Top" as const },
      { query: "bittensor alpha SN3 OR SN4 OR SN64 OR SN8", count: 50, sort: "Latest" as const },
      { query: "404gen OR \"djinn bittensor\" OR \"alphacore bittensor\" OR \"its ai bittensor\" OR \"resilabs bittensor\" OR \"beam network bittensor\" OR \"sjinn bittensor\" OR @404gen_ OR @djinn_gg OR @b1m_ai", count: 50, sort: "Top" as const },
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
      const netuids = matchTweetToSubnet(tweet);
      if (netuids.length === 0) continue;
      const rawEngagement =
        tweet.like_count + tweet.retweet_count + tweet.reply_count + (tweet.quote_count || 0);

      // KOL weight multiplier: a tweet from const_reborn (weight 100) counts 5x more
      // than a random account (weight 0)
      const kolWeight = getKOLWeight(tweet.user?.username || "");
      const kolMultiplier = kolWeight > 0 ? 1 + (kolWeight / 50) : 1; // max ~3x for top KOLs
      const weightedEngagement = Math.round(rawEngagement * kolMultiplier);

      for (const netuid of netuids) {
        const existing = socialMap.get(netuid) || { mentions: 0, engagement: 0 };
        existing.mentions++;
        existing.engagement += weightedEngagement;
        socialMap.set(netuid, existing);
      }
    }
    // PASS 1b: KOL timeline fetches — catches tweets that don't mention "bittensor"
    // e.g. const_reborn posts "404gen is making moves" — broad searches miss it entirely
    // Fetch last 15 tweets from every Tier 1 + Tier 2 KOL in parallel
    const { KOL_DATABASE } = await import("@/lib/kol-database");
    const tier12Kols = KOL_DATABASE.filter(k => k.tier <= 2);
    const kolTimelineResults = await Promise.allSettled(
      tier12Kols.map(kol => fetchKolTimeline(kol.handle, 15))
    );
    let kolTweetCount = 0;
    for (const r of kolTimelineResults) {
      if (r.status === "fulfilled") {
        for (const t of r.value) {
          if (!allTweets.has(t.id)) { allTweets.set(t.id, t); kolTweetCount++; }
        }
      }
    }
    console.log(`[scan] KOL timelines: +${kolTweetCount} new tweets from ${tier12Kols.length} KOLs. Total: ${allTweets.size}`);

    // Rebuild socialMap cleanly from full allTweets set (broad searches + KOL timelines, deduped)
    socialMap.clear();
    for (const tweet of allTweets.values()) {
      const netuids = matchTweetToSubnet(tweet);
      if (netuids.length === 0) continue;
      const rawEngagement = tweet.like_count + tweet.retweet_count + tweet.reply_count + (tweet.quote_count || 0);
      const kolWeight = getKOLWeight(tweet.user?.username || "");
      const kolMultiplier = kolWeight > 0 ? 1 + (kolWeight / 50) : 1;
      const weightedEngagement = Math.round(rawEngagement * kolMultiplier);
      for (const netuid of netuids) {
        const existing = socialMap.get(netuid) || { mentions: 0, engagement: 0 };
        existing.mentions++;
        existing.engagement += weightedEngagement;
        socialMap.set(netuid, existing);
      }
    }

    console.log(`[scan] Desearch broad search done. ${allTweets.size} tweets matched to ${socialMap.size} subnets.`);

    // PASS 2: Search for tweets FROM official subnet X handles
    // This captures the subnet's own posting activity + engagement
    const twitterHandleMap = new Map<string, number>(); // handle -> netuid
    for (const id of identities) {
      const registryHandle = id.twitter?.replace(/https?:\/\/(twitter|x)\.com\//g, "").replace("@", "").replace(/\/$/, "").trim() || "";
      const handle = registryHandle || TWITTER_HANDLE_OVERRIDES[id.netuid] || "";
      if (handle) twitterHandleMap.set(handle.toLowerCase(), id.netuid);
    }

    // Search ALL known subnet handles (up to 50, batched 5 at a time = 10 Desearch queries)
    // Previously limited to top-15 priority subnets — now we scan everything in the handle map
    // so @PinchyAlpha's full following list is covered every scan.
    const handleEntries = [...twitterHandleMap.entries()].slice(0, 50);

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

    // Save to in-memory cache so the next 5 scans (within 55 min) skip Desearch entirely
    if (socialMap.size > 0) {
      _socialCache = { data: new Map(socialMap), ts: Date.now() };
      console.log(`[scan] Social data cached (${socialMap.size} subnets). Next Desearch fetch in ~55min.`);
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
  async function analyzeDevActivity(ctx: DevContext): Promise<{ description: string; score: number; headline: string | null }> {
    if (!ANTHROPIC_KEY) return { description: buildFallbackDescription(ctx), score: fallbackScore(ctx), headline: null };

    const name = identityMap.get(ctx.act.netuid)?.subnet_name || `SN${ctx.act.netuid}`;
    const pool = poolMap.get(ctx.act.netuid);
    const price = pool ? (parseFloat(pool.price || "0") / RAO * taoPrice).toFixed(2) : "?";
    const mcap = pool ? "$" + (parseFloat(pool.market_cap || "0") / RAO * taoPrice / 1e6).toFixed(1) + "M" : "?";
    const priceChange = pool?.price_change_1_day ? parseFloat(pool.price_change_1_day).toFixed(1) : "?";

    const commitText = ctx.commits.slice(0, 8).join("\n");
    const prText = ctx.prs.slice(0, 4).join("\n");
    const releaseText = ctx.release ? `Latest release: ${ctx.release.name} (${ctx.release.tag})\n${ctx.release.body.slice(0, 500)}` : "";

    const identity = identityMap.get(ctx.act.netuid);
    const subnetDescription = identity?.description || identity?.summary || "";

    const prompt = `You are the AlphaGap intelligence engine — the world's sharpest Bittensor subnet analyst. You read raw GitHub commits and PRs and produce investment-grade intelligence signals.

Your job is to score the INVESTMENT OPPORTUNITY, not just the dev work in isolation. The score answers: "How much should a serious crypto investor care about this right now?"

SUBNET INFO:
Name: ${name} (SN${ctx.act.netuid})
Repo: ${ctx.owner}/${ctx.repo}
Description: ${subnetDescription || "No description available"}
Token: $${price} (24h change: ${priceChange}%) | Market Cap: ${mcap}
Today's activity: ${ctx.act.commits_1d} commits, ${ctx.act.prs_merged_1d} merged PRs, ${ctx.act.unique_contributors_1d} contributors

RAW COMMITS (this is the evidence — read carefully):
${commitText || "No commits found"}

MERGED PULL REQUESTS:
${prText || "No PRs found"}

${releaseText}

Write your intelligence report in this EXACT format:

SCORE: [number 1-100]
HEADLINE: [8 words max. What they actually built/shipped. Concrete, specific, no fluff. Examples: "Released v1.18 with new inference engine", "Fixed critical validator consensus bug", "Shipped multi-modal input support", "Launched public API for external devs". Do NOT write "pushed X commits" or "updated codebase".]

🏗️ What is ${name}:
[2 sentences MAX. What does this subnet do and what problem does it solve? Plain English — no crypto jargon. A smart friend with no Bittensor knowledge should instantly get it.]

🔧 What they built:
[Specific features, fixes, models, or improvements. Name actual things. No vague statements.]

📡 Why it matters:
[Why is this significant? What problem does it solve?]

💡 In simple terms:
[Explain to a smart non-technical friend over coffee. Use analogies.]

🎯 The AlphaGap take:
[Your boldest, most direct investment call. Is the market sleeping on this? Is this priced in or not? Be opinionated.]

HOW TO SCORE — the score is INVESTMENT SIGNAL STRENGTH: (dev quality) × (market opportunity).
Use the FULL range 1–100. Be aggressive — a great signal deserves 80, 85, 90. A bad signal deserves 10.

DEV QUALITY tiers:
- Noise (1–15): version bumps, dep updates, CI fixes, README edits, typos, linting
- Routine (16–30): small bug fixes, minor config changes, test additions, solo-contributor chores
- Incremental (31–50): small features, refactors with purpose, moderate PRs, consistent team activity
- Meaningful (51–65): real new capability, new API endpoint, protocol improvement, multi-contributor sprint
- Significant (66–82): major feature launch, new model shipped, protocol upgrade, public release, important bugfix
- Extraordinary (83–100): paradigm shift, breakthrough capability, first-ever feature in category, massive release

MARKET OPPORTUNITY — adjust UP or DOWN based on context:
- Small mcap ($1M–$10M) building hard, token flat/down → undervaluation signal, +10 to +20
- Medium mcap ($10M–$50M) meaningful dev, token flat → worth noting, +5 to +10
- Large mcap ($50M+) routine commits → likely priced in already, −5 to −15
- Token down 10%+ while team ships hard → market sleeping on this, +10 to +15
- Token up 20%+ today → already reflected in price, −5 to −10
- 3+ unique contributors in one day → team is serious, +5

CALIBRATION EXAMPLES (use these as anchors — don't be afraid to match them):
- Bumped 3 npm deps + CI fix at $80M mcap: 8
- Fixed a race condition bug, one contributor at $5M mcap: 22
- Added unit tests + refactored auth module, token flat at $12M: 38
- Shipped new inference endpoint + 3 PRs merged at $8M, token down 5%: 62
- Shipped new API endpoint + improved accuracy, $5M mcap, token flat: 72
- Released new validator protocol with 3+ contributors at $15M, token flat: 80
- Launched v2.0 with new architecture + public release, $20M mcap, token down 12%: 90
- First-ever real-time video generation model on Bittensor, $3M mcap, completely undiscovered: 97

BE DECISIVE. If it's a real feature shipped by a real team, score it 70+. If it's a major release or capability leap, score it 80+. Don't self-censor. The leaderboard is useless if every signal clusters between 55–70.

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
      if (!res.ok) return { description: buildFallbackDescription(ctx), score: fallbackScore(ctx), headline: null };
      const data = await res.json();
      const text: string = data.content?.[0]?.text || "";

      // Parse SCORE: and HEADLINE: from response
      const scoreMatch = text.match(/^SCORE:\s*(\d+)/m);
      const score = scoreMatch ? Math.min(100, Math.max(1, parseInt(scoreMatch[1]))) : fallbackScore(ctx);

      const headlineMatch = text.match(/^HEADLINE:\s*(.+)/m);
      const headline = headlineMatch ? headlineMatch[1].trim() : null;

      // Strip SCORE and HEADLINE lines from description shown to users
      const description = text
        .replace(/^SCORE:\s*\d+\s*\n?/m, "")
        .replace(/^HEADLINE:\s*.+\n?/m, "")
        .trim();

      console.log(`[scan] AI scored SN${ctx.act.netuid} (${name}): ${score}/100 — ${headline || "no headline"}`);
      return { description, score, headline };
    } catch {
      return { description: buildFallbackDescription(ctx), score: fallbackScore(ctx), headline: null };
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

  // Fallback score when AI is unavailable — uses full range to avoid clustering at 28.
  function fallbackScore(ctx: DevContext): number {
    // Base on event type — releases are highest, PRs next, pushes lowest
    let s = ctx.release ? 45 : ctx.act.prs_merged_1d > 0 ? 30 : 15;
    // Commit volume
    if (ctx.act.commits_1d >= 20) s += 25;
    else if (ctx.act.commits_1d >= 10) s += 18;
    else if (ctx.act.commits_1d >= 5) s += 10;
    else if (ctx.act.commits_1d >= 1) s += 4;
    // PR volume
    if (ctx.act.prs_merged_1d >= 5) s += 15;
    else if (ctx.act.prs_merged_1d >= 3) s += 10;
    else if (ctx.act.prs_merged_1d >= 1) s += 5;
    return Math.min(85, s); // fallback cap — AI can push higher with full context
  }

  // Try AI analysis for as many signals as time allows
  const timeLeftForAI = 200000 - (Date.now() - startTime);
  console.log(`[scan] AI analysis: ${devContexts.length} signals, ${(timeLeftForAI/1000).toFixed(0)}s left`);

  const analyzedDevSignals: { ctx: DevContext; description: string; score: number; headline: string | null }[] = [];

  if (timeLeftForAI > 8000 && ANTHROPIC_KEY) {
    try {
      const aiResults = await Promise.race([
        Promise.all(devContexts.map(async (ctx) => {
          const { description, score, headline } = await analyzeDevActivity(ctx);
          return { ctx, description, score, headline };
        })),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("AI timeout")), timeLeftForAI - 3000)),
      ]);
      analyzedDevSignals.push(...aiResults);
      console.log(`[scan] AI done: ${aiResults.length} analyzed`);
    } catch {
      console.log("[scan] AI timed out, using fallback for remaining");
      if (analyzedDevSignals.length === 0) {
        for (const ctx of devContexts) {
          analyzedDevSignals.push({ ctx, description: buildFallbackDescription(ctx), score: fallbackScore(ctx), headline: null });
        }
      }
    }
  } else {
    for (const ctx of devContexts) {
      analyzedDevSignals.push({ ctx, description: buildFallbackDescription(ctx), score: fallbackScore(ctx), headline: null });
    }
  }

  console.log(`[scan] Analyzed ${analyzedDevSignals.length} dev signals with AI.`);

  // Build quality map: netuid → AI quality score, used later to adjust dev_score
  const aiQualityMap = new Map<number, number>();
  for (const { ctx, score } of analyzedDevSignals) {
    aiQualityMap.set(ctx.act.netuid, score);
  }

  // Create rich dev signals — score from AI quality assessment, date from real commits
  for (const { ctx, description, score, headline } of analyzedDevSignals) {
    const name = identityMap.get(ctx.act.netuid)?.subnet_name || `SN${ctx.act.netuid}`;
    const ghResult = githubScanMap.get(ctx.act.netuid);

    // Real commit date from "[YYYY-MM-DD] sha: msg" format
    let commitDate = new Date().toISOString();
    if (ctx.commits.length > 0) {
      const m = ctx.commits[0].match(/^\[(\d{4}-\d{2}-\d{2})\]/);
      // Use noon UTC so date displays correctly in all timezones (avoids midnight UTC → day-before in Pacific)
      if (m) commitDate = new Date(m[1] + "T12:00:00.000Z").toISOString();
    } else if (ghResult?.releaseDate) {
      commitDate = ghResult.releaseDate;
    }

    const displayDate = new Date(commitDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    // Fallback title if AI didn't produce a headline
    const activitySummary = [
      ctx.act.commits_1d > 0 ? `${ctx.act.commits_1d} commits` : "",
      ctx.act.prs_merged_1d > 0 ? `${ctx.act.prs_merged_1d} PRs` : "",
      ghResult?.hasNewRelease ? `released ${ghResult.releaseTag}` : "",
    ].filter(Boolean).join(", ");
    const fallbackTitle = `${name} — ${activitySummary} (${displayDate})`;

    addSignal({
      netuid: ctx.act.netuid,
      signal_type: "dev_spike",
      strength: score, // AI-assigned quality score, not a commit-count formula
      title: headline ? `${name}: ${headline}` : fallbackTitle,
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
    // SubnetRadar enrichment
    taoLocked: number;        // total TAO staked in subnet pool (from SR taoIn)
    liquidityScore: number;   // liquidity health 0-100 (from SR healthBreakdown.liquidity)
    minerBurnPct: number;     // % of miner emissions burned (0 = healthy, 100 = all burned)
    srWhaleNetTao: number;    // net TAO from recent large stake/unstake moves (SubnetRadar whales)
    deregRisk: boolean;       // subnet flagged "at-risk" by SubnetRadar deregwatch
    fearGreedIndex: number;   // subnet sentiment 0-100 (SubnetRadar fearGreed)
    category: string;         // subnet category (Training, Inference, Agents, etc.)
    sparklinePrices: number[]; // trimmed historical prices for mini chart (30 pts)
    alphaStakedPct: number;   // % of total alpha that is staked (not in DEX pool)
    rootProp: number;          // root_prop from pool — % of emissions from root validators
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
      emissionPct: tmcMap.get(netuid)?.emission ?? (totalEmission > 0 ? (emissionMap.get(netuid) || 0) / totalEmission * 100 : 0),
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
      taoLocked: srSubnetMap.get(netuid)?.taoIn ?? (pool ? parseFloat(pool.total_tao) / RAO : 0),
      liquidityScore: srSubnetMap.get(netuid)?.healthBreakdown.liquidity ?? 0,
      minerBurnPct: minerBurnPctMap.get(netuid) ?? 0,
      srWhaleNetTao: srWhaleNetFlowMap.get(netuid) ?? 0,
      deregRisk: srSubnetMap.get(netuid)?.status === "at-risk",
      fearGreedIndex: srSubnetMap.get(netuid)?.fearGreed ?? 50,
      category: srSubnetMap.get(netuid)?.category ?? "",
      alphaStakedPct: (() => {
        if (!pool) return 0;
        const totalAlpha = parseFloat(pool.total_alpha || "0");
        const alphaInPool = parseFloat(pool.alpha_in_pool || "0");
        const alphaStaked = parseFloat(pool.alpha_staked || "0");
        if (totalAlpha <= 0) return 0;
        // alpha_staked = staked outside pool; alpha_in_pool = in DEX pool
        // Use alpha_staked directly if available, else derive from total - pool
        const staked = alphaStaked > 0 ? alphaStaked : Math.max(0, totalAlpha - alphaInPool);
        return Math.round((staked / totalAlpha) * 100);
      })(),
      rootProp: pool ? parseFloat(pool.root_prop || "0") : 0,
      // Keep 30 evenly-spaced points — enough shape for a sparkline, keeps blob lean.
      // If SubnetRadar has no sparkline, synthesize from known price-change percentages.
      sparklinePrices: (() => {
        const prices = srSubnetMap.get(netuid)?.sparklinePrices;
        if (prices && prices.length > 0) {
          if (prices.length <= 30) return prices;
          const step = Math.floor(prices.length / 30);
          return prices.filter((_, i) => i % step === 0).slice(0, 30);
        }
        // Synthetic fallback: reconstruct ~5 historical points from % changes
        const currentPrice = pool ? parseFloat(pool.price) * taoPrice : 0;
        if (!currentPrice || currentPrice <= 0) return [];
        const pc1h  = pool?.price_change_1_hour  ? parseFloat(pool.price_change_1_hour)  : 0;
        const pc24h = pool?.price_change_1_day   ? parseFloat(pool.price_change_1_day)   : 0;
        const pc7d  = pool?.price_change_1_week  ? parseFloat(pool.price_change_1_week)  : 0;
        const pc30d = pool?.price_change_1_month ? parseFloat(pool.price_change_1_month) : 0;
        const p1h   = currentPrice / (1 + pc1h  / 100);
        const p24h  = currentPrice / (1 + pc24h / 100);
        const p7d   = currentPrice / (1 + pc7d  / 100);
        const p30d  = currentPrice / (1 + pc30d / 100);
        return [p30d, p7d, p24h, p1h, currentPrice].filter(p => p > 0 && isFinite(p));
      })(),
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

    let score = Math.min(100, ghScore + hfScore);

    // ── Quality adjustment (AI signal score) ──────────────────────
    // Blends AI-assessed content quality into the quantity-based dev score.
    // +18 for groundbreaking work (95+), −8 for low-quality noise (<30).
    const aiQuality = aiQualityMap.get(d.netuid);
    if (aiQuality !== undefined) {
      const qualityAdj =
        aiQuality >= 95 ? 18 :  // groundbreaking — major architectural shift or research breakthrough
        aiQuality >= 85 ? 13 :
        aiQuality >= 70 ? 9 :
        aiQuality >= 50 ? 4 :
        aiQuality >= 30 ? -3 :
        -8;
      score = Math.min(100, Math.max(0, score + qualityAdj));
    }

    // ── Early detection bonus ──────────────────────────────────────
    // Small boost when we're catching fresh commits within 12h of being pushed.
    // Rewards finding the signal before the market does.
    // Early detection: if there's a fresh release within 12h, small boost
    const ghScan = githubScanMap.get(d.netuid);
    if (ghScan?.releaseDate && commits1d > 0) {
      const hoursSinceRelease = (Date.now() - new Date(ghScan.releaseDate).getTime()) / 3600000;
      if (hoursSinceRelease < 6) score = Math.min(100, score + 5);
      else if (hoursSinceRelease < 12) score = Math.min(100, score + 3);
    }

    return Math.round(score);
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

    // SubnetRadar real-time whale staking signal (±5 pts)
    // Actual large stake/unstake events (≥50 TAO) from the last ~30 min on-chain
    const srNet = d.srWhaleNetTao;
    let srWhaleScore = 0;
    if (srNet >= 500) srWhaleScore = 5;
    else if (srNet >= 200) srWhaleScore = 3;
    else if (srNet >= 50) srWhaleScore = 1;
    else if (srNet <= -500) srWhaleScore = -5;
    else if (srNet <= -200) srWhaleScore = -3;
    else if (srNet <= -50) srWhaleScore = -1;

    // VOLUME SURGE boost (0-28 pts)
    // Unusual buying activity = smart money positioning before a move.
    // Requires: current 24h buy vol ≥20 TAO AND ≥2.5x the rolling historical avg.
    // This is a strong leading indicator — weight it heavily.
    const surgeRatio = volumeSurgeMap.get(d.netuid) || 0;
    let volumeSurgeScore = 0;
    if (surgeRatio >= 10) volumeSurgeScore = 28;      // 10x+ surge: massive accumulation
    else if (surgeRatio >= 7) volumeSurgeScore = 23;  // 7x: very strong
    else if (surgeRatio >= 5) volumeSurgeScore = 18;  // 5x: strong signal
    else if (surgeRatio >= 3.5) volumeSurgeScore = 14; // 3.5x: clear surge
    else if (surgeRatio >= 2.5) volumeSurgeScore = 10; // 2.5x: notable

    // Fear & Greed sentiment modifier (±3 pts)
    // Greed confirms momentum when price is also rising (not a false signal).
    // Extreme fear in a downtrend is a contrarian setup — exactly what AlphaGap hunts.
    const fg = d.fearGreedIndex;
    let fgScore = 0;
    if (fg >= 80 && pch24h >= 2) fgScore = 3;       // extreme greed + price up = confirmed momentum
    else if (fg >= 65 && pch24h >= 0) fgScore = 1;   // mild greed + stable/up = slight confirm
    else if (fg <= 20 && pch7d <= -15) fgScore = 3;  // extreme fear in downtrend = contrarian reversal setup
    else if (fg <= 35 && pch7d <= -10) fgScore = 1;  // fear in downtrend = mild contrarian signal
    else if (fg >= 85 && pch7d >= 30) fgScore = -2;  // extreme greed after big 7d pump = overextended

    return Math.max(1, Math.min(100, score24h + score7d + score30d + reversalBonus + whaleScore + srWhaleScore + fgScore + volumeSurgeScore));
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

    // 6. MINER BURN PENALTY — subnet burning miner emissions instead of paying them
    // High burn = miners aren't getting rewarded = structural weakness signal
    // Healthy subnets pay their miners; chronic burners have 0% miner yield
    const burnPct = d.minerBurnPct;
    if (burnPct >= 95) score -= 15;  // Chronic: miners get essentially nothing
    else if (burnPct >= 80) score -= 10;
    else if (burnPct >= 60) score -= 5;
    else if (burnPct >= 40) score -= 3;

    // 7. HEALTH BOOST — TAO locked + liquidity signal from SubnetRadar (max +8 pts)
    // More TAO locked = more conviction from stakers + deeper liquidity = healthier subnet
    const taoLocked = d.taoLocked;
    const liqScore = d.liquidityScore;
    if (taoLocked >= 10000 && liqScore >= 70) score += 8;
    else if (taoLocked >= 5000 && liqScore >= 60) score += 6;
    else if (taoLocked >= 2000 && liqScore >= 50) score += 4;
    else if (taoLocked >= 500) score += 2;
    else if (taoLocked >= 100) score += 1;

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
  // netuid → { signal, messageCount, uniquePosters, scannedAt, releaseHint }
  const discordMap = new Map<number, { signal: string; alphaScore?: number; messageCount: number; uniquePosters: number; scannedAt: string; releaseHint?: boolean }>();
  for (const disc of discordResults) {
    if (disc.netuid && disc.netuid > 0) {
      discordMap.set(disc.netuid, {
        signal: disc.signal,
        alphaScore: (disc as Record<string, unknown>).alphaScore as number | undefined,
        messageCount: disc.messageCount,
        uniquePosters: disc.uniquePosters,
        scannedAt: disc.scannedAt || new Date().toISOString(),
        releaseHint: disc.releaseHint === true,
      });
    }
  }

  // ── Load KOL heat events (written by /api/cron/social-pulse every 10 min) ──
  // Heat events let a single tier-1 KOL tweet push a subnet's social score to 90-100.
  // Events store raw heat_score at detection time; we apply age-decay here.
  type HeatEvent = { tweet_id: string; netuid: number; subnet_name: string; kol_handle: string; kol_name: string; kol_weight: number; kol_tier: number; tweet_url: string; engagement: number; heat_score: number; detected_at: string };
  let hotEvents: HeatEvent[] = [];
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { get: getHotBlob } = await import("@vercel/blob");
      const hotBlob = await getHotBlob("social-hot.json", { token: process.env.BLOB_READ_WRITE_TOKEN, access: "private" });
      if (hotBlob?.stream) {
        const rdr = hotBlob.stream.getReader(); const cks: Uint8Array[] = [];
        while (true) { const { done, value } = await rdr.read(); if (done) break; cks.push(value); }
        hotEvents = (JSON.parse(Buffer.concat(cks).toString("utf-8")) as { events: HeatEvent[] }).events ?? [];
      }
    } catch { /* no hot events yet */ }
  }

  // ── Social Score v3: Early Trend Detector ──────────────────────
  // HIGH score = catching a FRESH, multi-voice social trend (alpha window open)
  // LOW score = no signal or single voice that has aged out
  //
  // Key design principles:
  //  - Dedupe to BEST event per unique KOL — 40 tweets from one account
  //    counts the same as 1 (repetition ≠ signal breadth)
  //  - Multiple DIFFERENT KOLs within 4h = cluster bonus (rare, serious)
  //  - To hit 90+: need 2+ unique KOLs active within 4h OR 3+ within 4h + discord alpha
  //  - To hit 100: need 3+ unique KOLs within 4h + discord alpha + some organic
  const desearchFailed = socialMap.size === 0;
  const _now = Date.now();

  function getKolScore(netuid: number): { kolPts: number; clusterBonus: number } {
    // Decay all events for this subnet
    const allDecayed = hotEvents
      .filter(e => e.netuid === netuid)
      .map(e => {
        const hoursOld = (_now - new Date(e.detected_at).getTime()) / 3600000;
        const freshness = hoursOld <= 4 ? 1.0 : Math.max(0, 1 - (hoursOld - 4) / 68);
        return { handle: e.kol_handle, heat: Math.round(e.heat_score * freshness), hoursOld };
      })
      .filter(e => e.heat >= 20);

    // DEDUPE: only the best event per unique KOL handle
    // One account tweeting 40 times counts once — breadth of voices is the signal
    const bestPerKol = new Map<string, { heat: number; hoursOld: number }>();
    for (const e of allDecayed) {
      const prev = bestPerKol.get(e.handle);
      if (!prev || e.heat > prev.heat) bestPerKol.set(e.handle, { heat: e.heat, hoursOld: e.hoursOld });
    }
    const uniqueKols = [...bestPerKol.entries()].sort((a, b) => b[1].heat - a[1].heat);

    // Stack unique KOL voices with steep diminishing returns
    const weights = [0.55, 0.35, 0.20, 0.10];
    let kolPts = 0;
    for (let i = 0; i < Math.min(uniqueKols.length, weights.length); i++) {
      kolPts += uniqueKols[i][1].heat * weights[i];
    }
    kolPts = Math.min(70, Math.round(kolPts));

    // Cluster bonus: multiple DIFFERENT KOLs active within 4h = coordinated early viral signal
    // 4+ KOLs in 4h is rare and deserves a major boost — that's a true early trend.
    const recent4hKOLs = uniqueKols.filter(([, v]) => v.hoursOld <= 4).length;
    const clusterBonus = recent4hKOLs >= 4 ? 35 : recent4hKOLs >= 3 ? 24 : recent4hKOLs >= 2 ? 14 : 0;

    return { kolPts, clusterBonus };
  }

  function computeSocialScore(netuid: number, mentions: number, engagement: number): number {
    const { kolPts, clusterBonus } = getKolScore(netuid);

    // ── Discord freshness signal (max 30 pts) ──
    // releaseHint = true gets a large extra bonus — imminent release chatter is the
    // highest-value early alpha: the market hasn't priced it yet and you're hearing it first.
    const disc = discordMap.get(netuid);
    let discordPts = 0;
    if (disc) {
      const discAgeHours = (_now - new Date(disc.scannedAt).getTime()) / 3600000;
      const discFresh = discAgeHours <= 12 ? 1.0
        : discAgeHours <= 48 ? Math.max(0.4, 1 - (discAgeHours - 12) / 36 * 0.6)
        : 0.4;
      if (disc.alphaScore != null) {
        // Use AI quality score directly: alphaScore 0-100 → 0-30 pts, scaled by freshness
        // release hint gets a 5pt bonus on top
        const base = Math.round(disc.alphaScore / 100 * 28) + (disc.releaseHint ? 5 : 0);
        discordPts = Math.round(Math.min(30, base) * discFresh);
      } else if (disc.signal === "alpha") {
        const base = disc.releaseHint
          ? Math.min(30, (22 + Math.min(disc.uniquePosters, 8)))
          : Math.min(20, (13 + Math.min(disc.uniquePosters, 7)));
        discordPts = Math.round(base * discFresh);
      } else if (disc.signal === "active") {
        discordPts = Math.round(Math.min(10, (5 + Math.min(disc.uniquePosters, 5))) * discFresh);
      }
    }

    // ── Organic volume (max 5 pts — tiebreaker only, not a primary signal) ──
    let organicPts = 0;
    if (mentions >= 30) organicPts = 5;
    else if (mentions >= 15) organicPts = 4;
    else if (mentions >= 7) organicPts = 3;
    else if (mentions >= 3) organicPts = 2;
    else if (mentions >= 1) organicPts = 1;

    // ── Fallback: no signal at all ──
    if (kolPts === 0 && discordPts === 0 && mentions <= 0) {
      if (desearchFailed) {
        const identity = identityMap.get(netuid);
        if (identity?.twitter) return 8;
        if (identity?.subnet_name) return 4;
      }
      return 0;
    }

    return Math.min(100, Math.max(0, kolPts + clusterBonus + discordPts + organicPts));
  }

  // ── Load aGap score history for EMA smoothing ──────────────────
  // Asymmetric EMA: fast up (70% current), slow down (30% current)
  // This rewards subnets that discover alpha quickly, but prevents
  // ── Website product scan cache (from /api/scan-websites daily cron) ─────
  // Keys are netuid (as number). Contains HTML-derived product signals.
  let websiteProductMap = new Map<number, WebsiteSignalData>();
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { get: getBlobWP } = await import("@vercel/blob");
      const wpBlob = await getBlobWP("website-product.json", {
        token: process.env.BLOB_READ_WRITE_TOKEN,
        access: "private",
      });
      if (wpBlob?.stream) {
        const reader = wpBlob.stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const wpData: WebsiteProductCache = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        for (const [nid, result] of Object.entries(wpData.subnets)) {
          if (result.reachable && result.score > 0) {
            websiteProductMap.set(Number(nid), {
              score: result.score,
              signals: result.signals,
              stage: result.stage,
              summary: result.summary,
              ai_scored: result.ai_scored,
            });
          }
        }
        console.log(`[scan] Loaded website product data for ${websiteProductMap.size} subnets`);
      }
    } catch {
      console.log("[scan] No website-product.json yet (first run)");
    }
  }

  // scores from crashing overnight when one data point changes.
  // Bump this when leaderboard formula changes — forces EMA history reset so old
  // baselines don't drag new scores down for hours after a formula update.
  const AGAP_HISTORY_VERSION = 9;
  type AGapHistoryEntry = { ema: number; lastUpdated: string };
  type AGapHistory = Record<number, AGapHistoryEntry> & { __version?: number };
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
        const loaded: AGapHistory = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        // Reset EMA if formula version changed — prevents old baselines dragging new scores
        if ((loaded.__version ?? 0) < AGAP_HISTORY_VERSION) {
          console.log(`[scan] AGap history version outdated (${loaded.__version ?? 0} < ${AGAP_HISTORY_VERSION}) — resetting EMA`);
          agapHistory = { __version: AGAP_HISTORY_VERSION };
        } else {
          agapHistory = loaded;
          console.log(`[scan] Loaded aGap history for ${Object.keys(agapHistory).filter(k => k !== "__version").length} subnets`);
        }
      }
    } catch {
      console.log("[scan] No aGap history yet (first run)");
    }
  }

  function smoothAGap(netuid: number, rawScore: number): number {
    const entry = agapHistory[netuid];
    const prev = entry && typeof entry === "object" && "ema" in entry ? (entry as AGapHistoryEntry) : null;
    if (!prev) return rawScore; // First time: use raw score

    const prevEma = prev.ema;
    if (rawScore >= prevEma) {
      // RISING: fast reaction — market hasn't priced it in yet
      return Math.round(0.8 * rawScore + 0.2 * prevEma);
    } else {
      // FALLING: moderate decay (55% current, 45% historical)
      // Less sticky on the way down so consistent quality builders
      // aren't permanently trapped by a bad stretch
      return Math.round(0.55 * rawScore + 0.45 * prevEma);
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

  // ── Load volume history + build surge map ───────────────────────
  // Tracks 24h buy volume per subnet over time to detect unusual buying surges.
  // A "surge" = current 24h buy vol is ≥2.5x the rolling historical average.
  // Data is throttled to ~1 reading/hour so history stays compact (~430KB for all subnets).
  type VolumeHistory = { [netuid: string]: { vol: number; ts: string }[] };
  let volumeHistory: VolumeHistory = {};
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const volBlob = await blobGet("volume-history.json", {
        token: process.env.BLOB_READ_WRITE_TOKEN!,
        access: "private",
      });
      if (volBlob?.stream) {
        const reader = volBlob.stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
        volumeHistory = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
      }
    }
  } catch { /* first scan — no history yet */ }

  // Build surge ratio map: netuid → (currentVol / historicalAvg)
  // Only fires when: current vol ≥ 20 TAO AND history has ≥ 5 readings AND avg > 0.5 TAO
  const volumeSurgeMap = new Map<number, number>();
  for (const pool of pools) {
    const hist = volumeHistory[String(pool.netuid)] || [];
    if (hist.length < 5) continue;
    const currentVol = parseFloat(pool.tao_buy_volume_24_hr || "0") / RAO;
    if (currentVol < 20) continue; // minimum meaningful volume (~$6k)
    const avgVol = hist.reduce((s, h) => s + h.vol, 0) / hist.length;
    if (avgVol > 0.5) {
      const ratio = currentVol / avgVol;
      if (ratio >= 2.5) volumeSurgeMap.set(pool.netuid, Math.round(ratio * 10) / 10);
    }
  }
  console.log(`[scan] Volume surges detected: ${volumeSurgeMap.size} subnets (${[...volumeSurgeMap.entries()].filter(([,r])=>r>=5).length} significant ≥5x)`);

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

    // ── THE ALPHA GAP FORMULA v7 ────────────────────────────────
    // THESIS: Find subnets where VALUE has been created but MARKET hasn't noticed yet.
    //
    // Two types of gap we're hunting:
    //   A) FRESH ACTIVITY GAP — dev work just shipped that nobody priced in yet
    //      (Templar posts insane work → market takes 4 days to react)
    //   B) ACCUMULATION GAP — smart money (whales/validators/stakers) loading up
    //      while price is still low or falling
    //
    // Signals are scored as: LEADING (new info market doesn't have) vs LAGGING (already priced in)
    // v7 cuts lagging signal weight and amplifies leading signals.

    // 1. BUILDING QUALITY (0-25 pts) — baseline dev health
    // This is the "known quality" signal — established dev reputation is already priced in.
    // We WANT good dev subnets, but not to over-reward ones the market already knows.
    // The FRESH ACTIVITY bonus below is the gap signal, not the level.
    const buildingPts = devScore * 0.25;

    // CONSISTENT BUILDER BONUS (0-10 pts)
    // Rewards teams that ship week after week — sustained 30d cadence
    // that the spike detector misses because it looks for outliers.
    // High 30d commits + contributors = the market probably still hasn't
    // fully priced in institutional-grade dev output.
    const devRaw30 = devMap.get(d.netuid);
    const cb_commits30d = devRaw30?.commits_30d || 0;
    const cb_contributors30d = devRaw30?.unique_contributors_30d || 0;
    const spikeDailyBaseline30 = cb_commits30d > 0 ? cb_commits30d / 30 : 0;
    let consistentBuilderBonus = 0;
    if (spikeDailyBaseline30 >= 3 && cb_contributors30d >= 3) {
      // Power team: high cadence + multi-contributor = top tier
      consistentBuilderBonus = 10;
    } else if (spikeDailyBaseline30 >= 2 && cb_contributors30d >= 2) {
      consistentBuilderBonus = 7;
    } else if (spikeDailyBaseline30 >= 1 && cb_contributors30d >= 2) {
      consistentBuilderBonus = 5;
    } else if (spikeDailyBaseline30 >= 1) {
      // Solo consistent builder — still worth something
      consistentBuilderBonus = 3;
    }

    // DEV SPIKE BONUS (0-15 pts) — THE KEY GAP SIGNAL FOR DEV
    // Detects: today's commits are significantly above this subnet's own 30d daily average.
    // This is the "Templar just posted something insane at 2am" signal.
    // Market takes hours to days to price in fresh GitHub activity — we catch it first.
    //
    // Quiet subnet suddenly shipping = MAXIMUM new information.
    // Always-active subnet with another normal day = already expected, already priced in.
    const devRaw = devMap.get(d.netuid);
    const spikeDailyBaseline = devRaw?.commits_30d
      ? devRaw.commits_30d / 30          // expected daily commits from 30d history
      : 0;
    const spikeCommits1d = devRaw?.commits_1d || 0;
    const spikeAiQuality = aiQualityMap.get(d.netuid);
    let devSpikeBonus = 0;

    if (spikeCommits1d > 0) {
      if (spikeDailyBaseline < 0.5) {
        // Normally quiet subnet — any activity today is new information
        if      (spikeCommits1d >= 10) devSpikeBonus = 12;
        else if (spikeCommits1d >= 5)  devSpikeBonus = 9;
        else if (spikeCommits1d >= 1)  devSpikeBonus = 5;
      } else {
        // Has history — measure how much above their own average
        const spikeRatio = spikeCommits1d / spikeDailyBaseline;
        if      (spikeRatio >= 10) devSpikeBonus = 12;
        else if (spikeRatio >= 5)  devSpikeBonus = 9;
        else if (spikeRatio >= 3)  devSpikeBonus = 6;
        else if (spikeRatio >= 2)  devSpikeBonus = 3;
      }

      // AI quality multiplier — groundbreaking work amplifies the spike signal
      // "Shipped new inference engine" is a bigger gap than "fixed typos"
      if (spikeAiQuality !== undefined) {
        if      (spikeAiQuality >= 90) devSpikeBonus = Math.min(15, Math.round(devSpikeBonus * 1.5));
        else if (spikeAiQuality >= 75) devSpikeBonus = Math.min(15, Math.round(devSpikeBonus * 1.25));
        else if (spikeAiQuality < 30)  devSpikeBonus = Math.round(devSpikeBonus * 0.4); // noise commits, penalize
      }
    }

    // 2. PRICE LAG / FLOW (0-20 pts) — multi-timeframe gap detection
    // No longer gated by devScore — flow is an independent signal.
    // Mature subnets with great price setups deserve full flow points regardless of commit pace.
    let priceLag = 0;
    const pch24h = d.priceChange24h || 0;
    const pch7d = d.priceChange1w || 0;
    const pch30d = d.priceChange1m || 0;

    // 30D price lag (0-8 pts) — long-term underperformance = biggest gap
    if (pch30d <= -40) priceLag += 8;
    else if (pch30d <= -25) priceLag += 7;
    else if (pch30d <= -15) priceLag += 5;
    else if (pch30d <= -5) priceLag += 3;
    else if (pch30d <= 5) priceLag += 1;
    else if (pch30d >= 50) priceLag -= 4;   // mooned = gap gone
    else if (pch30d >= 20) priceLag -= 2;

    // 7D price lag (0-7 pts)
    if (pch7d <= -25) priceLag += 7;
    else if (pch7d <= -15) priceLag += 5;
    else if (pch7d <= -8) priceLag += 4;
    else if (pch7d <= -3) priceLag += 2;
    else if (pch7d <= 3) priceLag += 1;
    else if (pch7d >= 20) priceLag -= 2;

    // 24H price lag (0-5 pts)
    if (pch24h <= -10) priceLag += 5;
    else if (pch24h <= -5) priceLag += 4;
    else if (pch24h <= 0) priceLag += 2;
    else if (pch24h <= 3) priceLag += 1;
    else if (pch24h >= 10) priceLag -= 2;

    // REVERSAL BONUS (0-5 pts) — THE MAGIC
    // Down long-term but turning up short-term = price is waking up
    if (pch30d <= -20 && pch24h >= 3) priceLag += 5;       // Down 20%+ monthly, up 3%+ today!
    else if (pch30d <= -15 && pch24h >= 1) priceLag += 4;
    else if (pch7d <= -15 && pch24h >= 2) priceLag += 3;   // Down 15%+ weekly, turning today
    else if (pch7d <= -10 && pch24h >= 0) priceLag += 2;   // Down weekly, stabilizing

    priceLag = Math.min(20, Math.max(-8, priceLag));

    // SUSTAINED DECLINE DISCOUNT — the market may just be right
    // If price is falling across ALL timeframes with zero reversal signal, this is no
    // longer a "gap" — it's a trend. The algo would otherwise reward chronic bleeders
    // every scan because each day's decline re-earns priceLag points.
    // The reversal bonus (above) already rewards when momentum turns; this is the
    // missing counterpart: penalise when it never does.
    const sustainedDecline     = pch30d <= -20 && pch7d <= -10 && pch24h <= 0;
    const deepSustainedDecline = pch30d <= -35 && pch7d <= -20 && pch24h <= -3;
    if (deepSustainedDecline) {
      priceLag = Math.max(-8, priceLag - 12);  // accelerating bleed — steep cut
    } else if (sustainedDecline) {
      priceLag = Math.max(-8, priceLag - 8);   // consistent bleed — meaningful cut
    }

    // PRICE FLOOR REVERSAL — bounced hard off recent low (bottom reversal pattern)
    let floorReversalBonus = 0;
    if (d.sparklinePrices.length >= 10) {
      const recentPrices = d.sparklinePrices.slice(-14);
      const floorPrice = Math.min(...recentPrices);
      const currentPrice = recentPrices[recentPrices.length - 1];
      if (floorPrice > 0 && currentPrice > 0) {
        const bounceRatio = currentPrice / floorPrice;
        if (bounceRatio >= 2.0) floorReversalBonus = 10;
        else if (bounceRatio >= 1.6) floorReversalBonus = 7;
        else if (bounceRatio >= 1.4) floorReversalBonus = 5;
        else if (bounceRatio >= 1.25) floorReversalBonus = 3;
      }
    }

    // 3. SOCIAL MOMENTUM (0-18 pts) — are we catching an early social trend?
    // High social score = fresh KOL cluster or discord alpha = open alpha window
    // Bumped ceiling to 18 to reward early viral events (4+ KOLs, discord alpha spikes)
    let socialMomentum = 0;
    if (socialScore >= 80) socialMomentum = 16;
    else if (socialScore >= 60) socialMomentum = 11;
    else if (socialScore >= 40) socialMomentum = 8;
    else if (socialScore >= 20) socialMomentum = 3;

    // 4. EMISSION VALUE GAP (0-12 pts) — network paying more than market realizes
    // Reduced from 22 → 12 max: high eval for well-known subnets is already priced in.
    // The REAL gap signal is high eval + LOW price (see evalVsPriceBonus below).
    let evalBoost = 0;
    if (evalScore >= 80) evalBoost = 12;
    else if (evalScore >= 60) evalBoost = 9;
    else if (evalScore >= 45) evalBoost = 6;
    else if (evalScore >= 30) evalBoost = 4;
    else if (evalScore >= 15) evalBoost = 2;
    // Net inflow = money flowing in alongside good eval = stronger signal
    if (d.netFlow24h && d.netFlow24h > 0) evalBoost = Math.min(12, evalBoost + 2);

    // EVAL VS PRICE BONUS (0-6 pts) — THE REAL EVAL GAP SIGNAL
    // High validator quality score + price still underwater = market hasn't caught up to
    // what validators already know. This is the pure "informed money vs. dumb money" gap.
    let evalVsPriceBonus = 0;
    if      (evalScore >= 65 && pch30d <= -20) evalVsPriceBonus = 6;
    else if (evalScore >= 55 && pch30d <= -15) evalVsPriceBonus = 5;
    else if (evalScore >= 50 && pch30d <= -10) evalVsPriceBonus = 4;
    else if (evalScore >= 45 && pch7d  <= -10) evalVsPriceBonus = 3;
    else if (evalScore >= 40 && pch7d  <= -5)  evalVsPriceBonus = 2;
    // Halve eval-vs-price bonus under sustained decline: if the market has been
    // consistently disagreeing with validators for weeks, the "informed money" thesis
    // gets weaker — maybe validators are wrong, or their conviction is fading.
    if (sustainedDecline) evalVsPriceBonus = Math.floor(evalVsPriceBonus / 2);

    // 5. MARKET CAP VIABILITY — too small = uninvestable / too illiquid to act on
    // Subnets under $1M are hard to enter/exit without moving the price significantly.
    // Penalties are steep below $1M. No bonus for large caps — they have the LEAST upside.
    const mcap = d.marketCapUsd || 0;
    let viability = 0;
    if (mcap < 50000) viability = -40;         // ghost subnet — no real market
    else if (mcap < 100000) viability = -30;   // effectively uninvestable
    else if (mcap < 250000) viability = -20;   // extreme illiquidity
    else if (mcap < 500000) viability = -15;   // very illiquid
    else if (mcap < 750000) viability = -10;   // illiquid, high slippage risk
    else if (mcap < 1000000) viability = -7;   // borderline — below $1M threshold
    // Note: no large/mid-cap bonus. Large caps are well-known and have the least gap upside.

    // ALPHA STAKING RATIO — high staked% = thin float = price sensitive to buy pressure
    let stakingBoost = 0;
    if (d.alphaStakedPct >= 75) stakingBoost = 12;
    else if (d.alphaStakedPct >= 65) stakingBoost = 8;
    else if (d.alphaStakedPct >= 55) stakingBoost = 4;

    // ROOT PROPORTION — high root_prop means top validators allocated stake here
    let rootPropBonus = 0;
    if (d.rootProp >= 0.35) rootPropBonus = 8;
    else if (d.rootProp >= 0.25) rootPropBonus = 5;
    else if (d.rootProp >= 0.15) rootPropBonus = 2;

    // 6. STITCH3 CAMPAIGN BOOST (0-8 pts) — small signal that marketing is running
    // Intentionally small: campaigns are paid activity, not organic conviction.
    // Real KOL signal (social score) is the stronger indicator.
    let campaignBoost = 0;
    const campaign = activeCampaigns.find(c => c.netuid === d.netuid);
    if (campaign) {
      const now = new Date();
      const start = new Date(campaign.startDate);
      const end = new Date(campaign.endDate);
      const totalDuration = end.getTime() - start.getTime();
      const elapsed = now.getTime() - start.getTime();

      if (elapsed < 0) {
        campaignBoost = 8;  // Not started yet — slightly elevated
      } else if (elapsed <= totalDuration * 0.5) {
        campaignBoost = 6;  // First half — running
      } else if (elapsed <= totalDuration) {
        campaignBoost = 3;  // Second half — winding down
      }
      // Campaign over = 0 boost
    }

    // 6. EMISSION MOMENTUM (±18 pts) — are validators routing more/less to this subnet?
    // Rising emissions = validators actively choosing this subnet → strong bullish signal
    // Falling emissions = validators leaving → bearish signal
    // This is the most direct "smart money" signal on Bittensor — validators vote with emissions.
    // A 50%+ weekly emission spike is a major signal and deserves a large boost.
    let emissionBoost = 0;
    let emissionChangePct: number | undefined;
    let emissionTrend: "up" | "down" | null = null;
    if (d.emissionPct > 0) {
      const emHistKey = String(d.netuid);
      const emHist = emissionHistory[emHistKey];
      if (emHist && emHist.length > 0) {
        // GUARDS before computing emission change:
        // 1. Require at least 3 readings (prevent first-run noise)
        // 2. Require baseline to be at least 4 hours old (prevents comparing to a reading
        //    from 5 minutes ago, which could show huge swings from data source variance)
        // 3. Cap displayed change at ±500% (blocks data-corruption outliers like +1266%)
        const MIN_READINGS = 3;
        const MIN_BASELINE_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

        if (emHist.length >= MIN_READINGS) {
          // Prefer a reading from ~7 days ago; fall back to oldest reading
          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          const candidate = emHist.find(h => new Date(h.timestamp).getTime() <= sevenDaysAgo)
            || emHist[0]; // oldest available

          const baselineAgeMs = Date.now() - new Date(candidate.timestamp).getTime();
          const baselineIsOldEnough = baselineAgeMs >= MIN_BASELINE_AGE_MS;

          if (candidate.pct > 0 && baselineIsOldEnough) {
            const currentPct = d.emissionPct;
            const rawChange = ((currentPct - candidate.pct) / candidate.pct) * 100;

            // Sanity cap: if the change is implausibly large (>500%), it almost certainly
            // reflects a data-source inconsistency in early history, not a real signal.
            // Log it but don't score it.
            if (Math.abs(rawChange) > 500) {
              console.warn(`[scan] Emission outlier SN${d.netuid}: ${rawChange.toFixed(0)}% (baseline=${candidate.pct}, current=${currentPct}, age=${Math.round(baselineAgeMs / 3600000)}h) — skipping`);
            } else {
              const changePct = rawChange;
              emissionChangePct = Math.round(changePct * 10) / 10;
              if (changePct >= 5) emissionTrend = "up";
              else if (changePct <= -5) emissionTrend = "down";

              // Boost: up to +20 for surging emissions (was +34 — reduced; emission spikes
              // attract mercenary capital that already found the subnet, not undiscovered alpha)
              if      (changePct >= 300) emissionBoost = 20;
              else if (changePct >= 200) emissionBoost = 17;
              else if (changePct >= 100) emissionBoost = 14;
              else if (changePct >= 50)  emissionBoost = 12;
              else if (changePct >= 30)  emissionBoost = 9;
              else if (changePct >= 20)  emissionBoost = 7;
              else if (changePct >= 10)  emissionBoost = 4;
              else if (changePct >= 5)   emissionBoost = 2;
              else if (changePct >= 0)   emissionBoost = 1;
              else if (changePct <= -50) emissionBoost = -16;
              else if (changePct <= -30) emissionBoost = -12;
              else if (changePct <= -20) emissionBoost = -8;
              else if (changePct <= -10) emissionBoost = -5;
              else if (changePct <= -5)  emissionBoost = -2;
            }
          }
        }
      }
    }

    // 7. WHALE DETECTION — pool buy/sell ratio + SubnetRadar real-time staking moves
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
            if (devScore >= 40) whaleBoost = 16;  // whales + dev = strong conviction
            else whaleBoost = 10;                  // whales alone = solid signal
          } else if (whaleRatio <= 0.5) {
            whaleSignal = "distributing";
            whaleBoost = -7; // whales selling = caution
          }
        }
      }
    }
    // Supplement with SubnetRadar real-time large stake/unstake events (last ~30 min)
    // This catches staking conviction not visible in the DEX pool buy/sell data
    const srWhaleNet = d.srWhaleNetTao;
    if (srWhaleNet >= 500) {
      // Strong net staking-in: override to accumulating if not already distributing
      if (whaleSignal !== "distributing") {
        whaleSignal = "accumulating";
        whaleBoost = Math.min(20, whaleBoost + 8);
      }
    } else if (srWhaleNet >= 200) {
      if (whaleSignal !== "distributing") {
        whaleSignal = "accumulating";
        whaleBoost = Math.min(20, whaleBoost + 4);
      }
    } else if (srWhaleNet <= -500) {
      // Heavy unstaking: flag as distributing regardless of pool signal
      whaleSignal = "distributing";
      whaleBoost = Math.max(-12, whaleBoost - 6);
    } else if (srWhaleNet <= -200) {
      if (whaleSignal !== "accumulating") {
        whaleSignal = "distributing";
        whaleBoost = Math.max(-12, whaleBoost - 3);
      }
    }

    // Volume surge — buying pressure is real but lagging (someone already found it).
    // Reduced ceiling from 18 → 10 pts: by the time you see 10x volume, the gap is closing.
    const surgeRatioForAGap = volumeSurgeMap.get(d.netuid) || 0;
    let volBoost = 0;
    if (surgeRatioForAGap >= 10) volBoost = 15;
    else if (surgeRatioForAGap >= 7)  volBoost = 12;
    else if (surgeRatioForAGap >= 5)  volBoost = 9;
    else if (surgeRatioForAGap >= 3.5) volBoost = 6;
    else if (surgeRatioForAGap >= 2.5) volBoost = 3;

    // ── MOMENTUM CONFIRMATION (±5 pts) ──────────────────────────────────────
    // Only rewards EARLY movement (5–10%). Large moves mean the gap is already closing —
    // those are handled by gapClosurePenalty below, not rewarded here.
    let momentumBoost = 0;

    // 7D uptrend: only reward early signs. 20%+ means the gap is already closing — neutral.
    if      (pch7d >= 5 && pch7d < 10) momentumBoost += 1;  // early signal, small reward
    else if (pch7d <= -25) momentumBoost -= 2;               // sustained downtrend penalty

    // 30D uptrend (secondary) — only reward if not already captured by gap closure
    if      (pch30d >= 40) momentumBoost += 1;  // was 2, reduced since big moves = gap closing
    else if (pch30d >= 15) momentumBoost += 1;

    // Whale confirmation (already covered by whaleBoost, just a tiny add here)
    if      (whaleSignal === "accumulating") momentumBoost += 1;
    else if (whaleSignal === "distributing") momentumBoost -= 1;

    momentumBoost = Math.min(5, Math.max(-3, momentumBoost));

    // ── GAP CLOSURE PENALTY ──────────────────────────────────────────────────
    // When price has already moved significantly UP on multiple timeframes, the market
    // is actively pricing in the thesis — the gap is CLOSING, not open.
    // Two timeframes confirming together is stronger signal than either alone.
    let gapClosurePenalty = 0;
    if      (pch7d >= 20 && pch24h >= 5)  gapClosurePenalty = -15; // gap closing fast on both TFs
    else if (pch7d >= 15 && pch24h >= 3)  gapClosurePenalty = -10;
    else if (pch7d >= 10 && pch24h >= 5)  gapClosurePenalty = -8;  // shorter window, same pattern
    else if (pch7d >= 20)                 gapClosurePenalty = -8;  // 7d run, today flat — still closed
    else if (pch7d >= 10)                 gapClosurePenalty = -4;  // mild 7d run

    // ── PRODUCT / UTILITY SCORE (0–100 scale) ────────────────────────────────
    // Priority: benchmark (0–100) > website scan (0–80) > milestone (0–80) > heuristic (0–60)
    // AGap contribution: productScore * 0.20 → 0–20 pts, plus two gap cross-signals
    const hasActiveCampaignForUtil = activeCampaigns.some(c => c.netuid === d.netuid);
    const websiteSignals = websiteProductMap.get(d.netuid);
    const {
      score: productScore,
      estimated: utilityEstimated,
      source: productSource,
    } = computeProductScore(
      d.netuid,
      {
        emissionPct: d.emissionPct,
        evalScore,
        devScore,
        marketCapUsd: mcap,
        alphaStakedPct: d.alphaStakedPct,
        hasActiveCampaign: hasActiveCampaignForUtil,
      },
      websiteSignals,
    );

    // ── PRODUCT SIGNALS (3 components, max ~40 pts combined) ────────────────
    // Product is the CORE alpha thesis — real utility the market hasn't priced in yet.
    // Three separate signals stack to reward the specific case of:
    //   "amazing product + nobody knows about it + price still underwater"

    // 1. Base product contribution (0–25 pts)
    //    productScore 0–100 × 0.25. Formally benchmarked hits 25, milestone hits ~20–23.
    //    Reduced from 0.35 to balance against Flow (whale/volume) signals.
    const productAGapPts = productScore * 0.25;

    // 2. Product awareness gap (0–12 pts) — THE CORE ALPHA THESIS
    //    High product score + low social = market genuinely hasn't noticed yet.
    //    Chutes/Targon (high product + high social) score 0 here — gap is already closed.
    //    Leadpoet (high product + B2B/low CT presence) scores full 12 pts.
    //
    //    Revenue confidence scale: a subnet with $10M ARR that nobody's talking about is a TRUE gap.
    //    A subnet with $100K ARR and low social may just be early-stage — market is accurately cautious.
    //    Scale both awareness and price bonuses proportionally so low-revenue subnets can't hit 100.
    const confirmedArrForAwareness = BENCHMARK_MAP.get(d.netuid)?.annual_revenue_usd ?? 0;
    const awarenessRevScale =
      confirmedArrForAwareness >= 5_000_000 ? 1.00  // proven business — full gap signal
      : confirmedArrForAwareness >= 1_000_000 ? 0.85  // strong traction
      : confirmedArrForAwareness >= 500_000   ? 0.72  // solid early revenue
      : confirmedArrForAwareness >= 100_000   ? 0.45  // real but early — gap is smaller
      : confirmedArrForAwareness >  0         ? 0.35  // pilot / minimal revenue
      : 0.85;                                          // pre-revenue: pure product thesis, still strong

    let productAwarenessGap = 0;
    if      (productScore >= 60 && socialScore <= 30) productAwarenessGap = Math.round(12 * awarenessRevScale);
    else if (productScore >= 60 && socialScore <= 50) productAwarenessGap = Math.round(6  * awarenessRevScale);
    else if (productScore >= 80 && socialScore <= 60) productAwarenessGap = Math.round(4  * awarenessRevScale);

    // 3. Product vs price gap (0–8 pts) — mirrors evalVsPriceBonus but for product signal
    //    High product + price underwater = market pricing the asset as if the product doesn't exist.
    //    Uses raw pch30d/pch7d (not clamped priceLag) so thresholds are always reachable.
    //    Also revenue-scaled: a price-down signal on $100K ARR deserves less weight than $5M ARR.
    let productVsPriceBonus = 0;
    if      (productScore >= 70 && pch30d <= -20) productVsPriceBonus = Math.round(8 * awarenessRevScale);
    else if (productScore >= 70 && pch30d <= -10) productVsPriceBonus = Math.round(4 * awarenessRevScale);
    else if (productScore >= 70 && pch7d  <= -10) productVsPriceBonus = Math.round(4 * awarenessRevScale);
    else if (productScore >= 50 && pch30d <= -25) productVsPriceBonus = Math.round(3 * awarenessRevScale);

    const rawAGap = buildingPts + consistentBuilderBonus + devSpikeBonus + priceLag + floorReversalBonus + socialMomentum + evalBoost + evalVsPriceBonus + viability + campaignBoost + whaleBoost + emissionBoost + volBoost + stakingBoost + rootPropBonus + productAGapPts + productAwarenessGap + productVsPriceBonus + momentumBoost + gapClosurePenalty;

    // SUSTAINED DECLINE CEILING — hard cap on the final score for chronic bleeders.
    // Reducing individual components (priceLag, evalVsPriceBonus) wasn't enough because
    // other strong pillars (dev, emissions, staking) can still push the score above 80.
    // If price is falling across ALL timeframes with no reversal anywhere, the market
    // has spoken consistently — cap the score so it can't trigger auto-buy signals.
    //
    // POST-PUMP FADE: pch30d can be misleadingly high after a pump even as price bleeds.
    // Catch this separately using short-term timeframes only.
    const postPumpFade = pch30d >= 50 && pch7d <= -15 && pch24h <= -3;  // pumped, now fading hard
    const sustainedDeclineCap = deepSustainedDecline ? 65
      : (sustainedDecline || postPumpFade) ? 72
      : 100;
    const clampedRaw = Math.max(1, Math.min(sustainedDeclineCap, Math.round(rawAGap)));
    const aGap = smoothAGap(d.netuid, clampedRaw);

    // ── INVESTING aGap (PILLAR-CAPPED + REVENUE-ANCHORED formula, v18) ──────────
    // Monthly horizon. Tighter pillar caps + revenue floors to prevent on-chain
    // noise (eval/emissions/whales) from burying real product subnets.
    //
    // Architecture: 4 pillars + RevTraction + MktVal + Synergy + Revenue Floor
    //   Dev(22) + Product(28) + Network(10) + Money(8) + RevTraction(20) + MktVal(5) + Synergy(4)
    //   Max theoretical = 97.
    //
    // Revenue floors: confirmed ARR guarantees a minimum score so network penalties
    // can't bury a subnet that's generating real fiat revenue.

    // ── NETWORK HEALTH (used by Pillar 3) ────────────────────────────────────
    let investNetworkHealth = 0;
    const iVals = d.validatorCount;
    if      (iVals >= 64) investNetworkHealth += 8;
    else if (iVals >= 48) investNetworkHealth += 5;
    else if (iVals >= 32) investNetworkHealth += 3;
    else if (iVals >= 16) investNetworkHealth += 1;
    const iBurnPct = d.minerBurnPct;
    if      (iBurnPct >= 80) investNetworkHealth -= 10;
    else if (iBurnPct >= 60) investNetworkHealth -=  6;
    else if (iBurnPct >= 40) investNetworkHealth -=  2;
    else if (iBurnPct <= 10 && iVals >= 16) investNetworkHealth += 3;

    // ── PRE-LAUNCH STEALTH (used by Pillar 2) ────────────────────────────────
    let investPreLaunch = 0;
    const hasWebPresence = productSource === "website" || productSource === "heuristic";
    if      (hasWebPresence && devScore >= 55 && socialScore <= 20 && productScore >= 35) investPreLaunch = 18;
    else if (hasWebPresence && devScore >= 45 && socialScore <= 30 && productScore >= 30) investPreLaunch = 12;
    else if (devScore >= 65 && socialScore <= 15) investPreLaunch = 8;

    // ── REVENUE TRACTION BONUS (0–20 pts) ────────────────────────────────────
    // THE core investing differentiator — completely absent from trading formula.
    const benchEntry  = BENCHMARK_MAP.get(d.netuid);
    const milestEntry = MILESTONE_MAP.get(d.netuid);
    const confirmedArr = benchEntry?.annual_revenue_usd ?? 0;
    const estimatedArr = confirmedArr > 0 ? confirmedArr : (milestEntry?.estimated_arr_usd ?? 0);
    const arrIsEstimated = confirmedArr === 0 && estimatedArr > 0;
    let revTractionBonus = 0;
    if      (estimatedArr >= 10_000_000) revTractionBonus = arrIsEstimated ? 17 : 20;
    else if (estimatedArr >=  2_000_000) revTractionBonus = arrIsEstimated ? 13 : 15;
    else if (estimatedArr >=  1_000_000) revTractionBonus = arrIsEstimated ?  8 : 10;
    else if (estimatedArr >=    500_000) revTractionBonus = arrIsEstimated ?  5 :  7;
    else if (estimatedArr >=    100_000) revTractionBonus = arrIsEstimated ?  3 :  4;
    else if (estimatedArr >           0) revTractionBonus = arrIsEstimated ?  1 :  2;

    // ── MARKET VALIDATION BONUS (0–5 pts) ────────────────────────────────────
    // Formally benchmarked AND generating revenue = proven PMF.
    let marketValidationBonus = 0;
    if      (productSource === "benchmark" && confirmedArr >= 1_000_000) marketValidationBonus = 5;
    else if (productSource === "benchmark" && confirmedArr >=   100_000) marketValidationBonus = 3;
    else if (productSource === "benchmark" && confirmedArr >          0) marketValidationBonus = 2;
    else if (productSource === "benchmark")                              marketValidationBonus = 1;

    // ── PILLAR 1: DEV (max 22) ────────────────────────────────────────────────
    const rawDevPillar = (buildingPts * 1.0) + (consistentBuilderBonus * 2.2) + (devSpikeBonus * 0.10);
    const pillarDev = Math.min(22, Math.round(rawDevPillar));

    // ── PILLAR 2: PRODUCT (max 28) ────────────────────────────────────────────
    const iProductSourceMult = productSource === "benchmark" ? 1.5 :
                               productSource === "website"   ? 1.3 :
                               productSource === "milestone" ? 1.1 :
                                                               0.9;
    const rawProductPillar = (productAGapPts * iProductSourceMult)
                           + (productAwarenessGap * 2.0)
                           + (productVsPriceBonus  * 2.0)
                           + (investPreLaunch       * 0.9);
    const pillarProduct = Math.min(28, Math.round(rawProductPillar));

    // ── PILLAR 3: NETWORK (max 10) ────────────────────────────────────────────
    // Eval/emissions are weekly signals. A subnet can be a great long-term
    // investment with moderate on-chain metrics. Cap is intentionally tight.
    const rawNetworkPillar = (evalBoost            * 0.45)
                           + (evalVsPriceBonus      * 1.0)
                           + (Math.max(0, emissionBoost) * 0.28)
                           + (stakingBoost          * 0.5)
                           + (rootPropBonus         * 0.6)
                           + Math.max(0, investNetworkHealth);
    const pillarNetwork = Math.min(10, Math.round(rawNetworkPillar));

    // ── PILLAR 4: SMART MONEY (max 8) ────────────────────────────────────────
    const rawMoneyPillar = (Math.max(0, whaleBoost) * 0.6) + (Math.max(0, volBoost) * 0.02);
    const pillarMoney = Math.min(8, Math.round(rawMoneyPillar));

    // ── CROSS-PILLAR SYNERGY (max 4) ─────────────────────────────────────────
    let investSynergy = 0;
    if      (pillarDev >= 14 && pillarProduct >= 20) investSynergy = 4;
    else if (pillarDev >=  8 && pillarProduct >= 14) investSynergy = 2;

    // ── PENALTIES (reduced severity — on-chain noise shouldn't bury real products) ──
    const emissionPenalty      = Math.round(Math.min(0, emissionBoost) * 0.45);
    const networkHealthPenalty = Math.round(Math.min(0, investNetworkHealth) * 0.5);
    const whalePenalty         = Math.round(Math.min(0, whaleBoost) * 0.7);
    const investDeregPenalty   = d.deregRisk ? -12 : 0;

    const rawInvestAGap = pillarDev + pillarProduct + pillarNetwork + pillarMoney
                        + revTractionBonus + marketValidationBonus + investSynergy
                        + emissionPenalty + networkHealthPenalty + whalePenalty
                        + viability + investDeregPenalty;

    const clampedInvestAGap = Math.max(1, Math.min(100, Math.round(rawInvestAGap)));

    // ── REVENUE FLOOR ────────────────────────────────────────────────────────
    // A subnet generating real fiat revenue can't be buried below a minimum by
    // bad on-chain signals on a given day. The floor is what matters for a monthly
    // thesis — not whether emissions ticked down this week.
    // Confirmed ARR (BENCHMARK_DATA) gets a +4 floor bonus vs milestone estimates.
    const isBenchmarked = productSource === "benchmark";
    const floorBenchBonus = isBenchmarked ? 4 : 0;
    let investRevFloor = 0;
    if      (confirmedArr >= 10_000_000) investRevFloor = 80 + floorBenchBonus;
    else if (confirmedArr >=  2_000_000) investRevFloor = 72 + floorBenchBonus;
    else if (confirmedArr >=  1_000_000) investRevFloor = 65 + floorBenchBonus;
    else if (confirmedArr >=    500_000) investRevFloor = 58 + floorBenchBonus;
    else if (confirmedArr >=    100_000) investRevFloor = 52 + floorBenchBonus;
    else if (confirmedArr >           0) investRevFloor = 44 + floorBenchBonus;
    // Estimated ARR (milestone, lower confidence): smaller floors, no bench bonus
    else if (estimatedArr >=  2_000_000) investRevFloor = 62;
    else if (estimatedArr >=  1_000_000) investRevFloor = 56;
    else if (estimatedArr >=    500_000) investRevFloor = 50;
    else if (estimatedArr >=    100_000) investRevFloor = 42;
    else if (estimatedArr >           0) investRevFloor = 36;

    const investAGap = Math.max(investRevFloor, clampedInvestAGap);

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
      miner_burn_pct: d.minerBurnPct > 0 ? d.minerBurnPct : undefined,
      tao_locked: d.taoLocked > 0 ? Math.round(d.taoLocked) : undefined,
      dereg_risk: d.deregRisk || undefined,
      fear_greed: d.fearGreedIndex !== 50 ? d.fearGreedIndex : undefined,
      category: d.category || undefined,
      sparkline_prices: d.sparklinePrices.length > 0 ? d.sparklinePrices : undefined,
      volume_surge: surgeRatioForAGap >= 2.5 ? true : undefined,
      volume_surge_ratio: surgeRatioForAGap >= 2.5 ? Math.round(surgeRatioForAGap * 10) / 10 : undefined,
      alpha_staked_pct: d.alphaStakedPct > 0 ? d.alphaStakedPct : undefined,
      product_score: productScore > 0 ? productScore : undefined,
      utility_estimated: utilityEstimated && productScore > 0 ? true : undefined,
      product_source: productScore > 0 ? productSource : undefined,
      benchmark_score: BENCHMARK_MAP.get(d.netuid)?.benchmark_score,
      benchmark_category: BENCHMARK_MAP.get(d.netuid)?.benchmark_category,
      cost_saving_pct: BENCHMARK_MAP.get(d.netuid)?.cost_saving_pct,
      vs_provider: BENCHMARK_MAP.get(d.netuid)?.vs_provider,
      benchmark_summary: BENCHMARK_MAP.get(d.netuid)?.benchmark_summary,
      annual_revenue_usd: BENCHMARK_MAP.get(d.netuid)?.annual_revenue_usd,
      momentum_boost: momentumBoost !== 0 ? momentumBoost : undefined,
      invest_agap: investAGap,
    });
  }

  leaderboard.sort((a, b) => b.composite_score - a.composite_score);

  // ── Sector rotation detection ─────────────────────────────────────────
  const categoryPumps = new Map<string, number>();
  for (const e of leaderboard) {
    if (e.category && (e.price_change_24h ?? 0) >= 5) {
      categoryPumps.set(e.category, (categoryPumps.get(e.category) || 0) + 1);
    }
  }
  const rotatingCategories = new Set([...categoryPumps.entries()]
    .filter(([, count]) => count >= 2)
    .map(([cat]) => cat));
  if (rotatingCategories.size > 0) {
    console.log(`[scan] Sector rotation detected: ${[...rotatingCategories].join(', ')}`);
    for (const entry of leaderboard) {
      if (entry.category && rotatingCategories.has(entry.category)) {
        entry.composite_score = Math.min(100, entry.composite_score + 6);
        entry.sector_rotation = true;
      }
    }
    leaderboard.sort((a, b) => b.composite_score - a.composite_score);
  }

  // ── Tag deregistration risks ─────────────────────────────────────
  // Primary source: TaoMarketCap's deregistration_risk boolean (already fetched).
  // Fallback: SubnetRadar healthScore (bottom-3) if TMC flags nothing.
  // SR API has been unreliable (403s from server-side), so TMC is preferred.
  const tmcDeregNetuids = new Set(
    leaderboard
      .filter(e => tmcMap.get(e.netuid)?.deregistration_risk === true)
      .map(e => e.netuid)
  );

  let deregTop3Netuids: Set<number>;
  if (tmcDeregNetuids.size > 0) {
    // TMC has data — use all flagged subnets (typically 2-5)
    deregTop3Netuids = tmcDeregNetuids;
  } else {
    // TMC unavailable — fall back to SR bottom-3 by healthScore
    const srCandidates = leaderboard
      .map(e => {
        const sr = srSubnetMap.get(e.netuid);
        if (!sr || sr.healthScore === 0) return null;
        return { netuid: e.netuid, health: sr.healthScore };
      })
      .filter((e): e is { netuid: number; health: number } => e !== null)
      .sort((a, b) => a.health - b.health)
      .slice(0, 3);
    deregTop3Netuids = new Set(srCandidates.map(e => e.netuid));
  }

  for (const entry of leaderboard) {
    if (deregTop3Netuids.has(entry.netuid)) entry.dereg_top3 = true;
  }

  // ── Persist per-subnet score history (90-day daily snapshots) ──
  // NOTE: Early price snapshot is saved AFTER this block so agap_velo is included.
  // Written once per scan. Each day's row is upserted so multiple scans
  // per day just overwrite the same date key. Used by /subnets/[netuid].
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { get: getBlob2 } = await import("@vercel/blob");
      type ScoreRow = { agap: number; flow: number; dev: number; eval: number; social: number; price: number; mcap: number; emission_pct: number };
      let scoreHistory: Record<string, Record<string, ScoreRow>> = {};
      try {
        const blob = await getBlob2("subnet-scores-history.json", { token: process.env.BLOB_READ_WRITE_TOKEN, access: "private" });
        if (blob?.stream) {
          const reader = blob.stream.getReader();
          const chunks: Uint8Array[] = [];
          while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
          scoreHistory = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        }
      } catch { /* start fresh */ }

      // ── Compute 24h and 7d aGap score changes ──────────────────────
      // Find the snapshot closest to 24h ago and 7d ago, then diff with current score.
      const now24 = Date.now();
      const target24h = now24 - 24 * 3600 * 1000;
      const target7d  = now24 - 7 * 24 * 3600 * 1000;
      const allTs = Object.keys(scoreHistory).sort(); // ascending ISO strings sort correctly

      // Find the timestamp closest to a target epoch, within the given tolerance (ms)
      function closestSnapshot(targetMs: number, toleranceMs: number): Record<string, ScoreRow> | null {
        if (allTs.length === 0) return null;
        let best = allTs[0];
        let bestDiff = Math.abs(new Date(allTs[0]).getTime() - targetMs);
        for (const ts of allTs) {
          const diff = Math.abs(new Date(ts).getTime() - targetMs);
          if (diff < bestDiff) { best = ts; bestDiff = diff; }
        }
        if (bestDiff > toleranceMs) return null;
        return scoreHistory[best];
      }

      // 24h: accept nearest snapshot within ±12h (handles sparse history during recovery)
      // 7d:  accept nearest snapshot within ±24h
      const snap24h = closestSnapshot(target24h, 12 * 3600 * 1000);
      const snap7d  = closestSnapshot(target7d,  24 * 3600 * 1000);

      for (const entry of leaderboard) {
        const key = String(entry.netuid);
        const cur = entry.composite_score;
        const d24 = (snap24h && snap24h[key] != null) ? cur - snap24h[key].agap : null;
        const d7  = (snap7d  && snap7d[key]  != null) ? cur - snap7d[key].agap  : null;

        if (d24 !== null || d7 !== null) {
          // ── aGap Velo formula ─────────────────────────────────────────────
          // Level significance: moves at high score levels matter far more.
          // score 20 → 0.27×  |  score 50 → 0.58×  |  score 80 → 0.86×
          // This makes 1→20 nearly invisible and 60→80 fire loudly.
          const levelMult = Math.pow(Math.max(0, cur - 10) / 90, 0.6);

          // Velocity: blend 24h speed (recent) + 7d daily average (trend).
          // Falls back gracefully to whichever snapshot is available.
          const dailyAvg7d = d7 !== null ? d7 / 7 : null;
          const velocity = (d24 !== null && dailyAvg7d !== null)
            ? d24 * 0.6 + dailyAvg7d * 0.4
            : (d24 !== null ? d24 : dailyAvg7d!);

          // Scale factor: aGap scores are 0-100 so raw deltas are small.
          // Calibrated so a sustained +15pt/7d move at score 70 → ~80 Velo.
          // Flat = 35. Strong up (+2 pts/day at high level) = 80+.
          const veloBase = 35 + velocity * levelMult * 25;

          // Acceleration bonus (±10 pts): rewards subnets moving faster
          // than their own recent trend — early momentum signal.
          const accelBonus = (d24 !== null && dailyAvg7d !== null)
            ? Math.tanh((d24 - dailyAvg7d) / 8) * 10
            : 0;

          const velo = Math.max(0, Math.min(100, Math.round(veloBase + accelBonus)));
          entry.agap_velo = velo;
        }
      }

      // Use full ISO timestamp so every scan writes its own entry (enables intraday charts)
      const scanTs = new Date().toISOString(); // e.g. "2024-01-15T14:30:00.000Z"
      scoreHistory[scanTs] = {};
      for (const entry of leaderboard) {
        scoreHistory[scanTs][String(entry.netuid)] = {
          agap: entry.composite_score,
          flow: entry.flow_score,
          dev: entry.dev_score,
          eval: entry.eval_score || 0,
          social: entry.social_score || 0,
          price: entry.alpha_price || 0,
          mcap: entry.market_cap || 0,
          emission_pct: entry.emission_pct || 0,
        };
      }

      // Trim to last 90 days (keep all intraday entries within that window)
      const cutoff90 = new Date(Date.now() - 90 * 86400000).toISOString();
      for (const d of Object.keys(scoreHistory)) { if (d < cutoff90) delete scoreHistory[d]; }

      await put("subnet-scores-history.json", JSON.stringify(scoreHistory), { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
      console.log(`[scan] Subnet score history: ${Object.keys(scoreHistory).length} snapshots stored`);
    } catch (e) { console.error("[scan] Subnet history save failed:", e); }
  }

  // ── Early snapshot save ─────────────────────────────────────────
  // Saved AFTER velo computation so agap_velo is included in the price snapshot.
  // This ensures the fallback path in cached-scan always has velo data.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await put("scan-prices.json", JSON.stringify({
        leaderboard,
        signals: [], // populated in final save
        lastScan: new Date().toISOString(),
        counts: { subnets: leaderboard.length, signals: 0 },
        scanDuration: `${Math.round((Date.now() - startTime) / 1000)}s (prices only)`,
        partial: true,
      }), { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
      console.log("[scan] Early price snapshot saved to scan-prices.json");
    } catch (e) { console.error("[scan] Failed early save:", e); }
  }

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
        allowOverwrite: true,
        contentType: "application/json",
      });
    }
  } catch (e) {
    console.error("[scan] Failed to save emission history:", e);
  }

  // ── Append current buy volumes to history ─────────────────────────
  // Mirror of the emission history loop above — was missing, which meant
  // hist.length was always 0 and no volume surges were ever detected.
  // Throttle to ~1 reading per hour so history stays compact.
  const nowVol = new Date().toISOString();
  for (const pool of pools) {
    const key = String(pool.netuid);
    const currentVol = parseFloat(pool.tao_buy_volume_24_hr || "0") / RAO;
    if (currentVol <= 0) continue; // skip subnets with no buy activity

    if (!volumeHistory[key]) volumeHistory[key] = [];
    const hist = volumeHistory[key];

    // Throttle: only append if last reading was >45 minutes ago
    const lastEntry = hist[hist.length - 1];
    const minutesSinceLast = lastEntry
      ? (Date.now() - new Date(lastEntry.ts).getTime()) / 60000
      : Infinity;

    if (minutesSinceLast >= 45) {
      hist.push({ vol: currentVol, ts: nowVol });
      // Keep 5 days of roughly-hourly readings (~120 entries per subnet)
      if (hist.length > 120) volumeHistory[key] = hist.slice(-120);
    }
  }

  // Save updated volume history
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      await put("volume-history.json", JSON.stringify(volumeHistory), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      console.log(`[scan] Volume history saved. ${volumeSurgeMap.size} subnets with surge data. ${Object.keys(volumeHistory).length} subnets tracked.`);
    }
  } catch (e) {
    console.error("[scan] Failed to save volume history:", e);
  }

  const duration = Date.now() - startTime;
  console.log(`[scan] Complete in ${duration}ms. ${leaderboard.length} subnets, ${mergedSignals.length} signals (${signals.length} new this scan).`);

  // Trigger pump lab auto-detect in background (fire-and-forget, never blocks scan response)
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
  fetch(`${baseUrl}/api/testing/auto-detect`, { signal: AbortSignal.timeout(15000) })
    .then(r => r.json())
    .then(d => { if (d.added?.length) console.log(`[scan] Pump lab auto-added: ${d.added.map((e: {name:string}) => e.name).join(", ")}`); })
    .catch(() => { /* non-critical */ });

  // Bump this when leaderboard schema changes (forces dashboard to rescan instead of using stale blob)
  const SCAN_SCHEMA_VERSION = 20; // v20: revenue-scaled awareness/price gap bonuses — low ARR subnets capped below 100

  const responseData = {
    schema_version: SCAN_SCHEMA_VERSION,
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

      // Save aGap history for EMA smoothing — include version so stale history gets reset
      agapHistory.__version = AGAP_HISTORY_VERSION;
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

      // Update peak price per position (used for Max P&L calculation)
      for (const pos of portfolio.positions) {
        const liveEntry = leaderboard.find(e => e.netuid === pos.netuid);
        const currentPrice = liveEntry?.alpha_price ?? pos.buyPriceUsd;
        if (!pos.peakPrice || currentPrice > pos.peakPrice) {
          pos.peakPrice = currentPrice;
          portfolioChanged = true;
        }
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
        // Re-read blob right before writing to merge any peak prices set
        // by the PATCH endpoint since we first loaded (prevents race condition
        // where scan overwrites a manually-patched higher peak price).
        const freshPortfolio = await loadPortfolio();
        for (const pos of portfolio.positions) {
          const fresh = freshPortfolio.positions.find(p => p.netuid === pos.netuid);
          if (fresh?.peakPrice && (!pos.peakPrice || fresh.peakPrice > pos.peakPrice)) {
            pos.peakPrice = fresh.peakPrice;
          }
        }
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
