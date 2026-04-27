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
      "The Targon Virtual Machine runs AI inside cryptographic enclaves — sealed environments where even the servers can't read your input. It has generated $10M+ in verifiable revenue and serves 4 million users, making it one of the most commercially validated subnets in the entire Bittensor ecosystem.",
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
      "Iota's pipeline-parallel architecture lets anyone with a GPU — including a standard home computer — contribute to large language model pretraining. They built a Mac app so even non-developers can join. It's the first truly permissionless distributed AI training network, with no gatekeepers deciding who can contribute.",
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
  category: "AI Inference",
  subnetType: "Inference",
  tagline: "The sharpest edge in decentralized AI inference",
  mainstream: "OpenAI API or Anthropic API",
  problem:
    "Centralized AI APIs are expensive, rate-limited, and controlled by a handful of companies. Developers building AI-powered products have no recourse when prices change overnight or access gets restricted. The cost of scaling inference can make entire business models unviable.",
  differentiator:
    "Apex harnesses Bittensor's competitive miner network to deliver fast, reliable AI inference at a fraction of centralized costs. Miners compete on speed and quality, driving prices down continuously while keeping service levels high.",
  keywords: [
    "decentralized AI inference",
    "cheap AI API",
    "Bittensor inference",
    "OpenAI alternative",
    "Apex Bittensor",
    "distributed LLM serving",
  ],
},

{
  netuid: 2,
  slug: "dsperse",
  name: "DSperse",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Spread your workloads, shrink your costs",
  mainstream: "Cloudflare Workers or AWS Step Functions",
  problem:
    "Distributing computational tasks across many nodes is notoriously hard to orchestrate. Developers waste weeks building custom job-dispatch infrastructure that breaks under load. There is no simple, decentralized way to fan out work and collect results reliably.",
  differentiator:
    "DSperse provides a decentralized task-dispatch layer where miners bid to process work units, and results are verified by the network before being returned. This means no single point of failure, automatic load balancing, and costs that scale down as more miners join.",
  keywords: [
    "decentralized task dispatch",
    "distributed computing tools",
    "Bittensor workload distribution",
    "DSperse Bittensor",
    "job queue decentralized",
    "parallel compute orchestration",
  ],
},

