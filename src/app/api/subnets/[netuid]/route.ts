import { NextResponse, after } from "next/server";
import { get as blobGet, put } from "@vercel/blob";
import { getSubnetPoolDetail, type SubnetIdentity, type SubnetPoolDetail } from "@/lib/taostats";
import { fetchTaoUsdDaily, taoSeriesToUsd, readPriceDaily, dailySeries } from "@/lib/market-data";

/**
 * GET /api/subnets/[netuid] - everything the subnet detail page draws.
 *
 * MARKET NUMBERS COME FROM market-latest.json, written by the scan from a
 * direct read of the Bittensor chain (lib/market-data). This route used to call
 * TaoStats four times per page view (identity, TAO price, pool detail,
 * metagraph). That drained the account's credits, and when they ran out each
 * of those calls could hand back days-old data that the page showed as live.
 *
 * The only TaoStats call left is pool detail, for the Fear & Greed index, which
 * has no chain equivalent. It is cached per subnet for an hour and used only if
 * its own row timestamp is recent. Without it the card simply does not render.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const HOUR = 3600_000;

async function readBlob<T>(name: string, token: string): Promise<T | null> {
  try {
    const result = await blobGet(name, { token, access: "private", abortSignal: AbortSignal.timeout(10_000) });
    if (!result?.stream) return null;
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch { return null; }
}

interface MarketRow {
  priceTao: number; priceUsd: number; marketCapUsd: number;
  change1h: number; change24h: number; change7d: number; change30d: number;
  volume24hUsd: number; netFlow24hTao: number | null;
  circulatingSupply: number; alphaInPool: number; alphaStaked: number;
  emissionPct: number | null; validators: number | null; neurons: number | null;
  symbol: string;
  buys24h: number | null; sells24h: number | null; buyers24h: number | null; sellers24h: number | null;
}
interface MarketLatest {
  source: string; observedAt: string; block: number | null; taoUsd: number;
  subnets: Record<string, MarketRow>;
}

type ScoreRow = { agap: number; flow: number; dev: number; eval: number; social: number; price?: number; mcap?: number; emission_pct?: number };
type PricePoint = { timestamp: string; price: number };

/**
 * Fear & Greed only, cached an hour per subnet. The row must carry a recent
 * timestamp of its own: a 200 from TaoStats is not proof of freshness, which
 * is exactly the assumption that let stale prices through before.
 */
