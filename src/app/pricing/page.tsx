"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

function FeatIcon({ name, className = "w-4 h-4" }: { name: string; className?: string }) {
  const p = { viewBox: "0 0 16 16", fill: "none" as const, stroke: "currentColor" as const, strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className };
  if (name === "leaderboard") return <svg {...p}><rect x="1.5" y="9" width="3.5" height="5" rx="0.5"/><rect x="6.5" y="6" width="3.5" height="8" rx="0.5"/><rect x="11" y="3" width="3.5" height="11" rx="0.5"/></svg>;
  if (name === "signals")     return <svg {...p}><polygon points="9 1.5 3 9.5 8 9.5 7 14.5 13 6.5 8 6.5" strokeLinejoin="round"/></svg>;
  if (name === "reports")     return <svg {...p}><rect x="3" y="1.5" width="10" height="13" rx="1.5"/><line x1="5.5" y1="5" x2="10.5" y2="5"/><line x1="5.5" y1="7.5" x2="10.5" y2="7.5"/><line x1="5.5" y1="10" x2="8.5" y2="10"/></svg>;
  if (name === "check")       return <svg {...p}><polyline points="2.5 8 6 12 13.5 4"/></svg>;
  if (name === "cancel")      return <svg {...p}><circle cx="8" cy="8" r="5.5"/><polyline points="8 5.5 8 8 10 10"/></svg>;
  if (name === "oracle")      return <svg {...p}><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>;
  if (name === "alerts")      return <svg {...p}><path d="M8 2A4 4 0 004 6v3.5L2.5 11.5h11L12 9.5V6A4 4 0 008 2z"/><path d="M6.5 11.5a1.5 1.5 0 003 0"/></svg>;
  if (name === "investing")   return <svg {...p}><polyline points="1 11 5 7 9 9.5 15 3.5"/><polyline points="11 3.5 15 3.5 15 7.5"/></svg>;
  if (name === "whale")       return <svg {...p}><path d="M1 9c2-4 4-6 7-6s5 2 7 6"/><path d="M2 12.5c1.5-2 3.5-3 6-3s4.5 1 6 3"/></svg>;
  if (name === "social")      return <svg {...p}><circle cx="5.5" cy="5.5" r="2.5"/><path d="M1 14c0-2.5 2-4 4.5-4"/><circle cx="11" cy="5.5" r="2.5"/><path d="M15 14c0-2.5-2-4-4.5-4S6 11.5 6 14"/></svg>;
  if (name === "discord")     return <svg {...p}><path d="M2.5 2.5h11a1 1 0 011 1v7a1 1 0 01-1 1H5.5l-3 2.5V3.5a1 1 0 011-1z"/><circle cx="5.5" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="7" r="1" fill="currentColor" stroke="none"/></svg>;
  if (name === "analytics")   return <svg {...p}><line x1="1" y1="14" x2="15" y2="14"/><rect x="2" y="10" width="3" height="4" rx="0.5"/><rect x="6.5" y="6.5" width="3" height="7.5" rx="0.5"/><rect x="11" y="8.5" width="3" height="5.5" rx="0.5"/></svg>;
  if (name === "performance") return <svg {...p}><path d="M4.5 14h7"/><line x1="8" y1="14" x2="8" y2="9.5"/><path d="M3.5 6l4.5-3.5L12.5 6v3.5H3.5z"/></svg>;
  if (name === "wallet")      return <svg {...p}><rect x="1.5" y="4.5" width="13" height="9" rx="1.5"/><path d="M1.5 7h13"/><circle cx="11.5" cy="10.5" r="1"/></svg>;
  if (name === "benchmarks")  return <svg {...p}><line x1="1" y1="4.5" x2="9.5" y2="4.5"/><line x1="1" y1="8" x2="13" y2="8"/><line x1="1" y1="11.5" x2="7" y2="11.5"/><circle cx="12" cy="4.5" r="1.5"/><circle cx="5.5" cy="11.5" r="1.5"/></svg>;
  if (name === "pumplab")     return <svg {...p}><line x1="5.5" y1="2" x2="10.5" y2="2"/><path d="M5.5 2v4.5L3 12.5a1 1 0 001 1h8a1 1 0 001-1L10.5 6.5V2"/></svg>;
  if (name === "early")       return <svg {...p}><polygon points="8 2 10 6.5 14.5 6.5 11 9.5 12.5 14 8 11.5 3.5 14 5 9.5 1.5 6.5 6 6.5"/></svg>;
  if (name === "index")       return <svg {...p}><line x1="1" y1="14" x2="15" y2="14"/><line x1="3" y1="14" x2="3" y2="11"/><line x1="6" y1="14" x2="6" y2="7"/><line x1="9" y1="14" x2="9" y2="5"/><line x1="12" y1="14" x2="12" y2="3"/></svg>;
  if (name === "rebalance")   return <svg {...p}><path d="M13.5 5A6 6 0 002 8"/><polyline points="13.5 1.5 13.5 5 10 5"/><path d="M2.5 11A6 6 0 0014 8"/><polyline points="2.5 14.5 2.5 11 6 11"/></svg>;
  if (name === "priority")    return <svg {...p}><polygon points="8 1.5 10 6 14.5 6 11 8.5 12.5 13 8 10.5 3.5 13 5 8.5 1.5 6 6 6"/></svg>;
  return <svg {...p}><polyline points="2.5 8 6 12 13.5 4"/></svg>;
}

