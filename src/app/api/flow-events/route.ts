/**
 * GET /api/flow-events
 *
 * Returns the persisted 48-hour rolling window of flow events
 * (whale buys/sells, volume surges, yield spikes/dips).
 * Written by /api/cron/flow-snapshot after each scan.
 */

import { NextResponse } from "next/server";
import { get as blobGet } from "@vercel/blob";
import type { PersistedFlowEvent } from "@/app/api/cron/flow-snapshot/route";

export const dynamic = "force-dynamic";

interface FlowEventsStore {
  events: PersistedFlowEvent[];
  updatedAt?: string;
}

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ events: [], updatedAt: null });
  }

  try {
    const b = await blobGet("flow-events.json", { token, access: "private" });
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
    ) as FlowEventsStore;

    // Only return events within the last 48 hours
    const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString().slice(0, 10);
    const events = (store.events ?? []).filter((e) => e.dayKey >= cutoff);

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
