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

const MAIN_CACHE_KEY    = "wallet-tracker-v14.json";
const MAIN_CACHE_TTL_MS = 60 * 60 * 1000; // 60 min (expensive to compute)

const WIN_CACHE_KEY     = "wallet-tracker-winners.json";

const SR_CACHE_KEY      = "wallet-tracker-sr-whales.json";
const SR_CACHE_TTL_MS   = 10 * 60 * 1000; // 10 min (live SR data)
const WIN_CACHE_TTL_MS  = 20 * 60 * 1000; // 20 min

// ── Known labeled wallets ─────────────────────────────────────────
export const KNOWN_WALLETS: Record<string, { label: string; emoji: string; category: string }> = {

  // ── Founders ──────────────────────────────────────────────────────
  "5G62K98tpNqsaffgyJmTvDSTCEFzva8WkmMqB2CEFSDgawrS": { label: "Const",        emoji: "👑", category: "founder" },
  "5GH2aUTMRUh1RprCgH4x3tRyCaKeUi5BfmYCfs1NARA8R54n": { label: "Const #2",     emoji: "👑", category: "founder" },

  // ── Opentensor Foundation ─────────────────────────────────────────
  "5HBtpwxuGNL1gwzwomwR7sjwUt8WXYSuWcLYN6f9KpTZkP4k": { label: "OTF",          emoji: "🏛️", category: "otf" },

  // ── VCs & Institutional ───────────────────────────────────────────
  "5E9fVY1jexCNVMjd2rdBsAxeamFGEMfzHcyTn2fHgdHeYc5p": { label: "DCG / Foundry", emoji: "🏦", category: "vc" },
  "5GP8N57T2oja6qR9y3FQDYjrEFxnhmx3ZuiadE64yw6h5For": { label: "Polychain",     emoji: "🔗", category: "vc" },
  "5EJAqczgzCMvWcmXhKMZH4vMS5gPy8BjeuHjz5o5yN6RYzX2": { label: "dao5",          emoji: "🦉", category: "vc" },

  // ── Subnet Owners ─────────────────────────────────────────────────
  "5HCFWvRqzSHWRPecN7q8J6c7aKQnrCZTMHstPv39xL1wgDHh": { label: "Macrocosmos (SN1)",  emoji: "🌌", category: "team" },
  "5G26HqQg8M6hfw9q84gM3udYHHymThmswRKgSGtwdcduBSos": { label: "Templar (SN3)",       emoji: "⚔️",  category: "team" },
  "5F6tnxzAAxbhaWRmeUmB63JEM3VXBNSmqb3AwYJVDStQjw8y": { label: "PTX (SN8)",           emoji: "📈", category: "team" },
  "5FsbubeciqtB5Nik3umL2iD4fG8FcC9GbT9nHJfXMj4mJJZ9": { label: "Macrocosmos (SN9)",  emoji: "🧠", category: "team" },
  "5HBswBt1A9Ahx6U76abXXGd7VmabmCNBGhSK2vrP71GSxtgZ": { label: "Macrocosmos (SN13)", emoji: "🗄️",  category: "team" },
  "5G9FYbXLvGTvGEgYF9tm56oW7RzkSFRCduhJeQq8EML54BXs": { label: "Cortex.t (SN18)",    emoji: "🧬", category: "team" },
  "5CFJNoUYbdw9NvU2MuvQuxG88BWBKYbEQPxg1sVieck16TRq": { label: "Nineteen (SN19)",     emoji: "👁️",  category: "team" },
  "5CMEwRYLefRmtJg7zzRyJtcXrQqmspr9B1r1nKySDReA37Z1": { label: "Rizzo / BitAgent (SN20)", emoji: "🎸", category: "team" },
  "5Cyfk5Jjee6uCafjZyUUjtKd7Q4qh1yJ48Ts7bkT9xXaDqe1": { label: "Neural Internet (SN27)", emoji: "🕸️", category: "team" },
  "5DXqqdrvu5FK3dASRVTCdGPZKx4Q9nkAZZSmibKG6PEEeW4j": { label: "Macrocosmos (SN37)", emoji: "🎛️", category: "team" },
  "5G77DNXrfAxbvi53p3mh88kRMySBcJsv9j9cH4KU6ALWXgQF": { label: "Rayon Labs (SN56)",  emoji: "🎓", category: "team" },
  "5DyV8a62E2t2C4FoSqjihdV5USVXPEZYvZtUjXxZq1Mnvwwg": { label: "Chutes / Rayon (SN64)", emoji: "🚀", category: "team" },

  // ── Validators ────────────────────────────────────────────────────
  "5GcCZ2BPXBjgG88tXJCEtkbdg2hNrPbL4EFfbiVRvBZdSQDC": { label: "Taostats",       emoji: "📊", category: "validator" },
  "5FRXwb2qsEhqDQQKcm5m2MF26xTWwW65MHTEtKFFydypuqjG": { label: "Macrocosmos",    emoji: "🌌", category: "validator" },
  "5DkwfxC9mZTTCsRUt6nrnwQEWVrhsmY13SBRparj6cpAVxVY": { label: "Datura",         emoji: "🌵", category: "validator" },
  "5GZSAgaVGQqegjhEkxpJjpSVLVmNnE2vx2PFLzr7kBBMKpGQ": { label: "RoundTable21",   emoji: "🔄", category: "validator" },
  "5CAwB3dSiMC5jJfpvVU47zT3Gyz5ZDoiyHMaYZUuNs5hFh2P": { label: "TAO.com",        emoji: "🧙", category: "validator" },
  "5HJvTnicbUEyKHE8pu3tWVhECRiqgDmxKE3AcG4H4djeyRK8": { label: "TAO-Validator",  emoji: "✅", category: "validator" },
  "5G1KeLg1rda5kBZ9pWVnpAe3y4RwRRphcVxuY5mukLFStJhj": { label: "FirstTensor",    emoji: "1️⃣",  category: "validator" },
  "5DSsZGwBuYHRDA7HzdZUVBhKKpZpJKcf7rTd9y5Gz1SQyo9V": { label: "Tensorplex",     emoji: "⚡", category: "validator" },
  "5GsbTgfvgCH4xdqSkiPb7EaBBFLHjWH5vfEALhJaewSFpZX9": { label: "tao.bot",        emoji: "🤖", category: "validator" },
  "5FHxxe8ZKYaNmGcSLdG5ekxXeZDhQnk9cbpHdsJW8RunGpSs": { label: "Kraken",         emoji: "🦑", category: "validator" },
  "5GRPcZ7L6cmCshSTiHPUUHFWFP8Go9gt6ndZZerF1R4fx7AZ": { label: "TaoStation",     emoji: "🛸", category: "validator" },
  "5EsyFEexqVRqaYymJmkmjDg55Lvr6ucbB22ZYDuSD9oVQgq1": { label: "Bittensor.Exchange", emoji: "💱", category: "validator" },
  "5EqnBs8XTFKqkA7B3xmzY6rWQGcBEqXYKebP7EhMtFrUKcrL": { label: "NorthTensor",   emoji: "🧭", category: "validator" },
  "5GyAMYSxde6x5hG8AHksoPHZZeum8GXk8sXisgADNn6CSi7Y": { label: "PRvalidator",    emoji: "📰", category: "validator" },
  "5CrBAGHUxUdj91kJZw8FAqA2USvksttNFgcMbfSfmqPcTu8t": { label: "Giga Corp",      emoji: "💪", category: "validator" },
  "5DALJz7mndb2b4bAaxtokVSrKpd9PS48qYPyYerb4xFs7KDb": { label: "Miners Union",   emoji: "⛏️",  category: "validator" },
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

// ── Parse TaoStats delegation responses robustly ──────────────────
// TaoStats has shipped multiple response shapes over time:
//   { data: [...] }   (v1 original)
//   { results: [...] } (some versions)
//   [...] direct array (rare)
// This helper extracts alpha investor addresses regardless of shape.
function extractTSAlphaAddresses(raw: unknown): Set<string> {
  const result = new Set<string>();
  let rows: unknown[] = [];
  if (Array.isArray(raw)) {
    rows = raw;
  } else if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.data))    rows = r.data;
    else if (Array.isArray(r.results)) rows = r.results;
  }
  for (const d of rows) {
    if (!d || typeof d !== "object") continue;
    const row = d as Record<string, unknown>;
    const netuid = row.netuid as number | null;
    if (netuid == null || netuid <= 0) continue;
    // Handle both nominator.ss58, nominator.address, and nominator as plain string
    const nom = row.nominator;
    let addr: string | undefined;
    if (typeof nom === "string") addr = nom;
    else if (nom && typeof nom === "object") {
      const n = nom as Record<string, unknown>;
      addr = (n.ss58 ?? n.address ?? n.coldkey ?? n.id) as string | undefined;
    }
    if (addr && typeof addr === "string") result.add(addr);
  }
  return result;
}

