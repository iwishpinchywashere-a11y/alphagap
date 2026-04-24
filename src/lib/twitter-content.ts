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
  dedupId: string;   // stable ID for 48h dedup (e.g. "whale_flow_82")
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

// FOOTER always appended — count it against budget
const FOOTER = "\n\nalphagap.io $TAO";
const FOOTER_LEN = FOOTER.length; // 18
const MAX_BODY = 260 - FOOTER_LEN; // 242 chars for the actual content

const TWEET_SYSTEM = `You are @AlphaGapTAO, a friendly analytics account covering Bittensor subnet intelligence.

Write ONE tweet in this exact 3-part format:

[emoji] [Subnet Name] (SN[X]) — [simple punchy headline]

[1-2 sentences in plain English explaining what's happening and why it's interesting — write like you're telling a friend, not writing a report. No jargon.]

[2-3 key numbers as short stats, e.g. "aGap 82 · Dev 91 · Price +9.5%"]

Hard rules:
- Total body under ${MAX_BODY} characters. The footer "alphagap.io $TAO" is added automatically — do NOT write it.
- No bullet points. No markdown. No headers.
- Plain English only — explain what the numbers actually mean, don't just list them.
- No trading advice, no "buy signals", no "smart money".
- Always use at least 2 emojis total (headline + anywhere in the body).

Good example:
🔍 Desearch (SN22) — on-chain traffic just spiked hard

Volume is running 3.5× higher than normal right now. The interesting thing? Price is only up 9.5% — the chain got busy before the price moved. 📈

aGap 82 · Dev 63 · Flow 77

Another good example:
🛠 Chutes (SN64) — team shipped async inference this week

They quietly pushed a major update that lets the network process more jobs in parallel. Dev score hit 91 — that's the highest in the entire top 10 right now. 💪

Dev 91 · aGap 78 · Price +4.2%`;

// Phrases that indicate Claude refused instead of writing a tweet.
const REFUSAL_SIGNALS = [
  "i need to decline", "i can't tweet", "i'm not able to",
  "i cannot tweet", "i appreciate the", "i can't assist",
  "i'm unable", "i must decline", "insider information",
];

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
        max_tokens: 200,           // enough for 3-line format, prevents over-generation
        system: TWEET_SYSTEM,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return [];
    const data = await res.json() as { content: Array<{ text: string }> };
    const raw = data.content[0]?.text?.trim() ?? "";

    if (REFUSAL_SIGNALS.some((s) => raw.toLowerCase().includes(s))) {
      console.warn("[twitter-bot] writeTweet: refusal detected, skipping");
      return [];
    }

    // Strip any footer Claude added anyway (we add it ourselves)
    const body = raw
      .replace(/\n*alphagap\.io.*$/i, "")
      .replace(/\$TAO\s*$/i, "")
      .trim();

    if (!body) return [];

    // Hard-truncate body if somehow still too long
    const safeBody = body.length > MAX_BODY
      ? body.slice(0, MAX_BODY - 1).trimEnd() + "…"
      : body;

    const tweet = safeBody + FOOTER;

    console.log(`[twitter-bot] tweet length: ${tweet.length} chars`);
    return [tweet];
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

  const prompt = `${subnet.name} (SN${subnet.netuid}) aGap score jumped ${fmtPct(subnet.composite_score_change)} to ${subnet.composite_score}/100. Drivers: ${driversLine}. Dev: ${subnet.dev_score} Flow: ${subnet.flow_score} Eval: ${subnet.eval_score}. Price 24h: ${fmtPct(subnet.price_change_24h)}. MCap: ${fmtMcap(subnet.market_cap)}.

Write a tweet using the format in your instructions. Explain in plain English why the score jumped and what that means. Use 🚀 as the lead emoji.`;



  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "agap_riser",
    tweets,
    rationale: `aGap riser: ${subnet.name} +${subnet.composite_score_change?.toFixed(0)} pts (${driversLine})`,
    dedupId: `agap_riser_${subnet.netuid}`,
  };
}

// ── 2. Dev Update (from /signals) ────────────────────────────────
// Brief summary of a high-scoring dev signal — much shorter than the full signal card.

export async function generateDevUpdate(signal: DevSignal): Promise<TweetPost | null> {
  const prompt = `${signal.name} (SN${signal.netuid}) just shipped: ${signal.title}. Dev score ${signal.score}/100. Detail: ${signal.description.slice(0, 120)}.

Write a tweet using the format in your instructions. Explain in plain English what was built and why it's a big deal. Use 🛠 as the lead emoji.`;


  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "dev_update",
    tweets,
    rationale: `Dev update: ${signal.name} (SN${signal.netuid}) — ${signal.title}`,
    dedupId: `dev_update_${signal.netuid}`,
  };
}

// ── 3. Whale Flow / Volume Surge (/whales) ────────────────────────

