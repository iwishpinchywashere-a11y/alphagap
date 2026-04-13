// Content generator for @AlphaGapTAO automated posts
//
// 8 post types (strict — no others):
//  1. agap_riser        — significant aGap score rise and why
//  2. dev_update        — high-scoring dev signal from /signals (brief)
//  3. whale_flow        — whale buy / smart money / volume surge from /whales
//  4. discord_alpha     — Discord alpha drop from /social
//  5. x_trending        — subnet trending on X and why, from /social
//  6. analytics_ratios  — top 3 subnets by plot-chart ratio on /analytics
//  7. benchmark_update  — new benchmark result beating centralised competitor
//  8. performance_gain  — /performance max-return stat (aGap ≥80 signal → price now → max % gain)

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";

// ── Shared data shapes ────────────────────────────────────────────

export interface SubnetScore {
  netuid: number;
  name: string;
  composite_score: number;
  composite_score_change?: number;   // delta since last scan
  flow_score: number;
  flow_score_change?: number;
  dev_score: number;
  dev_score_change?: number;
  eval_score: number;
  eval_score_change?: number;
  social_score: number;
  social_score_change?: number;
  velo_score?: number;
  velo_score_change?: number;
  product_score?: number;
  product_score_change?: number;
  alpha_price?: number;
  market_cap?: number;
  price_change_7d?: number;
  price_change_24h?: number;
  whale_signal?: string | null;
  volume_surge?: boolean;
  volume_surge_ratio?: number;
  emission_pct?: number;
  emission_trend?: string | null;
}

export interface DiscordEntry {
  subnetName: string;
  netuid: number | null;
  summary: string;
  keyInsights: string[];
  alphaScore?: number;
  scannedAt: string;
}

export interface DevSignal {
  name: string;
  netuid: number;
  title: string;
  description: string;
  score: number;
  created_at: string;
}

export interface SocialTrendEntry {
  subnetName: string;
  netuid: number;
  tweetCount?: number;
  sentiment?: string;
  topInsight?: string;
  scannedAt: string;
}

export interface AnalyticsEntry {
  netuid: number;
  name: string;
  ratio: number;          // e.g. emission/mcap or custom chart ratio
  ratioLabel?: string;    // human-readable label for the ratio
  composite_score: number;
}

export interface BenchmarkEntry {
  netuid: number;
  subnetName: string;
  taskName: string;
  score: number;           // subnet's benchmark score
  centralizedScore?: number;  // competitor score (e.g. GPT-4o)
  centralizedName?: string;
  delta?: number;          // positive = beating centralised
  updatedAt: string;
  isNew?: boolean;
}

export interface PerformanceEntry {
  netuid: number;
  name: string;
  agapScoreAtSignal: number;   // score when aGap hit ≥80
  priceAtSignal: number;
  priceNow: number;
  maxPrice?: number;
  maxGainPct: number;          // max % gain from signal price to max price
  currentGainPct: number;      // current price vs signal price
  signalDate: string;
}

// ── TweetPost ─────────────────────────────────────────────────────

export type PostType =
  | "agap_riser"
  | "dev_update"
  | "whale_flow"
  | "discord_alpha"
  | "x_trending"
  | "analytics_ratios"
  | "benchmark_update"
  | "performance_gain";

