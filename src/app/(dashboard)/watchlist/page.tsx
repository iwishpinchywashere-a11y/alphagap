"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { useWatchlist } from "@/components/dashboard/WatchlistProvider";
import { getTier, canAccessPro } from "@/lib/subscription";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
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
  const { watchlist, loading } = useWatchlist();
  const tier = getTier(session);
  const isPro = canAccessPro(tier);

  // Local pending state — what the user has checked but not yet saved
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const initialised = useRef(false);

  // Initialise pending from the loaded watchlist (once)
  useEffect(() => {
    if (!loading && !initialised.current) {
      initialised.current = true;
      setPending(new Set(watchlist));
    }
  }, [loading, watchlist]);

  const hasChanges = useMemo(() => {
    if (pending.size !== watchlist.size) return true;
    for (const n of pending) if (!watchlist.has(n)) return true;
    return false;
  }, [pending, watchlist]);

  function togglePending(netuid: number) {
    setPending((prev) => {
      const next = new Set(prev);
      if (next.has(netuid)) next.delete(netuid);
      else next.add(netuid);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ netuids: Array.from(pending) }),
      });
      const d = await res.json();
      if (Array.isArray(d.netuids)) {
        // Sync pending to what server confirmed
        setPending(new Set(d.netuids));
        // Update the global watchlist context
        // We force-refresh by reloading the watchlist from the provider
        // The provider will pick up via the next GET call; we signal it by
        // dispatching a custom event the provider can listen to.
        window.dispatchEvent(new CustomEvent("watchlist-saved", { detail: d.netuids }));
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch {
      // silent — user can try again
    } finally {
      setSaving(false);
    }
  }

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

  // "Watching" section reflects pending so the X button feels instant
  const watchedSubnets = leaderboard.filter((s) => pending.has(s.netuid));

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

        {/* Current saved Watchlist */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Currently Watching {loading ? "…" : `(${pending.size})`}
          </h2>

          {watchlist.size === 0 && !loading && (
            <div className="border border-gray-800 rounded-xl p-6 text-center text-gray-500">
              <div className="text-3xl mb-2">👇</div>
              <p className="text-sm">No subnets saved yet. Check some below and hit Save.</p>
            </div>
          )}

          {watchedSubnets.length > 0 && (
            <div className="space-y-2">
              {watchedSubnets.map((sub) => (
                <div
                  key={sub.netuid}
                  className="flex items-center gap-3 bg-blue-950/20 border border-blue-500/30 rounded-xl px-4 py-3 ring-1 ring-blue-500/20 shadow-sm shadow-blue-500/10"
                >
                  <SubnetLogo netuid={sub.netuid} name={sub.name} size={32} />
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
                  </div>
                  <ScoreRing score={sub.composite_score} />
                  <button
                    onClick={() => togglePending(sub.netuid)}
                    title="Remove from watchlist"
                    className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/10 border border-red-500/30 hover:bg-red-500/30 hover:border-red-400 transition-colors flex-shrink-0 ml-1"
                  >
                    <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Add / Edit section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Add Subnets
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">{scanning ? "Refreshing…" : `${leaderboard.length} subnets`}</span>
              <button
                onClick={handleSave}
                disabled={saving || (!hasChanges && !savedFlash)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  savedFlash
                    ? "bg-green-600 text-white"
                    : hasChanges
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : "bg-gray-800 text-gray-600 cursor-default"
                }`}
              >
                {saving ? "Saving…" : savedFlash ? "✓ Saved!" : "Save"}
              </button>
            </div>
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

          {/* Pending changes banner */}
          {hasChanges && (
            <div className="flex items-center justify-between bg-blue-950/30 border border-blue-500/30 rounded-lg px-3 py-2 mb-3 text-xs text-blue-300">
              <span>You have unsaved changes</span>
              <button onClick={handleSave} disabled={saving} className="font-semibold underline underline-offset-2 hover:text-white transition-colors">
                {saving ? "Saving…" : "Save now"}
              </button>
            </div>
          )}

          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
            {allSubnets.map((sub) => {
              const checked = pending.has(sub.netuid);
              return (
                <div
                  key={sub.netuid}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors cursor-pointer ${
                    checked
                      ? "bg-blue-950/20 border border-blue-500/30"
                      : "bg-gray-900/40 border border-gray-800/60 hover:border-gray-700 hover:bg-gray-900/70"
                  }`}
                  onClick={() => togglePending(sub.netuid)}
                >
                  {/* Checkbox */}
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                    checked ? "bg-blue-500 border-blue-500" : "border-gray-600"
                  }`}>
                    {checked && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  <SubnetLogo netuid={sub.netuid} name={sub.name} size={28} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-mono">SN{sub.netuid}</span>
                      <span className={`font-medium text-sm ${checked ? "text-blue-300" : "text-white"}`}>
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
