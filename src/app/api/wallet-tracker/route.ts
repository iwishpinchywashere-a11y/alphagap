/**
 * GET /api/wallet-tracker
 *
 * Returns the top 200 wallets (by total TAO) that hold ≥ 2 distinct alpha
 * tokens (subnet 0 / root network excluded — not an alpha token).
 * Per-wallet positions are included so the UI can expand without extra fetches.
 *
 * First cold request: ~10-15s (batch-fetches detail for 350 wallets).
 * Cached in Vercel Blob for 45 min — subsequent requests are instant.
 *
 * GET ?mode=winners  → top 50 by 24h TAO gain (20-min cache, fast)
 *
 * Data source: TaoMarketCap public/v1/accounts/coldkeys
 */

import { NextRequest, NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";
import { getTaoPrice } from "@/lib/taostats";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const TMC_API_KEY  = process.env.TMC_API_KEY || "";
const RAO_PER_TAO  = 1_000_000_000;
const ROOT_NETUID  = 0; // subnet 0 = root/legacy — NOT an alpha token

const MAIN_CACHE_KEY    = "wallet-tracker-v3.json";
const MAIN_CACHE_TTL_MS = 45 * 60 * 1000; // 45 min (expensive to compute)

const WIN_CACHE_KEY     = "wallet-tracker-winners.json";
const WIN_CACHE_TTL_MS  = 20 * 60 * 1000; // 20 min

// ── Known labeled wallets ─────────────────────────────────────────
export const KNOWN_WALLETS: Record<string, { label: string; emoji: string; category: string }> = {
  "5G62K98tpNqsaffgyJmTvDSTCEFzva8WkmMqB2CEFSDgawrS": { label: "Const",    emoji: "👑", category: "founder" },
  "5GH2aUTMRUh1RprCgH4x3tRyCaKeUi5BfmYCfs1NARA8R54n": { label: "Const #2", emoji: "👑", category: "founder" },
};

// ── Types ─────────────────────────────────────────────────────────
export interface AlphaPosition {
  netuid:     number;
  name:       string;
  staked_tao: number;
  staked_usd: number;
}

export interface WalletEntry {
  address:        string;
  label?:         string;
  emoji?:         string;
  category?:      string;
  is_known:       boolean;
  total_tao:      number;
  free_tao:       number;
  staked_tao:     number;
  change_24h_tao: number;
  change_24h_pct: number;
  rank:           number;
  alpha_count:    number;
  positions:      AlphaPosition[];
}

interface WinnerEntry {
  address:        string;
  label?:         string;
  emoji?:         string;
  category?:      string;
  is_known:       boolean;
  total_tao:      number;
  free_tao:       number;
  staked_tao:     number;
  change_24h_tao: number;
  change_24h_pct: number;
  rank:           number;
}

interface MainCache {
  wallets:   WalletEntry[];
  updatedAt: string;
}
interface WinnersCache {
  winners:   WinnerEntry[];
  updatedAt: string;
}

interface TMCColdkey {
  id:                 string;
  total:              number;
  free:               number;
  staked:             number;
  tao_staked:         number;
  tao_change_24h:     number;
  percent_change_24h: number;
  rank?:              number;
}
interface TMCHotkey {
  hotkey:     string;
  subnet:     number;
  staked:     number;
  tao_staked: number;
}
interface TMCWalletDetail {
  id:      string;
  hotkeys: TMCHotkey[];
  total:   number;
  free:    number;
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

// ── TMC fetch helpers ─────────────────────────────────────────────
async function fetchTMCList(orderBy: string, limit: number): Promise<TMCColdkey[]> {
  const url = `https://api.taomarketcap.com/public/v1/accounts/coldkeys/?limit=${limit}&order_by=${orderBy}&order=desc`;
  const r = await fetch(url, {
    headers: { Authorization: TMC_API_KEY },
    signal: AbortSignal.timeout(15000),
    next: { revalidate: 0 },
  });
  if (!r.ok) throw new Error(`TMC list ${orderBy} → HTTP ${r.status}`);
  const j = await r.json();
  return (j?.results ?? j?.data ?? j ?? []) as TMCColdkey[];
}

async function fetchDetail(address: string): Promise<TMCWalletDetail | null> {
  try {
    const r = await fetch(
      `https://api.taomarketcap.com/public/v1/accounts/coldkeys/${address}/`,
      { headers: { Authorization: TMC_API_KEY }, signal: AbortSignal.timeout(8000), next: { revalidate: 0 } }
    );
    if (!r.ok) return null;
    return await r.json() as TMCWalletDetail;
  } catch { return null; }
}

async function fetchSubnetNames(): Promise<Map<number, string>> {
  try {
    const r = await fetch(
      "https://api.taomarketcap.com/public/v1/subnets/table/",
      { headers: { Authorization: TMC_API_KEY }, signal: AbortSignal.timeout(10000), next: { revalidate: 0 } }
    );
    if (!r.ok) return new Map();
    const data = await r.json() as { subnet: number; name: string }[];
    const map = new Map<number, string>();
    for (const s of Array.isArray(data) ? data : []) {
      if (s.subnet !== ROOT_NETUID) map.set(s.subnet, s.name);
    }
    return map;
  } catch { return new Map(); }
}

// ── Build the main filtered wallet list ───────────────────────────
async function buildMainList(): Promise<WalletEntry[]> {
  // Fetch top 350 candidates, subnet names, and TAO price in parallel
  const [topWallets, subnetNames, taoPrice] = await Promise.all([
    fetchTMCList("total", 350),
    fetchSubnetNames(),
    getTaoPrice().catch(() => 0),
  ]);

  console.log(`[wallet-tracker] Got ${topWallets.length} wallets, ${subnetNames.size} subnets, TAO=$${taoPrice}`);

  // Batch-fetch per-wallet detail (20 concurrent at a time)
  const BATCH = 20;
  const details: (TMCWalletDetail | null)[] = [];
  for (let i = 0; i < topWallets.length; i += BATCH) {
    const batch   = topWallets.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(w => fetchDetail(w.id)));
    for (const r of results) details.push(r.status === "fulfilled" ? r.value : null);
  }

  console.log(`[wallet-tracker] Fetched ${details.filter(Boolean).length}/${topWallets.length} details`);

  const enriched: WalletEntry[] = [];

  for (let i = 0; i < topWallets.length; i++) {
    const w      = topWallets[i];
    const detail = details[i];
    if (!detail?.hotkeys?.length) continue;

    // Aggregate tao_staked per subnet, EXCLUDING root network (SN0)
    const posMap = new Map<number, number>(); // netuid → total tao_staked rao
    for (const hk of detail.hotkeys) {
      if (hk.subnet == null || hk.subnet === ROOT_NETUID) continue;
      posMap.set(hk.subnet, (posMap.get(hk.subnet) ?? 0) + (hk.tao_staked ?? 0));
    }

    // Must hold ≥ 2 distinct alpha tokens (not counting root)
    if (posMap.size < 2) continue;

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

  // Sort by total TAO, take top 200 qualified wallets
  return enriched.sort((a, b) => b.total_tao - a.total_tao).slice(0, 200);
}

// ── Main handler ──────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode");

  if (!TMC_API_KEY) {
    return NextResponse.json({ error: "TMC_API_KEY not configured" }, { status: 500 });
  }

  // ── Winners mode (fast, 20-min cache) ────────────────────────
  if (mode === "winners") {
    const cached = await readBlob<WinnersCache>(WIN_CACHE_KEY);
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < WIN_CACHE_TTL_MS) {
      return NextResponse.json(cached);
    }
    try {
      const raw = await fetchTMCList("tao_change_24h", 60);
      const winners: WinnerEntry[] = raw
        .filter(w => w.tao_change_24h > 0 && w.total > 0)
        .map((w, i) => {
          const known = KNOWN_WALLETS[w.id];
          return {
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
          };
        })
        .slice(0, 50);
      const result: WinnersCache = { winners, updatedAt: new Date().toISOString() };
      await writeBlob(WIN_CACHE_KEY, result);
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── Default: filtered multi-asset list (45-min cache) ────────
  const cached = await readBlob<MainCache>(MAIN_CACHE_KEY);
  if (cached && Date.now() - new Date(cached.updatedAt).getTime() < MAIN_CACHE_TTL_MS) {
    return NextResponse.json(cached);
  }

  try {
    const wallets = await buildMainList();
    const result: MainCache = { wallets, updatedAt: new Date().toISOString() };
    await writeBlob(MAIN_CACHE_KEY, result);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
