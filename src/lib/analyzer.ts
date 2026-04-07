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
USE THE FULL RANGE. Your score is absolute — not relative to other signals.
- 90-100: Major product launch, live integration with real users, breakthrough model, partnership announced
- 80-89: Significant new feature shipped, important infrastructure upgrade, meaningful model/dataset drop
- 65-79: Multiple solid PRs merged, real product features being built, meaningful progress
- 45-64: Decent development, bug fixes that improve the product, incremental but real features
- 25-44: Routine maintenance, dependency updates, minor config changes
- 10-24: Trivial changes, noise, unclear what was done
- 1-9: Nothing signal, garbage data

🔍 WHAT THEY BUILT: 2-3 sentences explaining SPECIFIC features, fixes, or products shipped. Read the commits and PRs. Name specific features. "Added Hyperliquid exchange integration" NOT "pushed commits to their repo".

💡 WHY IT MATTERS: One sentence connecting the work to real-world impact based on the Official Description.

🎯 ALPHA ANGLE: One sentence — is there an alpha gap here? Is the market sleeping on this? Or is this already priced in? Factor in the current price movement and TAO flow data.

Rules:
- Good solid feature work = 65-79. Don't underscore real shipping.
- Significant new capability or major release = 80-89. Use this range freely when warranted.
- Only hold 90+ for genuine breakthroughs or major external partnerships.
- Routine dependency updates, version bumps, chores = 20-40
- If price is DOWN but development is significant = boost score (alpha gap!)
- If price is UP and development is routine = lower score (already priced in)
- ACCURACY over hype. Never inflate insignificant work.
- NO markdown bold/italic — just plain text with emoji headers
- If you can't determine what was done, score it low and say so`;
}

// ── Analyze all pending signals ──────────────────────────────────
export async function analyzePendingSignals(maxBatch: number = 200): Promise<number> {
  const db = getDb();

  // Get signals that need analysis
  const pending = db
    .prepare(
      `SELECT s.* FROM signals s
       WHERE (s.analysis IS NULL OR s.analysis = '')
       AND s.analysis_status != 'failed'
       AND s.strength >= 20
       ORDER BY s.strength DESC
       LIMIT ?`
    )
    .all(maxBatch) as RawSignal[];

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

  // No post-processing normalization — Claude scores stand as-is.
  // The prompt is calibrated to use the full range directly.

  return analyzed;
}
