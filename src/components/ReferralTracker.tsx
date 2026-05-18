"use client";

import { useEffect } from "react";

// Inline constants — do NOT import from @/lib/referral here.
// referral.ts imports db.ts (better-sqlite3) which is Node-only and
// cannot be bundled into client components.
const COOKIE_NAME = "ag_ref";
const COOKIE_DAYS = 90;

/**
 * ReferralTracker — invisible component that reads the `?ref=` URL param,
 * fires a server-side cookie via /api/referral/track, and sets a client-side
 * fallback cookie. Renders nothing.
 *
 * Include in the root layout only when REFERRAL_ENABLED is set.
 * DO NOT add nav links to /affiliate — the page is accessed directly.
 */
export function ReferralTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref");
    if (!refCode) return;

    // Set client-side cookie as an immediate fallback
    const maxAge = COOKIE_DAYS * 24 * 60 * 60;
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(refCode.toUpperCase())}; max-age=${maxAge}; path=/; samesite=lax`;

    // Also persist server-side via API (sets HttpOnly-style cookie with proper flags)
    fetch("/api/referral/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: refCode }),
    }).catch((e) => console.warn("[ReferralTracker] track request failed:", e));
  }, []);

  return null;
}
