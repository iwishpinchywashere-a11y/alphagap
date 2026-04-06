import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSubnetIdentities } from "@/lib/taostats";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const anthropic = new Anthropic();

export async function GET() { return scanWebsites(); }
export async function POST() { return scanWebsites(); }

// ── Website URL overrides ─────────────────────────────────────────
// Priority: official product website > docs > GitHub pages
// GitHub-only repos omitted — no product page to analyze
const WEBSITE_URL_OVERRIDES: Record<number, string> = {
  // ── SN 1–20 ───────────────────────────────────────────────────────────────
  1:  "https://apex.macrocosmos.ai",
  2:  "https://omron.ai",
  3:  "https://tplr.ai",
  4:  "https://targon.com",
  6:  "https://numinous.ai",
  7:  "https://www.subvortex.com",
  8:  "https://vantatrading.io",
  9:  "https://macrocosmos.ai/sn9",
  10: "https://sturdy.finance",
  11: "https://dippy.ai",
  12: "https://computehorde.io",
  13: "https://data-universe.ai",
  14: "https://taohash.com",
  15: "https://oroagents.com",
  16: "https://bitads.ai",
  17: "https://404gen.ai",
  18: "https://zeus.so",
  19: "https://sn19.ai",
  20: "https://rizzo.network/subnet-20",

  // ── SN 21–40 ──────────────────────────────────────────────────────────────
  21: "https://tensor.storage",
  22: "https://desearch.ai",
  24: "https://quasar.ai",
  25: "https://www.macrocosmos.ai/sn25",
  26: "https://storb.dev",
  27: "https://nodex0.xyz",
  29: "https://coldint.io",
  33: "https://readyai.org",
  34: "https://bitmind.ai",
  36: "https://autoppia.com",
  37: "https://macrocosmos.ai/sn37",
  39: "https://basilic.ai",
  41: "https://almanac.market",

  // ── SN 42–60 ──────────────────────────────────────────────────────────────
  42: "https://masa.ai",
  44: "https://score.vision",
  45: "https://rizzo.network/subnet-45",
  46: "https://resilabs.ai",
  47: "https://www.condenses.ai",
  48: "https://nextplace.ai",
  50: "https://synthdata.co",
  51: "https://lium.io",
  52: "https://dojo.tensorplex.ai",
  53: "https://celium.io",
  54: "https://www.yanez.ai",
  55: "https://niome.genomes.io",
  56: "https://gradients.io",
  57: "https://gaiaresearch.ai",
  58: "https://handshake58.xyz",
  59: "https://app.masa.finance/agent-arena",
  60: "https://bitsec.ai",

  // ── SN 61–80 ──────────────────────────────────────────────────────────────
  61: "https://theredteam.io",
  62: "https://ridges.ai",
  63: "https://www.qbittensorlabs.com",
  64: "https://chutes.ai",
  65: "https://tpn.network",
  68: "https://metanova-labs.ai",
  71: "https://leadpoet.ai",
  72: "https://natix.network",
  73: "https://metahash73.com",
  74: "https://gittensor.io",
  75: "https://hippius.network",
  76: "https://safe-scan.ai",
  78: "https://www.loosh.ai",
  81: "https://grail.ai",

  // ── SN 82–100 ─────────────────────────────────────────────────────────────
  82: "https://hermes-subnet.ai",
  83: "https://cliqueai.toptensor.ai",
  85: "https://vidaio.xyz",
  87: "https://checkerchain.com",
  88: "https://investing88.ai",
  90: "https://subnet90.com",
  91: "https://bitstarter.ai",
  92: "https://reinforced.app",
  93: "https://bitcast.network",
  94: "https://bitsota.ai",
  96: "https://www.flock.io",
  97: "https://distilledai.com",

  // ── SN 120+ ───────────────────────────────────────────────────────────────
  121: "https://sundaebar.ai",
  122: "https://bitrecs.xyz",
  124: "https://swarmsubnet.xyz",
};

export interface WebsiteProductResult {
  netuid: number;
  url: string;
  reachable: boolean;
  score: number;          // 0–80
  signals: string[];      // e.g. ["live_product", "revenue", "enterprise"]
  stage: "revenue" | "live" | "beta" | "waitlist" | "research" | "unknown";
  summary: string;        // 1-sentence AI description of what they built
  page_title?: string;
  scanned_at: string;
  ai_scored: boolean;     // true = Claude read it; false = fallback keyword score
}

export interface WebsiteProductCache {
  scanned_at: string;
  subnets: Record<number, WebsiteProductResult>;
}

// ── Extract page title ────────────────────────────────────────────
function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
  return m ? m[1].trim() : undefined;
}

