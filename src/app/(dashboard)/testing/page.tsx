"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SubnetScore } from "@/lib/types";
import type { TrackedPumper } from "@/app/api/testing/route";

// ── Types ─────────────────────────────────────────────────────────────────

interface PricePoint { timestamp: string; price: number }
interface ScoreRow { date: string; agap: number; flow: number; dev: number; eval: number; social: number; price: number; mcap: number; emission_pct: number }
interface SignalRow { id: number; netuid: number; signal_type: string; strength: number; title: string; description: string; source: string; source_url?: string; created_at: string; signal_date?: string }
interface SubnetDetail {
  netuid: number; name: string;
  identity: { description?: string; summary?: string; github_repo?: string; twitter?: string; website?: string } | null;
  scoreHistory: ScoreRow[];
  priceHistory: PricePoint[];
  signals: SignalRow[];
  marketStats: { priceUsd: number; marketCapUsd: number; priceChangePct7d: number; priceChangePct30d: number; volume24hUsd: number } | null;
}

interface PumpEvent {
  gain: number;          // % gain
  startDate: string;
  endDate: string;
  startIdx: number;
  endIdx: number;
  startPrice: number;
  peakPrice: number;
  daysAgo: number;       // days since pump started
}

interface SignalFinding {
  icon: string;
  label: string;
  detail: string;
  strength: "strong" | "moderate" | "weak";
  daysBeforePump: number;  // positive = before pump
  fired: boolean;
}

interface Autopsy {
  pumper: TrackedPumper;
  current: SubnetScore | null;
  detail: SubnetDetail | null;
  pumpEvent: PumpEvent | null;
  findings: SignalFinding[];
  narrative: string;
  loading: boolean;
  error?: string;
}

// ── Analysis helpers ───────────────────────────────────────────────────────

function findBestPump(prices: PricePoint[]): PumpEvent | null {
  if (prices.length < 8) return null;
  let bestGain = -Infinity;
  let bestStart = 0;
  let bestEnd = 7;
  const WINDOW = 7;

  for (let i = 0; i <= prices.length - WINDOW - 1; i++) {
    const sp = prices[i].price;
    const ep = prices[i + WINDOW].price;
    if (sp <= 0) continue;
    const g = ((ep - sp) / sp) * 100;
    if (g > bestGain) { bestGain = g; bestStart = i; bestEnd = i + WINDOW; }
  }
  if (bestGain <= 10) return null; // not a meaningful pump

  const startDate = prices[bestStart].timestamp;
  const endDate = prices[bestEnd].timestamp;
  const daysAgo = Math.round((Date.now() - new Date(startDate).getTime()) / 86400000);

  return {
    gain: bestGain,
    startDate,
    endDate,
    startIdx: bestStart,
    endIdx: bestEnd,
    startPrice: prices[bestStart].price,
    peakPrice: prices[bestEnd].price,
    daysAgo,
  };
}