export interface TweetPost {
  type: PostType;
  tweets: string[];   // 1 = single tweet, 2+ = thread
  rationale: string;
  screenshotPath?: string;   // optional alphagap.io path to screenshot
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtMcap(v?: number): string {
  if (!v) return "";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}

function fmtPct(v?: number | null): string {
  if (v == null) return "";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function fmtPrice(v?: number): string {
  if (!v) return "";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
}

// ── AI tweet writer ───────────────────────────────────────────────

const TWEET_SYSTEM = `You are @AlphaGapTAO — a sharp, plain-English crypto signal account for Bittensor.

Voice rules:
- Write for someone curious about crypto/AI who doesn't follow Bittensor daily
- NEVER list raw scores or numbers alone — always explain what they mean in plain English
- Lead with the interesting thing: what is happening and why it matters
- Be specific but human: "builders are shipping fast" not "Dev score: 85"
- One clear point per tweet. No bullet lists. No jargon dumps.
- Max 1 emoji. No hype words (moon, gem, alpha, LFG, DYOR).
- Under 270 characters per tweet.`;

async function writeTweet(prompt: string): Promise<string[]> {
  if (!ANTHROPIC_KEY) return [];

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: TWEET_SYSTEM,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return [];
    const data = await res.json() as { content: Array<{ text: string }> };
    const text = data.content[0]?.text?.trim() ?? "";
    return text.split("---NEXT---").map((t) => t.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// ── 1. aGap Riser ─────────────────────────────────────────────────
// Fired when a subnet's composite score rises significantly.
// The tweet explains WHICH sub-scores drove the rise.

export async function generateAgapRiser(subnet: SubnetScore): Promise<TweetPost | null> {
  // Build a list of which scores moved
  const drivers: string[] = [];
  if ((subnet.velo_score_change ?? 0) >= 5) drivers.push(`Velocity +${subnet.velo_score_change?.toFixed(0)}`);
  if ((subnet.flow_score_change ?? 0) >= 5) drivers.push(`Flow +${subnet.flow_score_change?.toFixed(0)}`);
  if ((subnet.dev_score_change ?? 0) >= 5) drivers.push(`Dev +${subnet.dev_score_change?.toFixed(0)}`);
  if ((subnet.eval_score_change ?? 0) >= 5) drivers.push(`Eval +${subnet.eval_score_change?.toFixed(0)}`);
  if ((subnet.product_score_change ?? 0) >= 5) drivers.push(`Product +${subnet.product_score_change?.toFixed(0)}`);
  if ((subnet.social_score_change ?? 0) >= 5) drivers.push(`Social +${subnet.social_score_change?.toFixed(0)}`);
  if ((subnet.emission_trend) === "rising") drivers.push("Emissions rising");

  const driversLine = drivers.length > 0 ? drivers.join(" · ") : "multiple sub-scores improving";

  const prompt = `Write ONE tweet about this Bittensor subnet that suddenly became much more interesting.

Subnet: ${subnet.name} (SN${subnet.netuid})
What changed: aGap score jumped ${fmtPct(subnet.composite_score_change)} to ${subnet.composite_score}/100
Why it jumped: ${driversLine}
Price so far: ${fmtPct(subnet.price_change_24h)} in 24h | Market cap: ${fmtMcap(subnet.market_cap)}

Explain what drove the jump in plain English — what does it mean that ${driversLine.toLowerCase()}? Why should someone pay attention? Price hasn't caught up yet if it's flat/down.
End with "$${subnet.name.toUpperCase()} #Bittensor"`;

  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "agap_riser",
    tweets,
    rationale: `aGap riser: ${subnet.name} +${subnet.composite_score_change?.toFixed(0)} pts (${driversLine})`,
    screenshotPath: "/dashboard",
  };
}

// ── 2. Dev Update (from /signals) ────────────────────────────────
// Brief summary of a high-scoring dev signal — much shorter than the full signal card.

export async function generateDevUpdate(signal: DevSignal): Promise<TweetPost | null> {
  const prompt = `Write ONE tweet about something a Bittensor subnet just shipped.

Subnet: ${signal.name} (SN${signal.netuid})
What happened: ${signal.title}
Detail: ${signal.description}

Explain what was actually built and why it's a meaningful step forward — what problem does it solve or what capability does it add? Keep it concrete, not hype.
End with "$${signal.name.toUpperCase()} #Bittensor"`;

  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "dev_update",
    tweets,
    rationale: `Dev update: ${signal.name} (SN${signal.netuid}) — ${signal.title}`,
    screenshotPath: "/signals",
  };
}

// ── 3. Whale Flow / Volume Surge (/whales) ────────────────────────

export async function generateWhaleFlow(subnet: SubnetScore): Promise<TweetPost | null> {
  const isVolumeSurge = subnet.volume_surge && (subnet.volume_surge_ratio ?? 0) >= 2;
  const isWhale = subnet.whale_signal === "accumulating";

  if (!isVolumeSurge && !isWhale) return null;

  const signalType = isWhale && isVolumeSurge
    ? `Whale accumulation + volume surge (${subnet.volume_surge_ratio?.toFixed(1)}× normal)`
    : isWhale
    ? "Smart money accumulation detected"
    : `Volume surge (${subnet.volume_surge_ratio?.toFixed(1)}× normal volume)`;

  const prompt = `Write ONE tweet about unusual buying activity in a Bittensor subnet.

Subnet: ${subnet.name} (SN${subnet.netuid})
What's happening: ${signalType}
Price context: ${fmtPct(subnet.price_change_24h)} in 24h, ${fmtPct(subnet.price_change_7d)} in 7d | MCap: ${fmtMcap(subnet.market_cap)}
Fundamentals: the subnet scores well on development activity and is actively building

Explain what the unusual activity suggests — someone is buying before the broader market notices. Mention whether price has moved yet or if this looks early.
End with "#Bittensor #TAO"`;

  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "whale_flow",
    tweets,
    rationale: `Whale/volume: ${subnet.name} — ${signalType}`,
    screenshotPath: "/whales",
  };
}

// ── 4. Discord Alpha (/social) ────────────────────────────────────

export async function generateDiscordAlpha(entry: DiscordEntry): Promise<TweetPost | null> {
  const insights = entry.keyInsights.slice(0, 3).join("\n- ");

  const prompt = `Write a 2-tweet thread about something being discussed in a Bittensor subnet's Discord before the broader market knows.

Subnet: ${entry.subnetName}${entry.netuid ? ` (SN${entry.netuid})` : ""}
What's being discussed: ${entry.summary}
Key points:
- ${insights}

Tweet 1: What is actually happening — explain it simply so anyone can understand. Start with "🔊" or "⚡ ${entry.subnetName}:"
Tweet 2: Why this matters and what it could mean for the subnet going forward. End with "Spotted by @AlphaGapTAO → alphagap.io/social"
Separate with ---NEXT---`;

  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "discord_alpha",
    tweets,
    rationale: `Discord alpha: ${entry.subnetName} — ${entry.summary.slice(0, 80)}`,
    screenshotPath: "/social",
  };
}

