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

const MAIN_CACHE_KEY    = "wallet-tracker-v4.json";
const MAIN_CACHE_TTL_MS = 45 * 60 * 1000; // 45 min (expensive to compute)

const WIN_CACHE_KEY     = "wallet-tracker-winners.json";

const SR_CACHE_KEY      = "wallet-tracker-sr-whales.json";
const SR_CACHE_TTL_MS   = 5 * 60 * 1000; // 5 min (live SR data)
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

// ── SubnetRadar Whale types ───────────────────────────────────────
export interface SRWhaleWallet {
  address:       string;
  label?:        string;
  emoji?:        string;
  category?:     string;
  is_known:      boolean;
  move_count:    number;   // number of stake/unstake moves in the SR window
  total_staked:  number;   // total TAO staked across all moves
  total_unstaked: number;  // total TAO unstaked
  net_tao:       number;   // staked - unstaked (positive = net buyer)
  last_action:   "stake" | "unstake";
  last_netuid?:  number;
  last_amount:   number;   // TAO
  last_ts:       string;   // ISO
  active_subnets: number[]; // unique netuids touched
}
interface SRWhaleMoveRaw {
  id?:        string;
  type:       string;
  timestamp:  string;
  amount:     number;
  from:       string;
  to?:        string;
  netuid?:    number;
}
interface SRCache {
  whales:    SRWhaleWallet[];
  updatedAt: string;
}

// ── TaoStats Whale types ──────────────────────────────────────────
export interface TSWhaleWallet {
  address:        string;
  label?:         string;
  emoji?:         string;
  category?:      string;
  is_known:       boolean;
  subnet_count:   number;   // unique alpha subnets staked in
  total_usd:      number;   // sum of all DELEGATE USD in window
  net_usd:        number;   // DELEGATE - UNDELEGATE USD
  last_action:    "DELEGATE" | "UNDELEGATE";
  last_netuid:    number;
  last_usd:       number;
  last_ts:        string;
  active_subnets: number[];
}
interface TSCache {
  whales:    TSWhaleWallet[];
  updatedAt: string;
}
const TS_CACHE_KEY    = "wallet-tracker-ts-whales.json";
const TS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

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
  // Fetch top 1500 wallets by total TAO, subnet names, and TAO price in parallel
  const [topWallets, subnetNames, taoPrice] = await Promise.all([
    fetchTMCList("total", 1500),
    fetchSubnetNames(),
    getTaoPrice().catch(() => 0),
  ]);

  console.log(`[wallet-tracker] Got ${topWallets.length} wallets, ${subnetNames.size} subnets, TAO=$${taoPrice}`);

  // Pre-filter: only fetch detail for wallets with tao_staked > 0
  // (pure root-network validators have tao_staked=0 and will never qualify)
  const candidates = topWallets.filter(w => (w.tao_staked ?? 0) > 0);
  console.log(`[wallet-tracker] ${candidates.length}/${topWallets.length} wallets have alpha staking`);

  // Batch-fetch per-wallet detail (20 concurrent at a time)
  const BATCH = 20;
  const details: (TMCWalletDetail | null)[] = [];
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch   = candidates.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(w => fetchDetail(w.id)));
    for (const r of results) details.push(r.status === "fulfilled" ? r.value : null);
  }

  console.log(`[wallet-tracker] Fetched ${details.filter(Boolean).length}/${candidates.length} details`);

  const enriched: WalletEntry[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const w      = candidates[i];
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

// ── Build TaoStats whale wallet list (recent large dTAO stakers) ─
async function buildTSWhales(): Promise<TSWhaleWallet[]> {
  const TAOSTATS_KEY = process.env.TAOSTATS_API_KEY || "";
  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 86400_000) / 1000);

  // Fetch top 500 delegations by amount in last 30 days
  const url = `https://api.taostats.io/api/delegation/v1?limit=500&order=amount_desc&timestamp_start=${thirtyDaysAgo}`;
  const r = await fetch(url, {
    headers: { Authorization: TAOSTATS_KEY },
    signal: AbortSignal.timeout(15000),
    next: { revalidate: 0 },
  });
  if (!r.ok) throw new Error(`TaoStats delegation → HTTP ${r.status}`);

  interface TSDelegation {
    action:    "DELEGATE" | "UNDELEGATE";
    timestamp: string;
    nominator: { ss58: string };
    amount:    string; // rao
    usd:       string | null;
    netuid:    number | null;
  }
  const json = await r.json() as { data?: TSDelegation[] };
  const rows = json.data ?? [];

  // Only alpha subnet staking (netuid > 0), skip root network
  const alpha = rows.filter(d => d.netuid != null && d.netuid > 0);

  // Aggregate per wallet
  const map = new Map<string, {
    delegateUsd: number; undelegateUsd: number;
    subnets: Set<number>;
    lastAction: "DELEGATE" | "UNDELEGATE"; lastNetuid: number;
    lastUsd: number; lastTs: string;
  }>();

  for (const d of alpha) {
    const addr = d.nominator.ss58;
    const usd  = parseFloat(d.usd ?? "0") || 0;
    const netuid = d.netuid!;

    if (!map.has(addr)) {
      map.set(addr, {
        delegateUsd: 0, undelegateUsd: 0, subnets: new Set(),
        lastAction: d.action, lastNetuid: netuid, lastUsd: usd, lastTs: d.timestamp,
      });
    }
    const w = map.get(addr)!;
    if (d.action === "DELEGATE")   w.delegateUsd   += usd;
    else                           w.undelegateUsd += usd;
    w.subnets.add(netuid);
    if (d.timestamp >= w.lastTs) {
      w.lastTs = d.timestamp; w.lastAction = d.action;
      w.lastNetuid = netuid;  w.lastUsd = usd;
    }
  }

  const result: TSWhaleWallet[] = [];
  for (const [address, agg] of map) {
    if (agg.subnets.size < 1) continue; // must have at least 1 alpha subnet
    const known = KNOWN_WALLETS[address];
    result.push({
      address,
      label:    known?.label,
      emoji:    known?.emoji,
      category: known?.category,
      is_known: !!known,
      subnet_count:   agg.subnets.size,
      total_usd:      Math.round(agg.delegateUsd),
      net_usd:        Math.round(agg.delegateUsd - agg.undelegateUsd),
      last_action:    agg.lastAction,
      last_netuid:    agg.lastNetuid,
      last_usd:       Math.round(agg.lastUsd),
      last_ts:        agg.lastTs,
      active_subnets: [...agg.subnets].sort((a, b) => a - b),
    });
  }

  // Sort by total USD deployed (largest alpha investors first)
  return result
    .sort((a, b) => b.total_usd - a.total_usd)
    .slice(0, 200);
}

