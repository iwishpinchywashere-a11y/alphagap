import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "./db";
import { buildSignalContext, SignalContext } from "./context-fetcher";

const client = new Anthropic();

interface RawSignal {
  id: number;
  netuid: number;
  signal_type: string;
  title: string;
  description: string;
  source: string;
  source_url?: string;
  strength: number;
}

interface SubnetRow {
  netuid: number;
  name: string;
  description: string;
  github_url: string;
}

interface MetricRow {
  alpha_price: number;
  market_cap: number;
  net_flow_24h: number;
}

// ── Generate analysis + score for a single signal ────────────────
async function analyzeSignal(ctx: SignalContext): Promise<{ analysis: string; score: number }> {
  const prompt = buildPrompt(ctx);

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 700,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0];
  if (text.type !== "text") return { analysis: "", score: 50 };

  const raw = text.text;

  // Parse score from the response (look for "SCORE: XX" line)
  const scoreMatch = raw.match(/📊\s*SCORE:\s*(\d+)/);
  const score = scoreMatch ? Math.min(100, Math.max(1, parseInt(scoreMatch[1]))) : 50;

  // Remove the score line from the analysis text shown to users
  const analysis = raw.replace(/📊\s*SCORE:.*$/m, "").trim();

  return { analysis, score };
}

function buildPrompt(ctx: SignalContext): string {
  let contextBlock = "";

  if (ctx.githubContext) {
    contextBlock += `\n## Project README (excerpt)\n${ctx.githubContext.slice(0, 2000)}\n`;
  }
  if (ctx.releaseNotes) {
    contextBlock += `\n## Latest Release\n${ctx.releaseNotes.slice(0, 1000)}\n`;
  }
  if (ctx.recentPRs?.length) {
    contextBlock += `\n## Recently Merged Pull Requests (IMPORTANT — these describe WHAT was built)\n${ctx.recentPRs.slice(0, 8).join("\n\n")}\n`;
  }
  if (ctx.recentCommits?.length) {
    contextBlock += `\n## Recent Commits (read these to understand what changed)\n${ctx.recentCommits.slice(0, 15).join("\n")}\n`;
  }
  if (ctx.hfContext) {
    contextBlock += `\n## HuggingFace Details\n${ctx.hfContext.slice(0, 1500)}\n`;
  }

  const priceInfo = ctx.alphaPrice
    ? `Current alpha token price: $${ctx.alphaPrice.toFixed(2)} | Market cap: $${ctx.marketCap ? (ctx.marketCap / 1e6).toFixed(1) + "M" : "N/A"} | 24h TAO flow: ${ctx.netFlow ? ctx.netFlow.toFixed(0) : "N/A"}`
    : "";

  return `You are AlphaGap's super brain — the best signal analyst in the Bittensor TAO ecosystem. Your job is to evaluate whether each signal is actually significant and could move the subnet's alpha token price.

CRITICAL ACCURACY RULE: The "Official Description" below is the GROUND TRUTH about what this subnet does. NEVER guess or invent capabilities.

## Subnet Identity (GROUND TRUTH)
- **Name**: ${ctx.subnetName}
- **Official Description**: ${ctx.subnetDescription || "No description available — DO NOT guess what this subnet does"}

## Signal Detected
- **Signal type**: ${ctx.signalType}
- **What happened**: ${ctx.signalTitle}
- **Raw details**: ${ctx.signalDescription}
- **Source**: ${ctx.sourceUrl || "N/A"}
${priceInfo ? `- **Market data**: ${priceInfo}` : ""}

${contextBlock}

YOUR JOB: Analyze this signal and decide how significant it really is.

Ask yourself:
- Is this a major product launch, breakthrough, or new capability? Or just routine maintenance?
- Could this actually move the token price? Would a smart investor care?
- Is there an ALPHA GAP here — the subnet shipping hard but price hasn't caught up yet?
- Is this a nothing-burger dressed up as news?

Write your response in this EXACT format:

📊 SCORE: [1-100]
USE THE FULL RANGE. Do not cluster scores in the middle. Be decisive.
- 90-100: Major product launch, new integration with real users, breakthrough model release, partnership announcement
- 75-89: Significant new feature shipped, important infrastructure upgrade, meaningful model/dataset drop
- 60-74: Multiple solid PRs merged, real features being built, steady meaningful progress
- 45-59: Decent development work, bug fixes that improve the product, incremental features
- 25-44: Routine maintenance, dependency updates, minor fixes, config changes
- 10-24: Trivial changes, unclear what was done, insignificant flow movements
- 1-9: Literally nothing or data is garbage
The #1 signal of the day should be at LEAST 75. Spread your scores across the range. If everything clusters at 50, you're doing it wrong.

🔍 WHAT THEY BUILT: 2-3 sentences explaining SPECIFIC features, fixes, or products shipped. Read the commits and PRs. Name specific features. "Added Hyperliquid exchange integration" NOT "pushed commits to their repo".

💡 WHY IT MATTERS: One sentence connecting the work to real-world impact based on the Official Description.

🎯 ALPHA ANGLE: One sentence — is there an alpha gap here? Is the market sleeping on this? Or is this already priced in? Factor in the current price movement and TAO flow data.

Rules:
- THE SCORE IS EVERYTHING. Be brutally honest. Most signals are 30-60. Only truly significant developments get 70+.
- Routine dependency updates, version bumps, minor bug fixes = score 20-35
- New product features, integrations, model launches = score 60-80
- Major breakthroughs, product launches with real users, partnerships = score 85+
- If price is DOWN but development is significant = boost score (alpha gap!)
- If price is UP and development is routine = lower score (already priced in)
- ACCURACY over hype. Never inflate significance.
- NO markdown bold/italic — just plain text with emoji headers
- If you can't determine what was done, score it low and say so`;
}