// ── 5. X Trending (/social) ───────────────────────────────────────

export async function generateXTrending(entries: SocialTrendEntry[]): Promise<TweetPost | null> {
  if (!entries.length) return null;
  const top3 = entries.slice(0, 3);

  const lines = top3.map((e, i) =>
    `${i + 1}. ${e.subnetName}${e.netuid ? ` (SN${e.netuid})` : ""}${e.tweetCount ? ` — ${e.tweetCount} mentions` : ""}${e.topInsight ? ` — "${e.topInsight}"` : ""}`
  ).join("\n");

  const prompt = `Write ONE tweet about which Bittensor subnets are getting attention on X right now and why that matters.

Top subnets being talked about:
${lines}

Don't just list them — explain what the conversation is about and why the buzz is worth paying attention to. What are people excited or concerned about?
End with "→ alphagap.io/social #Bittensor"`;

  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "x_trending",
    tweets,
    rationale: `X trending: ${top3.map(e => e.subnetName).join(", ")}`,
    screenshotPath: "/social",
  };
}

// ── 6. Analytics Ratios — top 3 (/analytics) ─────────────────────

export async function generateAnalyticsRatios(entries: AnalyticsEntry[]): Promise<TweetPost | null> {
  if (entries.length < 3) return null;
  const top3 = entries.slice(0, 3);

  const ratioLabel = top3[0].ratioLabel ?? "efficiency ratio";
  const lines = top3.map((e, i) =>
    `${i + 1}. ${e.name} (SN${e.netuid}) — ratio: ${e.ratio.toFixed(2)} | aGap: ${e.composite_score}`
  ).join("\n");

  const prompt = `Write ONE tweet explaining which Bittensor subnets are getting the most output relative to their size right now.

The metric (${ratioLabel}) basically measures: which subnets are punching above their weight?
Top 3:
${lines}

Explain in plain English what it means to lead this metric and why it's relevant for spotting undervalued subnets. Don't list the raw numbers — say what they imply.
End with "→ alphagap.io/analytics #Bittensor"`;

  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "analytics_ratios",
    tweets,
    rationale: `Analytics top 3 by ${ratioLabel}: ${top3.map(e => e.name).join(", ")}`,
    screenshotPath: "/analytics",
  };
}

// ── 7. Benchmark Update (/benchmarks) ────────────────────────────

