import { NextResponse, after } from "next/server";
import { getPoolHistory } from "@/lib/taostats";
import { put, get as blobGet } from "@vercel/blob";

/**
 * 1Y price history, served cache-first.
 *
 * TaoStats 429s this endpoint, and lib/taostats retries three times with
 * exponential backoff before answering — about 15 seconds, which the user sat
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
// each request hit TaoStats live — which is what earned the 429s and the
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
      // Legacy entry, no timestamp — usable, but treat as due for a refresh.
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ netuid: string }> }
) {
  const { netuid: netuidStr } = await params;
  const netuid = parseInt(netuidStr, 10);
  if (isNaN(netuid)) return NextResponse.json({ error: "Invalid netuid" }, { status: 400 });

  const cached = await readCache(netuid);
  const haveCache = !!cached && cached.points.length >= 2;

  // Fresh enough: answer from the blob, never touch TaoStats.
  if (haveCache && cached!.ageMs < CACHE_TTL_MS) {
    return NextResponse.json({ priceHistory: cached!.points, stale: false });
  }

  // Past TTL but usable: answer now, refresh after the response so nobody
  // waits on a rate-limited upstream.
  if (haveCache) {
    after(async () => {
      const fresh = await fetchUpstream(netuid);
      if (fresh.length >= 2) await writeCache(netuid, fresh);
    });
    return NextResponse.json({ priceHistory: cached!.points, stale: false });
  }

  // Cold subnet: nothing cached, so this one request pays for the fetch.
  const priceHistory = await fetchUpstream(netuid);
  if (priceHistory.length >= 2) {
    await writeCache(netuid, priceHistory);
    return NextResponse.json({ priceHistory, stale: false });
  }
  return NextResponse.json({ priceHistory, stale: true });
}
