"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { PortfolioData } from "@/lib/types";
import BlurGate from "@/components/BlurGate";
import { getTier } from "@/lib/subscription";

// Pure SVG chart — no external deps
function PortfolioChart({ history }: { history: { date: string; totalValue: number }[] }) {
  const W = 800, H = 160;
  const PAD = { top: 12, right: 16, bottom: 28, left: 52 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const values = history.map((h) => h.totalValue);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const padRange = range * 0.12;
  const yMin = minVal - padRange;
  const yMax = maxVal + padRange;

  const xScale = (i: number) => PAD.left + (i / Math.max(history.length - 1, 1)) * chartW;
  const yScale = (v: number) => PAD.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  const pts = history.map((h, i) => `${xScale(i).toFixed(1)},${yScale(h.totalValue).toFixed(1)}`);
  const polyPoints = pts.join(" ");
  const firstX = xScale(0);
  const lastX = xScale(history.length - 1);
  const baseY = PAD.top + chartH;
  const areaPoints = `${firstX.toFixed(1)},${baseY} ${polyPoints} ${lastX.toFixed(1)},${baseY}`;
  const isUp = values[values.length - 1] >= values[0];
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
  const lastPt = { x: xScale(history.length - 1), y: yScale(values[values.length - 1]) };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "160px" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={gradStop} stopOpacity="0.18" />
          <stop offset="100%" stopColor={gradStop} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={yScale(v).toFixed(1)} x2={PAD.left + chartW} y2={yScale(v).toFixed(1)} stroke="#1f2937" strokeWidth="1" />
          <text x={PAD.left - 6} y={(yScale(v) + 4).toFixed(1)} fill="#6b7280" fontSize="10" textAnchor="end">${v.toFixed(0)}</text>
        </g>
      ))}
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline points={polyPoints} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {xLabels.map((l, i) => (
        <text key={i} x={l.x.toFixed(1)} y={H - 6} fill="#6b7280" fontSize="10" textAnchor="middle">{l.label}</text>
      ))}
      <circle cx={lastPt.x.toFixed(1)} cy={lastPt.y.toFixed(1)} r="4" fill={lineColor} />
      <text x={(lastPt.x + 8).toFixed(1)} y={(lastPt.y + 4).toFixed(1)} fill={lineColor} fontSize="11" fontWeight="bold">
        ${values[values.length - 1].toFixed(2)}
      </text>
    </svg>
  );
}

export default function PerformancePage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);

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
            {/* Summary strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">Portfolio Value</div>
                <div className="text-2xl font-bold text-white">${portfolioData.summary.totalValue.toFixed(2)}</div>
              </div>
              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">Total Return</div>
                <div className={`text-2xl font-bold ${portfolioData.summary.totalPnlUsd >= 0 ? "text-yellow-400" : "text-red-400"}`}>
                  {portfolioData.summary.totalPnlUsd >= 0 ? "+" : ""}${portfolioData.summary.totalPnlUsd.toFixed(2)}
                </div>
                <div className={`text-xs mt-0.5 ${portfolioData.summary.totalPnlPct >= 0 ? "text-yellow-500" : "text-red-500"}`}>
                  {portfolioData.summary.totalPnlPct >= 0 ? "+" : ""}{portfolioData.summary.totalPnlPct.toFixed(1)}% all-time
                </div>
              </div>
              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">Cash Deployed</div>
                <div className="text-2xl font-bold text-white">${portfolioData.summary.totalCost.toFixed(0)}</div>
                <div className="text-xs text-gray-600 mt-0.5">{portfolioData.summary.positionCount} positions × $100</div>
              </div>
              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">Max Return</div>
                {portfolioData.summary.maxReturnUsd != null ? (
                  <>
                    <div className="text-2xl font-bold text-green-400">
                      {(portfolioData.summary.maxReturnUsd ?? 0) >= 0 ? "+" : ""}${(portfolioData.summary.maxReturnUsd ?? 0).toFixed(2)}
                    </div>
                    <div className="text-xs text-green-500 mt-0.5">
                      {(portfolioData.summary.maxReturnPct ?? 0) >= 0 ? "+" : ""}{(portfolioData.summary.maxReturnPct ?? 0).toFixed(1)}% if sold at peak
                    </div>
                  </>
                ) : (
                  <div className="text-2xl font-bold text-gray-600">—</div>
                )}
              </div>
            </div>

            {/* Chart */}
            {portfolioData.history.length >= 2 ? (
              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-5">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">Portfolio Value Over Time</div>
                <PortfolioChart history={portfolioData.history} />
              </div>
            ) : (
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
                      <th className="text-right px-3 py-3">aGap</th>
                      <th className="text-right px-3 py-3">Bought</th>
                      <th className="text-right px-3 py-3">Buy Price</th>
                      <th className="text-right px-3 py-3">Current</th>
                      <th className="text-right px-3 py-3">Max Price</th>
                      <th className="text-right px-3 py-3">Value</th>
                      <th className="text-right px-3 py-3">24h P&L</th>
                      <th className="text-right px-3 py-3">Total P&L</th>
                      <th className="text-right px-5 py-3">Max P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40">
                    {portfolioData.positions.map((pos) => (
                      <tr key={pos.netuid} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-medium text-white">{pos.name}</div>
                          <div className="text-xs text-gray-500">SN{pos.netuid}</div>
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
                        <td className="text-right px-3 py-3">
                          <span className={pos.pnl24hUsd >= 0 ? "text-green-400" : "text-red-400"}>
                            {pos.change24h >= 0 ? "+" : ""}{pos.change24h.toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-right px-3 py-3">
                          <div className={`font-semibold ${pos.totalPnlUsd >= 0 ? "text-yellow-400" : "text-red-400"}`}>
                            {pos.totalPnlUsd >= 0 ? "+" : ""}${pos.totalPnlUsd.toFixed(2)}
                          </div>
                          <div className={`text-xs ${pos.totalPnlPct >= 0 ? "text-yellow-500" : "text-red-500"}`}>
                            {pos.totalPnlPct >= 0 ? "+" : ""}{pos.totalPnlPct.toFixed(1)}%
                          </div>
                        </td>
                        <td className="text-right px-5 py-3">
                          {pos.maxPnlUsd != null ? (
                            <>
                              <div className="font-semibold text-green-400">
                                {(pos.maxPnlUsd ?? 0) >= 0 ? "+" : ""}${(pos.maxPnlUsd ?? 0).toFixed(2)}
                              </div>
                              <div className="text-xs text-green-500">
                                {(pos.maxPnlPct ?? 0) >= 0 ? "+" : ""}{(pos.maxPnlPct ?? 0).toFixed(1)}%
                              </div>
                            </>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-gray-700">
                    <tr className="text-sm font-semibold">
                      <td className="px-5 py-3 text-gray-400" colSpan={6}>Total</td>
                      <td className="text-right px-3 py-3">${portfolioData.summary.totalValue.toFixed(2)}</td>
                      <td className="text-right px-3 py-3 text-gray-500">—</td>
                      <td className={`text-right px-3 py-3 ${portfolioData.summary.totalPnlUsd >= 0 ? "text-yellow-400" : "text-red-400"}`}>
                        {portfolioData.summary.totalPnlUsd >= 0 ? "+" : ""}${portfolioData.summary.totalPnlUsd.toFixed(2)}
                        <div className="text-xs font-normal">
                          ({portfolioData.summary.totalPnlPct >= 0 ? "+" : ""}{portfolioData.summary.totalPnlPct.toFixed(1)}%)
                        </div>
                      </td>
                      <td className="text-right px-5 py-3">
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
