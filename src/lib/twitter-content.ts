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

const TWEET_SYSTEM = `You are @AlphaGapTAO — a sharp, concise signal account tracking Bittensor subnets.

HARD LIMIT: Your entire tweet must be 260 characters or fewer. Count every character including spaces, line breaks, and emojis (emojis = 2 chars each).

Format (strict — fit it ALL in 260 chars):
[Subnet] (SN[X]) — [punchy headline] [emoji]

[1-2 key facts in plain English]

[1-sentence insight]

→ alphagap.io | $TOKEN #Bittensor

Rules:
- Numbers always paired with plain English meaning
- No hype words (moon, gem, LFG, DYOR)
- Confident, specific, human
- If you're near the limit, cut words — never exceed 260 chars`;

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
        max_tokens: 400,
        system: TWEET_SYSTEM,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return [];
    const data = await res.json() as { content: Array<{ text: string }> };
    const raw = data.content[0]?.text?.trim() ?? "";
    const tweets = raw.split("---NEXT---").map((t) => t.trim()).filter(Boolean);

    // Enforce 280-char limit — truncate at last whitespace before limit
    return tweets.map((t) => {
      if (t.length <= 280) return t;
      const cut = t.slice(0, 277);
      const lastSpace = cut.lastIndexOf(" ");
      return (lastSpace > 200 ? cut.slice(0, lastSpace) : cut) + "…";
    });
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

  const prompt = `Write a tweet about this Bittensor subnet whose intelligence score just jumped significantly.

Data:
- Subnet: ${subnet.name} (SN${subnet.netuid})
- aGap score: jumped ${fmtPct(subnet.composite_score_change)} to ${subnet.composite_score}/100
- What drove it: ${driversLine}
- Dev score: ${subnet.dev_score} | Flow: ${subnet.flow_score} | Eval: ${subnet.eval_score} | Social: ${subnet.social_score}
- Price 24h: ${fmtPct(subnet.price_change_24h)} | MCap: ${fmtMcap(subnet.market_cap)}

Use the format from your system prompt. Headline = "[Subnet] (SN[X]) — aGap score surging 🚨"
Bullet points should cover: what drove the score jump (explain each driver in plain English), what the price is doing vs the score, what the market cap context means.
AlphaGap take: is the price lagging the building activity? Is this early? What's the key thing to watch?
End bullets with "$${subnet.name.toUpperCase()} #Bittensor"`;



  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "agap_riser",
    tweets,
    rationale: `aGap riser: ${subnet.name} +${subnet.composite_score_change?.toFixed(0)} pts (${driversLine})`,
  };
}

// ── 2. Dev Update (from /signals) ────────────────────────────────
// Brief summary of a high-scoring dev signal — much shorter than the full signal card.

export async function generateDevUpdate(signal: DevSignal): Promise<TweetPost | null> {
  const prompt = `Write a tweet about something a Bittensor subnet just shipped.

Data:
- Subnet: ${signal.name} (SN${signal.netuid})
- What was built: ${signal.title}
- Detail: ${signal.description}
- Dev score: ${signal.score}/100

Use the format from your system prompt. Headline = "[Subnet] (SN[X]) — [what was shipped, very brief] 🚨"
Bullet points should cover: what was actually built in plain English, why this capability matters or what problem it solves, what it signals about the team's execution pace.
AlphaGap take: what does this shipping activity mean for the subnet's trajectory? Is the market likely aware yet?
End with "$${signal.name.toUpperCase()} #Bittensor"`;


  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "dev_update",
    tweets,
    rationale: `Dev update: ${signal.name} (SN${signal.netuid}) — ${signal.title}`,
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

  const prompt = `Write a tweet about unusual accumulation/volume activity in a Bittensor subnet.

Data:
- Subnet: ${subnet.name} (SN${subnet.netuid})
- Signal: ${signalType}
- Price 24h: ${fmtPct(subnet.price_change_24h)} | 7d: ${fmtPct(subnet.price_change_7d)} | MCap: ${fmtMcap(subnet.market_cap)}
- aGap score: ${subnet.composite_score}/100 | Dev: ${subnet.dev_score} | Flow: ${subnet.flow_score}

Use the format from your system prompt. Headline = "${subnet.name} (SN${subnet.netuid}) — accumulation signal 🚨"
Bullet points should cover: what the whale/volume signal means in plain English (someone is quietly buying), what the price has done vs the accumulation (is price still flat = early?), what the underlying fundamentals look like (is there actual building justifying the interest?).
AlphaGap take: what's the thesis here — why might smart money be positioning before the broader market? What's the risk?
End with "$${subnet.name.toUpperCase()} #Bittensor"`;


  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "whale_flow",
    tweets,
    rationale: `Whale/volume: ${subnet.name} — ${signalType}`,
  };
}

// ── 4. Discord Alpha (/social) ────────────────────────────────────

export async function generateDiscordAlpha(entry: DiscordEntry): Promise<TweetPost | null> {
  const insights = entry.keyInsights.slice(0, 3).join("\n- ");

  const prompt = `Write a tweet about something being discussed in a Bittensor subnet's Discord that the broader market doesn't know yet.

Data:
- Subnet: ${entry.subnetName}${entry.netuid ? ` (SN${entry.netuid})` : ""}
- What's being discussed: ${entry.summary}
- Key points: ${insights}
- Alpha score: ${entry.alphaScore ?? "n/a"}/100

Use the format from your system prompt. Headline = "${entry.subnetName} Discord alpha 🚨" (use 🔊 instead of 🚨 if it feels more fitting)
Bullet points should cover: what is actually happening (explain simply), the key insight from the Discord, why the community is paying attention to this.
AlphaGap take: why does this Discord activity matter? Is this the kind of early signal that precedes price movement? What should someone watching this subnet do with this information?
End with "Spotted by @AlphaGapTAO → alphagap.io/social"`;


  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "discord_alpha",
    tweets,
    rationale: `Discord alpha: ${entry.subnetName} — ${entry.summary.slice(0, 80)}`,
  };
}

