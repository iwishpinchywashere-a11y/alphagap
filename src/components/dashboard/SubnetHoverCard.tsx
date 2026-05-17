"use client";

import { useEffect, useRef, useState } from "react";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import { scoreColor, formatNum } from "@/lib/formatters";
import type { SubnetScore } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PricePoint { timestamp: string; price: number }
interface EmissionRow { pct: number; timestamp: string }
interface ScoreRow {
  date: string;
  agap: number;
  flow: number;
  dev: number;
  eval: number;
  social: number;
  price: number;
  mcap: number;
  emission_pct: number;
}

interface DetailData {
  priceHistory: PricePoint[];
  emissionHistory: EmissionRow[];
  scoreHistory: ScoreRow[];
}

// ── Cache ─────────────────────────────────────────────────────────────────────
// Shared across all card instances so each subnet is only fetched once per session
const fetchCache = new Map<number, DetailData | "loading" | "error">();

// ── Sparkline helpers ─────────────────────────────────────────────────────────

function Sparkline({
  values,
  width = 180,
  height = 44,
  color = "#34d399",
  fill = true,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polyline = pts.join(" ");
  const lastPt = pts[pts.length - 1].split(",");

  // Fill polygon: line down right edge, across bottom, back to start
  const fillPoly = fill
    ? `${polyline} ${(pad + w).toFixed(1)},${(pad + h).toFixed(1)} ${pad},${(pad + h).toFixed(1)}`
    : null;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && fillPoly && (
        <polygon
          points={fillPoly}
          fill={`url(#sg-${color.replace("#", "")})`}
        />
      )}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Current value dot */}
      <circle cx={lastPt[0]} cy={lastPt[1]} r={2.5} fill={color} />
    </svg>
  );
}

// ── Mini bar (score) ──────────────────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number | null | undefined }) {
  const v = value ?? 0;
  const color =
    v >= 75 ? "#34d399" :
    v >= 55 ? "#a3e635" :
    v >= 35 ? "#facc15" :
    v >= 20 ? "#fb923c" :
              "#f87171";
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-gray-500 w-6 text-right tabular-nums leading-none">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, backgroundColor: color }} />
      </div>
      <span className="text-[9px] tabular-nums w-5 text-right" style={{ color }}>{v}</span>
    </div>
  );
}

// ── Change chip ───────────────────────────────────────────────────────────────

