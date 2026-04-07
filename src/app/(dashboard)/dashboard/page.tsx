"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import SubnetDetailPanel from "@/components/dashboard/SubnetDetailPanel";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import { scoreColor, flowColor, formatNum } from "@/lib/formatters";
import { getTier, canAccessPro } from "@/lib/subscription";
import type { SubnetScore } from "@/lib/types";


const COLUMNS: [keyof SubnetScore, string, string][] = [
  ["composite_score", "aGap", "AlphaGap Score (0-100). Our composite intelligence score. Identifies subnets where fundamentals significantly exceed current market valuation — the higher the score, the larger the opportunity gap our models have detected."],
  ["agap_velo", "Velo ⚡", "aGap Velocity (0–100). Measures the speed and significance of a subnet's score movement. Weights both how fast the score is changing and how meaningful that level is — a move from 50→80 scores far higher than 1→20. 80–100 = explosive upward momentum. Below 30 = declining."],
  ["flow_score", "Flow", "Momentum Score (0-100). Tracks price action across multiple timeframes, whale and smart money movements, and unusual volume surges. High flow = strong market momentum and accumulation signals."],
  ["dev_score", "Dev", "Development Score (0-100). Measures the quality and velocity of real engineering work happening inside the subnet. Built on proprietary analysis of actual development activity."],
  ["eval_score", "eVal", "Emissions-to-Valuation Score (0-100). Watches emissions, validators, stakers, and miners to identify the gap between what the Bittensor network allocates to a subnet versus how the market has priced it. High eVal = the market is underpricing network conviction."],
  ["product_score", "Prod", "Product & Utility Score (0-100). Assesses real-world deployments and evidence of actual usage. Formally benchmarked subnets (highest confidence) are marked without a tilde. Estimated scores are shown as ~N. This column is the core early alpha detector: subnets building real product the market hasn't priced in."],
  ["social_score", "Social", "Social Velocity Score (0-100). Measures community awareness and KOL engagement across the Bittensor ecosystem."],
  ["emission_pct", "Em %", "Emission share — percentage of total Bittensor network emissions currently allocated to this subnet."],
  ["emission_change_pct", "Em Δ", "Recent change in emission allocation. Green = the network is voting more resources toward this subnet. Red = allocation is declining."],
  ["alpha_price", "Price", "Current alpha token price in USD."],
  ["market_cap", "MCap", "Total market capitalization in USD."],
  ["price_change_1h", "1h %", "Price change in the last 1 hour."],
  ["price_change_24h", "24h %", "Price change in the last 24 hours."],
  ["price_change_7d", "7d %", "Price change over the last 7 days."],
  ["price_change_30d", "30d %", "Price change over the last 30 days."],
  ["net_flow_24h", "24h Net", "Net USD flow in the last 24 hours. Positive = net buying pressure. A key early signal for institutional or whale accumulation."],
  ["signal_count", "Signals", "Number of intelligence signals detected for this subnet in the current scan window."],
];

// Separate component for useSearchParams (requires Suspense boundary)
function WelcomeRefresh() {
  const searchParams = useSearchParams();
  const { update: updateSession } = useSession();
  useEffect(() => {
    if (searchParams.get("welcome") !== "true") return;
    const timer = setTimeout(() => { updateSession(); }, 3000);
    return () => clearTimeout(timer);
  }, [searchParams, updateSession]);
  return null;
}

