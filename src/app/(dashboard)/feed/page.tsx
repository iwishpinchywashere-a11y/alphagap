"use client";

/**
 * /feed — The Feed. One page for everything that matters.
 *
 * Merges the MOST significant events from every AlphaGap surface — dev
 * signals, capital flow, social, audit, benchmarks, whale tracker,
 * conviction — into a single chronological timeline. Default thresholds are
 * deliberately strict (flow especially: only very large transactions);
 * users can customize sources + sensitivity at the top, persisted per
 * browser.
 */

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import AgIcon, { type AgIconName } from "@/components/AgIcon";
import BlurGate from "@/components/BlurGate";
import { getTier, canAccessPremium } from "@/lib/subscription";
import { BENCHMARK_DATA } from "@/lib/benchmarks";

/* ── Types ────────────────────────────────────────────────────────── */

type SourceKey = "dev" | "flow" | "social" | "audit" | "benchmark" | "whales" | "conviction" | "moves";
type Sensitivity = "strict" | "high" | "all";

interface FeedItem {
  id: string;
  source: SourceKey;
  kind: string;        // short label rendered on the chip, e.g. "WHALE FLOW"
  netuid: number;
  name: string;
  ts: number;          // epoch ms for sorting/grouping
  title: string;
  body?: string;
  metric?: string;     // right-side emphasis, e.g. "+$1.2M" or "96"
  metricTone?: "up" | "down" | "hot" | "flat";
  weight: number;      // significance 0-100 (sort tiebreak within a day)
}

interface FlowEvent {
  netuid: number; name: string; type: string; strength: number;
  headline: string; detail?: string; netFlow?: number; volumeRatio?: number;
  change24h?: number; detectedAt: string;
}
interface HotTweet {
  netuid: number; subnet_name?: string; kol_name?: string; kol_handle?: string;
  tweet_text?: string; heat_score?: number; detected_at?: string; engagement?: number;
}
interface DiscordEntry {
  netuid: number; name?: string; alphaScore?: number; summary?: string;
  lastActivityAt?: string; scannedAt?: string; releaseHint?: boolean; founderPost?: boolean;
}
interface WhaleEntry { netuid: number; subnetName?: string; signal?: string; entryAt?: string; status?: string; }
interface ConvictionRow { netuid: number; name?: string; priceUsd?: number; totalConvictionAlpha?: number; }
interface AuditRow { netuid: number; name?: string; grade?: string; operationalScore?: number; flags?: { type: string; severity: string; message: string }[]; updatedAt?: string; }

/* ── Thresholds per sensitivity ───────────────────────────────────── */
// STRICT is the default: only the biggest events survive. Flow is
// intentionally extreme — only very large net transactions appear.
const THRESHOLDS: Record<Sensitivity, {
  dev: number; flowUsd: number; heat: number; discord: number;
  scoreMove: number; priceMove: number; benchDays: number; auditSev: "critical" | "warning";
}> = {
  strict: { dev: 85, flowUsd: 500_000, heat: 85, discord: 85, scoreMove: 12, priceMove: 25, benchDays: 10, auditSev: "critical" },
  high:   { dev: 70, flowUsd: 150_000, heat: 70, discord: 72, scoreMove: 8,  priceMove: 15, benchDays: 21, auditSev: "critical" },
  all:    { dev: 55, flowUsd: 50_000,  heat: 55, discord: 60, scoreMove: 5,  priceMove: 10, benchDays: 45, auditSev: "warning" },
};

const SOURCES: { key: SourceKey; label: string; icon: AgIconName }[] = [
  { key: "dev",        label: "Dev",        icon: "bolt" },
  { key: "flow",       label: "Flow",       icon: "wave" },
  { key: "social",     label: "Social",     icon: "flame" },
  { key: "audit",      label: "Audit",      icon: "shield" },
  { key: "benchmark",  label: "Benchmarks", icon: "crown" },
  { key: "whales",     label: "Whales",     icon: "whale" },
  { key: "conviction", label: "Conviction", icon: "lock" },
  { key: "moves",      label: "Big Moves",  icon: "trendUp" },
];

