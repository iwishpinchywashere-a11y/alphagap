"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import { formatNum } from "@/lib/formatters";
import type { SubnetScore } from "@/lib/types";
import BlurGate from "@/components/BlurGate";
import { getTier } from "@/lib/subscription";
import { useWatchlist } from "@/components/dashboard/WatchlistProvider";

type FilterType = "all" | "accumulating" | "distributing" | "volume" | "flow" | "yield";

function StrengthBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct >= 80 ? "bg-green-400" :
    pct >= 60 ? "bg-emerald-500" :
    pct >= 40 ? "bg-yellow-400" :
    "bg-orange-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-6">{pct}</span>
    </div>
  );
}

interface FlowEvent {
  netuid: number;
  name: string;
  type: "accumulating" | "distributing" | "volume_surge" | "flow_spike" | "flow_inflection" | "flow_warning" | "yield_spike" | "yield_dip";
  strength: number;
  headline: string;
  detail: string;
  badge: string;
  badgeColor: string;
  netFlow?: number;
  whaleRatio?: number;
  volumeRatio?: number;
  price?: number;
  change24h?: number;
  signalDate?: string;
  apy_7d?: number;
  apy_1h?: number;
  apy_30d?: number;
}

function formatFlowDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TODAY_ISO = new Date().toISOString();

// Yield divergence thresholds
// Spike: 1H APY is >25% above 30d baseline (e.g. 30d=40%, 1H≥50%)
// Dip:   1H APY is >25% below 30d baseline (e.g. 30d=40%, 1H≤30%)
const YIELD_SPIKE_THRESHOLD = 1.25;
const YIELD_DIP_THRESHOLD   = 0.75;
// Minimum 30d APY to consider (filter out near-zero subnets)
const MIN_30D_APY = 0.10;

