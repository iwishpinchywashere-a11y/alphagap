"use client";

/**
 * /feed — one written card per subnet with real recent activity.
 *
 * This replaces the filterable raw-signal firehose. The old page surfaced
 * every flow blip and made the reader assemble the story with filter
 * controls; now a 6-hourly cron (api/cron/feed-digest) aggregates 48h of
 * signals per subnet, applies a materiality bar, and writes one short card
 * for each subnet that actually did something. The page just renders them —
 * no filters, no sensitivity sliders, one feed.
 */

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import AgIcon from "@/components/AgIcon";
import BlurGate from "@/components/BlurGate";
import { getTier } from "@/lib/subscription";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { useWatchlist } from "@/components/dashboard/WatchlistProvider";
import type { FeedCard } from "@/app/api/cron/feed-digest/route";


interface SubnetScoreLite {
  netuid: number; name: string; composite_score: number;
  price_change_24h?: number; sparkline_prices?: number[];
  emission_change_pct?: number; apy_7d?: number;
}
function topBy(
  rows: SubnetScoreLite[],
  pick: (r: SubnetScoreLite) => number | undefined,
  dir: "asc" | "desc",
): { netuid: number; name: string; value: number }[] {
  return rows
    .map(r => ({ netuid: r.netuid, name: r.name, value: pick(r) }))
    .filter((r): r is { netuid: number; name: string; value: number } => r.value != null && Number.isFinite(r.value) && r.value !== 0)
    .sort((a, b) => (dir === "desc" ? b.value - a.value : a.value - b.value))
    .slice(0, 5);
}


const TAG_TONE: Record<string, string> = {
  DEV: "text-emerald-300 border-emerald-500/30 bg-emerald-500/[0.08]",
  MODEL: "text-teal-300 border-teal-500/30 bg-teal-500/[0.08]",
  EMISSIONS: "text-violet-300 border-violet-500/30 bg-violet-500/[0.08]",
  SCORE: "text-lime-300 border-lime-500/30 bg-lime-500/[0.08]",
  PRICE: "text-yellow-300 border-yellow-500/30 bg-yellow-500/[0.08]",
  SOCIAL: "text-sky-300 border-sky-500/30 bg-sky-500/[0.08]",
  WHALE: "text-amber-300 border-amber-500/30 bg-amber-500/[0.08]",
  FLOW: "text-cyan-300 border-cyan-500/30 bg-cyan-500/[0.08]",
};


