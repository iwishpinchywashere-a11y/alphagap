/**
 * GET /api/stripe/upgrade-preview?plan=premium|ultra
 *
 * Returns the prorated amount due today if the user upgrades to the given plan.
 * Uses Stripe's upcoming invoice API — no charges, no changes, read-only.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe, PLANS, type PlanKey } from "@/lib/stripe-client";
import { getUserByEmail } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const rawPlan = searchParams.get("plan");
  const planKey: PlanKey = rawPlan === "ultra" ? "ultra" : "premium";
  const targetPlan = PLANS[planKey];

  try {
    const stripe = getStripe();
    const user = await getUserByEmail(email, { retries: 3 });
    if (!user) return NextResponse.json({ amountDue: null });

    // Find active subscription
    let subId = user.stripeSubscriptionId;
    const customerId = user.stripeCustomerId;

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
      unit_amount: targetPlan.amount,
      currency: targetPlan.currency,
      recurring: { interval: targetPlan.interval },
      product_data: { name: targetPlan.name },
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
