"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import { getSubnetDescription } from "@/lib/subnet-plain-english";
import { getTier, canAccessPro, canAccessPremium } from "@/lib/subscription";

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

// ── Locked Placeholder Card ───────────────────────────────────────

function LockedCard({ rank }: { rank: number }) {
  const medal = rankMedal(rank);
  // Fake a plausible score so the ring looks real but is blurred
  const fakeScore = 45 + ((rank * 7) % 50);
  const fakeTier = scoreTier(fakeScore);
  const circumference = 2 * Math.PI * 28;
  const filled = (fakeScore / 100) * circumference;
  const strokeColor = fakeScore >= 65 ? "#4ade80" : fakeScore >= 50 ? "#facc15" : "#fb923c";

  return (
    <div className="relative bg-gray-900/70 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-700/40" />
      <div className="flex items-center gap-3 p-4 md:p-5">
        {/* Rank — visible so user sees the position */}
        <div className="flex-shrink-0 w-6 sm:w-8 text-center">
          {medal
            ? <span className="text-lg sm:text-xl leading-none grayscale opacity-40">{medal}</span>
            : <span className="text-xs sm:text-sm font-bold text-gray-600 tabular-nums">#{rank}</span>
          }
        </div>

        {/* Logo — fully blacked out */}
        <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gray-800" />

        {/* Name + SN — fully blacked out */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="h-3.5 w-28 bg-gray-700 rounded" />
          <div className="h-2.5 w-10 bg-gray-700/60 rounded" />
        </div>

        {/* Description text — blurred so you can tell it's real text */}
        <div className="flex-[2] min-w-0 hidden sm:block space-y-1.5" style={{ filter: "blur(4px)" }}>
          <p className="text-sm text-gray-300 leading-snug">Decentralized protocol for AI inference and model serving at scale</p>
          <p className="text-xs text-gray-500 italic">Like a cloud provider where miners compete on speed and accuracy</p>
        </div>

        {/* Score ring — blurred so you can see a number but not read it */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0" style={{ filter: "blur(3px)" }}>
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#1f2937" strokeWidth="5" />
              <circle cx="32" cy="32" r="28" fill="none" stroke={strokeColor} strokeWidth="5"
                strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round" />
            </svg>
            <span className={`relative z-10 text-lg font-black tabular-nums ${fakeTier.color}`}>{fakeScore}</span>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${fakeTier.color}`}>{fakeTier.label}</span>
        </div>
      </div>
    </div>
  );
}

// ── Rank Card ─────────────────────────────────────────────────────

function RankCard({ entry, rank, mode }: { entry: SubnetEntry; rank: number; mode: "trading" | "investing" }) {
  const [expanded, setExpanded] = useState(false);
  const score = mode === "investing" && entry.invest_agap != null ? entry.invest_agap : entry.composite_score;
  const desc = getSubnetDescription(entry.netuid, entry.category);
  const medal = rankMedal(rank);
  const mcap = fmtMcap(entry.market_cap);
  const pch24 = entry.price_change_24h;
  const tier = scoreTier(score);

  return (
    <div className={`group relative bg-gray-900/70 border ${tier.border} rounded-2xl overflow-hidden transition-all duration-200 hover:bg-gray-900/90 hover:shadow-lg`}>

      {/* Subtle left accent glow */}
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${
        score >= 80 ? "bg-emerald-400/50" :
        score >= 65 ? "bg-green-400/40" :
        score >= 50 ? "bg-yellow-400/35" :
        score >= 35 ? "bg-orange-400/30" : "bg-red-400/25"
      }`} />

      {/* Main row — tappable on mobile */}
      <div
        className="flex items-center gap-3 p-4 md:p-5 cursor-pointer sm:cursor-default"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Rank number — narrower on mobile */}
        <div className="flex-shrink-0 w-6 sm:w-8 text-center">
          {medal ? (
            <span className="text-lg sm:text-xl leading-none">{medal}</span>
          ) : (
            <span className="text-xs sm:text-sm font-bold text-gray-500 tabular-nums">#{rank}</span>
          )}
        </div>

        {/* Logo */}
        <div className="flex-shrink-0">
          <SubnetLogo netuid={entry.netuid} name={entry.name} size={44} />
        </div>

        {/* Name + SN tag — grows to fill available space on mobile */}
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

        {/* Description — desktop only inline */}
        <div className="flex-[2] min-w-0 hidden sm:block">
          <p className="text-sm text-gray-300 leading-snug line-clamp-2">{desc.blurb}</p>
          <p className="text-xs text-gray-500 mt-1 italic">{desc.analogy}</p>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Mcap + 24h — desktop only */}
          <div className="hidden lg:flex flex-col items-end gap-0.5">
            {mcap && <span className="text-xs text-gray-400 font-medium">Market cap: <span className="text-gray-200">{mcap}</span></span>}
            {pch24 != null && (
              <span className={`text-xs font-semibold ${pch24 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {pch24 >= 0 ? "+" : ""}{pch24.toFixed(1)}% today
              </span>
            )}
          </div>

          {/* Score ring */}
          <ScoreRing score={score} />

          {/* Chevron — mobile only, centered vertically */}
          <span className={`sm:hidden text-gray-600 transition-transform duration-200 leading-none ${expanded ? "-rotate-90" : "rotate-90"}`}
            style={{ fontSize: 10 }}>
            ▶
          </span>
        </div>
      </div>

      {/* Expandable description — mobile only */}
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

  // Sort by selected mode score
  const sorted = [...leaderboard].sort((a, b) => {
    const sa = mode === "investing" && a.invest_agap != null ? a.invest_agap : a.composite_score;
    const sb = mode === "investing" && b.invest_agap != null ? b.invest_agap : b.composite_score;
    return sb - sa;
  });

  const visible = showAll ? sorted : sorted.slice(0, 25);

  return (
    <main className="flex-1 overflow-auto p-4 md:p-6 max-w-5xl mx-auto">

      {/* ── Hero header ─────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🏆</span>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Bittensor Power Rankings</h1>
        </div>
        <p className="text-base text-gray-400 max-w-2xl leading-relaxed">
          Every Bittensor subnet ranked by its <span className="text-white font-semibold">aGap score</span> — a simple 0–100 grade that shows what the subnet is up to and whether the market has noticed yet.
        </p>
      </div>

      {/* ── What is aGap — collapsible explainer ────────────────── */}
      <div className="bg-gray-900/60 border border-gray-700/60 rounded-2xl mb-6 overflow-hidden">
        <button
          onClick={() => setShowExplainer(s => !s)}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-800/40 transition-colors"
        >
          <span className="text-xl">💡</span>
          <span className="font-bold text-white text-sm flex-1">What does the aGap score actually mean?</span>
          <span className={`text-gray-500 transition-transform duration-200 text-xs ${showExplainer ? "rotate-180" : ""}`}>▼</span>
        </button>

        {showExplainer && (
          <div className="px-5 pb-5 border-t border-gray-800/60">
            <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-400 leading-relaxed mt-4">
              <p>
                The <span className="text-white">aGap score</span> looks at four things: how much <strong className="text-gray-200">code is being shipped</strong>, how much <strong className="text-gray-200">money is flowing in</strong>, how much <strong className="text-gray-200">buzz it&apos;s getting</strong>, and whether its <strong className="text-gray-200">price is cheap relative to its activity</strong>.
              </p>
              <p>
                A score of <span className="text-emerald-400 font-semibold">80+</span> means a lot is happening but the price might not have caught up yet — that&apos;s the &quot;alpha gap.&quot; A score of <span className="text-red-400 font-semibold">30 or below</span> means quiet activity and a price that may already reflect it.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                { range: "80–100", label: "Elite", color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/40" },
                { range: "65–79", label: "Strong", color: "text-green-400 bg-green-500/15 border-green-500/35" },
                { range: "50–64", label: "Solid", color: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30" },
                { range: "35–49", label: "Fair", color: "text-orange-400 bg-orange-500/15 border-orange-500/30" },
                { range: "0–34", label: "Weak", color: "text-red-400 bg-red-500/10 border-red-500/25" },
              ].map(t => (
                <span key={t.range} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${t.color}`}>
                  <span>{t.label}</span>
                  <span className="opacity-60">{t.range}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Mode tabs ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 mb-5">
        {/* Trading + Investing + Dash (desktop only) — one row */}
        <div className="flex items-stretch gap-2">
          {/* Trading tab */}
          <button
            onClick={() => { setMode("trading"); setShowInvestingGate(false); }}
            className={`flex-1 flex items-center gap-1.5 px-2 sm:px-3 py-2.5 rounded-xl border text-left transition-all min-w-0 ${
              mode === "trading"
                ? "bg-indigo-600/25 border-indigo-500/50 text-white"
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
                  className="absolute left-0 top-full mt-2 z-50 w-64 p-3.5 bg-gray-900 border border-purple-500/40 rounded-xl shadow-2xl text-xs leading-relaxed"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="font-semibold text-purple-400 mb-1.5">📈 Investing Analysis</div>
                  <p className="text-gray-400 mb-3 leading-relaxed">Long-term aGap scoring designed for serious investors. Weights real product development, smart money positioning, and fundamental conviction — not short-term noise.</p>
                  <p className="text-gray-600 text-[10px] mb-3">Available on Premium only.</p>
                  <a
                    href="/pricing"
                    className="block w-full text-center py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-colors"
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
                  ? "bg-indigo-600/25 border-indigo-500/50 text-white"
                  : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
              }`}
            >
              <span className="text-base leading-none flex-shrink-0">📈</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight truncate">
                  Investing{!isPremium && <span className="ml-1 text-purple-500/70">✦</span>}
                </div>
                <div className="text-[10px] text-gray-500 hidden sm:block">Long-term fundamentals</div>
              </div>
            </button>
          </div>

          {/* Dash — desktop only, same height as tabs via items-stretch */}
          <Link
            href="/dashboard"
            className="hidden sm:flex flex-shrink-0 items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200 transition-all text-sm font-semibold"
          >
            <span>📊</span>
            <span>Dashboard</span>
          </Link>
        </div>

        {/* View Full Dashboard — mobile only, full width below tabs */}
        <Link
          href="/dashboard"
          className="sm:hidden flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200 transition-all text-sm font-semibold"
        >
          <span>📊</span>
          <span>View Full Dashboard</span>
        </Link>
      </div>

      {/* ── Rankings list ─────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-900/50 border border-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No data available — check back soon.</div>
      ) : (
        <>
          {/* Free tier: top 20 blurred with floating CTA, ranks 21+ visible */}
          {!isPro ? (
            <>
              {sorted.length > 0 && (
                <div className="relative mb-2.5">
                  {/* Blacked-out top 20 — no real data rendered */}
                  <div className="space-y-2.5 pointer-events-none select-none">
                    {Array.from({ length: Math.min(20, sorted.length) }).map((_, i) => (
                      <LockedCard key={i} rank={i + 1} />
                    ))}
                  </div>

                  {/* Floating Get Access overlay — no background so cards stay visible */}
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-start pt-16 pointer-events-none">
                    <div className="text-center px-6 pointer-events-auto">
                      <p className="text-sm text-gray-400 mb-3">🔒 Top 20 subnets locked</p>
                      <Link
                        href="/pricing"
                        className="inline-block px-8 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl text-base hover:from-green-400 hover:to-emerald-500 transition-all shadow-xl shadow-green-500/30"
                      >
                        Get Access →
                      </Link>
                      <p className="text-xs text-gray-500 mt-2">Pro · $29/mo · Unlocks full rankings</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Ranks 21+ are free to view */}
              {sorted.length > 20 && (
                <div className="space-y-2.5">
                  {sorted.slice(20).map((entry, i) => (
                    <RankCard key={entry.netuid} entry={entry} rank={i + 21} mode={mode} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2.5">
                {visible.map((entry, i) => (
                  <RankCard key={entry.netuid} entry={entry} rank={i + 1} mode={mode} />
                ))}
              </div>

              {/* Show more / collapse */}
              {sorted.length > 25 && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowAll(s => !s)}
                    className="px-6 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm font-medium hover:border-gray-600 hover:text-gray-200 transition-colors"
                  >
                    {showAll
                      ? `Show top 25 only ↑`
                      : `Show all ${sorted.length} subnets ↓`}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Footer note ───────────────────────────────────────────── */}
      <div className="mt-10 pt-6 border-t border-gray-800 text-center">
        <p className="text-xs text-gray-600 max-w-lg mx-auto">
          Rankings update every 10 minutes. aGap scores reflect live on-chain data, GitHub activity, and market metrics.
          This is not financial advice — always do your own research.
        </p>
        <p className="text-xs text-gray-700 mt-1">
          Powered by <span className="text-gray-500">alphagap.io</span>
        </p>
      </div>

    </main>
  );
}
