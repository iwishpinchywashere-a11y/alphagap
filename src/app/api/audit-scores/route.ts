/**
 * GET /api/audit-scores
 * Returns a lightweight netuid → operationalScore map from the latest
 * audit-data.json blob. No auth required — these are summary numbers only.
 * Full audit detail (flags, breakdowns) stays behind the Premium gate at /api/audits.
 */

import { NextResponse } from "next/server";
import { get as blobGet } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  if (!token) return NextResponse.json({ scores: {} });

  try {
    const blob = await blobGet("audit-data.json", {
      token,
      access: "private",
      abortSignal: AbortSignal.timeout(8000),
    });
    if (!blob?.stream) return NextResponse.json({ scores: {} });

    const reader = blob.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as {
      subnets: Record<string, { operationalScore: number }>;
    };

    const scores: Record<string, number> = {};
    for (const [netuid, entry] of Object.entries(data.subnets ?? {})) {
      if (typeof entry?.operationalScore === "number") {
        scores[netuid] = entry.operationalScore;
      }
    }
    return NextResponse.json({ scores });
  } catch {
    return NextResponse.json({ scores: {} });
  }
}
