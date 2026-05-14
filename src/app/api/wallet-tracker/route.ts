/**
 * GET /api/wallet-tracker
 *
 * Returns the top 50 wallets by TAO stake + top 50 by alpha USD value,
 * aggregated from TaoStats stake_balance endpoint. Results are cached in
 * Vercel Blob for 30 minutes to avoid hammering the API.
 *
 * Also returns a curated list of known/labeled wallets.
 */

import { NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";

export const dynamic = "force-dynamic";

const TAOSTATS_KEY  = process.env.TAOSTATS_API_KEY || "";
const TMC_API_KEY   = process.env.TMC_API_KEY || "";
const CACHE_KEY     = "wallet-tracker-cache.json";
const CACHE_TTL_MS  = 30 * 60 * 1000; // 30 min

// ── Known labeled wallets ─────────────────────────────────────────
export const KNOWN_WALLETS: Record<string, { label: string; emoji: string; category: string }> = {
  "5G62K98tpNqsaffgyJmTvDSTCEFzva8WkmMqB2CEFSDgawrS": { label: "Const",    emoji: "👑", category: "founder" },
  "5GH2aUTMRUh1RprCgH4x3tRyCaKeUi5BfmYCfs1NARA8R54n": { label: "Const #2", emoji: "👑", category: "founder" },
};

// ── Types ─────────────────────────────────────────────────────────
export interface WalletPosition {
  netuid: number;
  name?: string;
  balance_tao: number;    // TAO-equivalent stake in this subnet
  balance_usd?: number;   // USD value (balance_tao × tao_price)
}

export interface TrackedWallet {
  address: string;
  label?: string;
  emoji?: string;
  category?: string;
  total_tao: number;          // Sum of all stake positions in TAO-equivalent
  total_usd: number;          // USD value
  subnet_count: number;       // # subnets staked across
  top_position: WalletPosition | null;
  positions: WalletPosition[]; // Top 5 largest positions
  rank_by_tao: number;
  rank_by_usd: number;
  is_known: boolean;
}

interface StakeBalanceEntry {
  coldkey: { ss58: string };
  netuid: number;
  balance: string;          // nanoAlpha (raw)
  balance_as_tao: string;   // TAO-equivalent in rao (÷1e9 = TAO)
}

interface CacheData {
  wallets: TrackedWallet[];
  updatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────
async function readCache(): Promise<CacheData | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  try {
    const blob = await blobGet(CACHE_KEY, { token, access: "private" });
    if (!blob?.stream) return null;
    const reader = blob.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as CacheData;
  } catch { return null; }
}

async function writeCache(data: CacheData): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  try {
    await put(CACHE_KEY, JSON.stringify(data), {
      access: "private", token,
      addRandomSuffix: false, allowOverwrite: true,
      contentType: "application/json",
    });
  } catch { /* non-critical */ }
}

async function fetchWithKey(url: string, apiKey: string): Promise<Response> {
  return fetch(url, {
    headers: { Authorization: apiKey },
    signal: AbortSignal.timeout(15000),
    next: { revalidate: 0 },
  });
}

