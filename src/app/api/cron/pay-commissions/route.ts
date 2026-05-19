/**
 * GET /api/cron/pay-commissions
 *
 * Daily cron — retries any commissions stuck in "pending" status.
 *
 * This handles the case where payPendingCommissions() failed during the
 * invoice.payment_succeeded webhook (e.g. affiliate hadn't finished Stripe
 * Connect onboarding yet). Without this cron, those commissions would sit
 * pending forever until an admin manually clicks "Repair & Pay".
 */
import { NextResponse } from "next/server";
import { payPendingCommissions } from "@/lib/referral";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request): Promise<NextResponse> {
  // Verify Vercel cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.REFERRAL_ENABLED) {
    return NextResponse.json({ skipped: true, reason: "REFERRAL_ENABLED not set" });
  }

  try {
    const paid = await payPendingCommissions();
    console.log(`[cron/pay-commissions] Paid ${paid} pending commission(s)`);
    return NextResponse.json({ ok: true, paid });
  } catch (e) {
    console.error("[cron/pay-commissions] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
