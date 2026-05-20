import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTier } from "@/lib/subscription";
import { get as blobGet, put } from "@vercel/blob";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAILY_LIMIT = 25; // premium only
const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN || "";

// ── Rate limit helpers (per-user blob) ──────────────────────────────
function rlKey(email: string) {
  const hash = email.toLowerCase().replace(/[^a-z0-9]/g, "_");
  return `oracle-rl/${hash}.json`;
}

async function getRateLimit(email: string): Promise<{ date: string; count: number }> {
  try {
    const b = await blobGet(rlKey(email), { token: TOKEN(), access: "private" });
    if (!b?.stream) return { date: "", count: 0 };
    const reader = b.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch { return { date: "", count: 0 }; }
}

async function incrementRateLimit(email: string, current: { date: string; count: number }): Promise<void> {
  await put(rlKey(email), JSON.stringify(current), {
    access: "private", token: TOKEN(), addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
  });
}

// ── Load blobs ──────────────────────────────────────────────────────
async function loadBlob<T>(name: string): Promise<T | null> {
  try {
    const b = await blobGet(name, { token: TOKEN(), access: "private" });
    if (!b?.stream) return null;
    const reader = b.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch { return null; }
}

// ── Build compact system prompt from live data ───────────────────────
function buildSystemPrompt(leaderboard: unknown[], audits: unknown, signals: unknown[]): string {
  const today = new Date().toISOString().slice(0, 10);

  // Compact leaderboard — key fields only
  const lb = (leaderboard as any[]).map(s => ({
    sn: s.netuid,
    name: s.name,
    agap: s.composite_score,
    invest: s.invest_agap,
    flow: s.flow_score,
    dev: s.dev_score,
    mcap_usd: s.market_cap ? Math.round(s.market_cap) : null,
    price: s.alpha_price,
    chg_24h: s.price_change_24h,
    chg_7d: s.price_change_7d,
    emission_pct: s.emission_pct,
    alpha_staked_pct: s.alpha_staked_pct,
    tao_locked: s.tao_locked,
    whale: s.whale_signal,
    vol_surge: s.volume_surge || false,
    const_buy: s.const_buy_tao,
    const_sell: s.const_sell_tao,
    velo: s.agap_velo,
    apy_7d: s.apy_7d,
    category: s.category,
    audit: s.audit_score,
  }));

  // Compact audit data
  const auditMap: Record<string, unknown> = {};
  if (audits && typeof audits === "object" && (audits as any).subnets) {
    for (const [id, a] of Object.entries((audits as any).subnets)) {
      const au = a as any;
      auditMap[id] = {
        nakamoto: au.nakamotoCoefficient,
        hhi: au.hhiNormalized,
        top10: au.top10Share,
        burn_pct: au.burnedEmissionPct,
        chain_buy: au.emissionChainBuysPct,
        stale_val_pct: au.staleValidatorPct,
        zi_miner_pct: au.zeroIncentiveMinerPct,
        vtrust: au.avgVTrust,
        holders: au.holdersCount,
        tao_pool: au.taoInPool,
        flags: au.flags?.map((f: any) => f.message) ?? [],
      };
    }
  }

  // Compact recent signals — dev signals only, last 72h, sorted by strength desc
  const cutoff = Date.now() - 72 * 3600 * 1000;
  const DEV_TYPES = new Set(["github_commit", "github_pr", "github_release", "huggingface_model", "huggingface_dataset", "huggingface_space", "dev_spike", "dev_activity"]);
  const recentSignals = (signals as any[])
    .filter(s => {
      const ts = new Date(s.signal_date ?? s.created_at).getTime();
      return ts >= cutoff;
    })
    .sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))
    .slice(0, 60) // top 60 signals max to keep prompt lean
    .map(s => ({
      sn: s.netuid,
      name: s.subnet_name,
      type: s.signal_type,
      strength: s.strength,
      title: s.title,
      desc: s.description,
      date: (s.signal_date ?? s.created_at ?? "").slice(0, 10),
      is_dev: DEV_TYPES.has(s.signal_type),
    }));

  return `You are the AlphaGap Oracle — an expert AI analyst for the Bittensor (TAO) ecosystem.
You have access to real-time data for every active Bittensor subnet as of ${today}.

PERSONALITY:
- Direct, confident, data-driven. Like a sharp analyst, not a chatbot.
- Always cite specific subnet names, numbers, and scores.
- If something looks risky, say so clearly.
- Use τ for TAO amounts.
- When asked about recent developments or "what shipped lately", lead with the highest-strength dev signals from RECENT SIGNALS data, summarise the title/description in plain English, and note when it happened.

SCORING GUIDE:
- aGap score (0-100): AlphaGap composite quality score. 70+ = strong, 50-70 = watch, <50 = weak.
- invest_agap: Long-term investing score. Higher = better hold candidate.
- flow_score: On-chain buy/sell flow signal. High = accumulation.
- dev_score: Development activity. High = active builders.
- audit_score: Operational health (decentralisation, validator/miner quality).
- velo: aGap Velocity — how fast the score is rising or falling.
- whale: "accumulating" or "distributing" — smart money signal.
- alpha_staked_pct: % of supply locked (not in DEX). High = conviction from holders.
- tao_locked: TAO locked in liquidity pool. Higher = deeper market.
- const_buy/const_sell: TAO amounts bought/sold by Const (Bittensor co-founder). Significant signal.
- nakamoto: Decentralisation score. Higher = safer. <3 = red flag.
- hhi: Stake concentration. Lower = more competitive. >0.5 = red flag.
- burn_pct: % of miner emissions burned. 0% = healthy. High = miners may leave.
- Signal strength (0-100): how significant the signal event is.
- Signal types: github_pr = pull request merged, github_release = new version shipped, github_commit = commits, huggingface_model/dataset/space = AI model published, dev_spike = unusual dev activity burst.

LIVE LEADERBOARD DATA (${lb.length} subnets):
${JSON.stringify(lb)}

LIVE AUDIT DATA:
${JSON.stringify(auditMap)}

RECENT SIGNALS — last 72h (sorted by strength, is_dev=true means development event):
${recentSignals.length > 0 ? JSON.stringify(recentSignals) : "No signals in the last 72h."}

Answer questions using this data directly. Be specific. If asked for top N subnets by some criteria, compute it from the data above. Never say you don't have access to the data — you do.`;
}

