import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe, PLANS, type PlanKey } from "@/lib/stripe-client";
import { getUserByEmail, setStripeCustomerLookup, updateUser } from "@/lib/users";

export const dynamic = "force-dynamic";

/**
 * GET /api/stripe/checkout-redirect?plan=pro|premium
 *
 * Used after signup — the browser navigates here (full page load) so the
 * session cookie is always sent, avoiding the race condition that occurs
 * when calling the POST checkout endpoint via fetch immediately after signIn().
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const planKey: PlanKey = searchParams.get("plan") === "premium" ? "premium" : "pro";

  const session = await getServerSession(authOptions);
  const baseUrl = process.env.NEXTAUTH_URL || "https://alphagap.io";

  if (!session?.user?.email) {
    return NextResponse.redirect(`${baseUrl}/pricing`);
  }

  try {
    const plan = PLANS[planKey];
    const stripe = getStripe();
    const user = await getUserByEmail(session.user.email);
    if (!user) return NextResponse.redirect(`${baseUrl}/pricing`);

    // Reuse or create Stripe customer
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

    // Already subscribed — send to dashboard
    if (user.stripeSubscriptionId) {
      const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId).catch(() => null);
      if (sub && (sub.status === "active" || sub.status === "trialing")) {
        return NextResponse.redirect(`${baseUrl}/dashboard?welcome=true`);
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
          },
          recurring: { interval: plan.interval },
          unit_amount: plan.amount,
        },
        quantity: 1,
      }],
      success_url: `${baseUrl}/dashboard?welcome=true`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { userEmail: user.email, userId: user.id, plan: planKey },
      },
    });

    if (!checkoutSession.url) return NextResponse.redirect(`${baseUrl}/pricing`);
    return NextResponse.redirect(checkoutSession.url);
  } catch (e) {
    console.error("[checkout-redirect]", e);
    return NextResponse.redirect(`${baseUrl}/pricing`);
  }
}
