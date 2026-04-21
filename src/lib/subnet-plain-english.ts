/**
 * Accurate plain-English descriptions + real-world analogies for Bittensor subnets.
 * Sources: alphagap.io/benchmarks data + subnet websites + GitHub research.
 * Written for people who've never heard of Bittensor.
 */
export const SUBNET_PLAIN_ENGLISH: Record<number, { blurb: string; analogy: string }> = {
  1: {
    blurb: "A network of competing AI models that answer questions, summarize, write code, and translate — the best-performing miners win rewards. Free public API available.",
    analogy: "Think: a decentralized ChatGPT where thousands of computers race to give the best answer.",
  },
  2: {
    blurb: "Generates cryptographic proofs that verify an AI model actually produced a given output, so developers can trustlessly confirm AI results without re-running the model.",
    analogy: "Think: a notary service for AI outputs — a tamper-proof receipt proving the AI really did the work.",
  },
  3: {
    blurb: "Pools GPUs from participants worldwide to collaboratively train massive AI language models. In 2026 it completed Covenant-72B — the largest model ever trained in a fully decentralized way.",
    analogy: "Think: a distributed supercomputing co-op for training ChatGPT-scale AI, run by thousands of volunteers.",
  },
  4: {
    blurb: "Private GPU inference secured by Intel TEE hardware, so your prompts can't be seen even by the server running them. Powers 4M+ users and generates $10.4M/yr in revenue.",
    analogy: "Think: AWS GPU cloud, but your data is mathematically sealed — even Amazon can't read it.",
  },
  5: {
    blurb: "Aggregates crypto news, social signals, and on-chain data into embeddings that AI trading bots and analysts use to track sentiment across the crypto market.",
    analogy: "Think: a Bloomberg Terminal data feed, built by competing AI models instead of a news desk.",
  },
  6: {
    blurb: "Aggregates hundreds of competing AI forecasting models into a single superhuman prediction signal used by hedge funds and Polymarket traders. Connected to Nous Research ($1B valuation).",
    analogy: "Think: a superforecasting think-tank where AI models compete, and the combined signal beats any single expert.",
  },
  7: {
    blurb: "Pays participants to run the infrastructure nodes that the rest of the Bittensor network depends on — improving speed, redundancy, and decentralization of the whole ecosystem.",
    analogy: "Think: paying volunteers to run the pipes and routers that every other Bittensor subnet relies on.",
  },
  8: {
    blurb: "Crowdsources AI-generated trading signals for Bitcoin, forex, and commodities. Miners submit predictions over a 90-day window; the best risk-adjusted performers earn rewards.",
    analogy: "Think: a decentralized hedge fund tryout where the best AI traders get paid in crypto.",
  },
  9: {
    blurb: "Pre-trains large language models from scratch using distributed GPUs — including a MacBook app that lets anyone contribute their laptop to train the next foundation model.",
    analogy: "Think: SETI@home, but instead of searching for aliens your computer helps train the next GPT.",
  },
  10: {
    blurb: "A DeFi bridge and swap platform letting Ethereum, Base, and Solana users buy Bittensor subnet tokens without touching Bittensor's infrastructure directly.",
    analogy: "Think: an on-ramp so Ethereum users can invest in Bittensor as easily as swapping on Uniswap.",
  },
  11: {
    blurb: "Powers the Dippy AI companion app (8.6M users, $600K ARR) by running decentralized AI image and media generation instead of paying a central cloud provider.",
    analogy: "Think: a decentralized AWS for AI-generated character art — the engine behind a real viral consumer app.",
  },
  13: {
    blurb: "Continuously scrapes X/Twitter, Reddit, and YouTube to build the world's largest open-source social media dataset — 55B+ rows that other AI teams use to train models.",
    analogy: "Think: a data warehouse that pays people to scrape the internet, like a crowdfunded Google crawler.",
  },
  14: {
    blurb: "A community-owned Bitcoin mining pool on Bittensor. Miners point real mining rigs at the subnet; pool revenue is recycled back into TAO via a buyback mechanism.",
    analogy: "Think: a Bitcoin mining co-op where the profits go back into the Bittensor ecosystem instead of a mining company.",
  },
  15: {
    blurb: "AI-powered DeFi analytics you query in plain English — ask questions about crypto portfolios, pool risk, and on-chain data and get instant answers from competing AI miners.",
    analogy: "Think: Nansen or Dune Analytics, but you just type a question and an AI answers it.",
  },
  16: {
    blurb: "A decentralized ad network where advertisers only pay for verified sales conversions — not clicks or impressions. Miners validate the conversion data on-chain.",
    analogy: "Think: Google Ads, but the payout is proof-of-sale and the commission doesn't go to a platform.",
  },
  17: {
    blurb: "Generates 3D models from text or images. Has built the world's largest open-source 3D dataset with 21.5M+ models, used to train next-generation 3D AI.",
    analogy: "Think: Midjourney for 3D objects — type a description and get a printable or game-ready 3D model.",
  },
  18: {
    blurb: "A decentralized weather forecasting network where AI models compete to predict hourly atmospheric conditions at any lat/lon coordinate, reportedly outperforming commercial APIs by 40%.",
    analogy: "Think: a competitive weather forecasting league where AI beats the national meteorology service.",
  },
  19: {
    blurb: "A high-throughput AI inference API serving real users with text and image generation (Llama 3, SDXL, etc.) via a public web UI. One of Bittensor's most commercially active subnets.",
    analogy: "Think: a decentralized OpenAI API — send a prompt, competing miners answer it fast and cheaply.",
  },
  20: {
    blurb: "Runs MSPTech.ai, a live B2B product automating IT support ticket triage for managed service providers. Also hosts a $130K+ crowdsourced AI benchmarking challenge.",
    analogy: "Think: AI customer support automation for IT companies — a real paying product built on Bittensor.",
  },
  22: {
    blurb: "An AI-powered search engine that understands your question and returns a direct answer — benchmarked at 92.57% relevance, beating OpenAI, Google, and Perplexity. $11K MRR.",
    analogy: "Think: Perplexity AI, but built on a decentralized network and independently benchmarked as more accurate.",
  },
  23: {
    blurb: "Pays users to post high-quality, factual replies on X/Twitter — 400K+ Sybil-protected accounts evaluated for accuracy, tone, and granularity to improve online discourse.",
    analogy: "Think: a fact-checking bounty program that pays you for writing truthful, well-sourced social media replies.",
  },
  24: {
    blurb: "Collects training data for computer-use AI — video recordings of humans using computers, which teach AI agents how to navigate interfaces and complete real-world tasks.",
    analogy: "Think: the training footage Anthropic needs to build Operator or Claude's computer-use feature, sourced from contributors worldwide.",
  },
  25: {
    blurb: "A decentralized drug discovery compute network offering protein folding (OpenMM) and protein-ligand docking (DiffDock) as APIs for researchers and biotech companies.",
    analogy: "Think: a shared supercomputer for pharma research, like renting DeepMind's AlphaFold infrastructure by the API call.",
  },
  26: {
    blurb: "Distributed object storage using erasure coding — files split across many miners with cryptographic proof-of-storage challenges ensuring nothing gets lost. S3-compatible API.",
    analogy: "Think: AWS S3 or Dropbox, but your files are split across thousands of independent machines with no single point of failure.",
  },
  27: {
    blurb: "A GPU rental marketplace where hardware owners (including gamers) rent out their idle GPUs and clients get on-demand compute. Validators run Proof-of-GPU benchmarks to verify performance.",
    analogy: "Think: Airbnb for GPUs — your gaming PC earns money while you sleep.",
  },
  28: {
    blurb: "A decentralized S&P 500 price oracle operated by Foundry Digital (one of the largest Bitcoin mining companies, backed by DCG). Miners continuously predict S&P prices during trading hours.",
    analogy: "Think: a Wall Street financial data feed, run by competing AI predictors instead of Bloomberg.",
  },
  29: {
    blurb: "An AI agent safety research network — evaluating models for alignment, safety properties, and coordinating open research into making AI agents more trustworthy.",
    analogy: "Think: a bounty network for finding and fixing safety problems before they ship in AI products.",
  },
  31: {
    blurb: "Runs Neural Architecture Search (NAS) competitions on Bittensor — miners compete to discover optimal AI model structures. Beat Google's NAS benchmark on CIFAR-10 with a 2–4% accuracy gain.",
    analogy: "Think: a global contest to design better AI brains, with crypto rewards for whoever builds the most efficient architecture.",
  },
  32: {
    blurb: "The #1 ranked AI-text detector globally — 92%+ ROC-AUC on the MGTD benchmark, outperforming GPTZero, Originality.ai, and CopyLeaks. 22K+ monthly visits, subscription revenue live.",
    analogy: "Think: Turnitin for the AI age — schools, publishers, and hiring teams pay to know if text was written by a human or AI.",
  },
  36: {
    blurb: "Autonomous AI web agents that navigate websites, fill forms, extract data, and complete online tasks — unlike traditional automation tools they adapt dynamically when site layouts change.",
    analogy: "Think: Devin or OpenAI's Operator — an AI that browses the internet and does tasks for you.",
  },
  37: {
    blurb: "Trains and stress-tests AI language models for fine-tuning and hallucination detection. Miners submit models to HuggingFace; validators score them on a competitive leaderboard.",
    analogy: "Think: a quality-control lab for AI models — find which ones hallucinate least before you deploy them.",
  },
  38: {
    blurb: "Coordinates miners to collectively train a single large language model by distributing compute and gradient updates across the network — collaborative AI training at scale.",
    analogy: "Think: thousands of computers working as one — like SETI@home but building AI instead of searching for aliens.",
  },
  39: {
    blurb: "Was a GPU compute marketplace with hardware attestation and smart-contract collateral. Note: the operator (Covenant AI) publicly exited Bittensor in April 2026 — the subnet's future is uncertain.",
    analogy: "Think: enterprise GPU rentals with a cryptographic guarantee — but the operator recently walked away.",
  },
  40: {
    blurb: "Optimizes how large documents are split into chunks for RAG (AI question-answering systems) — better chunking means AI chatbots give more accurate answers from long documents.",
    analogy: "Think: a factory that figures out the best way to cut up text before feeding it to an AI, so it answers questions better.",
  },
  41: {
    blurb: "AI-powered sports prediction markets with a live trading bot on Polymarket. In Feb 2025 it generated a 178% monthly ROI trading NFL, NBA, and soccer predictions automatically.",
    analogy: "Think: a decentralized betting desk where an AI runs the trading strategy and the profits flow back to token holders.",
  },
  43: {
    blurb: "Solves complex route optimization problems (like the Travelling Salesman Problem) and is building TaoTrader — a copy-trading system for crypto portfolio management.",
    analogy: "Think: a logistics optimizer and copy-trading platform rolled into one — one side serves supply chains, the other serves traders.",
  },
  44: {
    blurb: "Computer vision for sports — analyzes 90-minute match footage in 2 minutes for $10 vs $10,000+ manually. Used by sports teams for real-time player tracking and performance analysis.",
    analogy: "Think: the AI behind NBA's player-tracking stats and NFL Next Gen Stats, available to any team at a fraction of the cost.",
  },
  45: {
    blurb: "A competitive AI coding assistant where Bittensor miners continuously benchmark code-generation models. Users get the best-performing model at subscription rates far below GitHub Copilot.",
    analogy: "Think: GitHub Copilot, but the underlying model is constantly improved by a global competition.",
  },
  46: {
    blurb: "Crowdsources real estate data from Zillow, Redfin, and public records into one free API covering 100+ property attributes — breaking the grip of expensive, siloed property data providers.",
    analogy: "Think: a Wikipedia for property data, built by paying contributors to collect and validate it from public sources.",
  },
  47: {
    blurb: "An API that compresses LLM inputs by 35–45% while keeping ~90% of the meaning — making AI applications 35–45% cheaper to run without retraining the model.",
    analogy: "Think: a zip file for AI prompts — same information, much lower cost to process.",
  },
  48: {
    blurb: "AI real estate price predictions claiming to beat Zillow's accuracy. From the same team (Nickel5) that built Almanac (SN41) — applying competitive AI forecasting to property markets.",
    analogy: "Think: a decentralized Zillow estimate engine where AI models compete to be the most accurate.",
  },
  49: {
    blurb: "A decentralized robotics competition running in NVIDIA Omniverse — miners train drone and robot control policies in simulation that are open-sourced as real autopilot software.",
    analogy: "Think: a flight school for robot AI — simulated competitions producing real open-source autopilot code.",
  },
  50: {
    blurb: "Probabilistic price forecasting API for Bitcoin, ETH, SPY, NVDA, and gold — live on Polymarket, Deribit, and Bybit. A $500K Polymarket trial returned ~110% in 4 weeks.",
    analogy: "Think: a Monte Carlo simulator for asset prices that hedge funds and prediction markets pay for as an API.",
  },
  51: {
    blurb: "GPU rental marketplace 90% cheaper than RunPod and Vast.ai. Supports H100, A100, and AMD MI200 hardware with hardware-level optimization — not just renting, actually faster.",
    analogy: "Think: a GPU rental service that's both cheaper and faster than the incumbents, powered by decentralized hardware.",
  },
  52: {
    blurb: "Labels and structures conversational text data at scale — turning raw chat transcripts into training-ready datasets for fine-tuning AI models. A decentralized alternative to Scale AI.",
    analogy: "Think: a crowdsourced data labeling shop — the unglamorous but essential work of tagging data that makes AI better.",
  },
  54: {
    blurb: "Creates synthetic deepfake identities and adversarial biometric data that banks and ID verification companies use to stress-test their fraud detection systems. $900K seed funding.",
    analogy: "Think: a penetration testing firm for identity verification — banks pay to see if their fraud systems can catch fake IDs.",
  },
  55: {
    blurb: "Bitcoin price forecasting every 5 minutes for the hour ahead, built with Coin Metrics data. Part of a broader decentralized financial intelligence infrastructure.",
    analogy: "Think: a short-term BTC price oracle that traders and quant funds can query for the next hour's expected range.",
  },
  56: {
    blurb: "AI model training at $5/hour vs AWS/GCP H100 at $30–60/hour. Life sciences companies are among early adopters, using it for cheaper model training and fine-tuning at scale.",
    analogy: "Think: renting NVIDIA's best GPUs at 10% of the AWS price — the same hardware, dramatically cheaper.",
  },
  57: {
    blurb: "Aggregates real-time global location, weather, and environmental data — miners compete to build the best geospatial AI prediction models on a shared data infrastructure.",
    analogy: "Think: Google Earth meets competitive AI forecasting, for location-based and climate data.",
  },
  58: {
    blurb: "Powers the voice layer of the Dippy AI companion app (8.6M users) — competing miners produce highly expressive speech models, reportedly more lifelike than ElevenLabs standard TTS.",
    analogy: "Think: ElevenLabs voice cloning, but the models constantly improve through a competitive Bittensor tournament.",
  },
  59: {
    blurb: "Trains AI models that start translating speech before the speaker finishes — predicting the full sentence from partial tokens for ultra-low-latency real-time translation. Yuma-accelerated.",
    analogy: "Think: a real-time interpreter that's already forming the translation while you're still talking.",
  },
  61: {
    blurb: "A gamified security bounty network where miners compete to find real exploits and vulnerabilities — decentralizing the bug-bounty model so anyone can contribute and get paid.",
    analogy: "Think: HackerOne or Bugcrowd, but open and incentivized on Bittensor — find bugs, earn crypto.",
  },
  62: {
    blurb: "An autonomous coding assistant scoring 66–69% on SWE-bench (the industry standard for real-world coding tasks) at $10/month — competing directly with $200+/yr GitHub Copilot.",
    analogy: "Think: GitHub Copilot that actually closes GitHub issues autonomously, at 5% of the price.",
  },
  63: {
    blurb: "Decentralized quantum circuit simulation backed by Quantum Rings Inc. — miners simulate quantum algorithms on classical hardware to accelerate quantum computing research.",
    analogy: "Think: a shared quantum computing sandbox where researchers test quantum algorithms without needing a real quantum computer.",
  },
  64: {
    blurb: "Deploys and runs AI apps in containers — 85% cheaper than AWS Lambda, 10x faster startup, and processing 100B tokens/day. 400K+ users. The Vercel of AI deployment.",
    analogy: "Think: Vercel or Render, but specialized for AI models — deploy your app and it runs on distributed hardware instantly.",
  },
  65: {
    blurb: "A decentralized VPN with exit nodes in 80+ countries including hard-to-reach locations. Miners run VPN nodes and earn rewards for geographic uniqueness via a consumer Android app.",
    analogy: "Think: a Tor/VPN network where anyone can plug in their server and earn crypto for providing internet privacy.",
  },
  66: {
    blurb: "A DeFi protocol where token holders vote on which Bittensor subnet token liquidity pools receive concentrated LP rewards — directing DeFi liquidity to where governance decides it's needed.",
    analogy: "Think: Curve Finance's gauge voting, applied to Bittensor subnet token liquidity.",
  },
  67: {
    blurb: "Leveraged trading for Bittensor subnet alpha tokens — borrow TAO against TAO collateral to amplify subnet exposure. Long-only design means no shorting or sell pressure.",
    analogy: "Think: margin trading for Bittensor subnet tokens — amplify your position without selling your TAO.",
  },
  68: {
    blurb: "AI drug screening with +79% accuracy improvement over traditional methods — miners search a 65 billion molecule space to identify drug candidates faster than any lab could manually.",
    analogy: "Think: a robot pharmacist scanning 65 billion drug candidates at once to find the ones worth testing in a lab.",
  },
  70: {
    blurb: "Verifies facts and scores information sources across text, audio, and video at scale. First product: a real-time prediction market tracker (predict.dfusion.ai). Yuma-accelerated.",
    analogy: "Think: an AI fact-checker that works at internet speed — every claim, every source, verified automatically.",
  },
  71: {
    blurb: "Real-time B2B intent data — identifies companies actively researching specific topics right now. Reached $1M ARR in its first quarter. Far fresher than static sales databases.",
    analogy: "Think: LinkedIn Sales Navigator, but instead of stale profiles it shows you which companies are buying right now.",
  },
  72: {
    blurb: "Crowd-sourced HD mapping with 250K contributors and 170M+ km mapped — 85% cheaper than HERE or TomTom. Used for autonomous vehicle navigation and location services.",
    analogy: "Think: Google Street View, but thousands of ordinary dashcams contribute the footage and earn crypto for it.",
  },
  73: {
    blurb: "A decentralized OTC marketplace for miners to swap earned subnet alpha tokens for META tokens via Dutch auction — solving the illiquid exit problem for small-cap subnet token holders.",
    analogy: "Think: a private auction house for Bittensor miners who hold illiquid subnet tokens and need an exit.",
  },
  74: {
    blurb: "Pays developers in crypto for merged open-source pull requests on GitHub — creating direct financial incentives to contribute code to public repositories.",
    analogy: "Think: getting paid a bounty every time your code gets merged into an open-source project.",
  },
  75: {
    blurb: "Decentralized cloud storage that's 60% cheaper than AWS S3 — IPFS plus S3-compatible API. $4.48M in realized PnL. Transparent on-chain pricing with no surprise fees.",
    analogy: "Think: AWS S3 or Dropbox at 40 cents on the dollar, with pricing you can verify on-chain.",
  },
  77: {
    blurb: "An on-chain liquidity mining system where token holders vote on which Bittensor pools receive rewards — incentivizing DeFi liquidity for subnet tokens on external markets.",
    analogy: "Think: a DAO that votes on which Bittensor token pairs deserve the deepest trading liquidity.",
  },
  78: {
    blurb: "Builds cognition infrastructure for AI agents — persistent working memory, long-term memory, multi-stage reasoning, and ethics modules for robots and autonomous systems. Yuma-accelerated.",
    analogy: "Think: adding a long-term memory and a conscience to AI agents so they don't forget context or make unethical decisions.",
  },
  79: {
    blurb: "Agent-based financial market simulations — AI trading agents compete in synthetic market environments, generating datasets and strategies used by quant researchers.",
    analogy: "Think: a stock market video game where the best AI traders win — and their strategies get published for researchers.",
  },
  80: {
    blurb: "AI models that generate and evaluate other AI model outputs — an AI-driven marketplace where the system is designed to improve itself over time. Early stage.",
    analogy: "Think: AI reviewing AI — a self-improving loop where models compete to produce better AI outputs than each other.",
  },
  82: {
    blurb: "Built by SubQuery, this subnet lets AI agents query live blockchain data via GraphQL — connecting AI models to real-time on-chain information across multiple networks.",
    analogy: "Think: a Bloomberg data terminal for AI agents — live blockchain data, queryable like a database.",
  },
  83: {
    blurb: "Distributed solving of NP-hard 'maximum clique' graph problems — real-world applications include drug discovery, fraud detection, and network analysis.",
    analogy: "Think: a global supercomputer solving math problems that normal computers can't crack efficiently.",
  },
  84: {
    blurb: "Designs computer chips using AI on Bittensor — miners compete to produce RISC-V chip designs with custom crypto extensions, with a path to real silicon via Google OpenMPW.",
    analogy: "Think: an AI chip design studio where the blueprints are open-source and the best designs get fabricated into real chips.",
  },
  85: {
    blurb: "AI video upscaling and enhancement — beats Topaz AI on quality benchmarks while cutting file size by 95%. Used to restore and upscale old or low-res video content.",
    analogy: "Think: a video restoration service better than the paid leader (Topaz), running on decentralized compute.",
  },
  86: {
    blurb: "Trains AI customer service agents for e-commerce sellers on Alibaba dialogue data — the end product ('Lucky Cat') handles multilingual product questions and support automatically.",
    analogy: "Think: an AI customer support rep for your online store that speaks 10 languages and never sleeps.",
  },
  87: {
    blurb: "A decentralized trust and review platform for crypto projects — miners independently evaluate projects using a rigorous 40-page methodology, like Moody's ratings for Web3. $1.15M invested.",
    analogy: "Think: S&P credit ratings for crypto projects — independent, methodical, and resistant to bribery.",
  },
  88: {
    blurb: "A decentralized quant fund with AI miners submitting trading strategies. In a 3-month period it achieved 92% returns with only 2.2% max drawdown — institutional-grade performance.",
    analogy: "Think: a hedge fund where the portfolio managers are AI models and the returns are verified on-chain.",
  },
  89: {
    blurb: "A Bitcoin mining pool integrated with Bittensor — real mining hardware earns BTC, which is used to buy TAO in perpetuity. Also runs one of the world's largest Lightning Network nodes.",
    analogy: "Think: a Bitcoin miner that permanently donates its profits to buying Bittensor tokens — forever compounding.",
  },
  91: {
    blurb: "A decentralized DDoS protection service — miners run eBPF/XDP traffic filtering nodes that stop attacks at Layers 3–7, positioned as an open alternative to Cloudflare or Akamai.",
    analogy: "Think: Cloudflare's DDoS shield, but run by thousands of independent nodes instead of one company.",
  },
  92: {
    blurb: "AI story and game narrative generation — a pipeline from concept to characters to full story arc to chapters, with a developer API for game studios.",
    analogy: "Think: an AI screenwriter/novelist that game developers can call via API to generate infinite story content.",
  },
  93: {
    blurb: "Decentralized podcast distribution where creators get paid directly by listeners. Claims $1,200+ CPM vs $50–100 centralized — no Spotify or Apple taking a cut.",
    analogy: "Think: a Spotify where the revenue goes directly to the podcaster, with no middleman taking 70%.",
  },
  94: {
    blurb: "AI model evolution using genetic algorithms — 90% of emissions are burned unless miners prove genuine state-of-the-art performance, creating extreme pressure to actually innovate.",
    analogy: "Think: survival of the fittest for AI models — only genuinely better models earn rewards, the rest are penalized.",
  },
  95: {
    blurb: "Enterprise AI agent infrastructure backed by Jack Clark (Anthropic co-founder). Builds agentic AI systems that can handle complex, multi-step enterprise workflows on Bittensor.",
    analogy: "Think: Anthropic's enterprise automation tools, but built on a decentralized network.",
  },
  96: {
    blurb: "An AI output verification network — validates and cryptographically attests that AI model responses meet specific accuracy and integrity standards before delivery.",
    analogy: "Think: a quality assurance layer for AI — nothing leaves without being checked first.",
  },
  97: {
    blurb: "Decentralized blockchain RPC infrastructure across Ethereum, SUI, and Bittensor (Solana planned) — miners run full archive nodes, developers pay per API call or stake for free access.",
    analogy: "Think: a decentralized Infura or Alchemy — blockchain node access with no centralized company that can cut you off.",
  },
  99: {
    blurb: "AI video generation — miners compete to produce the highest-quality AI-generated video clips from text prompts, building toward a decentralized video generation API.",
    analogy: "Think: a decentralized Sora or RunwayML — text-to-video generation without paying OpenAI.",
  },
  103: {
    blurb: "An encrypted sports prediction marketplace — sellers submit cryptographically sealed tips, buyers pay for access without anyone seeing the picks, sportsbook oracles verify the lines.",
    analogy: "Think: a private eBay for sports betting tips, with zero-knowledge proofs ensuring nobody can cheat.",
  },
  107: {
    blurb: "Decentralized genomic analysis — AI nodes compete to accurately identify genetic mutations (like BRCA1) from DNA data at clinical-grade accuracy. Relevant to cancer screening.",
    analogy: "Think: a crowdsourced DNA lab where AI models compete to find cancer mutations — the medical equivalent of a Bittensor competition.",
  },
  112: {
    blurb: "A DeFi trade execution optimizer — takes your swap intent and finds the best execution path across P2P matching, AMMs, and aggregators to maximize what you get.",
    analogy: "Think: a decentralized 1inch or Paraswap that uses AI agents to find you the best DeFi swap route.",
  },
  114: {
    blurb: "An intelligence bridge that connects multiple Bittensor subnets and AI models into one stable production layer — built by Dendrite, a 50+ person engineering firm.",
    analogy: "Think: an AI model router that picks the best Bittensor subnet for every job — one API, every model.",
  },
  116: {
    blurb: "A lending protocol for the Bittensor ecosystem — lend TAO or borrow against subnet ALPHA tokens as collateral while keeping your tokens staked and earning emissions.",
    analogy: "Think: Aave or Compound, but built specifically for TAO and Bittensor subnet tokens.",
  },
  119: {
    blurb: "Natural language analytics for Bittensor — query on-chain metrics, emissions, validator performance, GitHub activity, and social sentiment in plain English, like a Bloomberg Terminal for TAO.",
    analogy: "Think: a Bloomberg Terminal for Bittensor that you just talk to — no code, no spreadsheets.",
  },
  120: {
    blurb: "A decentralized open AI evaluation arena — multiple teams compete to evaluate models, producing benchmarks that outperform single-team results. Their April 2026 results went viral on X.",
    analogy: "Think: a decentralized LMSYS Chatbot Arena — the community decides which AI is best, not one lab.",
  },
  122: {
    blurb: "AI-powered product recommendations for e-commerce — Shopify and WooCommerce merchants install a plugin and competing AI miners generate 'customers also bought' suggestions.",
    analogy: "Think: Amazon's recommendation algorithm available as a Shopify plugin for any online store.",
  },
  124: {
    blurb: "Trains drone autopilot AI through competitive physics simulation in PyBullet — the fastest, most collision-free policies become open-source real-world drone control software.",
    analogy: "Think: a flight simulator where AI pilots compete, and the best flying algorithm gets used in real drones.",
  },
  126: {
    blurb: "Decentralized poker integrity — AI models detect bot players, game logic runs in tamper-proof hardware (TEE), and payouts settle on-chain so neither players nor the operator can cheat.",
    analogy: "Think: a poker room where the house mathematically cannot cheat and AI security catches every bot.",
  },
  127: {
    blurb: "LLM-based trading agents compete in sandboxed environments — miners submit algorithmic trading strategies, validators execute them and rank performance on a live leaderboard.",
    analogy: "Think: a trading competition for AI agents where the best algorithm earns emissions and may get commercialized.",
  },
};