export async function generateWhaleFlow(subnet: SubnetScore, todayUTC?: string): Promise<TweetPost | null> {
  const isVolumeSurge = subnet.volume_surge && (subnet.volume_surge_ratio ?? 0) >= 2;
  const isWhale = subnet.whale_signal === "accumulating";

  if (!isVolumeSurge && !isWhale) return null;

  // Rotate the angle so posts don't all sound the same
  const angleOptions = isWhale && isVolumeSurge ? [
    `Write a tweet that focuses on the combination of smart-money accumulation AND a volume surge (${subnet.volume_surge_ratio?.toFixed(1)}× normal). Explain what it means when both happen together. Use 🐋 as the lead emoji.`,
    `Write a tweet about the unusual on-chain pattern: large wallets buying AND volume spiking ${subnet.volume_surge_ratio?.toFixed(1)}× at the same time. What does this divergence signal? Use 📊 as the lead emoji.`,
  ] : isWhale ? [
    `Write a tweet about large-wallet accumulation on this subnet — what it typically signals ahead of a move. Use 🐋 as the lead emoji.`,
    `Write a tweet focused on smart-money positioning: wallets are staking/buying while most retail hasn't noticed. Use 🔍 as the lead emoji.`,
    `Write a tweet about the on-chain story here — large wallets accumulating while price action looks quiet. Use 👀 as the lead emoji.`,
  ] : [
    `Write a tweet about the volume surge (${subnet.volume_surge_ratio?.toFixed(1)}× baseline). Focus on what unusual volume says about near-term momentum. Use 📈 as the lead emoji.`,
    `Write a tweet that explains what it means when buy volume spikes ${subnet.volume_surge_ratio?.toFixed(1)}× above normal for a Bittensor subnet. Use ⚡ as the lead emoji.`,
  ];

  // Pick a pseudo-random angle based on the netuid so the same subnet gets variety over time
  const angle = angleOptions[subnet.netuid % angleOptions.length];

  const contextLines = [
    `aGap score: ${subnet.composite_score}/100`,
    `Dev: ${subnet.dev_score}`,
    `Flow: ${subnet.flow_score}`,
    subnet.price_change_24h != null ? `Price 24h: ${fmtPct(subnet.price_change_24h)}` : null,
    subnet.price_change_7d  != null ? `Price 7d: ${fmtPct(subnet.price_change_7d)}`  : null,
    subnet.emission_pct     != null ? `Emission: ${(subnet.emission_pct * 100).toFixed(2)}%` : null,
    subnet.market_cap       != null ? `MCap: ${fmtMcap(subnet.market_cap)}` : null,
  ].filter(Boolean).join(" · ");

  const prompt = `${subnet.name} (SN${subnet.netuid}) — ${contextLines}.

${angle}`;

  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "whale_flow",
    tweets,
    rationale: `On-chain activity: ${subnet.name} — ${isWhale ? "whale accumulation" : "volume surge"}`,
    // Daily dedup key — one whale post per calendar day regardless of subnet
    dedupId: `whale_flow_day_${todayUTC ?? new Date().toISOString().slice(0, 10)}`,
  };
}

// ── 4. Discord Alpha (/social) ────────────────────────────────────

export async function generateDiscordAlpha(entry: DiscordEntry): Promise<TweetPost | null> {
  const insights = entry.keyInsights.slice(0, 3).join("\n- ");

  const prompt = `${entry.subnetName}${entry.netuid ? ` (SN${entry.netuid})` : ""} Discord is very active (score ${entry.alphaScore ?? "?"}/100). Key topics: ${insights}.

Write a tweet using the format in your instructions. Explain in plain English what the community is buzzing about and why it's interesting. Use 🔊 as the lead emoji.`;


  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "discord_alpha",
    tweets,
    rationale: `Discord alpha: ${entry.subnetName} — ${entry.summary.slice(0, 80)}`,
    dedupId: `discord_alpha_${entry.netuid}`,
  };
}

// ── 5. X Trending (/social) ───────────────────────────────────────

