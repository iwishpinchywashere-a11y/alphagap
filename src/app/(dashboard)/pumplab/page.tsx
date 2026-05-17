"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { SubnetScore } from "@/lib/types";
import type { TrackedPumper } from "@/app/api/testing/route";
import BlurGate from "@/components/BlurGate";
import { getTier } from "@/lib/subscription";

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
  gain: number;
  startDate: string;
  endDate: string;
  startIdx: number;
  endIdx: number;
  startPrice: number;
  peakPrice: number;
  daysAgo: number;
}

interface SignalFinding {
  icon: string;
  label: string;
  detail: string;
  strength: "strong" | "high" | "moderate" | "weak";
  daysBeforePump: number;
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

function findBestPump(prices: PricePoint[], targetDate?: string | null): PumpEvent | null {
  if (prices.length < 8) return null;
  let bestGain = -Infinity;
  let bestStart = 0;
  let bestEnd = 7;
  const WINDOW = 7;

  const targetMs = targetDate ? new Date(targetDate).getTime() : null;
  const WINDOW_MS = 12 * 86400000;

  for (let i = 0; i <= prices.length - WINDOW - 1; i++) {
    if (targetMs !== null) {
      const windowStartMs = new Date(prices[i].timestamp).getTime();
      if (Math.abs(windowStartMs - targetMs) > WINDOW_MS) continue;
    }
    const sp = prices[i].price;
    const ep = prices[i + WINDOW].price;
    if (sp <= 0) continue;
    const g = ((ep - sp) / sp) * 100;
    if (g > bestGain) { bestGain = g; bestStart = i; bestEnd = i + WINDOW; }
  }
  if (bestGain <= 10) return null;

  const startDate = prices[bestStart].timestamp;
  const endDate = prices[bestEnd].timestamp;
  const daysAgo = Math.round((Date.now() - new Date(startDate).getTime()) / 86400000);

  return { gain: bestGain, startDate, endDate, startIdx: bestStart, endIdx: bestEnd, startPrice: prices[bestStart].price, peakPrice: prices[bestEnd].price, daysAgo };
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

  // AlphaGap Score
  const agapNow = current?.composite_score ?? 0;
  const prePumpScores = pre7.length > 0 ? pre7 : pre14;
  const agapAtPump = prePumpScores.length > 0 ? prePumpScores[prePumpScores.length - 1].agap : agapNow;
  const effectiveAgap = Math.max(agapAtPump, agapNow);
  const agapFired = effectiveAgap >= 65;
  findings.push({
    icon: "🎯",
    label: "AlphaGap Score",
    detail: effectiveAgap >= 80
      ? `aGap score ${effectiveAgap}/100 before pump — top-tier signal`
      : effectiveAgap >= 65
      ? `aGap score ${effectiveAgap}/100 — above-average signal`
      : `aGap score ${effectiveAgap}/100 — below threshold`,
    strength: effectiveAgap >= 80 ? "strong" : effectiveAgap >= 65 ? "high" : "weak",
    daysBeforePump: prePumpScores.length > 0 ? Math.min(7, prePumpScores.length) : 0,
    fired: agapFired,
  });

  // Dev spike
  const devTrend7  = trend(pre7.map((s) => s.dev));
  const devTrend14 = trend(pre14.map((s) => s.dev));
  const devSignals = signals.filter((s) => s.signal_type === "dev_spike");
  const devPrePump = devSignals.filter((s) => {
    const t = new Date(s.signal_date || s.created_at).getTime();
    return t < pumpMs && t > pumpMs - 14 * 86400000;
  });
  findings.push({
    icon: "⚡",
    label: "Dev Spike",
    detail: devPrePump.length > 0
      ? `${devPrePump.length} dev-spike signal${devPrePump.length > 1 ? "s" : ""} fired before pump`
      : devTrend14 > 10
      ? `Dev score +${devTrend14.toFixed(0)} pts in 14d window`
      : "No significant dev activity",
    strength: devPrePump.length > 0 ? "strong" : devTrend14 > 10 ? "moderate" : "weak",
    daysBeforePump: devPrePump.length > 0
      ? Math.round((pumpMs - new Date(devPrePump[0].signal_date || devPrePump[0].created_at).getTime()) / 86400000)
      : 7,
    fired: devTrend7 > 15 || devTrend14 > 20 || devPrePump.length > 0,
  });

  // Social spike
  const socialTrend14 = trend(pre14.map((s) => s.social));
  const socialSignals = signals.filter((s) => ["social_spike", "kol_mention", "twitter_spike"].includes(s.signal_type));
  const socialPrePump = socialSignals.filter((s) => {
    const t = new Date(s.signal_date || s.created_at).getTime();
    return t < pumpMs + 86400000 && t > pumpMs - 10 * 86400000;
  });
  findings.push({
    icon: "📢",
    label: "Social / KOL",
    detail: socialPrePump.length > 0
      ? `${socialPrePump.length} social signal${socialPrePump.length > 1 ? "s" : ""} — KOLs active pre-pump`
      : socialTrend14 > 10
      ? `Social score +${socialTrend14.toFixed(0)} pts in pre-pump window`
      : "No notable social signals",
    strength: socialPrePump.length >= 2 ? "strong" : socialPrePump.length === 1 || socialTrend14 > 10 ? "moderate" : "weak",
    daysBeforePump: socialPrePump.length > 0
      ? Math.round((pumpMs - new Date(socialPrePump[0].signal_date || socialPrePump[0].created_at).getTime()) / 86400000)
      : 3,
    fired: socialPrePump.length > 0 || socialTrend14 > 10,
  });

  // Volume surge
  const volSignals = signals.filter((s) => s.signal_type === "volume_surge");
  const volPrePump = volSignals.filter((s) => {
    const t = new Date(s.signal_date || s.created_at).getTime();
    return t < pumpMs + 2 * 86400000 && t > pumpMs - 7 * 86400000;
  });
  findings.push({
    icon: "📊",
    label: "Volume Surge",
    detail: volPrePump.length > 0
      ? `Volume spike detected around pump start`
      : current?.volume_surge
      ? `Vol surge ${current.volume_surge_ratio?.toFixed(1) ?? ""}× normal`
      : "No clear volume surge",
    strength: volPrePump.length > 0 ? "strong" : current?.volume_surge ? "high" : "weak",
    daysBeforePump: volPrePump.length > 0
      ? Math.round((pumpMs - new Date(volPrePump[0].signal_date || volPrePump[0].created_at).getTime()) / 86400000)
      : 1,
    fired: volPrePump.length > 0 || !!(current?.volume_surge && (current.volume_surge_ratio ?? 0) > 2),
  });

  // Whale accumulation
  const whaleSignals = signals.filter((s) => s.signal_type === "whale_accumulation" || (s.title || "").toLowerCase().includes("whale"));
  const whalePrePump = whaleSignals.filter((s) => {
    const t = new Date(s.signal_date || s.created_at).getTime();
    return t < pumpMs + 86400000 && t > pumpMs - 14 * 86400000;
  });
  findings.push({
    icon: "🐋",
    label: "Whale Accumulation",
    detail: whalePrePump.length > 0
      ? `Whale accumulation signal detected before pump`
      : current?.whale_signal === "accumulating"
      ? `Currently accumulating (${current.whale_ratio?.toFixed(1) ?? "?"}×)`
      : "No whale signal detected",
    strength: whalePrePump.length > 0 ? "strong" : current?.whale_signal === "accumulating" ? "moderate" : "weak",
    daysBeforePump: whalePrePump.length > 0
      ? Math.round((pumpMs - new Date(whalePrePump[0].signal_date || whalePrePump[0].created_at).getTime()) / 86400000)
      : 5,
    fired: whalePrePump.length > 0 || current?.whale_signal === "accumulating",
  });

  // Emission
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
      ? `Emission share +${emTrend14.toFixed(2)}% in pre-pump window`
      : "Emission flat/declining",
    strength: emPrePump.length > 0 ? "moderate" : emTrend14 > 0.3 ? "moderate" : "weak",
    daysBeforePump: emPrePump.length > 0
      ? Math.round((pumpMs - new Date(emPrePump[0].signal_date || emPrePump[0].created_at).getTime()) / 86400000)
      : 10,
    fired: emPrePump.length > 0 || emTrend14 > 0.3,
  });

  return findings;
}