/** Inline sparkline sized for the card header — line only, no area fill. */
function MiniSpark({ points, up }: { points: number[]; up: boolean }) {
  if (!points || points.length < 2) return null;
  const w = 64, h = 18;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / range) * (h - 4) - 2;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-16 h-[18px] flex-shrink-0" preserveAspectRatio="none" aria-hidden>
      <path d={path} fill="none" stroke={up ? "#34d399" : "#f87171"} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function timeAgo(iso: string): string {
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (h < 1) return "just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

export default function FeedPage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const router = useRouter();
  const { leaderboard, taoPrice } = useDashboard();
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const { watchlist } = useWatchlist();
  const [watchOnly, setWatchOnly] = useState(false);
  // Persisted so the choice survives navigation, like the old feed's filters did.
  useEffect(() => {
    try { setWatchOnly(localStorage.getItem("ag-feed-watchonly") === "1"); } catch {}
  }, []);
  const toggleWatchOnly = () => {
    setWatchOnly(v => {
      try { localStorage.setItem("ag-feed-watchonly", v ? "0" : "1"); } catch {}
      return !v;
    });
  };

  useEffect(() => {
    fetch("/api/feed-digest")
      .then((r) => (r.ok ? r.json() : { cards: [] }))
      .then((d) => setCards(Array.isArray(d?.cards) ? d.cards : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 90d sparkline per subnet, from the leaderboard the page already holds.
  const sparkBy = new Map<number, { points: number[]; up: boolean }>();
  for (const l of leaderboard) {
    if (l.sparkline_prices && l.sparkline_prices.length >= 2) {
      sparkBy.set(l.netuid, { points: l.sparkline_prices, up: (l.price_change_24h ?? 0) >= 0 });
    }
  }

  const visible = watchOnly ? cards.filter((c) => watchlist.has(c.netuid)) : cards;
  const fresh = visible.filter((c) => Date.now() - new Date(c.writtenAt).getTime() < 48 * 3600000);
  const older = visible.filter((c) => Date.now() - new Date(c.writtenAt).getTime() >= 48 * 3600000);

  return (
    <main className="flex-1 bg-[#07090b] text-white ag-aurora">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex gap-6">
      <div className="flex-1 min-w-0 max-w-3xl">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] leading-tight flex items-center gap-2.5">
            <AgIcon name="bolt" className="w-7 h-7 text-emerald-400" />
            <span>The <span className="ag-gradient-text">Feed</span></span>
          </h1>
        </div>
        <p className="text-[14.5px] text-gray-400 max-w-2xl leading-relaxed mb-8">
          What every subnet actually did, one card each — dev work, Discord and X chatter,
          whale moves, emissions and score changes from the last 48 hours. Quiet subnets don&apos;t post.
        </p>

        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={toggleWatchOnly}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              watchOnly
                ? "bg-emerald-500/[0.12] border-emerald-500/35 text-emerald-300"
                : "bg-white/[0.02] border-white/8 text-gray-500 hover:text-gray-300 hover:bg-white/[0.05]"
            }`}
          >
            <AgIcon name="star" className="w-3.5 h-3.5" />
            My Watchlist{watchOnly && watchlist.size > 0 ? ` · ${visible.length}` : ""}
          </button>
          {watchOnly && watchlist.size === 0 && (
            <span className="text-xs text-gray-600">
              Your watchlist is empty — star subnets to see them here.
            </span>
          )}
        </div>

        <BlurGate tier={tier} required="premium" minHeight="400px">
          {loading && (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="ag-glass rounded-2xl h-36 animate-pulse bg-white/[0.02]" />
              ))}
            </div>
          )}

          {!loading && cards.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              No updates yet — cards generate every six hours from the latest scan.
            </div>
          )}
          {!loading && cards.length > 0 && visible.length === 0 && watchOnly && (
            <div className="text-center py-16 text-gray-600">
              None of your watchlist subnets have updates right now — quiet is information too.
            </div>
          )}

          <div className="space-y-4">
            {fresh.map((c) => <Card key={c.netuid} c={c} spark={sparkBy.get(c.netuid)} />)}
          </div>

          {older.length > 0 && (
            <>
              <div className="flex items-center gap-3 mt-10 mb-4">
                <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-gray-600">Earlier this week</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
              <div className="space-y-4 opacity-80">
                {older.map((c) => <Card key={c.netuid} c={c} spark={sparkBy.get(c.netuid)} />)}
              </div>
            </>
          )}
        </BlurGate>
      </div>

      {/* ── Market rail (restored from the old feed — the digest replaced the
             signal list, not the sidebar) ── */}
      <aside className="hidden lg:block w-[320px] flex-shrink-0">
        <div className="sticky top-6 space-y-4">
          <TaoCard taoPrice={taoPrice} leaderboard={leaderboard} />
          <MoversCard leaderboard={leaderboard} onOpen={(n) => router.push(`/subnets/${n}`)} />
          <RankBoard
            title="Top price gainers · 24h"
            rows={topBy(leaderboard, l => l.price_change_24h, "desc")}
            format={v => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
            tone="up" onOpen={(n) => router.push(`/subnets/${n}`)}
          />
          <RankBoard
            title="Top price losers · 24h"
            rows={topBy(leaderboard, l => l.price_change_24h, "asc")}
            format={v => `${v.toFixed(1)}%`}
            tone="down" onOpen={(n) => router.push(`/subnets/${n}`)}
          />
          <RankBoard
            title="Top emission gainers"
            rows={topBy(leaderboard, l => l.emission_change_pct, "desc")}
            format={v => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
            tone="up" onOpen={(n) => router.push(`/subnets/${n}`)}
          />
          <RankBoard
            title="Top APY · 7d"
            rows={topBy(leaderboard, l => (l.apy_7d != null ? l.apy_7d * 100 : undefined), "desc")}
            format={v => `${v.toFixed(0)}%`}
            tone="up" onOpen={(n) => router.push(`/subnets/${n}`)}
          />
          <TopScoresCard leaderboard={leaderboard} onOpen={(n) => router.push(`/subnets/${n}`)} />
        </div>
      </aside>
      </div>
    </main>
  );
}

function Card({ c, spark }: { c: FeedCard; spark?: { points: number[]; up: boolean } }) {
  return (
    <article className="ag-glass rounded-2xl p-5 border border-white/[0.07] hover:border-white/[0.14] transition-colors">
      <div className="flex items-start gap-3">
        <Link href={`/subnets/${c.netuid}`} className="flex-shrink-0 mt-0.5">
          <SubnetLogo netuid={c.netuid} name={c.name} size={34} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Link
              href={`/subnets/${c.netuid}`}
              className="text-white font-display font-semibold hover:text-emerald-300 transition-colors"
            >
              {c.name}
            </Link>
            <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/[0.07] border border-emerald-500/20 rounded-full px-1.5 py-px">
              SN{c.netuid}
            </span>
            {spark && <MiniSpark points={spark.points} up={spark.up} />}
            <span className="text-[11px] text-gray-600 ml-auto flex-shrink-0">{timeAgo(c.writtenAt)}</span>
          </div>
          {(c.tags ?? []).length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mb-1.5">
              {(c.tags ?? []).map((t) => (
                <span key={t} className={`text-[9px] font-mono font-semibold tracking-[0.08em] border rounded px-1.5 py-px ${TAG_TONE[t] ?? "text-gray-400 border-white/10 bg-white/[0.04]"}`}>
                  {t}
                </span>
              ))}
            </div>
          )}
          <h2 className="text-[15px] font-semibold text-gray-100 leading-snug mb-1.5">{c.headline}</h2>
          {(c.bullets ?? []).length > 0 ? (
            <ul className="mb-3 space-y-1">
              {c.bullets!.map((b, i) => (
                <li key={i} className="text-[13.5px] text-gray-400 leading-relaxed flex gap-2">
                  <span className="text-emerald-500/60 flex-shrink-0 select-none">›</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-gray-400 leading-relaxed mb-3">{c.body}</p>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            {c.facts.map((f, i) => (
              <span key={i} className="text-[10.5px] font-mono text-gray-500 bg-white/[0.03] border border-white/[0.07] rounded-md px-1.5 py-0.5">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ── Market rail components (verbatim from the pre-digest feed) ── */
function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  if (!points || points.length < 2) return null;
  const w = 280, h = 52;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / range) * (h - 6) - 3;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const stroke = up ? "#34d399" : "#f87171";
  const id = `sp-${up ? "u" : "d"}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[52px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function TaoCard({ taoPrice, leaderboard }: { taoPrice: number | null; leaderboard: SubnetScoreLite[] }) {
  // Network pulse: median 24h move across the leaderboard as a market read
  const changes = leaderboard.map(l => l.price_change_24h ?? 0).filter(Boolean).sort((a, b) => a - b);
  const median = changes.length ? changes[Math.floor(changes.length / 2)] : 0;
  const advancing = leaderboard.filter(l => (l.price_change_24h ?? 0) > 0).length;
  const total = leaderboard.filter(l => l.price_change_24h != null).length || 1;
  const pct = Math.round((advancing / total) * 100);
  return (
    <div className="ag-glass p-5">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#5d665f] mb-2.5">TAO</div>
      <div className="flex items-baseline gap-2.5 mb-4">
        <span className="font-display text-[30px] font-semibold tracking-[-0.02em] tabular-nums">
          {taoPrice ? `$${taoPrice.toFixed(2)}` : "—"}
        </span>
      </div>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[#5d665f] mb-2">Network breadth · 24h</div>
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mb-2">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-400" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between font-mono text-[11px]">
        <span className="text-emerald-400">{advancing} advancing</span>
        <span className={median >= 0 ? "text-emerald-400" : "text-red-400"}>
          median {median >= 0 ? "+" : ""}{median.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function MoversCard({ leaderboard, onOpen }: { leaderboard: SubnetScoreLite[]; onOpen: (n: number) => void }) {
  const movers = [...leaderboard]
    .filter(l => l.price_change_24h != null && l.sparkline_prices?.length)
    .sort((a, b) => Math.abs(b.price_change_24h ?? 0) - Math.abs(a.price_change_24h ?? 0))
    .slice(0, 3);
  if (!movers.length) return null;
  return (
    <div className="ag-glass p-5">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#5d665f] mb-3.5">Biggest movers · 24h</div>
      <div className="space-y-4">
        {movers.map(m => {
          const chg = m.price_change_24h ?? 0;
          return (
            <button key={m.netuid} onClick={() => onOpen(m.netuid)} className="w-full text-left group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <SubnetLogo netuid={m.netuid} name={m.name} size={20} />
                  <span className="font-semibold text-[13.5px] truncate group-hover:text-emerald-400 transition-colors">{m.name}</span>
                  <span className="font-mono text-[9.5px] text-[#5d665f] flex-shrink-0">SN{m.netuid}</span>
                </div>
                <span className={`font-mono text-[12px] font-semibold flex-shrink-0 ${chg >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {chg >= 0 ? "+" : ""}{chg.toFixed(1)}%
                </span>
              </div>
              <Sparkline points={m.sparkline_prices!.slice(-40)} up={chg >= 0} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Compact ranked list used for the gainers/losers/emission/APY boards. */
function RankBoard({
  title, rows, format, tone, onOpen,
}: {
  title: string;
  rows: { netuid: number; name: string; value: number }[];
  format: (v: number) => string;
  tone: "up" | "down";
  onOpen: (n: number) => void;
}) {
  if (!rows.length) return null;
  const valueColor = tone === "up" ? "text-emerald-400" : "text-red-400";
  return (
    <div className="ag-glass p-5">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#5d665f] mb-3.5">{title}</div>
      <div className="space-y-2.5">
        {rows.map((r, i) => (
          <button key={r.netuid} onClick={() => onOpen(r.netuid)} className="w-full flex items-center gap-2.5 group">
            <span className="font-display text-[12px] font-bold text-[#5d665f] w-3.5 flex-shrink-0">{i + 1}</span>
            <SubnetLogo netuid={r.netuid} name={r.name} size={20} />
            <span className="font-semibold text-[13.5px] truncate flex-1 text-left group-hover:text-emerald-400 transition-colors">{r.name}</span>
            <span className={`font-mono text-[12px] font-semibold tabular-nums flex-shrink-0 ${valueColor}`}>{format(r.value)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TopScoresCard({ leaderboard, onOpen }: { leaderboard: SubnetScoreLite[]; onOpen: (n: number) => void }) {
  const top = [...leaderboard]
    .filter(l => (l.composite_score ?? 0) > 0)
    .sort((a, b) => (b.composite_score ?? 0) - (a.composite_score ?? 0))
    .slice(0, 6);
  if (!top.length) return null;
  return (
    <div className="ag-glass p-5">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#5d665f] mb-3.5">Top aGap scores</div>
      <div className="space-y-2.5">
        {top.map((s, i) => (
          <button key={s.netuid} onClick={() => onOpen(s.netuid)} className="w-full flex items-center gap-2.5 group">
            <span className="font-display text-[12px] font-bold text-[#5d665f] w-3.5 flex-shrink-0">{i + 1}</span>
            <SubnetLogo netuid={s.netuid} name={s.name} size={20} />
            <span className="font-semibold text-[13.5px] truncate flex-1 text-left group-hover:text-emerald-400 transition-colors">{s.name}</span>
            <div className="w-14 h-1.5 rounded-full bg-white/[0.06] overflow-hidden flex-shrink-0">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-400" style={{ width: `${s.composite_score}%` }} />
            </div>
            <span className="font-mono text-[12px] font-bold tabular-nums w-6 text-right flex-shrink-0">{Math.round(s.composite_score)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

