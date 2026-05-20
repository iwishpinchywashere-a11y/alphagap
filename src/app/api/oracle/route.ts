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

// ── Build compact system prompt from all live data ───────────────────
function buildSystemPrompt(blobs: {
  leaderboard: any[];
  audits: any;
  signals: any[];
  flowEvents: any;
  whaleTracker: any;
  socialHot: any[];
  benchmarkAlerts: any[];
  subnetActivity: any;
  discordLatest: any[];
  pumpTracker: any;
  yieldLatest: any;
}): string {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff72h = Date.now() - 72 * 3600 * 1000;
  const cutoff7d  = Date.now() - 7  * 24 * 3600 * 1000;

  // ── Leaderboard ──────────────────────────────────────────────────
  const lb = blobs.leaderboard.map(s => ({
    sn: s.netuid,
    name: s.name,
    agap: s.composite_score,
    invest: s.invest_agap,
    flow: s.flow_score,
    dev: s.dev_score,
    social: s.social_score,
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

  // ── Audit ────────────────────────────────────────────────────────
  const auditMap: Record<string, unknown> = {};
  if (blobs.audits?.subnets) {
    for (const [id, a] of Object.entries(blobs.audits.subnets as Record<string, any>)) {
      auditMap[id] = {
        nakamoto: a.nakamotoCoefficient,
        hhi: a.hhiNormalized,
        top10: a.top10Share,
        burn_pct: a.burnedEmissionPct,
        chain_buy: a.emissionChainBuysPct,
        stale_val_pct: a.staleValidatorPct,
        zi_miner_pct: a.zeroIncentiveMinerPct,
        vtrust: a.avgVTrust,
        holders: a.holdersCount,
        tao_pool: a.taoInPool,
        flags: a.flags?.map((f: any) => f.message) ?? [],
      };
    }
  }

  // ── Signals (dev + all types, last 72h) ──────────────────────────
  const DEV_TYPES = new Set(["github_commit", "github_pr", "github_release", "huggingface_model", "huggingface_dataset", "huggingface_space", "dev_spike", "dev_activity"]);
  const recentSignals = blobs.signals
    .filter(s => new Date(s.signal_date ?? s.created_at).getTime() >= cutoff72h)
    .sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))
    .slice(0, 80)
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

  // ── Safe array extractor ─────────────────────────────────────────
  function safeArray(raw: any, ...keys: string[]): any[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    for (const k of keys) {
      if (Array.isArray(raw[k])) return raw[k];
    }
    try { const v = Object.values(raw); return Array.isArray(v) ? v.filter(Boolean) : []; }
    catch { return []; }
  }

  // ── Flow events ──────────────────────────────────────────────────
  const flowEvents = safeArray(blobs.flowEvents, "events", "flowEvents", "flow")
    .filter((e: any) => new Date(e?.timestamp ?? e?.created_at ?? 0).getTime() >= cutoff7d)
    .slice(0, 30)
    .map((e: any) => ({
      sn: e.netuid, name: e.subnet_name ?? e.name,
      type: e.event_type ?? e.type, net_tao: e.net_tao ?? e.netTao,
      date: (e.timestamp ?? e.created_at ?? "").slice(0, 10),
    }));

  // ── Whale tracker state ──────────────────────────────────────────
  const whaleState = safeArray(blobs.whaleTracker, "whales", "subnets")
    .filter(Boolean)
    .slice(0, 40)
    .map((w: any) => ({
      sn: w.netuid, name: w.name ?? w.subnet_name,
      signal: w.signal ?? w.whale_signal, buy_ratio: w.buy_ratio,
      net_tao_7d: w.net_tao_7d, updated: (w.updated_at ?? "").slice(0, 10),
    }));

  // ── Social / KOL hot events (last 72h) ──────────────────────────
  const socialHot = blobs.socialHot
    .filter((e: any) => new Date(e?.timestamp ?? e?.created_at ?? 0).getTime() >= cutoff72h)
    .slice(0, 25)
    .map((e: any) => ({
      sn: e.netuid, name: e.subnet_name ?? e.name,
      kol: e.kol ?? e.username, heat: e.heat_score ?? e.score,
      text: (e.text ?? e.content ?? "").slice(0, 100),
      date: (e.timestamp ?? e.created_at ?? "").slice(0, 10),
    }));

  // ── Benchmark alerts / high-engagement KOL tweets ────────────────
  const benchmarks = blobs.benchmarkAlerts
    .filter((e: any) => new Date(e?.timestamp ?? e?.created_at ?? 0).getTime() >= cutoff7d)
    .slice(0, 20)
    .map((e: any) => ({
      sn: e.netuid, name: e.subnet_name ?? e.name,
      kol: e.username ?? e.kol, likes: e.likes ?? e.like_count,
      text: (e.text ?? e.content ?? "").slice(0, 90),
      date: (e.timestamp ?? e.created_at ?? "").slice(0, 10),
    }));

  // ── Subnet Twitter/social activity ──────────────────────────────
  const subnetSocial = safeArray(blobs.subnetActivity, "subnets", "activity")
    .filter(Boolean).slice(0, 60)
    .map((a: any) => ({ sn: a.netuid, name: a.name ?? a.subnet_name, posts_7d: a.posts_7d ?? a.post_count, score: a.score ?? a.activity_score }));

  // ── Discord signals (last 72h) ───────────────────────────────────
  const discordSignals = blobs.discordLatest
    .filter((e: any) => new Date(e?.timestamp ?? e?.created_at ?? 0).getTime() >= cutoff72h)
    .slice(0, 15)
    .map((e: any) => ({
      sn: e.netuid, name: e.subnet_name ?? e.name, channel: e.channel,
      text: (e.text ?? e.content ?? "").slice(0, 90),
      date: (e.timestamp ?? e.created_at ?? "").slice(0, 10),
    }));

  // ── Pump lab signals ─────────────────────────────────────────────
  const pumpSignals = safeArray(blobs.pumpTracker, "entries", "subnets", "pumps")
    .filter((p: any) => p && new Date(p.updated_at ?? p.timestamp ?? p.detected_at ?? 0).getTime() >= cutoff7d)
    .slice(0, 20)
    .map((p: any) => ({
      sn: p.netuid, name: p.name ?? p.subnet_name,
      pump_score: p.pump_score ?? p.score,
      signals: p.signals ?? p.signal_tags,
      date: (p.updated_at ?? p.timestamp ?? "").slice(0, 10),
    }));

  // ── Yield / APY ─────────────────────────────────────────────────
  const yieldData = safeArray(blobs.yieldLatest, "subnets", "yields")
    .filter(Boolean).slice(0, 40)
    .map((y: any) => ({ sn: y.netuid, name: y.name ?? y.subnet_name, apy_7d: y.apy_7d, apy_30d: y.apy_30d }));

  return `You are the AlphaGap Oracle — an expert AI analyst for the Bittensor (TAO) ecosystem.
You have access to REAL-TIME data for every active Bittensor subnet as of ${today}.
You are connected to ALL AlphaGap data sources: leaderboard, audit, signals, flow, whale tracker, social/KOL intel, Discord, pump lab, and yield data.

PERSONALITY:
- Direct, confident, data-driven. Like a sharp analyst, not a chatbot.
- Always cite specific subnet names, numbers, scores, and dates from the data.
- If something looks risky, say so clearly.
- Use τ for TAO amounts.
- When asked about recent developments, lead with the highest-strength dev signals and explain what was shipped in plain English.
- When asked about social buzz, use KOL heat events and benchmark alerts.
- When asked about pump signals, use the pump lab data.
- When asked about flow/accumulation, use both the leaderboard flow_score and flow events data.
- Never say you don't have access to data — you have all of it.

SCORING GUIDE:
- agap (0-100): composite quality score. 70+ = strong, 50-70 = watch, <50 = weak.
- invest: long-term hold score.
- flow: on-chain buy/sell flow. High = accumulation.
- dev: development activity. High = active builders.
- social: social/community activity score.
- audit: operational health (decentralisation, validator/miner quality).
- velo: aGap velocity — how fast score is rising/falling.
- whale: "accumulating" or "distributing" — smart money signal.
- alpha_staked_pct: % locked (not in DEX) = holder conviction.
- tao_locked: TAO in liquidity pool. Higher = deeper market.
- const_buy/const_sell: TAO bought/sold by Const (Bittensor co-founder). Major signal.
- nakamoto: decentralisation. <3 = red flag.
- hhi: stake concentration. >0.5 = red flag.
- burn_pct: % of miner emissions burned. 0% = healthy.
- Signal types: github_pr/release/commit = code shipped, huggingface_* = AI model published, dev_spike = unusual burst, whale_buy/sell = large wallet moves, flow_inflection = trend change, kol_mention = influencer post.

LIVE LEADERBOARD (${lb.length} subnets):
${JSON.stringify(lb)}

AUDIT DATA:
${JSON.stringify(auditMap)}

RECENT SIGNALS — last 72h, sorted by strength (is_dev=true = development event):
${recentSignals.length > 0 ? JSON.stringify(recentSignals) : "None in last 72h."}

FLOW EVENTS — last 7d:
${flowEvents.length > 0 ? JSON.stringify(flowEvents) : "None."}

WHALE TRACKER STATE (per subnet):
${whaleState.length > 0 ? JSON.stringify(whaleState) : "No data."}

SOCIAL / KOL HOT EVENTS — last 72h (heat_score = engagement strength):
${socialHot.length > 0 ? JSON.stringify(socialHot) : "None."}

HIGH-ENGAGEMENT KOL TWEETS — last 7d:
${benchmarks.length > 0 ? JSON.stringify(benchmarks) : "None."}

SUBNET SOCIAL ACTIVITY (Twitter posts per subnet):
${subnetSocial.length > 0 ? JSON.stringify(subnetSocial) : "No data."}

DISCORD SIGNALS — last 72h:
${discordSignals.length > 0 ? JSON.stringify(discordSignals) : "None."}

PUMP LAB — active pump signals, last 7d:
${pumpSignals.length > 0 ? JSON.stringify(pumpSignals) : "None."}

YIELD / APY DATA:
${yieldData.length > 0 ? JSON.stringify(yieldData) : "No data."}

Answer every question using the relevant data above. Be specific — cite subnet names, numbers, dates. Compute rankings from the data when asked. Never make up data.`;
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

  // Increment rate limit (fire and forget)
  incrementRateLimit(email, { date: today, count: count + 1 }).catch(() => {});

  // Load ALL data sources in parallel
  const [
    scanData,
    auditData,
    signalsData,
    flowEventsData,
    whaleTrackerData,
    socialHotData,
    benchmarkAlertsData,
    subnetActivityData,
    discordLatestData,
    pumpTrackerData,
    yieldLatestData,
  ] = await Promise.all([
    loadBlob<{ leaderboard?: unknown[] }>("scan-latest.json"),
    loadBlob<unknown>("audit-data.json"),
    loadBlob<{ signals?: unknown[] }>("signals-history.json"),
    loadBlob<unknown>("flow-events.json"),
    loadBlob<unknown>("whale-tracker.json"),
    loadBlob<unknown>("social-hot.json"),
    loadBlob<unknown>("benchmark-alerts.json"),
    loadBlob<unknown>("subnet-activity.json"),
    loadBlob<unknown>("discord-latest.json"),
    loadBlob<unknown>("pump-tracker.json"),
    loadBlob<unknown>("yield-latest.json"),
  ]);

  let systemPrompt: string;
  try {
    systemPrompt = buildSystemPrompt({
      leaderboard: (scanData as any)?.leaderboard ?? [],
      audits: auditData,
      signals: (signalsData as any)?.signals ?? [],
      flowEvents: flowEventsData,
      whaleTracker: whaleTrackerData,
      socialHot: Array.isArray(socialHotData) ? socialHotData : ((socialHotData as any)?.events ?? []),
      benchmarkAlerts: Array.isArray(benchmarkAlertsData) ? benchmarkAlertsData : ((benchmarkAlertsData as any)?.alerts ?? []),
      subnetActivity: subnetActivityData,
      discordLatest: Array.isArray(discordLatestData) ? discordLatestData : ((discordLatestData as any)?.signals ?? []),
      pumpTracker: pumpTrackerData,
      yieldLatest: yieldLatestData,
    });
  } catch (e) {
    console.error("[oracle] buildSystemPrompt failed:", e);
    return NextResponse.json({ error: "Failed to build Oracle context. Please try again." }, { status: 500 });
  }

  // Safety cap: Haiku 200K context window. Keep system prompt under ~180K chars (~45K tokens).
  const PROMPT_CHAR_LIMIT = 180_000;
  if (systemPrompt.length > PROMPT_CHAR_LIMIT) {
    console.warn(`[oracle] prompt too large (${systemPrompt.length} chars), truncating`);
    systemPrompt = systemPrompt.slice(0, PROMPT_CHAR_LIMIT) + "\n\n[Data truncated due to size limit]";
  }
  console.log(`[oracle] prompt_chars=${systemPrompt.length} user=${email}`);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Stream response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = anthropic.messages.stream({
          model: "claude-haiku-4-5",
          max_tokens: 1500,
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
      } catch (e: any) {
        console.error("[oracle] stream error:", e?.status, e?.message ?? e);
        const msg = e?.message ? `\n\n[Oracle error: ${e.message}]` : "\n\n[Oracle error — please try again]";
        controller.enqueue(new TextEncoder().encode(msg));
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