async function fearGreed(netuid: number, token: string): Promise<{ index: number; sentiment: string } | null> {
  const key = `pool-detail-cache/${netuid}.json`;
  const cached = await readBlob<{ savedAt: string; index: number; sentiment: string }>(key, token);
  if (cached && Date.now() - new Date(cached.savedAt).getTime() < HOUR) {
    return cached.index > 0 ? { index: cached.index, sentiment: cached.sentiment } : null;
  }
  const refresh = async (): Promise<{ index: number; sentiment: string } | null> => {
    const d: SubnetPoolDetail | null = await getSubnetPoolDetail(netuid).catch(() => null);
    if (!d?.timestamp || Date.now() - new Date(d.timestamp).getTime() > 30 * 60_000) return null;
    const out = { index: parseFloat(d.fear_and_greed_index || "0"), sentiment: d.fear_and_greed_sentiment || "" };
    await put(key, JSON.stringify({ savedAt: new Date().toISOString(), ...out }), {
      access: "private", addRandomSuffix: false, allowOverwrite: true, token, contentType: "application/json",
    }).catch(() => {});
    return out.index > 0 ? out : null;
  };
  if (cached) {
    // Stale cache: never shown (a sentiment reading from yesterday is not
    // today's), but refresh after responding so the next view has it.
    after(refresh);
    return null;
  }
  return Promise.race([refresh(), new Promise<null>(r => setTimeout(() => r(null), 3_000))]);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ netuid: string }> }
) {
  const { netuid: netuidStr } = await params;
  const netuid = parseInt(netuidStr, 10);
  if (isNaN(netuid)) return NextResponse.json({ error: "Invalid netuid" }, { status: 400 });

  const token = process.env.BLOB_READ_WRITE_TOKEN || "";

  const [
    scanLatest, scoreHistoryAll, emissionHistory, signalsHistory, flowHistoryAll,
    identities, market, priceDaily, fg, taoUsdDaily,
  ] = await Promise.all([
    readBlob<Record<string, unknown>>("scan-latest.json", token),
    readBlob<Record<string, Record<string, ScoreRow>>>("subnet-scores-history.json", token),
    readBlob<Record<string, Array<{ pct: number; timestamp: string }>>>("emission-history.json", token),
    readBlob<Array<{ netuid: number; strength: number; signal_type: string; title: string; description: string; source: string; source_url?: string; signal_date?: string; created_at: string; subnet_name?: string }>>("signals-history.json", token),
    readBlob<Record<string, Record<string, number>>>("flow-history.json", token),
    readBlob<SubnetIdentity[]>("identity-cache.json", token),
    readBlob<MarketLatest>("market-latest.json", token),
    // Daily closes read from chain state, a year deep. Fills the 3M chart's
    // range older than our hourly series without any TaoStats call.
    readPriceDaily(token),
    fearGreed(netuid, token),
    fetchTaoUsdDaily(token),
  ]);

  const leaderboard = (scanLatest?.leaderboard as Array<Record<string, unknown>>) || [];
  const current = leaderboard.find((e) => e.netuid === netuid) || null;
  const identity = (identities || []).find((id) => id.netuid === netuid) || null;
  const live = market?.subnets?.[String(netuid)] ?? null;
  const taoPrice = market?.taoUsd || Number(scanLatest?.taoPrice) || 0;
  const nowIso = market?.observedAt || new Date().toISOString();

  // ── Score history ────────────────────────────────────────────────
  const scoreHistory: Array<{ date: string; rank?: number } & ScoreRow> = [];
  if (scoreHistoryAll) {
    for (const ts of Object.keys(scoreHistoryAll).sort()) {
      const snapshot = scoreHistoryAll[ts];
      const row = snapshot[String(netuid)];
      if (!row) continue;
      const allAgap = Object.values(snapshot).map(r => r.agap).sort((a, b) => b - a);
      const rank = allAgap.indexOf(row.agap) + 1 || undefined;
      scoreHistory.push({ date: ts, rank, ...row });
    }
  }

  // ── aGap rank history, best rank per day ─────────────────────────
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

  const emissionData = (emissionHistory?.[String(netuid)] || [])
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const subnetSignals = (signalsHistory || [])
    .filter((s) => s.netuid === netuid)
    .sort((a, b) => new Date(b.signal_date || b.created_at).getTime() - new Date(a.signal_date || a.created_at).getTime())
    .slice(0, 20);

  // ── TAO flow EMA history, thinned by age ─────────────────────────
  // The chart's widest view is 3M and it downsamples to 200 points, so each
  // window keeps more points than it can draw while the payload stays small.
  const flowRaw: { x: string; y: number }[] = [];
  if (flowHistoryAll) {
    for (const ts of Object.keys(flowHistoryAll).sort()) {
      const val = flowHistoryAll[ts][String(netuid)];
      if (val != null) flowRaw.push({ x: ts, y: val });
    }
  }
  const nowMs = Date.now();
  const flowTiers: Array<[number, number]> = [[1, 1], [7, 6], [30, 25], [90, 90]];
  const flowHistory = flowRaw.filter((p, i) => {
    const ageDays = (nowMs - new Date(p.x).getTime()) / 86400000;
    if (i === flowRaw.length - 1) return true;
    const tier = flowTiers.find(([maxAge]) => ageDays <= maxAge);
    if (!tier) return false;
    return i % tier[1] === 0;
  });

  // ── Price history (USD) ──────────────────────────────────────────
  // Our own hourly series is the spine. The scan only records a price when it
  // came from a fresh chain read, so gaps mean "not observed", never "flat".
  const own: PricePoint[] = [];
  if (scoreHistoryAll) {
    for (const ts of Object.keys(scoreHistoryAll).sort()) {
      const px = scoreHistoryAll[ts]?.[String(netuid)]?.price;
      if (typeof px === "number" && px > 0) own.push({ timestamp: ts, price: px });
    }
  }
  // Older than our first own point, use the chain daily archive.
  const yearPts: PricePoint[] = dailySeries(priceDaily, netuid);
  const firstOwn = own[0]?.timestamp ?? nowIso;
  const cutoff90 = new Date(nowMs - 92 * 86400000).toISOString();
  // The archive is in TAO; ours is in USD. Convert at each day's own rate.
  const older = taoSeriesToUsd(
    yearPts.filter(p => p.timestamp >= cutoff90 && p.timestamp < firstOwn && p.price > 0),
    taoUsdDaily, taoPrice,
  );
  const priceHistory: PricePoint[] = [...older, ...own];
  // End every series at the live price, so the chart's last point is now and
  // not whenever the last hourly snapshot happened to land.
  if (live?.priceUsd && live.priceUsd > 0) {
    const lastTs = priceHistory.at(-1)?.timestamp ?? "";
    if (nowIso > lastTs) priceHistory.push({ timestamp: nowIso, price: live.priceUsd });
  }

  // 1D and 7D. These used TaoStats' 4-hour candles and, when those were
  // missing, fell back to "the last two daily candles": a single straight line.
  // Our own hourly series is denser than the candles ever were.
  const sevenDayPrices = priceHistory.filter(p => p.timestamp >= new Date(nowMs - 7 * 86400000).toISOString());
  const last24 = priceHistory.filter(p => p.timestamp >= new Date(nowMs - 86400000).toISOString()).map(p => p.price);

  const marketStats = live ? {
    priceUsd: live.priceUsd,
    priceChangePct1h: live.change1h,
    priceChangePct24h: live.change24h,
    priceChangePct7d: live.change7d,
    priceChangePct30d: live.change30d,
    marketCapUsd: live.marketCapUsd,
    fdvUsd: live.marketCapUsd,
    volume24hUsd: live.volume24hUsd,
    high24hUsd: last24.length ? Math.max(...last24) : live.priceUsd,
    low24hUsd: last24.length ? Math.min(...last24) : live.priceUsd,
    circulatingSupply: live.circulatingSupply,
    alphaInPool: live.alphaInPool,
    alphaStaked: live.alphaStaked,
    buys24h: live.buys24h ?? null,
    sells24h: live.sells24h ?? null,
    buyers24h: live.buyers24h ?? null,
    sellers24h: live.sellers24h ?? null,
    fearGreedIndex: fg?.index ?? 0,
    fearGreedSentiment: fg?.sentiment ?? "",
    symbol: live.symbol,
    taoPrice,
    priceTao: live.priceTao,
  } : null;

  // The header shows the live figure; keep `current` (the leaderboard row) in
  // step with it so no part of the page disagrees with another.
  const currentLive = current && live ? {
    ...current,
    alpha_price: live.priceUsd,
    market_cap: live.marketCapUsd,
    price_change_1h: live.change1h,
    price_change_24h: live.change24h,
    price_change_7d: live.change7d,
    price_change_30d: live.change30d,
  } : current;

  const validators = live?.validators ?? 0;
  const neurons = live?.neurons ?? 0;

  return NextResponse.json({
    netuid,
    name: (current?.name as string) || identity?.subnet_name || `Subnet ${netuid}`,
    identity: identity ? {
      description: identity.description,
      summary: identity.summary,
      github_repo: identity.github_repo,
      twitter: identity.twitter,
      discord: identity.discord,
      website: identity.subnet_url,
      tags: identity.tags,
    } : null,
    current: currentLive,
    scoreHistory,
    rankHistory,
    emissionHistory: emissionData,
    priceHistory,
    sevenDayPrices,
    marketStats,
    signals: subnetSignals,
    metagraph: { validators, miners: Math.max(0, neurons - validators), totalNeurons: neurons },
    flowHistory,
    lastScan: scanLatest?.lastScan || null,
    marketObservedAt: market?.observedAt ?? null,
    marketSource: market?.source ?? null,
  });
}
