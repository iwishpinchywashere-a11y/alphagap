"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { PortfolioData } from "@/lib/types";
import BlurGate from "@/components/BlurGate";
import { getTier } from "@/lib/subscription";

// Pure SVG chart — no external deps
// Narrower viewBox (500 wide) so text scales better on mobile screens.
function PortfolioChart({ history, values, formatY }: {
  history: { date: string }[];
  values: number[];
  formatY: (v: number) => string;
}) {
  const W = 500, H = 180;
  const PAD = { top: 14, right: 16, bottom: 30, left: 58 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const padRange = range * 0.12;
  const yMin = minV - padRange;
  const yMax = maxV + padRange;

  const xScale = (i: number) => PAD.left + (i / Math.max(history.length - 1, 1)) * chartW;
  const yScale = (v: number) => PAD.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  const pts = values.map((v, i) => `${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`);
  const polyPoints = pts.join(" ");
  const firstX = xScale(0);
  const lastX = xScale(history.length - 1);
  const baseY = PAD.top + chartH;
  const areaPoints = `${firstX.toFixed(1)},${baseY} ${polyPoints} ${lastX.toFixed(1)},${baseY}`;
  const isUp = values[values.length - 1] >= values[0];
  const lineColor = isUp ? "#4ade80" : "#f87171";
  const gradId = isUp ? "areaGreen" : "areaRed";
  const gradStop = isUp ? "#4ade80" : "#f87171";
  const yTicks = [yMin + (yMax - yMin) * 0.15, yMin + (yMax - yMin) * 0.5, yMin + (yMax - yMin) * 0.85];
  const xLabels = [0, Math.floor((history.length - 1) / 2), history.length - 1]
    .filter((i, idx, arr) => arr.indexOf(i) === idx)
    .map((i) => ({
      x: xScale(i),
      label: new Date(history[i].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
  const lastV = values[values.length - 1];
  const lastPt = { x: xScale(history.length - 1), y: yScale(lastV) };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "clamp(160px, 28vw, 220px)" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={gradStop} stopOpacity="0.22" />
          <stop offset="100%" stopColor={gradStop} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={yScale(v).toFixed(1)} x2={PAD.left + chartW} y2={yScale(v).toFixed(1)} stroke="#1f2937" strokeWidth="1" />
          <text x={PAD.left - 6} y={(yScale(v) + 4).toFixed(1)} fill="#6b7280" fontSize="13" textAnchor="end">{formatY(v)}</text>
        </g>
      ))}
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline points={polyPoints} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {xLabels.map((l, i) => (
        <text key={i} x={l.x.toFixed(1)} y={H - 7} fill="#6b7280" fontSize="13" textAnchor="middle">{l.label}</text>
      ))}
      <circle cx={lastPt.x.toFixed(1)} cy={lastPt.y.toFixed(1)} r="4" fill={lineColor} />
      <text x={(lastPt.x - 6).toFixed(1)} y={(lastPt.y - 9).toFixed(1)} fill={lineColor} fontSize="14" fontWeight="bold" textAnchor="end">
        {formatY(lastV)}
      </text>
    </svg>
  );
}

const POSITION_SIZE = 1000; // display as $1000 per position
// Normalize any position to $1,000-equivalent display: × (1000 / amountUsd).
// Auto-buys store $100 → ×10. Manually-added positions store $1000 → ×1.
// Never use raw PM=10 for dollar amounts — positions may have different stored sizes.
const PM = 10; // kept for currentValue display (currentValue = alphaTokens × price, not amountUsd-based)
const normDollar = (usd: number, amountUsd: number) => usd * (POSITION_SIZE / amountUsd);
const MATURITY_DAYS = 30; // positions younger than this are "still developing" — excluded from headline stats and chart
const HIT_THRESHOLD_PCT = 30; // 30%+ return = a "hit"

export default function PerformancePage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const router = useRouter();
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  type SortKey = "maxPnl" | "agap" | "bought" | "buyPrice" | "currentPrice" | "maxPrice" | "value" | "taoPnl" | "change24h";
  const [sortKey, setSortKey] = useState<SortKey>("maxPnl");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function sortedPositions(positions: PortfolioData["positions"], taoPrice: number) {
    return [...positions].sort((a, b) => {
      let av = 0, bv = 0;
      if (sortKey === "maxPnl")       { av = a.maxPnlPct ?? -Infinity; bv = b.maxPnlPct ?? -Infinity; }
      if (sortKey === "agap")         { av = a.buyAGapScore; bv = b.buyAGapScore; }
      if (sortKey === "bought")       { av = new Date(a.buyDate).getTime(); bv = new Date(b.buyDate).getTime(); }
      if (sortKey === "buyPrice")     { av = a.buyPriceUsd;  bv = b.buyPriceUsd; }
      if (sortKey === "currentPrice") { av = a.currentPrice; bv = b.currentPrice; }
      if (sortKey === "maxPrice")     { av = (a as any).manualPeakPrice ?? a.peakPrice ?? 0; bv = (b as any).manualPeakPrice ?? b.peakPrice ?? 0; }
      if (sortKey === "value")        { av = a.currentValue; bv = b.currentValue; }
      if (sortKey === "taoPnl")       { av = taoPrice > 0 ? (a.maxPnlUsd ?? 0) / taoPrice : 0; bv = taoPrice > 0 ? (b.maxPnlUsd ?? 0) / taoPrice : 0; }
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
          Every time a subnet&apos;s aGap score crosses <span className="text-green-400 font-semibold">80</span>, we auto-buy ${POSITION_SIZE.toLocaleString()} of its alpha token. Hit rate counts picks that returned +30% or more — once a position hits {MATURITY_DAYS}+ days it&apos;s scored.
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
              Every time a subnet&apos;s aGap score crosses <span className="text-green-400 font-semibold">80</span>, we auto-buy ${POSITION_SIZE.toLocaleString()} of its alpha token.
            </p>
          </div>
        )}

        {!portfolioLoading && portfolioData && portfolioData.positions.length > 0 && (() => {
          // ── Mature positions: bought > MATURITY_DAYS ago ────────────────────────
          const maturityCutoff = new Date();
          maturityCutoff.setDate(maturityCutoff.getDate() - MATURITY_DAYS);
          const maturityCutoffStr = maturityCutoff.toISOString().slice(0, 10);
          const maturePositions = portfolioData.positions.filter(p => p.buyDate <= maturityCutoffStr);
          const developingCount = portfolioData.positions.length - maturePositions.length;

          // Hit rate: how many mature positions peaked at 2×+ (100%+ gain)
          const hits = maturePositions.filter(p => (p.maxPnlPct ?? 0) >= HIT_THRESHOLD_PCT);
          const hitCount = hits.length;
          const eligibleCount = maturePositions.length;

          // Avg peak return on mature positions only
          const matureAvgPeak = eligibleCount > 0
            ? maturePositions.reduce((s, p) => s + (p.maxPnlPct ?? 0), 0) / eligibleCount
            : null;

          // Best single pick by peak %
          const bestPick = maturePositions.reduce((best, p) =>
            (p.maxPnlPct ?? 0) > (best?.maxPnlPct ?? 0) ? p : best,
            maturePositions[0] ?? null
          );
          // Total peak profit across all positions (normalized)
          const totalPeakProfit = portfolioData.positions.reduce(
            (s, p) => s + normDollar(p.maxPnlUsd ?? 0, p.amountUsd), 0
          );
          const formatDollarKM = (v: number) =>
            `${v >= 0 ? "+" : "-"}$${Math.abs(v) >= 1000
              ? (Math.abs(v) / 1000).toFixed(1) + "k"
              : Math.abs(v).toFixed(0)}`;

          return (
          <>
            {/* ── KPI grid: 2×2 on mobile, 4 across on desktop ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Hit Rate */}
              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Hit Rate</div>
                {eligibleCount > 0 ? (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-black text-green-400 tabular-nums leading-none">{hitCount}</span>
                      <span className="text-xl font-bold text-gray-500">/ {eligibleCount}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1.5">picks hit +{HIT_THRESHOLD_PCT}%+ at peak</div>
                  </>
                ) : (
                  <div className="text-lg font-bold text-gray-600 mt-1">Developing…</div>
                )}
              </div>

              {/* Success Rate */}
              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Success Rate</div>
                {eligibleCount > 0 ? (
                  <>
                    <div className="text-4xl font-black text-green-400 leading-none">
                      {Math.round((hitCount / eligibleCount) * 100)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1.5">of scored picks</div>
                  </>
                ) : (
                  <div className="text-lg font-bold text-gray-600 mt-1">—</div>
                )}
              </div>

              {/* Avg Peak Return */}
              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Avg Peak Return</div>
                {matureAvgPeak != null ? (
                  <>
                    <div className="text-4xl font-black text-green-400 leading-none">
                      +{matureAvgPeak.toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1.5">across {eligibleCount} scored picks</div>
                  </>
                ) : (
                  <div className="text-lg font-bold text-gray-600 mt-1">—</div>
                )}
              </div>

              {/* Peak Profit */}
              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Peak Profit</div>
                <div className="text-4xl font-black text-green-400 leading-none">
                  {formatDollarKM(totalPeakProfit)}
                </div>
                <div className="text-xs text-gray-500 mt-1.5">
                  {bestPick ? `best: ${bestPick.name} +${(bestPick.maxPnlPct ?? 0).toFixed(0)}%` : "if sold at highs"}
                </div>
              </div>
            </div>
            {developingCount > 0 && (
              <div className="text-xs text-gray-600 -mt-1 px-1">
                {developingCount} pick{developingCount !== 1 ? "s" : ""} still developing (&lt;{MATURITY_DAYS}d) · not yet scored
              </div>
            )}

            {/* Chart — cumulative max profit in dollars.
                 Each position's maxPnlUsd (peak-price gain, never decreases) is
                 attributed to its buy date. Running sum = total profit if every
                 pick had been sold at its all-time high. Always up or flat. */}
            {portfolioData.positions.length >= 2 ? (() => {
              const sortedPositions = [...portfolioData.positions]
                .sort((a, b) => a.buyDate.localeCompare(b.buyDate));

              // Build cumulative max profit staircase at each buy date
              // Use normDollar so $100-stored and $1000-stored positions both display at $1000 scale
              let cumMaxPnl = 0;
              const buyPoints: { date: string; cum: number }[] = [];
              for (const pos of sortedPositions) {
                cumMaxPnl += normDollar(pos.maxPnlUsd ?? 0, pos.amountUsd);
                // If multiple buys on same day, just update
                const last = buyPoints[buyPoints.length - 1];
                if (last && last.date === pos.buyDate) {
                  last.cum = cumMaxPnl;
                } else {
                  buyPoints.push({ date: pos.buyDate, cum: cumMaxPnl });
                }
              }

              // Densify: fill every calendar day first buy → today
              const today = new Date().toISOString().slice(0, 10);
              const allDates: string[] = [];
              const cur = new Date(buyPoints[0].date + "T12:00:00");
              const end = new Date(today + "T12:00:00");
              while (cur <= end) {
                allDates.push(cur.toISOString().slice(0, 10));
                cur.setDate(cur.getDate() + 1);
              }

              let lastCum = 0;
              const chartData = allDates.map(d => {
                const pt = buyPoints.filter(p => p.date <= d).pop();
                if (pt) lastCum = pt.cum;
                return { date: d, cum: lastCum };
              });

              const totalMaxPnl = buyPoints[buyPoints.length - 1]?.cum ?? 0;

              return (
                <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 md:p-5">
                  <div className="flex items-start justify-between mb-3 md:mb-4 gap-3">
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider">Cumulative Max Profit</div>
                      <div className="text-xs text-gray-600 mt-0.5">Total if every pick sold at its all-time high · never goes down</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-3xl font-black text-green-400">{formatDollarKM(totalMaxPnl)}</div>
                      <div className="text-xs text-gray-500">peak total</div>
                    </div>
                  </div>
                  <PortfolioChart
                    history={chartData}
                    values={chartData.map(h => h.cum)}
                    formatY={formatDollarKM}
                  />
                </div>
              );
            })() : (
              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-5">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Performance Chart</div>
                <div className="text-center py-6 text-gray-600 text-sm">Chart builds as picks mature — check back in a few weeks 📊</div>
              </div>
            )}

            {/* Holdings table */}
            <div className="bg-gray-900/70 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <h3 className="font-semibold text-sm">Holdings</h3>
                <span className="text-xs text-gray-600">${POSITION_SIZE.toLocaleString()} auto-buy when aGap ≥ 80</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b border-gray-800/60">
                      <th className="text-left px-5 py-3">Subnet</th>
                      {(["maxPnl","agap","bought","buyPrice","currentPrice","maxPrice","value","taoPnl","change24h"] as SortKey[]).map((key, i) => {
                        const labels: Record<SortKey, string> = { maxPnl:"Max P&L", agap:"aGap", bought:"Bought", buyPrice:"Buy Price", currentPrice:"Current", maxPrice:"Max Price", value:"Value", taoPnl:"Max τ PnL", change24h:"24h P&L" };
                        const active = sortKey === key;
                        const isLast = i === 8;
                        return (
                          <th key={key} onClick={() => handleSort(key)} className={`text-right ${isLast ? "px-5" : "px-3"} py-3 cursor-pointer select-none whitespace-nowrap hover:text-gray-300 transition-colors ${active ? "text-white" : ""}`}>
                            {labels[key]}{active ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40">
                    {sortedPositions(portfolioData.positions, portfolioData.summary.taoPrice ?? 0).map((pos) => (
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
                                {(pos.maxPnlUsd ?? 0) >= 0 ? "+" : ""}${normDollar(pos.maxPnlUsd ?? 0, pos.amountUsd).toFixed(2)}
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
                        <td className="text-right px-3 py-3 font-semibold">${(pos.currentValue * PM).toFixed(2)}</td>
                        <td className="text-right px-3 py-3 font-mono text-xs">
                          {portfolioData.summary.taoPrice && portfolioData.summary.taoPrice > 0 && pos.maxPnlUsd != null ? (
                            <span className={(pos.maxPnlUsd ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>
                              {(pos.maxPnlUsd ?? 0) >= 0 ? "+" : ""}
                              {(normDollar(pos.maxPnlUsd ?? 0, pos.amountUsd) / portfolioData.summary.taoPrice).toFixed(3)} τ
                            </span>
                          ) : <span className="text-gray-600">—</span>}
                        </td>
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
                            {(portfolioData.summary.maxReturnUsd ?? 0) >= 0 ? "+" : ""}${portfolioData.positions.reduce((s, p) => s + normDollar(p.maxPnlUsd ?? 0, p.amountUsd), 0).toFixed(2)}
                            <div className="text-xs font-normal">
                              ({(portfolioData.summary.maxReturnPct ?? 0) >= 0 ? "+" : ""}{(portfolioData.summary.maxReturnPct ?? 0).toFixed(1)}%)
                            </div>
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="text-right px-3 py-3 text-gray-500" colSpan={5}>—</td>
                      <td className="text-right px-3 py-3">${(portfolioData.summary.totalValue * PM).toFixed(2)}</td>
                      <td className="text-right px-3 py-3 font-mono text-xs">
                        {portfolioData.summary.taoPrice && portfolioData.summary.taoPrice > 0 && portfolioData.summary.maxReturnUsd != null ? (
                          <span className={(portfolioData.summary.maxReturnUsd ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>
                            {(portfolioData.summary.maxReturnUsd ?? 0) >= 0 ? "+" : ""}
                            {(portfolioData.positions.reduce((s, p) => s + normDollar(p.maxPnlUsd ?? 0, p.amountUsd), 0) / portfolioData.summary.taoPrice).toFixed(3)} τ
                          </span>
                        ) : <span className="text-gray-500">—</span>}
                      </td>
                      <td className="text-right px-5 py-3 text-gray-500">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="text-xs text-gray-600 text-center pb-2">
              Simulated portfolio — ${POSITION_SIZE.toLocaleString()} auto-invested per subnet when aGap ≥ 80. Tracks real alpha token prices. Not financial advice.
            </div>
          </>
          );
        })()}
      </div>
      </BlurGate>
    </main>
  );
}
