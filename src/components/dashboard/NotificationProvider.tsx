"use client";

import {
  createContext, useContext, useState, useEffect,
  useRef, useCallback, ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { useDashboard } from "./DashboardProvider";
import { useWatchlist } from "./WatchlistProvider";
import { getTier, canAccessPro } from "@/lib/subscription";
import type { AppNotification, NotificationSnapshot } from "@/lib/notification-types";

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  markRead: () => {},
  markAllRead: () => {},
  clearAll: () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

const SCORE_THRESHOLD = 20; // composite_score points to trigger notification
const BENCH_THRESHOLD = 5; // benchmark_score points to trigger notification

const WHALE_TYPES = new Set([
  "whale_buy", "whale_sell", "flow_spike",
  "flow_inflection", "flow_warning", "volume_surge",
]);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const isPro = canAccessPro(getTier(session));

  const { leaderboard, signals, lastScan } = useDashboard();
  const { watchlist } = useWatchlist();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  // Use refs for snapshot + check-guard to avoid stale closures / infinite loops
  const snapshotRef = useRef<NotificationSnapshot | null>(null);
  const lastCheckedScan = useRef<string | null>(null);
  const checking = useRef(false);

  // Fetch existing notifications + snapshot on mount
  useEffect(() => {
    if (!isPro) return;
    setLoading(true);
    fetch("/api/notifications")
      .then(r => r.json())
      .then(d => {
        setNotifications(d.notifications ?? []);
        snapshotRef.current = d.snapshot ?? null;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isPro]);

  // Run check whenever scan data changes (new scan completed)
  useEffect(() => {
    if (!isPro) return;
    if (!leaderboard.length || !lastScan) return;
    if (lastCheckedScan.current === lastScan) return;
    if (checking.current) return;
    if (watchlist.size === 0) return;

    checking.current = true;
    lastCheckedScan.current = lastScan;

    (async () => {
      try {
        const now = new Date().toISOString();
        const currentSnapshot = snapshotRef.current;
        const newNotifications: AppNotification[] = [];

        // Build updated snapshot from current data
        const newSnapshot: NotificationSnapshot = {
          scores: {},
          benchmarkScores: {},
          signalIds: [...(currentSnapshot?.signalIds ?? [])],
          tweetIds: [...(currentSnapshot?.tweetIds ?? [])],
          reportKeys: [...(currentSnapshot?.reportKeys ?? [])],
          checkedAt: now,
        };

        for (const s of leaderboard) {
          newSnapshot.scores[s.netuid] = s.composite_score;
          if (s.benchmark_score != null) newSnapshot.benchmarkScores[s.netuid] = s.benchmark_score;
        }

        // ── Score & benchmark changes (only if we have a baseline) ─────
        if (currentSnapshot) {
          for (const s of leaderboard) {
            if (!watchlist.has(s.netuid)) continue;

            // aGap score change
            const prevScore = currentSnapshot.scores[s.netuid];
            if (prevScore != null) {
              const delta = s.composite_score - prevScore;
              if (Math.abs(delta) >= SCORE_THRESHOLD) {
                const dir = delta > 0 ? "up" : "down";
                newNotifications.push({
                  id: `score-${s.netuid}-${now}`,
                  type: "score",
                  netuid: s.netuid,
                  subnetName: s.name,
                  message: `aGap score ${dir} ${Math.abs(Math.round(delta))} pts → ${Math.round(s.composite_score)}`,
                  url: `/subnets/${s.netuid}`,
                  timestamp: now,
                  read: false,
                });
              }
            }

            // Benchmark score change
            if (s.benchmark_score != null) {
              const prevBench = currentSnapshot.benchmarkScores[s.netuid];
              if (prevBench != null) {
                const bdelta = s.benchmark_score - prevBench;
                if (Math.abs(bdelta) >= BENCH_THRESHOLD) {
                  newNotifications.push({
                    id: `bench-${s.netuid}-${now}`,
                    type: "benchmark",
                    netuid: s.netuid,
                    subnetName: s.name,
                    message: `Benchmark ${bdelta > 0 ? "improved" : "dropped"} ${Math.abs(Math.round(bdelta))} pts → ${Math.round(s.benchmark_score)}`,
                    url: `/benchmarks`,
                    timestamp: now,
                    read: false,
                  });
                }
              }
            }
          }
        }

        // ── New signals / whale signals ────────────────────────────────
        const seenSignalIds = new Set(newSnapshot.signalIds);
        for (const sig of signals) {
          if (!watchlist.has(sig.netuid)) continue;
          if (seenSignalIds.has(sig.id)) continue;
          seenSignalIds.add(sig.id);
          // Only generate notifications once we have a baseline snapshot
          if (currentSnapshot) {
            const isWhale = WHALE_TYPES.has(sig.signal_type);
            newNotifications.push({
              id: `signal-${sig.id}`,
              type: isWhale ? "whale" : "signal",
              netuid: sig.netuid,
              subnetName: sig.subnet_name || `SN${sig.netuid}`,
              message: sig.title,
              url: isWhale ? "/whales" : "/signals",
              timestamp: sig.created_at,
              read: false,
            });
          }
        }
        newSnapshot.signalIds = [...seenSignalIds].slice(-300);

        // ── New reports ────────────────────────────────────────────────
        try {
          const rRes = await fetch("/api/reports");
          if (rRes.ok) {
            const { reports } = await rRes.json() as { reports: Array<{ date: string; netuid?: number; subnet_name?: string; generated_at?: string }> };
            const seenReportKeys = new Set(newSnapshot.reportKeys);
            for (const r of (reports ?? [])) {
              if (!r.netuid || !watchlist.has(r.netuid)) continue;
              const key = `${r.date}-${r.netuid}`;
              if (seenReportKeys.has(key)) continue;
              seenReportKeys.add(key);
              if (currentSnapshot) {
                newNotifications.push({
                  id: `report-${key}`,
                  type: "report",
                  netuid: r.netuid,
                  subnetName: r.subnet_name || `SN${r.netuid}`,
                  message: `New intelligence report published`,
                  url: `/reports`,
                  timestamp: r.generated_at || `${r.date}T12:00:00Z`,
                  read: false,
                });
              }
            }
            newSnapshot.reportKeys = [...seenReportKeys].slice(-100);
          }
        } catch { /* non-fatal */ }

        // ── New social / KOL activity ──────────────────────────────────
        try {
          const sRes = await fetch("/api/social");
          if (sRes.ok) {
            const { hotTweets } = await sRes.json() as {
              hotTweets: Array<{ tweet_id: string; netuid: number; subnet_name: string; kol_handle: string; detected_at: string }>;
            };
            const seenTweetIds = new Set(newSnapshot.tweetIds);
            for (const t of (hotTweets ?? [])) {
              if (!watchlist.has(t.netuid)) continue;
              if (seenTweetIds.has(t.tweet_id)) continue;
              seenTweetIds.add(t.tweet_id);
              if (currentSnapshot) {
                newNotifications.push({
                  id: `tweet-${t.tweet_id}`,
                  type: "social",
                  netuid: t.netuid,
                  subnetName: t.subnet_name || `SN${t.netuid}`,
                  message: `@${t.kol_handle} is talking about ${t.subnet_name}`,
                  url: `/social`,
                  timestamp: t.detected_at,
                  read: false,
                });
              }
            }
            newSnapshot.tweetIds = [...seenTweetIds].slice(-300);
          }
        } catch { /* non-fatal */ }

        // ── Persist to server ──────────────────────────────────────────
        snapshotRef.current = newSnapshot;

        if (newNotifications.length > 0 || !currentSnapshot) {
          const res = await fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notifications: newNotifications, snapshot: newSnapshot }),
          });
          if (res.ok && newNotifications.length > 0) {
            setNotifications(prev => {
              const ids = new Set(prev.map(n => n.id));
              const toAdd = newNotifications.filter(n => !ids.has(n.id));
              return [...toAdd, ...prev];
            });
          }
        }
      } finally {
        checking.current = false;
      }
    })();
  }, [isPro, leaderboard, signals, lastScan, watchlist]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  }, []);

  const clearAll = useCallback(async () => {
    // Await the DELETE before updating UI — fire-and-forget was causing notifications
    // to reappear on refresh if the request hadn't landed before the page reloaded.
    try {
      const res = await fetch("/api/notifications", { method: "DELETE" });
      if (!res.ok) return; // Don't clear UI if server rejected the request
    } catch {
      return; // Network error — leave UI unchanged so user knows it didn't work
    }
    setNotifications([]);
    // Reset snapshot ref so the next background check establishes a fresh baseline
    // from current scores/signals rather than comparing against stale pre-clear data.
    // Without this, old score deltas or unseen signals would re-trigger immediately.
    snapshotRef.current = null;
    lastCheckedScan.current = null;
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, loading, markRead, markAllRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}
