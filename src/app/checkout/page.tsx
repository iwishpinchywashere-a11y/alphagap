/**
 * /checkout?plan=pro|premium
 *
 * Server component — session cookies are guaranteed to be present.
 * IMPORTANT: redirect() must NOT be called inside try/catch in Next.js
 * because redirect() works by throwing NEXT_REDIRECT, which catch blocks catch.
 */
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe, PLANS, type PlanKey } from "@/lib/stripe-client";
import { getUserByEmail, setStripeCustomerLookup, updateUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const params = await searchParams;
  const planKey: PlanKey = params.plan === "premium" ? "premium" : "pro";
  const baseUrl = (process.env.NEXTAUTH_URL || "https://alphagap.io").replace(/\/$/, "");

  // ── 1. Auth check ──────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    // Session not found — show debug info instead of silent redirect
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-gray-900 border border-red-500/30 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-white font-bold text-xl mb-2">Session not found</h1>
          <p className="text-gray-400 text-sm mb-6">
            Your account was created but we couldn&apos;t establish a session.
            Please sign in manually to continue to checkout.
          </p>
          <a
            href={`/auth/signin?callbackUrl=${encodeURIComponent(`/checkout?plan=${planKey}`)}`}
            className="inline-block bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold px-6 py-3 rounded-lg text-sm"
          >
            Sign In → Continue to Payment
          </a>
        </div>
      </div>
    );
  }

  // ── 2. Load user + build Stripe checkout URL ───────────────────
  let stripeUrl: string | null = null;
  let errorMsg: string | null = null;

  // Retry up to 3x (1.8s total) to handle Vercel Blob propagation delay
  // after a fresh signup on a different serverless instance
  const user = await getUserByEmail(email, { retries: 3 });

  if (!user) {
    errorMsg = `User record not found for ${email}. This is a temporary sync issue — please try again in a moment.`;
  } else if (user.stripeSubscriptionId) {
    // Already subscribed — check if still active
    const sub = await getStripe().subscriptions.retrieve(user.stripeSubscriptionId).catch(() => null);
    if (sub && (sub.status === "active" || sub.status === "trialing")) {
      redirect("/dashboard?welcome=true");
    }
  }

  if (!errorMsg && user) {
    try {
      const stripe = getStripe();
      const plan = PLANS[planKey];

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { userId: user.id },
        });
        customerId = customer.id;
        await setStripeCustomerLookup(user.email, customerId);
        await updateUser(user.email, { stripeCustomerId: customerId });
      }

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{
          price_data: {
            currency: plan.currency,
            product_data: { name: plan.name, description: plan.description },
            recurring: { interval: plan.interval },
            unit_amount: plan.amount,
          },
          quantity: 1,
        }],
        success_url: `${baseUrl}/dashboard?welcome=true`,
        cancel_url: `${baseUrl}/pricing?canceled=true`,
        allow_promotion_codes: true,
        subscription_data: {
          metadata: { userEmail: user.email, userId: user.id, plan: planKey },
        },
      });

      stripeUrl = checkoutSession.url;
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : "Failed to create checkout session.";
    }
  }

  // ── 3. Redirect or show error ──────────────────────────────────
  // redirect() is called OUTSIDE try/catch so NEXT_REDIRECT propagates correctly
  if (stripeUrl) {
    redirect(stripeUrl);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-gray-900 border border-red-500/30 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-white font-bold text-xl mb-2">Checkout setup failed</h1>
        <p className="text-red-400 text-sm mb-2 font-mono">{errorMsg}</p>
        <p className="text-gray-500 text-xs mb-6">Signed in as: {email}</p>
        <div className="flex gap-3 justify-center">
          <a
            href={`/checkout?plan=${planKey}`}
            className="inline-block bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold px-6 py-3 rounded-lg text-sm"
          >
            Try Again
          </a>
          <a
            href="/pricing"
            className="inline-block bg-gray-800 text-gray-300 px-6 py-3 rounded-lg text-sm"
          >
            Back to Pricing
          </a>
        </div>
      </div>
    </div>
  );
}
