"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getTier, canAccessPro } from "@/lib/subscription";

const STORAGE_KEY = "ag_watchlist_intro_v1";

export default function WatchlistOnboarding() {
  const { data: session } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  const isPro = canAccessPro(getTier(session));

  useEffect(() => {
    setMounted(true);
    // Only show if Pro/Premium and not yet dismissed
    if (isPro && !localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, [isPro]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "seen");
    setVisible(false);
  }

  function goToWatchlist() {
    dismiss();
    router.push("/watchlist");
  }

  if (!mounted || !visible) return null;

  const modal = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9990] bg-black/70 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Modal card */}
      <div
        className="fixed z-[9995] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-950 border border-blue-500/40 rounded-2xl shadow-2xl shadow-blue-500/10 overflow-hidden flex flex-col min-h-0">

          {/* Blue top accent bar */}
          <div className="h-1 bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600 flex-shrink-0" />

          {/* Scrollable body */}
          <div className="overflow-y-auto flex flex-col min-h-0">
            <div className="p-4 sm:p-6">
              {/* Close button */}
              <button
                onClick={dismiss}
                className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title="Dismiss"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Header */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest mb-0.5">New Feature</div>
                  <h2 className="text-base sm:text-lg font-bold text-white leading-tight">Introducing: Subnet Watchlists</h2>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-3 sm:mb-4">
                Pin the subnets you care about and get a personalised intelligence feed built around them — highlights, alerts, and signals filtered to what matters to you.
              </p>

              {/* Feature bullets */}
              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-5">
                {[
                  {
                    icon: "🔵",
                    title: "Instant visual highlights",
                    body: "Your watched subnets glow blue across every page.",
                  },
                  {
                    icon: "🔔",
                    title: "Smart notifications",
                    body: "Alerts when aGap score moves 20+ points, new reports drop, or major Discord/X buzz hits.",
                  },
                  {
                    icon: "⚡",
                    title: "Personalised signal feed",
                    body: "Signals and whale activity filtered to only your subnets — less noise, more alpha.",
                  },
                  {
                    icon: "👁️",
                    title: "View Your Subnets",
                    body: "Hit \"My Watchlist\" on any page to instantly narrow the feed to your list.",
                  },
                  {
                    icon: "📋",
                    title: "Unlimited subnets",
                    body: "Add, remove, and reorder any time from your Watchlist page.",
                  },
                ].map((f) => (
                  <div key={f.title} className="flex items-start gap-2.5">
                    <span className="text-sm leading-none mt-0.5 flex-shrink-0">{f.icon}</span>
                    <div>
                      <span className="text-xs sm:text-sm font-semibold text-white">{f.title} </span>
                      <span className="text-xs sm:text-sm text-gray-400">{f.body}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={goToWatchlist}
                  className="flex-1 py-2 sm:py-2.5 px-4 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors text-center"
                >
                  Set up my Watchlist →
                </button>
                <button
                  onClick={dismiss}
                  className="flex-1 py-2 sm:py-2.5 px-4 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-700 transition-colors"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}
