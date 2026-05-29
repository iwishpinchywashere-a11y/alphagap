"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
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

function rankMedal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

function fmtMcap(v?: number) {
  if (!v) return null;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}

// ── Score Ring ────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const tier = scoreTier(score);
  const circumference = 2 * Math.PI * 28;
  const filled = (score / 100) * circumference;

  const strokeColor =
    score >= 80 ? "#34d399" :
    score >= 65 ? "#4ade80" :
    score >= 50 ? "#facc15" :
    score >= 35 ? "#fb923c" : "#f87171";

  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="#1f2937" strokeWidth="5" />
          <circle
            cx="32" cy="32" r="28" fill="none"
            stroke={strokeColor} strokeWidth="5"
            strokeDasharray={`${filled} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <span className={`relative z-10 text-lg font-black tabular-nums ${tier.color}`}>{score}</span>
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${tier.color}`}>{tier.label}</span>
    </div>
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
    <div className="mb-6">
      <div className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-green-950/30 via-emerald-950/10 to-transparent border border-gray-700/60 rounded-t-xl">
        <div className="w-1 h-5 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full" />
        <span className="text-sm font-bold text-white">Today&apos;s Movers</span>
        <span className="text-xs text-gray-500">24h aGap score change</span>
      </div>
      <div className="bg-gray-900/40 border border-t-0 border-gray-700/60 rounded-b-xl p-4">
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {/* Gainers */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-widest text-emerald-500/70 font-bold pl-1">▲ Gainers</div>
            {gainers.map(e => {
              const delta = e.score_delta_24h ?? 0;
              return (
                <div
                  key={e.netuid}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors"
                >
                  <SubnetLogo netuid={e.netuid} name={e.name} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate leading-tight">{e.name}</div>
                    <div className="text-[10px] text-gray-600 font-mono">SN{e.netuid}</div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-black text-emerald-400 tabular-nums">
                      +{delta.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-gray-600">{e.composite_score}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Losers */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-widest text-red-500/70 font-bold pl-1">▼ Losers</div>
            {losers.map(e => {
              const delta = e.score_delta_24h ?? 0;
              return (
                <div
                  key={e.netuid}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 transition-colors"
                >
                  <SubnetLogo netuid={e.netuid} name={e.name} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate leading-tight">{e.name}</div>
                    <div className="text-[10px] text-gray-600 font-mono">SN{e.netuid}</div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-black text-red-400 tabular-nums">
                      {delta.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-gray-600">{e.composite_score}</div>
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
  const medal = rankMedal(rank);
  const score = mode === "investing" && entry.invest_agap != null ? entry.invest_agap : entry.composite_score;
  const tier = scoreTier(score);
  const circumference = 2 * Math.PI * 28;
  const filled = (score / 100) * circumference;
  const strokeColor =
    score >= 80 ? "#34d399" :
    score >= 65 ? "#4ade80" :
    score >= 50 ? "#facc15" :
    score >= 35 ? "#fb923c" : "#f87171";

  return (
    <div className="relative bg-gray-900/70 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-700/40" />
      <div className="flex items-center gap-3 p-4 md:p-5">
        <div className="flex-shrink-0 w-6 sm:w-8 text-center">
          {medal
            ? <span className="text-lg sm:text-xl leading-none grayscale opacity-40">{medal}</span>
            : <span className="text-xs sm:text-sm font-bold text-gray-600 tabular-nums">#{rank}</span>
          }
        </div>

        <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gray-800" />

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="h-3.5 w-28 bg-gray-700 rounded" />
          <div className="h-2.5 w-10 bg-gray-700/60 rounded" />
        </div>

        <div className="flex-[2] min-w-0 hidden sm:block space-y-1.5" style={{ filter: "blur(4px)" }}>
          <p className="text-sm text-gray-300 leading-snug">Decentralized protocol for AI inference and model serving at scale</p>
          <p className="text-xs text-gray-500 italic">Like a cloud provider where miners compete on speed and accuracy</p>
        </div>

        <div className="flex flex-col items-center gap-1 flex-shrink-0" style={{ filter: "blur(3px)" }}>
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#1f2937" strokeWidth="5" />
              <circle cx="32" cy="32" r="28" fill="none" stroke={strokeColor} strokeWidth="5"
                strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round" />
            </svg>
            <span className={`relative z-10 text-lg font-black tabular-nums ${tier.color}`}>{score}</span>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${tier.color}`}>{tier.label}</span>
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
  const medal = rankMedal(rank);
  const mcap = fmtMcap(entry.market_cap);
  const pch24 = entry.price_change_24h;
  const tier = scoreTier(score);

  return (
    <div className={`group relative bg-gray-900/70 border ${tier.border} rounded-2xl overflow-hidden transition-all duration-200 hover:bg-gray-900/90 hover:shadow-lg ${watched ? "ring-2 ring-blue-400/60 bg-blue-950/40 shadow-lg shadow-blue-500/30 border-blue-400/70" : ""}`}>

      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${
        score >= 80 ? "bg-emerald-400/50" :
        score >= 65 ? "bg-green-400/40" :
        score >= 50 ? "bg-yellow-400/35" :
        score >= 35 ? "bg-orange-400/30" : "bg-red-400/25"
      }`} />

      <div
        className="flex items-center gap-3 p-4 md:p-5 cursor-pointer sm:cursor-default"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-shrink-0 w-6 sm:w-8 text-center">
          {medal ? (
            <span className="text-lg sm:text-xl leading-none">{medal}</span>
          ) : (
            <span className="text-xs sm:text-sm font-bold text-gray-500 tabular-nums">#{rank}</span>
          )}
        </div>

        <div className="flex-shrink-0">
          <SubnetLogo netuid={entry.netuid} name={entry.name} size={44} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-bold text-white text-sm md:text-base leading-tight truncate">{entry.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-gray-500 font-mono flex-shrink-0">SN{entry.netuid}</span>
            {entry.category && (
              <span className="hidden sm:inline text-[10px] text-gray-600 bg-gray-800/80 px-1.5 py-0.5 rounded-full truncate">
                {entry.category}
              </span>
            )}
          </div>
        </div>

        <div className="flex-[2] min-w-0 hidden sm:block">
          <p className="text-sm text-gray-300 leading-snug line-clamp-2">{desc.blurb}</p>
          <p className="text-xs text-gray-500 mt-1 italic">{desc.analogy}</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden lg:flex flex-col items-end gap-0.5">
            {mcap && <span className="text-xs text-gray-400 font-medium">Market cap: <span className="text-gray-200">{mcap}</span></span>}
            {pch24 != null && (
              <span className={`text-xs font-semibold ${pch24 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {pch24 >= 0 ? "+" : ""}{pch24.toFixed(1)}% today
              </span>
            )}
          </div>

          <ScoreRing score={score} />

          <span className={`sm:hidden text-gray-600 transition-transform duration-200 leading-none ${expanded ? "-rotate-90" : "rotate-90"}`}
            style={{ fontSize: 10 }}>
            ▶
          </span>
        </div>
      </div>

      {expanded && (
        <div className="sm:hidden px-4 pb-4 pt-2 border-t border-gray-800/50">
          {entry.category && (
            <span className="inline-block text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full mb-3">
              {entry.category}
            </span>
          )}
          <p className="text-sm text-gray-200 leading-relaxed mb-2">{desc.blurb}</p>
          <p className="text-sm text-gray-500 italic">{desc.analogy}</p>
          {(mcap || pch24 != null) && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-800/50">
              {mcap && <span className="text-xs text-gray-500">Market cap: <span className="text-gray-300 font-medium">{mcap}</span></span>}
              {pch24 != null && (
                <span className={`text-xs font-semibold ${pch24 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
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
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative border-b border-gray-800/50 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute top-0 right-1/4 w-96 h-48 bg-green-600/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative px-4 md:px-6 py-8 max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 via-emerald-300 to-white bg-clip-text text-transparent leading-tight mb-1">
            🏆 Power Rankings
          </h1>
          <p className="text-sm text-gray-400 max-w-xl mb-4">
            Every Bittensor subnet ranked by its <span className="text-white font-medium">aGap score</span> — a 0–100 grade for what&apos;s happening and whether the market has noticed yet.
          </p>

          {/* Score tier chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { range: "80–100", label: "Elite", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
              { range: "65–79", label: "Strong", color: "text-green-400 bg-green-500/10 border-green-500/30" },
              { range: "50–64", label: "Solid", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/25" },
              { range: "35–49", label: "Fair", color: "text-orange-400 bg-orange-500/10 border-orange-500/25" },
              { range: "0–34", label: "Weak", color: "text-red-400 bg-red-500/10 border-red-500/20" },
            ].map(t => (
              <span key={t.range} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${t.color}`}>
                <span>{t.label}</span>
                <span className="opacity-60">{t.range}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4 md:p-6 w-full max-w-5xl mx-auto">

        {/* ── What is aGap — collapsible explainer ────────────────── */}
        <div className="border border-gray-700/60 rounded-xl mb-6 overflow-hidden">
          <button
            onClick={() => setShowExplainer(s => !s)}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-800/40 transition-colors bg-gray-900/50"
          >
            <span className="text-lg">💡</span>
            <span className="font-bold text-white text-sm flex-1">What does the aGap score actually mean?</span>
            <span className={`text-gray-500 transition-transform duration-200 text-xs ${showExplainer ? "rotate-180" : ""}`}>▼</span>
          </button>

          {showExplainer && (
            <div className="px-5 pb-5 border-t border-gray-800/60 bg-gray-900/30">
              <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-400 leading-relaxed mt-4">
                <p>
                  The <span className="text-white">aGap score</span> looks at four things: how much <strong className="text-gray-200">code is being shipped</strong>, how much <strong className="text-gray-200">money is flowing in</strong>, how much <strong className="text-gray-200">buzz it&apos;s getting</strong>, and whether its <strong className="text-gray-200">price is cheap relative to its activity</strong>.
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
              className={`flex-1 flex items-center gap-1.5 px-2 sm:px-3 py-2.5 rounded-xl border text-left transition-all min-w-0 ${
                mode === "trading"
                  ? "bg-green-500/15 border-green-500/40 text-white"
                  : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
              }`}
            >
              <span className="text-base leading-none flex-shrink-0">⚡</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight truncate">Trading</div>
                <div className="text-[10px] text-gray-500 hidden sm:block">Short-term signals</div>
              </div>
            </button>

            {/* Investing tab — Premium gated */}
            <div className="relative flex-1">
              {showInvestingGate && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowInvestingGate(false)} />
                  <div
                    className="absolute right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-1rem)] p-3.5 bg-gray-900 border border-green-500/30 rounded-xl shadow-2xl text-xs leading-relaxed"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="font-semibold text-green-400 mb-1.5">📈 Investing Analysis</div>
                    <p className="text-gray-400 mb-3 leading-relaxed">Long-term aGap scoring designed for serious investors. Weights real product development, smart money positioning, and fundamental conviction — not short-term noise.</p>
                    <p className="text-gray-600 text-[10px] mb-3">Available on Premium only.</p>
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
                className={`w-full flex items-center gap-1.5 px-2 sm:px-3 py-2.5 rounded-xl border text-left transition-all min-w-0 ${
                  mode === "investing"
                    ? "bg-green-500/15 border-green-500/40 text-white"
                    : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                }`}
              >
                <span className="text-base leading-none flex-shrink-0">📈</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight truncate">
                    Investing{!isPremium && <span className="ml-1 text-green-500/50">✦</span>}
                  </div>
                  <div className="text-[10px] text-gray-500 hidden sm:block">Long-term fundamentals</div>
                </div>
              </button>
            </div>
          </div>

          {/* View Full Alpha Dashboard */}
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200 transition-all text-sm font-semibold"
          >
            <span>📊</span>
            <span>View Full Alpha Dashboard</span>
          </Link>

          {/* Watchlist filter + search */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWatchlistOnly(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
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

            {/* Search bar */}
            <div className="relative flex items-center">
              <svg className="absolute left-2.5 w-3.5 h-3.5 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search subnet…"
                className="pl-7 pr-7 py-1.5 rounded-lg text-xs bg-gray-800/60 border border-gray-700/40 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600 w-36"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 text-gray-500 hover:text-gray-300">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Rankings list ─────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className="w-full h-[88px] bg-gray-900/50 border border-gray-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No data available — check back soon.</div>
        ) : (
          <>
            {!isPro ? (
              <>
                {sorted.length > 0 && (
                  <div className="relative mb-2.5">
                    <div className="space-y-2.5 pointer-events-none select-none">
                      {sorted.slice(0, 20).map((entry, i) => (
                        <LockedCard key={entry.netuid} rank={i + 1} entry={entry} mode={mode} />
                      ))}
                    </div>

                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-start pt-16 pointer-events-none">
                      <div className="text-center px-6 pointer-events-auto">
                        <p className="text-sm text-gray-400 mb-3">🔒 Top 20 subnets locked</p>
                        <Link
                          href="/pricing"
                          className="inline-block px-8 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl text-base hover:from-green-400 hover:to-emerald-500 transition-all shadow-xl shadow-green-500/30"
                        >
                          Get Access →
                        </Link>
                        <p className="text-xs text-gray-500 mt-2">Pro · $29/mo · Scroll down to view free analysis</p>
                      </div>
                    </div>
                  </div>
                )}

                {sorted.length > 20 && (
                  <div className="space-y-2.5">
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
                <div className="space-y-2.5">
                  {visible.map((entry, i) => (
                    <RankCard key={entry.netuid} entry={entry} rank={i + 1} mode={mode} watched={isWatched(entry.netuid)} />
                  ))}
                </div>

                {searchFiltered.length > 25 && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setShowAll(s => !s)}
                      className="px-6 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm font-medium hover:border-gray-600 hover:text-gray-200 transition-colors"
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
        <div className="mt-10 pt-6 border-t border-gray-800/50 text-center">
          <p className="text-xs text-gray-600 max-w-lg mx-auto">
            Rankings update every 10 minutes. aGap scores reflect live on-chain data, GitHub activity, and market metrics.
            This is not financial advice — always do your own research.
          </p>
          <p className="text-xs text-gray-700 mt-1">
            Powered by <span className="text-gray-500">alphagap.io</span>
          </p>
        </div>

      </main>
    </div>
  );
}
