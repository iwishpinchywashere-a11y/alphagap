"use client";

/**
 * /benchmarks: the Subnet Valuation Index.
 *
 * Revenue, growth, customers, alpha buybacks and product quality for every
 * Bittensor subnet, each claim carrying its source, joined to live market
 * caps from the chain. Research is in src/data/valuation.json; scoring is in
 * src/lib/valuation.ts; the join happens in /api/valuation.
 *
 * Two numbers are kept apart on purpose: the fundamentals score says how much
 * real business is here, the P/S multiple says what the market is paying for
 * it. The reader decides what is cheap.
 */

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import AgIcon from "@/components/AgIcon";
import BlurGate from "@/components/BlurGate";
import { getTier, canAccessPremium } from "@/lib/subscription";
import { useWatchlist } from "@/components/dashboard/WatchlistProvider";
import { WEIGHTS, type ValuationRow, type Confidence, type BuybackStatus, type GrowthTrend } from "@/lib/valuation";

type SortKey = "index" | "revenue" | "buybacks" | "ps" | "growth" | "product" | "mcap";
type Filter = "all" | "revenue" | "buybacks" | "watchlist";

interface Summary {
  subnets: number; live: number; withRevenue: number;
  confirmedArrUsd: number; reportedArrUsd: number; estimatedArrUsd: number; totalStatedArrUsd: number; creditedArrUsd: number;
  buybacksActive: number; buybacksAnnounced: number; buybacksPlanned: number;
  medianPs: number | null; revenueMarketCapUsd: number; marketObservedAt: string | null; taoUsd: number | null;
}

// ── Formatting ───────────────────────────────────────────────────────────

function fmtUsd(v: number | null | undefined, dash = "-"): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return dash;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 10e6 ? 1 : 2)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
}
const fmtPs = (v: number | null) => (v == null ? "-" : v >= 1000 ? `${Math.round(v)}x` : `${v.toFixed(1)}x`);
const fmtAlpha = (v: number | null) => (v == null || v <= 0 ? "-" : v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : String(Math.round(v)));

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  confirmed: "Confirmed", self_reported: "Self-reported", estimated: "Estimated", pre_revenue: "Pre-revenue", unknown: "Unknown",
};
const CONFIDENCE_TONE: Record<Confidence, string> = {
  confirmed: "text-emerald-300 border-emerald-500/30 bg-emerald-500/[0.08]",
  self_reported: "text-amber-300 border-amber-500/30 bg-amber-500/[0.08]",
  estimated: "text-sky-300 border-sky-500/30 bg-sky-500/[0.08]",
  pre_revenue: "text-gray-400 border-white/10 bg-white/[0.03]",
  unknown: "text-gray-500 border-white/10 bg-white/[0.02]",
};
const BUYBACK_LABEL: Record<BuybackStatus, string> = {
  active: "Buying back", announced: "Announced", planned: "Planned", none: "No buybacks", unknown: "Unknown",
};
const BUYBACK_TONE: Record<BuybackStatus, string> = {
  active: "text-emerald-300 border-emerald-500/35 bg-emerald-500/[0.10]",
  announced: "text-amber-300 border-amber-500/30 bg-amber-500/[0.08]",
  planned: "text-gray-300 border-white/15 bg-white/[0.04]",
  none: "text-gray-500 border-white/10 bg-white/[0.02]",
  unknown: "text-gray-600 border-white/[0.06] bg-transparent",
};
const GROWTH_GLYPH: Record<GrowthTrend, { glyph: string; tone: string; label: string }> = {
  accelerating: { glyph: "▲▲", tone: "text-emerald-400", label: "Accelerating" },
  growing: { glyph: "▲", tone: "text-emerald-400", label: "Growing" },
  flat: { glyph: "▬", tone: "text-gray-400", label: "Flat" },
  declining: { glyph: "▼", tone: "text-red-400", label: "Declining" },
  unknown: { glyph: "·", tone: "text-gray-600", label: "Unknown" },
};

function Pill({ tone, children, title }: { tone: string; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full border px-2 py-0.5 whitespace-nowrap ${tone}`}>
      {children}
    </span>
  );
}

function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const tone = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-green-400" : score >= 40 ? "text-yellow-400" : score >= 20 ? "text-orange-400" : "text-gray-500";
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth="3" fill="none" className="text-white/[0.06]" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)} className={tone} />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center font-display font-semibold tabular-nums ${tone}`} style={{ fontSize: size * 0.32 }}>
        {score}
      </div>
    </div>
  );
}

