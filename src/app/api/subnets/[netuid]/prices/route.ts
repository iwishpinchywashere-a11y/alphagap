import { NextResponse } from "next/server";
import { getPoolHistory } from "@/lib/taostats";

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
  const priceHistory = raw
    .map((p) => ({ timestamp: toIso(p.timestamp), price: parseFloat(p.price) }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return NextResponse.json({ priceHistory });
}
