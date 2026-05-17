"use client";
// v3 — premium redesign
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import { BENCHMARK_DATA, type BenchmarkEntry } from "@/lib/benchmarks";
import BlurGate from "@/components/BlurGate";
import { getTier } from "@/lib/subscription";
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

// Category emoji mapping
const CAT_EMOJI: Record<string, string> = {
  "AI Compute": "🖥️",
  "AI Inference": "⚡",
  "AI Training": "🧠",
  "Data": "📊",
  "Storage": "🗄️",
  "Compute": "💻",
  "Vision": "👁️",
  "Audio": "🎙️",
  "Language": "💬",
  "Search": "🔍",
};

function ScoreMeter({ score }: { score: number }) {
  const color = score >= 90 ? "text-emerald-400 border-emerald-500/60 bg-emerald-500/10"
    : score >= 80 ? "text-green-400 border-green-500/60 bg-green-500/10"
    : score >= 70 ? "text-yellow-400 border-yellow-500/60 bg-yellow-500/10"
    : "text-orange-400 border-orange-500/60 bg-orange-500/10";
  const barColor = score >= 90 ? "bg-emerald-400" : score >= 80 ? "bg-green-400" : score >= 70 ? "bg-yellow-400" : "bg-orange-400";
  return (
    <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl border-2 ${color} relative overflow-hidden`}>
      {/* Fill bar */}
      <div className={`absolute bottom-0 left-0 right-0 ${barColor} opacity-20 transition-all`} style={{ height: `${score}%` }} />
      <span className="relative font-bold text-xl leading-none tabular-nums">{score}</span>
      <span className="relative text-[9px] opacity-60 mt-0.5">/ 100</span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg" title="#1">🥇</span>;
  if (rank === 2) return <span className="text-lg" title="#2">🥈</span>;
  if (rank === 3) return <span className="text-lg" title="#3">🥉</span>;
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
  const catEmoji = CAT_EMOJI[b.benchmark_category] ?? "🔬";
  const cardAlerts = alerts.filter(a => a.netuid === b.subnet_id).slice(0, 2);

  const costColor = b.cost_saving_pct >= 80 ? "text-emerald-400" : b.cost_saving_pct >= 60 ? "text-green-400" : b.cost_saving_pct >= 40 ? "text-yellow-400" : "text-orange-400";
  const scoreGlow = b.benchmark_score >= 90 ? "shadow-emerald-500/10" : b.benchmark_score >= 80 ? "shadow-green-500/10" : "shadow-none";

  return (
    <div className={`group rounded-2xl border overflow-hidden backdrop-blur-sm transition-all duration-200 ${
      watched
        ? "border-blue-400/60 bg-blue-950/20 shadow-lg shadow-blue-500/10"
        : "border-gray-800/60 bg-gray-950/70 hover:border-gray-700/60"
    } shadow-lg ${scoreGlow}`}>

      {/* Card row */}
      <div className="relative flex items-center gap-3 px-4 py-4 cursor-pointer" onClick={onToggle}>
        {/* Left green accent */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-green-500 to-emerald-600 rounded-l-2xl" />

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
            <span className="font-bold text-white truncate">{b.subnet_name}</span>
            <span className="text-[10px] text-green-400 bg-green-900/40 border border-green-800/40 rounded px-1.5 py-0.5 font-mono flex-shrink-0">SN{b.subnet_id}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <span>{catEmoji}</span>
            <span>{b.benchmark_category}</span>
            {cardAlerts.length > 0 && (
              <span className="ml-1 text-[9px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded px-1">📡 NEW</span>
            )}
          </div>
        </div>

        {/* Cost saving — desktop */}
        <div className="hidden md:flex flex-col flex-none w-32">
          <span className={`text-xl font-bold tabular-nums ${costColor}`}>{b.cost_saving_pct}%</span>
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
          <span className={`text-lg font-bold tabular-nums ${costColor}`}>{b.cost_saving_pct}%</span>
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
        <div className="border-t border-gray-800/50 bg-gray-950/60 px-5 py-5">
          <div className="grid md:grid-cols-2 gap-6">

            {/* Left: summary + alerts */}
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">📋 Benchmark Findings</div>
              <p className="text-sm text-gray-300 leading-relaxed">{b.benchmark_summary}</p>

              {cardAlerts.map((a, ai) => (
                <a key={ai} href={a.tweet_url} target="_blank" rel="noopener noreferrer"
                  className="mt-3 flex items-start gap-2 bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-3 hover:border-emerald-700/40 transition-colors group/alert block">
                  <span className="text-[10px] text-emerald-400 font-bold flex-shrink-0 mt-0.5">📡 NEW</span>
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
                  { label: "Cost Saving", value: `${b.cost_saving_pct}%`, color: costColor, icon: "💰" },
                  { label: "Revenue", value: formatRevenue(b.annual_revenue_usd), color: b.annual_revenue_usd > 0 ? "text-white" : "text-gray-600", icon: "💵" },
                  { label: "Users", value: b.active_users, color: "text-white", icon: "👥" },
                ].map(({ label, value, color, icon }) => (
                  <div key={label} className="bg-gray-900/60 border border-gray-800/40 rounded-xl p-3 text-center">
                    <div className="text-base mb-0.5">{icon}</div>
                    <div className={`text-sm font-bold ${color} leading-tight`}>{value}</div>
                    <div className="text-[9px] text-gray-600 mt-0.5 uppercase tracking-wider">{label}</div>
                  </div>
                ))}
              </div>

              {/* Competing against */}
              <div className="bg-gray-900/40 border border-gray-800/30 rounded-xl px-4 py-3">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">⚔️ Beating</div>
                <div className="text-sm text-gray-300">{b.vs_provider}</div>
              </div>

              {/* Key advantage */}
              <div className="bg-green-950/20 border border-green-800/30 rounded-xl px-4 py-3">
                <div className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">⚡ Key Advantage</div>
                <div className="text-sm text-green-300 font-medium leading-snug">{b.perf_delta}</div>
              </div>

              {/* Dashboards */}
              {b.dashboards && b.dashboards.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">📊 Live Dashboards</div>
                  <div className="flex flex-wrap gap-1.5">
                    {b.dashboards.map((d, di) => (
                      <a key={di} href={d.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/25 text-[11px] font-medium text-green-400 hover:bg-green-500/20 hover:border-green-500/40 transition-colors">
                        📊 {d.label} ↗
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources + footer */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-800/40">
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

const CATEGORIES = ["All", ...Array.from(new Set(BENCHMARK_DATA.map(b => b.benchmark_category))).sort()];

export default function BenchmarksPage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"benchmark_score" | "cost_saving_pct" | "annual_revenue_usd">("benchmark_score");
  const [alerts, setAlerts] = useState<BenchmarkAlert[]>([]);
  const { isWatched, watchlist } = useWatchlist();
  const [watchlistOnly, setWatchlistOnly] = useState(false);

  useEffect(() => {
    fetch("/api/benchmarks/alerts").then(r => r.ok ? r.json() : null).then(d => {
      if (Array.isArray(d)) setAlerts(d);
    }).catch(() => {});
  }, []);

  const filtered = [...BENCHMARK_DATA]
    .filter(b => selectedCategory === "All" || b.benchmark_category === selectedCategory)
    .filter(b => !watchlistOnly || watchlist.has(b.subnet_id) || watchlist.has((b as BenchmarkEntry & { netuid?: number }).netuid ?? -1))
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const totalRevenue = BENCHMARK_DATA.reduce((s, b) => s + b.annual_revenue_usd, 0);
  const avgCostSaving = Math.round(BENCHMARK_DATA.reduce((s, b) => s + b.cost_saving_pct, 0) / BENCHMARK_DATA.length);
  const avgBenchScore = Math.round(BENCHMARK_DATA.reduce((s, b) => s + b.benchmark_score, 0) / BENCHMARK_DATA.length);
  const revenueSubnets = BENCHMARK_DATA.filter(b => b.annual_revenue_usd > 0).length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* Hero header */}
      <div className="relative overflow-hidden border-b border-gray-800/50">
        {/* Grid bg */}
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        {/* Green glow orbs */}
        <div className="absolute -top-24 left-1/4 w-96 h-96 bg-green-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-10 right-1/4 w-64 h-64 bg-emerald-600/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-screen-xl mx-auto px-4 md:px-6 pt-10 pb-7">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 via-emerald-300 to-white bg-clip-text text-transparent">
              🏆 Subnet Benchmarks
            </h1>
            <span className="text-xs bg-green-900/50 text-green-400 border border-green-800/40 rounded-full px-2.5 py-0.5 font-bold uppercase tracking-wider">
              {BENCHMARK_DATA.length} Verified
            </span>
          </div>
          <p className="text-gray-400 text-sm max-w-2xl mb-6">
            Real-world performance data for Bittensor subnets vs AWS, Google Cloud, CoreWeave & OpenAI.
            <span className="text-gray-600"> Only subnets with verifiable public benchmark data are listed.</span>
          </p>

          {/* Stat chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Avg cost saving", value: `${avgCostSaving}%`, icon: "💰", green: true },
              { label: "Avg bench score", value: `${avgBenchScore}/100`, icon: "🎯", green: false },
              { label: "Est. combined revenue", value: `$${(totalRevenue / 1_000_000).toFixed(1)}M/yr`, icon: "💵", green: false },
              { label: "Generating revenue", value: `${revenueSubnets} subnets`, icon: "📈", green: false },
            ].map(({ label, value, icon, green }) => (
              <div key={label} className={`flex items-center gap-2 text-xs rounded-full px-3 py-1.5 border ${
                green
                  ? "bg-green-900/30 border-green-800/30 text-gray-300"
                  : "bg-gray-800/60 border-gray-700/40 text-gray-300"
              }`}>
                <span>{icon}</span>
                <span className={`font-bold ${green ? "text-green-400" : "text-white"}`}>{value}</span>
                <span className="text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 pt-5 pb-3">
        <div className="flex flex-wrap items-center gap-2">

          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5 flex-1">
            {CATEGORIES.map(cat => {
              const emoji = cat === "All" ? "✨" : (CAT_EMOJI[cat] ?? "🔬");
              return (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    selectedCategory === cat
                      ? "bg-green-500/20 border-green-500/50 text-green-300"
                      : "border-gray-700/60 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                  }`}>
                  <span>{emoji}</span>
                  <span>{cat}</span>
                </button>
              );
            })}

            {/* Watchlist toggle */}
            <button onClick={() => setWatchlistOnly(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                watchlistOnly
                  ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                  : "border-gray-700/60 text-gray-500 hover:border-gray-600 hover:text-gray-300"
              }`}>
              ⭐ Watchlist
            </button>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] text-gray-600 uppercase tracking-widest">Sort</span>
            {[
              { key: "benchmark_score" as const, label: "Score" },
              { key: "cost_saving_pct" as const, label: "Cost %" },
              { key: "annual_revenue_usd" as const, label: "Revenue" },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setSortBy(key)}
                className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                  sortBy === key
                    ? "bg-green-500/15 border-green-500/40 text-green-300"
                    : "border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300"
                }`}>
                {label}
              </button>
            ))}
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

        {/* Rest behind BlurGate */}
        {filtered.length > 1 && (
          <BlurGate tier={tier} required="premium" minHeight="400px">
            <div className="space-y-3">
              {filtered.slice(1).map((b, i) => (
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
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-sm">No benchmarks in this category yet</div>
          </div>
        )}
      </div>

      {/* Methodology footer */}
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 pb-10">
        <div className="bg-gray-950/60 border border-gray-800/40 rounded-2xl px-5 py-4 flex flex-col md:flex-row md:items-start gap-4">
          <div className="text-2xl flex-shrink-0">📐</div>
          <div>
            <div className="text-sm font-semibold text-gray-300 mb-1">How Benchmark Scores Work</div>
            <p className="text-xs text-gray-500 leading-relaxed max-w-2xl">
              Scores (0–100) compare each subnet&apos;s real-world performance against the leading centralized AI provider in its category.
              Only subnets with verifiable, publicly available benchmark data are listed.
              Benchmark results directly feed into a subnet&apos;s overall AlphaGap composite score.
              <span className="text-gray-600"> Revenue figures are best estimates and may vary.</span>
            </p>
            <div className="mt-2 text-[10px] text-gray-700">Last updated: April 3, 2026</div>
          </div>
        </div>
      </div>
    </div>
  );
}
