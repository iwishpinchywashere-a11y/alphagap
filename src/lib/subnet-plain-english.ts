/**
 * Plain-English descriptions for Bittensor subnets.
 * Written so anyone — zero crypto or AI knowledge required — can understand.
 * No jargon. Short sentences. One dead-simple analogy.
 */
export const SUBNET_PLAIN_ENGLISH: Record<number, { blurb: string; analogy: string }> = {
  1: {
    blurb: "Thousands of computers race to answer your questions and write text. The best answer wins a reward.",
    analogy: "Like ChatGPT — but no single company controls it.",
  },
  2: {
    blurb: "Produces a tamper-proof receipt proving that an AI actually ran and gave a specific answer. Useful when you need to verify AI outputs without trusting anyone.",
    analogy: "Like a notary stamp for AI — proof the answer is real.",
  },
  3: {
    blurb: "Thousands of computers around the world pool their power to train one giant AI model together. Built the largest AI model ever trained without a central company.",
    analogy: "Like a charity fundraiser, but instead of money everyone donates computing power.",
  },
  4: {
    blurb: "Runs AI on hardware that keeps your questions totally private — even the server can't read them. Powers 4 million users and earns $10M+ per year.",
    analogy: "Like a locked safe that can still do work inside it — nobody can peek.",
  },
  5: {
    blurb: "Reads crypto news, social media, and market data 24/7 and turns it into signals that AI trading tools use to track what's happening in crypto.",
    analogy: "Like a news desk that never sleeps and only covers crypto.",
  },
  6: {
    blurb: "Combines hundreds of AI prediction models into one super-forecast. Used by hedge funds and prediction market traders to get an edge. Connected to a $1 billion AI company.",
    analogy: "Like asking 500 experts their opinion and combining the best parts into one answer.",
  },
  7: {
    blurb: "Pays people to keep the Bittensor network running smoothly by hosting the infrastructure that all other subnets depend on.",
    analogy: "Like paying the people who maintain the roads so everyone else can drive on them.",
  },
  8: {
    blurb: "Collects AI-generated trading predictions for Bitcoin and other assets. The best performers over 90 days get paid. Used by quant traders worldwide.",
    analogy: "Like a fantasy sports league, but for AI trading strategies — the best picks win.",
  },
  9: {
    blurb: "Trains big AI models using regular people's computers, including a Mac app anyone can download. Every machine that helps gets rewarded.",
    analogy: "Like SETI@home — donate your laptop's spare time to build AI instead of searching for aliens.",
  },
  10: {
    blurb: "Lets people on Ethereum or Solana buy Bittensor tokens without needing to understand how Bittensor works under the hood.",
    analogy: "Like an exchange booth at an airport — swap your currency without knowing how international banking works.",
  },
  11: {
    blurb: "Powers the Dippy app — an AI companion with 8.6 million users — by running the AI image and media generation on a decentralized network instead of one central server.",
    analogy: "Like the engine room of a popular app, running on thousands of computers instead of one company's cloud.",
  },
  13: {
    blurb: "Scrapes Twitter, Reddit, and YouTube around the clock and builds a giant open dataset. Over 55 billion rows collected. AI companies use this data to train their models.",
    analogy: "Like a library that pays people to collect and organize every book — except the 'books' are social media posts.",
  },
  14: {
    blurb: "A Bitcoin mining pool where members point their mining hardware at the group. The Bitcoin revenue gets recycled back into the Bittensor ecosystem.",
    analogy: "Like a community gold mine — everyone digs together and the profits go back into the town.",
  },
  15: {
    blurb: "Ask questions about crypto in plain English — 'which DeFi pool has the best risk-adjusted yield right now?' — and AI miners race to answer accurately.",
    analogy: "Like having a crypto analyst on call, but it's powered by competing AI instead of one firm.",
  },
  16: {
    blurb: "An ad network that only pays out when a purchase is confirmed — not for clicks or page views. Miners verify the sale happened before any money changes hands.",
    analogy: "Like a commission-only salesperson — you only pay when something actually sells.",
  },
  17: {
    blurb: "Generates 3D models from text descriptions. Has built the world's largest open-source 3D dataset with over 21 million models, used to train the next wave of 3D AI.",
    analogy: "Like Midjourney but for 3D objects — type what you want and get a model you can print or put in a game.",
  },
  18: {
    blurb: "AI models compete to predict the weather at any location on Earth, hour by hour. Reportedly 40% more accurate than commercial weather APIs.",
    analogy: "Like a weather forecasting competition where the winner gets paid and everyone gets better forecasts.",
  },
  19: {
    blurb: "A public AI service where you can generate text and images using powerful models like Llama 3. One of Bittensor's busiest subnets with a live web app anyone can use.",
    analogy: "Like a decentralized OpenAI — send a message, get a response, no subscription required.",
  },
  20: {
    blurb: "Runs a real product called MSPTech that automates IT support tickets for businesses. Also hosts a competition with $130K in prizes to build the best AI benchmarks.",
    analogy: "Like an IT helpdesk that's entirely automated by AI — the ticket gets sorted before a human even sees it.",
  },
  22: {
    blurb: "An AI search engine that gives you direct answers instead of a list of links. Independently tested to be more accurate than OpenAI, Google, and Perplexity. Earning real revenue.",
    analogy: "Like Google, but it reads the page for you and just tells you the answer.",
  },
  23: {
    blurb: "Pays real people to post high-quality, factual replies on Twitter/X. Checks 400,000+ accounts to prevent fake participation. Fighting misinformation with financial incentives.",
    analogy: "Like paying people to fact-check the internet — if your reply is accurate and well-sourced, you earn.",
  },
  24: {
    blurb: "Collects video recordings of people using computers — clicking, typing, navigating — to teach AI how to use software the way a human would.",
    analogy: "Like recording someone's screen while they work, so an AI can learn to do the same job.",
  },
  25: {
    blurb: "Runs protein folding and drug discovery calculations for biotech researchers. Makes expensive pharmaceutical compute available to anyone as a cheap API.",
    analogy: "Like renting time on a supercomputer that helps find new medicines — by the minute, for any lab.",
  },
  26: {
    blurb: "Stores your files split across many independent computers. No single server to hack or go down. Works like Amazon's cloud storage but nobody owns it.",
    analogy: "Like hiding pieces of a puzzle in different houses — no one person can read your files, but you can always get them back.",
  },
  27: {
    blurb: "A marketplace where GPU owners (including gamers) rent out their hardware to people who need computing power. The blockchain handles trust and payment automatically.",
    analogy: "Like Airbnb, but instead of a spare bedroom you're renting out your graphics card.",
  },
  28: {
    blurb: "Predicts S&P 500 prices in real time, run by Foundry Digital — one of the biggest Bitcoin mining companies, backed by Barry Silbert's DCG.",
    analogy: "Like a Wall Street data feed, but built by competing AI predictors instead of one financial data company.",
  },
  29: {
    blurb: "Researchers and AI systems compete to find safety problems in AI models before they're deployed. A decentralized safety testing network.",
    analogy: "Like a bug bounty program for AI safety — find the flaw, prove it, get paid.",
  },
  31: {
    blurb: "Runs competitions to find the most efficient AI model architectures. Beat Google's own benchmark for designing better neural networks.",
    analogy: "Like a Formula 1 design competition — but for AI brains instead of race cars.",
  },
  32: {
    blurb: "Detects whether text was written by a human or an AI. Ranked #1 globally on the industry benchmark. More accurate than GPTZero, Originality.ai, and CopyLeaks. Real subscription revenue.",
    analogy: "Like Turnitin for the AI era — schools and publishers use it to check if content is human-written.",
  },
  36: {
    blurb: "AI agents that browse websites and complete tasks for you — filling forms, extracting data, clicking through flows. Unlike older automation tools, they don't break when a website updates.",
    analogy: "Like hiring a virtual assistant that actually uses a browser the way you do.",
  },
  37: {
    blurb: "A competition to build better AI models and stress-test them for mistakes and hallucinations. Winning models are published openly on HuggingFace.",
    analogy: "Like a quality control lab for AI — nothing ships until it passes the test.",
  },
  38: {
    blurb: "Thousands of computers work together to train one large AI model, each handling a piece of the job. A massive collaborative effort with no central coordinator.",
    analogy: "Like a barn raising — everyone shows up, everyone contributes, and together they build something none could alone.",
  },
  39: {
    blurb: "Was a marketplace for renting GPU computers with a verified guarantee of performance. Note: the company running it (Covenant AI) abruptly left Bittensor in April 2026 — future uncertain.",
    analogy: "Like a rental car company that guaranteed every car worked — but the owner just closed up shop.",
  },
  40: {
    blurb: "Figures out the best way to split long documents into pieces before feeding them to an AI chatbot. Better chunking means the AI gives more accurate answers.",
    analogy: "Like deciding how to slice a textbook before handing it to a student — the cut affects how well they understand it.",
  },
  41: {
    blurb: "An AI sports prediction system that automatically bets on Polymarket. In one month it turned $17K profit on sports predictions — NFL, NBA, soccer, and more.",
    analogy: "Like a sports analyst robot that places its own bets and shows you the receipts.",
  },
  43: {
    blurb: "Solves complex routing problems (like the fastest way to visit 1,000 cities) and is building a copy-trading tool that lets anyone follow the best crypto traders automatically.",
    analogy: "Like a GPS that plans the perfect route — and also lets you copy what the best driver is doing.",
  },
  44: {
    blurb: "Analyzes 90-minute sports matches in 2 minutes for $10 — tracking every player's movement, speed, and positioning. Used by pro teams that used to pay $10,000+ for the same analysis.",
    analogy: "Like the tracking stats you see on ESPN broadcasts, available to any team at a fraction of the cost.",
  },
  45: {
    blurb: "An AI coding assistant where the underlying model is constantly improved by a global competition. Far cheaper than GitHub Copilot — built by the same team as Dippy.",
    analogy: "Like GitHub Copilot, but the best AI wins the job every day instead of one model holding it forever.",
  },
  46: {
    blurb: "Collects property data from Zillow, Redfin, and public records into one free API with 100+ attributes per property. Competing with expensive data companies that charge a lot for the same info.",
    analogy: "Like a free Zillow database that anyone can query — built by contributors who get paid for the data they add.",
  },
  47: {
    blurb: "Compresses the text you send to an AI by 35–45% before it gets processed, cutting costs without losing meaning. The AI gets the same information for less money.",
    analogy: "Like a zip file for AI prompts — same message, lower cost to process.",
  },
  48: {
    blurb: "Predicts real estate prices using AI, claiming to beat Zillow's accuracy. From the same team that built the Almanac sports prediction system.",
    analogy: "Like a Zestimate, but powered by a competition of AI models instead of one algorithm.",
  },
  49: {
    blurb: "A competition where AI systems train robot and drone control software inside a realistic simulation. The winning policies are released as open-source autopilot code.",
    analogy: "Like a flight simulator tournament — the best virtual pilot becomes a real autopilot program.",
  },
  50: {
    blurb: "Predicts future prices for Bitcoin, gold, stocks, and more. Live on Polymarket and Deribit. A test run on $500K trading volume returned 110% in 4 weeks.",
    analogy: "Like a financial forecaster that shows its work and lets anyone check the track record.",
  },
  51: {
    blurb: "Rent powerful AI-grade GPUs for 90% less than RunPod or Vast.ai. Supports the best chips on the market and is actually faster, not just cheaper.",
    analogy: "Like renting a high-end camera from a local shop instead of buying from the big brand — same quality, fraction of the cost.",
  },
  52: {
    blurb: "Labels and organizes raw text data so it's ready to train AI models. A decentralized alternative to Scale AI, which charges companies a lot to do the same work.",
    analogy: "Like workers sorting mail — tedious but essential, and AI can't learn without it.",
  },
  54: {
    blurb: "Creates realistic fake identities and biometric data that banks use to test whether their fraud detection systems can spot the fakes. Raised $900K to build it.",
    analogy: "Like hiring actors to attempt a heist so you can test your bank's security before a real criminal tries.",
  },
  55: {
    blurb: "Predicts Bitcoin's price every 5 minutes, one hour into the future. Built with professional market data from Coin Metrics.",
    analogy: "Like a short-range weather forecast — not perfect, but consistently more useful than guessing.",
  },
  56: {
    blurb: "Trains AI models for $5 per hour instead of the $30–60 per hour AWS charges. Life sciences companies are already using it to run cheaper experiments.",
    analogy: "Like renting a professional kitchen during off-hours — same equipment, 10% of the price.",
  },
  57: {
    blurb: "Combines real-time location data, weather readings, and environmental sensors into a shared AI platform where competing models race to make the best predictions.",
    analogy: "Like a weather station network crossed with a competition — whoever predicts best, wins.",
  },
  58: {
    blurb: "Generates the voices in the Dippy AI companion app, used by 8.6 million people. Competing AI voice models race to sound more natural and expressive than ElevenLabs.",
    analogy: "Like a voice acting audition that runs 24/7 — only the most convincing voice gets used.",
  },
  59: {
    blurb: "Translates speech so fast that the translation starts forming before you finish your sentence. Built for real-time conversations across language barriers.",
    analogy: "Like a live interpreter who's already speaking your words before you've finished saying them.",
  },
  61: {
    blurb: "A competitive bug bounty network where anyone can hunt for security vulnerabilities and get paid for finding real ones. All done through Bittensor's incentive system.",
    analogy: "Like a bounty hunter program for software security — find the hole, prove it, collect the reward.",
  },
  62: {
    blurb: "An AI coding assistant that can solve real GitHub issues on its own — ranked in the top tier on the industry standard benchmark. $10/month vs $200+/year for competitors.",
    analogy: "Like a junior developer who actually closes tickets independently — not just autocomplete.",
  },
  63: {
    blurb: "Simulates quantum computer experiments on regular hardware. Backed by Quantum Rings Inc. Helps researchers test quantum algorithms without needing a real quantum computer.",
    analogy: "Like a flight simulator for quantum computing — test the algorithm before you have the machine.",
  },
  64: {
    blurb: "Deploy and run AI apps instantly — 85% cheaper than AWS, 10x faster startup. Processes 100 billion AI tokens per day. Over 400,000 users. The go-to place to host AI on Bittensor.",
    analogy: "Like Vercel or Netlify for AI apps — push your code and it just works, cheaply.",
  },
  65: {
    blurb: "A decentralized VPN with exit nodes in 80+ countries. People who run nodes earn rewards. Users get private internet access via an Android app.",
    analogy: "Like NordVPN or ExpressVPN — but the servers are run by thousands of individuals instead of one company.",
  },
  66: {
    blurb: "Token holders vote on which Bittensor liquidity pools receive rewards, directing DeFi money to where the community decides it's needed most.",
    analogy: "Like a community deciding which local businesses get a grant — but for crypto trading pools.",
  },
  67: {
    blurb: "Lets you borrow money against your Bittensor tokens without selling them — amplifying your exposure. Long-only, so it can't be used to bet against subnets.",
    analogy: "Like a home equity loan for your crypto — borrow against what you own without giving it up.",
  },
  68: {
    blurb: "Scans 65 billion potential drug molecules to find candidates worth testing in a lab. 79% more accurate than older methods. Could significantly speed up pharmaceutical research.",
    analogy: "Like a robot that reads every medical textbook ever written and tells you which experiments are worth running.",
  },
  70: {
    blurb: "Verifies whether claims in text, audio, and video are true or false at internet scale. First product is a live prediction market tracker.",
    analogy: "Like a real-time fact-checker that works on everything — articles, videos, podcasts.",
  },
  71: {
    blurb: "Identifies which companies are actively researching a topic right now — not last month. Reached $1 million in annual revenue in its first quarter.",
    analogy: "Like knowing which stores are about to run out of stock before they do — but for B2B sales leads.",
  },
  72: {
    blurb: "Builds detailed maps from dashcam footage contributed by 250,000 people worldwide. 85% cheaper than HERE or TomTom. Used for autonomous vehicle navigation.",
    analogy: "Like Google Street View, except ordinary drivers earn crypto for every kilometer they map.",
  },
  73: {
    blurb: "A private marketplace where Bittensor miners can sell their earned subnet tokens without crashing the market price. Uses Dutch auctions to find fair prices.",
    analogy: "Like a private auction for rare coins — sellers get a fair price without flooding the open market.",
  },
  74: {
    blurb: "Pays developers crypto rewards every time their code gets merged into an open-source project on GitHub. Direct financial incentive for contributing to public software.",
    analogy: "Like tipping a musician every time a song of theirs plays — except it's programmers and code.",
  },
  75: {
    blurb: "Store files on a decentralized network for 60% less than Amazon S3. Works with the same tools developers already use. Pricing is transparent and verifiable on-chain.",
    analogy: "Like a storage unit that costs half the price and you can verify the bill on a public ledger.",
  },
  77: {
    blurb: "Token holders vote on which Bittensor trading pairs deserve the deepest liquidity, then the system rewards the liquidity providers accordingly.",
    analogy: "Like a community deciding which products deserve shelf space at a store — and paying the suppliers who stock them.",
  },
  78: {
    blurb: "Gives AI agents a long-term memory and ethical reasoning layer so they don't forget past conversations or make decisions they shouldn't. Built for robots and autonomous systems.",
    analogy: "Like giving an AI a diary and a conscience — it remembers what happened and considers what's right before acting.",
  },
  79: {
    blurb: "Runs AI trading agents inside simulated stock markets where they compete against each other. The strategies that win get published for quant researchers to study.",
    analogy: "Like a trading video game where the winners' strategies get used in real financial research.",
  },
  80: {
    blurb: "AI models that create and evaluate other AI outputs — a self-improving system where the AI grades its own work. Early stage, still proving the concept.",
    analogy: "Like a teacher who is also a student — the AI marks its own homework and gets smarter from it.",
  },
  82: {
    blurb: "Lets AI agents read live blockchain data by answering structured database-style queries. Built by SubQuery, a well-known blockchain data company.",
    analogy: "Like giving an AI direct read access to every crypto transaction ever made — in real time.",
  },
  83: {
    blurb: "Solves a hard category of math problem (finding the largest connected group in a network) that has real uses in drug discovery, fraud detection, and logistics.",
    analogy: "Like a distributed brain for solving puzzles that regular computers take too long to crack.",
  },
  84: {
    blurb: "Uses AI competition to design computer chips. The winning designs are open-source and have a path to becoming real physical chips through Google's fabrication program.",
    analogy: "Like a design competition for microchips — the best blueprint gets built into actual hardware.",
  },
  85: {
    blurb: "Upscales and restores old or low-quality video using AI. Beats the paid leader (Topaz) on quality benchmarks while shrinking the file size by 95%.",
    analogy: "Like a film restoration service — old, blurry footage comes out looking like it was shot in 4K.",
  },
  86: {
    blurb: "Trains AI customer service agents specifically for e-commerce, using Alibaba shopping data. The finished product handles customer questions in multiple languages automatically.",
    analogy: "Like hiring a customer service rep who speaks 10 languages and never needs a day off.",
  },
  87: {
    blurb: "Independent analysts evaluate crypto projects using a rigorous 40-page methodology, like credit ratings for Web3. Backed by $1.15M in strategic investment.",
    analogy: "Like Moody's or S&P — but for crypto projects, and the analysts can't be bribed because they don't know each other's scores.",
  },
  88: {
    blurb: "A decentralized quantitative fund where AI models submit trading strategies. Achieved 92% returns in 3 months with only 2.2% maximum drawdown.",
    analogy: "Like a hedge fund where the portfolio managers are AI and the performance is verified publicly.",
  },
  89: {
    blurb: "A Bitcoin mining pool that permanently uses all its profits to buy Bittensor tokens. Also runs one of the world's largest Bitcoin Lightning Network nodes.",
    analogy: "Like a money printing machine that gives everything it prints to one specific cause — forever.",
  },
  91: {
    blurb: "A decentralized DDoS protection service that blocks cyberattacks at the network level. Positioned as an open alternative to Cloudflare, run by thousands of independent nodes.",
    analogy: "Like a neighborhood watch for the internet — thousands of independent lookouts instead of one security company.",
  },
  92: {
    blurb: "AI that generates complete game narratives — characters, plot arcs, dialogue, and full chapters. Game studios can access it via API to generate unlimited story content.",
    analogy: "Like hiring a novelist on demand — except it never gets writer's block and charges by the word.",
  },
  93: {
    blurb: "A podcast platform where creators get paid directly by listeners with no platform taking a cut. Claims $1,200+ CPM versus $50–100 on traditional platforms.",
    analogy: "Like Spotify — but the money goes to the podcaster, not the app.",
  },
  94: {
    blurb: "AI models evolve through genetic-style competition — 90% of rewards are burned unless a miner actually proves they built something genuinely better than before.",
    analogy: "Like natural selection for AI models — only the truly fittest survive and get paid.",
  },
  95: {
    blurb: "Enterprise AI agent infrastructure backed by Jack Clark, who co-founded Anthropic (the company behind Claude). Builds AI systems that handle complex multi-step business workflows.",
    analogy: "Like hiring a team of AI employees to run your business processes — backed by one of the biggest names in AI safety.",
  },
  96: {
    blurb: "Verifies that AI outputs meet accuracy and quality standards before they're delivered. An independent quality assurance layer for AI systems.",
    analogy: "Like a product inspector on a factory line — nothing ships until it's checked.",
  },
  97: {
    blurb: "Runs the blockchain node infrastructure that developers need to build apps on Ethereum, SUI, and Bittensor. No central company can cut off access.",
    analogy: "Like the electricity grid for crypto developers — nobody owns it, but everyone can plug in.",
  },
  99: {
    blurb: "Competing AI models generate video from text descriptions. Building toward a decentralized alternative to Sora and RunwayML for video creation.",
    analogy: "Like YouTube Shorts generated entirely by AI — describe the scene, it appears.",
  },
  103: {
    blurb: "A private marketplace for sports betting tips. Sellers seal their picks cryptographically before selling so nobody can copy them. Oracle nodes verify the odds are real.",
    analogy: "Like a sealed-bid auction for sports predictions — the tip is sold before anyone can see it.",
  },
  107: {
    blurb: "AI nodes compete to identify genetic mutations in DNA samples at clinical accuracy. One use case: detecting BRCA1 mutations linked to breast cancer.",
    analogy: "Like a medical lab that never closes and runs samples through thousands of competing AI doctors simultaneously.",
  },
  112: {
    blurb: "Finds the best route to swap one crypto token for another — comparing direct trades, automated market makers, and aggregators to maximize what you receive.",
    analogy: "Like a travel booking site that checks every airline at once to get you the cheapest flight.",
  },
  114: {
    blurb: "Connects multiple Bittensor subnets into one production layer so developers can call the best AI for any task through a single API. Built by a 50+ person engineering firm.",
    analogy: "Like a general contractor who picks the best specialist for each part of your renovation — you just make one call.",
  },
  116: {
    blurb: "Borrow against your Bittensor tokens without selling them, or lend yours out and earn interest. Your tokens keep earning staking rewards while used as collateral.",
    analogy: "Like a pawnshop where your item keeps generating income while it's in their possession.",
  },
  119: {
    blurb: "Ask questions about Bittensor in plain English and get answers from live on-chain data — emissions, staking, validator performance, GitHub commits, and market data all in one place.",
    analogy: "Like having a Bloomberg Terminal analyst who answers your questions in normal language.",
  },
  120: {
    blurb: "A decentralized arena where many teams evaluate AI models simultaneously. Their results went viral in April 2026 — distributed evaluation outperforms any single lab.",
    analogy: "Like a panel of independent film critics instead of one studio's review — more trustworthy because nobody controls it.",
  },
  122: {
    blurb: "Installs a product recommendation widget in your Shopify or WooCommerce store. Competing AI miners figure out the best 'customers also bought' suggestions for your products.",
    analogy: "Like Amazon's recommendation algorithm available to any small online store, not just Amazon.",
  },
  124: {
    blurb: "Trains drone autopilot software through physics simulations where AI pilots compete. The best-performing policies become real open-source autopilot code.",
    analogy: "Like a drone racing league where the winner's flying style gets programmed into every future drone.",
  },
  126: {
    blurb: "Runs online poker where AI detects bot players, the cards are mathematically sealed so nobody can cheat, and winnings settle instantly on-chain.",
    analogy: "Like a casino that's mathematically impossible to cheat — the house can't see the cards either.",
  },
  127: {
    blurb: "AI trading strategies compete live in isolated environments. The best-performing algorithms rank on a public leaderboard and may eventually become commercial products.",
    analogy: "Like a trading competition where every contestant is an AI and the scoreboard is public.",
  },
};