export async function generateBenchmarkUpdate(entry: BenchmarkEntry): Promise<TweetPost | null> {
  const isBeating = (entry.delta ?? 0) > 0;
  if (!isBeating && !entry.isNew) return null;

  const compLine = entry.centralizedName && entry.centralizedScore != null
    ? `vs ${entry.centralizedName} (${entry.centralizedScore.toFixed(1)})`
    : "vs centralised baseline";

  const prompt = `Write ONE tweet about a decentralised AI network ${isBeating ? "beating" : "being measured against"} a centralised competitor.

Subnet: ${entry.subnetName} (SN${entry.netuid})
Task: ${entry.taskName}
${entry.centralizedScore != null ? `Result: decentralised network vs ${compLine}` : `Result: new benchmark score ${entry.score.toFixed(1)}`}
${entry.delta != null && entry.delta > 0 ? `Edge: ahead by ${entry.delta.toFixed(1)} points` : ""}

Explain what the task is in simple terms and why it matters that ${isBeating ? "a decentralised subnet is winning" : "this is being tracked"}. Make the comparison feel real — not just numbers.
End with "$${entry.subnetName.toUpperCase()} #Bittensor"`;

  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "benchmark_update",
    tweets,
    rationale: `Benchmark: ${entry.subnetName} scored ${entry.score.toFixed(1)} on ${entry.taskName} ${isBeating ? `(beats ${entry.centralizedName ?? "centralised"})` : "(new)"}`,
    screenshotPath: "/benchmarks",
  };
}

// ── 8. Performance / Max Return (/performance) ───────────────────
// Highlights subnets where aGap ≥80 signal fired, shows buy price vs now vs max gain.

export async function generatePerformanceGain(entry: PerformanceEntry): Promise<TweetPost | null> {
  const prompt = `Write a 2-tweet thread showing that an AlphaGap signal called a move before the market.

Subnet: ${entry.name} (SN${entry.netuid})
When flagged: ${new Date(entry.signalDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at ${fmtPrice(entry.priceAtSignal)}
What happened: price went up ${fmtPct(entry.maxGainPct)} at its peak, currently ${fmtPct(entry.currentGainPct)} from the signal price

Tweet 1: Set the scene — AlphaGap spotted this subnet building quietly while the price sat still, then flagged it. Keep it conversational.
Tweet 2: What played out — the numbers tell the story here (use the actual % gains). End with "Track record → alphagap.io/performance"
Separate with ---NEXT---`;

  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "performance_gain",
    tweets,
    rationale: `Performance: ${entry.name} flagged at ${fmtPrice(entry.priceAtSignal)}, max gain ${fmtPct(entry.maxGainPct)}`,
    screenshotPath: "/performance",
  };
}

// ── Pick best post ────────────────────────────────────────────────
// Priority order matching the 8 approved post types.
// Skips types where no fresh/qualifying data exists.

export interface BotData {
  leaderboard: SubnetScore[];
  discordAlpha: DiscordEntry[];
  devSignals: DevSignal[];
  socialTrending?: SocialTrendEntry[];
  analyticsRatios?: AnalyticsEntry[];
  benchmarkUpdates?: BenchmarkEntry[];
  performanceGains?: PerformanceEntry[];
  alreadyPostedIds: Set<string>;
}

// ── Type rotation slots ───────────────────────────────────────────
// 4 runs per day (7am, 12pm, 5pm, 10pm UTC). Each slot has 2 preferred
// types (covering all 8 across the day) tried first, then falls back
// to any available type so a run is never wasted.
//
// Slot 0 → 7am:  agap_riser,       dev_update
// Slot 1 → 12pm: discord_alpha,    x_trending
// Slot 2 → 5pm:  whale_flow,       performance_gain
// Slot 3 → 10pm: analytics_ratios, benchmark_update

function getSlot(utcHour: number): 0 | 1 | 2 | 3 {
  if (utcHour < 10)  return 0;
  if (utcHour < 15)  return 1;
  if (utcHour < 20)  return 2;
  return 3;
}

