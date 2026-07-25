"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { getTier, canAccessPro } from "@/lib/subscription";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { useWatchlist } from "@/components/dashboard/WatchlistProvider";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import AgIcon from "@/components/AgIcon";

const MIN_PICKS = 3;
const TOP_COUNT = 12;

function storageKey(email: string) {
  return `ag-onboard-${email}`;
}

export default function WatchlistOnboarding() {
  const { data: session } = useSession();
  const { leaderboard } = useDashboard();
  const { watchlist, loaded } = useWatchlist();

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = session?.user?.email ?? null;
  const isPro = canAccessPro(getTier(session));

  useEffect(() => {
    setMounted(true);
  }, []);

  // Trigger: signed-in Pro+ user, account watchlist has loaded and is empty,
  // and this account hasn't dismissed the first-run step before.
  useEffect(() => {
    if (!mounted || !email || !isPro || !loaded) return;
    if (watchlist.size > 0) return;
    if (localStorage.getItem(storageKey(email))) return;
    setVisible(true);
  }, [mounted, email, isPro, loaded, watchlist]);

  const topSubnets = useMemo(
    () =>
      [...leaderboard]
        .sort((a, b) => (b.composite_score ?? 0) - (a.composite_score ?? 0))
        .slice(0, TOP_COUNT),
    [leaderboard]
  );

  function toggleSelect(netuid: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(netuid)) next.delete(netuid);
      else next.add(netuid);
      return next;
    });
  }

  function markDismissed() {
    if (email) localStorage.setItem(storageKey(email), "seen");
  }

  function skip() {
    markDismissed();
    setVisible(false);
  }

  async function save() {
    if (selected.size < MIN_PICKS || saving) return;
    setSaving(true);
    setError(null);

    // Persist each pick to the account watchlist (same POST the provider's
    // toggle uses). Sequential so the server-side list builds up in order.
    let lastNetuids: number[] | null = null;
    let successes = 0;
    for (const netuid of selected) {
      try {
        const r = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ netuid }),
        });
        if (!r.ok) continue;
        const d = await r.json();
        if (Array.isArray(d.netuids)) lastNetuids = d.netuids;
        successes++;
      } catch {
        // keep going — partial saves are still useful
      }
    }

    setSaving(false);

    if (successes === 0) {
      setError("Couldn't save your watchlist. Check your connection and try again.");
      return;
    }

    // Sync the WatchlistProvider with the authoritative server list.
    if (lastNetuids) {
      window.dispatchEvent(new CustomEvent<number[]>("watchlist-saved", { detail: lastNetuids }));
    }

    markDismissed();
    setVisible(false);
  }

  if (!mounted || !visible || topSubnets.length === 0) return null;

  const count = selected.size;
  const ctaEnabled = count >= MIN_PICKS && !saving;

  const modal = (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9990] bg-black/70 backdrop-blur-sm" onClick={skip} />

      {/* Modal */}
      <div
        className="fixed z-[9995] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[94vw] max-w-lg max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ag-glass overflow-hidden flex flex-col min-h-0 shadow-2xl shadow-emerald-500/10 bg-gray-950/90">
          <div className="h-1 bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600 flex-shrink-0" />

          <div className="overflow-y-auto flex flex-col min-h-0">
            <div className="relative p-4 sm:p-6">
              {/* Close */}
              <button
                onClick={skip}
                className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title="Skip for now"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Header */}
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-emerald-400">
                  <AgIcon name="radar" className="w-4.5 h-4.5" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mb-0.5">
                    First-run setup
                  </div>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-white leading-tight">
                    Pick your{" "}
                    <span className="bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">
                      subnets
                    </span>
                  </h2>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-4">
                Choose at least {MIN_PICKS} subnets to track. Your watchlist powers personalised
                highlights, alerts, and signal feeds across AlphaGap — you can change it any time.
              </p>

              {/* Subnet chips */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {topSubnets.map((s) => {
                  const active = selected.has(s.netuid);
                  return (
                    <button
                      key={s.netuid}
                      onClick={() => toggleSelect(s.netuid)}
                      disabled={saving}
                      className={`ag-glass flex items-center gap-2 px-2.5 py-2 text-left transition-colors !rounded-xl ${
                        active
                          ? "!border-emerald-400/60 !bg-emerald-500/10"
                          : "hover:!border-emerald-500/30"
                      }`}
                    >
                      <SubnetLogo netuid={s.netuid} name={s.name} size={22} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-white truncate">
                          {s.name}
                        </span>
                        <span
                          className={`block text-[10px] font-mono ${
                            active ? "text-emerald-300" : "text-gray-500"
                          }`}
                        >
                          aGap {Math.round(s.composite_score ?? 0)}
                        </span>
                      </span>
                      {active && (
                        <span className="text-emerald-400 flex-shrink-0">
                          <AgIcon name="star" className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {error && (
                <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2 mb-3">
                  <AgIcon name="warning" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* CTA */}
              <button
                onClick={save}
                disabled={!ctaEnabled}
                className={`w-full py-2.5 px-4 rounded-xl text-sm font-bold transition-colors text-center ${
                  ctaEnabled
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-gray-800 text-gray-500 cursor-not-allowed"
                }`}
              >
                {saving
                  ? "Saving…"
                  : count >= MIN_PICKS
                    ? `Track ${count} subnet${count === 1 ? "" : "s"} →`
                    : `Select ${MIN_PICKS - count} more to continue`}
              </button>

              <button
                onClick={skip}
                disabled={saving}
                className="w-full mt-2 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}
