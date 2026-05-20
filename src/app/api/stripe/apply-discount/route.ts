import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe } from "@/lib/stripe-client";
import { getUserByEmail } from "@/lib/users";

export const dynamic = "force-dynamic";

// Coupon ID we'll reuse across all save offers.
// Created once in Stripe (idempotent) and reused forever.
const SAVE_COUPON_ID = "ALPHAGAP_SAVE40_3MO";

async function getOrCreateCoupon(): Promise<string> {
  const stripe = getStripe();
  try {
    // If coupon already exists, this throws and we catch it below
    const existing = await stripe.coupons.retrieve(SAVE_COUPON_ID);
    return existing.id;
  } catch {
    // Doesn't exist yet — create it
    const coupon = await stripe.coupons.create({
      id: SAVE_COUPON_ID,
      percent_off: 40,
      duration: "repeating",
      duration_in_months: 3,
      name: "40% off — 3 months (save offer)",
    });
    return coupon.id;
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const email = session.user.email;

  try {
    const user = await getUserByEmail(email);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const stripe = getStripe();
    let subscriptionId = user.stripeSubscriptionId;

    // Look up subscription if not stored
    if (!subscriptionId) {
      const customerIds: string[] = [];
      if (user.stripeCustomerId) customerIds.push(user.stripeCustomerId);
      const byEmail = await stripe.customers.list({ email, limit: 5 }).catch(() => null);
      for (const c of byEmail?.data ?? []) {
        if (!customerIds.includes(c.id)) customerIds.push(c.id);
      }
      for (const custId of customerIds) {
        const subs = await stripe.subscriptions.list({ customer: custId, status: "active", limit: 5 }).catch(() => null);
        const match = subs?.data[0];
        if (match) { subscriptionId = match.id; break; }
      }
    }

    if (!subscriptionId) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
    }

    const couponId = await getOrCreateCoupon();

    // Apply coupon to the subscription
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (stripe.subscriptions.update as any)(subscriptionId, {
      coupon: couponId,
    });

    console.log(`[apply-discount] Applied ${SAVE_COUPON_ID} to ${email} sub ${subscriptionId}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[apply-discount]", e);
    return NextResponse.json({ error: "Failed to apply discount" }, { status: 500 });
  }
}