function getWindow(scores: ScoreRow[], anchorDate: string, daysBack: number): ScoreRow[] {
  const anchorMs = new Date(anchorDate).getTime();
  const cutoff = anchorMs - daysBack * 86400000;
  return scores
    .filter((s) => { const t = new Date(s.date).getTime(); return t >= cutoff && t <= anchorMs; })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function trend(vals: number[]): number {
  if (vals.length < 2) return 0;
  return vals[vals.length - 1] - vals[0];
}

function buildFindings(
  pumpEvent: PumpEvent | null,
  scores: ScoreRow[],
  signals: SignalRow[],
  current: SubnetScore | null
): SignalFinding[] {
  const findings: SignalFinding[] = [];
  if (!pumpEvent) return findings;

  const pumpMs = new Date(pumpEvent.startDate).getTime();
  const pre14 = getWindow(scores, pumpEvent.startDate, 14);
  const pre7  = getWindow(scores, pumpEvent.startDate, 7);

  // ── Dev spike ──────────────────────────────────────────────────────
  const devTrend14 = trend(pre14.map((s) => s.dev));
  const devTrend7  = trend(pre7.map((s) => s.dev));
  const devFired = devTrend7 > 15 || devTrend14 > 20;
  const devSignals = signals.filter((s) => s.signal_type === "dev_spike");
  const devPrePump = devSignals.filter((s) => {
    const t = new Date(s.signal_date || s.created_at).getTime();
    return t < pumpMs && t > pumpMs - 14 * 86400000;
  });
  findings.push({
    icon: "⚡",
    label: "Dev Spike",
    detail: devPrePump.length > 0
      ? `${devPrePump.length} dev-spike signal${devPrePump.length > 1 ? "s" : ""} fired in pre-pump window`
      : devTrend14 > 10
      ? `Dev score rose ${devTrend14 > 0 ? "+" : ""}${devTrend14.toFixed(0)} pts in 14d before pump`
      : "No significant dev activity detected before pump",
    strength: devPrePump.length > 0 ? "strong" : devTrend14 > 10 ? "moderate" : "weak",
    daysBeforePump: devPrePump.length > 0
      ? Math.round((pumpMs - new Date(devPrePump[0].signal_date || devPrePump[0].created_at).getTime()) / 86400000)
      : 7,
    fired: devFired || devPrePump.length > 0,
  });

  // ── Social spike ───────────────────────────────────────────────────
  const socialTrend14 = trend(pre14.map((s) => s.social));
  const socialSignals = signals.filter((s) => ["social_spike", "kol_mention", "twitter_spike"].includes(s.signal_type));
  const socialPrePump = socialSignals.filter((s) => {
    const t = new Date(s.signal_date || s.created_at).getTime();
    return t < pumpMs + 86400000 && t > pumpMs - 10 * 86400000; // allow pump day +1
  });
  findings.push({
    icon: "📢",
    label: "Social / KOL Activity",
    detail: socialPrePump.length > 0
      ? `${socialPrePump.length} social signal${socialPrePump.length > 1 ? "s" : ""} — KOLs active pre-pump`
      : socialTrend14 > 10
      ? `Social score climbed ${socialTrend14.toFixed(0)} pts in pre-pump window`
      : "No notable social signals detected before pump",
    strength: socialPrePump.length >= 2 ? "strong" : socialPrePump.length === 1 || socialTrend14 > 10 ? "moderate" : "weak",
    daysBeforePump: socialPrePump.length > 0
      ? Math.round((pumpMs - new Date(socialPrePump[0].signal_date || socialPrePump[0].created_at).getTime()) / 86400000)
      : 3,
    fired: socialPrePump.length > 0 || socialTrend14 > 10,
  });

  // ── Volume surge ───────────────────────────────────────────────────
  const volSignals = signals.filter((s) => s.signal_type === "volume_surge");
  const volPrePump = volSignals.filter((s) => {
    const t = new Date(s.signal_date || s.created_at).getTime();
    return t < pumpMs + 2 * 86400000 && t > pumpMs - 7 * 86400000;
  });
  const volFired = volPrePump.length > 0 || (current?.volume_surge && current.volume_surge_ratio && current.volume_surge_ratio > 2);
  findings.push({
    icon: "📊",
    label: "Volume Surge",
    detail: volPrePump.length > 0
      ? `Volume spike detected ${volPrePump.length > 1 ? `${volPrePump.length}×` : ""} around pump start`
      : current?.volume_surge
      ? `Current vol surge ${current.volume_surge_ratio?.toFixed(1) ?? ""}× normal — possibly still active`
      : "No clear volume surge detected in data window",
    strength: volPrePump.length > 0 ? "strong" : current?.volume_surge ? "moderate" : "weak",
    daysBeforePump: volPrePump.length > 0
      ? Math.round((pumpMs - new Date(volPrePump[0].signal_date || volPrePump[0].created_at).getTime()) / 86400000)
      : 1,
    fired: !!volFired,
  });

  // ── Whale accumulation ─────────────────────────────────────────────
  const whaleSignals = signals.filter((s) => s.signal_type === "whale_accumulation" || (s.title || "").toLowerCase().includes("whale"));
  const whalePrePump = whaleSignals.filter((s) => {
    const t = new Date(s.signal_date || s.created_at).getTime();
    return t < pumpMs + 86400000 && t > pumpMs - 14 * 86400000;
  });
  const whaleFired = whalePrePump.length > 0 || current?.whale_signal === "accumulating";
  findings.push({
    icon: "🐋",
    label: "Whale Accumulation",
    detail: whalePrePump.length > 0
      ? `Whale accumulation signal detected ~${whalePrePump[0] ? Math.round((pumpMs - new Date(whalePrePump[0].signal_date || whalePrePump[0].created_at).getTime() / 86400000)) : "?"} days before pump`
      : current?.whale_signal === "accumulating"
      ? `Currently accumulating (ratio ${current.whale_ratio?.toFixed(1) ?? "?"}×) — may precede next move`
      : current?.whale_signal === "distributing"
      ? "Whales distributing — pump may be ending"
      : "No whale accumulation signal detected",
    strength: whalePrePump.length > 0 ? "strong" : current?.whale_signal === "accumulating" ? "moderate" : "weak",
    daysBeforePump: whalePrePump.length > 0
      ? Math.round((pumpMs - new Date(whalePrePump[0].signal_date || whalePrePump[0].created_at).getTime()) / 86400000)
      : 5,
    fired: whaleFired,
  });

  // ── Emission momentum ──────────────────────────────────────────────
  const emTrend14 = trend(pre14.map((s) => s.emission_pct));
  const emSignals = signals.filter((s) => ["emission_spike", "emission_rising"].includes(s.signal_type));
  const emPrePump = emSignals.filter((s) => {
    const t = new Date(s.signal_date || s.created_at).getTime();
    return t < pumpMs && t > pumpMs - 14 * 86400000;
  });
  findings.push({
    icon: "⚛️",
    label: "Emission Momentum",
    detail: emPrePump.length > 0
      ? `Emission rising signal fired ${emPrePump.length}× before pump`
      : emTrend14 > 0.3
      ? `Emission share rose +${emTrend14.toFixed(2)}% in pre-pump window`
      : "Emission trend flat/declining before pump",
    strength: emPrePump.length > 0 ? "moderate" : emTrend14 > 0.3 ? "moderate" : "weak",
    daysBeforePump: emPrePump.length > 0
      ? Math.round((pumpMs - new Date(emPrePump[0].signal_date || emPrePump[0].created_at).getTime()) / 86400000)
      : 10,
    fired: emPrePump.length > 0 || emTrend14 > 0.3,
  });

  // ── HuggingFace / product update ──────────────────────────────────
  const hfSignals = signals.filter((s) => s.signal_type === "hf_update" || s.signal_type === "product_update");
  const hfPrePump = hfSignals.filter((s) => {
    const t = new Date(s.signal_date || s.created_at).getTime();
    return t < pumpMs + 86400000 && t > pumpMs - 21 * 86400000;
  });
  findings.push({
    icon: "🤗",
    label: "HuggingFace / Product Update",
    detail: hfPrePump.length > 0
      ? `${hfPrePump.length} product/HF update${hfPrePump.length > 1 ? "s" : ""} published before pump`
      : "No product or HF updates detected in pre-pump window",
    strength: hfPrePump.length >= 2 ? "strong" : hfPrePump.length === 1 ? "moderate" : "weak",
    daysBeforePump: hfPrePump.length > 0
      ? Math.round((pumpMs - new Date(hfPrePump[0].signal_date || hfPrePump[0].created_at).getTime()) / 86400000)
      : 14,
    fired: hfPrePump.length > 0,
  });

  return findings;
}

function buildNarrative(
  name: string,
  pumpEvent: PumpEvent | null,
  findings: SignalFinding[],
  scores: ScoreRow[],
  current: SubnetScore | null,
): string {
  if (!pumpEvent) {
    return `${name} hasn't shown a clear pump event in available price history. Monitoring for future moves — current aGap score is ${current?.composite_score ?? "?"}/100.`;
  }

  const firedSignals = findings.filter((f) => f.fired).map((f) => f.label);
  const strongSignals = findings.filter((f) => f.fired && f.strength === "strong").map((f) => f.label);
  const pre14 = getWindow(scores, pumpEvent.startDate, 14);

  const gainStr = `+${pumpEvent.gain.toFixed(0)}%`;
  const daysAgoStr = pumpEvent.daysAgo <= 3 ? "recently" : pumpEvent.daysAgo <= 10 ? `~${pumpEvent.daysAgo} days ago` : `~${Math.round(pumpEvent.daysAgo / 7)} weeks ago`;

  let narrative = `${name} pumped ${gainStr} over 7 days, starting ${daysAgoStr}. `;

  if (strongSignals.length > 0) {
    narrative += `The strongest pre-pump indicators were ${strongSignals.join(" and ")}. `;
  } else if (firedSignals.length > 0) {
    narrative += `Pre-pump signals included ${firedSignals.slice(0, 3).join(", ")}. `;
  } else {
    narrative += `Historical signal data is limited — the move may have been driven by market-wide rotation or external catalysts not yet captured. `;
  }

  if (pre14.length >= 3) {
    const devStart = pre14[0].dev;
    const devEnd = pre14[pre14.length - 1].dev;
    const socialEnd = pre14[pre14.length - 1].social;
    if (devEnd - devStart > 15) {
      narrative += `Dev score rose ${devStart}→${devEnd} in the two weeks before the pump — a classic leading indicator. `;
    }
    if (socialEnd > 60) {
      narrative += `Social momentum was elevated (score ${socialEnd}) going into the move. `;
    }
  }

  if (current?.whale_signal === "accumulating") {
    narrative += `Whale wallets are currently still accumulating, suggesting the move may have more room. `;
  } else if (current?.whale_signal === "distributing") {
    narrative += `Whale wallets are now distributing — the smart money may be taking profit. `;
  }

  narrative += `Current aGap score: ${current?.composite_score ?? "?"}/100.`;
  return narrative;
}

// ── Mini SVG price chart ───────────────────────────────────────────────────

function MiniPriceChart({
  prices,
  pump,
}: {
  prices: PricePoint[];
  pump: PumpEvent | null;
}) {
  const W = 480; const H = 120;
  const PAD = { top: 8, right: 8, bottom: 20, left: 8 };

  if (prices.length < 2) {
    return (
      <div className="flex items-center justify-center h-[120px] text-gray-600 text-xs">
        Loading price data…
      </div>
    );
  }

  const vals = prices.map((p) => p.price);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (i / (prices.length - 1)) * cW;
  const y = (v: number) => PAD.top + cH - ((v - minV) / range) * cH;

  // Path
  const path = prices.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.price).toFixed(1)}`).join(" ");

  // Fill path (close to bottom)
  const fill = path + ` L ${x(prices.length - 1).toFixed(1)} ${(H - PAD.bottom).toFixed(1)} L ${PAD.left} ${(H - PAD.bottom).toFixed(1)} Z`;

  // Pump region highlight
  const pumpRect =
    pump && pump.startIdx < prices.length && pump.endIdx < prices.length
      ? {
          x1: x(pump.startIdx),
          x2: x(Math.min(pump.endIdx, prices.length - 1)),
        }
      : null;

  const isUp = prices[prices.length - 1].price >= prices[0].price;
  const lineColor = pump && pump.gain > 0 ? "#4ade80" : isUp ? "#4ade80" : "#f87171";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "120px" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Pump region */}
      {pumpRect && (
        <rect
          x={pumpRect.x1} y={PAD.top}
          width={pumpRect.x2 - pumpRect.x1}
          height={cH}
          fill="rgba(250,204,21,0.08)"
          stroke="rgba(250,204,21,0.3)"
          strokeWidth="1"
          rx="2"
        />
      )}
      {/* Fill */}
      <path d={fill} fill="url(#chartFill)" />
      {/* Line */}
      <path d={path} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" />
      {/* Pump start dot */}
      {pump && pump.startIdx < prices.length && (
        <circle cx={x(pump.startIdx)} cy={y(prices[pump.startIdx].price)} r="3" fill="#facc15" />
      )}
      {/* Pump peak dot */}
      {pump && pump.endIdx < prices.length && (
        <circle cx={x(pump.endIdx)} cy={y(prices[pump.endIdx].price)} r="3" fill="#4ade80" />
      )}
      {/* Baseline label */}
      <text x={PAD.left + 2} y={H - 4} fill="#4b5563" fontSize="9">
        {prices[0] ? new Date(prices[0].timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
      </text>
      <text x={W - PAD.right - 2} y={H - 4} fill="#4b5563" fontSize="9" textAnchor="end">
        {prices[prices.length - 1] ? new Date(prices[prices.length - 1].timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
      </text>
    </svg>
  );
}

// ── Score history mini table ───────────────────────────────────────────────

function ScoreTable({ scores, pump }: { scores: ScoreRow[]; pump: PumpEvent | null }) {
  if (scores.length === 0) {
    return (
      <div className="text-xs text-gray-600 italic py-2">
        Score history not yet available — builds over time with each scan.
      </div>
    );
  }

  // Pick 4 snapshots: -30d, -14d, -7d, closest to pump start
  const pumpMs = pump ? new Date(pump.startDate).getTime() : Date.now();
  const snap = (daysBack: number) => {
    const target = pumpMs - daysBack * 86400000;
    return scores.reduce(
      (best, s) => {
        const diff = Math.abs(new Date(s.date).getTime() - target);
        return diff < Math.abs(new Date(best.date).getTime() - target) ? s : best;
      },
      scores[0]
    );
  };
  const cols = pump
    ? [
        { label: "−30d", row: snap(30) },
        { label: "−14d", row: snap(14) },
        { label: "−7d",  row: snap(7) },
        { label: "Pump", row: snap(0) },
      ]
    : [
        { label: scores[0] ? new Date(scores[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "oldest", row: scores[0] },
        { label: "mid",  row: scores[Math.floor(scores.length / 2)] },
        { label: "recent", row: scores[scores.length - 1] },
      ];

  const scoreColor = (v: number) =>
    v >= 70 ? "text-green-400" : v >= 45 ? "text-yellow-400" : "text-red-400";

  const rows: { key: string; label: string; fn: (r: ScoreRow) => number }[] = [
    { key: "agap",    label: "aGap",    fn: (r) => r.agap },
    { key: "dev",     label: "Dev",     fn: (r) => r.dev },
    { key: "social",  label: "Social",  fn: (r) => r.social },
    { key: "flow",    label: "Flow",    fn: (r) => r.flow },
    { key: "eval",    label: "Eval",    fn: (r) => r.eval },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full">
        <thead>
          <tr>
            <th className="text-left text-gray-600 font-normal pb-1 pr-4">Metric</th>
            {cols.map((c) => (
              <th key={c.label} className="text-right text-gray-500 font-mono pb-1 px-2">{c.label}</th>
            ))}
            <th className="text-right text-gray-500 font-normal pb-1 pl-2">Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, fn }) => {
            const vals = cols.map((c) => c.row ? fn(c.row) : null);
            const first = vals[0] ?? 0;
            const last = vals[vals.length - 1] ?? 0;
            const delta = last - first;
            return (
              <tr key={key} className="border-t border-gray-800/40">
                <td className="text-gray-500 py-1 pr-4">{label}</td>
                {vals.map((v, i) => (
                  <td key={i} className={`text-right font-mono py-1 px-2 ${v != null ? scoreColor(v) : "text-gray-700"}`}>
                    {v != null ? v.toFixed(0) : "—"}
                  </td>
                ))}
                <td className={`text-right font-mono py-1 pl-2 text-xs ${delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-gray-600"}`}>
                  {delta !== 0 ? `${delta > 0 ? "+" : ""}${delta.toFixed(0)}` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Autopsy Card ──────────────────────────────────────────────────────────

function AutopsyCard({ autopsy, onRemove }: { autopsy: Autopsy; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(true);

  const { pumper, current, detail, pumpEvent, findings, narrative, loading, error } = autopsy;
  const fmtUsd = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
    return `$${v.toFixed(4)}`;
  };
  const fmtPrice = (v: number) => {
    if (v < 0.0001) return `$${v.toFixed(8)}`;
    if (v < 0.01)   return `$${v.toFixed(5)}`;
    if (v < 1)      return `$${v.toFixed(4)}`;
    return `$${v.toFixed(2)}`;
  };
  const pctColor = (v: number) => v >= 0 ? "text-green-400" : "text-red-400";

  const ms = detail?.marketStats ?? null;
  const price7d = current?.price_change_7d ?? ms?.priceChangePct7d ?? null;
  const price30d = current?.price_change_30d ?? ms?.priceChangePct30d ?? null;
  const priceUsd = current?.alpha_price ?? ms?.priceUsd ?? null;
  const mcap = current?.market_cap ?? ms?.marketCapUsd ?? null;

  const firedCount = findings.filter((f) => f.fired).length;
  const strongCount = findings.filter((f) => f.fired && f.strength === "strong").length;

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
      {/* Card header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-800/30 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-lg">{pumper.name}</span>
              {pumper.netuid != null && (
                <Link
                  href={`/subnets/${pumper.netuid}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-gray-500 bg-gray-800 rounded px-1.5 py-0.5 hover:text-gray-300"
                >
                  SN{pumper.netuid}
                </Link>
              )}
              {loading && <span className="text-xs text-gray-600 animate-pulse">Loading…</span>}
              {error && <span className="text-xs text-red-500">{error}</span>}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
              {priceUsd != null && <span>{fmtPrice(priceUsd)}</span>}
              {mcap != null && <span>MCap {fmtUsd(mcap)}</span>}
              {price7d != null && (
                <span className={pctColor(price7d)}>7D {price7d >= 0 ? "+" : ""}{price7d.toFixed(1)}%</span>
              )}
              {price30d != null && (
                <span className={pctColor(price30d)}>30D {price30d >= 0 ? "+" : ""}{price30d.toFixed(1)}%</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Pump badge */}
          {pumpEvent && (
            <div className="text-center">
              <div className="text-green-400 font-bold text-xl leading-none">
                +{pumpEvent.gain.toFixed(0)}%
              </div>
              <div className="text-gray-600 text-xs mt-0.5">7D peak pump</div>
            </div>
          )}

          {/* Signal summary */}
          <div className="text-center hidden sm:block">
            <div className="text-yellow-400 font-bold text-xl leading-none">{firedCount}/{findings.length}</div>
            <div className="text-gray-600 text-xs mt-0.5">signals fired</div>
          </div>

          {/* aGap */}
          {current?.composite_score != null && (
            <div className="text-center hidden md:block">
              <div className={`font-bold text-xl leading-none ${current.composite_score >= 70 ? "text-green-400" : current.composite_score >= 45 ? "text-yellow-400" : "text-red-400"}`}>
                {current.composite_score}
              </div>
              <div className="text-gray-600 text-xs mt-0.5">aGap now</div>
            </div>
          )}

          {/* Remove + expand toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="text-gray-700 hover:text-red-500 transition-colors text-xs px-2 py-1 rounded hover:bg-gray-800"
              title="Remove from tracker"
            >
              ✕
            </button>
            <span className="text-gray-600 text-lg">{expanded ? "▲" : "▼"}</span>
          </div>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-800/50 pt-4 space-y-5">

          {/* Price chart */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">90-Day Price</h3>
              {pumpEvent && (
                <span className="text-xs text-yellow-400/80">
                  🟡 pump start &nbsp; 🟢 pump peak
                </span>
              )}
            </div>
            <div className="bg-gray-950/50 rounded-lg p-2">
              <MiniPriceChart prices={detail?.priceHistory ?? []} pump={pumpEvent} />
            </div>
            {pumpEvent && (
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <span>Pump: {new Date(pumpEvent.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} → {new Date(pumpEvent.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                <span className="text-green-400">+{pumpEvent.gain.toFixed(1)}% ({fmtPrice(pumpEvent.startPrice)} → {fmtPrice(pumpEvent.peakPrice)})</span>
                <span className={pumpEvent.daysAgo <= 7 ? "text-yellow-400" : ""}>{pumpEvent.daysAgo <= 3 ? "🔥 Recent!" : pumpEvent.daysAgo <= 7 ? "Recent" : `~${pumpEvent.daysAgo}d ago`}</span>
              </div>
            )}
          </div>

          {/* Two-col: signals + scores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Signal findings */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Pre-Pump Signal Audit
                {strongCount > 0 && <span className="ml-2 text-green-400 normal-case font-normal">{strongCount} strong</span>}
              </h3>
              <div className="space-y-2">
                {findings.map((f) => (
                  <div key={f.label} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border ${
                    f.fired && f.strength === "strong"
                      ? "bg-green-950/30 border-green-800/30"
                      : f.fired && f.strength === "moderate"
                      ? "bg-yellow-950/20 border-yellow-800/20"
                      : "bg-gray-900/30 border-gray-800/20"
                  }`}>
                    <span className="text-base leading-none mt-0.5">{f.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-300">{f.label}</span>
                        {f.fired ? (
                          <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium ${
                            f.strength === "strong" ? "bg-green-900/60 text-green-400" :
                            f.strength === "moderate" ? "bg-yellow-900/60 text-yellow-400" :
                            "bg-gray-800 text-gray-400"
                          }`}>
                            {f.strength === "strong" ? "✓ STRONG" : f.strength === "moderate" ? "~ MODERATE" : "~ WEAK"}
                          </span>
                        ) : (
                          <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-gray-800/60 text-gray-600">✗ NOT DETECTED</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{f.detail}</p>
                    </div>
                    {f.fired && f.daysBeforePump > 0 && (
                      <div className="text-right flex-shrink-0">
                        <div className="text-[10px] text-gray-600">−{f.daysBeforePump}d</div>
                        <div className="text-[9px] text-gray-700">before</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Score history */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Score History (Pre-Pump)</h3>
              <div className="bg-gray-950/40 rounded-lg p-3">
                <ScoreTable scores={detail?.scoreHistory ?? []} pump={pumpEvent} />
              </div>

              {/* Current stats grid */}
              {current && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { label: "Dev", val: current.dev_score },
                    { label: "Flow", val: current.flow_score },
                    { label: "Social", val: current.social_score },
                    { label: "Eval", val: current.eval_score },
                    { label: "Product", val: current.product_score },
                    { label: "Em%", val: current.emission_pct != null ? parseFloat(current.emission_pct.toFixed(2)) : null, isRaw: true },
                  ].map(({ label, val, isRaw }) => (
                    val != null && (
                      <div key={label} className="bg-gray-900/60 rounded-lg px-2 py-1.5 text-center">
                        <div className={`text-sm font-bold font-mono ${!isRaw ? (val >= 70 ? "text-green-400" : val >= 45 ? "text-yellow-400" : "text-red-400") : "text-gray-300"}`}>
                          {isRaw ? `${val}%` : val.toFixed(0)}
                        </div>
                        <div className="text-[10px] text-gray-600">{label} now</div>
                      </div>
                    )
                  ))}
                </div>
              )}

              {/* Whale / volume indicators */}
              {current && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {current.whale_signal === "accumulating" && (
                    <span className="text-xs bg-blue-900/30 text-blue-400 border border-blue-800/30 rounded-full px-2 py-0.5">🐋 Whales accumulating</span>
                  )}
                  {current.whale_signal === "distributing" && (
                    <span className="text-xs bg-red-900/30 text-red-400 border border-red-800/30 rounded-full px-2 py-0.5">🐋 Whales distributing</span>
                  )}
                  {current.volume_surge && (
                    <span className="text-xs bg-purple-900/30 text-purple-400 border border-purple-800/30 rounded-full px-2 py-0.5">📊 Vol surge {current.volume_surge_ratio?.toFixed(1)}×</span>
                  )}
                  {current.emission_trend === "up" && (
                    <span className="text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-800/30 rounded-full px-2 py-0.5">⚛️ Emission ↑</span>
                  )}
                  {current.sector_rotation && (
                    <span className="text-xs bg-orange-900/30 text-orange-400 border border-orange-800/30 rounded-full px-2 py-0.5">🔄 Sector rotation</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Recent signals list */}
          {detail && detail.signals.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Recent Signals ({detail.signals.length} captured)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {detail.signals.slice(0, 8).map((sig, i) => (
                  <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 border text-xs ${
                    sig.strength >= 80 ? "border-green-800/40 bg-green-950/20" :
                    sig.strength >= 50 ? "border-yellow-800/30 bg-yellow-950/10" :
                    "border-gray-800/30 bg-gray-900/20"
                  }`}>
                    <span className={`font-bold tabular-nums flex-shrink-0 ${
                      sig.strength >= 80 ? "text-green-400" : sig.strength >= 50 ? "text-yellow-400" : "text-gray-500"
                    }`}>{sig.strength}</span>
                    <div className="min-w-0">
                      <div className="text-gray-300 truncate">{sig.title}</div>
                      <div className="text-gray-600 text-[10px]">{sig.signal_type} · {new Date(sig.signal_date || sig.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Narrative */}
          <div className="border-t border-gray-800/40 pt-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              🔍 Analysis
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">{narrative}</p>
            <div className="mt-2 text-xs text-gray-600">
              Added: {pumper.added_at} · Reason: {pumper.reason ?? "manual"} ·
              {pumper.netuid != null && (
                <Link href={`/subnets/${pumper.netuid}`} className="ml-1 text-gray-500 hover:text-gray-300">
                  Full subnet page →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function TestingPage() {
  const [autopsies, setAutopsies] = useState<Autopsy[]>([]);
  const [autoDetected, setAutoDetected] = useState<SubnetScore[]>([]);
  const [addModal, setAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addNetuid, setAddNetuid] = useState("");
  const [addReason, setAddReason] = useState("");
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  // Match a tracked pumper to a subnet in the leaderboard by name
  function resolveName(tracked: TrackedPumper, leaderboard: SubnetScore[]): SubnetScore | null {
    const search = (tracked.searchName || tracked.name).toLowerCase();
    // Exact match first
    let match = leaderboard.find((s) => s.name.toLowerCase() === search);
    if (!match) match = leaderboard.find((s) => s.name.toLowerCase().includes(search) || search.includes(s.name.toLowerCase().split(" ")[0]));
    return match ?? null;
  }

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    async function loadAll() {
      // 1) Fetch tracked list
      const trackerRes = await fetch("/api/testing");
      const { tracked }: { tracked: TrackedPumper[] } = await trackerRes.json();

      // 2) Fetch leaderboard (for name→netuid resolution + current scores)
      const scanRes = await fetch("/api/cached-scan");
      const scanData = await scanRes.json();
      const leaderboard: SubnetScore[] = scanData.leaderboard ?? [];

      // Auto-detect: subnets with >50% 7D pump not yet tracked
      const trackedNames = new Set(tracked.map((t) => (t.searchName || t.name).toLowerCase()));
      const newPumpers = leaderboard.filter(
        (s) =>
          (s.price_change_7d ?? 0) >= 50 &&
          !trackedNames.has(s.name.toLowerCase()) &&
          !tracked.some((t) => s.name.toLowerCase().includes((t.searchName || t.name).toLowerCase()))
      );
      setAutoDetected(newPumpers.sort((a, b) => (b.price_change_7d ?? 0) - (a.price_change_7d ?? 0)).slice(0, 5));

      // 3) Initialise autopsy stubs
      const stubs: Autopsy[] = tracked.map((p) => {
        const current = p.netuid != null
          ? leaderboard.find((s) => s.netuid === p.netuid) ?? resolveName(p, leaderboard)
          : resolveName(p, leaderboard);
        const resolvedNetuid = current?.netuid ?? p.netuid ?? null;
        return {
          pumper: { ...p, netuid: resolvedNetuid },
          current: current ?? null,
          detail: null,
          pumpEvent: null,
          findings: [],
          narrative: "",
          loading: resolvedNetuid != null,
        };
      });
      setAutopsies(stubs);

      // 4) Load subnet detail for each resolved netuid (staggered to avoid hammering)
      for (let i = 0; i < stubs.length; i++) {
        const stub = stubs[i];
        const netuid = stub.pumper.netuid;
        if (netuid == null) continue;

        await new Promise((r) => setTimeout(r, i * 600)); // stagger

        try {
          const res = await fetch(`/api/subnets/${netuid}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const detail: SubnetDetail = await res.json();

          const pumpEvent = findBestPump(detail.priceHistory);
          const findings = buildFindings(pumpEvent, detail.scoreHistory, detail.signals, stub.current);
          const narrative = buildNarrative(stub.pumper.name, pumpEvent, findings, detail.scoreHistory, stub.current);

          setAutopsies((prev) =>
            prev.map((a, idx) =>
              idx === i ? { ...a, detail, pumpEvent, findings, narrative, loading: false } : a
            )
          );
        } catch (e) {
          setAutopsies((prev) =>
            prev.map((a, idx) =>
              idx === i ? { ...a, loading: false, error: String(e) } : a
            )
          );
        }
      }
    }

    loadAll().catch(console.error);
  }, []);

  async function handleRemove(name: string) {
    await fetch("/api/testing", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setAutopsies((prev) => prev.filter((a) => a.pumper.name !== name));
  }

  async function handleAddNew(name: string, netuid?: number, reason?: string) {
    setSaving(true);
    try {
      await fetch("/api/testing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, netuid: netuid ?? null, reason }),
      });
      // Reload page to pick up new entry
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  async function trackAutoDetected(sub: SubnetScore) {
    await handleAddNew(sub.name, sub.netuid, `Auto-detected: +${(sub.price_change_7d ?? 0).toFixed(0)}% 7D`);
  }

  const loading = autopsies.some((a) => a.loading);
  const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-8 space-y-8">

        {/* Page header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">🔬 Pump Autopsy Lab</h1>
            <span className="text-xs bg-yellow-900/50 text-yellow-400 border border-yellow-800/40 rounded-full px-2 py-0.5 font-medium">BETA</span>
          </div>
          <p className="text-gray-500 text-sm max-w-2xl">
            Backtesting which signals fire before price pumps. Tracks subnets that have pumped strongly on the 7D timeframe and audits what indicators preceded the move — to sharpen the AlphaGap algo.
          </p>
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-600">
            <Link href="/dashboard" className="hover:text-gray-400 transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-gray-400">Pump Autopsy</span>
          </div>
        </div>

        {/* Auto-detected pumpers banner */}
        {autoDetected.length > 0 && (
          <div className="bg-yellow-950/20 border border-yellow-800/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-yellow-400 font-semibold text-sm">🚀 New Pumpers Detected</span>
              <span className="text-xs text-gray-500">Subnets with &gt;50% 7D gain not yet tracked</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {autoDetected.map((sub) => (
                <div key={sub.netuid} className="flex items-center gap-2 bg-yellow-950/30 border border-yellow-800/20 rounded-lg px-3 py-2">
                  <span className="text-white font-medium text-sm">{sub.name}</span>
                  <span className="text-xs text-gray-500">SN{sub.netuid}</span>
                  <span className="text-green-400 font-bold text-sm">{fmtPct(sub.price_change_7d ?? 0)}</span>
                  <button
                    onClick={() => trackAutoDetected(sub)}
                    className="text-xs bg-yellow-800/40 hover:bg-yellow-800/60 text-yellow-300 rounded px-2 py-0.5 transition-colors ml-1"
                  >
                    + Track
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Tracked Pumpers", val: autopsies.length },
            { label: "Strong Signals Found", val: autopsies.reduce((n, a) => n + a.findings.filter((f) => f.fired && f.strength === "strong").length, 0) },
            {
              label: "Avg Peak 7D Pump",
              val: autopsies.filter((a) => a.pumpEvent).length > 0
                ? `+${(autopsies.filter((a) => a.pumpEvent).reduce((s, a) => s + (a.pumpEvent?.gain ?? 0), 0) / autopsies.filter((a) => a.pumpEvent).length).toFixed(0)}%`
                : "—",
            },
            { label: "Loading", val: loading ? autopsies.filter((a) => a.loading).length + " remaining" : "Done ✓" },
          ].map(({ label, val }) => (
            <div key={label} className="bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3">
              <div className="text-xl font-bold text-white">{val}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Add new button */}
        <div className="flex justify-end">
          <button
            onClick={() => setAddModal(true)}
            className="text-sm bg-blue-800/30 hover:bg-blue-800/50 border border-blue-700/40 text-blue-300 rounded-lg px-4 py-2 transition-colors"
          >
            + Add Pumper
          </button>
        </div>

        {/* Autopsy cards */}
        <div className="space-y-4">
          {autopsies.map((a) => (
            <AutopsyCard
              key={a.pumper.name}
              autopsy={a}
              onRemove={() => handleRemove(a.pumper.name)}
            />
          ))}
          {autopsies.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-600">No tracked pumpers yet. Add some above.</div>
          )}
        </div>

        {/* Add modal */}
        {addModal && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setAddModal(false)}
          >
            <div
              className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-white">Track a New Pumper</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Subnet Name *</label>
                  <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Apex"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Netuid (optional)</label>
                  <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g. 42"
                    value={addNetuid}
                    onChange={(e) => setAddNetuid(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Reason / Notes</label>
                  <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g. +87% 7D pump on Apr 5"
                    value={addReason}
                    onChange={(e) => setAddReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm transition-colors"
                  onClick={() => setAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 bg-blue-700 hover:bg-blue-600 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
                  disabled={!addName || saving}
                  onClick={() => handleAddNew(addName, addNetuid ? parseInt(addNetuid) : undefined, addReason)}
                >
                  {saving ? "Adding…" : "Track It"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
