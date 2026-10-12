"use client";

/**
 * LineChart: the one line-chart renderer for the subnet pages.
 *
 * The previous charts drew into a fixed 900x180 viewBox and stretched it to
 * the container with preserveAspectRatio="none". On a phone that squashes
 * the x axis 2.4x and leaves the y axis alone, so the stroke is thick in one
 * direction and thin in the other, every corner looks jagged and the left
 * axis column eats 48 of 375 pixels. This component measures its container
 * and draws in real pixels, smooths with a monotone cubic (no overshoot, so
 * a smoothed line never shows a price that did not trade), keeps the axis
 * labels inside the plot, and scrubs with pointer events on touch and mouse.
 */

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

export interface ChartPoint { t: number; v: number }

interface Props {
  points: ChartPoint[];
  color: string;
  height?: number;
  formatValue: (v: number) => string;
  formatAxisTime: (t: number) => string;
  formatTooltipTime: (t: number) => string;
  /** Draw a dashed baseline at this value and fill the area from it (TAO flow uses 0). */
  baseline?: number | null;
  /** Rank-style series where a smaller value should sit higher. */
  invertY?: boolean;
  /** Label the highest and lowest points. */
  showExtremes?: boolean;
  /** Fired while scrubbing; null when the pointer leaves. */
  onHover?: (p: ChartPoint | null) => void;
  /** Changing this replays the draw-in animation (pass the timeframe). */
  animateKey?: string | number;
  className?: string;
}

const PAD = { top: 16, right: 10, bottom: 22, left: 10 };
const MAX_POINTS = 600;

/** Monotone cubic (Fritsch-Carlson) path through the points; never overshoots. */
function monotonePath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 0) return "";
  if (n === 1) return `M${xs[0]},${ys[0]}`;
  const dx: number[] = [], dy: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx.push(xs[i + 1] - xs[i]); dy.push(ys[i + 1] - ys[i]); m.push(dx[i] === 0 ? 0 : dy[i] / dx[i]); }
  const tan: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) tan.push(0);
    else { const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1]; tan.push((w1 + w2) / (w1 / m[i - 1] + w2 / m[i])); }
  }
  tan.push(m[n - 2]);
  let d = `M${xs[0].toFixed(2)},${ys[0].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(xs[i] + h).toFixed(2)},${(ys[i] + tan[i] * h).toFixed(2)} ${(xs[i + 1] - h).toFixed(2)},${(ys[i + 1] - tan[i + 1] * h).toFixed(2)} ${xs[i + 1].toFixed(2)},${ys[i + 1].toFixed(2)}`;
  }
  return d;
}

/** Three round-number gridlines inside the plotted range. */
function niceTicks(min: number, max: number, count = 3): number[] {
  const range = max - min || Math.abs(max) || 1;
  const rough = range / (count + 1);
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const steps = [1, 2, 2.5, 5, 10];
  const step = steps.map(s => s * mag).find(s => s >= rough) ?? rough;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9 && out.length < count + 2; v += step) out.push(v);
  if (out.length < 2) return [0.25, 0.5, 0.75].map(f => min + range * f);
  return out;
}

/** Thin very long series for rendering while keeping the first, last, min and max. */
function thin(points: ChartPoint[]): ChartPoint[] {
  if (points.length <= MAX_POINTS) return points;
  const step = Math.ceil(points.length / MAX_POINTS);
  let minI = 0, maxI = 0;
  points.forEach((p, i) => { if (p.v < points[minI].v) minI = i; if (p.v > points[maxI].v) maxI = i; });
  return points.filter((_, i) => i % step === 0 || i === points.length - 1 || i === minI || i === maxI);
}

