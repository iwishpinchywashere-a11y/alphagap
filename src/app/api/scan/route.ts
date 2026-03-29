import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
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
  analysis?: string;
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
  price_change_1h?: number;
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

  // Batch 2: flows + emissions + dev activity (all parallel)
  console.log("[scan] Batch 2: flows + emissions + dev activity...");
  const [flowsResult, emissionsResult, devResult] = await Promise.allSettled([
    getTaoFlows(),
    getSubnetEmissions(),
    getGithubActivity(),
  ]);
  const flows = flowsResult.status === "fulfilled" ? flowsResult.value : [];
  const emissions = emissionsResult.status === "fulfilled" ? emissionsResult.value : [];
  let devActivity = devResult.status === "fulfilled" ? devResult.value : ([] as Awaited<ReturnType<typeof getGithubActivity>>);
  console.log(`[scan] Batch 2 done: ${flows.length} flows, ${emissions.length} emissions, ${devActivity.length} dev`);

  await new Promise(r => setTimeout(r, 500));

  // Batch 3: staking + revenue (all parallel)
  console.log("[scan] Batch 3: staking + revenue...");
  let alphaSharesResult: PromiseSettledResult<Awaited<ReturnType<typeof getValidatorAlphaShares>>>;
  let regCostsResult: PromiseSettledResult<Awaited<ReturnType<typeof getRegistrationCosts>>>;
  let burnedAlphaResult: PromiseSettledResult<Awaited<ReturnType<typeof getBurnedAlpha>>>;

  [alphaSharesResult, regCostsResult, burnedAlphaResult] = await Promise.allSettled([
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
      { query: "templar bittensor", count: 50, sort: "Top" as const },
      { query: "chutes bittensor", count: 50, sort: "Top" as const },
      { query: "bittensor SN", count: 50, sort: "Latest" as const },
      { query: "tao alpha subnet", count: 50, sort: "Latest" as const },
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

  // ── Step 5: Generate signals (dev + HF ONLY) ───────────────────
  // Flow/price signals REMOVED — this feed is purely about development intelligence

  // ── RICH DEV SIGNALS: Fetch actual commits/PRs and analyze with AI ──
  // Sort by activity level, take top 20 most active subnets for deep analysis
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const activeDevSubnets = devActivity
    .filter(a => a.commits_1d > 0 || a.prs_merged_1d > 0)
    .sort((a, b) => (b.commits_1d + b.prs_merged_1d * 5) - (a.commits_1d + a.prs_merged_1d * 5))
    .slice(0, 8);

  console.log(`[scan] Fetching commit/PR details for ${activeDevSubnets.length} active subnets...`);

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
(Is the market sleeping on this? Does the development activity justify the current price? Is there an alpha gap here — strong building but the price hasn't caught up yet? Give a clear, actionable take.)`;

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
          max_tokens: 500,
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

  // Run ALL AI analyses in parallel (8 calls to Haiku ~3-4s total)
  const timeLeftForAI = 58000 - (Date.now() - startTime);
  console.log(`[scan] Running AI analysis on ${devContexts.length} signals (${(timeLeftForAI/1000).toFixed(0)}s left)...`);

  const analyzedDevSignals: { ctx: DevContext; analysis: string }[] = [];
  if (timeLeftForAI > 5000 && ANTHROPIC_KEY) {
    const aiResults = await Promise.all(
      devContexts.map(async (ctx) => ({ ctx, analysis: await analyzeDevActivity(ctx) }))
    );
    analyzedDevSignals.push(...aiResults);
  } else {
    // Out of time or no API key — use fallback
    console.log(`[scan] Skipping AI (${timeLeftForAI < 5000 ? 'no time' : 'no key'}), using fallback`);
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
    });
  }

  // Also create signals for subnets with dev activity that didn't get deep analysis
  for (const act of devActivity) {
    if (act.commits_1d <= 0 && act.prs_merged_1d <= 0) continue;
    if (analyzedDevSignals.some(s => s.ctx.act.netuid === act.netuid)) continue;
    const name = identityMap.get(act.netuid)?.subnet_name || `SN${act.netuid}`;
    addSignal({
      netuid: act.netuid,
      signal_type: "dev_spike",
      strength: Math.min(70, 20 + act.commits_1d * 2 + act.prs_merged_1d * 8),
      title: `${name}: ${act.commits_1d} commits, ${act.prs_merged_1d} PRs merged today`,
      description: `${act.unique_contributors_1d} contributor${act.unique_contributors_1d !== 1 ? "s" : ""} active. 7d trend: ${act.commits_7d} commits, ${act.prs_merged_7d} PRs. Full analysis pending — check back after next scan.`,
      source: "github",
      source_url: act.repo_url,
      subnet_name: name,
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
    addSignal({
      netuid,
      signal_type: "hf_update",
      strength: Math.min(80, 25 + hf.models * 8 + hf.datasets * 5 + hf.spaces * 3 + Math.min(hf.downloads / 500, 20)),
      title: `${name}: New AI assets on HuggingFace`,
      description: `${org} has ${parts.join(", ")} published on HuggingFace with ${hf.downloads.toLocaleString()} total downloads. This indicates active model development and deployment — check their HuggingFace page for specific model architectures and benchmarks.`,
      source: "huggingface",
      source_url: `https://huggingface.co/${org}`,
      subnet_name: name,
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

    rawSubnets.push({
      netuid,
      name,
      priceChange24h: priceChange,
      priceChange1h,
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
  const alphaSharesFailed = alphaSharesResult.status === "rejected" || alphaShares.length === 0;

  function computeStakingScore(d: RawSubnet): number {
    // Fallback if staking API failed
    if (alphaSharesFailed) {
      const mcap = d.marketCapUsd || 0;
      let fallback = 0;
      if (mcap >= 50000000) fallback = 45;
      else if (mcap >= 20000000) fallback = 38;
      else if (mcap >= 10000000) fallback = 32;
      else if (mcap >= 5000000) fallback = 26;
      else if (mcap >= 1000000) fallback = 20;
      else if (mcap >= 100000) fallback = 14;
      else if (mcap > 0) fallback = 10;
      const hasIdentity = identityMap.has(d.netuid);
      if (hasIdentity) fallback += 5;
      return Math.min(100, fallback);
    }

    // Composite raw score from all staking dimensions
    let rawScore = 0;

    // Total alpha staked (primary signal - how much value validators put in)
    const totalStaked = d.totalAlphaStaked;
    if (totalStaked > 0) {
      rawScore += Math.log10(totalStaked + 1) * 8; // log scale: 1M staked = 48, 100K = 40, 10K = 32
    }

    // Validator count bonus
    const valCount = d.validatorCount;
    rawScore += Math.min(20, valCount * 5); // 4 validators = 20 pts max

    // Decentralization bonus (lower top share = more decentralized = better)
    const topShare = d.topValidatorShare || 1;
    rawScore += Math.round((1 - topShare) * 25); // if top val has 40%, bonus = 15

    // Market cap as proxy for overall confidence
    const mcap = d.marketCapUsd || 0;
    if (mcap > 0) {
      rawScore += Math.min(15, Math.log10(mcap + 1) * 2); // $10M mcap = ~14 pts
    }

    // Registration cost bonus (high cost = high demand)
    const regCost = d.regCost || 0;
    if (regCost > 0) {
      rawScore += Math.min(10, Math.log10(regCost + 1) * 3);
    }

    // Scale to 0-100 range. Max realistic rawScore is about 120
    const scaled = Math.min(100, Math.round((rawScore / 100) * 100));
    return Math.max(1, scaled);
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
  const desearchFailed = socialMap.size === 0;

  function computeSocialScore(netuid: number, mentions: number, engagement: number): number {
    if (mentions <= 0 && engagement <= 0) {
      if (desearchFailed) {
        const identity = identityMap.get(netuid);
        if (identity?.twitter) return 15;
        if (identity?.subnet_name) return 8;
      }
      return 0;
    }
    // Weighted raw score: mentions * 5 + engagement
    const rawScore = mentions * 5 + engagement;
    // Use log scale to spread scores better (social data is very skewed)
    const logScore = Math.log10(rawScore + 1);
    // Scale: log10(1) = 0, log10(10) ~= 1, log10(100) = 2, log10(1000) = 3, log10(10000) = 4, log10(100000) = 5
    // Map to 0-100: anything above log10(10000)=4 gets ~100
    const scaled = Math.min(100, Math.round((logScore / 4) * 100));
    return Math.max(5, scaled); // minimum 5 if they have ANY mentions
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
    const socialScore = computeSocialScore(d.netuid, d.socialMentions, d.socialEngagement);

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
      price_change_1h: d.priceChange1h,
    });
  }

  leaderboard.sort((a, b) => b.composite_score - a.composite_score);

  // Sort signals by strength desc
  signals.sort((a, b) => b.strength - a.strength);

  // ── Step 7: Analyze top signals with AI (if time permits) ─────
  const elapsed7 = Date.now() - startTime;
  const timeLeftForAI = 55000 - elapsed7;

  if (ANTHROPIC_KEY && timeLeftForAI > 8000) {
    const topSignals = signals.slice(0, Math.min(3, Math.floor(timeLeftForAI / 3000)));
    console.log(`[scan] Analyzing ${topSignals.length} signals with AI (${(timeLeftForAI/1000).toFixed(0)}s left)...`);

    const analyzePromises = topSignals.map(async (sig) => {
      try {
        const subnetData = leaderboard.find(s => s.netuid === sig.netuid);
        const prompt = `You are AlphaGap, a Bittensor subnet intelligence analyst. Analyze this signal and explain it in 2-3 sentences. Be specific about WHAT happened and WHY it matters for the subnet's alpha token price. No emoji, no headers.

Signal: ${sig.title}
Details: ${sig.description || ""}
Subnet: ${sig.subnet_name || `SN${sig.netuid}`} (aGap score: ${subnetData?.composite_score || "?"})
Price: $${subnetData?.alpha_price?.toFixed(2) || "?"} (24h: ${subnetData?.price_change_24h?.toFixed(1) || "?"}%)
MCap: $${subnetData?.market_cap ? (subnetData.market_cap / 1e6).toFixed(1) + "M" : "?"}`;

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 200,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.content?.[0]?.text;
          if (text) sig.analysis = text;
        }
      } catch (e) {
        console.error(`[scan] AI analysis failed for signal ${sig.id}:`, e);
      }
    });

    await Promise.all(analyzePromises);
    console.log(`[scan] AI analysis done.`);
  }

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
