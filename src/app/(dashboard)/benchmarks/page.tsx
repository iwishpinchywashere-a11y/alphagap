"use client";
// v2
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import { BENCHMARK_DATA, type BenchmarkEntry } from "@/lib/benchmarks";
import BlurGate from "@/components/BlurGate";
import { getTier } from "@/lib/subscription";

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

function BenchBadge({ score }: { score: number }) {
  const color = score >= 90 ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30"
    : score >= 80 ? "text-green-400 bg-green-400/10 border-green-400/30"
    : score >= 70 ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
    : "text-orange-400 bg-orange-400/10 border-orange-400/30";
  return (
    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border font-bold text-lg ${color}`}>
      {score}
    </span>
  );
}

function CostBadge({ pct }: { pct: number }) {
  const color = pct >= 80 ? "text-emerald-400" : pct >= 60 ? "text-green-400" : pct >= 40 ? "text-yellow-400" : "text-orange-400";
  return (
    <span className={`font-bold ${color}`}>
      {pct}%<span className="hidden sm:inline"> cheaper</span>
    </span>
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

  useEffect(() => {
    fetch("/api/benchmarks/alerts").then(r => r.ok ? r.json() : null).then(d => {
      if (Array.isArray(d)) setAlerts(d);
    }).catch(() => {});
  }, []);

  const filtered = [...BENCHMARK_DATA]
    .filter(b => selectedCategory === "All" || b.benchmark_category === selectedCategory)
    .sort((a, b) => b[sortBy] - a[sortBy]);

  // Stats
  const totalRevenue = BENCHMARK_DATA.reduce((s, b) => s + b.annual_revenue_usd, 0);
  const avgCostSaving = Math.round(BENCHMARK_DATA.reduce((s, b) => s + b.cost_saving_pct, 0) / BENCHMARK_DATA.length);
  const avgBenchScore = Math.round(BENCHMARK_DATA.reduce((s, b) => s + b.benchmark_score, 0) / BENCHMARK_DATA.length);

  return (
    <main className="flex-1 overflow-auto p-4 md:p-6">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-white">Subnet Benchmarks</h1>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 uppercase tracking-wider">
            {BENCHMARK_DATA.length} Benchmarked
          </span>
        </div>
        <p className="text-sm text-gray-500 max-w-2xl">
          Confirmed performance benchmarks for Bittensor subnets vs centralized AI providers — AWS, Google Cloud, CoreWeave, OpenAI.
          Only subnets with verifiable public benchmark data are listed.{" "}
          <span className="text-gray-600">All reported revenue figures are based on best estimates and may vary.</span>
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Subnets Benchmarked", value: `${BENCHMARK_DATA.length} of 128`, sub: "More added as data becomes available" },
          { label: "Avg Cost Saving", value: `${avgCostSaving}%`, sub: "vs centralized providers" },
          { label: "Avg Benchmark Score", value: `${avgBenchScore}/100`, sub: "composite performance score" },
          { label: "Combined Est. Revenue", value: `$${(totalRevenue / 1_000_000).toFixed(1)}M/yr`, sub: "external revenue (not emissions)" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className="text-xl font-bold text-white">{value}</div>
            <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Category filter + sort */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedCategory === cat
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                  : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-600">Sort by:</span>
          {[
            { key: "benchmark_score" as const, label: "Bench Score" },
            { key: "cost_saving_pct" as const, label: "Cost Saving" },
            { key: "annual_revenue_usd" as const, label: "Revenue" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                sortBy === key
                  ? "bg-gray-700 border-gray-600 text-white"
                  : "border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main table */}
      <div className="space-y-2">
        {/* First entry always visible */}
        {filtered.slice(0, 1).map((b, i) => (
          <div key={b.subnet_id} className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors">
            {/* Main row */}
            <div
              className="flex items-center gap-3 p-4 cursor-pointer"
              onClick={() => setExpandedId(expandedId === b.subnet_id ? null : b.subnet_id)}
            >
              {/* Rank */}
              <span className="text-gray-600 text-sm tabular-nums w-5 text-center flex-shrink-0">{i + 1}</span>

              {/* Logo */}
              <div className="flex-shrink-0">
                <SubnetLogo netuid={b.subnet_id} name={b.subnet_name} size={28} />
              </div>

              {/* Name + category — fixed width on desktop */}
              <div className="flex-1 min-w-0 md:flex-none md:w-44 lg:w-56">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white truncate">{b.subnet_name}</span>
                  <span className="text-[10px] text-gray-600 font-mono flex-shrink-0">SN{b.subnet_id}</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5 truncate">{b.benchmark_category}</div>
              </div>

              {/* Cost saving — desktop only */}
              <div className="hidden md:block flex-none w-36">
                <CostBadge pct={b.cost_saving_pct} />
                <span className="text-[10px] text-gray-500 ml-1">vs {b.vs_provider.split(" / ")[0]}</span>
              </div>

              {/* Perf delta — desktop only, fills remaining space */}
              <div className="hidden md:block flex-1 min-w-0">
                <span className="text-xs text-emerald-400/80 font-medium line-clamp-2">{b.perf_delta}</span>
              </div>

              {/* Revenue + users — desktop only */}
              <div className="hidden md:block flex-none w-28 text-right">
                <div className={`text-xs font-semibold ${b.annual_revenue_usd > 0 ? "text-white" : "text-gray-600"}`}>
                  {formatRevenue(b.annual_revenue_usd)}
                </div>
                <div className="text-[10px] text-gray-600">{b.active_users}</div>
              </div>

              {/* Mobile-only: cost badge only (revenue hidden to save space) */}
              <div className="flex md:hidden items-center flex-shrink-0">
                <CostBadge pct={b.cost_saving_pct} />
              </div>

              {/* Score badge */}
              <div className="flex-shrink-0 flex items-center gap-2">
                <BenchBadge score={b.benchmark_score} />
                <span className="text-gray-600 text-xs">{expandedId === b.subnet_id ? "▲" : "▼"}</span>
              </div>
            </div>

            {/* Expanded detail */}
            {expandedId === b.subnet_id && (
              <div className="border-t border-gray-800 px-4 py-4 bg-gray-950/40">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1.5">Benchmark Findings</div>
                    <p className="text-sm text-gray-300 leading-relaxed">{b.benchmark_summary}</p>
                    {/* Auto-detected benchmark posts from official account */}
                    {alerts.filter(a => a.netuid === b.subnet_id).slice(0, 2).map((a, ai) => (
                      <a key={ai} href={a.tweet_url} target="_blank" rel="noopener noreferrer"
                        className="mt-3 flex items-start gap-2 bg-gray-900 border border-gray-700/50 rounded-lg p-2.5 hover:border-gray-600 transition-colors group block">
                        <span className="text-[10px] text-emerald-500 font-bold flex-shrink-0 mt-0.5">📡 NEW</span>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-300 group-hover:text-white leading-relaxed">{a.tweet_text}</p>
                          <span className="text-[10px] text-gray-600 mt-1 block">{a.engagement} engagements · @{a.handle} ↗</span>
                        </div>
                      </a>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Competing Against</div>
                      <div className="text-sm text-gray-300">{b.vs_provider}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Key Advantage</div>
                      <div className="text-sm text-emerald-400 font-medium">{b.perf_delta}</div>
                    </div>
                    <div className="flex items-start gap-6">
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Revenue</div>
                        <div className="text-sm text-white font-semibold">{formatRevenue(b.annual_revenue_usd)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Users</div>
                        <div className="text-sm text-white font-semibold">{b.active_users}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Last Updated</div>
                        <div className="text-sm text-gray-400">{b.last_updated}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Sources</div>
                      <div className="flex flex-wrap gap-1.5">
                        {b.sources.map((src, si) => (
                          <a
                            key={si}
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
                          >
                            Source {si + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-800/50 flex items-center justify-between">
                  <div className="text-[10px] text-gray-600">
                    Scores based on verifiable benchmark data. Not audited.
                  </div>
                  <Link
                    href={`/subnets/${b.subnet_id}`}
                    onClick={e => e.stopPropagation()}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                  >
                    View full analysis &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Remaining entries — single BlurGate */}
        {filtered.length > 1 && (
          <BlurGate tier={tier} required="premium" minHeight="400px">
            <div className="space-y-2">
              {filtered.slice(1).map((b, i) => (
                <div key={b.subnet_id} className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors">
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === b.subnet_id ? null : b.subnet_id)}
                  >
                    <span className="text-gray-600 text-sm tabular-nums w-5 text-center flex-shrink-0">{i + 2}</span>
                    <div className="flex-shrink-0">
                      <SubnetLogo netuid={b.subnet_id} name={b.subnet_name} size={28} />
                    </div>
                    <div className="flex-1 min-w-0 md:flex-none md:w-44 lg:w-56">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white truncate">{b.subnet_name}</span>
                        <span className="text-[10px] text-gray-600 font-mono flex-shrink-0">SN{b.subnet_id}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5 truncate">{b.benchmark_category}</div>
                    </div>
                    <div className="hidden md:block flex-none w-36">
                      <CostBadge pct={b.cost_saving_pct} />
                      <span className="text-[10px] text-gray-500 ml-1">vs {b.vs_provider.split(" / ")[0]}</span>
                    </div>
                    <div className="hidden md:block flex-1 min-w-0">
                      <span className="text-xs text-emerald-400/80 font-medium line-clamp-2">{b.perf_delta}</span>
                    </div>
                    <div className="hidden md:block flex-none w-28 text-right">
                      <div className={`text-xs font-semibold ${b.annual_revenue_usd > 0 ? "text-white" : "text-gray-600"}`}>
                        {formatRevenue(b.annual_revenue_usd)}
                      </div>
                      <div className="text-[10px] text-gray-600">{b.active_users}</div>
                    </div>
                    <div className="flex md:hidden items-center flex-shrink-0">
                      <CostBadge pct={b.cost_saving_pct} />
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <BenchBadge score={b.benchmark_score} />
                      <span className="text-gray-600 text-xs">{expandedId === b.subnet_id ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  {expandedId === b.subnet_id && (
                    <div className="border-t border-gray-800 px-4 py-4 bg-gray-950/40">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1.5">Benchmark Findings</div>
                          <p className="text-sm text-gray-300 leading-relaxed">{b.benchmark_summary}</p>
                          {alerts.filter(a => a.netuid === b.subnet_id).slice(0, 2).map((a, ai) => (
                            <a key={ai} href={a.tweet_url} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="mt-3 flex items-start gap-2 bg-gray-900 border border-gray-700/50 rounded-lg p-2.5 hover:border-gray-600 transition-colors group block">
                              <span className="text-[10px] text-emerald-500 font-bold flex-shrink-0 mt-0.5">📡 NEW</span>
                              <div className="min-w-0">
                                <p className="text-xs text-gray-300 group-hover:text-white leading-relaxed">{a.tweet_text}</p>
                                <span className="text-[10px] text-gray-600 mt-1 block">{a.engagement} engagements · @{a.handle} ↗</span>
                              </div>
                            </a>
                          ))}
                        </div>
                        <div className="space-y-3">
                          <div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Competing Against</div>
                            <div className="text-sm text-gray-300">{b.vs_provider}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Key Advantage</div>
                            <div className="text-sm text-emerald-400 font-medium">{b.perf_delta}</div>
                          </div>
                          <div className="flex items-start gap-6">
                            <div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Revenue</div>
                              <div className="text-sm text-white font-semibold">{formatRevenue(b.annual_revenue_usd)}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Users</div>
                              <div className="text-sm text-white font-semibold">{b.active_users}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Last Updated</div>
                              <div className="text-sm text-gray-400">{b.last_updated}</div>
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Sources</div>
                            <div className="flex flex-wrap gap-1.5">
                              {b.sources.map((src, si) => (
                                <a key={si} href={src} target="_blank" rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">
                                  Source {si + 1}
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-800/50 flex items-center justify-between">
                        <div className="text-[10px] text-gray-600">Scores based on verifiable benchmark data. Not audited.</div>
                        <Link href={`/subnets/${b.subnet_id}`} onClick={e => e.stopPropagation()}
                          className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                          View full analysis &rarr;
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </BlurGate>
        )}
      </div>

      {/* Methodology note */}
      <div className="mt-6 p-4 bg-gray-900/40 border border-gray-800/60 rounded-xl">
        <div className="text-sm font-semibold text-gray-300 mb-2">About Benchmark Scores</div>
        <p className="text-xs text-gray-500 leading-relaxed">
          Benchmark scores (0&ndash;100) compare each subnet&apos;s real-world performance against the leading centralized AI providers in the same category.
          Only subnets with verifiable, publicly available benchmark data are listed here. Benchmark results directly feed into a subnet&apos;s overall AlphaGap score.
        </p>
        <div className="mt-3 text-[10px] text-gray-600">
          Updated: April 3, 2026
        </div>
      </div>
    </main>
  );
}