// ── 5. X Trending (/social) ───────────────────────────────────────

export async function generateXTrending(entries: SocialTrendEntry[]): Promise<TweetPost | null> {
  if (!entries.length) return null;
  const top3 = entries.slice(0, 3);

  const lines = top3.map((e, i) =>
    `${i + 1}. ${e.subnetName}${e.netuid ? ` (SN${e.netuid})` : ""}${e.tweetCount ? ` — ${e.tweetCount} mentions` : ""}${e.topInsight ? ` — "${e.topInsight}"` : ""}`
  ).join("\n");

  const prompt = `Write a tweet about which Bittensor subnets are trending on X right now and why it matters.

Data:
${lines}

Use the format from your system prompt. Headline = "Bittensor trending on X right now 🚨"
Bullet points: one per subnet — what the conversation is actually about and why people are talking about it (not just "X mentions").
AlphaGap take: what does this social activity mean? Is this hype catching up to fundamentals, or is sentiment running ahead of what's actually being built? What should someone watching these subnets know?
End with "→ alphagap.io/social #Bittensor"`;


  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "x_trending",
    tweets,
    rationale: `X trending: ${top3.map(e => e.subnetName).join(", ")}`,
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

  const prompt = `Write a tweet about which Bittensor subnets are punching above their weight right now.

Data:
- Metric: ${ratioLabel} (measures which subnets generate the most relative to their market size)
- Top 3: ${lines}

Use the format from your system prompt. Headline = "Bittensor subnets punching above their weight 🚨"
Bullet points: one per subnet — explain in plain English why this subnet leading the metric is notable. What does a high ${ratioLabel} actually mean for an investor? What does it suggest about valuation?
AlphaGap take: what's the overall picture — are these subnets undervalued relative to what they're producing? What's the key opportunity here?
End with "→ alphagap.io/analytics #Bittensor"`;


  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "analytics_ratios",
    tweets,
    rationale: `Analytics top 3 by ${ratioLabel}: ${top3.map(e => e.name).join(", ")}`,
  };
}

// ── 7. Benchmark Update (/benchmarks) ────────────────────────────

export async function generateBenchmarkUpdate(entry: BenchmarkEntry): Promise<TweetPost | null> {
  const isBeating = (entry.delta ?? 0) > 0;
  if (!isBeating && !entry.isNew) return null;

  const compLine = entry.centralizedName && entry.centralizedScore != null
    ? `vs ${entry.centralizedName} (${entry.centralizedScore.toFixed(1)})`
    : "vs centralised baseline";

  const prompt = `Write a tweet about a decentralised Bittensor subnet ${isBeating ? "beating" : "matching"} a centralised AI competitor on a benchmark.

Data:
- Subnet: ${entry.subnetName} (SN${entry.netuid})
- Task: ${entry.taskName}
- Subnet score: ${entry.score.toFixed(1)}
${entry.centralizedScore != null ? `- Competitor: ${compLine}` : ""}
${entry.delta != null && entry.delta > 0 ? `- Margin: ahead by ${entry.delta.toFixed(1)} points` : ""}

Use the format from your system prompt. Headline = "${entry.subnetName} vs centralised AI 🚨" (use 🏆 if clearly beating)
Bullet points: explain what the benchmark task actually tests in plain English, what the scores mean in practical terms (not just numbers), why a decentralised network winning here is significant.
AlphaGap take: what does this result mean for the subnet's long-term thesis? If decentralised AI is proving itself in this domain, what's the investment implication?
End with "$${entry.subnetName.toUpperCase()} #Bittensor"`;


  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "benchmark_update",
    tweets,
    rationale: `Benchmark: ${entry.subnetName} scored ${entry.score.toFixed(1)} on ${entry.taskName} ${isBeating ? `(beats ${entry.centralizedName ?? "centralised"})` : "(new)"}`,
  };
}

// ── 8. Performance / Max Return (/performance) ───────────────────
// Highlights subnets where aGap ≥80 signal fired, shows buy price vs now vs max gain.

export async function generatePerformanceGain(entry: PerformanceEntry): Promise<TweetPost | null> {
  const prompt = `Write a tweet showing that AlphaGap called a move before the market.

Data:
- Subnet: ${entry.name} (SN${entry.netuid})
- When AlphaGap flagged it: ${new Date(entry.signalDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at ${fmtPrice(entry.priceAtSignal)}
- Max gain from signal price: ${fmtPct(entry.maxGainPct)}
- Current gain from signal price: ${fmtPct(entry.currentGainPct)}

Use the format from your system prompt. Headline = "${entry.name} — AlphaGap called it early 🚨"
Bullet points: when and why AlphaGap flagged this subnet (building quietly, price was flat), what happened to the price after the signal, what the max gain looked like for people who acted on it.
AlphaGap take: what does this example show about the alpha gap thesis — why does tracking development activity before the market notices it tend to lead to price moves? What's the lesson for signal followers?
End with "Full track record → alphagap.io/performance"`;


  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "performance_gain",
    tweets,
    rationale: `Performance: ${entry.name} flagged at ${fmtPrice(entry.priceAtSignal)}, max gain ${fmtPct(entry.maxGainPct)}`,
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
