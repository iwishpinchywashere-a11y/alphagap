// src/lib/benchmarks.ts
// Bittensor subnet benchmark data vs centralized AI providers
// Source: AlphaGap Benchmark Integration (April 3, 2026)
// Data from: taoflute.com, taostats.io, subnetalpha.ai, subnet documentation

export interface BenchmarkDashboard {
  url: string;
  label: string;   // short display label e.g. "Stats Dashboard", "Tokenomics"
}

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
  dashboards?: BenchmarkDashboard[];   // official live stats/analytics pages
}

export const BENCHMARK_DATA: BenchmarkEntry[] = [
  {
    subnet_id: 64,
    subnet_name: "Chutes",
    benchmark_score: 95,
    benchmark_category: "AI Compute",
    vs_provider: "AWS Lambda / Google Cloud AI",
    cost_saving_pct: 85,
    perf_delta: "85% cheaper than AWS Lambda; #1 provider on OpenRouter by traffic; 120B tokens/day peak; 9.1T total tokens processed",
    benchmark_summary: "85% cheaper than AWS Lambda; 10x faster startup (200ms vs 2s+); peaked at ~120B tokens/day; 400K+ users; 9.1T tokens processed. #1 provider on OpenRouter by traffic volume. TAO Institute Verified on SubnetRadar: $1.41M 90-day revenue → ~$4.2M ARR (range: $3.7M–$5.5M). Unsupervised Capital independently cited $4.3M ARR (late 2025). Fiat payments launched. Llama 4 models added. Part of Rayon Labs trio (SN19 + SN56 + SN64).",
    active_users: "400K+",
    annual_revenue_usd: 4200000,
    last_updated: "2026-05-25",
    sources: [
      "https://subnetalpha.ai/subnet/chutes/",
      "https://www.unsupervised.capital/writing/bittensors-ai-compute-subnets-collectively-reach-20m-arr",
      "https://subnetradar.com/revenue",
    ],
    dashboards: [
      { url: "https://chutes.ai/app/research", label: "Network Stats" },
      { url: "https://chutes.ai/app/research/utilization", label: "Utilization" },
    ],
  },
  {
    subnet_id: 51,
    subnet_name: "lium.io",
    benchmark_score: 96,
    benchmark_category: "AI Compute",
    vs_provider: "RunPod / Vast.ai / AWS EC2 GPU",
    cost_saving_pct: 90,
    perf_delta: "$5.2M ARR — revenue now exceeds TAO emissions subsidy; B200 GPUs in stock",
    benchmark_summary: "90% price reduction vs RunPod/Vast.ai; 45% compute efficiency improvement; hardware-level GPU optimization supporting H100/A100/AMD MI200 and B200. Revenue ~$432K/month (~$5.2M ARR) — one of the only Bittensor subnets where external demand outpaces emissions subsidy. 500+ H100s on-platform. B200 access when other providers are sold out. Agent-first GPU network pivot timed with the 2026 agentic AI wave. Fiat payments via Coinbase. Subnet 3 (Templar) relaunch drove lium revenue up 20%.",
    active_users: "500+ enterprise & developer customers",
    annual_revenue_usd: 5200000,
    last_updated: "2026-05-15",
    sources: [
      "https://x.com/lium_io/status/2048817703079796963",
      "https://x.com/SiamKidd/status/1958114027281797216",
      "https://x.com/lium_io/status/2045540119952695455",
      "https://www.youtube.com/watch?v=xftMhCMOf-4",
    ],
  },
  {
    subnet_id: 4,
    subnet_name: "Targon",
    benchmark_score: 88,
    benchmark_category: "AI Compute",
    vs_provider: "CoreWeave / AWS Confidential Compute",
    cost_saving_pct: 50,
    perf_delta: "$10.4M/yr revenue — 20B+ paid inference tokens/day, 1,500+ H200s, $10.5M Series A",
    benchmark_summary: "Highest-revenue compute subnet at $10.4M/yr; TEE-based confidential GPU inference via Intel TDX (joint Intel white paper March 2026); $70M+ NVIDIA-certified hardware; 1,500+ H200s; 20B+ paid inference tokens/day; 4M–8.6M users via Dippy. $10.5M Series A (OSS Capital + DCG + Tobias Lütke, Shopify CEO + Ram Shriram). Intel co-authored white paper on decentralized compute with Intel TDX. Series A validates institutional confidence in the TEE compute model.",
    active_users: "4M–8.6M (via Dippy)",
    annual_revenue_usd: 10400000,
    last_updated: "2026-05-15",
    sources: [
      "https://www.manifold.inc/releases/series-a-announcement",
      "https://oss.capital/oss-capital-leads-10-5m-series-a-in-manifold-labs-alongside-industry-legends/",
      "https://ownyourmind.ai/tokenomics/targon-bittensor-confidential-compute/",
    ],
    dashboards: [
      { url: "https://stats.targon.com/", label: "Live Stats" },
    ],
  },
  {
    subnet_id: 22,
    subnet_name: "DeSearch",
    benchmark_score: 80,
    benchmark_category: "Data & Intelligence",
    vs_provider: "OpenAI Search / Perplexity / Google Search AI",
    cost_saving_pct: 60,
    perf_delta: "Beats OpenAI & Perplexity on search relevance (92.57% vs ~85%)",
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
    benchmark_score: 72,
    benchmark_category: "Developer Tools",
    vs_provider: "GitHub Copilot / Claude Code / Codex",
    cost_saving_pct: 95,
    perf_delta: "Merged with Latent Holdings Feb 2026 — $12/mo AI coding subscription; SWE-bench methodology revised",
    benchmark_summary: "AI coding assistant with Cursor/VS Code extension at $12/month. Merged with Latent Holdings in February 2026 (combining Ridges' subnet expertise with Latent's go-to-market capabilities). SWE-bench score previously cited at 66-69% — methodology has since changed significantly with Polyglot evaluation; current score ~41%. External revenue: no confirmed public figure as of May 2026 (taorevenue.com shows deficit vs. emissions). The $600K ARR previously cited is unconfirmed. Investors: Stillcore Capital, DSV Fund. Watch for post-merger commercialization results.",
    active_users: "Enterprise devs",
    annual_revenue_usd: 0,
    last_updated: "2026-05-25",
    sources: [
      "https://www.lbank.com/price/ridges-ai",
      "https://x.com/Mars_DeFi/status/2038861707762901286",
      "https://taodaily.io/revenue-search-54-surprise-appearance-by-shak-from-ridges-sn62/",
    ],
  },
  {
    subnet_id: 75,
    subnet_name: "Hippius",
    benchmark_score: 66,
    benchmark_category: "Storage",
    vs_provider: "AWS S3 / Google Cloud Storage",
    cost_saving_pct: 60,
    perf_delta: "60% cheaper than AWS S3 — $0.003/GB/month; S3-compatible + IPFS; MEXC listed Oct 2025",
    benchmark_summary: "AWS S3 equivalent at fraction of cost; IPFS + S3-compatible API; transparent on-chain pricing at $0.003/GB/month (29-48× cheaper than AWS/Google). 900 TB aggregate capacity within weeks of launch (March 2025). Fiat + Bittensor payments. MEXC listed October 2025. Note: the '$4.48M realized PnL' metric reflects alpha token performance, not external service revenue. External customer demand pipeline described as 'soon open to external demand.'",
    active_users: "Enterprise",
    annual_revenue_usd: 0,
    last_updated: "2026-05-15",
    sources: [
      "https://simplytao.ai/blog/your-simple-guide-to-hippius-sn75",
    ],
    dashboards: [
      { url: "https://hipstats.com/", label: "Network Stats" },
    ],
  },
  {
    subnet_id: 50,
    subnet_name: "Synth",
    benchmark_score: 84,
    benchmark_category: "Finance & Trading",
    vs_provider: "Polymarket Research / Refinitiv / Traditional Quant Desks",
    cost_saving_pct: 80,
    perf_delta: "Polymarket account 20x in 10 weeks ($3K→$73K); LLM for Traders live; 4 DeFi integrations",
    benchmark_summary: "LLM for Traders launched (converts Monte Carlo forecasts to natural language trade stats + charts). Live integrations: Polymarket, Hyperliquid, Limitless, Deribit. Polymarket test account grew $3K → $73K in ~10 weeks (20x) as proof-of-concept. Tokenized equity coverage: BTC, ETH, SOL, XAU, TSLAX, AAPLX, GOOGLX, SPYX, NVDAX at 1h/24h horizons. 200+ ML models competing. $6M Optimism Foundation grant. First Bittensor subnet with agentic x402 payments. Monte Carlo simulation paths across 9 assets.",
    active_users: "Institutional traders",
    annual_revenue_usd: 0,
    last_updated: "2026-05-15",
    sources: [
      "https://www.synthdata.co/",
    ],
  },
  {
    subnet_id: 56,
    subnet_name: "Gradients",
    benchmark_score: 70,
    benchmark_category: "AI Training",
    vs_provider: "AWS EC2 / Google Cloud TPU",
    cost_saving_pct: 83,
    perf_delta: "$5/hr vs $30-60/hr centralized",
    benchmark_summary: "AI model training for $5/hour vs AWS/GCP H100 at $30-60/hour; adopted by life sciences; part of Rayon Labs ecosystem (SN19 + SN56 + SN64). No confirmed external revenue figure as of May 2026 — the $240K/yr previously cited had no public source. Transparent pricing and functional product but commercial traction is not publicly disclosed.",
    active_users: "Life sciences",
    annual_revenue_usd: 0,
    last_updated: "2026-05-25",
    sources: [
      "https://www.ainvest.com/news/decentralized-ai-rising-cost-efficiency-network-growth-bittensor-subnet-62-2509/",
    ],
  },
  {
    subnet_id: 71,
    subnet_name: "Leadpoet",
    benchmark_score: 80,
    benchmark_category: "Data & Intelligence",
    vs_provider: "ZoomInfo / Apollo.io / Clearbit",
    cost_saving_pct: 70,
    perf_delta: "$1M ARR in first quarter — real-time intent data vs stale databases",
    benchmark_summary: "Decentralized real-time buyer intent detection — 240 miners scrape fresh signals (job postings, funding rounds, tech stack changes, competitor engagement) vs ZoomInfo/Apollo's stale static databases. 5.4M+ verified leads accepted (71.6% acceptance rate), 25K+ leads/day. Triple-validator consensus (email deliverability + LinkedIn validation + LLM verification). $1M ARR in first quarter post-launch — 26 paying B2B customers at ~$38K ACV. Forbes coverage Feb 2026. Deflationary token burn on every lead request. 7.5M total leads generated in under 6 months. Forbes coverage Feb 2026 ('AI-Driven Intent Data Gains Traction'). NVIDIA Inception accelerator member. 2M leads in 2 additional weeks (parabolic growth from 1M). Backed by DSV Fund + Astrid Intelligence.",
    active_users: "26 B2B enterprise customers",
    annual_revenue_usd: 1_000_000,
    last_updated: "2026-05-15",
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
    benchmark_category: "Media & Creative",
    vs_provider: "Topaz Video AI / AWS Elemental MediaConvert / HitPaw",
    cost_saving_pct: 80,
    perf_delta: "Beats Topaz on video quality (0.4697 vs 0.4658); 95% file size cut",
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
    benchmark_category: "Finance & Trading",
    vs_provider: "BlackRock / Bridgewater / Traditional Hedge Funds",
    cost_saving_pct: 60,
    perf_delta: "92% return / 2.2% drawdown in 3 months — decentralized quant fund",
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
    benchmark_score: 72,
    benchmark_category: "Science & Research",
    vs_provider: "Schrödinger / BioNTech AI / Insilico Medicine",
    cost_saving_pct: 90,
    perf_delta: "+79% drug screening accuracy — 65B molecule search space",
    benchmark_summary: "Decentralized drug discovery platform running on Bittensor SN68. 4.8M molecules screened across 7,000+ protein targets. Combinatorial expansion from SAVI 2020 (1.75B synthesizable compounds) to 65B search space — impossible at any single centralized lab. TREAT-1 fine-tuned model: +79% enrichment factor improvement (39.5% → ~70% true binders in screened sets; MAPE reduced 0.50→0.25). Average drug costs $2.6B and takes 10+ years — NOVA targets 50% cost reduction. Timelock encryption ensures fair miner competition. DiaGen AI JV (Nov 2025) for hit-picking tool. Wet lab validation pipeline with CRO partners. Revenue model: Screening-as-a-Service + licensing validated candidates + model licensing. February 2026 milestone: NOVA Blueprint 'massively outperforms Thompson Sampling on hard oncology target' (PBX1 transcription factor). Submission API launched with miner privacy protections. Three live competitions: molecule screening, nanobody design, search optimization. Wet lab validation pipeline with CRO partners in progress.",
    active_users: "Researchers + pharma/biotech pipeline",
    annual_revenue_usd: 0,
    last_updated: "2026-05-15",
    sources: [
      "https://www.metanova-labs.ai/",
      "https://subnetalpha.ai/subnet/nova/",
      "https://github.com/metanova-labs/nova",
    ],
  },
  {
    subnet_id: 93,
    subnet_name: "Bitcast",
    benchmark_score: 85,
    benchmark_category: "Media & Creative",
    vs_provider: "Traditional Ad Agencies / Creator.co / AspireIQ",
    cost_saving_pct: 65,
    perf_delta: "No contracts, no agencies — daily on-chain payouts to creators tied to verified YouTube Premium Revenue",
    benchmark_summary: "5.14M+ combined subscriber/follower network across YouTube and Stitch3 (X). ~$630K worth of SN93 alpha tokens burned (18% of issued supply). Bitget (crypto exchange) confirmed as paying brand client. Performance-based model: brands pay only for verified reach. YouTube audience grew 66% in April 2026. Self-serve advertiser portal and fiat payment support (roadmap May 2026). Decentralized content marketing protocol on Bittensor — brands post briefs on-chain, creators produce YouTube/X content, validators score via YouTube OAuth API. Weekly on-chain buybacks from revenue. Listed on Bybit, Crypto.com, MEXC. External customer revenue: not confirmed publicly as of May 2026 — revenue model only launched Q4 2025. $20-25B global influencer marketing TAM.",
    active_users: "378+ creators, 5.14M+ combined subscriber/follower network",
    annual_revenue_usd: 0,
    last_updated: "2026-05-25",
    sources: [
      "https://stats.bitcast.network/",
      "https://bitcast.network/",
      "https://subnetalpha.ai/subnet/bitcast/",
      "https://github.com/bitcast-network/bitcast",
    ],
    dashboards: [
      { url: "https://stats.bitcast.network/", label: "Creator Stats" },
    ],
  },
  {
    subnet_id: 44,
    subnet_name: "Score / Manako",
    benchmark_score: 88,
    benchmark_category: "Robotics & Vision",
    vs_provider: "Google Video Intelligence API / AWS Rekognition / Manual Video Annotation",
    cost_saving_pct: 99,
    perf_delta: "PwC France alliance (136 countries) + Paris Blockchain Week 2026 winner — 90-min match for $10 vs $10K manual",
    benchmark_summary: "Score's Manako platform processes a full 90-min football match in ~2 min for ~$10 vs $10,000+ with manual annotation (99%+ cost reduction). PwC France & Maghreb alliance (April 15, 2026) — Manako integrated into PwC's AI advisory practice across 136 countries (retail, logistics, manufacturing, energy). Won 1st place Paris Blockchain Week Start In Block 2026 (beat 1,000+ startups). 94% per-frame accuracy on SoccerNet GSR challenge. Enterprise clients: Reading FC (tactical analytics), major European petroleum company (gas station CCTV), $5B sports betting syndicate (20% revenue share). Revenue Search podcast (May 2026): $150K/month enterprise client confirmed — ~$1.8M ARR from that client alone. 100% trial-to-paid conversion rate. 20% of all commercial revenue directed to SN44 alpha buybacks.",
    active_users: "4+ enterprise clients",
    annual_revenue_usd: 1200000,
    last_updated: "2026-05-25",
    sources: [
      "https://www.wearescore.com/",
      "https://manako.ai/",
      "https://subnetalpha.ai/subnet/score/",
      "https://github.com/score-technologies/score-vision",
      "https://x.com/MaxScore/status/2042322226683220213",
      "https://simplytao.ai/blog/score-sn44-manako-pwc-france-alliance-enterprise-physical-ai",
      "https://simplytao.ai/blog/score-sn44-wins-paris-blockchain-week-start-in-block-2026",
    ],
  },
  {
    subnet_id: 32,
    subnet_name: "It's AI",
    benchmark_score: 78,
    benchmark_category: "Security & Trust",
    vs_provider: "GPTZero / Originality.ai / CopyLeaks",
    cost_saving_pct: 65,
    perf_delta: "#1 AI text detector globally — 92%+ ROC-AUC, beats GPTZero",
    benchmark_summary: "#1 ranked AI-generated text detector on the MGTD benchmark (ICAIE 2025) with 92%+ ROC-AUC — outperforming GPTZero, Originality.ai, and CopyLeaks. 22K+ monthly visits (10× growth since Nov 2024). Web app, Chrome extension, and developer API all live. Revenue-generating via subscriptions. Bittensor incentives continuously improve detection accuracy.",
    active_users: "22K+ monthly visits",
    annual_revenue_usd: 150000,
    last_updated: "2026-04-07",
    sources: [
      "https://its-ai.org",
      "https://app.its-ai.org",
    ],
  },
  {
    subnet_id: 72,
    subnet_name: "StreetVision",
    benchmark_score: 58,
    benchmark_category: "Computer Vision / Mapping Intelligence",
    vs_provider: "Google Street View / Mapillary computer-vision pipelines, Nexar, or a cloud vision API (AWS Rekognition, Google Vision)",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "StreetVision (SN72): A Bittensor subnet by NATIX Network for street-level image classification and object detection. Miners deploy vision models (e.g. binary classifiers that detect roadwork/construction sites) against balanced datasets of real and synthetic street imagery; validators score them on accuracy. Models are published to Hugging Face and decay after ~90 days to force continuous improvement, feeding NATIX's crowdsourced mapping/DePIN dataset. Ties an open model-improvement competition to NATIX's existing drive-to-earn dashcam network, with time-decaying model validity that forces miners to keep beating the state of the art rather than parking a one-time model. Revenue: No independently verified subnet revenue figure found. NATIX operates a broader DePIN business (drive-to-earn, mapping data sales) but subnet-attributable revenue is unverified.. Caveats: Repo commit cadence slowed (last push May 2026 vs today 2026-07-21). No third-party accuracy benchmark published for the subnet's detectors..",
    active_users: "No independently verified subnet revenue figure found. NATIX operates a broader DePIN business (drive-to-earn, mapping data sales) but subnet-attributable revenue is unverified.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/natixnetwork/streetvision-subnet",
      "https://api.github.com/repos/natixnetwork/streetvision-subnet",
      "https://www.natix.network"
    ],
  },
  // ── APRIL 2026 RESEARCH SWEEP — 43 NEW ENTRIES ───────────────────
  {
    subnet_id: 41,
    subnet_name: "Almanac",
    benchmark_score: 60,
    benchmark_category: "Prediction Markets / Sports Forecasting",
    vs_provider: "Polymarket / sportsbooks (bookmaker odds)",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Almanac (SN41): An information-incentivization layer for prediction markets (built by the Sportstensor team). Miners run ML models that forecast sports and event outcomes; validators sync match data and score each miner's edge versus market odds. Almanac is the consumer-facing terminal that surfaces these aggregated forecasts. The subnet announced a partnership positioning Almanac as a layer on top of Polymarket, letting users mine via a web app without running code. Darwinian competition network that aggregates many independent forecasters into a meta-model scored on real edge vs market prices, plumbed directly into prediction-market liquidity (Polymarket) rather than a walled bookmaker. Revenue: No hard revenue figures disclosed. Real strategic partnership with Polymarket (announced Sep 2025) gives a plausible distribution/monetization path; up-to-$100k weekly reward pool advertised.. Caveats: Prediction/betting exposure carries regulatory risk. Advertised reward numbers are marketing, not audited. No third-party accuracy benchmark published..",
    active_users: "No hard revenue figures disclosed. Real strategic partnership with Polymarket (announced Sep 2025) gives a plausible distribution/monetization path; up-to-$100k weekly reward pool advertised.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/sportstensor/sn41",
      "https://almanac.market",
      "https://docs.sportstensor.com",
      "https://x.com/sportstensor/status/1968037908029505968"
    ],
  },
  {
    subnet_id: 58,
    subnet_name: "Greevils",
    benchmark_score: 57,
    benchmark_category: "Autonomous Trading",
    vs_provider: "Quant hedge funds / prop trading firms and copy-trading platforms",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Greevils (SN58): Subnet where autonomous trading agents and human traders compete head-to-head on live crypto markets with real capital. Agents run in Confidential Space TEEs with encrypted code and trade-only keys, taking real positions on Hyperliquid perps; a unified leaderboard ranks agents and humans on five risk-adjusted metrics with daily on-chain settlement. Sealed TEE execution (agent code encrypted, keys can trade but not withdraw), real Hyperliquid positions rather than paper trading, and a single ranking pool where humans and AI agents compete on risk-adjusted metrics with heavy drawdown penalties and a $1,000 equity elimination floor. Revenue: Humans earn up to 10% of trading profits (max 50% per round); agent emissions are the dominant incentive pool and unclaimed emissions burn. No platform fee/revenue disclosed. Live web terminal at app.greevils.ai.. Caveats: Team anonymous; young repo (created mid-June 2026, 21 commits, no releases); real-capital trading carries user financial risk; leaderboard metrics self-hosted (no independent audit); fee/revenue model unstated..",
    active_users: "Humans earn up to 10% of trading profits (max 50% per round); agent emissions are the dominant incentive pool and unclaimed emissions burn. No platform fee/revenue disclosed. Live web terminal at app.greevils.ai.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/greevils-ai/greevils-cli",
      "https://www.greevils.ai/",
      "https://bittensor.ai/subnets"
    ],
  },
  {
    subnet_id: 13,
    subnet_name: "Gravity / Data Universe",
    benchmark_score: 75,
    benchmark_category: "Data & Intelligence",
    vs_provider: "Brandwatch / Bright Data / Diffbot / Sprinklr",
    cost_saving_pct: 80,
    perf_delta: "55B+ rows scraped — 10.79% of all Hugging Face datasets",
    benchmark_summary: "Data Universe (SN13) is the world's largest open-source social media dataset — miners continuously scrape X/Twitter, Reddit, and YouTube transcripts. Gravity is the commercial product layer where customers specify data requirements and pay on delivery. 55B+ rows scraped (10.79% of all Hugging Face datasets). Early paying customers confirmed Q1 2025. Powers downstream Bittensor subnets (SN5, SN6). Built by Macrocosmos.",
    active_users: "Paying API customers",
    annual_revenue_usd: 100000,
    last_updated: "2026-04-07",
    sources: ["https://macrocosmos.ai/"],
    dashboards: [
      { url: "https://sn13-dashboard.api.macrocosmos.ai/", label: "Data Universe" },
    ],
  },
  {
    subnet_id: 6,
    subnet_name: "Numinous (Eversight)",
    benchmark_score: 70,
    benchmark_category: "Finance & Trading",
    vs_provider: "Metaculus / Polymarket aggregators / Superforecaster platforms",
    cost_saving_pct: 60,
    perf_delta: "Superhuman prediction ensemble — Nous Research raised $50M at $1B val",
    benchmark_summary: "Numinous (SN6) aggregates hundreds of competing AI forecasting agents into superhuman predictive intelligence across prediction markets, geopolitics, sports, and macro. Consumer product Eversight is a chat/API for Polymarket traders and hedge funds. Nous Research (formerly on SN6) raised $50M Series A led by Paradigm at $1B valuation (April 2025) — Hermes 3 open-source LLM has 50M+ downloads. Eversight hedge fund API access in early revenue stage.",
    active_users: "Hedge fund + trader API users",
    annual_revenue_usd: 50000,
    last_updated: "2026-04-07",
    sources: ["https://www.tao.app/subnets/6"],
  },
  {
    subnet_id: 45,
    subnet_name: "AlphaRidge.ai",
    benchmark_score: 55,
    benchmark_category: "Market Intelligence / Financial NLP",
    vs_provider: "Bloomberg Terminal news analytics, RavenPack, AlphaSense, or Kaito-style social-signal platforms",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "AlphaRidge.ai (SN45): A real-time market-intelligence subnet that reads the global conversation across markets (equities, FX, crypto, commodities, indices) from 1,000+ news sources plus X and Telegram. A staged pipeline has multiple independent miner models score each item for sentiment, impact, market outlook, classification, signal quality, entity/asset mapping, economic data points and cross-market contagion; validators verify work and consensus becomes the final structured, screenable signal. Uses decentralized multi-model consensus with validator verification (miners paid only for verified work) instead of a single vendor's proprietary model, aiming for harder-to-game, auditable signals across many asset classes at once. Revenue: No verified revenue. Docs assert miners earn above operating cost for verified work, but no signal-accuracy or P&L benchmark is published.. Caveats: No named team and no public brand/X presence for a financial-signals product (trust-sensitive domain). No third-party benchmark of signal quality. Netuid 45 was recycled onto AlphaRidge. Note: some search results conflate SN45 with a Bittensor-specific social-post subnet - AlphaRidge's own repo describes broad multi-market financial intelligence..",
    active_users: "No verified revenue. Docs assert miners earn above operating cost for verified work, but no signal-accuracy or P&L benchmark is published.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/Team-Rizzo/alpharidge-ai",
      "https://api.github.com/repos/Team-Rizzo/alpharidge-ai",
      "https://alpharidge.ai"
    ],
  },
  {
    subnet_id: 87,
    subnet_name: "Provenonce (Proof of Assurance)",
    benchmark_score: 38,
    benchmark_category: "AI Verification / Agentic Infrastructure",
    vs_provider: "Centralized AI observability / eval & audit-trail platforms (LangSmith, Galileo, Arize)",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Provenonce (Proof of Assurance) (SN87): Provenonce is building 'Proof of Assurance' — a Bittensor subnet for verified AI execution. A 'Canonical Path Contract' specifies a task and the expected evidence before execution; miners run the workflow and produce structured 'Evidence Bundles'; validators score the evidence against requirements to produce an 'Assurance Score' that drives rewards. Positioned as a trust/coordination layer so agentic systems can operate safely across platforms without data-custody or lock-in. Explicitly limited to structured workflows (does not claim universal AI verification). Turns structured workflow execution into on-chain-scored evidence with predefined requirement contracts; incentivized, multi-miner verification of the same workflow so only verified complete execution earns a high score. Revenue: No revenue. Raised ~300 TAO in a Proof of Pitch live crowdfund (runner-up) at Proof of Talk, Paris; partnering with Bitstarter Ltd. to explore path to launch.. Caveats: Reads as pre-launch concept, not a fully operational subnet — described repeatedly as a 'subnet concept' still 'exploring the path to launch'. No GitHub, no code, no benchmarks, no verified subnet X handle. netuid 87 appears recycled/renamed. Could not confirm live mainnet product matches the Proof of Assurance pitch..",
    active_users: "No revenue. Raised ~300 TAO in a Proof of Pitch live crowdfund (runner-up) at Proof of Talk, Paris; partnering with Bitstarter Ltd. to explore path to launch.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://provenonce.ai/",
      "https://provenonce.ai/proofoftalk"
    ],
  },
  {
    subnet_id: 54,
    subnet_name: "Yanez MIID",
    benchmark_score: 67,
    benchmark_category: "Security & Trust",
    vs_provider: "Jumio / Onfido / Socure adversarial testing tools",
    cost_saving_pct: 85,
    perf_delta: "$900K seed oversubscribed — adversarial KYC data for banks",
    benchmark_summary: "Yanez MIID (SN54) is a decentralized adversarial identity data generation platform — creates synthetic deepfake identities and adversarial biometric patterns that banks and IDV companies use to stress-test fraud detection systems. Closed $900K Seed Part A in July 2025 (target $600K — 50% oversubscribed). Led by Jose Caldera and Asem Othman. Mainnet May 2025. B2B customers: banks, IDV companies, compliance vendors. $3B+ KYC/AML market.",
    active_users: "B2B compliance customers",
    annual_revenue_usd: 0,
    last_updated: "2026-04-07",
    sources: ["https://www.yanezcompliance.com/"],
  },
  {
    subnet_id: 84,
    subnet_name: "ChipForge",
    benchmark_score: 45,
    benchmark_category: "Decentralized Chip / Silicon Design",
    vs_provider: "Traditional EDA design flow (Cadence/Synopsys)",
    cost_saving_pct: 0,
    perf_delta: "Designs are objectively scored by EDA tools (Verilator/Yosys/OpenLane) on functionality, timing, power and area; the competition mechanic itself is the benchmark",
    benchmark_summary: "ChipForge (SN84): ChipForge is a decentralized hardware-design subnet where miners compete to design real silicon. On-chain challenges publish Verilog/SystemVerilog spec problems (AI accelerators, cryptographic modules, mini-GPUs, RISC-V cores). Miners submit hardware designs; validators run industry-standard EDA toolchains (Verilator, Yosys, OpenLane) to automatically score functionality, timing, power and area. Built on the TATSU ecosystem; a RISC-V core with crypto features has already been completed. First digital-design subnet; turns silicon design into verifiable on-chain challenges scored by real EDA toolchains, letting a global pool of engineers/AI compete on measurable PPA (power/performance/area). Revenue: Early-stage; value via emissions/alpha token and potential IP from winning designs. On-chain identity shows 'Unknown' (unset) but subnet is actively traded with real market cap.. Caveats: On-chain identity is 'Unknown' (owner has not set the identity string). Smaller/newer project with modest GitHub traction (2 stars) and much of the visibility from PR-style coin-news articles; core repo and docs are genuine, so identity is confident even if traction is early..",
    active_users: "Early-stage; value via emissions/alpha token and potential IP from winning designs. On-chain identity shows 'Unknown' (unset) but subnet is actively traded with real market cap.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://taostats.io/subnets/84",
      "https://github.com/TatsuProject/ChipForge_SN84",
      "https://subnetalpha.ai/subnet/chipforge/",
      "https://coinpaper.com/13297/chip-forge-the-bittensor-subnet-where-better-chips-win-literally",
      "https://www.kucoin.com/news/flash/chipforge-aims-to-revolutionize-edge-ai-chip-development-with-decentralized-design-model"
    ],
  },
  {
    subnet_id: 95,
    subnet_name: "Actual Computer",
    benchmark_score: 66,
    benchmark_category: "AI Compute",
    vs_provider: "CoreWeave / AWS SageMaker / Modal",
    cost_saving_pct: 75,
    perf_delta: "Jack Clark (Anthropic co-founder) signal — enterprise AI agents on Bittensor",
    benchmark_summary: "Actual Computer (SN95) provides high-performance AI inference software and distributed computing solutions for enterprise AI deployment via decentralized Bittensor compute. Token surged 110%+ since October 23, 2025 launch. Followed by Jack Clark (Anthropic co-founder) on X — notable credibility signal. CEO Tom A. Lynch, Venice CA. Described as 'The Quietest High-Conviction Bet on Bittensor' by SubnetEdge. Addresses the $40B+ AI inference and enterprise MLOps market projected by 2030.",
    active_users: "Enterprise AI teams",
    annual_revenue_usd: 0,
    last_updated: "2026-04-07",
    sources: ["https://actual.inc/"],
  },
  {
    subnet_id: 17,
    subnet_name: "404-GEN (Three Gen)",
    benchmark_score: 70,
    benchmark_category: "Media & Creative",
    vs_provider: "Luma AI / Meshy / Stability AI 3D / Masterpiece Studio",
    cost_saving_pct: 90,
    perf_delta: "21.5M+ 3D models — world's largest open-source 3D dataset",
    benchmark_summary: "404-GEN (SN17) is a decentralized text-to-3D generation network where miners produce 3D models (Gaussian Splatting, NeRF, 3D Diffusion) from text prompts. Unity Plugin (v0.4.0) published to Unity Asset Store — first blockchain-based 3D gen plugin on the Store. Blender add-on (v0.9.0) live. 21.5M+ AI-generated 3D models produced — world's largest open-source 3D dataset. Launched April 2024. Covered by VentureBeat, GamesBeat. Targets the $200B+ gaming and VR/AR content creation market.",
    active_users: "Game/VR/AR developers",
    annual_revenue_usd: 0,
    last_updated: "2026-04-07",
    sources: ["https://github.com/404-Repo/three-gen-subnet"],
  },
  {
    subnet_id: 24,
    subnet_name: "Quasar",
    benchmark_score: 45,
    benchmark_category: "Science",
    vs_provider: "Closed long-context frontier models (Google Gemini, OpenAI GPT long-context)",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Quasar (SN24): A decentralized training subnet that continues pretraining Quasar, an open long-context foundation model that replaces quadratic attention with linear-scaling continuous-time attention. Miners contribute GPU compute to train the model and validators verify work; released weights are open under Apache 2.0 on Hugging Face. Quasar uses linear continuous-time attention aiming to handle millions of tokens at a fraction of the compute, and trains on Bittensor's distributed miner network rather than a central cluster. Every model ships with full open weights under Apache 2.0, no waitlist or gating. Revenue: unknown/pre-revenue — open-weights research model, no product revenue. Caveats: Bold architecture claims (linear attention, 'millions of tokens') with no published benchmarks or third-party evaluation. Subnet training repo is thin (6 commits) and last pushed ~1 month ago. Current model is small (3B total / 1B active) and 'Preview' stage..",
    active_users: "unknown/pre-revenue — open-weights research model, no product revenue",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/SILX-LABS/QUASAR-SUBNET/",
      "https://silxinc.com/",
      "https://huggingface.co/silx-ai/Quasar-Preview",
      "https://x.com/QuasarModels"
    ],
  },
  {
    subnet_id: 91,
    subnet_name: "Cascade",
    benchmark_score: 46,
    benchmark_category: "Time-Series Foundation Models",
    vs_provider: "Amazon Chronos / Google TimesFM / Nixtla TimeGPT",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Cascade (SN91): A Bittensor subnet where the neural architecture is held byte-identical across all participants and the only competitive variable is each miner's synthetic-data generator, isolating and rewarding data quality for training time-series forecasting foundation models. Miners/trainers/validators compete in daily ~24h rounds. Fixes the model (Toto2-4M) byte-for-byte so the synthetic data generator is the sole variable, turning data-quality into a directly measurable, competable quantity. Revenue: No revenue; pre-product research subnet, incentive is TAO emissions only.. Caveats: Website is testnet-only, near-zero GitHub traction, no team identity, no third-party validated results yet. Cites others' models (Chronos-2, FlowState, DynaMix) as motivation, not its own benchmarks..",
    active_users: "No revenue; pre-product research subnet, incentive is TAO emissions only.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/TensorLink-AI/cascade",
      "https://cascadesub.net",
      "https://testnet.cascadesub.net/",
      "https://api.github.com/repos/TensorLink-AI/cascade"
    ],
  },
  {
    subnet_id: 61,
    subnet_name: "RedTeam (Innerworks)",
    benchmark_score: 65,
    benchmark_category: "Security & Trust",
    vs_provider: "HackerOne / Bugcrowd / Synack Red Team",
    cost_saving_pct: 80,
    perf_delta: "Gamified decentralized exploit bounties — Innerworks bot detection team",
    benchmark_summary: "RedTeam (SN61) is the world's first decentralized gamified cybersecurity platform — ethical hackers submit exploit code to bypass bot detection systems, earning TAO rewards. Validated exploits are integrated into open-source defenses. Built by Innerworks (behavioral biometrics specialists). Launched December 2024 (GlobeNewswire). Future: enterprise bounty model where companies post paid security challenges. Addresses the $250B+ cybersecurity market; bot management alone $1.5B+ and growing.",
    active_users: "Ethical hackers + enterprises",
    annual_revenue_usd: 0,
    last_updated: "2026-04-07",
    sources: ["https://innerworks.com/"],
  },
  {
    subnet_id: 70,
    subnet_name: "NexisGen",
    benchmark_score: 58,
    benchmark_category: "AI Training Data / Datasets",
    vs_provider: "Scale AI / Appen / Surge AI (managed training-data marketplaces)",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "NexisGen (SN70): A decentralized 'commissions house for AI training data' built on Bittensor by Rendix Network. Buyers commission dataset specifications; a network of miners produces candidate datasets and validators/appraisers certify each record with full provenance. The current live commission (VIDEO_V1) produces high-fidelity 1280x704 video-clip datasets with grounded captions, cross-source overlap arbitration, and chain-of-custody provenance back to YouTube source URLs. Miners work on fixed 50-block intervals, upload Parquet + JSON manifests to Cloudflare R2, and validators verify against schema, resolution, and overlap policy before scoring and setting weights on-chain. On-chain incentivized data pipeline with per-record certification and chain-of-custody provenance back to source URLs, versus centralized human-labeling vendors. Revenue: Commission-based: buyers pay to commission dataset specs and receive certified outputs. 'Open Commission' status accepting buyers. No revenue figures disclosed.. Caveats: No third-party benchmark; product claims are self-described. GitHub has 0 stars and low external engagement. Token (SN70) fell ~29% in an April 2026 ecosystem downturn. Enterprise-buyer traction not evidenced publicly..",
    active_users: "Commission-based: buyers pay to commission dataset specs and receive certified outputs. 'Open Commission' status accepting buyers. No revenue figures disclosed.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://www.nexisgen.ai/",
      "https://github.com/RendixNetwork/nexisgen",
      "https://www.rendix.network/",
      "https://subnetalpha.ai/subnet/subnet70/",
      "https://cryptorank.io/price/nexisgen-ai"
    ],
  },
  {
    subnet_id: 49,
    subnet_name: "Nepher Robotics",
    benchmark_score: 64,
    benchmark_category: "Robotics & Vision",
    vs_provider: "NVIDIA Isaac Lab / Boston Dynamics sim tools / Mujoco",
    cost_saving_pct: 0,
    perf_delta: "First decentralized robotics policy competition on NVIDIA Omniverse",
    benchmark_summary: "Nepher Robotics (SN49) is a decentralized robotics policy competition — miners train sim-to-real robotic control policies in NVIDIA Omniverse/Isaac Sim and compete in physics simulations. Winning policies open-sourced via SimStore. EnvHub hosts Isaac Sim environments for community use. Launched November 2025. First robotics-focused Bittensor subnet. Addresses the $8B+ robotics AI market with NVIDIA Omniverse as central infrastructure.",
    active_users: "Robotics researchers + engineers",
    annual_revenue_usd: 0,
    last_updated: "2026-04-07",
    sources: ["https://nepher.ai/"],
  },
  {
    subnet_id: 48,
    subnet_name: "Quantum Compute",
    benchmark_score: 50,
    benchmark_category: "Quantum Computing Marketplace",
    vs_provider: "AWS Braket / IBM Quantum / Azure Quantum",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Quantum Compute (SN48): A decentralized marketplace for quantum computation. QPU operators (miners) connect real quantum computers to the network; users submit OpenQASM 2.0/3.0 circuits (and via Qiskit/PennyLane) through validator-managed interfaces, the network executes them on physical quantum hardware and compensates operators in TAO. The paired 'Open Quantum' offering aims to provide a crypto-abstracted UX routing jobs to real QPUs. Uses Bittensor incentives to build an open, multi-vendor QPU marketplace where only genuine quantum hardware can mine ('no middlemen'), subsidizing user access instead of routing through a single cloud vendor's pricing. Revenue: No disclosed revenue. Marketplace model earns operators TAO emissions; user-facing paid access via Open Quantum is prospective.. Caveats: Very capital-intensive, hardware-dependent thesis. Claimed real-QPU access via IonQ/Rigetti/IQM/AQT and the Open Quantum partnership is self-reported on their site and not independently verified. Verifying that miners run genuine quantum hardware (vs simulators) is a hard, unproven problem..",
    active_users: "No disclosed revenue. Marketplace model earns operators TAO emissions; user-facing paid access via Open Quantum is prospective.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/qbittensor-labs/quantum-compute",
      "https://www.qbittensorlabs.com/quantum",
      "https://bittensor.ai/subnets/48",
      "https://subnetalpha.ai/subnet/quantumcompute/"
    ],
  },
  {
    subnet_id: 78,
    subnet_name: "Vocence",
    benchmark_score: 58,
    benchmark_category: "Voice AI",
    vs_provider: "ElevenLabs",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Vocence (SN78): Decentralized voice-intelligence subnet where miners train and deploy voice models (prompt-based TTS, STT, speech-to-speech, voice cloning/design, text-to-music) and validators score them on content correctness, audio quality and prompt adherence. Ships a live Studio product with API. Prompt-based TTS where a natural-language description sets voice traits (gender, tone, emotion, pitch, age, accent, recording environment), evaluated by decentralized validators; already has a live Studio product and API rather than being research-only. Revenue: Live Studio product (TTS/STT, voice cloning/design, text-to-music, API) suggests a consumer-facing monetization path, but no published revenue or pricing figures found.. Caveats: Low repo traction (2 stars/3 forks); no independent benchmark vs ElevenLabs; on-chain X handle absent and guessed handle @vocence_bt could not be verified live; team anonymous..",
    active_users: "Live Studio product (TTS/STT, voice cloning/design, text-to-music, API) suggests a consumer-facing monetization path, but no published revenue or pricing figures found.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/vocence-78/vocence",
      "https://www.vocence.ai/",
      "https://bittensor.ai/subnets"
    ],
  },
  {
    subnet_id: 36,
    subnet_name: "Eirel",
    benchmark_score: 50,
    benchmark_category: "Multimodal AI Agents",
    vs_provider: "OpenAI/ChatGPT agents, Manus, or centralized multimodal agent platforms",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Eirel (SN36): Decentralized marketplace of competing multimodal AI agents. A user prompt is turned into a full deliverable across language, vision, audio and code through a six-layer pipeline (intent -> planning -> generation -> media -> tool orchestration -> delivery). Miners submit Docker-packaged specialist agents (Analyst, Builder, Media, Browser, Data, Planner) and validators score them with frozen evaluation bundles. Specialist agent families competing on a stake-weighted leaderboard with owner-frozen evaluation bundles, plus integrated tool services (web search, URL fetch, Python sandbox, RAG) and a roadmap toward MCP support and consumer payments. Revenue: Consumer payments planned for Phase 2 (Q3-Q4 2026); no current revenue. Site shows a demo (autonomous campaign in 14.2s at 92% confidence) but that is a self-reported demo, not a benchmark.. Caveats: Early-phase (Phase 1, owner-frozen evaluation; validator-run eval not until Q1-Q2 2027); low repo traction (2 stars); demo metrics are self-reported, no independent benchmark; team members anonymous behind Rendix brand..",
    active_users: "Consumer payments planned for Phase 2 (Q3-Q4 2026); no current revenue. Site shows a demo (autonomous campaign in 14.2s at 92% confidence) but that is a self-reported demo, not a benchmark.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/RendixNetwork/eirel-ai",
      "https://eirel.ai/",
      "https://www.rendix.network/",
      "https://bittensor.ai/subnets"
    ],
  },
  {
    subnet_id: 37,
    subnet_name: "Aurelius",
    benchmark_score: 52,
    benchmark_category: "AI Alignment Infrastructure",
    vs_provider: "Anthropic/OpenAI in-house RLHF & Constitutional AI alignment pipelines",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Aurelius (SN37): Decentralized moral-reasoning alignment: miners submit structured ethical-dilemma scenario configs; validators run them through an 8-stage quality pipeline and then through sandboxed Concordia generative-agent simulations; the resulting transcripts become training data to improve LLM performance on moral-reasoning benchmarks (targets MoReBench). Open vs closed, multi-agentic vs monolithic, discovered vs dictated: alignment data emerges bottom-up from network-run agent simulations of ethical dilemmas rather than being dictated by a single lab. Revenue: No revenue model or pricing disclosed; miners/validators earn TAO emissions. Output is alignment training data.. Caveats: No third-party benchmark or published MoReBench score yet (MoReBench is the target, not a demonstrated result); no team names beyond one contact; no revenue/customers; success depends on synthetic Concordia transcripts actually improving real model alignment, which is unproven..",
    active_users: "No revenue model or pricing disclosed; miners/validators earn TAO emissions. Output is alignment training data.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://aureliusaligned.ai",
      "https://github.com/Aurelius-Protocol/Aurelius-Protocol",
      "https://api.github.com/repos/Aurelius-Protocol/Aurelius-Protocol"
    ],
  },
  {
    subnet_id: 9,
    subnet_name: "IOTA / Train at Home",
    benchmark_score: 65,
    benchmark_category: "AI Training",
    vs_provider: "CoreWeave / Lambda Labs / RunPod LLM training",
    cost_saving_pct: 90,
    perf_delta: "Distributed LLM pretraining on consumer hardware — MacBook app launched",
    benchmark_summary: "IOTA (SN9) is Macrocosmos's distributed LLM pretraining subnet — transforms participants into a cooperative training unit using data-parallel and pipeline-parallel training across heterogeneous devices globally. Train at Home is the consumer product: a no-code app letting MacBook/Mac Mini owners contribute compute and earn TAO. Launched November-December 2025. Arxiv paper published July 2025. Partnership with Rowan Scientific (neural network potentials for drug discovery). macOS support live; Windows/Linux coming.",
    active_users: "Consumer hardware contributors",
    annual_revenue_usd: 0,
    last_updated: "2026-04-07",
    sources: ["https://iota.macrocosmos.ai/"],
    dashboards: [
      { url: "https://iota.macrocosmos.ai/", label: "Live Dashboard" },
    ],
  },
  {
    subnet_id: 1,
    subnet_name: "Apex (Macrocosmos)",
    benchmark_score: 62,
    benchmark_category: "AI Compute",
    vs_provider: "OpenAI API / Anthropic API / Together AI",
    cost_saving_pct: 85,
    perf_delta: "Competitive LLM routing API — free tier: 100 req/hr",
    benchmark_summary: "Apex (SN1) is Macrocosmos's competitive LLM inference routing subnet. Miners run LLMs competing on accuracy across Q&A, summarization, code debugging, math, and translation. API live: chat completions + web retrieval (RAG-like) endpoints. Free tier: 100 req/hr; validator tier: 1,000 req/hr. Part of Macrocosmos's full AI stack (SN1, SN9, SN13, SN25, SN37). GitHub: macrocosm-os/apex.",
    active_users: "API developers",
    annual_revenue_usd: 0,
    last_updated: "2026-04-07",
    sources: ["https://macrocosmos.ai/"],
    dashboards: [
      { url: "https://apex.macrocosmos.ai/", label: "Miner Leaderboard" },
    ],
  },
  {
    subnet_id: 74,
    subnet_name: "Gittensor",
    benchmark_score: 58,
    benchmark_category: "Developer Tools",
    vs_provider: "GitHub Sponsors / Gitcoin / Open Collective",
    cost_saving_pct: 0,
    perf_delta: "Crypto rewards for merged open-source PRs — GitHub-native",
    benchmark_summary: "Gittensor (SN74) pays developers in TAO alpha tokens for making verified, merged pull requests to approved open-source repositories. Miners register with a GitHub personal access token; validators verify merged PRs and score by code quality, repo weight, and language. No special app needed beyond GitHub. Creates a cryptographic incentive layer on top of existing GitHub contribution workflows. Unique approach to sustaining open-source development in the $600B+ software ecosystem.",
    active_users: "Open-source developers",
    annual_revenue_usd: 0,
    last_updated: "2026-04-07",
    sources: ["https://subnetalpha.ai/subnet/gittensor/"],
  },
  {
    subnet_id: 25,
    subnet_name: "Mainframe (Macrocosmos)",
    benchmark_score: 63,
    benchmark_category: "Science & Research",
    vs_provider: "Schrödinger / OpenEye / AWS Life Sciences / Folding@home",
    cost_saving_pct: 85,
    perf_delta: "Protein folding + ligand docking API — Rowan Scientific partnership",
    benchmark_summary: "Mainframe (SN25) is Macrocosmos's decentralized science compute subnet — protein molecular dynamics (OpenMM) and protein-ligand docking (DiffDock) for drug discovery. RESTful Folding API live for researchers and biotech companies. Partnership with Rowan Scientific for neural network potential (NNP) development. Part of the $75B+ pharma R&D market; computational biology tools $3B+. Built by Macrocosmos, which operates 5 Bittensor subnets.",
    active_users: "Biotech researchers + academics",
    annual_revenue_usd: 0,
    last_updated: "2026-04-07",
    sources: ["https://macrocosmos.ai/"],
  },
  {
    subnet_id: 5,
    subnet_name: "Hone",
    benchmark_score: 72,
    benchmark_category: "AI Training",
    vs_provider: "Petals / Prime Intellect / Nous Research distributed training",
    cost_saving_pct: 60,
    perf_delta: "Decentralized hierarchical pretraining — distributed LLM training by Manifold Labs (builders of Targon SN4)",
    benchmark_summary: "Hone (SN5) is a decentralized hierarchical pretraining subnet built by Manifold Labs (also behind Targon SN4). Miners participate in distributed LLM pretraining using a hierarchical reward structure. The network applies evolutionary pressure to model quality — better-performing training runs earn more rewards, creating a self-improving training system. Addresses the high cost of frontier model pretraining ($100M+ for leading runs) by distributing compute across the network.",
    active_users: "ML researchers + validators",
    annual_revenue_usd: 0,
    last_updated: "2026-05-08",
    sources: ["https://github.com/manifold-inc/hone", "https://www.hone.training/"],
  },
  {
    subnet_id: 15,
    subnet_name: "ORO",
    benchmark_score: 58,
    benchmark_category: "AI Agent Evaluation / Agentic Commerce",
    vs_provider: "OpenAI Operator / Amazon Rufus / closed shopping-agent benchmarks",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "ORO (SN15): A decentralized evaluation platform for AI shopping agents. Miners submit Python agents that search products, compare prices and make purchase decisions; validators run them in sandboxed Docker environments against ShoppingBench (an intent-grounded benchmark over ~2.5M real products) and score them independently. Best agents earn emissions; every evaluation and score is public and verifiable. The team also ships an open-source Bittensor authentication stack (SR25519, nonce replay protection, session mgmt, Python/TS SDKs). Open, publicly-auditable agent competition ('no closed-door benchmarks') where every score is independently reproduced by multiple validators over a real 2.5M-product catalog, with emissions rewarding the top agents. Revenue: No disclosed revenue. Venture-backed (site lists Crucible Labs, Unsupervised Capital, Savant; also listed on f4.fund). Actively hiring. Monetization via emissions + potential commerce-agent licensing.. Caveats: ShoppingBench is ORO's own eval suite (academic ShoppingBench papers exist on arXiv, but no third-party head-to-head numbers vs a named provider are published). No comparative benchmark scores disclosed. Team members not named..",
    active_users: "No disclosed revenue. Venture-backed (site lists Crucible Labs, Unsupervised Capital, Savant; also listed on f4.fund). Actively hiring. Monetization via emissions + potential commerce-agent licensing.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/ORO-AI/oro",
      "https://oroagents.com/",
      "https://github.com/ORO-AI/bittensor-auth",
      "https://f4.fund/startups/oroagents",
      "https://x.com/oroagents/status/2046288314295373953"
    ],
  },
  {
    subnet_id: 28,
    subnet_name: "gm",
    benchmark_score: 58,
    benchmark_category: "AI Inference",
    vs_provider: "OpenRouter / direct OpenAI & Anthropic API access",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "gm (SN28): A confidential, OpenAI-compatible LLM inference gateway that routes prompts to Claude, GPT, Gemini and Llama through Intel TDX trusted execution environments so the operator and host cannot read your prompts or upstream API keys. Miners supply upstream frontier-model API capacity and earn the spread on traffic. Every request runs through an Intel TDX-attested enclave with Intel-signed measurements verifying the exact gateway code, so operators cannot see prompts or upstream keys. It is OpenAI-API-compatible (works with Cursor, Cline, Claude Code) and prices models at or below official provider rates. Revenue: unknown/pre-revenue — public beta; pricing at/below official rates is self-reported, no revenue disclosed. Caveats: Privacy guarantee rests entirely on TEE attestation; miners resell frontier-model API capacity, which may conflict with upstream provider terms of service. GitHub repo has 0 stars. No third-party privacy or performance audit published..",
    active_users: "unknown/pre-revenue — public beta; pricing at/below official rates is self-reported, no revenue disclosed",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/taostat/gm-miner",
      "https://saygm.com/",
      "https://demo.saygm.com/",
      "https://x.com/say_gm_",
      "https://subnetaiq.io/subnet/28"
    ],
  },
  {
    subnet_id: 55,
    subnet_name: "NIOME",
    benchmark_score: 58,
    benchmark_category: "Synthetic Genomic Data",
    vs_provider: "Syntegra / MDClone / Gretel synthetic data (health), or licensed real-genome datasets like UK Biobank",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "NIOME (SN55): Incentivizes miners to generate privacy-safe synthetic genomic data (DNA profiles that preserve the statistical distributions and genetic correlations of real DNA without any actual patient data), validated for statistical fidelity and biological plausibility, and sold to pharma/precision-medicine research via API and VCF/PLINK exports. Decentralized competition to produce high-fidelity synthetic genomes with zero re-identification risk, scaling past consent bottlenecks; framed around a 12-month peer-reviewed data-challenge program (Q2 2026-Q1 2027) across 24 prediction challenges. Revenue: Enterprise API access / custom cohort generation for pharma clients; miners earn TAO emissions on data quality. $44B precision-medicine market cited as TAM. No disclosed revenue figures.. Caveats: Named VC backing is self-asserted on site and not independently verified here; no team names; no third-party benchmark of synthetic-data fidelity; regulatory acceptance of synthetic genomes for real drug pipelines is unproven..",
    active_users: "Enterprise API access / custom cohort generation for pharma clients; miners earn TAO emissions on data quality. $44B precision-medicine market cited as TAM. No disclosed revenue figures.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://niome.genomes.io",
      "https://github.com/genomesio/subnet-niome",
      "https://api.github.com/repos/genomesio/subnet-niome"
    ],
  },
  {
    subnet_id: 16,
    subnet_name: "Fast Thinker",
    benchmark_score: 48,
    benchmark_category: "Reasoning Model Optimization",
    vs_provider: "OpenAI o-series / DeepSeek-R1 reasoning-model efficiency work (centralized R&D labs)",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Fast Thinker (SN16): A Bittensor subnet focused on making reasoning models faster, leaner, and more efficient without sacrificing accuracy. Miners submit LoRA adapter bundles (default 500 MiB cap) to Hugging Face; validators score them across three task categories — math (deterministic local generators requiring strict \\boxed{answer} formatting), long-context QA (candidates must select a minimal document set, verified using only those docs), and multiple-choice reasoning. Submissions mature for six epochs before evaluation. A public dashboard (Hugging Face Space, backed by a Weights & Biases static build) shows live leaderboard rankings, per-epoch accuracy vs. the base model, and token-usage efficiency trends (lower is better). Incentivized, repeatable adapter competition scored on both accuracy and token efficiency, with anti-gaming measures (encrypted manifests, deterministic generators, six-epoch maturation), versus closed lab R&D. Revenue: No external revenue model surfaced; value accrues via TAO emissions to top adapters. No product/API or pricing disclosed.. Caveats: Repo is only ~3 weeks old (created 2026-07-01) — very early. No third-party benchmark; leaderboard is self-reported from the subnet's own W&B build and dashboard was showing placeholder/'waiting for data' states. 0 GitHub stars. No X presence..",
    active_users: "No external revenue model surfaced; value accrues via TAO emissions to top adapters. No product/API or pricing disclosed.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://fast-thinker-dashboard.hf.space",
      "https://github.com/fast-thinker/fast-thinker",
      "https://bittensor.ai/subnets"
    ],
  },
  {
    subnet_id: 20,
    subnet_name: "GroundLayer",
    benchmark_score: 35,
    benchmark_category: "Capital Markets Infrastructure / OTC",
    vs_provider: "Crypto OTC trading desks (Genesis, Cumberland) and traditional structured private-placement/OTC markets",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "GroundLayer (SN20): An institutional-grade, on-chain OTC marketplace for Bittensor subnet (alpha) tokens. It structures three-party deals between subnet owners raising capital, fund managers, and investors, with terms enforced by smart contracts so subnets can raise without dumping tokens on the spot market. Positioned as capital infrastructure for the subnet-token ecosystem rather than an AI-inference subnet. Claims 0% spot price impact on raises and 100% on-chain smart-contract enforcement with a three-party aligned incentive model, versus trust-based off-chain OTC handshakes. Revenue: Pre-launch; no revenue and no verified deal volume. Marketing figures (0% price impact, 100% on-chain) are self-stated design claims, not audited results.. Caveats: On-chain GitHub points to a non-existent/private 'comingsoon' repo (404) - github_verified false. Pre-launch with no product live, no team disclosed, and self-reported metrics only. Netuid 20 was recycled onto this project..",
    active_users: "Pre-launch; no revenue and no verified deal volume. Marketing figures (0% price impact, 100% on-chain) are self-stated design claims, not audited results.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://groundlayer.xyz",
      "https://github.com/RogueTensor/comingsoon",
      "https://taostats.io/subnets/20"
    ],
  },
  {
    subnet_id: 23,
    subnet_name: "Trishool",
    benchmark_score: 52,
    benchmark_category: "AI Safety / Alignment Auditing",
    vs_provider: "In-house red-teaming / alignment eval labs at OpenAI, Anthropic (e.g. Petri-style auditing)",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Trishool (SN23): A decentralized AI-alignment and safety-auditing layer. Miners submit seed instructions/prompts that are run through an alignment auditing agent (Petri) against target LLMs to elicit and detect problematic behaviors — deception, sycophancy, manipulation, overconfidence, power-seeking. The network turns red-teaming and behavioral safety evaluation into a competitive, market-validated process. Its Halo Guard safety classifier has been integrated into Chutes (SN64) inference. Automates the safety loop via open competition — miners are economically rewarded for surfacing misaligned behaviors, producing a continuously-updated, decentralized safety benchmark rather than one-off internal audits. Revenue: No direct revenue disclosed. Signals: accepted into Google for Startups Web3 program (up to $200k GCP credits) and a landed customer (Chutes/SN64) using Halo Guard classifier — early traction, not revenue.. Caveats: Ambitious 'Safe Superintelligence' framing; small team and low repo activity signals. Customer/credit claims are self-reported. No third-party safety benchmark scores published..",
    active_users: "No direct revenue disclosed. Signals: accepted into Google for Startups Web3 program (up to $200k GCP credits) and a landed customer (Chutes/SN64) using Halo Guard classifier — early traction, not revenue.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/TrishoolAI/trishool-phase2",
      "https://docs.trishool.ai/",
      "https://subnetalpha.ai/subnet/trishool/",
      "https://cryptorank.io/news/feed/trishool-sn23-joins-the-google-for-startups-web3-program"
    ],
  },
  {
    subnet_id: 26,
    subnet_name: "Perturb",
    benchmark_score: 58,
    benchmark_category: "AI Security / Adversarial Robustness",
    vs_provider: "Centralized AI red-teaming / model-security vendors (HiddenLayer, Robust Intelligence, Protect AI)",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Perturb (SN26): Decentralized adversarial-robustness network where miners compete to find adversarial examples (imperceptible input perturbations) that make image classifiers and multi-modal LLMs misclassify. Validators sample challenge images (ImageNet-100), run classifiers, and verify miner attacks. Produces a growing corpus of adversarial examples plus on-chain auditable proof of adversarial evaluation for AI-regulation compliance. Supports black-box, white-box, and transfer attacks; outputs robustness scores and vulnerability heatmaps. Global network of miners attacking models 24/7 with rewards aligned to finding real exploitable vulnerabilities rather than synthetic ones; on-chain proof of evaluation for compliance. Revenue: No revenue disclosed. Business model implied as robustness-testing service (robustness scores, vulnerability heatmaps) but no pricing on site.. Caveats: Only 3 GitHub stars and young repo (Apr 2026); no public benchmark or third-party validation; no disclosed customers or revenue. Team names not independently verified beyond own site..",
    active_users: "No revenue disclosed. Business model implied as robustness-testing service (robustness scores, vulnerability heatmaps) but no pricing on site.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://www.perturbai.io/",
      "https://github.com/0xsigurd/Perturb"
    ],
  },
  {
    subnet_id: 43,
    subnet_name: "Graphite AI",
    benchmark_score: 50,
    benchmark_category: "Finance & Trading",
    vs_provider: "Google OR-Tools / IBM CPLEX / Gurobi",
    cost_saving_pct: 70,
    perf_delta: "7% routing efficiency gain on TSP — TaoTrader copy-trading in dev",
    benchmark_summary: "Graphite AI (SN43) is a decentralized graph optimization network — miners compete to solve NP-hard routing problems (TSP, multi-vehicle TSP), claiming up to 7% efficiency improvement. Pivoting toward financial applications: TaoTrader (taotrader.xyz) is a Leader-Copy Trader system for crypto portfolio optimization. Commercial subnet API planned for Phase 2b. Addresses both the $15B+ logistics optimization software market and algorithmic trading tools.",
    active_users: "Logistics teams + crypto traders",
    annual_revenue_usd: 0,
    last_updated: "2026-04-07",
    sources: ["https://graphite-ai.net/"],
  },
  {
    subnet_id: 47,
    subnet_name: "EvolAI",
    benchmark_score: 38,
    benchmark_category: "Model Training / Evaluation",
    vs_provider: "OpenAI/Anthropic frontier-model training, or open eval leaderboards like LMSYS/HuggingFace Open LLM Leaderboard",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "EvolAI (SN47): LLM evaluation-and-improvement subnet. Miners submit language models to HuggingFace (transformer or mamba2 architectures) and validators score them on Quality (60%, KL divergence vs a Qwen reference model), Flow (30%, consistent improvement trend) and Side Quests (10%, arithmetic accuracy) using seeded on-chain challenge indices. Deterministic seeded evaluation (SHA256 of seed:uid:dataset) that lets miners optimize toward their own eval samples while rewarding chain-of-thought reasoning and consistent improvement; supports mamba2 as well as transformer architectures. Revenue: No product, no revenue model surfaced; purely an incentive/eval subnet with no consumer-facing offering identified.. Caveats: No website, no X presence, 1 star, no releases; heavy validator hardware requirement (80GB VRAM, CUDA 13+); no third-party benchmark; entirely infrastructure-facing with no external demand signal..",
    active_users: "No product, no revenue model surfaced; purely an incentive/eval subnet with no consumer-facing offering identified.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/openevolai/evolai"
    ],
  },
  {
    subnet_id: 63,
    subnet_name: "Enigma",
    benchmark_score: 52,
    benchmark_category: "Science",
    vs_provider: "centralized providers",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Enigma (SN63): A decentralized challenge platform where sponsors post hard problems with funded prize pools and a global crowd of researchers and hackers competes to solve them, with winning solutions published openly. Live challenges focus on breaking RSA encryption (with Terra Quantum) and hardening quantum circuits / finding peaked states (with BlueQubit), oriented around post-quantum 'Q-Day' readiness. Enigma turns critical-technology testing into open, on-chain competitions funded by prize pools and network emissions, open to anyone (researchers, hackers, students) with verified, published solutions and escalating difficulty. It creates a public, compounding record of progress rather than closed-door results. Revenue: unknown/pre-revenue — prize pools funded by network emissions and sponsor challenges; no revenue figure disclosed. Caveats: Reported results (e.g. RSA-460 factored in 3.9 hours, RSA-480 on 2026-07-02) are self-reported milestone achievements, not benchmarks against a centralized competitor. 'First quantum subnet' framing is heavily marketing-driven; partner/sponsor claims not independently verified here. Repo has 1 star..",
    active_users: "unknown/pre-revenue — prize pools funded by network emissions and sponsor challenges; no revenue figure disclosed",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/qbittensor-labs/enigma",
      "https://www.qbittensorlabs.com/enigma",
      "https://x.com/qbittensorlabs",
      "https://medium.com/@qbittensorlabs"
    ],
  },
  {
    subnet_id: 66,
    subnet_name: "Ninja",
    benchmark_score: 55,
    benchmark_category: "AI Coding Agents",
    vs_provider: "Cursor / Devin / SWE-bench leaderboard",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Ninja (SN66): A king-of-the-hill competitive arena for software-engineering agents. The validator generates tasks from real GitHub commits, pits a reigning champion agent against challengers in head-to-head duels judged by an LLM (GPT-5.4), and crowns a new king when a challenger decisively wins. Miners submit coding-agent harnesses that must beat the current best. Continuous adversarial king-of-the-hill duels on freshly-mined real GitHub tasks instead of a fixed benchmark; untrusted miner code runs in network-isolated Docker sandboxes, coordinated via PostgreSQL, with an LLM judge scoring patches head-to-head. Revenue: No disclosed revenue. Team also builds Katana, an agentic IDE positioned as a Cursor competitor; monetization path unclear.. Caveats: Very young subnet (repo <1 month old, 0 stars). No published benchmark numbers or third-party validation. Small/anonymous team..",
    active_users: "No disclosed revenue. Team also builds Katana, an agentic IDE positioned as a Cursor competitor; monetization path unclear.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/ninja-subnet/ninja-validator",
      "https://ninja66.ai",
      "https://www.tao.app/subnets/66",
      "https://www.intotao.app/subnets/66-ninja"
    ],
  },
  {
    subnet_id: 67,
    subnet_name: "Harnyx",
    benchmark_score: 55,
    benchmark_category: "Deep Research API",
    vs_provider: "OpenAI Deep Research, Perplexity, Google Gemini Deep Research, Exa",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Harnyx (SN67): A Bittensor subnet exposing a decentralized 'deep research' API for AI agents. Miners submit Python research agents/harnesses; validators execute them in sandboxes and score outputs via pairwise comparison against reference answers, with a champion-dethroning rule. A single API call returns synthesized, comprehensive, citation-backed research rather than fragmented search results, integrating with LangChain, CrewAI, n8n and OpenClaw. Competitive open marketplace of research harnesses ('better harnesses compound faster') targeting ~10x cost reduction with provenance/citations, benchmarked against real external suites. Revenue: No confirmed revenue; positions on cost-per-query vs incumbents ($1.54-$3.68). API integrations exist but no disclosed paying customers.. Caveats: Benchmarks (DRACO by Perplexity, DeepSearchQA by DeepMind) are named targets Harnyx aims to reach ('Phase 1 targets parity'), not published achieved scores vs a provider — so no citable benchmark result yet. VC-backing claims not independently verified. X handle cited from own site but liveness not independently confirmed..",
    active_users: "No confirmed revenue; positions on cost-per-query vs incumbents ($1.54-$3.68). API integrations exist but no disclosed paying customers.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/harnyx/harnyx",
      "https://harnyx.ai/",
      "https://api.github.com/repos/harnyx/harnyx"
    ],
  },
  {
    subnet_id: 73,
    subnet_name: "MetaHash",
    benchmark_score: 40,
    benchmark_category: "DeFi / Treasury / OTC",
    vs_provider: "A crypto OTC trading desk / holding-company treasury",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "MetaHash (SN73): MetaHash (SN73) is a decentralized over-the-counter (OTC) settlement and treasury layer for Bittensor. dTAO holders swap their earned subnet ALPHA tokens directly for SN73's native token (META) through on-chain Dutch auctions run in discrete epochs, so miners can exit subnet positions without slippage or price impact on the original subnet's thin liquidity pool. SN73 also acts as an on-chain treasury/coordination layer that acquires and governs a portfolio of subnets. Epoch-based Dutch-auction mechanism that settles ALPHA -> META off the native pools, eliminating slippage; treasury-backed META token; portfolio-of-subnets governance model. Revenue: Value accrues to META token via auction settlements and treasury holdings; no conventional off-chain revenue identified.. Caveats: On-chain identity currently reads 'Parked', but this is the live, actively-developed MetaHash slot (docs, site, multiple GitHub repos, exchange/tracker listings all current). Financial/treasury subnets carry token-mechanism risk..",
    active_users: "Value accrues to META token via auction settlements and treasury holdings; no conventional off-chain revenue identified.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://www.tao.app/subnets/73",
      "https://github.com/fx-integral/metahash",
      "https://github.com/oxylok/73-metahash",
      "https://docs.metahash73.com/README",
      "https://learnbittensor.org/subnets/73",
      "https://subnetalpha.ai/subnet/metahash/"
    ],
  },
  {
    subnet_id: 77,
    subnet_name: "Liquidity Mining (SN77)",
    benchmark_score: 44,
    benchmark_category: "Web3 & DeFi",
    vs_provider: "Convex Finance / Curve / Balancer gauge system",
    cost_saving_pct: 0,
    perf_delta: "Token holder-voted LP rewards — DeFi liquidity for Bittensor tokens",
    benchmark_summary: "SN77 is an on-chain liquidity mining system for the Bittensor ecosystem. Token holders vote on liquidity pools; validators process votes to assign miner weights and rewards, incentivizing liquidity provision for Bittensor subnet tokens in external DeFi markets. Open-source, MIT licensed. Part of the growing DeFi infrastructure being built around Bittensor's dTAO subnet token economy. GitHub: CreativeBuilds/sn77.",
    active_users: "Bittensor liquidity providers",
    annual_revenue_usd: 0,
    last_updated: "2026-04-07",
    sources: ["https://github.com/CreativeBuilds/sn77"],
  },
  {
    subnet_id: 79,
    subnet_name: "MVTRX (TAOS)",
    benchmark_score: 55,
    benchmark_category: "Finance & Trading",
    vs_provider: "Centralized crypto exchanges / proprietary quant market simulators",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "MVTRX (TAOS) (SN79): A large-scale agent-based simulation of automated trading in intelligent markets, where miners submit risk-managed trading agents that compete inside L3 market-by-order limit-order-book simulations scored by validators. The project is extending the sim into GenTRX (a shared generative order-book model) and a planned live MVTRX exchange for dTAO/alpha tokens. TAOS runs a C++/Rust market-microstructure simulation engine (built on MAXE) paired with Python validators, creating open L3 limit-order books where anyone can develop and be rewarded for profitable, risk-managed agents. It aims to convert that simulation edge into a real MVTRX exchange with a dynamic zero-sum rebate/fee incentive structure. Revenue: unknown/pre-revenue — live simulation subnet since May 2025 but the revenue-generating MVTRX exchange is still 'coming soon', no fee revenue disclosed. Caveats: The monetizing product (MVTRX live exchange) is not yet launched; team is effectively anonymous behind the taos.im domain. Benchmarks/whitepaper are self-published with no third-party validation..",
    active_users: "unknown/pre-revenue — live simulation subnet since May 2025 but the revenue-generating MVTRX exchange is still 'coming soon', no fee revenue disclosed",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://taos.im/",
      "https://github.com/taos-im/sn-79",
      "https://x.com/taos_im",
      "https://taostats.io/subnets/79/chart"
    ],
  },
  {
    subnet_id: 83,
    subnet_name: "CliqueAI (TopTensor)",
    benchmark_score: 52,
    benchmark_category: "Science & Research",
    vs_provider: "IBM CPLEX / Gurobi / Google OR-Tools (clique solvers)",
    cost_saving_pct: 80,
    perf_delta: "Distributed NP-hard maximum clique solving — rewards algorithmic novelty",
    benchmark_summary: "CliqueAI (SN83) is an AI-powered distributed maximum clique solver by TopTensor — miners compete to solve complex graph optimization problems (NP-hard). AI curates problems and evaluates both solution optimality AND algorithmic diversity. Four-stage autonomous mechanism. Rewards algorithmic novelty alongside best solution. Real applications: drug discovery, network security, social graph analysis. Maximum clique is a foundational NP-hard problem in combinatorial optimization.",
    active_users: "Graph theory researchers + engineers",
    annual_revenue_usd: 0,
    last_updated: "2026-04-07",
    sources: ["https://subnetalpha.ai/subnet/clique/"],
  },
  {
    subnet_id: 94,
    subnet_name: "BitSota",
    benchmark_score: 40,
    benchmark_category: "AI Research / AutoML",
    vs_provider: "AutoML / neural-architecture-search platforms (e.g. Google AutoML, evolutionary AutoML research)",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "BitSota (SN94): BitSota (SN94) is a decentralized, problem-agnostic research network that evolves machine-learning algorithms through competitive optimization. Miners use genetic programming to evolve/self-generate ML algorithms locally and submit breakthroughs; validators replay and evaluate performance in sandboxed environments and distribute rewards via smart-contract/Merkle-style voting. Supports both individual mining (higher compute, larger rewards) and collaborative pool mining. Problem-agnostic genetic-programming approach aimed at self-improving/self-generating AI, with sandboxed validator replay and pooled collaborative mining. Revenue: No off-chain revenue model identified; value accrues to the SN94 (Bitsota) alpha token.. Caveats: On-chain identity reads 'pending...', but a real project exists (GitHub repo, tao.app + CoinGecko 'Bitsota' listing, ~$1.86M mcap matching the target). Public product docs are still thin; subnetalpha.ai shows 'Awaiting Data'..",
    active_users: "No off-chain revenue model identified; value accrues to the SN94 (Bitsota) alpha token.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://www.tao.app/subnets/94",
      "https://github.com/AlveusLabs/SN94-BitSota",
      "https://www.coingecko.com/en/coins/bitsota",
      "https://subnetalpha.ai/subnet/subnet94/"
    ],
  },
  {
    subnet_id: 120,
    subnet_name: "Affine",
    benchmark_score: 78,
    benchmark_category: "AI Model Evaluation",
    vs_provider: "Centralized AI Leaderboards (Chatbot Arena / LMSYS)",
    cost_saving_pct: 70,
    perf_delta: "Open decentralized arena outperforming single-team AI benchmarks",
    benchmark_summary: "Affine (SN120) runs a decentralized open AI arena — 'One team can't build the best AI, so we stopped trying. We built an open arena instead.' Their April 2026 benchmark results went viral on X (5,000+ views), demonstrating that distributed evaluation across many teams outperforms centralized AI development. Affine is positioning as the decentralized alternative to LMSYS Chatbot Arena and similar centralized AI evaluation platforms.",
    active_users: "Growing — viral launch April 2026",
    annual_revenue_usd: 0,
    last_updated: "2026-04-08",
    sources: [
      "https://x.com/affine_io/status/2041999022110490923",
      "https://subnetalpha.ai/subnet/affine/",
    ],
  },
  // ── NEW ENTRIES — Subnets with first-party live dashboards ──────────────
  {
    subnet_id: 8,
    subnet_name: "Vanta",
    benchmark_score: 91,
    benchmark_category: "Finance & Trading",
    vs_provider: "FTMO / The Funded Trader / Topstep / MyForexFunds",
    cost_saving_pct: 100,
    perf_delta: "100% profit split (vs 70–80% at FTMO/Topstep) · 1-step evaluation (vs 2-phase industry standard) · on-chain USDC payouts — no withdrawal delays · scale to $400K funded account",
    benchmark_summary: "Vanta (SN8) by Taoshi is the world's first hyperscaled decentralized prop firm — powered by Bittensor AI trading intelligence and settled on Hyperliquid's perp DEX. Flagship product Hyperscaled: 1-step funded account challenge, 10% profit target, 5% max drawdown, 100% profit split in USDC. All rules and payouts verifiable on-chain. Funded accounts scale from $25K to $400K. $30M+ paid out to traders. Launched February 2026 — pacing 5-10 new signups per day as of March 2026 at evaluation fees of $149–$349. Revenue ramping early-stage (~$500K/yr estimate). Beats centralized prop firms (FTMO/Topstep) on profit split, 1-step structure, and on-chain payout trust. $20B+ global prop trading industry. Additional products: GlitchFinancial (automated trading beta), 0x_Markets (DEX for crypto, forex, commodities).",
    active_users: "Prop traders globally — challenge tiers $25K / $50K / $100K",
    annual_revenue_usd: 500000,
    last_updated: "2026-05-25",
    sources: [
      "https://www.hyperscaled.trade/",
      "https://www.vantatrading.io/",
      "https://www.prnewswire.com/news-releases/taoshi-announces-vanta-trading-a-new-decentralized-prop-trading-evaluation-platform-302686852.html",
      "https://taoshi.io/vanta",
    ],
    dashboards: [
      { url: "https://www.hyperscaled.trade/", label: "Hyperscaled" },
      { url: "https://www.vantatrading.io/", label: "VantaTrading" },
      { url: "https://tokenomics.taoshi.io/", label: "Tokenomics" },
    ],
  },
  {
    subnet_id: 12,
    subnet_name: "ComputeHorde",
    benchmark_score: 74,
    benchmark_category: "AI Compute",
    vs_provider: "CoreWeave / Lambda Labs / Vast.ai",
    cost_saving_pct: 70,
    perf_delta: "Decentralized GPU compute with on-chain job verification",
    benchmark_summary: "ComputeHorde (SN12) is a decentralized compute network where miners run GPU workloads submitted by validators, who verify results using organic job requests. Jobs include LLM inference, image generation, and custom ML tasks. Metagraph and community contributions are tracked live via a Grafana dashboard at grafana.bittensor.church. Strong active community with transparent on-chain metrics.",
    active_users: "GPU compute users",
    annual_revenue_usd: 0,
    last_updated: "2026-05-04",
    sources: ["https://github.com/backend-developers-ltd/ComputeHorde"],
    dashboards: [
      { url: "https://grafana.bittensor.church/d/subnet/metagraph-subnet?var-subnet=12", label: "Grafana Dashboard" },
    ],
  },
  {
    subnet_id: 27,
    subnet_name: "Orion",
    benchmark_score: 38,
    benchmark_category: "Training Data Generation",
    vs_provider: "Scale AI / Surge AI / centralized data-labeling and dataset vendors",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Orion (SN27): A campaign-driven data subnet where data consumers define dataset requirements, miners compete to produce the data (pretraining, instruction-tuning, preference pairs, domain-specific content), and validators score submissions on compliance and quality. First consumer is SILX's Quasar model. Open Bittensor incentive where miners compete to produce datasets to spec, validated on quality/compliance, feeding SILX's own Quasar long-context model plus a planned commercial data product. Revenue: No revenue; pre-launch data subnet. Planned commercial data product mentioned but not shipped.. Caveats: Extremely early (repo days old, 6 commits, no README description); no dedicated website or X handle for Orion; heavily dependent on SILX's own Quasar as the sole initial consumer..",
    active_users: "No revenue; pre-launch data subnet. Planned commercial data product mentioned but not shipped.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/SILX-LABS/Orion",
      "https://github.com/SILX-LABS/QUASAR-SUBNET/",
      "https://silxinc.com/",
      "https://api.github.com/repos/SILX-LABS/Orion"
    ],
  },
  {
    subnet_id: 34,
    subnet_name: "BitMind",
    benchmark_score: 80,
    benchmark_category: "Security & Trust",
    vs_provider: "Hive Moderation / AWS Rekognition / Google SafeSearch",
    cost_saving_pct: 75,
    perf_delta: "Decentralized deepfake detection — distributed AI content authentication",
    benchmark_summary: "BitMind (SN34) is a decentralized AI content detection network specializing in deepfake identification. Miners run competing AI models that detect AI-generated images and video; validators challenge miners with new synthetic media. Dashboard tracks model accuracy scores, detection rates, and miner performance in a competitive leaderboard. Addresses the growing $4B+ AI content detection market as deepfake proliferation accelerates.",
    active_users: "Enterprise content platforms",
    annual_revenue_usd: 0,
    last_updated: "2026-05-04",
    sources: ["https://bitmind.ai/"],
    dashboards: [
      { url: "https://app.bitmind.ai/dashboard", label: "Detection Dashboard" },
    ],
  },
  {
    subnet_id: 46,
    subnet_name: "Zipcode (RESI)",
    benchmark_score: 55,
    benchmark_category: "Data",
    vs_provider: "Zillow Zestimate, CoreLogic",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Zipcode (RESI) (SN46): A decentralized real-estate intelligence network where miners build ONNX ML models that appraise/predict US residential property prices and collect property data, while validators score them against real sales data. The ZIPCODE portal (zipcode.ai) exposes appraisal workspaces and APIs on top of this open property database. RESI/Zipcode crowdsources both property data collection and competitive appraisal models on Bittensor, using a winner-takes-all incentive so the single best-performing valuation model earns ~99% of emissions. The result is an open, continuously benchmarked property-price oracle with public APIs instead of a closed proprietary Zestimate. Revenue: unknown/pre-revenue — appraisal API/portal exists but no revenue figure or paying-customer count disclosed. Caveats: Brand/scope churn: rebranded RESI -> ZIPCODE (also a newer @Zipcodenetwork handle) and pivoted from pure data-collection to appraisal models, leaving the original data repo stale. zipcode.ai is only a login portal with no public product detail, and no third-party accuracy benchmark vs Zestimate has been published..",
    active_users: "unknown/pre-revenue — appraisal API/portal exists but no revenue figure or paying-customer count disclosed",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://www.resilabs.ai/",
      "https://github.com/resi-labs-ai/RESI-models",
      "https://x.com/resilabsai",
      "https://www.coingecko.com/en/coins/resi"
    ],
  },
  {
    subnet_id: 82,
    subnet_name: "Compelle",
    benchmark_score: 60,
    benchmark_category: "AI Reasoning / Debate",
    vs_provider: "Asking a single frontier LLM (ChatGPT / Claude); no direct centralized debate-as-a-service equivalent",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Compelle (SN82): An adversarial AI-debate platform (Bittensor SN82) where two frontier AI models argue opposite sides of a user's question until one concedes or an independent multi-judge panel rules a winner. Users get the verdict, full transcript, and analysis of the decisive arguments. Runs continuously with open data, judges, strategies, and prompts. Single debates start ~$1.27; tournaments from ~$11, delivered in minutes. Structured adversarial debate with independent panel judging instead of one model's answer; open judges/strategies/prompts and a large corpus of judged debates as a decentralized subnet. Revenue: Consumer usage-based pricing live: debates from ~$1.27, tournaments from ~$11. Self-reported cumulative usage: 102,389 debates judged, 2,997 tournaments, 968,592 rounds, 8B tokens reasoned. Revenue figures not disclosed; usage stats are self-reported and unaudited.. Caveats: No team disclosed, no X/social presence, no third-party benchmark — usage stats are self-reported. Small repo/star count. Novel product category with unproven durable demand..",
    active_users: "Consumer usage-based pricing live: debates from ~$1.27, tournaments from ~$11. Self-reported cumulative usage: 102,389 debates judged, 2,997 tournaments, 968,592 rounds, 8B tokens reasoned. Revenue figures not disclosed; usage stats are self-reported and unaudited.",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://compelle.com/",
      "https://github.com/compelle/compelle-validator",
      "https://subnetalpha.ai/subnet/compelle/"
    ],
  },
  {
    subnet_id: 18,
    subnet_name: "Zeus",
    benchmark_score: 72,
    benchmark_category: "Climate & Environmental AI",
    vs_provider: "ECMWF / NOAA NWP / IBM Environmental Intelligence",
    cost_saving_pct: 80,
    perf_delta: "AI-driven forecasts at a fraction of physics-based NWP compute cost",
    benchmark_summary: "Zeus (SN18) by Orpheus AI is a decentralized climate and environmental forecasting subnet. Miners run AI models to predict weather variables using the ERA5 reanalysis dataset — the largest global environmental dataset in existence, with hourly measurements from 1940 to present across hundreds of variables. Traditional physics-based Numerical Weather Prediction (NWP) models like those run by ECMWF require hours of supercomputing time per forecast. Zeus incentivises AI-driven alternatives that are faster, cheaper, and continuously improving through competitive miner evolution. Published peer-reviewed research includes a Decentralized Mixture-of-Experts approach for state-of-the-art weather forecasting and Gridded Transformer Neural Processes for spatio-temporal data. The subnet supports both short-horizon (0–48h) and long-horizon (0–360h / 15-day) forecasts across all ERA5 variables.",
    active_users: "Climate researchers + energy market analysts",
    annual_revenue_usd: 0,
    last_updated: "2026-05-06",
    sources: [
      "https://www.zeussubnet.com/",
      "https://github.com/Orpheus-AI/Zeus",
    ],
    dashboards: [
      { url: "https://www.zeussubnet.com/", label: "Orpheus AI" },
    ],
  },
  // ── MAY 2026 RESEARCH SWEEP — NEW ENTRIES ────────────────────────
  {
    subnet_id: 33,
    subnet_name: "ReadyAI",
    benchmark_score: 71,
    benchmark_category: "Data & Intelligence",
    vs_provider: "Scale AI / Mechanical Turk / Labelbox",
    cost_saving_pct: 99,
    perf_delta: "660× cheaper than Mechanical Turk — Ipsos in production, 86% more accurate than human annotation",
    benchmark_summary: "ReadyAI (SN33) is a decentralized structured data annotation network. Miners convert unstructured data (conversations, surveys, Common Crawl) into AI-ready formats via survey tagging, NER, and multivariate annotation. Live in production with Ipsos — one of world's largest market research firms (6 total enterprise pilots). Claims 86% higher accuracy vs human annotation and 51% vs GPT-4o on survey tagging and NER tasks. 660× lower annotation costs than Mechanical Turk. Jobs Interface live for enterprise customers. Director of Sales (with $15M+ software sales track record) recently hired. One of the first Bittensor subnets to process core Fortune-500 enterprise data in production.",
    active_users: "Ipsos + 5 enterprise POC customers",
    annual_revenue_usd: 60000,
    last_updated: "2026-05-15",
    sources: [
      "https://readyai.ai/",
      "https://subnetalpha.ai/subnet/readyai/",
      "https://github.com/afterpartyai/bittensor-conversation-genome-project",
    ],
  },
  {
    // NOTE: netuid 53 was recycled — previously "Efficient Frontier (SignalPlus)"
    // (dead). Hanlin AI took over the slot ~end of April 2026 and launched Engy.
    subnet_id: 53,
    subnet_name: "Engy",
    benchmark_score: 75,
    benchmark_category: "AI Inference",
    vs_provider: "Z.ai (GLM first-party) / OpenRouter / OpenAI-compatible inference APIs",
    cost_saving_pct: 55,
    perf_delta: "~50-66% cheaper than Z.ai first-party GLM-5.2 pricing; first to run the full 753B GLM-5.2 on consumer GPUs; every response cryptographically verified",
    benchmark_summary: "Engy (SN53) by Hanlin AI serves verified inference for frontier open models: an OpenAI/Anthropic-compatible API where every response carries a TOPLOC activation fingerprint proving the exact pinned model checkpoint (Merkle model_root) produced it — no trusted hardware/TEEs. Live product with 90-day verified uptime (API gateway 99.69%, GLM-5.2 98.19%): GLM-5.2 753B NVFP4 on a 32× RTX 5090 cluster ($0.68/$1.50 per M tokens vs Z.ai's $1.40/$4.40 — cost edge independently cross-checked) and Qwen3.6-35B-A3B open to permissionless miners (~4,500 tok/s at 128 concurrent users per 8×4090 node). Anti-cheat live test caught an INT4 cheat claiming an FP8 root with zero false positives. Founder Ning Ren is ex-Google Brain (TensorFlow/TPU). Integrates with Claude Code, Cursor, Codex. Caveats: 'paying buyers' self-reported with no revenue figures; benchmarks self-published; ~3 weeks public; weight formation temporarily centralized (disclosed Phase-1 design); subnet emissions not yet re-enabled.",
    active_users: "Coding-agent users (Claude Code, Cursor, Codex, Hermes, OpenClaw integrations)",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://engy.ai",
      "https://engy.ai/status",
      "https://github.com/hanlinai/engy",
      "https://hanlin.ai",
    ],
    dashboards: [
      { url: "https://engy.ai/status", label: "Live Uptime" },
      { url: "https://engy.ai/providers", label: "GPU Fleet" },
      { url: "https://engy.ai/pricing", label: "Live Pricing" },
    ],
  },
  {
    subnet_id: 97,
    subnet_name: "Albedo",
    benchmark_score: 40,
    benchmark_category: "AI Inference",
    vs_provider: "Frontier LLM providers (OpenAI, Anthropic)",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Albedo (SN97): A king-of-the-hill Bittensor subnet for trajectory/model distillation, where miners compete to distill large language models into smaller, cheaper models that reproduce the frontier model's behavior. The current best submission holds the 'reigning champion' crown and its outputs power a King Chat demo. Albedo uses a king-of-the-hill incentive where miners must beat the reigning champion on distillation benchmarks to take over emissions, driving a continuously improving open distilled model. It is the SN97 successor to the earlier 'Distil' subnet, extended from competitive distillation to trajectory distillation. Revenue: unknown/pre-revenue — no product pricing, customers, or revenue disclosed. Caveats: Anonymous team, no verified X/social presence, and only ~2 stars/6 forks on GitHub. The website is a barebones dashboard hosted on Hippius decentralized storage whose panels mostly show 'loading…', benchmarks are self-reported, and the subnet was recently renamed from Distil — overall very early/low-profile..",
    active_users: "unknown/pre-revenue — no product pricing, customers, or revenue disclosed",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://github.com/unarbos/albedo",
      "https://github.com/unarbos/distil",
      "https://us-east-1.hippius.com/albedo/index.html"
    ],
  },
  {
    subnet_id: 114,
    subnet_name: "SOMA",
    benchmark_score: 58,
    benchmark_category: "Developer Tools",
    vs_provider: "Centralized MCP hosting / AWS Lambda for agent tools / Custom RAG pipelines",
    cost_saving_pct: 70,
    perf_delta: "Decentralized MCP infrastructure — 280% 30-day performance gain; perfectly timed with MCP protocol explosion",
    benchmark_summary: "SOMA (SN114) is decentralized Model Context Protocol (MCP) infrastructure — miners compete to deliver high-availability, low-latency MCP servers so AI agents can securely access tools and data sources. MCP is the dominant agent-tool connectivity standard in 2026, making SOMA's timing exceptional. First initiative: MCP competition focused on cost reduction, throughput, and scalability. Bridges Bittensor subnets as a unifying intelligence layer for agentic workflows. 280% gain in 30-day performance metrics (March 2026). Part of Project Rubicon (Base chain ERC-20 bridge integration). Built by DendriteHQ.",
    active_users: "AI agent developers",
    annual_revenue_usd: 0,
    last_updated: "2026-05-15",
    sources: [
      "https://thesoma.ai/",
      "https://github.com/DendriteHQ/SOMA",
    ],
  },
  {
    subnet_id: 118,
    subnet_name: "Ditto",
    benchmark_score: 55,
    benchmark_category: "Developer Tools",
    vs_provider: "mem0, OpenAI Memory, Letta",
    cost_saving_pct: 0,
    perf_delta: "Live product — no independent third-party benchmark published yet",
    benchmark_summary: "Ditto (SN118): A persistent memory and context layer for AI agents, letting them remember users across every chat, app and tool via an MCP-connected memory graph. The subnet (DittoBench) incentivizes miners to build memory-retrieval and context models that power the Ditto agent workspace. Ditto offers a portable, agent-native memory graph accessible from Claude, Cursor and other tools over MCP with zero-OAuth login, rather than a memory silo tied to one vendor. Miners on SN118 compete on DittoBench to produce better memory retrieval (composite + cross-encoder ranking over an embedded vector store), which the team claims delivers SOTA memory at a fraction of frontier cost. Revenue: unknown/pre-revenue — 2,100+ users and 54,000+ prompts self-reported on the consumer app; on-chain mining only launching mid-2026, no revenue figure disclosed. Caveats: On-chain X handle @heydittoai has a very small following (~30 followers), a separate @Ditto__AI account also exists causing brand ambiguity; mainnet mining is new/just launching and the 'SOTA memory at 1/100th frontier cost' claim is self-reported with no third-party benchmark..",
    active_users: "unknown/pre-revenue — 2,100+ users and 54,000+ prompts self-reported on the consumer app; on-chain mining only launching mid-2026, no revenue figure disclosed",
    annual_revenue_usd: 0,
    last_updated: "2026-07-21",
    sources: [
      "https://heyditto.ai/",
      "https://github.com/orgs/ditto-assistant/repositories",
      "https://x.com/heydittoai",
      "https://taodaily.io/ditto-sn118-open-sources-its-mining-stack-ahead-of-launch/"
    ],
  },
  {
    subnet_id: 121,
    subnet_name: "sundae_bar",
    benchmark_score: 48,
    benchmark_category: "Developer Tools",
    vs_provider: "UiPath / Automation Anywhere / ServiceNow AI agents",
    cost_saving_pct: 70,
    perf_delta: "Publicly listed on Aquis Stock Exchange (SBAR) — generalist enterprise AI agent in live development",
    benchmark_summary: "sundae_bar (SN121) is a marketplace connecting AI agent developers with enterprise users, running an incentivized economy for a single generalist AI agent capable of business workflow automation. Enterprise platform provides a single access point to rent and deploy AI-powered workforce automation. sundae_bar PLC is publicly listed on Aquis Stock Exchange (ticker: SBAR) — providing regulatory accountability rare among Bittensor subnets. Generalist commercial AI agent in live development as of December 2025, transitioning from internal testing to real-world Bittensor network training. Production-grade enterprise agent targeted.",
    active_users: "Enterprise workflow automation buyers",
    annual_revenue_usd: 0,
    last_updated: "2026-05-15",
    sources: [
      "https://www.investegate.co.uk/announcement/rns/sundae-bar-plc--sbar/update-on-generalist-ai-agent-development/9392632",
      "https://subnetalpha.ai/subnet/sundae_bar/",
    ],
  },
  {
    subnet_id: 123,
    subnet_name: "MANTIS",
    benchmark_score: 55,
    benchmark_category: "Finance & Trading",
    vs_provider: "Two Sigma / Numerai / Traditional Quant Signal Providers",
    cost_saving_pct: 75,
    perf_delta: "Decentralized institutional quant signal platform — launched Sep 2025, institutional interest confirmed",
    benchmark_summary: "MANTIS (SN123) is an AI-driven financial forecasting subnet. Miners generate trading signals and financial predictions; best signals are packaged as 'alpha' and sold to institutional and retail investors. Launched September 2025. Competes directly with SN8 (PTN) and SN88 (Mobius Investing) in the Bittensor quant space. Institutional players described as 'intrigued by its ability to monetize predictive analytics.' Pre-confirmed external revenue; signals model is live with leaderboard active.",
    active_users: "Quant traders + institutional investors",
    annual_revenue_usd: 0,
    last_updated: "2026-05-15",
    sources: [
      "https://www.ainvest.com/news/bittensor-subnets-62-123-120-catalysts-tao-institutional-takeoff-2509/",
      "https://www.altcoinbuzz.io/cryptocurrency-news/why-bittensor-subnets-62-123-120-have-top-potential/",
    ],
  },
  {
    subnet_id: 127,
    subnet_name: "Astrid SigmaArena",
    benchmark_score: 60,
    benchmark_category: "Finance & Trading",
    vs_provider: "FTMO / Topstep / Quantiacs (AI trading competitions)",
    cost_saving_pct: 0,
    perf_delta: "Publicly listed on Aquis Stock Exchange (ASTR) — AI trading bot competition live mainnet March 2026",
    benchmark_summary: "Astrid SigmaArena (SN127) is an autonomous AI trading competition platform — miners deploy AI trading bots competing in live market conditions. Best performers earn emissions and expand to FX and DeFi markets. Operated by Astrid Intelligence PLC, publicly listed on Aquis Stock Exchange Growth Market (ticker: ASTR). Validator launched on mainnet March 10, 2026. Astrid Intel FY2025 financials: net assets £7.24M (up from £514K), £10.5M capital raise, cash £2.31M. Acquired TaoFi (SN10/Sturdy) and rebranded as Astrid Bridge — significant ecosystem consolidation. Holds $600K+ in SN44 (Score) alpha tokens — active strategic investor in Bittensor.",
    active_users: "AI trading bot developers + institutional investors",
    annual_revenue_usd: 0,
    last_updated: "2026-05-15",
    sources: [
      "https://www.investegate.co.uk/announcement/rns/astrid-intelligence-plc--astr/annual-results/9447683",
      "https://www.investegate.co.uk/announcement/rns/astrid-intelligence-plc--astr/development-of-sigmaarena-on-subnet-127-/9227757",
      "https://arena.astrid.global/",
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

// Last updated: 2026-05-15
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
    milestone_date: "2026-03-31",
    title: "Hyperscaled Prop Firm live — 100% profit split, on-chain USDC payouts via Hyperliquid",
    description: "Vanta (SN8) launched Hyperscaled — the world's first on-chain prop firm. 1-step challenge: 10% profit target, 5% max drawdown, 100% profit split paid monthly in USDC direct to wallet (no withdrawal delays, no discretionary risk). Funded accounts scale to $400K ($2.5M roadmap). Powered by Bittensor AI trading intelligence + Hyperliquid perpetuals DEX. $30M+ paid out to traders lifetime. Beats every major centralized prop firm (FTMO, Topstep, The Funded Trader) on split, evaluation structure, and payout trust. $20B+ traditional prop trading industry TAM.",
    source_url: "https://www.hyperscaled.trade/",
    estimated_arr_usd: 1_200_000,
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

  // ── APRIL 2026 RESEARCH SWEEP — 45 NEW SUBNETS ──────────────────────

  // ── REVENUE-GENERATING ──────────────────────────────────────────────
  {
    netuid: 41,
    subnet_name: "Almanac (Sportstensor)",
    stage: "revenue",
    milestone_date: "2025-12-01",
    title: "$17,842 profit in Feb 2025 (178% ROI) — 350+ live Polymarket trades, Polymarket partnership",
    description: "Almanac (SN41) aggregates sports prediction signals from Sportstensor miners and auto-executes live trades on Polymarket, charging a 1% fee on winning trades. In February 2025 the treasury models generated ~$17,842 profit (178% monthly ROI) on 350+ executed Polymarket trades since Dec 2024. Strategic partnership with Polymarket confirmed Sept 2025. Covers NFL, NBA, MLB, NHL, EPL, MLS. Featured in Grayscale's April 2025 'Bittensor: The Internet of AI' report. Additional partnerships: Grid (esports data), Edge Onchain (algo trading). 1% fee on wins flows back to buy/burn SN41 tokens.",
    source_url: "https://beta.almanac.market/",
    estimated_arr_usd: 214000,
    confidence: "high",
  },
  {
    netuid: 58,
    subnet_name: "Dippy Speech",
    stage: "revenue",
    milestone_date: "2025-06-01",
    title: "Empathetic AI voice layer — 8.6M users, $40-60K/month Dippy app, $2.1M Drive Capital raised",
    description: "Dippy Speech (SN58) is the voice/speech infrastructure layer for the Dippy AI companion app — SN11 handles text roleplay while SN58 miners compete to produce the world's best empathetic speech models. The Dippy app generates $40-60K/month (~$600K ARR) from 8.6M users averaging 1hr/day. 150,000+ unique AI characters. $2.1M pre-seed raised (Drive Capital). Member of CreatorBid TAO Council. SN11 + SN58 form a complete AI companion stack on Bittensor.",
    source_url: "https://www.dippyspeech.com/",
    estimated_arr_usd: 0,
    confidence: "high",
  },
  {
    netuid: 13,
    subnet_name: "Gravity (Macrocosmos)",
    stage: "revenue",
    milestone_date: "2025-03-01",
    title: "World's largest open-source social dataset — 55B rows, paying customers, Gravity API live",
    description: "Data Universe (SN13) is Bittensor's decentralized data layer — miners scrape X/Twitter, Reddit, YouTube transcripts at scale. Gravity is the commercial product layer: customers specify data requirements, miners collect on-demand, customers pay on delivery. Gravity API launched Q1 2025 with paying customers (undisclosed figures). 55B+ rows scraped — 10.79% of all Hugging Face datasets. Powers downstream subnets (SN5, SN6). Built by Macrocosmos (also SN1, SN9, SN25, SN37). Analytics platform, data streaming, and YouTube ingestion added Q1 2025.",
    source_url: "https://macrocosmos.ai/",
    estimated_arr_usd: 100000,
    confidence: "medium",
  },
  {
    netuid: 6,
    subnet_name: "Numinous (Eversight)",
    stage: "revenue",
    milestone_date: "2025-09-01",
    title: "Eversight hedge fund AI — superhuman prediction ensemble, Nous Research $50M Paradigm raise halo",
    description: "SN6 is now Numinous — a decentralized forecasting protocol that aggregates hundreds of competing AI agents into superhuman predictive intelligence across prediction markets, geopolitics, sports, and macro. Consumer product Eversight is a chat/API interface targeting Polymarket traders and hedge funds. Nous Research (formerly on SN6) raised $50M Series A led by Paradigm at $1B valuation (April 2025). Hermes 3 open-source LLM has 50M+ downloads. Numinous now operates independently, leveraging the ecosystem credibility. Early hedge fund API access live. Token buyback model in place.",
    source_url: "https://www.tao.app/subnets/6",
    estimated_arr_usd: 50000,
    confidence: "medium",
  },
  {
    netuid: 45,
    subnet_name: "Gen42 (Rizzo Network)",
    stage: "revenue",
    milestone_date: "2025-11-01",
    title: "Gen42 AI coding assistant — subscription model live, first direct-to-consumer Rizzo product",
    description: "Gen42 (SN45) is a competitive AI coding assistant — Bittensor miners benchmark code generation models continuously, and Gen42 surfaces the best-performing outputs to developers. Free trial and subscription tiers live. Part of Rizzo Network's multi-subnet strategy (also SN20, SN58). First direct-to-consumer product from the Rizzo ecosystem. Positioned vs GitHub Copilot, Cursor, Claude Code in the $6B+ AI coding tools market.",
    source_url: "https://gen42.ai/",
    estimated_arr_usd: 30000,
    confidence: "low",
  },
  {
    netuid: 122,
    subnet_name: "Bitrecs",
    stage: "revenue",
    milestone_date: "2025-05-01",
    title: "Bitrecs AI product recommendations — live on Shopify App Store with paid plans and merchant installs",
    description: "Bitrecs (SN122) is an AI-powered product recommendation widget for Shopify and WooCommerce that uses Bittensor's consensus engine to query dozens of AI models (ChatGPT, Claude, Grok) in parallel and surface personalized upsell/cross-sell suggestions in real time. Live on the Shopify App Store with 5.0 star rating (7 reviews). Paid subscription plans live: Growth $14.99/mo, Pro $49/mo, Enterprise $199/mo. One verified merchant (Permanent Vacation, Canada) cited a 15% AOV lift after 8 months. WooCommerce widget also available. REST API and MCP server in development for headless/agentic commerce. Competing in the $3B+ ecommerce personalization market against Nosto, Rebuy, and LimeSpot.",
    source_url: "https://www.bitrecs.ai/",
    estimated_arr_usd: 20000,
    confidence: "medium",
  },

  // ── PARTNERSHIP / INVESTMENT ─────────────────────────────────────────
  {
    netuid: 87,
    subnet_name: "CheckerChain",
    stage: "partnership",
    milestone_date: "2025-11-01",
    title: "$1.15M investment from Lamida Crypto — S&P/Moody's for Web3 projects, live on mainnet",
    description: "CheckerChain (SN87) is a decentralized trust and review platform for Web3 projects — miners independently analyze crypto projects using a 40-page methodology and reach consensus through a tamper-proof evaluation system analogous to S&P Global/Moody's for the Web3 world. Anti-collusion mechanism: evaluators score independently without seeing others' opinions. $1.15M strategic investment from Lamida Crypto (November 2025). Live on mainnet. Token: $CRCN. Addresses the $20B+ credit rating market applied to the Web3 sector.",
    source_url: "https://checkerchain.com/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 54,
    subnet_name: "Yanez MIID",
    stage: "partnership",
    milestone_date: "2025-07-01",
    title: "$900K oversubscribed seed round — adversarial KYC/identity data for banks and compliance",
    description: "Yanez MIID (SN54) is a decentralized adversarial identity data generation platform — creates synthetic deepfake identities, adversarial biometric patterns, and adversarial KYC datasets that banks and identity verification companies use to stress-test fraud detection systems. Closed $900K Seed Part A in July 2025 (target $600K — 50% oversubscribed). Led by Jose Caldera and Asem Othman. Mainnet launch May 2025. Directly targets banks, IDV companies, and compliance vendors as B2B customers in the $3B+ KYC/AML market.",
    source_url: "https://www.yanezcompliance.com/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 25,
    subnet_name: "Mainframe (Macrocosmos)",
    stage: "partnership",
    milestone_date: "2025-08-01",
    title: "Rowan Scientific partnership — decentralized drug discovery compute, protein folding API live",
    description: "Mainframe (SN25) is Macrocosmos's decentralized science compute subnet — currently focused on protein molecular dynamics (OpenMM) and protein-ligand docking (DiffDock) for drug discovery pipelines. Partnership with Rowan Scientific for neural network potential (NNP) development announced — providing computational chemistry infrastructure for next-generation drug discovery. RESTful Folding API live for researchers and biotech companies. Part of the $75B+ pharma R&D market. Macrocosmos team runs SN1, SN9, SN13, SN25, SN37.",
    source_url: "https://macrocosmos.ai/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },

  // ── LIVE PRODUCTS ────────────────────────────────────────────────────
  {
    netuid: 1,
    subnet_name: "Apex (Macrocosmos)",
    stage: "live",
    milestone_date: "2025-01-01",
    title: "Decentralized LLM inference API — chat completions + web retrieval, Macrocosmos ecosystem",
    description: "Apex (SN1) is Macrocosmos's competitive LLM inference routing subnet. Miners run LLMs competing on accuracy across Q&A, summarization, code debugging, math, and translation. API live with chat completions and web retrieval (RAG-like) endpoints. Free tier 100 req/hr; validator tier 1,000 req/hr. Part of Macrocosmos's full decentralized AI stack (SN1 inference → SN9 pretraining → SN13 data → SN25 science compute → SN37 finetuning). GitHub: macrocosm-os/apex.",
    source_url: "https://macrocosmos.ai/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 17,
    subnet_name: "404-GEN (Three Gen)",
    stage: "live",
    milestone_date: "2025-04-28",
    title: "21.5M+ AI-generated 3D models — world's largest open-source 3D dataset, Unity Asset Store live",
    description: "404-GEN (SN17) is a decentralized text-to-3D generation network where miners run GPU nodes producing 3D models (Gaussian Splatting, NeRF, 3D Diffusion) from text prompts. Unity Plugin (v0.4.0) published to Unity Asset Store — first blockchain-based 3D generation plugin on the Store. Blender Add-on (v0.9.0) also live. 21.5M+ AI-generated 3D models — world's largest open-source 3D dataset. Team of ~10 from gaming/VFX backgrounds. Launched April 28, 2024. Covered by VentureBeat, GamesBeat, BlockchainGamer.biz. Targeting $200B+ gaming and VR/AR content creation market.",
    source_url: "https://github.com/404-Repo/three-gen-subnet",
    estimated_arr_usd: 0,
    confidence: "high",
  },
  {
    netuid: 24,
    subnet_name: "OMEGA Labs",
    stage: "live",
    milestone_date: "2025-06-01",
    title: "OMEGA Focus app live — world's largest AGI multimodal dataset, computer-use AI training data",
    description: "OMEGA Labs (SN24) is building the world's largest decentralized AGI multimodal dataset targeting 1M+ hours of video and 30M+ 2-minute clips. OMEGA Focus is a 1-click screen-recording app where users complete tasks and upload recordings to train computer-use AI agents (analogous to Anthropic Computer Use, OpenAI Operator). Hugging Face dataset: omegalabsinc/omega-multimodal publicly available. $24.8M token market cap. Positions directly against Scale AI and Appen in the $5B+ AI training data market. Computer-use agent training is an emerging $50B+ category.",
    source_url: "https://github.com/omegalabsinc/omegalabs-bittensor-subnet",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 16,
    subnet_name: "BitAds",
    stage: "live",
    milestone_date: "2024-12-01",
    title: "Proof-of-Sale advertising network — advertisers only pay on verified conversions, not clicks",
    description: "BitAds (SN16) is a blockchain-native performance advertising network built on Bittensor. Advertisers stake SN16 alpha tokens to acquire marketing bandwidth; publisher-miners pick up campaigns and drive traffic; rewards are released only upon verified conversions (actual sales) — not clicks or impressions. This 'Proof-of-Sale' model aligns all incentives around real commercial outcomes. One of the earliest product-focused subnets (launched late 2023). Addresses the $1T+ digital ad market via the $17B+ affiliate/performance marketing segment. Whitepaper at bitads.ai/whitepaper.",
    source_url: "https://bitads.ai/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 31,
    subnet_name: "NASChain",
    stage: "live",
    milestone_date: "2025-01-01",
    title: "Beat Google NAS solvers on CIFAR-10 — decentralized neural architecture search, 2-4% SOTA accuracy gain",
    description: "NASChain (SN31) is a decentralized neural architecture search network where miners compete to discover smaller, more accurate AI model architectures, submitting best PyTorch models to HuggingFace for evaluation. Claims to have beaten Google's best NAS solvers on CIFAR-10, with discovered architectures showing 2–4% higher accuracy than SOTA at similar parameter counts. Real-time visualization dashboard live at dashboard.naschain.ai. Addresses the ~$6B AutoML market. GitHub: neuronlogic/NASChain.",
    source_url: "https://www.naschain.ai/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 36,
    subnet_name: "Autoppia (Web Agents)",
    stage: "live",
    milestone_date: "2025-06-01",
    title: "Permissionless adaptive web automation agents — handles dynamic UI without breaking",
    description: "Autoppia (SN36) is a permissionless network of autonomous web agents that navigate websites, fill forms, extract data, and complete transactions on behalf of users. Unlike traditional RPA tools that break when site layouts change, Autoppia's AI agents adapt dynamically to any website interface. Fully permissionless. Live on Bittensor mainnet. Addresses the $13B+ RPA/web automation market with an AI-native architecture. GitHub: autoppia/autoppia_web_agents_subnet.",
    source_url: "https://autoppia.com/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 37,
    subnet_name: "Aurelius (Macrocosmos)",
    stage: "live",
    milestone_date: "2025-06-01",
    title: "LLM finetuning + AI alignment stress-testing — hallucination detection, Macrocosmos + Taoverse",
    description: "Aurelius (SN37) is evolving from an LLM fine-tuning competition subnet into an AI alignment stress-testing platform that identifies hallucinations and systematic misalignments in deployed models. Miners train and submit models to HuggingFace; real-time leaderboard live. Joint product of Macrocosmos and Taoverse. Commercial fine-tuning API in development. Part of the $5B+ LLM fine-tuning market. GitHub: macrocosm-os/finetuning.",
    source_url: "https://www.macrocosmos.ai/sn37",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 48,
    subnet_name: "NextPlace AI",
    stage: "live",
    milestone_date: "2025-09-01",
    title: "Decentralized real estate price prediction — claims to outperform Zillow, CompCurve partnership",
    description: "NextPlace AI (SN48) is the first decentralized real estate AI subnet — miners deploy predictive models forecasting home sale prices and dates for millions of US properties daily, scored against actual closed sales. Claims accuracy outperforming Zillow and Redfin on some metrics. Data sourced from Redfin; covers NY, SF, Seattle and expanding. Strategic partnership with CompCurve for bulk real estate data. Revenue roadmap: API subscriptions, affiliate marketing, third-party data licensing. Built by Nickel5 (same team as Bettensor/SN30 and Almanac/SN41 — proven execution track record). Competing with Zillow's $2B/year revenue in proptech.",
    source_url: "https://nextplace.ai/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 49,
    subnet_name: "Nepher Robotics",
    stage: "live",
    milestone_date: "2025-11-01",
    title: "Decentralized robotics policy competition — NVIDIA Omniverse/Isaac Sim, SimStore for open-sourced policies",
    description: "Nepher Robotics (SN49) is a decentralized robotics policy competition platform where miners train sim-to-real robotic control policies in NVIDIA Omniverse/Isaac Sim and compete in physics simulations. Winning policies are open-sourced via SimStore (simstore.nepher.ai). EnvHub (envhub.nepher.ai) hosts Isaac Sim environments for community use. Launched November 2025. First robotics-focused Bittensor subnet. Addresses the $8B+ robotics AI market with NVIDIA Omniverse as central infrastructure.",
    source_url: "https://nepher.ai/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 61,
    subnet_name: "RedTeam (Innerworks)",
    stage: "live",
    milestone_date: "2024-12-23",
    title: "Gamified decentralized cybersecurity — ethical hackers earn TAO bypassing bot detection, enterprise bounty model",
    description: "RedTeam (SN61) is the world's first decentralized gamified cybersecurity platform where ethical hackers (miners) submit exploit code to bypass bot detection systems, earning TAO rewards. Validated exploits are integrated into open-source defenses. Built by Innerworks — a specialist in next-generation behavioral biometrics. Launched December 2024 (GlobeNewswire coverage). Future revenue model: enterprises post paid cybersecurity bounties via validators. Miners rewarded on performance, originality, and stake. Addresses the $250B+ cybersecurity market; bot management alone $1.5B+.",
    source_url: "https://innerworks.com/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 70,
    subnet_name: "Vericore (dFusion AI)",
    stage: "live",
    milestone_date: "2025-04-01",
    title: "Semantic fact verification network — prediction market tracker beta live, Yuma accelerator backed",
    description: "Vericore (SN70) is an open semantic verification network that validates facts and scores information sources across text, audio, and video at scale. First application is predict.dfusion.ai — a real-time prediction market tracker in beta. Yuma-accelerated subnet (Barry Silbert personally announced as the 9th Yuma subnet). Launched Q1/Q2 2025 on Bittensor mainnet. Addresses the $10B+ content verification and AI misinformation market. GitHub: dfusionai/Vericore.",
    source_url: "https://www.dfusion.ai/vericore",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 74,
    subnet_name: "Gittensor",
    stage: "live",
    milestone_date: "2025-06-01",
    title: "Pays developers TAO for merged open-source PRs — GitHub-native cryptographic incentive layer",
    description: "Gittensor (SN74) is a decentralized incentive protocol that pays developers in TAO alpha tokens for making verified, merged pull requests to approved open-source repositories. Miners register with a GitHub personal access token; validators verify merged PRs and score by code quality, repo weight, and language. No special app needed beyond GitHub. Creates a cryptographic incentive layer on top of existing GitHub contribution workflows. Addresses the challenge of financially rewarding open-source contributors in the $600B+ software development ecosystem.",
    source_url: "https://subnetalpha.ai/subnet/gittensor/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 78,
    subnet_name: "Loosh AI",
    stage: "live",
    milestone_date: "2025-12-01",
    title: "Machine consciousness Cognition Engine beta live — persistent memory + ethical reasoning for AI agents, Yuma-accelerated",
    description: "Loosh AI (SN78) is the first Bittensor subnet focused on machine consciousness — a 'Cognition Engine' that provides persistent working memory, long-term memory, multi-stage reasoning, and deontological/ethical evaluation modules for robots and agentic AI systems. Ensures AI agents act predictably and ethically across sessions. Cognition Engine Beta launched December 2025. Yuma-accelerated (Barry Silbert ecosystem). Founded by Lisa Cheng. Covered by IBTimes and Financial Tech Times. Addresses the $180B+ enterprise AI and robotics safety market.",
    source_url: "https://www.loosh.ai/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 91,
    subnet_name: "Tensorprox",
    stage: "live",
    milestone_date: "2025-04-01",
    title: "Decentralized DDoS protection — eBPF/XDP firewall nodes, 'decentralized Cloudflare', listed on MEXC",
    description: "Tensorprox (SN91) is a decentralized DDoS mitigation and firewall service by SHUGO LLC — miners deploy eBPF/XDP-based traffic filtering nodes; validators audit real-time performance. Positioned as a decentralized alternative to Cloudflare/Akamai/Fastly at OSI Layers 3–7. Uses ML for continuously evolving anomaly detection. Listed on MEXC exchange. Market cap ~$3.36M. DDoS attacks cost businesses $1M+/hour — the global DDoS protection market is projected at $7B+ by 2028.",
    source_url: "https://subnetalpha.ai/subnet/tensorprox/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 84,
    subnet_name: "ChipForge (TatsuProject)",
    stage: "live",
    milestone_date: "2025-05-01",
    title: "First decentralized chip design subnet — RISC-V processor completed, path to real silicon via Google OpenMPW",
    description: "ChipForge (SN84) is the world's first decentralized hardware design subnet — miners compete to design real silicon chips (AI accelerators, cryptographic modules, mini-GPUs) using Verilog/SystemVerilog, evaluated by automated EDA tools on functionality, area, timing, and power. First major milestone: completed a full RISC-V processor core with crypto extensions (M, C, K). Next focus: Edge AI NPUs. Path to physical production via Google OpenMPW shuttles (open-source chip fabrication runs). Backed by Tatsu validator team. Covered by CoinPedia, CryptoPaper, U.Today. Addresses the $600B+ semiconductor market where chip design tools alone are a $12B market.",
    source_url: "https://subnetalpha.ai/subnet/chipforge/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 95,
    subnet_name: "Actual Computer",
    stage: "live",
    milestone_date: "2025-10-23",
    title: "Enterprise AI inference on decentralized compute — 110%+ token surge, Anthropic co-founder signal",
    description: "Actual Computer (SN95) provides high-performance AI inference software and distributed computing solutions for enterprise AI deployment via the Bittensor network. Token surged 110%+ since October 23, 2025 launch. Followed by Jack Clark (Anthropic co-founder) on X — notable credibility signal. Based in Venice, CA (CEO Tom A. Lynch). Described as 'The Quietest High-Conviction Bet on Bittensor' by SubnetEdge. Addresses the $40B+ AI inference and enterprise MLOps market projected by 2030.",
    source_url: "https://actual.inc/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },

  // ── BETA / EARLY ACCESS ─────────────────────────────────────────────
  {
    netuid: 5,
    subnet_name: "Hone",
    stage: "beta",
    milestone_date: "2025-10-01",
    title: "Hone — decentralized hierarchical pretraining by Manifold Labs (builders of Targon SN4)",
    description: "Hone (SN5) is a decentralized hierarchical pretraining subnet built by Manifold Labs, the same team behind Targon (SN4). Miners participate in distributed LLM pretraining with hierarchical reward coordination. Applies evolutionary selection pressure to training runs — better-performing training earns more, creating a self-improving network. Website: hone.training.",
    source_url: "https://github.com/manifold-inc/hone",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 9,
    subnet_name: "IOTA (Macrocosmos)",
    stage: "beta",
    milestone_date: "2025-12-01",
    title: "Train at Home — distributed LLM pretraining on consumer hardware (MacBook/Mac Mini), Rowan Scientific partnership",
    description: "IOTA (SN9) is Macrocosmos's distributed LLM pretraining subnet — transforms participants into a single cooperative training unit using data-parallel and pipeline-parallel training across heterogeneous, unreliable devices globally. Train at Home is the consumer product: a no-code app letting anyone (including MacBook/Mac Mini owners) contribute compute to pretraining AI models and earn TAO. Launched November-December 2025. Arxiv paper published (July 2025). Partnership with Rowan Scientific for neural network potential development. Currently supports macOS (Apple Silicon); Windows/Linux expansion planned.",
    source_url: "https://iota.macrocosmos.ai/",
    estimated_arr_usd: 0,
    confidence: "high",
  },
  {
    netuid: 15,
    subnet_name: "BitQuant (OpenGradient)",
    stage: "beta",
    milestone_date: "2025-06-01",
    title: "DeFi AI intelligence — natural language crypto/DeFi queries, Berkeley Function Calling Leaderboard",
    description: "BitQuant (SN15) is a decentralized AI DeFi intelligence platform by OpenGradient. Users ask natural language questions about crypto, DeFi pools, portfolios, and risk; AI agent miners fetch on-chain and off-chain data and provide answers. Models compete on the Berkeley Function Calling Leaderboard — open-source models (≤8B params) benchmarked against industry leaders. Apache 2.0 licensed. 230% token appreciation in recent 30-day period (late 2025). Addresses the $15B+ fintech analytics market. Competitors: Nansen, Dune Analytics, Messari.",
    source_url: "https://bittensor123.com/subnets/sn15/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 20,
    subnet_name: "Bounty Hunter (Rizzo Network)",
    stage: "beta",
    milestone_date: "2025-07-01",
    title: "$130K+ community reward pool — crowdsourced AI benchmark challenges, MSPTech B2B product live",
    description: "SN20 (Rizzo Network) pivoted from BitAgent (tool-calling benchmark subnet) to Bounty Hunter — a crowdsourced AI benchmark challenge system where the community funds and competes on breakthrough AI tasks. $130K+ reward pool (85,000+ SN20 tokens) active mid-2025. Commercial B2B product MSPTech.ai is live: AI-powered IT support ticket automation for managed service providers (MSPs). GoGoAgent (AI workflow automation) also built on SN20. Part of Rizzo Network's multi-subnet ecosystem (SN20, SN45, SN58).",
    source_url: "https://rizzo.network/subnet-20/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 23,
    subnet_name: "Nuance",
    stage: "beta",
    milestone_date: "2025-04-01",
    title: "Financial incentives for quality online discourse — 400K+ Sybil-protected accounts, launched April 2025",
    description: "Nuance (SN23) is a decentralized incentive layer for improving the quality of online discourse, starting on X/Twitter. It evaluates replies and posts for factuality, granularity, and tone using the DeSciearch AI API combined with Rayon Labs' evaluation mechanism. Users and miners who post high-quality factual replies earn TAO rewards. Ratings sourced from 400,000+ Sybil-attack-protected accounts. Launched April 2025. Plans to expand beyond X. References 2024 Pew Research Center Digital Trust Study as motivation. Addresses the $5B+ content moderation and trust/safety market.",
    source_url: "https://github.com/NuanceNetwork/Nuance",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 26,
    subnet_name: "Storb",
    stage: "beta",
    milestone_date: "2025-06-01",
    title: "Decentralized object storage — erasure coding + Bittensor incentives, alternative to AWS S3",
    description: "Storb (SN26) is a distributed object storage subnet. When users upload files, validators break them into chunks using erasure coding, distribute to miners for redundant storage, and periodically challenge miners to prove data retention. Hybrid architecture: off-chain storage for speed + on-chain Bittensor incentives for reliability. Up to 256 nodes (64 validators, 192 miners). Addresses the $100B+ cloud storage market dominated by AWS S3, Google Cloud Storage. Similar model to Filecoin/Arweave but built natively on Bittensor incentives. GitHub: storb-tech/storb.",
    source_url: "https://storb.dev/",
    estimated_arr_usd: 0,
    confidence: "low",
  },
  {
    netuid: 28,
    subnet_name: "Foundry S&P Oracle",
    stage: "beta",
    milestone_date: "2024-02-20",
    title: "Decentralized S&P 500 price oracle — institutional operator (Foundry Digital/DCG), 5-min prediction cycles",
    description: "SN28 is the Foundry S&P 500 Oracle — a financial prediction subnet operated by Foundry Digital (one of the largest Bitcoin mining and staking companies, backed by Digital Currency Group). Miners continuously predict S&P 500 prices during trading hours; best predictions aggregated into a decentralized financial oracle. Launched February 20, 2024. Represents significant institutional validation — Foundry Digital's involvement signals enterprise-grade credibility. Addresses the $8B+ financial data and oracle market. Competitors: Chainlink, Pyth Network, Bloomberg.",
    source_url: "https://github.com/foundryservices/snpOracle",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 43,
    subnet_name: "Graphite AI",
    stage: "beta",
    milestone_date: "2025-06-01",
    title: "Graph optimization + crypto copy trading — TSP routing efficiency, TaoTrader portfolio platform",
    description: "Graphite AI (SN43) is a decentralized graph optimization network originally focused on NP-hard routing problems (Traveling Salesman Problem, multi-vehicle TSP). Claims up to 7% efficiency improvement on routing problems. Pivoting toward financial applications — TaoTrader (taotrader.xyz) is a 'Leader-Copy Trader' system for crypto portfolio optimization. Commercial subnet API planned for Phase 2b to monetize validator bandwidth. Addresses logistics optimization ($15B+ software market) and algorithmic trading tools simultaneously.",
    source_url: "https://graphite-ai.net/",
    estimated_arr_usd: 0,
    confidence: "low",
  },
  {
    netuid: 47,
    subnet_name: "Condense AI",
    stage: "beta",
    milestone_date: "2025-06-01",
    title: "LLM token compression API — 35-45% fewer tokens, 'pay on what you save' pricing",
    description: "Condense AI (SN47) is a token compression API for LLMs — condenses long input sequences into compact soft tokens, reducing inference cost by 35-45% while maintaining ~90% contextual accuracy. 'Pay on what you save' pricing model. Useful for RAG pipelines, chat frameworks, and long-document processing where input tokens drive API cost. Addresses the $5B+ LLM API market. NOTE: SubnetAlpha currently lists SN47 as 'FOR SALE' — project may be seeking acquisition or new ownership; viability uncertain.",
    source_url: "https://www.condenses.ai/",
    estimated_arr_usd: 0,
    confidence: "low",
  },
  {
    netuid: 55,
    subnet_name: "Precog (Coin Metrics)",
    stage: "beta",
    milestone_date: "2025-06-01",
    title: "BTC price forecast every 5 minutes — Coin Metrics institutional data, simulated positive returns vs buy-and-hold",
    description: "Precog (SN55) is a high-frequency Bitcoin price forecasting subnet built in collaboration with Yuma (DCG subsidiary) and backed by Coin Metrics' institutional-grade market data. Miners produce forward-looking BTC price signals every 5 minutes (1-hour lookahead), aggregated into a consensus forecast. Simulated trading tests show consistently positive returns above buy-and-hold. Exploring expanded coverage: TAO token, volatility forecasting, funding rates. API monetization in development. Addresses the $1B+ crypto market intelligence and institutional data subscription market.",
    source_url: "https://coinmetrics.io/company-news/precog-coin-metrics-bittensor-subnet/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 63,
    subnet_name: "Quantum Innovate (qBitTensor)",
    stage: "beta",
    milestone_date: "2025-07-07",
    title: "Decentralized quantum circuit simulation marketplace — backed by Quantum Rings Inc.",
    description: "Quantum Innovate (SN63) is a decentralized marketplace for quantum circuit simulation — miners run classical hardware to simulate quantum algorithms and return results as if executed on real quantum processors. Launched July 7, 2025 by qBitTensor Labs, backed by Quantum Rings Inc. (a Colorado-based quantum startup led by Bob Wold). One of the first quantum-focused Bittensor subnets. Addresses the $450B+ quantum computing market projected by 2040 — democratizing access before real quantum hardware is widely available.",
    source_url: "https://www.qbittensorlabs.com/",
    estimated_arr_usd: 0,
    confidence: "low",
  },
  {
    netuid: 66,
    subnet_name: "Oceans",
    stage: "beta",
    milestone_date: "2025-06-01",
    title: "Decentralized Bittensor liquidity management — miners provide concentrated LP to subnet token pools",
    description: "Oceans (SN66) is a decentralized liquidity management protocol for the Bittensor ecosystem. Miners compete to provide concentrated liquidity to Bittensor subnet token pools based on governance votes from SN66 Alpha holders. Alpha holders vote to direct miner liquidity; miners can burn SN66 Alpha for weight multipliers. Addresses liquidity fragmentation and slippage across Bittensor's growing subnet token market. Part of the $50B+ decentralized exchange liquidity infrastructure market. GitHub: Oceans-Subnet/oceans_subnet.",
    source_url: "https://oceans66.com/",
    estimated_arr_usd: 0,
    confidence: "low",
  },
  {
    netuid: 67,
    subnet_name: "Tenex",
    stage: "beta",
    milestone_date: "2025-06-01",
    title: "Leveraged margin trading for Bittensor subnet tokens — long-only TAO collateral protocol",
    description: "Tenex (SN67) is a long-only leveraged margin trading protocol for Bittensor subnet alpha tokens — users borrow TAO against their TAO collateral to amplify exposure to subnet tokens. Long-only design prevents shorting to avoid sell pressure on subnet tokens. CLI tools exist; web interface in development. Developed by the TaoMind/Tenexium team. Addresses the gap in DeFi derivatives and leveraged trading instruments native to the Bittensor dTAO ecosystem.",
    source_url: "https://subnetalpha.ai/subnet/tenex/",
    estimated_arr_usd: 0,
    confidence: "low",
  },
  {
    netuid: 73,
    subnet_name: "MetaHash",
    stage: "beta",
    milestone_date: "2025-06-01",
    title: "OTC marketplace for subnet alpha tokens — Dutch auction swaps for miners, treasury yield generation",
    description: "MetaHash (SN73) is a decentralized OTC marketplace for Bittensor miners to swap earned subnet alpha tokens for the MetaHash META token, via a Dutch auction mechanism that avoids impacting on-chain pools. Treasury is used for cross-subnet liquidity provision and yield generation. MetaHash Group also acts as a subnet portfolio manager. Solves the illiquid exit problem for miners holding small-cap subnet alpha tokens. GitHub: fx-integral/metahash. Documentation at docs.metahash73.com.",
    source_url: "https://mh73.com/",
    estimated_arr_usd: 0,
    confidence: "low",
  },
  {
    netuid: 77,
    subnet_name: "Liquidity Mining (SN77)",
    stage: "beta",
    milestone_date: "2025-06-01",
    title: "On-chain liquidity mining for Bittensor subnet tokens — governance-directed LP rewards",
    description: "SN77 is a complete on-chain liquidity mining system for the Bittensor ecosystem. Token holders vote on liquidity pools and validators process votes to assign miner weights and rewards, incentivizing liquidity provision for Bittensor subnet tokens in external DeFi markets. Open-source, MIT licensed. Part of the growing DeFi infrastructure layer being built around Bittensor's dTAO subnet token economy. GitHub: CreativeBuilds/sn77.",
    source_url: "https://github.com/CreativeBuilds/sn77",
    estimated_arr_usd: 0,
    confidence: "low",
  },
  {
    netuid: 79,
    subnet_name: "τaos (Trading Simulation)",
    stage: "beta",
    milestone_date: "2025-05-07",
    title: "Automated trading strategy simulation — synthetic financial datasets for quant algorithm training",
    description: "τaos (SN79) is a large-scale agent-based simulation of automated trading strategies where miners submit risk-managed algorithmic trading logic; the network produces synthetic datasets mimicking real-world asset class market conditions. Launched May 7, 2025. Weekly simulation configuration updates. Detailed whitepaper published April 2025. The synthetic financial datasets produced are the primary commercial deliverable — targeting quantitative finance teams needing diverse, realistic training data for automated trading algorithms. GitHub: taos-im/sn-79.",
    source_url: "https://taos.im/",
    estimated_arr_usd: 0,
    confidence: "medium",
  },
  {
    netuid: 80,
    subnet_name: "AI Factory (FacTAO)",
    stage: "beta",
    milestone_date: "2025-03-28",
    title: "AI-generated AI marketplace — 'one-stop hub' for Bittensor AI model marketplaces",
    description: "AI Factory (SN80) is an AI-generated AI marketplace by FacTAO — a platform where AI models generate and validate other AI outputs, aiming to become a 'one-stop hub for all marketplaces on the Bittensor network.' Launched March 2025. Concept: automating AI model creation and evaluation through AI-driven processes, reducing human involvement in AI output generation pipelines. Early stage; proving concept.",
    source_url: "https://subnetalpha.ai/subnet/aifactory/",
    estimated_arr_usd: 0,
    confidence: "low",
  },
  {
    netuid: 83,
    subnet_name: "CliqueAI (TopTensor)",
    stage: "beta",
    milestone_date: "2025-06-01",
    title: "AI-powered maximum clique solver — distributed NP-hard graph optimization, rewards algorithmic novelty",
    description: "CliqueAI (SN83) is an AI-powered distributed maximum clique solver network by TopTensor — miners compete to solve complex graph optimization problems, with AI curating problems and evaluating both solution optimality and algorithmic diversity. Four-stage autonomous mechanism: problem selection → miner selection → scoring → weight setting. Rewards miners on solution quality AND algorithmic novelty (not just best answer). Maximum clique problems have real applications in drug discovery, network security, and social graph analysis. NP-hard combinatorial optimization is a critical but computationally intractable class of problems.",
    source_url: "https://subnetalpha.ai/subnet/clique/",
    estimated_arr_usd: 0,
    confidence: "low",
  },
  {
    netuid: 86,
    subnet_name: "MIAOAI",
    stage: "beta",
    milestone_date: "2025-06-01",
    title: "E-commerce customer service AI — Lucky Cat product, Alibaba dialogue training data, multilingual",
    description: "MIAOAI (SN86) is a decentralized AI training network specializing in e-commerce customer service. Miners train AI agents on Alibaba e-commerce dialogue datasets. End product is 'Lucky Cat' — a personalized AI customer service tool for e-commerce sellers that loads local knowledge bases (products, FAQs) for multilingual support. Targets e-commerce sellers globally with affordable, multilingual, configurable AI customer service. Addresses the $5B+ customer service AI market projected by 2027. GitHub: MIAOAI-Subnet/MIAOAI_SUBNET.",
    source_url: "https://github.com/MIAOAI-Subnet/MIAOAI_SUBNET",
    estimated_arr_usd: 0,
    confidence: "low",
  },
  {
    netuid: 92,
    subnet_name: "StoryNet",
    stage: "beta",
    milestone_date: "2025-06-01",
    title: "Decentralized AI story generation — structured narrative pipeline, API for game/app developers",
    description: "StoryNet (SN92) is a decentralized AI-powered interactive story generation network. Miners compete to produce high-quality narrative content through a structured pipeline: Blueprint → Characters → Arc → Chapters. Evaluated on technical quality (30%), structure (40%), and content (30%). API available for game and app developers. Targets the $12B+ game AI market projected by 2030 — providing scalable narrative infrastructure for interactive media. Unlike unconstrained LLM generation, StoryNet's structured scoring produces more consistent, higher-quality narrative outputs. GitHub: StorynetAI/storynet-subnet.",
    source_url: "https://storynet.app/",
    estimated_arr_usd: 0,
    confidence: "low",
  },
  {
    netuid: 94,
    subnet_name: "Bitsota (Alveus Labs)",
    stage: "beta",
    milestone_date: "2025-03-01",
    title: "AutoML research competition — 90% emissions burned unless genuine SOTA breakthrough is proven",
    description: "Bitsota (SN94) is a decentralized AutoML research competition by Alveus Labs — miners use genetic programming to evolve ML algorithms, earning rewards ONLY when they achieve verified new state-of-the-art results on AI benchmark tasks (currently CIFAR-10). ~90% of emissions are burned unless genuine breakthrough progress occurs. Cryptographic verification of genuine algorithmic breakthroughs. Opens AI research to global contributors. The burn mechanism creates deflationary pressure on emissions while ensuring only real progress is rewarded. Eastworld AI (eastworld.ai) monitors SN94 as a real-time AI evolution viewer. GitHub: AlveusLabs/SN94-BitSota.",
    source_url: "https://subnetalpha.ai/subnet/bitsota/",
    estimated_arr_usd: 0,
    confidence: "low",
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
    else if (b.annual_revenue_usd >= 100_000)  revBonus = 3;  // early revenue — real but small
    else if (b.annual_revenue_usd > 0)         revBonus = 1;  // minimal / pilot revenue

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
