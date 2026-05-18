import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createConnectAccount, createOnboardingLink } from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";

interface AffiliateAccountRow {
  user_id: string;
  stripe_connect_account_id: string | null;
  payouts_enabled: number;
}

export async function POST(): Promise<NextResponse> {
  if (!process.env.REFERRAL_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !(session.user as { id?: string }).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const userEmail = session.user.email;

  const db = getDb();

  let affiliateAccount = db
    .prepare("SELECT * FROM affiliate_accounts WHERE user_id = ?")
    .get(userId) as AffiliateAccountRow | undefined;

  let connectAccountId: string;

  if (affiliateAccount?.stripe_connect_account_id) {
    connectAccountId = affiliateAccount.stripe_connect_account_id;
  } else {
    // Create new Stripe Express account
    connectAccountId = await createConnectAccount(userEmail, userId);

    if (affiliateAccount) {
      db.prepare(
        "UPDATE affiliate_accounts SET stripe_connect_account_id = ? WHERE user_id = ?",
      ).run(connectAccountId, userId);
    } else {
      db.prepare(
        "INSERT INTO affiliate_accounts (user_id, user_email, stripe_connect_account_id) VALUES (?, ?, ?)",
      ).run(userId, userEmail, connectAccountId);
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://alphagap.io";
  const returnUrl = `${baseUrl}/api/referral/connect/return`;
  const refreshUrl = `${baseUrl}/api/referral/connect/onboard`;

  const onboardingUrl = await createOnboardingLink(connectAccountId, returnUrl, refreshUrl);

  return NextResponse.json({ url: onboardingUrl });
}
