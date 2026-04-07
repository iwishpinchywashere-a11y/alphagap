import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe } from "@/lib/stripe-client";
import { getUserByEmail, updateUser, updateUserListEntry } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const email = session.user.email;

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const stripe = getStripe();
    let subscriptionId = user.stripeSubscriptionId;

    // If we don't have a subscription ID stored, look it up via Stripe
    if (!subscriptionId) {
      const customers = await stripe.customers.list({ email, limit: 5 });
      for (const cust of customers.data) {
        const subs = await stripe.subscriptions.list({
          customer: cust.id,
          status: "active",
          limit: 1,
        });
        if (subs.data.length > 0) {
          subscriptionId = subs.data[0].id;
          break;
        }
      }
    }

    if (!subscriptionId) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
    }

    // Cancel at period end — user keeps access until their billing date
    const sub = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    const periodEnd = (sub as any).current_period_end as number;
    const cancelDate = new Date(periodEnd * 1000).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    // Update the blob so we know cancellation is pending
    await Promise.all([
      updateUser(email, { subscriptionStatus: "active" }), // still active until period end
      updateUserListEntry(email, { subscriptionStatus: "active" }),
    ]).catch(() => {});

    return NextResponse.json({ ok: true, cancelDate, periodEnd });
  } catch (e) {
    console.error("[stripe/cancel]", e);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}
