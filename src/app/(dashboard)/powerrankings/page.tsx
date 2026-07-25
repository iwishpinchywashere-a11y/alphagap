"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import AgIcon from "@/components/AgIcon";
import { getSubnetDescription } from "@/lib/subnet-plain-english";
import { getTier, canAccessPro, canAccessPremium } from "@/lib/subscription";
import { useWatchlist } from "@/components/dashboard/WatchlistProvider";

// ── Types ─────────────────────────────────────────────────────────

interface SubnetEntry {
  netuid: number;
  name: string;
  composite_score: number;
  invest_agap?: number;
  category?: string;
  price_change_24h?: number;
  price_change_7d?: number;
  market_cap?: number;
  dev_score?: number;
  flow_score?: number;
  score_delta_24h?: number;
}

// ── Helpers ───────────────────────────────────────────────────────

function scoreTier(score: number): { label: string; color: string; bg: string; border: string; ring: string } {
  if (score >= 80) return { label: "Elite", color: "text-emerald-300", bg: "bg-emerald-500/15", border: "border-emerald-500/40", ring: "ring-emerald-500/30" };
  if (score >= 65) return { label: "Strong", color: "text-green-300", bg: "bg-green-500/15", border: "border-green-500/40", ring: "ring-green-500/20" };
  if (score >= 50) return { label: "Solid", color: "text-yellow-300", bg: "bg-yellow-500/15", border: "border-yellow-500/35", ring: "ring-yellow-500/15" };
  if (score >= 35) return { label: "Fair", color: "text-orange-300", bg: "bg-orange-500/15", border: "border-orange-500/35", ring: "ring-orange-500/15" };
  return { label: "Weak", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", ring: "ring-red-500/10" };
}

function fmtMcap(v?: number) {
  if (!v) return null;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}

// Gradient for the score bar — emerald for strong scores, warmer for weaker.
function scorebarStyle(score: number): React.CSSProperties {
  const bg =
    score >= 65 ? undefined :
    score >= 50 ? "linear-gradient(90deg,#facc15,#fde047)" :
    score >= 35 ? "linear-gradient(90deg,#fb923c,#fdba74)" :
    "linear-gradient(90deg,#f87171,#fca5a5)";
  return bg ? { width: `${score}%`, background: bg } : { width: `${score}%` };
}

// Big Space Grotesk rank number — #1 gets the emerald glow.
function RankNum({ rank, muted = false }: { rank: number; muted?: boolean }) {
  return (
    <span
      className={`font-display font-semibold tabular-nums text-lg sm:text-[22px] leading-none ${
        muted
          ? "text-white/15"
          : rank === 1
            ? "text-emerald-400 drop-shadow-[0_0_18px_rgba(52,211,153,0.45)]"
            : rank <= 3
              ? "text-white/70"
              : "text-white/30"
      }`}
    >
      {rank}
    </span>
  );
}

// ── Today's Movers ────────────────────────────────────────────────

function TodaysMovers({ entries }: { entries: SubnetEntry[] }) {
  const withDelta = entries.filter(e => e.score_delta_24h != null);
  if (withDelta.length < 4) return null;

  const sorted = [...withDelta].sort((a, b) => (b.score_delta_24h ?? 0) - (a.score_delta_24h ?? 0));
  const gainers = sorted.slice(0, 3);
  const losers = sorted.slice(-3).reverse();

  return (
    <div className="mb-6 ag-glass rounded-[20px] overflow-hidden">
      <div className="flex items-center gap-3 px-5 md:px-6 py-4 border-b border-white/[0.06]">
        <span className="ag-live-dot" />
        <span className="font-display font-semibold text-white text-[15px]">Today&apos;s Movers</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">24h aGap score change</span>
      </div>
      <div className="p-4 md:p-5">
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {/* Gainers */}
          <div className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-400/70 font-semibold pl-1">▲ Gainers</div>
            {gainers.map(e => {
              const delta = e.score_delta_24h ?? 0;
              return (
                <div
                  key={e.netuid}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors"
                >
                  <SubnetLogo netuid={e.netuid} name={e.name} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate leading-tight">{e.name}</div>
                    <div className="text-[10px] text-white/30 font-mono">SN{e.netuid}</div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-semibold font-mono text-emerald-400 tabular-nums">
                      +{delta.toFixed(1)}
                    </div>
                    <div className="text-[10px] font-mono text-white/30">{e.composite_score}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Losers */}
          <div className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-400/70 font-semibold pl-1">▼ Losers</div>
            {losers.map(e => {
              const delta = e.score_delta_24h ?? 0;
              return (
                <div
                  key={e.netuid}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/[0.04] border border-red-500/20 hover:bg-red-500/10 transition-colors"
                >
                  <SubnetLogo netuid={e.netuid} name={e.name} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate leading-tight">{e.name}</div>
                    <div className="text-[10px] text-white/30 font-mono">SN{e.netuid}</div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-semibold font-mono text-red-400 tabular-nums">
                      {delta.toFixed(1)}
                    </div>
                    <div className="text-[10px] font-mono text-white/30">{e.composite_score}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Locked Placeholder Card ───────────────────────────────────────

function LockedCard({ rank, entry, mode }: { rank: number; entry: SubnetEntry; mode: "trading" | "investing" }) {
  const score = mode === "investing" && entry.invest_agap != null ? entry.invest_agap : entry.composite_score;
  const tier = scoreTier(score);

  return (
    <div className="relative ag-glass rounded-[16px] overflow-hidden opacity-80">
      <div className="flex items-center gap-3 md:gap-4 px-4 md:px-6 py-4">
        <div className="flex-shrink-0 w-8 sm:w-10 text-center">
          <RankNum rank={rank} muted />
        </div>

        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-white/[0.06] border border-white/[0.08]" />

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="h-3.5 w-28 bg-white/10 rounded" />
          <div className="h-2.5 w-10 bg-white/[0.06] rounded" />
        </div>

        <div className="flex-[2] min-w-0 hidden sm:block space-y-1.5" style={{ filter: "blur(4px)" }}>
          <p className="text-sm text-white/60 leading-snug">Decentralized protocol for AI inference and model serving at scale</p>
          <p className="text-xs text-white/35 italic">Like a cloud provider where miners compete on speed and accuracy</p>
        </div>

        <div className="flex items-center gap-3 md:gap-4 flex-shrink-0" style={{ filter: "blur(3px)" }}>
          <div className="hidden md:block w-24">
            <div className="ag-scorebar"><i style={scorebarStyle(score)} /></div>
          </div>
          <div className="text-right">
            <div className="font-mono font-semibold text-[15px] text-white tabular-nums">
              {score}<span className="text-white/30 font-normal text-xs">/100</span>
            </div>
            <div className={`font-mono text-[9px] uppercase tracking-[0.16em] ${tier.color}`}>{tier.label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Rank Card ─────────────────────────────────────────────────────

function RankCard({ entry, rank, mode, watched = false }: { entry: SubnetEntry; rank: number; mode: "trading" | "investing"; watched?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const score = mode === "investing" && entry.invest_agap != null ? entry.invest_agap : entry.composite_score;
  const desc = getSubnetDescription(entry.netuid, entry.category);
  const mcap = fmtMcap(entry.market_cap);
  const pch24 = entry.price_change_24h;
  const delta = entry.score_delta_24h;
  const tier = scoreTier(score);

  return (
    <div className={`group relative ag-glass ag-glass-hover rounded-[16px] overflow-hidden transition-all duration-200 ${watched ? "ring-2 ring-blue-400/60 shadow-lg shadow-blue-500/20 border-blue-400/50" : ""}`}>

      <div
        className="flex items-center gap-3 md:gap-4 px-4 md:px-6 py-4 cursor-pointer sm:cursor-default"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-shrink-0 w-8 sm:w-10 text-center">
          <RankNum rank={rank} />
        </div>

        <div className="flex-shrink-0">
          <SubnetLogo netuid={entry.netuid} name={entry.name} size={44} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm md:text-[15px] leading-tight truncate">{entry.name}</div>
          <div className="font-mono text-[10.5px] text-white/35 mt-0.5 truncate uppercase tracking-wide">
            SN{entry.netuid}
            {entry.category && <span className="hidden sm:inline"> · {entry.category}</span>}
          </div>
        </div>

        <div className="flex-[2] min-w-0 hidden sm:block">
          <p className="text-[13px] text-white/55 leading-snug line-clamp-2">{desc.blurb}</p>
          <p className="text-xs text-white/30 mt-1 italic">{desc.analogy}</p>
        </div>

        <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
          <div className="hidden lg:flex flex-col items-end gap-0.5">
            {mcap && <span className="font-mono text-[11px] text-white/40">MCAP <span className="text-white/70">{mcap}</span></span>}
            {pch24 != null && (
              <span className={`font-mono text-[11px] font-medium ${pch24 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {pch24 >= 0 ? "+" : ""}{pch24.toFixed(1)}% today
              </span>
            )}
          </div>

          <div className="hidden md:block w-24">
            <div className="ag-scorebar"><i style={scorebarStyle(score)} /></div>
          </div>

          <div className="text-right">
            <div className="font-mono font-semibold text-[15px] text-white tabular-nums">
              {score}<span className="text-white/30 font-normal text-xs">/100</span>
            </div>
            <div className={`font-mono text-[9px] uppercase tracking-[0.16em] ${tier.color}`}>{tier.label}</div>
          </div>

          {delta != null && (
            <span className={`hidden sm:inline-flex items-center font-mono text-[11px] px-2.5 py-1 rounded-lg tabular-nums whitespace-nowrap ${
              delta > 0
                ? "text-emerald-400 bg-emerald-500/[0.08]"
                : delta < 0
                  ? "text-red-400 bg-red-500/[0.07]"
                  : "text-white/30 bg-white/[0.04]"
            }`}>
              {delta > 0 ? `▲ ${delta.toFixed(1)}` : delta < 0 ? `▼ ${Math.abs(delta).toFixed(1)}` : "—"}
            </span>
          )}

          <span className={`sm:hidden text-white/30 transition-transform duration-200 leading-none ${expanded ? "-rotate-90" : "rotate-90"}`}
            style={{ fontSize: 10 }}>
            ▶
          </span>
        </div>
      </div>

      {expanded && (
        <div className="sm:hidden px-4 pb-4 pt-2 border-t border-white/[0.06]">
          {entry.category && (
            <span className="inline-block font-mono text-[10px] uppercase tracking-wide text-white/40 bg-white/[0.06] px-2 py-0.5 rounded-full mb-3">
              {entry.category}
            </span>
          )}
          <div className="ag-scorebar mb-3"><i style={scorebarStyle(score)} /></div>
          <p className="text-sm text-white/70 leading-relaxed mb-2">{desc.blurb}</p>
          <p className="text-sm text-white/35 italic">{desc.analogy}</p>
          {(mcap || pch24 != null) && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.06]">
              {mcap && <span className="font-mono text-xs text-white/35">MCAP <span className="text-white/70 font-medium">{mcap}</span></span>}
              {pch24 != null && (
                <span className={`font-mono text-xs font-medium ${pch24 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {pch24 >= 0 ? "+" : ""}{pch24.toFixed(1)}% today
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function PowerRankingsPage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const isPro = canAccessPro(tier);
  const isPremium = canAccessPremium(tier);

  const [leaderboard, setLeaderboard] = useState<SubnetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"trading" | "investing">("trading");
  const [showAll, setShowAll] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);
  const [showInvestingGate, setShowInvestingGate] = useState(false);
  const { isWatched, watchlist } = useWatchlist();
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/cached-scan")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (Array.isArray(d?.leaderboard)) {
          setLeaderboard(d.leaderboard as SubnetEntry[]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...leaderboard].sort((a, b) => {
    const sa = mode === "investing" && a.invest_agap != null ? a.invest_agap : a.composite_score;
    const sb = mode === "investing" && b.invest_agap != null ? b.invest_agap : b.composite_score;
    return sb - sa;
  });

  const watchlistFiltered = watchlistOnly ? sorted.filter(e => watchlist.has(e.netuid)) : sorted;
  const searchFiltered = searchQuery.trim()
    ? watchlistFiltered.filter(e => {
        const q = searchQuery.trim().toLowerCase().replace(/^sn/i, "");
        return e.name.toLowerCase().includes(q) || String(e.netuid).includes(q);
      })
    : watchlistFiltered;
  const visible = showAll ? searchFiltered : searchFiltered.slice(0, 25);

  return (
    <div className="ag-aurora min-h-screen bg-[#0a0a0f] text-white">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="border-b border-white/[0.06]">
        <div className="px-4 md:px-6 pt-10 pb-8 max-w-5xl mx-auto">
          <h1 className="font-display font-semibold text-4xl md:text-[40px] tracking-[-0.03em] leading-tight mb-2">
            Power <span className="ag-gradient-text">Rankings</span>
          </h1>
          <p className="text-[14.5px] text-white/50 leading-[1.65] max-w-xl mb-3">
            Every Bittensor subnet ranked by its <span className="text-white font-medium">aGap score</span> — a 0–100 grade for what&apos;s happening and whether the market has noticed yet.
          </p>
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white/35 mb-5">
            <span className="ag-live-dot" />
            Live · Updates every 10 min{leaderboard.length > 0 && <> · {leaderboard.length} subnets</>}
          </div>

          {/* Score tier chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { range: "80–100", label: "Elite", color: "text-emerald-400 bg-emerald-500/[0.07] border-emerald-500/30" },
              { range: "65–79", label: "Strong", color: "text-green-400 bg-green-500/[0.06] border-green-500/30" },
              { range: "50–64", label: "Solid", color: "text-yellow-400 bg-yellow-500/[0.06] border-yellow-500/25" },
              { range: "35–49", label: "Fair", color: "text-orange-400 bg-orange-500/[0.06] border-orange-500/25" },
              { range: "0–34", label: "Weak", color: "text-red-400 bg-red-500/[0.06] border-red-500/20" },
            ].map(t => (
              <span key={t.range} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-[10.5px] uppercase tracking-wide border ${t.color}`}>
                <span>{t.label}</span>
                <span className="opacity-60">{t.range}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4 md:p-6 w-full max-w-5xl mx-auto">

        {/* ── What is aGap — collapsible explainer ────────────────── */}
        <div className="ag-glass rounded-[16px] mb-6 overflow-hidden">
          <button
            onClick={() => setShowExplainer(s => !s)}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
          >
            <AgIcon name="bulb" className="w-5 h-5 text-emerald-400" />
            <span className="font-display font-semibold text-white text-sm flex-1">What does the aGap score actually mean?</span>
            <span className={`text-white/30 transition-transform duration-200 text-xs ${showExplainer ? "rotate-180" : ""}`}>▼</span>
          </button>

          {showExplainer && (
            <div className="px-5 pb-5 border-t border-white/[0.06]">
              <div className="grid sm:grid-cols-2 gap-4 text-sm text-white/50 leading-relaxed mt-4">
                <p>
                  The <span className="text-white">aGap score</span> looks at four things: how much <strong className="text-white/80">code is being shipped</strong>, how much <strong className="text-white/80">money is flowing in</strong>, how much <strong className="text-white/80">buzz it&apos;s getting</strong>, and whether its <strong className="text-white/80">price is cheap relative to its activity</strong>.
                </p>
                <p>
                  A score of <span className="text-emerald-400 font-semibold">80+</span> means a lot is happening but the price might not have caught up yet — that&apos;s the &quot;alpha gap.&quot; A score of <span className="text-red-400 font-semibold">30 or below</span> means quiet activity and a price that may already reflect it.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Today's Movers ────────────────────────────────────────── */}
        {!loading && leaderboard.length > 0 && (
          <TodaysMovers entries={leaderboard} />
        )}

        {/* ── Mode tabs ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 mb-5">
          <div className="flex items-stretch gap-2">
            {/* Trading tab */}
            <button
              onClick={() => { setMode("trading"); setShowInvestingGate(false); }}
              className={`flex-1 flex items-center gap-1.5 px-2 sm:px-3 py-2.5 rounded-[14px] border text-left transition-all min-w-0 backdrop-blur-xl ${
                mode === "trading"
                  ? "bg-gradient-to-b from-emerald-500/20 to-emerald-500/[0.06] border-emerald-500/30 text-white shadow-[0_6px_18px_-8px_rgba(52,211,153,0.35)]"
                  : "bg-white/[0.02] border-white/[0.08] text-white/45 hover:border-white/[0.14] hover:text-white/80"
              }`}
            >
              <AgIcon name="bolt" className="w-4 h-4 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight truncate">Trading</div>
                <div className="text-[10px] text-white/35 hidden sm:block">Short-term signals</div>
              </div>
            </button>

            {/* Investing tab — Premium gated */}
            <div className="relative flex-1">
              {showInvestingGate && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowInvestingGate(false)} />
                  <div
                    className="absolute right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-1rem)] p-3.5 bg-[#0d1113]/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl shadow-2xl text-xs leading-relaxed"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="font-semibold text-emerald-400 mb-1.5 flex items-center gap-1.5"><AgIcon name="trendUp" className="w-3.5 h-3.5" /> Investing Analysis</div>
                    <p className="text-white/50 mb-3 leading-relaxed">Long-term aGap scoring designed for serious investors. Weights real product development, smart money positioning, and fundamental conviction — not short-term noise.</p>
                    <p className="text-white/30 text-[10px] mb-3">Available on Premium only.</p>
                    <a
                      href="/pricing"
                      className="block w-full text-center py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black rounded-lg font-semibold transition-all"
                    >
                      Upgrade to Premium →
                    </a>
                  </div>
                </>
              )}
              <button
                onClick={() => {
                  if (!isPremium) {
                    setShowInvestingGate(v => !v);
                  } else {
                    setMode("investing");
                    setShowInvestingGate(false);
                  }
                }}
                className={`w-full flex items-center gap-1.5 px-2 sm:px-3 py-2.5 rounded-[14px] border text-left transition-all min-w-0 backdrop-blur-xl ${
                  mode === "investing"
                    ? "bg-gradient-to-b from-emerald-500/20 to-emerald-500/[0.06] border-emerald-500/30 text-white shadow-[0_6px_18px_-8px_rgba(52,211,153,0.35)]"
                    : "bg-white/[0.02] border-white/[0.08] text-white/45 hover:border-white/[0.14] hover:text-white/80"
                }`}
              >
                <AgIcon name="trendUp" className="w-4 h-4 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight truncate">
                    Investing{!isPremium && <span className="ml-1 text-emerald-500/50">✦</span>}
                  </div>
                  <div className="text-[10px] text-white/35 hidden sm:block">Long-term fundamentals</div>
                </div>
              </button>
            </div>
          </div>

          {/* View Full Alpha Dashboard */}
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-[14px] border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl text-white/45 hover:border-white/[0.14] hover:text-white/90 transition-all text-sm font-semibold"
          >
            <AgIcon name="chart" className="w-4 h-4" />
            <span>View Full Alpha Dashboard</span>
          </Link>

          {/* Watchlist filter + search */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWatchlistOnly(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border backdrop-blur-xl ${
                watchlistOnly
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-white/[0.035] border-white/[0.08] text-white/45 hover:text-white"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              My Watchlist
            </button>

            {/* Search bar */}
            <div className="relative flex items-center">
              <svg className="absolute left-2.5 w-3.5 h-3.5 text-white/30 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search subnet…"
                className="pl-7 pr-7 py-1.5 rounded-lg text-xs bg-white/[0.035] backdrop-blur-xl border border-white/[0.08] text-white/70 placeholder-white/25 focus:outline-none focus:border-emerald-500/30 w-36"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 text-white/30 hover:text-white/70">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Rankings list ─────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className="w-full h-[78px] ag-glass rounded-[16px] animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-white/35">No data available — check back soon.</div>
        ) : (
          <>
            {!isPro ? (
              <>
                {sorted.length > 0 && (
                  <div className="relative mb-3">
                    <div className="space-y-3 pointer-events-none select-none">
                      {sorted.slice(0, 20).map((entry, i) => (
                        <LockedCard key={entry.netuid} rank={i + 1} entry={entry} mode={mode} />
                      ))}
                    </div>

                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-start pt-16 pointer-events-none">
                      <div className="text-center px-6 pointer-events-auto">
                        <p className="text-sm text-white/50 mb-3 flex items-center justify-center gap-1.5"><AgIcon name="lock" className="w-3.5 h-3.5" /> Top 20 subnets locked</p>
                        <Link
                          href="/pricing"
                          className="inline-block px-8 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl text-base hover:from-green-400 hover:to-emerald-500 transition-all shadow-xl shadow-green-500/30"
                        >
                          Get Access →
                        </Link>
                        <p className="text-xs text-white/35 mt-2">Pro · $29/mo · Scroll down to view free analysis</p>
                      </div>
                    </div>
                  </div>
                )}

                {sorted.length > 20 && (
                  <div className="space-y-3">
                    {sorted.slice(20).filter(e => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.trim().toLowerCase().replace(/^sn/i, "");
                      return e.name.toLowerCase().includes(q) || String(e.netuid).includes(q);
                    }).map((entry, i) => (
                      <RankCard key={entry.netuid} entry={entry} rank={i + 21} mode={mode} watched={isWatched(entry.netuid)} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-3">
                  {visible.map((entry, i) => (
                    <RankCard key={entry.netuid} entry={entry} rank={i + 1} mode={mode} watched={isWatched(entry.netuid)} />
                  ))}
                </div>

                {searchFiltered.length > 25 && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setShowAll(s => !s)}
                      className="px-6 py-2.5 rounded-[14px] border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl text-white/45 text-sm font-medium hover:border-white/[0.14] hover:text-white/90 transition-colors"
                    >
                      {showAll
                        ? `Show top 25 only ↑`
                        : `Show all ${searchFiltered.length} subnets ↓`}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Footer note ───────────────────────────────────────────── */}
        <div className="mt-10 pt-6 border-t border-white/[0.06] text-center">
          <p className="text-xs text-white/30 max-w-lg mx-auto">
            Rankings update every 10 minutes. aGap scores reflect live on-chain data, GitHub activity, and market metrics.
            This is not financial advice — always do your own research.
          </p>
          <p className="text-xs text-white/20 mt-1">
            Powered by <span className="text-white/40">alphagap.io</span>
          </p>
        </div>

      </main>
    </div>
  );
}
