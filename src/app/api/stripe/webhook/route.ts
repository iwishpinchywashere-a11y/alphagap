import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe-client";
import { getUserByStripeCustomerId, updateUser, updateUserListEntry } from "@/lib/users";
import { getAttributionByReferredUser, recordCommission, payPendingCommissions } from "@/lib/referral";
import { sendSubscriptionConfirmationEmail } from "@/lib/email";

/** Detect tier from subscription price amount (in cents) */
function tierFromSub(sub: Stripe.Subscription): "pro" | "premium" | "ultra" {
  const amount = sub.items.data[0]?.price?.unit_amount ?? 0;
  if (amount >= 9900) return "ultra";
  if (amount >= 4900) return "premium";
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
        const subRaw = event.data.object as Stripe.Subscription;
        // Re-retrieve with expanded items so price.unit_amount is available.
        // Webhook event objects don't expand nested objects by default.
        const sub = await getStripe().subscriptions.retrieve(subRaw.id, {
          expand: ["items.data.price"],
        }).catch(() => subRaw);
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
          await updateUserListEntry(user.email, { subscriptionStatus: status, subscriptionTier });
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
        // This handler used to mark the user past_due for ANY failed invoice,
        // with none of the old-subscription protection that
        // customer.subscription.updated already had. That is a real incident,
        // not a theoretical gap:
        //
        //   A customer's April subscription went past_due. They bought a fresh
        //   Ultra subscription on 2026-08-06 which went active correctly. But
        //   Stripe keeps retrying the dead subscription's invoice for weeks,
        //   and every retry landed here and knocked a fully paid-up customer
        //   back to past_due. They lost access and it had to be fixed by hand.
        //
        // A failed invoice on a subscription the user has moved on from says
        // nothing about whether they are currently paying. Only act when the
        // invoice belongs to the subscription we actually have on file, and
        // re-check Stripe for any other live subscription before downgrading.
        const invoice = event.data.object as Stripe.Invoice;
        const sub = (invoice as any).subscription
          ? await getStripe().subscriptions.retrieve((invoice as any).subscription as string).catch(() => null)
          : null;
        if (sub) {
          const user = await getUserByStripeCustomerId(sub.customer as string);
          if (user) {
            if (user.stripeSubscriptionId && user.stripeSubscriptionId !== sub.id) {
              console.log(`[webhook] payment_failed on stale sub ${sub.id} (current: ${user.stripeSubscriptionId}) — ignoring`);
              break;
            }
            // Even for the sub on file, confirm the customer has nothing else
            // live before removing access. Cheap call, and the failure mode it
            // prevents is charging someone and locking them out.
            const live = await getStripe().subscriptions.list({
              customer: sub.customer as string,
              status: "active",
              limit: 10,
            }).catch(() => null);
            const otherActive = live?.data.find(s => s.id !== sub.id);
            if (otherActive) {
              console.log(`[webhook] payment_failed on ${sub.id} but ${otherActive.id} is active — keeping access`);
              break;
            }
            await updateUser(user.email, { subscriptionStatus: "past_due" });
            await updateUserListEntry(user.email, { subscriptionStatus: "past_due" });
            console.log(`[webhook] ${user.email} → past_due (sub ${sub.id})`);
          }
        }
        break;
      }

      // ── Referral commissions ──────────────────────────────────────────────
      case "invoice.payment_succeeded": {
        if (!process.env.REFERRAL_ENABLED) break;
        const invoice = event.data.object as Stripe.Invoice;
        const amountPaid = (invoice as unknown as { amount_paid: number }).amount_paid ?? 0;
        // Skip free / $0 invoices (trials, etc.)
        if (amountPaid <= 0) break;
        try {
          const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
          if (!customerId) break;
          const referredUser = await getUserByStripeCustomerId(customerId);
          if (!referredUser) break;
          const attribution = await getAttributionByReferredUser(referredUser.id);
          if (!attribution) break;
          const chargeId = typeof (invoice as unknown as { charge: string | null }).charge === "string"
            ? ((invoice as unknown as { charge: string }).charge)
            : "";
          await recordCommission(referredUser.id, invoice.id, chargeId, amountPaid);
          await payPendingCommissions();
        } catch (e) {
          console.error("[webhook] Referral commission handling error:", e);
        }
        break;
      }
      // ─────────────────────────────────────────────────────────────────────

      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        if (checkoutSession.mode === "subscription" && checkoutSession.subscription) {
          const sub = await getStripe().subscriptions.retrieve(checkoutSession.subscription as string, { expand: ["items.data.price"] });
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
            await updateUserListEntry(user.email, { subscriptionStatus: status, subscriptionTier });

            // Cancel any other active subscriptions for this customer (upgrade deduplication).
            // payment-success already attempts this synchronously; this is the backup.
            try {
              const allSubs = await getStripe().subscriptions.list({ customer: customerId, status: "active" });
              for (const oldSub of allSubs.data) {
                if (oldSub.id !== sub.id) {
                  await getStripe().subscriptions.cancel(oldSub.id);
                  console.log(`[webhook] Cancelled old sub ${oldSub.id} for ${user.email}`);
                }
              }
            } catch (e) {
              console.error("[webhook] Failed to cancel old subs:", e);
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
