"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { getTier, canAccessUltra } from "@/lib/subscription";

/* ── Static data ─────────────────────────────────────────────────────────── */

const INDEX_HOLDINGS = [
  { rank: 1,  netuid: 51,  name: "lium.io",        category: "AI Compute",    agap: 94, weight: 14.2, change: +8.3,  rev: "$5.2M ARR",  thesis: "Revenue exceeds emissions. B200 GPUs. Enterprise-first." },
  { rank: 2,  netuid: 64,  name: "Chutes",          category: "AI Compute",    agap: 91, weight: 13.8, change: +5.1,  rev: "$4.2M ARR",  thesis: "#1 on OpenRouter by traffic. 9.1T tokens processed." },
  { rank: 3,  netuid: 44,  name: "Score",           category: "Physical AI",   agap: 87, weight: 12.1, change: +12.4, rev: "$1.2M ARR",  thesis: "PwC France alliance. Paris Blockchain Week winner." },
  { rank: 4,  netuid: 1,   name: "Apex",            category: "Frontier LLM",  agap: 85, weight: 11.5, change: +3.2,  rev: "Emissions",  thesis: "The original Bittensor subnet. Pioneer status." },
  { rank: 5,  netuid: 9,   name: "Pretrain",        category: "Foundation",    agap: 82, weight: 10.8, change: -1.4,  rev: "Emissions",  thesis: "Foundational model training. Core infrastructure layer." },
  { rank: 6,  netuid: 4,   name: "Targon",          category: "AI Inference",  agap: 79, weight: 10.2, change: +6.7,  rev: "Growing",    thesis: "High-throughput inference with verified outputs." },
  { rank: 7,  netuid: 19,  name: "Nineteen.ai",     category: "AI Compute",    agap: 77, weight: 9.4,  change: +2.1,  rev: "Growing",    thesis: "Part of Rayon Labs trio. Complementary to Chutes." },
  { rank: 8,  netuid: 27,  name: "NI",              category: "Data Scraping", agap: 74, weight: 8.3,  change: -0.8,  rev: "Active",     thesis: "Real-time web intelligence. Enterprise data pipelines." },
  { rank: 9,  netuid: 13,  name: "Data Universe",   category: "Data Storage",  agap: 71, weight: 5.4,  change: +4.5,  rev: "Active",     thesis: "Decentralised data storage. Growing B2B pipeline." },
  { rank: 10, netuid: 8,   name: "Vanta",           category: "AI Audio",      agap: 68, weight: 4.3,  change: +1.9,  rev: "$500K ARR",  thesis: "Audio AI processing. Feb 2026 launch, early traction." },
];

