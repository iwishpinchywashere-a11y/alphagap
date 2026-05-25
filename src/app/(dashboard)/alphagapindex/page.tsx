"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { getTier, canAccessUltra } from "@/lib/subscription";

/* ── Placeholder index holdings ─────────────────────────────────────────── */
const INDEX_HOLDINGS = [
  { rank: 1,  netuid: 51,  name: "lium.io",       category: "AI Compute",    agap: 94, weight: 14.2, change: +8.3  },
  { rank: 2,  netuid: 64,  name: "Chutes",         category: "AI Compute",    agap: 91, weight: 13.8, change: +5.1  },
  { rank: 3,  netuid: 44,  name: "Score",          category: "Physical AI",   agap: 87, weight: 12.1, change: +12.4 },
  { rank: 4,  netuid: 1,   name: "Apex",           category: "Frontier LLM",  agap: 85, weight: 11.5, change: +3.2  },
  { rank: 5,  netuid: 9,   name: "Pretrain",       category: "Foundation",    agap: 82, weight: 10.8, change: -1.4  },
  { rank: 6,  netuid: 4,   name: "Targon",         category: "AI Inference",  agap: 79, weight: 10.2, change: +6.7  },
  { rank: 7,  netuid: 19,  name: "Nineteen.ai",    category: "AI Compute",    agap: 77, weight: 9.4,  change: +2.1  },
  { rank: 8,  netuid: 27,  name: "NI",             category: "Data Scraping", agap: 74, weight: 8.3,  change: -0.8  },
  { rank: 9,  netuid: 13,  name: "Data Universe",  category: "Data Storage",  agap: 71, weight: 5.4,  change: +4.5  },
  { rank: 10, netuid: 8,   name: "Vanta",          category: "AI Audio",      agap: 68, weight: 4.3,  change: +1.9  },
];

const CATEGORY_COLORS: Record<string, string> = {
  "AI Compute":    "bg-blue-500/15 text-blue-400",
  "Physical AI":   "bg-purple-500/15 text-purple-400",
  "Frontier LLM":  "bg-indigo-500/15 text-indigo-400",
  "Foundation":    "bg-teal-500/15 text-teal-400",
  "AI Inference":  "bg-cyan-500/15 text-cyan-400",
  "Data Scraping": "bg-amber-500/15 text-amber-400",
  "Data Storage":  "bg-rose-500/15 text-rose-400",
  "AI Audio":      "bg-green-500/15 text-green-400",
};

