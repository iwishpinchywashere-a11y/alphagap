import { NextResponse } from "next/server";
import { get as blobGet } from "@vercel/blob";
import { getPoolHistory, getMetagraph, getSubnetIdentities, getSubnetEmissionHistory } from "@/lib/taostats";

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

  // ── Load blobs in parallel ───────────────────────────────────────
  const [scanLatest, scoreHistoryAll, emissionHistory, signalsHistory, identities] = await Promise.all([
    readBlob<Record<string, unknown>>("scan-latest.json", token),
    readBlob<Record<string, Record<string, { agap: number; flow: number; dev: number; eval: number; social: number; price: number; mcap: number; emission_pct: number }>>>("subnet-scores-history.json", token),
    readBlob<Record<string, Array<{ pct: number; timestamp: string }>>>("emission-history.json", token),
    readBlob<Array<{ netuid: number; strength: number; signal_type: string; title: string; description: string; source: string; source_url?: string; signal_date?: string; created_at: string; subnet_name?: string }>>("signals-history.json", token),
    getSubnetIdentities().catch(() => []),
  ]);

  // ── Current leaderboard entry ───────────────────────────────────
  const leaderboard = (scanLatest?.leaderboard as Array<Record<string, unknown>>) || [];
  const current = leaderboard.find((e) => e.netuid === netuid) || null;

  // ── Subnet identity ─────────────────────────────────────────────
  const identity = identities.find((id) => id.netuid === netuid) || null;

  // ── Score history — extract per-subnet across all dates ─────────
  type ScoreRow = { agap: number; flow: number; dev: number; eval: number; social: number; price: number; mcap: number; emission_pct: number };
  const scoreHistory: Array<{ date: string } & ScoreRow> = [];
  if (scoreHistoryAll) {
    const dates = Object.keys(scoreHistoryAll).sort();
    for (const date of dates) {
      const row = scoreHistoryAll[date][String(netuid)];
      if (row) scoreHistory.push({ date, ...row });
    }
  }

  // ── Emission history for this subnet ────────────────────────────
  const emissionData = (emissionHistory?.[String(netuid)] || [])
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // ── Signals for this subnet (last 14 days) ──────────────────────
  const subnetSignals = (signalsHistory || [])
    .filter((s) => s.netuid === netuid)
    .sort((a, b) => new Date(b.signal_date || b.created_at).getTime() - new Date(a.signal_date || a.created_at).getTime())
    .slice(0, 20);

  // ── Live data from TaoStats (in parallel) ───────────────────────
  const [priceHistory, metagraph] = await Promise.all([
    getPoolHistory(netuid, 365).catch(() => []),  // full year
    getMetagraph(netuid).catch(() => []),
  ]);

  // Process price history (reverse to chronological order)
  const priceData = [...priceHistory]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((p) => ({
      timestamp: p.timestamp,
      price: parseFloat(p.price),
      market_cap: parseFloat(p.market_cap) / RAO,
      volume: parseFloat(p.tao_volume_24_hr) / RAO,
    }));

  // Process metagraph — count validators vs miners
  const validators = metagraph.filter((n) => n.validator_permit).length;
  const miners = metagraph.filter((n) => !n.validator_permit).length;
  const totalNeurons = metagraph.length;

  return NextResponse.json({
    netuid,
    name: current?.name || identity?.subnet_name || `Subnet ${netuid}`,
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
    signals: subnetSignals,
    metagraph: {
      validators,
      miners,
      totalNeurons,
    },
    lastScan: scanLatest?.lastScan || null,
  });
}
