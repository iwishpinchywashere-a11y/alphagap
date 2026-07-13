import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";

export const dynamic = "force-dynamic";

// Serves signals from the scan blob. The old SQLite-backed version 500'd in
// production (no persistent filesystem on Vercel) — SQLite still works locally
// via /api/scan's local path, but this endpoint must work everywhere.

interface ScanSignal {
  netuid: number;
  [key: string]: unknown;
}

export async function GET(req: NextRequest) {
  const netuid = req.nextUrl.searchParams.get("netuid");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");

  try {
    const result = await get("scan-latest.json", {
      token: process.env.BLOB_READ_WRITE_TOKEN!,
      access: "private",
      abortSignal: AbortSignal.timeout(8000),
    });
    if (!result?.stream) return NextResponse.json({ signals: [] });

    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const scan = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    let signals: ScanSignal[] = Array.isArray(scan.signals) ? scan.signals : [];
    if (netuid) signals = signals.filter(s => s.netuid === parseInt(netuid));

    return NextResponse.json({ signals: signals.slice(0, limit), lastScan: scan.lastScan ?? null });
  } catch {
    return NextResponse.json({ signals: [] });
  }
}