export default function AlphaGapIndexPage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const isUltra = canAccessUltra(tier);
  const [activeTab, setActiveTab] = useState<"holdings" | "methodology" | "partner">("holdings");

  return (
    <main className="flex-1 overflow-auto">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative border-b border-gray-800/50 overflow-hidden">
        {/* Grid bg */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-48 bg-green-600/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-64 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative px-4 md:px-8 py-12 max-w-6xl mx-auto">
          {/* Badge row */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
              ✦ Ultra Exclusive
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
              Powered by TrustedStake
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              ↻ Rebalanced Weekly
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-6 md:gap-10">
            <div className="flex-1">
              <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-3">
                <span className="text-white">AlphaGap </span>
                <span className="bg-gradient-to-r from-green-400 via-emerald-300 to-green-400 bg-clip-text text-transparent">
                  Subnet Index
                </span>
              </h1>
              <p className="text-gray-400 text-base sm:text-lg max-w-xl leading-relaxed">
                The top 10 Bittensor subnets selected by our proprietary{" "}
                <span className="text-green-400 font-semibold">aGap investing formula</span>{" "}
                — automatically managed, non-custodially deployed, and rebalanced every week.
              </p>
            </div>

            {/* Hero stats */}
            <div className="flex gap-4 md:gap-6 flex-shrink-0">
              {[
                { label: "Subnets Tracked", value: "128" },
                { label: "Index Holdings", value: "10" },
                { label: "Rebalance Cadence", value: "Weekly" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5 whitespace-nowrap">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 py-8 max-w-6xl mx-auto space-y-8">

        {/* ── How It Works ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              step: "01",
              icon: "🔮",
              title: "Oracle Scores Every Subnet",
              desc: "The AlphaGap Oracle continuously analyzes all 128 subnets — benchmarks, revenue, whale activity, and on-chain signals — generating live aGap scores.",
              color: "border-green-500/20 bg-green-500/5",
              iconBg: "bg-green-500/10 border-green-500/20",
            },
            {
              step: "02",
              icon: "📊",
              title: "Top 10 Selected Weekly",
              desc: "Every Sunday, the formula re-ranks all subnets. The 10 highest-conviction investments replace any that have dropped out. No emotion. No guessing.",
              color: "border-blue-500/15 bg-blue-500/5",
              iconBg: "bg-blue-500/10 border-blue-500/20",
            },
            {
              step: "03",
              icon: "⚡",
              title: "TrustedStake Auto-Deploys",
              desc: "Your TAO is deployed across the index via TrustedStake's non-custodial infrastructure. You keep full custody. They handle the staking execution.",
              color: "border-purple-500/15 bg-purple-500/5",
              iconBg: "bg-purple-500/10 border-purple-500/20",
            },
          ].map(card => (
            <div key={card.step} className={`rounded-2xl border ${card.color} p-5`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl border ${card.iconBg} flex items-center justify-center text-xl`}>
                  {card.icon}
                </div>
                <span className="text-xs font-bold text-gray-600 tracking-widest">{card.step}</span>
              </div>
              <h3 className="font-bold text-white mb-2 text-sm">{card.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Main Panel ───────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/40 overflow-hidden">

          {/* Tabs */}
          <div className="flex items-center gap-0 border-b border-gray-800 px-4 pt-1">
            {([
              { key: "holdings",    label: "Current Holdings" },
              { key: "methodology", label: "aGap Methodology" },
              { key: "partner",     label: "TrustedStake" },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-green-400 text-green-400"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}

            <div className="ml-auto pr-2 pb-1 flex items-center gap-2">
              <span className="text-xs text-gray-600">Last rebalanced:</span>
              <span className="text-xs font-medium text-gray-400">May 25, 2026</span>
            </div>
          </div>

          {/* ── Holdings Tab ─────────────────────────────────────────────── */}
          {activeTab === "holdings" && (
            <div className={`relative ${!isUltra ? "min-h-[520px]" : ""}`}>
              <div className={!isUltra ? "blur-sm pointer-events-none select-none" : ""}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-600 border-b border-gray-800">
                        <th className="px-5 py-3 w-8">#</th>
                        <th className="px-3 py-3">Subnet</th>
                        <th className="px-3 py-3 hidden sm:table-cell">Category</th>
                        <th className="px-3 py-3 text-right">aGap Score</th>
                        <th className="px-3 py-3 text-right">Weight</th>
                        <th className="px-3 py-3 text-right">30d Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {INDEX_HOLDINGS.map((h) => (
                        <tr key={h.netuid} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                          <td className="px-5 py-3.5 text-xs font-bold text-gray-600 tabular-nums">{h.rank}</td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">
                                {h.netuid}
                              </div>
                              <div>
                                <div className="font-semibold text-gray-100">{h.name}</div>
                                <div className="text-xs text-gray-600">SN{h.netuid}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 hidden sm:table-cell">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[h.category] ?? "bg-gray-800 text-gray-400"}`}>
                              {h.category}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
                                  style={{ width: `${h.agap}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-green-400 tabular-nums w-8">{h.agap}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-right">
                            <span className="text-sm font-semibold text-gray-200 tabular-nums">{h.weight}%</span>
                          </td>
                          <td className="px-3 py-3.5 text-right">
                            <span className={`text-sm font-bold tabular-nums ${h.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {h.change >= 0 ? "+" : ""}{h.change}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between">
                  <p className="text-xs text-gray-600">Weights reflect aGap score proportions. Rebalanced every Sunday 00:00 UTC.</p>
                  <span className="text-xs text-gray-600 italic">Preview data — live allocations available after deploy</span>
                </div>
              </div>

              {/* Ultra gate overlay */}
              {!isUltra && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]/60 backdrop-blur-[2px] rounded-b-2xl">
                  <div className="text-center px-8 py-10 rounded-2xl border border-amber-500/20 bg-[#0d0d14] shadow-2xl shadow-amber-500/5 max-w-sm mx-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl mx-auto mb-4">
                      ✦
                    </div>
                    <p className="text-lg font-bold text-white mb-2">Ultra Members Only</p>
                    <p className="text-sm text-gray-500 mb-6">
                      The AlphaGap Subnet Index is exclusive to Ultra subscribers.
                    </p>
                    <a
                      href="/pricing"
                      className="inline-block bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black text-sm font-bold px-7 py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                    >
                      Upgrade to Ultra →
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Methodology Tab ──────────────────────────────────────────── */}
          {activeTab === "methodology" && (
            <div className="p-6 md:p-8 space-y-8">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">The aGap Investing Formula</h2>
                <p className="text-sm text-gray-500 leading-relaxed max-w-2xl">
                  aGap is AlphaGap&apos;s proprietary multi-factor scoring model designed for long-term subnet investing — not short-term trading. Every subnet is evaluated across five dimensions, producing a composite score from 0–100.
                </p>
              </div>

              {/* Formula dimensions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: "Benchmark Performance",  pct: "30%", icon: "📐", desc: "How the subnet's AI output measures against centralized incumbents. Accuracy, throughput, quality." },
                  { label: "External Revenue",        pct: "25%", icon: "💰", desc: "Verified real-world revenue from paying customers outside of emissions. The strongest signal." },
                  { label: "On-Chain Momentum",       pct: "20%", icon: "📈", desc: "Stake velocity, whale accumulation patterns, validator confidence and TAO inflow trends." },
                  { label: "Team & Product Maturity", pct: "15%", icon: "🏗️", desc: "Product shipping cadence, founder track record, community health and roadmap execution." },
                  { label: "Market Opportunity",      pct: "10%", icon: "🌐", desc: "TAM size, competitive differentiation, and defensibility of the subnet's position." },
                ].map(f => (
                  <div key={f.label} className="bg-gray-900/60 rounded-xl border border-gray-800 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{f.icon}</span>
                      <span className="text-2xl font-extrabold text-green-400 tabular-nums">{f.pct}</span>
                    </div>
                    <div className="font-semibold text-white text-sm mb-1">{f.label}</div>
                    <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-green-500/15 bg-green-500/5 p-5">
                <div className="flex gap-3">
                  <span className="text-green-400 text-lg flex-shrink-0 mt-0.5">💡</span>
                  <div>
                    <p className="text-sm font-semibold text-green-300 mb-1">Investing, not trading</p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      The aGap formula is built for fundamental investors. It deliberately deprioritizes short-term price momentum in favour of subnets building durable, revenue-generating businesses on Bittensor. The result: lower churn, higher conviction, fewer whipsaw rebalances.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Selection Rules</p>
                <ul className="space-y-2">
                  {[
                    "Minimum benchmark score of 60 required for eligibility",
                    "No more than 3 subnets from the same category (prevents sector concentration)",
                    "Subnets with unconfirmed or fabricated revenue claims are excluded",
                    "New subnets must have at least 90 days of on-chain data",
                    "Rebalance only if top-10 composition changes — no unnecessary churn",
                  ].map(rule => (
                    <li key={rule} className="flex items-start gap-2.5 text-sm text-gray-400">
                      <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ── TrustedStake Tab ─────────────────────────────────────────── */}
          {activeTab === "partner" && (
            <div className="p-6 md:p-8 space-y-8">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-lg">
                      🤝
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white leading-tight">Powered by TrustedStake</h2>
                      <a href="https://trustedstake.ai" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">
                        trustedstake.ai ↗
                      </a>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed max-w-xl">
                    TrustedStake provides non-custodial enterprise staking infrastructure for the Bittensor ecosystem. Their platform handles stake allocation, validator selection, and continuous rebalancing — you always retain full custody of your TAO.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    icon: "🔐",
                    title: "Non-Custodial",
                    desc: "Your TAO never leaves your wallet. TrustedStake executes staking operations on your behalf without ever holding your assets.",
                  },
                  {
                    icon: "⚙️",
                    title: "Automated Rebalancing",
                    desc: "When AlphaGap updates the index every Sunday, TrustedStake automatically rotates your stake to match the new top-10 allocation.",
                  },
                  {
                    icon: "🎯",
                    title: "Optimal Validator Selection",
                    desc: "Continuous monitoring selects the highest-performing validators for each subnet, maximising your staking yield on every position.",
                  },
                  {
                    icon: "📊",
                    title: "Root Yield Auto-Compounding",
                    desc: "Root network yield is automatically compounded back into your index positions, growing your exposure over time without manual intervention.",
                  },
                  {
                    icon: "🔄",
                    title: "One-Click Deploy",
                    desc: "Connect your wallet, choose your TAO allocation, and you're in. The index handles everything else — no spreadsheets, no manual staking across 10 subnets.",
                  },
                  {
                    icon: "📡",
                    title: "Live Portfolio Tracking",
                    desc: "Track your index positions, yield, and rebalance history directly inside the AlphaGap dashboard. Full transparency on every move.",
                  },
                ].map(f => (
                  <div key={f.title} className="flex gap-3 bg-gray-900/60 rounded-xl border border-gray-800 p-4">
                    <span className="text-xl flex-shrink-0 mt-0.5">{f.icon}</span>
                    <div>
                      <div className="font-semibold text-white text-sm mb-1">{f.title}</div>
                      <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-5">
                <div className="flex gap-3">
                  <span className="text-blue-400 text-lg flex-shrink-0 mt-0.5">ℹ️</span>
                  <div>
                    <p className="text-sm font-semibold text-blue-300 mb-1">Partnership Status</p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      The AlphaGap × TrustedStake integration is currently in development. Ultra subscribers will receive early access before public launch, with direct portfolio deployment available from within this dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Oracle Integration Banner ─────────────────────────────────────── */}
        <div className="rounded-2xl border border-green-500/15 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-transparent p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-2xl flex-shrink-0">
            🔮
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white mb-1">The Oracle watches. The Index acts.</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              The AlphaGap Oracle continuously monitors every subnet — whale activity, benchmark shifts, revenue signals, Discord chatter from founders. When the data moves, the index methodology captures it at the next weekly rebalance.
            </p>
          </div>
          <div className="flex-shrink-0">
            <a
              href="/oracle"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/25 text-green-400 text-sm font-semibold rounded-xl transition-colors"
            >
              Ask the Oracle
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </div>

        {/* ── Deploy CTA ───────────────────────────────────────────────────── */}
        {isUltra && (
          <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/8 via-orange-500/5 to-transparent p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl mx-auto mb-5">
              ⚡
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Ready to deploy your TAO?</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
              The full TrustedStake integration is coming soon. Join the early access list and you&apos;ll be first in when it launches.
            </p>
            <a
              href="mailto:hello@alphagap.io?subject=AlphaGap Subnet Index — Early Access"
              className="inline-block bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black text-sm font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95"
            >
              Join Early Access →
            </a>
          </div>
        )}

      </div>
    </main>
  );
}