export default function LeaderboardPage() {
  const { leaderboard, taoPrice, scanning, signals, setSelectedSubnet, infoPopup, setInfoPopup } = useDashboard();
  const router = useRouter();
  const { data: session } = useSession();
  const tier = getTier(session);
  const isPro = canAccessPro(tier);
  const [sortCol, setSortCol] = useState<keyof SubnetScore>("composite_score");
  const [sortAsc, setSortAsc] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMinCap, setFilterMinCap] = useState(false);
  const [filterHasEmissions, setFilterHasEmissions] = useState(false);
  const [filterWhaleAccum, setFilterWhaleAccum] = useState(false);
  const [filterEmissionsRising, setFilterEmissionsRising] = useState(false);
  const [filterOversoldQuality, setFilterOversoldQuality] = useState(false);
  const [filterKolActive, setFilterKolActive] = useState(false);
  const [filterNetInflow, setFilterNetInflow] = useState(false);
  const [filterHighConviction, setFilterHighConviction] = useState(false);
  const [filterVolumeSurge, setFilterVolumeSurge] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const handleSort = (col: keyof SubnetScore) => {
    if (!isPro) return; // free users cannot sort
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
  };

  const q = searchQuery.toLowerCase().trim();
  const sortedLeaderboard = [...leaderboard]
    .filter((sub) => !q || sub.name.toLowerCase().includes(q) || `sn${sub.netuid}`.includes(q))
    .filter((sub) => !filterMinCap || (sub.market_cap != null && sub.market_cap >= 5_000_000))
    .filter((sub) => !filterHasEmissions || (sub.emission_pct != null && sub.emission_pct > 0))
    .filter((sub) => !filterWhaleAccum || sub.whale_signal === "accumulating")
    .filter((sub) => !filterEmissionsRising || sub.emission_trend === "up")
    .filter((sub) => !filterOversoldQuality || ((sub.dev_score ?? 0) >= 50 && (sub.price_change_7d ?? 0) <= -20))
    .filter((sub) => !filterKolActive || (sub.social_score ?? 0) >= 60)
    .filter((sub) => !filterNetInflow || (sub.net_flow_24h != null && sub.net_flow_24h > 0))
    .filter((sub) => !filterHighConviction || (sub.emission_trend === "up" && sub.whale_signal === "accumulating" && (sub.dev_score ?? 0) >= 40))
    .filter((sub) => !filterVolumeSurge || sub.volume_surge === true)
    .filter((sub) => !filterCategory || sub.category === filterCategory)
    .sort((a, b) => {
      const av = a[sortCol] ?? -Infinity;
      const bv = b[sortCol] ?? -Infinity;
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

  return (
    <main className="flex-1 flex overflow-x-hidden">
      {/* Refreshes session 3s after returning from Stripe payment */}
      <Suspense fallback={null}><WelcomeRefresh /></Suspense>
      <div className="flex-1 overflow-auto p-4 md:p-6 max-w-full">
        {/* Refreshing banner */}
        {scanning && leaderboard.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-900/60 border border-gray-700/40 rounded-lg px-3 py-2 mb-4">
            <span className="animate-spin text-green-400">&#x21BB;</span>
            <span>Refreshing data in background&hellip;</span>
          </div>
        )}

        {/* First-load spinner */}
        {scanning && leaderboard.length === 0 && (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <div className="text-4xl mb-4 animate-spin">&#x21BB;</div>
            <h2 className="text-xl font-bold mb-2">Loading Data&hellip;</h2>
            <p className="text-gray-500 max-w-md mb-4">Pulling prices, dev activity, and signals from all sources.</p>
            <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-green-400 rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>
        )}

        {/* Empty state */}
        {!scanning && leaderboard.length === 0 && (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <div className="text-6xl mb-4">&#x1F50D;</div>
            <h2 className="text-xl font-bold mb-2">Scanning…</h2>
            <p className="text-gray-500 max-w-md">Fetching the latest subnet data.</p>
          </div>
        )}

        {leaderboard.length > 0 && (
          <div>
            {/* Title row */}
            <h2 className="text-lg font-bold mb-2">Alpha Leaderboard</h2>
            {/* Search + Filters row */}
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                placeholder="Search subnets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600/30 w-full max-w-[180px]"
              />
              {/* Filters popover */}
              {(() => {
                const FILTERS = [
                  { label: "💰 >$5M MCap",         active: filterMinCap,          set: setFilterMinCap },
                  { label: "⛽ Has Emissions",      active: filterHasEmissions,    set: setFilterHasEmissions },
                  { label: "🐋 Whales Buying",      active: filterWhaleAccum,      set: setFilterWhaleAccum },
                  { label: "📈 Emissions Rising",   active: filterEmissionsRising, set: setFilterEmissionsRising },
                  { label: "📉 Oversold Quality",   active: filterOversoldQuality, set: setFilterOversoldQuality },
                  { label: "🔥 KOL Active",         active: filterKolActive,       set: setFilterKolActive },
                  { label: "💸 Net Inflow",          active: filterNetInflow,       set: setFilterNetInflow },
                  { label: "🎯 High Conviction",     active: filterHighConviction,  set: setFilterHighConviction },
                  { label: "🤑 Volume Surge",        active: filterVolumeSurge,     set: setFilterVolumeSurge },
                ] as { label: string; active: boolean; set: React.Dispatch<React.SetStateAction<boolean>> }[];
                const activeCount = FILTERS.filter(f => f.active).length + (filterCategory ? 1 : 0);
                // Collect unique categories from leaderboard for the category picker
                const allCategories = [...new Set(leaderboard.map(s => s.category).filter(Boolean) as string[])].sort();
                return (
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setFiltersOpen(v => !v)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${activeCount > 0 ? "bg-green-500/20 border-green-500/50 text-green-400" : "bg-gray-800/60 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600"}`}
                    >
                      <span>Filters</span>
                      {activeCount > 0 && (
                        <span className="bg-green-500 text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">{activeCount}</span>
                      )}
                      <span className="text-[10px] opacity-60">{filtersOpen ? "▲" : "▼"}</span>
                    </button>
                    {filtersOpen && (
                      <>
                        {/* Backdrop */}
                        <div className="fixed inset-0 z-10" onClick={() => setFiltersOpen(false)} />
                        {/* Dropdown — anchored to right edge so it never overflows on mobile */}
                        <div className="absolute right-0 top-full mt-1 z-20 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 w-56">
                          <div className="flex items-center justify-between mb-2 px-1">
                            <span className="text-xs text-gray-500 font-medium">Filter subnets</span>
                            {activeCount > 0 && (
                              <button
                                onClick={() => { FILTERS.forEach(f => f.set(false)); setFilterCategory(""); }}
                                className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                              >
                                Clear all
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            {FILTERS.map(({ label, active, set }) => (
                              <button
                                key={label}
                                onClick={() => set(v => !v)}
                                className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${active ? "bg-green-500/20 border border-green-500/40 text-green-400" : "hover:bg-gray-800 text-gray-300 border border-transparent"}`}
                              >
                                <span className={`w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center ${active ? "bg-green-500 border-green-500" : "border-gray-600"}`}>
                                  {active && <span className="text-black text-[8px] font-bold">✓</span>}
                                </span>
                                {label}
                              </button>
                            ))}
                          </div>
                          {/* Category picker */}
                          {allCategories.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-800">
                              <div className="text-[10px] text-gray-500 font-medium px-1 mb-2">Category</div>
                              <div className="flex flex-wrap gap-1">
                                {allCategories.map(cat => (
                                  <button
                                    key={cat}
                                    onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${filterCategory === cat ? "bg-green-500/20 border-green-500/40 text-green-400" : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"}`}
                                  >
                                    {cat}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Mobile-only sticky CTA — sits above the horizontally-scrolling table */}
            {!isPro && (
              <div className="md:hidden mb-3 flex flex-col items-center gap-1.5 py-4 px-4 rounded-xl bg-[#0a0a0f]/80 border border-gray-800">
                <p className="text-xs text-white font-bold">Top 20 subnets are locked on the free plan</p>
                <a
                  href="/pricing"
                  className="font-sans px-8 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl text-base hover:from-green-400 hover:to-emerald-500 transition-all shadow-xl shadow-green-500/30"
                >
                  Get Access →
                </a>
              </div>
            )}

            <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
              <table className="w-full text-sm font-data min-w-[900px]">
                <thead>
                  <tr className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-800">
                    <th className="text-left py-2 px-3 font-medium w-8">#</th>
                    <th className="text-left py-2 px-3 font-medium">Subnet</th>
                    {COLUMNS.map(([key, label, tooltip]) => (
                      <React.Fragment key={key}>
                        <th
                          className={`text-right py-2 px-3 font-medium transition-colors select-none ${isPro ? "cursor-pointer hover:text-gray-300" : "cursor-not-allowed opacity-60"} ${key === "composite_score" ? "text-green-400/80" : ""}`}
                          onClick={() => handleSort(key)}
                          style={key === "composite_score" ? { background: "rgba(16, 185, 129, 0.06)", borderLeft: "2px solid rgba(16, 185, 129, 0.15)" } : undefined}
                        >
                          {label}
                          {tooltip && (
                            <span
                              className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-700 text-[9px] text-gray-600 hover:text-green-400 hover:border-green-400 cursor-help relative normal-case tracking-normal"
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setInfoPopup(infoPopup === key ? null : key); }}
                            >
                              i
                              {infoPopup === key && (
                                <div className="absolute z-50 top-5 right-0 w-72 p-3 bg-gray-900 border border-green-800/50 rounded-lg shadow-xl text-xs text-gray-300 font-normal whitespace-normal leading-relaxed normal-case tracking-normal" onClick={(e) => e.stopPropagation()}>
                                  <div className="font-semibold text-green-400 mb-1">{label}</div>
                                  {tooltip}
                                </div>
                              )}
                            </span>
                          )}
                          {sortCol === key && (
                            <span className="ml-1 text-green-400">{sortAsc ? "\u25B2" : "\u25BC"}</span>
                          )}
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedLeaderboard.map((sub, i) => {
                    const isLocked = !isPro && i < 20;
                    return (<React.Fragment key={sub.netuid}>
                    <tr
                      className={`border-b transition-colors ${isLocked ? "opacity-50 pointer-events-none select-none" : "cursor-pointer"} ${
                        sub.composite_score >= 80
                          ? "border-green-500/20 bg-green-900/20 hover:bg-green-900/35"
                          : i % 2 === 0
                          ? "border-gray-800/40 bg-gray-900/30 hover:bg-gray-800/50"
                          : "border-gray-800/40 hover:bg-gray-800/50"
                      }`}
                      style={isLocked ? { filter: "blur(3px)" } : undefined}
                      onClick={() => !isLocked && router.push(`/subnets/${sub.netuid}`)}
                    >
                      <td className="py-2 px-3 text-white text-xs tabular-nums font-medium">{i + 1}</td>
                      <td className="py-2 px-3">
                        {isLocked ? (
                          /* Fully blacked-out on locked rows — no name or logo visible */
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-gray-800 flex-shrink-0" />
                            <div className="w-8 h-3 rounded bg-gray-800 flex-shrink-0" />
                            <div className="w-24 h-3.5 rounded bg-gray-800" />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <SubnetLogo netuid={sub.netuid} name={sub.name} size={20} />
                            <span className="text-[10px] text-gray-600 font-mono tracking-tight">SN{sub.netuid}</span>
                            <span className="font-bold text-[15px] text-gray-100 leading-tight">{sub.name}</span>
                            {sub.has_campaign && <span title="Active Stitch3 marketing campaign" className="text-sm">🔥</span>}
                            {sub.dereg_top3 && <span title="Top-3 deregistration risk — one of the 3 subnets with the lowest SubnetRadar health score" className="text-sm cursor-help">⚠️</span>}
                          </div>
                        )}
                      </td>
                      <td className={`py-2 px-3 text-right font-bold text-lg tabular-nums ${scoreColor(sub.composite_score)}`}
                        style={{ background: "rgba(16, 185, 129, 0.06)", borderLeft: "2px solid rgba(16, 185, 129, 0.15)" }}>
                        {sub.composite_score}
                      </td>
                      <td className={`py-2 px-3 text-right font-bold tabular-nums text-sm ${
                        sub.agap_velo == null ? "text-gray-700" :
                        sub.agap_velo >= 70 ? "text-green-400" :
                        sub.agap_velo >= 40 ? "text-yellow-400" :
                        "text-red-500"
                      }`}>
                        {sub.agap_velo != null ? sub.agap_velo : "—"}
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold tabular-nums ${scoreColor(sub.flow_score)}`}>
                        {sub.whale_signal === "accumulating" && <span title={`Whale accumulation (${sub.whale_ratio}x)`} className="mr-0.5 text-xs">🐋</span>}
                        {sub.whale_signal === "distributing" && <span title={`Whale distribution (${sub.whale_ratio}x)`} className="mr-0.5 text-xs opacity-50">🔻</span>}
                        {sub.volume_surge && <span title={`Volume surge: ${sub.volume_surge_ratio}x rolling average buy volume`} className="mr-0.5 text-xs">🤑</span>}
                        {sub.flow_score}
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold tabular-nums ${scoreColor(sub.dev_score)}`}>{sub.dev_score}</td>
                      <td className={`py-2 px-3 text-right font-semibold tabular-nums ${scoreColor(sub.eval_score || 0)}`}>{sub.eval_score || 0}</td>
                      <td className={`py-2 px-3 text-right font-semibold tabular-nums ${
                        sub.product_score
                          ? sub.utility_estimated ? "text-emerald-600" : "text-emerald-400"
                          : "text-gray-700"
                      }`}>
                        {sub.product_score != null ? (
                          <span
                            title={(() => {
                              const src = sub.product_source;
                              if (src === "benchmark") return sub.benchmark_summary || "Formally benchmarked vs centralized AI providers.";
                              if (src === "website") return `Website scan detected product signals (pricing, live app, enterprise) on this subnet's official site.`;
                              if (src === "milestone") return `Curated product milestone: confirmed launch, partnership, or revenue event detected for this subnet.`;
                              return `Estimated from proxy signals: emission share, validator quality, dev activity, and market conviction.`;
                            })()}
                            className="cursor-help"
                          >
                            {sub.utility_estimated ? "~" : ""}{sub.product_score}
                            {sub.product_source === "website" && <span className="text-[9px] text-emerald-500/60 ml-0.5" title="Website scan">🌐</span>}
                            {sub.product_source === "milestone" && <span className="text-[9px] text-emerald-500/60 ml-0.5" title="Curated product milestone">🚀</span>}
                          </span>
                        ) : "\u2014"}
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold tabular-nums ${scoreColor(sub.social_score || 0)}`}>{sub.social_score || 0}</td>
                      <td className="py-2 px-3 text-right text-gray-400 tabular-nums">
                        {sub.emission_pct != null && sub.emission_pct > 0 ? `${(sub.emission_pct * 100).toFixed(1)}%` : "\u2014"}
                      </td>
                      <td className={`py-2 px-3 text-right font-medium tabular-nums ${
                        sub.emission_change_pct == null ? "text-gray-600" :
                        sub.emission_change_pct > 0 ? "text-green-400" :
                        sub.emission_change_pct < 0 ? "text-red-400" : "text-gray-500"
                      }`}>
                        {sub.emission_change_pct != null && sub.emission_change_pct !== 0
                          ? `${sub.emission_change_pct > 0 ? "+" : ""}${sub.emission_change_pct.toFixed(1)}%`
                          : "\u2014"}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-300 tabular-nums font-medium">
                        {sub.alpha_price != null ? `$${formatNum(sub.alpha_price, 2)}` : "\u2014"}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-400 tabular-nums">
                        {sub.market_cap != null ? `$${formatNum(sub.market_cap)}` : "\u2014"}
                      </td>

                      {(["price_change_1h", "price_change_24h", "price_change_7d", "price_change_30d"] as const).map((col) => (
                        <td key={col} className={`py-2 px-3 text-right font-medium tabular-nums ${
                          sub[col] == null ? "text-gray-600" :
                          (sub[col] as number) > 0 ? "text-green-400" :
                          (sub[col] as number) < 0 ? "text-red-400" : "text-gray-500"
                        }`}>
                          {sub[col] != null
                            ? `${(sub[col] as number) > 0 ? "+" : ""}${(sub[col] as number).toFixed(1)}%`
                            : "\u2014"}
                        </td>
                      ))}
                      <td className={`py-2 px-3 text-right tabular-nums font-medium ${flowColor(sub.net_flow_24h)}`}>
                        {sub.net_flow_24h != null && taoPrice != null
                          ? `${sub.net_flow_24h > 0 ? "+" : ""}$${formatNum(Math.round(sub.net_flow_24h * taoPrice))}`
                          : sub.net_flow_24h != null
                          ? `${sub.net_flow_24h > 0 ? "+" : ""}${formatNum(sub.net_flow_24h)} τ`
                          : "\u2014"}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {sub.signal_count > 0
                          ? <span className="bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-xs font-semibold">{sub.signal_count}</span>
                          : <span className="text-gray-700">—</span>}
                      </td>
                    </tr>
                    {/* CTA injected in the middle of the locked section — desktop only */}
                    {!isPro && i === 9 && (
                      <tr className="hidden md:table-row">
                        <td colSpan={19} className="py-5 text-center bg-[#0a0a0f]/60">
                          <div className="inline-flex flex-col items-center gap-2">
                            <a href="/pricing" className="font-sans px-8 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl text-base hover:from-green-400 hover:to-emerald-500 transition-all shadow-xl shadow-green-500/30">
                              Get Access →
                            </a>
                            <p className="text-xs text-white font-bold">Top 20 subnets by aGap score are locked on the free plan</p>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>);
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <SubnetDetailPanel />
    </main>
  );
}
