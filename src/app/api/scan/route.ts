import { NextResponse } from "next/server";
import {
  getSubnetIdentities,
  getSubnetPools,
  getTaoFlows,
  getSubnetEmissions,
  getTaoPrice,
  getGithubActivity,
  getValidatorAlphaShares,
  getRegistrationCosts,
  getBurnedAlpha,
  type SubnetIdentity,
  type SubnetPool,
  type GithubActivity,
} from "@/lib/taostats";
import {
  listModelsByAuthor,
  listDatasetsByAuthor,
  listSpacesByAuthor,
} from "@/lib/huggingface";

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
    const res = await fetch(`${DESEARCH_API}/twitter?${params}`, {
      headers: { Authorization: DESEARCH_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    return await res.json();
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
  subnet_name?: string;
}

interface LeaderboardEntry {
  netuid: number;
  name: string;
  composite_score: number;
  flow_score: number;
  dev_score: number;
  hf_score: number;
  staking_score: number;
  revenue_score: number;
  social_score: number;
  signal_count: number;
  top_signal?: string;
  alpha_price?: number;
  market_cap?: number;
  net_flow_24h?: number;
  emission_pct?: number;
  price_change_24h?: number;
}

// ── Main scan handler ─────────────────────────────────────────────
export async function GET() {
  const startTime = Date.now();
  const signals: ScanSignal[] = [];
  let signalId = 1;

  function addSignal(s: Omit<ScanSignal, "id" | "created_at">) {
    signals.push({
      ...s,
      id: signalId++,
      created_at: new Date().toISOString(),
    });
  }

  // ── Step 1: Staggered API calls (avoid TaoStats rate limits) ───
  // Batch 1: Critical data (identities + pools + TAO price)
  console.log("[scan] Batch 1: identities, pools, tao price...");
  const [identitiesResult, poolsResult, taoPriceResult] = await Promise.allSettled([
    getSubnetIdentities(),
    getSubnetPools(),
    getTaoPrice(),
  ]);

  const identities = identitiesResult.status === "fulfilled" ? identitiesResult.value : [];
  const pools = poolsResult.status === "fulfilled" ? poolsResult.value : [];
  const taoPrice = taoPriceResult.status === "fulfilled" ? taoPriceResult.value : 0;

  console.log(`[scan] Batch 1 done: ${identities.length} identities, ${pools.length} pools, TAO=$${taoPrice.toFixed(2)}`);

  // Small delay to avoid rate limits
  await new Promise(r => setTimeout(r, 500));

  // Batch 2: Flows, emissions, dev activity
  console.log("[scan] Batch 2: flows, emissions, dev activity...");
  const [flowsResult, emissionsResult, devActivityResult] = await Promise.allSettled([
    getTaoFlows(),
    getSubnetEmissions(),
    getGithubActivity(),
  ]);

  const flows = flowsResult.status === "fulfilled" ? flowsResult.value : [];
  const emissions = emissionsResult.status === "fulfilled" ? emissionsResult.value : [];
  const devActivity = devActivityResult.status === "fulfilled" ? devActivityResult.value : [];

  await new Promise(r => setTimeout(r, 500));

  // Batch 3: Staking + revenue (lower priority)
  console.log("[scan] Batch 3: staking, reg costs, burned alpha...");
  const [alphaSharesResult, regCostsResult, burnedAlphaResult] = await Promise.allSettled([
    getValidatorAlphaShares(),
    getRegistrationCosts(),
    getBurnedAlpha(),
  ]);

  const alphaShares = alphaSharesResult.status === "fulfilled" ? alphaSharesResult.value : [];
  const regCosts = regCostsResult.status === "fulfilled" ? regCostsResult.value : [];
  const burnedAlpha = burnedAlphaResult.status === "fulfilled" ? burnedAlphaResult.value : [];

  const elapsed1 = Date.now() - startTime;
  console.log(`[scan] TaoStats APIs done in ${elapsed1}ms. Identities: ${identities.length}, Pools: ${pools.length}, DevActivity: ${devActivity.length}`);

  // ── Step 2: Build lookup maps ───────────────────────────────────
  const identityMap = new Map<number, SubnetIdentity>(identities.map((i) => [i.netuid, i]));
  const poolMap = new Map<number, SubnetPool>(pools.map((p) => [p.netuid, p]));
  const flowMap = new Map<number, number>(flows.map((f) => [f.netuid, f.tao_flow / RAO]));
  const emissionMap = new Map<number, number>(
    emissions.map((e) => [e.netuid, parseFloat(e.alpha_rewards) / RAO])
  );
  const devMap = new Map<number, GithubActivity>(devActivity.map((d) => [d.netuid, d]));

  // Alpha shares -> staking data per subnet
  const stakingMap = new Map<number, { totalAlpha: number; validatorCount: number; topShare: number }>();
  {
    const bySubnet = new Map<number, number[]>();
    for (const s of alphaShares) {
      if (!s.netuid || s.netuid === 0) continue;
      const alpha = parseFloat(s.alpha) / RAO;
      if (!bySubnet.has(s.netuid)) bySubnet.set(s.netuid, []);
      bySubnet.get(s.netuid)!.push(alpha);
    }
    for (const [netuid, alphas] of bySubnet) {
      const total = alphas.reduce((a, b) => a + b, 0);
      const topAlpha = Math.max(...alphas);
      stakingMap.set(netuid, {
        totalAlpha: total,
        validatorCount: alphas.length,
        topShare: total > 0 ? topAlpha / total : 0,
      });
    }
  }

  // Reg costs map
  const regCostMap = new Map<number, number>(
    regCosts.map((c) => [c.netuid, parseFloat(c.cost) / RAO])
  );

  // Burned alpha map
  const burnedMap = new Map<number, number>(
    burnedAlpha.filter((b) => parseFloat(b.burned_alpha) > 0).map((b) => [b.netuid, parseFloat(b.burned_alpha) / RAO])
  );

  // Total emission for share calculation
  let totalEmission = 0;
  for (const v of emissionMap.values()) totalEmission += v;

  // ── Step 3: HuggingFace (parallel, top 15 orgs) ────────────────
  const timeLeftForHF = 50000 - (Date.now() - startTime);
  const hfActivityMap = new Map<number, { models: number; datasets: number; spaces: number; downloads: number }>();

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
      });
    }
    console.log(`[scan] HuggingFace done. ${hfActivityMap.size} subnets with HF data.`);
  }

  // ── Step 4: Desearch social (4 bulk searches) ───────────────────
  const timeLeftForSocial = 50000 - (Date.now() - startTime);
  const socialMap = new Map<number, { mentions: number; engagement: number }>();

  if (timeLeftForSocial > 12000 && DESEARCH_KEY) {
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

    const searches = [
      { query: "bittensor subnet", count: 100, sort: "Top" as const },
      { query: "bittensor subnet", count: 100, sort: "Latest" as const },
      { query: "$TAO subnet", count: 50, sort: "Top" as const },
      { query: "bittensor alpha", count: 50, sort: "Latest" as const },
    ];

    // Run searches sequentially to avoid rate limits (each takes ~2-3s)
    const allTweets = new Map<string, DesearchTweet>();
    for (const search of searches) {
      const timeLeft = 50000 - (Date.now() - startTime);
      if (timeLeft < 5000) break;
      const tweets = await fetchTweets(search.query, search.count, search.sort);
      for (const t of tweets) allTweets.set(t.id, t);
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
    console.log(`[scan] Desearch done. ${allTweets.size} tweets matched to ${socialMap.size} subnets.`);
  }

  // ── Step 5: Generate signals from pool data ─────────────────────
  for (const [netuid, pool] of poolMap) {
    if (netuid === 0) continue;
    const name = identityMap.get(netuid)?.subnet_name || `SN${netuid}`;
    const priceChange = pool.price_change_1_day ? parseFloat(pool.price_change_1_day) : 0;
    const priceChange1w = pool.price_change_1_week ? parseFloat(pool.price_change_1_week) : 0;

    if (Math.abs(priceChange) > 10) {
      const direction = priceChange > 0 ? "surged" : "dropped";
      const strength = Math.round(Math.min(90, 40 + Math.abs(priceChange)));
      addSignal({
        netuid,
        signal_type: priceChange > 0 ? "price_surge" : "price_drop",
        strength,
        title: `Price ${direction} ${priceChange > 0 ? "+" : ""}${priceChange.toFixed(1)}% in 24h`,
        description: `${name} alpha token ${direction} ${Math.abs(priceChange).toFixed(1)}% in the last 24 hours. Weekly change: ${priceChange1w > 0 ? "+" : ""}${priceChange1w.toFixed(1)}%. Buys: ${pool.buys_24_hr}, Sells: ${pool.sells_24_hr}.`,
        source: "taostats",
        subnet_name: name,
      });
    }

    // Volume-based buy/sell pressure
    const buyVol = parseFloat(pool.tao_buy_volume_24_hr || "0") / RAO;
    const sellVol = parseFloat(pool.tao_sell_volume_24_hr || "0") / RAO;
    const totalVol = buyVol + sellVol;
    if (totalVol > 100) {
      const volRatio = buyVol / Math.max(sellVol, 1);
      if (volRatio > 1.5 && priceChange > 0) {
        addSignal({
          netuid,
          signal_type: "buy_pressure",
          strength: Math.round(Math.min(80, 40 + volRatio * 10)),
          title: `Buy pressure: ${buyVol.toFixed(0)}t bought vs ${sellVol.toFixed(0)}t sold`,
          description: `${volRatio.toFixed(1)}x buy/sell volume ratio on ${name}. ${pool.buyers_24_hr} unique buyers, ${pool.sellers_24_hr} sellers. Price ${priceChange > 0 ? "+" : ""}${priceChange.toFixed(1)}%.`,
          source: "taostats",
          subnet_name: name,
        });
      } else if (volRatio < 0.67 && priceChange < 0) {
        addSignal({
          netuid,
          signal_type: "sell_pressure",
          strength: Math.round(Math.min(70, 30 + (1 / volRatio) * 10)),
          title: `Sell pressure: ${sellVol.toFixed(0)}t sold vs ${buyVol.toFixed(0)}t bought`,
          description: `${(1 / volRatio).toFixed(1)}x sell/buy volume ratio on ${name}. ${pool.sellers_24_hr} unique sellers, ${pool.buyers_24_hr} buyers. Price ${priceChange.toFixed(1)}%.`,
          source: "taostats",
          subnet_name: name,
        });
      }
    }
  }

  // Dev activity signals
  for (const act of devActivity) {
    if (act.commits_1d > 5 || act.prs_merged_1d > 1) {
      let repoName = act.repo_url;
      if (repoName.includes("github.com/")) repoName = repoName.split("github.com/")[1];
      repoName = repoName.replace(/^\/|\/$/g, "");
      const name = identityMap.get(act.netuid)?.subnet_name || `SN${act.netuid}`;
      addSignal({
        netuid: act.netuid,
        signal_type: "dev_spike",
        strength: Math.min(90, 30 + act.commits_1d * 2 + act.prs_merged_1d * 10),
        title: `Hot dev activity: ${act.commits_1d} commits, ${act.prs_merged_1d} PRs in 24h`,
        description: `${repoName} — ${act.unique_contributors_1d} active contributors. 7d trend: ${act.commits_7d} commits.`,
        source: "github",
        source_url: act.repo_url,
        subnet_name: name,
      });
    }
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
    alphaPriceUsd: number | null;
    marketCapUsd: number | null;
    volumeUsd: number | null;
    netFlow24h: number | null;
    taoReserve: number | null;
    emissionShare: number;
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
    // Staking
    totalAlphaStaked: number;
    validatorCount: number;
    topValidatorShare: number;
    regCost: number;
    // Revenue extras
    burnedAlpha: number;
    buyVol: number;
    sellVol: number;
    coverageRatio: number;
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
    const staking = stakingMap.get(netuid);
    const social = socialMap.get(netuid);

    const name = identity?.subnet_name || pool?.name || `Subnet ${netuid}`;
    if (name === "Unknown" || name === "") continue;

    const priceChange = pool?.price_change_1_day ? parseFloat(pool.price_change_1_day) : 0;
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

    rawSubnets.push({
      netuid,
      name,
      priceChange24h: priceChange,
      alphaPriceUsd,
      marketCapUsd,
      volumeUsd,
      netFlow24h,
      taoReserve,
      emissionShare,
      ghCommits7d,
      ghPRsMerged7d,
      ghContributors30d,
      ghEvents,
      hfModels: hf?.models || 0,
      hfDatasets: hf?.datasets || 0,
      hfSpaces: hf?.spaces || 0,
      hfDownloads: hf?.downloads || 0,
      totalAlphaStaked: staking?.totalAlpha || 0,
      validatorCount: staking?.validatorCount || 0,
      topValidatorShare: staking?.topShare || 0,
      regCost: regCostMap.get(netuid) || 0,
      burnedAlpha: burnedMap.get(netuid) || 0,
      buyVol,
      sellVol,
      coverageRatio: Math.min(coverageRatio, 10),
      socialMentions: social?.mentions || 0,
      socialEngagement: social?.engagement || 0,
    });
  }

  // ── Compute dev raw scores for percentile ranking ───────────────
  const devRawScores = rawSubnets.map(
    (d) =>
      d.ghPRsMerged7d * 30 +
      d.ghCommits7d * 3 +
      d.ghContributors30d * 15 +
      d.ghEvents * 1 +
      d.hfModels * 25 +
      d.hfDatasets * 15 +
      d.hfSpaces * 10 +
      Math.min(d.hfDownloads / 100, 30)
  );

  // ── Flow score formula ──────────────────────────────────────────
  function computeFlowScore(priceChange24h: number): number {
    if (priceChange24h <= -20) return 1;
    if (priceChange24h >= 10) return 100;
    if (priceChange24h < 0) {
      return Math.round(1 + ((priceChange24h + 20) / 20) * 49);
    }
    return Math.round(50 + (priceChange24h / 10) * 50);
  }

  // ── Staking score formula ───────────────────────────────────────
  function computeStakingScore(d: RawSubnet): number {
    let score = 0;
    const totalStaked = d.totalAlphaStaked;
    if (totalStaked >= 2000000) score += 35;
    else if (totalStaked >= 1500000) score += 30;
    else if (totalStaked >= 1000000) score += 25;
    else if (totalStaked >= 500000) score += 18;
    else if (totalStaked >= 100000) score += 12;
    else if (totalStaked >= 10000) score += 6;
    else if (totalStaked > 0) score += 2;

    const valCount = d.validatorCount;
    if (valCount >= 5) score += 20;
    else if (valCount >= 4) score += 16;
    else if (valCount >= 3) score += 12;
    else if (valCount >= 2) score += 8;
    else if (valCount >= 1) score += 4;

    const topShare = d.topValidatorShare || 1;
    if (topShare <= 0.25) score += 20;
    else if (topShare <= 0.35) score += 16;
    else if (topShare <= 0.45) score += 12;
    else if (topShare <= 0.55) score += 8;
    else if (topShare <= 0.75) score += 4;

    return Math.min(100, score);
  }

  // ── Revenue score formula ───────────────────────────────────────
  function computeRevenueScore(d: RawSubnet): number {
    let score = 0;

    const vol = d.volumeUsd || 0;
    if (vol >= 1000000) score += 30;
    else if (vol >= 500000) score += 25;
    else if (vol >= 100000) score += 20;
    else if (vol >= 50000) score += 15;
    else if (vol >= 10000) score += 10;
    else if (vol >= 1000) score += 5;
    else if (vol > 0) score += 2;

    const taoPool = d.taoReserve || 0;
    if (taoPool >= 100000) score += 25;
    else if (taoPool >= 50000) score += 22;
    else if (taoPool >= 20000) score += 18;
    else if (taoPool >= 10000) score += 14;
    else if (taoPool >= 5000) score += 10;
    else if (taoPool >= 1000) score += 6;
    else if (taoPool > 0) score += 2;

    const coverage = d.coverageRatio;
    if (coverage >= 3) score += 20;
    else if (coverage >= 2) score += 17;
    else if (coverage >= 1.5) score += 14;
    else if (coverage >= 1.1) score += 11;
    else if (coverage >= 0.9) score += 8;
    else if (coverage >= 0.5) score += 4;

    const mcap = d.marketCapUsd || 0;
    if (mcap >= 50000000) score += 15;
    else if (mcap >= 20000000) score += 12;
    else if (mcap >= 5000000) score += 9;
    else if (mcap >= 1000000) score += 6;
    else if (mcap >= 100000) score += 3;

    const burned = d.burnedAlpha;
    if (burned > 100) score += 10;
    else if (burned > 10) score += 7;
    else if (burned > 1) score += 4;
    else if (burned > 0) score += 2;

    return Math.min(100, score);
  }

  // ── Compute social score ────────────────────────────────────────
  function computeSocialScore(mentions: number, engagement: number): number {
    if (mentions <= 0 && engagement <= 0) return 0;
    let mentionPts = 0;
    if (mentions >= 50) mentionPts = 40;
    else if (mentions >= 20) mentionPts = 30;
    else if (mentions >= 10) mentionPts = 22;
    else if (mentions >= 5) mentionPts = 15;
    else if (mentions >= 2) mentionPts = 8;
    else mentionPts = 3;

    let engagePts = 0;
    if (engagement >= 5000) engagePts = 60;
    else if (engagement >= 1000) engagePts = 50;
    else if (engagement >= 500) engagePts = 40;
    else if (engagement >= 100) engagePts = 28;
    else if (engagement >= 30) engagePts = 18;
    else if (engagement >= 10) engagePts = 10;
    else engagePts = 3;

    return Math.min(100, mentionPts + engagePts);
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

    const devScore = percentileRank(devRawScores, devRawScores[i]);
    const flowScore = computeFlowScore(d.priceChange24h);
    const stakingScore = computeStakingScore(d);
    const revenueScore = computeRevenueScore(d);
    const socialScore = computeSocialScore(d.socialMentions, d.socialEngagement);

    // ── THE ALPHA GAP FORMULA v5 ────────────────────────────────
    // 1. DEV BASE (0-55 pts)
    const devBase = devScore * 0.55;

    // 2. FLOW GAP (0-25 pts)
    let flowGap = 0;
    if (devScore > 30) {
      if (d.priceChange24h < -20) flowGap = 25;
      else if (d.priceChange24h < -10) flowGap = 20;
      else if (d.priceChange24h < -5) flowGap = 15;
      else if (d.priceChange24h < -2) flowGap = 10;
      else if (d.priceChange24h < 0) flowGap = 6;
      else if (d.priceChange24h < 3) flowGap = 3;
      else if (d.priceChange24h < 8) flowGap = 0;
      else if (d.priceChange24h < 15) flowGap = -5;
      else flowGap = -12;
    }

    // 3. SOCIAL GAP (0-10 pts)
    let socialGap = 0;
    if (devScore > 40) {
      if (d.socialMentions <= 2 && d.socialEngagement < 50) socialGap = 10;
      else if (d.socialMentions <= 8 && d.socialEngagement < 300) socialGap = 6;
      else if (d.socialMentions <= 15 && d.socialEngagement < 800) socialGap = 3;
      else if (d.socialMentions > 30 && d.socialEngagement > 2000) socialGap = -3;
      else if (d.socialMentions > 50 && d.socialEngagement > 5000) socialGap = -8;
    }

    // 4. CONFIDENCE BOOST (0-10 pts)
    const confidenceBoost = Math.min(5, stakingScore * 0.05) + Math.min(5, revenueScore * 0.05);

    // 5. MARKET CAP PENALTY
    const mcap = d.marketCapUsd || 0;
    let mcapPenalty = 0;
    if (mcap < 50000) mcapPenalty = -35;
    else if (mcap < 100000) mcapPenalty = -25;
    else if (mcap < 500000) mcapPenalty = -15;
    else if (mcap < 1000000) mcapPenalty = -8;
    else if (mcap < 5000000) mcapPenalty = -3;

    const rawAGap = devBase + flowGap + socialGap + confidenceBoost + mcapPenalty;
    const aGap = Math.max(1, Math.min(100, Math.round(rawAGap)));

    leaderboard.push({
      netuid: d.netuid,
      name: d.name,
      composite_score: aGap,
      flow_score: Math.round(flowScore),
      dev_score: Math.round(devScore),
      hf_score: 0,
      staking_score: stakingScore,
      revenue_score: revenueScore,
      social_score: socialScore,
      signal_count: signalCountMap.get(d.netuid) || 0,
      top_signal: topSignalMap.get(d.netuid),
      alpha_price: d.alphaPriceUsd ?? undefined,
      market_cap: d.marketCapUsd ?? undefined,
      net_flow_24h: d.netFlow24h ?? undefined,
      emission_pct: d.emissionShare || undefined,
      price_change_24h: d.priceChange24h,
    });
  }

  leaderboard.sort((a, b) => b.composite_score - a.composite_score);

  // Sort signals by strength desc
  signals.sort((a, b) => b.strength - a.strength);

  const duration = Date.now() - startTime;
  console.log(`[scan] Complete in ${duration}ms. ${leaderboard.length} subnets, ${signals.length} signals.`);

  return NextResponse.json({
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
  });
}
