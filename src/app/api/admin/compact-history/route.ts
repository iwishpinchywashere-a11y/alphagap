/**
 * GET /api/admin/compact-history
 *
 * The subnet-scores-history.json blob grew to ~57 MB because every 10-min scan
 * wrote a unique ISO timestamp key. This endpoint:
 *   1. Reads the full (potentially huge) blob in chunks
 *   2. De-duplicates to one entry per hour (keeps the last scan within each hour)
 *   3. Writes the compacted blob back (~720 entries for 30 days ≈ ~10 MB)
 *
 * After running this, the next scan will find historical snapshots and velo /
 * emission-delta will compute immediately.
 */

import { NextResponse } from "next/server";
import { get, put } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: "no token" }, { status: 500 });

  // ── Read the blob (may be very large) ────────────────────────────
  let raw: Buffer;
  try {
    const blob = await get("subnet-scores-history.json", {
      token,
      access: "private",
      abortSignal: AbortSignal.timeout(120_000),
    });
    if (!blob?.stream) {
      return NextResponse.json({ error: "blob not found or no stream" }, { status: 404 });
    }
    const reader = blob.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    raw = Buffer.concat(chunks);
  } catch (e) {
    return NextResponse.json({ error: `read failed: ${e}` }, { status: 500 });
  }

  const originalSizeMB = Math.round(raw.byteLength / 1e5) / 10;

  // ── Parse (may take a few seconds on large blob) ──────────────────
  type ScoreRow = { agap: number; flow: number; dev: number; eval: number; social: number; price: number; mcap: number; emission_pct: number };
  let history: Record<string, Record<string, ScoreRow>>;
  try {
    history = JSON.parse(raw.toString("utf-8"));
  } catch (e) {
    return NextResponse.json({ error: `parse failed: ${e}`, sizeMB: originalSizeMB }, { status: 500 });
  }

  const allTs = Object.keys(history).sort(); // ascending
  const originalCount = allTs.length;

  // ── Compact: keep the LAST entry within each calendar hour ────────
  // Key by YYYY-MM-DDTHH (13 chars) → keep the largest (latest) full ts in that hour
  const hourMap = new Map<string, string>(); // hourKey → latest full timestamp
  for (const ts of allTs) {
    const hourKey = ts.slice(0, 13); // "2026-05-05T14"
    const existing = hourMap.get(hourKey);
    if (!existing || ts > existing) hourMap.set(hourKey, ts);
  }

  // Build compacted history using only the kept timestamps
  const compacted: Record<string, Record<string, ScoreRow>> = {};
  for (const [, ts] of hourMap) {
    compacted[ts] = history[ts];
  }

  // Trim to last 90 days
  const cutoff90 = new Date(Date.now() - 90 * 86_400_000).toISOString();
  for (const k of Object.keys(compacted)) {
    if (k < cutoff90) delete compacted[k];
  }

  const compactedCount = Object.keys(compacted).length;
  const compactedJson = JSON.stringify(compacted);
  const compactedSizeMB = Math.round(compactedJson.length / 1e5) / 10;

  // ── Write compacted blob back ─────────────────────────────────────
  try {
    await put("subnet-scores-history.json", compactedJson, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token,
    });
  } catch (e) {
    return NextResponse.json({ error: `write failed: ${e}` }, { status: 500 });
  }

  // ── Verify snap24h will be found on next scan ─────────────────────
  const compactedTs = Object.keys(compacted).sort();
  const now = Date.now();
  const target24h = now - 24 * 3600_000;
  let bestDiff = Infinity;
  let bestTs = "";
  for (const ts of compactedTs) {
    const diff = Math.abs(new Date(ts).getTime() - target24h);
    if (diff < bestDiff) { bestDiff = diff; bestTs = ts; }
  }
  const snap24hAgeH = Math.round((now - new Date(bestTs).getTime()) / 3600_000 * 10) / 10;
  const snap24hFound = bestDiff <= 18 * 3600_000;

  return NextResponse.json({
    ok: true,
    original:   { entries: originalCount, sizeMB: originalSizeMB },
    compacted:  { entries: compactedCount, sizeMB: compactedSizeMB },
    snap24h:    { found: snap24hFound, bestTs, ageH: snap24hAgeH },
    veloReadyOnNextScan: snap24hFound,
    message: snap24hFound
      ? `✅ Velo and Em Δ will compute on the next scan (~10 min).`
      : `⚠️ No snapshot found within 6–42h window. Oldest entry is ${snap24hAgeH}h old — wait for more history to accumulate.`,
  });
}