/** Category fallbacks for subnets without a specific entry */
export const CATEGORY_FALLBACKS: Record<string, { blurb: string; analogy: string }> = {
  Training: {
    blurb: "A network of computers that pool their power to train AI models. Contributors earn rewards for helping.",
    analogy: "Like a crowdfunded supercomputer — everyone chips in and the AI gets smarter.",
  },
  Inference: {
    blurb: "Runs AI models on demand across thousands of computers. Fast, cheap, and no single company controls it.",
    analogy: "Like renting AI computing power by the second — no long-term contracts.",
  },
  Agents: {
    blurb: "AI agents that take actions, complete tasks, and make decisions without needing a human at every step.",
    analogy: "Like a virtual employee who works 24/7 without supervision.",
  },
  Computing: {
    blurb: "People with spare computing power rent it out to those who need it. The blockchain handles payment and trust.",
    analogy: "Like Airbnb for computers — your hardware earns money while you sleep.",
  },
  DeFi: {
    blurb: "Financial services like lending, trading, or earning interest — run by code and math, no bank required.",
    analogy: "Like a bank with no employees and no fees, open 24/7 to anyone.",
  },
  "Web3 & DeFi": {
    blurb: "Financial tools built natively for the Bittensor ecosystem — trading, lending, and liquidity for TAO and subnet tokens.",
    analogy: "Like a stock exchange that only lists Bittensor assets.",
  },
  Data: {
    blurb: "Collects, cleans, or labels data that AI needs to learn. The raw fuel that makes AI possible.",
    analogy: "Like a farm that grows food for AI — without it, nothing else runs.",
  },
  "Data & Intelligence": {
    blurb: "Turns raw internet or on-chain data into useful signals, datasets, or answers that AI applications can use.",
    analogy: "Like a research team that reads everything so you don't have to.",
  },
  Storage: {
    blurb: "Stores your files across many independent computers worldwide. No single point of failure or control.",
    analogy: "Like Dropbox, but nobody can shut it down or read your files.",
  },
  "Science & Research": {
    blurb: "Applies AI and distributed computing to solve hard problems in biology, chemistry, or physics.",
    analogy: "Like a global research lab that never closes and shares all its results publicly.",
  },
  "Security & Trust": {
    blurb: "Finds security vulnerabilities, detects fraud, or verifies facts — using AI and decentralized competition.",
    analogy: "Like a security guard team where nobody can bribe the whole team at once.",
  },
  "Finance & Trading": {
    blurb: "AI-powered financial tools — market predictions, trading signals, or data feeds — available as an open service.",
    analogy: "Like a hedge fund's research tools, available to everyone not just institutions.",
  },
  "Media & Creative": {
    blurb: "AI-generated images, video, audio, or creative content — produced by competing models on a decentralized network.",
    analogy: "Like a creative agency where AI models compete to produce the best work for every brief.",
  },
  "Developer Tools": {
    blurb: "Tools for software developers — code generation, automation, or infrastructure — powered by Bittensor.",
    analogy: "Like the tools a carpenter uses, but for building software — and getting better every day.",
  },
  "Robotics & Vision": {
    blurb: "Computer vision and robotics AI — from reading images and video to training real robot control systems.",
    analogy: "Like teaching a robot to see and move, through millions of competitive practice runs.",
  },
  "AI Model Evaluation": {
    blurb: "Independently tests and scores AI models so you can know which ones are actually better without trusting the company that built them.",
    analogy: "Like Consumer Reports for AI models — independent, rigorous, and honest.",
  },
  "AI Compute": {
    blurb: "Distributed GPU power for running AI workloads — faster and cheaper than big cloud providers.",
    analogy: "Like renting a supercomputer by the hour, split across thousands of machines.",
  },
};

export const DEFAULT_FALLBACK = {
  blurb: "A network of computers competing to deliver the best results for a specific real-world task.",
  analogy: "Like a competitive marketplace where the best performance wins.",
};

export function getSubnetDescription(netuid: number, category?: string): { blurb: string; analogy: string } {
  return (
    SUBNET_PLAIN_ENGLISH[netuid] ??
    (category ? CATEGORY_FALLBACKS[category] : null) ??
    DEFAULT_FALLBACK
  );
}
