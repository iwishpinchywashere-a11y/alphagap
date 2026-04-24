"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { getTier, canAccessPro } from "@/lib/subscription";

interface WatchlistContextValue {
  watchlist: Set<number>;
  loading: boolean;
  toggle: (netuid: number) => Promise<void>;
  isWatched: (netuid: number) => boolean;
}

const WatchlistContext = createContext<WatchlistContextValue>({
  watchlist: new Set(),
  loading: false,
  toggle: async () => {},
  isWatched: () => false,
});

export function useWatchlist() {
  return useContext(WatchlistContext);
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const tier = getTier(session);
  const isPro = canAccessPro(tier);

  const [watchlist, setWatchlist] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchWatchlist = useCallback(() => {
    if (!isPro) return;
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.netuids)) setWatchlist(new Set(d.netuids));
      })
      .catch(() => {});
  }, [isPro]);

  // Fetch watchlist on mount if user is pro/premium
  useEffect(() => {
    if (!isPro) return;
    setLoading(true);
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.netuids)) setWatchlist(new Set(d.netuids));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isPro]);

  // Re-fetch whenever the tab becomes visible — picks up changes made on other devices
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") fetchWatchlist();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [fetchWatchlist]);

  // Listen for save events from the watchlist page
  useEffect(() => {
    function onSaved(e: Event) {
      const netuids = (e as CustomEvent<number[]>).detail;
      if (Array.isArray(netuids)) setWatchlist(new Set(netuids));
    }
    window.addEventListener("watchlist-saved", onSaved);
    return () => window.removeEventListener("watchlist-saved", onSaved);
  }, []);

  const toggle = useCallback(async (netuid: number) => {
    if (!isPro) return;
    const isCurrentlyWatched = watchlist.has(netuid);
    // Optimistic update
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (isCurrentlyWatched) next.delete(netuid);
      else next.add(netuid);
      return next;
    });
    try {
      if (isCurrentlyWatched) {
        const r = await fetch(`/api/watchlist?netuid=${netuid}`, { method: "DELETE" });
        const d = await r.json();
        if (Array.isArray(d.netuids)) setWatchlist(new Set(d.netuids));
      } else {
        const r = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ netuid }),
        });
        const d = await r.json();
        if (Array.isArray(d.netuids)) setWatchlist(new Set(d.netuids));
      }
    } catch {
      // Revert optimistic update on error
      setWatchlist((prev) => {
        const next = new Set(prev);
        if (isCurrentlyWatched) next.add(netuid);
        else next.delete(netuid);
        return next;
      });
    }
  }, [isPro, watchlist]);

  const isWatched = useCallback((netuid: number) => watchlist.has(netuid), [watchlist]);

  return (
    <WatchlistContext.Provider value={{ watchlist, loading, toggle, isWatched }}>
      {children}
    </WatchlistContext.Provider>
  );
}
