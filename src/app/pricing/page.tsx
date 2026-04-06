"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

const PLANS = [
  {
    id: "pro" as const,
    name: "Pro",
    price: "$29",
    period: "/month",
    tagline: "For active Bittensor investors",
    highlight: false,
    features: [
      "Full Alpha Leaderboard (all 128 subnets)",
      "All intelligence signals — unlimited",
      "Daily Deep Dive reports",
      "Whale & smart money tracking",
      "Social / KOL momentum feed",
      "Subnet analytics & score history",
      "Cancel anytime",
    ],
  },
  {
    id: "premium" as const,
    name: "Premium",
    price: "$49",
    period: "/month",
    tagline: "For power users & researchers",
    highlight: true,
    features: [
      "Everything in Pro",
      "Portfolio performance tracker",
      "Pump Autopsy Lab (backtesting)",
      "Benchmark comparisons vs AWS/GCP",
      "Priority data refresh",
      "Early access to new features",
      "Cancel anytime",
    ],
  },
];

export default function PricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState<"pro" | "premium" | null>(null);

  async function handleSelect(plan: "pro" | "premium") {
    setLoading(plan);
    try {
      if (status === "authenticated") {
        // Already logged in — go straight to checkout
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          router.push("/dashboard");
        }
      } else {
        // Not logged in — go to signup with plan pre-selected
        router.push(`/auth/signup?plan=${plan}`);
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-green-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-3xl mx-auto px-4 py-14 sm:py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <Link href="/" className="inline-block mb-10">
            <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-9 w-auto mx-auto" />
          </Link>
          <div className="flex justify-center mb-4">
            <span className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
              Simple pricing
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Pick your plan</h1>
          <p className="text-gray-400 text-base">No hidden fees. Cancel anytime. Switch plans anytime.</p>
        </div>

        {/* Plan cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-6 flex flex-col ${
                plan.highlight
                  ? "bg-gradient-to-b from-green-950/40 to-gray-900/60 border-green-500/40 shadow-xl shadow-green-500/10"
                  : "bg-gray-900/60 border-gray-800"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-black text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-5">
                <div className="text-sm font-semibold text-gray-400 mb-1">{plan.name}</div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-gray-500 text-sm mb-1">{plan.period}</span>
                </div>
                <div className="text-xs text-gray-500">{plan.tagline}</div>
              </div>

              <ul className="space-y-2.5 mb-7 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-gray-300">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelect(plan.id)}
                disabled={loading !== null}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  plan.highlight
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-black hover:from-green-400 hover:to-emerald-500 shadow-lg shadow-green-500/25"
                    : "bg-gray-800 border border-gray-700 text-white hover:bg-gray-700"
                }`}
              >
                {loading === plan.id
                  ? "Loading…"
                  : status === "authenticated"
                  ? `Subscribe to ${plan.name} →`
                  : `Get ${plan.name} →`}
              </button>
            </div>
          ))}
        </div>

        {/* Free tier note */}
        <div className="text-center border border-gray-800 rounded-xl p-4 bg-gray-900/30">
          <p className="text-sm text-gray-400">
            Just browsing?{" "}
            <Link href="/dashboard" className="text-green-400 hover:text-green-300 font-medium transition-colors">
              Explore the free tier →
            </Link>
            <span className="text-gray-600 ml-2">Top 3 signals · Latest report preview · Free leaderboard</span>
          </p>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Payments processed securely by Stripe · No card stored by AlphaGap
        </p>
      </div>
    </div>
  );
}