// ── Mini SVG price chart ───────────────────────────────────────────────────

function MiniPriceChart({ prices, pump }: { prices: PricePoint[]; pump: PumpEvent | null }) {
  const W = 600; const H = 160;
  const PAD = { top: 16, right: 16, bottom: 32, left: 56 };

  if (prices.length < 2) {
    return (
      <div className="flex items-center justify-center h-[160px] text-gray-700 text-xs italic">
        No price data
      </div>
    );
  }

  const fmtPrice = (v: number) => {
    if (v < 0.0001) return `$${v.toFixed(6)}`;
    if (v < 0.01)   return `$${v.toFixed(4)}`;
    if (v < 1)      return `$${v.toFixed(3)}`;
    if (v < 1000)   return `$${v.toFixed(2)}`;
    return `$${(v / 1000).toFixed(1)}K`;
  };

  const vals = prices.map((p) => p.price);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (i / (prices.length - 1)) * cW;
  const y = (v: number) => PAD.top + cH - ((v - minV) / range) * cH;

  const path = prices.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.price).toFixed(1)}`).join(" ");
  const areaBottom = PAD.top + cH;
  const fill = path + ` L ${x(prices.length - 1).toFixed(1)} ${areaBottom.toFixed(1)} L ${PAD.left} ${areaBottom.toFixed(1)} Z`;

  const pumpRect = pump && pump.startIdx < prices.length && pump.endIdx < prices.length
    ? { x1: x(pump.startIdx), x2: x(Math.min(pump.endIdx, prices.length - 1)) }
    : null;

  const isUp = prices[prices.length - 1].price >= prices[0].price;
  const lineColor = pump && pump.gain > 0 ? "#4ade80" : isUp ? "#4ade80" : "#f87171";
  const gradId = `chartFill_${pump?.startDate ?? "up"}`;

  const yLabels = [0, 1, 2, 3].map((i) => ({ val: minV + (i / 3) * range, yPos: y(minV + (i / 3) * range) }));
  const xLabels = [0, 1, 2, 3].map((i) => {
    const idx = Math.round((i / 3) * (prices.length - 1));
    return { idx, xPos: x(idx), label: new Date(prices[idx].timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
  });

  const pumpPeakIdx = pump && pump.endIdx < prices.length ? pump.endIdx : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "160px" }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {yLabels.map(({ yPos }, i) => (
        <line key={i} x1={PAD.left} y1={yPos.toFixed(1)} x2={W - PAD.right} y2={yPos.toFixed(1)} stroke="rgba(55,65,81,0.4)" strokeWidth="1" />
      ))}
      {yLabels.map(({ val, yPos }, i) => (
        <text key={i} x={PAD.left - 4} y={(yPos + 3).toFixed(1)} fill="#6b7280" fontSize="9" textAnchor="end">{fmtPrice(val)}</text>
      ))}

      {/* Pump region highlight */}
      {pumpRect && (
        <rect x={pumpRect.x1} y={PAD.top} width={Math.max(pumpRect.x2 - pumpRect.x1, 2)} height={cH}
          fill="rgba(74,222,128,0.08)" stroke="rgba(74,222,128,0.25)" strokeWidth="1" rx="2" />
      )}

      <path d={fill} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {pump && pump.startIdx < prices.length && (
        <circle cx={x(pump.startIdx).toFixed(1)} cy={y(prices[pump.startIdx].price).toFixed(1)} r="4" fill="#facc15" />
      )}
      {pumpPeakIdx != null && pump != null && (
        <>
          <circle cx={x(pumpPeakIdx).toFixed(1)} cy={y(prices[pumpPeakIdx].price).toFixed(1)} r="4" fill="#4ade80" />
          <text x={(x(pumpPeakIdx) + 6).toFixed(1)} y={(y(prices[pumpPeakIdx].price) - 6).toFixed(1)} fill="#4ade80" fontSize="10" fontWeight="bold">
            ▲ +{pump.gain.toFixed(0)}%
          </text>
        </>
      )}

      {xLabels.map(({ xPos, label }, i) => (
        <text key={i} x={xPos.toFixed(1)} y={(H - 6).toFixed(1)} fill="#4b5563" fontSize="9" textAnchor="middle">{label}</text>
      ))}
    </svg>
  );
}

// ── Formatters ─────────────────────────────────────────────────────────────

function fmtPrice(v: number): string {
  if (v < 0.0001) return `$${v.toFixed(8)}`;
  if (v < 0.01)   return `$${v.toFixed(5)}`;
  if (v < 1)      return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}
function fmtUsd(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(4)}`;
}

