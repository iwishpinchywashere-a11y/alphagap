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
];

/** Look up a TaoPageSubnet by URL slug */
export function getTaoPageBySlug(slug: string): TaoPageSubnet | undefined {
  return TAO_PAGES_SUBNETS.find((s) => s.slug === slug);
}

/** Ordered list of netuids for generateStaticParams */
export const TAO_PAGE_NETUIDS = TAO_PAGES_SUBNETS.map((s) => s.netuid);
