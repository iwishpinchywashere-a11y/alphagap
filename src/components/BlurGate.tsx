"use client";

import Link from "next/link";
import type { Tier } from "@/lib/subscription";

interface BlurGateProps {
  tier: Tier;
  required: "pro" | "premium";
  children: React.ReactNode;
  /** Override the upgrade URL (default: /subscribe) */
  href?: string;
  /** Replace the default label */
  label?: string;
  /** Minimum height of blur area */
  minHeight?: string;
}

/**
 * Wraps content in a blurred overlay when the user's tier is below `required`.
 * Shows a "Get Full Access" / "Upgrade" button centred over the blurred content.
 */
export default function BlurGate({
  tier,
  required,
  children,
  href = "/subscribe",
  label,
  minHeight = "120px",
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
      ? "Premium · $49/mo · All pages"
      : "Pro · $29/mo · Leaderboard, Signals & Reports";

  return (
    <div className="relative overflow-hidden rounded-xl" style={{ minHeight }}>
      {/* Blurred content underneath */}
      <div className="pointer-events-none select-none blur-sm opacity-40">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0f]/60 backdrop-blur-[2px] z-10">
        <div className="text-center px-6 py-8 max-w-xs">
          <div className="text-3xl mb-3">
            {required === "premium" ? "🔐" : "🔒"}
          </div>
          <p className="text-sm text-gray-400 mb-4 leading-relaxed">
            {required === "premium"
              ? "This feature is available on the Premium plan."
              : "This feature is available on the Pro plan."}
          </p>
          <Link
            href={href}
            className="inline-block px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl text-sm hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/20"
          >
            {buttonLabel}
          </Link>
          <p className="text-[11px] text-gray-600 mt-2">{subLabel}</p>
        </div>
      </div>
    </div>
  );
}