// ── Main handler ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const tier = getTier(session);
  if (tier !== "premium") {
    return NextResponse.json({ error: "premium_required" }, { status: 403 });
  }

  // Rate limit check
  const email = session.user.email;
  const today = new Date().toISOString().slice(0, 10);
  const rl = await getRateLimit(email);
  const count = rl.date === today ? rl.count : 0;

  if (count >= DAILY_LIMIT) {
    return NextResponse.json({
      error: "rate_limited",
      message: `You've used all ${DAILY_LIMIT} Oracle queries for today. Resets at midnight UTC.`,
    }, { status: 429 });
  }

  const { messages } = await req.json() as { messages: { role: string; content: string }[] };
  if (!messages?.length) {
    return NextResponse.json({ error: "No messages" }, { status: 400 });
  }

  // Increment rate limit (fire and forget — don't block the stream)
  incrementRateLimit(email, { date: today, count: count + 1 }).catch(() => {});

  // Load live data
  const [scanData, auditData, signalsData] = await Promise.all([
    loadBlob<{ leaderboard?: unknown[] }>("scan-latest.json"),
    loadBlob<unknown>("audit-data.json"),
    loadBlob<{ signals?: unknown[] }>("signals-history.json"),
  ]);

  const leaderboard = scanData?.leaderboard ?? [];
  const signals = signalsData?.signals ?? [];
  const systemPrompt = buildSystemPrompt(leaderboard, auditData, signals);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Stream response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = anthropic.messages.stream({
          model: "claude-haiku-4-5",
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        });

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text));
          }
        }
      } catch (e) {
        console.error("[oracle]", e);
        controller.enqueue(new TextEncoder().encode("\n\n[Oracle error — please try again]"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Oracle-Remaining": String(DAILY_LIMIT - count - 1),
      "X-Oracle-Limit": String(DAILY_LIMIT),
    },
  });
}
