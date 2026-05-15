/**
 * GET /api/wallet-tracker
 *
 * Default mode:
 *   - top 50 wallets by total TAO balance  (Top Holders)
 *   - top 50 wallets by 24h TAO gain       (Today's Big Winners)
 *   Cached in Vercel Blob for 20 minutes.
 *
 * ?mode=diversified:
 *   - top 200 wallets (by total TAO) that hold ≥ 2 distinct alpha tokens
 *   - each wallet includes a per-subnet positions breakdown
 *   Cached in Vercel Blob for 45 minutes.
 *   First request takes ~10-20s; subsequent requests serve from cache instantly.
 *
 * Data source: TaoMarketCap public/v1/accounts/coldkeys
 */

import { NextRequest, NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";
import { getTaoPrice } from "@/lib/taostats";

export const dynamic    = "force-dynamic";
export const maxDuration = 60; // seconds — needed for diversified batch fetches

const TMC_API_KEY  = process.env.TMC_API_KEY || "";
const RAO_PER_TAO  = 1_000_000_000;

const CACHE_KEY         = "wallet-tracker-cache.json";
const CACHE_TTL_MS      = 20 * 60 * 1000; // 20 min

const DIV_CACHE_KEY     = "wallet-tracker-diversified.json";
const DIV_CACHE_TTL_MS  = 45 * 60 * 1000; // 45 min

// ── Known labeled wallets ─────────────────────────────────────────
export const KNOWN_WALLETS: Record<string, { label: string; emoji: string; category: string }> = {
  "5G62K98tpNqsaffgyJmTvDSTCEFzva8WkmMqB2CEFSDgawrS": { label: "Const",    emoji: "👑", category: "founder" },
  "5GH2aUTMRUh1RprCgH4x3tRyCaKeUi5BfmYCfs1NARA8R54n": { label: "Const #2", emoji: "👑", category: "founder" },
};

// ── Types ─────────────────────────────────────────────────────────
export interface AlphaPosition {
  netuid: number;
  name: string;
  staked_tao: number;  // TAO equivalent
  staked_usd: number;  // USD value
}

export interface WalletEntry {
  address: string;
  label?: string;
  emoji?: string;
  category?: string;
  is_known: boolean;
  // balances in TAO
  total_tao: number;
  free_tao: number;
  staked_tao: number;
  // 24h change in TAO
  change_24h_tao: number;
  change_24h_pct: number;
  // rank in their respective list
  rank: number;
  // diversified mode only
  alpha_count?: number;
  positions?: AlphaPosition[];
}

interface CacheData {
  holders:  WalletEntry[];
  winners:  WalletEntry[];
  losers:   WalletEntry[];
  updatedAt: string;
}

interface DiversifiedCache {
  wallets:   WalletEntry[];
  updatedAt: string;
}

interface TMCColdkey {
  id: string;
  total: number;
  free: number;
  staked: number;
  tao_staked: number;
  tao_change_24h: number;
  percent_change_24h: number;
  rank?: number;
}

interface TMCHotkey {
  hotkey: string;
  subnet: number;
  staked: number;      // alpha (rao)
  tao_staked: number;  // TAO equivalent (rao)
}

interface TMCWalletDetail {
  id: string;
  hotkeys: TMCHotkey[];
  total: number;
  free: number;
  staked: number;
  tao_staked: number;
  rank: number;
  tao_change_24h: number;
  percent_change_24h: number;
}

// ── Blob helpers ──────────────────────────────────────────────────
async function readBlob<T>(key: string): Promise<T | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  try {
    const blob = await blobGet(key, { token, access: "private" });
    if (!blob?.stream) return null;
    const reader = blob.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch { return null; }
}

async function writeBlob(key: string, data: unknown): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  try {
    await put(key, JSON.stringify(data), {
      access: "private", token,
      addRandomSuffix: false, allowOverwrite: true,
      contentType: "application/json",
    });
  } catch { /* non-critical */ }
}

