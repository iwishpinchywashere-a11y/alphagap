/**
 * /checkout?plan=pro|premium
 *
 * Server component — session cookies are guaranteed to be present.
 *
 * IMPORTANT: redirect() must NOT be called inside try/catch in Next.js
 * because redirect() works by throwing NEXT_REDIRECT, which catch blocks catch.
 *
 * DESIGN: We do NOT hard-require the user blob to exist here. On fresh signups
 * the Vercel Blob can take >10s to propagate across serverless instances.
 * All we need for Stripe is email + name + userId — which are already in the
 * session JWT. The webhook fires after payment (30s+) when the blob is
 * guaranteed to exist and does all the subscription status updates.
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

  // ── 2. Best-effort user blob lookup (3 retries / ~1.8s) ───────
  // We do NOT hard-fail if this returns null — session has what we need.
  const user = await getUserByEmail(email, { retries: 3 });

  // Fallback identity from the JWT (always present)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionUserId = ((session.user) as any)?.id as string | undefined;
  const sessionUserName = session.user?.name ?? "";

  // ── 3. Already subscribed? Skip to dashboard ──────────────────
  if (user?.stripeSubscriptionId) {
    const sub = await getStripe()
      .subscriptions.retrieve(user.stripeSubscriptionId)
      .catch(() => null);
    if (sub && (sub.status === "active" || sub.status === "trialing")) {
      redirect("/dashboard?welcome=true");
    }
  }

  // ── 4. Build Stripe checkout ──────────────────────────────────
  let stripeUrl: string | null = null;
  let errorMsg: string | null = null;

  try {
    const stripe = getStripe();
    const plan = PLANS[planKey];

    // Reuse existing Stripe customer if we have one; otherwise create new.
    let customerId = user?.stripeCustomerId;
    if (!customerId) {
      // Search Stripe for an existing customer with this email before creating a new one.
      // This prevents duplicate customers from repeated signups/test payments.
      const existing = await stripe.customers.list({ email, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email,
          name: user?.name ?? sessionUserName,
          metadata: { userId: user?.id ?? sessionUserId ?? "" },
        });
        customerId = customer.id;
      }

      // Always write the email→customerId lookup so the webhook can resolve it.
      await setStripeCustomerLookup(email, customerId);

      // Best-effort: store customerId on user blob.
      if (user) {
        await updateUser(email, { stripeCustomerId: customerId }).catch(() => {});
      }
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: plan.currency,
            product_data: { name: plan.name, description: plan.description },
            recurring: { interval: plan.interval },
            unit_amount: plan.amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/api/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          userEmail: email,
          userId: user?.id ?? sessionUserId ?? "",
          plan: planKey,
        },
      },
    });

    stripeUrl = checkoutSession.url;
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Failed to create checkout session.";
  }

  // ── 5. Redirect or show error ─────────────────────────────────
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
