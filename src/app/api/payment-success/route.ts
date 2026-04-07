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
      sessionEmail ? getUserByEmail(sessionEmail).catch(() => null) : Promise.resolve(null),
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

    // Use blob user we already fetched, or look up by Stripe email if different
    const user = userFromSession ?? await getUserByEmail(email).catch(() => null);

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

    // 3. Set cookie and redirect immediately — don't block on blob writes
    const secure = baseUrl.startsWith("https");
    const cookieName = secure
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

    const response = NextResponse.redirect(`${baseUrl}/dashboard`);
    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    // 4. Fire blob updates without awaiting — webhook handles persistence as backup
    if (user) {
      Promise.all([
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

    return response;

  } catch (e) {
    console.error("[payment-success]", e);
    // On any error, just go to dashboard — they can refresh
    return NextResponse.redirect(`${baseUrl}/dashboard`);
  }
}
