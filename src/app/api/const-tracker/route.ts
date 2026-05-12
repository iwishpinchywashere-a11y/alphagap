/**
 * GET /api/const-tracker
 *
 * Returns the persisted Const founder wallet events (last 7 days).
 * Written by /api/scan after each scan when Const activity is detected.
 */

import { NextResponse } from "next/server";
import { get as blobGet } from "@vercel/blob";

export const dynamic = "force-dynamic";

interface ConstEvent {
  id: string;
  type: "buy" | "sell";
  wallet: string;
  netuid: number;
  subnetName?: string;
  amountTao: number;
  amountUsd: number;
  detectedAt: string;
}

interface ConstTracker {
  events: ConstEvent[];
  updatedAt: string;
}

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ events: [], updatedAt: null });
  }

  try {
    const b = await blobGet("const-latest.json", { token, access: "private" });
    if (!b?.stream) return NextResponse.json({ events: [], updatedAt: null });

    const reader = b.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const store = JSON.parse(
      Buffer.concat(chunks).toString("utf-8")
    ) as ConstTracker;

    // Only return events within the last 7 days
    const cutoff7d = Date.now() - 7 * 24 * 3600_000;
    const events = (store.events ?? []).filter(
      (e) => new Date(e.detectedAt).getTime() > cutoff7d
    );

    return NextResponse.json(
      { events, updatedAt: store.updatedAt ?? null },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch {
    return NextResponse.json({ events: [], updatedAt: null });
  }
}
