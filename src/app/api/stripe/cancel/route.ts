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

    /** Look up a live subscription from Stripe directly (by email → customer → sub) */
    async function lookupFromStripe(): Promise<string | undefined> {
      // Try via stored customer ID first (faster)
      const customerIds: string[] = [];
      if (user!.stripeCustomerId) customerIds.push(user!.stripeCustomerId);
      // Also search by email in case customer ID is stale
      const byEmail = await stripe.customers.list({ email, limit: 5 }).catch(() => null);
      for (const c of byEmail?.data ?? []) {
        if (!customerIds.includes(c.id)) customerIds.push(c.id);
      }
      for (const custId of customerIds) {
        // Use "all" to find any subscription regardless of status
        const subs = await stripe.subscriptions.list({ customer: custId, status: "all", limit: 10 }).catch(() => null);
        console.log(`[stripe/cancel] customer ${custId} subs:`, subs?.data.map(s => `${s.id}=${s.status}`).join(", ") || "none");
        // Prefer active/trialing, fall back to past_due
        const ranked = ["active", "trialing", "past_due"];
        for (const st of ranked) {
          const match = subs?.data.find(s => s.status === st);
          if (match) return match.id;
        }
      }
      console.error(`[stripe/cancel] No cancellable subscription found for ${email}, customerIds: ${customerIds.join(", ")}`);
      return undefined;
    }

    // If we don't have a subscription ID stored, look it up via Stripe
    if (!subscriptionId) {
      subscriptionId = await lookupFromStripe();
    }

    if (!subscriptionId) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
    }

    // Cancel at period end — user keeps access until their billing date
    let sub;
    try {
      sub = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } catch (stripeErr: any) {
      // Stored subscription ID is stale — do a fresh lookup and retry once
      console.error("[stripe/cancel] update failed for stored ID, retrying with fresh lookup:", stripeErr?.message);
      subscriptionId = await lookupFromStripe();
      if (!subscriptionId) {
        return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
      }
      sub = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }

    const periodEnd = (sub as any).current_period_end as number;
    const cancelDate = new Date(periodEnd * 1000).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    // Update the blob so we know cancellation is pending; also fix stale sub ID if needed
    const updatePayload: Record<string, unknown> = { subscriptionStatus: "active" };
    if (subscriptionId && subscriptionId !== user.stripeSubscriptionId) {
      updatePayload.stripeSubscriptionId = subscriptionId;
    }
    await Promise.all([
      updateUser(email, updatePayload),
      updateUserListEntry(email, { subscriptionStatus: "active" }),
    ]).catch(() => {});

    return NextResponse.json({ ok: true, cancelDate, periodEnd });
  } catch (e) {
    console.error("[stripe/cancel]", e);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}