export default function FlowPage() {
  const { leaderboard, signals, taoPrice, scanning } = useDashboard();
  const router = useRouter();
  const { data: session } = useSession();
  const tier = getTier(session);
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<"strength" | "flow" | "volume">("strength");
  const { isWatched, watchlist } = useWatchlist();
  const [watchlistOnly, setWatchlistOnly] = useState(false);

  const events = useMemo<FlowEvent[]>(() => {
    const out: FlowEvent[] = [];

    for (const sub of leaderboard) {
      // ── Whale accumulation ───────────────────────────────────────
      if (sub.whale_signal === "accumulating" && sub.whale_ratio != null) {
        const flowUsd = sub.net_flow_24h != null && taoPrice != null
          ? sub.net_flow_24h * taoPrice : null;
        const strength = Math.min(95, 50 + (sub.whale_ratio - 2) * 15);
        out.push({
          netuid: sub.netuid,
          name: sub.name,
          type: "accumulating",
          strength: Math.round(strength),
          headline: `${sub.whale_ratio}x avg buy size vs sells — whales accumulating`,
          detail: flowUsd != null
            ? `Net ${flowUsd > 0 ? "+" : ""}$${formatNum(Math.abs(Math.round(flowUsd)))} in 24h · ${sub.whale_ratio}x whale buy/sell ratio`
            : `${sub.whale_ratio}x whale buy/sell ratio detected`,
          badge: "🐋 WHALE BUY",
          badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
          netFlow: sub.net_flow_24h ?? undefined,
          whaleRatio: sub.whale_ratio,
          price: sub.alpha_price ?? undefined,
          change24h: sub.price_change_24h ?? undefined,
          signalDate: TODAY_ISO,
        });
      }

      // ── Whale distribution ───────────────────────────────────────
      if (sub.whale_signal === "distributing" && sub.whale_ratio != null) {
        const flowUsd = sub.net_flow_24h != null && taoPrice != null
          ? sub.net_flow_24h * taoPrice : null;
        const strength = Math.min(85, 50 + (1 / sub.whale_ratio - 2) * 10);
        out.push({
          netuid: sub.netuid,
          name: sub.name,
          type: "distributing",
          strength: Math.round(Math.max(30, strength)),
          headline: `${sub.whale_ratio}x sell pressure — smart money exiting`,
          detail: flowUsd != null
            ? `Net ${flowUsd > 0 ? "+" : "-"}$${formatNum(Math.abs(Math.round(flowUsd)))} in 24h · ${sub.whale_ratio}x whale sell/buy ratio`
            : `${sub.whale_ratio}x whale sell-side pressure`,
          badge: "🔻 WHALE SELL",
          badgeColor: "bg-red-500/20 text-red-400 border-red-500/30",
          netFlow: sub.net_flow_24h ?? undefined,
          whaleRatio: sub.whale_ratio,
          price: sub.alpha_price ?? undefined,
          change24h: sub.price_change_24h ?? undefined,
          signalDate: TODAY_ISO,
        });
      }

      // ── Volume surge ─────────────────────────────────────────────
      if (sub.volume_surge && sub.volume_surge_ratio != null) {
        const buyVolUsd = sub.net_flow_24h != null && taoPrice != null && sub.net_flow_24h > 0
          ? sub.net_flow_24h * taoPrice : null;
        const strength = Math.min(95,
          sub.volume_surge_ratio >= 10 ? 95 :
          sub.volume_surge_ratio >= 7 ? 85 :
          sub.volume_surge_ratio >= 5 ? 75 :
          sub.volume_surge_ratio >= 3.5 ? 65 : 55
        );
        out.push({
          netuid: sub.netuid,
          name: sub.name,
          type: "volume_surge",
          strength,
          headline: `${sub.volume_surge_ratio}x unusual buy volume vs 5-day average`,
          detail: buyVolUsd != null
            ? `+$${formatNum(Math.round(buyVolUsd))} net buying · ${sub.volume_surge_ratio}x rolling avg volume`
            : `${sub.volume_surge_ratio}x rolling average buy volume`,
          badge: "🤑 VOL SURGE",
          badgeColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
          volumeRatio: sub.volume_surge_ratio,
          netFlow: sub.net_flow_24h ?? undefined,
          price: sub.alpha_price ?? undefined,
          change24h: sub.price_change_24h ?? undefined,
          signalDate: TODAY_ISO,
        });
      }

      // ── Yield divergence signals ─────────────────────────────────
      if (
        sub.apy_1h != null && sub.apy_30d != null &&
        sub.apy_30d >= MIN_30D_APY
      ) {
        const ratio = sub.apy_1h / sub.apy_30d;
        const apy1hPct  = (sub.apy_1h  * 100).toFixed(0);
        const apy30dPct = (sub.apy_30d * 100).toFixed(0);

        if (ratio >= YIELD_SPIKE_THRESHOLD) {
          // 1H yield well above 30d baseline — something changed (emissions, validator drop-off, stake exit)
          const pctAbove = Math.round((ratio - 1) * 100);
          const strength = Math.min(90, 50 + (ratio - 1.25) * 120);
          out.push({
            netuid: sub.netuid,
            name: sub.name,
            type: "yield_spike",
            strength: Math.round(strength),
            headline: `Staking yield spiked ${pctAbove}% above 30-day baseline`,
            detail: `1H APY ${apy1hPct}% vs 30d avg ${apy30dPct}% — sudden shift in staking dynamics. Could signal validator exit, emissions change, or stake redistribution.`,
            badge: "📈 YIELD SPIKE",
            badgeColor: "bg-lime-500/20 text-lime-300 border-lime-500/30",
            price: sub.alpha_price ?? undefined,
            change24h: sub.price_change_24h ?? undefined,
            signalDate: TODAY_ISO,
            apy_7d: sub.apy_7d,
            apy_1h: sub.apy_1h,
            apy_30d: sub.apy_30d,
          });
        } else if (ratio <= YIELD_DIP_THRESHOLD) {
          // 1H yield well below 30d baseline — yield compression, large stake inflow
          const pctBelow = Math.round((1 - ratio) * 100);
          const strength = Math.min(75, 40 + (1 - ratio - 0.25) * 80);
          out.push({
            netuid: sub.netuid,
            name: sub.name,
            type: "yield_dip",
            strength: Math.round(Math.max(30, strength)),
            headline: `Staking yield compressed ${pctBelow}% below 30-day baseline`,
            detail: `1H APY ${apy1hPct}% vs 30d avg ${apy30dPct}% — yield compression often follows large stake inflows or increased competition among validators.`,
            badge: "📉 YIELD DIP",
            badgeColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
            price: sub.alpha_price ?? undefined,
            change24h: sub.price_change_24h ?? undefined,
            signalDate: TODAY_ISO,
            apy_7d: sub.apy_7d,
            apy_1h: sub.apy_1h,
            apy_30d: sub.apy_30d,
          });
        }
      }
    }

    // ── Flow signals from the signals feed ───────────────────────
    const flowTypes = ["flow_inflection", "flow_spike", "flow_warning", "whale_sell"];
    for (const sig of signals) {
      if (!flowTypes.includes(sig.signal_type)) continue;
      const alreadyType =
        sig.signal_type === "flow_warning" || sig.signal_type === "whale_sell"
          ? "distributing"
          : ["accumulating", "volume_surge"];
      const already = out.find(e => e.netuid === sig.netuid &&
        (Array.isArray(alreadyType) ? alreadyType.includes(e.type) : e.type === alreadyType));
      if (already) continue;

      const sub = leaderboard.find(s => s.netuid === sig.netuid);
      const name = sig.subnet_name || sub?.name || `SN${sig.netuid}`;

      if (sig.signal_type === "flow_inflection") {
        out.push({
          netuid: sig.netuid, name, type: "flow_inflection", strength: sig.strength,
          headline: sig.title, detail: sig.description,
          badge: "↑ FLOW FLIP", badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
          price: sub?.alpha_price ?? undefined, change24h: sub?.price_change_24h ?? undefined,
          signalDate: sig.signal_date || sig.created_at,
        });
      } else if (sig.signal_type === "flow_spike") {
        out.push({
          netuid: sig.netuid, name, type: "flow_spike", strength: sig.strength,
          headline: sig.title, detail: sig.description,
          badge: "⚡ FLOW SPIKE", badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
          price: sub?.alpha_price ?? undefined, change24h: sub?.price_change_24h ?? undefined,
          signalDate: sig.signal_date || sig.created_at,
        });
      } else if (sig.signal_type === "flow_warning") {
        out.push({
          netuid: sig.netuid, name, type: "flow_warning", strength: sig.strength,
          headline: sig.title, detail: sig.description,
          badge: "⚠️ FLOW WARN", badgeColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
          price: sub?.alpha_price ?? undefined, change24h: sub?.price_change_24h ?? undefined,
          signalDate: sig.signal_date || sig.created_at,
        });
      } else if (sig.signal_type === "whale_sell") {
        out.push({
          netuid: sig.netuid, name, type: "distributing", strength: sig.strength,
          headline: sig.title, detail: sig.description,
          badge: "🔻 WHALE SELL", badgeColor: "bg-red-500/20 text-red-400 border-red-500/30",
          price: sig.price_at_signal ?? sub?.alpha_price ?? undefined,
          change24h: sub?.price_change_24h ?? undefined,
          signalDate: sig.signal_date || sig.created_at,
        });
      }
    }

    // ── Apply filter ─────────────────────────────────────────────
    const filtered = filter === "all" ? out :
      filter === "accumulating"  ? out.filter(e => e.type === "accumulating" || e.type === "flow_inflection" || e.type === "flow_spike") :
      filter === "distributing"  ? out.filter(e => e.type === "distributing" || e.type === "flow_warning") :
      filter === "volume"        ? out.filter(e => e.type === "volume_surge") :
      filter === "yield"         ? out.filter(e => e.type === "yield_spike" || e.type === "yield_dip") :
      out.filter(e => e.type === "flow_inflection" || e.type === "flow_spike" || e.type === "flow_warning");

    return filtered.sort((a, b) => {
      if (sortBy === "strength") return b.strength - a.strength;
      if (sortBy === "flow") return Math.abs(b.netFlow ?? 0) - Math.abs(a.netFlow ?? 0);
      return (b.volumeRatio ?? 0) - (a.volumeRatio ?? 0);
    });
  }, [leaderboard, signals, taoPrice, filter, sortBy]);

  const visibleEvents = watchlistOnly ? events.filter(ev => watchlist.has(ev.netuid)) : events;

  const stats = useMemo(() => {
    const accumCount = leaderboard.filter(s => s.whale_signal === "accumulating").length;
    const distCount = leaderboard.filter(s => s.whale_signal === "distributing").length;
    const surgeCount = leaderboard.filter(s => s.volume_surge).length;
    const totalNetFlow = leaderboard.reduce((sum, s) => sum + (s.net_flow_24h ?? 0), 0);
    const totalUsd = taoPrice != null ? totalNetFlow * taoPrice : null;
    const yieldSpikeCount = leaderboard.filter(s =>
      s.apy_1h != null && s.apy_30d != null && s.apy_30d >= MIN_30D_APY &&
      s.apy_1h / s.apy_30d >= YIELD_SPIKE_THRESHOLD
    ).length;
    return { accumCount, distCount, surgeCount, totalUsd, totalNetFlow, yieldSpikeCount };
  }, [leaderboard, taoPrice]);

  const yieldEventCount = useMemo(() =>
    leaderboard.filter(s =>
      s.apy_1h != null && s.apy_30d != null && s.apy_30d >= MIN_30D_APY &&
      (s.apy_1h / s.apy_30d >= YIELD_SPIKE_THRESHOLD || s.apy_1h / s.apy_30d <= YIELD_DIP_THRESHOLD)
    ).length,
  [leaderboard]);

  const FILTERS: { key: FilterType; label: string; count?: number }[] = [
    { key: "all",          label: "All Signals",     count: events.length },
    { key: "accumulating", label: "🐋 Buying",       count: leaderboard.filter(s => s.whale_signal === "accumulating").length },
    { key: "distributing", label: "🔻 Selling",      count: leaderboard.filter(s => s.whale_signal === "distributing").length },
    { key: "volume",       label: "🤑 Vol Surge",    count: leaderboard.filter(s => s.volume_surge).length },
    { key: "flow",         label: "⚡ Flow Signals" },
    { key: "yield",        label: "📈 Yield",        count: yieldEventCount },
  ];

  return (
    <main className="flex-1 overflow-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-xl font-bold text-white">Flow &amp; Smart Money Tracker</h2>
          {scanning && (
            <span className="text-xs text-gray-500 animate-pulse">refreshing…</span>
          )}
        </div>
        <p className="text-sm text-gray-500">Real-time whale movements, smart money flows, unusual volume, and staking yield anomalies across all Bittensor subnets.</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4">
          <div className="text-2xl font-bold text-cyan-300">{stats.accumCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Subnets whales buying</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="text-2xl font-bold text-red-400">{stats.distCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Subnets whales selling</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <div className="text-2xl font-bold text-yellow-300">{stats.surgeCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Volume surges detected</div>
        </div>
        <div className={`border rounded-xl p-4 ${
          (stats.totalUsd ?? stats.totalNetFlow) >= 0
            ? "bg-green-500/10 border-green-500/20"
            : "bg-red-500/10 border-red-500/20"
        }`}>
          <div className={`text-2xl font-bold tabular-nums ${
            (stats.totalUsd ?? stats.totalNetFlow) >= 0 ? "text-green-400" : "text-red-400"
          }`}>
            {stats.totalUsd != null
              ? `${stats.totalUsd >= 0 ? "+" : ""}$${formatNum(Math.abs(Math.round(stats.totalUsd)))}`
              : `${stats.totalNetFlow >= 0 ? "+" : ""}${formatNum(Math.abs(stats.totalNetFlow), 1)} τ`}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Total 24h net flow</div>
        </div>
      </div>

      {/* Filter + sort bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filter === f.key
                  ? "bg-green-500/20 border-green-500/40 text-green-400"
                  : "bg-gray-800/60 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600"
              }`}
            >
              {f.label}{f.count != null ? ` · ${f.count}` : ""}
            </button>
          ))}
          <button
            onClick={() => setWatchlistOnly(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              watchlistOnly
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            My Watchlist
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">Sort:</span>
          {(["strength", "flow", "volume"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                sortBy === s
                  ? "bg-gray-700 border-gray-600 text-gray-200"
                  : "border-gray-800 text-gray-600 hover:text-gray-400"
              }`}
            >
              {s === "strength" ? "Signal strength" : s === "flow" ? "Net flow" : "Volume"}
            </button>
          ))}
        </div>
      </div>

      {/* Event feed */}
      {visibleEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-4xl mb-3">🌊</div>
          <p className="text-gray-500 text-sm">No flow activity detected right now.</p>
          <p className="text-gray-600 text-xs mt-1">Scanning.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <FlowCard
            key={`${visibleEvents[0].netuid}-${visibleEvents[0].type}-0`}
            event={visibleEvents[0]}
            taoPrice={taoPrice}
            watched={isWatched(visibleEvents[0].netuid)}
            onClick={() => router.push(`/subnets/${visibleEvents[0].netuid}`)}
          />
          {visibleEvents.length > 1 && (
            <BlurGate tier={tier} required="premium" minHeight="300px">
              <div className="flex flex-col gap-2">
                {visibleEvents.slice(1).map((ev, i) => (
                  <FlowCard
                    key={`${ev.netuid}-${ev.type}-${i + 1}`}
                    event={ev}
                    taoPrice={taoPrice}
                    watched={isWatched(ev.netuid)}
                    onClick={() => router.push(`/subnets/${ev.netuid}`)}
                  />
                ))}
              </div>
            </BlurGate>
          )}
        </div>
      )}
    </main>
  );
}

function FlowCard({
  event: ev,
  taoPrice,
  watched = false,
  onClick,
}: {
  event: FlowEvent;
  taoPrice: number | null;
  watched?: boolean;
  onClick: () => void;
}) {
  const isYield   = ev.type === "yield_spike" || ev.type === "yield_dip";
  const isPositive = ev.type === "accumulating" || ev.type === "volume_surge" || ev.type === "flow_inflection" || ev.type === "flow_spike" || ev.type === "yield_spike";
  const isNegative = ev.type === "distributing" || ev.type === "flow_warning" || ev.type === "yield_dip";

  const borderColor = isYield
    ? isPositive ? "border-lime-500/25" : "border-orange-500/20"
    : isPositive
    ? ev.type === "volume_surge" ? "border-yellow-500/25" : "border-cyan-500/25"
    : isNegative ? "border-red-500/20" : "border-purple-500/20";

  const accentColor = isYield
    ? isPositive ? "bg-lime-400/60" : "bg-orange-400/50"
    : isPositive
    ? ev.type === "volume_surge" ? "bg-yellow-400/60" : "bg-cyan-400/60"
    : isNegative ? "bg-red-400/50" : "bg-purple-400/50";

  return (
    <div
      onClick={onClick}
      className={`relative group cursor-pointer border ${borderColor} rounded-xl bg-gray-900/60 hover:bg-gray-900/90 transition-all px-4 py-3.5 overflow-hidden ${watched ? "ring-2 ring-blue-400/60 bg-blue-950/40 shadow-lg shadow-blue-500/30 border-blue-400/70" : ""}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl ${accentColor}`} />

      <div className="flex items-start gap-3 pl-2">
        <div className="flex-shrink-0 mt-0.5">
          <SubnetLogo netuid={ev.netuid} name={ev.name} size={32} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-gray-600">SN{ev.netuid}</span>
            <span className="font-bold text-white text-sm">{ev.name}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ev.badgeColor}`}>
              {ev.badge}
            </span>
            {ev.signalDate && (
              <span className="text-[10px] text-gray-600 ml-1">{formatFlowDate(ev.signalDate)}</span>
            )}
          </div>
          <p className="text-sm text-gray-200 font-medium leading-snug mb-1">{ev.headline}</p>
          <p className="text-xs text-gray-500 leading-relaxed">{ev.detail}</p>
        </div>

        <div className="flex-shrink-0 text-right flex flex-col items-end gap-1.5">
          {ev.price != null && (
            <span className="text-sm font-medium text-gray-300 tabular-nums">
              ${formatNum(ev.price, 2)}
            </span>
          )}
          {ev.change24h != null && (
            <span className={`text-xs font-medium tabular-nums ${
              ev.change24h > 0 ? "text-green-400" : ev.change24h < 0 ? "text-red-400" : "text-gray-500"
            }`}>
              {ev.change24h > 0 ? "+" : ""}{ev.change24h.toFixed(1)}%
            </span>
          )}
          <StrengthBar value={ev.strength} />
        </div>
      </div>

      {/* Extra metrics row */}
      {(ev.whaleRatio != null || ev.volumeRatio != null || ev.netFlow != null || ev.apy_7d != null) && (
        <div className="flex flex-wrap gap-3 mt-2.5 pl-11 text-xs text-gray-600">
          {ev.whaleRatio != null && (
            <span>
              <span className="text-gray-500">Avg tx size ratio </span>
              <span className={`font-semibold ${ev.whaleRatio >= 2 ? "text-cyan-400" : "text-red-400"}`}>
                {ev.whaleRatio}x
              </span>
            </span>
          )}
          {ev.volumeRatio != null && (
            <span>
              <span className="text-gray-500">Vol </span>
              <span className="font-semibold text-yellow-400">{ev.volumeRatio}x avg</span>
            </span>
          )}
          {ev.netFlow != null && taoPrice != null && (
            <span>
              <span className="text-gray-500">Net flow </span>
              <span className={`font-semibold tabular-nums ${ev.netFlow >= 0 ? "text-green-400" : "text-red-400"}`}>
                {ev.netFlow >= 0 ? "+" : ""}${formatNum(Math.abs(Math.round(ev.netFlow * taoPrice)))}
              </span>
            </span>
          )}
          {ev.apy_7d != null && (
            <span>
              <span className="text-gray-500">7d APY </span>
              <span className="font-semibold text-lime-400">{(ev.apy_7d * 100).toFixed(0)}%</span>
            </span>
          )}
          {ev.apy_1h != null && (
            <span>
              <span className="text-gray-500">1H APY </span>
              <span className={`font-semibold ${ev.type === "yield_spike" ? "text-lime-400" : "text-orange-400"}`}>
                {(ev.apy_1h * 100).toFixed(0)}%
              </span>
            </span>
          )}
          {ev.apy_30d != null && (
            <span>
              <span className="text-gray-500">30d avg </span>
              <span className="font-semibold text-gray-400">{(ev.apy_30d * 100).toFixed(0)}%</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
