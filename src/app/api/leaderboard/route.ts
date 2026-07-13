import { NextResponse } from "next/server";
import { get } from "@vercel/blob";

export const dynamic = "force-dynamic";

// Serves the leaderboard from the scan blob. The old SQLite-backed version
// (computeLeaderboard) 500'd in production — no persistent filesystem on Vercel.

export async function GET() {
  try {
    const result = await get("scan-latest.json", {
      token: process.env.BLOB_READ_WRITE_TOKEN!,
      access: "private",
      abortSignal: AbortSignal.timeout(8000),
    });
    if (!result?.stream) return NextResponse.json({ leaderboard: [] });

    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const scan = JSON.parse(Buffer.concat(chunks).toString("utf-8"));

    return NextResponse.json({
      leaderboard: Array.isArray(scan.leaderboard) ? scan.leaderboard : [],
      lastScan: scan.lastScan ?? null,
    });
  } catch {
    return NextResponse.json({ leaderboard: [] });
  }
}
