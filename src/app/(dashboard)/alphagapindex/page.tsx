"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { getTier, canAccessUltra } from "@/lib/subscription";

/* ── SVG Icons ───────────────────────────────────────────────────────────── */
const IconChart = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const IconShield = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const IconZap = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);
const IconTarget = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
  </svg>
);
const IconRefresh = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);
const IconLayers = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
  </svg>
);
const IconTrend = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);
const IconDollar = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </svg>
);
const IconUsers = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const IconGlobe = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
);
const IconArrow = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);
const IconCheck = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconChevron = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* ── Data ────────────────────────────────────────────────────────────────── */
const INDEX_HOLDINGS = [
  { rank: 1,  netuid: 51,  name: "lium.io",       category: "AI Compute",    agap: 94, weight: 14.2, change: +8.3,  rev: "$5.2M ARR",  thesis: "Revenue exceeds emissions — one of the only subnets where external demand outpaces the TAO subsidy. B200 GPU access when other providers are sold out." },
  { rank: 2,  netuid: 64,  name: "Chutes",         category: "AI Compute",    agap: 91, weight: 13.8, change: +5.1,  rev: "$4.2M ARR",  thesis: "#1 provider on OpenRouter by traffic. 9.1T tokens processed. 85% cheaper than AWS Lambda. TAO Institute verified ARR." },
  { rank: 3,  netuid: 44,  name: "Score",          category: "Physical AI",   agap: 87, weight: 12.1, change: +12.4, rev: "$1.2M ARR",  thesis: "PwC France alliance confirmed. Paris Blockchain Week winner 2026. Physical AI computer vision with $150K/month client revenue." },
  { rank: 4,  netuid: 1,   name: "Apex",           category: "Frontier LLM",  agap: 85, weight: 11.5, change: +3.2,  rev: "Emissions",  thesis: "The original Bittensor subnet. Pioneer network status. Foundational to the entire ecosystem's legitimacy and validator set." },
  { rank: 5,  netuid: 9,   name: "Pretrain",       category: "Foundation",    agap: 82, weight: 10.8, change: -1.4,  rev: "Emissions",  thesis: "Core foundation model training layer. Infrastructure-level importance to Bittensor's long-term AI output quality." },
  { rank: 6,  netuid: 4,   name: "Targon",         category: "AI Inference",  agap: 79, weight: 10.2, change: +6.7,  rev: "Growing",    thesis: "High-throughput inference with on-chain verified outputs. Growing developer adoption and API usage." },
  { rank: 7,  netuid: 19,  name: "Nineteen.ai",    category: "AI Compute",    agap: 77, weight: 9.4,  change: +2.1,  rev: "Growing",    thesis: "Part of Rayon Labs trio alongside Chutes (SN64) and SN56. Coordinated compute layer with strategic synergies." },
  { rank: 8,  netuid: 27,  name: "NI",             category: "Data",          agap: 74, weight: 8.3,  change: -0.8,  rev: "Active",     thesis: "Real-time web intelligence and structured data pipelines. Enterprise B2B use cases with recurring demand." },
  { rank: 9,  netuid: 13,  name: "Data Universe",  category: "Data Storage",  agap: 71, weight: 5.4,  change: +4.5,  rev: "Active",     thesis: "Decentralised data storage with growing B2B pipeline. Early traction in the $200B+ cloud storage market." },
  { rank: 10, netuid: 8,   name: "Vanta",          category: "AI Audio",      agap: 68, weight: 4.3,  change: +1.9,  rev: "$500K ARR",  thesis: "Audio AI processing launched Feb 2026. Early enterprise traction. Founder has 20+ years at Netflix, Disney, and Spotify." },
];

