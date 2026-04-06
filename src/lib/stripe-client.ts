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

export const PLAN = {
  name: "AlphaGap Pro",
  description: "Full access to AlphaGap Bittensor subnet intelligence",
  amount: 1900, // $19.00 in cents
  currency: "usd",
  interval: "month" as const,
};