// ── Strip HTML to readable text (for AI prompt) ───────────────────
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000); // keep first 4KB of meaningful text for AI
}

// ── AI scoring via Claude Haiku ───────────────────────────────────
async function aiScoreWebsite(
  netuid: number,
  url: string,
  text: string,
  title: string | undefined,
): Promise<{ score: number; signals: string[]; stage: WebsiteProductResult["stage"]; summary: string }> {
  const prompt = `You are evaluating a Bittensor AI subnet's product maturity from their website.

Website URL: ${url}
Page title: ${title || "unknown"}
Page text (first 4KB):
---
${text}
---

Rate this subnet's PRODUCT MATURITY on 0–80 scale (NOT 0–100, max is 80 for website tier):

Scoring guide:
- 70–80: Live revenue-generating product with paying customers, real pricing, clear product
- 55–69: Live product accessible to users (login/signup/API/app), may be pre-revenue
- 40–54: Public beta or early access with real functionality shipped
- 20–39: Waitlist/coming soon, credible roadmap, active development visible
- 5–19: Research project or very early stage, mostly concepts
- 0–4: Dead site, 404, pure marketing with no product signals, or unrelated content

Signals to detect (output ALL that apply):
- "revenue": pricing page, checkout, subscription tiers, paying customers mentioned
- "live_product": login, signup, dashboard, API docs with endpoints, working app
- "enterprise": B2B sales, contact sales, enterprise plan, team pricing
- "beta": beta/early access signup, waitlist with product details
- "api": API documentation, developer docs, SDK, endpoints shown
- "compute": GPU/CPU compute, cloud infrastructure, hardware
- "research": academic research, whitepaper focus, no product yet
- "funded": grants, VC funding, investment mentioned

Stage (pick ONE most accurate):
- "revenue": actively charging customers
- "live": product live and accessible, not yet revenue
- "beta": early access / beta launched
- "waitlist": not launched yet but accepting signups
- "research": academic / research focus, no product
- "unknown": can't determine

Respond in this EXACT format (no other text):
SCORE: [number 0-80]
STAGE: [one of: revenue|live|beta|waitlist|research|unknown]
SIGNALS: [comma-separated list]
SUMMARY: [1 sentence describing what they built and current product status]`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = msg.content[0];
    if (raw.type !== "text") throw new Error("no text");

    const scoreMatch = raw.text.match(/SCORE:\s*(\d+)/);
    const stageMatch = raw.text.match(/STAGE:\s*(revenue|live|beta|waitlist|research|unknown)/);
    const signalsMatch = raw.text.match(/SIGNALS:\s*(.+)/);
    const summaryMatch = raw.text.match(/SUMMARY:\s*(.+)/);

    const score = scoreMatch ? Math.min(80, Math.max(0, parseInt(scoreMatch[1]))) : 10;
    const stage = (stageMatch?.[1] as WebsiteProductResult["stage"]) || "unknown";
    const signals = signalsMatch?.[1]
      ? signalsMatch[1].split(",").map(s => s.trim()).filter(Boolean)
      : [];
    const summary = summaryMatch?.[1]?.trim() || "";

    console.log(`[scan-websites] SN${netuid} AI score: ${score} stage: ${stage} signals: ${signals.join(",")}`);
    return { score, signals, stage, summary };
  } catch (e) {
    console.error(`[scan-websites] AI scoring failed for SN${netuid}:`, e);
    return { score: 10, signals: [], stage: "unknown", summary: "" };
  }
}

// ── Keyword fallback (used if AI fails or site unreachable) ───────
function keywordScore(html: string, url: string): { score: number; signals: string[] } {
  const lower = html.toLowerCase().slice(0, 80_000);
  const signals: string[] = [];
  let score = 0;

  const pricingHits = ["per month", "/month", "/mo", "pricing", "subscribe", "upgrade to pro", "choose a plan"].filter(k => lower.includes(k));
  if (/\/pricing|\/plans|\/subscribe/.test(url) || pricingHits.length >= 2) { score += 30; signals.push("revenue"); }
  else if (pricingHits.length === 1) { score += 12; }

  const liveHits = ["log in", "login", "sign in", "sign up", "dashboard", "open app", "launch app", "start for free"].filter(k => lower.includes(k));
  if (/^https?:\/\/app\./.test(url) || liveHits.length >= 3) { score += 25; signals.push("live_product"); }
  else if (liveHits.length >= 1) score += 10;

  const enterpriseHits = ["enterprise", "contact sales", "book a demo", "custom pricing"].filter(k => lower.includes(k));
  if (enterpriseHits.length >= 2) { score += 15; signals.push("enterprise"); }

  const betaHits = ["join waitlist", "waitlist", "early access", "private beta"].filter(k => lower.includes(k));
  if (betaHits.length >= 1) { score += 10; signals.push("beta"); }

  return { score: Math.min(80, score), signals };
}