export default function LineChart({
  points: rawPoints, color, height = 220, formatValue, formatAxisTime, formatTooltipTime,
  baseline = null, invertY = false, showExtremes = false, onHover, animateKey, className = "",
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId().replace(/:/g, "");

  useLayoutEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(entries => { for (const e of entries) setWidth(Math.round(e.contentRect.width)); });
    ro.observe(el); setWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const points = useMemo(() => thin(rawPoints), [rawPoints]);

  const geo = useMemo(() => {
    if (points.length < 2 || width === 0) return null;
    const vals = points.map(p => p.v);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (baseline != null) { lo = Math.min(lo, baseline); hi = Math.max(hi, baseline); }
    const span = hi - lo || Math.abs(hi) * 0.02 || 1;
    const yLo = lo - span * 0.10, yHi = hi + span * 0.10;
    const t0 = points[0].t, t1 = points[points.length - 1].t, tSpan = t1 - t0 || 1;
    const plotW = width - PAD.left - PAD.right, plotH = height - PAD.top - PAD.bottom;
    const x = (t: number) => PAD.left + ((t - t0) / tSpan) * plotW;
    const y = (v: number) => {
      const f = (v - yLo) / (yHi - yLo);
      return invertY ? PAD.top + f * plotH : PAD.top + plotH - f * plotH;
    };
    const xs = points.map(p => x(p.t)), ys = points.map(p => y(p.v));
    const line = monotonePath(xs, ys);
    const baseY = baseline != null ? y(baseline) : PAD.top + plotH;
    const area = `${line} L${xs[xs.length - 1].toFixed(2)},${baseY.toFixed(2)} L${xs[0].toFixed(2)},${baseY.toFixed(2)} Z`;
    let minI = 0, maxI = 0;
    vals.forEach((v, i) => { if (v < vals[minI]) minI = i; if (v > vals[maxI]) maxI = i; });
    const ticks = niceTicks(yLo, yHi).filter(v => v > yLo && v < yHi)
      .filter((v, i, arr) => arr.findIndex(w => formatValue(w) === formatValue(v)) === i);
    // Four x labels at even time positions, snapped to real points
    const labelCount = width < 260 ? 2 : width < 420 ? 3 : 4;
    const xLabels = Array.from({ length: labelCount }, (_, i) => {
      const target = t0 + (tSpan * i) / (labelCount - 1);
      let best = 0; for (let k = 1; k < points.length; k++) if (Math.abs(points[k].t - target) < Math.abs(points[best].t - target)) best = k;
      return { x: xs[best], t: points[best].t, align: i === 0 ? "left" : i === labelCount - 1 ? "right" : "center" };
    });
    return { xs, ys, line, area, baseY, minI, maxI, ticks, y, xLabels, plotW, plotH };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, width, height, baseline, invertY]);

  // Replay the draw-in when the series changes (timeframe switch)
  const pathRef = useRef<SVGPathElement>(null);
  useEffect(() => {
    const el = pathRef.current; if (!el || !geo) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const len = el.getTotalLength();
    el.style.transition = "none";
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    void el.getBoundingClientRect();
    el.style.transition = "stroke-dashoffset 650ms cubic-bezier(.22,.61,.36,1)";
    el.style.strokeDashoffset = "0";
    const done = window.setTimeout(() => { el.style.strokeDasharray = ""; el.style.transition = "none"; }, 700);
    return () => window.clearTimeout(done);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateKey, width]);

  const setFromClientX = (clientX: number) => {
    if (!geo || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const px = clientX - rect.left;
    // nearest point by x
    let lo = 0, hi = geo.xs.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (geo.xs[mid] < px) lo = mid; else hi = mid; }
    const i = px - geo.xs[lo] < geo.xs[hi] - px ? lo : hi;
    if (i !== hover) { setHover(i); onHover?.(points[i]); }
  };
  const clear = () => { setHover(null); onHover?.(null); };

  if (!geo) {
    return (
      <div ref={wrapRef} className={`w-full ${className}`} style={{ height }}>
        {width > 0 && points.length < 2 && (
          <div className="h-full flex items-center justify-center text-xs text-gray-600">Not enough data for this range yet</div>
        )}
      </div>
    );
  }

  const h = hover;
  const hx = h != null ? geo.xs[h] : null, hy = h != null ? geo.ys[h] : null;
  const last = points.length - 1;
  const tipW = 150;
  const tipLeft = hx != null ? Math.max(0, Math.min(width - tipW, hx - tipW / 2)) : 0;

  return (
    <div ref={wrapRef} className={`relative w-full select-none ${className}`} style={{ height, touchAction: "pan-y" }}
      onPointerDown={e => { (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId); setFromClientX(e.clientX); }}
      onPointerMove={e => { if (e.pointerType === "mouse" || e.buttons > 0) setFromClientX(e.clientX); }}
      onPointerUp={e => { if (e.pointerType !== "mouse") clear(); }}
      onPointerCancel={clear}
      onPointerLeave={clear}>
      <svg width={width} height={height} className="block overflow-visible" style={{ cursor: "crosshair" }}>
        <defs>
          <linearGradient id={`g-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="55%" stopColor={color} stopOpacity="0.08" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id={`glow-${uid}`} x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <clipPath id={`clip-${uid}`}><rect x="0" y="0" width={width} height={height} /></clipPath>
        </defs>

        {/* grid */}
        {geo.ticks.map((v, i) => (
          <line key={i} x1={PAD.left} x2={width - PAD.right} y1={geo.y(v)} y2={geo.y(v)} stroke="rgba(255,255,255,0.055)" strokeWidth="1" />
        ))}
        {baseline != null && (
          <line x1={PAD.left} x2={width - PAD.right} y1={geo.baseY} y2={geo.baseY} stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 4" />
        )}

        <g clipPath={`url(#clip-${uid})`}>
          <path d={geo.area} fill={`url(#g-${uid})`} />
          <path d={geo.line} fill="none" stroke={color} strokeWidth="5" strokeOpacity="0.12" strokeLinejoin="round" strokeLinecap="round" filter={`url(#glow-${uid})`} />
          <path ref={pathRef} d={geo.line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </g>

        {/* dimmed future when scrubbing */}
        {hx != null && <rect x={hx} y={0} width={Math.max(0, width - hx)} height={height} fill="rgba(7,9,11,0.45)" />}

        {/* extremes */}
        {showExtremes && geo.maxI !== geo.minI && h == null && (
          <>
            <circle cx={geo.xs[geo.maxI]} cy={geo.ys[geo.maxI]} r="2.5" fill={color} opacity="0.9" />
            <circle cx={geo.xs[geo.minI]} cy={geo.ys[geo.minI]} r="2.5" fill={color} opacity="0.9" />
          </>
        )}

        {/* live dot */}
        {h == null && (
          <g>
            <circle cx={geo.xs[last]} cy={geo.ys[last]} r="9" fill={color} opacity="0.18">
              <animate attributeName="r" values="5;11;5" dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.3;0;0.3" dur="2.2s" repeatCount="indefinite" />
            </circle>
            <circle cx={geo.xs[last]} cy={geo.ys[last]} r="3.5" fill={color} stroke="#07090b" strokeWidth="1.5" />
          </g>
        )}

        {/* scrubber */}
        {hx != null && hy != null && (
          <g pointerEvents="none">
            <line x1={hx} x2={hx} y1={PAD.top - 6} y2={height - PAD.bottom} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
            <circle cx={hx} cy={hy} r="7" fill={color} opacity="0.25" />
            <circle cx={hx} cy={hy} r="4" fill={color} stroke="#07090b" strokeWidth="1.5" />
          </g>
        )}
      </svg>

      {/* y labels inside the plot, right edge; a 160px card has no room for them */}
      {width >= 260 && geo.ticks.map((v, i) => (
        <span key={i} className="absolute right-2 -translate-y-1/2 font-mono text-[10px] text-gray-600/90 tabular-nums pointer-events-none bg-[#0b0e10]/60 px-1 rounded"
          style={{ top: geo.y(v) }}>{formatValue(v)}</span>
      ))}

      {/* extreme labels */}
      {showExtremes && geo.maxI !== geo.minI && h == null && ([
        { i: geo.maxI, cls: "text-gray-300", above: true },
        { i: geo.minI, cls: "text-gray-500", above: geo.ys[geo.minI] + 6 > height - PAD.bottom - 12 },
      ].map(({ i, cls, above }) => {
        // Near the right edge the label would sit on the y-axis labels, so it
        // hangs to the left of its point instead of being centred on it.
        const px = geo.xs[i], nearRight = px > width - 72;
        return (
          <span key={i} className={`absolute font-mono text-[10px] pointer-events-none whitespace-nowrap ${cls} ${nearRight ? "-translate-x-full" : "-translate-x-1/2"}`}
            style={{ left: nearRight ? px - 8 : Math.max(28, px), top: above ? Math.max(0, geo.ys[i] - 18) : geo.ys[i] + 6 }}>
            {formatValue(points[i].v)}
          </span>
        );
      }))}

      {/* x labels */}
      {geo.xLabels.map((l, i) => (
        <span key={i} className={`absolute bottom-0.5 font-mono text-[10px] text-gray-600 pointer-events-none whitespace-nowrap ${l.align === "center" ? "-translate-x-1/2" : l.align === "right" ? "-translate-x-full" : ""}`}
          style={{ left: l.x, transform: l.align === "center" ? "translateX(-50%)" : l.align === "right" ? "translateX(-100%)" : undefined }}>
          {formatAxisTime(l.t)}
        </span>
      ))}

      {/* tooltip pill */}
      {h != null && (
        <div className="absolute top-0 pointer-events-none" style={{ left: tipLeft, width: tipW }}>
          <div className="mx-auto w-fit rounded-full border border-white/10 bg-[#0b0e10]/95 px-3 py-1 shadow-xl backdrop-blur text-center">
            <span className="font-mono text-xs font-semibold text-white tabular-nums">{formatValue(points[h].v)}</span>
            <span className="ml-2 font-mono text-[10px] text-gray-500">{formatTooltipTime(points[h].t)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
