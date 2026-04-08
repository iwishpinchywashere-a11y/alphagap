import Stripe from "stripe";

// Lazy singleton — only instantiated when first used
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-01-27.acacia",
    });
  }
  return _stripe;
}

/** Legacy single-plan config — kept for backwards compat */
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
} as const;

export type PlanKey = keyof typeof PLANS;
