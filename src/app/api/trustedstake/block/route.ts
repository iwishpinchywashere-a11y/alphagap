/**
 * GET /api/trustedstake/block
 *
 * Public endpoint. Returns the latest Bittensor block number and timestamp.
 * Tries taostats first; falls back to estimating from a known anchor block
 * (Bittensor produces ~1 block per 12 seconds) so a rate-limit never breaks
 * the join flow.
 *
 * Cached for 30 seconds.
 */

import { NextResponse } from "next/server";

export const revalidate = 30;

// Anchor: block 8327892 at 2026-06-03T18:57:36Z (verified from taostats)
const ANCHOR_BLOCK = 8327892;
const ANCHOR_MS = new Date("2026-06-03T18:57:36Z").getTime();
const BLOCK_TIME_MS = 12000; // ~12 seconds per block on Bittensor

function estimateCurrentBlock(): { blockNumber: number; timestamp: string } {
  const elapsed = Date.now() - ANCHOR_MS;
  const blockNumber = ANCHOR_BLOCK + Math.floor(elapsed / BLOCK_TIME_MS);
  return { blockNumber, timestamp: new Date().toISOString() };
}

export async function GET() {
  const apiKey = process.env.TAOSTATS_API_KEY;

  // Try taostats for a precise block number
  if (apiKey) {
    try {
      const res = await fetch("https://api.taostats.io/api/block/v1?limit=1", {
        headers: { Authorization: apiKey },
        next: { revalidate: 30 },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const data = await res.json();
        const block = data?.data?.[0] ?? data?.blocks?.[0] ?? data?.[0];
        if (block) {
          const blockNumber = Number(block.block_number ?? block.number ?? block.id);
          const timestamp: string = block.timestamp ?? block.block_time ?? new Date().toISOString();
          return NextResponse.json({ blockNumber, timestamp, source: "taostats" });
        }
      }
      // Taostats failed (429, 5xx, etc.) — fall through to estimate
    } catch {
      // Timeout or network error — fall through to estimate
    }
  }

  // Fallback: estimate from anchor block + elapsed time
  const estimated = estimateCurrentBlock();
  return NextResponse.json({ ...estimated, source: "estimated" });
}