/** Category-level fallback descriptions for subnets not in the map above */
export const CATEGORY_FALLBACKS: Record<string, { blurb: string; analogy: string }> = {
  Training: {
    blurb: "Trains AI models using a globally distributed network of computers, with miners earning rewards for contributing useful compute.",
    analogy: "Think: a crowdsourced AI training lab — thousands of GPUs working toward one goal.",
  },
  Inference: {
    blurb: "Runs AI models on demand across distributed compute — fast, cheap, and without a single company controlling the infrastructure.",
    analogy: "Think: cloud computing for AI, but no single company owns the servers.",
  },
  Agents: {
    blurb: "Autonomous AI agents that take actions, browse the web, and complete tasks without human input on every step.",
    analogy: "Think: AI employees that work 24/7 and never ask for a raise.",
  },
  Computing: {
    blurb: "A marketplace for renting computing power — contributors earn by sharing their CPU or GPU with people who need it.",
    analogy: "Think: Airbnb for computers — your hardware earns money while you sleep.",
  },
  DeFi: {
    blurb: "Decentralized financial services — lending, trading, or yield — powered by AI and smart contracts with no central company.",
    analogy: "Think: a bank that runs itself with no employees, just code.",
  },
  "Web3 & DeFi": {
    blurb: "DeFi infrastructure native to the Bittensor ecosystem — liquidity, lending, and trading for TAO and subnet tokens.",
    analogy: "Think: Wall Street's back office, rebuilt for Bittensor with no middlemen.",
  },
  Data: {
    blurb: "Collects, labels, or curates data that AI models need to learn — the raw fuel for the AI economy.",
    analogy: "Think: a data pipeline company that pays contributors instead of employees.",
  },
  "Data & Intelligence": {
    blurb: "Turns raw internet or on-chain data into structured intelligence — datasets, signals, or analytics that power AI applications.",
    analogy: "Think: a data warehouse that pays people to scrape and structure information.",
  },
  Storage: {
    blurb: "Stores data across a decentralized network — no central server that can go down, censor you, or change its pricing.",
    analogy: "Think: Dropbox or AWS S3, running on thousands of independent computers.",
  },
  "Science & Research": {
    blurb: "Applies distributed AI compute to hard scientific problems — biology, chemistry, physics — that no single lab could tackle alone.",
    analogy: "Think: a global research university where the computers run the experiments.",
  },
  "Security & Trust": {
    blurb: "AI security tools — detecting threats, verifying facts, spotting fraud, or auditing systems — run on a decentralized network.",
    analogy: "Think: a cybersecurity firm anyone can access, with no single company holding all the power.",
  },
  "Finance & Trading": {
    blurb: "AI-powered financial intelligence — market prediction, trading signals, or quantitative analysis — available as an open API.",
    analogy: "Think: a quant hedge fund's research desk, open to anyone.",
  },
  "Media & Creative": {
    blurb: "AI-generated creative content — images, video, audio, or stories — produced by competing models on a decentralized network.",
    analogy: "Think: a creative studio where AI models compete to produce the best content.",
  },
  "Developer Tools": {
    blurb: "Tools for software developers — code generation, automation, data labeling, or infrastructure — built on Bittensor.",
    analogy: "Think: GitHub or AWS DevTools, but open and incentivized by crypto.",
  },
  "Robotics & Vision": {
    blurb: "Computer vision and robotics AI — from analyzing images and video to training real-world robot control policies.",
    analogy: "Think: the AI eyes and motor skills that drones and robots need to work in the real world.",
  },
  "AI Model Evaluation": {
    blurb: "Evaluates and benchmarks AI models across tasks — producing objective, verifiable quality scores without relying on a single organization.",
    analogy: "Think: an independent testing lab for AI, like Consumer Reports but for language models.",
  },
  "AI Compute": {
    blurb: "Distributed AI compute infrastructure — run AI workloads faster and cheaper across thousands of GPUs worldwide.",
    analogy: "Think: cloud computing for AI, at a fraction of AWS prices.",
  },
};

export const DEFAULT_FALLBACK = {
  blurb: "An AI-powered network where participants compete to deliver the best results for a specific real-world task.",
  analogy: "Think: a competitive marketplace for AI services — the best model wins.",
};

export function getSubnetDescription(netuid: number, category?: string): { blurb: string; analogy: string } {
  return (
    SUBNET_PLAIN_ENGLISH[netuid] ??
    (category ? CATEGORY_FALLBACKS[category] : null) ??
    DEFAULT_FALLBACK
  );
}
