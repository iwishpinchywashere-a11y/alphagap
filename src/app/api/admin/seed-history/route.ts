/**
 * GET /api/admin/seed-history
 *
 * Seeds subnet-scores-history.json with the current leaderboard scores
 * stamped as "25 hours ago". On the next scan the diff will be ~0
 * (velo shows 50/neutral for everyone) but the column stops showing "—".
 * Real deltas emerge naturally over the next 24h as scores drift.
 */

import { NextResponse } from "next/server";
import { get, put } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: "no token" }, { status: 500 });

  // ── Read current leaderboard ──────────────────────────────────────
  let leaderboard: Array<{
    netuid: number;
    composite_score: number;
    flow_score: number;
    dev_score: number;
    eval_score?: number;
    social_score?: number;
    alpha_price?: number;
    market_cap?: number;
    emission_pct?: number;
  }>;

  try {
    const blob = await get("scan-latest.json", { token, access: "private", abortSignal: AbortSignal.timeout(15_000) });
    if (!blob?.stream) return NextResponse.json({ error: "scan-latest.json not found" }, { status: 404 });
    const reader = blob.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    const scan = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    leaderboard = scan.leaderboard ?? [];
  } catch (e) {
    return NextResponse.json({ error: `failed to read scan-latest.json: ${e}` }, { status: 500 });
  }

  if (!leaderboard.length) return NextResponse.json({ error: "leaderboard empty" }, { status: 500 });

  // ── Read existing (fresh) history ─────────────────────────────────
  type ScoreRow = { agap: number; flow: number; dev: number; eval: number; social: number; price: number; mcap: number; emission_pct: number };
  let history: Record<string, Record<string, ScoreRow>> = {};
  try {
    const blob = await get("subnet-scores-history.json", { token, access: "private", abortSignal: AbortSignal.timeout(15_000) });
    if (blob?.stream) {
      const reader = blob.stream.getReader();
      const chunks: Uint8Array[] = [];
      while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
      const raw = Buffer.concat(chunks);
      if (raw.byteLength < 40_000_000) history = JSON.parse(raw.toString("utf-8"));
    }
  } catch { /* start fresh */ }

  // ── Build seeded snapshot stamped 25h ago ─────────────────────────
  // Using 25h so it falls inside the ±18h tolerance window around the 24h target.
  const seed25h = new Date(Date.now() - 25 * 3600_000);
  seed25h.setMinutes(0, 0, 0);
  const seedTs = seed25h.toISOString();

  // Also seed 7 days ago so snap7d works too
  const seed7d = new Date(Date.now() - 7 * 24 * 3600_000);
  seed7d.setMinutes(0, 0, 0);
  const seedTs7d = seed7d.toISOString();

  const snapshot: Record<string, ScoreRow> = {};
  for (const e of leaderboard) {
    snapshot[String(e.netuid)] = {
      agap:         e.composite_score,
      flow:         e.flow_score,
      dev:          e.dev_score,
      eval:         e.eval_score  ?? 0,
      social:       e.social_score ?? 0,
      price:        e.alpha_price  ?? 0,
      mcap:         e.market_cap   ?? 0,
      emission_pct: e.emission_pct ?? 0,
    };
  }

  // Don't overwrite if real data already exists at these timestamps
  if (!history[seedTs])   history[seedTs]   = snapshot;
  if (!history[seedTs7d]) history[seedTs7d] = snapshot;

  // ── Write back ────────────────────────────────────────────────────
  try {
    await put("subnet-scores-history.json", JSON.stringify(history), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token,
    });
  } catch (e) {
    return NextResponse.json({ error: `write failed: ${e}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    seededTs25h: seedTs,
    seededTs7d:  seedTs7d,
    subnetsSeeded: leaderboard.length,
    totalSnapshots: Object.keys(history).length,
    message: "✅ Seeded. Velo will show ~50 (neutral) on the next scan (~10 min). Real deltas emerge over the next 24h.",
  });
}
