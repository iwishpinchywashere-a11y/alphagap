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

  const email = session.user.email;

  try {
    const user = await getUserByEmail(email);
    const stripe = getStripe();
    const baseUrl = (process.env.NEXTAUTH_URL || "https://alphagap.io").replace(/\/$/, "");

    // Resolve Stripe customer ID — prefer stored value, fall back to email lookup
    let customerId = user?.stripeCustomerId;
    if (!customerId) {
      const existing = await stripe.customers.list({ email, limit: 1 });
      if (existing.data.length === 0) {
        return NextResponse.json({ error: "No billing account found" }, { status: 404 });
      }
      customerId = existing.data[0].id;
      // Persist it so we don't have to look it up again
      if (user) {
        import("@/lib/users").then(({ updateUser }) =>
          updateUser(email, { stripeCustomerId: customerId! }).catch(() => {})
        );
      }
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/account`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (e) {
    console.error("[stripe/portal]", e);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
