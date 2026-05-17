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
export const maxDuration = 120;

const TMC_API_KEY  = process.env.TMC_API_KEY || "";
const RAO_PER_TAO  = 1_000_000_000;
const ROOT_NETUID  = 0; // subnet 0 = root/legacy — NOT an alpha token

const MAIN_CACHE_KEY    = "wallet-tracker-v9.json";
const MAIN_CACHE_TTL_MS = 60 * 60 * 1000; // 60 min (expensive to compute)

const WIN_CACHE_KEY     = "wallet-tracker-winners.json";

const SR_CACHE_KEY      = "wallet-tracker-sr-whales.json";
const SR_CACHE_TTL_MS   = 10 * 60 * 1000; // 10 min (live SR data)
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
  // Retry up to 3 times with exponential back-off on 429
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(res => setTimeout(res, attempt * 2000));
    const r = await fetch(url, {
      headers: { Authorization: TMC_API_KEY },
      signal: AbortSignal.timeout(20000),
      next: { revalidate: 0 },
    });
    if (r.status === 429) {
      console.warn(`[wallet-tracker] Rate limited on list fetch (attempt ${attempt + 1})`);
      continue;
    }
    if (!r.ok) throw new Error(`Wallet list fetch failed (${r.status})`);
    const j = await r.json();
    return (j?.results ?? j?.data ?? j ?? []) as TMCColdkey[];
  }
  throw new Error("Wallet list fetch failed (429 after retries)");
}