const CAT_STYLE: Record<string, { dot: string; text: string }> = {
  "AI Compute":   { dot: "bg-blue-400",   text: "text-blue-400" },
  "Physical AI":  { dot: "bg-violet-400", text: "text-violet-400" },
  "Frontier LLM": { dot: "bg-indigo-400", text: "text-indigo-400" },
  "Foundation":   { dot: "bg-teal-400",   text: "text-teal-400" },
  "AI Inference": { dot: "bg-cyan-400",   text: "text-cyan-400" },
  "Data":         { dot: "bg-amber-400",  text: "text-amber-400" },
  "Data Storage": { dot: "bg-rose-400",   text: "text-rose-400" },
  "AI Audio":     { dot: "bg-green-400",  text: "text-green-400" },
};

/* ── Component ───────────────────────────────────────────────────────────── */
export default function AlphaGapIndexPage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const isUltra = canAccessUltra(tier);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <main className="flex-1 overflow-auto bg-[#080810]">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/5">
        {/* Background layers */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16,185,129,0.08) 0%, transparent 70%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 40% 60% at 80% 50%, rgba(245,158,11,0.04) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 opacity-[0.018]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative px-6 md:px-12 pt-16 pb-14 max-w-5xl mx-auto">
          {/* Pill badges */}
          <div className="flex flex-wrap gap-2 mb-8">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Ultra Exclusive
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full bg-white/5 text-gray-400 border border-white/8">
              <IconShield className="w-3 h-3" /> Non-Custodial
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full bg-white/5 text-gray-400 border border-white/8">
              <IconRefresh className="w-3 h-3" /> Weekly Rebalance
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full bg-white/5 text-gray-400 border border-white/8">
              Powered by TrustedStake
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[0.95] mb-6">
            <span className="block text-white">AlphaGap</span>
            <span className="block bg-gradient-to-r from-emerald-300 via-green-400 to-emerald-500 bg-clip-text text-transparent">Subnet Index</span>
          </h1>

          <p className="text-gray-400 text-lg sm:text-xl max-w-xl leading-relaxed mb-10">
            The top 10 Bittensor subnets — selected by our proprietary{" "}
            <span className="text-emerald-400 font-semibold">aGap formula</span>, automatically deployed via TrustedStake, and rebalanced every Sunday.
          </p>

          {/* Divider line */}
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/30 to-transparent" />
            <span className="text-xs text-gray-400 font-medium tracking-widest uppercase">Fundamental. Systematic. Non-custodial.</span>
            <div className="h-px flex-1 bg-gradient-to-l from-emerald-500/30 to-transparent" />
          </div>
        </div>
      </section>

      <div className="px-6 md:px-12 max-w-5xl mx-auto">

        {/* ── THE PROBLEM ─────────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest mb-4">Why This Exists</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-5">
                128 subnets.<br />
                <span className="text-gray-500">One portfolio.</span><br />
                Zero guesswork.
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                Every signal that matters in Bittensor is public and observable. Validator stakes, emissions, benchmark scores, whale flows, founder comms — it&apos;s all there. The problem isn&apos;t access. It&apos;s processing it.
              </p>
              <p className="text-gray-500 text-sm leading-relaxed">
                TrustedStake estimates it takes over 1,400 hours to become a competent Bittensor investor. The AlphaGap Subnet Index is what happens when you give that research job to the Oracle — and pipe the output directly into a managed, non-custodial portfolio.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  icon: <IconLayers className="w-4 h-4" />,
                  color: "text-red-400 bg-red-500/10 border-red-500/20",
                  title: "The Hydra Problem",
                  desc: "New subnets launch every week. Existing ones pivot, merge, or collapse. Keeping up requires someone living and breathing this ecosystem full-time.",
                },
                {
                  icon: <IconShield className="w-4 h-4" />,
                  color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                  title: "The Moat Problem",
                  desc: "Mastering validator selection, dTAO mechanics, and stake allocation game theory simultaneously took the TrustedStake team 1,453 hours.",
                },
                {
                  icon: <IconChart className="w-4 h-4" />,
                  color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                  title: "The Clock Problem",
                  desc: "Without full-time attention, you miss optimal entries, rebalancing windows, and new launches. By the time you research an opportunity, whales are already in.",
                },
              ].map(p => (
                <div key={p.title} className="flex gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${p.color}`}>
                    {p.icon}
                  </div>
                  <div>
                    <div className="font-semibold text-white text-base mb-1">{p.title}</div>
                    <p className="text-sm text-gray-300 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest mb-4">The System</p>
          <h2 className="text-3xl font-black text-white mb-10">How it works</h2>

          <div className="relative">

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  n: "01",
                  icon: <IconChart className="w-5 h-5" />,
                  color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                  glow: "shadow-emerald-500/10",
                  title: "Oracle Monitors All 128",
                  body: "Live ingestion of benchmark scores, revenue data, whale wallet flows, founder Discord activity, and on-chain emissions across every subnet — 24/7.",
                },
                {
                  n: "02",
                  icon: <IconTarget className="w-5 h-5" />,
                  color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                  glow: "shadow-blue-500/10",
                  title: "aGap Scores Each Subnet",
                  body: "Our proprietary formula evaluates every subnet across performance, revenue, on-chain signals, team execution, and market opportunity. Scores updated weekly.",
                },
                {
                  n: "03",
                  icon: <IconTrend className="w-5 h-5" />,
                  color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
                  glow: "shadow-violet-500/10",
                  title: "Top 10 Selected",
                  body: "Every Sunday the formula re-ranks all 128. The 10 highest-conviction subnets form the index. No emotion, no narrative chasing — only the data.",
                },
                {
                  n: "04",
                  icon: <IconZap className="w-5 h-5" />,
                  color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                  glow: "shadow-amber-500/10",
                  title: "TrustedStake Executes",
                  body: "Your stake is deployed and rebalanced automatically. Validators are continuously optimised. Root yield is compounded. You watch the dashboard.",
                },
              ].map(s => (
                <div key={s.n} className={`relative p-5 rounded-2xl border border-white/6 bg-white/[0.025] shadow-xl ${s.glow} hover:bg-white/[0.04] transition-all`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${s.color}`}>
                      {s.icon}
                    </div>
                    <span className="text-xs font-black text-white/20 tabular-nums">{s.n}</span>
                  </div>
                  <div className="font-bold text-white text-base mb-2">{s.title}</div>
                  <p className="text-sm text-gray-300 leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOLDINGS ─────────────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest mb-2">Live Portfolio</p>
              <h2 className="text-3xl font-black text-white">Current Index Holdings</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 border border-white/6 rounded-lg px-3 py-2">
              <IconRefresh className="w-3 h-3" />
              Last rebalanced: <span className="text-gray-400 font-medium ml-1">May 25, 2026</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/6 bg-white/[0.02] overflow-hidden relative">
            {/* Weight spectrum bar */}
            <div className="flex h-[3px] w-full">
              {INDEX_HOLDINGS.map((h, i) => (
                <div key={h.netuid} style={{ width: `${h.weight}%`, background: `hsl(${150 - i * 10}, 65%, ${52 - i * 1.5}%)` }} />
              ))}
            </div>

            <div className={`relative ${!isUltra ? "min-h-[560px]" : ""}`}>
              <div className={!isUltra ? "blur-[3px] pointer-events-none select-none" : ""}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider w-10">#</th>
                        <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Subnet</th>
                        <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Category</th>
                        <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Revenue</th>
                        <th className="px-4 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">aGap</th>
                        <th className="px-4 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Weight</th>
                        <th className="px-4 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">30d</th>
                        <th className="px-4 py-4 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {INDEX_HOLDINGS.map((h) => {
                        const cat = CAT_STYLE[h.category] ?? { dot: "bg-gray-500", text: "text-gray-400" };
                        return (
                          <React.Fragment key={h.netuid}>
                            <tr
                              className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer group"
                              onClick={() => setExpandedRow(expandedRow === h.netuid ? null : h.netuid)}
                            >
                              <td className="px-6 py-4">
                                <span className="text-xs font-bold text-gray-500 tabular-nums">{h.rank}</span>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-[11px] font-black text-gray-400 flex-shrink-0 tabular-nums">{h.netuid}</div>
                                  <div>
                                    <div className="font-semibold text-gray-100 text-sm">{h.name}</div>
                                    <div className="text-[11px] text-gray-600">SN{h.netuid}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 hidden md:table-cell">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cat.dot}`} />
                                  <span className={`text-xs font-medium ${cat.text}`}>{h.category}</span>
                                </div>
                              </td>
                              <td className="px-4 py-4 hidden lg:table-cell">
                                <span className="text-sm text-gray-300 font-medium">{h.rev}</span>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-1 rounded-full bg-white/5 overflow-hidden">
                                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400" style={{ width: `${h.agap}%` }} />
                                  </div>
                                  <span className="text-sm font-bold text-emerald-400 tabular-nums">{h.agap}</span>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <span className="text-sm font-semibold text-gray-300 tabular-nums">{h.weight}%</span>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <span className={`text-sm font-bold tabular-nums ${h.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {h.change >= 0 ? "+" : ""}{h.change}%
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <IconChevron className={`w-4 h-4 text-gray-700 group-hover:text-gray-500 transition-all ${expandedRow === h.netuid ? "rotate-180" : ""}`} />
                              </td>
                            </tr>
                            {expandedRow === h.netuid && (
                              <tr className="border-b border-white/[0.04] bg-emerald-500/[0.03]">
                                <td colSpan={8} className="px-6 py-3">
                                  <div className="flex items-start gap-3 pl-11">
                                    <div className="w-px h-full bg-emerald-500/30 self-stretch mx-1 flex-shrink-0" />
                                    <p className="text-sm text-gray-300 leading-relaxed">
                                      <span className="font-semibold text-emerald-400">Why it&apos;s in: </span>{h.thesis}
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-6 py-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-gray-400">Click any row to expand the investment thesis. Weights are proportional to aGap scores.</p>
                  <p className="text-xs text-gray-400 italic">Preview — live allocations update post-rebalance</p>
                </div>
              </div>

              {/* Ultra gate */}
              {!isUltra && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(8,8,16,0.7) 0%, rgba(8,8,16,0.95) 100%)" }}>
                  <div className="text-center px-10 py-10 rounded-2xl border border-amber-500/20 bg-[#0c0c16] shadow-2xl shadow-amber-500/5 max-w-sm mx-4 backdrop-blur-sm">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
                      <svg className="w-6 h-6 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                    </div>
                    <p className="text-lg font-bold text-white mb-2">Ultra Members Only</p>
                    <p className="text-base text-gray-300 mb-6 leading-relaxed">Live holdings, investment thesis, and portfolio deployment are exclusive to Ultra subscribers.</p>
                    <a href="/pricing" className="inline-block bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black text-sm font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95">
                      Upgrade to Ultra →
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── aGAP METHODOLOGY ─────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest mb-4">The Formula</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start mb-10">
            <div>
              <h2 className="text-3xl font-black text-white mb-4">aGap Investing Methodology</h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-3">
                aGap is a proprietary multi-factor scoring model built for <strong className="text-white font-semibold">long-term subnet investing — not short-term trading</strong>. It deliberately deprioritises price momentum in favour of subnets building durable, revenue-generating businesses on Bittensor.
              </p>
              <p className="text-gray-500 text-sm leading-relaxed">
                The exact formula and weightings are proprietary. The philosophy is simple: back subnets with real products, real customers, and real teams. Not narrative.
              </p>
            </div>
            <div className="p-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/5">
              <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest mb-4">Result</p>
              <div className="space-y-3">
                {[
                  ["Lower churn", "Rebalances only when fundamentals shift — not price"],
                  ["Higher conviction", "10 concentrated positions, not 40+ diluted bets"],
                  ["Fewer whipsaws", "No daily momentum chasing — weekly fundamental review"],
                ].map(([title, sub]) => (
                  <div key={title} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <IconCheck className="w-3 h-3 text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white">{title}</span>
                      <span className="text-sm text-gray-300 ml-2">{sub}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {[
              {
                icon: <IconTarget className="w-5 h-5" />,
                color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                label: "Real-World Performance",
                detail: "How each subnet&apos;s AI output actually performs against the centralised players it&apos;s competing with. Head-to-head benchmarks across accuracy, throughput, and output quality — not self-reported metrics.",
              },
              {
                icon: <IconDollar className="w-5 h-5" />,
                color: "text-green-400 bg-green-500/10 border-green-500/20",
                label: "Verified Revenue",
                detail: "Product-market fit is proven by paying customers — not emissions. We only count revenue independently verified by SubnetRadar or TAO Institute. Subnets generating real fiat income score significantly higher.",
              },
              {
                icon: <IconTrend className="w-5 h-5" />,
                color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                label: "On-Chain Signals",
                detail: "Stake velocity, whale accumulation patterns, validator confidence, and TAO inflow trends. We track where sophisticated capital is quietly moving — before the narrative catches up.",
              },
              {
                icon: <IconUsers className="w-5 h-5" />,
                color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
                label: "Team & Execution",
                detail: "Shipping cadence, founder track record, community health, and public communications. The Oracle monitors key founder activity in real-time — including Discord signals from the builders who matter.",
              },
            ].map(f => (
              <div key={f.label} className="flex gap-4 p-5 rounded-xl border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${f.color}`}>
                  {f.icon}
                </div>
                <div>
                  <div className="font-bold text-white text-base mb-1.5">{f.label}</div>
                  <p className="text-sm text-gray-300 leading-relaxed">{f.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl border border-white/6 bg-white/[0.02]">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Inclusion Rules</p>
              <ul className="space-y-3">
                {[
                  "Minimum aGap score of 65 for index eligibility",
                  "Max 3 subnets per category — no sector concentration",
                  "Minimum 90 days of live on-chain data required",
                  "No subnet with unverified or fabricated revenue",
                  "Active validator competition required — no monopoly",
                ].map(r => (
                  <li key={r} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <IconCheck className="w-2.5 h-2.5 text-emerald-500" />
                    </div>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-5 rounded-xl border border-white/6 bg-white/[0.02]">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Rebalance Rules</p>
              <ul className="space-y-3">
                {[
                  "Rebalance only if top-10 composition changes — no churn",
                  "New entrant must score ≥5pts above the subnet it displaces",
                  "Maximum 3 rotations per rebalance to limit costs",
                  "Weights recalculated each rebalance from relative aGap scores",
                  "Emergency rebalance if a subnet is abandoned or exploited",
                ].map(r => (
                  <li key={r} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <IconArrow className="w-2.5 h-2.5 text-blue-500" />
                    </div>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── TRUSTEDSTAKE ─────────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest mb-4">Our Partner</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start mb-10">
            <div>
              <h2 className="text-3xl font-black text-white mb-4">TrustedStake Infrastructure</h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-3">
                TrustedStake is non-custodial enterprise staking infrastructure for the Bittensor ecosystem. Their platform handles the full complexity of managing multi-subnet positions — so the AlphaGap Index can focus on <em>what</em> to hold, not <em>how</em> to hold it.
              </p>
              <p className="text-gray-500 text-sm leading-relaxed mb-5">
                Partners include Kraken Institutional, Talisman, SubWallet, and Tao Institute — the same organisations that validate what&apos;s real in this ecosystem.
              </p>
              <a href="https://trustedstake.ai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                Visit trustedstake.ai <IconArrow className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="p-5 rounded-2xl border border-white/6 bg-white/[0.025]">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">The Yield Engine</p>
              <div className="space-y-4">
                {[
                  { icon: <IconRefresh className="w-4 h-4" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", title: "Automated Rebalancing", desc: "When the AlphaGap Index rotates on Sunday, TrustedStake executes the full transition automatically — no manual action needed." },
                  { icon: <IconTarget className="w-4 h-4" />, color: "text-violet-400 bg-violet-500/10 border-violet-500/20", title: "Optimal Validator Selection", desc: "Continuous monitoring selects the highest-performing validators per subnet to maximise yield, switching whenever better opportunities emerge." },
                  { icon: <IconTrend className="w-4 h-4" />, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", title: "Root Yield Compounding", desc: "Root network yield is automatically reinvested back into index positions — compounding your exposure without any manual intervention." },
                ].map(f => (
                  <div key={f.title} className="flex gap-3">
                    <div className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 ${f.color}`}>{f.icon}</div>
                    <div>
                      <div className="text-base font-semibold text-white mb-0.5">{f.title}</div>
                      <p className="text-sm text-gray-300 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <IconShield className="w-4 h-4" />, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", title: "Non-Custodial", desc: "Your TAO never leaves your wallet. TrustedStake executes delegations on your behalf — they never hold or touch your assets." },
              { icon: <IconZap className="w-4 h-4" />, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", title: "One-Click Deploy", desc: "Connect Talisman or SubWallet, set your TAO allocation, confirm. No manual staking across 10 subnets. No spreadsheets." },
              { icon: <IconGlobe className="w-4 h-4" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", title: "Enterprise-Grade Security", desc: "Built to the same standards used by their Kraken Institutional partnership. Every operation is auditable on-chain." },
              { icon: <IconChart className="w-4 h-4" />, color: "text-violet-400 bg-violet-500/10 border-violet-500/20", title: "Transparent Reporting", desc: "Every rebalance, validator switch, and yield event is logged in your dashboard. No black boxes." },
              { icon: <IconLayers className="w-4 h-4" />, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", title: "128+ Subnets Supported", desc: "Full Bittensor ecosystem coverage. The AlphaGap Index uses the top 10 — but the infrastructure scales to the entire network." },
              { icon: <IconUsers className="w-4 h-4" />, color: "text-rose-400 bg-rose-500/10 border-rose-500/20", title: "Aligned Incentives", desc: "TrustedStake earns when you earn. Performance-aligned fees mean they're incentivised to maximise your yield, not just deploy assets." },
            ].map(f => (
              <div key={f.title} className="flex flex-col gap-3 p-5 rounded-xl border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${f.color}`}>{f.icon}</div>
                <div>
                  <div className="font-bold text-white text-base mb-1">{f.title}</div>
                  <p className="text-sm text-gray-300 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-5 rounded-xl border border-blue-500/15 bg-blue-500/5 flex gap-3">
            <div className="w-5 h-5 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-blue-300">Integration status: </span>
              <span className="text-base text-gray-200">The AlphaGap × TrustedStake connection is in active development. The aGap formula is complete. TrustedStake&apos;s infrastructure is live and managing real assets. The dashboard integration is the final piece. Ultra subscribers get early access the moment it ships.</span>
            </div>
          </div>
        </section>

        {/* ── ORACLE SECTION ───────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <div className="relative rounded-2xl overflow-hidden border border-emerald-500/15 p-8 md:p-10" style={{ background: "radial-gradient(ellipse 80% 80% at 0% 50%, rgba(16,185,129,0.06) 0%, transparent 60%)" }}>
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest mb-4">Intelligence Layer</p>
                <h2 className="text-3xl font-black text-white mb-4">The Oracle watches.<br />The Index acts.</h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-5">
                  The AlphaGap Index isn&apos;t a static formula run on a spreadsheet. The Oracle continuously reads live data, founder communications, whale movements, and benchmark results — keeping aGap scores current between every rebalance.
                </p>
                <a href="/oracle" className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-sm font-semibold rounded-xl transition-colors">
                  Ask the Oracle <IconArrow className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="space-y-3">
                {[
                  { icon: <IconChart className="w-4 h-4" />, title: "Live Data Ingestion", desc: "Every data point across 128 subnets feeds back into the scoring model continuously." },
                  { icon: <IconUsers className="w-4 h-4" />, title: "Founder Signal Detection", desc: "Real-time monitoring of key founder Discord activity. Material announcements update scores before markets react." },
                  { icon: <IconTrend className="w-4 h-4" />, title: "Whale Flow Tracking", desc: "On-chain movements from large TAO holders trigger immediate score reviews on affected subnets." },
                ].map(f => (
                  <div key={f.title} className="flex gap-3 p-4 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/10">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">{f.icon}</div>
                    <div>
                      <div className="text-base font-semibold text-white mb-0.5">{f.title}</div>
                      <p className="text-sm text-gray-300 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest mb-4">Questions</p>
          <h2 className="text-3xl font-black text-white mb-8">Frequently asked</h2>
          <div className="space-y-2 max-w-3xl">
            {[
              { q: "Is my TAO safe? Who holds it?", a: "Nobody holds your TAO except you. TrustedStake operates a fully non-custodial model — they execute delegations through Bittensor's native staking mechanics, but your assets remain in your wallet at all times. Every position is verifiable on-chain." },
              { q: "What wallets are supported?", a: "TrustedStake integrates with Talisman and SubWallet — the two leading Bittensor-native wallets. Both are available as browser extensions and mobile apps. No centralised exchange required." },
              { q: "How much TAO do I need?", a: "Minimum allocation thresholds will be confirmed at launch. Early indications suggest a practical minimum of around 1 TAO to make rebalancing costs worthwhile relative to position size." },
              { q: "How often does the index change?", a: "Rebalances happen every Sunday at 00:00 UTC. The formula only rotates subnets if the new candidate scores at least 5 points higher than the one it displaces — preventing churn from minor fluctuations." },
              { q: "What fees are involved?", a: "The AlphaGap Index methodology is included in your Ultra subscription. TrustedStake charges a separate performance-aligned management fee for execution. Full fee structure will be published at launch." },
              { q: "Can I still use the Oracle independently?", a: "Yes. The Oracle runs independently of the Index. You can query any of the 128 subnets, challenge the methodology, or research subnets not currently in the index. Ultra members get 50 Oracle queries per day." },
              { q: "When does this launch?", a: "The integration is in active development. Ultra subscribers will be first to know and first to access early deployment. Confirm your interest below and we'll reach out directly." },
            ].map((faq, i) => (
              <div key={faq.q} className="rounded-xl border border-white/6 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                >
                  <span className="font-semibold text-gray-200 text-sm">{faq.q}</span>
                  <IconChevron className={`w-4 h-4 text-gray-600 flex-shrink-0 transition-transform ${expandedFaq === i ? "rotate-180" : ""}`} />
                </button>
                {expandedFaq === i && (
                  <div className="px-5 pb-4 border-t border-white/5">
                    <p className="text-base text-gray-300 leading-relaxed pt-4">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <section className="py-16">
          <div className="relative rounded-2xl overflow-hidden border border-amber-500/20 p-10 text-center" style={{ background: "radial-gradient(ellipse 80% 80% at 50% 0%, rgba(245,158,11,0.07) 0%, transparent 60%)" }}>
            <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)", backgroundSize: "30px 30px" }} />
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
                <svg className="w-6 h-6 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              </div>
              {isUltra ? (
                <>
                  <h2 className="text-3xl font-black text-white mb-3">You&apos;re on the list</h2>
                  <p className="text-gray-500 text-sm mb-7 max-w-md mx-auto leading-relaxed">As an Ultra subscriber, you have priority access the moment the TrustedStake integration launches. We&apos;ll reach out directly — no queue, no waitlist.</p>
                  <a href="mailto:hello@alphagap.io?subject=AlphaGap Subnet Index — Ultra Early Access" className="inline-block bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black text-sm font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95">
                    Confirm Early Access →
                  </a>
                </>
              ) : (
                <>
                  <h2 className="text-3xl font-black text-white mb-3">Unlock the Index</h2>
                  <p className="text-gray-500 text-sm mb-7 max-w-md mx-auto leading-relaxed">The AlphaGap Subnet Index is exclusive to Ultra. Upgrade for live holdings, portfolio deploy, and 50 Oracle queries per day.</p>
                  <a href="/pricing" className="inline-block bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black text-sm font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95">
                    Upgrade to Ultra →
                  </a>
                </>
              )}
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