// ── Main handler ──────────────────────────────────────────────────
export async function GET() {
  // Check cache first
  const cached = await readCache();
  if (cached && Date.now() - new Date(cached.updatedAt).getTime() < CACHE_TTL_MS) {
    return NextResponse.json(cached);
  }

  if (!TAOSTATS_KEY) {
    return NextResponse.json({ error: "TAOSTATS_API_KEY not configured" }, { status: 500 });
  }

  // ── Fetch subnet names + prices from TaoMarketCap ──────────────
  const subnetNames  = new Map<number, string>();
  const subnetPrices = new Map<number, number>(); // USD price per alpha token
  let taoPrice = 0;

  if (TMC_API_KEY) {
    try {
      const r = await fetch("https://api.taomarketcap.com/public/v1/subnets/table/", {
        headers: { Authorization: TMC_API_KEY },
        signal: AbortSignal.timeout(10000),
      });
      if (r.ok) {
        const json = await r.json();
        const rows: { netuid: number; name?: string; subnet_name?: string; price?: number; alpha_price?: number }[] =
          json?.data ?? json ?? [];
        for (const row of rows) {
          if (row.netuid != null) {
            subnetNames.set(row.netuid, row.name ?? row.subnet_name ?? `SN${row.netuid}`);
            const price = row.price ?? row.alpha_price ?? 0;
            if (price > 0) subnetPrices.set(row.netuid, price);
          }
        }
      }
    } catch { /* non-critical */ }
  }

  // Get TAO price
  try {
    const r = await fetchWithKey(
      "https://api.taostats.io/api/price/latest/v1?asset=tao&limit=1",
      TAOSTATS_KEY
    );
    if (r.ok) {
      const j = await r.json();
      taoPrice = parseFloat(j?.data?.[0]?.price ?? "0") || 0;
    }
  } catch { /* non-critical */ }

  // ── Fetch top stake balances from TaoStats ─────────────────────
  // Try multiple endpoint candidates — TaoStats naming isn't always documented clearly
  const ENDPOINTS_TO_TRY = [
    "https://api.taostats.io/api/dtao/stake_balance/latest/v1?limit=200&order=balance_as_tao_desc",
    "https://api.taostats.io/api/stake/latest/v1?limit=200&order=balance_desc",
    "https://api.taostats.io/api/account/latest/v1?limit=200&order=balance_desc",
  ];

  const allEntries: StakeBalanceEntry[] = [];
  const endpointErrors: string[] = [];

  for (const url of ENDPOINTS_TO_TRY) {
    try {
      const r = await fetchWithKey(url, TAOSTATS_KEY);
      if (!r.ok) {
        const errBody = await r.text().catch(() => "");
        const msg = `${url.split("api.taostats.io/api")[1]?.split("?")[0]} → HTTP ${r.status}: ${errBody.slice(0, 120)}`;
        endpointErrors.push(msg);
        console.warn(`[wallet-tracker] ${msg}`);
        continue;
      }
      const j = await r.json();
      const entries: StakeBalanceEntry[] = j?.data ?? [];
      if (entries.length > 0) {
        console.log(`[wallet-tracker] Got ${entries.length} entries from ${url}`);
        allEntries.push(...entries);

        // Fetch page 2 if available
        if (j?.pagination?.total_pages > 1) {
          const r2 = await fetchWithKey(url.replace(/page=\d+/, "") + "&page=2", TAOSTATS_KEY);
          if (r2.ok) {
            const j2 = await r2.json();
            allEntries.push(...(j2?.data ?? []));
          }
        }
        break; // success — stop trying other endpoints
      }
    } catch (e) {
      const msg = `${url} → ${String(e).slice(0, 80)}`;
      endpointErrors.push(msg);
      console.error("[wallet-tracker]", msg);
    }
  }

  if (allEntries.length === 0) {
    return NextResponse.json({
      error: "No stake balance data returned from TaoStats",
      debug: endpointErrors,
    }, { status: 500 });
  }

  // ── Aggregate by coldkey ───────────────────────────────────────
  const walletMap = new Map<string, {
    total_tao: number;
    total_usd: number;
    positions: WalletPosition[];
  }>();

  for (const entry of allEntries) {
    const address = entry.coldkey?.ss58;
    if (!address) continue;

    const balanceTao = parseFloat(entry.balance_as_tao) / 1e9;
    if (balanceTao < 0.001) continue; // skip dust

    const alphaPrice = subnetPrices.get(entry.netuid) ?? 0;
    const balanceUsd = taoPrice > 0 ? balanceTao * taoPrice : 0;

    if (!walletMap.has(address)) {
      walletMap.set(address, { total_tao: 0, total_usd: 0, positions: [] });
    }
    const wallet = walletMap.get(address)!;
    wallet.total_tao += balanceTao;
    wallet.total_usd += balanceUsd;
    wallet.positions.push({
      netuid: entry.netuid,
      name: subnetNames.get(entry.netuid) ?? `SN${entry.netuid}`,
      balance_tao: balanceTao,
      balance_usd: alphaPrice > 0 ? (parseFloat(entry.balance) / 1e9) * alphaPrice : balanceUsd,
    });
  }

  // ── Sort and rank ──────────────────────────────────────────────
  const sorted = [...walletMap.entries()]
    .map(([address, data]) => ({ address, ...data }))
    .sort((a, b) => b.total_tao - a.total_tao);

  const sortedByUsd = [...sorted].sort((a, b) => b.total_usd - a.total_usd);

  const usdRankMap = new Map(sortedByUsd.map((w, i) => [w.address, i + 1]));

  const wallets: TrackedWallet[] = sorted.slice(0, 100).map((w, i) => {
    const knownInfo = KNOWN_WALLETS[w.address];
    // Sort positions by TAO value, keep top 5
    const topPositions = [...w.positions].sort((a, b) => b.balance_tao - a.balance_tao).slice(0, 5);
    return {
      address: w.address,
      label:    knownInfo?.label,
      emoji:    knownInfo?.emoji,
      category: knownInfo?.category,
      total_tao: Math.round(w.total_tao * 100) / 100,
      total_usd: Math.round(w.total_usd),
      subnet_count: w.positions.length,
      top_position: topPositions[0] ?? null,
      positions: topPositions,
      rank_by_tao: i + 1,
      rank_by_usd: usdRankMap.get(w.address) ?? i + 1,
      is_known: !!knownInfo,
    };
  });

  // Inject any known wallets that didn't make the top 100 naturally
  for (const [address, info] of Object.entries(KNOWN_WALLETS)) {
    if (!wallets.find(w => w.address === address)) {
      wallets.push({
        address,
        label:    info.label,
        emoji:    info.emoji,
        category: info.category,
        total_tao: 0, total_usd: 0, subnet_count: 0,
        top_position: null, positions: [],
        rank_by_tao: 9999, rank_by_usd: 9999,
        is_known: true,
      });
    }
  }

  const result: CacheData = { wallets, updatedAt: new Date().toISOString() };
  await writeCache(result);

  return NextResponse.json(result);
}
