"use client";

import { use, useEffect, useState, useMemo } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────
interface ScoreRow { date: string; agap: number; flow: number; dev: number; eval: number; social: number; price: number; mcap: number; emission_pct: number }
interface PricePoint { timestamp: string; price: number }
interface EmissionPoint { pct: number; timestamp: string }
interface Signal { netuid: number; strength: number; signal_type: string; title: string; description: string; source: string; source_url?: string; signal_date?: string; created_at: string }
interface MarketStats {
  priceUsd: number; priceChangePct1h: number; priceChangePct24h: number;
  priceChangePct7d: number; priceChangePct30d: number;
  marketCapUsd: number; fdvUsd: number; volume24hUsd: number;
  high24hUsd: number; low24hUsd: number;
  circulatingSupply: number; alphaInPool: number; alphaStaked: number;
  buys24h: number; sells24h: number; buyers24h: number; sellers24h: number;
  fearGreedIndex: number; fearGreedSentiment: string;
  symbol: string; taoPrice: number;
}
interface SubnetData {
  netuid: number; name: string;
  identity: { description?: string; summary?: string; github_repo?: string; twitter?: string; discord?: string; website?: string; tags?: string[] } | null;
  current: Record<string, number | string | boolean | null> | null;
  scoreHistory: ScoreRow[];
  emissionHistory: EmissionPoint[];
  priceHistory: PricePoint[];
  sevenDayPrices: PricePoint[];
  marketStats: MarketStats | null;
  signals: Signal[];
  metagraph: { validators: number; miners: number; totalNeurons: number };
  lastScan: string | null;
}

type Timeframe = "1D" | "7D" | "1M" | "3M" | "1Y";

// ── Formatters ───────────────────────────────────────────────────
function fmtUsd(v: number, decimals?: number): string {
  if (v === 0) return "$0";
  if (decimals !== undefined) return `$${v.toFixed(decimals)}`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}
function fmtPrice(v: number): string {
  if (v === 0) return "$0.00";
  if (v < 0.000001) return `$${v.toFixed(8)}`;
  if (v < 0.0001) return `$${v.toFixed(6)}`;
  if (v < 0.01) return `$${v.toFixed(5)}`;
  if (v < 1) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}