// ── TMC helpers ───────────────────────────────────────────────────
async function fetchTMC(orderBy: string, limit = 60): Promise<TMCColdkey[]> {
  const url = `https://api.taomarketcap.com/public/v1/accounts/coldkeys/?limit=${limit}&order_by=${orderBy}&order=desc`;
  const r = await fetch(url, {
    headers: { Authorization: TMC_API_KEY },
    signal: AbortSignal.timeout(15000),
    next: { revalidate: 0 },
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`TMC ${orderBy} → HTTP ${r.status}: ${body.slice(0, 120)}`);
  }
  const j = await r.json();
  return (j?.results ?? j?.data ?? j ?? []) as TMCColdkey[];
}

async function fetchWalletDetail(address: string): Promise<TMCWalletDetail | null> {
  try {
    const url = `https://api.taomarketcap.com/public/v1/accounts/coldkeys/${address}/`;
    const r = await fetch(url, {
      headers: { Authorization: TMC_API_KEY },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 0 },
    });
    if (!r.ok) return null;
    return await r.json() as TMCWalletDetail;
  } catch { return null; }
}

async function fetchSubnetNames(): Promise<Map<number, string>> {
  try {
    const url = "https://api.taomarketcap.com/public/v1/subnets/table/";
    const r = await fetch(url, {
      headers: { Authorization: TMC_API_KEY },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 0 },
    });
    if (!r.ok) return new Map();
    const data = await r.json() as { subnet: number; name: string }[];
    const map = new Map<number, string>();
    for (const s of Array.isArray(data) ? data : []) map.set(s.subnet, s.name);
    return map;
  } catch { return new Map(); }
}

// ── Enrich basic wallet list ───────────────────────────────────────
function enrich(rows: TMCColdkey[]): WalletEntry[] {
  return rows
    .filter(r => r.id && r.total > 0)
    .map((r, i) => {
      const known = KNOWN_WALLETS[r.id];
      return {
        address:        r.id,
        label:          known?.label,
        emoji:          known?.emoji,
        category:       known?.category,
        is_known:       !!known,
        total_tao:      Math.round(r.total          / RAO_PER_TAO * 100) / 100,
        free_tao:       Math.round(r.free           / RAO_PER_TAO * 100) / 100,
        staked_tao:     Math.round((r.tao_staked ?? 0) / RAO_PER_TAO * 100) / 100,
        change_24h_tao: Math.round(r.tao_change_24h / RAO_PER_TAO * 100) / 100,
        change_24h_pct: Math.round(r.percent_change_24h * 100) / 100,
        rank:           (r.rank ?? i + 1),
      };
    });
}