const CATEGORY_COLORS: Record<string, string> = {
  "AI Compute":    "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "Physical AI":   "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "Frontier LLM":  "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  "Foundation":    "bg-teal-500/15 text-teal-400 border-teal-500/20",
  "AI Inference":  "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  "Data Scraping": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "Data Storage":  "bg-rose-500/15 text-rose-400 border-rose-500/20",
  "AI Audio":      "bg-green-500/15 text-green-400 border-green-500/20",
};

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function AlphaGapIndexPage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const isUltra = canAccessUltra(tier);
  const [holdingsTab, setHoldingsTab] = useState<"table" | "thesis">("table");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  return (
    <main className="flex-1 overflow-auto bg-[#0a0a0f]">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div className="relative border-b border-gray-800/60 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.022]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.9) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.9) 1px,transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-56 bg-green-600/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 right-10 w-48 h-48 bg-amber-500/4 rounded-full blur-2xl pointer-events-none" />

        <div className="relative px-4 md:px-10 py-14 max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 tracking-wide">✦ ULTRA EXCLUSIVE</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-gray-800 text-gray-400 border border-gray-700">Powered by TrustedStake</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">↻ Rebalanced Weekly</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">🔐 Non-Custodial</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.05] mb-5 tracking-tight">
            <span className="text-white">AlphaGap </span>
            <span className="bg-gradient-to-r from-green-400 via-emerald-300 to-green-500 bg-clip-text text-transparent">Subnet Index</span>
          </h1>
          <p className="text-gray-400 text-lg sm:text-xl max-w-2xl leading-relaxed mb-8">
            The top 10 Bittensor subnets selected by the <span className="text-green-400 font-semibold">aGap investing formula</span> — algorithmically picked, automatically deployed, and rebalanced every week through TrustedStake&apos;s non-custodial infrastructure.
          </p>

          {/* Stat bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
            {[
              { label: "Subnets Screened",   value: "128",    sub: "every week" },
              { label: "Index Holdings",     value: "10",     sub: "concentrated" },
              { label: "Rebalance Cadence",  value: "Weekly", sub: "Sundays 00:00 UTC" },
              { label: "Custody Model",      value: "0%",     sub: "assets held by us" },
            ].map(s => (
              <div key={s.label} className="bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3">
                <div className="text-2xl font-bold text-white tabular-nums">{s.value}</div>
                <div className="text-xs font-medium text-gray-400 mt-0.5">{s.label}</div>
                <div className="text-xs text-gray-600 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-10 py-10 max-w-6xl mx-auto space-y-12">

        {/* ── MANIFESTO ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div>
            <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Why This Exists</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 leading-snug">
              128 subnets. One portfolio.<br />
              <span className="text-green-400">Zero guesswork.</span>
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Every signal that matters in Bittensor is public and observable. Validator stakes, emissions, benchmark scores, on-chain whale flows, founder Discord posts — it&apos;s all there. The problem isn&apos;t access. It&apos;s processing it.
            </p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Doing this properly requires 1,400+ hours of continuous research. The AlphaGap Subnet Index is what happens when you give that research job to the Oracle — and pipe the output directly into a managed, non-custodial portfolio via TrustedStake.
            </p>
          </div>
          <div className="space-y-3">
            {[
              {
                icon: "🐍",
                title: "The Hydra Problem",
                desc: "Bittensor is constantly evolving. New subnets launch weekly. Existing ones pivot, merge, or collapse. Keeping up requires full-time attention from someone who lives and breathes this ecosystem.",
                color: "border-red-500/15 bg-red-500/5",
              },
              {
                icon: "🏰",
                title: "The Moat Problem",
                desc: "Effective staking requires mastering validator selection, stake allocation game theory, subnet fundamentals, and dTAO mechanics simultaneously. It took the TrustedStake team 1,453 hours to become experts.",
                color: "border-amber-500/15 bg-amber-500/5",
              },
              {
                icon: "⏰",
                title: "The Clock Problem",
                desc: "Without full-time commitment, you miss optimal entry points, rebalancing windows, and subnet launches. By the time you research a new opportunity, whales are already positioned.",
                color: "border-blue-500/15 bg-blue-500/5",
              },
            ].map(p => (
              <div key={p.title} className={`rounded-xl border ${p.color} p-4 flex gap-3`}>
                <span className="text-xl flex-shrink-0">{p.icon}</span>
                <div>
                  <div className="font-semibold text-white text-sm mb-1">{p.title}</div>
                  <p className="text-xs text-gray-500 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">The System</p>
          <h2 className="text-2xl font-bold text-white mb-6">How the index works, step by step</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                step: "01",
                icon: "🔮",
                title: "Oracle Monitors All 128",
                body: "The AlphaGap Oracle ingests live data from every subnet — benchmark scores, external revenue, whale wallet flows, founder Discord activity, GitHub commits, and on-chain emissions. Running continuously, 24/7.",
                color: "border-green-500/20 bg-green-500/5",
                iconBg: "bg-green-500/10 border-green-500/20 text-green-400",
              },
              {
                step: "02",
                icon: "📐",
                title: "aGap Scores Every Subnet",
                body: "Each subnet receives an aGap score (0–100) derived from five weighted dimensions: benchmark performance, external revenue, on-chain momentum, team execution, and market opportunity. Updated weekly.",
                color: "border-blue-500/15 bg-blue-500/5",
                iconBg: "bg-blue-500/10 border-blue-500/20 text-blue-400",
              },
              {
                step: "03",
                icon: "🏆",
                title: "Top 10 Selected Weekly",
                body: "Every Sunday, the formula re-ranks all 128 subnets. The 10 highest-conviction subnets form the index. No emotion, no narrative chasing — only the numbers. Subnets that drop below threshold are rotated out.",
                color: "border-purple-500/15 bg-purple-500/5",
                iconBg: "bg-purple-500/10 border-purple-500/20 text-purple-400",
              },
              {
                step: "04",
                icon: "⚡",
                title: "TrustedStake Executes",
                body: "TrustedStake's infrastructure auto-rebalances your stake to match the new allocation. Validator selection is optimised continuously. Root yield is compounded. You watch the dashboard. They do the work.",
                color: "border-amber-500/15 bg-amber-500/5",
                iconBg: "bg-amber-500/10 border-amber-500/20 text-amber-400",
              },
            ].map(s => (
              <div key={s.step} className={`rounded-2xl border ${s.color} p-5 flex flex-col gap-3`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl border ${s.iconBg} flex items-center justify-center text-xl`}>{s.icon}</div>
                  <span className="text-xs font-bold text-gray-600 tracking-widest">{s.step}</span>
                </div>
                <div className="font-bold text-white text-sm">{s.title}</div>
                <p className="text-xs text-gray-500 leading-relaxed flex-1">{s.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── CURRENT INDEX HOLDINGS ───────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-1">Live Portfolio</p>
              <h2 className="text-2xl font-bold text-white">Current Index Holdings</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-0.5 text-xs">
                <button onClick={() => setHoldingsTab("table")} className={`px-3 py-1.5 rounded-md font-medium transition-colors ${holdingsTab === "table" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>Table</button>
                <button onClick={() => setHoldingsTab("thesis")} className={`px-3 py-1.5 rounded-md font-medium transition-colors ${holdingsTab === "thesis" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>Investment Thesis</button>
              </div>
              <span className="text-xs text-gray-600 border border-gray-800 rounded-lg px-3 py-1.5">Last rebalanced: May 25, 2026</span>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900/40 overflow-hidden relative">
            {/* Weight bar visualisation at top */}
            <div className="flex h-1.5 w-full overflow-hidden">
              {INDEX_HOLDINGS.map((h, i) => (
                <div key={h.netuid} className="h-full" style={{ width: `${h.weight}%`, background: `hsl(${142 - i * 8}, 70%, ${55 - i * 2}%)` }} />
              ))}
            </div>

            <div className={`relative ${!isUltra ? "min-h-[600px]" : ""}`}>
              <div className={!isUltra ? "blur-sm pointer-events-none select-none" : ""}>

                {holdingsTab === "table" && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-600 border-b border-gray-800 bg-gray-900/40">
                          <th className="px-5 py-3">#</th>
                          <th className="px-3 py-3">Subnet</th>
                          <th className="px-3 py-3 hidden md:table-cell">Category</th>
                          <th className="px-3 py-3 hidden lg:table-cell">Revenue</th>
                          <th className="px-3 py-3 text-right">aGap Score</th>
                          <th className="px-3 py-3 text-right">Weight</th>
                          <th className="px-3 py-3 text-right">30d</th>
                          <th className="px-3 py-3 w-6"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {INDEX_HOLDINGS.map((h) => (
                          <React.Fragment key={h.netuid}>
                            <tr
                              className="border-b border-gray-800/50 hover:bg-gray-800/25 transition-colors cursor-pointer"
                              onClick={() => setExpandedRow(expandedRow === h.netuid ? null : h.netuid)}
                            >
                              <td className="px-5 py-3.5">
                                <span className="text-xs font-bold text-gray-600 tabular-nums">{h.rank}</span>
                              </td>
                              <td className="px-3 py-3.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700/60 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0 tabular-nums">{h.netuid}</div>
                                  <div>
                                    <div className="font-semibold text-gray-100 text-sm">{h.name}</div>
                                    <div className="text-xs text-gray-600">SN{h.netuid}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3.5 hidden md:table-cell">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[h.category] ?? "bg-gray-800 text-gray-400 border-gray-700"}`}>{h.category}</span>
                              </td>
                              <td className="px-3 py-3.5 hidden lg:table-cell">
                                <span className="text-xs text-gray-400 font-medium">{h.rev}</span>
                              </td>
                              <td className="px-3 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-20 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                                    <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400" style={{ width: `${h.agap}%` }} />
                                  </div>
                                  <span className="text-sm font-bold text-green-400 tabular-nums w-8 text-right">{h.agap}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <div className="w-16 h-1 rounded-full bg-gray-800 overflow-hidden">
                                    <div className="h-full rounded-full bg-gray-500" style={{ width: `${h.weight * 5}%` }} />
                                  </div>
                                  <span className="text-sm font-semibold text-gray-200 tabular-nums">{h.weight}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-3.5 text-right">
                                <span className={`text-sm font-bold tabular-nums ${h.change >= 0 ? "text-green-400" : "text-red-400"}`}>{h.change >= 0 ? "+" : ""}{h.change}%</span>
                              </td>
                              <td className="px-3 py-3.5">
                                <svg className={`w-3.5 h-3.5 text-gray-600 transition-transform ${expandedRow === h.netuid ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                              </td>
                            </tr>
                            {expandedRow === h.netuid && (
                              <tr className="border-b border-gray-800/50 bg-gray-900/60">
                                <td colSpan={8} className="px-5 py-3">
                                  <div className="flex items-start gap-3">
                                    <span className="text-green-400 mt-0.5">→</span>
                                    <p className="text-xs text-gray-400 leading-relaxed"><span className="font-semibold text-gray-200">Why it&apos;s in:</span> {h.thesis}</p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-5 py-3 border-t border-gray-800 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-gray-600">Click any row to see the investment thesis. Weights are proportional to aGap scores. Total: 100%.</p>
                      <p className="text-xs text-gray-600 italic">Preview data — live allocations reflect actual rebalance</p>
                    </div>
                  </div>
                )}

                {holdingsTab === "thesis" && (
                  <div className="divide-y divide-gray-800/60">
                    {INDEX_HOLDINGS.map((h) => (
                      <div key={h.netuid} className="px-5 py-4 flex items-start gap-4 hover:bg-gray-800/15 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700/60 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0 tabular-nums mt-0.5">{h.netuid}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-gray-100 text-sm">{h.name}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[h.category] ?? "bg-gray-800 text-gray-400 border-gray-700"}`}>{h.category}</span>
                            <span className="text-xs text-gray-600">aGap {h.agap} · {h.weight}% weight</span>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed">{h.thesis}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`text-sm font-bold tabular-nums ${h.change >= 0 ? "text-green-400" : "text-red-400"}`}>{h.change >= 0 ? "+" : ""}{h.change}%</div>
                          <div className="text-xs text-gray-600">30d</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>

              {/* Ultra gate */}
              {!isUltra && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]/65 backdrop-blur-[3px] rounded-b-2xl">
                  <div className="text-center px-8 py-10 rounded-2xl border border-amber-500/20 bg-[#0d0d14] shadow-2xl max-w-sm mx-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl mx-auto mb-4">✦</div>
                    <p className="text-lg font-bold text-white mb-2">Ultra Members Only</p>
                    <p className="text-sm text-gray-500 mb-6">The AlphaGap Subnet Index — live holdings, thesis, and portfolio deploy — is exclusive to Ultra subscribers.</p>
                    <a href="/pricing" className="inline-block bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black text-sm font-bold px-7 py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95">Upgrade to Ultra →</a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── aGAP METHODOLOGY ─────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">The Formula</p>
          <h2 className="text-2xl font-bold text-white mb-2">aGap Investing Methodology</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-2xl leading-relaxed">
            aGap is a multi-factor scoring model built for <strong className="text-gray-300">long-term subnet investing, not short-term trading</strong>. It deliberately deprioritises price momentum in favour of subnets building durable, revenue-generating businesses. The result: lower churn, higher conviction, fewer whipsaw rebalances.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[
              {
                weight: "30%", icon: "📐", label: "Benchmark Performance",
                color: "border-green-500/20 bg-green-500/5",
                bar: "bg-green-500",
                detail: "How the subnet's AI output stacks up against centralised incumbents. We run standardised comparisons across accuracy, throughput, latency, and output quality. A subnet scoring 90+ here is genuinely competing with — or beating — AWS, OpenAI, and Google on its chosen task.",
                examples: ["SN51 lium.io: 90% cheaper than AWS H100s", "SN64 Chutes: #1 on OpenRouter by traffic", "SN44 Score: beats centralized physical AI systems"],
              },
              {
                weight: "25%", icon: "💰", label: "External Revenue",
                color: "border-emerald-500/20 bg-emerald-500/5",
                bar: "bg-emerald-500",
                detail: "Verified, real-world revenue from paying customers outside of TAO emissions. This is the single strongest signal of product-market fit in Bittensor. We only count revenue confirmed by SubnetRadar, TAO Institute, or the team's own published financials — not projections or taorevenue.com staking flow.",
                examples: ["Verified ARR via SubnetRadar or TAO Institute", "Excludes emissions-only revenue", "Fiat-paying enterprise customers weighted highest"],
              },
              {
                weight: "20%", icon: "📈", label: "On-Chain Momentum",
                color: "border-blue-500/20 bg-blue-500/5",
                bar: "bg-blue-500",
                detail: "Stake velocity, whale accumulation patterns, validator confidence, TAO inflow trends, and dTAO mechanics. We track wallet-level movements and flag when sophisticated capital is quietly building positions — before the narrative catches up.",
                examples: ["Whale wallet inflow/outflow tracking", "Validator confidence scores", "dTAO stake velocity and burn rate"],
              },
              {
                weight: "15%", icon: "🏗️", label: "Team & Product Execution",
                color: "border-purple-500/20 bg-purple-500/5",
                bar: "bg-purple-500",
                detail: "GitHub commit frequency, product shipping cadence, founder track record outside Bittensor, community health metrics, and Discord engagement quality. We read the founders — not just the code. Const posts, team announcements, and validator communications all feed in.",
                examples: ["GitHub activity (commits, PRs, contributors)", "Founder background and track record", "Discord/community health signals from the Oracle"],
              },
              {
                weight: "10%", icon: "🌐", label: "Market Opportunity",
                color: "border-amber-500/20 bg-amber-500/5",
                bar: "bg-amber-500",
                detail: "Total addressable market size, competitive differentiation against both centralised and other Bittensor players, and defensibility of the subnet's position. A $400B TAM with a genuine moat scores significantly higher than a $5B TAM in a crowded vertical.",
                examples: ["TAM sourced from public market research", "Bittensor-native competitive mapping", "Defensibility of subnet architecture"],
              },
            ].map(f => (
              <div key={f.label} className={`rounded-xl border ${f.color} p-5 flex flex-col gap-3`}>
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-extrabold text-white tabular-nums">{f.weight}</span>
                  <span className="text-2xl">{f.icon}</span>
                </div>
                <div>
                  <div className="font-bold text-white text-sm mb-0.5">{f.label}</div>
                  <div className="w-full h-1 rounded-full bg-gray-800 overflow-hidden mb-3">
                    <div className={`h-full rounded-full ${f.bar}`} style={{ width: f.weight }} />
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed mb-3">{f.detail}</p>
                  <ul className="space-y-1">
                    {f.examples.map(e => (
                      <li key={e} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <span className="text-gray-700 mt-0.5 flex-shrink-0">·</span>{e}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Selection rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Inclusion Rules</p>
              <ul className="space-y-2.5">
                {[
                  "Minimum aGap score of 65 required for index eligibility",
                  "Maximum 3 subnets per category (prevents sector concentration)",
                  "Minimum 90 days of live on-chain data required",
                  "No subnet with unconfirmed or fabricated revenue claims",
                  "Subnets must have active validator competition (no monopoly)",
                ].map(r => (
                  <li key={r} className="flex items-start gap-2 text-xs text-gray-400">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Rebalance Rules</p>
              <ul className="space-y-2.5">
                {[
                  "Rebalance only occurs if top-10 composition changes — no unnecessary churn",
                  "New entrant must score ≥5 points higher than the subnet it displaces",
                  "Maximum 3 rotations per rebalance to limit transaction costs",
                  "Weights recalculated every rebalance based on relative aGap scores",
                  "Emergency rebalance can be triggered if a subnet is abandoned or exploited",
                ].map(r => (
                  <li key={r} className="flex items-start gap-2 text-xs text-gray-400">
                    <span className="text-blue-500 mt-0.5 flex-shrink-0">→</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-green-500/15 bg-green-500/5 p-5 flex gap-3">
            <span className="text-green-400 text-lg flex-shrink-0 mt-0.5">💡</span>
            <div>
              <p className="text-sm font-semibold text-green-300 mb-1">Investing, not trading — by design</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                The aGap formula specifically excludes short-term price momentum as a primary factor. A subnet whose token pumped 200% this week scores no differently on aGap than it did last week — unless its fundamentals changed. This means the index naturally filters out speculation-driven rotations and holds subnets that are genuinely building. Compare this to a momentum-only strategy like TaoGalaxy&apos;s daily-rebalanced indexes, which track price strength rather than business quality.
              </p>
            </div>
          </div>
        </div>

        {/* ── TRUSTEDSTAKE DEEP DIVE ───────────────────────────────────────── */}
        <div>
          <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Our Partner</p>
          <h2 className="text-2xl font-bold text-white mb-2">TrustedStake Infrastructure</h2>
          <p className="text-gray-500 text-sm mb-8 max-w-2xl leading-relaxed">
            TrustedStake is the non-custodial enterprise staking layer for the Bittensor ecosystem. Their platform handles the full complexity of managing multi-subnet positions — so the AlphaGap Index can stay focused on what to hold, not how to hold it.
          </p>

          {/* Core capabilities */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[
              {
                icon: "🔐",
                title: "Non-Custodial by Design",
                body: "Your TAO never leaves your wallet. TrustedStake executes staking operations on your behalf through smart contract-level delegations — they never hold, touch, or have access to your assets. Complete asset control, always.",
                tag: "Core Architecture",
                tagColor: "bg-green-500/10 text-green-400",
              },
              {
                icon: "⚙️",
                title: "Automated Rebalancing Engine",
                body: "Their systems make thousands of micro-optimisation decisions per day — adjusting stake weights, switching validators, and rebalancing across subnets. When the AlphaGap Index rotates on Sunday, TrustedStake executes the full transition automatically.",
                tag: "Yield Engine",
                tagColor: "bg-blue-500/10 text-blue-400",
              },
              {
                icon: "🎯",
                title: "Optimal Validator Selection",
                body: "Continuous monitoring of all validators across every held subnet. TrustedStake automatically moves your stake to the highest-performing validators to maximise yield, switching when better opportunities emerge — without any manual action required.",
                tag: "Yield Engine",
                tagColor: "bg-blue-500/10 text-blue-400",
              },
              {
                icon: "🔄",
                title: "Root Yield Auto-Compounding",
                body: "Root network yield (generated passively from holding positions) is automatically reinvested back into your index positions. This compounds your exposure over time without manual intervention, accelerating portfolio growth on a risk-free basis.",
                tag: "Yield Engine",
                tagColor: "bg-blue-500/10 text-blue-400",
              },
              {
                icon: "🛡️",
                title: "Enterprise-Grade Security",
                body: "Built for institutions. TrustedStake's infrastructure follows enterprise security standards — the same level of rigour used by their partners at Kraken Institutional. Every operation is auditable, transparent, and cryptographically verifiable.",
                tag: "Security",
                tagColor: "bg-purple-500/10 text-purple-400",
              },
              {
                icon: "📊",
                title: "Transparent Reporting",
                body: "Every rebalance, every validator switch, every compounded yield event is logged and visible in your dashboard. No black boxes. You can see exactly what TrustedStake did, when they did it, and why — tied directly to the AlphaGap Index changes.",
                tag: "Transparency",
                tagColor: "bg-amber-500/10 text-amber-400",
              },
              {
                icon: "🌐",
                title: "128+ Subnets Accessible",
                body: "TrustedStake supports the full breadth of the Bittensor ecosystem. The AlphaGap Index uses the top 10, but their infrastructure is built to handle broad diversification across the entire network if the formula ever expands.",
                tag: "Coverage",
                tagColor: "bg-teal-500/10 text-teal-400",
              },
              {
                icon: "⚡",
                title: "One-Click Deploy",
                body: "Connect your compatible wallet (Talisman, SubWallet), choose your TAO allocation, confirm — you're in. No manual staking across 10 individual subnets. No tracking validator APYs. No rebalancing spreadsheets. One click.",
                tag: "UX",
                tagColor: "bg-indigo-500/10 text-indigo-400",
              },
              {
                icon: "🤝",
                title: "Aligned Incentives",
                body: "TrustedStake earns when you earn. Their fee structure is performance-aligned, not fixed-cost — meaning they're incentivised to maximise your yield, not just keep your assets deployed. White-glove service for institutional-scale positions.",
                tag: "Alignment",
                tagColor: "bg-rose-500/10 text-rose-400",
              },
            ].map(f => (
              <div key={f.title} className="bg-gray-900/50 rounded-xl border border-gray-800 p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-2xl">{f.icon}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${f.tagColor}`}>{f.tag}</span>
                </div>
                <div className="font-bold text-white text-sm">{f.title}</div>
                <p className="text-xs text-gray-500 leading-relaxed flex-1">{f.body}</p>
              </div>
            ))}
          </div>

          {/* TrustedStake portfolio comparison */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/40 overflow-hidden mb-4">
            <div className="px-6 py-4 border-b border-gray-800">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">TrustedStake Index Options — Context</p>
              <p className="text-xs text-gray-600 mt-1">TrustedStake offers these portfolios independently. The AlphaGap Index is a custom strategy powered by our aGap formula — separate from their off-the-shelf options.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-600 border-b border-gray-800 bg-gray-900/40">
                    <th className="px-5 py-3">Index</th>
                    <th className="px-4 py-3">Coverage</th>
                    <th className="px-4 py-3">Style</th>
                    <th className="px-4 py-3">Rebalance</th>
                    <th className="px-4 py-3 hidden md:table-cell">Comparable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {[
                    { name: "Universe Index", cov: "40+ subnets", style: "Broad market exposure", reb: "Performance-based", comp: "S&P 500 equivalent", highlight: false },
                    { name: "Top 15 Index", cov: "15 subnets", style: "Blue-chip concentrated", reb: "Performance-based", comp: "S&P 100 equivalent", highlight: false },
                    { name: "Sector Indexes", cov: "Themed (AI, DeFi, Compute)", style: "Sector exposure", reb: "Performance-based", comp: "Sector ETFs", highlight: false },
                    { name: "Company Indexes", cov: "Team-focused portfolios", style: "Founder/team conviction", reb: "Performance-based", comp: "Thematic funds", highlight: false },
                    { name: "⚡ AlphaGap Index", cov: "Top 10 by aGap score", style: "Fundamental investing", reb: "Weekly (aGap-driven)", comp: "Active fund strategy", highlight: true },
                  ].map(row => (
                    <tr key={row.name} className={`${row.highlight ? "bg-green-500/5 border-l-2 border-l-green-500/40" : ""} hover:bg-gray-800/15 transition-colors`}>
                      <td className={`px-5 py-3 font-semibold ${row.highlight ? "text-green-400" : "text-gray-300"}`}>{row.name}</td>
                      <td className="px-4 py-3 text-gray-500">{row.cov}</td>
                      <td className="px-4 py-3 text-gray-500">{row.style}</td>
                      <td className="px-4 py-3 text-gray-500">{row.reb}</td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{row.comp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-5 flex gap-3">
            <span className="text-blue-400 text-lg flex-shrink-0 mt-0.5">🤝</span>
            <div>
              <p className="text-sm font-semibold text-blue-300 mb-1">Partnership — Early Stage</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                The AlphaGap × TrustedStake integration is in active development. The aGap formula and index methodology are complete. TrustedStake&apos;s infrastructure is live and managing real assets. The integration layer — connecting the two directly inside this dashboard — is the final piece. Ultra subscribers get early access the moment it ships.
              </p>
              <a href="https://trustedstake.ai" target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2">Visit trustedstake.ai ↗</a>
            </div>
          </div>
        </div>

        {/* ── vs COMPETITORS ───────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">How We Compare</p>
          <h2 className="text-2xl font-bold text-white mb-2">AlphaGap Index vs. alternatives</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-2xl leading-relaxed">
            Other Bittensor index products exist. Here&apos;s how the AlphaGap Index differs in approach, methodology, and depth.
          </p>
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-600 border-b border-gray-800 bg-gray-900/50">
                    <th className="px-5 py-4">Feature</th>
                    <th className="px-4 py-4 text-green-400 font-bold">AlphaGap Index</th>
                    <th className="px-4 py-4 text-gray-500">TaoGalaxy Momentum</th>
                    <th className="px-4 py-4 text-gray-500 hidden md:table-cell">TrustedStake Universe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {[
                    ["Picking methodology",       "Fundamental (aGap formula)",    "Price momentum + on-chain",    "Research + performance metrics"],
                    ["Rebalance frequency",        "Weekly",                        "Daily",                        "Performance-based"],
                    ["Revenue as a factor",        "✓ 25% weight (verified only)",  "✗ Not a primary factor",       "Partial"],
                    ["Whale flow tracking",        "✓ Real-time Oracle monitoring", "✓ On-chain signals",           "Internal research"],
                    ["Founder signal tracking",    "✓ Discord + Oracle",            "✗",                            "✗"],
                    ["Custody model",              "Non-custodial (TrustedStake)",  "Dashboard only (no deploy)",   "Non-custodial"],
                    ["Auto-deploy TAO",            "✓ Coming soon",                 "✗ Manual",                     "✓ Live"],
                    ["Holdings count",             "10 (concentrated)",             "Variable daily",               "40+ (broad)"],
                    ["Investment horizon",         "Long-term fundamental",         "Short-term momentum",          "Medium-term"],
                  ].map(([feat, ag, tg, ts]) => (
                    <tr key={feat} className="hover:bg-gray-800/15 transition-colors">
                      <td className="px-5 py-3 text-xs text-gray-500 font-medium">{feat}</td>
                      <td className="px-4 py-3 text-xs text-green-400 font-medium">{ag}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{tg}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{ts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── ORACLE INTEGRATION ───────────────────────────────────────────── */}
        <div className="rounded-2xl border border-green-500/15 bg-gradient-to-br from-green-500/5 via-emerald-500/5 to-transparent p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-3xl flex-shrink-0">🔮</div>
            <div>
              <h3 className="text-xl font-bold text-white mb-1">The Oracle is the intelligence layer</h3>
              <p className="text-gray-500 text-sm leading-relaxed max-w-xl">
                The AlphaGap Index isn&apos;t a static formula run on a spreadsheet. It&apos;s powered by the Oracle — which continuously reads live subnet data, founder communications, whale wallet movements, and benchmark results to keep aGap scores current.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { icon: "📡", title: "Live Data Ingestion", desc: "Every Oracle query across all 128 subnets feeds back into the scoring model. The more you ask, the smarter the index gets." },
              { icon: "📣", title: "Founder Signal Detection", desc: "The Oracle monitors Discord for posts from key founders (Const, subnet builders). Material announcements update relevance scores before the market reacts." },
              { icon: "🐋", title: "Whale Flow Tracking", desc: "On-chain wallet movements from large TAO holders are tracked in real-time. Unusual accumulation in a subnet triggers immediate score review." },
            ].map(f => (
              <div key={f.title} className="bg-green-500/5 border border-green-500/10 rounded-xl p-4">
                <span className="text-xl">{f.icon}</span>
                <div className="font-semibold text-white text-sm mt-2 mb-1">{f.title}</div>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-sm text-gray-500">Want to dig into any subnet before the next rebalance? Ask the Oracle directly.</p>
            <a href="/oracle" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/25 text-green-400 text-sm font-semibold rounded-xl transition-colors flex-shrink-0">
              Open the Oracle
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </a>
          </div>
        </div>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Questions</p>
          <h2 className="text-2xl font-bold text-white mb-6">Frequently asked</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                q: "Is my TAO safe? Who holds it?",
                a: "Nobody holds your TAO except you. TrustedStake operates a fully non-custodial model — they execute delegations on your behalf through Bittensor's native staking mechanics, but your assets remain in your wallet at all times. You can verify every position on-chain.",
              },
              {
                q: "What wallets are supported?",
                a: "TrustedStake integrates with Talisman and SubWallet — the two leading Bittensor-native wallets. Both are available as browser extensions and mobile apps. You do not need a centralised exchange account.",
              },
              {
                q: "How much TAO do I need to participate?",
                a: "Minimum allocation thresholds will be confirmed at launch. Early indications from TrustedStake suggest a practical minimum of around 1 TAO to make rebalancing costs worthwhile relative to position size.",
              },
              {
                q: "How often does the index change?",
                a: "The index rebalances every Sunday at 00:00 UTC. The formula will only rotate subnets if the new candidate scores at least 5 points higher than the one it displaces — preventing unnecessary churn from minor score fluctuations.",
              },
              {
                q: "What fees are involved?",
                a: "The AlphaGap Index methodology is included in your Ultra subscription. TrustedStake charges a separate performance-aligned management fee for execution. Full fee structure will be published at launch.",
              },
              {
                q: "Can I still access the Oracle to research subnets?",
                a: "Yes. The Oracle runs independently of the Index. You can query any of the 128 subnets, ask about current holdings, challenge the methodology, or research subnets not currently in the index. Ultra members get 50 Oracle queries per day.",
              },
              {
                q: "How is this different from just staking on taostats.io?",
                a: "Manual staking on taostats requires you to pick subnets, choose validators, monitor performance, and rebalance manually. The AlphaGap Index handles subnet selection (via aGap formula), validator optimisation, yield compounding, and weekly rebalancing automatically — saving the 1,400+ hours TrustedStake estimates it takes to do this properly.",
              },
              {
                q: "When does this launch?",
                a: "The integration is in active development. Ultra subscribers will be first to know and first to access early deployment. Join the early access list below and we'll reach out directly.",
              },
            ].map(faq => (
              <div key={faq.q} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                <p className="font-semibold text-white text-sm mb-2">{faq.q}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        {isUltra ? (
          <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/8 via-orange-500/4 to-transparent p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl mx-auto mb-5">⚡</div>
            <h2 className="text-2xl font-bold text-white mb-2">You&apos;re on the list</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
              As an Ultra subscriber, you have priority access to the AlphaGap Index the moment the TrustedStake integration launches. We&apos;ll reach out directly — no queue.
            </p>
            <a
              href="mailto:hello@alphagap.io?subject=AlphaGap Subnet Index — Ultra Early Access"
              className="inline-block bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black text-sm font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95"
            >
              Confirm Early Access →
            </a>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl mx-auto mb-5">✦</div>
            <h2 className="text-2xl font-bold text-white mb-2">Unlock the AlphaGap Index</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
              The AlphaGap Subnet Index is exclusive to Ultra subscribers. Upgrade to access live holdings, methodology details, portfolio deploy, and 50 Oracle queries per day.
            </p>
            <a href="/pricing" className="inline-block bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black text-sm font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95">
              Upgrade to Ultra →
            </a>
          </div>
        )}

      </div>
    </main>
  );
}