export async function generateXTrending(entries: SocialTrendEntry[]): Promise<TweetPost | null> {
  if (!entries.length) return null;
  const top3 = entries.slice(0, 3);

  const lines = top3.map((e, i) =>
    `${i + 1}. ${e.subnetName}${e.netuid ? ` (SN${e.netuid})` : ""}${e.tweetCount ? ` — ${e.tweetCount} mentions` : ""}${e.topInsight ? ` — "${e.topInsight}"` : ""}`
  ).join("\n");

  const prompt = `Trending on Bittensor X right now:\n${lines}

Write a tweet using the format in your instructions. Name the top subnets and explain in plain English why people are talking about them. Use 📈 as the lead emoji.`;


  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  const dateKey = new Date().toISOString().slice(0, 10);
  return {
    type: "x_trending",
    tweets,
    rationale: `X trending: ${top3.map(e => e.subnetName).join(", ")}`,
    dedupId: `x_trending_${dateKey}`,
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

  const prompt = `Top Bittensor subnets by ${ratioLabel}:\n${lines}

Write a tweet using the format in your instructions. Explain in plain English what this metric means and why these subnets topping it is interesting. Use 📊 as the lead emoji.`;


  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  const dateKey = new Date().toISOString().slice(0, 10);
  return {
    type: "analytics_ratios",
    tweets,
    rationale: `Analytics top 3 by ${ratioLabel}: ${top3.map(e => e.name).join(", ")}`,
    dedupId: `analytics_ratios_${dateKey}`,
  };
}

// ── 7. Benchmark Update (/benchmarks) ────────────────────────────

export async function generateBenchmarkUpdate(entry: BenchmarkEntry): Promise<TweetPost | null> {
  const isBeating = (entry.delta ?? 0) > 0;
  if (!isBeating && !entry.isNew) return null;

  const compLine = entry.centralizedName && entry.centralizedScore != null
    ? `vs ${entry.centralizedName} (${entry.centralizedScore.toFixed(1)})`
    : "vs centralised baseline";

  const prompt = `${entry.subnetName} (SN${entry.netuid}) scored ${entry.score.toFixed(1)} on ${entry.taskName}${entry.centralizedScore != null ? `, beating ${compLine}` : ""}${entry.delta != null && entry.delta > 0 ? ` by ${entry.delta.toFixed(1)} pts` : ""}.

Write a tweet using the format in your instructions. Explain in plain English what this benchmark tests and why a decentralised network winning it matters. Use 🏆 as the lead emoji if clearly beating the competitor, otherwise ⚡.`;


  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "benchmark_update",
    tweets,
    rationale: `Benchmark: ${entry.subnetName} scored ${entry.score.toFixed(1)} on ${entry.taskName} ${isBeating ? `(beats ${entry.centralizedName ?? "centralised"})` : "(new)"}`,
    dedupId: `benchmark_update_${entry.netuid}_${entry.taskName}`,
  };
}

// ── 8. Performance / Max Return (/performance) ───────────────────
// Highlights subnets where aGap ≥80 signal fired, shows buy price vs now vs max gain.

