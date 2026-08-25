import { NextResponse } from "next/server";
import { get as blobGet } from "@vercel/blob";
import type { FeedCard } from "@/app/api/cron/feed-digest/route";

export const dynamic = "force-dynamic";
// Blob-only route; nothing here fetches upstream APIs, so no fetchCache
// override is needed. Cards regenerate at most every 6h via the cron.

export async function GET() {
  try {
    const b = await blobGet("feed-digest.json", {
      token: process.env.BLOB_READ_WRITE_TOKEN || "", access: "private",
      abortSignal: AbortSignal.timeout(10000),
    });
    if (!b?.stream) return NextResponse.json({ cards: [] });
    const r = b.stream.getReader(); const cs: Uint8Array[] = [];
    while (true) { const { done, value } = await r.read(); if (done) break; cs.push(value); }
    const cards: FeedCard[] = JSON.parse(Buffer.concat(cs).toString("utf-8"));
    return NextResponse.json({ cards });
  } catch {
    return NextResponse.json({ cards: [] });
  }
}