// ── Build SubnetRadar whale wallet list ───────────────────────────
async function buildSRWhales(): Promise<SRWhaleWallet[]> {
  const r = await fetch("https://subnetradar.com/api/whales", {
    signal: AbortSignal.timeout(10000),
    headers: {
      "User-Agent": "Mozilla/5.0 AppleWebKit/537.36",
      "Accept":     "application/json",
      "Referer":    "https://subnetradar.com/",
    },
    next: { revalidate: 0 },
  });
  if (!r.ok) throw new Error(`SR whales → HTTP ${r.status}`);
  const data = await r.json() as { moves?: SRWhaleMoveRaw[]; whaleData?: SRWhaleMoveRaw[] };

  // Prefer whaleData if it exists, fall back to moves
  const moves: SRWhaleMoveRaw[] = data.whaleData ?? data.moves ?? [];

  // Only care about stake/unstake moves with a from address
  const stakeMoves = moves.filter(
    m => (m.type === "stake" || m.type === "unstake") && m.from && m.amount > 0
  );

  // Aggregate per wallet
  const walletMap = new Map<string, {
    staked: number; unstaked: number; moveCount: number;
    lastAction: "stake" | "unstake"; lastNetuid?: number;
    lastAmount: number; lastTs: string; subnets: Set<number>;
  }>();

  for (const m of stakeMoves) {
    const addr = m.from;
    if (!walletMap.has(addr)) {
      walletMap.set(addr, {
        staked: 0, unstaked: 0, moveCount: 0,
        lastAction: m.type as "stake" | "unstake",
        lastNetuid: m.netuid, lastAmount: m.amount,
        lastTs: m.timestamp, subnets: new Set(),
      });
    }
    const w = walletMap.get(addr)!;
    if (m.type === "stake")   w.staked   += m.amount;
    else                      w.unstaked += m.amount;
    w.moveCount++;
    if (m.netuid != null) w.subnets.add(m.netuid);
    // Track most recent
    if (m.timestamp >= w.lastTs) {
      w.lastTs     = m.timestamp;
      w.lastAction = m.type as "stake" | "unstake";
      w.lastNetuid = m.netuid;
      w.lastAmount = m.amount;
    }
  }

  const result: SRWhaleWallet[] = [];
  for (const [address, agg] of walletMap) {
    const known = KNOWN_WALLETS[address];
    result.push({
      address,
      label:          known?.label,
      emoji:          known?.emoji,
      category:       known?.category,
      is_known:       !!known,
      move_count:     agg.moveCount,
      total_staked:   Math.round(agg.staked   * 100) / 100,
      total_unstaked: Math.round(agg.unstaked * 100) / 100,
      net_tao:        Math.round((agg.staked - agg.unstaked) * 100) / 100,
      last_action:    agg.lastAction,
      last_netuid:    agg.lastNetuid,
      last_amount:    Math.round(agg.lastAmount * 100) / 100,
      last_ts:        agg.lastTs,
      active_subnets: [...agg.subnets].sort((a, b) => a - b),
    });
  }

  // Sort by total volume (staked + unstaked), most active first
  return result
    .sort((a, b) => (b.total_staked + b.total_unstaked) - (a.total_staked + a.total_unstaked))
    .slice(0, 150);
}

// ── Main handler ──────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode");

  if (!TMC_API_KEY) {
    return NextResponse.json({ error: "TMC_API_KEY not configured" }, { status: 500 });
  }

  // ── TaoStats Whales mode (recent large dTAO stakers, 10-min cache) ──
  if (mode === "taostats-whales") {
    const cached = await readBlob<TSCache>(TS_CACHE_KEY);
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < TS_CACHE_TTL_MS) {
      return NextResponse.json(cached);
    }
    try {
      const whales = await buildTSWhales();
      const result: TSCache = { whales, updatedAt: new Date().toISOString() };
      await writeBlob(TS_CACHE_KEY, result);
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── SR Whales mode (live SubnetRadar data, 5-min cache) ──────
  if (mode === "sr-whales") {
    const cached = await readBlob<SRCache>(SR_CACHE_KEY);
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < SR_CACHE_TTL_MS) {
      return NextResponse.json(cached);
    }
    try {
      const whales = await buildSRWhales();
      const result: SRCache = { whales, updatedAt: new Date().toISOString() };
      await writeBlob(SR_CACHE_KEY, result);
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
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
