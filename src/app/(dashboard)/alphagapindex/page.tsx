"use client";

import React, { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { getTier, canAccessUltra } from "@/lib/subscription";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import SubnetLogo from "@/components/dashboard/SubnetLogo";

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

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 65) return "text-yellow-400";
  return "text-orange-400";
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function AlphaGapIndexPage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const isUltra = canAccessUltra(tier);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const { leaderboard } = useDashboard();

  // Top 10 by invest_agap (the live aGap investing score)
  const top10 = useMemo(() => {
    return [...leaderboard]
      .filter(s => (s.invest_agap ?? 0) > 0)
      .sort((a, b) => (b.invest_agap ?? 0) - (a.invest_agap ?? 0))
      .slice(0, 10)
      .map((s, i) => {
        const score = s.invest_agap ?? 0;
        return { rank: i + 1, subnet: s, score };
      });
  }, [leaderboard]);

  // Compute weights proportional to scores
  const totalScore = top10.reduce((sum, h) => sum + h.score, 0);
  const holdings = top10.map(h => ({
    ...h,
    weight: totalScore > 0 ? Math.round((h.score / totalScore) * 1000) / 10 : 0,
  }));

  return (
    <main className="flex-1 overflow-auto bg-[#080810]">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16,185,129,0.08) 0%, transparent 70%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 40% 60% at 80% 50%, rgba(245,158,11,0.04) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 opacity-[0.018]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative w-full px-6 md:px-16 lg:px-24 pt-12 pb-10 text-center flex flex-col items-center">
          <div className="flex flex-wrap justify-center gap-2 mb-8">
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

          <h1 className="text-6xl sm:text-7xl lg:text-8xl xl:text-9xl font-extrabold tracking-tight leading-[1.0] mb-6">
            <span className="block text-white">AlphaGap</span>
            <span className="block bg-gradient-to-r from-emerald-300 via-green-400 to-emerald-500 bg-clip-text text-transparent">Subnet Index</span>
          </h1>

          <p className="text-white text-2xl sm:text-3xl font-semibold max-w-4xl leading-snug mb-4">
            Connect your wallet. Deploy your TAO.<br />
            <span className="text-emerald-400">We do everything else.</span>
          </p>
          <p className="text-gray-400 text-sm sm:text-base max-w-3xl leading-relaxed mb-8">
            aGap picks the top 10 subnets. TrustedStake auto-buys the tokens, manages the portfolio, and rebalances every Sunday. You sit back, collect APY, and let the formula do the work.
          </p>

          {/* 3-step visual */}
          <div className="flex flex-wrap justify-center items-center gap-3 mb-10">
            {[
              { n: "1", label: "Connect wallet", icon: <IconShield className="w-4 h-4" />, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
              { n: "2", label: "Deploy your TAO", icon: <IconZap className="w-4 h-4" />, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
              { n: "3", label: "Collect APY & relax", icon: <IconTrend className="w-4 h-4" />, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
            ].map((step, i) => (
              <React.Fragment key={step.n}>
                <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border ${step.color} font-semibold text-sm`}>
                  {step.icon}
                  <span className="text-white/50 text-xs font-bold">{step.n}</span>
                  <span>{step.label}</span>
                </div>
                {i < 2 && <IconArrow className="w-4 h-4 text-gray-700 hidden sm:block" />}
              </React.Fragment>
            ))}
          </div>

          {!isUltra && (
            <a href="/pricing" className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black font-bold text-base rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95 mb-8">
              Subscribe to Ultra — $99/mo <IconArrow className="w-4 h-4" />
            </a>
          )}

          <div className="flex items-center gap-4 w-full max-w-lg">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-emerald-500/30" />
            <span className="text-xs text-gray-500 font-medium tracking-widest uppercase whitespace-nowrap">Fundamental · Systematic · Non-custodial</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-emerald-500/30" />
          </div>
        </div>
      </section>

      <div className="px-6 md:px-12">

        {/* ── THE PROBLEM ─────────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest mb-4">Why This Exists</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-8">
            128 subnets.<br />
            <span className="text-gray-500">One portfolio.</span><br />
            Zero guesswork.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: <IconLayers className="w-5 h-5" />, color: "text-red-400 bg-red-500/10 border-red-500/20", title: "Too Many Subnets", desc: "128 subnets and counting. New ones launch weekly. You can't track them all." },
              { icon: <IconShield className="w-5 h-5" />, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", title: "Too Much Complexity", desc: "Validator selection, dTAO mechanics, stake allocation — it takes 1,400+ hours to master." },
              { icon: <IconChart className="w-5 h-5" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", title: "No Time to React", desc: "Miss a rebalance window and whales are already in. This solves that." },
            ].map(p => (
              <div key={p.title} className="flex gap-4 p-5 rounded-xl border border-white/5 bg-white/[0.02]">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${p.color}`}>{p.icon}</div>
                <div>
                  <div className="font-bold text-white text-lg mb-1">{p.title}</div>
                  <p className="text-base text-gray-400 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest mb-4">The System</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-10">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { n: "01", icon: <IconChart className="w-5 h-5" />, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", title: "Oracle Watches All 128", body: "Live data across every subnet — benchmarks, whale flows, founder signals, emissions." },
              { n: "02", icon: <IconTarget className="w-5 h-5" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", title: "aGap Scores Each One", body: "Our formula ranks every subnet on performance, revenue, on-chain signals, and team execution." },
              { n: "03", icon: <IconTrend className="w-5 h-5" />, color: "text-violet-400 bg-violet-500/10 border-violet-500/20", title: "Top 10 Selected", body: "Every Sunday the 10 highest-conviction subnets form the index. No emotion — only data." },
              { n: "04", icon: <IconZap className="w-5 h-5" />, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", title: "TrustedStake Executes", body: "Your TAO is deployed and rebalanced automatically. Yield compounded. You do nothing." },
            ].map(s => (
              <div key={s.n} className="relative p-5 rounded-2xl border border-white/6 bg-white/[0.025] hover:bg-white/[0.04] transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${s.color}`}>{s.icon}</div>
                  <span className="text-sm font-black text-white/20 tabular-nums">{s.n}</span>
                </div>
                <div className="font-bold text-white text-lg mb-2">{s.title}</div>
                <p className="text-base text-gray-400 leading-relaxed">{s.body}</p>
              </div>
            ))}
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
              {holdings.map((h, i) => (
                <div key={h.subnet.netuid} style={{ width: `${h.weight}%`, background: `hsl(${150 - i * 10}, 65%, ${52 - i * 1.5}%)` }} />
              ))}
            </div>

            <div className="relative">
              <div>
                {holdings.length === 0 ? (
                  <p className="px-6 py-12 text-center text-gray-500 text-sm">Loading index data…</p>
                ) : (<>

                  {/* ── Mobile cards (< md) ── */}
                  <div className="md:hidden divide-y divide-white/[0.04]">
                    {holdings.map((h) => {
                      const s = h.subnet;
                      const change24h = s.price_change_24h ?? null;
                      const change30d = s.price_change_30d ?? null;
                      const emission = s.emission_pct != null ? s.emission_pct * 100 : null;
                      const apy = s.apy_7d != null ? s.apy_7d * 100 : null;
                      const isOpen = expandedRow === s.netuid;
                      return (
                        <div key={s.netuid}>
                          <button
                            className="w-full text-left px-4 py-4 flex items-center gap-3 hover:bg-white/[0.03] transition-colors"
                            onClick={() => setExpandedRow(isOpen ? null : s.netuid)}
                          >
                            <span className="text-xs font-bold text-gray-600 w-5 tabular-nums flex-shrink-0">{h.rank}</span>
                            <SubnetLogo netuid={s.netuid} name={s.name} size={36} />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-100 text-base truncate">{s.name}</div>
                              <div className="text-xs text-gray-500">SN{s.netuid} · {s.category ?? s.benchmark_category ?? "—"}</div>
                            </div>
                            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                              <span className={`text-sm font-bold tabular-nums ${scoreColor(h.score)}`}>{h.score}</span>
                              <span className="text-xs text-gray-500">{h.weight}%</span>
                            </div>
                            <IconChevron className={`w-4 h-4 text-gray-600 flex-shrink-0 transition-transform ml-1 ${isOpen ? "rotate-180" : ""}`} />
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-4 bg-emerald-500/[0.03] border-t border-white/[0.04]">
                              {/* Stats grid */}
                              <div className="grid grid-cols-2 gap-2 pt-3 mb-3">
                                {[
                                  { label: "24h", value: change24h != null ? `${change24h >= 0 ? "+" : ""}${change24h.toFixed(1)}%` : "—", color: change24h != null ? (change24h >= 0 ? "text-emerald-400" : "text-red-400") : "text-gray-600" },
                                  { label: "30d", value: change30d != null ? `${change30d >= 0 ? "+" : ""}${change30d.toFixed(1)}%` : "—", color: change30d != null ? (change30d >= 0 ? "text-emerald-400" : "text-red-400") : "text-gray-600" },
                                  { label: "EM %", value: emission != null ? `${emission.toFixed(1)}%` : "—", color: "text-gray-300" },
                                  { label: "APY", value: apy != null ? `${apy.toFixed(0)}%` : "—", color: apy != null && apy >= 20 ? "text-emerald-400" : apy != null && apy >= 10 ? "text-yellow-400" : apy != null ? "text-orange-400" : "text-gray-600" },
                                ].map(stat => (
                                  <div key={stat.label} className="bg-white/[0.03] rounded-lg px-3 py-2">
                                    <div className="text-xs text-gray-500 mb-0.5">{stat.label}</div>
                                    <div className={`text-sm font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
                                  </div>
                                ))}
                              </div>
                              {/* Score bar */}
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs text-gray-500">aGap</span>
                                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400" style={{ width: `${h.score}%` }} />
                                </div>
                                <span className={`text-xs font-bold tabular-nums ${scoreColor(h.score)}`}>{h.score}</span>
                              </div>
                              {/* Thesis */}
                              {s.benchmark_summary && (
                                <p className="text-sm text-gray-400 leading-relaxed">{s.benchmark_summary.slice(0, 200)}{s.benchmark_summary.length > 200 ? "…" : ""}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Desktop table (md+) ── */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider w-10">#</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Subnet</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Category</th>
                          <th className="px-4 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">aGap</th>
                          <th className="px-4 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Weight</th>
                          <th className="px-4 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">24h</th>
                          <th className="px-4 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider hidden lg:table-cell">30d</th>
                          <th className="px-4 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider hidden lg:table-cell">EM %</th>
                          <th className="px-4 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider hidden lg:table-cell">APY</th>
                          <th className="px-4 py-4 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {holdings.map((h) => {
                          const s = h.subnet;
                          const change24h = s.price_change_24h ?? null;
                          const change30d = s.price_change_30d ?? null;
                          const emission = s.emission_pct != null ? s.emission_pct * 100 : null;
                          const apy = s.apy_7d != null ? s.apy_7d * 100 : null;
                          return (
                            <React.Fragment key={s.netuid}>
                              <tr
                                className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer group"
                                onClick={() => setExpandedRow(expandedRow === s.netuid ? null : s.netuid)}
                              >
                                <td className="px-6 py-4"><span className="text-xs font-bold text-gray-500 tabular-nums">{h.rank}</span></td>
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-3">
                                    <SubnetLogo netuid={s.netuid} name={s.name} size={32} />
                                    <div>
                                      <div className="font-semibold text-gray-100 text-sm">{s.name}</div>
                                      <div className="text-xs text-gray-500">SN{s.netuid}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4 hidden lg:table-cell"><span className="text-xs text-gray-400 font-medium">{s.category ?? s.benchmark_category ?? "—"}</span></td>
                                <td className="px-4 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-14 h-1 rounded-full bg-white/5 overflow-hidden">
                                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400" style={{ width: `${h.score}%` }} />
                                    </div>
                                    <span className={`text-sm font-bold tabular-nums ${scoreColor(h.score)}`}>{h.score}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-right"><span className="text-sm font-semibold text-gray-300 tabular-nums">{h.weight}%</span></td>
                                <td className="px-4 py-4 text-right">
                                  {change24h != null ? <span className={`text-sm font-bold tabular-nums ${change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>{change24h >= 0 ? "+" : ""}{change24h.toFixed(1)}%</span> : <span className="text-gray-600 text-sm">—</span>}
                                </td>
                                <td className="px-4 py-4 text-right hidden lg:table-cell">
                                  {change30d != null ? <span className={`text-sm font-bold tabular-nums ${change30d >= 0 ? "text-emerald-400" : "text-red-400"}`}>{change30d >= 0 ? "+" : ""}{change30d.toFixed(1)}%</span> : <span className="text-gray-600 text-sm">—</span>}
                                </td>
                                <td className="px-4 py-4 text-right hidden lg:table-cell"><span className="text-sm text-gray-300 tabular-nums font-medium">{emission != null ? `${emission.toFixed(1)}%` : "—"}</span></td>
                                <td className="px-4 py-4 text-right hidden lg:table-cell">
                                  <span className={`text-sm font-semibold tabular-nums ${apy != null && apy >= 20 ? "text-emerald-400" : apy != null && apy >= 10 ? "text-yellow-400" : apy != null ? "text-orange-400" : "text-gray-600"}`}>
                                    {apy != null ? `${apy.toFixed(0)}%` : "—"}
                                  </span>
                                </td>
                                <td className="px-4 py-4"><IconChevron className={`w-4 h-4 text-gray-700 group-hover:text-gray-500 transition-all ${expandedRow === s.netuid ? "rotate-180" : ""}`} /></td>
                              </tr>
                              {expandedRow === s.netuid && (
                                <tr className="border-b border-white/[0.04] bg-emerald-500/[0.03]">
                                  <td colSpan={10} className="px-6 py-3">
                                    <p className="text-sm text-gray-300 leading-relaxed pl-10">
                                      <span className="font-semibold text-emerald-400">aGap Score: {h.score} · </span>
                                      {s.benchmark_summary ? s.benchmark_summary.slice(0, 200) + (s.benchmark_summary.length > 200 ? "…" : "") : "No summary available."}
                                    </p>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>)}
                <div className="px-4 md:px-6 py-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-gray-400">Tap any row to see the investment thesis.</p>
                  <p className="text-sm text-gray-500 italic">Live allocations update post-rebalance</p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── MID-PAGE CTA ─────────────────────────────────────────────────── */}
        {!isUltra && (
          <div className="py-10 border-b border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-white font-bold text-xl mb-1">Deploy your TAO into the top 10 subnets.</p>
              <p className="text-gray-400 text-base">Automated. Non-custodial. Powered by aGap + TrustedStake.</p>
            </div>
            <a href="/pricing" className="flex-shrink-0 inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black font-bold text-base rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95 whitespace-nowrap">
              Subscribe to Ultra <IconArrow className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* ── aGAP METHODOLOGY ─────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest mb-4">The Formula</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">aGap Investing Methodology</h2>
          <p className="text-gray-400 text-lg mb-10 max-w-2xl">Built for long-term investing — not trading. We back subnets with real products, real customers, and real teams.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: <IconTarget className="w-5 h-5" />, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Real-World Performance", detail: "Head-to-head benchmarks against centralised competitors. Not self-reported metrics." },
              { icon: <IconDollar className="w-5 h-5" />, color: "text-green-400 bg-green-500/10 border-green-500/20", label: "Revenue Potential", detail: "Real customers, product traction, and clear paths to monetisation." },
              { icon: <IconTrend className="w-5 h-5" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", label: "On-Chain Signals", detail: "Whale accumulation, stake velocity, and validator confidence — before narratives catch up." },
              { icon: <IconUsers className="w-5 h-5" />, color: "text-violet-400 bg-violet-500/10 border-violet-500/20", label: "Team & Execution", detail: "Shipping cadence, founder track record, and real community health." },
            ].map(f => (
              <div key={f.label} className="flex gap-4 p-5 rounded-xl border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${f.color}`}>{f.icon}</div>
                <div>
                  <div className="font-bold text-white text-lg mb-1">{f.label}</div>
                  <p className="text-base text-gray-400 leading-relaxed">{f.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── TRUSTEDSTAKE ─────────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest mb-4">Our Partner</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">TrustedStake Infrastructure</h2>
          <p className="text-gray-400 text-lg mb-10 max-w-2xl">Non-custodial enterprise staking for Bittensor. Trusted by Kraken Institutional, Talisman, and SubWallet.
            <a href="https://trustedstake.ai" target="_blank" rel="noopener noreferrer" className="ml-2 text-emerald-400 hover:text-emerald-300 transition-colors">trustedstake.ai →</a>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <IconShield className="w-5 h-5" />, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", title: "Non-Custodial", desc: "Your TAO never leaves your wallet. Ever." },
              { icon: <IconZap className="w-5 h-5" />, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", title: "One-Click Deploy", desc: "Connect your wallet, set your amount, done." },
              { icon: <IconRefresh className="w-5 h-5" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", title: "Auto Rebalancing", desc: "Index rotates every Sunday. TrustedStake handles the rest." },
              { icon: <IconTrend className="w-5 h-5" />, color: "text-violet-400 bg-violet-500/10 border-violet-500/20", title: "Yield Compounding", desc: "Root network yield automatically reinvested into your positions." },
              { icon: <IconTarget className="w-5 h-5" />, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", title: "Best Validators", desc: "Continuous monitoring picks the highest-yielding validators per subnet." },
              { icon: <IconGlobe className="w-5 h-5" />, color: "text-rose-400 bg-rose-500/10 border-rose-500/20", title: "Enterprise Security", desc: "Same standards as their Kraken Institutional partnership." },
            ].map(f => (
              <div key={f.title} className="flex gap-4 p-5 rounded-xl border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${f.color}`}>{f.icon}</div>
                <div>
                  <div className="font-bold text-white text-lg mb-1">{f.title}</div>
                  <p className="text-base text-gray-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── ORACLE SECTION ───────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <div className="relative rounded-2xl overflow-hidden border border-emerald-500/15 p-8 md:p-12" style={{ background: "radial-gradient(ellipse 80% 80% at 0% 50%, rgba(16,185,129,0.06) 0%, transparent 60%)" }}>
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative flex flex-col md:flex-row gap-8 items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest mb-4">Intelligence Layer</p>
                <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">The Oracle watches.<br />The Index acts.</h2>
                <p className="text-gray-400 text-lg mb-6 max-w-lg">Scores stay current between rebalances — live data, whale movements, founder signals, benchmark updates. Not a spreadsheet.</p>
                <a href="/oracle" className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-base font-semibold rounded-xl transition-colors">
                  Ask the Oracle <IconArrow className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest mb-4 text-center">Questions</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-8 text-center">Common questions</h2>
          <div className="space-y-2 max-w-3xl mx-auto">
            {[
              { q: "Is my TAO safe?", a: "Yes. Non-custodial — your TAO never leaves your wallet. TrustedStake only executes delegations on your behalf." },
              { q: "What wallets are supported?", a: "Talisman and SubWallet. Both are Bittensor-native and available as browser extensions." },
              { q: "How often does the index rebalance?", a: "Every Sunday. Only rotates if a new subnet scores 5+ points above the one it displaces." },
              { q: "What does it cost?", a: "Index access is included in Ultra. TrustedStake charges a separate performance fee for execution — full details at launch." },
              { q: "When does this launch?", a: "In active development. Ultra subscribers get early access the moment it ships." },
            ].map((faq, i) => (
              <div key={faq.q} className="rounded-xl border border-white/6 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                >
                  <span className="font-semibold text-white text-base">{faq.q}</span>
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
