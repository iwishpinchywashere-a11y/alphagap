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
    subnet_id: 50,
    subnet_name: "Synth",
    benchmark_score: 82,
    benchmark_category: "AI Price Forecasting",
    vs_provider: "Polymarket Research / Refinitiv / Traditional Quant Desks",
    cost_saving_pct: 80,
    perf_delta: "~110% return in 4-week Polymarket trial on $500K volume",
    benchmark_summary: "First Bittensor subnet with agentic x402 payments; probabilistic price forecasting API live on Polymarket, Deribit, Bybit, and Koshi institutional risk desk; Monte Carlo simulation paths for BTC, ETH, SOL, XAU, SPY, NVDA, TSLA, AAPL, GOOGL at 1h/24h horizons; $6M Optimism Foundation grant; in a 4-week Polymarket trial a $2K test account returned ~110% on $500K trading volume",
    active_users: "Institutional traders",
    annual_revenue_usd: 0,
    last_updated: "2026-04-04",
    sources: [
      "https://www.synthdata.co/",
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
  {
    subnet_id: 71,
    subnet_name: "Leadpoet",
    benchmark_score: 78,
    benchmark_category: "B2B Sales Intelligence & Intent Data",
    vs_provider: "ZoomInfo / Apollo.io / Clearbit",
    cost_saving_pct: 70,
    perf_delta: "Real-time intent signals vs static database",
    benchmark_summary: "Decentralized real-time buyer intent detection — 240 miners scrape fresh signals (job postings, funding rounds, tech stack changes, competitor engagement) vs ZoomInfo/Apollo's stale static databases. 5.4M+ verified leads accepted (71.6% acceptance rate), 25K+ leads/day. Triple-validator consensus (email deliverability + LinkedIn validation + LLM verification). $1M ARR in first quarter post-launch — 26 paying B2B customers at ~$38K ACV. Forbes coverage Feb 2026. Deflationary token burn on every lead request. 7.5M total leads generated in under 6 months.",
    active_users: "26 B2B enterprise customers",
    annual_revenue_usd: 1_000_000,
    last_updated: "2026-04-07",
    sources: [
      "https://leadpoet.com/",
      "https://subnetalpha.ai/subnet/leadpoet/",
      "https://github.com/leadpoet/leadpoet",
    ],
  },
  {
    subnet_id: 85,
    subnet_name: "Vidaio",
    benchmark_score: 74,
    benchmark_category: "AI Video Processing (Upscaling & Compression)",
    vs_provider: "Topaz Video AI / AWS Elemental MediaConvert / HitPaw",
    cost_saving_pct: 80,
    perf_delta: "ClipIQA+ 0.4697 vs Topaz 0.4658; 95% file size reduction",
    benchmark_summary: "Publicly benchmarked vs Topaz (leading commercial upscaler): Vidaio base miner scores 0.4697 ClipIQA+ vs Topaz 0.4658, FFmpeg 0.4084, HitPaw 0.3637. Community miners exceed baseline weekly. AI video compression: ~800MB → ~40MB (~95% reduction) with maintained perceptual quality. No-reference scoring via CLIP-IQA+, VMAF, LPIPS. Content-aware scene-by-scene ML codec optimization vs one-size-fits-all encoders. $400B TAM (streaming + CDN + post-production). Beta live; enterprise fiat API coming. Founder: Gareth Howells (20+ years Netflix, Disney, Sony, Spotify, Hulu).",
    active_users: "Beta users",
    annual_revenue_usd: 0,
    last_updated: "2026-04-07",
    sources: [
      "https://vidaio.io/",
      "https://medium.com/@vidaio/benchmarking-video-upscaling-vidaio-bittensor-subnet-85-bacdee2f96f9",
      "https://github.com/vidaio-subnet/vidaio-subnet",
    ],
  },
  {
    subnet_id: 88,
    subnet_name: "Mobius Fund / Investing",
    benchmark_score: 68,
    benchmark_category: "Decentralized Asset Management (AUM)",
    vs_provider: "BlackRock / Bridgewater / Traditional Hedge Funds",
    cost_saving_pct: 60,
    perf_delta: "92.39% return / 2.24% drawdown over 3 months (self-reported)",
    benchmark_summary: "World's first decentralized AUM platform — crowdsources investment strategies from global miners (human + AI), validates via proprietary MAR×LSR×odds% scoring, and aggregates into the 88 Quant Fund (live Dec 2025). Phase I: TAO/Alpha staking optimization. Phase II: US equities (live NYSE/NASDAQ Market on Open/Close). 1,400+ TAO AUM. 92.39% return / 2.24% drawdown over 3 months across 50+ subnets (ensemble, self-reported). MPT + CAPM diversification on top of miner outputs. Non-custodial via TrustedStake. KYM (Know Your Miner) zero-code interface lowers barrier for strategy submission. Revenue model: AUM fees + signal sales + Bittensor emissions. $145 trillion global AUM industry TAM.",
    active_users: "88 Quant Fund investors",
    annual_revenue_usd: 0,
    last_updated: "2026-04-07",
    sources: [
      "https://github.com/mobiusfund/investing",
      "https://subnetalpha.ai/subnet/investing/",
      "https://trustedstake.ai/",
    ],
  },
  {
    subnet_id: 68,
    subnet_name: "MetaNova / NOVA",
    benchmark_score: 70,
    benchmark_category: "AI Drug Discovery (Virtual Screening)",
    vs_provider: "Schrödinger / BioNTech AI / Insilico Medicine",
    cost_saving_pct: 90,
    perf_delta: "TREAT-1: +79% enrichment factor vs baseline PSICHIC",
    benchmark_summary: "Decentralized drug discovery platform running on Bittensor SN68. 4.8M molecules screened across 7,000+ protein targets. Combinatorial expansion from SAVI 2020 (1.75B synthesizable compounds) to 65B search space — impossible at any single centralized lab. TREAT-1 fine-tuned model: +79% enrichment factor improvement (39.5% → ~70% true binders in screened sets; MAPE reduced 0.50→0.25). Average drug costs $2.6B and takes 10+ years — NOVA targets 50% cost reduction. Timelock encryption ensures fair miner competition. DiaGen AI JV (Nov 2025) for hit-picking tool. Wet lab validation pipeline with CRO partners. Revenue model: Screening-as-a-Service + licensing validated candidates + model licensing.",
    active_users: "Researchers + pharma/biotech pipeline",
    annual_revenue_usd: 0,
    last_updated: "2026-04-07",
    sources: [
      "https://www.metanova-labs.ai/",
      "https://subnetalpha.ai/subnet/nova/",
      "https://github.com/metanova-labs/nova",
    ],
  },
  {
    subnet_id: 93,
    subnet_name: "Bitcast",
    benchmark_score: 72,
    benchmark_category: "Decentralized Influencer Marketing",
    vs_provider: "Traditional Ad Agencies / Creator.co / AspireIQ",
    cost_saving_pct: 65,
    perf_delta: "$1,200+ CPM vs ~$50-100 CPM centralized; verified via YouTube OAuth",
    benchmark_summary: "First non-AI application on Bittensor — a fully automated, blockchain-verified influencer marketing network. Brands post briefs; creators (miners) produce YouTube videos; validators pull real engagement via YouTube OAuth API. 456K+ subscriber network, 18,600+ verified watch hours, 389+ videos, 20+ creators across 5 languages. $630K+ worth of alpha tokens burned (18% of total issued supply) from brand spend — deflationary flywheel. 7th highest emissions among all Bittensor subnets. Ranked on Bybit, Crypto.com, MEXC. No contracts, no agencies — campaigns launch programmatically with daily crypto payouts to creators. $20-25B global influencer marketing TAM. Expanding to TikTok, Instagram, X.",
    active_users: "20+ creators, multiple brands",
    annual_revenue_usd: 120_000,
    last_updated: "2026-04-07",
    sources: [
      "https://bitcast.network/",
      "https://subnetalpha.ai/subnet/bitcast/",
      "https://github.com/bitcast-network/bitcast",
    ],
  },
  {
    subnet_id: 44,
    subnet_name: "Score / Manako",
    benchmark_score: 85,
    benchmark_category: "Computer Vision & Video Analytics",
    vs_provider: "Google Video Intelligence API / AWS Rekognition / Manual Video Annotation",
    cost_saving_pct: 99,
    perf_delta: "94% per-frame accuracy; 1,000× faster than manual",
    benchmark_summary: "Score's Manako platform processes a full 90-minute football match in ~2 minutes for ~$10 vs $10,000+ with manual annotation teams (99%+ cost reduction, 1,000× speed). Validated on the SoccerNet GSR challenge using GS-HOTA (Game State Higher Order Tracking Accuracy) metric — 94% per-frame accuracy. Describes itself as '150B addressable cameras globally'. Live enterprise deployments: Reading FC (tactical analytics), major European petroleum CCTV monitoring ($5B betting syndicate, 20% revenue share), Two-a-Day South Africa (fruit packing QC). First five-figure monthly recurring invoice confirmed Nov 2025. 20% of all commercial revenue directed to SN44 ALPHA token buybacks. No-code interface via Manako: connect any camera, describe what to detect in plain language, instant alerts. Plans for basketball, tennis, security, retail, and 2026 World Cup fantasy sports app.",
    active_users: "4+ enterprise clients",
    annual_revenue_usd: 180000,
    last_updated: "2026-04-07",
    sources: [
      "https://www.wearescore.com/",
      "https://manako.ai/",
      "https://subnetalpha.ai/subnet/score/",
      "https://github.com/score-technologies/score-vision",
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

// Last updated: 2026-04-07
// Research sources: subnetalpha.ai, X, PRNewswire, Forbes, Unsupervised Capital, direct team announcements, wearescore.com, leadpoet.com, vidaio.io, bitcast.network, metanova-labs.ai, github.com/mobiusfund
export const PRODUCT_MILESTONES: ProductMilestone[] = [
  // ── REVENUE-GENERATING ──────────────────────────────────────────
  {
    netuid: 11,
    subnet_name: "Dippy",
    stage: "revenue",
    milestone_date: "2025-06-01",
    title: "$600K+ ARR — 4M+ users, $40-60K/month, alpha buybacks from app revenue",
    description: "Dippy AI companion app drives $40-60K/month in subscription revenue ($9.99/mo Super plan) — ~$600K ARR. 4M+ users with 1hr/day avg engagement. 5B+ tokens/day served via SN4 Targon inference. $70K+ in SN11 alpha token buybacks from app revenue. $2.1M raised (Drive Capital seed). 8.6M total users cited in 2026 estimates. Consumer companion model trained by SN11 miners.",
    source_url: "https://www.together.ai/blog/dippy-ai",
    estimated_arr_usd: 600_000,
    confidence: "high",
  },
  {
    netuid: 19,
    subnet_name: "NineteenAI",
    stage: "revenue",
    milestone_date: "2025-06-01",
    title: "1B+ tokens/day on OpenRouter paid tier — Rayon Labs inference ecosystem at $4M+ ARR",
    description: "NineteenAI (SN19) is Rayon Labs' decentralized AI inference subnet, serving 1B+ tokens/day via OpenRouter paid tier. Part of Rayon Labs ecosystem (SN19 + SN56 Gradients + SN64 Chutes) collectively generating ~$20M ARR across Bittensor compute subnets. Rayon Labs has ~23.7% of total network emissions. SN19 focuses on LLM and image generation inference API.",
    source_url: "https://www.unsupervised.capital/writing/bittensors-ai-compute-subnets-collectively-reach-20m-arr",
    estimated_arr_usd: 0, // combined with Rayon Labs ecosystem; individual breakdown not public
    confidence: "high",
  },
  {
    netuid: 71,
    subnet_name: "Leadpoet",
    stage: "revenue",
    milestone_date: "2026-02-01",
    title: "$1M ARR — 26 paying B2B customers, 5.4M verified leads, Forbes coverage",
    description: "Leadpoet (SN71) is decentralized B2B sales intelligence — real-time buyer intent detection vs ZoomInfo/Apollo's stale static databases. Built by ex-Nasdaq PMs (CEO Gavin Zaentz, CTO Pranav Ramesh). $1M ARR in Q1 2026, 26 paying enterprise customers (~$38K ACV). 5.4M+ accepted leads (71.6% acceptance rate), 25K+/day output, 7.5M total submitted. 240 miners detect real-time signals (job postings, funding rounds, tech stack changes, competitor engagement). Triple-validator consensus: email deliverability (Truelist), LinkedIn (ScrapingDog), LLM (OpenRouter). Token burn on every lead request creates deflationary flywheel. Launched Oct 2025, beta Dec 2025, paid launch Jan 2026. Forbes coverage Feb 2026. Backed by DSV Fund + Astrid Intelligence (£500K). NVIDIA Inception member.",
    source_url: "https://leadpoet.com/",
    estimated_arr_usd: 1_000_000,
    confidence: "high",
  },
  {
    netuid: 44,
    subnet_name: "Score / Manako",
    stage: "revenue",
    milestone_date: "2025-11-01",
    title: "Manako — enterprise computer vision live, first five-figure MRR, 4 industries, 99% cheaper than AWS Rekognition",
    description: "Score's Manako platform (manako.ai) is the no-code commercial layer on top of Bittensor SN44. Businesses describe detections in plain language — Manako handles the rest across any camera feed. Validated on SoccerNet GSR challenge with GS-HOTA metric (94% per-frame accuracy). Full 90-min match processed in ~2 min for ~$10 vs $10,000+ manually (99% cost reduction, 1,000× speed). Live enterprise deployments: Reading FC (football tactical analytics), major European petroleum company CCTV monitoring (converted 100% after 60-day trial), $5B sports betting syndicate (20% revenue share), Two-a-Day South Africa (fruit packing quality control). First confirmed five-figure monthly recurring invoice Nov 2025. 20% of all commercial revenue directed to SN44 ALPHA buybacks. 283 football leagues + 400K match dataset. Expansion planned: basketball, tennis, security, retail analytics, 2026 World Cup fantasy app. Goldman Sachs veteran appointed chairman. Astrid Intelligence (AQSE:ASTR) publicly highlights SN44 holdings.",
    source_url: "https://www.wearescore.com/",
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
  // ── LIVE PRODUCT (continued) ─────────────────────────────────────
  {
    netuid: 2,
    subnet_name: "Omron",
    stage: "live",
    milestone_date: "2025-03-01",
    title: "zkML proofs in production — Benqi and EigenLayer integrations live",
    description: "Omron (SN2) generates zero-knowledge Proofs of Inference so AI model outputs can be verified trustlessly. Used in production by Benqi protocol and TestMachine. ZK proving time reduced from 15s to 5s via network incentives. MNIST proof under 2 seconds. EigenLayer and EigenCloud integration live. TEE inference also operational.",
    source_url: "https://sn2-docs.inferencelabs.com",
    estimated_arr_usd: 0,
    confidence: "high",
  },
  {
    netuid: 7,
    subnet_name: "SubVortex",
    stage: "live",
    milestone_date: "2025-01-01",
    title: "Bittensor native infrastructure — integrated into BTCLI v8.3, 80+ country exits",
    description: "SubVortex (SN7) is an incentivized network of full Subtensor nodes, decentralizing Bittensor's own network access. Now integrated natively into BTCLI v8.3 as a public endpoint. 80+ country exits, 4 geographically distributed DNS nameservers, zero single point of failure. Used as critical infrastructure by the Bittensor ecosystem.",
    source_url: "https://www.subvortex.com",
    estimated_arr_usd: 0,
    confidence: "high",
  },
  {
    netuid: 12,
    subnet_name: "ComputeHorde",
    stage: "live",
    milestone_date: "2025-06-01",
    title: "Validator compute layer — A6000 GPUs live, scaling Bittensor to 1,000+ subnets",
    description: "ComputeHorde (SN12) transforms untrusted miner GPUs into verified compute resources used by validators on other Bittensor subnets. A6000 hardware class live, A100 coming. Integrated into BTCLI v8.3. Designed to scale Bittensor to 1,000+ subnets by reducing validator compute costs dramatically.",
    source_url: "https://computehorde.io",
    estimated_arr_usd: 0,
    confidence: "high",
  },
  {
    netuid: 14,
    subnet_name: "TAOHash",
    stage: "live",
    milestone_date: "2025-04-01",
    title: "6 EH/s Bitcoin hashrate marketplace — miners earn real BTC via TIDES mechanism",
    description: "TAOHash (SN14) is a Bitcoin hashrate marketplace on Bittensor — miners direct real BTC mining hashpower to validators and earn both direct BTC (via TIDES mechanism) and alpha tokens. Bootstrapped ~6 EH/s ≈ 0.7% of BTC network within weeks of launch. $64.7M peak market cap. Expansion to Kaspa/Dogecoin planned. By Latent Holdings.",
    source_url: "https://taohash.com",
    estimated_arr_usd: 0,
    confidence: "high",
  },
  {
    netuid: 21,
    subnet_name: "FileTAO",
    stage: "live",
    milestone_date: "2025-01-01",
    title: "Hundreds of TBs stored — 5GB free tier, zero-knowledge proof-of-spacetime",
    description: "FileTAO (SN21) is a decentralized file storage network using ZK proof-of-spacetime (Pedersen commitments + Merkle proofs). tensor.storage frontend live with 5GB free tier, one-click deployment, E2E encrypted. 'Petabytes of capacity, hundreds of TBs used' per project.",
    source_url: "https://tensor.storage",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 34,
    subnet_name: "BitMind",
    stage: "live",
    milestone_date: "2025-04-01",
    title: "150K+ weekly deepfake detections — Chrome extension + iOS/Android live, SOC 2 certified",
    description: "BitMind's AI content verification network has 150K+ weekly Chrome extension detections. iOS/Android app launched Apr 2025. 95% accuracy at sub-second response times. SOC 2 compliant. V3 (Epistoola Framework) 3x faster. B2B API licensing path to social platforms for content moderation at scale.",
    source_url: "https://bitmind.ai",
    estimated_arr_usd: 0,
    confidence: "high",
  },
  {
    netuid: 42,
    subnet_name: "Masa",
    stage: "live",
    milestone_date: "2025-06-01",
    title: "176M+ data records — TEE-verified real-time social/financial data, $18M raised",
    description: "Masa (SN42, now rebranded Gopher) is a TEE-verified real-time data platform for finance — X Search, Web Search, X LLM Insights. 176M+ records processed, 1.4M unique users protocol-wide, 48K node operators. Masa corporate entity raised $18M from Animoca, DCG, GoldenTree.",
    source_url: "https://masa.ai",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 52,
    subnet_name: "Dojo",
    stage: "live",
    milestone_date: "2025-09-01",
    title: "V2 GAN-style competitive data annotation live — open platform for human feedback",
    description: "Tensorplex Dojo (SN52) is a decentralized RLHF data annotation platform. V2 introduces competitive GAN-style framework where miners generate AND discriminate outputs — creating a zero-sum improvement loop. Open to non-technical contributors. Live on mainnet.",
    source_url: "https://dojo.tensorplex.ai",
    estimated_arr_usd: 0,
    confidence: "high",
  },
  {
    netuid: 57,
    subnet_name: "Gaia",
    stage: "live",
    milestone_date: "2025-05-01",
    title: "Geospatial AI — 2 papers accepted at EGU25, soil moisture and geomagnetic forecasting live",
    description: "Gaia (SN57) is an earth observation AI subnet with mixture-of-experts models for soil moisture prediction, geomagnetic storm forecasting, and real-time climate analysis. Uses ECMWF, Sentinel-2, SMAP L4, SRTM datasets. Two abstracts accepted at EGU25 European Geosciences Union (May 2025). Partnership with Macrocosmos SN13 for weather data augmentation.",
    source_url: "https://gaiaresearch.ai",
    estimated_arr_usd: 0,
    confidence: "high",
  },
  {
    netuid: 59,
    subnet_name: "Agent Arena",
    stage: "live",
    milestone_date: "2024-12-01",
    title: "88 registered AI agents in first 4 days — $10K MCP hackathon prizes, gamified competition",
    description: "Masa Agent Arena (SN59) is a live AI agent competition platform where miners register Twitter/X agents competing for TAO rewards based on mindshare, engagement, and quality scores. 88 agents registered within first 4 days. $5K MCP integration hackathon prize pool. Platform built on Bittensor.",
    source_url: "https://www.masa.ai/arena",
    estimated_arr_usd: 0,
    confidence: "high",
  },
  {
    netuid: 60,
    subnet_name: "BitSec",
    stage: "live",
    milestone_date: "2025-01-01",
    title: "$275M+ in vulnerabilities found — smart contract auditing live, clients include Virtuals and Lium",
    description: "BitSec (SN60) is an AI-powered smart contract and software vulnerability detection subnet. V2 live. $275M+ in real vulnerabilities identified across Virtuals, Stargaze, and Lium. Products: BitSec Scanner (GitHub repo auditing) and BitSec Hunter (bug bounties). Addressable market framed as $200B software security problem.",
    source_url: "https://bitsec.ai",
    estimated_arr_usd: 0,
    confidence: "high",
  },
  {
    netuid: 65,
    subnet_name: "TPN",
    stage: "live",
    milestone_date: "2025-01-01",
    title: "Decentralized VPN — 80+ country exits, BTCLI integrated",
    description: "TAO Private Network (SN65) is a decentralized VPN with miners running exit nodes globally. 80+ country exits, federation stable. iOS/Android apps in development. Used as privacy infrastructure within the Bittensor ecosystem.",
    source_url: "https://tpn.network",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 82,
    subnet_name: "Hermes",
    stage: "live",
    milestone_date: "2026-01-01",
    title: "SubQuery blockchain indexing on Bittensor — GraphQL queries for AI agents, 20+ chains",
    description: "Hermes (SN82) connects SubQuery's production blockchain indexing infrastructure to Bittensor incentives. Miners answer GraphQL questions across SubQuery projects and The Graph subgraphs — enabling AI agents to query live chain data across Ethereum, Polkadot, Cosmos, and 20+ chains. SubQuery has existing enterprise production customers. Launched Jan 2026. Yuma accelerator backed.",
    source_url: "https://hermes-subnet.ai",
    estimated_arr_usd: 0,
    confidence: "high",
  },
  // ── BETA / EARLY ACCESS ─────────────────────────────────────────
  {
    netuid: 40,
    subnet_name: "Chunking",
    stage: "beta",
    milestone_date: "2025-08-01",
    title: "Document chunking subnet for RAG — VectorChat enterprise product in development",
    description: "Chunking (SN40) breaks documents (text, images, audio) into semantically coherent chunks for RAG applications. VectorChat is both builder and primary consumer. Chunking.com consumer product and Toffee AI assistant in development. Live on mainnet.",
    source_url: "https://chunking.com",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 46,
    subnet_name: "RESI",
    stage: "beta",
    milestone_date: "2025-10-28",
    title: "LOI signed with NextGen — real estate valuation API for DeFi protocols",
    description: "RESI Labs (SN46) is a real estate super-intelligence subnet — decentralized property data collection, appraisal modeling, and API. Letter of Intent signed with NextGen in October 2025 to scale the open real estate database. API pricing ~$0.001/query targeted for DeFi protocol integrations.",
    source_url: "https://www.globenewswire.com/news-release/2025/10/28/3175280/0/en/NextGen-Signs-LOI-with-Resi-Labs-to-Scale-AI-Real-Estate-Subnet-on-Bittensor.html",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 76,
    subnet_name: "SafeScan",
    stage: "beta",
    milestone_date: "2025-06-01",
    title: "AI skin cancer detection — SELFSCAN free app, open-source diagnostic models",
    description: "SafeScan (SN76) is an AI-powered cancer detection subnet focused on skin cancer (melanoma) screening. SELFSCAN free smartphone app for anyone. Miners run diagnostic AI models. Open-source models — the product belongs to everyone. Active alpha token trading on CoinGecko.",
    source_url: "https://safe-scan.ai",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 81,
    subnet_name: "Grail",
    stage: "live",
    milestone_date: "2025-06-01",
    title: "Decentralized LLM post-training — Covenant-72B participant, 4.8% release share",
    description: "Grail (SN81, formerly Patrol by Tensora Group) runs synchronous ~84-second distributed training rounds where miners upload pseudo-gradients to decentralized storage. Participated in Covenant-72B training — the world's largest completed decentralized LLM pretraining (72B params). 4.8% release share. Part of the Covenant AI ecosystem with Templar and Basilica.",
    source_url: "https://subnetalpha.ai/subnet/grail/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 93,
    subnet_name: "Bitcast",
    stage: "revenue",
    milestone_date: "2025-08-01",
    title: "$630K+ brand spend burned, 456K+ subscriber network, 7th in Bittensor emissions — decentralized influencer marketing live",
    description: "Bitcast (SN93) is the first non-AI application on Bittensor — fully automated YouTube influencer marketing verified via YouTube OAuth API. Brands post briefs on-chain, creators produce videos, validators pull real engagement metrics directly. v2.0 launched Aug 2025. Traction: 456K+ subscriber network, 18,600+ verified watch hours, 389+ videos, 20+ active creators across 5 languages. $630K+ worth of alpha tokens burned from brand ad spend (18% of total issued supply permanently removed). 7th highest emissions among all Bittensor subnets. Listed on Bybit, Crypto.com, MEXC. $18.8M market cap. No contracts or agency markups — daily crypto payouts to creators tied directly to verified YouTube Premium Revenue. 60% of all 2025 watch time generated in final 2 months (compounding). DSV Fund: 3 OTC investments totaling $150K+. $20-25B global influencer marketing TAM. Expanding to TikTok, Instagram, X. Self-serve advertiser portal with fiat payments coming.",
    source_url: "https://bitcast.network/",
    estimated_arr_usd: 120_000,
    confidence: "high",
  },
  {
    netuid: 68,
    subnet_name: "MetaNova / NOVA",
    stage: "partnership",
    milestone_date: "2025-11-18",
    title: "TREAT-1 model +79% enrichment factor, DiaGen JV, 4.8M molecules across 7K targets — pharma revenue pipeline live",
    description: "MetaNova (SN68) is a decentralized drug discovery platform using Bittensor incentives to crowdsource virtual screening across a 65B-compound synthesizable molecular search space (SAVI 2020, combinatorial). 4.8M molecules screened, 7,000+ protein targets covered. TREAT-1 fine-tuned model (Nov 2025): +79% enrichment factor improvement vs baseline PSICHIC — raises true binder proportion from ~39.5% to ~70%. MAPE reduced 0.50→0.25. Blueprint track rewards algorithm discovery (not just molecule hits). DiaGen AI JV announced Nov 18, 2025 for automated hit-picking tool. Wet lab CRO validation pipeline active. Revenue: Screening-as-a-Service fees + candidate licensing + model licensing — stated as 'expected in months' late 2025. TWIST Startups live show appearance Mar 2026. Featured in Bittensor official learning hub. Targets therapeutics for mood disorders (DAT/SERT/NET). Appeared at TWIST Startups Mar 2026. Austin, TX team: Micaela Bazo (CEO), Pedro Penna (CSO), Amanda Casadei (CTO).",
    source_url: "https://www.metanova-labs.ai/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 85,
    subnet_name: "Vidaio",
    stage: "beta",
    milestone_date: "2025-04-01",
    title: "Outperforms Topaz in published benchmark — AI video upscaling + 95% compression beta live",
    description: "Vidaio (SN85) is a decentralized AI video processing subnet with two products: (1) AI Upscaling: publicly benchmarked ClipIQA+ score of 0.4697 vs Topaz 0.4658 (leading commercial upscaler), HitPaw 0.3637, FFmpeg 0.4082. Community miners exceed baseline weekly. (2) AI Compression: ~800MB → ~40MB (~95% reduction, content-aware ML codec optimization vs one-size-fits-all encoders). Quality metrics: VMAF (Netflix), CLIP-IQA+, PieAPP, LPIPS, TOPIQ. No-reference scoring for organic user content. Beta live. Enterprise fiat API planned at ~$0.05/min (~75% margins). Founder Gareth Howells: 20+ years Netflix, Disney, Sony, Spotify, Hulu, Pokémon. Planned integrations: Hippius (storage), Soundsight (audio), Score (computer vision), BitMind. $400B TAM. Expansion: adaptive bitrate streaming, P2P CDN, live streaming, colorization.",
    source_url: "https://vidaio.io/",
    estimated_arr_usd: 0,
    confidence: "high",
  },
  {
    netuid: 88,
    subnet_name: "Mobius Fund / Investing",
    stage: "live",
    milestone_date: "2025-12-01",
    title: "88 Quant Fund live — 92.39% return / 2.24% drawdown, US equities + TAO staking phases active",
    description: "Mobius Fund (SN88) is the world's first decentralized AUM platform — crowdsources investment strategies from global miners (human + AI), validates via proprietary scoring (MAR × LSR × odds% × daily%), aggregates into investment products. Phase I (April 2025): TAO/Alpha staking optimization across Bittensor subnets. Phase II (July 2025): US equities via NYSE/NASDAQ Market on Open/Close execution. 88 Quant Fund launched Dec 2025 via TrustedStake (non-custodial). Live performance: 92.39% return / 2.24% drawdown over 3 months (ensemble, self-reported); 12.95% in 17 days pre-launch; 1.16% drawdown on NYE 'black swan'. AUM: 1,400+ TAO. Ensemble model uses MPT + CAPM diversification over top miner outputs. KYM (Know Your Miner) zero-code interface. Also operates HODL ETF (SN118). Revenue: AUM management fees + signal sales + TAO emissions. $145 trillion global AUM TAM.",
    source_url: "https://github.com/mobiusfund/investing",
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
  score: number;                                                         // 0–80 AI-rated or keyword score
  signals: string[];                                                     // e.g. ["live_product", "revenue", "api"]
  stage?: "revenue" | "live" | "beta" | "waitlist" | "research" | "unknown"; // AI-detected stage
  summary?: string;                                                      // AI one-sentence description
  ai_scored?: boolean;
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
  // If AI scored it, apply a stage bonus so "revenue" sites rank above "waitlist" even
  // if the raw keyword count happened to be similar.
  let websiteScore = websiteData?.score ?? 0;
  if (websiteData?.ai_scored && websiteData.stage) {
    const stageFloor: Record<string, number> = {
      revenue: 60,   // AI said they're charging customers — floor at 60
      live:    45,   // AI confirmed live product — floor at 45
      beta:    30,   // AI confirmed beta — floor at 30
      waitlist: 15,
      research: 10,
      unknown: 0,
    };
    websiteScore = Math.max(websiteScore, stageFloor[websiteData.stage] ?? 0);
  }

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