function ChangeChip({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return null;
  const pos = value > 0;
  const neg = value < 0;
  return (
    <div className={`flex flex-col items-center px-2 py-1 rounded-lg border ${
      pos ? "border-green-500/30 bg-green-500/10" :
      neg ? "border-red-500/30 bg-red-500/10" :
            "border-gray-700 bg-gray-800/40"
    }`}>
      <span className="text-[8px] text-gray-500 font-medium">{label}</span>
      <span className={`text-xs font-bold tabular-nums ${pos ? "text-green-400" : neg ? "text-red-400" : "text-gray-400"}`}>
        {pos ? "+" : ""}{value.toFixed(1)}%
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  sub: SubnetScore;
  anchorRect: DOMRect;
  taoPrice: number | null;
  onClose: () => void;
}

export default function SubnetHoverCard({ sub, anchorRect, taoPrice, onClose }: Props) {
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  // Position the card: right of row if space, otherwise left
  const CARD_W = 300;
  const CARD_H = 380;
  const viewport = typeof window !== "undefined" ? { w: window.innerWidth, h: window.innerHeight } : { w: 1200, h: 800 };

  // Prefer right of table row; if not enough space, go left
  let left = anchorRect.right + 8;
  if (left + CARD_W > viewport.w - 8) {
    left = anchorRect.left - CARD_W - 8;
  }
  // Vertical: align to row top, clamp to viewport
  let top = anchorRect.top;
  if (top + CARD_H > viewport.h - 8) {
    top = viewport.h - CARD_H - 8;
  }
  if (top < 8) top = 8;

  useEffect(() => {
    const cached = fetchCache.get(sub.netuid);
    if (cached === "loading") {
      // Poll until resolved
      const id = setInterval(() => {
        const c = fetchCache.get(sub.netuid);
        if (c && c !== "loading") {
          clearInterval(id);
          if (c !== "error") { setDetail(c); }
          setLoading(false);
        }
      }, 200);
      return () => clearInterval(id);
    }
    if (cached && cached !== "error") {
      setDetail(cached);
      setLoading(false);
      return;
    }
    if (cached === "error") { setLoading(false); return; }

    // Not yet fetched — kick off request
    fetchCache.set(sub.netuid, "loading");
    fetch(`/api/subnets/${sub.netuid}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { priceHistory?: PricePoint[]; emissionHistory?: EmissionRow[]; scoreHistory?: ScoreRow[] }) => {
        const data: DetailData = {
          priceHistory: d.priceHistory ?? [],
          emissionHistory: d.emissionHistory ?? [],
          scoreHistory: d.scoreHistory ?? [],
        };
        fetchCache.set(sub.netuid, data);
        setDetail(data);
        setLoading(false);
      })
      .catch(() => {
        fetchCache.set(sub.netuid, "error");
        setLoading(false);
      });
  }, [sub.netuid]);

  // Last 30 days of prices
  const prices30 = detail?.priceHistory.slice(-30).map(p => p.price) ?? [];
  // Last 30 days emission %
  const emission30 = detail?.emissionHistory.slice(-30).map(e => e.pct) ?? [];
  // Last 30 aGap scores
  const agapHistory = detail?.scoreHistory.slice(-30).map(r => r.agap) ?? [];

  const agapColor =
    sub.composite_score >= 80 ? "#34d399" :
    sub.composite_score >= 60 ? "#a3e635" :
    sub.composite_score >= 40 ? "#facc15" :
    sub.composite_score >= 20 ? "#fb923c" :
                                 "#f87171";

  return (
    <>
      {/* Invisible overlay to capture outside clicks/hover-leave */}
      <div className="fixed inset-0 z-[299]" onMouseMove={onClose} />

      <div
        ref={cardRef}
        className="fixed z-[300] pointer-events-none"
        style={{ left, top, width: CARD_W }}
        onMouseEnter={(e) => e.stopPropagation()}
      >
        <div
          className="rounded-2xl border border-gray-700/60 bg-[#0c0c14]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          style={{
            boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${agapColor}18`,
          }}
        >
          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-800/60">
            <div className="flex items-center gap-2.5">
              <SubnetLogo netuid={sub.netuid} name={sub.name} size={28} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-600 font-mono">SN{sub.netuid}</span>
                  <span className="font-bold text-white text-sm truncate">{sub.name}</span>
                  {sub.has_campaign && <span className="text-xs">🔥</span>}
                </div>
                {sub.category && (
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider">{sub.category}</span>
                )}
              </div>
              {/* aGap badge */}
              <div
                className="flex-shrink-0 w-11 h-11 rounded-xl flex flex-col items-center justify-center border"
                style={{
                  backgroundColor: `${agapColor}18`,
                  borderColor: `${agapColor}40`,
                }}
              >
                <span className="text-[8px] text-gray-500 leading-none mb-0.5">aGap</span>
                <span className="text-xl font-black leading-none tabular-nums" style={{ color: agapColor }}>
                  {sub.composite_score}
                </span>
              </div>
            </div>
          </div>

          {/* ── Price chart ──────────────────────────────────────────── */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-gray-500 uppercase tracking-wider">Price · 30d</span>
              <div className="flex items-center gap-1">
                {sub.alpha_price != null && (
                  <span className="text-xs font-semibold text-gray-200 tabular-nums">
                    ${formatNum(sub.alpha_price, 3)}
                  </span>
                )}
                {sub.price_change_24h != null && (
                  <span className={`text-[10px] font-medium tabular-nums ${sub.price_change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {sub.price_change_24h >= 0 ? "+" : ""}{sub.price_change_24h.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            {loading ? (
              <div className="h-11 flex items-center justify-center">
                <div className="w-3.5 h-3.5 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
              </div>
            ) : prices30.length >= 2 ? (
              <div className="w-full">
                <Sparkline
                  values={prices30}
                  width={CARD_W - 32}
                  height={48}
                  color={prices30[prices30.length - 1] >= prices30[0] ? "#34d399" : "#f87171"}
                />
              </div>
            ) : (
              <div className="h-11 flex items-center text-[10px] text-gray-600">No price history</div>
            )}
          </div>

          {/* ── Price change chips ───────────────────────────────────── */}
          <div className="px-4 pb-3 flex gap-1.5">
            <ChangeChip label="1h" value={sub.price_change_1h} />
            <ChangeChip label="24h" value={sub.price_change_24h} />
            <ChangeChip label="7d" value={sub.price_change_7d} />
            <ChangeChip label="30d" value={sub.price_change_30d} />
          </div>

          {/* ── aGap score history + emission ───────────────────────── */}
          <div className="px-4 pb-3 flex gap-3">
            <div className="flex-1">
              <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">aGap · 30d</div>
              {agapHistory.length >= 2 ? (
                <Sparkline values={agapHistory} width={118} height={28} color={agapColor} fill={false} />
              ) : (
                <div className="h-7 flex items-center text-[10px] text-gray-700">—</div>
              )}
            </div>
            <div className="flex-1">
              <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Emission % · 30d</div>
              {emission30.length >= 2 ? (
                <Sparkline values={emission30} width={118} height={28} color="#818cf8" fill={false} />
              ) : (
                <div className="h-7 flex items-center text-[10px] text-gray-700">—</div>
              )}
            </div>
          </div>

          {/* ── Score bars ───────────────────────────────────────────── */}
          <div className="px-4 pb-3 space-y-1.5 border-t border-gray-800/60 pt-3">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Score Breakdown</div>
            <ScoreBar label="Flow" value={sub.flow_score} />
            <ScoreBar label="Dev" value={sub.dev_score} />
            <ScoreBar label="eVal" value={sub.eval_score} />
            <ScoreBar label="Prod" value={sub.product_score} />
            <ScoreBar label="Soc" value={sub.social_score} />
          </div>

          {/* ── Market stats ─────────────────────────────────────────── */}
          <div className="px-4 pb-4 pt-3 border-t border-gray-800/60 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[8px] text-gray-600 uppercase tracking-wider mb-0.5">MCap</div>
              <div className="text-[11px] font-semibold text-gray-300 tabular-nums">
                {sub.market_cap != null ? `$${formatNum(sub.market_cap)}` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[8px] text-gray-600 uppercase tracking-wider mb-0.5">Emission</div>
              <div className={`text-[11px] font-semibold tabular-nums ${
                sub.emission_change_pct != null && sub.emission_change_pct > 0 ? "text-green-400" :
                sub.emission_change_pct != null && sub.emission_change_pct < 0 ? "text-red-400" :
                "text-gray-300"
              }`}>
                {sub.emission_pct != null ? `${(sub.emission_pct * 100).toFixed(2)}%` : "—"}
                {sub.emission_change_pct != null && sub.emission_change_pct !== 0 && (
                  <span className="text-[8px] ml-0.5">
                    {sub.emission_change_pct > 0 ? "↑" : "↓"}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[8px] text-gray-600 uppercase tracking-wider mb-0.5">APY</div>
              <div className={`text-[11px] font-semibold tabular-nums ${
                sub.apy_7d != null && sub.apy_7d >= 0.5 ? "text-green-400" :
                sub.apy_7d != null && sub.apy_7d >= 0.2 ? "text-yellow-400" :
                "text-gray-300"
              }`}>
                {sub.apy_7d != null ? `${(sub.apy_7d * 100).toFixed(0)}%` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[8px] text-gray-600 uppercase tracking-wider mb-0.5">24h Flow</div>
              <div className={`text-[11px] font-semibold tabular-nums ${
                sub.net_flow_24h != null && sub.net_flow_24h > 0 ? "text-green-400" :
                sub.net_flow_24h != null && sub.net_flow_24h < 0 ? "text-red-400" :
                "text-gray-300"
              }`}>
                {sub.net_flow_24h != null && taoPrice != null
                  ? `${sub.net_flow_24h > 0 ? "+" : ""}$${formatNum(Math.round(Math.abs(sub.net_flow_24h) * taoPrice))}`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-[8px] text-gray-600 uppercase tracking-wider mb-0.5">Audit</div>
              <div className={`text-[11px] font-semibold tabular-nums ${
                sub.audit_score == null ? "text-gray-600" :
                sub.audit_score >= 70 ? "text-green-400" :
                sub.audit_score >= 50 ? "text-yellow-400" :
                "text-orange-400"
              }`}>
                {sub.audit_score ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[8px] text-gray-600 uppercase tracking-wider mb-0.5">Velo</div>
              <div className={`text-[11px] font-semibold tabular-nums ${
                sub.agap_velo != null && sub.agap_velo >= 70 ? "text-green-400" :
                sub.agap_velo != null && sub.agap_velo >= 40 ? "text-yellow-400" :
                "text-gray-300"
              }`}>
                {sub.agap_velo ?? "—"}
              </div>
            </div>
          </div>

          {/* ── Footer hint ──────────────────────────────────────────── */}
          <div className="px-4 py-2 border-t border-gray-800/40 flex items-center justify-between">
            <span className="text-[9px] text-gray-700">Click row to open full analysis</span>
            {sub.whale_signal === "accumulating" && (
              <span className="text-[9px] text-green-400 font-medium">🐋 Whale accumulating</span>
            )}
            {sub.whale_signal === "distributing" && (
              <span className="text-[9px] text-red-400 font-medium">🔻 Whale distributing</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
