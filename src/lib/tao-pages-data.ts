/**
 * Curated SEO content for TAO Pages (/taopages/[slug])
 * Each entry contains rich, plain-English descriptions written for
 * anyone — zero crypto or AI knowledge required.
 */

export type SubnetType =
  | "Inference"
  | "Training"
  | "Compute"
  | "Storage"
  | "Agents"
  | "Data"
  | "Finance"
  | "Science"
  | "Creative"
  | "Tools";

export interface TaoPageSubnet {
  netuid: number;
  slug: string;
  name: string;
  category: string;
  /** Broad Bittensor subnet type used for index filtering */
  subnetType: SubnetType;
  tagline: string;
  /** Mainstream product/company this is most like */
  mainstream: string;
  /** 2-3 sentence problem statement */
  problem: string;
  /** 2-3 sentence competitive differentiator */
  differentiator: string;
  /** Primary search keywords for this page */
  keywords: string[];
  /** Optional: what external benchmark it competes on */
  benchmarkLabel?: string;
}

export const TAO_PAGES_SUBNETS: TaoPageSubnet[] = [
  {
    netuid: 64,
    slug: "chutes",
    name: "Chutes",
    category: "AI Infrastructure",
    subnetType: "Inference",
    tagline: "Serverless AI compute at the speed of thought",
    mainstream: "Vercel (for AI apps) or AWS Lambda",
    problem:
      "Running AI in production is expensive and complicated. You either pay for idle GPU capacity around the clock or deal with slow cold-start times that frustrate users. Most developers and startups simply can't afford to deploy their AI models at real scale.",
    differentiator:
      "Chutes uses Bittensor's incentive layer to continuously attract the cheapest, most available GPU compute worldwide. With 400,000+ users and 100 billion tokens processed every day, it's one of the most widely used real applications built on Bittensor — and it costs 85% less than AWS.",
    keywords: [
      "serverless AI compute",
      "GPU inference marketplace",
      "deploy AI models cheap",
      "Bittensor AI infrastructure",
      "Chutes Bittensor",
      "cheap AI API",
    ],
    benchmarkLabel: "Inference throughput vs Replicate, Modal",
  },
  {
    netuid: 4,
    slug: "targon",
    name: "Targon",
    category: "Privacy AI",
    subnetType: "Inference",
    tagline: "Run AI so private even the server can't read your data",
    mainstream: "OpenAI API (but with cryptographic privacy guarantees)",
    problem:
      "Most AI APIs can see everything you send them — your questions, your documents, your proprietary business data. For hospitals, law firms, and any company handling sensitive information, that's a dealbreaker. Switching to open-source models still requires trusting whoever runs the servers.",
    differentiator:
      "Targon (by Manifold Labs) runs AI inside Intel TDX and AMD SEV trusted execution environments — hardware-level cryptographic enclaves where even the server operator can't read your data. With $70M+ in NVIDIA hardware (H200s, L40s), 1,500+ GPU nodes, ~$100K/month in real revenue, and a $10.5M Series A raised in August 2025, it's one of the most commercially validated subnets in the entire Bittensor ecosystem.",
    keywords: [
      "private AI inference",
      "confidential computing AI",
      "secure AI API",
      "privacy-preserving machine learning",
      "Targon Bittensor",
      "Targon Virtual Machine",
    ],
  },
  {
    netuid: 120,
    slug: "affine",
    name: "Affine",
    category: "AI Model Evaluation",
    subnetType: "Tools",
    tagline: "Independent panels of evaluators that AI companies can't influence",
    mainstream: "Consumer Reports or NIST AI benchmarks",
    problem:
      "Almost all AI model evaluations are run by the companies that built the models. There's an obvious incentive to inflate scores and hide weaknesses. Single-lab evaluations can also miss blind spots that a diverse group of evaluators would catch.",
    differentiator:
      "Affine coordinates multiple independent teams who evaluate AI models simultaneously without being able to compare notes or coordinate results. The outcome is an unbiased, multi-perspective assessment that's far more trustworthy than any single lab's review — like having ten independent auditors instead of one.",
    keywords: [
      "AI model evaluation",
      "independent AI benchmarking",
      "AI testing platform",
      "trustworthy AI evaluation",
      "Affine Bittensor",
      "reason mining",
    ],
  },
  {
    netuid: 51,
    slug: "lium",
    name: "Lium",
    category: "GPU Compute",
    subnetType: "Compute",
    tagline: "AI-grade GPUs at 90% off — no waiting list, no enterprise contract",
    mainstream: "RunPod or Vast.ai",
    problem:
      "High-performance GPU compute is expensive and bottlenecked by a handful of big cloud providers. AI researchers, startups, and independent developers are routinely priced out of the hardware they need. Waiting lists and opaque pricing make planning nearly impossible.",
    differentiator:
      "Lium delivers AI-grade GPUs at 90% less cost than RunPod or Vast.ai, with comparable or better performance benchmarks. Because GPU providers compete continuously on the Bittensor network, prices stay low and quality stays high — not as a promise, but as a structural outcome.",
    keywords: [
      "cheap GPU rental",
      "AI compute marketplace",
      "RunPod alternative",
      "Vast.ai alternative",
      "affordable GPU cloud",
      "Lium Bittensor",
    ],
  },
  {
    netuid: 8,
    slug: "vanta",
    name: "Vanta",
    category: "Prop Trading",
    subnetType: "Finance",
    tagline: "Prove your edge, get funded, keep every dollar of profit",
    mainstream: "Topstep or FTMO (prop trading firms)",
    problem:
      "Talented traders can't access real capital without joining a traditional prop firm that takes large cuts and imposes restrictive rules. The evaluation process is expensive, the terms are opaque, and disputes have no neutral arbiter.",
    differentiator:
      "Vanta is the first decentralized, trustless prop trading infrastructure. Prove your strategy works, get access to a funded account, and keep 100% of profits. All performance is verified on-chain — no disputes, no hidden rules, no middleman taking a cut.",
    keywords: [
      "decentralized prop trading",
      "funded trader program",
      "prop firm Bittensor",
      "trading capital decentralized",
      "Vanta Bittensor",
      "Taoshi trading",
    ],
  },
  {
    netuid: 62,
    slug: "ridges",
    name: "Ridges",
    category: "AI Dev Tools",
    subnetType: "Tools",
    tagline: "AI agents that actually close GitHub issues — not just autocomplete",
    mainstream: "GitHub Copilot or Devin (Cognition AI)",
    problem:
      "AI coding tools generate code snippets, but they don't actually solve problems. Real software development requires understanding a codebase, writing tests, running them, and iterating until the issue is resolved — not just suggesting the next line of code.",
    differentiator:
      "Ridges agents are benchmarked against real GitHub issues and SWE-bench — the gold standard for AI software engineering — not toy puzzles. At $10/month versus $200+/year for GitHub Copilot, it costs a fraction of the price while solving far more complex tasks.",
    keywords: [
      "AI coding agent",
      "GitHub issue solver",
      "SWE-bench AI",
      "AI software engineering",
      "Ridges Bittensor",
      "automated bug fixing",
    ],
    benchmarkLabel: "SWE-bench verified score",
  },
  {
    netuid: 44,
    slug: "score",
    name: "Score",
    category: "Computer Vision",
    subnetType: "Tools",
    tagline: "Full match analytics in 2 minutes for $10 — for any team in the world",
    mainstream: "Second Spectrum or Hawk-Eye (pro sports tracking)",
    problem:
      "Advanced sports analytics — player tracking, movement heat maps, tactical breakdowns — costs tens of thousands of dollars per team annually. Only elite professional clubs can afford it. Grassroots teams, academies, and semi-pro leagues are completely locked out.",
    differentiator:
      "Score analyzes a full 90-minute match in under 2 minutes for $10, tracking every player's position, speed, and movement throughout the game. This makes professional-grade sports analytics accessible to any team at any level — from Sunday league to the first division.",
    keywords: [
      "AI sports analytics",
      "computer vision football",
      "player tracking AI",
      "match analysis software",
      "Score Bittensor",
      "affordable sports data",
    ],
  },
  {
    netuid: 9,
    slug: "iota",
    name: "Iota",
    category: "AI Model Training",
    subnetType: "Training",
    tagline: "Train frontier AI models from your laptop — no PhD required",
    mainstream: "SETI@home or Folding@home (but building AI instead of searching for aliens)",
    problem:
      "Training frontier AI models costs hundreds of millions of dollars and is only possible for OpenAI, Google, and a handful of other companies. The rest of the world uses whatever those companies decide to release. There has never been a permissionless way to participate in building foundational AI.",
    differentiator:
      "IOTA (Incentivised Orchestrated Training Architecture, by Macrocosmos) uses pipeline-parallel training to distribute model layers across miners, streaming activations between them — enabling model sizes that exceed any single GPU's VRAM. A 'Train at Home' initiative lets consumer GPU owners contribute with zero ML knowledge required. Model size scales with the number of participants, not individual VRAM, making it adversarially robust even with untrusted nodes.",
    keywords: [
      "distributed AI training",
      "decentralized LLM training",
      "contribute to AI training",
      "Bittensor training subnet",
      "Iota Bittensor",
      "permissionless AI",
    ],
    benchmarkLabel: "LLM benchmark (MMLU, HellaSwag)",
  },
  {
    netuid: 75,
    slug: "hippius",
    name: "Hippius",
    category: "Decentralized Cloud",
    subnetType: "Storage",
    tagline: "60% cheaper than Amazon S3 — with a public receipt for every file",
    mainstream: "Amazon S3 or Dropbox",
    problem:
      "Cloud storage is controlled by AWS, Google, and Azure — centralized services that can read your files, shut down your account, and raise prices whenever they want. Developers and businesses have no real alternative that offers comparable reliability and tooling.",
    differentiator:
      "Hippius offers decentralized file storage for 60% less than Amazon S3, using familiar developer tools (S3-compatible APIs) so there's no migration overhead. Every storage operation is verifiable on-chain — you can independently confirm your files are intact and exactly what you're paying for.",
    keywords: [
      "decentralized cloud storage",
      "Amazon S3 alternative",
      "blockchain file storage",
      "cheap object storage",
      "Hippius Bittensor",
      "censorship-resistant storage",
    ],
  },
  {
    netuid: 56,
    slug: "gradients",
    name: "Gradients",
    category: "AutoML",
    subnetType: "Training",
    tagline: "Fine-tune AI models for $5/hr — life sciences teams already use it",
    mainstream: "AWS SageMaker or DataRobot",
    problem:
      "Fine-tuning AI models for specific industries requires expensive ML engineers and cloud compute that costs $30–60 per hour. Most companies end up using generic off-the-shelf models that don't fit their specific domain — in medicine, finance, or law, that gap really matters.",
    differentiator:
      "Gradients delivers AI model fine-tuning for $5/hour versus $30–60/hour on AWS, using a competitive network of GPU providers. Life sciences companies are already using it for specialized medical model training that was previously cost-prohibitive. The competitive network structure means price and quality improve over time, not just once.",
    keywords: [
      "AutoML platform",
      "AI fine-tuning service",
      "cheap model training",
      "GPU training marketplace",
      "Gradients Bittensor",
      "machine learning automation",
    ],
  },
  {
    netuid: 68,
    slug: "nova",
    name: "Nova",
    category: "Drug Discovery AI",
    subnetType: "Science",
    tagline: "Scanning 65 billion molecules to find the next medicine",
    mainstream: "Schrödinger or Insilico Medicine (computational drug discovery)",
    problem:
      "Drug discovery takes 12+ years and costs $2.6 billion per approved drug. The biggest bottleneck is the computational experimentation phase — running molecular simulations to identify which of billions of candidate molecules are worth testing in a lab. Only major pharmaceutical companies can afford this.",
    differentiator:
      "Nova (MetaNova Labs) screens 65 billion drug molecules to identify the most promising candidates, with 79% greater accuracy than previous methods. By distributing the compute across the Bittensor network, it makes pharmaceutical-grade molecular modeling accessible to any research team — not just the ones with supercomputers.",
    keywords: [
      "drug discovery AI",
      "molecular docking simulation",
      "computational drug design",
      "biotech AI platform",
      "Nova Bittensor",
      "MetaNova Labs",
    ],
    benchmarkLabel: "Binding affinity prediction accuracy",
  },
  {
    netuid: 17,
    slug: "404gen",
    name: "404 Gen",
    category: "3D Generative AI",
    subnetType: "Creative",
    tagline: "Type a description. Get a 3D model. Print it or build with it.",
    mainstream: "Meshy AI or Luma AI (3D generation tools)",
    problem:
      "Creating 3D assets is extremely expensive — a single professional 3D model can cost thousands of dollars and weeks of work. Game studios, architects, VR developers, and e-commerce businesses are constantly bottlenecked by the cost and time of 3D content production.",
    differentiator:
      "404—GEN built the world's largest open-source 3D dataset with over 21 million models. A competitive network of AI generators keeps quality continuously improving through Bittensor's incentive model. The result is a text-to-3D pipeline that produces print-ready and game-ready models on demand, for a fraction of traditional production cost.",
    keywords: [
      "AI 3D model generation",
      "text to 3D model",
      "3D asset creation AI",
      "generative 3D content",
      "404 Gen Bittensor",
      "open source 3D dataset",
    ],
  },
  {
  netuid: 1,
  slug: "apex",
  name: "Apex",
  category: "AI Competition Platform",
  subnetType: "Tools",
  tagline: "Game-theoretic AI competitions where any algorithm can win — on-chain, every round",
  mainstream: "Kaggle, ARC Prize, or OpenAI Evals",
  problem:
    "There is no open, on-chain competitive arena for algorithm and agent development that rewards genuine innovation on arbitrary problem domains. Kaggle competitions are centralized and infrequent; academic benchmarks don't pay out.",
  differentiator:
    "Apex (by Macrocosmos) has evolved into a modular competition platform where miners submit Python-based algorithms evaluated across diverse problem domains in competitive Rounds. Apex 3.0 outsources inference to Chutes (SN64) and web retrieval to Data Universe (SN13), making it a hub in the Bittensor ecosystem. Any algorithmic or agentic task can be hosted — miners earn TAO for winning, not just participating.",
  keywords: [
    "AI competition platform",
    "algorithm optimization",
    "game-theoretic AI",
    "Apex Bittensor Macrocosmos",
    "decentralized AI benchmarks",
    "agentic reasoning contests",
  ],
},

{
  netuid: 2,
  slug: "dsperse",
  name: "DSperse",
  category: "Zero-Knowledge AI Verification",
  subnetType: "Tools",
  tagline: "160 million ZK proofs — trustless AI inference you can independently verify",
  mainstream: "Modulus Labs, EZKL, or Proof of AI",
  problem:
    "AI outputs from unknown servers can't be independently verified. Businesses using AI APIs have to trust the provider ran the correct model on the correct input — there is no cryptographic receipt. In regulated industries, healthcare, and financial services, that blind trust is a liability.",
  differentiator:
    "DSperse (formerly Omron) has processed 160 million+ zero-knowledge proofs — making it the world's largest decentralized ZK proving cluster. Every AI inference is accompanied by a cryptographic proof that the computation happened correctly, without revealing the underlying data. Enterprise-focused with a Rust-based Expander ZK backend for high performance.",
  keywords: [
    "zero-knowledge proofs AI",
    "verifiable AI inference",
    "ZK-ML",
    "trustless AI",
    "DSperse Bittensor",
    "enterprise AI verification",
  ],
},

{
  netuid: 3,
  slug: "templar",
  name: "Templar",
  category: "Decentralized AI Training",
  subnetType: "Training",
  tagline: "Incentivized internet-wide LLM pre-training, no data center required",
  mainstream: "A decentralized substitute for training frontier LLMs on a single centralized GPU supercluster (e.g. Meta/OpenAI training runs)",
  problem:
    "Frontier model pre-training is locked behind massive centralized GPU clusters and closed labs; there is no permissionless way to pool global compute to train large models.",
  differentiator:
    "Fully permissionless, whitelist-free distributed pre-training over commodity internet using SparseLoCo (sparsification + 2-bit quant + error feedback) for 146x comms reduction; produced an openly released 72B model (Apache license).",
  keywords: [
    "decentralized training",
    "pre-training",
    "LLM",
    "SparseLoCo",
    "Covenant-72B",
    "permissionless compute",
  ],
},

{
  netuid: 5,
  slug: "hone",
  name: "Hone",
  category: "AI Agents",
  subnetType: "Agents",
  tagline: "Autonomous agents that get sharper over time",
  mainstream: "AutoGPT or LangChain Agents",
  problem:
    "Most AI agents follow fixed instructions and never improve from their mistakes. When an agent fails at a task, users have to manually debug and prompt-engineer a fix. Agents deployed in production today are brittle and require constant human supervision.",
  differentiator:
    "Hone uses reinforcement signals from real task outcomes to continuously refine its agent fleet. Miners are rewarded for agents that successfully complete goals, creating evolutionary pressure toward smarter, more reliable autonomous behavior over time.",
  keywords: [
    "autonomous AI agents",
    "self-improving agents",
    "Bittensor agent subnet",
    "Hone Bittensor",
    "reinforcement learning agents",
    "AI task automation",
  ],
},

{
  netuid: 6,
  slug: "numinous",
  name: "Numinous",
  category: "AI Forecasting Agents",
  subnetType: "Agents",
  tagline: "A swarm of competing AI agents that predict the future better than any single model",
  mainstream: "Metaculus, Polymarket, or Good Judgment Project",
  problem:
    "Single-model forecasting is brittle and overconfident — one AI's prediction is only as good as its training data and assumptions. Geopolitical events, market shocks, and complex social dynamics require diverse perspectives and genuine uncertainty quantification that no single system can provide.",
  differentiator:
    "Numinous coordinates a competitive swarm of autonomous forecasting agents that analyze geopolitical, financial, and social signals, evaluated using rigorous Brier scoring. It recently launched 'Indicia' — a curated OSINT signal engine fed by X and Liveuamap with timestamps and confidence scores — giving miners real-world intelligence to work with. The competitive pressure between agents produces calibrated predictions that emerge from diversity rather than being imposed by a single model.",
  keywords: [
    "AI forecasting agents",
    "prediction markets",
    "geopolitical intelligence",
    "OSINT AI",
    "calibrated forecasting",
    "Numinous Bittensor",
  ],
},

{
  netuid: 7,
  slug: "allways",
  name: "Allways",
  category: "Distributed Compute",
  subnetType: "Compute",
  tagline: "Compute that finds a way, every way, always",
  mainstream: "AWS EC2 or Google Compute Engine",
  problem:
    "Cloud compute bills spiral out of control as applications scale, and you are always paying for peak capacity even when demand is low. Vendor lock-in means migrating away from expensive cloud providers is a months-long engineering project. Small teams simply cannot compete with companies that have negotiated enterprise cloud contracts.",
  differentiator:
    "Allways routes compute jobs to the cheapest available decentralized nodes in real time, automatically shifting workloads as prices and availability change. The Bittensor incentive layer ensures miners maintain uptime standards, giving you cloud-like reliability at spot-market prices.",
  keywords: [
    "decentralized cloud compute",
    "cheap GPU compute",
    "Bittensor compute subnet",
    "Allways Bittensor",
    "AWS alternative decentralized",
    "distributed compute marketplace",
  ],
},

{
  netuid: 10,
  slug: "swap",
  name: "Swap",
  category: "DeFi",
  subnetType: "Finance",
  tagline: "Bringing deep cross-chain liquidity to Bittensor",
  mainstream: "Uniswap and centralized exchanges (Coinbase, Binance)",
  problem:
    "Buying Bittensor subnet (alpha) tokens historically required native TAO wallets and multi-step bridging, blocking mainstream DeFi users on Base/Ethereum from entering the ecosystem. Thin on-chain liquidity made trading TAO and alpha tokens slow and expensive.",
  differentiator:
    "SN10 turns liquidity provision into an incentivized subnet, deploying Uniswap v3 on Bittensor EVM so a TAO/USDC pool has deep, miner-supplied liquidity. Combined with Hyperlane cross-chain routing, TaoFi lets users swap from an EVM wallet into any of 100+ subnet tokens in a single transaction at a 0.1% fee.",
  keywords: [
    "bittensor defi",
    "tao usdc pool",
    "cross-chain swap",
    "subnet 10 swap",
    "taofi liquidity",
    "alpha token dex",
  ],
},

{
  netuid: 11,
  slug: "trajectoryrl",
  name: "TrajectoryRL",
  category: "AI Agent Optimization",
  subnetType: "Tools",
  tagline: "The on-chain market for AI agent prompts that actually cut costs",
  mainstream: "PromptLayer, Braintrust, or LangSmith",
  problem:
    "Deploying AI agents in production is expensive — models burn tokens on verbose instructions, redundant tool calls, and poorly-structured prompts that cost more but perform worse. There has been no competitive market to discover the most cost-efficient agent policies at scale.",
  differentiator:
    "TrajectoryRL runs an on-chain tournament where miners write self-contained 'policy packs' — system prompts, tool rules, and stop conditions — evaluated on safety, cost-efficiency, and task correctness. The cheapest qualifying submission wins, creating a structural incentive to drive LLM agent costs down. No GPU required to mine — just prompt engineering skill.",
  keywords: [
    "prompt optimization",
    "AI agent policy",
    "LLM cost reduction",
    "agent benchmarking",
    "TrajectoryRL Bittensor",
    "decentralized prompt engineering",
  ],
},

{
  netuid: 12,
  slug: "compute-horde",
  name: "Compute Horde",
  category: "Distributed Compute",
  subnetType: "Compute",
  tagline: "A horde of GPUs available on demand",
  mainstream: "CoreWeave or Vast.ai",
  problem:
    "GPU availability for AI workloads is constrained and expensive, with long wait queues on cloud providers and opaque pricing. Independent GPU owners have idle capacity but no easy way to monetize it. The result is wasted hardware on one side and frustrated developers on the other.",
  differentiator:
    "Compute Horde aggregates idle GPU capacity from thousands of miners worldwide into a single, programmable compute pool. Bittensor's incentive layer automatically verifies work is completed correctly and pays miners fairly, creating a self-sustaining marketplace with transparent pricing.",
  keywords: [
    "GPU marketplace decentralized",
    "idle GPU monetization",
    "Bittensor GPU compute",
    "Compute Horde Bittensor",
    "distributed GPU network",
    "rent GPU decentralized",
  ],
},

{
  netuid: 13,
  slug: "data-universe",
  name: "Data Universe",
  category: "Decentralized Data",
  subnetType: "Data",
  tagline: "17 billion items of live social data — the largest open-source social dataset in existence",
  mainstream: "Bright Data, Apify, or Common Crawl",
  problem:
    "High-quality, fresh, large-scale training data is expensive and controlled by a few vendors charging enterprise fees. AI teams especially need recent social media data — Reddit posts, X/Twitter content — but getting it at scale requires expensive commercial contracts.",
  differentiator:
    "Data Universe (by Macrocosmos) mines 350M+ rows per day from Reddit and X, with 17+ billion total items published on HuggingFace — 10x the size of the previously largest open-source social media dataset. The 'Gravity' marketplace lets customers specify exactly what data they want, miners collect it, and customers pay for verified datasets. It now powers other Bittensor subnets, including GAIA (SN57) for weather signal augmentation.",
  keywords: [
    "social media AI data",
    "Reddit training data",
    "X Twitter dataset",
    "Data Universe Bittensor",
    "open social media dataset",
    "AI training data marketplace",
  ],
},

{
  netuid: 14,
  slug: "cacheon",
  name: "Cacheon",
  category: "AI Inference",
  subnetType: "Inference",
  tagline: "A competitive market for faster, cheaper LLM inference",
  mainstream: "Together AI / Fireworks AI / NVIDIA TensorRT-LLM (optimized inference stacks)",
  problem:
    "Serving large language models cheaply and quickly requires hand-tuned GPU kernels and inference stacks that today only well-resourced centralized labs (Together, Fireworks, NVIDIA) produce, keeping optimization work closed and expensive.",
  differentiator:
    "Cacheon crowdsources kernel and server optimization through an open, quality-gated competition on real datacenter GPUs (4x B300 on a MiniMax-M3 arena), rewarding only measured throughput gains at equal output fidelity rather than paying for stake or registration.",
  keywords: [
    "decentralized inference",
    "bittensor SN14",
    "LLM inference optimization",
    "GPU kernels",
    "triton cutedsl",
    "cacheon",
  ],
},

{
  netuid: 15,
  slug: "oro",
  name: "ORO",
  category: "AI Agent Evaluation / Agentic Commerce",
  subnetType: "Tools",
  tagline: "Where AI learns to shop.",
  mainstream: "OpenAI Operator / Amazon Rufus / closed shopping-agent benchmarks",
  problem:
    "Agentic-commerce capability is measured by closed-door, non-reproducible internal benchmarks, so there's no open, independently-verified way to know which shopping agents actually work.",
  differentiator:
    "Open, publicly-auditable agent competition ('no closed-door benchmarks') where every score is independently reproduced by multiple validators over a real 2.5M-product catalog, with emissions rewarding the top agents.",
  keywords: [
    "shopping agents",
    "ShoppingBench",
    "agent evaluation",
    "agentic commerce",
    "Docker sandbox",
    "open benchmark",
  ],
},

{
  netuid: 16,
  slug: "fast-thinker",
  name: "Fast Thinker",
  category: "Reasoning Model Optimization",
  subnetType: "Training",
  tagline: "Making reasoning models faster, leaner, and more efficient without sacrificing performance",
  mainstream: "OpenAI o-series / DeepSeek-R1 reasoning-model efficiency work (centralized R&D labs)",
  problem:
    "Reasoning models are expensive and token-hungry; there is no open, incentivized marketplace for compact adapters that preserve reasoning accuracy while cutting token cost.",
  differentiator:
    "Incentivized, repeatable adapter competition scored on both accuracy and token efficiency, with anti-gaming measures (encrypted manifests, deterministic generators, six-epoch maturation), versus closed lab R&D.",
  keywords: [
    "reasoning",
    "lora",
    "adapter",
    "efficiency",
    "math",
    "long-context",
  ],
},

{
  netuid: 18,
  slug: "zeus",
  name: "Zeus",
  category: "Climate Forecasting",
  subnetType: "Science",
  tagline: "Decentralized climate forecasting — accuracy verified on-chain",
  mainstream: "The Weather Company (IBM) or Climate Corp",
  problem:
    "Commercial weather and climate forecasting is dominated by centralized providers whose models are expensive, opaque, and inaccessible to smaller businesses, researchers, and developing-world users who need accurate forecasts the most.",
  differentiator:
    "Zeus (by Ørpheus AI) runs a competitive decentralized climate forecasting network where miners produce probabilistic weather predictions scored against observed outcomes. On-chain incentives reward accuracy rather than brand reputation, creating a transparent forecasting layer that anyone can verify and build on.",
  keywords: [
    "climate forecasting AI",
    "weather AI decentralized",
    "Bittensor climate subnet",
    "Zeus Bittensor",
    "Orpheus AI",
    "decentralized meteorology",
  ],
},

{
  netuid: 19,
  slug: "blockmachine",
  name: "blockmachine",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Decentralized, verifiable RPC infrastructure with work-based payouts",
  mainstream: "Alchemy / Infura / QuickNode",
  problem:
    "Blockchain apps depend on centralized RPC providers (Alchemy, Infura) that are single points of failure, can censor or throttle, and price by tiered subscription rather than actual work. There is little transparency into node correctness or uptime.",
  differentiator:
    "Miners bid a USD price per request unit and the protocol routes traffic to the cheapest correct nodes, so a competitive supplier market drives cost down instead of up. Responses are continuously verified against known-good references and you pay only for successful requests; public dashboards show latency and uptime.",
  keywords: [
    "decentralized RPC",
    "bittensor SN19",
    "archive node",
    "ethereum RPC",
    "verifiable infrastructure",
    "blockmachine",
  ],
},

{
  netuid: 20,
  slug: "groundlayer",
  name: "GroundLayer",
  category: "Capital Markets Infrastructure / OTC",
  subnetType: "Finance",
  tagline: "Structured, on-chain OTC capital raises for Bittensor subnets",
  mainstream: "Crypto OTC trading desks (Genesis, Cumberland) and traditional structured private-placement/OTC markets",
  problem:
    "Subnet owners need funding but spot-selling alpha damages price and credibility; informal OTC deals lack enforceable terms and trust; institutions lack a structured on-chain entry point to Bittensor exposure.",
  differentiator:
    "Claims 0% spot price impact on raises and 100% on-chain smart-contract enforcement with a three-party aligned incentive model, versus trust-based off-chain OTC handshakes.",
  keywords: [
    "OTC marketplace",
    "subnet tokens",
    "capital raise",
    "on-chain enforcement",
    "alpha token",
    "structured deals",
  ],
},

{
  netuid: 21,
  slug: "adtao",
  name: "AdTAO",
  category: "Prediction Market / AdTech",
  subnetType: "Data",
  tagline: "A live, verifiable prediction engine for Google Ads performance",
  mainstream: "Google Ads performance forecasting / agency PPC consultants / ad-optimization SaaS",
  problem:
    "Advertisers spend ~$291B/yr on Google Ads with performance forecasting locked inside opaque agency expertise and Google's own black-box tools; no verifiable, independent forecast market exists.",
  differentiator:
    "Cryptographically sealed, timelock-committed predictions bound to each miner and reproducible by any chain reader; turns distributed miners into an auditable forecast market rather than trusting a single agency.",
  keywords: [
    "google ads",
    "prediction market",
    "ppc",
    "ad performance",
    "timelock",
    "forecasting",
  ],
},

{
  netuid: 22,
  slug: "desearch",
  name: "Desearch",
  category: "AI Search Engine",
  subnetType: "Inference",
  tagline: "AI-powered search across the entire web — unbiased, verifiable, and uncensored",
  mainstream: "Perplexity AI, You.com, or Bing AI",
  problem:
    "Centralized AI search engines curate results based on advertising relationships and opaque ranking algorithms. Users can't tell if results are being filtered or promoted. For research, journalism, or any high-stakes query, that lack of transparency is a fundamental problem.",
  differentiator:
    "Desearch is a decentralized AI search engine that returns verifiable results across X, Reddit, Arxiv, Hacker News, Wikipedia, YouTube, and the general web — with no single company controlling rankings. Every result has a traceable source, and the distributed architecture means no government or advertiser can suppress results.",
  keywords: [
    "AI search engine",
    "decentralized search",
    "unbiased web search",
    "Desearch Bittensor",
    "Perplexity alternative",
    "multi-source AI search",
  ],
},

{
  netuid: 23,
  slug: "trishool",
  name: "Trishool",
  category: "AI Safety / Alignment Auditing",
  subnetType: "Science",
  tagline: "Sovereign, market-validated safety for AI.",
  mainstream: "In-house red-teaming / alignment eval labs at OpenAI, Anthropic (e.g. Petri-style auditing)",
  problem:
    "Safety evaluation and red-teaming of frontier models is done behind closed doors by the same labs building the models, with no open, trustless, continuously-incentivized auditing at scale.",
  differentiator:
    "Automates the safety loop via open competition — miners are economically rewarded for surfacing misaligned behaviors, producing a continuously-updated, decentralized safety benchmark rather than one-off internal audits.",
  keywords: [
    "AI alignment",
    "safety auditing",
    "red teaming",
    "Petri",
    "LLM evaluation",
    "deception detection",
  ],
},

{
  netuid: 24,
  slug: "quasar",
  name: "Quasar",
  category: "Science",
  subnetType: "Training",
  tagline: "Open long-context foundation models trained on decentralized compute",
  mainstream: "Closed long-context frontier models (Google Gemini, OpenAI GPT long-context)",
  problem:
    "Standard transformers scale attention quadratically, making very long context windows expensive, and the leading long-context models are closed, gated, and trained on centralized GPU clusters out of reach for most builders.",
  differentiator:
    "Quasar uses linear continuous-time attention aiming to handle millions of tokens at a fraction of the compute, and trains on Bittensor's distributed miner network rather than a central cluster. Every model ships with full open weights under Apache 2.0, no waitlist or gating.",
  keywords: [
    "long context model",
    "bittensor SN24",
    "linear attention",
    "decentralized training",
    "open foundation model",
    "quasar silx",
  ],
},

{
  netuid: 25,
  slug: "mainframe",
  name: "Mainframe",
  category: "Life Sciences Compute",
  subnetType: "Science",
  tagline: "Decentralized compute for drug discovery, protein folding, and molecular dynamics",
  mainstream: "Folding@home, D.E. Shaw Research, or Schrödinger",
  problem:
    "Computational biology workloads — protein folding, molecular dynamics, drug-ligand docking — require enormous GPU clusters that smaller biotech companies and academic research groups simply cannot afford. Life science breakthroughs are being delayed because only the biggest pharmaceutical companies can run the simulations.",
  differentiator:
    "Mainframe (by Macrocosmos) is Bittensor's DeSci flagship, supporting OpenMM molecular dynamics, DiffDock protein-ligand docking, and neural network potentials via a production partnership with Rowan Scientific. It has evolved from a single-task protein folding subnet into a generalizable platform for any computational biology workload — accessible to any research team worldwide.",
  keywords: [
    "drug discovery compute",
    "protein folding AI",
    "molecular dynamics",
    "DiffDock",
    "Mainframe Bittensor",
    "decentralized life sciences",
  ],
},

{
  netuid: 26,
  slug: "perturb",
  name: "Perturb",
  category: "AI Security / Adversarial Robustness",
  subnetType: "Tools",
  tagline: "Harden Your AI Against Invisible Attacks",
  mainstream: "Centralized AI red-teaming / model-security vendors (HiddenLayer, Robust Intelligence, Protect AI)",
  problem:
    "AI models are silently vulnerable to adversarial inputs; single-pixel or noise perturbations can flip state-of-the-art model outputs, and centralized red-teaming is narrow and infrequent.",
  differentiator:
    "Global network of miners attacking models 24/7 with rewards aligned to finding real exploitable vulnerabilities rather than synthetic ones; on-chain proof of evaluation for compliance.",
  keywords: [
    "adversarial",
    "robustness",
    "red-team",
    "perturbation",
    "AI-security",
    "attacks",
  ],
},

{
  netuid: 27,
  slug: "orion",
  name: "Orion",
  category: "Training Data Generation",
  subnetType: "Data",
  tagline: "Campaign-driven data mining for LLM training datasets",
  mainstream: "Scale AI / Surge AI / centralized data-labeling and dataset vendors",
  problem:
    "High-quality, purpose-built LLM training data is expensive and controlled by centralized labeling vendors; small labs struggle to source curated pretraining and preference data.",
  differentiator:
    "Open Bittensor incentive where miners compete to produce datasets to spec, validated on quality/compliance, feeding SILX's own Quasar long-context model plus a planned commercial data product.",
  keywords: [
    "training data",
    "dataset generation",
    "llm data",
    "data curation",
    "preference pairs",
    "silx",
  ],
},

{
  netuid: 29,
  slug: "hotfloat",
  name: "hotfloat",
  category: "LLM Inference Optimization",
  subnetType: "Compute",
  tagline: "A competitive arena for production-grade LLM inference speed.",
  mainstream: "Together AI / Fireworks / Baseten inference optimization, or vLLM/TensorRT-LLM tuning",
  problem:
    "Squeezing maximum throughput/latency out of LLM inference servers is hard, closed, and hardware-specific; there is no open competitive benchmark for production inference-server optimization.",
  differentiator:
    "Open, continuous, same-hardware competition scored purely on end-to-end response time vs a vLLM baseline, with an objective winner-take-most reward.",
  keywords: [
    "LLM inference",
    "vLLM baseline",
    "GPU optimization",
    "inference arena",
    "throughput",
    "container benchmark",
  ],
},

{
  netuid: 31,
  slug: "sn31",
  name: "Subnet 31",
  category: "Unverified",
  subnetType: "Tools",
  tagline: "Identity not yet confirmed on-chain",
  mainstream: "n/a",
  problem:
    "This subnet slot (netuid 31) was recently registered or recycled and its operator has not yet published a verified on-chain identity, website, or repository. We do not show unverified product claims.",
  differentiator:
    "AlphaGap only publishes subnet details we can verify from primary sources. When this slot's team ships a public identity, its profile will update automatically.",
  keywords: [
    "Bittensor subnet 31",
    "netuid 31",
    "unverified subnet",
  ],
},

{
  netuid: 32,
  slug: "itsai",
  name: "It's AI",
  category: "AI Content Detection",
  subnetType: "Tools",
  tagline: "The world's most accurate AI-generated text detector — ranked #1 on MGTD and RAID",
  mainstream: "GPTZero, Originality.ai, Copyleaks, or Turnitin",
  problem:
    "AI-generated text is flooding academic institutions, newsrooms, and enterprise environments — and existing detectors are unreliable, easily fooled, and can't keep pace with the pace of new LLM releases. A single wrong accusation can destroy a student's career; a false negative lets AI fraud slide through.",
  differentiator:
    "It's AI ranked #1 on the MGTD benchmark (ICAIE 2025) with 92%+ ROC-AUC and achieves 98.3% accuracy on the RAID benchmark — detecting outputs from 30+ LLMs with adversarial augmentation testing. With 22K+ monthly visits and enterprise pilots running at private schools in the UAE, it's one of the most production-validated AI detection tools available.",
  keywords: [
    "AI text detection",
    "LLM detection",
    "academic integrity AI",
    "deepfake text detection",
    "It's AI Bittensor",
    "RAID benchmark",
  ],
},

{
  netuid: 33,
  slug: "readyai",
  name: "ReadyAI",
  category: "Data Annotation",
  subnetType: "Data",
  tagline: "660x cheaper than Mechanical Turk — enterprise-grade data annotation at AI scale",
  mainstream: "Scale AI, Appen, or Amazon Mechanical Turk",
  problem:
    "Manual data labeling costs thousands of dollars per hour at Mechanical Turk scale, and quality is inconsistent across contractors. AI companies and enterprises are bottlenecked on the annotated data they need to train and improve their models.",
  differentiator:
    "ReadyAI uses fine-tuned LLMs to convert unstructured data — transcripts, PDFs, social posts — into AI-ready structured formats, at 660x lower cost than Mechanical Turk and outperforming GPT-4o by 50% on benchmarks. It has a production partnership with Ipsos for survey tagging, proving real enterprise utility beyond the benchmark.",
  keywords: [
    "data annotation AI",
    "structured data pipeline",
    "AI training data",
    "ReadyAI Bittensor",
    "Mechanical Turk alternative",
    "enterprise data labeling",
  ],
},

{
  netuid: 34,
  slug: "bitmind",
  name: "BitMind",
  category: "Deepfake Detection",
  subnetType: "Tools",
  tagline: "Detect AI-generated images in real time — 95% accuracy, browser extension with 150K+ weekly detections",
  mainstream: "Intel FakeCatcher, Microsoft Video Authenticator, or Hive Moderation",
  problem:
    "Deepfakes are proliferating at scale — fake images in news stories, fake videos of politicians, synthetic media used for fraud and manipulation. Centralized detection tools can't improve fast enough because they rely on a single team of researchers, while deepfake generators improve continuously.",
  differentiator:
    "BitMind (by BitMind AI) has achieved 95% deepfake image detection accuracy across 100+ countries, with a Chrome Extension delivering 150K+ weekly detections and mobile apps on both App Store and Play Store. The competitive miner network — trained against 30+ generative models — has improved detection accuracy by 20%+ since launch purely through decentralized competition.",
  keywords: [
    "deepfake detection",
    "AI-generated image detection",
    "content authenticity",
    "BitMind Bittensor",
    "media verification",
    "misinformation AI",
  ],
},

{
  netuid: 35,
  slug: "0xmarkets",
  name: "0xMarkets",
  category: "DeFi Liquidity / Perp DEX",
  subnetType: "Finance",
  tagline: "Liquidity-as-a-Service powering a decentralized perps exchange",
  mainstream: "Centralized perp/FX brokers and market makers; GMX/Hyperliquid-style liquidity provision",
  problem:
    "Decentralized perpetual/FX exchanges need deep, reliable liquidity; sourcing it normally requires centralized market makers or protocol-owned incentives rather than an open, incentivized LP network.",
  differentiator:
    "Uses Bittensor incentives to crowdsource and algorithmically allocate real USDC liquidity into a multi-asset perp DEX, with duration-weighted on-chain scoring and weekly epoch settlement.",
  keywords: [
    "perpetual dex",
    "liquidity",
    "forex",
    "defi",
    "usdc vaults",
    "market making",
  ],
},

{
  netuid: 36,
  slug: "eirel",
  name: "Eirel",
  category: "Multimodal AI Agents",
  subnetType: "Inference",
  tagline: "One prompt, full execution - decentralized multimodal agents",
  mainstream: "OpenAI/ChatGPT agents, Manus, or centralized multimodal agent platforms",
  problem:
    "General-purpose multimodal agents are locked into centralized vendors; Eirel distributes agent intelligence across a competitive Bittensor network to avoid vendor lock-in.",
  differentiator:
    "Specialist agent families competing on a stake-weighted leaderboard with owner-frozen evaluation bundles, plus integrated tool services (web search, URL fetch, Python sandbox, RAG) and a roadmap toward MCP support and consumer payments.",
  keywords: [
    "agents",
    "multimodal",
    "orchestration",
    "code generation",
    "media",
    "tools",
  ],
},

{
  netuid: 37,
  slug: "aurelius",
  name: "Aurelius",
  category: "AI Alignment Infrastructure",
  subnetType: "Data",
  tagline: "Open, community-discovered AI alignment instead of alignment defined in private.",
  mainstream: "Anthropic/OpenAI in-house RLHF & Constitutional AI alignment pipelines",
  problem:
    "AI alignment today is defined privately by hyperscalers with no transparency, accountability, or shared standards.",
  differentiator:
    "Open vs closed, multi-agentic vs monolithic, discovered vs dictated: alignment data emerges bottom-up from network-run agent simulations of ethical dilemmas rather than being dictated by a single lab.",
  keywords: [
    "AI alignment",
    "moral reasoning",
    "ethical dilemmas",
    "Concordia simulation",
    "training data",
    "MoReBench",
  ],
},

{
  netuid: 38,
  slug: "chronollm",
  name: "ChronoLLM",
  category: "Point-in-Time Financial LLM",
  subnetType: "Training",
  tagline: "Lookahead-bias-free LLMs for honest financial backtesting.",
  mainstream: "Bloomberg GPT / general foundation models used for finance (which carry lookahead bias), or point-in-time data vendors like Compustat PIT",
  problem:
    "Standard LLMs are trained on decades of data at once, so they leak future information into analyses of past periods, making backtests look artificially strong and strategies fail live.",
  differentiator:
    "Temporally-clean vintages with walk-forward methodology and independent post-cutoff probe sets, operated by an established crowdsourced-ML institution rather than a fresh anon team.",
  keywords: [
    "lookahead bias",
    "point-in-time",
    "financial LLM",
    "backtesting",
    "walk-forward",
    "embeddings",
  ],
},

{
  netuid: 39,
  slug: "basilica",
  name: "Basilica",
  category: "Decentralized GPU Compute",
  subnetType: "Compute",
  tagline: "Cryptographically-verified decentralized GPU compute at scale",
  mainstream: "A decentralized, trust-minimized alternative to renting GPUs from AWS, Lambda Labs, or CoreWeave",
  problem:
    "Centralized GPU clouds are expensive, capacity-constrained, and require trusting the provider that the advertised hardware is real and jobs ran correctly.",
  differentiator:
    "Hardware attestation and cryptographic proof-of-GPU so buyers get verifiable compute (not spoofed specs), delivered permissionlessly through Bittensor incentives.",
  keywords: [
    "GPU compute",
    "verifiable compute",
    "hardware attestation",
    "decentralized cloud",
    "executors",
    "Covenant AI",
  ],
},

{
  netuid: 40,
  slug: "ralph",
  name: "Ralph",
  category: "Decentralized AI Research / Model Training",
  subnetType: "Training",
  tagline: "Decentralized, autonomous AI research — an open, continuously improving training recipe",
  mainstream: "Centralized model-training labs / AutoML & hyperparameter search (Google Vizier, HF AutoTrain, closed frontier-lab research)",
  problem:
    "Frontier training know-how is siloed inside closed labs; there's no open, continuously improving, verifiable recipe with published negative results.",
  differentiator:
    "Open competition over training-recipe patches with canonical proof tests (containerized, fixed seed/data/config + hardware attestation) and a fully public, citable corpus of every change and its measured effect; open-weights reference lineage proving compounding improvement.",
  keywords: [
    "training-recipe",
    "AutoML",
    "decentralized-research",
    "open-weights",
    "knowledge-corpus",
    "model-lineage",
  ],
},

{
  netuid: 41,
  slug: "almanac",
  name: "Almanac",
  category: "Prediction Markets / Sports Forecasting",
  subnetType: "Finance",
  tagline: "Accurate Before It's Obvious",
  mainstream: "Polymarket / sportsbooks (bookmaker odds)",
  problem:
    "Sharp forecasting edge is concentrated in closed hedge-fund and bookmaker models; retail has no way to access or contribute crowd-sourced predictive alpha.",
  differentiator:
    "Darwinian competition network that aggregates many independent forecasters into a meta-model scored on real edge vs market prices, plumbed directly into prediction-market liquidity (Polymarket) rather than a walled bookmaker.",
  keywords: [
    "prediction markets",
    "sports betting",
    "Polymarket",
    "edge scoring",
    "meta-model",
    "forecasting",
  ],
},

{
  netuid: 43,
  slug: "graphite",
  name: "Graphite",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Draw the connections that make your data make sense",
  mainstream: "Neo4j or AWS Neptune",
  problem:
    "Graph databases are powerful for modeling relationships between entities — customers, products, fraud networks — but are notoriously hard to scale and expensive to host. Most teams default to relational databases and miss critical relational insights as a result.",
  differentiator:
    "Graphite provides a decentralized graph intelligence layer, distributing graph storage and query processing across Bittensor miners. It automatically discovers and surfaces relationships in your data that traditional databases would miss, at a cost that scales with actual usage.",
  keywords: [
    "decentralized graph database",
    "knowledge graph AI",
    "Bittensor tools subnet",
    "Graphite Bittensor",
    "relationship intelligence",
    "graph analytics platform",
  ],
},

{
  netuid: 45,
  slug: "alpharidge",
  name: "AlphaRidge",
  category: "Market Intelligence / Financial NLP",
  subnetType: "Data",
  tagline: "Multi-model consensus turning market chatter into structured trading signals",
  mainstream: "Bloomberg Terminal news analytics, RavenPack, AlphaSense, or Kaito-style social-signal platforms",
  problem:
    "Actionable market signal is buried across thousands of fast-moving news and social sources; centralized intelligence terminals are costly and opaque, and single-model NLP is noisy and gameable.",
  differentiator:
    "Uses decentralized multi-model consensus with validator verification (miners paid only for verified work) instead of a single vendor's proprietary model, aiming for harder-to-game, auditable signals across many asset classes at once.",
  keywords: [
    "market intelligence",
    "sentiment signals",
    "financial NLP",
    "real-time news",
    "multi-asset",
    "consensus scoring",
  ],
},

{
  netuid: 46,
  slug: "zipcode",
  name: "Zipcode",
  category: "Data",
  subnetType: "Training",
  tagline: "Open real estate super-intelligence and AI appraisals",
  mainstream: "",
  problem:
    "Real estate data and valuations are expensive, fragmented and controlled by a few gatekeepers (Zillow, CoreLogic, MLS) in a $45T market, leaving appraisals opaque and paywalled. There is no open, real-time, auditable property valuation layer developers can build on.",
  differentiator:
    "RESI/Zipcode crowdsources both property data collection and competitive appraisal models on Bittensor, using a winner-takes-all incentive so the single best-performing valuation model earns ~99% of emissions. The result is an open, continuously benchmarked property-price oracle with public APIs instead of a closed proprietary Zestimate.",
  keywords: [
    "real estate ai",
    "home appraisal",
    "property valuation",
    "bittensor subnet 46",
    "zipcode resi",
    "zestimate alternative",
  ],
},

{
  netuid: 47,
  slug: "evolai",
  name: "EvolAI",
  category: "Model Training / Evaluation",
  subnetType: "Training",
  tagline: "Incentivized open LLM evolution on Bittensor",
  mainstream: "OpenAI/Anthropic frontier-model training, or open eval leaderboards like LMSYS/HuggingFace Open LLM Leaderboard",
  problem:
    "Frontier LLM improvement is concentrated in a few centralized labs; EvolAI tries to crowdsource iterative model improvement and evaluation through on-chain incentives.",
  differentiator:
    "Deterministic seeded evaluation (SHA256 of seed:uid:dataset) that lets miners optimize toward their own eval samples while rewarding chain-of-thought reasoning and consistent improvement; supports mamba2 as well as transformer architectures.",
  keywords: [
    "LLM",
    "model evaluation",
    "fine-tuning",
    "HuggingFace",
    "KL divergence",
    "reasoning",
  ],
},

{
  netuid: 48,
  slug: "quantum-compute",
  name: "Quantum Compute",
  category: "Quantum Computing Marketplace",
  subnetType: "Compute",
  tagline: "The only currency in the universe that can only be mined by real quantum computers.",
  mainstream: "AWS Braket / IBM Quantum / Azure Quantum",
  problem:
    "Fewer than ~100 quantum computers exist globally; access costs $5k-$15k/hour with months-long procurement, keeping QPU time scarce and expensive.",
  differentiator:
    "Uses Bittensor incentives to build an open, multi-vendor QPU marketplace where only genuine quantum hardware can mine ('no middlemen'), subsidizing user access instead of routing through a single cloud vendor's pricing.",
  keywords: [
    "quantum computing",
    "QPU marketplace",
    "OpenQASM",
    "Qiskit",
    "decentralized compute",
    "Open Quantum",
  ],
},

{
  netuid: 49,
  slug: "nepher-robotics",
  name: "Nepher Robotics",
  category: "Robotics AI",
  subnetType: "Science",
  tagline: "Teaching robots to navigate the real world",
  mainstream: "Boston Dynamics or ROS (Robot Operating System)",
  problem:
    "Training robots to operate reliably in unstructured environments requires enormous amounts of diverse simulation data and real-world trial runs, both of which are extremely expensive. Most robotics companies are stuck training on narrow scenarios that break the moment conditions change.",
  differentiator:
    "Nepher Robotics uses Bittensor miners to run massive parallel robot simulations, generating the diverse training data needed for robust real-world performance. The incentive layer rewards miners whose simulations produce policies that transfer successfully to physical robots.",
  keywords: [
    "robotics AI training",
    "decentralized robot simulation",
    "Bittensor science subnet",
    "Nepher Robotics Bittensor",
    "robot learning distributed",
    "autonomous robot training",
  ],
},

{
  netuid: 50,
  slug: "synth",
  name: "Synth",
  category: "Price Forecasting",
  subnetType: "Finance",
  tagline: "1,000 simulated price paths per asset — the full probability distribution, not a guess",
  mainstream: "Numerai or QuantConnect",
  problem:
    "Single-point price predictions are dangerously overconfident — they give a number but hide the full range of outcomes. AI agent decision-making in DeFi and trading requires a real probability distribution, not just 'price will go up.'",
  differentiator:
    "Synth (by Mode Network) generates 1,000 Monte Carlo simulated price paths per asset per request for BTC, ETH, SOL, XAU, and tokenized equities (NVDA, TSLA, AAPL, GOOGL, SPY) — plus XRP, HYPE, and crude oil added in March 2026. Each miner produces a full probability distribution, which is the foundation for genuinely intelligent DeFAI (DeFi AI) systems that make decisions under uncertainty.",
  keywords: [
    "price forecasting AI",
    "Monte Carlo simulation",
    "DeFAI",
    "probabilistic AI finance",
    "Synth Bittensor",
    "crypto price prediction",
  ],
},

{
  netuid: 52,
  slug: "dojo",
  name: "Dojo",
  category: "RLHF Data Collection",
  subnetType: "Data",
  tagline: "Decentralized human feedback data for AI alignment — backed by CZ's fund",
  mainstream: "Scale AI RLHF, Prolific, or Surge AI",
  problem:
    "RLHF (Reinforcement Learning from Human Feedback) requires expensive, high-quality human preference data to align AI models with human values. The entire industry depends on a handful of centralized labeling companies, creating both bottlenecks and misaligned incentives.",
  differentiator:
    "Dojo (by Tensorplex) creates a decentralized network of human contributors who provide preference feedback and alignment data for AI model training. Backed by CZ's BNB Chain fund, it has attracted significant institutional attention as the only crypto-native RLHF data platform — rewarding contributors in TAO while producing the data that makes AI safer and more useful.",
  keywords: [
    "RLHF data collection",
    "human feedback AI",
    "AI alignment data",
    "Dojo Bittensor Tensorplex",
    "decentralized RLHF",
    "CZ BNB Chain AI",
  ],
},

{
  netuid: 53,
  slug: "engy",
  name: "Engy",
  category: "AI Inference",
  subnetType: "Compute",
  tagline: "Verified inference for frontier open models — proof you got the model you paid for",
  mainstream: "OpenAI API, Z.ai, or OpenRouter",
  problem:
    "When you buy LLM inference from an API, you can't verify what actually served your request. Providers can silently swap in a cheaper quantized model and pocket the difference — and with agentic coding tools burning millions of tokens, nobody would ever know. Trusted-hardware solutions (TEEs) just move the trust to the chip vendor.",
  differentiator:
    "Engy, built by Hanlin AI (ex-Google Brain), pins each model's exact weights and quantization via published Merkle roots and attaches a cryptographic activation fingerprint to every response — proof the pinned checkpoint produced your output, with no trusted hardware required. It runs frontier open models like the 753B GLM-5.2 on consumer GPUs at roughly half of first-party pricing, with an OpenAI/Anthropic-compatible API that plugs straight into Claude Code and Cursor.",
  keywords: [
    "verified AI inference",
    "Engy Bittensor",
    "cryptographic inference proof",
    "GLM-5.2 API",
    "cheap LLM inference",
    "decentralized inference subnet",
  ],
},

{
  netuid: 54,
  slug: "yanez-miid",
  name: "Yanez MIID",
  category: "KYC/AML Defense",
  subnetType: "Data",
  tagline: "Adversarial synthetic identity data that keeps KYC/AML systems battle-hardened",
  mainstream: "LexisNexis Risk Solutions, Jumio, or Onfido",
  problem:
    "Financial crime is increasingly sophisticated — synthetic identities, deepfake biometrics, and coordinated fraud attacks exploit weaknesses in KYC/AML systems. Regulators require continuous validation, but generating realistic adversarial test data manually is expensive and slow.",
  differentiator:
    "Yanez MIID (Modular Identity Intelligence Defense) generates adversarial synthetic identities, deepfake-resistant biometrics, sanctions-variation patterns, and structural adversarial KYC data at scale — for stress-testing and hardening compliance systems. Sitting at the intersection of deepfake proliferation and regulatory pressure, it turns Bittensor's incentive layer into a continuously improving adversarial data factory.",
  keywords: [
    "KYC AML defense",
    "synthetic identity AI",
    "adversarial compliance data",
    "Yanez MIID Bittensor",
    "financial crime prevention",
    "identity fraud AI",
  ],
},

{
  netuid: 55,
  slug: "niome",
  name: "NIOME",
  category: "Synthetic Genomic Data",
  subnetType: "Data",
  tagline: "Synthetic genomes for drug research, without the privacy risk.",
  mainstream: "Syntegra / MDClone / Gretel synthetic data (health), or licensed real-genome datasets like UK Biobank",
  problem:
    "Drug development needs datasets of 100k+ genomes, but real genomic data is locked behind consent, GDPR/HIPAA compliance, and breach risk (e.g. 23andMe 2023), stalling research.",
  differentiator:
    "Decentralized competition to produce high-fidelity synthetic genomes with zero re-identification risk, scaling past consent bottlenecks; framed around a 12-month peer-reviewed data-challenge program (Q2 2026-Q1 2027) across 24 prediction challenges.",
  keywords: [
    "synthetic genomics",
    "DNA data",
    "precision medicine",
    "privacy-preserving",
    "pharma research",
    "biomarker discovery",
  ],
},

{
  netuid: 57,
  slug: "gaia",
  name: "Gaia",
  category: "Geospatial & Weather AI",
  subnetType: "Science",
  tagline: "The hub of geospatial and weather AI on Bittensor",
  mainstream: "A decentralized alternative to centralized weather forecasting (ECMWF, NOAA) and geospatial ML models like Google/DeepMind GraphCast and Microsoft Aurora",
  problem:
    "Accurate weather/geospatial forecasting is dominated by a few well-funded centralized institutions; there is no open, incentivized network pooling diverse models to compete and improve on localized and global forecasts.",
  differentiator:
    "First geospatial subnet; incentivizes many independent forecasting models (globally forecast, locally fine-tune) across multiple tasks (weather, soil moisture, geomagnetic storms) rather than a single model.",
  keywords: [
    "geospatial",
    "weather forecasting",
    "earth observation",
    "Microsoft Aurora",
    "soil moisture",
    "climate prediction",
  ],
},

{
  netuid: 58,
  slug: "greevils",
  name: "Greevils",
  category: "Autonomous Trading",
  subnetType: "Finance",
  tagline: "Agents and humans trading live markets, verified on-chain",
  mainstream: "Quant hedge funds / prop trading firms and copy-trading platforms",
  problem:
    "Trading-strategy performance is opaque and unverifiable, and centralized algo trading is closed; Greevils creates a transparent, TEE-sealed arena where real PnL is verified on-chain.",
  differentiator:
    "Sealed TEE execution (agent code encrypted, keys can trade but not withdraw), real Hyperliquid positions rather than paper trading, and a single ranking pool where humans and AI agents compete on risk-adjusted metrics with heavy drawdown penalties and a $1,000 equity elimination floor.",
  keywords: [
    "trading",
    "agents",
    "Hyperliquid",
    "TEE",
    "perpetuals",
    "leaderboard",
  ],
},

{
  netuid: 59,
  slug: "babelbit",
  name: "BabelBit",
  category: "Speech Translation AI",
  subnetType: "Inference",
  tagline: "Speech-to-speech translation that starts before you finish speaking",
  mainstream: "Google Translate real-time, DeepL, or Meta SeamlessM4T",
  problem:
    "Traditional speech translation has inherent latency — systems must wait for a complete utterance before translating. For live conversation, conferences, or real-time media, this delay makes the tool frustrating to use. Every fraction of a second of latency breaks the illusion of real-time communication.",
  differentiator:
    "BabelBit uses predictive language modeling to begin translating before an utterance is complete — LLMs can often predict sentence-final verbs from context. Founded by Matthew Karas (25+ years in speech/audio research), it distributes this low-latency inference across Bittensor miners, with competition driving the latency even lower over time.",
  keywords: [
    "speech translation AI",
    "low-latency translation",
    "predictive speech AI",
    "BabelBit Bittensor",
    "real-time translation",
    "speech-to-speech AI",
  ],
},

{
  netuid: 60,
  slug: "bitsec-ai",
  name: "Bitsec.ai",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Security intelligence that evolves faster than threats",
  mainstream: "Snyk or CrowdStrike",
  problem:
    "Cybersecurity threats evolve daily, but security tools are often updated weekly or monthly, leaving dangerous windows of exposure. Static analysis tools miss novel attack patterns, and security audits are expensive one-time events rather than continuous protection.",
  differentiator:
    "Bitsec.ai runs continuous security analysis across code, infrastructure, and network traffic using a competitive miner network that is incentivized to find real vulnerabilities. New attack patterns discovered by one miner are immediately shared across the network, updating protection for all users.",
  keywords: [
    "AI security analysis",
    "decentralized cybersecurity",
    "Bittensor tools subnet",
    "Bitsec AI Bittensor",
    "continuous security scanning",
    "vulnerability detection AI",
  ],
},

{
  netuid: 61,
  slug: "redteam",
  name: "RedTeam",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Attack your own system before attackers do",
  mainstream: "HackerOne or Cobalt (bug bounty platforms)",
  problem:
    "Red team exercises — simulated attacks on your own systems — are expensive and infrequent, typically done once or twice a year by specialized consultants. This leaves long windows where new vulnerabilities introduced in software updates go undetected.",
  differentiator:
    "RedTeam deploys automated adversarial agents that continuously probe your systems for vulnerabilities, with miners competing to find the highest-severity issues. Organizations get the equivalent of a permanent red team operating around the clock at a fraction of the cost of human consultants.",
  keywords: [
    "automated penetration testing",
    "AI red team",
    "Bittensor tools subnet",
    "RedTeam Bittensor",
    "continuous security testing",
    "adversarial AI security",
  ],
},

{
  netuid: 63,
  slug: "enigma",
  name: "Enigma",
  category: "Science",
  subnetType: "Science",
  tagline: "Open prize-pool challenges to pressure-test critical cryptography",
  mainstream: "",
  problem:
    "The most important cryptographic and quantum technologies are tested behind closed doors by a handful of institutions, leaving the world with little public evidence of how close real hardware is to breaking today's encryption before quantum 'Q-Day' arrives.",
  differentiator:
    "Enigma turns critical-technology testing into open, on-chain competitions funded by prize pools and network emissions, open to anyone (researchers, hackers, students) with verified, published solutions and escalating difficulty. It creates a public, compounding record of progress rather than closed-door results.",
  keywords: [
    "quantum bittensor",
    "bittensor SN63",
    "RSA challenge",
    "post-quantum",
    "crypto bounty",
    "enigma qbittensor",
  ],
},

{
  netuid: 65,
  slug: "tao-private-network",
  name: "TAO Private Network",
  category: "Distributed Compute",
  subnetType: "Compute",
  tagline: "Private compute that no one can inspect or censor",
  mainstream: "Mullvad VPN or Tailscale",
  problem:
    "Sensitive compute workloads — medical records processing, legal document analysis, financial modeling — cannot safely run on shared cloud infrastructure where the provider could theoretically access your data. Private on-premise infrastructure is expensive to build and maintain.",
  differentiator:
    "TAO Private Network routes compute jobs through trusted enclaves in the Bittensor miner network, using hardware-level isolation to guarantee that even the miner processing your job cannot see its contents. Users get cloud-scale private compute without trusting any single provider.",
  keywords: [
    "private compute network",
    "confidential computing",
    "Bittensor compute subnet",
    "TAO Private Network Bittensor",
    "secure enclave computing",
    "privacy-preserving compute",
  ],
},

{
  netuid: 66,
  slug: "ninja",
  name: "Ninja",
  category: "AI Coding Agents",
  subnetType: "Tools",
  tagline: "The race to build the best coding agent.",
  mainstream: "Cursor / Devin / SWE-bench leaderboard",
  problem:
    "Closed, static coding-agent benchmarks and proprietary leaderboards don't create continuous economic pressure to actually improve agents on real-world engineering work.",
  differentiator:
    "Continuous adversarial king-of-the-hill duels on freshly-mined real GitHub tasks instead of a fixed benchmark; untrusted miner code runs in network-isolated Docker sandboxes, coordinated via PostgreSQL, with an LLM judge scoring patches head-to-head.",
  keywords: [
    "coding agent",
    "king of the hill",
    "SWE tasks",
    "LLM judge",
    "GitHub",
    "Katana IDE",
  ],
},

{
  netuid: 67,
  slug: "harnyx",
  name: "Harnyx",
  category: "Deep Research API",
  subnetType: "Inference",
  tagline: "Deep research as a commodity — deep enough to trust, cheap enough to scale",
  mainstream: "OpenAI Deep Research, Perplexity, Google Gemini Deep Research, Exa",
  problem:
    "Deep research is expensive ($1.54-$3.68/query) and slow (5-30 min), while cheap search loses depth and lacks synthesis and citations; agents must stitch many calls together.",
  differentiator:
    "Competitive open marketplace of research harnesses ('better harnesses compound faster') targeting ~10x cost reduction with provenance/citations, benchmarked against real external suites.",
  keywords: [
    "deep-research",
    "agents",
    "synthesis",
    "citations",
    "research-API",
    "Bittensor",
  ],
},

{
  netuid: 70,
  slug: "nexisgen",
  name: "NexisGen",
  category: "AI Training Data / Datasets",
  subnetType: "Data",
  tagline: "A commissions house for AI training data",
  mainstream: "Scale AI / Appen / Surge AI (managed training-data marketplaces)",
  problem:
    "Enterprises need custom, verifiable, provenance-tracked training datasets (especially video) that centralized data vendors deliver slowly and opaquely.",
  differentiator:
    "On-chain incentivized data pipeline with per-record certification and chain-of-custody provenance back to source URLs, versus centralized human-labeling vendors.",
  keywords: [
    "dataset",
    "training data",
    "video",
    "provenance",
    "commission",
    "bittensor",
  ],
},

{
  netuid: 71,
  slug: "leadpoet",
  name: "Leadpoet",
  category: "Decentralized Data",
  subnetType: "Data",
  tagline: "Find your best leads before your competitors do",
  mainstream: "Apollo.io or ZoomInfo",
  problem:
    "B2B lead generation databases are expensive subscriptions full of stale contact information, with accuracy rates that often fall below 70%. Sales teams waste hours reaching dead ends while paying thousands of dollars per month for data that doesn't convert.",
  differentiator:
    "Leadpoet coordinates miners that continuously verify and enrich B2B contact and company data from live sources, rather than serving static database snapshots. Accuracy is validated on-chain and miners earn rewards only for contacts that pass verification checks.",
  keywords: [
    "B2B lead generation data",
    "decentralized sales intelligence",
    "Bittensor data subnet",
    "Leadpoet Bittensor",
    "verified contact data",
    "sales prospecting AI",
  ],
},

{
  netuid: 72,
  slug: "streetvision",
  name: "StreetVision",
  category: "Computer Vision / Mapping Intelligence",
  subnetType: "Data",
  tagline: "Decentralized street-scene vision for real-world mapping data",
  mainstream: "Google Street View / Mapillary computer-vision pipelines, Nexar, or a cloud vision API (AWS Rekognition, Google Vision)",
  problem:
    "Building and maintaining accurate street-level detection models (roadwork, hazards, signage) at map scale is expensive and centralized in a few mapping giants; fresh labeled real-world imagery is a bottleneck.",
  differentiator:
    "Ties an open model-improvement competition to NATIX's existing drive-to-earn dashcam network, with time-decaying model validity that forces miners to keep beating the state of the art rather than parking a one-time model.",
  keywords: [
    "street vision",
    "object detection",
    "image classification",
    "NATIX",
    "DePIN mapping",
    "roadwork detection",
  ],
},

{
  netuid: 73,
  slug: "metahash",
  name: "MetaHash",
  category: "DeFi / Treasury / OTC",
  subnetType: "Finance",
  tagline: "Slippage-free OTC exchange and on-chain treasury for Bittensor subnet (ALPHA) tokens",
  mainstream: "A crypto OTC trading desk / holding-company treasury",
  problem:
    "Selling earned subnet ALPHA rewards on-chain crashes the subnet's own thin liquidity pool, causing heavy slippage and price impact when miners try to exit.",
  differentiator:
    "Epoch-based Dutch-auction mechanism that settles ALPHA -> META off the native pools, eliminating slippage; treasury-backed META token; portfolio-of-subnets governance model.",
  keywords: [
    "OTC",
    "treasury",
    "dTAO",
    "alpha tokens",
    "Dutch auction",
    "slippage-free swap",
  ],
},

{
  netuid: 74,
  slug: "gittensor",
  name: "Gittensor",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Version control meets decentralized intelligence",
  mainstream: "GitHub or GitLab",
  problem:
    "Software development collaboration is centralized on platforms like GitHub that can revoke access, change pricing, or go down at any time. Developers have no control over the infrastructure that their entire workflow depends on, and the AI features built on top are limited to what a single company chooses to build.",
  differentiator:
    "Gittensor provides decentralized code collaboration infrastructure with AI assistance powered by the Bittensor miner network. Code repositories are distributed and censorship-resistant, while AI features like code review and documentation generation are provided by competing miners.",
  keywords: [
    "decentralized code collaboration",
    "GitHub alternative blockchain",
    "Bittensor developer tools",
    "Gittensor Bittensor",
    "git decentralized",
    "AI code review decentralized",
  ],
},

{
  netuid: 76,
  slug: "byzantium",
  name: "Byzantium",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Byzantine fault tolerance, built for the real world",
  mainstream: "PagerDuty or Datadog",
  problem:
    "Distributed systems fail in complex and unexpected ways that single-vendor monitoring tools are not designed to detect. Byzantine failures — where components fail silently or send contradictory signals — are especially hard to diagnose and can cause catastrophic cascading outages.",
  differentiator:
    "Byzantium deploys a distributed monitoring network that can itself tolerate Byzantine failures, providing trustworthy system health signals even when your infrastructure is partially compromised. Miners cross-validate each other's observations, making the monitoring layer immune to the failures it is designed to detect.",
  keywords: [
    "Byzantine fault tolerance",
    "distributed systems monitoring",
    "Bittensor tools subnet",
    "Byzantium Bittensor",
    "resilient infrastructure monitoring",
    "decentralized observability",
  ],
},

{
  netuid: 77,
  slug: "liquidity",
  name: "Liquidity",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Deep liquidity, everywhere, without the middleman",
  mainstream: "Uniswap or Curve Finance",
  problem:
    "Liquidity in DeFi is fragmented across hundreds of protocols and chains, making it expensive and slow to execute large trades without significant price impact. Market makers face complex optimization problems to deploy capital efficiently across this fragmented landscape.",
  differentiator:
    "Liquidity coordinates a network of automated market-making miners that intelligently distribute liquidity across protocols to minimize slippage network-wide. The Bittensor incentive layer rewards miners who place liquidity where it is most needed, creating organic depth where it matters most.",
  keywords: [
    "DeFi liquidity optimization",
    "automated market making",
    "Bittensor finance subnet",
    "Liquidity Bittensor",
    "decentralized liquidity provision",
    "AMM optimization",
  ],
},

// SN78 (Loosh) — deregistered

{
  netuid: 79,
  slug: "mvtrx",
  name: "MVTRX",
  category: "Finance & Trading",
  subnetType: "Finance",
  tagline: "Agent-based market simulation powering a next-gen exchange",
  mainstream: "Proprietary quant/HFT market simulators and centralized crypto exchanges (Binance, Coinbase)",
  problem:
    "High-fidelity market microstructure simulation and algorithmic-trading research are locked inside a handful of hedge funds and exchanges, with no open venue to develop and benchmark trading agents. Bittensor's dTAO/alpha token markets also lack a sophisticated, purpose-built exchange.",
  differentiator:
    "TAOS runs a C++/Rust market-microstructure simulation engine (built on MAXE) paired with Python validators, creating open L3 limit-order books where anyone can develop and be rewarded for profitable, risk-managed agents. It aims to convert that simulation edge into a real MVTRX exchange with a dynamic zero-sum rebate/fee incentive structure.",
  keywords: [
    "algorithmic trading",
    "market simulation",
    "limit order book",
    "bittensor subnet 79",
    "taos mvtrx",
    "dtao exchange",
  ],
},

{
  netuid: 80,
  slug: "sn80",
  name: "Subnet 80",
  category: "Unverified",
  subnetType: "Tools",
  tagline: "Identity not yet confirmed on-chain",
  mainstream: "n/a",
  problem:
    "This subnet slot (netuid 80) was recently registered or recycled and its operator has not yet published a verified on-chain identity, website, or repository. We do not show unverified product claims.",
  differentiator:
    "AlphaGap only publishes subnet details we can verify from primary sources. When this slot's team ships a public identity, its profile will update automatically.",
  keywords: [
    "Bittensor subnet 80",
    "netuid 80",
    "unverified subnet",
  ],
},

{
  netuid: 81,
  slug: "grail",
  name: "Grail",
  category: "Verifiable Post-Training / RL",
  subnetType: "Training",
  tagline: "Verifiable decentralized post-training and RL for LLMs",
  mainstream: "A decentralized, verifiable alternative to centralized RLHF/RLVR post-training pipelines used to align frontier models",
  problem:
    "Post-training/RL (RLHF, GRPO) is compute-heavy and normally done in closed labs; decentralizing it requires proving that miners actually ran the claimed rollouts on the claimed model rather than faking results.",
  differentiator:
    "GRAIL protocol cryptographically verifies GRPO rollout authenticity, making permissionless, trust-minimized RL post-training possible on Bittensor.",
  keywords: [
    "post-training",
    "reinforcement learning",
    "GRPO",
    "GRAIL protocol",
    "verifiable inference",
    "Covenant AI",
  ],
},

// SN82 (Hermes) — deregistered

{
  netuid: 83,
  slug: "cliqueai",
  name: "CliqueAI",
  category: "Scientific Computing",
  subnetType: "Science",
  tagline: "Network science meets artificial intelligence",
  mainstream: "Gephi or NetworkX",
  problem:
    "Analyzing large network graphs — social networks, biological networks, supply chains — requires specialized algorithms and significant computational resources. Most researchers work with stripped-down samples of their data because full-scale graph analysis is prohibitively slow.",
  differentiator:
    "CliqueAI distributes large-scale graph analysis across Bittensor miners, applying AI-enhanced network science algorithms at scales previously only possible on supercomputers. Researchers submit graph datasets and receive comprehensive structural insights in minutes rather than weeks.",
  keywords: [
    "graph network analysis AI",
    "large scale network science",
    "Bittensor science subnet",
    "CliqueAI Bittensor",
    "decentralized graph analytics",
    "AI social network analysis",
  ],
},

{
  netuid: 84,
  slug: "chipforge",
  name: "ChipForge",
  category: "Decentralized Chip / Silicon Design",
  subnetType: "Science",
  tagline: "The Bittensor subnet where better chip designs win, literally",
  mainstream: "A decentralized, competition-based alternative to traditional in-house EDA chip design done with Cadence/Synopsys tools inside chipmakers",
  problem:
    "Chip design is expensive, slow, and gated behind a few firms and costly EDA licenses; there is no open, global, incentivized way to crowdsource and objectively benchmark hardware designs.",
  differentiator:
    "First digital-design subnet; turns silicon design into verifiable on-chain challenges scored by real EDA toolchains, letting a global pool of engineers/AI compete on measurable PPA (power/performance/area).",
  keywords: [
    "chip design",
    "silicon",
    "Verilog",
    "RISC-V",
    "EDA",
    "decentralized hardware",
  ],
},

{
  netuid: 85,
  slug: "vidaio",
  name: "Vidaio",
  category: "Generative Media",
  subnetType: "Creative",
  tagline: "AI video generation at studio quality, instantly",
  mainstream: "Runway ML or Sora",
  problem:
    "Professional video production costs tens of thousands of dollars per minute of finished content. AI video generation tools are improving rapidly but remain centralized, expensive for high-volume users, and controlled by companies that can change their content policies at any time.",
  differentiator:
    "Vidaio harnesses a decentralized network of GPU miners to generate high-quality video content, with competitive validation ensuring consistently high output quality. Content creators can produce studio-quality video at a fraction of commercial rates without worrying about platform censorship.",
  keywords: [
    "AI video generation",
    "decentralized video AI",
    "Bittensor creative subnet",
    "Vidaio Bittensor",
    "AI video production",
    "Runway alternative blockchain",
  ],
},

{
  netuid: 86,
  slug: "sn86",
  name: "Subnet 86",
  category: "Unverified",
  subnetType: "Tools",
  tagline: "Identity not yet confirmed on-chain",
  mainstream: "n/a",
  problem:
    "This subnet slot (netuid 86) was recently registered or recycled and its operator has not yet published a verified on-chain identity, website, or repository. We do not show unverified product claims.",
  differentiator:
    "AlphaGap only publishes subnet details we can verify from primary sources. When this slot's team ships a public identity, its profile will update automatically.",
  keywords: [
    "Bittensor subnet 86",
    "netuid 86",
    "unverified subnet",
  ],
},

{
  netuid: 87,
  slug: "provenonce",
  name: "Provenonce",
  category: "AI Verification / Agentic Infrastructure",
  subnetType: "Tools",
  tagline: "Building the trust layer for AI execution",
  mainstream: "Centralized AI observability / eval & audit-trail platforms (LangSmith, Galileo, Arize)",
  problem:
    "Agentic AI execution is unverifiable — no standard way to prove an AI workflow actually did the required work correctly, which blocks safe cross-platform agent coordination.",
  differentiator:
    "Turns structured workflow execution into on-chain-scored evidence with predefined requirement contracts; incentivized, multi-miner verification of the same workflow so only verified complete execution earns a high score.",
  keywords: [
    "assurance",
    "verification",
    "agentic",
    "evidence",
    "proof-of-execution",
    "trust-layer",
  ],
},

{
  netuid: 88,
  slug: "investing",
  name: "Investing",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Smarter investing backed by decentralized AI",
  mainstream: "Betterment or Wealthfront",
  problem:
    "Automated investing platforms (robo-advisors) use simple rule-based allocation strategies that perform no better than passive index funds in most conditions. They charge management fees for adding little value beyond basic diversification.",
  differentiator:
    "Investing applies AI-driven portfolio management trained and validated across the Bittensor network, continuously adapting to market conditions rather than following fixed allocation rules. Users pay performance-linked fees only when returns exceed benchmarks, aligning incentives properly.",
  keywords: [
    "AI portfolio management",
    "decentralized robo-advisor",
    "Bittensor finance subnet",
    "Investing Bittensor",
    "automated investing AI",
    "smart portfolio optimization",
  ],
},

{
  netuid: 89,
  slug: "infinitequant",
  name: "InfiniteQuant",
  category: "Trading Signals",
  subnetType: "Finance",
  tagline: "Commit-reveal trade signals graded on real market data; only proven edge earns.",
  mainstream: "Quant hedge-fund signal desks, or copy-trading/signal platforms like eToro / TradingView paid signals",
  problem:
    "Trading-signal providers are unverifiable and gameable; there's no trustless, tamper-proof way to prove a caller actually had predictive edge.",
  differentiator:
    "Non-custodial (keys never leave the miner), timelock commit-reveal prevents peeking, fixed symmetric bands give objective scoring, copy-detection penalizes shadowing, and deterministic validation means identical weights from the same chain+market data.",
  keywords: [
    "trade signals",
    "timelock encryption",
    "commit-reveal",
    "alpha edge",
    "quant",
    "market prediction",
  ],
},

{
  netuid: 91,
  slug: "cascade",
  name: "Cascade",
  category: "Time-Series Foundation Models",
  subnetType: "Training",
  tagline: "SOTA time-series foundation models on Bittensor",
  mainstream: "Amazon Chronos / Google TimesFM / Nixtla TimeGPT",
  problem:
    "Time-series foundation models are bottlenecked by synthetic training-data quality, but that quality is normally impossible to measure in isolation because architecture and hyperparameters vary between attempts.",
  differentiator:
    "Fixes the model (Toto2-4M) byte-for-byte so the synthetic data generator is the sole variable, turning data-quality into a directly measurable, competable quantity.",
  keywords: [
    "time-series",
    "forecasting",
    "synthetic-data",
    "foundation-model",
    "data-quality",
    "Bittensor",
  ],
},

{
  netuid: 92,
  slug: "sn92",
  name: "Subnet 92",
  category: "Unverified",
  subnetType: "Tools",
  tagline: "Identity not yet confirmed on-chain",
  mainstream: "n/a",
  problem:
    "This subnet slot (netuid 92) was recently registered or recycled and its operator has not yet published a verified on-chain identity, website, or repository. We do not show unverified product claims.",
  differentiator:
    "AlphaGap only publishes subnet details we can verify from primary sources. When this slot's team ships a public identity, its profile will update automatically.",
  keywords: [
    "Bittensor subnet 92",
    "netuid 92",
    "unverified subnet",
  ],
},

{
  netuid: 93,
  slug: "bitcast",
  name: "Bitcast",
  category: "Generative Media",
  subnetType: "Creative",
  tagline: "Broadcast your content to a decentralized world",
  mainstream: "Spotify or Apple Podcasts",
  problem:
    "Content creators are dependent on centralized platforms that take large revenue cuts, can demonetize channels without recourse, and own the relationship with the audience. There is no decentralized alternative that provides the same reach with creator-owned distribution.",
  differentiator:
    "Bitcast provides decentralized audio and video content distribution, with AI-powered production assistance generated by Bittensor miners. Creators keep their revenue, own their audience data, and access AI tools for transcription, editing, and promotion without giving up platform control.",
  keywords: [
    "decentralized content distribution",
    "creator-owned podcast platform",
    "Bittensor creative subnet",
    "Bitcast Bittensor",
    "Spotify alternative blockchain",
    "AI podcast production",
  ],
},

{
  netuid: 94,
  slug: "bitsota",
  name: "BitSota",
  category: "AI Research / AutoML",
  subnetType: "Science",
  tagline: "Decentralized network that evolves self-improving ML algorithms",
  mainstream: "AutoML / neural-architecture-search platforms (e.g. Google AutoML, evolutionary AutoML research)",
  problem:
    "Discovering and improving ML algorithms is centralized, compute-gated, and slow; there is no open, incentivized market for self-improving algorithm search.",
  differentiator:
    "Problem-agnostic genetic-programming approach aimed at self-improving/self-generating AI, with sandboxed validator replay and pooled collaborative mining.",
  keywords: [
    "AutoML",
    "genetic programming",
    "algorithm evolution",
    "self-improving AI",
    "research network",
    "sandbox evaluation",
  ],
},

{
  netuid: 96,
  slug: "verathos",
  name: "Verathos",
  category: "Verified LLM Compute",
  subnetType: "Compute",
  tagline: "Verified Intelligence for Everyone",
  mainstream: "OpenAI/Together/Fireworks inference APIs, plus verifiable-compute plays like EZKL / Gensyn",
  problem:
    "Users of hosted LLM inference/training must trust that the provider actually ran the correct model and computation; there is no cryptographic proof that the returned output came from the committed weights.",
  differentiator:
    "Sumcheck-based proofs over Merkle-committed weights give cryptographic proof of correct weights, computation, and output integrity behind a standard OpenAI-compatible API.",
  keywords: [
    "verified-inference",
    "zero-knowledge",
    "sumcheck",
    "vLLM",
    "Merkle-commitment",
    "Bittensor",
  ],
},

{
  netuid: 97,
  slug: "albedo",
  name: "Albedo",
  category: "AI Inference",
  subnetType: "Training",
  tagline: "Competitive distillation of frontier LLMs into cheap models",
  mainstream: "Frontier LLM providers (OpenAI, Anthropic) and centralized model-distillation pipelines",
  problem:
    "Running frontier LLMs is expensive, and distilling them into small efficient models is a specialized, mostly closed process controlled by the labs that own the teacher models. There is no open, continuously competitive venue for producing best-in-class distilled models.",
  differentiator:
    "Albedo uses a king-of-the-hill incentive where miners must beat the reigning champion on distillation benchmarks to take over emissions, driving a continuously improving open distilled model. It is the SN97 successor to the earlier 'Distil' subnet, extended from competitive distillation to trajectory distillation.",
  keywords: [
    "model distillation",
    "llm compression",
    "trajectory distillation",
    "bittensor subnet 97",
    "albedo distil",
    "king of the hill",
  ],
},

{
  netuid: 98,
  slug: "neverplayalone",
  name: "NeverPlayAlone",
  category: "Embodied Game AI Agents",
  subnetType: "Training",
  tagline: "Living AI agents that play Minecraft alongside humans",
  mainstream: "Google/DeepMind SIMA, Voyager (MineDojo), Altera's agents",
  problem:
    "Solo/managed multiplayer gameplay is hard to set up, and there is no open, trustless marketplace for embodied game-playing AI agents evaluated on real gameplay rather than simplified simulators.",
  differentiator:
    "Agents are tested in the live Minecraft world (not a simulator) via deterministic NPA-Bench missions, paired with a paid consumer hosting product.",
  keywords: [
    "Minecraft",
    "embodied-agents",
    "game-AI",
    "NPA-Bench",
    "multiplayer",
    "Bittensor",
  ],
},

{
  netuid: 99,
  slug: "thirty-spokes",
  name: "Thirty Spokes",
  category: "LLM Router / API Gateway",
  subnetType: "Tools",
  tagline: "Thirty spokes share one hub — it is the empty space at the center that makes the wheel useful",
  mainstream: "OpenRouter (and to a degree Requesty / Martian model routing)",
  problem:
    "Developers juggle many model providers, keys, and price/quality tradeoffs; a single routing layer that optimizes quality-per-dollar is centralized (OpenRouter) and opaque about routing decisions.",
  differentiator:
    "Permissionless, benchmark-driven routing competition where routing agents run inside TEEs with commit-reveal anti-front-running, versus a single centralized routing operator.",
  keywords: [
    "router",
    "gateway",
    "llm",
    "routing",
    "tee",
    "openrouter",
  ],
},

// SN100 (Plaτform) — first subnet deregistered under Bittensor's 4-month pruning mechanism (late 2025)

{
  netuid: 102,
  slug: "connitoai",
  name: "ConnitoAI",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Connect everything with intelligent AI middleware",
  mainstream: "MuleSoft or Boomi (integration platforms)",
  problem:
    "Enterprise software integration is a multi-billion dollar problem because systems speak different languages and were built by different teams with no coordination. Integration middleware is expensive, brittle, and requires specialized expertise to maintain.",
  differentiator:
    "ConnitoAI uses AI-powered schema understanding to automatically map and transform data between incompatible systems, with miners handling the compute for continuous integration monitoring. When upstream systems change, ConnitoAI detects and adapts automatically rather than breaking silently.",
  keywords: [
    "AI system integration",
    "intelligent middleware",
    "Bittensor tools subnet",
    "ConnitoAI Bittensor",
    "enterprise integration AI",
    "MuleSoft alternative AI",
  ],
},

{
  netuid: 103,
  slug: "djinn",
  name: "Djinn",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Grant any financial wish with decentralized intelligence",
  mainstream: "Personal Capital or Monarch Money",
  problem:
    "Personal finance management tools provide dashboards and historical reporting but no genuine intelligence about what to do next. Users are left to interpret their own data without access to the sophisticated modeling that financial advisors charge thousands of dollars to provide.",
  differentiator:
    "Djinn combines your personal financial data with Bittensor-powered AI modeling to generate genuinely personalized financial recommendations — not generic advice, but specific actions tailored to your situation, risk tolerance, and goals.",
  keywords: [
    "AI personal finance",
    "decentralized financial advisor",
    "Bittensor finance subnet",
    "Djinn Bittensor",
    "personal finance AI",
    "smart financial planning",
  ],
},

{
  netuid: 105,
  slug: "beam",
  name: "Beam",
  category: "Distributed Compute",
  subnetType: "Compute",
  tagline: "Beam your workloads anywhere in the world, instantly",
  mainstream: "Modal or Fly.io",
  problem:
    "Deploying compute workloads to the optimal geographic location based on latency, cost, and regulatory requirements requires expertise that most teams don't have. The wrong deployment decision results in wasted spend or poor user experience.",
  differentiator:
    "Beam automatically routes compute workloads to the optimal set of Bittensor miners based on real-time pricing, latency, and compliance requirements. Workloads can be beamed to new locations instantly if conditions change, without any infrastructure reconfiguration.",
  keywords: [
    "intelligent compute routing",
    "geo-distributed compute",
    "Bittensor compute subnet",
    "Beam Bittensor",
    "workload optimization cloud",
    "decentralized compute routing",
  ],
},

{
  netuid: 106,
  slug: "nodexo",
  name: "Nodexo",
  category: "Decentralized GPU Compute",
  subnetType: "Compute",
  tagline: "Verified, trustless GPU compute rented from a decentralized network",
  mainstream: "AWS/GCP GPU instances, CoreWeave, Lambda, or decentralized peers io.net and Akash",
  problem:
    "Centralized cloud GPU is expensive and gatekept, while other decentralized compute markets struggle to cryptographically prove that rented GPUs actually did the work claimed.",
  differentiator:
    "Adds verifiable compute (zk proofs / zkGEMM plus Proof-of-GPU) so buyers get cryptographic assurance work was done, rather than trusting self-reported miner benchmarks; backed by the Neural Internet team behind the earlier NI Compute (SN27).",
  keywords: [
    "GPU compute",
    "decentralized cloud",
    "verified compute",
    "zero-knowledge proof",
    "Proof-of-GPU",
    "Nodexo",
  ],
},

{
  netuid: 107,
  slug: "minos",
  name: "Minos",
  category: "Scientific Computing",
  subnetType: "Science",
  tagline: "Judge your models with scientific rigor",
  mainstream: "MLflow or Weights & Biases (model evaluation)",
  problem:
    "AI model evaluation is inconsistent and often misleading, with researchers cherry-picking benchmarks that favor their approach. There is no trusted, independent evaluation infrastructure that applies rigorous, reproducible scientific methods to AI model assessment.",
  differentiator:
    "Minos provides a decentralized model judgment layer where miners run standardized evaluation protocols and cross-validate each other's results. The Bittensor incentive system rewards accurate, reproducible evaluation, creating a trustworthy scoreboard that cannot be gamed by the model authors.",
  keywords: [
    "AI model evaluation",
    "reproducible model benchmarking",
    "Bittensor science subnet",
    "Minos Bittensor",
    "decentralized AI evaluation",
    "independent model testing",
  ],
},

{
  netuid: 108,
  slug: "talkhead",
  name: "TalkHead",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Give any AI a voice, face, and personality",
  mainstream: "HeyGen or D-ID (AI avatars)",
  problem:
    "Creating realistic AI avatars for customer service, education, and content creation is expensive and technically complex. Existing solutions are obvious, uncanny, and tied to centralized platforms with restrictive content policies and high per-minute pricing.",
  differentiator:
    "TalkHead provides decentralized AI avatar generation and animation, with miners competing to produce the most natural-looking and natural-sounding results. Users get customizable digital humans without per-minute fees or platform restrictions on use cases.",
  keywords: [
    "AI avatar generation",
    "talking head AI",
    "Bittensor tools subnet",
    "TalkHead Bittensor",
    "digital human AI",
    "HeyGen alternative blockchain",
  ],
},

{
  netuid: 110,
  slug: "green-compute",
  name: "Green Compute",
  category: "Renewable GPU Compute",
  subnetType: "Compute",
  tagline: "Only verifiably clean compute gets paid",
  mainstream: "AWS/GCP GPU instances, RunPod, Vast.ai, Lambda Labs",
  problem:
    "GPU compute is expensive and carbon-intensive; centralized clouds offer no verifiable green-energy sourcing and charge a premium over commodity GPUs.",
  differentiator:
    "'Verified by Nature' on-chain green-energy verification (carbon-registry + hardware-location proofs) gating miner rewards — a renewable-provenance layer no centralized GPU cloud provides, at commodity per-minute pricing.",
  keywords: [
    "gpu compute",
    "renewable energy",
    "green compute",
    "gpu rental",
    "inference",
    "carbon verification",
  ],
},

{
  netuid: 111,
  slug: "claims",
  name: "Claims",
  category: "Decentralized Science",
  subnetType: "Science",
  tagline: "Turning research papers into verifiable, machine-readable scientific claims",
  mainstream: "Semantic Scholar / Elicit / scientific knowledge graphs (Scite.ai citation-context)",
  problem:
    "Trillions of dollars of scientific knowledge sits locked in unstructured PDFs that AI cannot reliably reason over or verify; citation tools retrieve but don't structure or ground claims.",
  differentiator:
    "Open incentive mechanism that grows a canonical, evidence-grounded claim graph; agent-based extraction (dspy-react/langchain) audited on-chain for source grounding rather than centralized editorial curation.",
  keywords: [
    "desci",
    "scientific claims",
    "knowledge graph",
    "evidence grounding",
    "research papers",
    "claim extraction",
  ],
},

{
  netuid: 112,
  slug: "minotaur",
  name: "minotaur",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Navigate the labyrinth of DeFi with confidence",
  mainstream: "DeFi Llama or Zapper.fi",
  problem:
    "DeFi is a labyrinth of protocols, chains, and tokens that is nearly impossible to navigate without deep expertise. Users lose money not because markets moved against them but because they accidentally interacted with scam contracts, misconfigured transactions, or misunderstood protocol mechanics.",
  differentiator:
    "minotaur acts as a safety-first DeFi navigator, using Bittensor miners to continuously audit protocols, simulate transactions before execution, and flag risks in plain English. Users interact with confidence knowing every action has been independently verified.",
  keywords: [
    "DeFi safety navigator",
    "transaction simulation DeFi",
    "Bittensor finance subnet",
    "minotaur Bittensor",
    "DeFi risk management",
    "smart contract audit AI",
  ],
},

{
  netuid: 113,
  slug: "tensorusd",
  name: "TensorUSD",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Stable value anchored to decentralized intelligence",
  mainstream: "MakerDAO (DAI) or Frax Finance",
  problem:
    "Decentralized stablecoins have struggled to maintain their pegs during market stress, often relying on fragile algorithmic mechanisms or excessive collateral requirements. Users seeking stable value in crypto have no reliable decentralized option with a track record of resilience.",
  differentiator:
    "TensorUSD uses AI-driven collateral management and dynamic stability mechanisms validated by Bittensor miners, making peg maintenance more robust than purely algorithmic alternatives. The network continuously monitors market conditions and adjusts parameters before instability develops.",
  keywords: [
    "AI stablecoin",
    "decentralized stable value",
    "Bittensor finance subnet",
    "TensorUSD Bittensor",
    "DAI alternative AI",
    "intelligent collateral management",
  ],
},

{
  netuid: 114,
  slug: "soma",
  name: "SOMA",
  category: "AI Inference",
  subnetType: "Inference",
  tagline: "Whole-brain AI inference for complex real-world tasks",
  mainstream: "Anthropic Claude or OpenAI GPT-4",
  problem:
    "Complex reasoning tasks require more than a single model call — they need orchestrated reasoning across different cognitive functions. Current AI inference APIs treat every query as a single-step operation, missing the structured reasoning that humans apply to difficult problems.",
  differentiator:
    "SOMA implements a multi-stage cognitive inference pipeline where different specialized models handle perception, reasoning, planning, and response generation. The Bittensor network rewards miners whose pipeline stages produce the highest quality integrated outputs.",
  keywords: [
    "cognitive AI inference",
    "multi-stage AI reasoning",
    "Bittensor inference subnet",
    "SOMA Bittensor",
    "structured AI reasoning",
    "complex task AI inference",
  ],
},

{
  netuid: 115,
  slug: "hashichain",
  name: "HashiChain",
  category: "AI Agents",
  subnetType: "Agents",
  tagline: "Chain together agents that hash out the hardest problems",
  mainstream: "HashiCorp Terraform or Ansible (infrastructure automation)",
  problem:
    "Infrastructure automation still requires expert-level knowledge of configuration management tools that have steep learning curves and cryptic syntax. When automation fails, diagnosing and fixing it requires skills that are in short supply and expensive to hire.",
  differentiator:
    "HashiChain deploys AI agents that automate infrastructure management in plain English, chaining together specialized agents for provisioning, security hardening, and monitoring. Miners are rewarded for agents that successfully maintain infrastructure uptime, not just for generating plausible-looking configurations.",
  keywords: [
    "AI infrastructure automation",
    "decentralized DevOps agents",
    "Bittensor agent subnet",
    "HashiChain Bittensor",
    "Terraform alternative AI",
    "autonomous infrastructure management",
  ],
},

{
  netuid: 116,
  slug: "sn116",
  name: "Subnet 116",
  category: "Unverified",
  subnetType: "Tools",
  tagline: "Identity not yet confirmed on-chain",
  mainstream: "n/a",
  problem:
    "This subnet slot (netuid 116) was recently registered or recycled and its operator has not yet published a verified on-chain identity, website, or repository. We do not show unverified product claims.",
  differentiator:
    "AlphaGap only publishes subnet details we can verify from primary sources. When this slot's team ships a public identity, its profile will update automatically.",
  keywords: [
    "Bittensor subnet 116",
    "netuid 116",
    "unverified subnet",
  ],
},

{
  netuid: 117,
  slug: "glyph",
  name: "Glyph",
  category: "Neural Text Compression",
  subnetType: "Training",
  tagline: "Lossless neural text compression on Bittensor (a perpetual Hutter Prize)",
  mainstream: "The Hutter Prize / enwik9 compression; LLMZip and neural-compression research",
  problem:
    "LLM pipelines process massive redundant text, wasting tokens/compute; there is no open incentivized network continuously pushing state-of-the-art lossless neural compression.",
  differentiator:
    "Turns compression into an on-chain, perpetually contestable benchmark with permanent codec commitments and reproducible round-trips, rather than a one-time prize.",
  keywords: [
    "compression",
    "lossless",
    "Hutter-Prize",
    "codec",
    "token-efficiency",
    "Bittensor",
  ],
},

{
  netuid: 118,
  slug: "ditto",
  name: "Ditto",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Long-term memory for every AI agent you use",
  mainstream: "OpenAI/ChatGPT Memory, mem0, Letta (MemGPT)",
  problem:
    "AI agents forget everything between sessions and each tool keeps its own siloed context, so users repeat themselves and lose continuity. Memory today is proprietary and locked inside individual apps like ChatGPT with no portability across the tools people actually use.",
  differentiator:
    "Ditto offers a portable, agent-native memory graph accessible from Claude, Cursor and other tools over MCP with zero-OAuth login, rather than a memory silo tied to one vendor. Miners on SN118 compete on DittoBench to produce better memory retrieval (composite + cross-encoder ranking over an embedded vector store), which the team claims delivers SOTA memory at a fraction of frontier cost.",
  keywords: [
    "ai memory",
    "agent context",
    "mcp memory",
    "bittensor subnet 118",
    "ditto assistant",
    "long-term memory",
  ],
},

{
  netuid: 119,
  slug: "satori",
  name: "Satori",
  category: "Decentralized Data",
  subnetType: "Data",
  tagline: "Sudden clarity from the world's streaming data",
  mainstream: "Apache Kafka or AWS Kinesis",
  problem:
    "Extracting insight from real-time streaming data requires specialized infrastructure and skills that are scarce and expensive. Most organizations batch-process data that should be acted on immediately, losing value that disappears the moment the window closes.",
  differentiator:
    "Satori provides real-time streaming data intelligence powered by Bittensor miners, continuously analyzing data streams and surfacing actionable insights as events happen. The decentralized architecture handles arbitrary throughput without the operational overhead of managing Kafka clusters.",
  keywords: [
    "real-time data intelligence",
    "streaming data analytics",
    "Bittensor data subnet",
    "Satori Bittensor",
    "event stream analysis",
    "live data insights AI",
  ],
},

{
  netuid: 121,
  slug: "sundae-bar",
  name: "sundae_bar",
  category: "AI Agents",
  subnetType: "Agents",
  tagline: "Sweet AI agents with all the right toppings",
  mainstream: "Zapier or Make.com",
  problem:
    "Most automation platforms offer a fixed menu of pre-built integrations that cover only the most common use cases. When your workflow doesn't fit a template, you're stuck — customization requires developer resources that defeat the purpose of a no-code platform.",
  differentiator:
    "sundae_bar offers modular, composable agent building blocks that users mix and match to automate any workflow, no matter how unusual. Miners contribute custom toppings — specialized capabilities — that are immediately available to all users, expanding the palette continuously.",
  keywords: [
    "composable AI agents",
    "modular automation platform",
    "Bittensor agent subnet",
    "sundae bar Bittensor",
    "no-code AI workflows",
    "flexible automation agents",
  ],
},

{
  netuid: 122,
  slug: "cookingtao",
  name: "CookingTAO",
  category: "Mining Infrastructure",
  subnetType: "Tools",
  tagline: "Democratizing Bittensor mining",
  mainstream: "Akash / managed cloud-mining or app-store style deployment platforms",
  problem:
    "Mining on Bittensor requires wallet management, infrastructure, dependency setup and constant ops, gating out the far larger pool of AI builders on GitHub/HuggingFace/Kaggle from participating.",
  differentiator:
    "Three-sided marketplace separating code authors, deployers and validators; a code marketplace with monetization where developers earn from downstream deployment performance rather than uploads, plus no-code single-click miner deployment across subnets.",
  keywords: [
    "mining",
    "no-code",
    "marketplace",
    "deployment",
    "infrastructure",
    "miners",
  ],
},

{
  netuid: 123,
  slug: "mantis",
  name: "MANTIS",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Strike with precision on every technical challenge",
  mainstream: "Datadog or New Relic (observability)",
  problem:
    "Modern distributed systems generate so much telemetry data that the signal-to-noise ratio makes actionable observability nearly impossible. Engineers spend more time correlating logs and traces than actually fixing problems, and most issues are detected by users before monitoring catches them.",
  differentiator:
    "MANTIS applies AI analysis to observability data in real time, correlating signals across logs, metrics, and traces to identify root causes automatically. Bittensor miners run the analysis workloads, so the system scales with data volume without proportional cost increases.",
  keywords: [
    "AI observability platform",
    "intelligent monitoring tools",
    "Bittensor tools subnet",
    "MANTIS Bittensor",
    "root cause analysis AI",
    "decentralized DevOps monitoring",
  ],
},

{
  netuid: 124,
  slug: "swarm",
  name: "Swarm",
  category: "Scientific Computing",
  subnetType: "Science",
  tagline: "Collective intelligence at the scale of a swarm",
  mainstream: "OpenMPI or Dask (distributed computing frameworks)",
  problem:
    "Swarm intelligence algorithms — particle swarms, ant colonies, genetic algorithms — are powerful optimization techniques but are difficult to implement at meaningful scale without distributed computing expertise. Most applications use simplified versions that miss the full power of the approach.",
  differentiator:
    "Swarm implements production-grade swarm intelligence across the Bittensor miner network, with each miner acting as a node in a massive coordinated swarm. Scientists and engineers submit optimization problems and receive solutions that benefit from true large-scale swarm dynamics.",
  keywords: [
    "swarm intelligence computing",
    "distributed optimization science",
    "Bittensor science subnet",
    "Swarm Bittensor",
    "collective AI optimization",
    "decentralized swarm algorithms",
  ],
},

{
  netuid: 125,
  slug: "8-ball",
  name: "8 Ball",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Predict the future of markets with AI precision",
  mainstream: "Polymarket or Augur (prediction markets)",
  problem:
    "Prediction markets are powerful tools for aggregating distributed knowledge but suffer from thin liquidity on most questions and manipulation by well-capitalized players. Most predictions markets also require manual curation of which questions to list.",
  differentiator:
    "8 Ball uses Bittensor miners to automatically generate, price, and maintain prediction markets on any measurable question, with AI liquidity provision keeping spreads tight even on niche topics. The network's diversity of miners makes it extremely hard for any single actor to manipulate outcomes.",
  keywords: [
    "decentralized prediction markets",
    "AI forecasting platform",
    "Bittensor finance subnet",
    "8 Ball Bittensor",
    "Polymarket alternative AI",
    "automated prediction markets",
  ],
},

{
  netuid: 126,
  slug: "poker44",
  name: "Poker44",
  category: "Generative Media",
  subnetType: "Creative",
  tagline: "Play with AI opponents who always raise the stakes",
  mainstream: "PokerStars or GGPoker",
  problem:
    "Online poker platforms rely on human opponents and are vulnerable to collusion, bot abuse, and rigged random number generation — problems that players can rarely detect or prove. Trust in online card games is at an all-time low.",
  differentiator:
    "Poker44 combines verifiable on-chain randomness with AI-powered opponents trained by Bittensor miners, creating fair games that are mathematically provable. Players can choose between human opponents with on-chain fraud detection or AI opponents of configurable skill levels.",
  keywords: [
    "blockchain poker",
    "AI poker opponents",
    "Bittensor creative subnet",
    "Poker44 Bittensor",
    "provably fair poker",
    "decentralized card games",
  ],
},

{
  netuid: 127,
  slug: "astrid",
  name: "Astrid",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Navigate complexity with a star to guide you",
  mainstream: "Notion AI or Confluence AI",
  problem:
    "Enterprise knowledge management fails because information is scattered across dozens of systems, written in different styles, and never kept up to date. When employees need answers, they ask colleagues instead of searching documentation — creating bottlenecks and knowledge silos.",
  differentiator:
    "Astrid builds and maintains a living knowledge graph of your organization by continuously mining your existing tools and documents. Bittensor miners handle the extraction and synthesis, while the incentive layer ensures accuracy by validating knowledge claims against primary sources.",
  keywords: [
    "enterprise knowledge management AI",
    "organizational knowledge graph",
    "Bittensor tools subnet",
    "Astrid Bittensor",
    "AI documentation assistant",
    "corporate knowledge base AI",
  ],
},

{
  netuid: 128,
  slug: "byteleap",
  name: "ByteLeap",
  category: "Distributed Compute",
  subnetType: "Compute",
  tagline: "Leap ahead with byte-perfect distributed compute",
  mainstream: "Fly.io or Railway (developer compute platforms)",
  problem:
    "Developer-friendly compute platforms charge a significant premium over raw infrastructure costs for the convenience of simple deployment. Teams scaling beyond prototype stage face sticker shock when bills arrive, but migrating to cheaper bare-metal is a multi-month engineering project.",
  differentiator:
    "ByteLeap combines developer-friendly deployment simplicity with the cost efficiency of decentralized compute from the Bittensor network. Teams get push-to-deploy convenience at infrastructure-cost pricing, without ever needing to manage servers or negotiate cloud contracts.",
  keywords: [
    "developer compute platform",
    "cheap app deployment",
    "Bittensor compute subnet",
    "ByteLeap Bittensor",
    "Fly.io alternative decentralized",
    "simple decentralized hosting",
  ],
},

{
  netuid: 28,
  slug: "gm",
  name: "gm",
  category: "AI Inference",
  subnetType: "Inference",
  tagline: "Confidential drop-in gateway to Claude, GPT and Gemini",
  mainstream: "OpenRouter / direct OpenAI & Anthropic API access",
  problem:
    "Sending prompts to frontier-model APIs exposes potentially sensitive data to the provider and any intermediary aggregator, and there is no cryptographic guarantee about what code is handling your request or your keys. Teams that need privacy have few drop-in options.",
  differentiator:
    "Every request runs through an Intel TDX-attested enclave with Intel-signed measurements verifying the exact gateway code, so operators cannot see prompts or upstream keys. It is OpenAI-API-compatible (works with Cursor, Cline, Claude Code) and prices models at or below official provider rates.",
  keywords: [
    "confidential inference",
    "bittensor gm",
    "TEE LLM gateway",
    "Intel TDX",
    "private AI API",
    "OpenAI compatible",
  ],
},

{
  netuid: 78,
  slug: "vocence",
  name: "Vocence",
  category: "Voice AI",
  subnetType: "Creative",
  tagline: "A decentralized voice-intelligence layer on Bittensor",
  mainstream: "ElevenLabs",
  problem:
    "High-quality voice AI (TTS, cloning, voice design) is dominated by closed, expensive centralized APIs like ElevenLabs; Vocence aims to produce comparable voice models through open, incentive-driven competition.",
  differentiator:
    "Prompt-based TTS where a natural-language description sets voice traits (gender, tone, emotion, pitch, age, accent, recording environment), evaluated by decentralized validators; already has a live Studio product and API rather than being research-only.",
  keywords: [
    "voice",
    "text-to-speech",
    "voice cloning",
    "speech",
    "PromptTTS",
    "audio",
  ],
},

{
  netuid: 82,
  slug: "compelle",
  name: "Compelle",
  category: "AI Reasoning / Debate",
  subnetType: "Inference",
  tagline: "Stop asking one AI. Make two of them fight over your question.",
  mainstream: "Asking a single frontier LLM (ChatGPT / Claude); no direct centralized debate-as-a-service equivalent",
  problem:
    "A single AI answer is a confident monologue with no adversarial pressure-testing; users can't see the strongest counterarguments to a claim.",
  differentiator:
    "Structured adversarial debate with independent panel judging instead of one model's answer; open judges/strategies/prompts and a large corpus of judged debates as a decentralized subnet.",
  keywords: [
    "debate",
    "adversarial",
    "reasoning",
    "judge-panel",
    "frontier-LLM",
    "argumentation",
  ],
},

{
  netuid: 100,
  slug: "base",
  name: "BASE",
  category: "AI Evaluation Infrastructure",
  subnetType: "Tools",
  tagline: "Trustless, reproducible, multi-challenge evaluation layer for decentralized AI",
  mainstream: "An on-chain Kaggle / MLPerf-style benchmarking and model-evaluation platform",
  problem:
    "AI research lacks trustless, reproducible evaluation. Existing benchmarks are centralized, gameable, and can't honestly assess model submissions across many simultaneous challenges.",
  differentiator:
    "Byzantine-fault-tolerant PBFT consensus across independent validators running identical Docker eval containers, plus sub-subnet architecture for many concurrent challenges under one validator network.",
  keywords: [
    "evaluation framework",
    "PBFT consensus",
    "Docker challenges",
    "benchmarking",
    "sub-subnet",
    "reproducible AI",
  ],
},
];

/** Look up a TaoPageSubnet by URL slug */
export function getTaoPageBySlug(slug: string): TaoPageSubnet | undefined {
  return TAO_PAGES_SUBNETS.find((s) => s.slug === slug);
}

/** Ordered list of netuids for generateStaticParams */
export const TAO_PAGE_NETUIDS = TAO_PAGES_SUBNETS.map((s) => s.netuid);
