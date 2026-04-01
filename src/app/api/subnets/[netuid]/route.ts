import { NextResponse } from "next/server";
import { get as blobGet } from "@vercel/blob";
import { getPoolHistory, getMetagraph, getSubnetIdentities, getSubnetPoolDetail } from "@/lib/taostats";
import { getTaoPrice } from "@/lib/taostats";

export const dynamic = "force-dynamic";
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ netuid: string }> }
) {
  const { netuid: netuidStr } = await params;
  const netuid = parseInt(netuidStr, 10);
  if (isNaN(netuid)) return NextResponse.json({ error: "Invalid netuid" }, { status: 400 });

  const token = process.env.BLOB_READ_WRITE_TOKEN || "";

  // ── Load blobs + TaoStats in parallel ───────────────────────────
  const [scanLatest, scoreHistoryAll, emissionHistory, signalsHistory, identities, taoPrice, poolDetail, priceHistory, metagraph] = await Promise.all([
    readBlob<Record<string, unknown>>("scan-latest.json", token),
    readBlob<Record<string, Record<string, { agap: number; flow: number; dev: number; eval: number; social: number; price: number; mcap: number; emission_pct: number }>>>("subnet-scores-history.json", token),
    readBlob<Record<string, Array<{ pct: number; timestamp: string }>>>("emission-history.json", token),
    readBlob<Array<{ netuid: number; strength: number; signal_type: string; title: string; description: string; source: string; source_url?: string; signal_date?: string; created_at: string; subnet_name?: string }>>("signals-history.json", token),
    getSubnetIdentities().catch(() => []),
    getTaoPrice().catch(() => 0),
    getSubnetPoolDetail(netuid).catch(() => null),
    getPoolHistory(netuid, 365).catch(() => []),
    getMetagraph(netuid).catch(() => []),
  ]);

  // ── Current leaderboard entry ───────────────────────────────────
  const leaderboard = (scanLatest?.leaderboard as Array<Record<string, unknown>>) || [];
  const current = leaderboard.find((e) => e.netuid === netuid) || null;

  // ── Subnet identity ─────────────────────────────────────────────
  const identity = identities.find((id) => id.netuid === netuid) || null;

  // ── Score history ───────────────────────────────────────────────
  type ScoreRow = { agap: number; flow: number; dev: number; eval: number; social: number; price: number; mcap: number; emission_pct: number };
  const scoreHistory: Array<{ date: string } & ScoreRow> = [];
  if (scoreHistoryAll) {
    for (const date of Object.keys(scoreHistoryAll).sort()) {
      const row = scoreHistoryAll[date][String(netuid)];
      if (row) scoreHistory.push({ date, ...row });
    }
  }

  // ── Emission history ─────────────────────────────────────────────
  const emissionData = (emissionHistory?.[String(netuid)] || [])
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // ── Signals ──────────────────────────────────────────────────────
  const subnetSignals = (signalsHistory || [])
    .filter((s) => s.netuid === netuid)
    .sort((a, b) => new Date(b.signal_date || b.created_at).getTime() - new Date(a.signal_date || a.created_at).getTime())
    .slice(0, 20);

  // ── Price history (1Y daily, chronological) ──────────────────────
  const priceData = [...priceHistory]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((p) => ({ timestamp: p.timestamp, price: parseFloat(p.price) }));

  // ── 7D intraday (4h candles from poolDetail.seven_day_prices) ───
  const sevenDayPrices = (poolDetail?.seven_day_prices || [])
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((p) => ({ timestamp: p.timestamp, price: parseFloat(p.price) }));

  // ── Metagraph ────────────────────────────────────────────────────
  const validators = metagraph.filter((n) => n.validator_permit).length;
  const miners = metagraph.filter((n) => !n.validator_permit).length;

  // ── Market stats (computed from poolDetail + taoPrice) ──────────
  const pool = poolDetail;
  const marketStats = pool ? {
    priceUsd: parseFloat(pool.price) * taoPrice,
    priceChangePct1h: parseFloat(pool.price_change_1_hour || "0"),
    priceChangePct24h: parseFloat(pool.price_change_1_day || "0"),
    priceChangePct7d: parseFloat(pool.price_change_1_week || "0"),
    priceChangePct30d: parseFloat(pool.price_change_1_month || "0"),
    marketCapUsd: parseFloat(pool.market_cap) / RAO * taoPrice,
    fdvUsd: parseFloat(pool.market_cap) / RAO * taoPrice, // same as mcap for now
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
    emissionHistory: emissionData,
    priceHistory: priceData,
    sevenDayPrices,
    marketStats,
    signals: subnetSignals,
    metagraph: { validators, miners, totalNeurons: metagraph.length },
    lastScan: scanLatest?.lastScan || null,
  });
}