function Bar({ label, value, weight }: { label: string; value: number; weight: number }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-gray-500 uppercase tracking-widest">{label} <span className="text-gray-700">x{weight}%</span></span>
        <span className="text-gray-300 tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500/70 to-emerald-400" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function Sources({ urls }: { urls: string[] }) {
  if (!urls?.length) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      <span className="text-[10px] text-gray-600">Sources</span>
      {urls.map((u, i) => (
        <a key={i} href={u} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
          title={u} className="text-[10px] text-emerald-500/70 hover:text-emerald-400 underline underline-offset-2">[{i + 1}]</a>
      ))}
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────

function Row({ r, expanded, onToggle, watched }: { r: ValuationRow; expanded: boolean; onToggle: () => void; watched: boolean }) {
  const arr = r.revenue.arr_usd;
  const g = GROWTH_GLYPH[r.growth.trend] ?? GROWTH_GLYPH.unknown;
  const dead = r.status === "dead";
  return (
    <div className={`ag-glass overflow-hidden transition-all duration-200 ${watched ? "!border-blue-400/60 !bg-blue-950/20" : "ag-glass-hover"} ${dead ? "opacity-60" : ""}`}>
      <div className="relative flex items-center gap-3 px-4 py-3.5 cursor-pointer" onClick={onToggle}>
        <div className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-2xl ${r.buybacks.status === "active" ? "bg-gradient-to-b from-emerald-400 to-emerald-600/50" : "bg-white/[0.06]"}`} />

        <div className="hidden sm:block pl-1.5 w-8 text-center font-mono text-xs text-gray-500 tabular-nums flex-shrink-0">{r.rank}</div>
        <SubnetLogo netuid={r.netuid} name={r.name} size={32} />

        <div className="flex-1 min-w-0 md:flex-none md:w-52">
          <div className="flex items-center gap-1.5">
            <span className="font-display font-semibold text-white truncate">{r.name}</span>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/[0.07] border border-emerald-500/25 rounded-full px-1.5 py-px font-mono flex-shrink-0">SN{r.netuid}</span>
            {dead && <span className="text-[9px] text-red-300 border border-red-500/30 rounded px-1 flex-shrink-0">DEAD</span>}
          </div>
          <div className="text-[10.5px] text-gray-500 truncate">{r.product.category}</div>
        </div>

        {/* Revenue */}
        <div className="hidden md:flex flex-col w-36 flex-shrink-0">
          <span className={`font-display text-lg font-semibold tabular-nums leading-tight ${arr ? "text-white" : "text-gray-600"}`}>{fmtUsd(arr, "no revenue")}</span>
          <span className="mt-0.5"><Pill tone={CONFIDENCE_TONE[r.revenue.confidence]}>{CONFIDENCE_LABEL[r.revenue.confidence]}</Pill></span>
        </div>

        {/* Growth */}
        <div className="hidden lg:flex w-16 flex-shrink-0 items-center" title={g.label}>
          <span className={`text-sm font-bold ${g.tone}`}>{g.glyph}</span>
        </div>

        {/* Buybacks */}
        <div className="hidden md:block w-28 flex-shrink-0">
          <Pill tone={BUYBACK_TONE[r.buybacks.status]} title={r.buybacks.mechanism || undefined}>
            {r.buybacks.status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            {BUYBACK_LABEL[r.buybacks.status]}
          </Pill>
          {r.buybacks.status === "active" && r.buybacks.pct_of_revenue != null && (
            <div className="text-[10px] text-gray-500 mt-0.5">{r.buybacks.pct_of_revenue}% of revenue</div>
          )}
        </div>

        {/* P/S */}
        <div className="hidden lg:flex flex-col w-20 flex-shrink-0 text-right" title="Market cap divided by annual revenue">
          <span className={`font-display text-base tabular-nums ${r.psMultiple == null ? "text-gray-700" : r.psMultiple <= 10 ? "text-emerald-300" : r.psMultiple <= 30 ? "text-gray-200" : "text-amber-300"}`}>{fmtPs(r.psMultiple)}</span>
          <span className="text-[9px] text-gray-600 uppercase tracking-widest">P/S</span>
        </div>

        {/* Market cap */}
        <div className="hidden xl:flex flex-col w-24 flex-shrink-0 text-right">
          <span className="text-sm text-gray-300 tabular-nums">{fmtUsd(r.live.marketCapUsd)}</span>
          <span className="text-[9px] text-gray-600 uppercase tracking-widest">Mkt cap</span>
        </div>

        {/* Product */}
        <div className="hidden lg:flex flex-col w-14 flex-shrink-0 text-right" title="Product quality">
          <span className="text-sm text-gray-300 tabular-nums">{r.product.quality_score}</span>
          <span className="text-[9px] text-gray-600 uppercase tracking-widest">Product</span>
        </div>

        {/* Mobile: ARR */}
        <div className="md:hidden flex-shrink-0 text-right">
          <div className={`font-display text-sm font-semibold tabular-nums ${arr ? "text-white" : "text-gray-600"}`}>{fmtUsd(arr, "-")}</div>
          {r.buybacks.status === "active" && <div className="text-[9px] text-emerald-400">buying back</div>}
        </div>

        <div className="flex items-center gap-2 ml-1 flex-shrink-0">
          <ScoreRing score={r.fundamentals} />
          <svg className={`w-4 h-4 text-gray-600 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.08] bg-white/[0.02] px-5 py-5">
          <div className="grid lg:grid-cols-5 gap-5">

            {/* Left: product + customers + score breakdown */}
            <div className="lg:col-span-2 space-y-4">
              <div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><AgIcon name="doc" className="w-3 h-3" /> What it is</div>
                <p className="text-sm text-gray-300 leading-relaxed">{r.product.what_it_is}</p>
                <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]">
                  <span className={r.product.live_product ? "text-emerald-300" : "text-gray-500"}>{r.product.live_product ? "Live product" : "Not usable yet"}</span>
                  {r.product.pricing_url && <a href={r.product.pricing_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-emerald-500/80 hover:text-emerald-400 underline underline-offset-2">Pricing</a>}
                </div>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed"><span className="text-gray-400">Quality {r.product.quality_score}/100:</span> {r.product.quality_rationale}</p>
              </div>

              <div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><AgIcon name="users" className="w-3 h-3" /> Customers</div>
                {r.customers.named?.length ? (
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {r.customers.named.map((c, i) => <span key={i} className="text-[11px] text-gray-200 bg-white/[0.05] border border-white/10 rounded-full px-2 py-0.5">{c}</span>)}
                  </div>
                ) : null}
                <p className="text-xs text-gray-500 leading-relaxed">
                  {r.customers.count != null ? `${r.customers.count.toLocaleString()} customers · ` : ""}{r.customers.type !== "none" ? `${r.customers.type}` : "no customers found"}{r.customers.evidence ? `. ${r.customers.evidence}` : ""}
                </p>
              </div>

              {r.benchmark && (
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><AgIcon name="target" className="w-3 h-3" /> Product benchmark</div>
                  <div className="flex items-baseline gap-3 mb-1.5">
                    {r.benchmark.cost_saving_pct > 0 && (
                      <span className="font-display text-xl font-semibold text-emerald-400 tabular-nums">{r.benchmark.cost_saving_pct}%<span className="text-[10px] text-gray-500 font-normal ml-1">cheaper vs {r.benchmark.vs_provider.split(" / ")[0]}</span></span>
                    )}
                  </div>
                  {r.benchmark.perf_delta && <p className="text-xs text-emerald-300/90 leading-snug mb-1.5">{r.benchmark.perf_delta}</p>}
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-6">{r.benchmark.summary.split(" CAVEATS:")[0].split(" AUDIT:")[0]}</p>
                  {r.benchmark.dashboards.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {r.benchmark.dashboards.map((d, i) => (
                        <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/20">
                          <AgIcon name="chart" className="w-3 h-3" /> {d.label}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="text-[10px] text-gray-700 mt-2">Benchmarked {r.benchmark.last_updated}</div>
                </div>
              )}

              <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-2.5">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center justify-between">
                  <span>Fundamentals {r.fundamentals}/100</span>
                </div>
                <Bar label="Revenue" value={r.components.revenue} weight={WEIGHTS.revenue} />
                <Bar label="Buybacks" value={r.components.buybacks} weight={WEIGHTS.buybacks} />
                <Bar label="Growth" value={r.components.growth} weight={WEIGHTS.growth} />
                <Bar label="Product" value={r.components.product} weight={WEIGHTS.product} />
              </div>
            </div>

            {/* Right: revenue, buybacks, market */}
            <div className="lg:col-span-3 space-y-3">
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><AgIcon name="money" className="w-3 h-3" /> Revenue</div>
                    <div className={`font-display text-2xl font-semibold tabular-nums mt-1 ${arr ? "text-white" : "text-gray-600"}`}>{fmtUsd(arr, "No revenue")}<span className="text-xs text-gray-500 font-normal ml-1.5">{arr ? "ARR" : ""}</span></div>
                  </div>
                  <div className="text-right">
                    <Pill tone={CONFIDENCE_TONE[r.revenue.confidence]}>{CONFIDENCE_LABEL[r.revenue.confidence]}</Pill>
                    {r.revenue.as_of && <div className="text-[10px] text-gray-600 mt-1">as of {r.revenue.as_of}</div>}
                  </div>
                </div>
                {r.revenue.basis && <p className="text-xs text-gray-400 mt-2"><span className="text-gray-500">Basis:</span> {r.revenue.basis}</p>}
                {r.revenue.evidence && <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{r.revenue.evidence}</p>}
                <div className="mt-2 text-xs">
                  <span className={`font-semibold ${g.tone}`}>{g.glyph} {g.label}</span>
                  {r.growth.prior_arr_usd != null && r.growth.prior_as_of && <span className="text-gray-500"> · was {fmtUsd(r.growth.prior_arr_usd)} as of {r.growth.prior_as_of}</span>}
                  {r.growth.evidence && <span className="text-gray-600"> · {r.growth.evidence}</span>}
                </div>
                <Sources urls={r.revenue.sources} />
              </div>

              <div className={`border rounded-xl p-4 ${r.buybacks.status === "active" ? "bg-emerald-500/[0.05] border-emerald-500/25" : "bg-white/[0.03] border-white/[0.08]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><AgIcon name="repost" className="w-3 h-3" /> Alpha buybacks</div>
                  <Pill tone={BUYBACK_TONE[r.buybacks.status]}>{BUYBACK_LABEL[r.buybacks.status]}</Pill>
                </div>
                {r.buybacks.mechanism && <p className="text-sm text-gray-200 mt-2">{r.buybacks.mechanism}</p>}
                <div className="flex gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                  {r.buybacks.pct_of_revenue != null && <span>{r.buybacks.pct_of_revenue}% of revenue</span>}
                  {r.buybacks.usd_to_date != null && <span>{fmtUsd(r.buybacks.usd_to_date)} bought to date</span>}
                  {r.buybackYieldPct != null && <span title="Annual buyback dollars as a share of market cap">{r.buybackYieldPct}% buyback yield</span>}
                </div>
                {r.buybacks.evidence && <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{r.buybacks.evidence}</p>}
                <Sources urls={r.buybacks.sources} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Market cap", value: fmtUsd(r.live.marketCapUsd) },
                  { label: "P/S", value: fmtPs(r.psMultiple) },
                  { label: "Emission", value: r.live.emissionPct != null ? `${r.live.emissionPct.toFixed(2)}%` : "-" },
                  { label: "Owner locked", value: r.live.ownerLockedAlpha ? `${fmtAlpha(r.live.ownerLockedAlpha)} α` : "-" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 text-center">
                    <div className="font-display text-sm font-semibold text-white tabular-nums">{value}</div>
                    <div className="text-[9px] text-gray-600 uppercase tracking-[0.16em] mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
              {r.live.ownerLockedAlpha ? (
                <p className="text-[11px] text-gray-600">Owner-locked alpha is the team locking tokens it already holds (BIT-0011). It is skin in the game, not a buyback.</p>
              ) : null}

              {r.notes && (
                <div className="bg-amber-500/[0.04] border border-amber-500/15 rounded-xl px-4 py-3">
                  <div className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest mb-1">Caveats</div>
                  <p className="text-xs text-gray-400 leading-relaxed">{r.notes}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-gray-600">{r.verified ? `Verified ${r.verified.at}` : "Research pass only"}</span>
                <Link href={`/subnets/${r.netuid}`} onClick={e => e.stopPropagation()} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">Full subnet page →</Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function ValuationPage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const { isWatched, watchlist } = useWatchlist();
  const [rows, setRows] = useState<ValuationRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>("index");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [showMethod, setShowMethod] = useState(false);

  useEffect(() => {
    fetch("/api/valuation").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.rows) { setRows(d.rows); setSummary(d.summary); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    const bb = (s: BuybackStatus) => ({ active: 3, announced: 2, planned: 1, none: 0, unknown: 0 }[s]);
    const gr = (t: GrowthTrend) => ({ accelerating: 4, growing: 3, flat: 2, unknown: 1, declining: 0 }[t]);
    const query = q.trim().toLowerCase().replace(/^sn/i, "");
    let list = rows.filter(r => {
      if (filter === "revenue" && !(r.revenue.arr_usd && r.revenue.arr_usd > 0)) return false;
      if (filter === "buybacks" && !["active", "announced"].includes(r.buybacks.status)) return false;
      if (filter === "watchlist" && !watchlist.has(r.netuid)) return false;
      if (query && !(r.name.toLowerCase().includes(query) || String(r.netuid) === query)) return false;
      return true;
    });
    const cmp: Record<SortKey, (a: ValuationRow, b: ValuationRow) => number> = {
      index: (a, b) => a.rank - b.rank,
      revenue: (a, b) => (b.creditedArrUsd - a.creditedArrUsd) || ((b.revenue.arr_usd ?? 0) - (a.revenue.arr_usd ?? 0)),
      buybacks: (a, b) => (bb(b.buybacks.status) - bb(a.buybacks.status)) || ((b.buybackYieldPct ?? -1) - (a.buybackYieldPct ?? -1)) || (b.creditedArrUsd - a.creditedArrUsd),
      // Lowest multiple first, among subnets that have one. Cheap revenue sorts to the top.
      ps: (a, b) => ((a.psMultiple ?? Infinity) - (b.psMultiple ?? Infinity)),
      growth: (a, b) => (gr(b.growth.trend) - gr(a.growth.trend)) || (b.creditedArrUsd - a.creditedArrUsd),
      product: (a, b) => (b.product.quality_score - a.product.quality_score),
      mcap: (a, b) => ((b.live.marketCapUsd ?? 0) - (a.live.marketCapUsd ?? 0)),
    };
    list = [...list].sort(cmp[sort]);
    return list;
  }, [rows, sort, filter, q, watchlist]);

  const s = summary;
  const observed = s?.marketObservedAt ? new Date(s.marketObservedAt) : null;

  return (
    <div className="min-h-screen bg-[#07090b] text-white ag-aurora">
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 pt-9 pb-2">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] leading-tight flex items-center gap-2.5">
            <AgIcon name="crown" className="w-7 h-7 text-emerald-400" />
            <span>Subnet <span className="ag-gradient-text">Valuation Index</span></span>
          </h1>
        </div>
        <p className="text-[14.5px] text-gray-400 max-w-2xl leading-relaxed">
          Revenue, growth, customers and alpha buybacks for every Bittensor subnet, each figure with its source,
          next to live market caps from the chain. What a subnet earns, what it does with it, and what you pay for it.
        </p>

        <div className="flex items-center gap-2.5 mt-4 font-mono text-[11px] uppercase tracking-[0.08em] text-gray-500 flex-wrap">
          <span className="ag-live-dot flex-shrink-0" />
          {s ? (
            <span>{s.subnets} subnets researched · {s.withRevenue} earning revenue · {s.buybacksActive} buying back alpha{observed ? ` · market data ${observed.toUTCString().slice(17, 22)} UTC` : ""}</span>
          ) : <span>Loading index</span>}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-6">
          {[
            { label: "Confirmed ARR", value: fmtUsd(s?.confirmedArrUsd, "$0"), sub: "dashboards, ledgers, named press", icon: "money", accent: true },
            { label: "Reported ARR", value: fmtUsd((s?.reportedArrUsd ?? 0) + (s?.estimatedArrUsd ?? 0), "$0"), sub: "team-stated or derived", icon: "money", accent: false },
            { label: "Buying back alpha", value: s ? `${s.buybacksActive}` : "-", sub: s ? `${s.buybacksAnnounced} more announced` : "", icon: "repost", accent: false },
            { label: "Median P/S", value: s?.medianPs != null ? fmtPs(s.medianPs) : "-", sub: "market cap / revenue, revenue subnets", icon: "chart", accent: false },
            { label: "Revenue subnets mkt cap", value: fmtUsd(s?.revenueMarketCapUsd), sub: s ? `${s.withRevenue} of ${s.subnets} subnets` : "", icon: "target", accent: false },
          ].map(({ label, value, sub, icon, accent }) => (
            <div key={label} className="ag-glass ag-glass-hover p-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500 mb-2 flex items-center gap-1.5">
                <AgIcon name={icon as never} className="w-3.5 h-3.5 text-emerald-400" /> {label}
              </div>
              <div className={`font-display text-2xl font-semibold tabular-nums ${accent ? "text-emerald-400" : "text-white"}`}>{value}</div>
              {sub && <div className="text-[10px] text-gray-600 mt-1">{sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 pt-5 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="ag-pill-tabs flex-shrink-0">
            {([["all", "All"], ["revenue", "Revenue"], ["buybacks", "Buybacks"], ["watchlist", "Watchlist"]] as Array<[Filter, string]>).map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)} className={`ag-pill-tab !px-3 !py-1.5 !text-xs ${filter === k ? "ag-pill-tab-on" : ""}`}>
                {k === "watchlist" && <AgIcon name="star" className="w-3 h-3 inline mr-1" />}{label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search subnet"
            className="px-3 py-1.5 rounded-full text-xs bg-white/[0.035] border border-white/[0.08] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-emerald-500/40 w-36" />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] text-gray-600 uppercase tracking-widest">Sort</span>
            <div className="ag-pill-tabs">
              {([["index", "Index"], ["revenue", "Revenue"], ["buybacks", "Buybacks"], ["ps", "P/S"], ["growth", "Growth"], ["product", "Product"], ["mcap", "Mkt cap"]] as Array<[SortKey, string]>).map(([k, label]) => (
                <button key={k} onClick={() => setSort(k)} className={`ag-pill-tab !px-3 !py-1.5 !text-xs ${sort === k ? "ag-pill-tab-on" : ""}`}>{label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-[10px] text-gray-600">
          <span>{shown.length} subnet{shown.length !== 1 ? "s" : ""}</span>
          <button onClick={() => setShowMethod(v => !v)} className="text-emerald-500/80 hover:text-emerald-400 underline underline-offset-2">{showMethod ? "Hide" : "How this index works"}</button>
        </div>

        {showMethod && (
          <div className="ag-glass px-5 py-4 mt-3 text-xs text-gray-400 leading-relaxed space-y-2">
            <p><span className="text-gray-200 font-semibold">Revenue tiers.</span> <span className="text-emerald-300">Confirmed</span> means a public dashboard, an on-chain ledger, or a named-source report we can open. <span className="text-amber-300">Self-reported</span> means the team or an index states it and there is no independent check. <span className="text-sky-300">Estimated</span> means we derived it from public usage and public pricing, with the arithmetic shown. A revenue figure is never inferred from market cap, emissions or token price.</p>
            <p><span className="text-gray-200 font-semibold">Fundamentals score (0-100).</span> Revenue {WEIGHTS.revenue}% on a log scale with self-reported counted at 70% and estimated at 50%; alpha buybacks {WEIGHTS.buybacks}% (active with most of revenue committed scores highest); growth {WEIGHTS.growth}%; product quality {WEIGHTS.product}%. A dead subnet scores zero.</p>
            <p><span className="text-gray-200 font-semibold">P/S.</span> Live market cap divided by stated ARR. It is shown, not scored: whether 8x is cheap for a subnet is your call. Buyback yield is the annual buyback dollars as a share of market cap, only where the programme is active and the percentage of revenue is stated.</p>
            <p><span className="text-gray-200 font-semibold">Buybacks.</span> Only revenue used to buy the subnet&apos;s own alpha counts. Owner-locked alpha is shown separately; it is the team locking tokens it already holds, which is a different signal.</p>
          </div>
        )}
      </div>

      {/* List */}
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 pb-10 space-y-2.5">
        {loading && [0, 1, 2, 3].map(i => <div key={i} className="ag-glass h-16 animate-pulse bg-white/[0.02]" />)}

        {!loading && shown.slice(0, 1).map(r => (
          <Row key={r.netuid} r={r} expanded={expanded === r.netuid} onToggle={() => setExpanded(expanded === r.netuid ? null : r.netuid)} watched={isWatched(r.netuid)} />
        ))}
        {!loading && shown.length > 1 && (
          <BlurGate tier={tier} required="premium" minHeight="400px">
            <div className="space-y-2.5">
              {(canAccessPremium(tier) ? shown.slice(1) : shown.slice(1, 7)).map(r => (
                <Row key={r.netuid} r={r} expanded={expanded === r.netuid} onToggle={() => setExpanded(expanded === r.netuid ? null : r.netuid)} watched={isWatched(r.netuid)} />
              ))}
            </div>
          </BlurGate>
        )}
        {!loading && shown.length === 0 && (
          <div className="text-center py-16 text-gray-600 text-sm">Nothing matches that filter.</div>
        )}
      </div>
    </div>
  );
}
