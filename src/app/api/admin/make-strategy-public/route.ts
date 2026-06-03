/**
 * GET /api/admin/make-strategy-public
 *
 * One-time admin endpoint to flip the TrustedStake strategy to isPublic=true.
 * Protected by CRON_SECRET. Call once, then this endpoint is no longer needed.
 */

import { NextResponse } from "next/server";
import { makeStrategyPublic } from "@/lib/trustedstake";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await makeStrategyPublic();
    return NextResponse.json({ ok: true, message: "Strategy is now public" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