{
  netuid: 3,
  slug: "templar",
  name: "τemplar",
  category: "Decentralized AI Training",
  subnetType: "Training",
  tagline: "Train large models without a datacenter",
  mainstream: "Google TPU pods or Lambda Labs clusters",
  problem:
    "Training frontier AI models costs tens of millions of dollars and requires access to massive, coordinated GPU clusters that only the biggest tech companies own. Independent researchers and startups are locked out of training anything meaningful. The result is AI development concentrated in a tiny number of hands.",
  differentiator:
    "τemplar coordinates distributed training across thousands of volunteer GPU miners using gradient-sharing techniques. The Bittensor incentive layer pays miners in TAO for contributing honest gradients, making it economically viable to train large models without owning a single GPU server.",
  keywords: [
    "decentralized AI training",
    "distributed model training",
    "Bittensor training subnet",
    "templar Bittensor",
    "train LLM without GPU cluster",
    "federated AI training",
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
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "On-chain intelligence for smarter DeFi decisions",
  mainstream: "Messari or Dune Analytics",
  problem:
    "DeFi moves faster than any human analyst can track. Protocols change parameters, liquidity shifts between pools, and yield opportunities open and close within hours. Retail participants have no access to the kind of real-time intelligence that professional trading desks use.",
  differentiator:
    "Numinous deploys a network of miners that continuously monitor on-chain data, model risk, and surface actionable DeFi insights. Users get institutional-grade financial intelligence without paying for expensive data subscriptions or proprietary terminals.",
  keywords: [
    "DeFi analytics",
    "on-chain intelligence",
    "Bittensor finance subnet",
    "Numinous Bittensor",
    "decentralized financial data",
    "crypto yield optimization",
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
  category: "Decentralized Exchange",
  subnetType: "Finance",
  tagline: "The decentralized swap layer built for TAO",
  mainstream: "Uniswap or 1inch",
  problem:
    "Swapping TAO and Bittensor ecosystem tokens is fragmented across centralized exchanges with high fees, withdrawal limits, and KYC requirements. Decentralized alternatives for the Bittensor ecosystem are immature, leaving users with poor prices and high slippage.",
  differentiator:
    "Swap provides a native decentralized exchange layer tuned for the Bittensor ecosystem, with miners running automated market-making strategies to provide deep liquidity. TAO holders can swap assets without handing custody to a centralized party.",
  keywords: [
    "TAO decentralized exchange",
    "Bittensor DEX",
    "Swap Bittensor",
    "swap TAO tokens",
    "decentralized crypto swap",
    "TAO liquidity",
  ],
},

{
  netuid: 11,
  slug: "trajectoryrl",
  name: "TrajectoryRL",
  category: "Generative Media",
  subnetType: "Creative",
  tagline: "Reinforcement learning that generates stunning motion",
  mainstream: "Runway Gen-2 or Pika Labs",
  problem:
    "Generating realistic motion for characters and objects in video or game environments is one of the hardest problems in AI. Physics-based animation requires enormous compute and specialized expertise, keeping it out of reach for indie studios and creators.",
  differentiator:
    "TrajectoryRL trains reinforcement learning policies that produce physically plausible motion trajectories, then renders them into usable animations. By distributing training across Bittensor miners, it democratizes high-quality motion generation for anyone who can write a prompt.",
  keywords: [
    "AI motion generation",
    "reinforcement learning animation",
    "Bittensor creative subnet",
    "TrajectoryRL Bittensor",
    "AI video motion",
    "physics animation AI",
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
  tagline: "Every dataset you need, sourced by the crowd",
  mainstream: "Hugging Face Datasets or Scale AI",
  problem:
    "High-quality training data is the bottleneck for AI development, yet gathering and labeling it costs millions of dollars and months of time. Data brokers charge exorbitant fees for datasets that are often stale, biased, or poorly curated. Small AI teams simply cannot afford competitive data pipelines.",
  differentiator:
    "Data Universe incentivizes a global network of miners to continuously scrape, clean, and contribute diverse datasets. The Bittensor validation layer scores data quality automatically, so contributors are paid only for genuinely useful information.",
  keywords: [
    "decentralized AI datasets",
    "crowdsourced training data",
    "Bittensor data subnet",
    "Data Universe Bittensor",
    "AI data marketplace",
    "open dataset network",
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
  slug: "oro",
  name: "ORO",
  category: "AI Agents",
  subnetType: "Agents",
  tagline: "Orchestrate real-world tasks with AI precision",
  mainstream: "Zapier AI or Make.com",
  problem:
    "Automating multi-step real-world tasks — booking, researching, filing, ordering — requires AI agents that can reliably navigate websites, APIs, and documents without constant human correction. Current automation tools break at the first unexpected screen or API change.",
  differentiator:
    "ORO deploys a fleet of resilient agents that handle real-world task orchestration end-to-end, with miners competing to produce the most successful task completions. Failed subtasks are automatically retried by different miners, making the system far more robust than any single agent.",
  keywords: [
    "AI task orchestration",
    "autonomous agents real world",
    "Bittensor agent subnet",
    "ORO Bittensor",
    "AI automation platform",
    "multi-step AI agents",
  ],
},

{
  netuid: 16,
  slug: "bitads",
  name: "BitAds",
  category: "Decentralized Advertising",
  subnetType: "Tools",
  tagline: "Ad intelligence without the Big Tech middleman",
  mainstream: "Google Ads or The Trade Desk",
  problem:
    "Online advertising is dominated by Google and Meta, who take massive cuts while providing limited transparency into how ads are targeted and measured. Advertisers have no way to independently verify impressions or click quality, and publishers receive only a fraction of what advertisers pay.",
  differentiator:
    "BitAds uses Bittensor miners to run transparent ad-matching and verification, connecting advertisers directly to publishers with on-chain proof of delivery. This eliminates the opaque middleman markup and gives both sides verifiable data about campaign performance.",
  keywords: [
    "decentralized advertising",
    "transparent ad network",
    "Bittensor ads subnet",
    "BitAds Bittensor",
    "Google Ads alternative",
    "on-chain ad verification",
  ],
},

{
  netuid: 18,
  slug: "zeus",
  name: "Zeus",
  category: "Scientific Computing",
  subnetType: "Science",
  tagline: "Scientific compute at the scale of a thunderbolt",
  mainstream: "Folding@home or BOINC",
  problem:
    "Scientific simulations — from protein folding to climate modeling — require supercomputer-scale resources that most research institutions cannot afford. Grant funding for compute is slow and competitive, often blocking important research for years.",
  differentiator:
    "Zeus coordinates high-performance scientific compute across Bittensor's global miner network, with validators checking simulation integrity. Researchers submit jobs and pay in TAO, while miners earn by running verified scientific workloads on their hardware.",
  keywords: [
    "decentralized scientific computing",
    "distributed HPC",
    "Bittensor science subnet",
    "Zeus Bittensor",
    "protein folding decentralized",
    "research compute marketplace",
  ],
},

{
  netuid: 19,
  slug: "blockmachine",
  name: "blockmachine",
  category: "AI Inference",
  subnetType: "Inference",
  tagline: "Block-by-block inference, fast and unstoppable",
  mainstream: "Together AI or Replicate",
  problem:
    "Running inference on large language models requires significant GPU memory and bandwidth, making it expensive to serve users at scale. Centralized inference providers introduce single points of failure and can cut off access at any time.",
  differentiator:
    "blockmachine distributes inference requests across its miner network in discrete blocks, allowing parallel processing that dramatically reduces latency. The decentralized architecture means no single outage can take the service down.",
  keywords: [
    "decentralized LLM inference",
    "fast AI inference",
    "Bittensor inference subnet",
    "blockmachine Bittensor",
    "distributed inference network",
    "reliable AI API",
  ],
},

{
  netuid: 20,
  slug: "groundlayer",
  name: "GroundLayer",
  category: "AI Agents",
  subnetType: "Agents",
  tagline: "The foundation layer for AI agent infrastructure",
  mainstream: "LangChain or CrewAI",
  problem:
    "Building production AI agents requires stitching together a dozen different libraries, APIs, and hosting services, none of which talk to each other cleanly. Most agent frameworks are research-grade and collapse under real-world load or complexity.",
  differentiator:
    "GroundLayer provides a unified substrate for deploying, coordinating, and monitoring AI agents at scale. Miners contribute agent runtime capacity, and the Bittensor incentive layer rewards agents that successfully complete tasks with measurable outcomes.",
  keywords: [
    "AI agent infrastructure",
    "agent deployment platform",
    "Bittensor agent subnet",
    "GroundLayer Bittensor",
    "LangChain alternative",
    "production AI agents",
  ],
},

{
  netuid: 21,
  slug: "adtao",
  name: "AdTAO",
  category: "AI Agents",
  subnetType: "Agents",
  tagline: "Autonomous agents that run your ad campaigns",
  mainstream: "Google Performance Max or Meta Advantage+",
  problem:
    "Running effective digital ad campaigns requires constant monitoring, bid adjustments, and creative testing — work that agencies charge thousands of dollars a month to perform. Small businesses simply cannot afford professional ad management and their campaigns underperform as a result.",
  differentiator:
    "AdTAO deploys autonomous agents that manage ad campaigns end-to-end, from creative generation to bid optimization, with miners competing to deliver the best return on ad spend. The system learns from performance data continuously, improving without any human intervention.",
  keywords: [
    "autonomous ad management",
    "AI ad optimization",
    "Bittensor ad agents",
    "AdTAO Bittensor",
    "automated ad campaigns",
    "AI marketing agents",
  ],
},

{
  netuid: 22,
  slug: "desearch",
  name: "Desearch",
  category: "Decentralized Search",
  subnetType: "Inference",
  tagline: "Search the web without the filter bubble",
  mainstream: "Google Search or Brave Search",
  problem:
    "Web search is controlled by a small number of companies that rank results based on advertising relationships and opaque algorithms. Users have no way to know if results are being filtered, promoted, or suppressed. Privacy is also a constant concern with centralized search logging every query.",
  differentiator:
    "Desearch distributes web crawling and indexing across a global miner network, then uses Bittensor's consensus mechanism to rank results by collective relevance rather than ad revenue. Queries are never tied to an identity, giving users genuinely private, unfiltered search.",
  keywords: [
    "decentralized web search",
    "private search engine",
    "Bittensor search subnet",
    "Desearch Bittensor",
    "Google alternative blockchain",
    "censorship-resistant search",
  ],
},

{
  netuid: 23,
  slug: "trishool",
  name: "Trishool",
  category: "Decentralized Data",
  subnetType: "Data",
  tagline: "Three-pronged data intelligence for the open web",
  mainstream: "Clearbit or ZoomInfo",
  problem:
    "Business intelligence data is expensive, siloed, and often outdated by the time it reaches users. Companies pay thousands of dollars per month for access to data that was collected and enriched by opaque third parties. There is no open, verifiable source of truth for business and web data.",
  differentiator:
    "Trishool uses a three-tier miner architecture — collectors, enrichers, and validators — to produce continuously fresh business and web data. Every data point has a verifiable provenance trail, so users know exactly where information came from and how recently it was confirmed.",
  keywords: [
    "decentralized business data",
    "web intelligence network",
    "Bittensor data subnet",
    "Trishool Bittensor",
    "open data marketplace",
    "verifiable business intelligence",
  ],
},

{
  netuid: 24,
  slug: "quasar",
  name: "Quasar",
  category: "AI Inference",
  subnetType: "Inference",
  tagline: "Blazing inference from the edges of the network",
  mainstream: "Groq or Fireworks AI",
  problem:
    "Low-latency AI inference requires specialized hardware and geographic distribution that is prohibitively expensive to build independently. Most inference providers have data centers in only a few regions, resulting in high latency for users far from those hubs.",
  differentiator:
    "Quasar places inference nodes at the network edge worldwide, dramatically reducing round-trip times for users in every region. Miners with fast hardware and good connectivity earn the most TAO, creating a natural pressure toward distributed, high-performance inference.",
  keywords: [
    "edge AI inference",
    "low latency LLM",
    "Bittensor inference subnet",
    "Quasar Bittensor",
    "fast AI API",
    "global inference network",
  ],
},

{
  netuid: 25,
  slug: "mainframe",
  name: "Mainframe",
  category: "Scientific Computing",
  subnetType: "Science",
  tagline: "Mainframe-scale science on decentralized rails",
  mainstream: "AWS HPC or XSEDE supercomputing",
  problem:
    "Legacy supercomputing allocations are rationed through bureaucratic grant processes that can take a year or more to navigate. By the time compute is granted, research priorities may have shifted. Startups and independent researchers are effectively excluded from supercomputer-class work.",
  differentiator:
    "Mainframe aggregates idle high-performance computing resources into a decentralized supercomputing pool, accessible in minutes rather than months. Validators verify scientific integrity of workloads, ensuring miners are running real science rather than gaming the reward system.",
  keywords: [
    "decentralized supercomputing",
    "HPC on blockchain",
    "Bittensor science subnet",
    "Mainframe Bittensor",
    "scientific compute decentralized",
    "distributed research computing",
  ],
},

{
  netuid: 26,
  slug: "kinitro",
  name: "Kinitro",
  category: "Decentralized Storage",
  subnetType: "Storage",
  tagline: "Store anything, lose nothing, pay less",
  mainstream: "Filecoin or Arweave",
  problem:
    "Centralized cloud storage gives a handful of companies control over your data, with no guarantee of permanence or privacy. Existing decentralized storage solutions are technically complex to use and often slower than their centralized counterparts.",
  differentiator:
    "Kinitro combines the economic incentives of Bittensor with a user-friendly storage interface, making decentralized permanent storage as easy as uploading a file to Dropbox. Miners are penalized by the network for any data loss, creating strong guarantees of long-term availability.",
  keywords: [
    "decentralized storage",
    "permanent file storage",
    "Bittensor storage subnet",
    "Kinitro Bittensor",
    "Filecoin alternative",
    "censorship-resistant storage",
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
  slug: "coldint",
  name: "Coldint",
  category: "Decentralized AI Training",
  subnetType: "Training",
  tagline: "Cold-start training, hot results",
  mainstream: "Hugging Face AutoTrain or Lightning AI",
  problem:
    "Training specialized AI models from scratch is expensive and slow, discouraging experimentation. Most teams end up fine-tuning the same few public models rather than developing truly novel architectures because the cost of training from zero is prohibitive.",
  differentiator:
    "Coldint specializes in efficiently bootstrapping training runs from cold starts, using Bittensor's miner network to parallelize the most compute-intensive early phases. This dramatically cuts the cost and time of training new models, making from-scratch training economically viable again.",
  keywords: [
    "decentralized model training",
    "cold start AI training",
    "Bittensor training subnet",
    "Coldint Bittensor",
    "distributed deep learning",
    "train AI models cheap",
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
  name: "ItsAI",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "AI tooling that just works, out of the box",
  mainstream: "GitHub Copilot or Cursor",
  problem:
    "AI developer tools require constant configuration, model selection, and API key management that distracts developers from actual coding. Most AI coding assistants are tied to a single provider's models, limiting quality and availability.",
  differentiator:
    "ItsAI provides a unified developer tooling layer backed by Bittensor's decentralized inference network, automatically routing requests to the best-performing model at any given moment. Developers get a single integration point that improves over time as the miner ecosystem grows.",
  keywords: [
    "AI developer tools",
    "decentralized coding assistant",
    "Bittensor developer subnet",
    "ItsAI Bittensor",
    "GitHub Copilot alternative",
    "AI code completion",
  ],
},

{
  netuid: 33,
  slug: "readyai",
  name: "ReadyAI",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Production-ready AI, deployed in minutes",
  mainstream: "Vercel AI SDK or Modal",
  problem:
    "Getting an AI application from prototype to production involves a daunting checklist of infrastructure work: model hosting, scaling, monitoring, rate limiting, and fallback handling. Most startups spend more time on infrastructure than on their core product.",
  differentiator:
    "ReadyAI provides an opinionated, batteries-included deployment platform for AI applications, with all infrastructure concerns handled by the Bittensor miner network. Developers push code and ReadyAI handles scaling, failover, and cost optimization automatically.",
  keywords: [
    "AI deployment platform",
    "production AI infrastructure",
    "Bittensor tools subnet",
    "ReadyAI Bittensor",
    "deploy AI app fast",
    "AI app hosting",
  ],
},

{
  netuid: 34,
  slug: "bitmind",
  name: "BitMind",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Detect AI-generated content with certainty",
  mainstream: "GPTZero or Originality.ai",
  problem:
    "As AI-generated text and images flood the internet, distinguishing real from synthetic content is increasingly critical for journalism, academic integrity, and trust online. Existing detectors are unreliable, easily fooled, and cannot keep pace with rapidly improving generators.",
  differentiator:
    "BitMind trains a continuously updating ensemble of detection models across its miner network, staying ahead of the latest generative AI advances. Each time a new generation model is released, BitMind miners fine-tune their detectors to catch its outputs, making the network self-improving by design.",
  keywords: [
    "AI content detection",
    "deepfake detector",
    "Bittensor tools subnet",
    "BitMind Bittensor",
    "AI generated text detection",
    "synthetic media detection",
  ],
},

{
  netuid: 35,
  slug: "cartha",
  name: "Cartha",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Chart a smarter course through crypto markets",
  mainstream: "TradingView or CoinGecko",
  problem:
    "Retail crypto investors make decisions based on the same public charts and social media noise as everyone else, with no edge. Professional trading firms have access to proprietary data, quant models, and real-time analytics that give them a permanent structural advantage.",
  differentiator:
    "Cartha coordinates a miner network that continuously generates, back-tests, and improves quantitative market models for crypto assets. Users access institutional-quality analytics and signals at a fraction of the cost of Bloomberg or proprietary research services.",
  keywords: [
    "crypto market analytics",
    "quantitative trading signals",
    "Bittensor finance subnet",
    "Cartha Bittensor",
    "decentralized market intelligence",
    "crypto trading AI",
  ],
},

{
  netuid: 36,
  slug: "web-agents-autoppia",
  name: "Web Agents - Autoppia",
  category: "AI Agents",
  subnetType: "Agents",
  tagline: "Automate any website without writing a line of code",
  mainstream: "Playwright or Selenium (for developers), Zapier (for non-devs)",
  problem:
    "Automating interactions with websites — filling forms, extracting data, navigating flows — requires technical expertise that most business users lack. Browser automation tools break every time a website updates its layout, requiring constant developer maintenance.",
  differentiator:
    "Web Agents - Autoppia deploys AI agents that understand web interfaces visually and semantically, automatically adapting when pages change. Miners compete to execute web tasks successfully, with the network rewarding agents that complete real browser interactions reliably.",
  keywords: [
    "web automation AI",
    "browser agent AI",
    "Bittensor web agents",
    "Autoppia Bittensor",
    "no-code web scraping",
    "AI browser automation",
  ],
},

{
  netuid: 37,
  slug: "aurelius",
  name: "Aurelius",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Wisdom-driven tooling for the modern builder",
  mainstream: "Linear or Notion AI",
  problem:
    "Software development teams lose enormous time to fragmented tooling — project management in one app, documentation in another, code review in a third — with no intelligence connecting them. Each tool operates in its own silo, duplicating work and missing insights that span the whole stack.",
  differentiator:
    "Aurelius acts as an intelligent connective tissue across your development stack, using Bittensor miners to analyze signals across tools and surface recommendations. It learns your team's patterns over time and proactively flags risks, bottlenecks, and opportunities.",
  keywords: [
    "AI developer productivity",
    "intelligent project management",
    "Bittensor tools subnet",
    "Aurelius Bittensor",
    "dev workflow AI",
    "software team intelligence",
  ],
},

{
  netuid: 38,
  slug: "colosseum",
  name: "colosseum",
  category: "Decentralized AI Training",
  subnetType: "Training",
  tagline: "Where AI models compete to become the strongest",
  mainstream: "Hugging Face Model Hub or MLflow",
  problem:
    "Evaluating which AI model is truly best for a given task requires expensive, time-consuming benchmarking that few teams have resources for. Model leaderboards are often gamed or based on narrow benchmarks that don't reflect real-world performance.",
  differentiator:
    "colosseum runs continuous model tournaments where miners submit models that compete head-to-head on real tasks. The Bittensor incentive layer rewards models that win honestly, creating a credible, continuously updated ranking of model quality across tasks.",
  keywords: [
    "AI model competition",
    "model evaluation decentralized",
    "Bittensor training subnet",
    "colosseum Bittensor",
    "AI model benchmarking",
    "model tournament network",
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
  slug: "almanac",
  name: "Almanac",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Financial forecasting with the wisdom of the crowd",
  mainstream: "Bloomberg Terminal or FactSet",
  problem:
    "Financial forecasting relies on expensive proprietary data and closed models that only institutional investors can access. Retail investors make decisions with a fraction of the information available to professionals, consistently putting them at a disadvantage.",
  differentiator:
    "Almanac aggregates financial predictions from a diverse network of miners using different models and data sources, then combines them into calibrated ensemble forecasts. Users get democratized access to institutional-grade predictions without the six-figure terminal subscription.",
  keywords: [
    "financial forecasting AI",
    "decentralized market predictions",
    "Bittensor finance subnet",
    "Almanac Bittensor",
    "crowd wisdom investing",
    "Bloomberg alternative decentralized",
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
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Synthesize market truth from a thousand signals",
  mainstream: "Numerai or Quandl",
  problem:
    "Financial signal generation requires combining dozens of noisy data sources in ways that are statistically sound and not already priced in by the market. Individual quants or small funds lack the resources to process all available data and discover genuinely novel signals.",
  differentiator:
    "Synth coordinates a diverse network of miners that each generate and test financial signals from different data sources and methodologies. The ensemble approach — combining uncorrelated signals from many miners — produces more robust and durable market edge than any single model.",
  keywords: [
    "financial signal generation",
    "quant trading AI",
    "Bittensor finance subnet",
    "Synth Bittensor",
    "decentralized quant research",
    "alpha signal network",
  ],
},

{
  netuid: 52,
  slug: "dojo",
  name: "Dojo",
  category: "Decentralized Data",
  subnetType: "Data",
  tagline: "Train harder, train smarter, train together",
  mainstream: "Scale AI or Labelbox",
  problem:
    "High-quality AI training data requires human intelligence to label, rank, and verify — work that is expensive to commission and slow to scale. Data labeling platforms charge per-task fees that add up quickly, and quality is inconsistent across contractors.",
  differentiator:
    "Dojo builds a decentralized network of human contributors who label and rank AI training data, with Bittensor rewards ensuring honest participation. Sophisticated quality-control mechanisms catch low-effort contributions automatically, maintaining dataset quality without expensive manual review.",
  keywords: [
    "decentralized data labeling",
    "human feedback AI",
    "Bittensor data subnet",
    "Dojo Bittensor",
    "RLHF data collection",
    "crowdsourced AI labels",
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
  category: "Decentralized Data",
  subnetType: "Data",
  tagline: "Multi-modal identity intelligence on demand",
  mainstream: "Clearbit Enrichment or Twilio Lookup",
  problem:
    "Verifying and enriching identity information across multiple data types — text, image, document — is fragmented across specialized providers that each handle only one modality. Combining them requires custom integrations and exponential costs.",
  differentiator:
    "Yanez MIID provides unified multi-modal identity data enrichment, coordinating miners that specialize in different data types to produce comprehensive identity profiles in a single API call. The decentralized architecture keeps costs low while maintaining coverage across jurisdictions.",
  keywords: [
    "multi-modal identity data",
    "identity enrichment AI",
    "Bittensor data subnet",
    "Yanez MIID Bittensor",
    "decentralized identity verification",
    "identity intelligence API",
  ],
},

{
  netuid: 55,
  slug: "niome",
  name: "NIOME",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "New income opportunities, on-chain and open",
  mainstream: "Compound or Aave (yield protocols)",
  problem:
    "DeFi yield opportunities are complex to find and evaluate, with risks ranging from smart contract bugs to liquidity crises. Retail participants chasing yield often end up in protocols they don't understand, losing capital when things go wrong.",
  differentiator:
    "NIOME uses Bittensor miners to continuously monitor, score, and rank DeFi yield opportunities by risk-adjusted return. Users get clear, plain-English summaries of opportunities and risks, making yield farming accessible without requiring a deep technical background.",
  keywords: [
    "DeFi yield optimization",
    "decentralized income",
    "Bittensor finance subnet",
    "NIOME Bittensor",
    "yield farming AI",
    "risk-adjusted crypto yield",
  ],
},

{
  netuid: 57,
  slug: "sparket-ai",
  name: "Sparket.AI",
  category: "Decentralized Data",
  subnetType: "Data",
  tagline: "Sports market intelligence, powered by AI",
  mainstream: "SportsLine or Action Network",
  problem:
    "Sports betting markets are increasingly efficient, with sharp bettors and algorithmic traders quickly arbitraging away any public edge. Retail bettors have no access to the sophisticated modeling and data pipelines that professional handicappers use.",
  differentiator:
    "Sparket.AI coordinates miners that build and test sports prediction models across every major league, continuously updating with new game data. The network surfaces genuine market inefficiencies before they close, giving users a data-driven edge that is not available through any single commercial provider.",
  keywords: [
    "sports betting AI",
    "sports prediction models",
    "Bittensor data subnet",
    "Sparket AI Bittensor",
    "sports market intelligence",
    "decentralized sports analytics",
  ],
},

{
  netuid: 58,
  slug: "handshake",
  name: "Handshake",
  category: "AI Agents",
  subnetType: "Agents",
  tagline: "Autonomous agents that close deals for you",
  mainstream: "Salesforce Einstein or HubSpot AI",
  problem:
    "Sales outreach and negotiation require personalization at scale — crafting the right message for each prospect at the right time — which is impossible for humans to do manually across thousands of contacts. Generic automation produces generic results.",
  differentiator:
    "Handshake deploys autonomous sales agents that research prospects, craft personalized outreach, and manage follow-up sequences independently. Miners compete to build the most effective outreach strategies, continuously improving conversion rates through real-world performance data.",
  keywords: [
    "AI sales agents",
    "autonomous sales automation",
    "Bittensor agent subnet",
    "Handshake Bittensor",
    "AI outreach tool",
    "sales AI decentralized",
  ],
},

{
  netuid: 59,
  slug: "babelbit",
  name: "Babelbit",
  category: "AI Inference",
  subnetType: "Inference",
  tagline: "Break language barriers at the speed of thought",
  mainstream: "DeepL or Google Translate",
  problem:
    "High-quality machine translation is expensive at scale, and existing services suffer from privacy concerns because every document you translate passes through a third-party server. For sensitive business or legal content, this is an unacceptable risk.",
  differentiator:
    "Babelbit provides decentralized translation inference with configurable privacy levels, routing sensitive content to verified private miners. The competitive miner network continuously improves translation quality across language pairs, especially for underserved languages.",
  keywords: [
    "decentralized translation AI",
    "private machine translation",
    "Bittensor inference subnet",
    "Babelbit Bittensor",
    "multilingual AI API",
    "DeepL alternative blockchain",
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
  slug: "alphacore",
  name: "AlphaCore",
  category: "AI Agents",
  subnetType: "Agents",
  tagline: "The core intelligence powering next-gen AI agents",
  mainstream: "OpenAI Assistants API or Anthropic Claude API",
  problem:
    "Building sophisticated AI agents requires a reliable, high-quality reasoning backbone that can handle long context, tool use, and multi-step planning without hallucinating. Current models are inconsistent in agentic settings, causing costly failures in automated pipelines.",
  differentiator:
    "AlphaCore provides a specialized agent reasoning layer optimized specifically for autonomous task execution, backed by fine-tuned models served across the Bittensor miner network. The competitive validation ensures only the highest-quality reasoning models earn rewards.",
  keywords: [
    "AI agent reasoning",
    "agentic AI infrastructure",
    "Bittensor agent subnet",
    "AlphaCore Bittensor",
    "autonomous AI backbone",
    "agent intelligence layer",
  ],
},

{
  netuid: 67,
  slug: "harnyx",
  name: "Harnyx",
  category: "Decentralized Finance",
  subnetType: "Finance",
  tagline: "Harness market forces for decentralized profit",
  mainstream: "Robinhood or eToro",
  problem:
    "Retail investors lack the tools and data to compete with algorithmic trading firms that execute thousands of trades per second using proprietary strategies. The financial information asymmetry between retail and institutional participants grows wider every year.",
  differentiator:
    "Harnyx democratizes algorithmic trading strategies by running a decentralized strategy marketplace where miners contribute and validate trading algorithms. Verified strategies are made available to all participants, leveling the playing field between retail and institutional capital.",
  keywords: [
    "decentralized trading strategies",
    "algorithmic trading AI",
    "Bittensor finance subnet",
    "Harnyx Bittensor",
    "retail trading intelligence",
    "crypto strategy marketplace",
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
  category: "Scientific Computing",
  subnetType: "Science",
  tagline: "Forge the chips of tomorrow, today",
  mainstream: "Cadence Design Systems or Synopsys",
  problem:
    "Chip design is one of the most expensive and specialized engineering endeavors in existence, with EDA (electronic design automation) software licenses costing hundreds of thousands of dollars. Only the largest semiconductor companies can afford to design custom chips.",
  differentiator:
    "ChipForge uses AI across the Bittensor network to automate the most time-consuming parts of chip design — synthesis, placement, and routing — at a fraction of traditional EDA tool costs. This opens custom silicon design to startups and research labs that were previously priced out entirely.",
  keywords: [
    "AI chip design",
    "decentralized EDA tools",
    "Bittensor science subnet",
    "ChipForge Tatsu Bittensor",
    "semiconductor design AI",
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
  name: "Bitstarter #1",
  category: "Developer Tools",
  subnetType: "Tools",
  tagline: "Launch your project with decentralized momentum",
  mainstream: "Product Hunt or Kickstarter",
  problem:
    "Launching a new project in the crypto and AI space requires simultaneously building a community, attracting capital, and proving technical credibility — each of which is a full-time job on its own. Most promising projects fail at launch not because of technical quality but because they can't coordinate attention.",
  differentiator:
    "Bitstarter #1 provides a decentralized launchpad that coordinates community building, due diligence, and capital formation through Bittensor's incentive layer. Miners are rewarded for identifying and promoting genuinely high-quality projects, creating credible signal in a noisy market.",
  keywords: [
    "decentralized project launchpad",
    "crypto crowdfunding",
    "Bittensor tools subnet",
    "Bitstarter Bittensor",
    "blockchain project launch",
    "decentralized fundraising",
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
  category: "AI Agents",
  subnetType: "Agents",
  tagline: "The platform where AI agents build the future",
  mainstream: "Salesforce Platform or ServiceNow",
  problem:
    "Enterprise workflow automation requires expensive platform licenses and armies of consultants to implement. The biggest platforms charge per user, per workflow, and per integration — costs that compound rapidly and lock companies into proprietary ecosystems.",
  differentiator:
    "Plaτform provides an open, decentralized workflow automation platform powered by Bittensor agents, where any workflow can be built and run without per-seat licensing. Miners compete to execute workflows reliably, and the best automation patterns are shared across the community.",
  keywords: [
    "decentralized workflow automation",
    "enterprise AI platform",
    "Bittensor agent subnet",
    "Platform Bittensor",
    "no-code AI workflows",
    "Salesforce alternative blockchain",
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
