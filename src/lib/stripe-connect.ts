import Stripe from "stripe";

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-01-27.acacia",
  });
}

export async function createConnectAccount(
  email: string,
  userId: string,
): Promise<string> {
  const stripe = getStripe();
  // Do NOT pre-set country or capabilities — Stripe's hosted onboarding will
  // ask the affiliate to choose their country and will configure the correct
  // capabilities for that country automatically. Pre-setting capabilities
  // causes Stripe to default to the platform's home country (CA) for Express
  // accounts, which locks out affiliates in the US, EU, Asia, etc.
  const account = await stripe.accounts.create({
    type: "express",
    email,
    metadata: { userId },
  });
  return account.id;
}

export async function createOnboardingLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string,
): Promise<string> {
  const stripe = getStripe();
  const link = await stripe.accountLinks.create({
    account: accountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: "account_onboarding",
  });
  return link.url;
}

export async function isPayoutsEnabled(accountId: string): Promise<boolean> {
  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(accountId);
  return !!(account.charges_enabled && account.payouts_enabled);
}

export async function createTransfer(
  amount: number,
  currency: string,
  destinationAccountId: string,
  description: string,
): Promise<string> {
  const stripe = getStripe();
  const transfer = await stripe.transfers.create({
    amount,
    currency,
    destination: destinationAccountId,
    description,
  });
  return transfer.id;
}