// ── Build the main filtered wallet list ───────────────────────────
// Strategy:
//   Primary:  TaoStats delegation events (5 pages × 200, timestamp_desc) →
//             confirmed alpha investors (netuid > 0 only). Typically gives 250-350
//             unique addresses covering the most active recent dTAO stakers.
//   Fallback: Previously-built TSWhales cache (same alpha-staker pool, avoids
//             a blank list when TaoStats is temporarily slow/down).
//   Enrichment: TMC top-200 list for rank + 24h change data only (NOT used
//             as candidate source — TMC top-by-tao_staked are mostly validators
//             with root-network stake and zero alpha positions).
async function buildMainList(): Promise<WalletEntry[]> {
  const TAOSTATS_KEY = process.env.TAOSTATS_API_KEY || "";
  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 86400_000) / 1000);

  const tsFetch = (page: number) =>
    fetch(
      `https://api.taostats.io/api/delegation/v1?limit=200&page=${page}&order=timestamp_desc&timestamp_start=${thirtyDaysAgo}`,
      { headers: { Authorization: TAOSTATS_KEY }, signal: AbortSignal.timeout(15000), next: { revalidate: 0 } }
    ).then(r => r.ok ? r.json() : null).catch(() => null);

  // Fetch TaoStats pages + enrichment data + TSWhales cache (fallback seed) in parallel
  const [ts1, ts2, ts3, ts4, ts5, tmcTop, tsWhalesCache, subnetNames, taoPrice] = await Promise.all([
    tsFetch(1), tsFetch(2), tsFetch(3), tsFetch(4), tsFetch(5),
    fetchTMCList("tao_staked", 200).catch(() => [] as TMCColdkey[]),
    readBlob<TSCache>(TS_CACHE_KEY),   // previously built by the TSWhales tab
    fetchSubnetNames(),
    getTaoPrice().catch(() => 0),
  ]);

  // Collect confirmed alpha investor addresses from TaoStats (format-resilient)
  const tsAddresses = new Set<string>();
  for (const page of [ts1, ts2, ts3, ts4, ts5]) {
    for (const addr of extractTSAlphaAddresses(page)) tsAddresses.add(addr);
  }

  // Supplement with any addresses from the TSWhales cache (robust fallback)
  // These are already confirmed alpha stakers, so they're ideal candidates.
  const cachedWhaleCount = (tsWhalesCache?.whales ?? []).length;
  for (const w of (tsWhalesCache?.whales ?? [])) {
    tsAddresses.add(w.address);
  }

  console.log(`[wallet-tracker] ${tsAddresses.size} alpha investor candidates (TaoStats + ${cachedWhaleCount} TSWhales cache), TAO=$${taoPrice}`);

  // TMC data for enrichment only (rank + 24h change)
  const tmcMap = new Map<string, TMCColdkey>();
  for (const w of tmcTop) tmcMap.set(w.id, w);

  // Known wallets go FIRST so they're always in the first fetch batch
  const knownAddresses = Object.keys(KNOWN_WALLETS);
  const knownSet = new Set(knownAddresses);

  const allAddresses: string[] = [...knownAddresses]; // known first
  for (const addr of tsAddresses) {
    if (!knownSet.has(addr)) allAddresses.push(addr);
  }
  const candidates = allAddresses.slice(0, 550);
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
    const isKnown = !!KNOWN_WALLETS[addr];
    if (!detail?.hotkeys?.length && !isKnown) continue;

    // Aggregate tao_staked per subnet, EXCLUDING root network (SN0)
    const posMap = new Map<number, number>();
    for (const hk of (detail?.hotkeys ?? [])) {
      if (hk.subnet == null || hk.subnet === ROOT_NETUID) continue;
      posMap.set(hk.subnet, (posMap.get(hk.subnet) ?? 0) + (hk.tao_staked ?? 0));
    }
    // Regular wallets need ≥1 alpha position; known wallets always shown
    if (posMap.size < 1 && !isKnown) continue;

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
      : Math.round(((detail?.total) ?? 0) / RAO_PER_TAO * 100) / 100;
    const free_tao   = tmc
      ? Math.round(tmc.free  / RAO_PER_TAO * 100) / 100
      : Math.round(((detail?.free) ?? 0) / RAO_PER_TAO * 100) / 100;

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

  // Sort by alpha staked — most active alpha investors first.
  // Known wallets are always included (not subject to the 200-wallet cap).
  const sorted = enriched.sort((a, b) => b.staked_tao - a.staked_tao);
  const topRegular = sorted.filter(w => !knownSet.has(w.address)).slice(0, 200);
  const knownEntries = sorted.filter(w => knownSet.has(w.address));
  // Merge: known wallets that are also in the top 200 stay in their position;
  // any known wallets outside the top 200 are appended at the end.
  const topRegularAddrs = new Set(topRegular.map(w => w.address));
  const knownOnly = knownEntries.filter(w => !topRegularAddrs.has(w.address));
  return [...topRegular, ...knownOnly];
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

  // ── Single wallet PROFILE (positions + P&L only — trades are fetched separately) ──
  if (mode === "wallet-profile") {
    const address = request.nextUrl.searchParams.get("address");
    if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

    const TAOSTATS_KEY = process.env.TAOSTATS_API_KEY || "";

    try {
      const [detail, subnetNames, taoPrice, tradesRes] = await Promise.all([
        fetchDetail(address),
        fetchSubnetNames(),
        getTaoPrice().catch(() => 0),
        // Retry once on timeout — 20s per attempt
        (async () => {
          for (let attempt = 0; attempt < 2; attempt++) {
            if (attempt > 0) await new Promise(res => setTimeout(res, 2000));
            try {
              const r = await fetch(
                `https://api.taostats.io/api/delegation/v1?nominator=${encodeURIComponent(address)}&limit=500&order=timestamp_desc`,
                { headers: { Authorization: TAOSTATS_KEY }, signal: AbortSignal.timeout(20000), next: { revalidate: 0 } }
              );
              if (r.ok) return r;
            } catch { /* retry */ }
          }
          return null;
        })(),
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
      interface TradeEntry { action: "DELEGATE" | "UNDELEGATE"; netuid: number | null; subnet_name: string; amount_tao: number; amount_usd: number; timestamp: string; is_validator_swap?: boolean; }

      let rawRows: TSDelegationRaw[] = [];
      let historyComplete = true;
      let trades_failed   = false;
      if (tradesRes?.ok) {
        const j = await tradesRes.json() as { data?: TSDelegationRaw[]; pagination?: { total_items?: number } };
        rawRows = j.data ?? [];
        const totalItems = j.pagination?.total_items ?? rawRows.length;
        historyComplete = totalItems <= 500;
      } else {
        trades_failed = true;
        console.warn(`[wallet-profile] Trades fetch failed for ${address} — returning empty trades with flag`);
      }

      // Build display trades (most recent first, only alpha subnets)
      const rawDisplayRows = rawRows
        .filter(d => d.netuid != null && d.netuid > 0)
        .slice(0, 50)
        .map(d => ({
          action:      d.action,
          netuid:      d.netuid,
          subnet_name: subnetNames.get(d.netuid!) ?? `SN${d.netuid}`,
          amount_tao:  Math.round(parseInt(d.amount || "0") / RAO_PER_TAO * 100) / 100,
          amount_usd:  Math.round((parseFloat(d.usd ?? "0") || 0) * 100) / 100,
          timestamp:   d.timestamp,
          is_validator_swap: false,
        }));

      // Detect validator swaps: DELEGATE + UNDELEGATE for the same subnet,
      // same amount (within 1%), within 10 minutes of each other.
      const SWAP_WINDOW_MS = 10 * 60 * 1000;
      for (let a = 0; a < rawDisplayRows.length; a++) {
        if (rawDisplayRows[a].is_validator_swap) continue;
        const ra = rawDisplayRows[a];
        for (let b = a + 1; b < rawDisplayRows.length; b++) {
          const rb = rawDisplayRows[b];
          if (rb.netuid !== ra.netuid) continue;
          const timeDiff = Math.abs(new Date(ra.timestamp).getTime() - new Date(rb.timestamp).getTime());
          if (timeDiff > SWAP_WINDOW_MS) break;
          if (ra.action !== rb.action) {
            const amtA = ra.amount_tao, amtB = rb.amount_tao;
            const pct = amtA > 0 ? Math.abs(amtA - amtB) / amtA : 1;
            if (pct < 0.01) {
              rawDisplayRows[a].is_validator_swap = true;
              rawDisplayRows[b].is_validator_swap = true;
              break;
            }
          }
        }
      }

      const trades: TradeEntry[] = rawDisplayRows;

      // ── P&L engine (FIFO per subnet, chronological order) ──────
      const chronoRows = [...rawRows]
        .filter(d => d.netuid != null && d.netuid > 0)
        .reverse();

      const buyQueues = new Map<number, Array<{ tao: number; ts: number }>>();
      let total_invested = 0;
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

      let cost_basis_open_raw = 0;
      for (const q of buyQueues.values()) cost_basis_open_raw += q.reduce((s, l) => s + l.tao, 0);

      const current_staked  = positions.reduce((s, p) => s + p.staked_tao, 0);
      const cost_basis_open = Math.min(cost_basis_open_raw, current_staked);
      const unrealized_pnl  = current_staked - cost_basis_open;
      const total_pnl       = Math.round((realized_pnl + unrealized_pnl) * 100) / 100;
      const roi_pct         = (historyComplete && !trades_failed && total_invested > 0)
        ? Math.round((total_pnl / total_invested) * 10000) / 100
        : null;
      const avg_hold_days   = hold_days.length > 0
        ? Math.round(hold_days.reduce((s, d) => s + d, 0) / hold_days.length * 10) / 10
        : null;

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
        total_pnl,
        realized_pnl:   Math.round(realized_pnl   * 100) / 100,
        unrealized_pnl: Math.round(unrealized_pnl * 100) / 100,
        roi_pct,
        avg_hold_days,
        positions,
        trades,
        trades_failed,  // true when TaoStats was unreachable — UI shows retry button
      });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── Trades-only refresh (called by UI retry button) ───────────────
  if (mode === "wallet-trades") {
    const address = request.nextUrl.searchParams.get("address");
    if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

    const TAOSTATS_KEY = process.env.TAOSTATS_API_KEY || "";

    // 3 attempts, 2s apart, 25s timeout each
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(res => setTimeout(res, 2000));
      try {
        const r = await fetch(
          `https://api.taostats.io/api/delegation/v1?nominator=${encodeURIComponent(address)}&limit=500&order=timestamp_desc`,
          { headers: { Authorization: TAOSTATS_KEY }, signal: AbortSignal.timeout(25000), next: { revalidate: 0 } }
        );
        if (!r.ok) continue;

        const subnetNames = await fetchSubnetNames();
        interface TSDelegationRaw { action: "DELEGATE" | "UNDELEGATE"; timestamp: string; amount: string; usd: string | null; netuid: number | null; }
        const j = await r.json() as { data?: TSDelegationRaw[] };
        const rawRows = j.data ?? [];
        const rawDisplayRows2 = rawRows
          .filter(d => d.netuid != null && d.netuid > 0)
          .slice(0, 50)
          .map(d => ({
            action:      d.action,
            netuid:      d.netuid,
            subnet_name: subnetNames.get(d.netuid!) ?? `SN${d.netuid}`,
            amount_tao:  Math.round(parseInt(d.amount || "0") / RAO_PER_TAO * 100) / 100,
            amount_usd:  Math.round((parseFloat(d.usd ?? "0") || 0) * 100) / 100,
            timestamp:   d.timestamp,
            is_validator_swap: false,
          }));
        const SWAP_WIN = 10 * 60 * 1000;
        for (let a = 0; a < rawDisplayRows2.length; a++) {
          if (rawDisplayRows2[a].is_validator_swap) continue;
          const ra = rawDisplayRows2[a];
          for (let b = a + 1; b < rawDisplayRows2.length; b++) {
            const rb = rawDisplayRows2[b];
            if (rb.netuid !== ra.netuid) continue;
            const timeDiff = Math.abs(new Date(ra.timestamp).getTime() - new Date(rb.timestamp).getTime());
            if (timeDiff > SWAP_WIN) break;
            if (ra.action !== rb.action) {
              const pct = ra.amount_tao > 0 ? Math.abs(ra.amount_tao - rb.amount_tao) / ra.amount_tao : 1;
              if (pct < 0.01) { rawDisplayRows2[a].is_validator_swap = true; rawDisplayRows2[b].is_validator_swap = true; break; }
            }
          }
        }
        return NextResponse.json({ trades: rawDisplayRows2 });
      } catch { /* retry */ }
    }
    return NextResponse.json({ error: "TaoStats unavailable after 3 attempts" }, { status: 503 });
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
    // Guard: never overwrite a valid cache with empty / known-only results
    const nonKnownCount = wallets.filter(w => !w.is_known).length;
    const cachedNonKnown = (cached?.wallets ?? []).filter(w => !w.is_known).length;
    if (nonKnownCount === 0 && cachedNonKnown > 0) {
      console.warn(`[wallet-tracker] Built ${wallets.length} wallets (0 non-known) — serving stale cache with ${cachedNonKnown} non-known wallets`);
      return NextResponse.json(cached);
    }
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
    const prev = await readBlob<MainCache>("wallet-tracker-v9.json");
    if (prev?.wallets?.length) return NextResponse.json(prev);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
