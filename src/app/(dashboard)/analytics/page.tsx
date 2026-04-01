"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import type { SubnetScore } from "@/lib/types";

// ── Formatters ────────────────────────────────────────────────────
function fmtMcap(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
function fmtPrice(v: number): string {
  if (v === 0) return "$0";
  if (v < 0.0001) return `$${v.toFixed(6)}`;
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
}
function fmtPct(v: number): string { return `${(v * 100).toFixed(2)}%`; }

// ── dot colour by aGap score ──────────────────────────────────────
function agapColor(score: number): string {
  if (score >= 75) return "#4ade80";
  if (score >= 50) return "#86efac";
  if (score >= 35) return "#fbbf24";
  return "#6b7280";
}

// ── Log-scale helpers ─────────────────────────────────────────────
function logVal(v: number): number { return Math.log10(Math.max(v, 1e-12)); }

function niceLogTicks(min: number, max: number): number[] {
  // Return powers of 10 (and optionally 5× and 2× multiples) in range
  const ticks: number[] = [];
  const lo = Math.floor(Math.log10(min));
  const hi = Math.ceil(Math.log10(max));
  for (let e = lo; e <= hi; e++) {
    for (const m of [1, 2, 5]) {
      const v = m * Math.pow(10, e);
      if (v >= min * 0.9 && v <= max * 1.1) ticks.push(v);
    }
  }
  return [...new Set(ticks)].sort((a, b) => a - b);
}

// ── Shared scatter plot component ─────────────────────────────────
interface ScatterPoint {
  netuid: number; name: string;
  x: number; y: number;
  agap: number; label?: string;
}

function ScatterPlot({
  points, title, subtitle,
  xLabel, yLabel,
  formatX, formatY,
  yLog = false, xMax100 = false,
  alphaX = "right", alphaY = "bottom",
  alphaLabel = "Alpha Zone 🔥",
  overLabel = "Overvalued ⚠️",
}: {
  points: ScatterPoint[];
  title: string; subtitle: string;
  xLabel: string; yLabel: string;
  formatX: (v: number) => string;
  formatY: (v: number) => string;
  yLog?: boolean; xMax100?: boolean;
  alphaX?: "left" | "right";
  alphaY?: "top" | "bottom";
  alphaLabel?: string; overLabel?: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const router = useRouter();

  const W = 760; const H = 380;
  const PAD = { top: 24, right: 24, bottom: 52, left: 78 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  // Filter valid data
  const valid = points.filter(p => p.x > 0 && p.y > 0 && isFinite(p.x) && isFinite(p.y));
  if (valid.length < 2) {
    return (
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
        <h3 className="font-semibold text-white mb-1">{title}</h3>
        <p className="text-gray-600 text-sm">Not enough data to render chart.</p>
      </div>
    );
  }

  // ── X scale (linear, 0-100 for scores) ───────────────────────────
  const xVals = valid.map(p => p.x);
  const xDataMin = Math.min(...xVals); const xDataMax = Math.max(...xVals);
  const xLo = xMax100 ? 0 : Math.max(0, xDataMin - (xDataMax - xDataMin) * 0.08);
  const xHi = xMax100 ? 100 : xDataMax + (xDataMax - xDataMin) * 0.08;
  const xS = (v: number) => PAD.left + ((v - xLo) / (xHi - xLo)) * cW;

  // ── Y scale (log or linear) ───────────────────────────────────────
  const yVals = valid.map(p => p.y);
  const yDataMin = Math.min(...yVals); const yDataMax = Math.max(...yVals);
  const yLo = yLog ? logVal(yDataMin * 0.6) : Math.max(0, yDataMin * 0.85);
  const yHi = yLog ? logVal(yDataMax * 1.6) : yDataMax * 1.15;
  const yS = (v: number) => {
    const lv = yLog ? logVal(v) : v;
    return PAD.top + cH - ((lv - yLo) / (yHi - yLo)) * cH;
  };

  // X axis ticks
  const xTicks = xMax100
    ? [0, 20, 40, 60, 80, 100]
    : (() => {
        const step = (xHi - xLo) / 5;
        return Array.from({ length: 6 }, (_, i) => xLo + i * step);
      })();

  // Y axis ticks
  const yTicks = yLog
    ? niceLogTicks(yDataMin * 0.5, yDataMax * 2)
    : (() => {
        const step = (yDataMax - yDataMin) / 4;
        return Array.from({ length: 5 }, (_, i) => yDataMin + i * step);
      })();

  // Quadrant dividers (median of x and y)
  const xMed = valid.reduce((s, p) => s + p.x, 0) / valid.length;
  const yMed = yLog
    ? Math.pow(10, valid.reduce((s, p) => s + logVal(p.y), 0) / valid.length)
    : valid.reduce((s, p) => s + p.y, 0) / valid.length;

  const xMidSvg = xS(xMed);
  const yMidSvg = yS(yMed);

  // Alpha quadrant rectangle
  const alphaX1 = alphaX === "right" ? xMidSvg : PAD.left;
  const alphaX2 = alphaX === "right" ? PAD.left + cW : xMidSvg;
  const alphaY1 = alphaY === "bottom" ? yMidSvg : PAD.top;
  const alphaY2 = alphaY === "bottom" ? PAD.top + cH : yMidSvg;

  const overX1 = alphaX === "right" ? PAD.left : xMidSvg;
  const overX2 = alphaX === "right" ? xMidSvg : PAD.left + cW;
  const overY1 = alphaY === "bottom" ? PAD.top : yMidSvg;
  const overY2 = alphaY === "bottom" ? yMidSvg : PAD.top + cH;

  // Hover handling: find nearest point
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const my = ((e.clientY - rect.top) / rect.height) * H;
    let best = -1; let bestDist = 625; // 25px threshold²
    valid.forEach((p, i) => {
      const dx = xS(p.x) - mx; const dy = yS(p.y) - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) { bestDist = d2; best = i; }
    });
    setHoverIdx(best >= 0 ? best : null);
  }, [valid, xS, yS]);

  const hp = hoverIdx !== null ? valid[hoverIdx] : null;

  // Tooltip positioning
  let ttX = 0; let ttY = 0; const TW = 160; const TH = 64;
  if (hp) {
    const px = xS(hp.x); const py = yS(hp.y);
    ttX = px + 12 + TW > PAD.left + cW ? px - TW - 12 : px + 12;
    ttY = Math.max(PAD.top, Math.min(py - TH / 2, PAD.top + cH - TH));
  }

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
      <div className="mb-3">
        <h3 className="text-base font-bold text-white">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
        {[["≥75", "#4ade80"], ["50–74", "#86efac"], ["35–49", "#fbbf24"], ["<35", "#6b7280"]].map(([lbl, col]) => (
          <span key={lbl} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: col }} />
            aGap {lbl}
          </span>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair select-none"
        style={{ height: "340px" }}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
        onClick={() => hp && router.push(`/subnets/${hp.netuid}`)}
      >
        {/* ── Alpha quadrant shading ── */}
        <rect
          x={alphaX1} y={alphaY1}
          width={alphaX2 - alphaX1} height={alphaY2 - alphaY1}
          fill="#4ade80" fillOpacity="0.04"
        />
        {/* ── Overhyped quadrant shading ── */}
        <rect
          x={overX1} y={overY1}
          width={overX2 - overX1} height={overY2 - overY1}
          fill="#f87171" fillOpacity="0.03"
        />

        {/* ── Quadrant dividers ── */}
        <line x1={xMidSvg} y1={PAD.top} x2={xMidSvg} y2={PAD.top + cH}
          stroke="#374151" strokeWidth="1" strokeDasharray="5 4" />
        <line x1={PAD.left} y1={yMidSvg} x2={PAD.left + cW} y2={yMidSvg}
          stroke="#374151" strokeWidth="1" strokeDasharray="5 4" />

        {/* ── Quadrant labels ── */}
        <text
          x={alphaX === "right" ? alphaX2 - 8 : alphaX1 + 8}
          y={alphaY === "bottom" ? alphaY2 - 8 : alphaY1 + 16}
          fill="#4ade80" fontSize="11" fontWeight="600"
          textAnchor={alphaX === "right" ? "end" : "start"}
          fillOpacity="0.8"
        >
          {alphaLabel}
        </text>
        <text
          x={alphaX === "right" ? overX1 + 8 : overX2 - 8}
          y={alphaY === "bottom" ? overY1 + 16 : overY2 - 8}
          fill="#f87171" fontSize="11" fontWeight="500"
          textAnchor={alphaX === "right" ? "start" : "end"}
          fillOpacity="0.6"
        >
          {overLabel}
        </text>

        {/* ── Y axis ── */}
        {yTicks.map((v, i) => {
          const sy = yS(v);
          if (sy < PAD.top - 4 || sy > PAD.top + cH + 4) return null;
          return (
            <g key={i}>
              <line x1={PAD.left} y1={sy} x2={PAD.left + cW} y2={sy}
                stroke="#1f2937" strokeWidth="1" />
              <text x={PAD.left - 6} y={sy + 4} fill="#4b5563" fontSize="10" textAnchor="end">
                {formatY(v)}
              </text>
            </g>
          );
        })}

        {/* ── X axis ── */}
        {xTicks.map((v, i) => {
          const sx = xS(v);
          return (
            <g key={i}>
              <line x1={sx} y1={PAD.top} x2={sx} y2={PAD.top + cH}
                stroke="#1f2937" strokeWidth="1" />
              <text x={sx} y={PAD.top + cH + 16} fill="#4b5563" fontSize="10" textAnchor="middle">
                {formatX(v)}
              </text>
            </g>
          );
        })}

        {/* ── Axis borders ── */}
        <rect x={PAD.left} y={PAD.top} width={cW} height={cH}
          fill="none" stroke="#374151" strokeWidth="1" />

        {/* ── Axis labels ── */}
        <text x={PAD.left + cW / 2} y={H - 4} fill="#6b7280" fontSize="12"
          textAnchor="middle">{xLabel}</text>
        <text
          x={16} y={PAD.top + cH / 2} fill="#6b7280" fontSize="12"
          textAnchor="middle"
          transform={`rotate(-90, 16, ${PAD.top + cH / 2})`}
        >{yLabel}</text>

        {/* ── Data points ── */}
        {valid.map((p, i) => {
          const px = xS(p.x); const py = yS(p.y);
          const isHovered = hoverIdx === i;
          const col = agapColor(p.agap);
          return (
            <g key={p.netuid}>
              {isHovered && (
                <circle cx={px} cy={py} r="10" fill={col} fillOpacity="0.2" />
              )}
              <circle
                cx={px} cy={py}
                r={isHovered ? 6 : 4.5}
                fill={col}
                fillOpacity={isHovered ? 1 : 0.85}
                stroke={isHovered ? "#fff" : "#0a0a0f"}
                strokeWidth={isHovered ? 1.5 : 0.8}
              />
            </g>
          );
        })}

        {/* ── Hover tooltip ── */}
        {hp && (
          <g style={{ pointerEvents: "none" }}>
            <rect x={ttX} y={ttY} width={TW} height={TH} rx="6"
              fill="#0f172a" stroke="#334155" strokeWidth="1" />
            <text x={ttX + 10} y={ttY + 16} fill="white" fontSize="12" fontWeight="700">
              {hp.name.length > 16 ? hp.name.slice(0, 16) + "…" : hp.name}
            </text>
            <text x={ttX + 10} y={ttY + 30} fill="#9ca3af" fontSize="10">
              {xLabel}: {formatX(hp.x)}
            </text>
            <text x={ttX + 10} y={ttY + 43} fill="#9ca3af" fontSize="10">
              {yLabel}: {formatY(hp.y)}
            </text>
            <text x={ttX + 10} y={ttY + 56} fill={agapColor(hp.agap)} fontSize="10" fontWeight="600">
              aGap: {hp.agap}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ── Analytics page ────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { leaderboard, scanning } = useDashboard();

  if (scanning && leaderboard.length === 0) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl animate-spin mb-4 text-green-400">⟳</div>
          <p className="text-gray-500 text-sm">Loading data…</p>
        </div>
      </main>
    );
  }

  const n = leaderboard.length;

  // ── Build scatter point arrays ────────────────────────────────────
  // 1. Dev Score vs Market Cap (signature — bottom-right = high dev, low cap)
  const devVsMcap: ScatterPoint[] = leaderboard
    .filter(s => s.dev_score > 0 && (s.market_cap ?? 0) > 0)
    .map(s => ({ netuid: s.netuid, name: s.name, x: s.dev_score, y: s.market_cap!, agap: s.composite_score }));

  // 2. aGap Score vs Market Cap (bottom-right = high aGap, low cap)
  const agapVsMcap: ScatterPoint[] = leaderboard
    .filter(s => s.composite_score > 0 && (s.market_cap ?? 0) > 0)
    .map(s => ({ netuid: s.netuid, name: s.name, x: s.composite_score, y: s.market_cap!, agap: s.composite_score }));

  // 3. Emission % vs Market Cap (bottom-right = high emission, low cap = undervalued by market)
  const emVsMcap: ScatterPoint[] = leaderboard
    .filter(s => (s.emission_pct ?? 0) > 0 && (s.market_cap ?? 0) > 0)
    .map(s => ({ netuid: s.netuid, name: s.name, x: (s.emission_pct ?? 0) * 100, y: s.market_cap!, agap: s.composite_score }));

  return (
    <main className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-screen-xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Scatter plots across all {n} subnets. <span className="text-green-400">Bottom-right quadrant</span> = the alpha zone — high activity, low valuation.
            Click any dot to open the subnet.
          </p>
        </div>

        {/* Chart 1: Dev Score vs Market Cap — SIGNATURE */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30 rounded px-2 py-0.5">Signature Chart</span>
          </div>
          <ScatterPlot
            points={devVsMcap}
            title="Dev Activity vs Market Cap"
            subtitle="Subnets in the bottom-right are shipping hard but the market hasn't noticed yet — the core alpha signal."
            xLabel="Dev Score"
            yLabel="Market Cap"
            formatX={v => v.toFixed(0)}
            formatY={fmtMcap}
            xMax100
            yLog
            alphaX="right" alphaY="bottom"
            alphaLabel="High Dev, Low Cap 🔥"
            overLabel="Overhyped ⚠️"
          />
        </div>

        {/* Charts 2 + 3 in a 2-col grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Chart 2: aGap Score vs Market Cap */}
          <ScatterPlot
            points={agapVsMcap}
            title="aGap Score vs Market Cap"
            subtitle="High aGap + low market cap = strongest opportunity signal. Bottom-right is where to look."
            xLabel="aGap Score"
            yLabel="Market Cap"
            formatX={v => v.toFixed(0)}
            formatY={fmtMcap}
            xMax100
            yLog
            alphaX="right" alphaY="bottom"
            alphaLabel="Alpha 🔥"
            overLabel="Priced In ⚠️"
          />

          {/* Chart 3: Emission % vs Market Cap */}
          <ScatterPlot
            points={emVsMcap}
            title="Emission Share vs Market Cap"
            subtitle="High network emissions, low market cap — the market hasn't priced in what the network is paying out."
            xLabel="Emission %"
            yLabel="Market Cap"
            formatX={v => `${v.toFixed(2)}%`}
            formatY={fmtMcap}
            yLog
            alphaX="right" alphaY="bottom"
            alphaLabel="Undervalued 🔥"
            overLabel="Overvalued ⚠️"
          />
        </div>

      </div>
    </main>
  );
}
