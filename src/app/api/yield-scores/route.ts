/**
 * GET /api/yield-scores
 *
 * Public endpoint (no auth required) — returns staking APY per subnet from
 * the yield-latest.json blob so the dashboard can populate the APY column
 * independently of the main scan cycle.
 *
 * Response: { scores: { [netuid]: { apy_7d, apy_1h, apy_30d } }, updatedAt }
 */

import { NextResponse } from "next/server";
import { get as blobGet } from "@vercel/blob";

export const dynamic = "force-dynamic";

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";

interface SubnetYield {
  apy_7d: number;
  apy_1h: number;
  apy_30d: number;
  validators: number;
}

interface YieldBlob {
  subnets: Record<string, SubnetYield>;
  updatedAt: string;
}

export async function GET() {
  try {
    const b = await blobGet("yield-latest.json", { token: BLOB_TOKEN, access: "private" });
    if (!b?.stream) return NextResponse.json({ scores: {}, updatedAt: null });

    const reader = b.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as YieldBlob;
    return NextResponse.json({ scores: data.subnets ?? {}, updatedAt: data.updatedAt ?? null });
  } catch {
    return NextResponse.json({ scores: {}, updatedAt: null });
  }
}
