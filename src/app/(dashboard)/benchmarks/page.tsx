"use client";
// v3 — premium redesign
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import AgIcon, { type AgIconName } from "@/components/AgIcon";
import { BENCHMARK_DATA, type BenchmarkEntry } from "@/lib/benchmarks";
import BlurGate from "@/components/BlurGate";
import { getTier, canAccessPremium } from "@/lib/subscription";
import { useWatchlist } from "@/components/dashboard/WatchlistProvider";

interface BenchmarkAlert {
  netuid: number;
  subnet_name: string;
  handle: string;
  tweet_url: string;
  tweet_text: string;
  engagement: number;
  detected_at: string;
}

function formatRevenue(usd: number): string {
  if (usd === 0) return "Pre-revenue";
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M/yr`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K/yr`;
  return `$${usd.toLocaleString()}/yr`;
}

// Category icon mapping
const CAT_ICON: Record<string, AgIconName> = {
  "AI Compute": "robot",
  "AI Inference": "bolt",
  "AI Training": "brain",
  "Data": "chart",
  "Storage": "doc",
  "Compute": "scope",
  "Vision": "eye",
  "Audio": "wave",
  "Language": "chat",
  "Search": "search",
};

function ScoreMeter({ score }: { score: number }) {
  const color = score >= 90 ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/[0.07]"
    : score >= 80 ? "text-green-400 border-green-500/40 bg-green-500/[0.07]"
    : score >= 70 ? "text-yellow-400 border-yellow-500/40 bg-yellow-500/[0.07]"
    : "text-orange-400 border-orange-500/40 bg-orange-500/[0.07]";
  const barColor = score >= 90 ? "bg-emerald-400" : score >= 80 ? "bg-green-400" : score >= 70 ? "bg-yellow-400" : "bg-orange-400";
  return (
    <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl border backdrop-blur-md ${color} relative overflow-hidden`}>
      {/* Fill bar */}
      <div className={`absolute bottom-0 left-0 right-0 ${barColor} opacity-20 transition-all`} style={{ height: `${score}%` }} />
      <span className="relative font-display font-semibold text-xl leading-none tabular-nums">{score}</span>
      <span className="relative font-mono text-[9px] opacity-60 mt-0.5">/ 100</span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span title="#1"><AgIcon name="crown" className="w-5 h-5 text-yellow-400" /></span>;
  if (rank === 2) return <span title="#2"><AgIcon name="star" className="w-5 h-5 text-gray-300" /></span>;
  if (rank === 3) return <span title="#3"><AgIcon name="star" className="w-5 h-5 text-amber-600" /></span>;
  return <span className="text-gray-600 text-xs font-mono tabular-nums w-5 text-center">#{rank}</span>;
}

function BenchmarkCard({
  entry, rank, expanded, onToggle, alerts, watched,
}: {
  entry: BenchmarkEntry & { netuid?: number };
  rank: number;
  expanded: boolean;
  onToggle: () => void;
  alerts: BenchmarkAlert[];
  watched: boolean;
}) {
  const b = entry;
  const catIcon = CAT_ICON[b.benchmark_category] ?? "scope";
  const cardAlerts = alerts.filter(a => a.netuid === b.subnet_id).slice(0, 2);

  const costColor = b.cost_saving_pct >= 80 ? "text-emerald-400" : b.cost_saving_pct >= 60 ? "text-green-400" : b.cost_saving_pct >= 40 ? "text-yellow-400" : "text-orange-400";
  const scoreGlow = b.benchmark_score >= 90 ? "shadow-emerald-500/10" : b.benchmark_score >= 80 ? "shadow-green-500/10" : "shadow-none";

  return (
    <div className={`ag-glass group overflow-hidden transition-all duration-200 ${
      watched
        ? "!border-blue-400/60 !bg-blue-950/20 shadow-lg shadow-blue-500/10"
        : "ag-glass-hover"
    } shadow-lg ${scoreGlow}`}>

      {/* Card row */}
      <div className="relative flex items-center gap-3 px-4 py-4 cursor-pointer" onClick={onToggle}>
        {/* Left green accent */}
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-400/70 to-emerald-600/40 rounded-l-2xl" />

        {/* Rank */}
        <div className="pl-2 flex-shrink-0">
          <RankBadge rank={rank} />
        </div>

        {/* Logo */}
        <div className="flex-shrink-0">
          <SubnetLogo netuid={b.subnet_id} name={b.subnet_name} size={32} />
        </div>

        {/* Name + category */}
        <div className="flex-1 min-w-0 md:flex-none md:w-48">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-display font-semibold text-white truncate">{b.subnet_name}</span>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/[0.07] border border-emerald-500/25 rounded-full px-2 py-0.5 font-mono flex-shrink-0">SN{b.subnet_id}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <AgIcon name={catIcon} className="w-3 h-3" />
            <span>{b.benchmark_category}</span>
            {cardAlerts.length > 0 && (
              <span className="ml-1 text-[9px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded px-1 inline-flex items-center gap-0.5"><AgIcon name="radar" className="w-2.5 h-2.5" /> NEW</span>
            )}
          </div>
        </div>

        {/* Cost saving — desktop */}
        <div className="hidden md:flex flex-col flex-none w-32">
          <span className={`font-display text-xl font-semibold tabular-nums ${costColor}`}>{b.cost_saving_pct}%</span>
          <span className="text-[10px] text-gray-600">cheaper vs {b.vs_provider.split(" / ")[0].split(" ")[0]}</span>
        </div>

        {/* Perf delta — desktop */}
        <div className="hidden lg:block flex-1 min-w-0 px-2">
          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{b.perf_delta}</p>
        </div>

        {/* Revenue — desktop */}
        <div className="hidden md:block flex-none w-28 text-right">
          <div className={`text-sm font-bold ${b.annual_revenue_usd > 0 ? "text-white" : "text-gray-600"}`}>
            {formatRevenue(b.annual_revenue_usd)}
          </div>
          <div className="text-[10px] text-gray-600 mt-0.5">{b.active_users}</div>
        </div>

        {/* Mobile: cost saving */}
        <div className="flex md:hidden flex-shrink-0">
          <span className={`font-display text-lg font-semibold tabular-nums ${costColor}`}>{b.cost_saving_pct}%</span>
        </div>

        {/* Score meter + chevron */}
        <div className="flex-shrink-0 flex items-center gap-2 ml-1">
          <ScoreMeter score={b.benchmark_score} />
          <svg className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/[0.08] bg-white/[0.02] px-5 py-5">
          <div className="grid md:grid-cols-2 gap-6">

            {/* Left: summary + alerts */}
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><AgIcon name="doc" className="w-3 h-3" /> Benchmark Findings</div>
              <p className="text-sm text-gray-300 leading-relaxed">{b.benchmark_summary}</p>

              {cardAlerts.map((a, ai) => (
                <a key={ai} href={a.tweet_url} target="_blank" rel="noopener noreferrer"
                  className="mt-3 flex items-start gap-2 bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-3 hover:border-emerald-700/40 transition-colors group/alert block">
                  <span className="text-[10px] text-emerald-400 font-bold flex-shrink-0 mt-0.5 inline-flex items-center gap-1"><AgIcon name="radar" className="w-3 h-3" /> NEW</span>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-300 group-hover/alert:text-white leading-relaxed">{a.tweet_text}</p>
                    <span className="text-[10px] text-gray-600 mt-1 block">{a.engagement} engagements · @{a.handle} ↗</span>
                  </div>
                </a>
              ))}
            </div>

            {/* Right: stats */}
            <div className="space-y-4">

              {/* Key stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Cost Saving", value: `${b.cost_saving_pct}%`, color: costColor, icon: "money" as AgIconName },
                  { label: "Revenue", value: formatRevenue(b.annual_revenue_usd), color: b.annual_revenue_usd > 0 ? "text-white" : "text-gray-600", icon: "money" as AgIconName },
                  { label: "Users", value: b.active_users, color: "text-white", icon: "users" as AgIconName },
                ].map(({ label, value, color, icon }) => (
                  <div key={label} className="bg-white/[0.035] border border-white/[0.08] rounded-xl p-3 text-center backdrop-blur-md">
                    <div className="mb-0.5 flex justify-center"><AgIcon name={icon} className="w-4 h-4 text-emerald-400" /></div>
                    <div className={`font-display text-sm font-semibold ${color} leading-tight`}>{value}</div>
                    <div className="text-[9px] text-gray-600 mt-0.5 uppercase tracking-[0.16em]">{label}</div>
                  </div>
                ))}
              </div>

              {/* Competing against */}
              <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl px-4 py-3">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><AgIcon name="target" className="w-3 h-3" /> Beating</div>
                <div className="text-sm text-gray-300">{b.vs_provider}</div>
              </div>

              {/* Key advantage */}
              <div className="bg-emerald-500/[0.05] border border-emerald-500/20 rounded-xl px-4 py-3">
                <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><AgIcon name="bolt" className="w-3 h-3" /> Key Advantage</div>
                <div className="text-sm text-emerald-300 font-medium leading-snug">{b.perf_delta}</div>
              </div>

              {/* Dashboards */}
              {b.dashboards && b.dashboards.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><AgIcon name="chart" className="w-3 h-3" /> Live Dashboards</div>
                  <div className="flex flex-wrap gap-1.5">
                    {b.dashboards.map((d, di) => (
                      <a key={di} href={d.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/25 text-[11px] font-medium text-green-400 hover:bg-green-500/20 hover:border-green-500/40 transition-colors">
                        <AgIcon name="chart" className="w-3 h-3" /> {d.label} ↗
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources + footer */}
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-gray-600">Sources:</span>
                  {b.sources.map((src, si) => (
                    <a key={si} href={src} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      className="text-[10px] text-green-500/70 hover:text-green-400 underline underline-offset-2 transition-colors">
                      [{si + 1}]
                    </a>
                  ))}
                  <span className="text-[10px] text-gray-700">· Updated {b.last_updated}</span>
                </div>
                <Link href={`/subnets/${b.subnet_id}`} onClick={e => e.stopPropagation()}
                  className="text-xs text-green-400 hover:text-green-300 font-medium transition-colors flex-shrink-0">
                  Full analysis →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BenchmarksPage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"benchmark_score" | "cost_saving_pct" | "annual_revenue_usd">("benchmark_score");
  const [alerts, setAlerts] = useState<BenchmarkAlert[]>([]);
  const { isWatched, watchlist } = useWatchlist();
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/benchmarks/alerts").then(r => r.ok ? r.json() : null).then(d => {
      if (Array.isArray(d)) setAlerts(d);
    }).catch(() => {});
  }, []);

  const filtered = [...BENCHMARK_DATA]
    .filter(b => !watchlistOnly || watchlist.has(b.subnet_id) || watchlist.has((b as BenchmarkEntry & { netuid?: number }).netuid ?? -1))
    .filter(b => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase().replace(/^sn/i, "");
      return b.subnet_name.toLowerCase().includes(q) || String(b.subnet_id).includes(q);
    })
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const totalRevenue = BENCHMARK_DATA.reduce((s, b) => s + b.annual_revenue_usd, 0);
  const avgCostSaving = Math.round(BENCHMARK_DATA.reduce((s, b) => s + b.cost_saving_pct, 0) / BENCHMARK_DATA.length);
  const avgBenchScore = Math.round(BENCHMARK_DATA.reduce((s, b) => s + b.benchmark_score, 0) / BENCHMARK_DATA.length);
  const revenueSubnets = BENCHMARK_DATA.filter(b => b.annual_revenue_usd > 0).length;

  return (
    <div className="min-h-screen bg-[#07090b] text-white ag-aurora">

      {/* Hero header */}
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 pt-9 pb-2">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] leading-tight flex items-center gap-2.5">
            <AgIcon name="crown" className="w-7 h-7 text-emerald-400" />
            <span>Product <span className="ag-gradient-text">Benchmarks</span></span>
          </h1>
          <span className="ag-badge ag-badge-buy">{BENCHMARK_DATA.length} VERIFIED</span>
        </div>
        <p className="text-[14.5px] text-gray-400 max-w-2xl leading-relaxed">
          Real-world performance data for Bittensor subnets vs AWS, Google Cloud, CoreWeave & OpenAI.
          <span className="text-gray-600"> Only subnets with verifiable public benchmark data are listed.</span>
        </p>

        {/* LIVE row */}
        <div className="flex items-center gap-2.5 mt-4 font-mono text-[11px] uppercase tracking-[0.08em] text-gray-500">
          <span className="ag-live-dot flex-shrink-0" />
          <span>{BENCHMARK_DATA.length} SUBNETS BENCHMARKED · {revenueSubnets} GENERATING REVENUE</span>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          {[
            { label: "Avg cost saving", value: `${avgCostSaving}%`, icon: "money" as AgIconName, accent: true },
            { label: "Avg bench score", value: `${avgBenchScore}/100`, icon: "target" as AgIconName, accent: false },
            { label: "Est. combined revenue", value: `$${(totalRevenue / 1_000_000).toFixed(1)}M/yr`, icon: "money" as AgIconName, accent: false },
            { label: "Generating revenue", value: `${revenueSubnets} subnets`, icon: "trendUp" as AgIconName, accent: false },
          ].map(({ label, value, icon, accent }) => (
            <div key={label} className="ag-glass ag-glass-hover p-5">
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-gray-500 mb-2.5 flex items-center gap-1.5">
                <AgIcon name={icon} className="w-3.5 h-3.5 text-emerald-400" />
                {label}
              </div>
              <div className={`font-display text-[26px] font-semibold tracking-tight leading-none tabular-nums ${accent ? "text-emerald-400" : "text-white"}`}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 pt-5 pb-3">
        <div className="flex flex-wrap items-center gap-2">

          {/* Watchlist toggle */}
          <div className="ag-pill-tabs flex-shrink-0">
            <button onClick={() => setWatchlistOnly(v => !v)}
              className={`ag-pill-tab !px-3 !py-1.5 !text-xs flex items-center gap-1.5 ${watchlistOnly ? "ag-pill-tab-on" : ""}`}>
              <AgIcon name="star" className="w-3 h-3" /> Watchlist
            </button>
          </div>
          <div className="flex-1" />

          {/* Search bar */}
          <div className="relative flex items-center flex-shrink-0">
            <svg className="absolute left-2.5 w-3.5 h-3.5 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search subnet…"
              className="pl-7 pr-7 py-1.5 rounded-full text-xs bg-white/[0.035] border border-white/[0.08] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-emerald-500/40 backdrop-blur-md w-36"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 text-gray-500 hover:text-gray-300">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] text-gray-600 uppercase tracking-widest">Sort</span>
            <div className="ag-pill-tabs">
              {[
                { key: "benchmark_score" as const, label: "Score" },
                { key: "cost_saving_pct" as const, label: "Cost %" },
                { key: "annual_revenue_usd" as const, label: "Revenue" },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setSortBy(key)}
                  className={`ag-pill-tab !px-3 !py-1.5 !text-xs ${sortBy === key ? "ag-pill-tab-on" : ""}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-3 text-[10px] text-gray-600">
          {filtered.length} subnet{filtered.length !== 1 ? "s" : ""} · sorted by {sortBy === "benchmark_score" ? "benchmark score" : sortBy === "cost_saving_pct" ? "cost saving" : "revenue"}
        </div>
      </div>

      {/* Card list */}
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 pb-10 space-y-3">

        {/* First card always visible */}
        {filtered.slice(0, 1).map((b, i) => (
          <BenchmarkCard
            key={b.subnet_id}
            entry={b as BenchmarkEntry & { netuid?: number }}
            rank={i + 1}
            expanded={expandedId === b.subnet_id}
            onToggle={() => setExpandedId(expandedId === b.subnet_id ? null : b.subnet_id)}
            alerts={alerts}
            watched={isWatched(b.subnet_id)}
          />
        ))}

        {/* Rest behind BlurGate. Gated viewers only get a short blurred
            preview — rendering all ~70 locked cards produced thousands of px
            of blurred dead-scroll below the CTA (especially bad on mobile). */}
        {filtered.length > 1 && (
          <BlurGate tier={tier} required="premium" minHeight="400px">
            <div className="space-y-3">
              {(canAccessPremium(tier) ? filtered.slice(1) : filtered.slice(1, 7)).map((b, i) => (
                <BenchmarkCard
                  key={b.subnet_id}
                  entry={b as BenchmarkEntry & { netuid?: number }}
                  rank={i + 2}
                  expanded={expandedId === b.subnet_id}
                  onToggle={() => setExpandedId(expandedId === b.subnet_id ? null : b.subnet_id)}
                  alerts={alerts}
                  watched={isWatched(b.subnet_id)}
                />
              ))}
            </div>
          </BlurGate>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <div className="mb-3 flex justify-center"><AgIcon name="search" className="w-10 h-10 text-gray-600" /></div>
            <div className="text-sm">No benchmarks in this category yet</div>
          </div>
        )}
      </div>

      {/* Methodology footer */}
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 pb-10">
        <div className="ag-glass px-5 py-4 flex flex-col md:flex-row md:items-start gap-4">
          <div className="flex-shrink-0"><AgIcon name="scope" className="w-6 h-6 text-gray-500" /></div>
          <div>
            <div className="font-display text-sm font-semibold text-gray-300 mb-1">How Benchmark Scores Work</div>
            <p className="text-xs text-gray-500 leading-relaxed max-w-2xl">
              Scores (0–100) compare each subnet&apos;s real-world performance against the leading centralized AI provider in its category.
              Only subnets with verifiable, publicly available benchmark data are listed.
              Benchmark results directly feed into a subnet&apos;s overall AlphaGap composite score.
              <span className="text-gray-600"> Revenue figures are best estimates and may vary.</span>
            </p>
            <div className="mt-2 text-[10px] text-gray-700">Last updated: May 15, 2026</div>
          </div>
        </div>
      </div>
    </div>
  );
}
