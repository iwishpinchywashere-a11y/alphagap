import Stripe from "stripe";

// Lazy singleton - only instantiated when first used
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-01-27.acacia",
    });
  }
  return _stripe;
}

/** Legacy single-plan config - kept for backwards compat */
export const PLAN = {
  name: "AlphaGap Pro",
  description: "Full access to AlphaGap Bittensor subnet intelligence",
  amount: 2900,
  currency: "usd",
  interval: "month" as const,
};

export const PLANS = {
  pro: {
    name: "AlphaGap Pro",
    description: "Full leaderboard, signals & reports access",
    amount: 2900,
    currency: "usd",
    interval: "month" as const,
    tier: "pro" as const,
  },
  premium: {
    name: "AlphaGap Premium",
    description: "Full access to all AlphaGap features",
    amount: 4900,
    currency: "usd",
    interval: "month" as const,
    tier: "premium" as const,
  },
  ultra: {
    name: "AlphaGap Ultra",
    description: "AlphaGap Index + 20 Oracle queries/day + full access",
    amount: 9900,
    currency: "usd",
    interval: "month" as const,
    tier: "ultra" as const,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export type SubscriptionTier = "pro" | "premium" | "ultra";

/**
 * Price (cents/month) -> tier. The ONLY tier mapping: payment-success, the
 * Stripe webhook, sync-subscription and the reconcile cron all use it.
 * On 2026-10-12 sync-subscription still carried a "$2 testing" copy that knew
 * only pro/premium, so an Ultra payer was written back to premium seconds
 * after payment-success had minted them ultra.
 */
export function tierFromAmount(cents: number): SubscriptionTier {
  if (cents >= 9900) return "ultra";
  if (cents >= 4900) return "premium";
  return "pro";
}

export function tierFromSubscription(sub: { items: { data: Array<{ price?: { unit_amount?: number | null } | null }> } }): SubscriptionTier {
  return tierFromAmount(sub.items.data[0]?.price?.unit_amount ?? 0);
}

