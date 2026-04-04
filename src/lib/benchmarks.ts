// src/lib/benchmarks.ts
// Bittensor subnet benchmark data vs centralized AI providers
// Source: AlphaGap Benchmark Integration (April 3, 2026)
// Data from: taoflute.com, taostats.io, subnetalpha.ai, subnet documentation

export interface BenchmarkEntry {
  subnet_id: number;
  subnet_name: string;
  benchmark_score: number;       // 0–100
  benchmark_category: string;
  vs_provider: string;
  cost_saving_pct: number;       // percentage (e.g. 85 = "85%")
  perf_delta: string;
  benchmark_summary: string;
  active_users: string;
  annual_revenue_usd: number;    // 0 if pre-revenue
  last_updated: string;
  sources: string[];
}

export const BENCHMARK_DATA: BenchmarkEntry[] = [
  {
    subnet_id: 64,
    subnet_name: "Chutes",
    benchmark_score: 95,
    benchmark_category: "Serverless AI Compute",
    vs_provider: "AWS Lambda / Google Cloud AI",
    cost_saving_pct: 85,
    perf_delta: "+10x startup speed",
    benchmark_summary: "85% cheaper than AWS Lambda; 10x faster startup (200ms vs 2s+); processes 100B tokens/day (~1/3 of Google NLP throughput); 400K+ users; 9.1T tokens processed",
    active_users: "400K+",
    annual_revenue_usd: 1800000,
    last_updated: "2026-04-03",
    sources: [
      "https://subnetalpha.ai/subnet/chutes/",
      "https://www.ainvest.com/news/decentralized-ai-rising-cost-efficiency-network-growth-bittensor-subnet-62-2509/",
    ],
  },
  {
    subnet_id: 51,
    subnet_name: "lium.io",
    benchmark_score: 90,
    benchmark_category: "GPU Compute",
    vs_provider: "RunPod / Vast.ai / AWS EC2 GPU",
    cost_saving_pct: 90,
    perf_delta: "+45% compute efficiency",
    benchmark_summary: "90% price reduction vs RunPod/Vast.ai; 45% compute efficiency improvement; hardware-level GPU optimization supporting H100/A100/AMD MI200",
    active_users: "500+",
    annual_revenue_usd: 2555000,
    last_updated: "2026-04-03",
    sources: [
      "https://www.youtube.com/watch?v=xftMhCMOf-4",
    ],
  },
  {
    subnet_id: 4,
    subnet_name: "Targon",
    benchmark_score: 85,
    benchmark_category: "Confidential AI Inference",
    vs_provider: "CoreWeave / AWS Confidential Compute",
    cost_saving_pct: 50,
    perf_delta: "TEE confidential inference",
    benchmark_summary: "Highest revenue subnet at $10.4M/yr; TEE-based confidential GPU inference; $70M+ NVIDIA-certified hardware; 1,000+ H200s; 4M+ users via Dippy",
    active_users: "4M+ (via Dippy)",
    annual_revenue_usd: 10400000,
    last_updated: "2026-04-03",
    sources: [
      "https://www.youtube.com/watch?v=2Nl7STjDs54",
    ],
  },
  {
    subnet_id: 22,
    subnet_name: "DeSearch",
    benchmark_score: 80,
    benchmark_category: "AI Search",
    vs_provider: "OpenAI Search / Perplexity / Google Search AI",
    cost_saving_pct: 60,
    perf_delta: "92.57% relevance vs ~85% centralized",
    benchmark_summary: "92.57% summary relevance score — beating OpenAI, Google, and Perplexity in AI search benchmarks; $11K MRR; real-time decentralized search API",
    active_users: "1K+ API users",
    annual_revenue_usd: 132000,
    last_updated: "2026-04-03",
    sources: [
      "https://x.com/bittingthembits/status/1857099946912006349",
    ],
  },
  {
    subnet_id: 62,
    subnet_name: "Ridges",
    benchmark_score: 78,
    benchmark_category: "AI Coding Agents",
    vs_provider: "GitHub Copilot / Claude Code / Codex",
    cost_saving_pct: 95,
    perf_delta: "66-69% SWE-bench score",
    benchmark_summary: "66-69% SWE-bench success rate on autonomous coding; subscription at $10/mo vs $200+ for centralized tools; reportedly outperforming Claude on some coding tasks",
    active_users: "Enterprise devs",
    annual_revenue_usd: 600000,
    last_updated: "2026-04-03",
    sources: [
      "https://www.lbank.com/price/ridges-ai",
      "https://x.com/Mars_DeFi/status/2038861707762901286",
    ],
  },
  {
    subnet_id: 3,
    subnet_name: "templar",
    benchmark_score: 76,
    benchmark_category: "LLM Pre-Training",
    vs_provider: "OpenAI GPT-4 Training / Google DeepMind",
    cost_saving_pct: 70,
    perf_delta: "72B param decentralized LLM",
    benchmark_summary: "Covenant-72B: world's largest decentralized LLM pre-training (72B params, 1.1T tokens); GPT-4 class benchmarks; endorsed by NVIDIA CEO Jensen Huang; +98% token price 30d",
    active_users: "Researchers / devs",
    annual_revenue_usd: 0,
    last_updated: "2026-04-03",
    sources: [
      "https://www.mexc.com/news/947690",
    ],
  },
  {
    subnet_id: 75,
    subnet_name: "Hippius",
    benchmark_score: 72,
    benchmark_category: "Decentralized Storage",
    vs_provider: "AWS S3 / Google Cloud Storage",
    cost_saving_pct: 60,
    perf_delta: "Transparent pricing",
    benchmark_summary: "AWS S3 equivalent at fraction of cost; IPFS + S3-compatible API; $4.48M realized PnL; transparent on-chain pricing",
    active_users: "Enterprise",
    annual_revenue_usd: 4480000,
    last_updated: "2026-04-03",
    sources: [
      "https://simplytao.ai/blog/your-simple-guide-to-hippius-sn75",
    ],
  },
  {
    subnet_id: 56,
    subnet_name: "Gradients",
    benchmark_score: 70,
    benchmark_category: "AI Model Training",
    vs_provider: "AWS EC2 / Google Cloud TPU",
    cost_saving_pct: 83,
    perf_delta: "$5/hr vs $30-60/hr centralized",
    benchmark_summary: "AI model training for $5/hour vs AWS/GCP H100 at $30-60/hour; adopted by life sciences; part of Rayon Labs ecosystem",
    active_users: "Life sciences",
    annual_revenue_usd: 240000,
    last_updated: "2026-04-03",
    sources: [
      "https://www.ainvest.com/news/decentralized-ai-rising-cost-efficiency-network-growth-bittensor-subnet-62-2509/",
    ],
  },
];

