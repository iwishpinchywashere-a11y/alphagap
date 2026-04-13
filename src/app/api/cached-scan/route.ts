import { NextResponse } from "next/server";
import { get } from "@vercel/blob";

export const dynamic = "force-dynamic";

// ── Hard score overrides ──────────────────────────────────────────
// These subnets had large token dumps (Apr 9 2026).
// Scores are locked here at the API layer until manually removed.
// This runs on EVERY response so no scan can override them.
const SCORE_OVERRIDES = new Map<number, number>([
  [3,  40], // Templar
  [39, 34], // Basilica
  [81, 29], // Grail
]);

function applyScoreOverrides(data: Record<string, unknown>) {
  if (!Array.isArray(data.leaderboard)) return data;
  for (const entry of data.leaderboard as Array<Record<string, unknown>>) {
    const override = SCORE_OVERRIDES.get(entry.netuid as number);
    if (override !== undefined) entry.composite_score = override;
  }
  (data.leaderboard as Array<Record<string, unknown>>).sort(
    (a, b) => (b.composite_score as number) - (a.composite_score as number)
  );
  return data;
}

async function readBlob(name: string, token: string) {
  const result = await get(name, { token, access: "private" });
  if (!result?.stream) return null;
  const reader = result.stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ cached: false, error: "no token" }, { status: 404 });
  }

  try {
    // Try the full scan first
    const full = await readBlob("scan-latest.json", token).catch(() => null);

    if (full) {
      const fullLeaderboardSize = Array.isArray(full.leaderboard) ? full.leaderboard.length : 0;

      // SAFEGUARD: if the stored blob has an empty/degraded leaderboard, treat it
      // as missing so we fall through to the price snapshot or 404 rather than
      // serving a blank dashboard to paying customers.
      if (fullLeaderboardSize < 50) {
        console.warn(`[cached-scan] Stored blob has only ${fullLeaderboardSize} subnets — treating as degraded, skipping.`);
      } else {
        // Check freshness — prefer full scan if < 4h old
        const age = full.lastScan ? Date.now() - new Date(full.lastScan).getTime() : Infinity;
        if (age < 4 * 60 * 60 * 1000) {
          return NextResponse.json(applyScoreOverrides({ ...full, cached: true }));
        }

        // Full scan is stale — try price snapshot as a supplement
        const prices = await readBlob("scan-prices.json", token).catch(() => null);
        if (prices && prices.lastScan && (Array.isArray(prices.leaderboard) ? prices.leaderboard.length : 0) >= 50) {
          const priceAge = Date.now() - new Date(prices.lastScan).getTime();
          if (priceAge < age) {
            // Merge: use fresh prices/leaderboard from price snapshot, signals from full scan
            return NextResponse.json(applyScoreOverrides({
              ...full,
              leaderboard: prices.leaderboard ?? full.leaderboard,
              cached: true,
              priceRefreshedAt: prices.lastScan,
            }));
          }
        }

        // Fall back to stale full scan — still better than nothing
        return NextResponse.json(applyScoreOverrides({ ...full, cached: true, stale: true }));
      }
    }

    // No full scan yet — try price-only snapshot
    const prices = await readBlob("scan-prices.json", token).catch(() => null);
    if (prices) {
      return NextResponse.json(applyScoreOverrides({ ...prices, cached: true, partial: true }));
    }

    return NextResponse.json({ cached: false }, { status: 404 });
  } catch (e) {
    const msg = String(e);
    if (msg.includes("BlobNotFound") || msg.includes("not_found")) {
      return NextResponse.json({ cached: false }, { status: 404 });
    }
    console.error("[cached-scan] Error:", e);
    return NextResponse.json({ cached: false, error: msg }, { status: 500 });
  }
}
