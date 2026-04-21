/**
 * Plain-English descriptions for Bittensor subnets.
 * Written so anyone — zero crypto or AI knowledge required — can understand.
 * No jargon. Short sentences. One dead-simple analogy.
 * Blurbs must fit in 2 lines (≤ ~120 chars) — no truncation allowed.
 */
export const SUBNET_PLAIN_ENGLISH: Record<number, { blurb: string; analogy: string }> = {
  1: {
    blurb: "Computers compete to answer your questions and write text — the best answer wins a reward.",
    analogy: "Like ChatGPT, but no single company controls it.",
  },
  2: {
    blurb: "Creates a tamper-proof receipt proving an AI actually ran and gave a real answer.",
    analogy: "Like a notary stamp for AI — proof the answer is real.",
  },
  3: {
    blurb: "Computers worldwide pool their power to train one giant AI model together.",
    analogy: "Like a charity fundraiser, but everyone donates computing power instead of money.",
  },
  4: {
    blurb: "Runs AI so private even the server can't read your questions. Powers 4M users, $10M+ revenue.",
    analogy: "Like a locked safe that can still do work inside — nobody can peek.",
  },
  5: {
    blurb: "Reads crypto news and market data 24/7 and turns it into signals for AI trading tools.",
    analogy: "Like a news desk that never sleeps and only covers crypto.",
  },
  6: {
    blurb: "Combines hundreds of AI prediction models into one super-forecast — used by hedge funds.",
    analogy: "Like asking 500 experts their opinion and combining the best parts into one answer.",
  },
  7: {
    blurb: "Pays people to host the infrastructure that all other Bittensor subnets run on.",
    analogy: "Like paying road crews so everyone else can drive.",
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
    blurb: "Lets Ethereum and Solana users swap into Bittensor tokens without needing to understand how it works.",
    analogy: "Like an airport currency exchange — swap without knowing how international banking works.",
  },
  11: {
    blurb: "Runs the AI image generation behind Dippy, an AI companion app with 8.6 million users.",
    analogy: "Like the engine room of a popular app, spread across thousands of computers.",
  },
  13: {
    blurb: "Scrapes Twitter, Reddit, and YouTube 24/7 — 55B+ rows collected for AI companies to train on.",
    analogy: "Like a library that pays people to collect every social media post ever made.",
  },
  14: {
    blurb: "A Bitcoin mining pool — members contribute hardware and profits flow back into Bittensor.",
    analogy: "Like a community gold mine — everyone digs together and the profits go back into the town.",
  },
  15: {
    blurb: "AI shopping assistants compete on real tasks — finding products, comparing prices, making decisions.",
    analogy: "Like a mystery shopper competition where every contestant is an AI.",
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
    blurb: "AI models compete to predict hourly weather anywhere on Earth — 40% more accurate than commercial APIs.",
    analogy: "Like a forecasting competition where the winner gets paid and everyone gets better weather.",
  },
  19: {
    blurb: "Generate text and images using powerful AI models — live app, no subscription needed.",
    analogy: "Like a decentralized OpenAI — send a message, get a response, for free.",
  },
  20: {
    blurb: "Runs MSPTech, an AI that automates IT support tickets, plus a $130K benchmark competition.",
    analogy: "Like an IT helpdesk run entirely by AI — tickets sorted before a human sees them.",
  },
  21: {
    blurb: "AI helpers compete to diagnose and fix broken Google ad campaigns.",
    analogy: "Like a mechanic competition, but the contestants are fixing ad campaigns instead of engines.",
  },
  22: {
    blurb: "An AI search engine giving direct answers — independently tested to beat OpenAI, Google, and Perplexity.",
    analogy: "Like Google, but it reads the page for you and just tells you the answer.",
  },
  23: {
    blurb: "Pays real people to post accurate, well-sourced replies on Twitter/X to fight misinformation.",
    analogy: "Like paying people to fact-check the internet — good replies earn money.",
  },
  24: {
    blurb: "AI models compete to read and remember entire books at once — no forgetting what was said earlier.",
    analogy: "Like giving an AI a photographic memory instead of a notepad with a few pages.",
  },
  25: {
    blurb: "Runs drug discovery and protein folding calculations for biotech researchers — cheap and accessible.",
    analogy: "Like renting a pharmaceutical supercomputer by the minute, for any lab.",
  },
  26: {
    blurb: "Stores files split across many independent computers — no single server to hack or control.",
    analogy: "Like hiding puzzle pieces in different houses — nobody can read your files, but you always can.",
  },
  27: {
    blurb: "GPU owners rent their hardware to people who need computing power — blockchain handles payment.",
    analogy: "Like Airbnb, but instead of a spare bedroom you're renting out your graphics card.",
  },
  28: {
    blurb: "Predicts S&P 500 prices in real time — run by Foundry Digital, one of the biggest Bitcoin miners.",
    analogy: "Like a Wall Street data feed built by competing AI predictors instead of one company.",
  },
  29: {
    blurb: "Competing researchers find safety problems in AI models before they're deployed.",
    analogy: "Like a bug bounty program for AI safety — find the flaw, prove it, get paid.",
  },
  31: {
    blurb: "Runs competitions to find the most efficient AI model designs — beat Google's own benchmark.",
    analogy: "Like a Formula 1 design competition, but for AI brains instead of race cars.",
  },
  32: {
    blurb: "Detects whether text was written by a human or an AI — ranked #1 globally, beating GPTZero.",
    analogy: "Like Turnitin for the AI era — schools and publishers use it to check authorship.",
  },
  35: {
    blurb: "Pools shared money and automatically spreads it across trading markets to keep trades flowing.",
    analogy: "Like a neighborhood fund where everyone chips in and a smart system puts it to work.",
  },
  36: {
    blurb: "AI agents browse websites and complete tasks — filling forms, extracting data, clicking through flows.",
    analogy: "Like a virtual assistant that uses a browser the exact same way you do.",
  },
  37: {
    blurb: "AI models compete to prove they're better — stress-tested for mistakes, winners published on HuggingFace.",
    analogy: "Like a quality control lab for AI — nothing ships until it passes the test.",
  },
  38: {
    blurb: "Thousands of computers work together to train one large AI model, each handling a small piece.",
    analogy: "Like a barn raising — everyone contributes and together they build something none could alone.",
  },
  39: {
    blurb: "Was a verified GPU rental marketplace — the founding company (Covenant AI) left Bittensor in April 2026.",
    analogy: "Like a rental car company that guaranteed every car worked — but the owner just closed up shop.",
  },
  40: {
    blurb: "Finds the optimal way to split long documents before feeding them to AI — better chunks, better answers.",
    analogy: "Like deciding how to slice a textbook — the cut affects how well the student understands it.",
  },
  41: {
    blurb: "An AI sports prediction system that bets automatically on Polymarket — $17K profit in one month.",
    analogy: "Like a sports analyst robot that places its own bets and shows you the receipts.",
  },
  43: {
    blurb: "Solves complex routing problems and builds a copy-trading tool to follow the best crypto traders.",
    analogy: "Like a GPS that plans the perfect route — and lets you copy the best driver.",
  },
  44: {
    blurb: "Analyzes a full 90-minute match in 2 minutes for $10 — tracking every player's movement and speed.",
    analogy: "Like the ESPN tracking stats, available to any team at a fraction of the cost.",
  },
  45: {
    blurb: "An AI coding assistant improved daily by global competition — far cheaper than GitHub Copilot.",
    analogy: "Like GitHub Copilot, but the best model wins the job every day instead of holding it forever.",
  },
  46: {
    blurb: "A free property data API with 100+ attributes per home — pulling from Zillow, Redfin, and public records.",
    analogy: "Like a free Zillow database anyone can query — contributors get paid for the data they add.",
  },
  47: {
    blurb: "Compresses text sent to AI by 35–45% — same meaning, lower cost to process.",
    analogy: "Like a zip file for AI prompts — same message, lower cost.",
  },
  48: {
    blurb: "Predicts real estate prices with AI — claims to be more accurate than Zillow's Zestimate.",
    analogy: "Like a Zestimate, powered by competing AI models instead of one algorithm.",
  },
  49: {
    blurb: "AI systems compete in realistic simulations to train robot and drone autopilot software.",
    analogy: "Like a flight simulator tournament — the best virtual pilot becomes a real autopilot.",
  },
  50: {
    blurb: "Predicts prices for Bitcoin, gold, and stocks — live on Polymarket, 110% return in an early test.",
    analogy: "Like a financial forecaster that shows its work and lets anyone check the track record.",
  },
  51: {
    blurb: "Rent powerful AI-grade GPUs for 90% less than RunPod or Vast.ai — and actually faster.",
    analogy: "Like renting a high-end camera locally instead of from the big brand — same quality, fraction of the price.",
  },
  52: {
    blurb: "Labels and organizes raw data for AI training — a cheaper, decentralized alternative to Scale AI.",
    analogy: "Like workers sorting mail — tedious but essential, and AI can't learn without it.",
  },
  54: {
    blurb: "Creates fake identities and biometric data so banks can test whether their fraud detection actually works.",
    analogy: "Like hiring actors to attempt a heist so you can test your bank's security first.",
  },
  55: {
    blurb: "Predicts Bitcoin's price every 5 minutes, one hour ahead — using professional Coin Metrics data.",
    analogy: "Like a short-range weather forecast — not perfect, but consistently better than guessing.",
  },
  56: {
    blurb: "Fine-tunes AI models for $5/hr instead of $30–60/hr on AWS — life sciences companies already use it.",
    analogy: "Like renting a professional kitchen during off-hours — same equipment, 10% of the price.",
  },
  57: {
    blurb: "Combines location, weather, and sensor data — AI models compete to make the best predictions.",
    analogy: "Like a weather station network crossed with a competition — whoever predicts best wins.",
  },
  58: {
    blurb: "A marketplace where AI agents hire other AI services and pay per use — as little as $0.0001, no fees.",
    analogy: "Like a vending machine for AI services — the agent inserts a tiny coin, gets the result, moves on.",
  },
  59: {
    blurb: "Translates speech in real time — so fast the translation starts before you finish talking.",
    analogy: "Like a live interpreter who's already speaking your words before you've finished.",
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
    blurb: "Simulates quantum computing on regular hardware — test quantum algorithms without a real quantum computer.",
    analogy: "Like a flight simulator for quantum computers — practice before the actual machine is built.",
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
    blurb: "AI assistants compete to manage cloud servers from plain English instructions — most accurate wins.",
    analogy: "Like a hiring competition for robot IT managers — same job list, best result gets hired.",
  },
  67: {
    blurb: "Borrow money against your Bittensor tokens without selling them — long-only, no shorting subnets.",
    analogy: "Like a home equity loan for your crypto — borrow without giving it up.",
  },
  68: {
    blurb: "Scans 65 billion drug molecules to find lab-worthy candidates — 79% more accurate than older methods.",
    analogy: "Like a robot that reads every medical textbook and tells you which experiments are worth running.",
  },
  70: {
    blurb: "Verifies whether claims in text, audio, and video are true or false at internet scale.",
    analogy: "Like a real-time fact-checker that works across articles, videos, and podcasts.",
  },
  71: {
    blurb: "Monitors job postings, funding rounds, and tech changes to find companies ready to buy right now.",
    analogy: "Like a radar showing which businesses are about to start shopping — before they call any vendors.",
  },
  72: {
    blurb: "Builds maps from dashcam footage — 85% cheaper than HERE or TomTom, 250K drivers contributing.",
    analogy: "Like Google Street View, except ordinary drivers earn crypto for every kilometer they map.",
  },
  73: {
    blurb: "A private marketplace where Bittensor miners sell subnet tokens at fair prices without flooding the market.",
    analogy: "Like a private auction for rare coins — sellers get a fair price without crashing the open market.",
  },
  74: {
    blurb: "Pays developers crypto every time their code gets merged into an open-source GitHub project.",
    analogy: "Like tipping a musician every time their song plays — but for programmers and code.",
  },
  75: {
    blurb: "Decentralized file storage for 60% less than Amazon S3 — using tools developers already know.",
    analogy: "Like a storage unit that costs half the price and you can verify the bill publicly.",
  },
  77: {
    blurb: "Token holders vote on which trading pairs deserve the most liquidity — providers get rewarded.",
    analogy: "Like a community deciding which products deserve shelf space, and paying suppliers who stock them.",
  },
  78: {
    blurb: "Gives AI agents long-term memory and ethical reasoning — so they don't forget or act badly.",
    analogy: "Like giving an AI a diary and a conscience — it remembers what happened and thinks before acting.",
  },
  79: {
    blurb: "AI trading agents compete in simulated stock markets — winning strategies get published for researchers.",
    analogy: "Like a trading video game where the winners' strategies get used in real financial research.",
  },
  80: {
    blurb: "AI models grade and improve other AI outputs — a self-improving loop where the AI marks its own work.",
    analogy: "Like a teacher who is also a student — the AI marks its own homework and gets smarter from it.",
  },
  81: {
    blurb: "Thousands of computers each train a small piece of one shared AI model and send progress to a common ledger.",
    analogy: "Like a global science project — every student runs the same experiment at home and the results combine.",
  },
  82: {
    blurb: "Lets AI agents query live blockchain data in real time — built by SubQuery.",
    analogy: "Like giving an AI direct read access to every crypto transaction ever made.",
  },
  83: {
    blurb: "Solves hard network math problems used in drug discovery, fraud detection, and logistics.",
    analogy: "Like a distributed brain for puzzles that regular computers take too long to crack.",
  },
  84: {
    blurb: "AI competition to design computer chips — winners get open-sourced and can be physically fabricated.",
    analogy: "Like a chip design competition where the best blueprint gets turned into real hardware.",
  },
  85: {
    blurb: "Upscales and restores old or blurry video — beats Topaz on quality while shrinking file size 95%.",
    analogy: "Like a film restoration service — old footage comes out looking like it was shot in 4K.",
  },
  86: {
    blurb: "Trains AI customer service agents for e-commerce — handles questions in multiple languages automatically.",
    analogy: "Like hiring a customer service rep who speaks 10 languages and never needs a day off.",
  },
  87: {
    blurb: "Independent analysts give crypto projects credit ratings using a rigorous 40-page methodology.",
    analogy: "Like Moody's for crypto — analysts can't compare notes, so the scores can't be coordinated.",
  },
  88: {
    blurb: "AI trading strategies compete in a decentralized quant fund — 92% returns in 3 months, 2.2% drawdown.",
    analogy: "Like a hedge fund where the managers are AI and performance is verified publicly.",
  },
  89: {
    blurb: "A Bitcoin mining pool that permanently uses all profits to buy Bittensor tokens.",
    analogy: "Like a money printing machine that donates everything it prints to one cause — forever.",
  },
  91: {
    blurb: "Blocks cyberattacks at the network level — a decentralized alternative to Cloudflare.",
    analogy: "Like a neighborhood watch for the internet — thousands of independent lookouts instead of one company.",
  },
  92: {
    blurb: "AI that writes full game storylines — characters, dialogue, and plot arcs — via API.",
    analogy: "Like hiring a novelist on demand — never gets writer's block, charges by the word.",
  },
  93: {
    blurb: "A podcast platform where creators get paid directly by listeners — $1,200+ CPM vs $50–100 on Spotify.",
    analogy: "Like Spotify, but the money goes to the podcaster instead of the platform.",
  },
  94: {
    blurb: "AI models compete to genuinely improve — 90% of rewards are burned unless you prove you built something better.",
    analogy: "Like natural selection for AI — only the truly fittest survive and get paid.",
  },
  95: {
    blurb: "Enterprise AI agent infrastructure backed by Jack Clark, co-founder of Anthropic.",
    analogy: "Like hiring a team of AI employees for your business — backed by one of the biggest names in AI.",
  },
  96: {
    blurb: "Verifies AI outputs meet quality standards before delivery — an independent QA layer.",
    analogy: "Like a product inspector on a factory line — nothing ships until it's checked.",
  },
  97: {
    blurb: "Runs blockchain node infrastructure for Ethereum, SUI, and Bittensor — no single company can cut access.",
    analogy: "Like the electricity grid for crypto developers — nobody owns it, but everyone can plug in.",
  },
  98: {
    blurb: "A launchpad for AI bots — developers build them, the network runs them, best performers earn rewards.",
    analogy: "Like a talent show for AI robots — the most popular ones keep getting booked.",
  },
  99: {
    blurb: "AI models compete to generate video from text descriptions — a decentralized alternative to Sora.",
    analogy: "Like AI-generated YouTube Shorts — describe the scene and it appears.",
  },
  100: {
    blurb: "Runs AI coding competitions in locked, tamper-proof environments — best results used in real products.",
    analogy: "Like a proctored exam for AI assistants — same test, locked room, top scorers get hired.",
  },
  103: {
    blurb: "Sports picks sealed cryptographically before sale — nobody can steal the tip. Odds verified on-chain.",
    analogy: "Like a sealed-bid auction for sports predictions — the tip is sold before anyone can see it.",
  },
  105: {
    blurb: "Moves data using idle bandwidth from homes and data centers — verified on-chain, built for AI pipelines.",
    analogy: "Like a courier network of regular people with spare car space instead of one big delivery company.",
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
