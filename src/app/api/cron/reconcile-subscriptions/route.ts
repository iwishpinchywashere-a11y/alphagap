/**
 * GET /api/cron/reconcile-subscriptions — daily at 05:00 UTC.
 *
 * Stripe is the source of truth for who has paid. Our user blobs are a cache of
 * that, kept in sync by webhooks. Webhooks are not reliable enough to be the
 * only path: they can be missed, they can arrive out of order, and — as
 * happened on 2026-08-06 — they can be handled wrongly.
 *
 * That incident: a customer's April subscription lapsed to past_due. They bought
 * a fresh Ultra subscription on 06 Aug which activated correctly. Stripe then
 * kept retrying the DEAD subscription's invoice for days, and every retry hit an
 * invoice.payment_failed handler with none of the stale-subscription protection
 * that customer.subscription.updated already had. A fully paid-up customer was
 * repeatedly knocked back to past_due and had to be fixed by hand. Nothing in
 * the system would ever have noticed on its own.
 *
 * The webhook guard is the actual fix. This is the safety net underneath it, so
 * that the next billing bug is caught by us rather than reported by the customer.
 *
 * DELIBERATELY ASYMMETRIC. It restores access but never removes it:
 *
 *   - Stripe says paying, we say not  → FIX automatically. This is a paying
 *     customer locked out of what they bought; the worst case of acting is a
 *     few hours of free access, and the worst case of waiting is what happened.
 *   - Stripe says not paying, we say paying → REPORT only, change nothing.
 *     Revoking access in bulk from a reconciler is exactly the kind of thing
 *     that turns one bug into a mass lockout. A human decides those.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe-client";
import { getUserList, getUserByEmail, updateUser, updateUserListEntry } from "@/lib/users";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LIVE = new Set(["active", "trialing"]);

/** Same price-based tier mapping the webhook uses. */
function tierFromAmount(cents: number): "pro" | "premium" | "ultra" {
  if (cents >= 9900) return "ultra";
  if (cents >= 4900) return "premium";
  return "pro";
}

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!isVercelCron) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const stripe = getStripe();
  const fixed: Array<{ email: string; from: string; to: string; tier: string; sub: string }> = [];
  const overGranted: Array<{ email: string; ourStatus: string; stripeHas: string }> = [];
  const stale: Array<{ email: string; onFile: string; live: string }> = [];
  let checked = 0;

  try {
    const users = await getUserList();

    for (const entry of users) {
      const email = entry.email;
      if (!email) continue;

      const user = await getUserByEmail(email);
      if (!user?.stripeCustomerId) continue;
      checked++;

      const subs = await stripe.subscriptions
        .list({ customer: user.stripeCustomerId, status: "all", limit: 20, expand: ["data.items.data.price"] })
        .catch(() => null);
      if (!subs) continue;

      const live = subs.data.filter(s => LIVE.has(s.status));
      const ourStatus = user.subscriptionStatus ?? "none";

      if (live.length > 0) {
        // Newest live subscription wins — that is the one they most recently paid for.
        const best = live.sort((a, b) => b.created - a.created)[0];
        const cents = best.items.data[0]?.price?.unit_amount ?? 0;
        const tier = tierFromAmount(cents);

        if (ourStatus !== "active" || user.subscriptionTier !== tier) {
          await updateUser(email, {
            subscriptionStatus: "active",
            subscriptionTier: tier,
            stripeSubscriptionId: best.id,
            subscriptionPeriodEnd: (best as unknown as { current_period_end: number }).current_period_end,
          });
          await updateUserListEntry(email, { subscriptionStatus: "active", subscriptionTier: tier });
          fixed.push({ email, from: `${ourStatus}/${user.subscriptionTier ?? "none"}`, to: "active", tier, sub: best.id });
          console.warn(`[reconcile] RESTORED ${email}: ${ourStatus}/${user.subscriptionTier} → active/${tier} (${best.id})`);
        } else if (user.stripeSubscriptionId && user.stripeSubscriptionId !== best.id) {
          // Right access, wrong subscription on file — the exact condition that
          // lets a dead subscription's events act on a live customer.
          await updateUser(email, { stripeSubscriptionId: best.id });
          stale.push({ email, onFile: user.stripeSubscriptionId, live: best.id });
          console.warn(`[reconcile] Repointed ${email} to live sub ${best.id} (was ${user.stripeSubscriptionId})`);
        }
      } else if (ourStatus === "active") {
        // Report, never revoke.
        overGranted.push({ email, ourStatus, stripeHas: subs.data.map(s => s.status).join(",") || "no subscriptions" });
        console.warn(`[reconcile] REVIEW ${email}: we say active, Stripe has [${subs.data.map(s => s.status).join(",") || "none"}]`);
      }
    }
  } catch (e) {
    console.error("[reconcile] Failed:", e);
    return NextResponse.json({ success: false, error: String(e), checked, fixed, overGranted }, { status: 500 });
  }

  console.log(`[reconcile] Checked ${checked} paying users — restored ${fixed.length}, repointed ${stale.length}, ${overGranted.length} to review`);
  return NextResponse.json({ success: true, checked, restored: fixed, repointed: stale, review: overGranted });
}