// ── Scan a single subnet URL ──────────────────────────────────────
async function scanUrl(netuid: number, url: string): Promise<WebsiteProductResult> {
  const now = new Date().toISOString();

  let html = "";
  let finalUrl = url;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AlphaGapBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      return { netuid, url, reachable: false, score: 0, signals: [], stage: "unknown", summary: "", scanned_at: now, ai_scored: false };
    }
    html = await res.text();
    finalUrl = res.url || url;
  } catch {
    return { netuid, url, reachable: false, score: 0, signals: [], stage: "unknown", summary: "", scanned_at: now, ai_scored: false };
  }

  const page_title = extractTitle(html);
  const text = htmlToText(html);

  // Use AI if content is substantial enough to analyze
  if (text.length > 200 && process.env.ANTHROPIC_API_KEY) {
    try {
      const { score, signals, stage, summary } = await aiScoreWebsite(netuid, finalUrl, text, page_title);
      return { netuid, url, reachable: true, score, signals, stage, summary, page_title, scanned_at: now, ai_scored: true };
    } catch {
      // fall through to keyword scoring
    }
  }

  // Keyword fallback
  const { score, signals } = keywordScore(html, finalUrl);
  const stage: WebsiteProductResult["stage"] =
    signals.includes("revenue") ? "revenue" :
    signals.includes("live_product") ? "live" :
    signals.includes("beta") ? "beta" : "unknown";

  return { netuid, url, reachable: true, score, signals, stage, summary: "", page_title, scanned_at: now, ai_scored: false };
}

// ── Main scan ────────────────────────────────────────────────────
async function scanWebsites() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: "No blob token" }, { status: 500 });

  // Load subnet identities
  let identities: Awaited<ReturnType<typeof getSubnetIdentities>> = [];
  try { identities = await getSubnetIdentities(); } catch { /* ok */ }

  // Build netuid → URL map
  const urlMap = new Map<number, string>();
  for (const id of identities) {
    const url = id.subnet_url?.trim() || WEBSITE_URL_OVERRIDES[id.netuid];
    if (url?.startsWith("http")) urlMap.set(id.netuid, url);
  }
  for (const [netuid, url] of Object.entries(WEBSITE_URL_OVERRIDES)) {
    if (!urlMap.has(Number(netuid))) urlMap.set(Number(netuid), url);
  }

  console.log(`[scan-websites] Scanning ${urlMap.size} subnet URLs with AI analysis...`);

  // Load existing cache
  let existing: WebsiteProductCache = { scanned_at: new Date().toISOString(), subnets: {} };
  try {
    const { get: getBlobWP } = await import("@vercel/blob");
    const wpBlob = await getBlobWP("website-product.json", { token, access: "private" });
    if (wpBlob?.stream) {
      const reader = wpBlob.stream.getReader();
      const chunks: Uint8Array[] = [];
      while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
      existing = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    }
  } catch { /* first run */ }

  // Scan in batches of 5 (smaller batches to respect AI rate limits)
  const entries = [...urlMap.entries()];
  const BATCH = 5;
  const results: WebsiteProductResult[] = [];

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(([netuid, url]) => scanUrl(netuid, url)));
    results.push(...batchResults);
    console.log(`[scan-websites] Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(entries.length / BATCH)} done (${results.filter(r => r.ai_scored).length} AI-scored so far)`);
    // Pause between batches to respect Anthropic rate limits
    if (i + BATCH < entries.length) await new Promise(r => setTimeout(r, 1500));
  }

  // Merge with existing cache
  const cache: WebsiteProductCache = {
    scanned_at: new Date().toISOString(),
    subnets: { ...existing.subnets },
  };
  for (const r of results) cache.subnets[r.netuid] = r;

  // Save
  await put("website-product.json", JSON.stringify(cache), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
    token: token!,
  });

  const reachable = results.filter(r => r.reachable).length;
  const aiScored = results.filter(r => r.ai_scored).length;
  const withSignals = results.filter(r => r.signals.length > 0).length;

  console.log(`[scan-websites] Done. ${reachable}/${results.length} reachable, ${aiScored} AI-scored, ${withSignals} with signals.`);

  return NextResponse.json({
    scanned: results.length,
    reachable,
    ai_scored: aiScored,
    with_signals: withSignals,
    top: results
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(r => ({ netuid: r.netuid, url: r.url, score: r.score, stage: r.stage, signals: r.signals, summary: r.summary, ai_scored: r.ai_scored })),
  });
}
