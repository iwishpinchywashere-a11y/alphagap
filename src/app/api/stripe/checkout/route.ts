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

    // Resolve Stripe customer — check blob first, then search Stripe by email,
    // only create a new customer as a last resort. This prevents a new empty
    // customer being created when the blob hasn't propagated yet after signup.
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const existing = await stripe.customers.list({ email: user.email, limit: 5 }).catch(() => null);
      customerId = existing?.data[0]?.id ?? undefined;
      if (customerId) {
        // Found one — persist it so future calls skip the lookup
        await Promise.all([
          setStripeCustomerLookup(user.email, customerId),
          updateUser(user.email, { stripeCustomerId: customerId }),
        ]).catch(() => {});
      } else {
        // Truly new user — create customer
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { userId: user.id },
        });
        customerId = customer.id;
        await setStripeCustomerLookup(user.email, customerId);
        await updateUser(user.email, { stripeCustomerId: customerId });
      }
    }

    // Find any existing active subscription — try stored ID first, then list all
    // for this customer. The Stripe list is the source of truth and handles blob
    // propagation lag (user just subscribed and blob hasn't updated yet).
    let activeSub = null;
    if (user.stripeSubscriptionId) {
      activeSub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
        expand: ["items.data.price"],
      }).catch(() => null);
      if (activeSub?.status !== "active" && activeSub?.status !== "trialing") activeSub = null;
    }
    if (!activeSub) {
      // Search ALL customers for this email in case customer ID itself is stale
      const customers = await stripe.customers.list({ email: user.email, limit: 5 }).catch(() => null);
      for (const cust of customers?.data ?? []) {
        const listed = await stripe.subscriptions.list({
          customer: cust.id,
          status: "active",
          limit: 5,
          expand: ["data.items.data.price"],
        }).catch(() => null);
        activeSub = listed?.data[0] ?? null;
        if (activeSub) { customerId = cust.id; break; }
      }
    }

    if (activeSub) {
      const sub = activeSub;
      // Determine current tier from the actual Stripe price amount (source of truth)
      const currentAmount = sub.items.data[0]?.price?.unit_amount ?? 0;
      const tierRank = { pro: 1, premium: 2 };
      const currentTier: PlanKey = currentAmount >= PLANS.premium.amount ? "premium" : "pro";

      if ((tierRank[currentTier] ?? 0) >= (tierRank[planKey] ?? 0)) {
        // Already on this plan or higher — just go to dashboard
        return NextResponse.json({ url: `${baseUrl}/dashboard?welcome=true` });
      }

      // Upgrading (e.g. Pro → Premium): update the existing subscription in-place.
      // This charges ONLY the prorated difference to the card on file — no new checkout.
      // Stripe generates an immediate invoice for (premium_price - unused_pro_credit).
      const existingItemId = sub.items.data[0]?.id;
      if (!existingItemId) {
        return NextResponse.json({ error: "Cannot find subscription item to upgrade" }, { status: 500 });
      }

      // subscriptions.update() requires a Price ID (not inline price_data),
      // so we create a one-off Price object for this upgrade.
      const upgradePrice = await stripe.prices.create({
        unit_amount: plan.amount,
        currency: plan.currency,
        recurring: { interval: plan.interval },
        product_data: { name: plan.name },
        metadata: { plan: planKey },
      });

      await stripe.subscriptions.update(sub.id, {
        items: [{ id: existingItemId, price: upgradePrice.id }],
        proration_behavior: "always_invoice",  // charge prorated diff immediately
        metadata: { plan: planKey, userEmail: user.email, userId: user.id },
      });

      // Redirect to upgrade-success which mints a fresh JWT with the new tier
      return NextResponse.json({ url: `${baseUrl}/api/stripe/upgrade-success?plan=${planKey}` });
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
