/**
 * Plain-English descriptions + real-world business analogies for Bittensor subnets.
 * Written for people who've never heard of Bittensor — no jargon, just the idea.
 *
 * Format: { blurb: "what it does in 1-2 plain sentences", analogy: "Think: [familiar business]" }
 */
export const SUBNET_PLAIN_ENGLISH: Record<number, { blurb: string; analogy: string }> = {
  1: {
    blurb: "A network of AI models that answer questions and generate text, all competing to give the best response.",
    analogy: "Think: a decentralized ChatGPT where thousands of computers share the work.",
  },
  2: {
    blurb: "Runs AI models fast and cheaply by spreading the compute across thousands of machines worldwide.",
    analogy: "Think: AWS cloud computing, but no Amazon — anyone can plug in and get paid.",
  },
  3: {
    blurb: "Trains large AI language models from scratch, using a global network of GPUs working in sync.",
    analogy: "Think: Google's model training division, but open and distributed.",
  },
  4: {
    blurb: "Routes AI requests to the best available model in real time, like a smart matchmaker for AI.",
    analogy: "Think: a broker that finds you the fastest, cheapest AI for every job.",
  },
  5: {
    blurb: "Builds high-quality datasets to train AI — miners earn rewards by contributing useful data.",
    analogy: "Think: a data factory feeding raw materials to the AI industry.",
  },
  7: {
    blurb: "Powers AI assistants and automation workflows that run 24/7 without a central server.",
    analogy: "Think: Zapier meets ChatGPT — automated AI pipelines that anyone can build.",
  },
  8: {
    blurb: "Forecasts financial markets using AI models trained on price data and on-chain signals.",
    analogy: "Think: a quant hedge fund's research desk — but open to everyone.",
  },
  9: {
    blurb: "Pre-trains foundation AI models — the huge first step before fine-tuning for specific tasks.",
    analogy: "Think: building the engine block before anyone puts the car together.",
  },
  10: {
    blurb: "Decentralized lending and yield optimization — earn interest on crypto without any bank in the middle.",
    analogy: "Think: Aave or Compound, built natively on Bittensor.",
  },
  11: {
    blurb: "AI-powered roleplay and companion experiences — interactive characters that remember and respond.",
    analogy: "Think: Character.AI, but running on a decentralized network.",
  },
  13: {
    blurb: "Continuously scrapes and indexes the internet to build massive datasets for AI training.",
    analogy: "Think: Google's web crawlers, monetized and open to anyone who contributes.",
  },
  14: {
    blurb: "Proof-of-work mining that produces useful AI compute instead of just burning electricity.",
    analogy: "Think: Bitcoin mining that actually builds something useful.",
  },
  16: {
    blurb: "A decentralized ad network where users get paid for their attention instead of the platform keeping all the money.",
    analogy: "Think: Google Ads, but the revenue flows to the users who see the ads.",
  },
  18: {
    blurb: "Generates lifelike AI voices and audio using a network of competing text-to-speech models.",
    analogy: "Think: ElevenLabs voice cloning, but open and decentralized.",
  },
  19: {
    blurb: "Fast, low-cost AI inference — runs your AI queries across thousands of distributed GPUs.",
    analogy: "Think: an AI supercomputer made from ordinary people's gaming PCs.",
  },
  22: {
    blurb: "AI-powered search that understands questions and gives real answers, not just links.",
    analogy: "Think: Perplexity AI, built on Bittensor instead of a startup.",
  },
  23: {
    blurb: "Generates images from text descriptions using a network of image AI models competing for quality.",
    analogy: "Think: Midjourney or DALL-E, but running on a decentralized network.",
  },
  25: {
    blurb: "Applies AI to scientific problems — protein folding, drug discovery, molecular simulation.",
    analogy: "Think: DeepMind's AlphaFold research, but open and globally distributed.",
  },
  26: {
    blurb: "Fine-tunes existing AI models to be better at specific tasks — like specialized training for AI.",
    analogy: "Think: a gym that makes AI models stronger for your specific job.",
  },
  32: {
    blurb: "Detects whether a piece of text was written by a human or an AI model.",
    analogy: "Think: Turnitin for the AI age — schools and publishers pay for this.",
  },
  36: {
    blurb: "AI web agents that browse websites, fill forms, and complete online tasks automatically.",
    analogy: "Think: Devin or OpenAI's Operator — an AI that uses the internet for you.",
  },
  37: {
    blurb: "Financial market prediction using AI — generates trading signals from price patterns and news.",
    analogy: "Think: Bloomberg Terminal crossed with a machine learning trading desk.",
  },
  39: {
    blurb: "Decentralized data storage that splits your files across many machines for reliability.",
    analogy: "Think: AWS S3 or Dropbox, but no central company can shut it down.",
  },
  41: {
    blurb: "AI-powered prediction markets where you bet on real-world outcomes and the AI helps set odds.",
    analogy: "Think: Polymarket meets machine learning — smarter odds, fairer payouts.",
  },
  44: {
    blurb: "Uses computer vision to track player movements and analyze sports performance in real time.",
    analogy: "Think: the tracking tech behind NBA player stats and NFL Next Gen Stats.",
  },
  51: {
    blurb: "A marketplace for renting GPU compute power — anyone with a gaming PC can earn by contributing.",
    analogy: "Think: Airbnb for computer hardware — idle GPUs become income.",
  },
  56: {
    blurb: "Trains and fine-tunes AI models at scale using distributed hardware and gradient sharing.",
    analogy: "Think: a massive distributed ML pipeline, like running thousands of Colab notebooks at once.",
  },
  59: {
    blurb: "AI-powered translation across 100+ languages with real-time accuracy scoring.",
    analogy: "Think: Google Translate, but built on a network of competing AI translators.",
  },
  64: {
    blurb: "Deploys and runs AI apps in containers — like a serverless cloud for AI workloads.",
    analogy: "Think: Vercel or Render, but specialized for running AI models.",
  },
  68: {
    blurb: "Generates synthetic (fake-but-realistic) data to train AI without privacy concerns.",
    analogy: "Think: a Hollywood studio that creates realistic scenarios for AI to learn from.",
  },
  75: {
    blurb: "Decentralized cloud storage — your files live across thousands of machines worldwide.",
    analogy: "Think: Google Drive or Dropbox, but no single company holds your data.",
  },
  82: {
    blurb: "Rents out distributed GPU clusters for AI training — connect your hardware, earn TAO.",
    analogy: "Think: AWS EC2 compute rental, but the 'servers' are everyone's gaming PCs.",
  },
  93: {
    blurb: "Decentralized podcasting and media distribution — creators get paid directly by listeners.",
    analogy: "Think: Spotify without the middleman — revenue goes straight to creators.",
  },
  116: {
    blurb: "Decentralized lending protocol — borrow against your TAO without selling it.",
    analogy: "Think: a crypto bank where you use TAO as collateral, like MakerDAO.",
  },
  119: {
    blurb: "Market prediction engine that aggregates AI signals and on-chain data to forecast asset prices.",
    analogy: "Think: a quant fund's signal aggregator, open to anyone who runs the software.",
  },
  122: {
    blurb: "AI-powered personalized recommendations for products, content, and services.",
    analogy: "Think: Netflix's recommendation algorithm, but you can rent it for your own app.",
  },
};

