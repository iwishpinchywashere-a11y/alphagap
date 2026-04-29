/**
 * Plain-English descriptions for Bittensor subnets.
 * Written so anyone — zero crypto or AI knowledge required — can understand.
 * No jargon. Short sentences. One dead-simple analogy.
 * Blurbs must fit in 2 lines (≤ ~120 chars) — no truncation allowed.
 */
export const SUBNET_PLAIN_ENGLISH: Record<number, { blurb: string; analogy: string }> = {
  1: {
    blurb: "Miners submit algorithms that compete on real AI benchmarks in rotating tournaments — best result wins TAO.",
    analogy: "Like Kaggle, but with crypto prizes and the competitions never stop.",
  },
  2: {
    blurb: "Generates cryptographic proofs that an AI actually ran correctly — 160 million proofs issued and counting.",
    analogy: "Like a bank receipt that's mathematically impossible to forge — proof the AI ran what it claimed.",
  },
  3: {
    blurb: "The world's largest decentralized AI training network — completed Covenant-72B on 70+ independent machines.",
    analogy: "Like a barn raising — thousands of people worldwide each contribute a few hours, and together build something massive.",
  },
  4: {
    blurb: "Runs AI inside hardware-sealed enclaves — $70M+ in NVIDIA hardware, $10.5M Series A, ~$100K/month real revenue.",
    analogy: "Like a locked safe that can still process requests inside — even the server operator can't see your data.",
  },
  5: {
    blurb: "AI agents that self-improve from real task outcomes — miners rewarded for agents that successfully complete goals.",
    analogy: "Like a school where the students keep getting smarter every time they fail — the network learns from every mistake.",
  },
  6: {
    blurb: "A swarm of competing AI agents produce calibrated forecasts on geopolitical and financial events.",
    analogy: "Like a prediction market where the traders are AI agents that never sleep.",
  },
  7: {
    blurb: "Routes compute jobs to the cheapest available nodes in real time — reliability ensured by Bittensor incentives.",
    analogy: "Like a rideshare app for computing — always finds the nearest, cheapest driver for your job.",
  },
  8: {
    blurb: "Pay a fee to prove your trading strategy works, then get a funded account with 100% profit split.",
    analogy: "Like a prop firm tryout — prove you can trade, keep all the profits.",
  },
  9: {
    blurb: "Trains AI models on regular people's computers — including a Mac app anyone can download.",
    analogy: "Like SETI@home — donate your spare computing time to build AI instead of hunting aliens.",
  },
  10: {
    blurb: "The native DEX for Bittensor subnet tokens — cross-chain bridge from Ethereum Base and Solana, fee buybacks built in.",
    analogy: "Like Uniswap, but purpose-built for trading Bittensor's subnet tokens.",
  },
  11: {
    blurb: "An on-chain tournament where miners write AI agent instructions — the cheapest submission that works wins.",
    analogy: "Like a contract bidding process — whoever delivers results at the lowest cost gets paid.",
  },
  12: {
    blurb: "Aggregates idle GPU capacity from thousands of miners — transparent pricing, automatic work verification on-chain.",
    analogy: "Like a GPU rental marketplace where every machine is verified and the billing is public.",
  },
  13: {
    blurb: "Scrapes Twitter/X and Reddit 24/7 — 17 billion+ items collected, the largest open social media dataset in existence.",
    analogy: "Like a library that pays people to collect every social media post ever made.",
  },
  14: {
    blurb: "A Bitcoin mining pool — members contribute hardware and profits flow back into Bittensor.",
    analogy: "Like a community gold mine — everyone digs together and the profits go back into the town.",
  },
  15: {
    blurb: "Ask any DeFi question in plain English — every answer is signed on-chain so you can verify it yourself.",
    analogy: "Like a Bloomberg Terminal analyst who answers in plain language and signs every answer.",
  },
  16: {
    blurb: "An ad network that only pays out when a purchase is confirmed — never for clicks alone.",
    analogy: "Like a commission-only salesperson — you only pay when something actually sells.",
  },
  17: {
    blurb: "Generates 3D models from text — built the world's largest open-source 3D dataset with 21M+ models.",
    analogy: "Like Midjourney but for 3D objects — type what you want, get a printable model.",
  },
  18: {
    blurb: "A competitive decentralized climate forecasting network — miners predict weather, validators score accuracy on-chain.",
    analogy: "Like a forecasting competition where the winner gets paid and everyone gets better weather data.",
  },
  19: {
    blurb: "The #1 ranked inference subnet on Bittensor — fast LLM and image generation, one of OpenRouter's top providers.",
    analogy: "Like a decentralized OpenAI — send a request, get a response, at a fraction of the cost.",
  },
  20: {
    blurb: "Miners compete on real AI benchmarks like SWE-Bench — actual crypto bounties paid for winning results.",
    analogy: "Like a Kaggle competition where prizes are paid in crypto and the contests never stop running.",
  },
  21: {
    blurb: "Building the world's largest open AGI dataset — 1M+ hours of video, 30M+ clips across 50+ real-world scenarios.",
    analogy: "Like a global data collection drive where every contributor earns a share of the reward.",
  },
  22: {
    blurb: "An AI search engine returning verified results from X, Reddit, Arxiv, Wikipedia, and the web — no filter bubbles.",
    analogy: "Like Google, but it reads every source and tells you the answer — with citations you can check.",
  },
  23: {
    blurb: "Scores online content on factuality, depth, and tone using 400K+ Sybil-resistant accounts — a quality signal for the internet.",
    analogy: "Like a restaurant health inspector — independent, rigorous, and impossible to bribe.",
  },
  24: {
    blurb: "Collecting 1M+ hours of video and 30M+ clips to train AGI — released Quasar-3B, a long-context AI model.",
    analogy: "Like a global museum that pays people to donate exhibits — the collection keeps growing.",
  },
  25: {
    blurb: "Decentralized compute for drug discovery — protein folding, molecular dynamics, and docking for any research team.",
    analogy: "Like renting pharmaceutical-grade supercomputer time by the minute — for any lab, anywhere.",
  },
  26: {
    blurb: "The first decentralized robotics AI competition — miners submit robot policies that compete in simulated environments.",
    analogy: "Like a robot Olympics where anyone can enter, and the winners advance the science.",
  },
  27: {
    blurb: "Abstracts away node orchestration — give it a task via API, it handles routing, fault tolerance, and payment.",
    analogy: "Like calling an Uber — you say where you need to go, you don't manage the route.",
  },
  28: {
    blurb: "Predicts S&P 500 prices in real time — run by Foundry Digital, one of the biggest Bitcoin miners.",
    analogy: "Like a Wall Street data feed built by competing AI predictors instead of one company.",
  },
  29: {
    blurb: "Miners compete to find adversarial flaws in AI agents before they're deployed — the first on-chain AI safety network.",
    analogy: "Like a bug bounty program for AI — find the unsafe behavior, prove it, earn TAO.",
  },
  31: {
    blurb: "Fault-tolerant AI training with automatic checkpointing — training runs survive hardware failures and resume anywhere.",
    analogy: "Like an auto-save feature for AI training — a machine can drop out and the run never restarts from zero.",
  },
  32: {
    blurb: "Detects AI-generated text with 98.3% accuracy — ranked #1 on MGTD and RAID, beats GPTZero globally.",
    analogy: "Like Turnitin for the AI era — schools and publishers use it to catch AI-written work.",
  },
  33: {
    blurb: "Converts raw documents into structured AI-ready data — 660x cheaper than Mechanical Turk, used by Ipsos.",
    analogy: "Like a filing clerk that's 660x cheaper and never makes errors — turns any document into usable data.",
  },
  34: {
    blurb: "Detects AI-generated images with 95% accuracy — Chrome extension with 150K+ weekly detections across 100+ countries.",
    analogy: "Like a universal lie detector for photos — instantly tells you if that viral image was AI-made.",
  },
  35: {
    blurb: "An AI reasoning competition focused on hard math and logic — miners scored on reasoning steps, not just answers.",
    analogy: "Like a math olympiad where showing your work matters as much as getting the right answer.",
  },
  36: {
    blurb: "AI agents browse websites and complete tasks — filling forms, extracting data, clicking through flows.",
    analogy: "Like a virtual assistant that uses a browser the exact same way you do.",
  },
  37: {
    blurb: "Runs simultaneous fine-tuning competitions for chatbots, coding, and reasoning — winners published on HuggingFace.",
    analogy: "Like a bake-off where multiple categories run at once — the best recipe in each wins.",
  },
  38: {
    blurb: "Trains LLMs by distributing gradient computations — 40% more energy-efficient than traditional clusters.",
    analogy: "Like a barn raising — thousands of computers each do a small piece, and together they build a full AI model.",
  },
  39: {
    blurb: "Declarative compute infrastructure — describe what you need, Bittensor miners provision it automatically.",
    analogy: "Like Terraform, but the servers are rented from thousands of independent miners instead of AWS.",
  },
  40: {
    blurb: "Finds the optimal way to split long documents before feeding them to AI — better chunks, better answers.",
    analogy: "Like deciding how to slice a textbook — the cut affects how well the student understands it.",
  },
  41: {
    blurb: "AI models compete to predict NFL, NBA, MLB, and soccer outcomes — integrated with Polymarket for real-world utility.",
    analogy: "Like a sports analytics competition where every contestant is an AI and the leaderboard is public.",
  },
  43: {
    blurb: "Decentralized graph database intelligence — discovers hidden relationships in your data at cloud scale.",
    analogy: "Like a detective who finds every connection between people, places, and events in your data.",
  },
  44: {
    blurb: "Analyzes a full 90-minute match in 2 minutes for $10 — tracking every player's movement and speed.",
    analogy: "Like the ESPN tracking stats, available to any team at a fraction of the cost.",
  },
  45: {
    blurb: "Persistent personal AI agents that learn your preferences and autonomously handle email, calendar, and tasks.",
    analogy: "Like a personal assistant who reads everything you've ever done and handles the boring parts for you.",
  },
  46: {
    blurb: "A free property data API with 100+ attributes per home — pulling from Zillow, Redfin, and public records.",
    analogy: "Like a free Zillow database anyone can query — contributors get paid for the data they add.",
  },
  47: {
    blurb: "Automated AI model lifecycle management — detects drift, triggers retraining, and validates new versions before deployment.",
    analogy: "Like a car mechanic that never waits for you to notice a problem — it fixes the engine before it breaks.",
  },
  48: {
    blurb: "Quantum-inspired classical algorithms for finance — portfolio optimization and risk modeling without the quantum hardware wait.",
    analogy: "Like using Formula 1 engineering math in a regular car — the techniques are real, the machine is accessible.",
  },
  49: {
    blurb: "AI systems compete in realistic simulations to train robot and drone autopilot software.",
    analogy: "Like a flight simulator tournament — the best virtual pilot becomes a real autopilot.",
  },
  50: {
    blurb: "Generates 1,000 simulated price paths per asset — full probability distributions for BTC, ETH, gold, and stocks.",
    analogy: "Like a financial weather forecast — not just 'it might rain' but a full probability distribution for every outcome.",
  },
  51: {
    blurb: "Rent powerful AI-grade GPUs for 90% less than RunPod or Vast.ai — and actually faster.",
    analogy: "Like renting a high-end camera locally instead of from the big brand — same quality, fraction of the price.",
  },
  52: {
    blurb: "Collects human preference data to align AI models — RLHF at scale, backed by CZ's BNB Chain fund.",
    analogy: "Like a massive focus group for AI — real human feedback that makes AI safer and more useful.",
  },
  53: {
    blurb: "Explores vast search spaces to find Pareto-optimal configurations — for hyperparameter tuning and portfolio construction.",
    analogy: "Like a scout who maps every possible path and reports back the ones with the best trade-offs.",
  },
  54: {
    blurb: "Generates adversarial synthetic identities and biometrics to stress-test KYC and fraud detection systems.",
    analogy: "Like hiring professional thieves to test your vault — find the weakness before real criminals do.",
  },
  55: {
    blurb: "Creates synthetic DNA that is statistically indistinguishable from real genomes — won MIT prize, has paying clients.",
    analogy: "Like a photocopier for DNA — the copies are so good that AI can train on them instead of real patient data.",
  },
  56: {
    blurb: "Fine-tunes AI models for $5/hr instead of $30–60/hr on AWS — life sciences companies already use it.",
    analogy: "Like renting a professional kitchen during off-hours — same equipment, 10% of the price.",
  },
  57: {
    blurb: "10-day global weather forecasts powered by Microsoft Aurora — geospatial AI for climate, agriculture, and disaster response.",
    analogy: "Like Weather.com, but run by thousands of competing AI models instead of one company.",
  },
  58: {
    blurb: "AI agents can pay each other $0.0001 per transaction — 200x smaller than Stripe's minimum, zero gas after setup.",
    analogy: "Like a vending machine for AI services — the agent inserts a tiny coin, gets the result, moves on.",
  },
  59: {
    blurb: "Speech-to-speech translation that starts before you finish the sentence — predictive AI cuts the lag.",
    analogy: "Like a live interpreter who's already speaking your words before you've finished.",
  },
  60: {
    blurb: "Continuous security scanning for code and infrastructure — new attack patterns discovered by one miner protect everyone.",
    analogy: "Like a neighborhood watch for your servers — every discovery is instantly shared across the whole network.",
  },
  61: {
    blurb: "Anyone can hunt for security vulnerabilities and get paid for real discoveries.",
    analogy: "Like a bug bounty program — find the hole, prove it, collect the reward.",
  },
  62: {
    blurb: "An AI coding assistant that solves real GitHub issues — top benchmark, $10/month vs $200+/year.",
    analogy: "Like a junior developer who actually closes tickets, not just autocomplete.",
  },
  63: {
    blurb: "Aggregates access to quantum hardware and high-fidelity simulators — researchers pay in TAO, get results.",
    analogy: "Like a co-op for quantum computers — everyone pays a little, everyone gets access.",
  },
  64: {
    blurb: "Deploy and run AI apps instantly — 85% cheaper than AWS, 100B tokens/day, 400K+ users.",
    analogy: "Like Vercel for AI apps — push your code and it just works, cheaply.",
  },
  65: {
    blurb: "A decentralized VPN with nodes in 80+ countries — node operators earn crypto, users get privacy.",
    analogy: "Like NordVPN, but the servers are run by thousands of individuals instead of one company.",
  },
  66: {
    blurb: "AI coding agents duel each other patching real open-source repositories — only the agent that fixes the code wins.",
    analogy: "Like a coding competition where the prize goes to whoever actually fixes the most bugs.",
  },
  67: {
    blurb: "Take leveraged long positions on Bittensor subnet tokens using TAO as collateral — the first DeFi protocol for dTAO.",
    analogy: "Like a margin account for Bittensor — borrow against your TAO to amplify your bet on a specific subnet.",
  },
  68: {
    blurb: "Scans 65 billion drug molecules to find lab-worthy candidates — 79% more accurate than older methods.",
    analogy: "Like a robot that reads every medical textbook and tells you which experiments are worth running.",
  },
  70: {
    blurb: "Proactive code generation that anticipates what you need next — analyzes your codebase and generates components before you ask.",
    analogy: "Like a developer who reads your codebase overnight and shows up with the next three things you would have written.",
  },
  71: {
    blurb: "Continuously verifies and enriches B2B contact data from live sources — accuracy validated on-chain.",
    analogy: "Like a real-time phone book for businesses — it checks every number before you call, not once a year.",
  },
  72: {
    blurb: "Builds maps from dashcam footage — 85% cheaper than HERE or TomTom, 250K drivers contributing.",
    analogy: "Like Google Street View, except ordinary drivers earn crypto for every kilometer they map.",
  },
  73: {
    blurb: "Builds an open layer of financial metadata on blockchain data — entity labels and risk scores, tamper-proof and free.",
    analogy: "Like giving every on-chain transaction a name tag and a credit score — without charging for the data.",
  },
  74: {
    blurb: "Decentralized code collaboration — censorship-resistant repositories with AI code review powered by competing miners.",
    analogy: "Like GitHub, but nobody can shut it down or read your private code.",
  },
  75: {
    blurb: "Decentralized file storage for 60% less than Amazon S3 — using tools developers already know.",
    analogy: "Like a storage unit that costs half the price and you can verify the bill publicly.",
  },
  76: {
    blurb: "Distributed system monitoring that itself tolerates Byzantine failures — cross-validates health signals across miners.",
    analogy: "Like a fire alarm system that keeps working even if some alarms are broken or lying.",
  },
  77: {
    blurb: "Token holders vote on which trading pairs deserve the most liquidity — providers get rewarded.",
    analogy: "Like a community deciding which products deserve shelf space, and paying suppliers who stock them.",
  },
  // 78 (Loosh) — deregistered
  79: {
    blurb: "Routes value transfers cross-chain at optimal fees and settlement speed — miners compete for the best path.",
    analogy: "Like a flight booking site that checks every airline at once — but for moving money between blockchains.",
  },
  80: {
    blurb: "Single-command distributed training — automatically coordinates Bittensor miners into an efficient training cluster.",
    analogy: "Like pressing one button to assemble a supercomputer from spare parts around the world.",
  },
  81: {
    blurb: "Implements frontier-lab training efficiency techniques — gradient checkpointing, mixed precision, pipeline parallelism — as a turnkey service.",
    analogy: "Like hiring the best F1 pit crew for your AI training run — the same techniques the big labs use, packaged for anyone.",
  },
  // 82 (Hermes) — deregistered
  83: {
    blurb: "Distributes large-scale graph analysis across miners — social networks, drug interactions, and supply chains at supercomputer scale.",
    analogy: "Like a distributed brain for network puzzles — regular computers take too long, this one never does.",
  },
  84: {
    blurb: "Competitive AI chip design — Verilog submissions auto-evaluated by EDA tools, moving toward real Google silicon tape-out.",
    analogy: "Like a chip design contest where the winner's blueprint actually gets manufactured into a real chip.",
  },
  85: {
    blurb: "AI video generation at studio quality — decentralized alternative to Runway and Sora, no content policy locks.",
    analogy: "Like a film studio where the camera crew is thousands of GPUs, not employees.",
  },
  86: {
    blurb: "Agent-driven compute workload execution — dynamically scales capacity from the Bittensor miner network on demand.",
    analogy: "Like a staffing agency for computers — sends exactly the workers you need, exactly when you need them.",
  },
  87: {
    blurb: "Privacy-preserving customer data platform — distributes enrichment across miners so no single breach exposes your users.",
    analogy: "Like a customer database split across a thousand locked boxes — useful, but nobody can steal all of it.",
  },
  88: {
    blurb: "AI-driven portfolio management that continuously adapts to market conditions — performance-linked fees only.",
    analogy: "Like a robo-advisor that actually learns and charges you nothing until it beats the market.",
  },
  89: {
    blurb: "Decentralized yield optimization — miners continuously rebalance staking positions across protocols to maximize returns.",
    analogy: "Like a financial robot that moves your savings to the highest interest account, 24/7, automatically.",
  },
  91: {
    blurb: "The first crowdfunding and accelerator for Bittensor subnet startups — raise from the TAO community via smart contracts.",
    analogy: "Like Kickstarter for Bittensor projects — community funds the idea, smart contracts hold the money safely.",
  },
  92: {
    blurb: "Automatically refines prompts and routes to the best model for each creative style — gallery-quality results, no prompt engineering.",
    analogy: "Like a creative director who translates your rough idea into the perfect brief for every AI artist.",
  },
  93: {
    blurb: "Creator-owned decentralized audio and video distribution — AI production tools included, no platform taking a cut.",
    analogy: "Like Spotify, but the money goes to the creator and the servers belong to nobody.",
  },
  94: {
    blurb: "Shared experimental AI training infrastructure — researchers contribute ideas, the network provides compute, best results shared openly.",
    analogy: "Like a public research lab where everyone chips in compute and all breakthroughs are published immediately.",
  },
  95: {
    blurb: "Enterprise AI agent infrastructure backed by Jack Clark, co-founder of Anthropic.",
    analogy: "Like hiring a team of AI employees for your business — backed by one of the biggest names in AI.",
  },
  96: {
    blurb: "AI-powered API intelligence — automatically discovers, documents, and generates integration code for any web service.",
    analogy: "Like a translator who speaks every software language — connects any two apps without custom code.",
  },
  97: {
    blurb: "Bare-metal compute marketplace — connects workloads to idle dedicated hardware at cloud flexibility and spot-market pricing.",
    analogy: "Like a hotel for servers — high-performance physical machines available by the hour, no minimum commitment.",
  },
  98: {
    blurb: "AI-driven multi-decade wealth scenarios — optimizes for generational wealth preservation across full economic cycles.",
    analogy: "Like a financial planner who models the next 50 years instead of just the next quarter.",
  },
  99: {
    blurb: "Trains specialized creative AI models that understand aesthetic style, visual hierarchy, and brand coherence.",
    analogy: "Like the difference between a printer and an art director — one copies, the other understands.",
  },
  // 100 (Plaτform) — deregistered (first subnet pruned, late 2025)
  103: {
    blurb: "AI personal financial management — specific, actionable recommendations tailored to your situation and risk tolerance.",
    analogy: "Like a financial advisor who actually reads your bank statements and tells you exactly what to do.",
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
    blurb: "Finds the best route to swap crypto tokens — compares every option to maximize what you receive.",
    analogy: "Like a flight booking site that checks every airline at once to get the cheapest route.",
  },
  114: {
    blurb: "Connects multiple Bittensor subnets into one layer — call the best AI for any task through one API.",
    analogy: "Like a general contractor who picks the best specialist — you just make one call.",
  },
  115: {
    blurb: "Builds the infrastructure for AI bots to find each other, agree on tasks, and pay each other.",
    analogy: "Like a postal service and bank rolled into one, but for robots instead of people.",
  },
  116: {
    blurb: "Borrow against your Bittensor tokens without selling them — or lend them out to earn interest.",
    analogy: "Like a pawnshop where your item keeps generating income while it's in their possession.",
  },
  118: {
    blurb: "Rewards people for holding Bittensor tokens long-term using preset index baskets — like a crypto ETF.",
    analogy: "Like a savings account that pays more the longer you promise to leave your money alone.",
  },
  119: {
    blurb: "Ask questions about Bittensor in plain English — answers from live on-chain data and market stats.",
    analogy: "Like a Bloomberg Terminal analyst who answers questions in normal language.",
  },
  120: {
    blurb: "Many independent teams evaluate AI models simultaneously — more trustworthy than any single lab.",
    analogy: "Like a panel of independent film critics instead of one studio's own review.",
  },
  121: {
    blurb: "Businesses post problems, developers build AI bots to solve them, community votes — winners get deployed.",
    analogy: "Like a freelance job board where the applicants are AI bots and clients pick the best one.",
  },
  122: {
    blurb: "Adds Amazon-style product recommendations to any Shopify or WooCommerce store.",
    analogy: "Like Amazon's 'customers also bought' feature, available to any small online shop.",
  },
  124: {
    blurb: "AI pilots compete in physics simulations to train real drone autopilot software.",
    analogy: "Like a drone racing league where the winner's flying style gets programmed into every future drone.",
  },
  126: {
    blurb: "Online poker where AI detects cheats, cards are cryptographically sealed, and winnings settle on-chain.",
    analogy: "Like a casino that's mathematically impossible to cheat — even the house can't see the cards.",
  },
  127: {
    blurb: "AI trading strategies compete live in sandboxed environments — best performers rank publicly.",
    analogy: "Like a trading competition where every contestant is an AI and the scoreboard is open.",
  },
  128: {
    blurb: "Rent out your graphics card to AI researchers who need computing power — blockchain handles payments.",
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
