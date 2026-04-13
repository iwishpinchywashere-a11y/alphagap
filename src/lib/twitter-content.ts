// Content generator for @AlphaGapTAO automated posts
// Reads scan/discord/social blobs → Claude generates tweet copy

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";

export interface SubnetScore {
  netuid: number; name: string; composite_score: number; flow_score: number;
  dev_score: number; eval_score: number; social_score: number;
  alpha_price?: number; market_cap?: number;
  price_change_7d?: number; price_change_24h?: number;
  whale_signal?: string | null; volume_surge?: boolean; volume_surge_ratio?: number;
  emission_pct?: number; emission_trend?: string | null;
}

export interface TweetPost {
  type: "top_movers" | "dev_signal" | "discord_alpha" | "whale_alert" | "eval_gap" | "daily_briefing";
  tweets: string[];   // 1 = single tweet, 2+ = thread
  rationale: string;  // internal, not posted
}

// ── Helper: truncate to fit in tweet ──────────────────────────────

function fit(s: string, max = 275): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

// ── Format numbers ────────────────────────────────────────────────

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

// ── AI tweet writer ────────────────────────────────────────────────

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
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return [];
    const data = await res.json() as { content: Array<{ text: string }> };
    const text = data.content[0]?.text?.trim() ?? "";

    // Split on ---NEXT--- delimiter for threads
    return text.split("---NEXT---").map((t) => t.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// ── Post type generators ──────────────────────────────────────────

export async function generateDailyBriefing(leaderboard: SubnetScore[]): Promise<TweetPost | null> {
  const top5 = leaderboard.slice(0, 5);
  const risers = leaderboard
    .filter((s) => (s.price_change_24h ?? 0) >= 8)
    .sort((a, b) => (b.price_change_24h ?? 0) - (a.price_change_24h ?? 0))
    .slice(0, 3);

  const top5Lines = top5.map((s, i) =>
    `${i + 1}. ${s.name} (SN${s.netuid}) — aGap ${s.composite_score} | Dev ${s.dev_score} | Flow ${s.flow_score} | MCap ${fmtMcap(s.market_cap)}`
  ).join("\n");

  const riserLines = risers.length > 0
    ? risers.map((s) => `${s.name}: ${fmtPct(s.price_change_24h)} 24H`).join(", ")
    : "steady";

  const prompt = `You are @AlphaGapTAO — an AI that spots alpha in Bittensor subnets before the market does.

Write a DAILY BRIEFING tweet thread (2 tweets) about today's top Bittensor subnets. Be sharp, confident, data-driven. No hype. No fluff. Use emojis sparingly (1-2 max total). Each tweet must be under 270 characters. Separate tweets with ---NEXT---

Today's AlphaGap top 5 (ranked by composite score):
${top5Lines}

Notable 24H price movers: ${riserLines}

Tweet 1: Lead with the #1 ranked subnet — why it's top, what signals are firing.
Tweet 2: Quick scan of the rest of the top 5. End with "→ alphagap.io" CTA.

Do NOT use phrases like "exciting", "thrilled", "amazing". Sound like a sharp analyst, not marketing copy.`;

  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "daily_briefing",
    tweets,
    rationale: `Daily briefing: top 5 — ${top5.map(s => s.name).join(", ")}`,
  };
}

export async function generateDevAlert(signal: { name: string; netuid: number; title: string; description: string; score: number }): Promise<TweetPost | null> {
  const prompt = `You are @AlphaGapTAO — an AI that spots Bittensor alpha.

Write ONE tweet about this dev activity signal. Under 270 chars. Sharp, factual. 1 emoji max.

Subnet: ${signal.name} (SN${signal.netuid})
Signal: ${signal.title}
Detail: ${signal.description}
AlphaGap dev signal score: ${signal.score}/100

Lead with the subnet name. Mention what was actually built (not vague "commits"). End with "$${signal.name.toUpperCase()} #Bittensor"`;

  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "dev_signal",
    tweets,
    rationale: `Dev signal for ${signal.name} (SN${signal.netuid}): ${signal.title}`,
  };
}

export async function generateDiscordAlpha(entry: {
  subnetName: string; netuid: number; summary: string; keyInsights: string[];
}): Promise<TweetPost | null> {
  const insights = entry.keyInsights.slice(0, 3).join("\n- ");

  const prompt = `You are @AlphaGapTAO — an AI that catches Bittensor Discord alpha before it hits Twitter.

Write a tweet thread (2 tweets) about this Discord alpha drop. Be specific. Name the actual thing happening. Under 270 chars each. Separate with ---NEXT---

Subnet: ${entry.subnetName} (SN${entry.netuid})
Discord summary: ${entry.summary}
Key insights:
- ${insights}

Tweet 1: The alpha drop — what's actually happening. Lead with "🔊 Discord alpha:" or "⚡ ${entry.subnetName} Discord:"
Tweet 2: Why it matters for price/value. End with "Spotted by @AlphaGapTAO | alphagap.io"`;

  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "discord_alpha",
    tweets,
    rationale: `Discord alpha: ${entry.subnetName} — ${entry.summary.slice(0, 80)}`,
  };
}

