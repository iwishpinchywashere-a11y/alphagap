"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import SubnetDetailPanel from "@/components/dashboard/SubnetDetailPanel";
import { scoreColor, flowColor, formatNum } from "@/lib/formatters";
import type { SubnetScore } from "@/lib/types";

const COLUMNS: [keyof SubnetScore, string, string][] = [
  ["composite_score", "aGap", "Alpha Gap Score (0-100). The core metric. Finds subnets building quality work where the price hasn't caught up yet. Formula: Dev quality (50pts) + Price lag across 24h/7d/30d (30pts) + Social gap (15pts) + Emission value gap (15pts) - Market cap penalty."],
  ["flow_score", "Flow", "Flow & Momentum (0-100). Combines price momentum across 24h, 7d, and 30d timeframes, whale activity, and reversal bonuses."],
  ["dev_score", "Dev", "Development Score (0-100). Measures actual GitHub + HuggingFace activity quality based on commits, PRs, contributors, and AI models published."],
  ["eval_score", "eVal", "Emissions-to-Valuation (0-100). Finds the gap between what the network pays a subnet (emissions) vs what the market values it (market cap). Also factors in the validator/miner ratio — subnets with balanced, healthy node composition score higher."],
  ["social_score", "Social", "Social Velocity (0-100). Multi-source social intelligence: X/Twitter KOL mentions and Discord activity across the Bittensor ecosystem."],
  ["emission_pct", "Em %", "Emission share — percentage of total Bittensor network emissions allocated to this subnet."],
  ["emission_change_pct", "Em Δ", "Daily change in emission %. Green = increased, Red = decreased."],
  ["alpha_price", "Price", "Current alpha token price in USD."],
  ["market_cap", "MCap", "Total market capitalization in USD."],
  ["price_change_1h", "1h %", "Price change in the last 1 hour."],
  ["price_change_24h", "24h %", "Price change in the last 24 hours."],
  ["price_change_7d", "7d %", "Price change over the last 7 days."],
  ["price_change_30d", "30d %", "Price change over the last 30 days."],
  ["net_flow_24h", "24h Net", "Net USD flow in the last 24 hours. Positive = more buying than selling."],
  ["signal_count", "Signals", "Number of intelligence signals detected for this subnet."],
];

