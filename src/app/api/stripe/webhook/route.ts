import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe-client";
import { getUserByStripeCustomerId, updateUser, updateUserListEntry } from "@/lib/users";
import { sendSubscriptionConfirmationEmail } from "@/lib/email";

/** Detect tier from subscription price amount (in cents) */
function tierFromSub(sub: Stripe.Subscription): "pro" | "premium" {
  const amount = sub.items.data[0]?.price?.unit_amount ?? 0;
  if (amount >= 200) return "premium"; // threshold: $2 testing (restore to 4900 for launch)
  return "pro";
}

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
          // Don't let an old subscription's event downgrade an already-active user.
          // Allow if: no current sub stored, OR this IS the current sub, OR this sub is active/trialing.
          const isCurrentSub = !user.stripeSubscriptionId || user.stripeSubscriptionId === sub.id;
          const isUpgrade = sub.status === "active" || sub.status === "trialing";
          const wouldDowngrade = user.subscriptionStatus === "active" && !isCurrentSub && !isUpgrade;
          if (wouldDowngrade) {
            console.log(`[webhook] Skipping update from old sub ${sub.id} to avoid downgrade`);
            break;
          }
          const status = mapSubStatus(sub.status);
          const subscriptionTier = tierFromSub(sub);
          await updateUser(user.email, {
            stripeSubscriptionId: sub.id,
            subscriptionStatus: status,
            subscriptionTier,
            subscriptionPeriodEnd: (sub as any).current_period_end,
          });
          await updateUserListEntry(user.email, { subscriptionStatus: status });
          console.log(`[webhook] Updated ${user.email} → ${status} (${subscriptionTier})`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const user = await getUserByStripeCustomerId(sub.customer as string);
        if (user) {
          // Only cancel if this is the user's CURRENT subscription.
          // Ignore deletion events for old subscriptions (previous test payments etc.)
          // so stale webhook retries don't overwrite an active status.
          if (user.stripeSubscriptionId && user.stripeSubscriptionId !== sub.id) {
            console.log(`[webhook] Ignoring deletion of old sub ${sub.id} (current: ${user.stripeSubscriptionId})`);
            break;
          }
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
          const customerId = sub.customer as string;
          const user = await getUserByStripeCustomerId(customerId);
          if (user) {
            const status = mapSubStatus(sub.status);
            const subscriptionTier = tierFromSub(sub);
            const periodEnd = (sub as any).current_period_end as number;
            const amountCents = sub.items.data[0]?.price?.unit_amount ?? 0;
            await updateUser(user.email, {
              stripeCustomerId: customerId, // ensure stored even if checkout skipped it
              stripeSubscriptionId: sub.id,
              subscriptionStatus: status,
              subscriptionTier,
              subscriptionPeriodEnd: periodEnd,
            });
            await updateUserListEntry(user.email, { subscriptionStatus: status });

            // Cancel the previous subscription if this was an upgrade
            // The old sub ID is stored in the checkout session metadata
            const prevSubId = checkoutSession.metadata?.previousSubscriptionId
              || sub.metadata?.previousSubscriptionId;
            if (prevSubId && prevSubId !== sub.id) {
              await getStripe().subscriptions.cancel(prevSubId).catch((e) =>
                console.error(`[webhook] Failed to cancel old sub ${prevSubId}:`, e)
              );
              console.log(`[webhook] Cancelled old sub ${prevSubId} after upgrade for ${user.email}`);
            }

            // Send subscription confirmation email
            sendSubscriptionConfirmationEmail(
              user.name,
              user.email,
              subscriptionTier,
              amountCents,
              periodEnd,
            ).catch((e) => console.error("[webhook] confirmation email failed:", e));
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
