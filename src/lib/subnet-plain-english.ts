/**
 * Plain-English descriptions for Bittensor subnets.
 * Blurbs are ≤ ~90 chars — fits in 2 lines at text-sm with line-clamp-2.
 * No truncation. No trailing "...". Complete sentences only.
 *
 * Last updated: May 2026
 */
export const SUBNET_PLAIN_ENGLISH: Record<number, { blurb: string; analogy: string }> = {
  1: {
    blurb: "Bittensor's flagship AI arena — miners run LLMs with web search and code execution.",
    analogy: "Like a decentralized Olympics for AI assistants, where only the smartest agents win.",
  },
  2: {
    blurb: "DSperse generates cryptographic proofs that a specific AI model ran correctly.",
    analogy: "Like a notary for AI computations — proves a model ran correctly without revealing inputs.",
  },
  3: {
    blurb: "Templar trains large language models across contributors on commodity hardware.",
    analogy: "Like a Wikipedia edit-a-thon for training AI: thousands chip in and build something massive.",
  },
  4: {
    blurb: "Targon runs AI inference inside tamper-proof Intel enclaves — backed by 1,500+ H200 GPUs.",
    analogy: "Like a bank vault for AI computations — the host machine cannot read what's running inside.",
  },
  5: {
    blurb: "OpenKaito trains text embedding models that convert content into searchable meaning vectors.",
    analogy: "Like a universal translator for meaning: converts text into numbers capturing what it's about.",
  },
  6: {
    blurb: "Numinous is a decentralized prediction market where AI agents compete on binary forecasts.",
    analogy: "Like a stock market for predictions: consistently right agents get more capital to work with.",
  },
  7: {
    blurb: "SubVortex incentivizes global Bittensor infrastructure nodes scored on uptime and latency.",
    analogy: "Like the backbone routers of the internet, but decentralized and paid in crypto.",
  },
  8: {
    blurb: "Vanta is a trading signal network — miners submit live signals; top performers share a $30M+ pool.",
    analogy: "Like a trading tournament where the best strategies win, paid in cryptocurrency.",
  },
  9: {
    blurb: "IOTA distributes LLM pretraining across thousands of devices including a Mac app.",
    analogy: "Like SETI@home but for training AI: your laptop earns tokens for helping build the model.",
  },
  10: {
    blurb: "Swap (TaoFi) is Bittensor's native DEX with cross-chain bridging and subnet alpha token trading.",
    analogy: "Like Uniswap but built specifically for trading Bittensor's subnet tokens.",
  },
  11: {
    blurb: "TrajectoryRL is a reinforcement learning arena — miners submit AI agents on optimization tasks.",
    analogy: "Like a cost-cutting competition for AI instructions: the cheapest prompt that works wins.",
  },
  12: {
    blurb: "ComputeHorde aggregates GPU capacity from miners to power validator compute across Bittensor.",
    analogy: "Like a staffing agency providing computing muscle to anyone in the Bittensor network.",
  },
  13: {
    blurb: "Data Universe scrapes X and Reddit 24/7 — 55B+ items available on Hugging Face.",
    analogy: "Like a decentralized internet archive that pays people to collect and store social posts.",
  },
  14: {
    blurb: "TAOHash is a decentralized Bitcoin mining pool — all BTC earned is converted to alpha and burned.",
    analogy: "Like a Bitcoin mining cooperative where all profits buy and destroy the pool's own token.",
  },
  15: {
    blurb: "ORO benchmarks AI commerce agents across 2.5M real product listings with autonomous purchasing.",
    analogy: "Like a driving test for AI shopping bots: navigate real listings and buy the right thing.",
  },
  16: {
    blurb: "BitKoop crowdsources verified promotional codes — miners only earn for codes that work.",
    analogy: "Like a community-verified coupon site where contributors are paid only for real codes.",
  },
  17: {
    blurb: "Gen 404 generates 3D assets from text prompts — Unity and Blender plugins available.",
    analogy: "Like a 3D printing service that works from a text description, run by competing AI systems.",
  },
  18: {
    blurb: "Zeus is a decentralized climate forecasting subnet targeting energy trading and motorsport.",
    analogy: "Like a weather prediction competition where the most accurate AI models earn the most.",
  },
  19: {
    blurb: "Nineteen.ai provides decentralized LLM and image inference — available on OpenRouter.",
    analogy: "Like a shared taxi fleet for AI requests: thousands of GPU owners compete for your fare.",
  },
  20: {
    blurb: "Bounty Hunter hosts open AI competitions — miners submit models scored on real benchmarks.",
    analogy: "Like a hackathon that never ends, where the best AI tools win ongoing prize money.",
  },
  21: {
    blurb: "OMEGA Labs collected 30M+ video clips for multimodal AGI training across text, image, and video.",
    analogy: "Like a decentralized YouTube for AI training: miners collect videos so models learn.",
  },
  22: {
    blurb: "Desearch is a decentralized AI search engine — miners index X, Reddit, Arxiv, and the live web.",
    analogy: "Like a Google search built by thousands of independent operators instead of one company.",
  },
  23: {
    blurb: "Nuance scores X replies for factuality and tone using 400K+ Sybil-resistant accounts.",
    analogy: "Like a fact-checking crowd where everyone is paid proportionally to how accurate they are.",
  },
  24: {
    blurb: "Quasar runs long-context LLM competitions — miners build models for infinite-context tasks.",
    analogy: "Like a reading comprehension competition for AI, but the documents can be book-length.",
  },
  25: {
    blurb: "Mainframe runs decentralized protein folding and molecular dynamics for pharma compute.",
    analogy: "Like Folding@home but with financial incentives for accurate simulations.",
  },
  26: {
    blurb: "Perturb probes production AI models 24/7 with adversarial attacks — delivers vulnerability heatmaps.",
    analogy: "Like a red team that never sleeps: constantly probing AI systems to find weaknesses.",
  },
  27: {
    blurb: "NeuralInternet is a permissionless GPU compute marketplace — validators verify and dispatch workloads.",
    analogy: "Like Airbnb for GPUs: rent out your graphics card to AI researchers via smart contract.",
  },
  28: {
    blurb: "Miners predict S&P 500 closes at 5-minute intervals during trading hours, ranked by accuracy.",
    analogy: "Like a continuous forecasting competition for stocks, with crypto rewards for top predictions.",
  },
  29: {
    blurb: "AI-ASSeSS runs dynamic AI model competitions using on-chain configs across evolving tasks.",
    analogy: "Like a live leaderboard where AI models compete on rotating challenges in real time.",
  },
  31: {
    blurb: "Miners train medical AI models and publish to Hugging Face — scored on clinical datasets.",
    analogy: "Like a continuous medical AI competition where better models earn more cryptocurrency.",
  },
  32: {
    blurb: "It's AI detects AI-generated text — ranked #1 on MGTD (92% ROC-AUC) and RAID (98.3%).",
    analogy: "Like a lie detector for AI writing: tells you if a human or a machine wrote it.",
  },
  33: {
    blurb: "ReadyAI converts documents into AI-ready data — 86% more accurate than human annotators.",
    analogy: "Like a document factory that turns messy PDFs into clean, labeled training data at speed.",
  },
  34: {
    blurb: "BitMind detects deepfakes — Chrome extension crossed 150K weekly detections.",
    analogy: "Like a spam filter for deepfakes: tells you if a real camera or an AI generator created it.",
  },
  35: {
    blurb: "LogicNet rewards AI models that write and execute Python to solve math and logic problems.",
    analogy: "Like a math competition for AI systems, where the only way to win is working code.",
  },
  36: {
    blurb: "Autopipa trains AI agents to browse and complete tasks on any website — benchmarked on Infinite Web Arena.",
    analogy: "Like a driver's test for AI bots: navigate a real website and get graded on success.",
  },
  37: {
    blurb: "Macrocosmos SN37 runs fine-tuning competitions for chatbot, reasoning, and coding models.",
    analogy: "Like a cooking competition where each chef specializes in a cuisine and judges eat the results.",
  },
  38: {
    blurb: "Distributed Training trains a single LLM collaboratively — miners compute gradients on data shards.",
    analogy: "Like a relay race where each runner carries the model further before passing it on.",
  },
  39: {
    blurb: "Basilica is a decentralized GPU compute cloud focused on the Covenant training ecosystem.",
    analogy: "Like a cloud hosting provider where servers are owned by thousands of individuals.",
  },
  40: {
    blurb: "Chunking finds optimal document splits for RAG — miners maximize intra-chunk coherence.",
    analogy: "Like an editor who knows exactly where to break a book into chapters that each make sense.",
  },
  41: {
    blurb: "Sportstensor predicts NFL, NBA, MLB, and soccer events — formal Polymarket partnership.",
    analogy: "Like a sports advisor that bets real money on its own predictions so you can verify it.",
  },
  43: {
    blurb: "Graphite AI solves graph optimization problems like Traveling Salesman across competing miners.",
    analogy: "Like outsourcing a complex routing puzzle to thousands of computers competing for the best path.",
  },
  44: {
    blurb: "Manako turns enterprise cameras into real-time operations systems. PwC France partner.",
    analogy: "Like giving every security camera in a factory a brain that tells the right person what to do.",
  },
  45: {
    blurb: "SWE-Rizzo deploys software engineering agents to fix real GitHub bugs — benchmarked on SWE-Bench.",
    analogy: "Like posting a coding bounty to a global network of AI developers who compete to fix bugs.",
  },
  46: {
    blurb: "RESI crowdsources US real estate price prediction — miners commit ONNX models scored against sales.",
    analogy: "Like a Zillow estimate built by a global competition of AI models instead of one algorithm.",
  },
  47: {
    blurb: "Condenses AI compresses long token sequences into soft-tokens — cuts LLM inference costs 40%.",
    analogy: "Like a zip file for AI prompts: the model reads a compressed version as fast as a short one.",
  },
  48: {
    blurb: "qBitTensor is Bittensor's quantum computing access layer — runs circuits on simulators and QPUs.",
    analogy: "Like AWS for quantum computers: rent time on quantum hardware through a decentralized market.",
  },
  49: {
    blurb: "Nepher Robotics runs a decentralized robotics policy tournament — evaluated in NVIDIA Isaac Sim.",
    analogy: "Like a flight simulator competition for robots: the best virtual pilots earn real money.",
  },
  50: {
    blurb: "Synth generates probabilistic price-path simulations for BTC, ETH, SOL, and gold.",
    analogy: "Like a weather forecast for asset prices: a full range of possible futures with probabilities.",
  },
  51: {
    blurb: "lium.io is a permissionless GPU marketplace — no KYC, up to 90% cheaper than AWS.",
    analogy: "Like Airbnb for high-end graphics cards, connecting researchers directly to GPU owners.",
  },
  52: {
    blurb: "Dojo crowdsources human preference data for AI alignment — miners produce outputs matching human baselines.",
    analogy: "Like a taste test where thousands of human judges teach future AI what humans prefer.",
  },
  53: {
    blurb: "AI models compete to find optimal trading configurations and risk-adjusted strategies.",
    analogy: "Like a strategy game where AI players compete to find the best moves in financial markets.",
  },
  54: {
    blurb: "MIID generates synthetic identity test data to stress-test KYC and sanctions screening.",
    analogy: "Like a red team for identity verification: generates fake identities to find fraud gaps.",
  },
  55: {
    blurb: "NIOME generates synthetic human DNA for pharma research — statistically indistinguishable from real.",
    analogy: "Like fictional patients for medical research: realistic enough to train AI, no real data needed.",
  },
  56: {
    blurb: "Gradients runs decentralized fine-tuning tournaments — first Bittensor subnet to hit $100M market cap.",
    analogy: "Like a cooking school where thousands of chefs compete to perfect a recipe, then it ships.",
  },
  57: {
    blurb: "Gaia delivers 10-day global weather forecasts using Microsoft Aurora — state-of-the-art accuracy.",
    analogy: "Like a thousand independent weather models voting on tomorrow's forecast, weighted by past accuracy.",
  },
  58: {
    blurb: "Handshake58 enables $0.0001 micropayments between AI agents — integrates with Cursor and Claude.",
    analogy: "Like a toll booth for AI services charging fractions of a penny, no bank account required.",
  },
  59: {
    blurb: "Babelbit provides real-time speech-to-speech translation with predictive phrase completion.",
    analogy: "Like a live interpreter who starts translating before you finish your sentence.",
  },
  60: {
    blurb: "Bitsec scans GitHub repositories for software vulnerabilities using AI and static analysis.",
    analogy: "Like hiring a security firm that uses AI to find bugs, paid only when they find something real.",
  },
  61: {
    blurb: "Bitsec Hunter runs active AI bug bounty programs — miners detect smart contract vulnerabilities.",
    analogy: "Like a decentralized bug bounty platform where AI hunters are paid per real flaw found.",
  },
  62: {
    blurb: "Ridges is a decentralized SWE agent marketplace — hit 80% on SWE-Bench in 45 days.",
    analogy: "Like a global freelance market for AI coders, where the best ones earn ongoing crypto.",
  },
  63: {
    blurb: "qBitTensor SN63 simulates quantum circuits on classical hardware — feeds real QPU access in SN48.",
    analogy: "Like a quantum flight simulator: test algorithms cheaply before running on real hardware.",
  },
  64: {
    blurb: "Chutes is Bittensor's leading serverless AI inference — 9.1T+ tokens, 85% cheaper than AWS.",
    analogy: "Like Vercel for AI models: deploy any model in seconds at a fraction of cloud pricing.",
  },
  65: {
    blurb: "TAO Private Network is a decentralized VPN — miners provide residential and business proxy nodes.",
    analogy: "Like NordVPN but owned by thousands of individuals, with crypto payments for node operators.",
  },
  66: {
    blurb: "ninja is a coding agent arena — miners submit agents that fix real open-source GitHub bugs.",
    analogy: "Like a fighting game for AI programmers: agents compete fixing the same real bug head-to-head.",
  },
  67: {
    blurb: "Harnyx is a deep research API for AI agents — synthesized multi-source analysis in seconds.",
    analogy: "Like a research analyst who reads a hundred sources and sends a cited summary instantly.",
  },
  68: {
    blurb: "NOVA screens 4.8M+ molecules across 7,000 protein targets for virtual drug discovery.",
    analogy: "Like a drug discovery factory testing billions of potential medicines simultaneously using AI.",
  },
  70: {
    blurb: "Proactive code generation — analyzes your codebase and generates the next components before you ask.",
    analogy: "Like a developer who reads your codebase overnight and shows up with the next things to write.",
  },
  71: {
    blurb: "Leadpoet is a decentralized B2B lead network — crossed 2M verified leads in 10 weeks.",
    analogy: "Like a sales intelligence platform where AI agents do the prospecting and earn per lead.",
  },
  72: {
    blurb: "NATIX StreetVision ingests dashcam footage from Drive& and Tesla vehicles to train autonomous driving.",
    analogy: "Like crowdsourcing Google Street View: drivers earn crypto and the data trains self-driving AI.",
  },
  73: {
    blurb: "MetaHash is an OTC marketplace for Bittensor — miners bid alpha tokens in Dutch auctions.",
    analogy: "Like an internal exchange desk where miners swap subnet earnings without moving markets.",
  },
  74: {
    blurb: "Gittensor pays developers in TAO for merged pull requests to open-source repositories.",
    analogy: "Like getting a crypto bonus every time your code contribution gets accepted into open source.",
  },
  75: {
    blurb: "Hippius provides decentralized IPFS + S3-compatible storage — 400+ miners across 15 countries.",
    analogy: "Like Dropbox but storage is spread across thousands of independent computers.",
  },
  76: {
    blurb: "SafeScan runs AI cancer detection competitions — models scored against clinical datasets.",
    analogy: "Like a medical AI competition where winning models are made free to help doctors detect cancer.",
  },
  77: {
    blurb: "Liquidity rewards miners for providing capital to Bittensor token pools.",
    analogy: "Like a community-governed liquidity fund where token holders vote on capital deployment.",
  },
  79: {
    blurb: "MVTRX is a live exchange for dTAO alpha token trading with dynamic fee adjustments.",
    analogy: "Like a trading simulator where AI strategies compete in a realistic market environment.",
  },
  80: {
    blurb: "AI Factory is a decentralized marketplace where miners compete to build custom AI models.",
    analogy: "Like a factory producing custom AI models on demand, run by competing developers.",
  },
  82: {
    blurb: "Compelle is a data processing marketplace — miners clean, annotate, and run inference tasks.",
    analogy: "Like Amazon Mechanical Turk but run by AI and paid in crypto, with validated output quality.",
  },
  83: {
    blurb: "Distributes large-scale graph analysis across miners — social networks and supply chains.",
    analogy: "Like a distributed brain for network puzzles — regular computers take too long, this one doesn't.",
  },
  84: {
    blurb: "ChipForge runs decentralized chip design competitions — miners submit Verilog AI accelerators.",
    analogy: "Like a global hackathon for designing computer chips, where the best may get manufactured.",
  },
  85: {
    blurb: "Vidaio enhances and upscales video using decentralized AI — miners compete on frame quality.",
    analogy: "Like thousands of AI film editors competing to give your home video a Hollywood upgrade.",
  },
  86: {
    blurb: "Agent-driven compute execution — dynamically scales GPU capacity from the Bittensor network.",
    analogy: "Like a staffing agency for computers: sends exactly the workers you need, when you need them.",
  },
  87: {
    blurb: "Luminar Network applies AI to video forensics — real-time anomaly detection across footage.",
    analogy: "Like a security camera system that automatically flags suspicious events using AI.",
  },
  88: {
    blurb: "Optimizes staking strategies across TAO and alpha tokens — scored on risk-adjusted performance.",
    analogy: "Like a robo-advisor competition where AI strategies compete to maximize staking returns.",
  },
  89: {
    blurb: "InfiniteHash is a Bitcoin mining pool — miners point ASICs and 100% of BTC is burned as alpha.",
    analogy: "Like a Bitcoin mining cooperative where all profits buy and destroy the pool's own token.",
  },
  91: {
    blurb: "Bitstarter is Bittensor's crowdfunding platform — teams raise TAO; backers get subnet tokens.",
    analogy: "Like Kickstarter for Bittensor startups: invest TAO and get new subnet tokens at pre-launch.",
  },
  92: {
    blurb: "TensorClaw routes requests across DeepSeek, Claude, Llama, and other LLM providers.",
    analogy: "Like a smart switchboard for AI models: sends your request to whichever is fastest and cheapest.",
  },
  93: {
    blurb: "Bitcast rewards creators in TAO for producing brand content — decentralized influencer marketing.",
    analogy: "Like a creator fund where AI evaluates content quality and pays in crypto instead of ad revenue.",
  },
  94: {
    blurb: "Shared experimental AI training infrastructure — researchers contribute ideas and compute openly.",
    analogy: "Like a public research lab where everyone chips in compute and all breakthroughs are published.",
  },
  95: {
    blurb: "Actual Computer builds enterprise AI agent infrastructure for autonomous business workflows.",
    analogy: "Like hiring a team of AI employees for your business, built on a decentralized compute network.",
  },
  96: {
    blurb: "Verathos provides cryptographically verified AI inference — proves exactly which model answered.",
    analogy: "Like a certified AI service: you get a receipt proving exactly which model answered your question.",
  },
  97: {
    blurb: "distil compresses large models into small ones — miners shrink Qwen3-35B to sub-5.25B student models.",
    analogy: "Like a weight-loss competition for AI: make it smaller without making it dumber, or don't get paid.",
  },
  98: {
    blurb: "AI-driven multi-decade wealth scenario modeling across full economic cycles.",
    analogy: "Like a financial planner who models the next 50 years instead of just the next quarter.",
  },
  99: {
    blurb: "Trains specialized creative AI that understands aesthetic style and brand coherence.",
    analogy: "Like the difference between a printer and an art director — one copies, the other understands.",
  },
  102: {
    blurb: "ConnitoAI splits large language models into expert groups distributed across miners.",
    analogy: "Like breaking a massive build into specialist crews — each handles their part, together they ship.",
  },
  103: {
    blurb: "DJINN is a decentralized sports prediction market with cryptographic track records on-chain.",
    analogy: "Like a sealed-bid prediction market where your historical accuracy is provably verified.",
  },
  105: {
    blurb: "Routes compute workloads to optimal Bittensor miners based on latency and cost.",
    analogy: "Like a logistics router for cloud jobs — always finds the fastest, cheapest path.",
  },
  107: {
    blurb: "AI nodes compete to identify genetic mutations including cancer markers at clinical accuracy.",
    analogy: "Like a medical lab that never closes, running samples through thousands of competing AI doctors.",
  },
  112: {
    blurb: "Minotaur is a decentralized DEX aggregator — batch auctions across AMMs for optimal swap routes.",
    analogy: "Like a travel aggregator for crypto swaps: searches every exchange for the best price.",
  },
  114: {
    blurb: "SOMA is the MCP infrastructure layer for Bittensor — miners compete on Model Context Protocol servers.",
    analogy: "Like an App Store for AI tools: developers publish plugins for AI agents to use real systems.",
  },
  115: {
    blurb: "Infrastructure for AI agents to find each other, agree on tasks, and settle payments autonomously.",
    analogy: "Like a postal service and bank rolled into one, but for AI agents instead of people.",
  },
  116: {
    blurb: "TaoLend is Bittensor's lending protocol — lend TAO for ~8% APY or borrow against alpha collateral.",
    analogy: "Like a decentralized bank where your Bittensor subnet tokens act as collateral for loans.",
  },
  118: {
    blurb: "Rewards long-term holding of Bittensor tokens using preset index baskets — longer hold, higher yield.",
    analogy: "Like a savings account that pays more the longer you promise to leave your money alone.",
  },
  119: {
    blurb: "Ask questions about Bittensor in plain English — answers from live on-chain data.",
    analogy: "Like a Bloomberg Terminal analyst who answers questions in normal language.",
  },
  120: {
    blurb: "Affine is a decentralized reinforcement learning environment for coding and reasoning benchmarks.",
    analogy: "Like a continuous exam where AI models keep retraining until they score higher.",
  },
  121: {
    blurb: "Businesses post problems, developers build AI bots, the community votes — winners earn ongoing rewards.",
    analogy: "Like a freelance job board where the applicants are AI bots and clients pick the best.",
  },
  122: {
    blurb: "Adds Amazon-style product recommendations to any Shopify or WooCommerce store.",
    analogy: "Like Amazon's 'customers also bought' feature, available to any small online shop.",
  },
  124: {
    blurb: "AI pilots compete in physics simulations to train real drone autopilot software.",
    analogy: "Like a drone racing league where the winner's flying style gets programmed into every drone.",
  },
  126: {
    blurb: "Online poker where AI detects cheats, cards are cryptographically sealed, and winnings settle on-chain.",
    analogy: "Like a casino mathematically impossible to cheat — even the house can't see the cards.",
  },
  127: {
    blurb: "AI trading strategies compete live in sandboxed environments with verified public track records.",
    analogy: "Like a trading competition where every contestant is an AI and the scoreboard is open.",
  },
  128: {
    blurb: "Rent out your GPU to AI researchers — blockchain handles payments and work verification.",
    analogy: "Like Airbnb, but instead of a spare bedroom you're renting your GPU to an AI scientist.",
  },
};

