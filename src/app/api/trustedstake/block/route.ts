/**
 * GET /api/trustedstake/block
 *
 * Public endpoint. Returns the latest Bittensor block number and timestamp
 * from taostats. Cached for 30 seconds.
 */

import { NextResponse } from "next/server";

export const revalidate = 30;

export async function GET() {
  const apiKey = process.env.TAOSTATS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TAOSTATS_API_KEY not configured" }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.taostats.io/api/block/v1?limit=1", {
      headers: { Authorization: apiKey },
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Taostats error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    // taostats returns { data: [{ block_number, timestamp, ... }] }
    const block = data?.data?.[0] ?? data?.blocks?.[0] ?? data?.[0];
    if (!block) {
      return NextResponse.json({ error: "No block data returned" }, { status: 502 });
    }

    const blockNumber: number = Number(block.block_number ?? block.number ?? block.id);
    const timestamp: string = block.timestamp ?? block.block_time ?? new Date().toISOString();

    return NextResponse.json({ blockNumber, timestamp });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
