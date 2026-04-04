import { NextResponse } from "next/server";
import { put, get } from "@vercel/blob";
import { getSubnetIdentities } from "@/lib/taostats";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET handler for Vercel cron job (runs daily)
export async function GET() {
  return scanWebsites();
}

// POST handler for manual trigger
export async function POST() {
  return scanWebsites();
}

// ── Website URL overrides ─────────────────────────────────────────
// For subnets where TaoStats registry has no URL or the wrong one.
// Last verified: 2026-04-03. Priority: official website > docs site > GitHub pages.
// GitHub-only subnets are omitted (no product signals detectable from code repos).
const WEBSITE_URL_OVERRIDES: Record<number, string> = {
  // ── SN 1–20 ───────────────────────────────────────────────────────────────
  1:  "https://apex.macrocosmos.ai",        // Apex by Macrocosmos
  2:  "https://omron.ai",                   // Omron
  3:  "https://tplr.ai",                    // templar
  4:  "https://targon.com",                 // Targon — benchmarked, $10.4M ARR
  6:  "https://numinous.ai",                // Numinous
  7:  "https://www.subvortex.com",          // SubVortex
  8:  "https://vantatrading.io",            // Vanta — prop firm launched Feb 2026
  9:  "https://macrocosmos.ai/sn9",         // IOTA by Macrocosmos
  10: "https://sturdy.finance",             // Sturdy Finance
  11: "https://trajectoryrl.xyz",           // Trajectory RL
  12: "https://computehorde.io",            // ComputeHorde
  13: "https://data-universe.ai",           // Data Universe
  14: "https://taohash.com",               // TaoHash
  15: "https://oroagents.com",             // Oro Agents
  16: "https://bitads.ai",                 // BitAds
  17: "https://404gen.ai",                 // 404gen
  18: "https://zeus.so",                   // Zeus
  19: "https://sn19.ai",                   // Nineteen
  20: "https://rizzo.network/subnet-20",   // Bounty Hunter / Rizzo

  // ── SN 21–40 ──────────────────────────────────────────────────────────────
  21: "https://tensor.storage",            // FileTAO
  22: "https://desearch.ai",              // DeSearch — benchmarked, $132K ARR
  24: "https://quasar.ai",                // Quasar
  25: "https://www.macrocosmos.ai/sn25",  // Mainframe (protein folding) by Macrocosmos
  26: "https://storb.dev",                // Storb (object storage)
  27: "https://nodex0.xyz",              // NodeX
  29: "https://coldint.io",              // ColdInt
  33: "https://readyai.org",             // ReadyAI — Ipsos production, begun monetization
  34: "https://bitmind.ai",              // BitMind — 150K+ weekly detections, SOC2
  36: "https://autoppia.com",            // Autoppia
  37: "https://macrocosmos.ai/sn37",     // Finetuning by Macrocosmos
  39: "https://basilic.ai",              // Basilica
  41: "https://almanac.market",          // Almanac

  // ── SN 42–60 ──────────────────────────────────────────────────────────────
  42: "https://masa.ai",                 // Masa Real-Time Data
  44: "https://score.vision",            // Score/Manako — five-figure MRR, 4 enterprise deals
  45: "https://rizzo.network/subnet-45", // Rizzo SWE
  46: "https://resilabs.ai",             // Resilabs
  47: "https://www.condenses.ai",        // Condense AI
  48: "https://nextplace.ai",            // NextPlace
  50: "https://synthdata.co",            // Synth — API live Jan 2026, $6M Optimism grant
  51: "https://lium.io",                 // lium.io — benchmarked, $2.5M ARR
  52: "https://dojo.tensorplex.ai",      // Tensorplex Dojo
  54: "https://www.yanez.ai",            // Yanez AI
  55: "https://niome.genomes.io",        // NIOME by GenomesDAO
  56: "https://gradients.io",            // Gradients — benchmarked, $240K ARR
  58: "https://handshake58.xyz",         // Handshake
  59: "https://app.masa.finance/agent-arena", // Agent Arena by Masa
  60: "https://bitsec.ai",               // BitSec

  // ── SN 61–80 ──────────────────────────────────────────────────────────────
  61: "https://theredteam.io",           // RedTeam by Innerworks
  62: "https://ridges.ai",               // Ridges — benchmarked, VS Code ext, $12/mo
  63: "https://www.qbittensorlabs.com",  // Quantum Compute
  64: "https://chutes.ai",               // Chutes — benchmarked, $1.8M ARR, 400K users
  65: "https://tpn.network",             // TPN Labs
  68: "https://metanova-labs.ai",        // MetaNova — 4.8M molecules screened
  71: "https://leadpoet.ai",             // Leadpoet — $1M ARR, 26 paying B2B customers
  72: "https://natix.network",           // StreetVision by NATIX
  73: "https://metahash73.com",          // MetaHash
  74: "https://gittensor.io",            // GitTensor
  75: "https://hippius.network",         // Hippius — benchmarked, $4.48M ARR
  76: "https://safe-scan.ai",            // SafeScan
  78: "https://www.loosh.ai",            // Loosh
  81: "https://grail.ai",               // Grail

  // ── SN 82–100 ─────────────────────────────────────────────────────────────
  82: "https://hermes-subnet.ai",        // Hermes by SubQuery
  83: "https://cliqueai.toptensor.ai",   // CliqueAI by TopTensor
  85: "https://vidaio.xyz",              // Vidaio
  87: "https://checkerchain.com",        // CheckerChain
  88: "https://investing88.ai",          // Investing88
  90: "https://subnet90.com",            // DegenBrain
  91: "https://bitstarter.ai",           // BitStarter
  92: "https://reinforced.app",          // ReinforcedAI
  93: "https://bitcast.network",         // Bitcast
  94: "https://bitsota.ai",              // BitSota by Alveus Labs
  96: "https://www.flock.io",            // FLock OFF by FLock.io
  97: "https://distilledai.com",         // Distilled AI

  // ── SN 120+ ───────────────────────────────────────────────────────────────
  121: "https://sundaebar.ai",
  122: "https://bitrecs.xyz",
  124: "https://swarmsubnet.xyz",
};

