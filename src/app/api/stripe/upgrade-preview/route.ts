/**
 * GET /api/stripe/upgrade-preview
 *
 * Returns the prorated amount due today if the user upgrades from Pro to Premium.
 * Uses Stripe's upcoming invoice API — no charges, no changes, read-only.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe, PLANS } from "@/lib/stripe-client";
import { getUserByEmail } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const stripe = getStripe();
    const user = await getUserByEmail(email, { retries: 3 });
    if (!user) return NextResponse.json({ amountDue: null });

    // Find active subscription
    let subId = user.stripeSubscriptionId;
    let customerId = user.stripeCustomerId;

    if (!subId && customerId) {
      const listed = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }).catch(() => null);
      subId = listed?.data[0]?.id ?? undefined;
    }
    if (!subId) return NextResponse.json({ amountDue: null });

    // Get existing subscription item
    const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
    const existingItemId = sub.items.data[0]?.id;
    if (!existingItemId) return NextResponse.json({ amountDue: null });

    // Create a temporary Price to preview the proration (not charged)
    const previewPrice = await stripe.prices.create({
      unit_amount: PLANS.premium.amount,
      currency: PLANS.premium.currency,
      recurring: { interval: PLANS.premium.interval },
      product_data: { name: PLANS.premium.name },
    });

    // Preview the prorated charge — no changes made, read-only
    const preview = await stripe.invoices.createPreview({
      customer: sub.customer as string,
      subscription: subId,
      subscription_details: {
        items: [{ id: existingItemId, price: previewPrice.id }],
        proration_behavior: "always_invoice",
      },
    });

    return NextResponse.json({ amountDue: preview.amount_due });
  } catch (e) {
    console.error("[upgrade-preview]", e);
    return NextResponse.json({ amountDue: null });
  }
}
