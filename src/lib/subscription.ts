// Subscription tier utilities
// Free    → limited preview on every page
// Pro     → full access to Leaderboard, Signals, Reports ($29/mo)
// Premium → full access to all pages + Oracle (15/day) ($49/mo)
// Ultra   → everything + expanded Oracle (50/day) + exclusive features ($99/mo) [secret]

export type Tier = "free" | "pro" | "premium" | "ultra";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTier(session: any): Tier {
  if (!session?.user) return "free";
  const u = session.user;

  // Admins always get ultra
  if (u.isAdmin) return "ultra";

  // Explicit tier field (new subscriptions)
  if (u.subscriptionTier === "ultra")   return "ultra";
  if (u.subscriptionTier === "premium") return "premium";
  if (u.subscriptionTier === "pro")     return "pro";

  // Backwards compat: existing active subs without a tier → pro
  const s = u.subscriptionStatus as string | undefined;
  if (s === "active" || s === "trialing") return "pro";

  return "free";
}

export function canAccessPro(tier: Tier): boolean {
  return tier === "pro" || tier === "premium" || tier === "ultra";
}

export function canAccessPremium(tier: Tier): boolean {
  return tier === "premium" || tier === "ultra";
}

export function canAccessUltra(tier: Tier): boolean {
  return tier === "ultra";
}

export function tierLabel(tier: Tier): string {
  if (tier === "ultra")   return "Ultra";
  if (tier === "premium") return "Premium";
  if (tier === "pro")     return "Pro";
  return "Free";
}