export interface WebsiteProductResult {
  netuid: number;
  url: string;
  reachable: boolean;
  score: number;             // 0–80
  signals: string[];         // e.g. ["pricing_page", "live_product", "enterprise"]
  page_title?: string;
  scanned_at: string;
}

export interface WebsiteProductCache {
  scanned_at: string;
  subnets: Record<number, WebsiteProductResult>;
}

// ── Signal detection ─────────────────────────────────────────────
const PRICING_KEYWORDS = [
  "per month", "per year", "/month", "/year", "/mo", "/yr",
  "monthly plan", "annual plan", "free plan", "pro plan", "starter plan",
  "business plan", "enterprise plan", "pricing", "subscribe now",
  "upgrade to pro", "choose a plan", "view pricing",
];
const LIVE_PRODUCT_KEYWORDS = [
  "log in", "login", "sign in", "sign up", "create account", "get started",
  "start for free", "try for free", "open app", "launch app", "go to app",
  "dashboard", "my account", "your account", "start building",
];
const ENTERPRISE_KEYWORDS = [
  "enterprise", "contact sales", "talk to sales", "schedule a demo",
  "book a demo", "book a call", "request a demo", "custom pricing",
  "for teams", "for businesses", "for enterprises", "api access",
  "white-label", "custom integration",
];
const BETA_KEYWORDS = [
  "join waitlist", "join the waitlist", "waitlist", "early access",
  "request access", "coming soon", "beta access", "beta program",
  "private beta", "public beta", "apply for beta",
];
const REVENUE_KEYWORDS = [
  "$", "usd", "eur", "gbp", "payment", "checkout", "billing",
  "subscription", "invoice", "pay now", "purchase", "buy now",
];

function scoreWebsiteHTML(html: string, url: string): { score: number; signals: string[] } {
  const lower = html.toLowerCase().slice(0, 80_000); // first 80KB
  const signals: string[] = [];
  let score = 0;

  // ── Pricing page (0–30 pts) ───────────────────────────────────
  const pricingMatches = PRICING_KEYWORDS.filter(k => lower.includes(k));
  const pricingUrlHit = /\/pricing|\/plans|\/subscribe|\/billing/.test(url);
  if (pricingUrlHit || pricingMatches.length >= 2) {
    score += 30;
    signals.push("pricing_page");
  } else if (pricingMatches.length === 1) {
    score += 12;
    signals.push("pricing_hint");
  }

  // ── Revenue signals (0–10 pts bonus on top of pricing) ────────
  const revenueMatches = REVENUE_KEYWORDS.filter(k => lower.includes(k));
  if (revenueMatches.length >= 3 && signals.includes("pricing_page")) {
    score += 10;
    signals.push("payment_integration");
  }

  // ── Live product / app (0–25 pts) ────────────────────────────
  const liveMatches = LIVE_PRODUCT_KEYWORDS.filter(k => lower.includes(k));
  const appSubdomain = /^https?:\/\/app\./.test(url) || /^https?:\/\/dashboard\./.test(url);
  if (appSubdomain || liveMatches.length >= 3) {
    score += 25;
    signals.push("live_product");
  } else if (liveMatches.length >= 1) {
    score += 10;
    signals.push("product_hint");
  }

  // ── Enterprise (0–15 pts) ────────────────────────────────────
  const enterpriseMatches = ENTERPRISE_KEYWORDS.filter(k => lower.includes(k));
  if (enterpriseMatches.length >= 2) {
    score += 15;
    signals.push("enterprise");
  } else if (enterpriseMatches.length === 1) {
    score += 6;
    signals.push("enterprise_hint");
  }

  // ── Beta / waitlist (0–10 pts) ───────────────────────────────
  const betaMatches = BETA_KEYWORDS.filter(k => lower.includes(k));
  if (betaMatches.length >= 1) {
    score += 10;
    signals.push("beta_waitlist");
  }

  return { score: Math.min(80, score), signals };
}