// ── Autopsy Card ──────────────────────────────────────────────────────────

function AutopsyCard({ autopsy, onRemove }: { autopsy: Autopsy; onRemove: () => void }) {
  const { pumper, current, detail, pumpEvent, findings, loading, error } = autopsy;

  const ms = detail?.marketStats ?? null;
  const priceUsd = current?.alpha_price ?? ms?.priceUsd ?? null;
  const mcap = current?.market_cap ?? ms?.marketCapUsd ?? null;
  const price7d = current?.price_change_7d ?? ms?.priceChangePct7d ?? null;

  const firedFindings = findings.filter((f) => f.fired);
  const firedCount = firedFindings.length;

  const signalBubbleColor = firedCount >= 3
    ? "bg-green-900/60 border-green-700/50 text-green-400"
    : firedCount === 2
    ? "bg-yellow-900/60 border-yellow-700/50 text-yellow-400"
    : "bg-orange-900/60 border-orange-700/50 text-orange-400";

  if (loading) {
    return (
      <div className="bg-gray-950/70 border border-gray-800/40 rounded-2xl overflow-hidden animate-pulse">
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-800/40">
          <div className="h-5 w-32 bg-gray-800 rounded-lg" />
          <div className="h-8 w-16 bg-gray-800 rounded-lg" />
        </div>
        <div className="h-[160px] mx-5 my-4 bg-gray-900/50 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="bg-gray-950/70 border border-gray-800/50 rounded-2xl overflow-hidden backdrop-blur-sm">

      {/* Header */}
      <div className="relative flex items-center justify-between px-5 py-4 bg-gradient-to-r from-green-950/30 via-emerald-950/10 to-transparent border-b border-gray-800/50">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-green-500 to-emerald-600 rounded-l-2xl" />

        <div className="pl-3 flex items-center gap-3 min-w-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-white font-bold text-lg">{pumper.name}</span>
              {pumper.netuid != null && (
                <Link href={`/subnets/${pumper.netuid}`}
                  className="text-[11px] text-green-400 bg-green-900/40 border border-green-800/40 rounded-md px-2 py-0.5 hover:text-green-300 transition-colors">
                  SN{pumper.netuid}
                </Link>
              )}
              {error && <span className="text-xs text-red-500">{error}</span>}
            </div>
            <div className="flex items-center gap-3 text-xs">
              {priceUsd != null && <span className="text-gray-300 font-mono">{fmtPrice(priceUsd)}</span>}
              {mcap != null && <span className="text-gray-500">MCap {fmtUsd(mcap)}</span>}
              {price7d != null && (
                <span className={`font-medium ${price7d >= 0 ? "text-green-400" : "text-red-400"}`}>
                  7D {price7d >= 0 ? "+" : ""}{price7d.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {pumpEvent && (
            <div className="text-right">
              <div className="text-green-400 font-bold text-2xl leading-none tabular-nums">+{pumpEvent.gain.toFixed(0)}%</div>
              <div className="text-gray-600 text-[10px] mt-0.5">peak pump</div>
            </div>
          )}
          <div className={`flex flex-col items-center justify-center w-11 h-11 rounded-xl border ${signalBubbleColor}`}>
            <span className="font-bold text-base leading-none">{firedCount}</span>
            <span className="text-[9px] leading-none mt-0.5 opacity-70">signals</span>
          </div>
          <button onClick={onRemove} className="text-gray-700 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-gray-800/60" title="Remove">✕</button>
        </div>
      </div>

      {/* Chart */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-2 text-[10px] text-gray-600">
          <span className="uppercase tracking-widest font-semibold">90-Day Price</span>
          {pumpEvent && <><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />pump start</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />pump peak</span></>}
        </div>
        <div className="bg-gray-900/40 rounded-xl p-3 border border-gray-800/30">
          <MiniPriceChart prices={detail?.priceHistory ?? []} pump={pumpEvent} />
        </div>
        {pumpEvent && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
            <span>{new Date(pumpEvent.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} → {new Date(pumpEvent.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            <span className="text-green-400 font-medium">+{pumpEvent.gain.toFixed(1)}% ({fmtPrice(pumpEvent.startPrice)} → {fmtPrice(pumpEvent.peakPrice)})</span>
            <span className={pumpEvent.daysAgo <= 7 ? "text-yellow-400" : ""}>{pumpEvent.daysAgo <= 3 ? "🔥 Recent!" : pumpEvent.daysAgo <= 7 ? "Recent" : `~${pumpEvent.daysAgo}d ago`}</span>
          </div>
        )}
      </div>

      {/* Fired signals — simple chips */}
      {firedFindings.length > 0 && (
        <div className="px-5 pb-5 pt-2">
          <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Pre-Pump Signals</div>
          <div className="flex flex-wrap gap-2">
            {firedFindings.map((f) => {
              const isStrong = f.strength === "strong" || f.strength === "high";
              return (
                <div key={f.label} className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-xs ${
                  isStrong ? "border-green-800/40 bg-green-950/20" : "border-yellow-800/30 bg-yellow-950/10"
                }`}>
                  <span>{f.icon}</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-200 font-medium">{f.label}</span>
                      <span className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 border ${
                        isStrong ? "bg-green-900/60 text-green-400 border-green-800/40" : "bg-yellow-900/50 text-yellow-400 border-yellow-800/40"
                      }`}>
                        {f.strength === "strong" ? "STRONG" : f.strength === "high" ? "HIGH" : "MOD"}
                      </span>
                      {f.daysBeforePump > 0 && <span className="text-gray-600">−{f.daysBeforePump}d before pump</span>}
                    </div>
                    <div className="text-gray-500 text-[10px] mt-0.5">{f.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-xs text-gray-600">
            Added {pumper.added_at} · {pumper.reason ?? "manual"}{pumper.netuid != null && <> · <Link href={`/subnets/${pumper.netuid}`} className="hover:text-gray-400 transition-colors">Full subnet →</Link></>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function PumpLabPage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const [autopsies, setAutopsies] = useState<Autopsy[]>([]);
  const [autoDetected, setAutoDetected] = useState<TrackedPumper[]>([]);
  const loadedRef = useRef(false);

  function resolveName(tracked: TrackedPumper, leaderboard: SubnetScore[]): SubnetScore | null {
    const search = (tracked.searchName || tracked.name).toLowerCase();
    let match = leaderboard.find((s) => s.name.toLowerCase() === search);
    if (!match) match = leaderboard.find((s) => s.name.toLowerCase().includes(search) || search.includes(s.name.toLowerCase().split(" ")[0]));
    return match ?? null;
  }

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    async function saveToCache(name: string, data: { pumpEvent: PumpEvent | null; findings: SignalFinding[]; narrative: string; research: null; priceHistory: PricePoint[] }) {
      try {
        await fetch("/api/testing", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, autopsy: data }),
        });
      } catch { /* non-critical */ }
    }

    async function loadAll() {
      // 1) Fetch tracked list + cache
      const trackerRes = await fetch("/api/testing");
      const { tracked, cache = {} }: {
        tracked: TrackedPumper[];
        cache: Record<string, { pumpEvent: PumpEvent | null; findings: SignalFinding[]; narrative: string; priceHistory?: PricePoint[] }>
      } = await trackerRes.json();

      // 2) Fetch leaderboard
      const scanRes = await fetch("/api/cached-scan");
      const scanData = await scanRes.json();
      const leaderboard: SubnetScore[] = scanData.leaderboard ?? [];

      // Auto-detect: subnets with >20% 7D pump not yet tracked
      const trackedNames = new Set(tracked.map((t) => (t.searchName || t.name).toLowerCase()));
      const newPumpers = leaderboard
        .filter((s) =>
          (s.price_change_7d ?? 0) >= 20 &&
          !trackedNames.has(s.name.toLowerCase()) &&
          !tracked.some((t) => s.name.toLowerCase().includes((t.searchName || t.name).toLowerCase()))
        )
        .sort((a, b) => (b.price_change_7d ?? 0) - (a.price_change_7d ?? 0))
        .slice(0, 8);

      const autoAdded: TrackedPumper[] = [];
      for (const sub of newPumpers) {
        try {
          const res = await fetch("/api/testing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: sub.name,
              searchName: sub.name.toLowerCase(),
              netuid: sub.netuid,
              reason: `Auto-detected: +${(sub.price_change_7d ?? 0).toFixed(0)}% 7D`,
              pump_pct: sub.price_change_7d ?? 0,
            }),
          });
          if (res.ok) {
            const { entry } = await res.json();
            autoAdded.push(entry);
            tracked.push(entry);
            trackedNames.add(sub.name.toLowerCase());
          }
        } catch { /* skip */ }
      }
      setAutoDetected(autoAdded);

      // 3) Build stubs — cache-first
      tracked.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());

      const stubs: Autopsy[] = tracked.map((p) => {
        const current = p.netuid != null
          ? leaderboard.find((s) => s.netuid === p.netuid) ?? resolveName(p, leaderboard)
          : resolveName(p, leaderboard);
        const resolvedNetuid = current?.netuid ?? p.netuid ?? null;

        const cachedKey = Object.keys(cache).find(k => k.toLowerCase() === p.name.toLowerCase());
        const cached = cachedKey ? cache[cachedKey] : null;

        if (cached && cached.findings.length > 0) {
          // Build detail with cached price history (may be empty for old entries)
          const cachedDetail: SubnetDetail | null = cached.priceHistory?.length
            ? { netuid: resolvedNetuid ?? 0, name: p.name, identity: null, scoreHistory: [], priceHistory: cached.priceHistory, signals: [], marketStats: null }
            : null;
          return {
            pumper: { ...p, netuid: resolvedNetuid },
            current: current ?? null,
            detail: cachedDetail,
            pumpEvent: cached.pumpEvent,
            findings: cached.findings,
            narrative: "",
            loading: false,
          };
        }

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

      // 4) For cached entries MISSING price history — fetch in background to fill chart
      const needsChart = stubs.filter(s => !s.loading && s.detail === null && s.pumper.netuid != null);
      // Process these alongside uncached entries below

      // 5) Fetch detail for uncached entries (and for cached-but-no-chart)
      const uncached = stubs
        .map((stub) => ({ stub }))
        .filter(({ stub }) => stub.loading);

      // Background chart-fills (no stagger, just chart data)
      for (const stub of needsChart) {
        const stubName = stub.pumper.name;
        const netuid = stub.pumper.netuid!;
        (async () => {
          try {
            const res = await fetch(`/api/subnets/${netuid}`);
            if (!res.ok) return;
            const detail: SubnetDetail = await res.json();
            setAutopsies(prev => prev.map(a => a.pumper.name === stubName ? { ...a, detail } : a));
            // Re-save cache with price history
            const cachedKey = Object.keys(cache).find(k => k.toLowerCase() === stubName.toLowerCase());
            const cached = cachedKey ? cache[cachedKey] : null;
            if (cached) {
              await saveToCache(stubName, {
                pumpEvent: stub.pumpEvent,
                findings: stub.findings as SignalFinding[],
                narrative: "",
                research: null,
                priceHistory: detail.priceHistory,
              });
            }
          } catch { /* ignore */ }
        })();
      }

      // Full compute for truly uncached entries
      for (let ci = 0; ci < uncached.length; ci++) {
        const { stub } = uncached[ci];
        const stubName = stub.pumper.name;
        const netuid = stub.pumper.netuid;
        if (netuid == null) {
          setAutopsies(prev => prev.map(a => a.pumper.name === stubName ? { ...a, loading: false } : a));
          continue;
        }

        if (ci > 0) await new Promise((r) => setTimeout(r, Math.min(ci * 200, 800)));

        try {
          const res = await fetch(`/api/subnets/${netuid}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const detail: SubnetDetail = await res.json();

          const pumpEvent = findBestPump(detail.priceHistory, stub.pumper.pump_date);
          const findings = buildFindings(pumpEvent, detail.scoreHistory, detail.signals, stub.current);

          // Auto-purge 0-signal cases
          const firedCount = findings.filter((f) => f.fired).length;
          if (firedCount === 0) {
            fetch("/api/testing", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: stubName }),
            }).catch(() => {});
            setAutopsies((prev) => prev.filter((a) => a.pumper.name !== stubName));
            continue;
          }

          setAutopsies((prev) =>
            prev.map((a) => a.pumper.name === stubName ? { ...a, detail, pumpEvent, findings, narrative: "", loading: false } : a)
          );

          await saveToCache(stubName, { pumpEvent, findings, narrative: "", research: null, priceHistory: detail.priceHistory });

        } catch (e) {
          setAutopsies((prev) =>
            prev.map((a) => a.pumper.name === stubName ? { ...a, loading: false, error: String(e) } : a)
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

  const loading = autopsies.some((a) => a.loading);

  const sortedAutopsies = [...autopsies]
    .filter((a) => a.loading || a.findings.filter((f) => f.fired).length > 0)
    .sort((a, b) => {
      if (a.loading && !b.loading) return 1;
      if (!a.loading && b.loading) return -1;
      return b.findings.filter((f) => f.fired).length - a.findings.filter((f) => f.fired).length;
    });

  const totalCases = sortedAutopsies.filter(a => !a.loading).length;
  const totalStrong = autopsies.reduce((n, a) => n + a.findings.filter((f) => f.fired && f.strength === "strong").length, 0);
  const pumpsWithEvent = autopsies.filter((a) => a.pumpEvent);
  const avgPump = pumpsWithEvent.length > 0
    ? (pumpsWithEvent.reduce((s, a) => s + (a.pumpEvent?.gain ?? 0), 0) / pumpsWithEvent.length).toFixed(0)
    : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* Hero header */}
      <div className="relative overflow-hidden border-b border-gray-800/50">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="absolute -top-20 left-1/3 w-96 h-96 bg-green-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-screen-xl mx-auto px-4 md:px-6 pt-10 pb-7">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 via-emerald-300 to-white bg-clip-text text-transparent">
              🔬 Pump Autopsy Lab
            </h1>
            <span className="text-xs bg-yellow-900/50 text-yellow-400 border border-yellow-800/40 rounded-full px-2 py-0.5 font-medium">BETA</span>
          </div>
          <p className="text-gray-500 text-sm max-w-2xl mb-5">
            Which signals fired before each pump? Backtesting the AlphaGap algo against real price moves.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs bg-gray-800/60 border border-gray-700/40 rounded-full px-3 py-1.5 text-gray-300">
              <span className="font-bold text-white">{totalCases}</span> cases
            </span>
            <span className="text-gray-700">·</span>
            <span className="text-xs bg-green-900/30 border border-green-800/30 rounded-full px-3 py-1.5 text-gray-300">
              <span className="font-bold text-green-400">{totalStrong}</span> strong signals
            </span>
            {avgPump && (
              <><span className="text-gray-700">·</span>
              <span className="text-xs bg-gray-800/60 border border-gray-700/40 rounded-full px-3 py-1.5 text-gray-300">
                avg <span className="font-bold text-green-400">+{avgPump}%</span> pump
              </span></>
            )}
            {loading && (
              <><span className="text-gray-700">·</span>
              <span className="text-xs bg-gray-800/60 border border-gray-700/40 rounded-full px-3 py-1.5 text-gray-500 animate-pulse">
                Computing {autopsies.filter((a) => a.loading).length} new…
              </span></>
            )}
          </div>
        </div>
      </div>

      <BlurGate tier={tier} required="premium" minHeight="500px">
        <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-8 space-y-6">

          {autoDetected.length > 0 && (
            <div className="bg-green-950/20 border border-green-800/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-400 font-semibold text-sm">🚀 Auto-added {autoDetected.length} new pumper{autoDetected.length > 1 ? "s" : ""}</span>
                <span className="text-xs text-gray-500">Detected &gt;20% 7D gain</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {autoDetected.map((p) => (
                  <div key={p.netuid ?? p.name} className="flex items-center gap-2 bg-green-950/30 border border-green-800/20 rounded-xl px-3 py-2">
                    <span className="text-white font-medium text-sm">{p.name}</span>
                    {p.netuid != null && <span className="text-xs text-gray-500">SN{p.netuid}</span>}
                    {p.pump_pct != null && <span className="text-green-400 font-bold text-sm">+{p.pump_pct.toFixed(0)}%</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {sortedAutopsies.map((a) => (
              <AutopsyCard key={a.pumper.name} autopsy={a} onRemove={() => handleRemove(a.pumper.name)} />
            ))}
            {autopsies.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-600">No pumpers tracked yet.</div>
            )}
          </div>
        </div>
      </BlurGate>
    </div>
  );
}
