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

  function addSignal(s: Omit<ScanSignal, "id" | "created_at"> & { signal_date?: string }) {
    signals.push({
      ...s,
      id: signalId++,
      strength: Math.round(s.strength), // always integer
      created_at: new Date().toISOString(),
      signal_date: s.signal_date || new Date().toISOString(),
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

    // 5 targeted searches (reduced from 8 to conserve credits)
    // ~5 credits/scan × 10 scans/day = 50 credits/day → $10 lasts ~60+ days
    const searches = [
      { query: "bittensor subnet", count: 100, sort: "Top" as const },
      { query: "bittensor subnet alpha", count: 100, sort: "Latest" as const },
      { query: "$TAO subnet SN", count: 50, sort: "Top" as const },
      { query: "bittensor alpha token", count: 50, sort: "Latest" as const },
      { query: "bittensor templar chutes ridges basilica", count: 50, sort: "Top" as const },
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
    console.log(`[scan] Desearch done. ${allTweets.size} tweets matched to ${socialMap.size} subnets.`);
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

  // ── Staking score formula ───────────────────────────────────────
  const alphaSharesFailed = alphaSharesResult.status === "rejected" || alphaShares.length === 0;

  function computeStakingScore(d: RawSubnet): number {
    let score = 0;

    // Total alpha staked — the primary signal (max 40 pts)
    const staked = d.totalAlphaStaked;
    if (staked >= 2000000) score += 40;
    else if (staked >= 1500000) score += 35;
    else if (staked >= 1000000) score += 28;
    else if (staked >= 500000) score += 22;
    else if (staked >= 100000) score += 15;
    else if (staked >= 10000) score += 8;
    else if (staked > 0) score += 3;

    // Validator count (max 20 pts)
    const vals = d.validatorCount;
    if (vals >= 5) score += 20;
    else if (vals >= 4) score += 16;
    else if (vals >= 3) score += 12;
    else if (vals >= 2) score += 8;
    else if (vals >= 1) score += 4;

    // Decentralization — low top validator share is better (max 15 pts)
    const topShare = d.topValidatorShare || 1;
    if (topShare <= 0.25) score += 15;
    else if (topShare <= 0.35) score += 12;
    else if (topShare <= 0.50) score += 8;
    else if (topShare <= 0.70) score += 4;
    else score += 1;

    // Market cap as confidence proxy (max 15 pts)
    const mcap = d.marketCapUsd || 0;
    if (mcap >= 100000000) score += 15;
    else if (mcap >= 50000000) score += 12;
    else if (mcap >= 20000000) score += 10;
    else if (mcap >= 5000000) score += 7;
    else if (mcap >= 1000000) score += 4;
    else if (mcap >= 100000) score += 2;

    // Registration cost — high demand for slots (max 10 pts)
    const regCost = d.regCost || 0;
    if (regCost >= 1) score += 10;
    else if (regCost >= 0.1) score += 6;
    else if (regCost > 0) score += 3;

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

    // Absolute social score based on actual social presence
    let score = 0;

    // Mentions (max 50 pts)
    if (mentions >= 50) score += 50;
    else if (mentions >= 25) score += 40;
    else if (mentions >= 15) score += 32;
    else if (mentions >= 8) score += 24;
    else if (mentions >= 4) score += 16;
    else if (mentions >= 2) score += 10;
    else if (mentions >= 1) score += 5;

    // Engagement (max 50 pts) — likes, retweets, comments
    if (engagement >= 5000) score += 50;
    else if (engagement >= 2000) score += 40;
    else if (engagement >= 800) score += 30;
    else if (engagement >= 300) score += 22;
    else if (engagement >= 100) score += 15;
    else if (engagement >= 30) score += 8;
    else if (engagement >= 5) score += 4;

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
    const stakingScore = computeStakingScore(d);
    const revenueScore = computeRevenueScore(d);
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

    // 4. SMART MONEY SIGNALS (0-15 pts) — are insiders accumulating?
    // Rising staking/emissions = validators see something before retail
    let smartMoney = 0;
    // High staking score = validators are confident
    if (stakingScore >= 60) smartMoney += 8;
    else if (stakingScore >= 40) smartMoney += 5;
    else if (stakingScore >= 25) smartMoney += 2;
    // Revenue health = sustainable economics
    if (revenueScore >= 60) smartMoney += 4;
    else if (revenueScore >= 40) smartMoney += 2;
    // Net inflow = money flowing in
    if (d.netFlow24h && d.netFlow24h > 0) smartMoney += 3;
    // High emission share = network allocating resources here
    if (d.emissionShare > 0.02) smartMoney += 3;
    else if (d.emissionShare > 0.01) smartMoney += 1;

    // 5. MARKET CAP VIABILITY — too small = uninvestable
    const mcap = d.marketCapUsd || 0;
    let viability = 0;
    if (mcap < 50000) viability = -30;        // ghost subnet
    else if (mcap < 100000) viability = -20;
    else if (mcap < 500000) viability = -10;
    else if (mcap < 1000000) viability = -5;
    else if (mcap >= 10000000) viability = 3;  // large enough for serious investment
    else if (mcap >= 50000000) viability = 5;

    const rawAGap = buildingPts + priceLag + socialGap + smartMoney + viability;
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
