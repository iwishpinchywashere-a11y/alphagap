import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isPayoutsEnabled } from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";

interface AffiliateAccountRow {
  user_id: string;
  stripe_connect_account_id: string | null;
  payouts_enabled: number;
}

export async function GET(): Promise<NextResponse> {
  if (!process.env.REFERRAL_ENABLED) {
    return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL ?? "https://alphagap.io"));
  }

  const session = await getServerSession(authOptions);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://alphagap.io";

  if (!session?.user?.email || !(session.user as { id?: string }).id) {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  const userId = (session.user as { id: string }).id;
  const db = getDb();

  const affiliateAccount = db
    .prepare("SELECT * FROM affiliate_accounts WHERE user_id = ?")
    .get(userId) as AffiliateAccountRow | undefined;

  if (affiliateAccount?.stripe_connect_account_id) {
    try {
      const payoutsReady = await isPayoutsEnabled(affiliateAccount.stripe_connect_account_id);
      if (payoutsReady) {
        db.prepare(
          "UPDATE affiliate_accounts SET payouts_enabled = 1, onboarded_at = datetime('now') WHERE user_id = ?",
        ).run(userId);
        console.log(`[referral] Payouts enabled for user ${userId}`);
      }
    } catch (e) {
      console.error("[referral] Error checking payouts status:", e);
    }
  }

  return NextResponse.redirect(new URL("/affiliate", baseUrl));
}