/** Category-level fallback descriptions for subnets not in the map above */
export const CATEGORY_FALLBACKS: Record<string, { blurb: string; analogy: string }> = {
  Training: {
    blurb: "Trains AI models using a globally distributed network of computers, earning rewards for good results.",
    analogy: "Think: a crowdsourced AI training lab — thousands of GPUs working toward one goal.",
  },
  Inference: {
    blurb: "Runs AI models on demand using distributed compute — fast, cheap, and censorship-resistant.",
    analogy: "Think: cloud computing for AI, but no single company owns the servers.",
  },
  Agents: {
    blurb: "Autonomous AI agents that take actions, browse the web, and complete tasks without human input.",
    analogy: "Think: AI employees that work 24/7 and never ask for a raise.",
  },
  Computing: {
    blurb: "A marketplace for renting computing power — contributors earn by sharing idle CPU/GPU resources.",
    analogy: "Think: Airbnb for computers — your hardware earns money while you sleep.",
  },
  DeFi: {
    blurb: "Decentralized financial services — lending, trading, and yield — all powered by AI and smart contracts.",
    analogy: "Think: a bank that runs itself with no employees, just code.",
  },
  Data: {
    blurb: "Collects, cleans, and curates data that AI models need to learn — the raw fuel for the AI economy.",
    analogy: "Think: a data pipeline company, like Palantir but open and incentivized.",
  },
  Storage: {
    blurb: "Stores data across a decentralized network of machines — no central server that can go down or censor you.",
    analogy: "Think: Dropbox or AWS S3, but running on thousands of independent computers.",
  },
  Social: {
    blurb: "AI-powered social and media tools — from content creation to community intelligence.",
    analogy: "Think: a social media layer powered by decentralized AI.",
  },
  Science: {
    blurb: "Applies AI to hard scientific problems — biology, chemistry, physics — that centralized labs can't crack alone.",
    analogy: "Think: a global research university where the computers do the experiments.",
  },
  Security: {
    blurb: "AI tools for cybersecurity — detecting threats, spotting AI-generated content, and defending networks.",
    analogy: "Think: an AI security firm that anyone can access.",
  },
  Finance: {
    blurb: "AI-powered financial intelligence — market prediction, trading signals, and portfolio analysis.",
    analogy: "Think: a quant hedge fund's research department, open to everyone.",
  },
  Gaming: {
    blurb: "AI-powered gaming experiences — from strategy opponents to game economy optimization.",
    analogy: "Think: the AI opponent in a strategy game, but smarter and built on a blockchain.",
  },
};

export const DEFAULT_FALLBACK = {
  blurb: "An AI-powered network competing to deliver the best results for a specific real-world task.",
  analogy: "Think: a startup with no CEO — just AI and code.",
};

export function getSubnetDescription(netuid: number, category?: string): { blurb: string; analogy: string } {
  return (
    SUBNET_PLAIN_ENGLISH[netuid] ??
    (category ? CATEGORY_FALLBACKS[category] : null) ??
    DEFAULT_FALLBACK
  );
}
