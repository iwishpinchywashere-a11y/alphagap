"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import SubnetDetailPanel from "@/components/dashboard/SubnetDetailPanel";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import { timeAgo, formatMcap } from "@/lib/formatters";
import BlurGate from "@/components/BlurGate";
import AgIcon from "@/components/AgIcon";
import { getTier, canAccessPro } from "@/lib/subscription";
import { useWatchlist } from "@/components/dashboard/WatchlistProvider";

// Map signal types onto Obsidian Glass badge variants
function badgeVariant(type: string): string {
  if (type === "whale_sell" || type === "flow_warning" || /warn|sell/.test(type)) return "ag-badge-warn";
  if (type === "whale_buy" || type === "flow_inflection" || type === "flow_spike") return "ag-badge-buy";
  if (/dev|discord|social|commit|github|release/.test(type)) return "ag-badge-dev";
  return "ag-badge-info";
}

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
  // Feed pagination — hundreds of signals rendered at once produced a 73k-px
  // page (unusable on mobile). Show a page at a time.
  const FEED_PAGE = 30;
  const [visibleLimit, setVisibleLimit] = useState(FEED_PAGE);
  useEffect(() => { setVisibleLimit(FEED_PAGE); }, [signalSort, searchQuery, watchlistOnly]);

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
    <main className="flex-1 flex overflow-x-hidden ag-aurora">
      <div className="flex-1 overflow-auto max-w-full">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className="relative px-4 md:px-6 pt-9 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl md:text-[40px] font-semibold tracking-[-0.03em] text-white leading-tight mb-2">
                Live <span className="ag-gradient-text">Signals</span>
              </h1>
              <p className="text-sm md:text-[14.5px] text-gray-400 max-w-xl leading-[1.65] mb-4">
                AI-scored developer activity across every active subnet — commits, model releases, and protocol upgrades ranked by signal strength.
              </p>
              <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-wider text-gray-500 uppercase">
                <span className="ag-live-dot" />
                <span className="tabular-nums">
                  {signals.length} SIGNALS
                  {signals.filter(s => s.strength >= 80).length > 0 &&
                    ` · ${signals.filter(s => s.strength >= 80).length} HIGH STRENGTH (80+)`}
                </span>
              </div>
            </div>
            {scanning && signals.length > 0 && (
              <div className="flex items-center gap-2 mt-1 flex-shrink-0">
                <div className="w-4 h-4 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
                <span className="text-xs text-gray-500">refreshing</span>
              </div>
            )}
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
              <h2 className="font-display text-xl font-semibold mb-2">Loading Signals…</h2>
              <p className="text-gray-500 max-w-md mb-4 text-sm">Scanning the ecosystem for signals…</p>
              <div className="w-64 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full bg-green-400 rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </div>
          )}

          {!scanning && signals.length === 0 && (
            <div className="flex flex-col items-center justify-center h-72 text-center">
              <AgIcon name="radar" className="w-14 h-14 text-emerald-400/60 mb-4" />
              <h2 className="font-display text-xl font-semibold mb-2">No Signals Yet</h2>
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
                    className="w-full bg-white/[0.035] border border-white/[0.08] rounded-full pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 backdrop-blur-[14px] focus:outline-none focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/20"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="ag-pill-tabs">
                    <button
                      onClick={() => isPro && setSignalSort("date")}
                      title={!isPro ? "Upgrade to Pro to sort" : undefined}
                      className={`ag-pill-tab ${
                        signalSort === "date" && isPro ? "ag-pill-tab-on" : ""
                      } ${isPro ? "" : "opacity-50 cursor-not-allowed"}`}
                    >
                      Latest
                    </button>
                    <button
                      onClick={() => isPro && setSignalSort("score")}
                      title={!isPro ? "Upgrade to Pro to sort" : undefined}
                      className={`ag-pill-tab ${
                        signalSort === "score" && isPro ? "ag-pill-tab-on" : ""
                      } ${isPro ? "" : "opacity-50 cursor-not-allowed"}`}
                    >
                      Top Score
                    </button>
                    <button
                      onClick={() => setWatchlistOnly(v => !v)}
                      className={`ag-pill-tab inline-flex items-center gap-1.5 ${watchlistOnly ? "ag-pill-tab-on" : ""}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      My Watchlist
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {(isPro ? sorted.slice(0, visibleLimit) : sorted.slice(0, 12)).map((sig, sigIndex) => {
                const isLocked = !isPro && sigIndex >= 3;
                const lb = leaderboard.find((s) => s.netuid === sig.netuid);
                const mcapStr = formatMcap(lb?.market_cap);
                const agap = lb?.composite_score;
                const isWarn = badgeVariant(sig.signal_type) === "ag-badge-warn";

                return (
                  <React.Fragment key={`${sig.netuid}-${sig.signal_type}-${(sig.signal_date || sig.created_at || "").slice(0, 10)}`}>
                  <div
                    className={`relative ag-glass overflow-hidden p-5 md:p-6 ${
                      isLocked ? "blur-sm opacity-40 pointer-events-none select-none" : "ag-glass-hover cursor-pointer"
                    } ${
                      isWatched(sig.netuid) ? "ring-2 ring-blue-400/60 shadow-lg shadow-blue-500/20" : ""
                    }`}
                    onClick={() => !isLocked && router.push(`/subnets/${sig.netuid}`)}
                  >
                    {/* Header row: badge + time */}
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className={`ag-badge ${badgeVariant(sig.signal_type)}`}>
                        {sig.signal_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-[11px] text-gray-600 hidden sm:inline">via {sig.source}</span>
                      <span className="ml-auto font-mono text-[10.5px] text-gray-500 tabular-nums flex-shrink-0">
                        {sig.signal_date
                          ? new Date(sig.signal_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : sig.created_at ? timeAgo(sig.created_at) : ""}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-display text-[17px] font-semibold text-white leading-snug mb-1">
                      {sig.subnet_name || `Subnet ${sig.netuid}`} · SN{sig.netuid}
                    </h3>
                    <p className="text-[13.5px] text-gray-300 font-medium leading-relaxed mb-2">{sig.title}</p>

                    {lb && (
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {mcapStr && (
                          <span className="font-mono text-[10.5px] text-gray-500 bg-white/[0.04] border border-white/[0.08] rounded-full px-2.5 py-1">
                            MCAP <b className="text-white font-semibold">{mcapStr}</b>
                          </span>
                        )}
                        {agap != null && (
                          <span className="font-mono text-[10.5px] text-gray-500 bg-white/[0.04] border border-white/[0.08] rounded-full px-2.5 py-1">
                            AGAP <b className={`font-semibold ${agap >= 80 ? "text-emerald-400" : agap >= 50 ? "text-yellow-400" : "text-white"}`}>{agap}</b>
                          </span>
                        )}
                      </div>
                    )}

                    {(sig.analysis || sig.description) ? (
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-2 space-y-1">
                        {(sig.analysis || sig.description || "").split("\n").filter((l) => l.trim()).map((line, i) => {
                          const trimmed = line.trim();
                          if (trimmed === "---" || trimmed === "***") return null;
                          if (trimmed.startsWith("# AlphaGap")) return null;
                          if (trimmed.startsWith("**Date:**") || trimmed.startsWith("**Signal Strength:**")) return null;
                          if (trimmed.match(/^(#{1,3}\s+)?[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u) ||
                              trimmed.match(/^(#{1,3}\s+)?\*\*[\u{1F527}\u{1F4E1}\u{1F4A1}\u{1F3AF}\u{1F680}\u{26A0}]/u)) {
                            const headerText = trimmed
                              .replace(/^#{1,3}\s+/, "")
                              .replace(/\*\*/g, "")
                              .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
                              .trim();
                            return <p key={i} className="font-display text-sm font-semibold text-emerald-400 mt-3 first:mt-0 pb-0.5">{headerText}</p>;
                          }
                          const renderBold = (text: string) => {
                            const parts = text.split(/\*\*(.*?)\*\*/g);
                            return parts.map((part, j) =>
                              j % 2 === 1
                                ? <b key={j} className="text-white font-semibold">{part}</b>
                                : <span key={j}>{part}</span>
                            );
                          };
                          return <p key={i} className="text-[13.5px] text-gray-400 leading-[1.65]">{renderBold(trimmed)}</p>;
                        })}
                      </div>
                    ) : null}

                    {/* Strength meter */}
                    <div className="flex items-center gap-3 mt-4">
                      <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${sig.strength}%`,
                            background: isWarn
                              ? "linear-gradient(90deg,#f87171,#fca5a5)"
                              : "linear-gradient(90deg,#34d399,#4ade80)",
                          }}
                        />
                      </div>
                      <span className="font-mono text-[10.5px] text-gray-500 tabular-nums flex-shrink-0">STRENGTH {sig.strength}</span>
                      {sig.source_url && (
                        <a href={sig.source_url} target="_blank" rel="noopener noreferrer"
                          className="font-mono text-[10.5px] text-emerald-400 hover:underline flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}>
                          View source
                        </a>
                      )}
                    </div>
                  </div>

                  {/* CTA injected right after the 3rd visible signal */}
                  {!isPro && sigIndex === 2 && sorted.length > 3 && (
                    <div className="flex flex-col items-center gap-3 py-8 ag-glass lg:col-span-2">
                      <p className="text-sm text-gray-500 flex items-center gap-1.5"><AgIcon name="lock" className="w-3.5 h-3.5" /> {sorted.length - 3} more signals locked</p>
                      <a href="/pricing" className="px-7 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-full text-base hover:from-green-400 hover:to-emerald-500 transition-all shadow-xl shadow-green-500/25">
                        Get Access →
                      </a>
                    </div>
                  )}
                  </React.Fragment>
                );
              })}
              {isPro && sorted.length > visibleLimit && (
                <button
                  onClick={() => setVisibleLimit(v => v + FEED_PAGE)}
                  className="ag-glass ag-glass-hover py-3.5 text-sm text-emerald-400 font-semibold lg:col-span-2"
                >
                  Load more · {sorted.length - visibleLimit} older signals
                </button>
              )}
              </div>
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
    <div className="px-4 md:px-6 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="ag-live-dot" />
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-400/80">Most Active This Week</span>
        <span className="font-mono text-[10px] text-gray-600 uppercase tracking-wider">ranked by signal strength + recency</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
        {ranked.map((entry, i) => {
          const lb = leaderboard.find(s => s.netuid === entry.netuid);
          return (
            <button
              key={entry.netuid}
              onClick={() => onNavigate(entry.netuid)}
              className="ag-glass ag-glass-hover flex sm:flex-col items-center sm:items-start gap-2.5 sm:gap-2 px-3.5 py-3 !rounded-2xl text-left group"
            >
              {/* Rank + logo row */}
              <div className="flex items-center gap-2 w-full">
                <span className={`font-display text-xs font-bold tabular-nums flex-shrink-0 ${rankColors[i]}`}>#{i + 1}</span>
                <SubnetLogo netuid={entry.netuid} name={entry.name} size={24} />
                <span className="font-semibold text-white text-xs truncate min-w-0 flex-1 group-hover:text-green-300 transition-colors">{entry.name}</span>
                <span className="text-[10px] text-gray-600 font-mono flex-shrink-0 sm:hidden">SN{entry.netuid}</span>
              </div>

              {/* Signal bar + count */}
              <div className="flex sm:flex-col items-center sm:items-start gap-2 sm:gap-1 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <div className="flex-1 sm:w-full h-1 bg-white/[0.06] rounded-full overflow-hidden" style={{ minWidth: 40 }}>
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
