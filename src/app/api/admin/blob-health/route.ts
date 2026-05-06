/**
 * GET /api/admin/blob-health
 * Diagnoses the state of history blobs used for Velo and Em Δ.
 */
import { NextResponse } from "next/server";
import { get } from "@vercel/blob";

export const dynamic = "force-dynamic";

async function readBlob(name: string, token: string) {
  try {
    const b = await get(name, { token, access: "private", abortSignal: AbortSignal.timeout(8000) });
    if (!b?.stream) return null;
    const reader = b.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch { return null; }
}

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: "no token" }, { status: 500 });

  const [scoreHistory, emissionHistory] = await Promise.all([
    readBlob("subnet-scores-history.json", token),
    readBlob("emission-history.json", token),
  ]);

  const now = Date.now();

  // Analyse score history
  let scoreStats: Record<string, unknown> = { exists: false };
  if (scoreHistory) {
    const ts = Object.keys(scoreHistory).sort();
    const oldest = ts[0] ? new Date(ts[0]).getTime() : null;
    const newest = ts[ts.length - 1] ? new Date(ts[ts.length - 1]).getTime() : null;
    const oldestAgeH = oldest ? Math.round((now - oldest) / 3600000 * 10) / 10 : null;

    // Check if snap24h would be found (needs entry 6-42h old)
    const target24h = now - 24 * 3600_000;
    const tol18h = 18 * 3600_000;
    let bestDiff = Infinity;
    for (const t of ts) {
      const diff = Math.abs(new Date(t).getTime() - target24h);
      if (diff < bestDiff) bestDiff = diff;
    }
    const snap24hFound = bestDiff <= tol18h;

    scoreStats = {
      exists: true,
      snapshots: ts.length,
      oldestTs: ts[0] ?? null,
      newestTs: ts[ts.length - 1] ?? null,
      oldestAgeH,
      snap24hFound,
      snap24hBestDiffH: Math.round(bestDiff / 3600000 * 10) / 10,
      veloWillCompute: snap24hFound,
    };
  }

  // Analyse emission history
  let emStats: Record<string, unknown> = { exists: false };
  if (emissionHistory) {
    const subnets = Object.keys(emissionHistory);
    const sampleSubnet = subnets[0];
    const sampleHist = sampleSubnet ? emissionHistory[sampleSubnet] : [];
    const oldestEntry = sampleHist[0];
    const oldestAgeH = oldestEntry
      ? Math.round((now - new Date(oldestEntry.timestamp).getTime()) / 3600000 * 10) / 10
      : null;

    emStats = {
      exists: true,
      subnetsTracked: subnets.length,
      sampleSubnet: `SN${sampleSubnet}`,
      sampleReadings: sampleHist.length,
      sampleOldestAgeH: oldestAgeH,
      emDeltaWillCompute: sampleHist.length >= 3 && (oldestAgeH ?? 0) >= 4,
    };
  }

  return NextResponse.json({ scoreHistory: scoreStats, emissionHistory: emStats, nowUtc: new Date().toISOString() });
}
