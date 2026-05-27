/**
 * POST /api/admin/trigger-index-rebalance
 * Admin-only manual trigger for the weekly index rebalance.
 * Useful for testing or forcing an off-cycle rebalance.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runRebalance } from "@/app/api/cron/index-rebalance/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ADMIN_EMAILS = new Set(["iwishpinchywashere@gmail.com", "shaneamartz@gmail.com"]);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !ADMIN_EMAILS.has(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  console.log(`[admin] ${session.user.email} triggered manual index rebalance`);
  return runRebalance();
}
