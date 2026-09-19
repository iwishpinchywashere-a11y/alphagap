import { NextResponse, after } from "next/server";
import { getPoolHistory } from "@/lib/taostats";
import { put, get as blobGet } from "@vercel/blob";
import { fetchTaoUsdDaily, taoSeriesToUsd, readPriceDaily, dailySeries } from "@/lib/market-data";

/**
 * 1Y price history, served cache-first.
 *
 * TaoStats 429s this endpoint, and lib/taostats retries three times with
 * exponential backoff before answering - about 15 seconds, which the user sat
 * through as "Loading 1Y price history...". The route already kept a last-good
 * copy per subnet, but only consulted it AFTER the slow upstream call failed,
 * so the cache never actually spared anyone the wait.
 *
 * Now the cache is the primary source: a year of daily candles barely changes,
 * so within the TTL we answer from the blob and never touch TaoStats. Past the
 * TTL we still answer from the blob and refresh after the response via after().
 * Only a subnet we have never cached blocks on a live fetch.
 */
const CACHE_KEY = (netuid: number) => `price-history-365/${netuid}.json`;
const CACHE_TTL_MS = 6 * 3600_000;
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";

export const dynamic = "force-dynamic";
// force-dynamic sets EVERY fetch in this route to { cache: "no-store",
// revalidate: 0 } and fetchCache to "force-no-store" (Next docs, caching
// guide). That silently killed every revalidate value in lib/taostats, so
// each request hit TaoStats live - which is what earned the 429s and the
// blank price charts. "default-cache" keeps the route dynamic while letting
// each fetch's own cache options apply again.
export const fetchCache = "default-cache";
export const maxDuration = 30;

type PricePoint = { timestamp: string; price: number };
type CacheShape = PricePoint[] | { fetchedAt: string; priceHistory: PricePoint[] };

function toIso(ts: string | number): string {
  const n = typeof ts === "number" ? ts : Number(ts);
  if (!isNaN(n) && String(ts).match(/^\d+$/)) {
    return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  }
  return String(ts);
}

/** Cached series plus its age. Accepts the legacy bare-array entries. */
async function readCache(netuid: number): Promise<{ points: PricePoint[]; ageMs: number } | null> {
  try {
    const b = await blobGet(CACHE_KEY(netuid), { token: TOKEN, access: "private", abortSignal: AbortSignal.timeout(6000) });
    if (!b?.stream) return null;
    const r = b.stream.getReader(); const cs: Uint8Array[] = [];
    while (true) { const { done, value } = await r.read(); if (done) break; cs.push(value); }
    const parsed = JSON.parse(Buffer.concat(cs).toString("utf-8")) as CacheShape;
    if (Array.isArray(parsed)) {
      // Legacy entry, no timestamp - usable, but treat as due for a refresh.
      return { points: parsed, ageMs: Number.POSITIVE_INFINITY };
    }
    if (!Array.isArray(parsed?.priceHistory)) return null;
    return { points: parsed.priceHistory, ageMs: Date.now() - new Date(parsed.fetchedAt).getTime() };
  } catch { return null; }
}