export async function pickBestPost(data: BotData, utcHour?: number): Promise<TweetPost | null> {
  const {
    leaderboard,
    discordAlpha,
    devSignals,
    socialTrending = [],
    analyticsRatios = [],
    benchmarkUpdates = [],
    performanceGains = [],
    alreadyPostedIds,
  } = data;

  const slot = getSlot(utcHour ?? new Date().getUTCHours());

  // ── Candidate builders (lazily evaluated in order) ────────────────

  async function tryAgapRiser(): Promise<TweetPost | null> {
    const risers = leaderboard
      .filter((s) => (s.composite_score_change ?? 0) >= 8 && !alreadyPostedIds.has(`agap_riser_${s.netuid}`))
      .sort((a, b) => (b.composite_score_change ?? 0) - (a.composite_score_change ?? 0));
    return risers.length > 0 ? generateAgapRiser(risers[0]) : null;
  }

  async function tryDevUpdate(): Promise<TweetPost | null> {
    const freshDev = devSignals
      .filter((s) => {
        if (alreadyPostedIds.has(`dev_update_${s.netuid}`)) return false;
        const ageH = (Date.now() - new Date(s.created_at).getTime()) / 3600000;
        return ageH <= 24 && s.score >= 75;
      })
      .sort((a, b) => b.score - a.score);
    return freshDev.length > 0 ? generateDevUpdate(freshDev[0]) : null;
  }

  async function tryDiscordAlpha(): Promise<TweetPost | null> {
    const freshDiscord = discordAlpha
      .filter((d) => {
        if (!d.netuid || alreadyPostedIds.has(`discord_alpha_${d.netuid}`)) return false;
        const ageH = (Date.now() - new Date(d.scannedAt).getTime()) / 3600000;
        return ageH <= 6 && (d.alphaScore ?? 0) >= 80;
      })
      .sort((a, b) => (b.alphaScore ?? 0) - (a.alphaScore ?? 0));
    return freshDiscord.length > 0 && freshDiscord[0].netuid
      ? generateDiscordAlpha(freshDiscord[0] as DiscordEntry & { netuid: number })
      : null;
  }

  async function tryXTrending(): Promise<TweetPost | null> {
    return socialTrending.length > 0 && !alreadyPostedIds.has("x_trending_daily")
      ? generateXTrending(socialTrending)
      : null;
  }

  async function tryWhaleFlow(): Promise<TweetPost | null> {
    const whaleTargets = leaderboard
      .filter((s) => {
        if (alreadyPostedIds.has(`whale_flow_${s.netuid}`)) return false;
        return s.whale_signal === "accumulating" || ((s.volume_surge_ratio ?? 0) >= 2.5);
      })
      .sort((a, b) => b.composite_score - a.composite_score);
    return whaleTargets.length > 0 ? generateWhaleFlow(whaleTargets[0]) : null;
  }

  async function tryPerformanceGain(): Promise<TweetPost | null> {
    const perfGains = performanceGains
      .filter((p) => p.maxGainPct >= 50 && !alreadyPostedIds.has(`performance_gain_${p.netuid}`))
      .sort((a, b) => b.maxGainPct - a.maxGainPct);
    return perfGains.length > 0 ? generatePerformanceGain(perfGains[0]) : null;
  }

  async function tryAnalyticsRatios(): Promise<TweetPost | null> {
    return analyticsRatios.length >= 3 && !alreadyPostedIds.has("analytics_ratios_daily")
      ? generateAnalyticsRatios(analyticsRatios)
      : null;
  }

  async function tryBenchmarkUpdate(): Promise<TweetPost | null> {
    const freshBenchmarks = benchmarkUpdates
      .filter((b) => {
        if (alreadyPostedIds.has(`benchmark_update_${b.netuid}_${b.taskName}`)) return false;
        const ageH = (Date.now() - new Date(b.updatedAt).getTime()) / 3600000;
        return ageH <= 48 && ((b.delta ?? 0) > 0 || b.isNew);
      })
      .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
    return freshBenchmarks.length > 0 ? generateBenchmarkUpdate(freshBenchmarks[0]) : null;
  }

  // ── Slot-based priority order ─────────────────────────────────────
  // Preferred types for this slot come first; remaining 6 are the fallback.

  type Tryer = () => Promise<TweetPost | null>;

  const slotOrder: [Tryer, Tryer, ...Tryer[]][] = [
    // Slot 0 — 7am:  agap_riser, dev_update → rest
    [tryAgapRiser,      tryDevUpdate,      tryDiscordAlpha,   tryXTrending,      tryWhaleFlow,   tryPerformanceGain, tryAnalyticsRatios, tryBenchmarkUpdate],
    // Slot 1 — 12pm: discord_alpha, x_trending → rest
    [tryDiscordAlpha,   tryXTrending,      tryAgapRiser,      tryDevUpdate,      tryWhaleFlow,   tryPerformanceGain, tryAnalyticsRatios, tryBenchmarkUpdate],
    // Slot 2 — 5pm:  whale_flow, performance_gain → rest
    [tryWhaleFlow,      tryPerformanceGain, tryAgapRiser,     tryDevUpdate,      tryDiscordAlpha, tryXTrending,      tryAnalyticsRatios, tryBenchmarkUpdate],
    // Slot 3 — 10pm: analytics_ratios, benchmark_update → rest
    [tryAnalyticsRatios, tryBenchmarkUpdate, tryAgapRiser,    tryDevUpdate,      tryWhaleFlow,   tryPerformanceGain, tryDiscordAlpha,    tryXTrending],
  ];

  for (const tryer of slotOrder[slot]) {
    const post = await tryer();
    if (post) return post;
  }

  return null;
}
