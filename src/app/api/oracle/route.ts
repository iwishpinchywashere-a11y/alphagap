import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTier, canAccessPremium } from "@/lib/subscription";
import { get as blobGet, put } from "@vercel/blob";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Oracle daily limits per tier
// Free + Pro: no access (403)
// Premium ($49/mo): 15/day   — ~$2.70/mo worst-case with caching
// Ultra ($99/mo):   50/day   — ~$9.00/mo worst-case with caching
const DAILY_LIMITS: Record<string, number> = {
  premium: 15,
  ultra:   50,
};

// Max conversation turns sent to the model — keeps context cost bounded.
// 15 turns = 30 messages (user + assistant alternating).
const MAX_TURNS = 15;

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

  // Conviction / BIT-0011 / locked alpha / on-chain commitment
  if (match(/conviction|bit.?0011|lock|locked alpha|on.chain commit|perpetual lock|decay/))
    needs.add("conviction-latest.json");

  // General investing / hold / best / top / revenue — add audit + conviction for fuller picture
  if (match(/invest|long.term|hold|best subnet|top subnet|recommend|slept on|undervalued|conviction|revenue|earn|profit|monetiz/)) {
    needs.add("audit-data.json");
    needs.add("conviction-latest.json");
  }

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

  // ── Conviction (BIT-0011 on-chain locks) ───────────────────────
  if (loaded["conviction-latest.json"]) {
    const raw = loaded["conviction-latest.json"];
    const savedAt = (raw?.savedAt ?? "").slice(0, 10);
    const obsBlock = raw?.observedAtBlock ?? 0;
    const rows = safeArr(raw, "rows")
      .filter((r: any) => r?.totalLockedAlpha > 0)
      .sort((a: any, b: any) => (b.totalConvictionAlpha ?? 0) - (a.totalConvictionAlpha ?? 0))
      .slice(0, 30)
      .map((r: any) => {
        const lockType = r.king?.lockType ?? "unknown";
        const lastUpdate = r.king?.lastUpdate ?? 0;
        const isOwner = r.king?.isOwner ?? false;
        // BIT-0011 maturity %
        let matPct: number | null = null;
        if (lastUpdate && obsBlock) {
          const blocks = Math.max(0, obsBlock - lastUpdate);
          const halfLife = lockType === "perpetual" ? 648000 : 216000;
          matPct = Math.round((1 - Math.exp(-blocks / halfLife)) * 100);
        }
        // % of supply locked
        const priceUsd = r.priceUsd ?? 0;
        const mcap = r.market_cap ?? 0;
        const supplyPct = priceUsd > 0 && mcap > 0
          ? +((r.totalLockedAlpha * priceUsd / mcap) * 100).toFixed(1) : null;
        return {
          sn: r.netuid, name: r.name,
          locked_alpha: Math.round(r.totalLockedAlpha),
          conviction_alpha: Math.round(r.totalConvictionAlpha ?? 0),
          lock_type: lockType,
          owner_lock: isOwner,
          lockers: r.lockers?.length ?? 0,
          maturity_pct: matPct,
          supply_locked_pct: supplyPct,
          agap_signal: r.agap_signal ?? "neutral",
          invest_score: r.invest_score ?? null,
          agap_score: r.agap_score ?? null,
          whale_signal: r.whale_signal ?? null,
        };
      });
    const network = {
      subnets_locking: rows.length,
      block: obsBlock,
      saved: savedAt,
    };
    sections.push(
      `BIT-0011 CONVICTION DATA (on-chain α locks, block #${obsBlock}, saved ${savedAt}):\n` +
      `Network: ${JSON.stringify(network)}\n` +
      `Subnets (sorted by conviction α):\n${rows.length ? JSON.stringify(rows) : "No conviction locks found."}\n` +
      `NOTE: lock_type=perpetual means permanent commitment (no decay). ` +
      `maturity_pct shows how far toward maximum conviction (BIT-0011 formula). ` +
      `supply_locked_pct shows what % of total α supply is conviction-locked. ` +
      `agap_signal=strong_buy means perpetual lock + invest_score≥70 + 50k+ α locked.`
    );
  }

  // ── Signals ─────────────────────────────────────────────────────
  // signals-history.json is a flat ScanSignal[] array.
  // scan-latest.json also has a .signals array with the freshest scan's signals.
  // We merge both, deduplicate by id, and show all of them.
  // Actual signal_type values: dev_spike | hf_update | hf_drop | flow_inflection |
  //   flow_spike | flow_warning | buy_pressure | sell_pressure | price_surge |
  //   price_drop | social_buzz
  if (loaded["signals-history.json"]) {
    const DEV = new Set(["dev_spike", "hf_update", "hf_drop"]);
    const histSigs: any[] = safeArr(loaded["signals-history.json"]); // flat array
    const latestSigs: any[] = safeArr(loaded["scan-latest.json"]?.signals ?? []); // from scan
    // Merge + deduplicate by id
    const seen = new Set<number>();
    const all: any[] = [];
    for (const s of [...latestSigs, ...histSigs]) {
      if (!s || seen.has(s.id)) continue;
      seen.add(s.id);
      all.push(s);
    }
    const sigs = all
      .filter((s: any) => new Date(s.signal_date ?? s.created_at ?? 0).getTime() >= cutoff7d)
      .sort((a: any, b: any) => (b.strength ?? 0) - (a.strength ?? 0))
      .slice(0, 60)
      .map((s: any) => ({
        sn: s.netuid, name: s.subnet_name, type: s.signal_type, strength: s.strength,
        title: s.title, desc: s.description?.slice(0, 120),
        date: (s.signal_date ?? s.created_at ?? "").slice(0, 10),
        dev: DEV.has(s.signal_type),
      }));
    sections.push(`RECENT SIGNALS — last 7d (${sigs.length} total; dev=true = dev_spike/hf_update/hf_drop):\n${sigs.length ? JSON.stringify(sigs) : "None in last 7d."}`);
  }

  // ── Whale tracker ───────────────────────────────────────────────
  // Shape: { entries: WhaleSignalEntry[], currentSignals: Record<number, "accumulating"|"distributing"|null>, lastUpdatedAt: string }
  // WhaleSignalEntry fields: id, netuid, subnetName, signal, entryPrice, entryAt, status ("active"|"closed")
  if (loaded["whale-tracker.json"]) {
    const raw = loaded["whale-tracker.json"];
    // currentSignals: the live per-subnet signal map
    const currentSigs = raw?.currentSignals ?? {};
    const activeSignals = Object.entries(currentSigs)
      .filter(([, v]) => v != null)
      .map(([sn, sig]) => ({ sn: Number(sn), signal: sig }));
    // entries: historical + active signal entries
    const entries = safeArr(raw, "entries")
      .filter((w: any) => w?.status === "active")
      .slice(0, 30)
      .map((w: any) => ({
        sn: w.netuid, name: w.subnetName,
        signal: w.signal, entry_price: w.entryPrice,
        since: (w.entryAt ?? "").slice(0, 10),
      }));
    const out = { active_signals: activeSignals, active_entries: entries, updated: (raw?.lastUpdatedAt ?? "").slice(0, 10) };
    sections.push(`WHALE TRACKER:\n${activeSignals.length || entries.length ? JSON.stringify(out) : "No active whale signals."}`);
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
  // social-hot.json shape: { events: HeatEvent[], seen_ids, last_pulse }
  // HeatEvent fields: netuid, subnet_name, kol_handle, kol_name, kol_tier,
  //   tweet_text, heat_score, engagement, detected_at
  // benchmark-alerts.json: flat array with fields:
  //   netuid, subnet_name, handle, tweet_text, engagement, detected_at
  if (loaded["social-hot.json"] || loaded["benchmark-alerts.json"]) {
    const hot = safeArr(loaded["social-hot.json"], "events")
      .filter((e: any) => new Date(e?.detected_at ?? 0).getTime() >= cutoff7d)
      .sort((a: any, b: any) => (b.heat_score ?? 0) - (a.heat_score ?? 0))
      .slice(0, 20)
      .map((e: any) => ({
        sn: e.netuid, name: e.subnet_name,
        kol: e.kol_handle, tier: e.kol_tier,
        heat: e.heat_score, text: (e.tweet_text ?? "").slice(0, 100),
        date: (e.detected_at ?? "").slice(0, 10),
      }));
    const bench = safeArr(loaded["benchmark-alerts.json"]) // flat array
      .filter((e: any) => new Date(e?.detected_at ?? 0).getTime() >= cutoff7d)
      .sort((a: any, b: any) => (b.engagement ?? 0) - (a.engagement ?? 0))
      .slice(0, 15)
      .map((e: any) => ({
        sn: e.netuid, name: e.subnet_name,
        kol: e.handle, engagement: e.engagement,
        text: (e.tweet_text ?? "").slice(0, 100),
        date: (e.detected_at ?? "").slice(0, 10),
      }));
    if (hot.length) sections.push(`KOL HOT EVENTS — last 7d (sorted by heat_score):\n${JSON.stringify(hot)}`);
    if (bench.length) sections.push(`HIGH-ENGAGEMENT KOL TWEETS — last 7d:\n${JSON.stringify(bench)}`);
    if (!hot.length && !bench.length) sections.push(`KOL/SOCIAL: No events in last 7d.`);
  }

  // ── Discord ─────────────────────────────────────────────────────
  // Shape: { scannedAt, channelsScanned, results: DiscordResult[] }
  // DiscordResult fields: netuid, subnetName, channelName, signal ("alpha"|"active"|"quiet"|"noise"),
  //   alphaScore, summary, keyInsights: string[], messageCount, scannedAt
  if (loaded["discord-latest.json"]) {
    const raw = loaded["discord-latest.json"];
    const scannedAt = (raw?.scannedAt ?? "").slice(0, 10);
    const disc = safeArr(raw, "results")
      .filter((e: any) => e?.signal === "alpha" || e?.signal === "active")
      .sort((a: any, b: any) => (b.alphaScore ?? 0) - (a.alphaScore ?? 0))
      .slice(0, 15)
      .map((e: any) => ({
        sn: e.netuid, name: e.subnetName, signal: e.signal,
        score: e.alphaScore, summary: (e.summary ?? "").slice(0, 120),
        insights: (e.keyInsights ?? []).slice(0, 3),
        msgs: e.messageCount,
      }));
    sections.push(`DISCORD SCAN (as of ${scannedAt}):\n${disc.length ? JSON.stringify(disc) : "No alpha or active channels in latest scan."}`);
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

RULES — READ CAREFULLY:
- Talk like a knowledgeable friend, not a report. Short sentences. Plain English.
- NEVER use markdown tables (no | pipes, no --- dividers). They render as garbage.
- NEVER use bullet point dashes like "- item". Use ▸ or just write it as sentences.
- Don't over-explain every data field. Just give the answer people actually care about.
- Cite subnet names and key numbers but don't dump raw JSON or every field you have.
- If a data source is empty, say it in one sentence and move on to what IS useful.
- For "revenue": Bittensor has no P&L. Use emission_pct (TAO earned) as the proxy. Just explain it naturally.
- For "dev activity": use dev_spike/hf_update/hf_drop signals first, fall back to dev_score ranking.
- For "discord": if nothing notable, say so in one line then pivot to social/KOL data.
- Keep answers focused. 3-5 points is usually enough. Don't write essays.

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

BIT-0011 CONVICTION (if conviction-latest.json loaded):
- locked_alpha: actual α locked on-chain via BIT-0011. This is real committed capital.
- lock_type=perpetual: founder/whale committed permanently — strongest signal.
- lock_type=decaying: conviction shrinks over time unless renewed.
- maturity_pct: how far toward max conviction (low = recently locked, high = long-term holder).
- supply_locked_pct: what % of the subnet's total supply is locked — 5%+ is significant, 15%+ is very high.
- owner_lock=true: the subnet owner/founder has locked — direct "skin in the game".
- agap_signal=strong_buy: perpetual lock + invest_score≥70 + 50k+ α = highest conviction signal.
- Conviction is a LONG-TERM signal — it shows who can't easily exit. Treat it as commitment, not price prediction.

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

  // Free and Pro have no Oracle access — use canAccessPremium so ultra is always included
  if (!canAccessPremium(tier))
    return NextResponse.json({ error: "premium_required" }, { status: 403 });

  // Fail-closed: if tier isn't in DAILY_LIMITS (should never happen after the gate above), block.
  const dailyLimit = DAILY_LIMITS[tier] ?? 0;
  if (dailyLimit === 0)
    return NextResponse.json({ error: "premium_required" }, { status: 403 });
  const email = session.user.email;
  const today = new Date().toISOString().slice(0, 10);
  const rl = await getRateLimit(email);
  const count = rl.date === today ? rl.count : 0;

  if (count >= dailyLimit)
    return NextResponse.json({ error: "rate_limited", message: `You've used all ${dailyLimit} Oracle queries today. Resets at midnight UTC.` }, { status: 429 });

  const { messages: rawMessages } = await req.json() as { messages: { role: string; content: string }[] };
  if (!rawMessages?.length)
    return NextResponse.json({ error: "No messages" }, { status: 400 });

  // Cap at MAX_TURNS to prevent ballooning context costs in long conversations.
  // Keep the last N messages (pairs of user+assistant), always ending on a user message.
  const messages = rawMessages.slice(-MAX_TURNS * 2);

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
        // Prompt caching: mark the system prompt block as cacheable.
        // Anthropic caches this for 5 minutes — subsequent queries within the
        // window pay $0.08/M instead of $0.80/M on input tokens (~10x savings).
        const anthropicStream = anthropic.messages.stream({
          model: "claude-haiku-4-5",
          max_tokens: 1500,
          system: [
            {
              type: "text",
              text: systemPrompt,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        } as Parameters<typeof anthropic.messages.stream>[0]);
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
      "X-Oracle-Remaining": String(dailyLimit - count - 1),
      "X-Oracle-Limit": String(dailyLimit),
    },
  });
}