/** Category fallbacks for subnets without a specific entry */
export const CATEGORY_FALLBACKS: Record<string, { blurb: string; analogy: string }> = {
  Training: {
    blurb: "Computers pool their power to train AI models — contributors earn rewards for helping.",
    analogy: "Like a crowdfunded supercomputer — everyone chips in and the AI gets smarter.",
  },
  Inference: {
    blurb: "Runs AI models on demand across thousands of computers — fast, cheap, no single company controls it.",
    analogy: "Like renting AI computing power by the second — no long-term contracts.",
  },
  Agents: {
    blurb: "AI agents that take actions and complete tasks without needing a human at every step.",
    analogy: "Like a virtual employee who works 24/7 without supervision.",
  },
  Computing: {
    blurb: "People with spare computing power rent it out — blockchain handles payment.",
    analogy: "Like Airbnb for computers — your hardware earns money while you sleep.",
  },
  DeFi: {
    blurb: "Financial services like lending or trading — run by code and math, no bank required.",
    analogy: "Like a bank with no employees and no fees, open 24/7.",
  },
  "Web3 & DeFi": {
    blurb: "Financial tools for the Bittensor ecosystem — trading, lending, and liquidity for TAO.",
    analogy: "Like a stock exchange that only lists Bittensor assets.",
  },
  Data: {
    blurb: "Collects, cleans, or labels data that AI needs to learn.",
    analogy: "Like a farm that grows food for AI — without it, nothing else runs.",
  },
  "Data & Intelligence": {
    blurb: "Turns raw internet or on-chain data into useful signals for AI applications.",
    analogy: "Like a research team that reads everything so you don't have to.",
  },
  Storage: {
    blurb: "Stores files across many independent computers — no single point of failure.",
    analogy: "Like Dropbox, but nobody can shut it down or read your files.",
  },
  "Science & Research": {
    blurb: "Applies AI and distributed computing to hard problems in biology, chemistry, or physics.",
    analogy: "Like a global research lab that never closes and shares all results publicly.",
  },
  "Security & Trust": {
    blurb: "Finds vulnerabilities, detects fraud, or verifies facts using AI and decentralized competition.",
    analogy: "Like a security team nobody can bribe — they don't all know each other.",
  },
  "Finance & Trading": {
    blurb: "AI-powered market predictions, trading signals, or data feeds — open to everyone.",
    analogy: "Like a hedge fund's research tools, available to everyone.",
  },
  "Media & Creative": {
    blurb: "AI-generated images, video, or audio — produced by competing models on a decentralized network.",
    analogy: "Like a creative agency where AI models compete to produce the best work.",
  },
  "Developer Tools": {
    blurb: "Tools for software developers — code generation, automation, or infrastructure.",
    analogy: "Like the tools a carpenter uses, but for building software.",
  },
  "Robotics & Vision": {
    blurb: "Computer vision and robotics AI — from reading images to training real robot control systems.",
    analogy: "Like teaching a robot to see and move through millions of competitive practice runs.",
  },
  "AI Model Evaluation": {
    blurb: "Independently tests AI models so you know which ones are better.",
    analogy: "Like Consumer Reports for AI models — independent, rigorous, and honest.",
  },
  "AI Compute": {
    blurb: "Distributed GPU power for AI workloads — faster and cheaper than big cloud providers.",
    analogy: "Like renting a supercomputer by the hour, split across thousands of machines.",
  },
};

export const DEFAULT_FALLBACK = {
  blurb: "Computers compete to deliver the best results for a specific real-world task.",
  analogy: "Like a competitive marketplace where the best performance wins.",
};

export function getSubnetDescription(netuid: number, category?: string): { blurb: string; analogy: string } {
  return (
    SUBNET_PLAIN_ENGLISH[netuid] ??
    (category ? CATEGORY_FALLBACKS[category] : null) ??
    DEFAULT_FALLBACK
  );
}
