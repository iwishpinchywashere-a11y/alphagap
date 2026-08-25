import { NextResponse } from "next/server";
import { getPoolHistory } from "@/lib/taostats";
import { put, get as blobGet } from "@vercel/blob";

/**
 * Last-good cache per subnet. taoFetch returns [] on a 429, and this route
 * used to pass that straight through — so the 1Y chart rendered "No price
 * data available" every time TaoStats throttled, even though we had served
 * the identical year of candles an hour earlier. Prices from last week do
 * not change; showing yesterday's copy of a year-long series is strictly
 * better than showing nothing.
 */
const CACHE_KEY = (netuid: number) => `price-history-365/${netuid}.json`;
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";

async function readCache(netuid: number): Promise<Array<{ timestamp: string; price: number }> | null> {
  try {
    const b = await blobGet(CACHE_KEY(netuid), { token: TOKEN, access: "private", abortSignal: AbortSignal.timeout(6000) });
    if (!b?.stream) return null;
    const r = b.stream.getReader(); const cs: Uint8Array[] = [];
    while (true) { const { done, value } = await r.read(); if (done) break; cs.push(value); }
    return JSON.parse(Buffer.concat(cs).toString("utf-8"));
  } catch { return null; }
}

export const dynamic = "force-dynamic";
// force-dynamic sets EVERY fetch in this route to { cache: "no-store",
// revalidate: 0 } and fetchCache to "force-no-store" (Next docs, caching
// guide). That silently killed every revalidate value in lib/taostats, so
// each request hit TaoStats live — which is what earned the 429s and the
// blank price charts. "default-cache" keeps the route dynamic while letting
// each fetch's own cache options apply again.
export const fetchCache = "default-cache";
export const maxDuration = 30;

function toIso(ts: string | number): string {
  const n = typeof ts === "number" ? ts : Number(ts);
  if (!isNaN(n) && String(ts).match(/^\d+$/)) {
    return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  }
  return String(ts);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ netuid: string }> }
) {
  const { netuid: netuidStr } = await params;
  const netuid = parseInt(netuidStr, 10);
  if (isNaN(netuid)) return NextResponse.json({ error: "Invalid netuid" }, { status: 400 });

  const raw = await getPoolHistory(netuid, 365).catch(() => []);
  let priceHistory = raw
    .map((p) => ({ timestamp: toIso(p.timestamp), price: parseFloat(p.price) }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  let stale = false;

  if (priceHistory.length >= 2) {
    // Fresh fetch succeeded — refresh the last-good copy. Fire and forget.
    if (TOKEN) {
      put(CACHE_KEY(netuid), JSON.stringify(priceHistory), {
        access: "private", addRandomSuffix: false, allowOverwrite: true, token: TOKEN, contentType: "application/json",
      }).catch(() => {});
    }
  } else {
    const cached = await readCache(netuid);
    if (cached && cached.length >= 2) {
      priceHistory = cached;
      stale = true;
      console.log(`[prices ${netuid}] TaoStats unavailable — served last-good cache (${cached.length} pts)`);
    }
  }

  return NextResponse.json({ priceHistory, stale });
}
