"use client";

import Link from "next/link";
import type { Tier } from "@/lib/subscription";

interface BlurGateProps {
  tier: Tier;
  required: "pro" | "premium";
  children: React.ReactNode;
  /** Override the upgrade URL (default: /subscribe) */
  href?: string;
  /** Replace the default button label */
  label?: string;
  /** Minimum height of blur area */
  minHeight?: string;
}

/**
 * Wraps content in a lightly-blurred overlay — visible but unreadable.
 * The "Get Full Access" button sits near the top so it's immediately obvious.
 */
export default function BlurGate({
  tier,
  required,
  children,
  href = "/subscribe",
  label,
  minHeight = "200px",
}: BlurGateProps) {
  const hasAccess =
    required === "pro"
      ? tier === "pro" || tier === "premium"
      : tier === "premium";

  if (hasAccess) return <>{children}</>;

  const buttonLabel =
    label ??
    (required === "premium" ? "Upgrade to Premium →" : "Get Full Access →");

  const subLabel =
    required === "premium"
      ? "Premium · $49/mo · Unlocks all pages"
      : "Pro · $29/mo · Leaderboard, Signals & Reports";

  return (
    <div className="relative overflow-hidden rounded-xl" style={{ minHeight }}>
      {/* Content: light blur so you can see there's stuff but can't read it */}
      <div className="pointer-events-none select-none" style={{ filter: "blur(4px)", opacity: 0.55 }}>
        {children}
      </div>

      {/* Overlay — button anchored to top */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-start pt-8 bg-[#0a0a0f]/40">
        <div className="text-center px-6">
          <Link
            href={href}
            className="inline-block px-8 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl text-base hover:from-green-400 hover:to-emerald-500 transition-all shadow-xl shadow-green-500/30"
          >
            {buttonLabel}
          </Link>
          <p className="text-xs text-gray-500 mt-2">{subLabel}</p>
        </div>
      </div>
    </div>
  );
}