// ── Extract page title ────────────────────────────────────────────
function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
  return m ? m[1].trim() : undefined;
}

// ── Scan a single URL ────────────────────────────────────────────
async function scanUrl(
  netuid: number,
  url: string,
): Promise<WebsiteProductResult> {
  const now = new Date().toISOString();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AlphaGapBot/1.0; +https://alphagap.xyz)",
        Accept: "text/html",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      return { netuid, url, reachable: false, score: 0, signals: [], scanned_at: now };
    }
    const html = await res.text();
    const { score, signals } = scoreWebsiteHTML(html, res.url || url);
    const page_title = extractTitle(html);
    return { netuid, url, reachable: true, score, signals, page_title, scanned_at: now };
  } catch {
    return { netuid, url, reachable: false, score: 0, signals: [], scanned_at: now };
  }
}

// ── Main scan ────────────────────────────────────────────────────
async function scanWebsites() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "No blob token" }, { status: 500 });
  }

  // Load subnet identities from TaoStats
  let identities: Awaited<ReturnType<typeof getSubnetIdentities>> = [];
  try {
    identities = await getSubnetIdentities();
  } catch (e) {
    console.error("[scan-websites] Failed to fetch identities:", e);
  }

  // Build netuid → URL map (identity URL wins; fall back to override)
  const urlMap = new Map<number, string>();
  for (const id of identities) {
    const url = id.subnet_url?.trim() || WEBSITE_URL_OVERRIDES[id.netuid];
    if (url && url.startsWith("http")) {
      urlMap.set(id.netuid, url);
    }
  }
  // Add any overrides not in identities
  for (const [netuid, url] of Object.entries(WEBSITE_URL_OVERRIDES)) {
    if (!urlMap.has(Number(netuid))) {
      urlMap.set(Number(netuid), url);
    }
  }

  console.log(`[scan-websites] Scanning ${urlMap.size} subnet URLs...`);

  // Load existing cache so we can merge (keep old entries for subnets not re-scanned)
  let existing: WebsiteProductCache = { scanned_at: new Date().toISOString(), subnets: {} };
  try {
    const blob = await get("website-product.json", {
      token: process.env.BLOB_READ_WRITE_TOKEN!,
      access: "private",
    });
    if (blob?.stream) {
      const reader = blob.stream.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      existing = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    }
  } catch { /* first run — no cache yet */ }

  // Scan in parallel batches of 10
  const entries = [...urlMap.entries()];
  const BATCH = 10;
  const results: WebsiteProductResult[] = [];

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map(([netuid, url]) => scanUrl(netuid, url))
    );
    results.push(...batchResults);
    console.log(`[scan-websites] Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(entries.length / BATCH)} done`);
    // Small pause between batches to be polite
    if (i + BATCH < entries.length) await new Promise(r => setTimeout(r, 500));
  }

  // Merge results
  const cache: WebsiteProductCache = {
    scanned_at: new Date().toISOString(),
    subnets: { ...existing.subnets },
  };
  for (const r of results) {
    cache.subnets[r.netuid] = r;
  }

  // Save to blob
  await put("website-product.json", JSON.stringify(cache), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
    token: process.env.BLOB_READ_WRITE_TOKEN!,
  });

  const reachable = results.filter(r => r.reachable).length;
  const withSignals = results.filter(r => r.signals.length > 0).length;
  console.log(`[scan-websites] Done. ${reachable}/${results.length} reachable, ${withSignals} with product signals.`);

  return NextResponse.json({
    scanned: results.length,
    reachable,
    with_signals: withSignals,
    top: results
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(r => ({ netuid: r.netuid, url: r.url, score: r.score, signals: r.signals })),
  });
}
