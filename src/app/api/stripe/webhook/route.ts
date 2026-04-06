import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe-client";
import { getUserByStripeCustomerId, updateUser, updateUserListEntry } from "@/lib/users";

export const dynamic = "force-dynamic";

// Stripe requires the raw body for signature verification
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig!, webhookSecret);
  } catch (e) {
    console.error("[webhook] Signature verification failed:", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log(`[webhook] ${event.type}`);

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const user = await getUserByStripeCustomerId(sub.customer as string);
        if (user) {
          const status = mapSubStatus(sub.status);
          await updateUser(user.email, {
            stripeSubscriptionId: sub.id,
            subscriptionStatus: status,
            subscriptionPeriodEnd: (sub as any).current_period_end,
          });
          await updateUserListEntry(user.email, { subscriptionStatus: status });
          console.log(`[webhook] Updated ${user.email} → ${status}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const user = await getUserByStripeCustomerId(sub.customer as string);
        if (user) {
          await updateUser(user.email, {
            subscriptionStatus: "canceled",
            subscriptionPeriodEnd: (sub as any).current_period_end,
          });
          await updateUserListEntry(user.email, { subscriptionStatus: "canceled" });
          console.log(`[webhook] Canceled ${user.email}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const sub = (invoice as any).subscription
          ? await getStripe().subscriptions.retrieve((invoice as any).subscription as string).catch(() => null)
          : null;
        if (sub) {
          const user = await getUserByStripeCustomerId(sub.customer as string);
          if (user) {
            await updateUser(user.email, { subscriptionStatus: "past_due" });
            await updateUserListEntry(user.email, { subscriptionStatus: "past_due" });
          }
        }
        break;
      }

      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        if (checkoutSession.mode === "subscription" && checkoutSession.subscription) {
          const sub = await getStripe().subscriptions.retrieve(checkoutSession.subscription as string);
          const user = await getUserByStripeCustomerId(sub.customer as string);
          if (user) {
            await updateUser(user.email, {
              stripeSubscriptionId: sub.id,
              subscriptionStatus: mapSubStatus(sub.status),
              subscriptionPeriodEnd: (sub as any).current_period_end,
            });
            await updateUserListEntry(user.email, { subscriptionStatus: mapSubStatus(sub.status) });
          }
        }
        break;
      }
    }
  } catch (e) {
    console.error("[webhook] Handler error:", e);
    // Return 200 so Stripe doesn't retry — we'll handle errors internally
  }

  return NextResponse.json({ received: true });
}

function mapSubStatus(status: Stripe.Subscription.Status): "active" | "canceled" | "past_due" | "trialing" | "none" {
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
