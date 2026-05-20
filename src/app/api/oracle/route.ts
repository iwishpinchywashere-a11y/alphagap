import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTier } from "@/lib/subscription";
import { get as blobGet, put } from "@vercel/blob";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAILY_LIMIT = 25;
const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN || "";

// ── Rate limit helpers ───────────────────────────────────────────────
function rlKey(email: string) {
  return `oracle-rl/${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}.json`;
}

async function getRateLimit(email: string): Promise<{ date: string; count: number }> {
  try {
    const b = await blobGet(rlKey(email), { token: TOKEN(), access: "private" });
    if (!b?.stream) return { date: "", count: 0 };
    const reader = b.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch { return { date: "", count: 0 }; }
}

async function incrementRateLimit(email: string, current: { date: string; count: number }) {
  await put(rlKey(email), JSON.stringify(current), {
    access: "private", token: TOKEN(), addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
  });
}

// ── Generic blob loader ──────────────────────────────────────────────
async function loadBlob<T>(name: string): Promise<T | null> {
  try {
    const b = await blobGet(name, { token: TOKEN(), access: "private" });
    if (!b?.stream) return null;
    const reader = b.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch { return null; }
}

// ── Safe array extractor ─────────────────────────────────────────────
function safeArr(raw: any, ...keys: string[]): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  for (const k of keys) if (Array.isArray(raw[k])) return raw[k];
  try { return (Object.values(raw) as any[]).filter(Boolean); } catch { return []; }
}

// ── Intent classifier — decide which blobs to load ──────────────────
// Returns the minimum set of blob keys needed to answer this question.
// leaderboard (scan-latest) is always included as the base layer.
function classifyIntent(messages: { role: string; content: string }[]): Set<string> {
  const text = messages.slice(-4).map(m => m.content).join(" ").toLowerCase();
  const needs = new Set<string>(["scan-latest.json"]); // always the base

  const match = (...pats: RegExp[]) => pats.some(p => p.test(text));

  // Audit / health / red flags / decentralisation
  if (match(/audit|nakamoto|naka|decen|hhi|validator|miner|burn|flag|risk|danger|avoid|worst|health|safe/))
    needs.add("audit-data.json");

  // Dev activity / code shipped / releases
  if (match(/dev|code|github|shipped|release|built|model|hugging|pr|commit|development|progress|update|launch/))
    needs.add("signals-history.json");

  // Signals / recent events / alerts in general
  if (match(/signal|recent|latest|happening|new alert|activity/))
    needs.add("signals-history.json");

  // Whale / smart money / const wallet
  if (match(/whale|smart money|const |accumul|distribut|big buyer|wallet/)) {
    needs.add("whale-tracker.json");
    needs.add("signals-history.json");
  }

  // On-chain flow / buy pressure
  if (match(/flow|inflow|outflow|buy pressure|sell pressure|net buy|net sell/))
    needs.add("flow-events.json");

  // Social / KOL / Twitter / influencer
  if (match(/social|kol|twitter|buzz|mention|influenc|hot|trending|tweet|talked about/)) {
    needs.add("social-hot.json");
    needs.add("benchmark-alerts.json");
  }

  // Discord
  if (match(/discord|community chat/))
    needs.add("discord-latest.json");

  // Pump lab / early momentum
  if (match(/pump|early sign|momentum|about to|surge/))
    needs.add("pump-tracker.json");

  // Yield / APY / staking rewards
  if (match(/yield|apy|return|staking reward|passive/))
    needs.add("yield-latest.json");

  // General investing / hold / best / top / revenue — add audit for fuller picture
  if (match(/invest|long.term|hold|best subnet|top subnet|recommend|slept on|undervalued|conviction|revenue|earn|profit|monetiz/))
    needs.add("audit-data.json");

  // Broad / open-ended questions — default to leaderboard + audit + signals
  if (needs.size === 1) {
    needs.add("audit-data.json");
    needs.add("signals-history.json");
  }

  return needs;
}

// ── Build prompt from only the blobs we loaded ───────────────────────
function buildSystemPrompt(loaded: Record<string, any>): string {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff72h = Date.now() - 72 * 3600 * 1000;
  const cutoff7d  = Date.now() - 7  * 24 * 3600 * 1000;
  const sections: string[] = [];

  // ── Leaderboard (always) ────────────────────────────────────────
  const lb = safeArr(loaded["scan-latest.json"]?.leaderboard).map((s: any) => ({
    sn: s.netuid, name: s.name, agap: s.composite_score,
    invest: s.invest_agap, flow: s.flow_score, dev: s.dev_score, social: s.social_score,
    mcap: s.market_cap ? Math.round(s.market_cap) : null,
    price: s.alpha_price, chg_24h: s.price_change_24h, chg_7d: s.price_change_7d,
    emission_pct: s.emission_pct, staked_pct: s.alpha_staked_pct, tao_locked: s.tao_locked,
    whale: s.whale_signal, vol_surge: s.volume_surge || false,
    const_buy: s.const_buy_tao, const_sell: s.const_sell_tao,
    velo: s.agap_velo, apy_7d: s.apy_7d, category: s.category, audit: s.audit_score,
  }));
  sections.push(`LEADERBOARD (${lb.length} subnets):\n${JSON.stringify(lb)}`);

  // ── Audit ───────────────────────────────────────────────────────
  if (loaded["audit-data.json"]) {
    const auditMap: Record<string, any> = {};
    const raw = loaded["audit-data.json"];
    const src = raw?.subnets ?? raw;
    if (src && typeof src === "object") {
      for (const [id, a] of Object.entries(src as Record<string, any>)) {
        if (!a) continue;
        auditMap[id] = {
          nakamoto: a.nakamotoCoefficient, hhi: a.hhiNormalized, top10: a.top10Share,
          burn_pct: a.burnedEmissionPct, chain_buy: a.emissionChainBuysPct,
          stale_val: a.staleValidatorPct, zi_miner: a.zeroIncentiveMinerPct,
          vtrust: a.avgVTrust, holders: a.holdersCount, tao_pool: a.taoInPool,
          flags: a.flags?.map((f: any) => f.message) ?? [],
        };
      }
    }
    sections.push(`AUDIT DATA:\n${JSON.stringify(auditMap)}`);
  }

  // ── Signals ─────────────────────────────────────────────────────
  if (loaded["signals-history.json"]) {
    // Actual signal types stored in the blob:
    // dev: "dev_spike", "hf_update", "hf_drop"
    // flow: "flow_inflection", "flow_spike", "flow_warning"
    // price: "price_surge", "price_drop", "buy_pressure", "sell_pressure"
    // social: "social_buzz"
    const DEV = new Set(["dev_spike", "hf_update", "hf_drop"]);
    // Use 7d window (not 72h) so we don't miss dev events on quiet weeks
    const sigs = safeArr(loaded["signals-history.json"], "signals")
      .filter((s: any) => new Date(s.signal_date ?? s.created_at ?? 0).getTime() >= cutoff7d)
      .sort((a: any, b: any) => (b.strength ?? 0) - (a.strength ?? 0))
      .slice(0, 60)
      .map((s: any) => ({
        sn: s.netuid, name: s.subnet_name, type: s.signal_type, strength: s.strength,
        title: s.title, desc: s.description?.slice(0, 120),
        date: (s.signal_date ?? s.created_at ?? "").slice(0, 10),
        dev: DEV.has(s.signal_type),
      }));
    sections.push(`RECENT SIGNALS — last 7d (dev=true means dev_spike/hf_update/hf_drop):\n${sigs.length ? JSON.stringify(sigs) : "None in last 7d."}`);
  }

  // ── Whale tracker ───────────────────────────────────────────────
  if (loaded["whale-tracker.json"]) {
    const whales = safeArr(loaded["whale-tracker.json"], "whales", "subnets")
      .filter(Boolean).slice(0, 40)
      .map((w: any) => ({
        sn: w.netuid, name: w.name ?? w.subnet_name,
        signal: w.signal ?? w.whale_signal, buy_ratio: w.buy_ratio,
        net_tao_7d: w.net_tao_7d, updated: (w.updated_at ?? "").slice(0, 10),
      }));
    sections.push(`WHALE TRACKER:\n${whales.length ? JSON.stringify(whales) : "No data."}`);
  }

  // ── Flow events ─────────────────────────────────────────────────
  if (loaded["flow-events.json"]) {
    const flow = safeArr(loaded["flow-events.json"], "events", "flowEvents", "flow")
      .filter((e: any) => new Date(e?.timestamp ?? e?.created_at ?? 0).getTime() >= cutoff7d)
      .slice(0, 25)
      .map((e: any) => ({
        sn: e.netuid, name: e.subnet_name ?? e.name, type: e.event_type ?? e.type,
        net_tao: e.net_tao ?? e.netTao, date: (e.timestamp ?? e.created_at ?? "").slice(0, 10),
      }));
    sections.push(`FLOW EVENTS — last 7d:\n${flow.length ? JSON.stringify(flow) : "None."}`);
  }

  // ── Social / KOL ────────────────────────────────────────────────
  if (loaded["social-hot.json"] || loaded["benchmark-alerts.json"]) {
    const hot = safeArr(loaded["social-hot.json"], "events")
      .filter((e: any) => new Date(e?.timestamp ?? e?.created_at ?? 0).getTime() >= cutoff7d)
      .slice(0, 20)
      .map((e: any) => ({
        sn: e.netuid, name: e.subnet_name ?? e.name, kol: e.kol ?? e.username,
        heat: e.heat_score ?? e.score, text: (e.text ?? e.content ?? "").slice(0, 90),
        date: (e.timestamp ?? e.created_at ?? "").slice(0, 10),
      }));
    const bench = safeArr(loaded["benchmark-alerts.json"], "alerts")
      .filter((e: any) => new Date(e?.timestamp ?? e?.created_at ?? 0).getTime() >= cutoff7d)
      .slice(0, 15)
      .map((e: any) => ({
        sn: e.netuid, name: e.subnet_name ?? e.name, kol: e.username ?? e.kol,
        likes: e.likes ?? e.like_count, text: (e.text ?? e.content ?? "").slice(0, 90),
        date: (e.timestamp ?? e.created_at ?? "").slice(0, 10),
      }));
    if (hot.length) sections.push(`KOL HOT EVENTS — last 72h:\n${JSON.stringify(hot)}`);
    if (bench.length) sections.push(`HIGH-ENGAGEMENT KOL TWEETS — last 7d:\n${JSON.stringify(bench)}`);
  }

  // ── Discord ─────────────────────────────────────────────────────
  if (loaded["discord-latest.json"]) {
    const disc = safeArr(loaded["discord-latest.json"], "signals")
      .filter((e: any) => new Date(e?.timestamp ?? e?.created_at ?? 0).getTime() >= cutoff7d)
      .slice(0, 15)
      .map((e: any) => ({
        sn: e.netuid, name: e.subnet_name ?? e.name, channel: e.channel,
        text: (e.text ?? e.content ?? "").slice(0, 90),
        date: (e.timestamp ?? e.created_at ?? "").slice(0, 10),
      }));
    sections.push(`DISCORD SIGNALS — last 72h:\n${disc.length ? JSON.stringify(disc) : "None."}`);
  }

  // ── Pump lab ────────────────────────────────────────────────────
  if (loaded["pump-tracker.json"]) {
    const pumps = safeArr(loaded["pump-tracker.json"], "entries", "subnets", "pumps")
      .filter((p: any) => p && new Date(p.updated_at ?? p.timestamp ?? p.detected_at ?? 0).getTime() >= cutoff7d)
      .slice(0, 20)
      .map((p: any) => ({
        sn: p.netuid, name: p.name ?? p.subnet_name,
        score: p.pump_score ?? p.score, signals: p.signals ?? p.signal_tags,
        date: (p.updated_at ?? p.timestamp ?? "").slice(0, 10),
      }));
    sections.push(`PUMP LAB — last 7d:\n${pumps.length ? JSON.stringify(pumps) : "None."}`);
  }

  // ── Yield ───────────────────────────────────────────────────────
  if (loaded["yield-latest.json"]) {
    const yields = safeArr(loaded["yield-latest.json"], "subnets", "yields")
      .filter(Boolean).slice(0, 40)
      .map((y: any) => ({ sn: y.netuid, name: y.name ?? y.subnet_name, apy_7d: y.apy_7d, apy_30d: y.apy_30d }));
    sections.push(`YIELD / APY DATA:\n${yields.length ? JSON.stringify(yields) : "No data."}`);
  }

  const loadedKeys = Object.keys(loaded).join(", ");

  return `You are the AlphaGap Oracle — expert AI analyst for the Bittensor (TAO) ecosystem. Date: ${today}.
Loaded data sources for this query: ${loadedKeys}

RULES:
- Direct, data-driven. No filler. Cite subnet names, numbers, dates.
- Use τ for TAO. Flag risks clearly.
- Answer from the data you have. If a specific data source shows "None" or is missing, say so briefly then immediately pivot to answer using related data you DO have. Never dwell on missing data.
- For "revenue" / "earnings" questions: Bittensor subnets don't have P&L. Answer using emission_pct (share of TAO emissions = closest proxy for revenue), tao_locked (liquidity depth), and market_cap from the leaderboard.
- For "dev activity" / "shipped" questions: look at signals with dev=true AND the leaderboard dev_score field. If no dev signals in the window, rank by dev_score.
- For "discord" questions: if discord-latest shows no data, say monitoring is active but nothing notable was flagged, then use social/KOL data if available.
- For any question where data appears empty, always fall back to the leaderboard data which has scores for every subnet.

SCORES:
- agap: composite score. 70+=strong, 50-70=watch, <50=weak.
- dev: build activity (higher = more active development).
- flow: on-chain buy pressure. High = accumulation.
- velo: momentum — rising or falling score velocity.
- social: community/social activity.
- emission_pct: share of total TAO emission this subnet earns (revenue proxy).
- staked_pct: % of alpha locked by holders (conviction signal).
- tao_locked: TAO in liquidity pool (market depth).
- const_buy/sell: TAO moved by Const (Bittensor co-founder) — major signal.
- audit (nakamoto<3=red flag, hhi>0.5=red flag, burn_pct high=miners may leave).

SIGNAL TYPES (actual values):
- dev_spike: unusual burst of GitHub/development activity
- hf_update: HuggingFace model or dataset updated
- hf_drop: new HuggingFace model/dataset published
- flow_inflection: buy/sell trend reversal
- flow_spike: sudden surge in buy volume
- flow_warning: sell pressure detected
- buy_pressure / sell_pressure: sustained directional flow
- price_surge / price_drop: significant price move
- social_buzz: spike in social media mentions

${sections.join("\n\n")}`;
}

// ── Main handler ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const tier = getTier(session);
  if (tier !== "premium")
    return NextResponse.json({ error: "premium_required" }, { status: 403 });

  const email = session.user.email;
  const today = new Date().toISOString().slice(0, 10);
  const rl = await getRateLimit(email);
  const count = rl.date === today ? rl.count : 0;

  if (count >= DAILY_LIMIT)
    return NextResponse.json({ error: "rate_limited", message: `You've used all ${DAILY_LIMIT} Oracle queries today. Resets at midnight UTC.` }, { status: 429 });

  const { messages } = await req.json() as { messages: { role: string; content: string }[] };
  if (!messages?.length)
    return NextResponse.json({ error: "No messages" }, { status: 400 });

  // Fire-and-forget rate limit increment
  incrementRateLimit(email, { date: today, count: count + 1 }).catch(() => {});

  // ── Intent-based blob selection ──────────────────────────────────
  const neededBlobs = classifyIntent(messages);
  console.log(`[oracle] user=${email} blobs=[${[...neededBlobs].join(",")}]`);

  // Load only the blobs we need, in parallel
  const blobEntries = await Promise.all(
    [...neededBlobs].map(async key => [key, await loadBlob(key)] as const)
  );
  const loaded: Record<string, any> = Object.fromEntries(blobEntries);

  // Build prompt
  let systemPrompt: string;
  try {
    systemPrompt = buildSystemPrompt(loaded);
  } catch (e) {
    console.error("[oracle] buildSystemPrompt error:", e);
    return NextResponse.json({ error: "Failed to build Oracle context." }, { status: 500 });
  }

  // Hard cap: Haiku 200K context window — keep well under
  const CHAR_LIMIT = 160_000;
  if (systemPrompt.length > CHAR_LIMIT) {
    console.warn(`[oracle] prompt truncated: ${systemPrompt.length} chars`);
    systemPrompt = systemPrompt.slice(0, CHAR_LIMIT) + "\n[truncated]";
  }
  console.log(`[oracle] prompt_chars=${systemPrompt.length}`);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Stream response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = anthropic.messages.stream({
          model: "claude-haiku-4-5",
          max_tokens: 1500,
          system: systemPrompt,
          messages: messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        });
        for await (const chunk of anthropicStream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta")
            controller.enqueue(new TextEncoder().encode(chunk.delta.text));
        }
      } catch (e: any) {
        console.error("[oracle] stream error:", e?.status, e?.message ?? e);
        controller.enqueue(new TextEncoder().encode(`\n\n[Oracle error: ${e?.message ?? "please try again"}]`));
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
