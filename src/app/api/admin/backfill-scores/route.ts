/**
 * POST /api/admin/backfill-scores
 *
 * One-shot endpoint: reads scan-latest.json and seeds subnet-scores-history.json
 * with daily entries going back `days` days (default 14), using today's scores
 * as the baseline.  Existing entries are never overwritten — the backfill only
 * fills in *missing* dates, so running it twice is safe.
 *
 * Usage:
 *   curl -X POST https://<host>/api/admin/backfill-scores \
 *        -H "x-admin-key: $ADMIN_KEY" \
 *        -H "Content-Type: application/json" \
 *        -d '{"days": 14}'
 */

import { NextResponse } from "next/server";
import { get as blobGet, put } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

export async function POST(req: Request) {
  // Simple auth gate
  const adminKey = process.env.ADMIN_KEY || "";
  if (adminKey && req.headers.get("x-admin-key") !== adminKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { days?: number };
  const days = Math.min(Math.max(body.days ?? 14, 1), 90);

  const token = process.env.BLOB_READ_WRITE_TOKEN || "";

  // Load current scan leaderboard
  const scanLatest = await readBlob<{ leaderboard: Array<Record<string, unknown>> }>("scan-latest.json", token);
  if (!scanLatest?.leaderboard?.length) {
    return NextResponse.json({ error: "scan-latest.json missing or empty" }, { status: 500 });
  }

  // Load existing score history
  type ScoreRow = { agap: number; flow: number; dev: number; eval: number; social: number; price: number; mcap: number; emission_pct: number };
  const existing = (await readBlob<Record<string, Record<string, ScoreRow>>>("subnet-scores-history.json", token)) ?? {};

  // Build one entry per day for the backfill window, using today's scores.
  // We only write a date if it doesn't already have data.
  let added = 0;
  for (let i = days; i >= 1; i--) {
    const d = new Date(Date.now() - i * 86400000);
    // Use YYYY-MM-DD keys so they sort correctly alongside ISO timestamp keys
    const key = d.toISOString().slice(0, 10);
    if (existing[key]) continue; // don't overwrite existing data

    existing[key] = {};
    for (const entry of scanLatest.leaderboard) {
      const netuid = String(entry.netuid);
      existing[key][netuid] = {
        agap: (entry.composite_score as number) || 0,
        flow: (entry.flow_score as number) || 0,
        dev: (entry.dev_score as number) || 0,
        eval: (entry.eval_score as number) || 0,
        social: (entry.social_score as number) || 0,
        price: (entry.alpha_price as number) || 0,
        mcap: (entry.market_cap as number) || 0,
        emission_pct: (entry.emission_pct as number) || 0,
      };
      added++;
    }
  }

  await put("subnet-scores-history.json", JSON.stringify(existing), {
    access: "private",
    token,
    allowOverwrite: true,
  });

  return NextResponse.json({
    ok: true,
    backdatedDays: days,
    entriesAdded: added,
    totalKeys: Object.keys(existing).length,
  });
}
