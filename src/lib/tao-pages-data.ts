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
  name: "τemplar",
  category: "Decentralized AI Training",
  subnetType: "Training",
  tagline: "The world's largest active decentralized LLM training network — Covenant-72B proves it works",
  mainstream: "Together AI, CoreWeave, or Lambda Labs GPU clusters",
  problem:
    "Training frontier AI models costs tens of millions of dollars and requires access to massive, coordinated GPU clusters that only the biggest tech companies own. Independent researchers and startups are completely locked out, concentrating AI development in a tiny number of hands.",
  differentiator:
    "In March 2026, τemplar completed Covenant-72B — the largest decentralized LLM pretraining run in history: a 7.2B parameter model trained on 1.1 trillion tokens across 70+ independent nodes. Anthropic co-founder Jack Clark called it the world's largest active decentralized training network, triggering a 40% TAO surge. The fully permissionless architecture means anyone with a GPU can contribute, and market-driven incentives reward loss reduction.",
  keywords: [
    "decentralized LLM training",
    "Covenant-72B",
    "τemplar Bittensor",
    "permissionless AI training",
    "distributed pretraining",
    "Jack Clark AI",
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
  slug: "taofi",
  name: "TaoFi",
  category: "Decentralized Exchange",
  subnetType: "Finance",
  tagline: "The only DEX purpose-built for dTAO subnet token trading — now bridged to Base and Solana",
  mainstream: "Uniswap, Orca, or Jupiter",
  problem:
    "Bittensor subnet tokens (dTAO) have no native liquid market. TAO holders who want exposure to specific subnet performance have had to use centralized exchanges with KYC, high fees, and no support for the full range of subnet tokens.",
  differentiator:
    "TaoFi is the native decentralized exchange for the Bittensor ecosystem, with Uniswap v3-style pools for TAO and all subnet alpha tokens. A cross-chain bridge brings Base and Solana liquidity to Bittensor in a single click. An activated protocol fee switch (0.1%) flows into SN10 token buybacks — making TaoFi one of the few Bittensor subnets with real, on-chain fee revenue.",
  keywords: [
    "TAO DEX",
    "dTAO subnet tokens",
    "TaoFi Bittensor",
    "cross-chain bridge",
    "subnet token liquidity",
    "decentralized exchange",
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
  slug: "taohash",
  name: "TAOHash",
  category: "Proof of Work Finance",
  subnetType: "Finance",
  tagline: "Merge mining meets decentralized intelligence",
  mainstream: "NiceHash or Braiins Pool",
  problem:
    "Proof-of-work miners generate enormous hash power but earn only from block rewards, with no additional revenue stream for their hardware. Meanwhile, hash rate is a valuable signal of computational commitment that goes largely untapped outside of its native chain.",
  differentiator:
    "TAOHash bridges traditional proof-of-work mining into the Bittensor ecosystem, letting miners earn TAO rewards on top of their existing mining revenue. This creates a new income layer for miners while anchoring Bittensor consensus to real-world computational work.",
  keywords: [
    "proof of work Bittensor",
    "TAOHash mining",
    "merge mining TAO",
    "Bittensor finance subnet",
    "crypto mining rewards",
    "hash rate monetization",
  ],
},

{
  netuid: 15,
  slug: "bitquant",
  name: "BitQuant",
  category: "Crypto Analytics AI",
  subnetType: "Finance",
  tagline: "Ask any question about DeFi — get a signed, verifiable answer on-chain",
  mainstream: "Messari, Nansen, or DeFiLlama analytics",
  problem:
    "Crypto market intelligence is siloed, expensive, and — critically — not verifiable. When a data provider tells you a pool's TVL or a protocol's risk score, you have no way to independently confirm the answer. For high-stakes DeFi decisions, that's a problem.",
  differentiator:
    "BitQuant (by OpenGradient) deploys AI agents that answer natural language questions about DeFi pools, portfolio risk, and crypto assets — with every answer logged as a signed, on-chain Q&A pair you can audit. With 4.7M beta sessions, 41M+ messages, and 1.5M unique users pre-launch, it's one of the most-adopted Bittensor applications outside of inference.",
  keywords: [
    "DeFi analytics AI",
    "crypto intelligence",
    "on-chain verified AI",
    "BitQuant Bittensor",
    "natural language crypto queries",
    "DeFi oracle",
  ],
},

{
  netuid: 16,
  slug: "bitads",
  name: "BitAds",
  category: "Performance Marketing",
  subnetType: "Tools",
  tagline: "Pay-per-sale advertising — you only pay when a sale is made, verified by Stripe",
  mainstream: "Google Ads, Meta Ads, or Rakuten Affiliate",
  problem:
    "Traditional digital advertising charges per impression or click, with massive amounts of fake traffic eating into ad budgets. Advertisers pay for clicks that never convert, and publishers are incentivized to generate volume over quality. Performance is almost impossible to independently verify.",
  differentiator:
    "BitAds (by FirstTensorLabs) is a decentralized pay-per-sale advertising network where advertisers pay zero unless a confirmed sale is made — verified via Stripe integration. Miners (marketers) drive traffic and are paid only on verified conversions. Advertisers stake SN16 alpha to own marketing bandwidth, creating a skin-in-the-game dynamic that aligns incentives across the entire funnel.",
  keywords: [
    "pay-per-sale advertising",
    "performance marketing",
    "BitAds Bittensor",
    "affiliate marketing crypto",
    "conversion-tracked ads",
    "decentralized advertising",
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
  slug: "nineteen",
  name: "Nineteen",
  category: "AI Inference",
  subnetType: "Inference",
  tagline: "The #1-ranked inference subnet on Bittensor, optimized for real-time production workloads",
  mainstream: "Together AI, Groq, or Fireworks AI",
  problem:
    "Low-latency AI inference at scale is expensive and centralized. Most inference providers have a handful of data centers, creating high round-trip times for users outside major regions — and single points of failure that shut down dependent applications.",
  differentiator:
    "Nineteen (by Rayon Labs) is the top-ranked inference subnet on Bittensor and one of the most-used providers on OpenRouter, optimized specifically for latency-sensitive production workloads. It hosts both LLM inference and image generation, with benchmarks showing it outperforms Web2 competitors on cost and speed.",
  keywords: [
    "decentralized LLM inference",
    "low-latency AI API",
    "Bittensor inference subnet",
    "Nineteen Bittensor",
    "Rayon Labs",
    "OpenRouter inference",
  ],
},

{
  netuid: 20,
  slug: "bounty-hunter",
  name: "Bounty Hunter",
  category: "AI Benchmarking",
  subnetType: "Tools",
  tagline: "Earn crypto bounties for winning on the world's toughest AI benchmarks",
  mainstream: "Kaggle or Papers With Code leaderboards",
  problem:
    "AI benchmark competitions are centralized, slow, and pay nothing — there is no mechanism for the researchers making real progress on hard problems like SWE-Bench to be rewarded proportionally to their contribution.",
  differentiator:
    "Bounty Hunter (by Team Rizzo) transforms Bittensor mining into open AI benchmark competitions with real TAO bounties. Miners compete on benchmarks like SWE-Bench and the results are automatically evaluated on-chain. The consumer platform AIBoards.io (launched Oct 2025) provides leaderboards, user accounts, and reputation scores — making it the first crypto-native incentive layer for AI research competitions.",
  keywords: [
    "AI benchmark competitions",
    "SWE-Bench bounty",
    "Bittensor tools subnet",
    "Bounty Hunter Bittensor",
    "AI research rewards",
    "on-chain AI evaluation",
  ],
},

{
  netuid: 21,
  slug: "omega-any-to-any",
  name: "OMEGA Any-to-Any",
  category: "Multimodal AI",
  subnetType: "Training",
  tagline: "Building the world's largest open AGI dataset — text, video, audio, and image together",
  mainstream: "Google Gemini multimodal or OpenAI GPT-4o",
  problem:
    "Training genuinely multimodal AI — models that seamlessly work across text, video, audio, and images simultaneously — requires enormous amounts of diverse, coordinated data that no single lab can afford to gather. The result is frontier multimodal AI concentrated in a handful of corporations.",
  differentiator:
    "OMEGA Any-to-Any (by OMEGA Labs) has assembled over 1 million hours of footage and 30 million 2-minute video clips across 50+ scenarios — the world's largest decentralized AGI multimodal dataset. Any contributor earns TAO permissionlessly. Primary focus in 2025-26 is voice-to-voice generation, with an any-to-any architecture training all modalities simultaneously.",
  keywords: [
    "multimodal AI",
    "AGI dataset",
    "any-to-any AI",
    "video AI training data",
    "OMEGA Labs Bittensor",
    "decentralized AI research",
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
  slug: "nuance",
  name: "Nuance",
  category: "Content Quality AI",
  subnetType: "Data",
  tagline: "Making online discourse more factual, more nuanced, more trustworthy",
  mainstream: "NewsGuard, Snopes, or Wikipedia quality control",
  problem:
    "Online discourse is flooded with misinformation, shallow takes, and low-quality content that platforms have no incentive to filter. Centralized fact-checkers introduce their own biases, while users have no independent way to assess the quality of what they're reading.",
  differentiator:
    "Nuance evaluates online content across three dimensions — factuality, granularity, and tone — using data from 400,000+ Sybil-resistant accounts. It fetches response data through the DeSEARCH API and creates objective quality scores that any platform or user can act on. The Sybil-resistance mechanism prevents coordinated manipulation of scores.",
  keywords: [
    "content quality AI",
    "fact-checking decentralized",
    "discourse quality",
    "Nuance Bittensor",
    "information integrity",
    "Sybil-resistant scoring",
  ],
},

{
  netuid: 24,
  slug: "omega-labs",
  name: "OMEGA Labs",
  category: "AGI Data Collection",
  subnetType: "Data",
  tagline: "Building the open data foundation for AGI — one video clip at a time",
  mainstream: "Scale AI data labeling or Common Crawl",
  problem:
    "Training AGI requires enormous volumes of diverse, multimodal data — text, video, images, audio — at scales that no single organization can generate. Existing datasets are either too small, too narrow, or locked behind corporate walls.",
  differentiator:
    "OMEGA Labs has assembled 1 million+ hours of footage and 30 million+ video clips across 50+ real-world scenarios — the world's largest decentralized multimodal dataset for AGI training. Contributors earn TAO for sharing data. In April 2026 they released Quasar-3B, a long-context AI using a looped continuous-time transformer architecture designed to handle millions of tokens.",
  keywords: [
    "AGI dataset",
    "multimodal training data",
    "video AI data",
    "OMEGA Labs Bittensor",
    "Quasar-3B",
    "long-context AI",
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
  slug: "kinitro",
  name: "Kinitro",
  category: "Robotics AI",
  subnetType: "Science",
  tagline: "The world's first decentralized robotics AI competition network",
  mainstream: "Boston Dynamics research, NVIDIA Isaac, or DeepMind Robotics",
  problem:
    "Developing generalizable robotic AI — robots that can navigate and manipulate in the real world — requires massive amounts of simulation data and compute that no single lab can afford. Progress is concentrated in a tiny number of well-funded research teams, leaving enormous potential untapped.",
  differentiator:
    "Kinitro incentivizes the development of generalist robotic policies through competitive challenges in diverse simulated environments. Miners submit AI agents that compete on robotic tasks; validators score performance across multiple scenarios. It's the first permissionless, incentivized arena for robot learning — anyone with compute can contribute to building the next generation of robotic AI.",
  keywords: [
    "robotics AI",
    "embodied intelligence",
    "robot simulation",
    "generalist robot policy",
    "Kinitro Bittensor",
    "decentralized robotics",
  ],
},

{
  netuid: 27,
  slug: "nodexo",
  name: "Nodexo",
  category: "Distributed Compute",
  subnetType: "Compute",
  tagline: "Node-by-node compute that scales without limits",
  mainstream: "Akash Network or Render Network",
  problem:
    "Scaling compute workloads across many nodes requires complex orchestration software and deep DevOps expertise. Most small teams end up over-provisioning expensive cloud VMs because setting up a proper distributed compute cluster is simply too hard.",
  differentiator:
    "Nodexo abstracts away all node orchestration complexity, presenting users with a simple API to run parallel compute tasks. The Bittensor incentive layer handles node discovery, fault tolerance, and payment, so users focus on their workloads rather than infrastructure.",
  keywords: [
    "distributed node computing",
    "decentralized compute cluster",
    "Bittensor compute subnet",
    "Nodexo Bittensor",
    "Akash alternative",
    "parallel compute API",
  ],
},

{
  netuid: 29,
  slug: "ai-assess",
  name: "AI-ASSeSS",
  category: "AI Safety",
  subnetType: "Tools",
  tagline: "Red-team AI agents at scale — find the safety gaps before they matter",
  mainstream: "Anthropic's internal red team, Scale AI safety division, or UK AI Safety Institute",
  problem:
    "As AI agents take on more autonomous tasks, adversarial testing and safety evaluation must scale with them. Traditional red-teaming is done by small human teams infrequently — there is no decentralized, crowdsourced mechanism for stress-testing AI agents against unsafe, misaligned, or adversarial behavior at scale.",
  differentiator:
    "AI-ASSeSS (AI Agent Safety & Security Subnet) is the first Bittensor subnet dedicated to AI safety evaluation. Miners compete on safety benchmarks, submitting adversarial scenarios that test AI agents for misaligned behavior, and earn TAO for finding vulnerabilities. It's permissionless, on-chain AI safety red-teaming — anyone can contribute attack scenarios and get rewarded for real discoveries.",
  keywords: [
    "AI safety",
    "red-teaming AI agents",
    "adversarial AI testing",
    "AI alignment",
    "AI-ASSeSS Bittensor",
    "AI security benchmarks",
  ],
},

{
  netuid: 31,
  slug: "halftime",
  name: "Halftime",
  category: "Decentralized AI Training",
  subnetType: "Training",
  tagline: "Cut your training time in half, every time",
  mainstream: "Google Vertex AI Training or Azure ML",
  problem:
    "Long training runs are both expensive and fragile — a hardware failure 90% through a run can waste weeks of compute time and thousands of dollars. Checkpointing and resuming training across heterogeneous hardware is a solved problem in theory but a nightmare in practice.",
  differentiator:
    "Halftime provides robust mid-training checkpointing and distributed continuation across Bittensor miners, so training runs survive hardware failures and can be resumed or scaled up at any point. The network automatically redistributes work when a miner drops out, eliminating wasted compute.",
  keywords: [
    "fault-tolerant AI training",
    "distributed training checkpointing",
    "Bittensor training subnet",
    "Halftime Bittensor",
    "resume training distributed",
    "efficient model training",
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
  slug: "cartha",
  name: "Cartha",
  category: "Mathematical AI",
  subnetType: "Tools",
  tagline: "Competitive AI that gets better at math every day",
  mainstream: "Wolfram Alpha, Mathway, or OpenAI o1/o3 reasoning",
  problem:
    "Mathematical and logical reasoning remains one of the weakest areas in large language models. A subnet that specifically incentivizes competition on hard math and logic problems can drive rapid improvement that general-purpose model development alone cannot match.",
  differentiator:
    "Cartha (rebranded from LogicNet) runs a competitive mathematical reasoning subnet where miners are scored on both correctness AND reasoning steps — the chain of thought, not just the final answer. This means the network rewards genuine mathematical understanding, not pattern matching, producing AI with more reliable STEM reasoning capabilities.",
  keywords: [
    "mathematical AI",
    "logical reasoning",
    "chain of thought AI",
    "STEM AI",
    "Cartha Bittensor",
    "math benchmark AI",
  ],
},

{
  netuid: 36,
  slug: "web-agents-autoppia",
  name: "Web Agents - Autoppia",
  category: "Autonomous Web Agents",
  subnetType: "Agents",
  tagline: "AI agents that navigate any website — competing directly with OpenAI Operator",
  mainstream: "OpenAI Operator, Anthropic Computer Use, or Playwright",
  problem:
    "Web automation breaks whenever a site updates its layout, because traditional browser automation is brittle script-following. AI agents that understand goals can adapt — but there has been no competitive market to drive them to get reliably good at real web tasks.",
  differentiator:
    "Autoppia uses the Infinite Web Arena (IWA) benchmark — generative AI that creates infinite novel web challenges to prevent overfitting — to evaluate miners building autonomous web agents. Competing directly with OpenAI Operator and Anthropic Computer Use, it's the only decentralized approach. The Dynamic Zero incentive upgrade (October 2025) further raised the quality bar for completing real browser interactions.",
  keywords: [
    "web automation AI",
    "autonomous browser agents",
    "Autoppia Bittensor",
    "OpenAI Operator alternative",
    "AI web workers",
    "Infinite Web Arena",
  ],
},

{
  netuid: 37,
  slug: "fine-tuning",
  name: "Macrocosmos Fine-tuning",
  category: "AI Model Fine-tuning",
  subnetType: "Training",
  tagline: "Run simultaneous model fine-tuning competitions — chatbots, coding, reasoning, and more",
  mainstream: "Hugging Face AutoTrain or Google Cloud Vertex AI fine-tuning",
  problem:
    "Fine-tuning state-of-the-art models to specific tasks requires expensive cloud resources and ML engineering expertise. Individual teams can't compete with the continuous improvement cycles that major AI labs run internally.",
  differentiator:
    "Macrocosmos Fine-tuning (SN37) runs multiple parallel fine-tuning competitions simultaneously across different domains — chatbots, reasoning, coding, and web agents. Miners fine-tune offline, upload to HuggingFace, and compete for rewards. The subnet cross-integrates with SN9 (IOTA) for pretrained base models and SN18 for synthetic training data, making it a key node in Bittensor's coordinated AI training ecosystem.",
  keywords: [
    "AI fine-tuning",
    "RLHF competition",
    "model training Bittensor",
    "Macrocosmos fine-tuning",
    "HuggingFace models",
    "decentralized ML training",
  ],
},

{
  netuid: 38,
  slug: "dstrbtd",
  name: "DSTRBTD",
  category: "Distributed AI Training",
  subnetType: "Training",
  tagline: "Train LLMs across commodity hardware — 40% more energy-efficient than traditional clusters",
  mainstream: "Prime Intellect or Petals (Hugging Face)",
  problem:
    "Training large language models requires centralized supercomputer clusters costing tens of millions of dollars. There is no viable way for independent researchers or small teams to contribute to genuine LLM pretraining at meaningful scale.",
  differentiator:
    "DSTRBTD miners perform gradient computations on portions of a dataset and share them to update a shared model — without requiring each miner to hold the full model in memory. The system uses trustless gradient verification in adversarial environments and has achieved ~40% lower energy cost versus traditional training clusters, having completed 1.1B parameter training runs.",
  keywords: [
    "distributed LLM training",
    "gradient sharing",
    "DSTRBTD Bittensor",
    "energy-efficient AI training",
    "decentralized pretraining",
    "commodity GPU training",
  ],
},

{
  netuid: 39,
  slug: "basilica",
  name: "basilica",
  category: "Distributed Compute",
  subnetType: "Compute",
  tagline: "The grand architecture for decentralized compute",
  mainstream: "Terraform or Pulumi (infrastructure as code)",
  problem:
    "Provisioning and managing distributed compute infrastructure requires deep expertise in cloud platforms and DevOps tooling. The gap between writing code that works locally and deploying it reliably at scale costs startups months of engineering time.",
  differentiator:
    "basilica provides a declarative infrastructure layer for decentralized compute, letting developers describe what they need and automatically provisioning resources from the Bittensor miner network. It handles elasticity, fault tolerance, and cost optimization without any cloud vendor account.",
  keywords: [
    "decentralized infrastructure",
    "compute provisioning",
    "Bittensor compute subnet",
    "basilica Bittensor",
    "cloud alternative decentralized",
    "infrastructure as code blockchain",
  ],
},

{
  netuid: 40,
  slug: "chunking",
  name: "Chunking",
  category: "Decentralized Storage",
  subnetType: "Storage",
  tagline: "Break it down, store it safe, retrieve it fast",
  mainstream: "Pinecone or Weaviate (vector storage)",
  problem:
    "Storing and retrieving large documents for AI applications requires splitting content into meaningful chunks and indexing them for semantic search. Building this pipeline correctly is complex, and centralized vector databases are expensive at scale.",
  differentiator:
    "Chunking specializes in intelligent document splitting and semantic indexing, distributing storage and retrieval across Bittensor miners. The network ensures chunks are stored redundantly and retrieved with sub-second latency, making RAG applications dramatically cheaper to run.",
  keywords: [
    "document chunking AI",
    "decentralized vector storage",
    "Bittensor storage subnet",
    "Chunking Bittensor",
    "RAG infrastructure decentralized",
    "semantic search storage",
  ],
},

{
  netuid: 41,
  slug: "sportstensor",
  name: "Sportstensor",
  category: "Sports Prediction AI",
  subnetType: "Finance",
  tagline: "Open AI sports prediction — every league, every game, verified on-chain",
  mainstream: "Stats Perform, Sportradar, or FanDuel analytics",
  problem:
    "Sports prediction models are proprietary and opaque, accessible only to sportsbooks and large DFS operations. Individual bettors and researchers have no way to access — let alone verify — the AI models that set the lines they're betting against.",
  differentiator:
    "Sportstensor runs a decentralized sports prediction network where miners compete on accuracy across NFL, NBA, MLB, NHL, EPL, and MLS. Validators sync match data every 30 minutes and score predictions with edge-based rewards. A Polymarket integration (September 2025) with a 1% fee-on-volume buyback model creates real economic utility beyond the prediction game itself.",
  keywords: [
    "sports prediction AI",
    "prediction markets",
    "Polymarket integration",
    "Sportstensor Bittensor",
    "NFL NBA MLB AI",
    "decentralized sports oracle",
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
  slug: "talisman-ai",
  name: "Talisman AI",
  category: "AI Agents",
  subnetType: "Agents",
  tagline: "Your AI guardian for every digital interaction",
  mainstream: "Notion AI or Personal.ai",
  problem:
    "Managing the flood of digital communications, tasks, and decisions in modern work is overwhelming. People spend more time organizing information than acting on it. Personal AI assistants exist but are siloed in single applications and can't act autonomously across your digital life.",
  differentiator:
    "Talisman AI deploys persistent personal agents that learn your preferences and autonomously handle routine tasks across email, calendar, documents, and apps. Miners compete to build the most capable and personalized agent behaviors, continuously raising the quality bar.",
  keywords: [
    "personal AI agent",
    "autonomous digital assistant",
    "Bittensor agent subnet",
    "Talisman AI Bittensor",
    "AI life management",
    "intelligent personal agent",
  ],
},

{
  netuid: 46,
  slug: "resi",
  name: "RESI",
  category: "Decentralized Data",
  subnetType: "Data",
  tagline: "Real estate intelligence that never sleeps",
  mainstream: "Zillow or CoStar",
  problem:
    "Real estate data is fragmented across thousands of local MLS systems, county records, and proprietary databases that do not communicate with each other. Investors and agents pay enormously for data that is still incomplete, delayed, and jurisdiction-specific.",
  differentiator:
    "RESI coordinates miners to continuously aggregate, normalize, and enrich real estate data from every available public and private source. The result is a living, unified property intelligence dataset that updates in near real-time and is far more comprehensive than any single commercial provider.",
  keywords: [
    "decentralized real estate data",
    "property intelligence AI",
    "Bittensor data subnet",
    "RESI Bittensor",
    "real estate analytics",
    "MLS data aggregation",
  ],
},

{
  netuid: 47,
  slug: "evolai",
  name: "EvolAI",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "AI that evolves with every interaction",
  mainstream: "Weights & Biases or MLflow",
  problem:
    "Deployed AI models degrade over time as the world changes around them — a phenomenon called model drift. Detecting and correcting drift requires dedicated monitoring infrastructure and retraining pipelines that most teams build from scratch, badly.",
  differentiator:
    "EvolAI provides automated model lifecycle management, detecting drift, triggering retraining, and validating new model versions before they replace old ones. The Bittensor miner network handles the compute for continuous evaluation, making production AI maintenance nearly hands-free.",
  keywords: [
    "AI model lifecycle management",
    "model drift detection",
    "Bittensor tools subnet",
    "EvolAI Bittensor",
    "MLOps decentralized",
    "continuous model improvement",
  ],
},

{
  netuid: 48,
  slug: "quantum-compute",
  name: "Quantum Compute",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Quantum-inspired finance at decentralized scale",
  mainstream: "IBM Quantum or D-Wave",
  problem:
    "Quantum computing promises to revolutionize portfolio optimization, risk modeling, and cryptography, but access is limited to a handful of expensive, unreliable quantum machines. Most financial institutions are experimenting without any path to production-scale quantum advantage.",
  differentiator:
    "Quantum Compute combines quantum-inspired classical algorithms with access to real quantum hardware, distributed via the Bittensor network. Financial users can run quantum optimization workloads without managing hardware, paying only for the compute they actually use.",
  keywords: [
    "quantum finance computing",
    "quantum optimization",
    "Bittensor finance subnet",
    "Quantum Compute Bittensor",
    "portfolio optimization quantum",
    "quantum-inspired algorithms",
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
  slug: "efficientfrontier",
  name: "EfficientFrontier",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Optimize everything, waste nothing",
  mainstream: "Optuna or Ray Tune",
  problem:
    "Hyperparameter optimization and portfolio construction both require exploring vast search spaces to find the best configurations — work that is computationally expensive and easy to do badly. Most teams use ad-hoc approaches that leave significant performance on the table.",
  differentiator:
    "EfficientFrontier applies portfolio optimization mathematics to general-purpose search problems, distributed across Bittensor miners. Whether you're tuning a model or allocating capital, the network efficiently explores the possibility space and surfaces Pareto-optimal solutions.",
  keywords: [
    "hyperparameter optimization",
    "portfolio optimization AI",
    "Bittensor tools subnet",
    "EfficientFrontier Bittensor",
    "decentralized optimization",
    "Pareto optimization network",
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
  category: "Synthetic Genomics",
  subnetType: "Science",
  tagline: "Privacy-safe synthetic DNA — enabling drug discovery without touching real patient data",
  mainstream: "23andMe (data), Illumina (sequencing), or Tempus AI (oncogenomics)",
  problem:
    "Drug discovery, personalized medicine, and pharmacogenomics research require large-scale genomic data — but real genomic data cannot be shared at scale due to privacy laws, ethics regulations, and patient consent requirements. This bottleneck is slowing life-saving research.",
  differentiator:
    "NIOME (by Genomes.io, accelerated by YumaGroup) generates synthetic genomic data that is statistically indistinguishable from real DNA, enabling AI training for drug discovery and precision medicine without ethical or legal barriers. It won the MIT Entrepreneurial Development Prize (January 2026) and has paying clients including a nutrition research practice in Scotland — validating it as a commercially real product.",
  keywords: [
    "synthetic genomics",
    "precision medicine AI",
    "pharmacogenomics",
    "drug discovery data",
    "NIOME Bittensor",
    "privacy-preserving genomics",
  ],
},

{
  netuid: 57,
  slug: "gaia",
  name: "GAIA",
  category: "Geospatial & Climate AI",
  subnetType: "Science",
  tagline: "10-day global weather forecasts powered by Microsoft Aurora — decentralized and open",
  mainstream: "The Weather Company (IBM), Tomorrow.io, or Google DeepMind WeatherBench",
  problem:
    "Commercial weather forecast APIs are expensive, centralized, and controlled by a handful of companies whose models are opaque. Climate and agricultural decision-makers in developing regions often have no access to accurate forecasts that their lives literally depend on.",
  differentiator:
    "GAIA (by the Nickel5 team) delivers 10-day global weather forecasts using Microsoft Aurora across 9 variables, 13 pressure levels, and 20 lead times — plus geomagnetic storm forecasting, soil moisture prediction, and agricultural optimization. It integrates ECMWF, Sentinel-2, and SMAP L4 data, and was presented at the European Geosciences Union 2025. This is the first geospatial AI subnet on Bittensor, and its mixture-of-experts approach makes it competitive with commercial providers.",
  keywords: [
    "weather forecasting AI",
    "geospatial AI",
    "Microsoft Aurora",
    "climate prediction",
    "GAIA Bittensor",
    "earth observation AI",
  ],
},

{
  netuid: 58,
  slug: "handshake",
  name: "Handshake",
  category: "AI Agent Payments",
  subnetType: "Finance",
  tagline: "$0.0001 micropayments for AI agents — 200x smaller than Stripe's minimum",
  mainstream: "Stripe, Circle, or Lightning Network",
  problem:
    "AI agents making thousands of micro-API calls have no viable payment layer. Existing payment rails are too expensive for sub-cent transactions — Stripe's minimum is 30 cents per charge, which makes micropayment-based AI agent economies economically impossible.",
  differentiator:
    "Handshake58 enables $0.0001 minimum transactions via USDC on Polygon using the DRAIN payment-channel protocol — with zero per-transaction gas after an initial $0.02 channel open. Launched February 2026, it provides an OpenAI-compatible provider API for easy agent integration. This is the infrastructure layer that makes pay-as-you-go AI agent economies viable at scale.",
  keywords: [
    "AI agent payments",
    "micropayments USDC",
    "DRAIN payment channels",
    "Handshake Bittensor",
    "agent payment infrastructure",
    "sub-cent transactions",
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
  slug: "quantum-innovate",
  name: "Quantum Innovate",
  category: "Scientific Computing",
  subnetType: "Science",
  tagline: "Quantum-ready science for the decentralized age",
  mainstream: "IBM Quantum or Google Quantum AI",
  problem:
    "Quantum computing research requires access to rare and expensive quantum processors that are booked months in advance. Most researchers are limited to simulation environments that cannot capture the true behavior of quantum systems at meaningful qubit counts.",
  differentiator:
    "Quantum Innovate aggregates access to diverse quantum hardware and high-fidelity simulators, distributed through the Bittensor network. Researchers submit experiments and pay in TAO, with validators ensuring computational integrity and fair access across the scientific community.",
  keywords: [
    "quantum computing research",
    "decentralized quantum access",
    "Bittensor science subnet",
    "Quantum Innovate Bittensor",
    "quantum simulation network",
    "quantum hardware marketplace",
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
  slug: "tau",
  name: "Tau",
  category: "AI Software Engineering",
  subnetType: "Agents",
  tagline: "AI coding agents that duel each other to patch real open-source code",
  mainstream: "Cognition AI Devin, OpenHands, or AutoCodeRover",
  problem:
    "Open-source software repositories accumulate bugs and technical debt faster than volunteer maintainers can address them. AI coding assistants exist, but there is no competitive incentive layer that continuously pushes them to get better at real-world software repair.",
  differentiator:
    "Tau's AI coding agents compete in head-to-head duels evaluated under SPRT (Sequential Probability Ratio Test) — patching real open-source repositories as the performance standard. The 'digital commodity' here is working software capability, not data or compute. Dueling evaluation ensures only agents that genuinely fix code win, with no gaming the benchmark.",
  keywords: [
    "AI coding agents",
    "open source patching",
    "software engineering AI",
    "Tau Bittensor",
    "autonomous code repair",
    "SPRT agent evaluation",
  ],
},

{
  netuid: 67,
  slug: "tenex",
  name: "Tenex",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Leveraged long positions on Bittensor subnet tokens — with TAO as collateral",
  mainstream: "Aave leveraged positions or dYdX perpetuals",
  problem:
    "TAO holders who believe in specific Bittensor subnets have had no way to take leveraged exposure to subnet token performance without using centralized exchanges with KYC requirements. Decentralized spot margin for subnet tokens simply didn't exist.",
  differentiator:
    "Tenex (Tenexium) is a spot margin lending protocol built natively for Bittensor, allowing users to take leveraged long positions on subnet tokens using TAO as collateral. TAO LPs earn yields from both Bittensor emissions and protocol fees. Launched September 9, 2025, it's the first DeFi protocol designed specifically around dTAO subnet token dynamics.",
  keywords: [
    "spot margin Bittensor",
    "leveraged subnet tokens",
    "Tenex Bittensor",
    "TAO collateral lending",
    "DeFi subnet tokens",
    "decentralized margin trading",
  ],
},

{
  netuid: 70,
  slug: "nexisgen",
  name: "NexisGen",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Generate the next thing before you need it",
  mainstream: "GitHub Copilot or Amazon CodeWhisperer",
  problem:
    "Code generation tools are reactive — they respond to what you type but don't anticipate what you need next. Developers still spend enormous time on boilerplate, configuration files, and repetitive code patterns that an intelligent system should handle proactively.",
  differentiator:
    "NexisGen analyzes your codebase context and proactively generates the next components, tests, and configuration you will need before you ask. Miners compete on prediction accuracy, creating a system that gets progressively better at anticipating developer needs.",
  keywords: [
    "proactive code generation",
    "AI code tools",
    "Bittensor tools subnet",
    "NexisGen Bittensor",
    "intelligent code completion",
    "developer AI assistant",
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
  slug: "streetvision-by-natix",
  name: "StreetVision by NATIX",
  category: "Decentralized Data",
  subnetType: "Data",
  tagline: "The world's streets mapped by everyone, for everyone",
  mainstream: "Google Street View or Mapillary",
  problem:
    "Street-level imagery and mapping data is controlled by Google, which collects it using expensive dedicated vehicles and uses it to power proprietary products. Municipalities, autonomous vehicle companies, and researchers pay enormous fees for data that the public effectively helped create.",
  differentiator:
    "StreetVision by NATIX turns every smartphone into a mapping device, rewarding contributors in TAO for capturing street-level imagery and sensor data. The resulting dataset is open, continuously updated, and free from corporate control — updated orders of magnitude faster than Google's vehicles can manage.",
  keywords: [
    "decentralized street mapping",
    "crowdsourced street imagery",
    "Bittensor data subnet",
    "StreetVision NATIX Bittensor",
    "Google Street View alternative",
    "open mapping network",
  ],
},

{
  netuid: 73,
  slug: "metahash",
  name: "MetaHash",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Hash the metadata, own the financial truth",
  mainstream: "Etherscan or Dune Analytics",
  problem:
    "Financial metadata — transaction context, entity labels, risk scores — is locked inside proprietary databases at blockchain analytics companies that charge enterprise fees. Without access to this metadata, on-chain data is nearly uninterpretable for most financial use cases.",
  differentiator:
    "MetaHash builds an open, decentralized layer of financial metadata on top of blockchain data, with miners competing to produce the most accurate entity labels and risk scores. All metadata is verifiable on-chain, making it tamper-resistant and available to anyone without subscription fees.",
  keywords: [
    "blockchain financial metadata",
    "on-chain analytics",
    "Bittensor finance subnet",
    "MetaHash Bittensor",
    "decentralized blockchain labels",
    "crypto entity intelligence",
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

{
  netuid: 78,
  slug: "loosh",
  name: "Loosh",
  category: "AI Agents",
  subnetType: "Agents",
  tagline: "Agents that feel the pulse of your digital world",
  mainstream: "Zapier AI or n8n",
  problem:
    "Event-driven automation systems are rigid — they respond to predefined triggers but miss contextual signals that a human would notice. When something unusual but important happens outside a defined rule, automated systems simply ignore it.",
  differentiator:
    "Loosh deploys contextually aware agents that monitor your digital environment holistically, identifying and responding to important signals whether or not they match a predefined trigger. Miners are rewarded for agents that catch high-value events that rule-based systems would miss.",
  keywords: [
    "contextual AI agents",
    "event-driven AI automation",
    "Bittensor agent subnet",
    "Loosh Bittensor",
    "intelligent monitoring agents",
    "autonomous event detection",
  ],
},

{
  netuid: 79,
  slug: "mvtrx",
  name: "MVTRX",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Move value at the speed of decentralized consensus",
  mainstream: "Stripe or Circle (USDC)",
  problem:
    "Moving value between blockchain networks and into the real world involves high fees, long settlement times, and custodial intermediaries that reintroduce the risks of centralized finance. Cross-chain transfers in particular are slow and expensive, limiting the utility of multi-chain portfolios.",
  differentiator:
    "MVTRX provides a decentralized value transfer layer that routes transactions across chains and into fiat rails via the most efficient path available. Miners compete to offer the lowest fees and fastest settlement, with the network automatically selecting optimal routes in real time.",
  keywords: [
    "decentralized value transfer",
    "cross-chain payments",
    "Bittensor finance subnet",
    "MVTRX Bittensor",
    "crypto payment rails",
    "multi-chain settlement",
  ],
},

{
  netuid: 80,
  slug: "dogelayer",
  name: "dogelayer",
  category: "Decentralized AI Training",
  subnetType: "Training",
  tagline: "Layer on the gains, one training run at a time",
  mainstream: "Petals or Ray (distributed training frameworks)",
  problem:
    "Training large models requires assembling a coordinated cluster of high-end GPUs, which is prohibitively expensive for most researchers. Distributed training frameworks exist but require significant engineering effort to set up and maintain across heterogeneous hardware.",
  differentiator:
    "dogelayer simplifies distributed training to a single command, automatically coordinating the Bittensor miner network into an efficient training cluster. The system handles hardware heterogeneity, fault tolerance, and gradient synchronization, so researchers focus on models rather than infrastructure.",
  keywords: [
    "decentralized distributed training",
    "easy AI model training",
    "Bittensor training subnet",
    "dogelayer Bittensor",
    "simple distributed deep learning",
    "GPU cluster automation",
  ],
},

{
  netuid: 81,
  slug: "grail",
  name: "grail",
  category: "Decentralized AI Training",
  subnetType: "Training",
  tagline: "The holy grail of AI training efficiency",
  mainstream: "DeepMind or OpenAI (internal training infrastructure)",
  problem:
    "AI training efficiency is the defining competitive advantage in the AI era, yet the techniques used by top labs — gradient checkpointing, mixed precision, pipeline parallelism — are documented in papers but rarely implemented correctly by smaller teams.",
  differentiator:
    "grail implements a curated set of state-of-the-art training efficiency techniques as a turnkey system across the Bittensor network. Users get frontier-lab training efficiency without the team of ML infrastructure engineers, dramatically increasing the compute-to-capability ratio.",
  keywords: [
    "AI training efficiency",
    "frontier model training",
    "Bittensor training subnet",
    "grail Bittensor",
    "efficient deep learning training",
    "training optimization distributed",
  ],
},

{
  netuid: 82,
  slug: "hermes",
  name: "Hermes",
  category: "Decentralized Data",
  subnetType: "Data",
  tagline: "Deliver data as fast as the messenger god",
  mainstream: "Confluent (Kafka) or AWS Kinesis",
  problem:
    "Real-time data streaming infrastructure is complex and expensive, requiring specialized engineering knowledge to operate at scale. Companies pay tens of thousands of dollars monthly for managed streaming services that create data lock-in.",
  differentiator:
    "Hermes provides decentralized real-time data streaming across the Bittensor network, with miners acting as relay nodes that are paid for throughput and reliability. Users get Kafka-scale data infrastructure without the vendor lock-in or the six-figure annual contract.",
  keywords: [
    "decentralized data streaming",
    "real-time data pipeline",
    "Bittensor data subnet",
    "Hermes Bittensor",
    "Kafka alternative blockchain",
    "streaming data network",
  ],
},

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
  slug: "chipforge-tatsu",
  name: "ChipForge (Tatsu)",
  category: "Chip Design AI",
  subnetType: "Science",
  tagline: "Competitive AI chip design — from Verilog contest to real silicon on Google OpenMPW",
  mainstream: "Arm Holdings, Cadence Design Systems, or Synopsys",
  problem:
    "Custom chip design is one of the most expensive engineering disciplines in existence, with EDA software licenses alone costing hundreds of thousands of dollars. Only the largest semiconductor companies can afford to design custom silicon — locking out startups, researchers, and open-source communities.",
  differentiator:
    "ChipForge miners submit Verilog/SystemVerilog designs for AI accelerators, crypto modules, and mini-GPUs in winner-takes-all challenges, with validators running automated EDA tools (Verilator, Yosys, OpenLane) to evaluate functionality, timing, power, and area. It has completed a RISC-V core with AES+SHA crypto extensions and is moving toward Google OpenMPW shuttles for actual silicon tape-out — the first decentralized path from hardware design competition to real chip production.",
  keywords: [
    "AI chip design",
    "Verilog competition",
    "RISC-V Bittensor",
    "ChipForge Tatsu Bittensor",
    "EDA automation",
    "open chip design platform",
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
  name: "⚒",
  category: "Distributed Compute",
  subnetType: "Agents",
  tagline: "Mine value from the decentralized intelligence layer",
  mainstream: "AWS Batch or Google Cloud Run",
  problem:
    "Executing autonomous computational workloads at scale requires expensive always-on infrastructure that is idle most of the time. Existing solutions force you to choose between over-provisioning capacity or suffering latency spikes when demand surges.",
  differentiator:
    "SN86 provides an agent-driven workload execution layer that scales dynamically with demand, drawing on the Bittensor miner network's collective capacity. Agents coordinate work distribution intelligently, ensuring high utilization without over-provisioning.",
  keywords: [
    "decentralized workload execution",
    "autonomous compute agents",
    "Bittensor agent subnet",
    "SN86 Bittensor",
    "elastic compute decentralized",
    "intelligent workload distribution",
  ],
},

{
  netuid: 87,
  slug: "luminar-network",
  name: "Luminar Network",
  category: "Decentralized Data",
  subnetType: "Data",
  tagline: "Illuminate your data with decentralized intelligence",
  mainstream: "Segment or mParticle",
  problem:
    "Customer data platforms are expensive, centralized systems that handle sensitive behavioral data on behalf of companies. When a data platform is breached or misuses data, thousands of companies' customers are affected without anyone knowing.",
  differentiator:
    "Luminar Network distributes customer data collection and enrichment across privacy-preserving miners, so no single point of failure can expose your users' data. The Bittensor incentive layer rewards miners for accurate, privacy-compliant data enrichment.",
  keywords: [
    "decentralized customer data",
    "privacy-first data platform",
    "Bittensor data subnet",
    "Luminar Network Bittensor",
    "CDP alternative blockchain",
    "privacy data enrichment",
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
  slug: "infinitehash",
  name: "InfiniteHash",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Infinite yield from finite compute, forever",
  mainstream: "Lido or Rocket Pool (liquid staking)",
  problem:
    "Staking and yield strategies in crypto require constant rebalancing across protocols to maximize returns, which is prohibitively time-consuming for individual investors. Yield aggregators exist but are controlled by small teams, creating smart contract risk and governance centralization.",
  differentiator:
    "InfiniteHash runs a decentralized yield optimization network where miners continuously evaluate and rebalance staking positions across protocols. The system is governed by TAO stakers rather than a small founding team, distributing both risk and governance power.",
  keywords: [
    "decentralized yield optimization",
    "crypto staking AI",
    "Bittensor finance subnet",
    "InfiniteHash Bittensor",
    "yield aggregator decentralized",
    "liquid staking optimization",
  ],
},

{
  netuid: 91,
  slug: "bitstarter-1",
  name: "Bitstarter",
  category: "Bittensor Startup Accelerator",
  subnetType: "Finance",
  tagline: "The first crowdfunding platform and accelerator for Bittensor subnet startups",
  mainstream: "Kickstarter, Y Combinator, or Indiegogo",
  problem:
    "New Bittensor subnet builders have no transparent, community-governed way to raise capital within the ecosystem. Traditional VC funding requires geography and connections. Kickstarter doesn't understand crypto. There was no on-chain fundraising mechanism designed for Bittensor projects.",
  differentiator:
    "Bitstarter (based in London, founded 2025) is the first crowdfunding and accelerator platform built natively for Bittensor. Projects raise capital from the TAO community via non-custodial smart contracts — funds are held on-chain and released only if the funding goal is met. Backers receive project tokens at pre-launch rates and funded projects get mentorship panel access.",
  keywords: [
    "Bittensor fundraising",
    "subnet startup accelerator",
    "Bitstarter Bittensor",
    "crypto crowdfunding",
    "TAO community investment",
    "decentralized startup funding",
  ],
},

{
  netuid: 92,
  slug: "tensorclaw",
  name: "TensorClaw",
  category: "Generative Media",
  subnetType: "Creative",
  tagline: "Grab the best generative AI output every time",
  mainstream: "Midjourney or Adobe Firefly",
  problem:
    "Generative AI for images and art requires significant prompt engineering skill and many generations to produce usable results. Creative professionals spend more time wrestling with prompts than actually creating, and the best outputs are locked to specific centralized platforms.",
  differentiator:
    "TensorClaw automatically refines prompts and routes generations to the best-performing model for each creative style, with miners competing to produce the highest-quality outputs. Users describe what they want in plain English and receive gallery-quality results without prompt engineering expertise.",
  keywords: [
    "AI image generation",
    "decentralized generative art",
    "Bittensor creative subnet",
    "TensorClaw Bittensor",
    "Midjourney alternative blockchain",
    "automated prompt optimization",
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
  name: "Bitsota",
  category: "Decentralized AI Training",
  subnetType: "Training",
  tagline: "State-of-the-art AI training, decentralized by default",
  mainstream: "Hugging Face or EleutherAI (open model training)",
  problem:
    "Keeping pace with the state of the art in AI requires rapid experimentation across different architectures, datasets, and training recipes. The cost of compute makes this iteration speed impossible for anyone outside the largest labs, creating an ever-widening capability gap.",
  differentiator:
    "Bitsota provides a shared experimental training infrastructure where researchers contribute ideas and the Bittensor network provides the compute, rewarding experiments that achieve new state-of-the-art results on public benchmarks. The best results are shared openly, making the entire field move faster.",
  keywords: [
    "state of the art AI training",
    "collaborative model training",
    "Bittensor training subnet",
    "Bitsota Bittensor",
    "open AI research compute",
    "decentralized AI research",
  ],
},

{
  netuid: 96,
  slug: "x",
  name: "X",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "The unknown variable that unlocks everything",
  mainstream: "Postman or RapidAPI",
  problem:
    "APIs are the connective tissue of the modern internet, but discovering, testing, and integrating them is still tedious and manual. Developers spend hours reading documentation and writing boilerplate integration code that an intelligent system should generate automatically.",
  differentiator:
    "X provides an AI-powered API intelligence layer that discovers, documents, and generates integration code for any API automatically. Miners compete to produce the most accurate API understanding, making it trivially easy to integrate any web service into any application.",
  keywords: [
    "AI API integration",
    "automatic API documentation",
    "Bittensor tools subnet",
    "X Bittensor subnet",
    "API intelligence platform",
    "developer integration tools",
  ],
},

{
  netuid: 97,
  slug: "constantinople",
  name: "Constantinople",
  category: "Distributed Compute",
  subnetType: "Compute",
  tagline: "The crossroads of decentralized compute power",
  mainstream: "Equinix Metal or Hetzner dedicated servers",
  problem:
    "Bare-metal compute for high-performance workloads is expensive and geographically limited. Dedicated server providers have long lead times, minimum commitments, and no elasticity — you pay for the machine whether you use it or not.",
  differentiator:
    "Constantinople acts as a global crossroads for bare-metal compute, connecting workloads to idle dedicated hardware through the Bittensor marketplace. Users get the performance of physical hardware with the flexibility of cloud pricing, paying only for what they actually consume.",
  keywords: [
    "bare metal compute marketplace",
    "decentralized dedicated servers",
    "Bittensor compute subnet",
    "Constantinople Bittensor",
    "physical server marketplace",
    "elastic bare metal compute",
  ],
},

{
  netuid: 98,
  slug: "forevermoney",
  name: "ForeverMoney",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Build wealth that outlasts everything",
  mainstream: "Vanguard or Fidelity (long-term investing)",
  problem:
    "Long-term wealth building requires consistent, disciplined investing over decades — but most platforms are optimized for active trading and short-term thinking. There is no investment platform designed specifically around permanence and generational wealth transfer.",
  differentiator:
    "ForeverMoney uses Bittensor miners to model multi-decade wealth scenarios and optimize for long-term preservation rather than short-term returns. Strategies are validated against historical data across full economic cycles, not just the last bull market.",
  keywords: [
    "long term wealth building",
    "generational wealth AI",
    "Bittensor finance subnet",
    "ForeverMoney Bittensor",
    "permanent portfolio AI",
    "decentralized wealth management",
  ],
},

{
  netuid: 99,
  slug: "leoma",
  name: "Leoma",
  category: "Generative Media",
  subnetType: "Creative",
  tagline: "Creative AI that thinks like an artist",
  mainstream: "Adobe Creative Cloud or Canva",
  problem:
    "AI creative tools are powerful but produce generic outputs that lack genuine artistic direction and aesthetic coherence. Professional designers spend more time correcting AI mistakes than the time they save, because the tools don't understand creative intent.",
  differentiator:
    "Leoma trains specialized creative models that understand aesthetic style, visual hierarchy, and brand coherence, with miners competing to produce genuinely beautiful and contextually appropriate outputs. It bridges the gap between raw AI generation and professional creative quality.",
  keywords: [
    "AI creative tools",
    "artistic AI generation",
    "Bittensor creative subnet",
    "Leoma Bittensor",
    "professional AI design",
    "aesthetic AI assistant",
  ],
},

{
  netuid: 100,
  slug: "platform",
  name: "Plaτform",
  category: "AI Research Platform",
  subnetType: "Tools",
  tagline: "Multi-challenge AI research platform using Intel TDX confidential computing",
  mainstream: "Azure Confidential Computing or AWS Nitro Enclaves",
  problem:
    "Running sensitive AI research workloads across multiple parallel challenges requires both privacy guarantees and trustless orchestration — a combination that neither centralized cloud nor existing decentralized platforms offered.",
  differentiator:
    "Plaτform was designed as a multi-challenge orchestration layer for parallel AI research tasks using Intel TDX confidential computing, ensuring sensitive workloads could run across untrusted nodes. Note: Plaτform became the first subnet to be deregistered under Bittensor's 4-month subnet pruning mechanism in late 2025, and the slot may have been reissued.",
  keywords: [
    "confidential computing AI",
    "Intel TDX",
    "multi-challenge orchestration",
    "Bittensor subnet",
    "Platform Bittensor",
    "AI research platform",
  ],
},

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
  slug: "voidai",
  name: "VoidAI",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Fill the void in your AI stack with intelligence",
  mainstream: "LlamaIndex or LangChain",
  problem:
    "AI application stacks have gaps — pieces of functionality that no existing tool handles well, forcing developers to write custom glue code that is fragile and hard to maintain. As AI capabilities evolve, this glue code becomes a technical debt liability.",
  differentiator:
    "VoidAI identifies and fills functional gaps in your AI stack with modular components that integrate seamlessly with your existing tools. The Bittensor miner network provides the compute for each module, and new modules are added as the community identifies unmet needs.",
  keywords: [
    "AI stack tooling",
    "AI application components",
    "Bittensor tools subnet",
    "VoidAI Bittensor",
    "modular AI infrastructure",
    "LangChain alternative",
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
  slug: "rich-kids-of-tao",
  name: "Rich Kids of TAO",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Elite DeFi strategies, now open to everyone",
  mainstream: "Tiger 21 or Family Office networks",
  problem:
    "The most sophisticated investment strategies — hedge fund allocations, private credit, structured products — are legally and practically accessible only to ultra-high-net-worth individuals. Retail investors are locked into a narrow set of products while the wealthy compound advantage indefinitely.",
  differentiator:
    "Rich Kids of TAO brings institutional-caliber DeFi strategies to any wallet size, using Bittensor miners to model and execute complex yield and growth strategies. The network's transparency ensures these strategies are verifiable, unlike the opaque structures available to family offices.",
  keywords: [
    "institutional DeFi strategies",
    "elite crypto investing",
    "Bittensor finance subnet",
    "Rich Kids of TAO Bittensor",
    "hedge fund DeFi",
    "decentralized wealth strategies",
  ],
},

{
  netuid: 111,
  slug: "oneoneone",
  name: "oneoneone",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "One tool to rule your entire AI stack",
  mainstream: "Retool or Appsmith (internal tools)",
  problem:
    "Building internal tools for AI operations requires pulling together data sources, model outputs, and human review workflows into a coherent interface. Most teams cobble together spreadsheets and scripts that become unmaintainable as complexity grows.",
  differentiator:
    "oneoneone provides a unified control plane for AI operations, letting teams build internal tools by connecting Bittensor-powered components visually. Miners contribute pre-built blocks for common AI tasks, so teams can assemble sophisticated workflows without custom code.",
  keywords: [
    "AI ops platform",
    "internal AI tools",
    "Bittensor tools subnet",
    "oneoneone Bittensor",
    "visual AI workflow builder",
    "Retool AI alternative",
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
  slug: "taolend",
  name: "TaoLend",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Lend and borrow TAO with decentralized confidence",
  mainstream: "Aave or Compound",
  problem:
    "Lending and borrowing in the Bittensor ecosystem has lacked a native protocol, forcing TAO holders to use generic DeFi platforms not optimized for TAO's unique tokenomics and staking dynamics. Interest rates on those platforms don't reflect TAO-specific risk factors.",
  differentiator:
    "TaoLend provides a lending protocol purpose-built for the TAO ecosystem, with interest rate models informed by Bittensor network data. Miners continuously update risk parameters based on real-time subnet performance, making rates more accurate and protocol risk more manageable.",
  keywords: [
    "TAO lending protocol",
    "Bittensor DeFi lending",
    "Bittensor finance subnet",
    "TaoLend Bittensor",
    "TAO borrowing",
    "decentralized lending TAO",
  ],
},

{
  netuid: 117,
  slug: "brainplay",
  name: "BrainPlay",
  category: "Generative Media",
  subnetType: "Creative",
  tagline: "Play your way through AI-generated worlds",
  mainstream: "Roblox or Unity (game development platforms)",
  problem:
    "Creating engaging game content — levels, characters, storylines, puzzles — requires enormous creative and technical resources that small studios and independent developers simply don't have. Most indie games suffer from content poverty because teams can make systems but not enough content to fill them.",
  differentiator:
    "BrainPlay uses AI miners to generate infinite, coherent game content on demand — levels that adapt to player skill, characters with consistent backstories, and narratives that branch meaningfully. The decentralized architecture means content generation scales without centralized infrastructure costs.",
  keywords: [
    "AI game content generation",
    "procedural game AI",
    "Bittensor creative subnet",
    "BrainPlay Bittensor",
    "AI game development",
    "generative game worlds",
  ],
},

{
  netuid: 118,
  slug: "hodl-etf",
  name: "HODL ETF",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Crypto index investing, decentralized and transparent",
  mainstream: "Bitwise or ProShares (crypto ETFs)",
  problem:
    "Crypto index products are controlled by centralized fund managers who charge high fees and make opaque rebalancing decisions. Investors have no way to verify that the fund actually holds what it claims, or that rebalancing decisions are made in their interest.",
  differentiator:
    "HODL ETF creates verifiable, on-chain crypto index products with rebalancing logic validated by Bittensor miners. Every portfolio decision is transparent and auditable, fees are a fraction of traditional ETF managers, and the index methodology can never be changed without community governance.",
  keywords: [
    "decentralized crypto ETF",
    "on-chain index fund",
    "Bittensor finance subnet",
    "HODL ETF Bittensor",
    "transparent crypto investing",
    "blockchain index product",
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
  slug: "bitrecs",
  name: "Bitrecs",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Recommendations that actually get it right",
  mainstream: "Recombee or AWS Personalize",
  problem:
    "Recommendation engines are expensive to build, require large amounts of data to work well, and often produce obvious suggestions that users already knew about. Small platforms can't afford the infrastructure and data science talent needed to compete with Netflix or Amazon on personalization.",
  differentiator:
    "Bitrecs provides a decentralized recommendation intelligence layer, with miners competing to build the most effective personalization models across diverse domains. Smaller platforms access recommendation quality comparable to tech giants without building any ML infrastructure.",
  keywords: [
    "decentralized recommendation engine",
    "AI personalization platform",
    "Bittensor tools subnet",
    "Bitrecs Bittensor",
    "recommendation AI decentralized",
    "personalization infrastructure",
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
];

/** Look up a TaoPageSubnet by URL slug */
export function getTaoPageBySlug(slug: string): TaoPageSubnet | undefined {
  return TAO_PAGES_SUBNETS.find((s) => s.slug === slug);
}

/** Ordered list of netuids for generateStaticParams */
export const TAO_PAGE_NETUIDS = TAO_PAGES_SUBNETS.map((s) => s.netuid);
