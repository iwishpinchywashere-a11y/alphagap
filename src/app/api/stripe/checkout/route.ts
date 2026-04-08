import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe, PLANS, type PlanKey } from "@/lib/stripe-client";
import { getUserByEmail, setStripeCustomerLookup, updateUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const planKey: PlanKey = body.plan === "premium" ? "premium" : "pro";
    const plan = PLANS[planKey];

    const stripe = getStripe();
    // Retry up to 5× (3s total) — Vercel Blob propagation delay after fresh signup
    // can cause the user blob to be invisible on a different serverless instance.
    const user = await getUserByEmail(session.user.email, { retries: 5 });
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
        // If they're already on this plan (or higher), just go to dashboard
        const currentTier = user.subscriptionTier ?? "pro";
        const tierRank = { pro: 1, premium: 2 };
        if ((tierRank[currentTier] ?? 0) >= (tierRank[planKey] ?? 0)) {
          return NextResponse.json({ url: `${baseUrl}/dashboard?welcome=true` });
        }

        // Upgrading from Pro → Premium: update the existing subscription's price
        const existingItem = sub.items.data[0];
        const updatedSub = await stripe.subscriptions.update(sub.id, {
          items: [{
            id: existingItem.id,
            price_data: {
              currency: plan.currency,
              product_data: { name: plan.name, description: plan.description },
              recurring: { interval: plan.interval },
              unit_amount: plan.amount,
            },
          }],
          proration_behavior: "always_invoice",
          metadata: { userEmail: user.email, userId: user.id, plan: planKey },
        });

        // Update user record immediately so it's reflected on next session
        await updateUser(user.email, { subscriptionTier: planKey });

        // Redirect to the latest invoice's hosted page so they confirm payment, or dashboard if nothing due
        const latestInvoiceId = updatedSub.latest_invoice;
        if (latestInvoiceId && typeof latestInvoiceId === "string") {
          const invoice = await stripe.invoices.retrieve(latestInvoiceId);
          if (invoice.hosted_invoice_url && invoice.status !== "paid") {
            return NextResponse.json({ url: invoice.hosted_invoice_url });
          }
        }
        return NextResponse.json({ url: `${baseUrl}/dashboard?upgraded=true` });
      }
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{
        price_data: {
          currency: plan.currency,
          product_data: {
            name: plan.name,
            description: plan.description,
            images: [`${baseUrl}/alphagap_logo_dark.svg`],
          },
          recurring: { interval: plan.interval },
          unit_amount: plan.amount,
        },
        quantity: 1,
      }],
      success_url: `${baseUrl}/api/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/subscribe?canceled=true`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { userEmail: user.email, userId: user.id, plan: planKey },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (e) {
    console.error("[stripe/checkout]", e);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