const SOURCE_TONE: Record<SourceKey, { text: string; ring: string; bg: string }> = {
  dev:        { text: "text-emerald-300", ring: "border-emerald-400/35", bg: "bg-emerald-500/10" },
  flow:       { text: "text-teal-300",    ring: "border-teal-400/35",    bg: "bg-teal-500/10" },
  social:     { text: "text-amber-300",   ring: "border-amber-400/35",   bg: "bg-amber-500/10" },
  audit:      { text: "text-red-300",     ring: "border-red-400/35",     bg: "bg-red-500/10" },
  benchmark:  { text: "text-sky-300",     ring: "border-sky-400/35",     bg: "bg-sky-500/10" },
  whales:     { text: "text-violet-300",  ring: "border-violet-400/35",  bg: "bg-violet-500/10" },
  conviction: { text: "text-fuchsia-300", ring: "border-fuchsia-400/35", bg: "bg-fuchsia-500/10" },
  moves:      { text: "text-emerald-300", ring: "border-emerald-400/35", bg: "bg-emerald-500/10" },
};

const SOURCE_ICON: Record<SourceKey, AgIconName> = {
  dev: "bolt", flow: "wave", social: "flame", audit: "shield",
  benchmark: "crown", whales: "whale", conviction: "lock", moves: "trendUp",
};

/* ── Helpers ──────────────────────────────────────────────────────── */

const stripEmoji = (s: string) =>
  s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, "").trim();

