/**
 * GET /api/cron/feed-digest — every 6 hours.
 *
 * Builds the /feed page's content: one written card per subnet that actually
 * did something in the last 48h, instead of a filterable firehose of raw
 * signals. The old feed made the user do the aggregation; this does it for
 * them — every subnet's recent story in one card.
 *
 * MATERIALITY BAR. 110 of 123 subnets fire some signal in any 48h window,
 * almost all of it flow noise (a hundred-plus flow_spike/flow_warning rows).
 * A card requires a real event — shipped code, a gate move, a large score or
 * price move. Flow only ever appears as supporting detail inside a card, and
 * a quiet subnet gets no card at all. Fewer, denser posts is the point.
 *
 * COST CONTROL. Each card stores a fingerprint of the facts it was written
 * from. If a subnet's facts have not changed since its last card, the card is
 * carried forward untouched — no rewrite, no drift, no Haiku call. A full run
 * with nothing new costs zero model calls.
 */

import { NextRequest, NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";
import crypto from "crypto";
import { BENCHMARK_MAP } from "@/lib/benchmarks";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const DIGEST_BLOB = "feed-digest.json";
// Volume target is a few dozen cards per DAY at most, fewer when quiet.
// 8 per run x 4 runs = 32/day worst case, and the fingerprint carry-forward
// means a typical day writes far fewer — only genuinely new events.
const MAX_NEW_CARDS_PER_RUN = 8;
const CARD_TTL_DAYS = 7;

interface SignalRow {
  netuid: number; signal_type: string; strength: number; title: string;
  description: string; created_at: string; subnet_name?: string;
}
interface LeaderRow {
  netuid: number; name: string; composite_score: number; invest_agap?: number;
  dev_score?: number; flow_score?: number; product_score?: number;
  alpha_price?: number; market_cap?: number; emission_pct?: number;
  price_change_24h?: number; price_change_7d?: number; net_flow_24h?: number;
  net_flow_7d?: number; emission_change_pct?: number; score_delta_24h?: number;
  whale_ratio?: number; whale_signal?: string;
}
interface DiscordEntry {
  netuid?: number; alphaScore?: number; founderPost?: boolean;
  summary?: string; keyInsights?: string[]; alphaTake?: string; scannedAt?: string;
}
interface HeatEvent {
  netuid: number; kol_handle?: string; heat_score?: number;
  engagement?: number; detected_at?: string;
}
export interface FeedCard {
  netuid: number;
  name: string;
  headline: string;
  /** Legacy single-paragraph body; kept so pre-bullet cards still render. */
  body: string;
  /** 1-3 short bullets — one per distinct thing that happened. */
  bullets?: string[];
  facts: string[];          // short chips rendered under the body
  tags: string[];           // category badges: DEV, SOCIAL, EMISSIONS, …
  materiality: number;      // drives feed ordering
  fingerprint: string;
  writtenAt: string;        // when the text was generated
  updatedAt: string;        // last time facts were confirmed current
}


/**
 * Category tags, derived from the fact chips rather than stored state, so
 * carried-forward and TTL-tail cards get correct tags without a rewrite and
 * a tag taxonomy change never needs a cache purge.
 */
function deriveTags(facts: string[]): string[] {
  const tags = new Set<string>();
  for (const f of facts) {
    if (/dev signal/.test(f)) tags.add("DEV");
    if (/model release/.test(f)) tags.add("MODEL");
    if (/emission bar|emissions/.test(f)) tags.add("EMISSIONS");
    if (/aGap [+-]/.test(f)) tags.add("SCORE");
    if (/price [+-]/.test(f)) tags.add("PRICE");
    if (/Discord|founder|trending on X/.test(f)) tags.add("SOCIAL");
    if (/whales accumulating/.test(f)) tags.add("WHALE");
    // The net-TAO chip is context on every card; only sizeable moves earn
    // the FLOW badge, or the tag would appear on everything and mean nothing.
    const m = f.match(/^([+-]\d+) TAO net/);
    if (m && Math.abs(Number(m[1])) >= 200) tags.add("FLOW");
  }
  return [...tags];
}

async function readBlob<T>(name: string): Promise<T | null> {
  try {
    const b = await blobGet(name, { token: TOKEN, access: "private", abortSignal: AbortSignal.timeout(10000) });
    if (!b?.stream) return null;
    const r = b.stream.getReader(); const cs: Uint8Array[] = [];
    while (true) { const { done, value } = await r.read(); if (done) break; cs.push(value); }
    return JSON.parse(Buffer.concat(cs).toString("utf-8"));
  } catch { return null; }
}

/** Same guardrails as the X bot rewrite: concrete, checkable, no filler. */
const DIGEST_SYSTEM = `You write short update cards for AlphaGap's feed, covering Bittensor subnets.

Readers are INVESTORS, not engineers. Most have never run a validator and do
not know what one is. Every card must be understandable by a smart person who
knows nothing about software.

TRANSLATE, don't recite. The facts you get are full of technical terms —
validators, miners, memory leaks, APIs, endpoints, commits, cross-chain
scoring. Turn each into what it MEANS:
- "fixed critical validator bugs" -> "fixed serious problems that were
  stopping the network from paying contributors correctly"
- "10.9GB memory leak per cycle" -> "fixed a flaw that made their machines
  waste huge amounts of capacity every cycle"
- "shipped inference API" -> "opened the door for customers to actually use
  the AI service"
- "29k labeled training episodes" -> "released a large batch of training
  data that makes their AI better at its job"
Keep the numbers that matter to an investor (emissions %, price %, TAO
flow); drop the ones that only matter to a programmer (GB, commit counts,
version numbers).

Rules:
- HEADLINE: max 9 words, no emoji, no subnet name, no technical terms. Say
  what happened in plain words: "Fixed the problems blocking new contributors".
- BULLETS: 1-3 short bullets, one per DISTINCT thing that happened — a
  shipped feature is one bullet, an emissions move is another, community
  news a third. Each bullet is a single plain sentence under 130 characters.
  Do NOT pad: one real event means one bullet, never split a single story
  into filler bullets. If the research notes help a newcomer place the
  subnet, the LAST bullet may say what it is for.
- Only claims supported by the facts given. Never speculate about price
  direction, never say "bullish", "heating up", "one to watch". No advice.
- Explain like you would to a friend who invests but doesn't code.
Return JSON only: {"headline": "...", "bullets": ["...", "..."]}`;

async function writeCard(prompt: string): Promise<{ headline: string; body: string; bullets: string[] } | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5", max_tokens: 300, system: DIGEST_SYSTEM,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const text: string = j?.content?.[0]?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    if (typeof parsed.headline !== "string" || !Array.isArray(parsed.bullets) || parsed.bullets.length === 0) return null;
    const bullets = parsed.bullets
      .filter((x: unknown): x is string => typeof x === "string" && x.trim().length > 0)
      .slice(0, 3)
      .map((x: string) => x.trim().replace(/^[-•*]\s*/, "").slice(0, 180));
    if (!bullets.length) return null;
    // body kept as the joined form for anything still reading the old field
    return { headline: parsed.headline.slice(0, 90), bullets, body: bullets.join(" ") };
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  if (req.headers.get("x-vercel-cron") !== "1") {
    if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  if (!TOKEN || !ANTHROPIC_KEY) {
    return NextResponse.json({ error: "missing env" }, { status: 500 });
  }

  const [scan, signals, existing, discordRaw, socialHot] = await Promise.all([
    readBlob<{ lastScan?: string; leaderboard?: LeaderRow[] }>("scan-latest.json"),
    readBlob<SignalRow[]>("signals-history.json"),
    readBlob<FeedCard[]>(DIGEST_BLOB),
    readBlob<{ results?: DiscordEntry[] }>("discord-latest.json"),
    readBlob<{ events?: HeatEvent[] }>("social-hot.json"),
  ]);
  const leaderboard = scan?.leaderboard ?? [];
  if (leaderboard.length < 50) {
    return NextResponse.json({ ok: false, reason: "leaderboard thin — not overwriting feed" }, { status: 500 });
  }
  // Same staleness rule as the X bot: never present frozen stats as news.
  const scanAgeH = scan?.lastScan ? (Date.now() - new Date(scan.lastScan).getTime()) / 3600000 : Infinity;
  if (scanAgeH > 12) {
    return NextResponse.json({ ok: true, skipped: true, reason: `scan stale (${scanAgeH.toFixed(1)}h)` });
  }

  const cutoff = Date.now() - 48 * 3600000;
  const recent = (signals ?? []).filter(s => new Date(s.created_at).getTime() > cutoff);

  // Community + market sources, keyed by netuid. These were missing from the
  // first version, which made the feed read as dev-only: Discord scans,
  // KOL heat on X and whale accumulation all existed and never fed a card.
  const discordBy = new Map<number, DiscordEntry>();
  for (const d of discordRaw?.results ?? []) {
    if (d.netuid == null) continue;
    const cur = discordBy.get(d.netuid);
    if (!cur || (d.alphaScore ?? 0) > (cur.alphaScore ?? 0)) discordBy.set(d.netuid, d);
  }
  const heatBy = new Map<number, HeatEvent[]>();
  for (const e of socialHot?.events ?? []) {
    if (!e.detected_at || new Date(e.detected_at).getTime() <= cutoff) continue;
    if (!heatBy.has(e.netuid)) heatBy.set(e.netuid, []);
    heatBy.get(e.netuid)!.push(e);
  }
  const byNetuid = new Map<number, SignalRow[]>();
  for (const s of recent) {
    if (!byNetuid.has(s.netuid)) byNetuid.set(s.netuid, []);
    byNetuid.get(s.netuid)!.push(s);
  }

  // ── Score materiality per subnet ─────────────────────────────────
  const candidates: Array<{ row: LeaderRow; sigs: SignalRow[]; materiality: number; facts: string[]; fingerprint: string }> = [];
  for (const row of leaderboard) {
    const sigs = byNetuid.get(row.netuid) ?? [];
    const dev = sigs.filter(s => s.signal_type === "dev_spike" && s.strength >= 55);
    const gate = sigs.filter(s => s.signal_type.startsWith("gate_"));
    const hf = sigs.filter(s => s.signal_type === "hf_update");
    const scoreD = Math.abs(row.score_delta_24h ?? 0);
    const px24 = row.price_change_24h ?? 0;
    const px7 = row.price_change_7d ?? 0;
    const emD = row.emission_change_pct ?? 0;

    let materiality = 0;
    const facts: string[] = [];

    if (dev.length) { materiality += 40 + Math.max(...dev.map(d => d.strength)) / 4; facts.push(`${dev.length} dev signal${dev.length > 1 ? "s" : ""}`); }
    if (hf.length) { materiality += 20; facts.push("new model release"); }
    if (gate.length) { materiality += 30; facts.push(gate[0].signal_type === "gate_convexity" ? "near emission bar, demand rising" : "sliding toward emission bar"); }
    if (scoreD >= 8) { materiality += 25; facts.push(`aGap ${row.score_delta_24h! > 0 ? "+" : ""}${row.score_delta_24h!.toFixed(0)} in 24h`); }
    if (Math.abs(px24) >= 12) { materiality += 20; facts.push(`price ${px24 > 0 ? "+" : ""}${px24.toFixed(0)}% 24h`); }
    else if (Math.abs(px7) >= 25) { materiality += 15; facts.push(`price ${px7 > 0 ? "+" : ""}${px7.toFixed(0)}% 7d`); }
    if (Math.abs(emD) >= 20) { materiality += 15; facts.push(`emissions ${emD > 0 ? "+" : ""}${emD.toFixed(0)}%`); }
    // Community + market events
    const disc = discordBy.get(row.netuid);
    if (disc && (disc.alphaScore ?? 0) >= 50) {
      materiality += 25; facts.push("Discord activity");
      if (disc.founderPost) { materiality += 15; facts.push("founder posted"); }
    }
    const heat = (heatBy.get(row.netuid) ?? []).sort((a, b) => (b.heat_score ?? 0) - (a.heat_score ?? 0));
    // Threshold calibrated against the live distribution (n=105: p50=31,
    // p90=44, max=53). The first draft used 60 — above the maximum ever
    // recorded, so the X wire could never fire. Same lesson as the mcap
    // ladder: never set a threshold without looking at the data it gates.
    if (heat.length && (heat[0].heat_score ?? 0) >= 45) {
      materiality += 20; facts.push(`trending on X (${heat.length} KOL post${heat.length > 1 ? "s" : ""})`);
    }
    if (row.whale_signal === "accumulating" && (row.whale_ratio ?? 0) >= 1.5) {
      materiality += 15; facts.push(`whales accumulating ${row.whale_ratio!.toFixed(1)}x`);
    }

    // Flow is context, not a qualifying event — it fires on a third of the
    // network every window and would rebuild the firehose this replaces.
    if (materiality > 0 && (row.net_flow_24h ?? 0) !== 0) {
      facts.push(`${(row.net_flow_24h ?? 0) > 0 ? "+" : ""}${(row.net_flow_24h ?? 0).toFixed(0)} TAO net 24h`);
    }

    if (materiality < 25) continue;

    const fingerprint = crypto.createHash("sha256")
      // PROMPT_V is part of the fingerprint so a voice change invalidates
      // every carried card: without it, old-voice cards persist until their
      // facts happen to change.
      .update(JSON.stringify(["v3-bullets", row.netuid, facts, dev.map(d => d.title).sort()]))
      .digest("hex").slice(0, 16);
    candidates.push({ row, sigs: [...dev, ...gate, ...hf], materiality, facts, fingerprint });
  }
  candidates.sort((a, b) => b.materiality - a.materiality);

  // ── Write / carry forward ────────────────────────────────────────
  const prev = new Map((existing ?? []).map(c => [c.netuid, c]));
  const now = new Date().toISOString();
  const out: FeedCard[] = [];
  let written = 0, carried = 0;

  for (const c of candidates) {
    const old = prev.get(c.row.netuid);
    if (old && old.fingerprint === c.fingerprint) {
      out.push({ ...old, materiality: c.materiality, updatedAt: now, tags: deriveTags(c.facts) });
      carried++;
      continue;
    }
    if (written >= MAX_NEW_CARDS_PER_RUN) {
      if (old) { out.push({ ...old, updatedAt: now }); carried++; }
      continue;
    }

    const b = BENCHMARK_MAP.get(c.row.netuid);
    const research = b
      ? `Research notes: ${(b.benchmark_summary ?? "").split(" AUDIT:")[0].slice(0, 350)}`
      : "";
    const devLines = c.sigs.filter(s => s.signal_type === "dev_spike")
      .map(s => `- ${s.title}`).slice(0, 3).join("\n");
    const discEntry = discordBy.get(c.row.netuid);
    const discLine = discEntry && (discEntry.alphaScore ?? 0) >= 50
      ? `Community (their Discord): ${(discEntry.summary ?? "").slice(0, 220)}${discEntry.alphaTake ? ` Take: ${discEntry.alphaTake.slice(0, 140)}` : ""}`
      : "";

    const prompt = `Subnet: ${c.row.name} (SN${c.row.netuid}). Last 48h facts:
${c.facts.map(f => `- ${f}`).join("\n")}
${devLines ? `Dev activity:\n${devLines}` : ""}
${discLine}
Current: aGap ${c.row.composite_score}, price $${(c.row.alpha_price ?? 0).toFixed(2)}, mcap $${((c.row.market_cap ?? 0) / 1e6).toFixed(1)}M.
${research}`;

    const card = await writeCard(prompt);
    if (!card) { if (old) { out.push({ ...old, updatedAt: now }); carried++; } continue; }
    out.push({
      netuid: c.row.netuid, name: c.row.name,
      headline: card.headline, body: card.body, bullets: card.bullets,
      facts: c.facts, tags: deriveTags(c.facts), materiality: c.materiality,
      fingerprint: c.fingerprint, writtenAt: now, updatedAt: now,
    });
    written++;
  }

  // Keep still-fresh cards for subnets that went quiet, so the feed has depth.
  const ttlCut = Date.now() - CARD_TTL_DAYS * 86400000;
  const have = new Set(out.map(c => c.netuid));
  for (const old of existing ?? []) {
    if (!have.has(old.netuid) && new Date(old.writtenAt).getTime() > ttlCut) {
      out.push({ ...old, tags: old.tags ?? deriveTags(old.facts ?? []) });
    }
  }
  out.sort((a, b) => new Date(b.writtenAt).getTime() - new Date(a.writtenAt).getTime());

  await put(DIGEST_BLOB, JSON.stringify(out), {
    access: "private", addRandomSuffix: false, allowOverwrite: true, token: TOKEN, contentType: "application/json",
  });
  console.log(`[feed-digest] ${out.length} cards (${written} written, ${carried} carried, ${candidates.length} candidates)`);
  return NextResponse.json({ ok: true, cards: out.length, written, carried, candidates: candidates.length });
}
