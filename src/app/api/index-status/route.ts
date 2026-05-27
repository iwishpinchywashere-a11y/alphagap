/**
 * GET /api/index-status
 * Returns the last AlphaGap Index rebalance result from Vercel Blob.
 * Used by the /alphagapindex page to show live last-rebalanced date and holdings.
 * Public endpoint — no auth required (holdings are public marketing info).
 */

import { NextResponse } from "next/server";
import { get as blobGet } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  try {
    const blob = await blobGet("index-rebalance-latest.json", { token, access: "private" });
    if (!blob?.stream) return NextResponse.json({ rebalancedAt: null, holdings: [] });
    const reader = blob.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ rebalancedAt: null, holdings: [] });
  }
}