const fmtUsd = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${(a / 1e3).toFixed(0)}K` : `$${a.toFixed(0)}`;
  return (v >= 0 ? "+" : "−") + s;
};

const timeAgo = (ts: number) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const dayLabel = (ts: number) => {
  const d = new Date(ts); const now = new Date();
  const key = d.toDateString();
  if (key === now.toDateString()) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (key === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
};

const FILTER_LS_KEY = "ag-feed-filters-v1";

/* ── Page ─────────────────────────────────────────────────────────── */

export default function FeedPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const tier = getTier(session);
  const isPremium = canAccessPremium(tier);
  const { signals, leaderboard, taoPrice, lastScanAt } = useDashboard();

  // ── Filters (persisted) ──
  const [sources, setSources] = useState<Set<SourceKey>>(new Set(SOURCES.map(s => s.key)));
  const [sensitivity, setSensitivity] = useState<Sensitivity>("strict");
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_LS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p.sources) && p.sources.length) setSources(new Set(p.sources));
        if (p.sensitivity === "strict" || p.sensitivity === "high" || p.sensitivity === "all") setSensitivity(p.sensitivity);
      }
    } catch { /* defaults */ }
    setFiltersLoaded(true);
  }, []);
  useEffect(() => {
    if (!filtersLoaded) return;
    try { localStorage.setItem(FILTER_LS_KEY, JSON.stringify({ sources: [...sources], sensitivity })); } catch { /* ignore */ }
  }, [sources, sensitivity, filtersLoaded]);

  const toggleSource = (k: SourceKey) => setSources(prev => {
    const next = new Set(prev);
    if (next.has(k)) { if (next.size > 1) next.delete(k); } else next.add(k);
    return next;
  });

  // ── Secondary data fetches (all defensive) ──
  const [flowEvents, setFlowEvents] = useState<FlowEvent[]>([]);
  const [hotTweets, setHotTweets] = useState<HotTweet[]>([]);
  const [discord, setDiscord] = useState<DiscordEntry[]>([]);
  const [whales, setWhales] = useState<WhaleEntry[]>([]);
  const [conviction, setConviction] = useState<ConvictionRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  useEffect(() => {
    fetch("/api/flow-events").then(r => r.ok ? r.json() : []).then(d => setFlowEvents(Array.isArray(d) ? d : d?.events ?? [])).catch(() => {});
    fetch("/api/social").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.hotTweets) setHotTweets(d.hotTweets);
      if (d?.discordLeaderboard) setDiscord(d.discordLeaderboard);
    }).catch(() => {});
    fetch("/api/whale-tracker").then(r => r.ok ? r.json() : null).then(d => { if (d?.entries) setWhales(d.entries); }).catch(() => {});
    fetch("/api/conviction").then(r => r.ok ? r.json() : null).then(d => { if (d?.rows) setConviction(d.rows); }).catch(() => {});
    fetch("/api/audits").then(r => r.ok ? r.json() : null).then(d => { if (d?.subnets) setAudits(d.subnets); }).catch(() => {});
  }, []);

  const [visibleLimit, setVisibleLimit] = useState(30);
  useEffect(() => { setVisibleLimit(30); }, [sources, sensitivity]);

  /* ── Build the merged feed ── */
  const items = useMemo<FeedItem[]>(() => {
    const t = THRESHOLDS[sensitivity];
    const scanTs = lastScanAt ? new Date(lastScanAt).getTime() : Date.now();
    const nameOf = (netuid: number, fallback?: string) =>
      leaderboard.find(l => l.netuid === netuid)?.name || fallback || `SN${netuid}`;
    const out: FeedItem[] = [];

    // DEV — high-strength dev signals only
    if (sources.has("dev")) {
      for (const s of signals) {
        const isDev = /dev|commit|github|release/i.test(s.signal_type);
        if (!isDev || (s.strength ?? 0) < t.dev) continue;
        const ts = new Date(s.signal_date || s.created_at || scanTs).getTime();
        out.push({
          id: `dev-${s.netuid}-${(s.signal_date || s.created_at || "").slice(0, 10)}`,
          source: "dev", kind: "DEV SIGNAL", netuid: s.netuid,
          name: s.subnet_name || nameOf(s.netuid), ts,
          title: stripEmoji(s.title || "Major development activity"),
          metric: String(s.strength), metricTone: "hot",
          weight: s.strength ?? 0,
        });
      }
    }

    // FLOW — extremely high bar: very large net USD flow only
    if (sources.has("flow") && taoPrice) {
      for (const ev of flowEvents) {
        const usd = (ev.netFlow ?? 0) * taoPrice;
        if (Math.abs(usd) < t.flowUsd) continue;
        out.push({
          id: `flow-${ev.netuid}-${ev.detectedAt}`,
          source: "flow", kind: usd >= 0 ? "MAJOR INFLOW" : "MAJOR OUTFLOW",
          netuid: ev.netuid, name: ev.name || nameOf(ev.netuid),
          ts: new Date(ev.detectedAt).getTime(),
          title: stripEmoji(ev.headline || "Very large net flow"),
          body: ev.detail ? stripEmoji(ev.detail) : undefined,
          metric: fmtUsd(usd), metricTone: usd >= 0 ? "up" : "down",
          weight: Math.min(100, 60 + Math.abs(usd) / 50_000),
        });
      }
    }

    // SOCIAL — hottest tweets + top discord alpha only
    if (sources.has("social")) {
      for (const tw of hotTweets) {
        if ((tw.heat_score ?? 0) < t.heat) continue;
        out.push({
          id: `tw-${tw.netuid}-${tw.detected_at}`,
          source: "social", kind: "VIRAL KOL", netuid: tw.netuid,
          name: tw.subnet_name || nameOf(tw.netuid),
          ts: new Date(tw.detected_at || scanTs).getTime(),
          title: `${tw.kol_name || "@" + (tw.kol_handle || "kol")} on ${tw.subnet_name || `SN${tw.netuid}`}`,
          body: stripEmoji((tw.tweet_text || "").slice(0, 180)),
          metric: String(tw.heat_score), metricTone: "hot",
          weight: tw.heat_score ?? 0,
        });
      }
      for (const d of discord) {
        if (d.founderPost) continue;
        const score = d.alphaScore ?? 0;
        const qualifies = score >= t.discord || (d.releaseHint && score >= t.discord - 10);
        if (!qualifies) continue;
        out.push({
          id: `dc-${d.netuid}-${(d.lastActivityAt || d.scannedAt || "").slice(0, 13)}`,
          source: "social", kind: d.releaseHint ? "RELEASE HINT" : "DISCORD ALPHA",
          netuid: d.netuid, name: d.name || nameOf(d.netuid),
          ts: new Date(d.lastActivityAt || d.scannedAt || scanTs).getTime(),
          title: stripEmoji((d.summary || "High-signal Discord activity").slice(0, 160)),
          metric: String(score), metricTone: "hot",
          weight: score,
        });
      }
    }

    // AUDIT — flagged operational problems (critical by default)
    if (sources.has("audit")) {
      for (const a of audits) {
        const flags = (a.flags ?? []).filter(f =>
          t.auditSev === "critical" ? f.severity === "critical" : f.severity === "critical" || f.severity === "warning"
        );
        if (flags.length === 0) continue;
        const worst = flags.find(f => f.severity === "critical") ?? flags[0];
        out.push({
          id: `aud-${a.netuid}-${worst.type}`,
          source: "audit", kind: worst.severity === "critical" ? "CRITICAL AUDIT" : "AUDIT WARNING",
          netuid: a.netuid, name: a.name || nameOf(a.netuid),
          ts: new Date(a.updatedAt || scanTs).getTime(),
          title: stripEmoji(worst.message),
          metric: a.grade || "—", metricTone: "down",
          weight: worst.severity === "critical" ? 90 : 70,
        });
      }
    }

    // BENCHMARK — recently verified product benchmarks
    if (sources.has("benchmark")) {
      const cutoff = Date.now() - t.benchDays * 86_400_000;
      for (const b of BENCHMARK_DATA) {
        const ts = new Date(b.last_updated).getTime();
        if (!ts || ts < cutoff) continue;
        out.push({
          id: `bench-${b.subnet_id}-${b.last_updated}`,
          source: "benchmark", kind: "BENCHMARK VERIFIED",
          netuid: b.subnet_id, name: b.subnet_name, ts,
          title: stripEmoji(b.perf_delta || `${b.benchmark_category} benchmark updated`),
          metric: `${b.benchmark_score}`, metricTone: b.benchmark_score >= 80 ? "up" : "flat",
          weight: b.benchmark_score,
        });
      }
    }

    // WHALES — fresh tracker entries (accumulating/distributing)
    if (sources.has("whales")) {
      const cutoff = Date.now() - 72 * 3_600_000;
      for (const w of whales) {
        const ts = new Date(w.entryAt || 0).getTime();
        if (w.status !== "active" || !ts || ts < cutoff) continue;
        const acc = w.signal === "accumulating";
        out.push({
          id: `wh-${w.netuid}-${w.entryAt}`,
          source: "whales", kind: acc ? "WHALE ACCUMULATION" : "WHALE DISTRIBUTION",
          netuid: w.netuid, name: w.subnetName || nameOf(w.netuid), ts,
          title: acc
            ? "Smart-money wallets are net accumulating this subnet"
            : "Smart-money wallets are net distributing this subnet",
          metric: acc ? "ACC" : "DIST", metricTone: acc ? "up" : "down",
          weight: 75,
        });
      }
    }

    // CONVICTION — largest active conviction lockups (top 3, USD-gated)
    if (sources.has("conviction") && conviction.length) {
      const rows = conviction
        .map(c => ({ ...c, usd: (c.totalConvictionAlpha ?? 0) * (c.priceUsd ?? 0) }))
        .filter(c => c.usd >= 1_000_000)
        .sort((a, b) => b.usd - a.usd)
        .slice(0, 3);
      for (const c of rows) {
        out.push({
          id: `conv-${c.netuid}`,
          source: "conviction", kind: "CONVICTION LOCK",
          netuid: c.netuid, name: c.name || nameOf(c.netuid), ts: scanTs,
          title: `${fmtUsd(c.usd).replace("+", "")} of alpha voluntarily locked — holders committing long-term`,
          metric: fmtUsd(c.usd).replace("+", ""), metricTone: "up",
          weight: Math.min(95, 60 + c.usd / 1_000_000),
        });
      }
    }

    // BIG MOVES — synthesized from the leaderboard (score + price swings).
    // Collected separately and capped: every one of these carries the same
    // scan timestamp, so uncapped they'd flood the top of today's feed and
    // bury the rarer, genuinely bigger events (whales, flow, dev).
    const moveItems: FeedItem[] = [];
    if (sources.has("moves")) {
      for (const l of leaderboard) {
        const dScore = (l as { score_delta_24h?: number }).score_delta_24h ?? 0;
        if (Math.abs(dScore) >= t.scoreMove) {
          moveItems.push({
            id: `mv-s-${l.netuid}`,
            source: "moves", kind: dScore > 0 ? "SCORE SURGE" : "SCORE DROP",
            netuid: l.netuid, name: l.name, ts: scanTs,
            title: `aGap score ${dScore > 0 ? "jumped" : "fell"} ${Math.abs(Math.round(dScore))} points in 24h — now ${Math.round(l.composite_score)}`,
            metric: `${dScore > 0 ? "+" : ""}${Math.round(dScore)}`, metricTone: dScore > 0 ? "up" : "down",
            weight: 50 + Math.min(40, Math.abs(dScore) * 2),
          });
        }
        const dPrice = l.price_change_24h ?? 0;
        if (Math.abs(dPrice) >= t.priceMove) {
          moveItems.push({
            id: `mv-p-${l.netuid}`,
            source: "moves", kind: dPrice > 0 ? "PRICE SURGE" : "PRICE DUMP",
            netuid: l.netuid, name: l.name, ts: scanTs,
            title: `Price ${dPrice > 0 ? "up" : "down"} ${Math.abs(dPrice).toFixed(0)}% in 24 hours`,
            metric: `${dPrice > 0 ? "+" : ""}${dPrice.toFixed(0)}%`, metricTone: dPrice > 0 ? "up" : "down",
            weight: 50 + Math.min(40, Math.abs(dPrice)),
          });
        }
      }
    }

    // Keep only the biggest moves so they punctuate the feed instead of
    // flooding it (8 at strict, more as sensitivity loosens).
    const moveCap = sensitivity === "strict" ? 8 : sensitivity === "high" ? 14 : 24;
    moveItems.sort((a, b) => b.weight - a.weight);
    out.push(...moveItems.slice(0, moveCap));

    // Dedupe by id, then sort by DAY (newest first) and by significance
    // WITHIN each day. Pure timestamp sorting buried real events under the
    // synthesized leaderboard "moves", which all share the scan timestamp.
    const seen = new Map<string, FeedItem>();
    for (const it of out) {
      const prev = seen.get(it.id);
      if (!prev || it.weight > prev.weight) seen.set(it.id, it);
    }
    const dayOf = (ts: number) => new Date(ts).toDateString();
    return [...seen.values()].sort((a, b) => {
      const da = new Date(dayOf(a.ts)).getTime();
      const db = new Date(dayOf(b.ts)).getTime();
      if (db !== da) return db - da;
      return (b.weight - a.weight) || (b.ts - a.ts);
    });
  }, [sources, sensitivity, signals, leaderboard, taoPrice, lastScanAt, flowEvents, hotTweets, discord, whales, conviction, audits]);

  /* ── Grouping by day ── */
  const visible = isPremium ? items.slice(0, visibleLimit) : items.slice(0, 3);
  const gatedPreview = isPremium ? [] : items.slice(3, 9);
  const groups = useMemo(() => {
    const g: { label: string; items: FeedItem[] }[] = [];
    for (const it of visible) {
      const label = dayLabel(it.ts);
      const last = g[g.length - 1];
      if (last && last.label === label) last.items.push(it);
      else g.push({ label, items: [it] });
    }
    return g;
  }, [visible]);

  /* ── Render ── */
  return (
    <main className="flex-1 bg-[#07090b] text-white ag-aurora">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-9 pb-24">

        {/* Hero */}
        <h1 className="font-display text-[34px] sm:text-[42px] font-semibold tracking-[-0.035em] leading-[1.05] mb-2">
          The <span className="ag-gradient-text">Feed</span>
        </h1>
        <p className="text-[#9aa39e] text-[14.5px] leading-relaxed max-w-lg mb-1">
          Everything that matters across the whole network, one timeline. Strict by default — only the biggest events make the cut.
        </p>
        <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#5d665f] mt-3 mb-6">
          <span className="ag-live-dot" />
          {items.length} significant events · {sensitivity === "strict" ? "strict" : sensitivity === "high" ? "high" : "everything"} sensitivity
        </div>

        {/* ── Filter bar ── */}
        <div className="ag-glass p-3.5 sm:p-4 mb-8 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#5d665f]">Your feed</span>
            <div className="ag-pill-tabs !p-1">
              {(["strict", "high", "all"] as Sensitivity[]).map(s => (
                <button key={s} onClick={() => setSensitivity(s)}
                  className={`ag-pill-tab !px-3.5 !py-1 !text-[11px] capitalize ${sensitivity === s ? "ag-pill-tab-on" : ""}`}>
                  {s === "all" ? "Everything" : s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SOURCES.map(s => {
              const on = sources.has(s.key);
              return (
                <button key={s.key} onClick={() => toggleSource(s.key)}
                  className={`flex items-center gap-1.5 flex-shrink-0 text-[11.5px] font-medium rounded-full px-3 py-1.5 border transition-all ${
                    on
                      ? `${SOURCE_TONE[s.key].text} ${SOURCE_TONE[s.key].ring} ${SOURCE_TONE[s.key].bg}`
                      : "text-[#5d665f] border-white/[0.08] bg-white/[0.02] opacity-60"
                  }`}>
                  <AgIcon name={s.icon} className="w-3 h-3" />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Timeline ── */}
        {items.length === 0 ? (
          <div className="ag-glass p-10 text-center">
            <AgIcon name="radar" className="w-9 h-9 text-[#5d665f] mx-auto mb-3" />
            <p className="text-sm text-[#9aa39e]">Nothing clears the bar right now.</p>
            <p className="text-xs text-[#5d665f] mt-1">Lower the sensitivity or enable more sources above.</p>
          </div>
        ) : (
          <div className="relative">
            {/* vertical rail */}
            <div className="absolute left-[17px] top-2 bottom-2 w-px bg-gradient-to-b from-emerald-400/25 via-white/[0.07] to-transparent hidden sm:block" aria-hidden />
            {groups.map(group => (
              <div key={group.label} className="mb-2">
                <div className="sm:pl-12 mb-3 mt-6 first:mt-0">
                  <span className="font-display text-[13px] font-semibold tracking-[0.01em] text-white/80">{group.label}</span>
                </div>
                <div className="space-y-3">
                  {group.items.map(it => <FeedCard key={it.id} it={it} onOpen={() => router.push(`/subnets/${it.netuid}`)} />)}
                </div>
              </div>
            ))}

            {/* Free-tier gate: 3 visible + short blurred preview only */}
            {!isPremium && gatedPreview.length > 0 && (
              <div className="mt-3">
                <BlurGate tier={tier} required="premium" minHeight="260px">
                  <div className="space-y-3">
                    {gatedPreview.map(it => <FeedCard key={it.id} it={it} onOpen={() => {}} />)}
                  </div>
                </BlurGate>
              </div>
            )}

            {isPremium && items.length > visibleLimit && (
              <button onClick={() => setVisibleLimit(v => v + 30)}
                className="ag-glass ag-glass-hover w-full mt-5 py-3.5 text-sm text-emerald-400 font-semibold">
                Load more · {items.length - visibleLimit} earlier events
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

/* ── Card ─────────────────────────────────────────────────────────── */

function FeedCard({ it, onOpen }: { it: FeedItem; onOpen: () => void }) {
  const tone = SOURCE_TONE[it.source];
  const metricColor =
    it.metricTone === "up" ? "text-emerald-400" :
    it.metricTone === "down" ? "text-red-400" :
    it.metricTone === "hot" ? "text-amber-300" : "text-white/80";
  return (
    <div className="flex items-start gap-3 sm:gap-0">
      {/* rail node (desktop) */}
      <div className={`hidden sm:flex w-9 h-9 rounded-full border ${tone.ring} ${tone.bg} items-center justify-center flex-shrink-0 mt-4 z-10 backdrop-blur-md`}>
        <AgIcon name={SOURCE_ICON[it.source]} className={`w-4 h-4 ${tone.text}`} />
      </div>
      <div onClick={onOpen}
        className="ag-glass ag-glass-hover cursor-pointer flex-1 p-4 sm:p-5 sm:ml-3 min-w-0">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`sm:hidden inline-flex w-6 h-6 rounded-full border ${tone.ring} ${tone.bg} items-center justify-center flex-shrink-0`}>
            <AgIcon name={SOURCE_ICON[it.source]} className={`w-3 h-3 ${tone.text}`} />
          </span>
          <span className={`font-mono text-[9px] tracking-[0.16em] px-2 py-0.5 rounded-full border ${tone.ring} ${tone.bg} ${tone.text}`}>{it.kind}</span>
          <span className="font-mono text-[10px] text-[#5d665f] ml-auto flex-shrink-0">{timeAgo(it.ts)}</span>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5"><SubnetLogo netuid={it.netuid} name={it.name} size={30} /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-display font-bold text-[16.5px] tracking-[-0.01em] text-white">{it.name}</span>
              <span className="font-mono text-[10px] text-[#5d665f]">SN{it.netuid}</span>
            </div>
            <p className="text-[14px] text-[#c6cdc9] leading-relaxed mt-1">{it.title}</p>
            {it.body && <p className="text-[12.5px] text-[#5d665f] leading-relaxed mt-1.5 line-clamp-2">{it.body}</p>}
          </div>
          {it.metric && (
            <div className="flex-shrink-0 text-right">
              <div className={`font-display font-bold text-[19px] tabular-nums ${metricColor}`}>{it.metric}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