type Feature = { icon: string; text: string };

const PLANS: Array<{
  id: "premium" | "ultra";
  name: string;
  price: string;
  period: string;
  tagline: string;
  highlight: boolean;
  features: Feature[];
}> = [
  {
    id: "premium" as const,
    name: "Premium",
    price: "$49",
    period: "/month",
    tagline: "For power users & researchers",
    highlight: false,
    features: [
      { icon: "leaderboard", text: "Full Alpha Leaderboard (all 128 subnets)" },
      { icon: "signals",     text: "All intelligence signals — unlimited" },
      { icon: "reports",     text: "Daily Deep Dive reports" },
      { icon: "oracle",      text: "TAO Oracle — live AI chat using data from every subnet (10 queries/day)" },
      { icon: "alerts",      text: "Telegram Alerts — 7 customisable alert types, straight to your phone" },
      { icon: "investing",   text: "Investing Analysis — long-term aGap scoring for serious investors" },
      { icon: "whale",       text: "Whale & smart money tracking" },
      { icon: "social",      text: "Twitter/X social momentum feed" },
      { icon: "discord",     text: "Discord scanner finds alpha in real time" },
      { icon: "analytics",   text: "Subnet analytics & score history" },
      { icon: "performance", text: "Portfolio performance tracker" },
      { icon: "wallet",      text: "Wallet Tracker — track any TAO wallet across all subnets" },
      { icon: "benchmarks",  text: "Benchmark comparisons vs AWS/GCP" },
      { icon: "pumplab",     text: "Pump Autopsy Lab (backtesting)" },
      { icon: "early",       text: "Early access to new features" },
      { icon: "cancel",      text: "Cancel anytime" },
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
      { icon: "check",     text: "Everything in Premium" },
      { icon: "index",     text: "AlphaGap Index — auto-invest your TAO into the top 10 subnets" },
      { icon: "rebalance", text: "Weekly auto-rebalancing tracks the top 10 as scores shift" },
      { icon: "oracle",    text: "TAO Oracle — 20 queries/day (2× Premium)" },
      { icon: "priority",  text: "Priority access to new Ultra-only features" },
      { icon: "cancel",    text: "Cancel anytime" },
    ],
  },
];

export default function PricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState<"premium" | "ultra" | null>(null);

  async function handleSelect(plan: "premium" | "ultra") {
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

      <div className="relative max-w-5xl mx-auto px-4 py-14 sm:py-20">
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
          <div className="w-11 h-11 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center flex-shrink-0 text-green-400">
            <FeatIcon name="oracle" className="w-5 h-5" />
          </div>
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
        <div className="grid sm:grid-cols-2 gap-4 mb-8 max-w-2xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-6 flex flex-col ${
                plan.id === "ultra"
                  ? "bg-gradient-to-b from-amber-950/40 to-gray-900/60 border-amber-400/40 shadow-xl shadow-amber-400/10"
                  : "bg-gradient-to-b from-purple-950/30 to-gray-900/60 border-purple-500/30 shadow-xl shadow-purple-500/10"
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
                <div className={`text-sm font-semibold mb-1 ${plan.id === "ultra" ? "text-amber-400" : "text-purple-400"}`}>{plan.name}</div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-gray-500 text-sm mb-1">{plan.period}</span>
                </div>
                <div className="text-xs text-gray-500">{plan.tagline}</div>
              </div>

              <ul className="space-y-2.5 mb-7 flex-1">
                {plan.features.map((f) => (
                  <li key={f.text} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 flex-shrink-0 ${plan.id === "ultra" ? "text-amber-400" : "text-purple-400"}`}>
                      <FeatIcon name={f.icon} />
                    </span>
                    <span className="text-gray-300">{f.text}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelect(plan.id)}
                disabled={loading !== null}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  plan.id === "ultra"
                    ? "bg-gradient-to-r from-amber-400 to-orange-400 text-black hover:from-amber-300 hover:to-orange-300 shadow-lg shadow-amber-400/25"
                    : "bg-gradient-to-r from-purple-600 to-violet-700 text-white hover:from-purple-500 hover:to-violet-600 shadow-lg shadow-purple-500/20"
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
            Learn About Premium &amp; Ultra →
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
