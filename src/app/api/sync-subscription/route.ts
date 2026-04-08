/**
 * POST /api/sync-subscription
 *
 * Called from the dashboard after returning from Stripe payment.
 * Directly fetches the user's subscription from Stripe and updates the
 * user blob — so we don't depend on the webhook arriving first.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe } from "@/lib/stripe-client";
import { getUserByEmail, updateUser, updateUserListEntry, setStripeCustomerLookup } from "@/lib/users";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

function tierFromAmount(amount: number): "pro" | "premium" {
  return amount >= 200 ? "premium" : "pro"; // threshold: $2 testing (restore to 4900 for launch)
}

function mapStatus(status: Stripe.Subscription.Status): "active" | "trialing" | "past_due" | "canceled" | "none" {
  switch (status) {
    case "active": return "active";
    case "trialing": return "trialing";
    case "past_due": return "past_due";
    case "canceled":
    case "incomplete_expired":
    case "unpaid":
    case "paused":
      return "canceled";
    default: return "none";
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const stripe = getStripe();
    const user = await getUserByEmail(email, { retries: 3 });

    if (!user) {
      return NextResponse.json({ status: "no_user" });
    }

    // If already active/trialing at the expected tier, nothing to do.
    // But don't early-exit during an upgrade — the blob tier may have just changed.
    const sessionTier = session?.user?.subscriptionTier;
    if (
      (user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing") &&
      user.subscriptionTier === sessionTier
    ) {
      return NextResponse.json({ status: user.subscriptionStatus, tier: user.subscriptionTier });
    }

    // Look up subscriptions via Stripe customer ID, or search by email
    let activeSub: Stripe.Subscription | null = null;

    if (user.stripeCustomerId) {
      const subs = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        limit: 5,
        expand: ["data.items.data.price"],
      });
      activeSub = subs.data.find(
        (s) => s.status === "active" || s.status === "trialing"
      ) ?? null;
    }

    // Fallback: search by email if no customer ID stored yet
    if (!activeSub) {
      const customers = await stripe.customers.list({ email, limit: 5 });
      for (const cust of customers.data) {
        const subs = await stripe.subscriptions.list({
          customer: cust.id,
          limit: 5,
          expand: ["data.items.data.price"],
        });
        const found = subs.data.find(
          (s) => s.status === "active" || s.status === "trialing"
        );
        if (found) {
          activeSub = found;
          // Write lookup blob for future webhook use
          await setStripeCustomerLookup(email, cust.id).catch(() => {});
          break;
        }
      }
    }

    if (!activeSub) {
      return NextResponse.json({ status: user.subscriptionStatus ?? "none" });
    }

    const status = mapStatus(activeSub.status);
    const amount = activeSub.items.data[0]?.price?.unit_amount ?? 0;
    const tier = tierFromAmount(amount);
    const periodEnd = (activeSub as any).current_period_end as number;

    await updateUser(email, {
      stripeCustomerId: activeSub.customer as string,
      stripeSubscriptionId: activeSub.id,
      subscriptionStatus: status,
      subscriptionTier: tier,
      subscriptionPeriodEnd: periodEnd,
    });
    await updateUserListEntry(email, { subscriptionStatus: status });

    return NextResponse.json({ status, tier });
  } catch (e) {
    console.error("[sync-subscription]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
