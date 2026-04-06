/**
 * /checkout?plan=pro|premium
 *
 * Server component — session cookies are guaranteed to be present when
 * this page renders, so getServerSession never returns null due to timing.
 * Creates a Stripe checkout session and immediately redirects to Stripe.
 */
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe, PLANS, type PlanKey } from "@/lib/stripe-client";
import { getUserByEmail, setStripeCustomerLookup, updateUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const params = await searchParams;
  const planKey: PlanKey = params.plan === "premium" ? "premium" : "pro";

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/pricing");
  }

  const baseUrl = (process.env.NEXTAUTH_URL || "https://alphagap.io").replace(/\/$/, "");

  try {
    const plan = PLANS[planKey];
    const stripe = getStripe();
    const user = await getUserByEmail(session.user.email);
    if (!user) redirect("/pricing");

    // Already subscribed → send straight to dashboard
    if (user.stripeSubscriptionId) {
      const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId).catch(() => null);
      if (sub && (sub.status === "active" || sub.status === "trialing")) {
        redirect("/dashboard?welcome=true");
      }
    }

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

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{
        price_data: {
          currency: plan.currency,
          product_data: { name: plan.name, description: plan.description },
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

    if (!checkoutSession.url) redirect("/pricing");
    redirect(checkoutSession.url);
  } catch {
    redirect("/pricing");
  }
}
