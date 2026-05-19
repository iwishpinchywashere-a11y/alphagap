"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import SubnetDetailPanel from "@/components/dashboard/SubnetDetailPanel";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import { signalColor, signalIcon, timeAgo, formatMcap } from "@/lib/formatters";
import BlurGate from "@/components/BlurGate";
import { getTier, canAccessPro } from "@/lib/subscription";
import { useWatchlist } from "@/components/dashboard/WatchlistProvider";

export default function SignalsPage() {
  const { signals, leaderboard, scanning, setSelectedSubnet } = useDashboard();
  const router = useRouter();
  const { data: session } = useSession();
  const tier = getTier(session);
  const isPro = canAccessPro(tier);
  void setSelectedSubnet;
  const [signalSort, setSignalSort] = useState<"score" | "date">("date");
  const [searchQuery, setSearchQuery] = useState("");
  const { isWatched, watchlist } = useWatchlist();
  const [watchlistOnly, setWatchlistOnly] = useState(false);

  const q = searchQuery.toLowerCase().trim();

  const day = (sig: (typeof signals)[number]) =>
    (sig.signal_date || sig.created_at || "1970-01-01").slice(0, 10);

  const byScore = useMemo(() =>
    [...signals].sort((a, b) => {
      const sa = Number(a.strength) || 0;
      const sb = Number(b.strength) || 0;
      if (sb !== sa) return sb - sa;
      const da = day(a); const db = day(b);
      if (db > da) return 1;
      if (db < da) return -1;
      return a.netuid - b.netuid;
    }), [signals]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDate = useMemo(() =>
    [...signals].sort((a, b) => {
      const da = day(a); const db = day(b);
      if (db > da) return 1;
      if (db < da) return -1;
      const sa = Number(a.strength) || 0;
      const sb = Number(b.strength) || 0;
      if (sb !== sa) return sb - sa;
      return a.netuid - b.netuid;
    }), [signals]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flow/whale signals belong on /whales — exclude them here
  const WHALES_PAGE_TYPES = new Set(["flow_inflection", "flow_spike", "flow_warning", "whale_buy", "whale_sell"]);

  const base = signalSort === "score" ? byScore : byDate;
  const sorted = base.filter(
    (sig) => !WHALES_PAGE_TYPES.has(sig.signal_type) &&
      (!q || (sig.subnet_name || "").toLowerCase().includes(q) || sig.title.toLowerCase().includes(q) || `sn${sig.netuid}`.includes(q)) &&
      (!watchlistOnly || watchlist.has(sig.netuid))
  );

  return (
    <main className="flex-1 flex overflow-x-hidden">
      <div className="flex-1 overflow-auto max-w-full">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className="relative border-b border-gray-800/50 overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="absolute top-0 left-1/2 w-96 h-40 bg-green-600/8 rounded-full blur-3xl pointer-events-none" />

          <div className="relative px-4 md:px-6 py-8">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 via-emerald-300 to-white bg-clip-text text-transparent leading-tight mb-1">
                  ⚡ Development Intelligence Feed
                </h1>
                <p className="text-sm text-gray-400 max-w-xl">
                  AI-scored developer activity across every active subnet — commits, model releases, and protocol upgrades ranked by signal strength.
                </p>
              </div>
              {scanning && signals.length > 0 && (
                <div className="flex items-center gap-2 mt-1 flex-shrink-0">
                  <div className="w-4 h-4 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
                  <span className="text-xs text-gray-500">refreshing</span>
                </div>
              )}
            </div>

            {/* Stat chips */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/40 rounded-full px-3 py-1.5">
                <span className="text-sm font-bold text-green-400 tabular-nums">{signals.length}</span>
                <span className="text-xs text-gray-400">signals</span>
              </div>
              {signals.filter(s => s.strength >= 80).length > 0 && (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/25 rounded-full px-3 py-1.5">
                  <span className="text-sm font-bold text-green-300 tabular-nums">
                    {signals.filter(s => s.strength >= 80).length}
                  </span>
                  <span className="text-xs text-gray-400">high strength (80+)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Top 5 Most Active Subnets ─────────────────────────── */}
        {signals.length > 0 && (
          <TopDeveloperSubnets signals={signals} leaderboard={leaderboard} onNavigate={(netuid) => router.push(`/subnets/${netuid}`)} />
        )}

        <div className="p-4 md:p-6">
          {scanning && signals.length === 0 && (
            <div className="flex flex-col items-center justify-center h-72 text-center">
              <div className="w-10 h-10 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin mb-5" />
              <h2 className="text-xl font-bold mb-2">Loading Signals…</h2>
              <p className="text-gray-500 max-w-md mb-4 text-sm">Scanning the ecosystem for signals…</p>
              <div className="w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-400 rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </div>
          )}

          {!scanning && signals.length === 0 && (
            <div className="flex flex-col items-center justify-center h-72 text-center">
              <div className="text-6xl mb-4">📡</div>
              <h2 className="text-xl font-bold mb-2">No Signals Yet</h2>
              <p className="text-gray-500 max-w-md text-sm">Scanning for signals.</p>
            </div>
          )}

          {signals.length > 0 && (
            <div className="space-y-4">
              {/* Search + sort bar */}
              <div className="space-y-2.5">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search signals..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-800/60 border border-gray-700/60 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-green-600/60 focus:ring-1 focus:ring-green-600/20"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => isPro && setSignalSort("date")}
                    title={!isPro ? "Upgrade to Pro to sort" : undefined}
                    className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors whitespace-nowrap border ${
                      signalSort === "date" && isPro
                        ? "bg-green-500/20 border-green-500/40 text-green-400"
                        : "bg-gray-800/60 border-gray-700/40 text-gray-400"
                    } ${isPro ? "hover:border-gray-600 cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                  >
                    🕐 Latest
                  </button>
                  <button
                    onClick={() => isPro && setSignalSort("score")}
                    title={!isPro ? "Upgrade to Pro to sort" : undefined}
                    className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors whitespace-nowrap border ${
                      signalSort === "score" && isPro
                        ? "bg-green-500/20 border-green-500/40 text-green-400"
                        : "bg-gray-800/60 border-gray-700/40 text-gray-400"
                    } ${isPro ? "hover:border-gray-600 cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                  >
                    🏆 Top Score
                  </button>
                  <button
                    onClick={() => setWatchlistOnly(v => !v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap border ${
                      watchlistOnly
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-gray-800/60 border-gray-700/40 text-gray-400 hover:text-white"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    My Watchlist
                  </button>
                </div>
              </div>

              {sorted.map((sig, sigIndex) => {
                const isLocked = !isPro && sigIndex >= 3;
                const lb = leaderboard.find((s) => s.netuid === sig.netuid);
                const mcapStr = formatMcap(lb?.market_cap);
                const agap = lb?.composite_score;

                return (
                  <React.Fragment key={`${sig.netuid}-${sig.signal_type}-${(sig.signal_date || sig.created_at || "").slice(0, 10)}`}>
                  <div
                    className={`relative bg-gray-900/50 border rounded-xl overflow-hidden transition-colors ${
                      isLocked ? "blur-sm opacity-40 pointer-events-none select-none" : "cursor-pointer hover:border-gray-600"
                    } ${
                      isWatched(sig.netuid) ? "ring-2 ring-blue-400/60 bg-blue-950/20 shadow-lg shadow-blue-500/20 border-blue-400/70" :
                      sig.strength >= 80 ? "border-green-800/60 signal-hot" :
                      sig.strength >= 50 ? "border-yellow-900/40" : "border-gray-800/60"
                    }`}
                    onClick={() => !isLocked && router.push(`/subnets/${sig.netuid}`)}
                  >
                    {/* Header */}
                    <div className={`px-4 py-2.5 flex items-center justify-between ${
                      sig.strength >= 80 ? "bg-gradient-to-r from-green-950/30 via-emerald-950/10 to-transparent" :
                      sig.strength >= 50 ? "bg-yellow-950/20" : "bg-gray-800/30"
                    }`}>
                      {sig.strength >= 80 && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500 to-emerald-600 rounded-l-xl" />
                      )}
                      <div className="flex items-center gap-2.5 pl-1">
                        <span className={`text-xl ${signalColor(sig.signal_type)}`}>{signalIcon(sig.signal_type)}</span>
                        <span className="text-xs font-medium text-gray-400 bg-gray-800 rounded px-2 py-0.5">SN{sig.netuid}</span>
                        <span className="font-semibold text-sm">{sig.subnet_name || `Subnet ${sig.netuid}`}</span>
                        <span className="text-xs text-gray-600 hidden sm:inline">via {sig.source}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-white">
                          {sig.signal_date
                            ? new Date(sig.signal_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : sig.created_at ? timeAgo(sig.created_at) : ""}
                        </span>
                        <div className={`text-lg font-bold tabular-nums ${
                          sig.strength >= 80 ? "text-green-400" :
                          sig.strength >= 50 ? "text-yellow-400" : "text-gray-500"
                        }`}>{sig.strength}</div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="px-4 py-3">
                      <h3 className="font-bold text-[15px] leading-snug mb-2 text-white">{sig.title}</h3>

                      {lb && (
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          {mcapStr && (
                            <span className="text-xs text-gray-400 bg-gray-800/80 rounded-full px-2.5 py-0.5">
                              MCap: <span className="text-white font-medium">{mcapStr}</span>
                            </span>
                          )}
                          {agap != null && (
                            <span className="text-xs text-gray-400 bg-gray-800/80 rounded-full px-2.5 py-0.5">
                              aGap: <span className={`font-medium ${agap >= 80 ? "text-green-400" : agap >= 50 ? "text-yellow-400" : "text-gray-300"}`}>{agap}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {(sig.analysis || sig.description) ? (
                        <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4 mb-2 space-y-1">
                          {(sig.analysis || sig.description || "").split("\n").filter((l) => l.trim()).map((line, i) => {
                            const trimmed = line.trim();
                            if (trimmed === "---" || trimmed === "***") return null;
                            if (trimmed.startsWith("# AlphaGap")) return null;
                            if (trimmed.startsWith("**Date:**") || trimmed.startsWith("**Signal Strength:**")) return null;
                            if (trimmed.match(/^(#{1,3}\s+)?[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u) ||
                                trimmed.match(/^(#{1,3}\s+)?\*\*[🔧📡💡🎯🚀⚠️]/)) {
                              const headerText = trimmed.replace(/^#{1,3}\s+/, "").replace(/\*\*/g, "");
                              return <p key={i} className="text-sm font-bold text-green-400 mt-3 first:mt-0 pb-0.5">{headerText}</p>;
                            }
                            const renderBold = (text: string) => {
                              const parts = text.split(/\*\*(.*?)\*\*/g);
                              return parts.map((part, j) =>
                                j % 2 === 1
                                  ? <strong key={j} className="text-white font-semibold">{part}</strong>
                                  : <span key={j}>{part}</span>
                              );
                            };
                            return <p key={i} className="text-sm text-gray-300 leading-relaxed">{renderBold(trimmed)}</p>;
                          })}
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${sig.strength >= 80 ? "bg-green-400" : sig.strength >= 50 ? "bg-yellow-400" : "bg-gray-600"}`}
                              style={{ width: `${sig.strength}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">{sig.signal_type.replace(/_/g, " ")}</span>
                        </div>
                        {sig.source_url && (
                          <a href={sig.source_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}>
                            View source
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CTA injected right after the 3rd visible signal */}
                  {!isPro && sigIndex === 2 && sorted.length > 3 && (
                    <div className="flex flex-col items-center gap-2 py-6 border border-gray-800/60 rounded-xl bg-gray-900/30">
                      <p className="text-sm text-gray-500">🔒 {sorted.length - 3} more signals locked</p>
                      <a href="/pricing" className="px-7 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl text-base hover:from-green-400 hover:to-emerald-500 transition-all shadow-xl shadow-green-500/25">
                        Get Access →
                      </a>
                    </div>
                  )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SubnetDetailPanel />
    </main>
  );
}

// ── Top Developer Subnets ─────────────────────────────────────────

const WHALES_TYPES = new Set(["flow_inflection", "flow_spike", "flow_warning", "whale_buy", "whale_sell"]);

function TopDeveloperSubnets({
  signals,
  leaderboard,
  onNavigate,
}: {
  signals: ReturnType<typeof useDashboard>["signals"];
  leaderboard: ReturnType<typeof useDashboard>["leaderboard"];
  onNavigate: (netuid: number) => void;
}) {
  // Only dev-related signals (exclude flow/whale types)
  const devSignals = signals.filter(s => !WHALES_TYPES.has(s.signal_type));

  // Group by subnet: track best strength, signal count, latest signal date, best signal type
  const bySubnet = new Map<number, {
    netuid: number;
    name: string;
    bestStrength: number;
    bestType: string;
    count: number;
    latestDate: string;
  }>();

  for (const sig of devSignals) {
    const existing = bySubnet.get(sig.netuid);
    const sigDate = sig.signal_date || sig.created_at || "";
    if (!existing) {
      bySubnet.set(sig.netuid, {
        netuid: sig.netuid,
        name: sig.subnet_name || `SN${sig.netuid}`,
        bestStrength: sig.strength,
        bestType: sig.signal_type,
        count: 1,
        latestDate: sigDate,
      });
    } else {
      existing.count++;
      if (sig.strength > existing.bestStrength) {
        existing.bestStrength = sig.strength;
        existing.bestType = sig.signal_type;
      }
      if (sigDate > existing.latestDate) existing.latestDate = sigDate;
    }
  }

  // Score = best strength * 0.7 + recency bonus (within 3 days = +20, within 7 days = +10) + count bonus (capped at +10)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const ranked = [...bySubnet.values()]
    .map(entry => {
      const recency = entry.latestDate >= threeDaysAgo ? 20 : entry.latestDate >= sevenDaysAgo ? 10 : 0;
      const countBonus = Math.min(10, (entry.count - 1) * 2);
      const score = entry.bestStrength * 0.7 + recency + countBonus;
      return { ...entry, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (ranked.length === 0) return null;

  const rankColors = [
    "text-yellow-400",  // #1
    "text-gray-300",    // #2
    "text-orange-400",  // #3
    "text-gray-500",    // #4
    "text-gray-600",    // #5
  ];

  const strengthColor = (s: number) =>
    s >= 80 ? "bg-green-400" : s >= 60 ? "bg-emerald-500" : s >= 40 ? "bg-yellow-400" : "bg-gray-600";

  function timeAgoShort(iso: string): string {
    if (!iso) return "";
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffH = diffMs / 3_600_000;
    const diffD = diffMs / 86_400_000;
    if (diffH < 1) return "just now";
    if (diffH < 24) return `${Math.floor(diffH)}h ago`;
    if (diffD < 2) return "yesterday";
    if (diffD < 7) return `${Math.floor(diffD)}d ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="border-b border-gray-800/50 px-4 md:px-6 py-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full" />
        <span className="text-xs font-bold uppercase tracking-widest text-green-500/80">Most Active This Week</span>
        <span className="text-[10px] text-gray-600">ranked by signal strength + recency</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
        {ranked.map((entry, i) => {
          const lb = leaderboard.find(s => s.netuid === entry.netuid);
          return (
            <button
              key={entry.netuid}
              onClick={() => onNavigate(entry.netuid)}
              className="flex sm:flex-col items-center sm:items-start gap-2.5 sm:gap-2 px-3 py-2.5 rounded-xl bg-gray-900/60 border border-gray-700/50 hover:border-green-500/30 hover:bg-gray-800/60 transition-all text-left group"
            >
              {/* Rank + logo row */}
              <div className="flex items-center gap-2 w-full">
                <span className={`text-xs font-black tabular-nums flex-shrink-0 ${rankColors[i]}`}>#{i + 1}</span>
                <SubnetLogo netuid={entry.netuid} name={entry.name} size={24} />
                <span className="font-semibold text-white text-xs truncate min-w-0 flex-1 group-hover:text-green-300 transition-colors">{entry.name}</span>
                <span className="text-[10px] text-gray-600 font-mono flex-shrink-0 sm:hidden">SN{entry.netuid}</span>
              </div>

              {/* Signal bar + count */}
              <div className="flex sm:flex-col items-center sm:items-start gap-2 sm:gap-1 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <div className="flex-1 sm:w-full h-1 bg-gray-800 rounded-full overflow-hidden" style={{ minWidth: 40 }}>
                    <div
                      className={`h-full rounded-full ${strengthColor(entry.bestStrength)}`}
                      style={{ width: `${entry.bestStrength}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${entry.bestStrength >= 80 ? "text-green-400" : entry.bestStrength >= 60 ? "text-emerald-400" : "text-yellow-400"}`}>
                    {entry.bestStrength}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 sm:flex-shrink">
                  <span className="text-[10px] text-gray-500">
                    {entry.count} signal{entry.count !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[10px] text-gray-600">·</span>
                  <span className="text-[10px] text-gray-500">{timeAgoShort(entry.latestDate)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