async function fetchDetail(address: string): Promise<TMCWalletDetail | null> {
  try {
    // Retry once on 429
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise(res => setTimeout(res, 1500));
      const r = await fetch(
        `https://api.taomarketcap.com/public/v1/accounts/coldkeys/${address}/`,
        { headers: { Authorization: TMC_API_KEY }, signal: AbortSignal.timeout(10000), next: { revalidate: 0 } }
      );
      if (r.status === 429) continue;
      if (!r.ok) return null;
      return await r.json() as TMCWalletDetail;
    }
    return null;
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

// ── Alpha-position filter (shared across all list modes) ─────────
/**
 * Given a list of wallet addresses, returns a Set of those that currently
 * hold at least one alpha token (netuid > 0, tao_staked > 0).
 *
 * Fast-path: any address already in the main cache is known to qualify.
 * Slow-path: remaining addresses are batch-checked via fetchDetail (up to 60,
 *            10 concurrent) so we don't add unbounded latency.
 */
async function filterToAlphaHolders(addresses: string[]): Promise<Set<string>> {
  // Load main cache for the fast-path (usually already warm / in-memory blob)
  const main    = await readBlob<MainCache>(MAIN_CACHE_KEY);
  const mainSet = new Set((main?.wallets ?? []).map(w => w.address));

  const result:  Set<string> = new Set();
  const unknown: string[]    = [];

  for (const addr of addresses) {
    if (mainSet.has(addr)) result.add(addr);
    else unknown.push(addr);
  }

  // Batch-check up to 60 unknown wallets (10 concurrent)
  const toCheck    = unknown.slice(0, 60);
  const CONCURRENT = 10;
  for (let i = 0; i < toCheck.length; i += CONCURRENT) {
    const batch   = toCheck.slice(i, i + CONCURRENT);
    const settled = await Promise.allSettled(batch.map(addr => fetchDetail(addr)));
    for (let j = 0; j < batch.length; j++) {
      const s      = settled[j];
      const detail = s.status === "fulfilled" ? s.value : null;
      if (!detail?.hotkeys?.length) continue;
      const hasAlpha = detail.hotkeys.some(
        hk => hk.subnet != null && hk.subnet !== ROOT_NETUID && (hk.tao_staked ?? 0) > 0
      );
      if (hasAlpha) result.add(batch[j]);
    }
  }

  return result;
}

// ── Build the main filtered wallet list ───────────────────────────
// Strategy: seed candidates from TaoStats delegation events (confirmed alpha
// holders) instead of scanning random TMC wallets. TaoStats delegation events
// with netuid > 0 ARE alpha staking events, so every address is guaranteed to
// be a real alpha investor. Enrich with TMC detail for current positions.
async function buildMainList(): Promise<WalletEntry[]> {
  const TAOSTATS_KEY = process.env.TAOSTATS_API_KEY || "";
  const sixtyDaysAgo = Math.floor((Date.now() - 60 * 86400_000) / 1000);

  // Fetch in parallel:
  //  1. TaoStats delegations — confirmed alpha investor addresses
  //  2. TMC top 100 — provides rank + 24h change data for known wallets
  //  3. Subnet names + TAO price
  interface TSDelegationLite { nominator: { ss58: string }; netuid: number | null; }
  const [tsResult, tmcTop, subnetNames, taoPrice] = await Promise.all([
    fetch(
      `https://api.taostats.io/api/delegation/v1?limit=1000&order=amount_desc&timestamp_start=${sixtyDaysAgo}`,
      { headers: { Authorization: TAOSTATS_KEY }, signal: AbortSignal.timeout(15000), next: { revalidate: 0 } }
    ).then(r => r.ok ? r.json() as Promise<{ data?: TSDelegationLite[] }> : { data: [] }).catch(() => ({ data: [] })),
    fetchTMCList("tao_staked", 100).catch(() => [] as TMCColdkey[]),
    fetchSubnetNames(),
    getTaoPrice().catch(() => 0),
  ]);

  // Collect confirmed alpha investor addresses from TaoStats (netuid > 0 only)
  const tsAddresses = new Set<string>();
  for (const d of (tsResult.data ?? [])) {
    if (d.netuid != null && d.netuid > 0 && d.nominator?.ss58) {
      tsAddresses.add(d.nominator.ss58);
    }
  }
  console.log(`[wallet-tracker] ${tsAddresses.size} alpha investors from TaoStats, ${tmcTop.length} from TMC top, TAO=$${taoPrice}`);

  // Build TMC lookup for rank + 24h change enrichment
  const tmcMap = new Map<string, TMCColdkey>();
  for (const w of tmcTop) tmcMap.set(w.id, w);

  // Merge: TaoStats addresses first (confirmed alpha holders),
  // then any TMC top wallets with stake not already included.
  const allAddresses: string[] = [...tsAddresses];
  for (const w of tmcTop) {
    if (!tsAddresses.has(w.id) && (w.tao_staked ?? 0) > 0) allAddresses.push(w.id);
  }
  const candidates = allAddresses.slice(0, 500);
  console.log(`[wallet-tracker] ${candidates.length} candidates to detail-fetch`);

  // Batch-fetch TMC detail (25 concurrent, 250ms pause between batches)
  const BATCH = 25;
  const details: (TMCWalletDetail | null)[] = [];
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch   = candidates.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(addr => fetchDetail(addr)));
    for (const r of results) details.push(r.status === "fulfilled" ? r.value : null);
    if (i + BATCH < candidates.length) await new Promise(res => setTimeout(res, 250));
  }
  console.log(`[wallet-tracker] Fetched ${details.filter(Boolean).length}/${candidates.length} details`);

  const enriched: WalletEntry[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const addr   = candidates[i];
    const detail = details[i];
    if (!detail?.hotkeys?.length) continue;

    // Aggregate tao_staked per subnet, EXCLUDING root network (SN0)
    const posMap = new Map<number, number>();
    for (const hk of detail.hotkeys) {
      if (hk.subnet == null || hk.subnet === ROOT_NETUID) continue;
      posMap.set(hk.subnet, (posMap.get(hk.subnet) ?? 0) + (hk.tao_staked ?? 0));
    }
    if (posMap.size < 1) continue;

    const positions: AlphaPosition[] = [...posMap.entries()]
      .map(([netuid, taoRao]) => {
        const staked_tao = Math.round(taoRao / RAO_PER_TAO * 100) / 100;
        return { netuid, name: subnetNames.get(netuid) ?? `SN${netuid}`, staked_tao,
                 staked_usd: Math.round(staked_tao * taoPrice * 100) / 100 };
      })
      .sort((a, b) => b.staked_tao - a.staked_tao);

    const staked_tao = positions.reduce((s, p) => s + p.staked_tao, 0);
    const tmc        = tmcMap.get(addr);
    const total_tao  = tmc
      ? Math.round(tmc.total / RAO_PER_TAO * 100) / 100
      : Math.round((detail.total ?? 0) / RAO_PER_TAO * 100) / 100;
    const free_tao   = tmc
      ? Math.round(tmc.free  / RAO_PER_TAO * 100) / 100
      : Math.round((detail.free  ?? 0) / RAO_PER_TAO * 100) / 100;

    const known = KNOWN_WALLETS[addr];
    enriched.push({
      address:        addr,
      label:          known?.label,
      emoji:          known?.emoji,
      category:       known?.category,
      is_known:       !!known,
      total_tao,
      free_tao,
      staked_tao,
      change_24h_tao: tmc ? Math.round(tmc.tao_change_24h     / RAO_PER_TAO * 100) / 100 : 0,
      change_24h_pct: tmc ? Math.round(tmc.percent_change_24h * 100) / 100 : 0,
      rank:           tmc?.rank ?? (i + 1),
      alpha_count:    posMap.size,
      positions,
    });
  }

  // Sort by alpha staked — most active alpha investors first
  return enriched.sort((a, b) => b.staked_tao - a.staked_tao).slice(0, 200);
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
  if (!r.ok) throw new Error(`On-chain data fetch failed (${r.status})`);

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
  // NOTE: No filterToAlphaHolders — TS data is already filtered to netuid > 0 delegation
  //       events. Adding that filter caused massive extra latency (100+ API calls).
  return result.sort((a, b) => b.total_usd - a.total_usd).slice(0, 200);
}

