import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateAffiliateAccount, updateAffiliateAccount } from "@/lib/referral";
import { isPayoutsEnabled } from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  if (!process.env.REFERRAL_ENABLED) {
    return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL ?? "https://www.alphagap.io"));
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.alphagap.io";
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !(session.user as { id?: string }).id) {
    return NextResponse.redirect(new URL("/auth/signin", baseUrl));
  }

  const userId = (session.user as { id: string }).id;
  const userEmail = session.user.email;

  try {
    const affiliate = await getOrCreateAffiliateAccount(userId, userEmail);
    if (affiliate.stripeConnectAccountId) {
      const payoutsReady = await isPayoutsEnabled(affiliate.stripeConnectAccountId);
      if (payoutsReady) {
        await updateAffiliateAccount(userId, {
          payoutsEnabled: true,
          onboardedAt: new Date().toISOString(),
        });
        console.log(`[referral] Payouts enabled for user ${userId}`);
      }
    }
  } catch (e) {
    console.error("[referral] connect return error:", e);
  }

  return NextResponse.redirect(new URL("/referral", baseUrl));
}