export default function LeaderboardPage() {
  const { leaderboard, taoPrice, scanning, signals, setSelectedSubnet, infoPopup, setInfoPopup } = useDashboard();
  const router = useRouter();
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

  const handleSort = (col: keyof SubnetScore) => {
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
    .sort((a, b) => {
      const av = a[sortCol] ?? -Infinity;
      const bv = b[sortCol] ?? -Infinity;
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

  return (
    <main className="flex-1 flex overflow-x-hidden">
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
            <h2 className="text-xl font-bold mb-2">Loading Data…</h2>
            <p className="text-gray-500 max-w-md">Data refreshes automatically every 10 minutes.</p>
          </div>
        )}

        {leaderboard.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <h2 className="text-lg font-bold mr-1">Alpha Leaderboard</h2>
              <input
                type="text"
                placeholder="Search subnets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600/30 w-40"
              />
              {([
                { label: "💰 >$5M MCap",        active: filterMinCap,          set: setFilterMinCap },
                { label: "⛽ Has Emissions",   active: filterHasEmissions,    set: setFilterHasEmissions },
                { label: "🐋 Whales Buying",   active: filterWhaleAccum,      set: setFilterWhaleAccum },
                { label: "📈 Emissions Rising",active: filterEmissionsRising, set: setFilterEmissionsRising },
                { label: "📉 Oversold Quality",active: filterOversoldQuality, set: setFilterOversoldQuality },
                { label: "🔥 KOL Active",      active: filterKolActive,       set: setFilterKolActive },
                { label: "💸 Net Inflow",       active: filterNetInflow,       set: setFilterNetInflow },
                { label: "🎯 High Conviction",  active: filterHighConviction,  set: setFilterHighConviction },
              ] as { label: string; active: boolean; set: (fn: (v: boolean) => boolean) => void }[]).map(({ label, active, set }) => (
                <button
                  key={label}
                  onClick={() => set(v => !v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${active ? "bg-green-500/20 border-green-500/50 text-green-400" : "bg-gray-800/60 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
              <table className="w-full text-sm font-data min-w-[900px]">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800">
                    <th className="text-left py-2 px-3">#</th>
                    <th className="text-left py-2 px-3">Subnet</th>
                    {COLUMNS.map(([key, label, tooltip]) => (
                      <th
                        key={key}
                        className={`text-right py-2 px-3 cursor-pointer hover:text-gray-300 transition-colors select-none ${key === "composite_score" ? "text-green-400/80" : ""}`}
                        onClick={() => handleSort(key)}
                        style={key === "composite_score" ? { background: "rgba(16, 185, 129, 0.06)", borderLeft: "2px solid rgba(16, 185, 129, 0.15)" } : undefined}
                      >
                        {label}
                        {tooltip && (
                          <span
                            className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-600 text-[9px] text-gray-500 hover:text-green-400 hover:border-green-400 cursor-help relative"
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setInfoPopup(infoPopup === key ? null : key); }}
                          >
                            i
                            {infoPopup === key && (
                              <div className="absolute z-50 top-5 right-0 w-72 p-3 bg-gray-900 border border-green-800/50 rounded-lg shadow-xl text-xs text-gray-300 font-normal whitespace-normal leading-relaxed" onClick={(e) => e.stopPropagation()}>
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
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedLeaderboard.map((sub, i) => (
                    <tr
                      key={sub.netuid}
                      className={`border-b cursor-pointer transition-colors ${
                        sub.composite_score >= 80
                          ? "border-green-500/30 bg-green-900/30 hover:bg-green-900/45"
                          : "border-gray-800/50 hover:bg-gray-900/50"
                      }`}
                      onClick={() => router.push(`/subnets/${sub.netuid}`)}
                    >
                      <td className="py-2.5 px-3 text-gray-500">{i + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs font-data">SN{sub.netuid}</span>
                          <span className="font-semibold">{sub.name}</span>
                          {sub.has_campaign && <span title="Active Stitch3 marketing campaign">🔥</span>}
                        </div>
                        {sub.top_signal && (
                          <span className="text-xs text-gray-600 block mt-0.5">{sub.top_signal}</span>
                        )}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold text-lg ${scoreColor(sub.composite_score)}`}
                        style={{ background: "rgba(16, 185, 129, 0.06)", borderLeft: "2px solid rgba(16, 185, 129, 0.15)" }}>
                        {sub.composite_score}
                      </td>
                      <td className={`py-2.5 px-3 text-right ${scoreColor(sub.flow_score)}`}>
                        {sub.whale_signal === "accumulating" && <span title={`Whale accumulation (${sub.whale_ratio}x)`}>🐋</span>}
                        {sub.whale_signal === "distributing" && <span title={`Whale distribution (${sub.whale_ratio}x)`} className="opacity-50">🔻</span>}
                        {sub.flow_score}
                      </td>
                      <td className={`py-2.5 px-3 text-right ${scoreColor(sub.dev_score)}`}>{sub.dev_score}</td>
                      <td className={`py-2.5 px-3 text-right ${scoreColor(sub.eval_score || 0)}`}>{sub.eval_score || 0}</td>
                      <td className={`py-2.5 px-3 text-right ${scoreColor(sub.social_score || 0)}`}>{sub.social_score || 0}</td>
                      <td className="py-2.5 px-3 text-right text-gray-400">
                        {sub.emission_pct != null && sub.emission_pct > 0 ? `${(sub.emission_pct * 100).toFixed(1)}%` : "\u2014"}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-medium ${
                        sub.emission_change_pct == null ? "text-gray-600" :
                        sub.emission_change_pct > 0 ? "text-green-400" :
                        sub.emission_change_pct < 0 ? "text-red-400" : "text-gray-500"
                      }`}>
                        {sub.emission_change_pct != null && sub.emission_change_pct !== 0
                          ? `${sub.emission_change_pct > 0 ? "+" : ""}${sub.emission_change_pct.toFixed(1)}%`
                          : "\u2014"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-400">
                        {sub.alpha_price != null ? `$${formatNum(sub.alpha_price, 2)}` : "\u2014"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-400">
                        {sub.market_cap != null ? `$${formatNum(sub.market_cap)}` : "\u2014"}
                      </td>
                      {(["price_change_1h", "price_change_24h", "price_change_7d", "price_change_30d"] as const).map((col) => (
                        <td key={col} className={`py-2.5 px-3 text-right font-medium ${
                          sub[col] == null ? "text-gray-600" :
                          (sub[col] as number) > 0 ? "text-green-400" :
                          (sub[col] as number) < 0 ? "text-red-400" : "text-gray-500"
                        }`}>
                          {sub[col] != null
                            ? `${(sub[col] as number) > 0 ? "+" : ""}${(sub[col] as number).toFixed(1)}%`
                            : "\u2014"}
                        </td>
                      ))}
                      <td className={`py-2.5 px-3 text-right ${flowColor(sub.net_flow_24h)}`}>
                        {sub.net_flow_24h != null && taoPrice != null
                          ? `${sub.net_flow_24h > 0 ? "+" : ""}$${formatNum(Math.round(sub.net_flow_24h * taoPrice))}`
                          : sub.net_flow_24h != null
                          ? `${sub.net_flow_24h > 0 ? "+" : ""}${formatNum(sub.net_flow_24h)} τ`
                          : "\u2014"}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {sub.signal_count > 0
                          ? <span className="bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-xs">{sub.signal_count}</span>
                          : <span className="text-gray-600">0</span>}
                      </td>
                    </tr>
                  ))}
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
