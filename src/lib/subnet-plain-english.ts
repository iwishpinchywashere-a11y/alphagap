/**
 * Plain-English descriptions for Bittensor subnets.
 * Written so anyone — zero crypto or AI knowledge required — can understand.
 * No jargon. Short sentences. One dead-simple analogy.
 * Blurbs must fit in 2 lines (≤ ~120 chars) — no truncation allowed.
 *
 * Last updated: May 2026
 */
export const SUBNET_PLAIN_ENGLISH: Record<number, { blurb: string; analogy: string }> = {
  1: {
    blurb: "Agentic reasoning competition — miners build LLM workflows with tool use; top outputs feed fine-tuning data to SN37.",
    analogy: "Like a decentralized Olympics for AI assistants, where only the smartest and most capable agents win.",
  },
  2: {
    blurb: "DSperse runs the world's largest decentralized zkML cluster — cryptographic proofs that a specific AI model produced a specific output.",
    analogy: "Like a notary for AI computations — mathematically proves a model ran correctly without revealing the inputs.",
  },
  3: {
    blurb: "Templar completed Covenant-72B in March 2026 — a 72B-parameter model trained across 70+ contributors on commodity internet hardware.",
    analogy: "Like a Wikipedia edit-a-thon for training AI: thousands of people each contribute a small piece and together build something massive.",
  },
  4: {
    blurb: "Targon runs GPU inference inside Intel TDX confidential enclaves — co-authored whitepaper with Intel engineers; backed by 1,500+ H200 GPUs and a $10.5M Series A.",
    analogy: "Like a bank vault for AI computations — the host machine literally cannot read what's running inside.",
  },
  5: {
    blurb: "OpenKaito trains the world's best generalized text embedding models — miners serve low-latency embedding APIs scored by validators.",
    analogy: "Like building a universal translator for meaning: converts any text into numbers that capture what it's actually about.",
  },
  6: {
    blurb: "Numinous is a decentralized forecasting subnet — AI agents compete on binary prediction tasks; best forecasters earn TAO emissions.",
    analogy: "Like a stock market for predictions: the agents that are consistently right get more money to bet with.",
  },
  7: {
    blurb: "SubVortex incentivizes a global network of subtensor infrastructure nodes — miners scored on uptime, latency, and geographic distribution.",
    analogy: "Like the backbone routers of the internet, but decentralized and paid in crypto for staying online.",
  },
  8: {
    blurb: "Vanta is a decentralized trading signal network — miners submit live signals across forex, crypto, and metals; top performers share a $30M+ annual rewards pool.",
    analogy: "Like a trading tournament where the best strategies win, but the prize pool is paid in cryptocurrency.",
  },
  9: {
    blurb: "IOTA by Macrocosmos distributes LLM pretraining across heterogeneous devices including a Mac app — transforms isolated miners into a cooperative training cluster.",
    analogy: "Like SETI@home but for training AI: your laptop contributes spare compute and earns tokens for helping build the model.",
  },
  10: {
    blurb: "Swap (TaoFi) is Bittensor's native DEX — cross-chain bridging from Ethereum and Solana, and a liquidity market for Bittensor subnet alpha tokens.",
    analogy: "Like Uniswap but built specifically for trading Bittensor's subnet tokens.",
  },
  11: {
    blurb: "TrajectoryRL runs a prompt optimization tournament — miners write AI agent policy packs that minimize inference cost while passing safety gates.",
    analogy: "Like a cost-cutting competition for AI instructions: the cheapest prompt that still works correctly wins.",
  },
  12: {
    blurb: "ComputeHorde aggregates GPU capacity from miners to power validator compute across Bittensor — a single miner can register thousands of GPUs.",
    analogy: "Like a staffing agency that provides computing muscle to anyone in the Bittensor network who needs it.",
  },
  13: {
    blurb: "Data Universe by Macrocosmos scrapes X (Twitter) and Reddit 24/7 — over 55 billion collected items available on Hugging Face.",
    analogy: "Like a decentralized internet archive that pays people to collect and store social media posts.",
  },
  14: {
    blurb: "TAOHash by Latent Holdings is a decentralized Bitcoin mining pool — miners point ASICs at the pool; all BTC earned is converted to alpha and burned.",
    analogy: "Like joining a Bitcoin mining cooperative where all profits are used to buy and destroy the pool's own token.",
  },
  15: {
    blurb: "BitQuant answers plain-English questions about crypto markets and DeFi — AI agents compete on accuracy, every answer signed on-chain.",
    analogy: "Like a financial analyst on call who bets their reputation on every answer being correct.",
  },
  16: {
    blurb: "BitKoop crowdsources and validates promotional discount codes — miners find and verify working promo codes, replacing the need for centralized coupon sites.",
    analogy: "Like a community-verified coupon site where contributors only get paid for codes that actually work.",
  },
  17: {
    blurb: "Gen 404 generates 3D assets from text using Gaussian Splatting and diffusion models — Unity and Blender plugins available; building a massive open 3D dataset.",
    analogy: "Like a 3D printing service that works from a text description, run by a global network of competing AI systems.",
  },
  18: {
    blurb: "Zeus is a decentralized climate forecasting subnet using ERA5 reanalysis data — targets energy trading and motorsport with ICML-published research.",
    analogy: "Like a weather prediction competition where the most accurate AI models earn the most money.",
  },
  19: {
    blurb: "Nineteen.ai provides decentralized LLM and image inference — available on OpenRouter alongside Targon and Chutes as Bittensor's main inference subnets.",
    analogy: "Like a shared taxi fleet for AI requests: instead of one company owning the cars, thousands of GPU owners compete for your fare.",
  },
  20: {
    blurb: "Bounty Hunter hosts open AI competitions — miners submit tool-calling models scored on Berkeley's Function Calling Leaderboard.",
    analogy: "Like a hackathon that never ends, where the best AI tools win ongoing prize money.",
  },
  21: {
    blurb: "OMEGA Labs has collected 30M+ video clips (1M+ hours) for AGI multimodal training — building any-to-any models integrating text, image, audio, and video.",
    analogy: "Like a decentralized YouTube for AI training: miners collect videos so models can learn how the world looks and sounds.",
  },
  22: {
    blurb: "Desearch by Datura is a decentralized AI search engine — miners index X, Reddit, Arxiv, Hacker News, Wikipedia, and the live web; API at desearch.ai.",
    analogy: "Like a Google search built by thousands of independent operators instead of one company.",
  },
  23: {
    blurb: "Nuance scores X replies for factuality and tone using 400K+ Sybil-resistant accounts — rewards users for improving public discourse quality.",
    analogy: "Like a fact-checking crowd where everyone gets paid proportionally to how insightful and accurate their corrections are.",
  },
  24: {
    blurb: "Quasar (SILX Labs) runs a long-context LLM competition — released Quasar-3B, a 3B-parameter looped transformer engineered for infinite-context tasks.",
    analogy: "Like a reading comprehension competition for AI, but the documents can be book-length.",
  },
  25: {
    blurb: "Mainframe runs decentralized protein folding and molecular dynamics simulations using OpenMM and DiffDock — a marketplace for pharmaceutical compute.",
    analogy: "Like Folding@home but with financial incentives for accurate simulations instead of volunteer altruism.",
  },
  26: {
    blurb: "Kinitro runs a decentralized robotics AI competition — validators post embodied AI tasks, miners submit policies evaluated in NVIDIA Isaac Sim.",
    analogy: "Like a robot Olympics where AI policies that perform best in simulation win ongoing prize money.",
  },
  27: {
    blurb: "NeuralInternet is a permissionless GPU compute marketplace — validators verify hardware, allocate resources, and dispatch AI workloads to miners worldwide.",
    analogy: "Like Airbnb for GPUs: rent out your graphics card to AI researchers through a trustless smart contract.",
  },
  28: {
    blurb: "Foundry Digital's S&P 500 Oracle has miners predict the index close price at 5-minute intervals during trading hours — ranked by accuracy.",
    analogy: "Like a continuous forecasting competition for the stock market, with cryptocurrency rewards for the most accurate predictions.",
  },
  29: {
    blurb: "AI-ASSeSS runs dynamic AI model competitions using on-chain JSON configs — validators benchmark submissions across evolving bounty tasks.",
    analogy: "Like a live leaderboard where AI models compete on rotating challenges and the rankings update in real time.",
  },
  31: {
    blurb: "Healthcare subnet — miners train medical AI models, publish to Hugging Face, and validators score on loss against held-out clinical datasets.",
    analogy: "Like a continuous medical AI competition where better models earn more cryptocurrency.",
  },
  32: {
    blurb: "It's AI detects AI-generated text — ranked #1 on MGTD benchmark (92% ROC-AUC) and #1 on RAID (98.3% accuracy), beating GPTZero and Originality.",
    analogy: "Like a lie detector for AI writing: it reads text and tells you if a human or a machine wrote it.",
  },
  33: {
    blurb: "ReadyAI converts raw documents into structured AI-ready data — 86% more accurate than human annotators, 660x cheaper than Mechanical Turk; processing Common Crawl.",
    analogy: "Like a document processing factory that turns messy PDFs into clean, labeled training data at machine speed.",
  },
  34: {
    blurb: "BitMind detects AI-generated images and video — 25%+ accuracy improvement since launch; V3 runs 3x faster; iOS/Android app released.",
    analogy: "Like a spam filter for deepfakes: it looks at an image and tells you if a real camera or an AI generator created it.",
  },
  35: {
    blurb: "LogicNet rewards AI models that write, test, and execute Python code to solve math, logic, and data analysis problems.",
    analogy: "Like a math competition for AI systems, where the only way to win is to actually run working code.",
  },
  36: {
    blurb: "Autoppia trains AI agents to browse and complete tasks on any website — evaluated on the Infinite Web Arena (IWA) benchmark.",
    analogy: "Like a driver's test for AI web bots: they get a task, navigate a real website, and are graded on whether they succeed.",
  },
  37: {
    blurb: "Macrocosmos SN37 runs simultaneous fine-tuning competitions — miners produce specialized chatbot, reasoning, and coding models; draws training data from SN1 and SN9.",
    analogy: "Like a cooking competition where each chef specializes in a different cuisine, and the judges eat the results.",
  },
  38: {
    blurb: "Distributed Training trains a single LLM collaboratively — miners compute gradients on dataset shards and average weights across the network.",
    analogy: "Like a relay race where each runner carries the model a little further before passing it to the next person.",
  },
  39: {
    blurb: "Basilica (WOMBO) is a decentralized GPU compute cloud for AI workloads — focuses on compute quality, serving the Covenant AI training ecosystem.",
    analogy: "Like a cloud hosting provider where the servers are owned by thousands of individuals instead of one company.",
  },
  40: {
    blurb: "Chunking (VectorChat) finds optimal document splits for RAG — miners maximize intrachunk similarity while minimizing interchunk similarity.",
    analogy: "Like a skilled editor who knows exactly where to break a long book into chapters so each one makes sense on its own.",
  },
  41: {
    blurb: "Sportstensor predicts NFL, NBA, MLB, soccer, and Polymarket events — formal Polymarket partnership announced Sept 2025; 14% NBA ROI in live trading.",
    analogy: "Like a sports betting advisor that bets real money on its own predictions so you can verify its track record.",
  },
  43: {
    blurb: "Graphite AI solves graph optimization problems (Traveling Salesman and similar) across a decentralized network of competing miners.",
    analogy: "Like outsourcing a complex routing puzzle to thousands of computers that compete to find the best solution.",
  },
  44: {
    blurb: "Score Vision analyzes soccer matches with decentralized computer vision — mines bounding boxes and keypoints from match footage; targeting the $600B football industry.",
    analogy: "Like having thousands of AI cameras analyze every second of every match, splitting the work across the network.",
  },
  45: {
    blurb: "SWE-Rizzo (Gen42) is a decentralized software engineering agent subnet — competes on Princeton's SWE-Bench; miners fix bugs and write code on real GitHub issues.",
    analogy: "Like posting a coding bounty to a global network of AI developers who compete to fix your bugs.",
  },
  46: {
    blurb: "RESI crowdsources US real estate price prediction — miners train ONNX models, commit on-chain, scored daily by MAPE against recent sales.",
    analogy: "Like a Zillow estimate built by a global competition of AI models instead of one company's algorithm.",
  },
  47: {
    blurb: "Condense AI compresses long token sequences into compact soft-tokens — accelerates LLM inference on long-context prompts while preserving meaning.",
    analogy: "Like a zip file for AI prompts: the model reads a compressed version of a long document as fast as a short one.",
  },
  48: {
    blurb: "qBitTensor is Bittensor's quantum computing access layer — executes quantum circuits on simulators with direct QPU hardware access via SN63 integration.",
    analogy: "Like AWS for quantum computers: rent time on quantum hardware through a decentralized marketplace.",
  },
  49: {
    blurb: "Nepher Robotics runs a decentralized robotics policy tournament — miners submit control policies evaluated in NVIDIA Isaac Sim; mainnet launched Feb 2026.",
    analogy: "Like a flight simulator competition for robots: the best virtual pilots earn real money.",
  },
  50: {
    blurb: "Synth generates probabilistic price-path simulations for BTC, ETH, SOL, and gold — 200+ miners submit Monte Carlo price cones; 110% ROI in a 4-week Polymarket live trial.",
    analogy: "Like a weather forecast for asset prices: instead of one prediction, you get a full range of possible futures with probabilities.",
  },
  51: {
    blurb: "Lium is a decentralized GPU rental marketplace — up to 90% cheaper than AWS; generates ~$600/hr in verified usage revenue, the highest among active Bittensor subnets.",
    analogy: "Like Airbnb for high-end graphics cards, connecting AI researchers directly to GPU owners without a middleman.",
  },
  52: {
    blurb: "Dojo by Tensorplex crowdsources human preference data for AI alignment — miners compete to produce outputs indistinguishable from high-quality human baselines.",
    analogy: "Like a taste test where thousands of human judges rate AI outputs, and the winners teach future AI what humans actually prefer.",
  },
  53: {
    blurb: "Miners develop AI models to identify optimal trading configurations — competing to find the best risk-adjusted strategies across large search spaces.",
    analogy: "Like a strategy game where AI players compete to find the best moves in financial markets.",
  },
  54: {
    blurb: "MIID generates synthetic identity test data — name variations, phonetic permutations, and identity threat scenarios to stress-test KYC and sanctions screening.",
    analogy: "Like a red team for identity verification systems: generates fake identities to find gaps in fraud detection.",
  },
  55: {
    blurb: "NIOME (Genomes.io) generates privacy-safe synthetic human DNA — statistically indistinguishable from real genomes; targets drug discovery and personalized medicine.",
    analogy: "Like creating fictional patients for medical research: the data is realistic enough to train AI but protects real people's privacy.",
  },
  56: {
    blurb: "Gradients by Rayon Labs runs decentralized fine-tuning tournaments — supports instruct, DPO, and GRPO; first Bittensor subnet to reach $100M market cap.",
    analogy: "Like a cooking school where thousands of chefs compete to perfect a recipe, and the best version gets deployed.",
  },
  57: {
    blurb: "Gaia uses Microsoft Aurora for 10-day global weather forecasts — achieved state-of-the-art skill on jet-stream forecasting; mixture-of-experts architecture.",
    analogy: "Like having a thousand independent weather models vote on tomorrow's forecast, weighted by how accurate each has been historically.",
  },
  58: {
    blurb: "Handshake58 (DRAIN protocol) enables $0.0001 micropayments between AI agents — Polygon USDC payment channels, zero gas per transaction; integrates with Cursor, Claude Desktop, and Cline.",
    analogy: "Like a toll booth for AI services that charges fractions of a penny per use, with no paperwork or bank account required.",
  },
  59: {
    blurb: "Babelbit provides real-time speech-to-speech translation with predictive phrase completion — starts translating before the speaker finishes the sentence.",
    analogy: "Like a live interpreter who starts translating before you finish your sentence by predicting what you'll say next.",
  },
  60: {
    blurb: "Bitsec scans GitHub repositories for software vulnerabilities using AI — miners run ML models and static analysis; initial focus on Bittensor subnet incentive mechanisms.",
    analogy: "Like hiring a security firm that uses AI to find bugs in your code, paid only when they find something real.",
  },
  61: {
    blurb: "Bitsec Hunter runs active bug bounty programs — AI-powered miners detect and report vulnerabilities in smart contracts and codebases for on-chain rewards.",
    analogy: "Like a decentralized bug bounty platform where AI hunters get paid for every real security flaw they find.",
  },
  62: {
    blurb: "Ridges builds autonomous software engineering agents — miners fix real GitHub issues and write production-ready code; competing on SWE-Bench leaderboard.",
    analogy: "Like a global freelance marketplace for AI coders, where the best ones win ongoing cryptocurrency rewards.",
  },
  63: {
    blurb: "qBitTensor SN63 simulates quantum circuits on classical hardware — the fidelity benchmarking layer that feeds real QPU access in SN48.",
    analogy: "Like a quantum flight simulator: test algorithms cheaply before running them on expensive real quantum hardware.",
  },
  64: {
    blurb: "Chutes is Bittensor's leading serverless AI inference platform — 9.1T+ tokens processed, 400K+ users, 5M+ requests/day, 85% cheaper than AWS; top provider on OpenRouter.",
    analogy: "Like Vercel for AI models: deploy any model in seconds without managing servers, at a fraction of cloud pricing.",
  },
  65: {
    blurb: "TAO Private Network (TPN) is a decentralized VPN — miners provide residential and business proxy nodes worldwide; Android app launched Nov 2025.",
    analogy: "Like NordVPN but owned by thousands of individuals instead of one company, with crypto payments for node operators.",
  },
  66: {
    blurb: "AlphaCore runs a decentralized AI coding agent competition — agents patch open-source repositories and compete in paired duels using statistical testing.",
    analogy: "Like a fighting game for AI programmers: two agents go head-to-head fixing the same bug and the better fix wins.",
  },
  67: {
    blurb: "Tenex enables up to 10x leveraged long positions on Bittensor subnet alpha tokens using TAO as collateral — mainnet launched Sept 2025.",
    analogy: "Like a margin trading desk for Bittensor's internal token market.",
  },
  68: {
    blurb: "NOVA (Metanova Labs) screens 65B drug molecule-target combinations — 11M+ molecules screened across 9 disease targets; partners doing wet-lab validation.",
    analogy: "Like a drug discovery factory that tests billions of potential medicines simultaneously using AI instead of chemistry.",
  },
  70: {
    blurb: "Proactive code generation that anticipates what you need next — analyzes your codebase and generates components before you ask.",
    analogy: "Like a developer who reads your codebase overnight and shows up with the next three things you would have written.",
  },
  71: {
    blurb: "LeadPoet sources, validates, and scores B2B sales leads using decentralized AI — miners scrape and score prospects; validators reach consensus each epoch.",
    analogy: "Like a sales intelligence platform where AI agents do the prospecting work and get paid per verified lead.",
  },
  72: {
    blurb: "NATIX StreetVision ingests dashcam footage from the Drive& app and Tesla vehicles to train autonomous driving models and update live maps.",
    analogy: "Like crowdsourcing Google Street View, but drivers earn cryptocurrency and the data trains self-driving AI.",
  },
  73: {
    blurb: "MetaHash is a treasury and OTC marketplace for Bittensor — miners bid ALPHA tokens in Dutch auctions to receive META tokens, enabling subnet token liquidity without pool slippage.",
    analogy: "Like an internal exchange desk where Bittensor miners can swap their subnet earnings without moving markets.",
  },
  74: {
    blurb: "Gittensor pays developers in TAO for merged pull requests to whitelisted open-source repositories — scored on code quality, repo weight, and language.",
    analogy: "Like getting a cryptocurrency bonus every time your code contribution gets accepted into a major open-source project.",
  },
  75: {
    blurb: "Hippius provides decentralized cloud storage (IPFS + S3-compatible) — 400+ miners, 15 countries, triple redundancy by default; pay with TAO, alpha, or fiat.",
    analogy: "Like Dropbox but the storage is spread across thousands of independent computers instead of Amazon's data centers.",
  },
  76: {
    blurb: "SafeScan runs competitive AI cancer detection — miners train and publish models to Hugging Face, validators score on held-out clinical datasets; expanding from melanoma to breast and lung.",
    analogy: "Like a medical AI competition where winning models are made freely available to help doctors detect cancer earlier.",
  },
  77: {
    blurb: "Liquidity rewards miners for providing capital to Bittensor token pools — alpha holders vote on which trading pairs receive funds; built on Uniswap V3.",
    analogy: "Like a community-governed liquidity fund where token holders vote on where to deploy the capital.",
  },
  79: {
    blurb: "τaos is an agent-based simulation of automated trading strategies — miners submit risk-managed trading logic that validators run in a shared market simulation.",
    analogy: "Like a trading simulator where AI strategies compete in a realistic market environment before anyone risks real money.",
  },
  80: {
    blurb: "AI Factory is a decentralized AI model development marketplace — miners compete to build customized AI models and solutions; community workshop shares research.",
    analogy: "Like a factory that produces custom AI models on demand, run by a network of competing developers.",
  },
  83: {
    blurb: "Distributes large-scale graph analysis across miners — social networks, drug interactions, and supply chains at supercomputer scale.",
    analogy: "Like a distributed brain for network puzzles — regular computers take too long, this one never does.",
  },
  84: {
    blurb: "ChipForge (TatsuProject) runs decentralized chip design competitions — miners submit Verilog implementations of AI accelerators evaluated by industry EDA tools (Yosys, OpenLane).",
    analogy: "Like a global hackathon for designing computer chips, where the best designs may actually get manufactured in silicon.",
  },
  85: {
    blurb: "Vidaio enhances and upscales video using decentralized AI — launched April 2025; miners compete to produce the highest-quality enhanced video frames.",
    analogy: "Like having thousands of AI-powered film editors compete to give your home video a Hollywood-quality upgrade.",
  },
  86: {
    blurb: "Agent-driven compute workload execution — dynamically scales capacity from the Bittensor miner network on demand.",
    analogy: "Like a staffing agency for computers — sends exactly the workers you need, exactly when you need them.",
  },
  87: {
    blurb: "Luminar Network applies decentralized AI to video forensics — real-time anomaly detection and evidence generation from video footage.",
    analogy: "Like a security camera system that uses AI to automatically flag suspicious events across thousands of video feeds.",
  },
  88: {
    blurb: "Investing (SN88) optimizes staking strategies across TAO and alpha tokens — miners submit strategies scored by validators on risk-adjusted performance metrics.",
    analogy: "Like a robo-advisor competition where AI strategies compete to maximize your crypto staking returns.",
  },
  89: {
    blurb: "InfiniteHash is a Bitcoin mining pool on Bittensor — miners point ASICs at the pool; 100% of BTC earned is converted to alpha and burned.",
    analogy: "Like joining a Bitcoin mining cooperative where all profits are used to buy and destroy the pool's own token.",
  },
  91: {
    blurb: "Bitstarter is Bittensor's first crowdfunding and accelerator platform — pre-vetted teams raise TAO from the community; backers receive subnet tokens at pre-launch rates.",
    analogy: "Like Kickstarter for Bittensor startups, where you invest TAO and get new subnet tokens if the project hits its goal.",
  },
  92: {
    blurb: "TensorClaw aggregates LLM APIs globally — provides load-balanced, OpenAI-compatible routing across DeepSeek, Claude, Llama, and other providers.",
    analogy: "Like a smart switchboard for AI models: sends your request to whichever API is fastest and cheapest at that moment.",
  },
  93: {
    blurb: "Bitcast Network rewards creators in TAO for producing brand content — decentralized influencer marketing where payment is tied to content performance.",
    analogy: "Like a creator fund where AI evaluates your content quality and pays you in crypto instead of ad revenue.",
  },
  94: {
    blurb: "Shared experimental AI training infrastructure — researchers contribute ideas, the network provides compute, best results shared openly.",
    analogy: "Like a public research lab where everyone chips in compute and all breakthroughs are published immediately.",
  },
  95: {
    blurb: "Actual Computer Inc. — enterprise AI agent infrastructure for autonomous business workflows; launched Oct 2025, Venice CA.",
    analogy: "Like hiring a team of AI employees for your business, built on a decentralized compute network.",
  },
  96: {
    blurb: "Verathos provides cryptographically verified AI inference via OpenAI-compatible API — miners prove their outputs are from specific models using on-chain verification.",
    analogy: "Like a certified AI service: you get a receipt proving exactly which model answered your question.",
  },
  97: {
    blurb: "Arbos runs competitive model distillation — miners create sub-5.25B models distilled from a 35B Qwen base; only the best performing model earns rewards.",
    analogy: "Like a weight-loss competition for AI models: make it smaller without making it dumber, or don't get paid.",
  },
  98: {
    blurb: "AI-driven multi-decade wealth scenarios — optimizes for generational wealth preservation across full economic cycles.",
    analogy: "Like a financial planner who models the next 50 years instead of just the next quarter.",
  },
  99: {
    blurb: "Trains specialized creative AI models that understand aesthetic style, visual hierarchy, and brand coherence.",
    analogy: "Like the difference between a printer and an art director — one copies, the other understands.",
  },
  103: {
    blurb: "DJINN runs a decentralized sports prediction signal marketplace — analysts post encrypted predictions; cryptographic track records verified via TLSNotary proofs.",
    analogy: "Like a sealed-bid prediction market where your historical accuracy is provably verified before anyone pays for your picks.",
  },
  105: {
    blurb: "Automatically routes compute workloads to the optimal Bittensor miners based on latency, cost, and compliance.",
    analogy: "Like a logistics router for cloud jobs — always finds the fastest, cheapest path to get the work done.",
  },
  107: {
    blurb: "AI nodes compete to identify genetic mutations in DNA at clinical accuracy — including cancer markers.",
    analogy: "Like a medical lab that never closes, running samples through thousands of competing AI doctors.",
  },
  112: {
    blurb: "Minotaur is a decentralized DEX aggregator and swap intent solver — runs batch auctions across AMMs and RFQs to find the optimal swap route for users.",
    analogy: "Like a travel aggregator for crypto swaps: searches every exchange simultaneously to find the best price for your trade.",
  },
  114: {
    blurb: "SOMA brings MCP servers into Bittensor — miners provide production-ready Model Context Protocol services scored on latency, uptime, and quality.",
    analogy: "Like an App Store for AI tools: developers publish plugins that let AI models interact with real-world systems.",
  },
  115: {
    blurb: "Builds the infrastructure for AI agents to find each other, agree on tasks, and pay each other.",
    analogy: "Like a postal service and bank rolled into one, but for AI agents instead of people.",
  },
  116: {
    blurb: "TaoLend is Bittensor's lending protocol — lend TAO to earn ~8% APY, or borrow against subnet alpha token collateral without unstaking.",
    analogy: "Like a decentralized bank where your Bittensor subnet tokens act as collateral for loans.",
  },
  118: {
    blurb: "Rewards long-term holding of Bittensor tokens using preset index baskets — the longer you hold, the higher your yield.",
    analogy: "Like a savings account that pays more the longer you promise to leave your money alone.",
  },
  119: {
    blurb: "Ask questions about Bittensor in plain English — answers drawn from live on-chain data and market stats.",
    analogy: "Like a Bloomberg Terminal analyst who answers questions in normal language.",
  },
  120: {
    blurb: "Many independent teams evaluate AI models simultaneously — more trustworthy than any single lab's self-reported benchmarks.",
    analogy: "Like a panel of independent film critics instead of one studio's own review.",
  },
  121: {
    blurb: "Businesses post problems, developers build AI bots to solve them, community votes — winners get deployed and earn ongoing rewards.",
    analogy: "Like a freelance job board where the applicants are AI bots and clients pick the best one.",
  },
  122: {
    blurb: "Adds Amazon-style product recommendations to any Shopify or WooCommerce store — plug-and-play AI merchandising for independent retailers.",
    analogy: "Like Amazon's 'customers also bought' feature, available to any small online shop.",
  },
  124: {
    blurb: "AI pilots compete in physics simulations to train real drone autopilot software — best virtual flying styles get programmed into hardware.",
    analogy: "Like a drone racing league where the winner's flying style gets programmed into every future drone.",
  },
  126: {
    blurb: "Online poker where AI detects cheats, cards are cryptographically sealed, and winnings settle on-chain.",
    analogy: "Like a casino that's mathematically impossible to cheat — even the house can't see the cards.",
  },
  127: {
    blurb: "AI trading strategies compete live in sandboxed market environments — best performers rank publicly with verified track records.",
    analogy: "Like a trading competition where every contestant is an AI and the scoreboard is open.",
  },
  128: {
    blurb: "Rent out your graphics card to AI researchers who need computing power — blockchain handles payments and work verification.",
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
    blurb: "People with spare computing power rent it out to those who need it — blockchain handles payment.",
    analogy: "Like Airbnb for computers — your hardware earns money while you sleep.",
  },
  DeFi: {
    blurb: "Financial services like lending or trading — run by code and math, no bank required.",
    analogy: "Like a bank with no employees and no fees, open 24/7.",
  },
  "Web3 & DeFi": {
    blurb: "Financial tools for the Bittensor ecosystem — trading, lending, and liquidity for TAO tokens.",
    analogy: "Like a stock exchange that only lists Bittensor assets.",
  },
  Data: {
    blurb: "Collects, cleans, or labels data that AI needs to learn — the raw fuel for AI.",
    analogy: "Like a farm that grows food for AI — without it, nothing else runs.",
  },
  "Data & Intelligence": {
    blurb: "Turns raw internet or on-chain data into useful signals and answers for AI applications.",
    analogy: "Like a research team that reads everything so you don't have to.",
  },
  Storage: {
    blurb: "Stores files across many independent computers — no single point of failure or control.",
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
    blurb: "AI-powered market predictions, trading signals, or data feeds — available as an open service.",
    analogy: "Like a hedge fund's research tools, available to everyone.",
  },
  "Media & Creative": {
    blurb: "AI-generated images, video, or audio — produced by competing models on a decentralized network.",
    analogy: "Like a creative agency where AI models compete to produce the best work.",
  },
  "Developer Tools": {
    blurb: "Tools for software developers — code generation, automation, or infrastructure on Bittensor.",
    analogy: "Like the tools a carpenter uses, but for building software.",
  },
  "Robotics & Vision": {
    blurb: "Computer vision and robotics AI — from reading images to training real robot control systems.",
    analogy: "Like teaching a robot to see and move through millions of competitive practice runs.",
  },
  "AI Model Evaluation": {
    blurb: "Independently tests AI models so you know which ones are better without trusting the company that built them.",
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