function fmtNum(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}
function fmtPct(v: number): string { return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`; }
function pctColor(v: number): string { return v >= 0 ? "text-green-400" : "text-red-400"; }
function scoreColor(s: number): string { return s >= 70 ? "text-green-400" : s >= 40 ? "text-yellow-400" : "text-red-400"; }

// ── SVG price chart (CoinGecko-style) ────────────────────────────
function PriceChart({ data, color }: { data: PricePoint[]; color: string }) {
  if (data.length < 2) {
    return <div className="flex items-center justify-center h-48 text-gray-600 text-xs">Loading chart data…</div>;
  }
  const W = 900; const H = 200;
  const PAD = { top: 8, right: 8, bottom: 24, left: 60 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const prices = data.map((d) => d.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || minP * 0.01 || 0.001;
  const yMin = minP - range * 0.08;
  const yMax = maxP + range * 0.08;

  const xS = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * cW;
  const yS = (v: number) => PAD.top + cH - ((v - yMin) / (yMax - yMin)) * cH;

  const pts = data.map((d, i) => `${xS(i).toFixed(1)},${yS(d.price).toFixed(1)}`).join(" ");
  const lastX = xS(data.length - 1);
  const baseY = PAD.top + cH;
  const area = `${xS(0).toFixed(1)},${baseY} ${pts} ${lastX.toFixed(1)},${baseY}`;

  // Y axis ticks (4)
  const yTicks = [0.1, 0.37, 0.63, 0.9].map((t) => yMin + (yMax - yMin) * t);

  // X axis labels (up to 5 evenly spaced)
  const xIdxs = data.length <= 5
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length * 0.25), Math.floor(data.length * 0.5), Math.floor(data.length * 0.75), data.length - 1];

  const parseTsInner = (ts: string): Date => {
    if (/^\d+$/.test(ts)) { const n = parseInt(ts, 10); return new Date(n < 1e12 ? n * 1000 : n); }
    return new Date(ts);
  };
  const fmtDate = (ts: string) => {
    const d = parseTsInner(ts);
    if (data.length <= 2) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (data.length <= 14) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "200px" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={yS(v).toFixed(1)} x2={PAD.left + cW} y2={yS(v).toFixed(1)} stroke="#1f2937" strokeWidth="1" />
          <text x={PAD.left - 6} y={(yS(v) + 4).toFixed(1)} fill="#4b5563" fontSize="10" textAnchor="end">{fmtPrice(v)}</text>
        </g>
      ))}
      {/* Area + Line */}
      <polygon points={area} fill="url(#priceGrad)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* X labels */}
      {xIdxs.map((idx, i) => (
        <text key={i} x={xS(idx).toFixed(1)} y={H - 4} fill="#4b5563" fontSize="10" textAnchor="middle">{fmtDate(data[idx].timestamp)}</text>
      ))}
      {/* Last price dot */}
      <circle cx={lastX.toFixed(1)} cy={yS(prices[prices.length - 1]).toFixed(1)} r="4" fill={color} />
    </svg>
  );
}

// ── Score line chart ──────────────────────────────────────────────
function ScoreChart({ data, color, label, formatY = (v: number) => v.toFixed(0) }: {
  data: { x: string; y: number }[]; color: string; label: string; formatY?: (v: number) => string;
}) {
  if (data.length < 2) {
    const val = data[0]?.y;
    return (
      <div className="flex flex-col items-center justify-center h-24 gap-1">
        {val != null && <span className="text-2xl font-bold" style={{ color }}>{formatY(val)}</span>}
        <span className="text-gray-600 text-xs">Accumulating — grows with each scan</span>
      </div>
    );
  }
  const W = 500; const H = 96;
  const PAD = { top: 8, right: 8, bottom: 18, left: 38 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const values = data.map((d) => d.y);
  const minV = Math.min(...values); const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const yMin = minV - range * 0.15; const yMax = maxV + range * 0.15;
  const xS = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * cW;
  const yS = (v: number) => PAD.top + cH - ((v - yMin) / (yMax - yMin)) * cH;
  const pts = data.map((d, i) => `${xS(i).toFixed(1)},${yS(d.y).toFixed(1)}`).join(" ");
  const area = `${xS(0).toFixed(1)},${PAD.top + cH} ${pts} ${xS(data.length - 1).toFixed(1)},${PAD.top + cH}`;
  const gradId = `sg-${label}`;
  const yTicks = [minV + range * 0.1, minV + range * 0.9];
  const xLabels = [0, data.length - 1].map((i) => ({
    x: xS(i), label: new Date(data[i].x + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "96px" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={yS(v).toFixed(1)} x2={PAD.left + cW} y2={yS(v).toFixed(1)} stroke="#1f2937" strokeWidth="1" />
          <text x={PAD.left - 4} y={(yS(v) + 3).toFixed(1)} fill="#4b5563" fontSize="9" textAnchor="end">{formatY(v)}</text>
        </g>
      ))}
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {xLabels.map((l, i) => (
        <text key={i} x={l.x.toFixed(1)} y={H - 2} fill="#4b5563" fontSize="9" textAnchor={i === 0 ? "start" : "end"}>{l.label}</text>
      ))}
      <circle cx={xS(data.length - 1).toFixed(1)} cy={yS(values[values.length - 1]).toFixed(1)} r="3" fill={color} />
    </svg>
  );
}

// ── Stat row item ─────────────────────────────────────────────────
function StatItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-800/60 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <div className="text-right">
        <span className="text-sm text-white font-medium">{value}</span>
        {sub && <div className="text-xs text-gray-600">{sub}</div>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function SubnetDetailPage({ params }: { params: Promise<{ netuid: string }> }) {
  const { netuid } = use(params);
  const [data, setData] = useState<SubnetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("1M");

  useEffect(() => {
    fetch(`/api/subnets/${netuid}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData).catch((e) => setError(String(e))).finally(() => setLoading(false));
  }, [netuid]);

  // Robustly parse a timestamp that may be ISO string or unix-second string
  const parseTs = (ts: string): number => {
    if (/^\d+$/.test(ts)) {
      const n = parseInt(ts, 10);
      return n < 1e12 ? n * 1000 : n; // unix seconds → ms
    }
    return new Date(ts).getTime();
  };

  // Select the right data series for the chosen timeframe
  const chartData = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    if (timeframe === "1D") {
      const cutoff = now - 86400000;
      return data.sevenDayPrices.filter((p) => parseTs(p.timestamp) >= cutoff);
    }
    if (timeframe === "7D") return data.sevenDayPrices;
    if (timeframe === "1M") {
      const cutoff = now - 30 * 86400000;
      return data.priceHistory.filter((p) => parseTs(p.timestamp) >= cutoff);
    }
    if (timeframe === "3M") {
      const cutoff = now - 90 * 86400000;
      return data.priceHistory.filter((p) => parseTs(p.timestamp) >= cutoff);
    }
    return data.priceHistory; // 1Y
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, timeframe]);

  // Chart color based on whether price is up in the selected window
  const chartColor = useMemo(() => {
    if (chartData.length < 2) return "#4ade80";
    return chartData[chartData.length - 1].price >= chartData[0].price ? "#4ade80" : "#f87171";
  }, [chartData]);

  // Price change % for selected timeframe
  const tfChangePct = useMemo(() => {
    if (!data?.marketStats) return null;
    const ms = data.marketStats;
    if (timeframe === "1D") return ms.priceChangePct24h;
    if (timeframe === "7D") return ms.priceChangePct7d;
    if (timeframe === "1M") return ms.priceChangePct30d;
    if (timeframe === "3M") return null;
    if (timeframe === "1Y") return null;
    return null;
  }, [data, timeframe]);

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl animate-spin mb-4 text-green-400">⟳</div>
        <p className="text-gray-500 text-sm">Loading subnet data…</p>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-gray-400">{error || "Subnet not found"}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-green-400 hover:underline text-sm">← Back to Dashboard</Link>
      </div>
    </div>
  );

  const ms = data.marketStats;
  const c = data.current;
  const agap = (c?.composite_score as number) || 0;
  const flow = (c?.flow_score as number) || 0;
  const dev = (c?.dev_score as number) || 0;
  const evalScore = (c?.eval_score as number) || 0;
  const social = (c?.social_score as number) || 0;
  const emissionPct = (c?.emission_pct as number) || 0;

  const agapSeries = data.scoreHistory.map((r) => ({ x: r.date, y: r.agap }));
  const flowSeries = data.scoreHistory.map((r) => ({ x: r.date, y: r.flow }));
  const devSeries = data.scoreHistory.map((r) => ({ x: r.date, y: r.dev }));
  const evalSeries = data.scoreHistory.map((r) => ({ x: r.date, y: r.eval }));
  const socialSeries = data.scoreHistory.map((r) => ({ x: r.date, y: r.social }));
  const emissionSeries = data.emissionHistory.map((r) => ({ x: r.timestamp, y: r.pct }));

  const TIMEFRAMES: Timeframe[] = ["1D", "7D", "1M", "3M", "1Y"];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100">
      {/* Nav */}
      <div className="border-b border-gray-800 px-4 md:px-6 py-3 flex items-center gap-4">
        <a href="/dashboard">
          <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-10 w-auto" />
        </a>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/dashboard" className="hover:text-gray-300 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/signals" className="hover:text-gray-300 transition-colors">Signals</Link>
          <span>/</span>
          <span className="text-gray-300">{data.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT: Price chart + scores ───────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs bg-gray-800 rounded px-2 py-0.5 text-gray-400">SN{data.netuid}</span>
                {ms?.symbol && <span className="text-xs bg-gray-800 rounded px-2 py-0.5 text-gray-500">{ms.symbol}</span>}
                {data.identity?.tags?.map((tag) => (
                  <span key={tag} className="text-xs bg-gray-800/60 rounded px-2 py-0.5 text-gray-600">{tag}</span>
                ))}
              </div>
              <h1 className="text-2xl font-bold text-white">{data.name}</h1>
              {(data.identity?.summary || data.identity?.description) && (
                <p className="text-gray-400 text-sm mt-1 max-w-2xl">{data.identity.summary || data.identity.description}</p>
              )}

              {/* Links */}
              <div className="flex flex-wrap items-center gap-4 mt-3">
                {data.identity?.website && (
                  <a href={data.identity.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-full px-3 py-1 transition-colors">
                    🌐 Website
                  </a>
                )}
                {data.identity?.github_repo && (
                  <a href={data.identity.github_repo} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-full px-3 py-1 transition-colors">
                    ⎇ GitHub
                  </a>
                )}
                {data.identity?.twitter && (
                  <a href={`https://x.com/${data.identity.twitter.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-full px-3 py-1 transition-colors">
                    𝕏 Twitter
                  </a>
                )}
                {data.identity?.discord && (
                  <a href={data.identity.discord} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-full px-3 py-1 transition-colors">
                    Discord
                  </a>
                )}
              </div>
            </div>

            {/* Price hero */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <div className="flex items-end gap-4 mb-1">
                <span className="text-4xl font-bold text-white">
                  {ms ? fmtPrice(ms.priceUsd) : "—"}
                </span>
                {ms && (
                  <div className="flex items-center gap-3 mb-1">
                    {tfChangePct != null && (
                      <span className={`text-base font-semibold ${pctColor(tfChangePct)}`}>
                        {fmtPct(tfChangePct)} ({timeframe})
                      </span>
                    )}
                    {ms.taoPrice > 0 && (
                      <span className="text-sm text-gray-500">
                        {ms.priceUsd > 0 ? `${(ms.priceUsd / ms.taoPrice).toFixed(6)} TAO` : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Change badges for all timeframes */}
              {ms && (
                <div className="flex gap-3 mb-4">
                  {[
                    { label: "1h", val: ms.priceChangePct1h },
                    { label: "24h", val: ms.priceChangePct24h },
                    { label: "7d", val: ms.priceChangePct7d },
                    { label: "30d", val: ms.priceChangePct30d },
                  ].map(({ label, val }) => (
                    <div key={label} className="text-xs">
                      <span className="text-gray-600 mr-1">{label}</span>
                      <span className={pctColor(val)}>{fmtPct(val)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Timeframe toggle */}
              <div className="flex items-center gap-1 mb-3">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                      timeframe === tf
                        ? "bg-green-500/20 text-green-400 border border-green-500/40"
                        : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              {/* Chart */}
              <PriceChart data={chartData} color={chartColor} />

              {/* 24h range */}
              {ms && ms.high24hUsd > 0 && (
                <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                  <span>24h Low: <span className="text-red-400">{fmtPrice(ms.low24hUsd)}</span></span>
                  <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-500 to-green-500 rounded-full" style={{
                      width: ms.high24hUsd > ms.low24hUsd
                        ? `${((ms.priceUsd - ms.low24hUsd) / (ms.high24hUsd - ms.low24hUsd) * 100).toFixed(1)}%`
                        : "50%"
                    }} />
                  </div>
                  <span>24h High: <span className="text-green-400">{fmtPrice(ms.high24hUsd)}</span></span>
                </div>
              )}
            </div>

            {/* ── AlphaGap score charts ─────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">AlphaGap Scores</h2>
                {data.scoreHistory.length < 3 && (
                  <span className="text-xs text-yellow-400/70 bg-yellow-900/20 border border-yellow-800/30 rounded px-2 py-0.5">
                    {data.scoreHistory.length} day{data.scoreHistory.length !== 1 ? "s" : ""} — accumulating
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: "aGap", data: agapSeries, color: "#4ade80", current: agap },
                  { label: "Flow", data: flowSeries, color: "#34d399", current: flow },
                  { label: "Dev", data: devSeries, color: "#60a5fa", current: dev },
                  { label: "eVal", data: evalSeries, color: "#a78bfa", current: evalScore },
                  { label: "Social", data: socialSeries, color: "#22d3ee", current: social },
                  { label: "Emission %", data: emissionSeries, color: "#f59e0b", current: emissionPct * 100,
                    formatY: (v: number) => `${v.toFixed(2)}%` },
                ].map(({ label, data: d, color, current: cur, formatY }) => (
                  <div key={label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
                      <span className={`text-lg font-bold tabular-nums ${label !== "Emission %" ? scoreColor(cur) : "text-yellow-400"}`}>
                        {label === "Emission %" ? `${(cur).toFixed(2)}%` : Math.round(cur)}
                      </span>
                    </div>
                    <ScoreChart data={d} color={color} label={label} formatY={formatY} />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Recent signals ─────────────────────────────────── */}
            {data.signals.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Recent Signals</h2>
                <div className="space-y-2">
                  {data.signals.slice(0, 8).map((sig, i) => (
                    <div key={i} className={`bg-gray-900/50 border rounded-lg px-4 py-3 flex items-start gap-3 ${
                      sig.strength >= 80 ? "border-green-800/50" : sig.strength >= 50 ? "border-yellow-900/30" : "border-gray-800"
                    }`}>
                      <div className="shrink-0 text-base">
                        {sig.signal_type === "dev_spike" ? "🔨" : sig.signal_type === "release" ? "🚀" : sig.signal_type === "hf_update" ? "🤗" : sig.signal_type === "flow_inflection" ? "↗" : "•"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-gray-500">
                            {new Date(sig.signal_date || sig.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          <span className="text-xs text-gray-600">via {sig.source}</span>
                          {sig.source_url && (
                            <a href={sig.source_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:underline">View →</a>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 truncate">{sig.title}</p>
                      </div>
                      <div className={`text-sm font-bold shrink-0 ${sig.strength >= 80 ? "text-green-400" : sig.strength >= 50 ? "text-yellow-400" : "text-gray-500"}`}>
                        {sig.strength}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Market stats sidebar ─────────────────────── */}
          <div className="space-y-4">

            {/* Market data */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Market Data</h3>
              <div>
                <StatItem label="Market Cap" value={ms ? fmtUsd(ms.marketCapUsd) : "—"} />
                <StatItem label="Fully Diluted Val." value={ms ? fmtUsd(ms.fdvUsd) : "—"} />
                <StatItem label="24h Volume" value={ms ? fmtUsd(ms.volume24hUsd) : "—"}
                  sub={ms ? `${fmtNum(ms.buys24h)} buys / ${fmtNum(ms.sells24h)} sells` : undefined} />
                <StatItem label="Circulating Supply" value={ms ? fmtNum(ms.circulatingSupply) : "—"} />
                <StatItem label="In Pool" value={ms ? fmtNum(ms.alphaInPool) : "—"} />
                <StatItem label="Staked" value={ms ? fmtNum(ms.alphaStaked) : "—"} />
                <StatItem label="Buyers / Sellers" value={ms ? `${ms.buyers24h} / ${ms.sellers24h}` : "—"} sub="24h" />
              </div>
            </div>

            {/* Fear & Greed */}
            {ms && ms.fearGreedIndex > 0 && (
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Fear & Greed Index</h3>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-white">{Math.round(ms.fearGreedIndex)}</div>
                  <div>
                    <div className={`text-sm font-semibold ${ms.fearGreedIndex >= 75 ? "text-green-400" : ms.fearGreedIndex >= 50 ? "text-yellow-400" : ms.fearGreedIndex >= 25 ? "text-orange-400" : "text-red-400"}`}>
                      {ms.fearGreedSentiment}
                    </div>
                    <div className="text-xs text-gray-600">TaoStats index</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-400"
                    style={{ width: `${ms.fearGreedIndex}%` }} />
                </div>
              </div>
            )}

            {/* Network */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Network</h3>
              <div>
                <StatItem label="Validators" value={String(data.metagraph.validators)} />
                <StatItem label="Miners" value={String(data.metagraph.miners)} />
                <StatItem label="Total Neurons" value={String(data.metagraph.totalNeurons)} />
                <StatItem label="Emission Share" value={emissionPct > 0 ? `${(emissionPct * 100).toFixed(2)}%` : "—"} />
              </div>
            </div>

            {/* AlphaGap score summary */}
            <div className="bg-gray-900/60 border border-green-900/30 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-green-400/70 uppercase tracking-wider mb-3">AlphaGap Score</h3>
              <div className="flex items-center gap-3 mb-3">
                <div className={`text-4xl font-bold tabular-nums ${scoreColor(agap)}`}>{agap}</div>
                <div className="text-xs text-gray-500">/ 100<br />composite</div>
              </div>
              <div>
                {[
                  { label: "Flow", val: flow }, { label: "Dev", val: dev },
                  { label: "eVal", val: evalScore }, { label: "Social", val: social },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-center gap-2 py-1.5 border-b border-gray-800/60 last:border-0">
                    <span className="text-xs text-gray-500 w-12">{label}</span>
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${val >= 70 ? "bg-green-400" : val >= 40 ? "bg-yellow-400" : "bg-red-400"}`}
                        style={{ width: `${val}%` }} />
                    </div>
                    <span className={`text-xs font-bold w-8 text-right ${scoreColor(val)}`}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {data.lastScan && (
              <p className="text-xs text-gray-700 text-center">
                Last scan: {new Date(data.lastScan).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
