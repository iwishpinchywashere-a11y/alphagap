"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import BlurGate from "@/components/BlurGate";
import AgIcon, { type AgIconName } from "@/components/AgIcon";
import { getTier, canAccessPremium } from "@/lib/subscription";
import type { SubnetScore } from "@/lib/types";
import type { PersistedFlowEvent } from "@/app/api/cron/flow-snapshot/route";

// ── Significance thresholds — the entire point of this page ────────
const SIGNAL_MIN_STRENGTH = 75;
const FLOW_MIN_STRENGTH = 75;
const TWEET_MIN_HEAT = 70;
const SCORE_MOVE_MIN = 8;      // |score_delta_24h| points
const PRICE_MOVE_MIN = 15;     // |price_change_24h| %

type FeedKind = "whale" | "signal" | "viral" | "score" | "price";
type FilterKey = "all" | "whales" | "signals" | "social" | "moves";

interface FeedItem {
  key: string;               // dedupe key `${netuid}:${kind}`
  kind: FeedKind;
  netuid: number;
  name: string;
  badge: string;
  badgeClass: string;        // ag-badge variant
  icon: AgIconName;
  title: string;
  detail?: string;
  strength: number;          // used for dedupe (keep strongest)
  ts: number;                // epoch ms for sorting
}

// Signal types that belong to the whale/flow world
const WHALE_SIGNAL_TYPES = new Set([
  "whale_buy", "whale_sell", "flow_inflection", "flow_spike", "flow_warning",
]);

interface HotTweet {
  tweet_id?: string;
  netuid: number;
  subnet_name?: string;
  kol_handle?: string;
  kol_name?: string;
  tweet_text?: string;
  heat_score: number;
  detected_at?: string;
}

// score_delta_24h ships in scan-latest.json but isn't on the shared type yet
type ScoredSubnet = SubnetScore & { score_delta_24h?: number };

