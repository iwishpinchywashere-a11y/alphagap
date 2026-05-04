"use client";

import { use, useEffect, useRef, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import SocialLinks from "@/components/dashboard/SocialLinks";

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
interface RankPoint { date: string; rank: number }
interface SubnetData {
  netuid: number; name: string;
  identity: { description?: string; summary?: string; github_repo?: string; twitter?: string; discord?: string; website?: string; tags?: string[] } | null;
  current: Record<string, number | string | boolean | null> | null;
  scoreHistory: ScoreRow[];
  rankHistory: RankPoint[];
  emissionHistory: EmissionPoint[];
  priceHistory: PricePoint[];    // 92 days, always in initial response
  sevenDayPrices: PricePoint[];  // 7d 4h candles
  marketStats: MarketStats | null;
  signals: Signal[];
  metagraph: { validators: number; miners: number; totalNeurons: number };
  flowHistory: { x: string; y: number }[];
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

// ── Subnet live dashboards ────────────────────────────────────────
const SUBNET_DASHBOARDS: Record<number, { label: string; url: string }[]> = {
  1:  [{ label: "Dashboard", url: "https://apex.macrocosmos.ai/" }],
  3:  [{ label: "Dashboard", url: "https://www.tplr.ai/dashboard" }],
  4:  [{ label: "Live Stats", url: "https://stats.targon.com/" }],
  8:  [{ label: "Trading Dashboard", url: "https://dashboard.taoshi.io/" }, { label: "Tokenomics", url: "https://tokenomics.taoshi.io/" }],
  9:  [{ label: "Dashboard", url: "https://iota.macrocosmos.ai/" }],
  12: [{ label: "Grafana", url: "https://grafana.bittensor.church/d/subnet/metagraph-subnet?var-subnet=12" }],
  13: [{ label: "Data Dashboard", url: "https://sn13-dashboard.api.macrocosmos.ai/" }],
  27: [{ label: "GPU Marketplace", url: "https://compute.neuralinternet.ai/" }],
  34: [{ label: "Dashboard", url: "https://app.bitmind.ai/dashboard" }],
  46: [{ label: "Model Dashboard", url: "https://dashboard.resilabs.ai/" }, { label: "Portal", url: "https://portal.resilabs.ai/" }],
  64: [{ label: "Network Stats", url: "https://chutes.ai/app/research" }, { label: "Utilization", url: "https://chutes.ai/app/research/utilization" }],
  72: [{ label: "Coverage Map", url: "https://coverage.natix.network/" }],
  75: [{ label: "Network Stats", url: "https://hipstats.com/" }],
  78: [{ label: "Miner Stats", url: "https://subnet.loosh.ai/" }],
  82: [{ label: "Query Portal", url: "https://ask.hermes-subnet.ai/" }],
  93: [{ label: "Creator Stats", url: "https://stats.bitcast.network/" }],
};

// ── TAO Pages slug helper (mirrors tao-pages-slugs.ts logic) ─────
const TAOPAGES_EXPLICIT_SLUGS: Record<number, string> = {
  64: "chutes", 4: "targon", 120: "affine", 51: "lium", 8: "vanta",
  62: "ridges", 44: "score", 9: "iota", 75: "hippius", 56: "gradients",
  68: "nova", 17: "404gen", 104: "sn104", 86: "sn86", 100: "platform",
};
function taoPageSlug(netuid: number, name: string): string {
  if (TAOPAGES_EXPLICIT_SLUGS[netuid]) return TAOPAGES_EXPLICIT_SLUGS[netuid];
  return name
    .toLowerCase()
    .replace(/[τΤ]/g, "t")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `sn${netuid}`;
}

// ── Shared crosshair helper (SVG lines + dot only — no text) ─────
// The tooltip text is rendered as an HTML overlay outside the SVG so it
// isn't squished by preserveAspectRatio="none" on mobile screens.
function Crosshair({
  cx, cy, W, H, PAD, color,
}: {
  cx: number; cy: number; W: number; H: number;
  PAD: { top: number; right: number; bottom: number; left: number };
  color: string;
}) {
  return (
    <g style={{ pointerEvents: "none" }}>
      {/* Vertical dashed line */}
      <line x1={cx} y1={PAD.top} x2={cx} y2={H - PAD.bottom}
        stroke="#6b7280" strokeWidth="1" strokeDasharray="4 3" />
      {/* Horizontal dashed line */}
      <line x1={PAD.left} y1={cy} x2={W - PAD.right} y2={cy}
        stroke="#6b7280" strokeWidth="1" strokeDasharray="4 3" />
      {/* Snap dot */}
      <circle cx={cx} cy={cy} r="5" fill={color} stroke="#0a0a0f" strokeWidth="2" />
    </g>
  );
}

// ── SVG price chart (CoinGecko-style, interactive) ────────────────
function PriceChart({ data, color }: { data: PricePoint[]; color: string }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 900; const H = 180;
  const PAD = { top: 8, right: 4, bottom: 4, left: 4 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  if (data.length < 2) {
    return <div className="flex items-center justify-center h-48 text-gray-600 text-xs">Loading chart data…</div>;
  }

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
  const yTicks = niceYTicks(yMin, yMax);
  const xIdxs = data.length <= 5
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length * 0.33), Math.floor(data.length * 0.66), data.length - 1];

  const parseTs = (ts: string): Date => {
    if (/^\d+$/.test(ts)) { const n = parseInt(ts, 10); return new Date(n < 1e12 ? n * 1000 : n); }
    return new Date(ts);
  };
  const fmtAxisDate = (ts: string) => {
    const d = parseTs(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const fmtTooltipDate = (ts: string) => {
    const d = parseTs(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    // Map screen coords → viewBox coords (preserveAspectRatio="none" so linear)
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const raw = (svgX - PAD.left) / cW * (data.length - 1);
    setHoverIdx(Math.max(0, Math.min(data.length - 1, Math.round(raw))));
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!svgRef.current || e.touches.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.touches[0].clientX - rect.left) / rect.width) * W;
    const raw = (svgX - PAD.left) / cW * (data.length - 1);
    setHoverIdx(Math.max(0, Math.min(data.length - 1, Math.round(raw))));
  };

  const h = hoverIdx !== null ? hoverIdx : null;

  return (
    <div className="relative">
      {/* HTML tooltip */}
      {h !== null && (
        <div className="absolute inset-x-0 top-1 flex justify-center pointer-events-none z-10">
          <div className="bg-gray-900/95 border border-gray-700 rounded-xl px-4 py-2 text-center shadow-xl">
            <div className="text-white font-bold font-mono text-xl leading-tight">{fmtPrice(data[h].price)}</div>
            <div className="text-gray-400 text-sm mt-0.5">{fmtTooltipDate(data[h].timestamp)}</div>
          </div>
        </div>
      )}

      {/* Y labels left, chart right — HTML labels don't squish on mobile */}
      <div className="flex items-stretch gap-1.5">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between py-[8px] shrink-0 w-12 text-right">
          {[...yTicks].reverse().map((v, i) => (
            <span key={i} className="text-[10px] leading-none text-gray-600">{fmtPrice(v)}</span>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full cursor-crosshair select-none"
            style={{ height: "180px", display: "block" }} preserveAspectRatio="none"
            onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}
            onTouchMove={handleTouchMove} onTouchEnd={() => setHoverIdx(null)}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={color} stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {/* Grid lines only — no SVG text */}
            {yTicks.map((v, i) => (
              <line key={i} x1={PAD.left} y1={yS(v).toFixed(1)} x2={PAD.left + cW} y2={yS(v).toFixed(1)}
                stroke="#1f2937" strokeWidth="1" />
            ))}
            <polygon points={area} fill="url(#priceGrad)" />
            <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {h === null && (
              <circle cx={lastX.toFixed(1)} cy={yS(prices[prices.length - 1]).toFixed(1)} r="4" fill={color} />
            )}
            {h !== null && (
              <Crosshair cx={xS(h)} cy={yS(data[h].price)} W={W} H={H} PAD={PAD} color={color} />
            )}
          </svg>

          {/* X-axis labels */}
          <div className="flex justify-between mt-0.5">
            {xIdxs.map((idx, i) => (
              <span key={i} className="text-[10px] leading-none text-gray-600">
                {fmtAxisDate(data[idx].timestamp)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Compute readable Y-axis ticks ────────────────────────────────
// Returns 3 values that fall at "nice" round numbers within the data range.
function niceYTicks(min: number, max: number): number[] {
  const range = max - min || 1;
  // Pick a step that lands on round numbers
  const roughStep = range / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const step = Math.ceil(roughStep / mag) * mag || 1;
  const start = Math.ceil((min + range * 0.05) / step) * step;
  const ticks: number[] = [];
  for (let v = start; ticks.length < 3 && v <= max - range * 0.05; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  // If we got fewer than 3 ticks, fall back to evenly-spaced percentile positions
  if (ticks.length < 2) {
    return [0.2, 0.5, 0.8].map((t) => Math.round((min + (max - min) * t) * 100) / 100);
  }
  return ticks;
}

// ── Score line chart (interactive) ───────────────────────────────
// x values are ISO timestamp strings (one per scan, ~30min apart)
function ScoreChart({ data, color, label, formatY = (v: number) => v.toFixed(0), invertY = false }: {
  data: { x: string; y: number }[]; color: string; label: string; formatY?: (v: number) => string; invertY?: boolean;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // ── Dimensions ────────────────────────────────────────────────────
  // Axis labels are rendered as HTML overlays (not SVG text) so they scale
  // correctly on all screen sizes — SVG text squishes on mobile with
  // preserveAspectRatio="none". The SVG itself has no left/bottom padding;
  // the parent container reserves space via CSS margins/padding.
  const W = 600; const H = 120;
  const PAD = { top: 10, right: 6, bottom: 4, left: 4 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  if (data.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-1">
        <span className="text-gray-600 text-xs text-center">No history yet — chart builds<br />with each scan (~30 min)</span>
      </div>
    );
  }

  // Tooltip shows date + time for precise hover info
  const fmtTooltipTs = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  const values = data.map((d) => d.y);
  const minV = Math.min(...values); const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const yMin = minV - range * 0.12; const yMax = maxV + range * 0.12;
  const xS = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * cW;
  const yS = (v: number) => invertY
    ? PAD.top + ((v - yMin) / (yMax - yMin)) * cH
    : PAD.top + cH - ((v - yMin) / (yMax - yMin)) * cH;
  const pts = data.map((d, i) => `${xS(i).toFixed(1)},${yS(d.y).toFixed(1)}`).join(" ");
  const area = `${xS(0).toFixed(1)},${PAD.top + cH} ${pts} ${xS(data.length - 1).toFixed(1)},${PAD.top + cH}`;
  const gradId = `sg-${label.replace(/[\s%]+/g, "")}`;

  // Y ticks: nice round values inside the data range
  const yTicks = niceYTicks(yMin, yMax);

  // X labels: pick 3 evenly-spaced indices across the data
  const xLabelIdxs = data.length <= 2
    ? [0, data.length - 1]
    : [0, Math.floor((data.length - 1) / 2), data.length - 1];

  const fmtXLabel = (ts: string) =>
    new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const raw = (svgX - PAD.left) / cW * (data.length - 1);
    setHoverIdx(Math.max(0, Math.min(data.length - 1, Math.round(raw))));
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!svgRef.current || e.touches.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.touches[0].clientX - rect.left) / rect.width) * W;
    const raw = (svgX - PAD.left) / cW * (data.length - 1);
    setHoverIdx(Math.max(0, Math.min(data.length - 1, Math.round(raw))));
  };

  const h = hoverIdx;

  return (
    <div className="relative">
      {/* HTML tooltip */}
      {h !== null && (
        <div className="absolute inset-x-0 top-0.5 flex justify-center pointer-events-none z-10">
          <div className="bg-gray-900/95 border border-gray-700 rounded-xl px-3 py-1.5 text-center shadow-xl">
            <div className="text-white font-bold font-mono text-lg leading-tight">{formatY(data[h].y)}</div>
            <div className="text-gray-400 text-xs mt-0.5">{fmtTooltipTs(data[h].x)}</div>
          </div>
        </div>
      )}

      {/* Chart area: Y labels left, SVG right */}
      <div className="flex items-stretch gap-1">
        {/* Y-axis labels — HTML so they don't squish on mobile */}
        <div className="flex flex-col justify-between py-[10px] shrink-0 w-8 text-right">
          {[...yTicks].reverse().map((v, i) => (
            <span key={i} className="text-[10px] leading-none text-gray-600">{formatY(v)}</span>
          ))}
        </div>

        {/* SVG chart — no left/bottom padding needed, labels are HTML */}
        <div className="flex-1 min-w-0">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full cursor-crosshair select-none"
            style={{ height: "120px", display: "block" }} preserveAspectRatio="none"
            onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}
            onTouchMove={handleTouchMove} onTouchEnd={() => setHoverIdx(null)}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={color} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {/* Horizontal grid lines only — no SVG text */}
            {yTicks.map((v, i) => (
              <line key={i} x1={PAD.left} y1={yS(v).toFixed(1)} x2={PAD.left + cW} y2={yS(v).toFixed(1)}
                stroke="#1f2937" strokeWidth="1" />
            ))}
            <polygon points={area} fill={`url(#${gradId})`} />
            <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {h === null && (
              <circle cx={xS(data.length - 1).toFixed(1)} cy={yS(values[values.length - 1]).toFixed(1)} r="3.5" fill={color} />
            )}
            {h !== null && (
              <Crosshair cx={xS(h)} cy={yS(data[h].y)} W={W} H={H} PAD={PAD} color={color} />
            )}
          </svg>

          {/* X-axis labels — HTML so they don't squish on mobile */}
          <div className="flex justify-between mt-0.5">
            {xLabelIdxs.map((idx, i) => (
              <span key={i} className="text-[10px] leading-none text-gray-600">
                {fmtXLabel(data[idx].x)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TAO Flow EMA Chart ────────────────────────────────────────────
// Full-width interactive chart with timeframe selector.
// Positive flow (inflow) = green, negative (outflow) = red.
// Data comes from TaoMarketCap subnet_ema_tao_flow, sampled every 10 min.
type FlowTf = "1D" | "7D" | "1M" | "3M";
function TaoFlowChart({ allData }: { allData: { x: string; y: number }[] }) {
  const [tf, setTf] = useState<FlowTf>("7D");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const cutoffMs: Record<FlowTf, number> = {
    "1D": 1 * 86400000,
    "7D": 7 * 86400000,
    "1M": 30 * 86400000,
    "3M": 90 * 86400000,
  };

  const data = useMemo(() => {
    const since = Date.now() - cutoffMs[tf];
    const filtered = allData.filter(d => new Date(d.x).getTime() >= since);
    // Downsample for longer ranges to keep SVG fast
    if (filtered.length <= 200) return filtered;
    const step = Math.ceil(filtered.length / 200);
    return filtered.filter((_, i) => i % step === 0 || i === filtered.length - 1);
  }, [allData, tf]);

  // Colour: green if latest value is positive, red if negative
  const latest = data.length > 0 ? data[data.length - 1].y : 0;
  const color = latest >= 0 ? "#4ade80" : "#f87171";

  const W = 600; const H = 200;
  const PAD = { top: 16, right: 6, bottom: 4, left: 4 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const fmtFlow = (v: number) => {
    const abs = Math.abs(v);
    const sign = v >= 0 ? "+" : "−";
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}K τ`;
    if (abs >= 1) return `${sign}${abs.toFixed(1)} τ`;
    return `${sign}${abs.toFixed(3)} τ`;
  };

  const fmtDate = (ts: string) => {
    const d = new Date(ts);
    if (tf === "1D") return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || data.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const raw = (svgX - PAD.left) / cW * (data.length - 1);
    setHoverIdx(Math.max(0, Math.min(data.length - 1, Math.round(raw))));
  };

  if (allData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <div className="text-gray-600 text-sm">TAO Flow EMA data collection in progress</div>
        <div className="text-gray-700 text-xs">Chart populates automatically every 10 minutes</div>
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <div className="text-gray-600 text-sm">Not enough data for this timeframe yet</div>
        <div className="text-gray-700 text-xs">Try a shorter range or check back later</div>
      </div>
    );
  }

  const values = data.map(d => d.y);
  const minV = Math.min(...values); const maxV = Math.max(...values);
  // Ensure zero is always visible — expand range to include 0
  const yMin = Math.min(minV, 0) - Math.abs(maxV - minV) * 0.08;
  const yMax = Math.max(maxV, 0) + Math.abs(maxV - minV) * 0.08;
  const range = yMax - yMin || 1;

  const xS = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * cW;
  const yS = (v: number) => PAD.top + cH - ((v - yMin) / range) * cH;
  const zeroY = yS(0).toFixed(1); // pixel position of the zero line

  const pts = data.map((d, i) => `${xS(i).toFixed(1)},${yS(d.y).toFixed(1)}`).join(" ");
  const area = `${xS(0).toFixed(1)},${zeroY} ${pts} ${xS(data.length - 1).toFixed(1)},${zeroY}`;

  const yTicks = niceYTicks(yMin, yMax);
  const xIdxs = data.length <= 2 ? [0, data.length - 1]
    : [0, Math.floor((data.length - 1) / 2), data.length - 1];

  const h = hoverIdx;

  return (
    <div className="space-y-3">
      {/* Timeframe buttons */}
      <div className="flex items-center gap-1.5">
        {(["1D", "7D", "1M", "3M"] as FlowTf[]).map(t => (
          <button key={t} onClick={() => { setTf(t); setHoverIdx(null); }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              tf === t ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
            }`}>
            {t}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-600">{data.length} data points</span>
      </div>

      {/* Chart */}
      <div className="relative">
        {/* Hover tooltip */}
        {h !== null && (
          <div className="absolute inset-x-0 top-0.5 flex justify-center pointer-events-none z-10">
            <div className="bg-gray-900/95 border border-gray-700 rounded-xl px-4 py-2 text-center shadow-xl">
              <div className={`font-bold font-mono text-xl leading-tight ${data[h].y >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {fmtFlow(data[h].y)}
              </div>
              <div className="text-gray-400 text-xs mt-0.5">{fmtDate(data[h].x)}</div>
            </div>
          </div>
        )}

        <div className="flex items-stretch gap-1.5">
          {/* Y-axis labels */}
          <div className="flex flex-col justify-between py-[16px] shrink-0 w-14 text-right">
            {[...yTicks].reverse().map((v, i) => (
              <span key={i} className={`text-[10px] leading-none ${v >= 0 ? "text-gray-600" : "text-red-800"}`}>
                {fmtFlow(v)}
              </span>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full cursor-crosshair select-none"
              style={{ height: "200px", display: "block" }} preserveAspectRatio="none"
              onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}
              onTouchMove={(e) => {
                e.preventDefault();
                if (!svgRef.current || e.touches.length === 0) return;
                const rect = svgRef.current.getBoundingClientRect();
                const svgX = ((e.touches[0].clientX - rect.left) / rect.width) * W;
                setHoverIdx(Math.max(0, Math.min(data.length - 1, Math.round((svgX - PAD.left) / cW * (data.length - 1)))));
              }}
              onTouchEnd={() => setHoverIdx(null)}>
              <defs>
                <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.30" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              {yTicks.map((v, i) => (
                <line key={i} x1={PAD.left} y1={yS(v).toFixed(1)} x2={PAD.left + cW} y2={yS(v).toFixed(1)}
                  stroke="#1f2937" strokeWidth="1" />
              ))}
              {/* Zero baseline — always visible */}
              <line x1={PAD.left} y1={zeroY} x2={PAD.left + cW} y2={zeroY}
                stroke="#374151" strokeWidth="1.5" strokeDasharray="4 3" />
              <polygon points={area} fill={`url(#flowGrad)`} />
              <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {h === null && (
                <circle cx={xS(data.length - 1).toFixed(1)} cy={yS(latest).toFixed(1)} r="4" fill={color} />
              )}
              {h !== null && <Crosshair cx={xS(h)} cy={yS(data[h].y)} W={W} H={H} PAD={PAD} color={color} />}
            </svg>

            {/* X-axis labels */}
            <div className="flex justify-between mt-0.5">
              {xIdxs.map((idx, i) => (
                <span key={i} className="text-[10px] leading-none text-gray-600">{fmtDate(data[idx].x)}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-gray-700 leading-relaxed">
        TAO Flow EMA measures net TAO moving into or out of this subnet&apos;s liquidity pool (7-day exponential moving average, sourced from TaoMarketCap). Sustained positive flow → emission share rising. Sustained negative flow → emission share falling. This is a leading indicator of where emissions are heading next.
      </p>
    </div>
  );
}

// ── Stat row item ─────────────────────────────────────────────────
function StatItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-800/50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="text-right">
        <span className="text-xs text-white font-medium">{value}</span>
        {sub && <div className="text-[10px] text-gray-600">{sub}</div>}
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

  // ── Watchlist (self-contained — subnet page is outside the dashboard layout) ──
  const [watchlist, setWatchlist] = useState<Set<number>>(new Set());
  const [watchlistBusy, setWatchlistBusy] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/watchlist").then(r => r.ok ? r.json() : null).then(d => {
      if (Array.isArray(d?.netuids)) setWatchlist(new Set(d.netuids.map(Number)));
    }).catch(() => {});
  }, []);
  const isWatched = useCallback((id: number) => watchlist.has(id), [watchlist]);
  const toggleWatchlist = useCallback(async (id: number) => {
    if (watchlistBusy) return;
    setWatchlistBusy(true);
    setWatchlistError(null);
    const watching = watchlist.has(id);
    // Optimistic update
    setWatchlist(prev => { const next = new Set(prev); watching ? next.delete(id) : next.add(id); return next; });
    try {
      const r = watching
        ? await fetch(`/api/watchlist?netuid=${id}`, { method: "DELETE" })
        : await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ netuid: Number(id) }) });
      if (!r.ok) {
        // Revert optimistic update — save failed
        setWatchlist(prev => { const next = new Set(prev); watching ? next.add(id) : next.delete(id); return next; });
        const err = await r.json().catch(() => ({}));
        setWatchlistError(err?.error || `Error ${r.status}`);
        return;
      }
      const d = await r.json();
      if (Array.isArray(d?.netuids)) setWatchlist(new Set(d.netuids.map(Number)));
    } catch {
      // Revert on network error
      setWatchlist(prev => { const next = new Set(prev); watching ? next.add(id) : next.delete(id); return next; });
      setWatchlistError("Network error — try again");
    } finally {
      setWatchlistBusy(false);
    }
  }, [watchlist, watchlistBusy]);

  // 1Y price history lazy-loads only when the user picks 1Y
  const [yearHistory, setYearHistory] = useState<PricePoint[]>([]);
  const [yearLoading, setYearLoading] = useState(false);
  const yearFetched = useRef(false);

  useEffect(() => {
    fetch(`/api/subnets/${netuid}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData).catch((e) => setError(String(e))).finally(() => setLoading(false));
  }, [netuid]);

  // Lazy-load 365d history only when user explicitly picks 1Y
  useEffect(() => {
    if (timeframe !== "1Y") return;
    if (yearFetched.current) return;
    yearFetched.current = true;
    setYearLoading(true);
    fetch(`/api/subnets/${netuid}/prices`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: { priceHistory: PricePoint[] }) => setYearHistory(d.priceHistory || []))
      .catch((e) => console.warn("1Y price history failed:", e))
      .finally(() => setYearLoading(false));
  }, [timeframe, netuid]);

  // Robustly parse timestamp (ISO string or unix-second string)
  const parseTs = (ts: string): number => {
    if (/^\d+$/.test(ts)) { const n = parseInt(ts, 10); return n < 1e12 ? n * 1000 : n; }
    return new Date(ts).getTime();
  };

  // Select the right data series for the chosen timeframe.
  // 1M/3M use priceHistory (92d, always present in initial load) → no lag.
  // 1Y uses yearHistory (lazy-loaded on demand).
  const chartData = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    if (timeframe === "1D") {
      return data.sevenDayPrices.filter((p) => parseTs(p.timestamp) >= now - 86400000);
    }
    if (timeframe === "7D") return data.sevenDayPrices;
    if (timeframe === "1M") {
      return data.priceHistory.filter((p) => parseTs(p.timestamp) >= now - 30 * 86400000);
    }
    if (timeframe === "3M") {
      return data.priceHistory.filter((p) => parseTs(p.timestamp) >= now - 90 * 86400000);
    }
    return yearHistory; // 1Y
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, timeframe, yearHistory]);

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
  // Use scoreHistory for emission so the date range matches all other charts.
  // emissionHistory is collected separately and often only has a few days of data.
  const emissionSeries = data.scoreHistory.length > 0
    ? data.scoreHistory.map((r) => ({ x: r.date, y: r.emission_pct * 100 }))
    : data.emissionHistory.map((r) => ({ x: r.timestamp, y: r.pct }));
  const rankSeries = (data.rankHistory ?? []).map((r) => ({ x: r.date, y: r.rank }));
  const currentRank = rankSeries.length > 0 ? rankSeries[rankSeries.length - 1].y : null;

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
          <span className="text-gray-300">{data.name}</span>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] xl:grid-cols-[1fr_240px] gap-6">

          {/* ── LEFT: Price chart + scores ───────────────────────── */}
          <div className="space-y-5">

            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs bg-gray-800 rounded px-2 py-0.5 text-gray-400">SN{data.netuid}</span>
                {ms?.symbol && <span className="text-xs bg-gray-800 rounded px-2 py-0.5 text-gray-500">{ms.symbol}</span>}
                {data.identity?.tags?.map((tag) => (
                  <span key={tag} className="text-xs bg-gray-800/60 rounded px-2 py-0.5 text-gray-600">{tag}</span>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <h1 className="text-2xl font-bold text-white">{data.name}</h1>
                <button
                  onClick={() => toggleWatchlist(data.netuid)}
                  disabled={watchlistBusy}
                  className={`flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 border transition-colors disabled:opacity-50 ${
                    isWatched(data.netuid)
                      ? "bg-green-500/10 border-green-500/40 text-green-400 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400"
                      : "bg-gray-800/60 border-gray-700 text-gray-400 hover:bg-green-500/10 hover:border-green-500/40 hover:text-green-400"
                  }`}
                  title={isWatched(data.netuid) ? "Remove from watchlist" : "Add to watchlist"}
                >
                  {watchlistBusy ? "…" : isWatched(data.netuid) ? "★ Watching" : "☆ Watchlist"}
                </button>
                {watchlistError && (
                  <span className="text-xs text-red-400">{watchlistError}</span>
                )}
              </div>

              {/* Links */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
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
                    𝕏 X
                  </a>
                )}
                {data.identity?.discord && (
                  <a href={data.identity.discord} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-full px-3 py-1 transition-colors">
                    Discord
                  </a>
                )}
                {(SUBNET_DASHBOARDS[data.netuid] ?? []).map((d, i) => (
                  <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-full px-3 py-1 transition-colors">
                    📊 {d.label}
                  </a>
                ))}
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
              {yearLoading && timeframe === "1Y" && chartData.length < 2
                ? <div className="flex items-center justify-center h-48 text-gray-600 text-xs gap-2">
                    <span className="animate-spin">⟳</span> Loading 1Y price history…
                  </div>
                : <PriceChart data={chartData} color={chartColor} />
              }

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
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">AlphaGap Score History</h2>
                <span className="text-xs text-gray-600">
                  {data.scoreHistory.length > 0
                    ? `${data.scoreHistory.length} snapshot${data.scoreHistory.length !== 1 ? "s" : ""}`
                    : "No history yet"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                {/* aGap Rank chart — inverted y-axis, rank 1 = top */}
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">aGap Rank</span>
                      <span className="text-[10px] text-gray-600 ml-1.5">best rank per day</span>
                    </div>
                    <span className="text-lg font-bold tabular-nums text-amber-400">
                      {currentRank != null ? `#${currentRank}` : "—"}
                    </span>
                  </div>
                  <ScoreChart
                    data={rankSeries}
                    color="#f59e0b"
                    label="aGap Rank"
                    formatY={(v) => `#${Math.round(v)}`}
                    invertY={true}
                  />
                </div>
              </div>
            </div>

            {/* ── TAO Flow EMA Chart ──────────────────────────────── */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">TAO Flow EMA</h2>
                <span className="text-xs text-gray-600">emission trajectory indicator</span>
              </div>
              <TaoFlowChart allData={data.flowHistory ?? []} />
            </div>

            {/* Description */}
            {(data.identity?.summary || data.identity?.description) && (
              <p className="text-gray-400 text-sm max-w-2xl">{data.identity.summary || data.identity.description}</p>
            )}

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

          {/* ── RIGHT: Compact sidebar ───────────────────────────── */}
          <div className="space-y-3">

            {/* aGap score badge */}
            <div className="bg-gray-900/60 border border-green-900/30 rounded-xl p-3">
              <div className="text-[10px] font-semibold text-green-400/70 uppercase tracking-wider mb-1.5">AlphaGap Score</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold tabular-nums ${scoreColor(agap)}`}>{agap}</span>
                <span className="text-xs text-gray-600">/ 100</span>
              </div>
            </div>

            {/* Market data */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Market Data</div>
              <StatItem label="Market Cap" value={ms ? fmtUsd(ms.marketCapUsd) : "—"} />
              <StatItem label="FDV" value={ms ? fmtUsd(ms.fdvUsd) : "—"} />
              <StatItem label="24h Volume" value={ms ? fmtUsd(ms.volume24hUsd) : "—"} />
              <StatItem label="Buys / Sells" value={ms ? `${ms.buys24h} / ${ms.sells24h}` : "—"} sub="24h" />
              <StatItem label="Circ. Supply" value={ms ? fmtNum(ms.circulatingSupply) : "—"} />
              <StatItem label="In Pool" value={ms ? fmtNum(ms.alphaInPool) : "—"} />
              <StatItem label="Staked" value={ms ? fmtNum(ms.alphaStaked) : "—"} />
            </div>

            {/* Fear & Greed */}
            {ms && ms.fearGreedIndex > 0 && (
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Fear &amp; Greed</div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-lg font-bold ${ms.fearGreedIndex >= 75 ? "text-green-400" : ms.fearGreedIndex >= 50 ? "text-yellow-400" : ms.fearGreedIndex >= 25 ? "text-orange-400" : "text-red-400"}`}>
                    {Math.round(ms.fearGreedIndex)}
                  </span>
                  <span className={`text-xs font-medium ${ms.fearGreedIndex >= 75 ? "text-green-400" : ms.fearGreedIndex >= 50 ? "text-yellow-400" : ms.fearGreedIndex >= 25 ? "text-orange-400" : "text-red-400"}`}>
                    {ms.fearGreedSentiment}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-400"
                    style={{ width: `${ms.fearGreedIndex}%` }} />
                </div>
              </div>
            )}

            {/* TAO Pages link */}
            <Link
              href={`/taopages/${taoPageSlug(data.netuid, data.name)}`}
              className="flex items-center justify-between bg-gray-900/60 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl p-3 transition-colors group"
            >
              <div>
                <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-0.5">TAO Pages</div>
                <div className="text-xs text-gray-400 group-hover:text-white transition-colors">Plain-English explainer for {data.name}</div>
              </div>
              <svg className="w-4 h-4 text-emerald-600 group-hover:text-emerald-400 transition-colors shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            {/* Network */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Network</div>
              <StatItem label="Validators" value={String(data.metagraph.validators)} />
              <StatItem label="Miners" value={String(data.metagraph.miners)} />
              <StatItem label="Neurons" value={String(data.metagraph.totalNeurons)} />
              <StatItem label="Emission" value={emissionPct > 0 ? `${(emissionPct * 100).toFixed(2)}%` : "—"} />
            </div>

            {data.lastScan && (
              <p className="text-[10px] text-gray-700 text-center">
                Scan: {new Date(data.lastScan).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
        <span>AlphaGap v0.3 — Bittensor Subnet Intelligence</span>
        <SocialLinks />
      </footer>
    </div>
  );
}
