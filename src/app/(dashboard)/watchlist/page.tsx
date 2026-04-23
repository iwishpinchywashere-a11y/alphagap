"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { useWatchlist } from "@/components/dashboard/WatchlistProvider";
import { getTier, canAccessPro } from "@/lib/subscription";
import Link from "next/link";

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 75 ? "#4ade80" : score >= 50 ? "#86efac" : score >= 35 ? "#fbbf24" : "#6b7280";
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="36" height="36" className="flex-shrink-0">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#1f2937" strokeWidth="3" />
      <circle
        cx="18" cy="18" r={r} fill="none"
        stroke={color} strokeWidth="3"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
      />
      <text x="18" y="22" textAnchor="middle" fontSize="9" fontWeight="bold" fill={color}>
        {Math.round(score)}
      </text>
    </svg>
  );
}

export default function WatchlistPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { leaderboard, scanning } = useDashboard();
  const { watchlist, toggle, loading } = useWatchlist();
  const tier = getTier(session);
  const isPro = canAccessPro(tier);

  const [search, setSearch] = useState("");

  // Gate: must be logged in and Pro/Premium
  if (!session) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold mb-2">Sign In Required</h2>
          <p className="text-gray-400 mb-4">Sign in to manage your watchlist.</p>
          <Link href="/auth/signin" className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors">
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  if (!isPro) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">⭐</div>
          <h2 className="text-xl font-bold mb-2">Pro Feature</h2>
          <p className="text-gray-400 mb-6">The Watchlist is available on Pro and Premium plans. Track your favourite subnets and get highlighted alerts across every page.</p>
          <Link href="/pricing" className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-lg transition-colors hover:from-green-400 hover:to-emerald-500">
            Upgrade to Pro →
          </Link>
        </div>
      </main>
    );
  }

  const watchedSubnets = leaderboard.filter((s) => watchlist.has(s.netuid));
  const q = search.toLowerCase().trim();
  const allSubnets = useMemo(
    () =>
      leaderboard.filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          `sn${s.netuid}`.includes(q) ||
          `${s.netuid}`.includes(q)
      ),
    [leaderboard, q]
  );

  return (
    <main className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            My Watchlist
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Subnets on your watchlist are highlighted with a blue glow across the dashboard, signals, reports, and more.
          </p>
        </div>

        {/* Current Watchlist */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Watching {loading ? "…" : `(${watchlist.size})`}
          </h2>

          {watchlist.size === 0 && !loading && (
            <div className="border border-gray-800 rounded-xl p-6 text-center text-gray-500">
              <div className="text-3xl mb-2">👇</div>
              <p className="text-sm">No subnets on your watchlist yet. Add some below.</p>
            </div>
          )}

          {watchedSubnets.length > 0 && (
            <div className="space-y-2">
              {watchedSubnets.map((sub) => (
                <div
                  key={sub.netuid}
                  className="flex items-center gap-3 bg-blue-950/20 border border-blue-500/30 rounded-xl px-4 py-3 ring-1 ring-blue-500/20 shadow-sm shadow-blue-500/10"
                >
                  {sub.image_url ? (
                    <img src={sub.image_url} alt={sub.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-300">
                      {sub.netuid}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-mono">SN{sub.netuid}</span>
                      <span
                        className="font-medium text-sm text-white cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => router.push(`/subnets/${sub.netuid}`)}
                      >
                        {sub.name}
                      </span>
                    </div>
                    {sub.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{sub.description}</p>
                    )}
                  </div>
                  <ScoreRing score={sub.composite_score} />
                  <button
                    onClick={() => toggle(sub.netuid)}
                    className="ml-1 p-1.5 rounded-lg text-blue-400 hover:bg-blue-900/30 hover:text-blue-300 transition-colors"
                    title="Remove from watchlist"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Add to Watchlist */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Add Subnets
            </h2>
            <span className="text-xs text-gray-600">{scanning ? "Refreshing…" : `${leaderboard.length} subnets`}</span>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or subnet number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
            />
          </div>

          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
            {allSubnets.map((sub) => {
              const watched = watchlist.has(sub.netuid);
              return (
                <div
                  key={sub.netuid}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors cursor-pointer ${
                    watched
                      ? "bg-blue-950/20 border border-blue-500/30"
                      : "bg-gray-900/40 border border-gray-800/60 hover:border-gray-700 hover:bg-gray-900/70"
                  }`}
                  onClick={() => toggle(sub.netuid)}
                >
                  {/* Checkbox */}
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                    watched ? "bg-blue-500 border-blue-500" : "border-gray-600"
                  }`}>
                    {watched && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  {sub.image_url ? (
                    <img src={sub.image_url} alt={sub.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-400">
                      {sub.netuid}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-mono">SN{sub.netuid}</span>
                      <span className={`font-medium text-sm ${watched ? "text-blue-300" : "text-white"}`}>
                        {sub.name}
                      </span>
                    </div>
                  </div>

                  <ScoreRing score={sub.composite_score} />
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </main>
  );
}