function timeAgoShort(ms: number): string {
  if (!ms) return "";
  const diffMs = Date.now() - ms;
  const diffMin = diffMs / 60_000;
  const diffH = diffMs / 3_600_000;
  const diffD = diffMs / 86_400_000;
  if (diffMin < 2) return "just now";
  if (diffMin < 60) return `${Math.floor(diffMin)}m ago`;
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffD < 7) return `${Math.floor(diffD)}d ago`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toTs(iso?: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

const KIND_TO_FILTER: Record<FeedKind, FilterKey> = {
  whale: "whales",
  signal: "signals",
  viral: "social",
  score: "moves",
  price: "moves",
};

export default function FeedsPage() {
  const { signals, leaderboard, scanning, lastScanAt } = useDashboard();
  const router = useRouter();
  const { data: session } = useSession();
  const tier = getTier(session);
  const isPremium = canAccessPremium(tier);

  const [filter, setFilter] = useState<FilterKey>("all");
  const PAGE = 25;
  const [visibleLimit, setVisibleLimit] = useState(PAGE);
  useEffect(() => { setVisibleLimit(PAGE); }, [filter]);

  // ── Persisted flow events (72h window) ────────────────────────
  const [flowEvents, setFlowEvents] = useState<PersistedFlowEvent[]>([]);
  useEffect(() => {
    fetch("/api/flow-events")
      .then(r => r.json())
      .then((data: { events?: PersistedFlowEvent[] }) => {
        if (Array.isArray(data?.events)) setFlowEvents(data.events);
      })
      .catch(() => {/* non-critical */});
  }, []);

  // ── Hot tweets ─────────────────────────────────────────────────
  const [hotTweets, setHotTweets] = useState<HotTweet[]>([]);
  useEffect(() => {
    fetch("/api/social")
      .then(r => r.json())
      .then((data: { hotTweets?: HotTweet[] }) => {
        if (Array.isArray(data?.hotTweets)) setHotTweets(data.hotTweets);
      })
      .catch(() => {/* non-critical */});
  }, []);

  // ── Build + merge + dedupe the significant feed ────────────────
  const items = useMemo<FeedItem[]>(() => {
    const out: FeedItem[] = [];
    const nameOf = (netuid: number, fallback?: string) =>
      fallback || leaderboard.find(s => s.netuid === netuid)?.name || `Subnet ${netuid}`;

    // 1) Signals (strength >= 75)
    for (const sig of signals) {
      if ((Number(sig.strength) || 0) < SIGNAL_MIN_STRENGTH) continue;
      const isWhale = WHALE_SIGNAL_TYPES.has(sig.signal_type);
      const isSell = /sell|warn/.test(sig.signal_type);
      out.push({
        key: `${sig.netuid}:${isWhale ? "whale" : "signal"}`,
        kind: isWhale ? "whale" : "signal",
        netuid: sig.netuid,
        name: nameOf(sig.netuid, sig.subnet_name),
        badge: isWhale ? "WHALE" : "SIGNAL",
        badgeClass: isWhale ? (isSell ? "ag-badge-warn" : "ag-badge-buy") : "ag-badge-dev",
        icon: isWhale ? "whale" : "signal",
        title: sig.title || sig.signal_type.replace(/_/g, " "),
        detail: sig.description || undefined,
        strength: Number(sig.strength) || 0,
        ts: toTs(sig.signal_date || sig.created_at),
      });
    }

    // 2) Flow events (strength >= 75) — no usd field on the persisted shape,
    //    so strength is the significance bar
    for (const ev of flowEvents) {
      if ((Number(ev.strength) || 0) < FLOW_MIN_STRENGTH) continue;
      const isSell = ev.type === "distributing";
      out.push({
        key: `${ev.netuid}:whale`,
        kind: "whale",
        netuid: ev.netuid,
        name: nameOf(ev.netuid, ev.name),
        badge: "WHALE",
        badgeClass: isSell ? "ag-badge-warn" : "ag-badge-buy",
        icon: "whale",
        title: ev.headline || ev.type.replace(/_/g, " "),
        detail: ev.detail || undefined,
        strength: Number(ev.strength) || 0,
        ts: toTs(ev.detectedAt),
      });
    }

    // 3) Viral tweets (heat >= 70)
    for (const tw of hotTweets) {
      if ((Number(tw.heat_score) || 0) < TWEET_MIN_HEAT) continue;
      const who = tw.kol_name || (tw.kol_handle ? `@${tw.kol_handle}` : "KOL");
      const text = (tw.tweet_text || "").replace(/\s+/g, " ").trim();
      out.push({
        key: `${tw.netuid}:viral`,
        kind: "viral",
        netuid: tw.netuid,
        name: nameOf(tw.netuid, tw.subnet_name),
        badge: "VIRAL",
        badgeClass: "ag-badge-info",
        icon: "flame",
        title: `${who} is talking — heat ${Math.round(tw.heat_score)}`,
        detail: text ? (text.length > 180 ? `${text.slice(0, 177)}…` : text) : undefined,
        strength: Number(tw.heat_score) || 0,
        ts: toTs(tw.detected_at),
      });
    }

    // 4) Synthesized moves from the leaderboard (timestamped to the scan)
    const scanTs = toTs(lastScanAt) || Date.now();
    for (const sub of leaderboard as ScoredSubnet[]) {
      const delta = sub.score_delta_24h;
      if (delta != null && Math.abs(delta) >= SCORE_MOVE_MIN) {
        out.push({
          key: `${sub.netuid}:score`,
          kind: "score",
          netuid: sub.netuid,
          name: sub.name || `Subnet ${sub.netuid}`,
          badge: "SCORE MOVE",
          badgeClass: delta >= 0 ? "ag-badge-buy" : "ag-badge-warn",
          icon: delta >= 0 ? "trendUp" : "trendDown",
          title: `aGap ${delta >= 0 ? "+" : ""}${delta.toFixed(1)} → ${Math.round(sub.composite_score)}`,
          detail: `Composite score moved ${delta >= 0 ? "+" : ""}${delta.toFixed(1)} points in 24h — a significant re-rating.`,
          strength: Math.abs(delta) * 5,
          ts: scanTs,
        });
      }

      const pc = sub.price_change_24h;
      if (pc != null && Math.abs(pc) >= PRICE_MOVE_MIN) {
        const priceStr = sub.alpha_price != null ? ` · $${sub.alpha_price.toFixed(sub.alpha_price < 1 ? 4 : 2)}` : "";
        out.push({
          key: `${sub.netuid}:price`,
          kind: "price",
          netuid: sub.netuid,
          name: sub.name || `Subnet ${sub.netuid}`,
          badge: "PRICE MOVE",
          badgeClass: pc >= 0 ? "ag-badge-buy" : "ag-badge-warn",
          icon: pc >= 0 ? "rocket" : "trendDown",
          title: `Price ${pc >= 0 ? "+" : ""}${pc.toFixed(1)}% in 24h${priceStr}`,
          detail: `Alpha moved ${Math.abs(pc).toFixed(1)}% in the last 24 hours — well past the ${PRICE_MOVE_MIN}% significance bar.`,
          strength: Math.abs(pc),
          ts: scanTs,
        });
      }
    }

    // Dedupe: one item per (netuid, kind), keep the strongest
    const best = new Map<string, FeedItem>();
    for (const item of out) {
      const existing = best.get(item.key);
      if (!existing || item.strength > existing.strength) best.set(item.key, item);
    }

    return [...best.values()].sort((a, b) => (b.ts - a.ts) || (b.strength - a.strength));
  }, [signals, flowEvents, hotTweets, leaderboard, lastScanAt]);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter(i => KIND_TO_FILTER[i.kind] === filter)),
    [items, filter],
  );

  const FILTERS: { key: FilterKey; label: string; icon?: AgIconName }[] = [
    { key: "all", label: "All" },
    { key: "whales", label: "Whales", icon: "whale" },
    { key: "signals", label: "Signals", icon: "signal" },
    { key: "social", label: "Social", icon: "flame" },
    { key: "moves", label: "Moves", icon: "trendUp" },
  ];

  const loading = scanning && items.length === 0;

  // Free tier: 3 clear items + ~8 blurred inside the gate. Never the full list.
  const freeClear = filtered.slice(0, 3);
  const freeBlurred = filtered.slice(3, 11);
  const premiumVisible = filtered.slice(0, visibleLimit);

  return (
    <main className="flex-1 flex overflow-x-hidden ag-aurora">
      <div className="flex-1 overflow-auto max-w-full">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className="relative px-4 md:px-6 pt-9 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl md:text-[40px] font-semibold tracking-[-0.03em] text-white leading-tight mb-2">
                The <span className="ag-gradient-text">Feed</span>
              </h1>
              <p className="text-sm md:text-[14.5px] text-gray-400 max-w-xl leading-[1.65] mb-4">
                Only what matters — the significant moves across the whole network.
              </p>
              <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-wider text-gray-500 uppercase">
                <span className="ag-live-dot" />
                <span className="tabular-nums">
                  {items.length} SIGNIFICANT EVENT{items.length === 1 ? "" : "S"}
                  {lastScanAt ? ` · UPDATED ${timeAgoShort(toTs(lastScanAt)).toUpperCase()}` : ""}
                </span>
              </div>
            </div>
            {scanning && items.length > 0 && (
              <div className="flex items-center gap-2 mt-1 flex-shrink-0">
                <div className="w-4 h-4 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
                <span className="text-xs text-gray-500">refreshing</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 md:p-6 pt-2">
          <div className="max-w-2xl mx-auto md:mx-0">
            {/* Filter pills */}
            <div className="ag-pill-tabs flex-wrap mb-5">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`ag-pill-tab !px-3.5 !py-2 !text-xs ${f.icon ? "flex items-center gap-1.5" : ""} ${filter === f.key ? "ag-pill-tab-on" : ""}`}
                >
                  {f.icon && <AgIcon name={f.icon} className="w-3.5 h-3.5" />}
                  {f.label}
                </button>
              ))}
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center h-72 text-center">
                <div className="w-10 h-10 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin mb-5" />
                <h2 className="font-display text-xl font-semibold mb-2">Building the Feed…</h2>
                <p className="text-gray-500 max-w-md text-sm">Filtering the network down to what actually matters.</p>
              </div>
            )}

            {/* Empty */}
            {!loading && filtered.length === 0 && (
              <div className="ag-glass flex flex-col items-center justify-center h-64 text-center">
                <AgIcon name="radar" className="w-12 h-12 text-emerald-400/60 mb-4" />
                <h2 className="font-display text-lg font-semibold mb-1">Quiet Out There</h2>
                <p className="text-gray-500 text-sm max-w-sm">
                  Nothing has cleared the significance bar{filter !== "all" ? " in this category" : ""} yet. That is the point — no noise.
                </p>
              </div>
            )}

            {/* Feed */}
            {!loading && filtered.length > 0 && (
              <div className="flex flex-col gap-2.5">
                {isPremium ? (
                  <>
                    {premiumVisible.map(item => (
                      <FeedCard key={item.key} item={item} onClick={() => router.push(`/subnets/${item.netuid}`)} />
                    ))}
                    {filtered.length > visibleLimit && (
                      <button
                        onClick={() => setVisibleLimit(v => v + PAGE)}
                        className="ag-glass ag-glass-hover py-3.5 text-sm text-emerald-400 font-semibold"
                      >
                        Load more · {filtered.length - visibleLimit} older events
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {freeClear.map(item => (
                      <FeedCard key={item.key} item={item} onClick={() => router.push(`/subnets/${item.netuid}`)} />
                    ))}
                    {freeBlurred.length > 0 && (
                      <BlurGate tier={tier} required="premium" minHeight="300px">
                        <div className="flex flex-col gap-2.5">
                          {freeBlurred.map(item => (
                            <FeedCard key={item.key} item={item} onClick={() => {}} />
                          ))}
                        </div>
                      </BlurGate>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Feed card ───────────────────────────────────────────────────────
function FeedCard({ item, onClick }: { item: FeedItem; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="ag-glass ag-glass-hover cursor-pointer !rounded-2xl px-4 py-3.5"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <SubnetLogo netuid={item.netuid} name={item.name} size={32} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-display font-semibold text-white text-sm truncate max-w-[45%] sm:max-w-none">
              {item.name}
            </span>
            <span className="font-mono text-[10px] text-gray-600 tabular-nums">
              SN{item.netuid}{item.ts ? ` · ${timeAgoShort(item.ts)}` : ""}
            </span>
            <span className={`ag-badge ${item.badgeClass} ml-auto inline-flex items-center gap-1 flex-shrink-0`}>
              <AgIcon name={item.icon} className="w-3 h-3" />
              {item.badge}
            </span>
          </div>
          <p className="text-sm text-gray-200 font-medium leading-snug">{item.title}</p>
          {item.detail && (
            <p className="text-xs text-gray-500 leading-relaxed mt-1 line-clamp-2">{item.detail}</p>
          )}
        </div>
      </div>
    </div>
  );
}
