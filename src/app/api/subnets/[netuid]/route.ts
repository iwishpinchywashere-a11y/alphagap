import { NextResponse } from "next/server";
import { get as blobGet } from "@vercel/blob";
import { getPoolHistory, getMetagraph, getSubnetIdentities, getSubnetPoolDetail } from "@/lib/taostats";
import { getTaoPrice } from "@/lib/taostats";

export const dynamic = "force-dynamic";
// force-dynamic sets EVERY fetch in this route to { cache: "no-store",
// revalidate: 0 } and fetchCache to "force-no-store" (Next docs, caching
// guide). That silently killed every revalidate value in lib/taostats, so
// each request hit TaoStats live — which is what earned the 429s and the
// blank price charts. "default-cache" keeps the route dynamic while letting
// each fetch's own cache options apply again.
export const fetchCache = "default-cache";
export const maxDuration = 60;

const RAO = 1e9;

async function readBlob<T>(name: string, token: string): Promise<T | null> {
  try {
    const result = await blobGet(name, { token, access: "private" });
    if (!result?.stream) return null;
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch { return null; }
}

// Normalise a TaoStats timestamp to ISO string.
// pool/history returns timestamps as unix-second integers (e.g. 1712345678).
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

  const token = process.env.BLOB_READ_WRITE_TOKEN || "";

  // ── Fetch everything in parallel ─────────────────────────────────
  // priceHistory92 = 92 days (~100 rows). Fast enough to always include.
  // This guarantees 1M and 3M charts have data on first load with no lag.
  // The /prices?period=365 endpoint handles 1Y lazy-load on the client.
  const [
    scanLatest, scoreHistoryAll, emissionHistory, signalsHistory, flowHistoryAll,
    identities, taoPrice, poolDetail, metagraph,
  ] = await Promise.all([
    readBlob<Record<string, unknown>>("scan-latest.json", token),
    readBlob<Record<string, Record<string, { agap: number; flow: number; dev: number; eval: number; social: number; price: number; mcap: number; emission_pct: number }>>>("subnet-scores-history.json", token),
    readBlob<Record<string, Array<{ pct: number; timestamp: string }>>>("emission-history.json", token),
    readBlob<Array<{ netuid: number; strength: number; signal_type: string; title: string; description: string; source: string; source_url?: string; signal_date?: string; created_at: string; subnet_name?: string }>>("signals-history.json", token),
    readBlob<Record<string, Record<string, number>>>("flow-history.json", token),
    getSubnetIdentities().catch(() => []),
    getTaoPrice().catch(() => 0),
    getSubnetPoolDetail(netuid).catch(() => null),
    getMetagraph(netuid).catch(() => []),
  ]);

  // ── Current leaderboard entry ───────────────────────────────────
  const leaderboard = (scanLatest?.leaderboard as Array<Record<string, unknown>>) || [];
  const current = leaderboard.find((e) => e.netuid === netuid) || null;

  // ── Subnet identity ─────────────────────────────────────────────
  const identity = identities.find((id) => id.netuid === netuid) || null;

  // ── Score history (per-scan ISO timestamps) ──────────────────────
  type ScoreRow = { agap: number; flow: number; dev: number; eval: number; social: number; price: number; mcap: number; emission_pct: number };
  const scoreHistory: Array<{ date: string; rank?: number } & ScoreRow> = [];
  if (scoreHistoryAll) {
    for (const ts of Object.keys(scoreHistoryAll).sort()) {
      const snapshot = scoreHistoryAll[ts];
      const row = snapshot[String(netuid)];
      if (!row) continue;
      // Compute rank: position among all subnets sorted by agap desc (best = 1)
      const allAgap = Object.values(snapshot).map(r => r.agap).sort((a, b) => b - a);
      const rank = allAgap.indexOf(row.agap) + 1 || undefined;
      scoreHistory.push({ date: ts, rank, ...row });
    }
  }

  // ── aGap Rank history — best (lowest) rank per calendar day ────────
  const rankByDay = new Map<string, number>();
  for (const row of scoreHistory) {
    if (row.rank == null) continue;
    const day = row.date.slice(0, 10);
    const prev = rankByDay.get(day);
    if (prev == null || row.rank < prev) rankByDay.set(day, row.rank);
  }
  const rankHistory = [...rankByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rank]) => ({ date, rank }));

  // ── Emission history ─────────────────────────────────────────────
  const emissionData = (emissionHistory?.[String(netuid)] || [])
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // ── Signals ──────────────────────────────────────────────────────
  const subnetSignals = (signalsHistory || [])
    .filter((s) => s.netuid === netuid)
    .sort((a, b) => new Date(b.signal_date || b.created_at).getTime() - new Date(a.signal_date || a.created_at).getTime())
    .slice(0, 20);

  // ── TAO Flow EMA history (from TaoMarketCap, per-scan snapshots) ──
  // flowHistoryAll is { [isoTs]: { [netuid]: taoFlowInTao } }
  // Extract this subnet's series, sorted chronologically.
  const flowHistory: { x: string; y: number }[] = [];
  if (flowHistoryAll) {
    for (const ts of Object.keys(flowHistoryAll).sort()) {
      const val = flowHistoryAll[ts][String(netuid)];
      if (val != null) flowHistory.push({ x: ts, y: val });
    }
  }

  // ── Price history (92d daily, chronological) ─────────────────────
  //
  // TaoStats rate-limits this endpoint. A 429 makes priceHistory92 come back
  // empty and the chart renders "No price data available" — intermittently,
  // which is why 7D sometimes worked and 1M/3M usually did not. The header
  // percentages kept showing because they come from cached pool data, so the
  // page looked half-broken rather than obviously down.
  //
  // We already store a price per subnet in subnet-scores-history.json, and
  // this route already loads it for the score chart. Fall back to our own copy
  // rather than showing an empty chart: it is the same series, sampled hourly
  // for the last week and daily before that.
  // OUR OWN HISTORY FIRST, TaoStats only as a backstop.
  //
  // This used to call getPoolHistory(netuid, 92) on EVERY page view, asking
  // TaoStats for 92 days of candles per visitor. That is what earned the
  // 429s: priceHistory came back empty and the chart rendered "No price data
  // available" while the header percentages, which come from cached pool
  // data, kept working — so the page looked half-broken rather than down.
  //
  // We already write a price per subnet on every scan and this route already
  // loads that blob for the score chart. Serving it first makes the common
  // path free, instant, and immune to upstream throttling. TaoStats is now
  // only touched when our own series is too thin to draw, which is a handful
  // of newly registered subnets rather than every visitor.
  let priceHistory: Array<{ timestamp: string; price: number }> = [];
  if (scoreHistoryAll) {
    for (const ts of Object.keys(scoreHistoryAll).sort()) {
      const px = scoreHistoryAll[ts]?.[String(netuid)]?.price;
      if (typeof px === "number" && px > 0) priceHistory.push({ timestamp: ts, price: px });
    }
  }

  // Our own archive only starts 2026-07-08, so it cannot fill a 3M chart yet.
  // Preferring it unconditionally (as this did) silently served ~48 days
  // wherever 92 were needed, which is why 3M looked broken rather than short.
  // Fetch upstream whenever ours does not actually span the range the page
  // draws, and keep whichever series is longer.
  const spanDays = priceHistory.length >= 2
    ? (new Date(priceHistory[priceHistory.length - 1].timestamp).getTime() -
       new Date(priceHistory[0].timestamp).getTime()) / 86400000
    : 0;

  if (priceHistory.length < 2 || spanDays < 85) {
    const upstream = (await getPoolHistory(netuid, 92).catch(() => []))
      .map((p) => ({ timestamp: toIso(p.timestamp), price: parseFloat(p.price) }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    if (upstream.length > priceHistory.length) {
      console.log(`[subnet ${netuid}] using TaoStats (${upstream.length} pts) over own history (${priceHistory.length} pts, ${spanDays.toFixed(0)}d)`);
      priceHistory = upstream;
    } else if (upstream.length) {
      console.log(`[subnet ${netuid}] kept own history (${priceHistory.length} pts) — upstream returned ${upstream.length}`);
    }
  }

  // ── 7D intraday (4h candles from poolDetail.seven_day_prices) ───
  const sevenDayPrices = (poolDetail?.seven_day_prices || [])
    .map((p) => ({ timestamp: toIso(p.timestamp), price: parseFloat(p.price) }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // ── Metagraph ────────────────────────────────────────────────────
  const validators = metagraph.filter((n) => n.validator_permit).length;
  const miners = metagraph.filter((n) => !n.validator_permit).length;

  // ── Market stats ─────────────────────────────────────────────────
  const pool = poolDetail;
  const marketStats = pool ? {
    priceUsd: parseFloat(pool.price) * taoPrice,
    priceChangePct1h: parseFloat(pool.price_change_1_hour || "0"),
    priceChangePct24h: parseFloat(pool.price_change_1_day || "0"),
    priceChangePct7d: parseFloat(pool.price_change_1_week || "0"),
    priceChangePct30d: parseFloat(pool.price_change_1_month || "0"),
    marketCapUsd: parseFloat(pool.market_cap) / RAO * taoPrice,
    fdvUsd: parseFloat(pool.market_cap) / RAO * taoPrice,
    volume24hUsd: parseFloat(pool.tao_volume_24_hr) / RAO * taoPrice,
    high24hUsd: parseFloat(pool.highest_price_24_hr || "0") * taoPrice,
    low24hUsd: parseFloat(pool.lowest_price_24_hr || "0") * taoPrice,
    circulatingSupply: parseFloat(pool.total_alpha) / RAO,
    alphaInPool: parseFloat(pool.alpha_in_pool) / RAO,
    alphaStaked: parseFloat(pool.alpha_staked) / RAO,
    buys24h: pool.buys_24_hr,
    sells24h: pool.sells_24_hr,
    buyers24h: pool.buyers_24_hr,
    sellers24h: pool.sellers_24_hr,
    fearGreedIndex: parseFloat(pool.fear_and_greed_index || "0"),
    fearGreedSentiment: pool.fear_and_greed_sentiment || "",
    symbol: pool.symbol,
    taoPrice,
  } : null;

  return NextResponse.json({
    netuid,
    name: current?.name || identity?.subnet_name || poolDetail?.name || `Subnet ${netuid}`,
    identity: identity ? {
      description: identity.description,
      summary: identity.summary,
      github_repo: identity.github_repo,
      twitter: identity.twitter,
      discord: identity.discord,
      website: identity.subnet_url,
      tags: identity.tags,
    } : null,
    current,
    scoreHistory,
    rankHistory,
    emissionHistory: emissionData,
    priceHistory,      // 92 days, always present
    sevenDayPrices,    // 7d 4h candles, always present
    marketStats,
    signals: subnetSignals,
    metagraph: { validators, miners, totalNeurons: metagraph.length },
    flowHistory,
    lastScan: scanLatest?.lastScan || null,
  });
}