export async function generatePerformanceGain(entry: PerformanceEntry): Promise<TweetPost | null> {
  const prompt = `AlphaGap flagged ${entry.name} (SN${entry.netuid}) on ${new Date(entry.signalDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${fmtPrice(entry.priceAtSignal)}. Max gain since signal: ${fmtPct(entry.maxGainPct)}. Still up ${fmtPct(entry.currentGainPct)} from signal price.

Write a tweet using the format in your instructions. Tell the story simply — we spotted it early when price was flat, here's what happened next. Use 🎯 as the lead emoji.`;


  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "performance_gain",
    tweets,
    rationale: `Performance: ${entry.name} flagged at ${fmtPrice(entry.priceAtSignal)}, max gain ${fmtPct(entry.maxGainPct)}`,
    dedupId: `performance_gain_${entry.netuid}`,
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

  // Date string for daily-reset dedup keys (resets at midnight UTC each day)
  const todayUTC = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  // ── Candidate builders (lazily evaluated in order) ────────────────

  async function tryAgapRiser(): Promise<TweetPost | null> {
    const risers = leaderboard
      .filter((s) => (s.composite_score_change ?? 0) >= 5 && !alreadyPostedIds.has(`agap_riser_${s.netuid}`))
      .sort((a, b) => (b.composite_score_change ?? 0) - (a.composite_score_change ?? 0));
    return risers.length > 0 ? generateAgapRiser(risers[0]) : null;
  }

  async function tryDevUpdate(): Promise<TweetPost | null> {
    const freshDev = devSignals
      .filter((s) => {
        if (alreadyPostedIds.has(`dev_update_${s.netuid}`)) return false;
        const ageH = (Date.now() - new Date(s.created_at).getTime()) / 3600000;
        return ageH <= 48 && s.score >= 65;
      })
      .sort((a, b) => b.score - a.score);
    return freshDev.length > 0 ? generateDevUpdate(freshDev[0]) : null;
  }

  async function tryDiscordAlpha(): Promise<TweetPost | null> {
    const freshDiscord = discordAlpha
      .filter((d) => {
        if (!d.netuid || alreadyPostedIds.has(`discord_alpha_${d.netuid}`)) return false;
        const ageH = (Date.now() - new Date(d.scannedAt).getTime()) / 3600000;
        return ageH <= 12 && (d.alphaScore ?? 0) >= 70;
      })
      .sort((a, b) => (b.alphaScore ?? 0) - (a.alphaScore ?? 0));
    return freshDiscord.length > 0 && freshDiscord[0].netuid
      ? generateDiscordAlpha(freshDiscord[0] as DiscordEntry & { netuid: number })
      : null;
  }

  async function tryXTrending(): Promise<TweetPost | null> {
    // Resets daily — use date-based key so it can fire once per calendar day
    return socialTrending.length > 0 && !alreadyPostedIds.has(`x_trending_${todayUTC}`)
      ? generateXTrending(socialTrending)
      : null;
  }

  async function tryWhaleFlow(): Promise<TweetPost | null> {
    // One whale post per calendar day max — prevents whale from dominating the feed.
    // Per-netuid dedup is still applied inside so we pick the best candidate for today.
    if (alreadyPostedIds.has(`whale_flow_day_${todayUTC}`)) return null;
    const whaleTargets = leaderboard
      .filter((s) => {
        // Also skip if we already posted this exact subnet as a whale within 48h
        if (alreadyPostedIds.has(`whale_flow_subnet_${s.netuid}`)) return false;
        return s.whale_signal === "accumulating" || ((s.volume_surge_ratio ?? 0) >= 2.5);
      })
      .sort((a, b) => b.composite_score - a.composite_score);
    return whaleTargets.length > 0 ? generateWhaleFlow(whaleTargets[0], todayUTC) : null;
  }

  async function tryPerformanceGain(): Promise<TweetPost | null> {
    const perfGains = performanceGains
      .filter((p) => p.maxGainPct >= 30 && !alreadyPostedIds.has(`performance_gain_${p.netuid}`))
      .sort((a, b) => b.maxGainPct - a.maxGainPct);
    return perfGains.length > 0 ? generatePerformanceGain(perfGains[0]) : null;
  }

  async function tryAnalyticsRatios(): Promise<TweetPost | null> {
    // Resets daily — use date-based key so it can fire once per calendar day
    return analyticsRatios.length >= 3 && !alreadyPostedIds.has(`analytics_ratios_${todayUTC}`)
      ? generateAnalyticsRatios(analyticsRatios)
      : null;
  }

  async function tryBenchmarkUpdate(): Promise<TweetPost | null> {
    const freshBenchmarks = benchmarkUpdates
      .filter((b) => {
        if (alreadyPostedIds.has(`benchmark_update_${b.netuid}_${b.taskName}`)) return false;
        const ageH = (Date.now() - new Date(b.updatedAt).getTime()) / 3600000;
        return ageH <= 72 && ((b.delta ?? 0) > 0 || b.isNew);
      })
      .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
    return freshBenchmarks.length > 0 ? generateBenchmarkUpdate(freshBenchmarks[0]) : null;
  }

  // ── Slot-based priority order ─────────────────────────────────────
  // Preferred types for this slot come first; remaining 6 are the fallback.

  type Tryer = () => Promise<TweetPost | null>;

  // ── Slot-based priority order ─────────────────────────────────────
  // whale_flow is limited to 1 post per day (daily dedup key) and demoted
  // to last-resort fallback across all slots to prevent feed domination.
  // Each slot leads with 2 substantive types, then tries the remaining
  // time-limited/data-dependent types before falling back to whale.
  //
  // Slot 0 → 7am:  agap_riser,       dev_update
  // Slot 1 → 12pm: discord_alpha,    x_trending
  // Slot 2 → 5pm:  analytics_ratios, performance_gain
  // Slot 3 → 10pm: benchmark_update, agap_riser

  const slotOrder: [Tryer, Tryer, ...Tryer[]][] = [
    // Slot 0 — 7am:  agap_riser first, then substantive types, whale as last resort
    [tryAgapRiser,       tryDevUpdate,       tryDiscordAlpha,    tryXTrending,       tryAnalyticsRatios, tryBenchmarkUpdate, tryPerformanceGain, tryWhaleFlow],
    // Slot 1 — 12pm: social/community types first, whale as last resort
    [tryDiscordAlpha,    tryXTrending,       tryAgapRiser,       tryDevUpdate,       tryAnalyticsRatios, tryBenchmarkUpdate, tryPerformanceGain, tryWhaleFlow],
    // Slot 2 — 5pm:  data/analytics types first, whale as last resort
    [tryAnalyticsRatios, tryPerformanceGain, tryAgapRiser,       tryDevUpdate,       tryDiscordAlpha,    tryXTrending,       tryBenchmarkUpdate, tryWhaleFlow],
    // Slot 3 — 10pm: benchmark/riser types first, whale as last resort
    [tryBenchmarkUpdate, tryAgapRiser,       tryDevUpdate,       tryPerformanceGain, tryDiscordAlpha,    tryXTrending,       tryAnalyticsRatios, tryWhaleFlow],
  ];

  for (const tryer of slotOrder[slot]) {
    const post = await tryer();
    if (post) return post;
  }

  return null;
}
