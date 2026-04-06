import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe } from "@/lib/stripe-client";
import { getUserByEmail } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const user = await getUserByEmail(session.user.email);
    if (!user?.stripeCustomerId) {
      return NextResponse.json({ error: "No billing account found" }, { status: 404 });
    }

    const stripe = getStripe();
    const baseUrl = process.env.NEXTAUTH_URL || "https://alphagap.vercel.app";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/account`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (e) {
    console.error("[stripe/portal]", e);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