// Quick lookup by subnet_id
export const BENCHMARK_MAP = new Map<number, BenchmarkEntry>(
  BENCHMARK_DATA.map(b => [b.subnet_id, b])
);

// ── Product Milestones ────────────────────────────────────────────
// Manually curated pre-launch / launch events for subnets not yet
// formally benchmarked vs AWS/GCP/OpenAI. These represent early alpha:
// teams that have shipped real product but the market hasn't priced it in yet.
export type MilestoneStage =
  | "revenue"        // generating real revenue (strongest signal)
  | "partnership"    // confirmed corporate / institutional partnership
  | "live"           // product is publicly live / accessible
  | "beta"           // beta / early access launched
  | "preview"        // public demo or product preview shown
  | "waitlist";      // waitlist open / coming soon announced

export interface ProductMilestone {
  netuid: number;
  subnet_name: string;
  stage: MilestoneStage;
  milestone_date: string;   // ISO date string e.g. "2026-03-20"
  title: string;
  description: string;
  source_url?: string;
  estimated_arr_usd?: number;   // 0 = pre-revenue / unknown
  confidence: "high" | "medium" | "low";
}

// Last updated: 2026-04-03
// Research sources: subnetalpha.ai, X, PRNewswire, Forbes, cointelligence, direct team announcements
export const PRODUCT_MILESTONES: ProductMilestone[] = [
  // ── REVENUE-GENERATING ──────────────────────────────────────────
  {
    netuid: 71,
    subnet_name: "Leadpoet",
    stage: "revenue",
    milestone_date: "2026-02-01",
    title: "$1M ARR — 26 paying B2B customers, Forbes coverage Feb 2026",
    description: "Leadpoet achieved $1M annualized revenue run rate within its first quarter post-launch (launched Oct 2025, beta Dec 2025, early access Jan 2026). 26 paying B2B customers using decentralized AI sales intelligence — intent-scored prospect lists outperforming ZoomInfo/Apollo. 2M+ total leads generated. Forbes coverage Feb 2026. $1.3M raised (DSV Fund + Astrid Intelligence). NVIDIA Inception member. Chutes AI partnership.",
    source_url: "https://subnetalpha.ai/subnet/leadpoet/",
    estimated_arr_usd: 1_000_000,
    confidence: "high",
  },
  {
    netuid: 44,
    subnet_name: "Score",
    stage: "revenue",
    milestone_date: "2025-11-01",
    title: "First five-figure recurring invoice — enterprise computer vision live across 4 industries",
    description: "Score's Manako platform has a confirmed first five-figure monthly recurring invoice (Nov 2025). Live enterprise partnerships: Reading FC (football analytics), major European petroleum company CCTV monitoring (60-day trial converting at 100%), $5B sports betting syndicate (20% revenue share on upside), Two-a-Day Africa (fruit packing quality control, announced ~Mar 2026). Access to 283 football leagues and 400K match dataset. 20% of commercial revenue directed to ALPHA token buybacks.",
    source_url: "https://subnetalpha.ai/subnet/score/",
    estimated_arr_usd: 180_000,
    confidence: "high",
  },
  // ── LIVE PRODUCT ────────────────────────────────────────────────
  {
    netuid: 8,
    subnet_name: "Vanta",
    stage: "live",
    milestone_date: "2026-02-17",
    title: "Prop trading firm launched Feb 2026 — 5–10 signups/day @ $149–$349",
    description: "Vanta Trading prop firm publicly launched Feb 17, 2026 (PR Newswire / Morningstar). Traders pay $149–$349 upfront evaluation fees for simulated funded accounts ($25K–$100K) with 100% profit split on pass. At 5–10 signups/day → ~$275K–$1.3M annualized. $20B+ traditional prop firm industry TAM (vs FTMO, Topstep). $30M+ token rewards pool for top traders. All-time high token price $11.59 on Mar 26, 2026.",
    source_url: "https://www.prnewswire.com/news-releases/taoshi-announces-vanta-trading-a-new-decentralized-prop-trading-evaluation-platform-302686852.html",
    estimated_arr_usd: 750_000,
    confidence: "high",
  },
  {
    netuid: 50,
    subnet_name: "Synth",
    stage: "live",
    milestone_date: "2026-01-27",
    title: "API launched with agentic x402 payments — Polymarket, Deribit, Bybit, Koshi live",
    description: "Synth publicly launched probabilistic price forecasting API Jan 27, 2026 with x402 agentic payment integration (first Bittensor subnet to use agentic payments). Live integrations: Polymarket (prediction markets), Deribit (crypto options), Bybit (trading), Koshi (institutional risk desk). $6M Optimism Foundation grant. Monte Carlo simulation paths across BTC, ETH, SOL, XAU, SPY, NVDA, TSLA, AAPL, GOOGL at 1h/24h horizons. In a 4-week Polymarket trial, $2K account returned ~110% on $500K trading volume using Synth signals. Expanded to tokenized equities (TSLAX, AAPLX, GOOGLX).",
    source_url: "https://www.synthdata.co/",
    estimated_arr_usd: 0,
    confidence: "high",
  },
  {
    netuid: 33,
    subnet_name: "ReadyAI",
    stage: "live",
    milestone_date: "2024-11-01",
    title: "Ipsos in production — 86% more accurate than human annotation, 51% better than GPT-4o",
    description: "ReadyAI's structured data processing platform went live with Ipsos (one of world's largest market research firms) in production Nov 2024. 6 total enterprise pilots in various stages. Claims 86% higher accuracy vs human annotation and 51% vs GPT-4o on survey tagging and NER tasks. 'Begun monetization' confirmed per company updates. Non-deterministic enrichment task type deployed — structural innovation. Enterprise API live.",
    source_url: "https://subnetalpha.ai/subnet/readyai/",
    estimated_arr_usd: 60_000,
    confidence: "medium",
  },
  // ── BETA / EARLY ACCESS ─────────────────────────────────────────
  {
    netuid: 34,
    subnet_name: "BitMind",
    stage: "beta",
    milestone_date: "2025-04-01",
    title: "150K+ weekly deepfake detections — Chrome extension + iOS/Android live, SOC 2 certified",
    description: "BitMind's AI content verification network has 150K+ weekly Chrome extension detections. iOS/Android app launched Apr 2025. 95% accuracy at sub-second response times. SOC 2 compliant. Expanding to video/audio modalities. Subnet V3 refactor with Epistoola framework in progress (3x speed improvement). elizaOS Bittensor plugin published. B2B monetization path: API licensing to social platforms for content moderation at scale.",
    source_url: "https://bitmind.ai",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 68,
    subnet_name: "MetaNova",
    stage: "beta",
    milestone_date: "2026-01-01",
    title: "Drug discovery: 4.8M molecules screened across 7,000 targets — fiat revenue pipeline building",
    description: "MetaNova's AI drug discovery screening platform has processed 4.8M molecules across 7,000 protein targets. Combinatorial chemistry expands search space to 65B molecules. Blueprint incentive mechanism (reaction pathway discovery) live. Fiat revenue from pharma screening-as-a-service 'expected in months' (stated late 2025). Working with CROs and universities. Targets mood disorders, reward pathways, and other therapeutic areas.",
    source_url: "https://www.metanova-labs.ai/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 62,
    subnet_name: "Ridges",
    stage: "beta",
    milestone_date: "2025-10-30",
    title: "AI coding agent VS Code extension live — $300K DSV Fund investment, $12/month subscription",
    description: "Ridges shipped V1 as a Cursor/VS Code extension Oct 30, 2025. SWE-Bench Polyglot scores at ~41%+ for autonomous software engineering. ~$12/month subscription pricing. Stillcore Capital investment Dec 2025. $300K DSV Fund invested. Latent Holdings partnership for go-to-market. Target: revenue > emissions by Jan 2026. Collaborates with ReadyAI, Score, BitMind, Bitcast subnets.",
    source_url: "https://subnetalpha.ai/subnet/ridgesai/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
];

// Quick lookup — use latest milestone per subnet
export const MILESTONE_MAP = new Map<number, ProductMilestone>(
  // Sort ascending so last write wins with the most recent milestone
  [...PRODUCT_MILESTONES]
    .sort((a, b) => a.milestone_date.localeCompare(b.milestone_date))
    .map(m => [m.netuid, m])
);

// ── Recency multiplier for milestone scores ───────────────────────
// Revenue / live / partnership stages describe ONGOING STATE — barely decay.
// Beta / preview / waitlist are one-time events — decay normally.
function milestoneRecency(dateStr: string, stage: MilestoneStage): number {
  const ageMs = Date.now() - new Date(dateStr).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (stage === "revenue" || stage === "partnership") {
    // Ongoing revenue: full credit for 6 months, very slow fade after
    if (ageDays <= 180) return 1.00;
    if (ageDays <= 365) return 0.85;
    return 0.70; // Revenue from >1yr ago still real, just less fresh
  }

  if (stage === "live") {
    // Live product: full credit for 3 months, then gentle fade
    if (ageDays <= 90)  return 1.00;
    if (ageDays <= 180) return 0.85;
    if (ageDays <= 365) return 0.65;
    return 0.45;
  }

  // beta / preview / waitlist — one-time announcements, decay faster
  if (ageDays <= 14)  return 1.00;
  if (ageDays <= 30)  return 0.85;
  if (ageDays <= 60)  return 0.65;
  if (ageDays <= 90)  return 0.45;
  if (ageDays <= 180) return 0.25;
  return 0.10;
}

// ── Stage base scores (0–80, below 100 benchmark ceiling) ────────
const STAGE_BASE: Record<MilestoneStage, number> = {
  revenue:     80,
  partnership: 65,
  live:        60,
  beta:        48,
  preview:     38,
  waitlist:    25,
};

// ── Inputs used for heuristic utility scoring ─────────────────────
export interface UtilityHeuristicInputs {
  emissionPct: number;       // raw emission % (e.g. 2.5 = 2.5% of network)
  evalScore: number;         // validator eval quality score (0–100)
  devScore: number;          // developer activity score (0–100)
  marketCapUsd: number;      // market cap in USD
  alphaStakedPct: number;    // % of alpha that is staked (0–100)
  hasActiveCampaign: boolean; // running a Stitch3 marketing campaign
}

// ── Website scan data (from /api/scan-websites blob cache) ────────
export interface WebsiteSignalData {
  score: number;      // 0–80 raw from HTML analysis
  signals: string[];  // e.g. ["pricing_page", "live_product", "enterprise"]
}

// ── computeProductScore ───────────────────────────────────────────
//
// Priority order (highest applicable wins):
//   1. Formally benchmarked vs AWS/GCP/OpenAI  →  0–100  estimated: false
//   2. Website scan detected live/pricing/etc  →  0–80   estimated: true
//   3. Manual product milestone (curated)      →  0–80   estimated: true
//   4. Heuristic from proxy signals            →  0–60   estimated: true
//
// ALL sources return a 0–100 scale (previously 0–10).
// In the AGap formula use: productScore * 0.10 to keep 0–10 pt contribution.
//
export function computeProductScore(
  netuid: number,
  heuristic?: UtilityHeuristicInputs,
  websiteData?: WebsiteSignalData,
): { score: number; estimated: boolean; source: "benchmark" | "website" | "milestone" | "heuristic" } {

  // ── 1. Formally benchmarked ───────────────────────────────────────────────
  const b = BENCHMARK_MAP.get(netuid);
  if (b) {
    // Revenue traction bonus (0–20 pts added to benchmark score)
    let revBonus = 0;
    if (b.annual_revenue_usd >= 10_000_000) revBonus = 20;
    else if (b.annual_revenue_usd >= 2_000_000) revBonus = 14;
    else if (b.annual_revenue_usd >= 500_000)  revBonus = 8;
    else if (b.annual_revenue_usd > 0)         revBonus = 4;

    return {
      score: Math.min(100, b.benchmark_score + revBonus),
      estimated: false,
      source: "benchmark",
    };
  }

  // ── 2. Website scan ────────────────────────────────────────────────────────
  const websiteScore = websiteData?.score ?? 0;

  // ── 3. Manual milestone ────────────────────────────────────────────────────
  const milestone = MILESTONE_MAP.get(netuid);
  let milestoneScore = 0;
  if (milestone) {
    const base = STAGE_BASE[milestone.stage];
    const recency = milestoneRecency(milestone.milestone_date, milestone.stage);
    const confidenceMultiplier = milestone.confidence === "high" ? 1.0 : milestone.confidence === "medium" ? 0.80 : 0.55;
    // ARR boost: known annual revenue lifts the score slightly
    const arrBonus = milestone.estimated_arr_usd && milestone.estimated_arr_usd >= 1_000_000 ? 10
      : milestone.estimated_arr_usd && milestone.estimated_arr_usd >= 500_000 ? 6
      : milestone.estimated_arr_usd && milestone.estimated_arr_usd >= 100_000 ? 3
      : 0;
    milestoneScore = Math.min(80, Math.round((base + arrBonus) * recency * confidenceMultiplier));
  }

  // Best of website vs milestone (both estimated; take whichever is stronger)
  const nonBenchmarkBest = Math.max(websiteScore, milestoneScore);

  if (nonBenchmarkBest > 0) {
    // Determine which source won
    const source = websiteScore >= milestoneScore ? "website" : "milestone";
    return { score: nonBenchmarkBest, estimated: true, source };
  }

  // ── 4. Heuristic (fallback) ────────────────────────────────────────────────
  if (!heuristic) {
    // If we have any website/milestone signal at all, return it even if small
    if (nonBenchmarkBest > 0) {
      return { score: nonBenchmarkBest, estimated: true, source: milestoneScore > 0 ? "milestone" : "website" };
    }
    return { score: 0, estimated: false, source: "heuristic" };
  }

  const { emissionPct, evalScore, devScore, marketCapUsd, alphaStakedPct, hasActiveCampaign } = heuristic;
  let utilPts = 0;

  // Emission share (0–2 units) — highest-confidence proxy for network-level usefulness
  if (emissionPct >= 3.0) utilPts += 2;
  else if (emissionPct >= 1.0) utilPts += 1;

  // Validator quality (0–2 units)
  if (evalScore >= 65) utilPts += 2;
  else if (evalScore >= 40) utilPts += 1;

  // Developer activity (0–1 unit)
  if (devScore >= 55) utilPts += 1;

  // Market / staking conviction (0–1 unit)
  if (marketCapUsd >= 15_000_000) utilPts += 1;
  else if (marketCapUsd >= 4_000_000 && alphaStakedPct >= 60) utilPts += 1;

  // Active campaign = subnet has a product worth selling
  if (hasActiveCampaign) utilPts = Math.min(6, utilPts + 1);

  // Scale 0–6 units → 0–60 pts (to match 0–100 scale)
  const heuristicScore = Math.min(60, utilPts * 10);

  // Use best of heuristic and any small website/milestone signal
  const finalScore = Math.max(heuristicScore, nonBenchmarkBest);
  const finalSource = finalScore === nonBenchmarkBest && nonBenchmarkBest > heuristicScore
    ? (milestoneScore > 0 ? "milestone" : "website")
    : "heuristic";

  return { score: finalScore, estimated: true, source: finalSource };
}
