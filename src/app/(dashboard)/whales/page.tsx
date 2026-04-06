"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import { formatNum } from "@/lib/formatters";
import type { SubnetScore } from "@/lib/types";

type FilterType = "all" | "accumulating" | "distributing" | "volume" | "flow";

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

interface WhaleEvent {
  netuid: number;
  name: string;
  type: "accumulating" | "distributing" | "volume_surge" | "flow_spike" | "flow_inflection" | "flow_warning";
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
}

export default function WhalesPage() {
  const { leaderboard, signals, taoPrice, scanning } = useDashboard();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<"strength" | "flow" | "volume">("strength");

  const events = useMemo<WhaleEvent[]>(() => {
    const out: WhaleEvent[] = [];

    for (const sub of leaderboard) {
      // Whale accumulation
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
        });
      }

      // Whale distribution
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
        });
      }

      // Volume surge
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
        });
      }
    }

    // Flow signals from the signals feed
    const flowTypes = ["flow_inflection", "flow_spike", "flow_warning"];
    for (const sig of signals) {
      if (!flowTypes.includes(sig.signal_type)) continue;
      // Skip if already represented by whale/volume event
      const already = out.find(e => e.netuid === sig.netuid &&
        (sig.signal_type === "flow_warning" ? e.type === "distributing" : e.type === "accumulating" || e.type === "volume_surge"));
      if (already) continue;

      const sub = leaderboard.find(s => s.netuid === sig.netuid);
      const name = sig.subnet_name || sub?.name || `SN${sig.netuid}`;

      if (sig.signal_type === "flow_inflection") {
        out.push({
          netuid: sig.netuid,
          name,
          type: "flow_inflection",
          strength: sig.strength,
          headline: sig.title,
          detail: sig.description,
          badge: "↑ FLOW FLIP",
          badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
          price: sub?.alpha_price ?? undefined,
          change24h: sub?.price_change_24h ?? undefined,
        });
      } else if (sig.signal_type === "flow_spike") {
        out.push({
          netuid: sig.netuid,
          name,
          type: "flow_spike",
          strength: sig.strength,
          headline: sig.title,
          detail: sig.description,
          badge: "⚡ FLOW SPIKE",
          badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
          price: sub?.alpha_price ?? undefined,
          change24h: sub?.price_change_24h ?? undefined,
        });
      } else if (sig.signal_type === "flow_warning") {
        out.push({
          netuid: sig.netuid,
          name,
          type: "flow_warning",
          strength: sig.strength,
          headline: sig.title,
          detail: sig.description,
          badge: "⚠️ FLOW WARN",
          badgeColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
          price: sub?.alpha_price ?? undefined,
          change24h: sub?.price_change_24h ?? undefined,
        });
      }
    }

    // Filter
    const filtered = filter === "all" ? out :
      filter === "accumulating" ? out.filter(e => e.type === "accumulating" || e.type === "flow_inflection" || e.type === "flow_spike") :
      filter === "distributing" ? out.filter(e => e.type === "distributing" || e.type === "flow_warning") :
      filter === "volume" ? out.filter(e => e.type === "volume_surge") :
      out.filter(e => e.type === "flow_inflection" || e.type === "flow_spike" || e.type === "flow_warning");

    // Sort
    return filtered.sort((a, b) => {
      if (sortBy === "strength") return b.strength - a.strength;
      if (sortBy === "flow") return Math.abs(b.netFlow ?? 0) - Math.abs(a.netFlow ?? 0);
      return (b.volumeRatio ?? 0) - (a.volumeRatio ?? 0);
    });
  }, [leaderboard, signals, taoPrice, filter, sortBy]);

  // Summary stats
  const stats = useMemo(() => {
    const accumCount = leaderboard.filter(s => s.whale_signal === "accumulating").length;
    const distCount = leaderboard.filter(s => s.whale_signal === "distributing").length;
    const surgeCount = leaderboard.filter(s => s.volume_surge).length;
    const totalNetFlow = leaderboard.reduce((sum, s) => sum + (s.net_flow_24h ?? 0), 0);
    const totalUsd = taoPrice != null ? totalNetFlow * taoPrice : null;
    return { accumCount, distCount, surgeCount, totalUsd, totalNetFlow };
  }, [leaderboard, taoPrice]);

  const FILTERS: { key: FilterType; label: string; count?: number }[] = [
    { key: "all", label: "All Signals", count: events.length },
    { key: "accumulating", label: "🐋 Buying", count: leaderboard.filter(s => s.whale_signal === "accumulating").length },
    { key: "distributing", label: "🔻 Selling", count: leaderboard.filter(s => s.whale_signal === "distributing").length },
    { key: "volume", label: "🤑 Volume Surge", count: leaderboard.filter(s => s.volume_surge).length },
    { key: "flow", label: "⚡ Flow Signals" },
  ];

  return (
    <main className="flex-1 overflow-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-xl font-bold text-white">Whale &amp; Smart Money Tracker</h2>
          {scanning && (
            <span className="text-xs text-gray-500 animate-pulse">refreshing…</span>
          )}
        </div>
        <p className="text-sm text-gray-500">Real-time whale wallet movements, smart money flows, and unusual volume across all Bittensor subnets.</p>
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
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-4xl mb-3">🌊</div>
          <p className="text-gray-500 text-sm">No whale activity detected right now.</p>
          <p className="text-gray-600 text-xs mt-1">Data refreshes every 10 minutes.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map((ev, i) => (
            <WhaleCard
              key={`${ev.netuid}-${ev.type}-${i}`}
              event={ev}
              taoPrice={taoPrice}
              onClick={() => router.push(`/subnets/${ev.netuid}`)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function WhaleCard({
  event: ev,
  taoPrice,
  onClick,
}: {
  event: WhaleEvent;
  taoPrice: number | null;
  onClick: () => void;
}) {
  const isPositive = ev.type === "accumulating" || ev.type === "volume_surge" || ev.type === "flow_inflection" || ev.type === "flow_spike";
  const isNegative = ev.type === "distributing" || ev.type === "flow_warning";

  const borderColor = isPositive
    ? ev.type === "volume_surge" ? "border-yellow-500/25" : "border-cyan-500/25"
    : isNegative ? "border-red-500/20" : "border-purple-500/20";

  const glowColor = isPositive
    ? ev.type === "volume_surge" ? "before:bg-yellow-500/5" : "before:bg-cyan-500/5"
    : isNegative ? "before:bg-red-500/5" : "before:bg-purple-500/5";

  return (
    <div
      onClick={onClick}
      className={`relative group cursor-pointer border ${borderColor} rounded-xl bg-gray-900/60 hover:bg-gray-900/90 transition-all px-4 py-3.5 overflow-hidden`}
    >
      {/* Subtle left accent */}
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl ${
        isPositive
          ? ev.type === "volume_surge" ? "bg-yellow-400/60" : "bg-cyan-400/60"
          : isNegative ? "bg-red-400/50" : "bg-purple-400/50"
      }`} />

      <div className="flex items-start gap-3 pl-2">
        {/* Logo */}
        <div className="flex-shrink-0 mt-0.5">
          <SubnetLogo netuid={ev.netuid} name={ev.name} size={32} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-gray-600">SN{ev.netuid}</span>
            <span className="font-bold text-white text-sm">{ev.name}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ev.badgeColor}`}>
              {ev.badge}
            </span>
          </div>
          <p className="text-sm text-gray-200 font-medium leading-snug mb-1">{ev.headline}</p>
          <p className="text-xs text-gray-500 leading-relaxed">{ev.detail}</p>
        </div>

        {/* Right side: price + strength */}
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

      {/* Extra metrics row for big signals */}
      {(ev.whaleRatio != null || ev.volumeRatio != null || ev.netFlow != null) && (
        <div className="flex flex-wrap gap-3 mt-2.5 pl-11 text-xs text-gray-600">
          {ev.whaleRatio != null && (
            <span>
              <span className="text-gray-500">Ratio </span>
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
        </div>
      )}
    </div>
  );
}