// ── Analyze all pending signals ──────────────────────────────────
export async function analyzePendingSignals(): Promise<number> {
  const db = getDb();

  // Get signals that need analysis
  const pending = db
    .prepare(
      `SELECT s.* FROM signals s
       WHERE (s.analysis IS NULL OR s.analysis = '')
       AND s.analysis_status != 'failed'
       AND s.strength >= 20
       ORDER BY s.strength DESC
       LIMIT 200`
    )
    .all() as RawSignal[];

  if (pending.length === 0) return 0;

  let analyzed = 0;

  const updateSignal = db.prepare(
    "UPDATE signals SET analysis = ?, analysis_status = ?, strength = ? WHERE id = ?"
  );

  for (const signal of pending) {
    try {
      // Mark as analyzing
      db.prepare("UPDATE signals SET analysis_status = 'analyzing' WHERE id = ?").run(signal.id);

      // Get subnet info
      const subnet = db
        .prepare("SELECT * FROM subnets WHERE netuid = ?")
        .get(signal.netuid) as SubnetRow | undefined;

      const metrics = db
        .prepare(
          "SELECT * FROM subnet_metrics WHERE netuid = ? ORDER BY timestamp DESC LIMIT 1"
        )
        .get(signal.netuid) as MetricRow | undefined;

      // Build rich context
      const ctx = await buildSignalContext(
        signal,
        {
          name: subnet?.name || `Subnet ${signal.netuid}`,
          description: subnet?.description || "",
          github_url: subnet?.github_url,
          alpha_price: metrics?.alpha_price,
          market_cap: metrics?.market_cap,
          net_flow_24h: metrics?.net_flow_24h,
        }
      );

      // Generate analysis + score with Claude
      const { analysis, score } = await analyzeSignal(ctx);

      if (analysis) {
        // AI determines the score — overwrite the hardcoded one
        updateSignal.run(analysis, "done", score, signal.id);
        analyzed++;
        console.log(`Analyzed signal ${signal.id} [score=${score}]: ${signal.title.slice(0, 50)}...`);
      } else {
        updateSignal.run(null, "failed", signal.strength, signal.id);
      }

      // Small delay between API calls
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.error(`Failed to analyze signal ${signal.id}:`, e);
      updateSignal.run(null, "failed", signal.strength, signal.id);
    }
  }

  // Post-process: normalize scores to use full range
  // The AI tends to cluster scores in the middle — stretch them out
  if (analyzed > 0) {
    const scores = db.prepare(
      "SELECT MIN(strength) as min_s, MAX(strength) as max_s FROM signals WHERE analysis IS NOT NULL AND analysis_status = 'done'"
    ).get() as { min_s: number; max_s: number };

    if (scores && scores.max_s > scores.min_s) {
      const range = scores.max_s - scores.min_s;
      // Stretch to 10-90 range (top signal gets ~85-90, bottom gets ~10-15)
      db.prepare(
        `UPDATE signals SET strength = ROUND(10 + ((strength - ?) / ? * 80))
         WHERE analysis IS NOT NULL AND analysis_status = 'done'`
      ).run(scores.min_s, range);
      console.log(`Normalized scores: ${scores.min_s}-${scores.max_s} → 10-90`);
    }
  }

  return analyzed;
}
