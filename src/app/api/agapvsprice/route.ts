import { NextResponse } from "next/server";
import { get as blobGet } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type ScoreRow = {
  agap: number; flow: number; dev: number; eval: number;
  social: number; price: number; mcap: number; emission_pct: number;
};

type HistoryBlob = Record<string, Record<string, ScoreRow>>;

export type SubnetSeries = {
  netuid: number;
  name: string;
  timestamps: string[];   // ISO strings, evenly-sampled
  agap: number[];
  price: number[];
  latestAgap: number;
  latestPrice: number;
  correlation: number;    // Pearson r between agap and price (-1 to 1)
};

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2) return 0;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const ea = a[i] - meanA, eb = b[i] - meanB;
    num += ea * eb; da += ea * ea; db += eb * eb;
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: "no token" }, { status: 500 });

  // Load score history
  let history: HistoryBlob = {};
  try {
    const b = await blobGet("subnet-scores-history.json", { token, access: "private" });
    if (b?.stream) {
      const reader = b.stream.getReader();
      const chunks: Uint8Array[] = [];
      while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
      history = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    }
  } catch { return NextResponse.json({ error: "failed to load history" }, { status: 500 }); }

  // Load scan-latest for subnet names
  let nameMap: Record<number, string> = {};
  try {
    const b = await blobGet("scan-latest.json", { token, access: "private" });
    if (b?.stream) {
      const reader = b.stream.getReader();
      const chunks: Uint8Array[] = [];
      while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
      const scan = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
      for (const entry of scan?.leaderboard ?? []) {
        nameMap[Number(entry.netuid)] = String(entry.name ?? `SN${entry.netuid}`);
      }
    }
  } catch { /* names optional */ }

  // Sort timestamps ascending
  const timestamps = Object.keys(history).sort();
  if (timestamps.length === 0) return NextResponse.json({ subnets: [] });

  // Collect all netuids
  const allNetuids = new Set<string>();
  for (const ts of timestamps) {
    for (const uid of Object.keys(history[ts] ?? {})) allNetuids.add(uid);
  }

  // Downsample to max 120 points (5-day resolution if we have 30d × 24h)
  const MAX_PTS = 120;
  const step = Math.max(1, Math.floor(timestamps.length / MAX_PTS));
  const sampledTs = timestamps.filter((_, i) => i % step === 0);

  const subnets: SubnetSeries[] = [];

  for (const uid of allNetuids) {
    const netuid = Number(uid);
    const agapSeries: number[] = [];
    const priceSeries: number[] = [];
    const tsSeries: string[] = [];

    for (const ts of sampledTs) {
      const row = history[ts]?.[uid];
      if (row == null) continue;
      agapSeries.push(row.agap ?? 0);
      priceSeries.push(row.price ?? 0);
      tsSeries.push(ts);
    }

    if (agapSeries.length < 3) continue; // not enough data
    // Skip if price never changed (stale / no data)
    const priceRange = Math.max(...priceSeries) - Math.min(...priceSeries);
    if (priceRange === 0 && priceSeries[0] === 0) continue;

    subnets.push({
      netuid,
      name: nameMap[netuid] ?? `SN${netuid}`,
      timestamps: tsSeries,
      agap: agapSeries,
      price: priceSeries,
      latestAgap: agapSeries[agapSeries.length - 1],
      latestPrice: priceSeries[priceSeries.length - 1],
      correlation: Math.round(pearson(agapSeries, priceSeries) * 100) / 100,
    });
  }

  // Sort by abs(correlation) desc — most correlated first
  subnets.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  return NextResponse.json({ subnets, snapshotCount: timestamps.length });
}
