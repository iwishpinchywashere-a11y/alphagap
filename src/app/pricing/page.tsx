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
      "Cancel anytime",
    ],
  },
  {
    id: "premium" as const,
    name: "Premium",
    price: "$49",
    period: "/month",
    tagline: "For power users & researchers",
    highlight: false,
    features: [
      "Everything in Pro",
      "🔮 TAO Oracle — live AI chat using data from every subnet (10 queries/day)",
      "📡 Telegram Alerts — 7 customisable alert types, straight to your phone",
      "Investing Analysis — long-term aGap scoring designed for serious investors",
      "Whale & smart money tracking",
      "Twitter/X social momentum feed",
      "Discord scanner finds alpha in real time",
      "Subnet analytics & score history",
      "Portfolio performance tracker",
      "🔍 Wallet Tracker — track any TAO wallet across all subnets",
      "Benchmark comparisons vs AWS/GCP",
      "Pump Autopsy Lab (backtesting)",
      "Early access to new features",
      "Cancel anytime",
    ],
  },
  {
    id: "ultra" as const,
    name: "Ultra",
    price: "$99",
    period: "/month",
    tagline: "For serious investors who want every edge",
    highlight: true,
    features: [
      "Everything in Premium",
      "📊 AlphaGap Index — auto-invest your TAO into the top 10 subnets",
      "🔮 TAO Oracle — 20 queries/day (2× Premium)",
      "Priority access to new Ultra-only features",
      "Cancel anytime",
    ],
  },
];

export default function PricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState<"pro" | "premium" | "ultra" | null>(null);

  async function handleSelect(plan: "pro" | "premium" | "ultra") {
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
          <div className="flex justify-center mb-10">
            <Link href="/">
              <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-9 w-auto" />
            </Link>
          </div>
          <div className="flex justify-center mb-4">
            <span className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
              Simple pricing
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Pick your plan</h1>
          <p className="text-gray-400 text-base">No hidden fees. Cancel anytime. Switch plans anytime.</p>
        </div>

        {/* Oracle feature callout */}
        <div className="mb-8 rounded-2xl border border-green-500/25 bg-gradient-to-r from-green-950/30 to-emerald-950/20 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center text-2xl flex-shrink-0">🔮</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white font-bold text-sm">TAO Oracle — now included in Premium</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 border border-green-400/20 uppercase tracking-widest">New</span>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed">Live AI chat using data from every Bittensor subnet. Ask about whale flows, dev momentum, red flags, top picks — get instant answers in plain English.</p>
          </div>
          <Link
            href="/"
            className="flex-shrink-0 text-xs text-green-400 hover:text-green-300 font-medium transition-colors whitespace-nowrap"
          >
            See it in action →
          </Link>
        </div>

        {/* Plan cards */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-6 flex flex-col ${
                plan.id === "ultra"
                  ? "bg-gradient-to-b from-amber-950/40 to-gray-900/60 border-amber-400/40 shadow-xl shadow-amber-400/10"
                  : "bg-gray-900/60 border-gray-800"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-amber-400 to-orange-400 text-black text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Most Powerful
                  </span>
                </div>
              )}

              <div className="mb-5">
                <div className={`text-sm font-semibold mb-1 ${plan.id === "ultra" ? "text-amber-400" : "text-gray-400"}`}>{plan.name}</div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-gray-500 text-sm mb-1">{plan.period}</span>
                </div>
                <div className="text-xs text-gray-500">{plan.tagline}</div>
              </div>

              <ul className="space-y-2.5 mb-7 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 flex-shrink-0 ${plan.id === "ultra" ? "text-amber-400" : "text-green-400"}`}>✓</span>
                    <span className="text-gray-300">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelect(plan.id)}
                disabled={loading !== null}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  plan.id === "ultra"
                    ? "bg-gradient-to-r from-amber-400 to-orange-400 text-black hover:from-amber-300 hover:to-orange-300 shadow-lg shadow-amber-400/25"
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

        {/* Learn more */}
        <div className="text-center mb-4">
          <Link
            href="/subscribe"
            className="inline-block px-6 py-2.5 border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white rounded-xl text-sm font-medium transition-colors"
          >
            Learn About Pro &amp; Premium →
          </Link>
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
