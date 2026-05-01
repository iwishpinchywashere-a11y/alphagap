/**
 * GET /api/whale-tracker
 *
 * Public read endpoint. Returns the full WhaleTrackerState plus computed
 * summary stats. No auth required.
 */

import { NextResponse } from "next/server";
import { get as blobGet } from "@vercel/blob";
import type { WhaleSignalEntry, WhaleTrackerState } from "@/lib/whale-tracker";

const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN || "";

async function readBlob<T>(name: string): Promise<T | null> {
  try {
    const b = await blobGet(name, { token: TOKEN(), access: "private" });
    if (!b?.stream) return null;
    const reader = b.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch {
    return null;
  }
}

function computeStats(entries: WhaleSignalEntry[]) {
  const totalSignals = entries.length;
  const activeSignals = entries.filter((e) => e.status === "active").length;
  const totalClosed = entries.filter((e) => e.status === "closed").length;

  // Win rate: closed accumulating entries where priceAt14d > entryPrice * 1.1
  const closedAccumulating = entries.filter(
    (e) => e.status === "closed" && e.signal === "accumulating" && e.priceAt14d !== undefined
  );
  const wins = closedAccumulating.filter(
    (e) => e.priceAt14d! > e.entryPrice * 1.1
  );
  const winRate14d = closedAccumulating.length > 0
    ? (wins.length / closedAccumulating.length) * 100
    : 0;

  // Average return at 14d for closed accumulating
  const returnsAt14d = closedAccumulating
    .filter((e) => e.entryPrice > 0)
    .map((e) => (e.priceAt14d! - e.entryPrice) / e.entryPrice);
  const avgReturn14d = returnsAt14d.length > 0
    ? returnsAt14d.reduce((a, b) => a + b, 0) / returnsAt14d.length * 100
    : 0;

  return {
    totalSignals,
    activeSignals,
    winRate14d: Math.round(winRate14d * 10) / 10,
    avgReturn14d: Math.round(avgReturn14d * 10) / 10,
    totalClosed,
  };
}

export async function GET() {
  const state = await readBlob<WhaleTrackerState>("whale-tracker.json");

  const entries: WhaleSignalEntry[] = state?.entries ?? [];
  const stats = computeStats(entries);

  return NextResponse.json(
    { entries, stats },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    }
  );
}