export async function generateWhaleAlert(subnet: SubnetScore): Promise<TweetPost | null> {
  if (subnet.whale_signal !== "accumulating") return null;

  const prompt = `You are @AlphaGapTAO — tracking smart money in Bittensor.

Write ONE tweet about whale accumulation. Under 270 chars. Factual, no hype. 1 emoji max.

Subnet: ${subnet.name} (SN${subnet.netuid})
Whale signal: ACCUMULATING
aGap composite score: ${subnet.composite_score}/100
Dev score: ${subnet.dev_score} | Eval score: ${subnet.eval_score} | Flow score: ${subnet.flow_score}
Market cap: ${fmtMcap(subnet.market_cap)}
7D price: ${fmtPct(subnet.price_change_7d)}

Lead with "🐋" then the subnet name. Note the aGap score and what's driving it. End with "#Bittensor"`;

  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "whale_alert",
    tweets,
    rationale: `Whale accumulation: ${subnet.name} (SN${subnet.netuid})`,
  };
}

export async function generateEvalGap(subnet: SubnetScore): Promise<TweetPost | null> {
  const prompt = `You are @AlphaGapTAO — finding undervalued Bittensor subnets.

Write ONE tweet about this valuation gap opportunity. Under 270 chars. Analytical tone. 1 emoji max.

Subnet: ${subnet.name} (SN${subnet.netuid})
eVal score: ${subnet.eval_score}/100 (high = network paying out relative to market cap = undervalued)
aGap composite: ${subnet.composite_score}/100
Market cap: ${fmtMcap(subnet.market_cap)}
Emission: ${((subnet.emission_pct ?? 0) * 100).toFixed(2)}% of network emissions
7D price: ${fmtPct(subnet.price_change_7d)}

Explain the valuation gap in plain terms. What's the network paying vs what the market prices it at? End with "#Bittensor #TAO"`;

  const tweets = await writeTweet(prompt);
  if (!tweets.length) return null;

  return {
    type: "eval_gap",
    tweets,
    rationale: `Eval gap: ${subnet.name} eval=${subnet.eval_score}`,
  };
}

// ── Pick best post for this run ────────────────────────────────────
// Priority: fresh discord alpha > whale alert > high eval gap > daily briefing

export async function pickBestPost(
  leaderboard: SubnetScore[],
  discordAlpha: Array<{ subnetName: string; netuid: number | null; summary: string; keyInsights: string[]; alphaScore?: number; scannedAt: string }>,
  devSignals: Array<{ name: string; netuid: number; title: string; description: string; score: number; created_at: string }>,
  alreadyPostedIds: Set<string>
): Promise<TweetPost | null> {

  // 1. Fresh discord alpha (within last 6h, alphaScore ≥ 80)
  const freshDiscord = discordAlpha
    .filter((d) => {
      if (!d.netuid || alreadyPostedIds.has(`discord_${d.netuid}`)) return false;
      const ageH = (Date.now() - new Date(d.scannedAt).getTime()) / 3600000;
      return ageH <= 6 && (d.alphaScore ?? 0) >= 80;
    })
    .sort((a, b) => (b.alphaScore ?? 0) - (a.alphaScore ?? 0));

  if (freshDiscord.length > 0) {
    const best = freshDiscord[0];
    if (best.netuid) {
      const post = await generateDiscordAlpha({ subnetName: best.subnetName, netuid: best.netuid, summary: best.summary, keyInsights: best.keyInsights });
      if (post) return post;
    }
  }

  // 2. Whale accumulation on high-scoring subnet
  const whaleSubnets = leaderboard.filter(
    (s) => s.whale_signal === "accumulating" && s.composite_score >= 55 && !alreadyPostedIds.has(`whale_${s.netuid}`)
  ).sort((a, b) => b.composite_score - a.composite_score);

  if (whaleSubnets.length > 0) {
    const post = await generateWhaleAlert(whaleSubnets[0]);
    if (post) return post;
  }

  // 3. High eval gap (eval ≥ 70, not in top 3 by composite — hidden gem)
  const evalGems = leaderboard
    .slice(3)  // skip already well-known top 3
    .filter((s) => s.eval_score >= 70 && s.composite_score >= 45 && !alreadyPostedIds.has(`eval_${s.netuid}`))
    .sort((a, b) => b.eval_score - a.eval_score);

  if (evalGems.length > 0) {
    const post = await generateEvalGap(evalGems[0]);
    if (post) return post;
  }

  // 4. Strong dev signal (score ≥ 75, within last 24h)
  const freshDev = devSignals
    .filter((s) => {
      if (alreadyPostedIds.has(`dev_${s.netuid}`)) return false;
      const ageH = (Date.now() - new Date(s.created_at).getTime()) / 3600000;
      return ageH <= 24 && s.score >= 75;
    })
    .sort((a, b) => b.score - a.score);

  if (freshDev.length > 0) {
    const post = await generateDevAlert(freshDev[0]);
    if (post) return post;
  }

  // 5. Fallback: daily briefing
  return generateDailyBriefing(leaderboard);
}
