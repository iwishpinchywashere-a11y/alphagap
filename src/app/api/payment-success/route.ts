/**
 * GET /api/payment-success?session_id={CHECKOUT_SESSION_ID}
 *
 * Stripe redirects here after successful payment (instead of directly to /dashboard).
 * We verify the payment, update the user blob, write a fresh JWT cookie with
 * subscriptionStatus:"active", then redirect to /dashboard.
 *
 * Everything is server-side — no client JS, no polling, no race conditions.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { encode } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { getStripe } from "@/lib/stripe-client";
import { getUserByEmail, updateUser, updateUserListEntry, setStripeCustomerLookup } from "@/lib/users";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

function tierFromSub(sub: Stripe.Subscription): "pro" | "premium" {
  const amount = sub.items.data[0]?.price?.unit_amount ?? 0;
  return amount >= 4900 ? "premium" : "pro";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  const baseUrl = (process.env.NEXTAUTH_URL || "https://alphagap.io").replace(/\/$/, "");

  if (!sessionId) {
    return NextResponse.redirect(`${baseUrl}/dashboard`);
  }

  try {
    const stripe = getStripe();

    // 1. Verify payment with Stripe — run in parallel with user blob lookup
    //    We read the email from the current session cookie so both can start together.
    const session = await getServerSession(authOptions);
    const sessionEmail = session?.user?.email ?? null;

    const [checkoutSession, userFromSession] = await Promise.all([
      stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription", "subscription.items.data.price"],
      }),
      // Retry up to 5× — Vercel Blob propagation delay can cause the user blob
      // to be invisible on the serverless instance handling this redirect.
      sessionEmail ? getUserByEmail(sessionEmail, { retries: 5 }).catch(() => null) : Promise.resolve(null),
    ]);

    if (checkoutSession.payment_status !== "paid") {
      return NextResponse.redirect(`${baseUrl}/pricing?canceled=true`);
    }

    const sub = checkoutSession.subscription as Stripe.Subscription;
    const customerId = sub.customer as string;
    const email =
      (sub.metadata?.userEmail) ||
      checkoutSession.customer_details?.email ||
      sessionEmail ||
      null;

    if (!email) {
      return NextResponse.redirect(`${baseUrl}/dashboard`);
    }

    const tier = tierFromSub(sub);
    const status = "active";
    const periodEnd = (sub as any).current_period_end as number;

    // Use blob user we already fetched, or look up by Stripe email if different.
    // Retry here too — different code path for when session email != sub email.
    const user = userFromSession ?? await getUserByEmail(email, { retries: 5 }).catch(() => null);

    // 2. Encode fresh JWT immediately — this is the critical path for the user experience.
    //    Blob updates happen in parallel below; webhook is the authoritative backup.
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",").map((e: string) => e.trim().toLowerCase()).filter(Boolean);

    const token = await encode({
      token: {
        sub: user?.id ?? "",
        email: email.toLowerCase(),
        name: user?.name ?? "",
        picture: null,
        subscriptionStatus: status,
        subscriptionTier: tier,
        isAdmin: adminEmails.includes(email.toLowerCase()),
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: 30 * 24 * 60 * 60,
    });

    // 3. Persist subscription to blob before redirecting — Vercel terminates the
    //    function as soon as we return, so fire-and-forget won't complete.
    //    Run all three writes in parallel; /activating page will sync-verify via Stripe
    //    as a belt-and-suspenders check once the user lands there.
    if (user) {
      await Promise.all([
        updateUser(email, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          subscriptionStatus: status,
          subscriptionTier: tier,
          subscriptionPeriodEnd: periodEnd,
        }),
        updateUserListEntry(email, { subscriptionStatus: status }),
        setStripeCustomerLookup(email, customerId),
      ]).catch((e) => console.error("[payment-success] blob updates failed:", e));
    }

    // 4. Cancel any other active subscriptions for this customer.
    // One customer should never have two active subscriptions — this handles
    // Pro → Premium upgrades without relying on metadata being threaded correctly.
    try {
      const allSubs = await stripe.subscriptions.list({ customer: customerId, status: "active" });
      for (const oldSub of allSubs.data) {
        if (oldSub.id !== sub.id) {
          await stripe.subscriptions.cancel(oldSub.id);
          console.log(`[payment-success] Cancelled old sub ${oldSub.id} for ${email}`);
        }
      }
    } catch (e) {
      console.error("[payment-success] Failed to cancel old subs:", e);
    }

    // 4. Set cookie and redirect to /activating loading page
    const secure = baseUrl.startsWith("https");
    const cookieName = secure
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

    const response = NextResponse.redirect(`${baseUrl}/activating`);
    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;

  } catch (e) {
    console.error("[payment-success]", e);
    // On any error, just go to dashboard — they can refresh
    return NextResponse.redirect(`${baseUrl}/dashboard`);
  }
}