// ── Build SubnetRadar whale wallet list ───────────────────────────
async function buildSRWhales(): Promise<SRWhaleWallet[]> {
  // Try multiple endpoint variants — SR has changed its API shape over time
  const endpoints = [
    "https://subnetradar.com/api/whales",
    "https://subnetradar.com/api/whale-activity",
  ];

  let raw: unknown = null;
  let lastErr = "";
  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AlphaGap/1.0)",
          "Accept":     "application/json",
          "Referer":    "https://subnetradar.com/",
        },
        next: { revalidate: 0 },
      });
      if (r.ok) { raw = await r.json(); break; }
      lastErr = `HTTP ${r.status}`;
    } catch (e) { lastErr = String(e); }
  }

  if (raw == null) throw new Error(`SubnetRadar unavailable: ${lastErr}`);

  // Robust response shape extraction — handles any nesting
  function extractMoves(obj: unknown): SRWhaleMoveRaw[] {
    if (Array.isArray(obj)) return obj as SRWhaleMoveRaw[];
    if (obj && typeof obj === "object") {
      const o = obj as Record<string, unknown>;
      // Try common top-level keys
      for (const key of ["moves", "whaleData", "data", "results", "transactions", "activity"]) {
        const val = o[key];
        if (Array.isArray(val) && val.length > 0) return val as SRWhaleMoveRaw[];
        if (val && typeof val === "object") {
          const inner = extractMoves(val);
          if (inner.length > 0) return inner;
        }
      }
    }
    return [];
  }

  const moves = extractMoves(raw);
  console.log(`[sr-whales] Extracted ${moves.length} raw moves`);

  // Only care about stake/unstake moves with a from address and positive amount
  const stakeMoves = moves.filter(
    m => m && (m.type === "stake" || m.type === "unstake") && m.from && (m.amount ?? 0) > 0
  );
  console.log(`[sr-whales] ${stakeMoves.length} valid stake/unstake moves`);

  if (stakeMoves.length === 0) {
    throw new Error(`No stake moves found in SR response (${moves.length} raw records)`);
  }

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
        lastTs: m.timestamp ?? "", subnets: new Set(),
      });
    }
    const w = walletMap.get(addr)!;
    if (m.type === "stake")   w.staked   += m.amount;
    else                      w.unstaked += m.amount;
    w.moveCount++;
    if (m.netuid != null) w.subnets.add(m.netuid);
    // Track most recent
    const ts = m.timestamp ?? "";
    if (ts >= w.lastTs) {
      w.lastTs     = ts;
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
  // NOTE: No filterToAlphaHolders here — SR data IS already staking activity on alpha
  //       subnets. Adding that filter caused 20-30s extra latency (100+ extra API calls).
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
      // Guard: never overwrite a valid cache with an empty result
      if (whales.length === 0 && cached) {
        console.warn("[ts-whales] Rebuilt 0 whales — serving stale cache");
        return NextResponse.json(cached);
      }
      const result: TSCache = { whales, updatedAt: new Date().toISOString() };
      await writeBlob(TS_CACHE_KEY, result);
      return NextResponse.json(result);
    } catch (e) {
      console.error("[ts-whales] Build error:", String(e));
      if (cached) return NextResponse.json(cached);
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── SR Whales mode (live SubnetRadar data, 10-min cache) ──────
  if (mode === "sr-whales") {
    const cached = await readBlob<SRCache>(SR_CACHE_KEY);
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < SR_CACHE_TTL_MS) {
      return NextResponse.json(cached);
    }
    try {
      const whales = await buildSRWhales();
      // Guard: never overwrite a valid cache with an empty result (upstream outage)
      if (whales.length === 0 && cached) {
        console.warn("[sr-whales] Rebuilt 0 whales — serving stale cache");
        return NextResponse.json(cached);
      }
      const result: SRCache = { whales, updatedAt: new Date().toISOString() };
      await writeBlob(SR_CACHE_KEY, result);
      return NextResponse.json(result);
    } catch (e) {
      console.error("[sr-whales] Build error:", String(e));
      if (cached) return NextResponse.json(cached);
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
      const raw = await fetchTMCList("tao_change_24h", 100);
      const candidates: WinnerEntry[] = raw
        .filter(w => w.tao_change_24h >= RAO_PER_TAO && w.total > 0 && (w.tao_staked ?? 0) > 0) // ≥ 1 TAO gain, no dust
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
        .slice(0, 80);

      // Sort by biggest 24h gain first — already pre-filtered to tao_staked > 0
      // (filterToAlphaHolders removed: it added 20s+ latency with 80+ extra API calls)
      const winners = candidates
        .sort((a, b) => b.change_24h_tao - a.change_24h_tao)
        .slice(0, 50);

      const result: WinnersCache = { winners, updatedAt: new Date().toISOString() };
      await writeBlob(WIN_CACHE_KEY, result);
      return NextResponse.json(result);
    } catch (e) {
      const winCached = await readBlob<WinnersCache>(WIN_CACHE_KEY);
      if (winCached) return NextResponse.json(winCached);
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── Single wallet PROFILE (positions + trade history + P&L) ──
  if (mode === "wallet-profile") {
    const address = request.nextUrl.searchParams.get("address");
    if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

    const TAOSTATS_KEY = process.env.TAOSTATS_API_KEY || "";

    try {
      const [detail, subnetNames, taoPrice, tradesRes] = await Promise.all([
        fetchDetail(address),
        fetchSubnetNames(),
        getTaoPrice().catch(() => 0),
        fetch(
          // correct param is "nominator" (not "nominator_ss58" which is silently ignored)
          // 500 records desc → display recent 50, reverse for chronological P&L calc
          `https://api.taostats.io/api/delegation/v1?nominator=${encodeURIComponent(address)}&limit=500&order=timestamp_desc`,
          {
            headers: { Authorization: TAOSTATS_KEY },
            signal: AbortSignal.timeout(12000),
            next: { revalidate: 0 },
          }
        ).catch(() => null),
      ]);

      // Build positions
      const posMap = new Map<number, number>();
      if (detail?.hotkeys?.length) {
        for (const hk of detail.hotkeys) {
          if (hk.subnet == null || hk.subnet === ROOT_NETUID) continue;
          posMap.set(hk.subnet, (posMap.get(hk.subnet) ?? 0) + (hk.tao_staked ?? 0));
        }
      }
      const positions: AlphaPosition[] = [...posMap.entries()]
        .map(([netuid, taoRao]) => {
          const staked_tao = Math.round(taoRao / RAO_PER_TAO * 100) / 100;
          return { netuid, name: subnetNames.get(netuid) ?? `SN${netuid}`, staked_tao, staked_usd: Math.round(staked_tao * taoPrice * 100) / 100 };
        })
        .sort((a, b) => b.staked_tao - a.staked_tao);

      interface TSDelegationRaw { action: "DELEGATE" | "UNDELEGATE"; timestamp: string; amount: string; usd: string | null; netuid: number | null; }
      interface TradeEntry { action: "DELEGATE" | "UNDELEGATE"; netuid: number | null; subnet_name: string; amount_tao: number; amount_usd: number; timestamp: string; }

      let rawRows: TSDelegationRaw[] = [];
      let historyComplete = true; // false when wallet has >500 total delegation events
      if (tradesRes?.ok) {
        const j = await tradesRes.json() as { data?: TSDelegationRaw[]; pagination?: { total_items?: number } };
        rawRows = j.data ?? [];
        const totalItems = j.pagination?.total_items ?? rawRows.length;
        historyComplete = totalItems <= 500;
      }

      // Build display trades (most recent first, only alpha subnets)
      const trades: TradeEntry[] = rawRows
        .filter(d => d.netuid != null && d.netuid > 0)
        .slice(0, 50)
        .map(d => ({
          action:      d.action,
          netuid:      d.netuid,
          subnet_name: subnetNames.get(d.netuid!) ?? `SN${d.netuid}`,
          amount_tao:  Math.round(parseInt(d.amount || "0") / RAO_PER_TAO * 100) / 100,
          amount_usd:  Math.round((parseFloat(d.usd ?? "0") || 0) * 100) / 100,
          timestamp:   d.timestamp,
        }));

      // ── P&L engine (FIFO per subnet, chronological order) ──────
      // Only alpha subnets, process oldest-first
      const chronoRows = [...rawRows]
        .filter(d => d.netuid != null && d.netuid > 0)
        .reverse();

      const buyQueues = new Map<number, Array<{ tao: number; ts: number }>>();
      let total_invested = 0; // sum of all DELEGATE TAO
      let realized_pnl   = 0;
      const hold_days: number[] = [];

      for (const d of chronoRows) {
        const netuid   = d.netuid!;
        const tao      = parseInt(d.amount || "0") / RAO_PER_TAO;
        const ts       = new Date(d.timestamp).getTime();

        if (!buyQueues.has(netuid)) buyQueues.set(netuid, []);
        const queue = buyQueues.get(netuid)!;

        if (d.action === "DELEGATE") {
          total_invested += tao;
          queue.push({ tao, ts });
        } else {
          // Match sell against buy lots FIFO
          let sell_remaining = tao;
          let cost_matched   = 0;
          while (sell_remaining > 0.001 && queue.length > 0) {
            const lot = queue[0];
            const matched = Math.min(sell_remaining, lot.tao);
            cost_matched   += matched;
            hold_days.push((ts - lot.ts) / 86_400_000);
            if (matched >= lot.tao - 0.001) { queue.shift(); }
            else { lot.tao -= matched; }
            sell_remaining -= matched;
          }
          if (cost_matched > 0) realized_pnl += tao - cost_matched;
        }
      }

      // Remaining buy queue = cost basis of open positions (raw, may be inflated by incomplete history)
      let cost_basis_open_raw = 0;
      for (const q of buyQueues.values()) cost_basis_open_raw += q.reduce((s, l) => s + l.tao, 0);

      const current_staked = positions.reduce((s, p) => s + p.staked_tao, 0);

      // Cap cost basis at actual current holdings. When history is incomplete (>500 records),
      // UNDELEGATEs that closed earlier positions fall outside our window, leaving "orphaned"
      // buy lots that produce phantom losses. Capping prevents this.
      const cost_basis_open = Math.min(cost_basis_open_raw, current_staked);
      const unrealized_pnl  = current_staked - cost_basis_open;
      const total_pnl       = Math.round((realized_pnl + unrealized_pnl) * 100) / 100;
      // ROI is only meaningful when we have complete history (≤500 total delegation events)
      const roi_pct         = (historyComplete && total_invested > 0)
        ? Math.round((total_pnl / total_invested) * 10000) / 100
        : null;
      const avg_hold_days   = hold_days.length > 0 ? Math.round(hold_days.reduce((s, d) => s + d, 0) / hold_days.length * 10) / 10 : null;

      const known     = KNOWN_WALLETS[address];
      const total_tao = detail ? Math.round(detail.total / RAO_PER_TAO * 100) / 100 : 0;
      const free_tao  = detail ? Math.round(detail.free  / RAO_PER_TAO * 100) / 100 : 0;

      return NextResponse.json({
        address,
        label:      known?.label,
        emoji:      known?.emoji,
        category:   known?.category,
        is_known:   !!known,
        total_tao,
        free_tao,
        staked_tao: Math.round(current_staked * 100) / 100,
        total_usd:  Math.round(total_tao * taoPrice * 100) / 100,
        alpha_count: posMap.size,
        tao_price:  taoPrice,
        // P&L metrics
        total_pnl,
        realized_pnl:   Math.round(realized_pnl   * 100) / 100,
        unrealized_pnl: Math.round(unrealized_pnl * 100) / 100,
        roi_pct,
        avg_hold_days,
        positions,
        trades,
      });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── Single wallet detail (on-demand positions for other tabs) ──
  if (mode === "wallet-detail") {
    const address = request.nextUrl.searchParams.get("address");
    if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });
    try {
      const [detail, subnetNames, taoPrice] = await Promise.all([
        fetchDetail(address),
        fetchSubnetNames(),
        getTaoPrice().catch(() => 0),
      ]);
      if (!detail?.hotkeys?.length) return NextResponse.json({ positions: [] });

      const posMap = new Map<number, number>();
      for (const hk of detail.hotkeys) {
        if (hk.subnet == null || hk.subnet === ROOT_NETUID) continue;
        posMap.set(hk.subnet, (posMap.get(hk.subnet) ?? 0) + (hk.tao_staked ?? 0));
      }
      const positions: AlphaPosition[] = [...posMap.entries()]
        .map(([netuid, taoRao]) => {
          const staked_tao = Math.round(taoRao / RAO_PER_TAO * 100) / 100;
          return { netuid, name: subnetNames.get(netuid) ?? `SN${netuid}`, staked_tao, staked_usd: Math.round(staked_tao * taoPrice * 100) / 100 };
        })
        .sort((a, b) => b.staked_tao - a.staked_tao);
      return NextResponse.json({ positions });
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
    // Guard: never overwrite a valid cache with empty results
    if (wallets.length === 0 && cached) {
      console.warn("[wallet-tracker] Built 0 wallets — serving stale cache");
      return NextResponse.json(cached);
    }
    const result: MainCache = { wallets, updatedAt: new Date().toISOString() };
    await writeBlob(MAIN_CACHE_KEY, result);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[wallet-tracker] Build error:", String(e));
    // On rate-limit or transient error, serve stale cache rather than showing error
    if (cached) return NextResponse.json(cached);
    // Last-resort: try reading the previous cache version
    const prev = await readBlob<MainCache>("wallet-tracker-v8.json");
    if (prev?.wallets?.length) return NextResponse.json(prev);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
