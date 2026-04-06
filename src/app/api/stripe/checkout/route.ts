import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe, PLAN } from "@/lib/stripe-client";
import { getUserByEmail, setStripeCustomerLookup, updateUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const stripe = getStripe();
    const user = await getUserByEmail(session.user.email);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const baseUrl = process.env.NEXTAUTH_URL || "https://alphagap.vercel.app";

    // Reuse existing Stripe customer or create new one
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await setStripeCustomerLookup(user.email, customerId);
      await updateUser(user.email, { stripeCustomerId: customerId });
    }

    // Check for existing active subscription
    if (user.stripeSubscriptionId) {
      const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId).catch(() => null);
      if (sub && (sub.status === "active" || sub.status === "trialing")) {
        return NextResponse.json({ url: `${baseUrl}/dashboard?welcome=true` });
      }
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{
        price_data: {
          currency: PLAN.currency,
          product_data: {
            name: PLAN.name,
            description: PLAN.description,
            images: [`${baseUrl}/alphagap_logo_dark.svg`],
          },
          recurring: { interval: PLAN.interval },
          unit_amount: PLAN.amount,
        },
        quantity: 1,
      }],
      success_url: `${baseUrl}/dashboard?welcome=true`,
      cancel_url: `${baseUrl}/subscribe?canceled=true`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { userEmail: user.email, userId: user.id },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (e) {
    console.error("[stripe/checkout]", e);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
