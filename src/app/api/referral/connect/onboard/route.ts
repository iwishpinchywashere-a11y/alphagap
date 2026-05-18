import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateAffiliateAccount, updateAffiliateAccount } from "@/lib/referral";
import { createConnectAccount, createOnboardingLink } from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";

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

  try {
    const affiliate = await getOrCreateAffiliateAccount(userId, userEmail);

    let connectAccountId: string;
    if (affiliate.stripeConnectAccountId) {
      connectAccountId = affiliate.stripeConnectAccountId;
    } else {
      connectAccountId = await createConnectAccount(userEmail, userId);
      await updateAffiliateAccount(userId, { stripeConnectAccountId: connectAccountId });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.alphagap.io";
    const returnUrl = `${baseUrl}/api/referral/connect/return`;
    const refreshUrl = `${baseUrl}/api/referral/connect/onboard`;

    const onboardingUrl = await createOnboardingLink(connectAccountId, returnUrl, refreshUrl);
    return NextResponse.json({ url: onboardingUrl });
  } catch (e) {
    console.error("[referral] connect onboard error:", e);
    return NextResponse.json({ error: "Failed to start onboarding" }, { status: 500 });
  }
}