async function fetchUpstream(netuid: number): Promise<PricePoint[]> {
  const raw = await getPoolHistory(netuid, 365).catch(() => []);
  return raw
    .map((p) => ({ timestamp: toIso(p.timestamp), price: parseFloat(p.price) }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

async function writeCache(netuid: number, points: PricePoint[]): Promise<void> {
  if (!TOKEN || points.length < 2) return;
  await put(CACHE_KEY(netuid), JSON.stringify({ fetchedAt: new Date().toISOString(), priceHistory: points }), {
    access: "private", addRandomSuffix: false, allowOverwrite: true, token: TOKEN, contentType: "application/json",
  }).catch(() => {});
}

/**
 * The cache and TaoStats both hold TAO-denominated prices, but every other
 * chart timeframe draws USD. The 1Y chart plotted the raw TAO values, so its
 * axis disagreed with 1D-3M. Convert at each day's TAO/USD close on the way
 * out; the cache stays in TAO so a rate source outage never corrupts it.
 */
async function asUsd(points: PricePoint[], netuid: number): Promise<PricePoint[]> {
  const daily = await fetchTaoUsdDaily(TOKEN);
  const latest = [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).at(-1)?.[1] ?? 0;
  const usd = daily.size === 0 ? points : taoSeriesToUsd(points, daily, latest);
  return extendToToday(usd, netuid);
}

/**
 * Whatever the source, run the series to today. An older TaoStats cache can
 * end months back (SN28's stopped at 2026-03-29), which drew a 1Y chart that
 * simply ended. Past its last point, append our own chain-verified history
 * (already USD), one close per day.
 */
async function extendToToday(points: PricePoint[], netuid: number): Promise<PricePoint[]> {
  const lastTs = points.at(-1)?.timestamp ?? "";
  try {
    const b = await blobGet("subnet-scores-history.json", { token: TOKEN, access: "private", abortSignal: AbortSignal.timeout(10_000) });
    if (!b?.stream) return points;
    const r = b.stream.getReader(); const cs: Uint8Array[] = [];
    while (true) { const { done, value } = await r.read(); if (done) break; cs.push(value); }
    const hist = JSON.parse(Buffer.concat(cs).toString("utf-8")) as Record<string, Record<string, { price?: number }>>;
    const closes = new Map<string, PricePoint>();
    for (const ts of Object.keys(hist).sort()) {
      const px = hist[ts]?.[String(netuid)]?.price;
      if (typeof px === "number" && px > 0 && ts > lastTs) closes.set(ts.slice(0, 10), { timestamp: ts, price: px });
    }
    return [...points, ...closes.values()];
  } catch { return points; }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ netuid: string }> }
) {
  const { netuid: netuidStr } = await params;
  const netuid = parseInt(netuidStr, 10);
  if (isNaN(netuid)) return NextResponse.json({ error: "Invalid netuid" }, { status: 400 });

  // Chain-derived daily closes first: a year deep, backfilled from the
  // archive node and kept current by the scan. The TaoStats path below only
  // runs if the archive is missing, e.g. for a subnet registered today.
  const archive = dailySeries(await readPriceDaily(TOKEN), netuid);
  const cached = await readCache(netuid);
  if (archive.length >= 30) {
    // The chain archive fills in over a couple of days (one old day per scan).
    // Until it reaches a year, the older range comes from the TaoStats cache.
    const firstChain = archive[0].timestamp;
    const older = (cached?.points ?? []).filter(p => p.timestamp < firstChain);
    return NextResponse.json({ priceHistory: await asUsd([...older, ...archive], netuid), stale: false, unit: "usd", source: older.length ? "chain+cache" : "chain" });
  }

  const haveCache = !!cached && cached.points.length >= 2;

  // Fresh enough: answer from the blob, never touch TaoStats.
  if (haveCache && cached!.ageMs < CACHE_TTL_MS) {
    return NextResponse.json({ priceHistory: await asUsd(cached!.points, netuid), stale: false, unit: "usd" });
  }

  // Past TTL but usable: answer now, refresh after the response so nobody
  // waits on a rate-limited upstream.
  if (haveCache) {
    after(async () => {
      const fresh = await fetchUpstream(netuid);
      if (fresh.length >= 2) await writeCache(netuid, fresh);
    });
    return NextResponse.json({ priceHistory: await asUsd(cached!.points, netuid), stale: false, unit: "usd" });
  }

  // Cold subnet: nothing cached, so this one request pays for the fetch.
  const priceHistory = await fetchUpstream(netuid);
  if (priceHistory.length >= 2) {
    await writeCache(netuid, priceHistory);
    return NextResponse.json({ priceHistory: await asUsd(priceHistory, netuid), stale: false, unit: "usd" });
  }
  return NextResponse.json({ priceHistory: await asUsd(priceHistory, netuid), stale: true, unit: "usd" });
}
