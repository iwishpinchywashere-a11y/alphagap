/**
 * GET /api/wallet-tracker
 *   → top 200 holders (by total TAO) + top 50 winners (by 24h gain)
 *   Cached in Vercel Blob for 20 minutes.
 *
 * GET /api/wallet-tracker?mode=detail&address=5G...
 *   → per-subnet alpha positions for a single wallet (real-time, ~500ms)
 *   Used when the user clicks a wallet row to expand it.
 *
 * Data source: TaoMarketCap public/v1/accounts/coldkeys
 */

import { NextRequest, NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";
import { getTaoPrice } from "@/lib/taostats";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

const TMC_API_KEY = process.env.TMC_API_KEY || "";
const RAO_PER_TAO = 1_000_000_000;

const CACHE_KEY    = "wallet-tracker-cache.json";
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 min

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
}

interface CacheData {
  holders:   WalletEntry[];
  winners:   WalletEntry[];
  losers:    WalletEntry[];
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
  id:                 string;
  hotkeys:            TMCHotkey[];
  total:              number;
  free:               number;
  tao_staked:         number;
  tao_change_24h:     number;
  percent_change_24h: number;
  rank:               number;
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

// ── TMC list fetch ────────────────────────────────────────────────
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

// ── TMC per-wallet detail ─────────────────────────────────────────
async function fetchWalletDetail(address: string): Promise<TMCWalletDetail | null> {
  try {
    const r = await fetch(
      `https://api.taomarketcap.com/public/v1/accounts/coldkeys/${address}/`,
      { headers: { Authorization: TMC_API_KEY }, signal: AbortSignal.timeout(8000), next: { revalidate: 0 } }
    );
    if (!r.ok) return null;
    return await r.json() as TMCWalletDetail;
  } catch { return null; }
}

// ── Subnet name map ───────────────────────────────────────────────
async function fetchSubnetNames(): Promise<Map<number, string>> {
  try {
    const r = await fetch(
      "https://api.taomarketcap.com/public/v1/subnets/table/",
      { headers: { Authorization: TMC_API_KEY }, signal: AbortSignal.timeout(10000), next: { revalidate: 0 } }
    );
    if (!r.ok) return new Map();
    const data = await r.json() as { subnet: number; name: string }[];
    const map = new Map<number, string>();
    for (const s of Array.isArray(data) ? data : []) map.set(s.subnet, s.name);
    return map;
  } catch { return new Map(); }
}

// ── Enrich coldkey list → WalletEntry ────────────────────────────
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
        rank:           r.rank ?? i + 1,
      };
    });
}

// ── Main handler ──────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const mode    = request.nextUrl.searchParams.get("mode");
  const address = request.nextUrl.searchParams.get("address");

  // ── Single wallet detail (on-demand, no cache) ────────────────
  if (mode === "detail" && address) {
    if (!TMC_API_KEY) return NextResponse.json({ error: "TMC_API_KEY not configured" }, { status: 500 });

    const [detail, subnetNames, taoPrice] = await Promise.all([
      fetchWalletDetail(address),
      fetchSubnetNames(),
      getTaoPrice().catch(() => 0),
    ]);

    if (!detail) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

    // Aggregate tao_staked per subnet (wallet may have multiple validators per subnet)
    const posMap = new Map<number, number>();
    for (const hk of detail.hotkeys ?? []) {
      if (hk.subnet == null) continue;
      posMap.set(hk.subnet, (posMap.get(hk.subnet) ?? 0) + (hk.tao_staked ?? 0));
    }

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

    return NextResponse.json({ address, positions, alpha_count: posMap.size });
  }

  // ── Default: top 200 holders + top 50 winners ─────────────────
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
    fetchTMC("total",          210), // fetch 210, serve 200 after filter
    fetchTMC("tao_change_24h",  60),
  ]);

  if (holdersResult.status === "fulfilled") holders = holdersResult.value;
  else errors.push(`holders: ${holdersResult.reason}`);

  if (winnersResult.status === "fulfilled") winners = winnersResult.value;
  else errors.push(`winners: ${winnersResult.reason}`);

  if (holders.length === 0 && winners.length === 0) {
    return NextResponse.json({ error: "No data returned from TaoMarketCap", debug: errors }, { status: 500 });
  }

  const result: CacheData = {
    holders: enrich(holders).slice(0, 200),
    winners: enrich(winners.filter(w => w.tao_change_24h > 0)).slice(0, 50),
    losers:  enrich([...winners].reverse().filter(w => w.tao_change_24h < 0)).slice(0, 50),
    updatedAt: new Date().toISOString(),
  };

  await writeBlob(CACHE_KEY, result);
  return NextResponse.json(result);
}