// ── Diversified wallet computation ────────────────────────────────
async function buildDiversified(): Promise<WalletEntry[]> {
  // Fetch top 350 wallets by total TAO, subnet names, and TAO price in parallel
  const [topWallets, subnetNames, taoPrice] = await Promise.all([
    fetchTMC("total", 350),
    fetchSubnetNames(),
    getTaoPrice().catch(() => 0),
  ]);

  // Batch-fetch per-wallet detail (25 concurrent at a time)
  const BATCH = 25;
  const details: (TMCWalletDetail | null)[] = [];
  for (let i = 0; i < topWallets.length; i += BATCH) {
    const batch = topWallets.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(w => fetchWalletDetail(w.id)));
    for (const r of results) {
      details.push(r.status === "fulfilled" ? r.value : null);
    }
  }

  const enriched: WalletEntry[] = [];
  for (let i = 0; i < topWallets.length; i++) {
    const w       = topWallets[i];
    const detail  = details[i];
    if (!detail?.hotkeys?.length) continue;

    // Aggregate tao_staked per subnet (wallet may have multiple validators per subnet)
    const posMap = new Map<number, number>(); // netuid → total tao_staked (rao)
    for (const hk of detail.hotkeys) {
      if (!hk.subnet && hk.subnet !== 0) continue;
      posMap.set(hk.subnet, (posMap.get(hk.subnet) ?? 0) + (hk.tao_staked ?? 0));
    }

    // Must hold ≥ 2 distinct alpha tokens
    if (posMap.size < 2) continue;

    // Build sorted position list
    const positions: AlphaPosition[] = [...posMap.entries()]
      .map(([netuid, taoRao]) => {
        const staked_tao = Math.round(taoRao / RAO_PER_TAO * 100) / 100;
        return {
          netuid,
          name:       subnetNames.get(netuid) ?? `SN${netuid}`,
          staked_tao,
          staked_usd: Math.round(staked_tao * taoPrice * 100) / 100,
        };
      })
      .sort((a, b) => b.staked_tao - a.staked_tao);

    const known = KNOWN_WALLETS[w.id];
    enriched.push({
      address:        w.id,
      label:          known?.label,
      emoji:          known?.emoji,
      category:       known?.category,
      is_known:       !!known,
      total_tao:      Math.round(w.total          / RAO_PER_TAO * 100) / 100,
      free_tao:       Math.round(w.free           / RAO_PER_TAO * 100) / 100,
      staked_tao:     Math.round((w.tao_staked ?? 0) / RAO_PER_TAO * 100) / 100,
      change_24h_tao: Math.round(w.tao_change_24h / RAO_PER_TAO * 100) / 100,
      change_24h_pct: Math.round(w.percent_change_24h * 100) / 100,
      rank:           w.rank ?? i + 1,
      alpha_count:    posMap.size,
      positions,
    });
  }

  // Sort by total TAO, take top 200
  return enriched.sort((a, b) => b.total_tao - a.total_tao).slice(0, 200);
}

// ── Main handler ──────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode");

  // ── Diversified mode ──────────────────────────────────────────
  if (mode === "diversified") {
    const cached = await readBlob<DiversifiedCache>(DIV_CACHE_KEY);
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < DIV_CACHE_TTL_MS) {
      return NextResponse.json(cached);
    }
    if (!TMC_API_KEY) {
      return NextResponse.json({ error: "TMC_API_KEY not configured" }, { status: 500 });
    }
    try {
      const wallets = await buildDiversified();
      const result: DiversifiedCache = { wallets, updatedAt: new Date().toISOString() };
      await writeBlob(DIV_CACHE_KEY, result);
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── Default mode (holders / winners) ─────────────────────────
  const cached = await readBlob<CacheData>(CACHE_KEY);
  if (cached && Date.now() - new Date(cached.updatedAt).getTime() < CACHE_TTL_MS) {
    return NextResponse.json(cached);
  }

  if (!TMC_API_KEY) {
    return NextResponse.json({ error: "TMC_API_KEY not configured" }, { status: 500 });
  }

  let holders: TMCColdkey[] = [];
  let winners: TMCColdkey[] = [];
  const errors: string[] = [];

  const [holdersResult, winnersResult] = await Promise.allSettled([
    fetchTMC("total",          60),
    fetchTMC("tao_change_24h", 60),
  ]);

  if (holdersResult.status === "fulfilled") holders = holdersResult.value;
  else errors.push(`holders: ${holdersResult.reason}`);

  if (winnersResult.status === "fulfilled") winners = winnersResult.value;
  else errors.push(`winners: ${winnersResult.reason}`);

  if (holders.length === 0 && winners.length === 0) {
    return NextResponse.json({ error: "No data returned from TaoMarketCap", debug: errors }, { status: 500 });
  }

  const result: CacheData = {
    holders: enrich(holders).slice(0, 50),
    winners: enrich(winners.filter(w => w.tao_change_24h > 0)).slice(0, 50),
    losers:  enrich([...winners].reverse().filter(w => w.tao_change_24h < 0)).slice(0, 50),
    updatedAt: new Date().toISOString(),
  };

  await writeBlob(CACHE_KEY, result);
  return NextResponse.json(result);
}
