"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { PortfolioData } from "@/lib/types";
import BlurGate from "@/components/BlurGate";
import { getTier } from "@/lib/subscription";

// Pure SVG chart — no external deps
function PortfolioChart({ history, costBasis }: { history: { date: string; totalValue: number }[]; costBasis: number }) {
  const W = 800, H = 160;
  const PAD = { top: 12, right: 24, bottom: 28, left: 56 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const base = costBasis > 0 ? costBasis : 1;
  const toPct = (v: number) => ((v - base) / base) * 100;

  const values = history.map((h) => h.totalValue);
  const pctValues = values.map(toPct);
  const minPct = Math.min(...pctValues);
  const maxPct = Math.max(...pctValues);
  const range = maxPct - minPct || 1;
  const padRange = range * 0.12;
  const yMin = minPct - padRange;
  const yMax = maxPct + padRange;

  const xScale = (i: number) => PAD.left + (i / Math.max(history.length - 1, 1)) * chartW;
  const yScale = (pct: number) => PAD.top + chartH - ((pct - yMin) / (yMax - yMin)) * chartH;

  const pts = pctValues.map((pct, i) => `${xScale(i).toFixed(1)},${yScale(pct).toFixed(1)}`);
  const polyPoints = pts.join(" ");
  const firstX = xScale(0);
  const lastX = xScale(history.length - 1);
  const baseY = PAD.top + chartH;
  const areaPoints = `${firstX.toFixed(1)},${baseY} ${polyPoints} ${lastX.toFixed(1)},${baseY}`;
  const isUp = pctValues[pctValues.length - 1] >= pctValues[0];
  const lineColor = isUp ? "#4ade80" : "#f87171";
  const gradId = isUp ? "areaGreen" : "areaRed";
  const gradStop = isUp ? "#4ade80" : "#f87171";
  const yTicks = [yMin + (yMax - yMin) * 0.1, yMin + (yMax - yMin) * 0.5, yMin + (yMax - yMin) * 0.9];
  const xLabels = [0, Math.floor((history.length - 1) / 2), history.length - 1]
    .filter((i, idx, arr) => arr.indexOf(i) === idx)
    .map((i) => ({
      x: xScale(i),
      label: new Date(history[i].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
  const lastPct = pctValues[pctValues.length - 1];
  const lastPt = { x: xScale(history.length - 1), y: yScale(lastPct) };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "160px" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={gradStop} stopOpacity="0.18" />
          <stop offset="100%" stopColor={gradStop} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {yTicks.map((pct, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={yScale(pct).toFixed(1)} x2={PAD.left + chartW} y2={yScale(pct).toFixed(1)} stroke="#1f2937" strokeWidth="1" />
          <text x={PAD.left - 6} y={(yScale(pct) + 4).toFixed(1)} fill="#6b7280" fontSize="10" textAnchor="end">{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</text>
        </g>
      ))}
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline points={polyPoints} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {xLabels.map((l, i) => (
        <text key={i} x={l.x.toFixed(1)} y={H - 6} fill="#6b7280" fontSize="10" textAnchor="middle">{l.label}</text>
      ))}
      <circle cx={lastPt.x.toFixed(1)} cy={lastPt.y.toFixed(1)} r="4" fill={lineColor} />
      <text x={(lastPt.x - 4).toFixed(1)} y={(lastPt.y - 8).toFixed(1)} fill={lineColor} fontSize="11" fontWeight="bold" textAnchor="end">
        {lastPct >= 0 ? "+" : ""}{lastPct.toFixed(1)}%
      </text>
    </svg>
  );
}

export default function PerformancePage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const router = useRouter();
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [chartView] = useState<"current" | "max">("max");
  type SortKey = "maxPnl" | "agap" | "bought" | "buyPrice" | "currentPrice" | "maxPrice" | "value" | "change24h";
  const [sortKey, setSortKey] = useState<SortKey>("maxPnl");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function sortedPositions(positions: PortfolioData["positions"]) {
    return [...positions].sort((a, b) => {
      let av = 0, bv = 0;
      if (sortKey === "maxPnl")       { av = a.maxPnlUsd ?? -Infinity; bv = b.maxPnlUsd ?? -Infinity; }
      if (sortKey === "agap")         { av = a.buyAGapScore; bv = b.buyAGapScore; }
      if (sortKey === "bought")       { av = new Date(a.buyDate).getTime(); bv = new Date(b.buyDate).getTime(); }
      if (sortKey === "buyPrice")     { av = a.buyPriceUsd;  bv = b.buyPriceUsd; }
      if (sortKey === "currentPrice") { av = a.currentPrice; bv = b.currentPrice; }
      if (sortKey === "maxPrice")     { av = (a as any).manualPeakPrice ?? a.peakPrice ?? 0; bv = (b as any).manualPeakPrice ?? b.peakPrice ?? 0; }
      if (sortKey === "value")        { av = a.currentValue; bv = b.currentValue; }
      if (sortKey === "change24h")    { av = a.change24h;    bv = b.change24h; }
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }

  useEffect(() => {
    setPortfolioLoading(true);
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((data) => setPortfolioData(data))
      .catch(() => {})
      .finally(() => setPortfolioLoading(false));
  }, []);

  return (
    <main className="flex-1 overflow-auto p-4 md:p-6">
      {/* Header always visible */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Portfolio Performance</h1>
        <p className="text-sm text-gray-500 max-w-2xl">
          Tracks a simulated $100 auto-buy portfolio — every time a subnet&apos;s aGap score crosses <span className="text-green-400 font-semibold">80</span>, it&apos;s added as a position. Watch real alpha token returns over time.
        </p>
      </div>
      <BlurGate tier={tier} required="premium" minHeight="500px">
      <div className="space-y-6">

        {portfolioLoading && (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <span className="animate-pulse text-2xl mr-3">◎</span>
            <span>Loading portfolio...</span>
          </div>
        )}

        {!portfolioLoading && portfolioData && portfolioData.positions.length === 0 && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-10 text-center">
            <div className="text-5xl mb-4">📈</div>
            <h3 className="text-lg font-bold mb-2">Portfolio Starts Building Soon</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Every time a subnet&apos;s aGap score crosses <span className="text-green-400 font-semibold">80</span>, we auto-buy $100 of its alpha token.
            </p>
          </div>
        )}

        {!portfolioLoading && portfolioData && portfolioData.positions.length > 0 && (
          <>
            {/* Summary — Max Return only */}
            <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Max Return</div>
              {portfolioData.summary.maxReturnUsd != null ? (
                <>
                  <div className="text-2xl font-bold text-green-400">
                    {(portfolioData.summary.maxReturnPct ?? 0) >= 0 ? "+" : ""}{(portfolioData.summary.maxReturnPct ?? 0).toFixed(1)}% <span className="text-sm font-normal">if sold at peak</span>
                  </div>
                  <div className="text-xs text-green-500 mt-0.5">
                    {(portfolioData.summary.maxReturnUsd ?? 0) >= 0 ? "+" : ""}${(portfolioData.summary.maxReturnUsd ?? 0).toFixed(2)}
                  </div>
                </>
              ) : (
                <div className="text-2xl font-bold text-gray-600">—</div>
              )}
            </div>

            {/* Chart */}
            {portfolioData.history.length >= 2 ? (() => {
              // Compute max-value history: for each date, sum alphaTokens × peak price
              // for all positions that had been bought by that date
              const maxHistory = portfolioData.history.map(h => {
                const maxValue = portfolioData.positions
                  .filter(p => p.buyDate <= h.date)
                  .reduce((sum, p) => {
                    const peak = (p as any).manualPeakPrice ?? p.peakPrice ?? p.buyPriceUsd;
                    return sum + p.alphaTokens * peak;
                  }, 0);
                return { date: h.date, totalValue: Math.round(maxValue * 100) / 100 };
              });
              const displayHistory = chartView === "max" ? maxHistory : portfolioData.history;
              return (
                <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Portfolio Max Value Over Time</div>
                  </div>
                  <PortfolioChart history={displayHistory} costBasis={portfolioData.summary.totalCost} />
                </div>
              );
            })() : (
              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-5">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Portfolio Value Chart</div>
                <div className="text-center py-6 text-gray-600 text-sm">Chart builds as data accumulates — check back tomorrow 📊</div>
              </div>
            )}

            {/* Holdings table */}
            <div className="bg-gray-900/70 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <h3 className="font-semibold text-sm">Holdings</h3>
                <span className="text-xs text-gray-600">$100 auto-buy when aGap ≥ 80</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b border-gray-800/60">
                      <th className="text-left px-5 py-3">Subnet</th>
                      {(["maxPnl","agap","bought","buyPrice","currentPrice","maxPrice","value","change24h"] as SortKey[]).map((key, i) => {
                        const labels: Record<SortKey, string> = { maxPnl:"Max P&L", agap:"aGap", bought:"Bought", buyPrice:"Buy Price", currentPrice:"Current", maxPrice:"Max Price", value:"Value", change24h:"24h P&L" };
                        const active = sortKey === key;
                        const isLast = i === 7;
                        return (
                          <th key={key} onClick={() => handleSort(key)} className={`text-right ${isLast ? "px-5" : "px-3"} py-3 cursor-pointer select-none whitespace-nowrap hover:text-gray-300 transition-colors ${active ? "text-white" : ""}`}>
                            {labels[key]}{active ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40">
                    {sortedPositions(portfolioData.positions).map((pos) => (
                      <tr
                        key={pos.netuid}
                        className="hover:bg-gray-800/30 transition-colors cursor-pointer"
                        onClick={() => router.push(`/subnets/${pos.netuid}`)}
                      >
                        <td className="px-5 py-3">
                          <div className="font-medium text-white hover:text-green-400 transition-colors">{pos.name}</div>
                          <div className="text-xs text-gray-500">SN{pos.netuid}</div>
                        </td>
                        <td className="text-right px-3 py-3">
                          {pos.maxPnlUsd != null ? (
                            <>
                              <div className="font-semibold text-green-400">
                                {(pos.maxPnlPct ?? 0) >= 0 ? "+" : ""}{(pos.maxPnlPct ?? 0).toFixed(1)}%
                              </div>
                              <div className="text-xs text-green-500">
                                {(pos.maxPnlUsd ?? 0) >= 0 ? "+" : ""}${(pos.maxPnlUsd ?? 0).toFixed(2)}
                              </div>
                            </>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="text-right px-3 py-3">
                          <span className="text-green-400 font-semibold">{pos.buyAGapScore}</span>
                        </td>
                        <td className="text-right px-3 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(pos.buyDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td className="text-right px-3 py-3 text-gray-300 font-mono text-xs">
                          ${pos.buyPriceUsd < 0.01 ? pos.buyPriceUsd.toFixed(5) : pos.buyPriceUsd.toFixed(4)}
                        </td>
                        <td className="text-right px-3 py-3 font-mono text-xs">
                          <span className={pos.currentPrice >= pos.buyPriceUsd ? "text-green-400" : "text-red-400"}>
                            ${pos.currentPrice < 0.01 ? pos.currentPrice.toFixed(5) : pos.currentPrice.toFixed(4)}
                          </span>
                        </td>
                        <td className="text-right px-3 py-3 font-mono text-xs text-green-400">
                          {pos.peakPrice != null ? `$${pos.peakPrice < 0.01 ? pos.peakPrice.toFixed(5) : pos.peakPrice.toFixed(4)}` : "—"}
                        </td>
                        <td className="text-right px-3 py-3 font-semibold">${pos.currentValue.toFixed(2)}</td>
                        <td className="text-right px-5 py-3">
                          <span className={pos.pnl24hUsd >= 0 ? "text-green-400" : "text-red-400"}>
                            {pos.change24h >= 0 ? "+" : ""}{pos.change24h.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-gray-700">
                    <tr className="text-sm font-semibold">
                      <td className="px-5 py-3 text-gray-400">Total</td>
                      <td className="text-right px-3 py-3">
                        {portfolioData.summary.maxReturnUsd != null ? (
                          <span className="text-green-400">
                            {(portfolioData.summary.maxReturnUsd ?? 0) >= 0 ? "+" : ""}${(portfolioData.summary.maxReturnUsd ?? 0).toFixed(2)}
                            <div className="text-xs font-normal">
                              ({(portfolioData.summary.maxReturnPct ?? 0) >= 0 ? "+" : ""}{(portfolioData.summary.maxReturnPct ?? 0).toFixed(1)}%)
                            </div>
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="text-right px-3 py-3 text-gray-500" colSpan={5}>—</td>
                      <td className="text-right px-3 py-3">${portfolioData.summary.totalValue.toFixed(2)}</td>
                      <td className="text-right px-5 py-3 text-gray-500">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="text-xs text-gray-600 text-center pb-2">
              Simulated portfolio — $100 auto-invested per subnet when aGap ≥ 80. Tracks real alpha token prices. Not financial advice.
            </div>
          </>
        )}
      </div>
      </BlurGate>
    </main>
  );
}
