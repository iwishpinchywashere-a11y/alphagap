"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import BlurGate from "@/components/BlurGate";
import { getTier, canAccessPro } from "@/lib/subscription";
import { useWatchlist } from "@/components/dashboard/WatchlistProvider";
import AgIcon from "@/components/AgIcon";

interface ReportMeta {
  date: string;
  subnet_name?: string;
  netuid?: number;
  composite_score?: number;
}

interface ReportFull extends ReportMeta {
  content: string;
  generated_at: string;
}

/**
 * Splits report markdown at the Nth ## heading (1-based).
 * Returns lines before that heading as `visible` and the rest as `locked`.
 * If there aren't enough ## headings, everything is visible.
 */
function splitAtSection(content: string, showSections: number) {
  const lines = content.split("\n");
  let h2Count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      h2Count++;
      if (h2Count > showSections) {
        return { visible: lines.slice(0, i), locked: lines.slice(i) };
      }
    }
  }
  return { visible: lines, locked: [] as string[] };
}

function renderLines(lines: string[]) {
  return lines.map((line, i) => {
    if (line.startsWith("# ")) return <h1 key={i} className="font-display text-xl font-semibold text-emerald-400 mt-6 mb-3 border-b border-white/[0.08] pb-2">{line.slice(2)}</h1>;
    if (line.startsWith("## ")) return <h2 key={i} className="font-display text-lg font-semibold text-emerald-400 mt-5 mb-2">{line.slice(3)}</h2>;
    if (line.startsWith("### ")) return <h3 key={i} className="font-display text-md font-semibold text-emerald-300 mt-4 mb-2">{line.slice(4)}</h3>;
    if (line.startsWith("---")) return <hr key={i} className="border-white/[0.08] my-4" />;
    if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="text-gray-300 ml-4 list-disc">{line.slice(2)}</li>;
    if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="text-white font-semibold mt-2">{line.replace(/\*\*/g, "")}</p>;
    if (line.trim() === "") return <div key={i} className="h-2" />;
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-gray-300 leading-relaxed">
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={j} className="text-white">{part.slice(2, -2)}</strong>
            : part
        )}
      </p>
    );
  });
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const isPro = canAccessPro(tier);
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [currentReport, setCurrentReport] = useState<ReportFull | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportSearch, setReportSearch] = useState("");
  const { isWatched, watchlist } = useWatchlist();
  const [watchlistOnly, setWatchlistOnly] = useState(false);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => {
        const list = d.reports || [];
        setReports(list);
        if (list.length > 0) loadReport(list[0].date);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadReport = async (date: string) => {
    setLoadingReport(true);
    try {
      const res = await fetch(`/api/reports?date=${date}`);
      if (res.ok) setCurrentReport(await res.json());
    } catch { /* ignore */ }
    setLoadingReport(false);
  };

  const filtered = reports.filter((r) => {
    if (watchlistOnly && !(r.netuid && watchlist.has(r.netuid))) return false;
    if (!reportSearch.trim()) return true;
    const q = reportSearch.toLowerCase();
    const dateStr = new Date(r.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toLowerCase();
    return dateStr.includes(q) || (r.subnet_name?.toLowerCase() || "").includes(q) || r.date.includes(q);
  });

  // For rendering the expanded report content
  const renderReportContent = (report: ReportFull) => {
    if (isPro) {
      return (
        <div className="px-6 py-5 prose prose-invert prose-sm max-w-none">
          {renderLines(report.content.split("\n"))}
        </div>
      );
    }

    const { visible, locked } = splitAtSection(report.content, 2);

    return (
      <>
        <div className="px-6 py-5 prose prose-invert prose-sm max-w-none">
          {renderLines(visible)}
        </div>
        {locked.length > 0 && (
          <div className="px-6 pb-2">
            <BlurGate tier={tier} required="pro" minHeight="260px">
              <div className="prose prose-invert prose-sm max-w-none py-3">
                {renderLines(locked)}
              </div>
            </BlurGate>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen ag-aurora text-white">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <div className="relative px-4 md:px-6 pt-9 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-[40px] font-semibold tracking-[-0.03em] text-white leading-tight mb-2">
              Deep Dive <span className="ag-gradient-text">Reports</span>
            </h1>
            <p className="text-sm md:text-[14.5px] text-gray-400 max-w-xl leading-[1.65] mb-4">
              Daily deep-dives on the top-ranked subnet. Product maturity, developer velocity, market position, and key catalysts — published every morning at 7am PT.
            </p>
            <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-4">
              <span className="ag-live-dot" />
              <span className="tabular-nums">{reports.length} REPORTS · PUBLISHED DAILY 7AM PT</span>
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-2">
              {!isPro && (
                <span className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] backdrop-blur-[14px] rounded-full px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-wider text-gray-500">
                  <AgIcon name="lock" /> Analysis sections — Pro only
                </span>
              )}
              <span className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] backdrop-blur-[14px] rounded-full px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-wider text-gray-500">
                <AgIcon name="clock" /> Auto-generated daily
              </span>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Search + filter bar */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search reports..."
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              className="w-full bg-white/[0.035] border border-white/[0.08] text-sm rounded-full pl-9 pr-4 py-2.5 text-gray-200 placeholder-gray-500 backdrop-blur-[14px] focus:outline-none focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/20"
            />
          </div>
          <div className="ag-pill-tabs">
            <button
              onClick={() => setWatchlistOnly(v => !v)}
              className={`ag-pill-tab inline-flex items-center gap-1.5 ${watchlistOnly ? "ag-pill-tab-on" : ""}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              My Watchlist
            </button>
          </div>
        </div>

        {!loadingReport && reports.length === 0 && (
          <div className="ag-glass p-10 text-center">
            <div className="text-4xl mb-3 flex justify-center text-gray-400"><AgIcon name="chart" /></div>
            <h3 className="font-display text-lg font-semibold mb-2">No Reports Yet</h3>
            <p className="text-gray-500 text-sm">Reports are auto-generated daily at 7am PT on the top aGap subnet.</p>
          </div>
        )}

        <div className="space-y-3">
          {/* Latest report — always accessible (free tier gets first 2 sections) */}
          {filtered.slice(0, 1).map((r) => {
            const isExpanded = currentReport?.date === r.date;
            const dateLabel = new Date(r.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
            const isWatchedReport = r.netuid != null && isWatched(r.netuid);
            return (
              <div key={r.date} className={`ag-glass overflow-hidden transition-all ${
                isWatchedReport
                  ? "ring-2 ring-blue-400/60 shadow-lg shadow-blue-500/20"
                  : ""
              }`}>
                <button
                  className="w-full flex items-start sm:items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors text-left gap-3"
                  onClick={() => isExpanded ? setCurrentReport(null) : loadReport(r.date)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-1 h-8 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full flex-shrink-0" />
                    <span className="font-display text-sm font-semibold text-white truncate">
                      {r.subnet_name ? `${r.subnet_name} — ${dateLabel}` : dateLabel}
                    </span>
                    <span className="ag-badge ag-badge-buy flex-shrink-0">Latest</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.composite_score != null && (
                      <span className="font-mono text-emerald-400 font-semibold text-sm tabular-nums">{r.composite_score} aGap</span>
                    )}
                    {loadingReport && isExpanded
                      ? <div className="w-4 h-4 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
                      : <span className="text-gray-600 text-xs">{isExpanded ? "▲" : "▼"}</span>
                    }
                  </div>
                </button>

                {isExpanded && currentReport && (
                  <div className="border-t border-white/[0.08]">
                    {renderReportContent(currentReport)}
                    <div className="px-6 pb-4 text-xs text-gray-600">
                      Generated {new Date(currentReport.generated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Older reports — locked for free users */}
          {filtered.length > 1 && (
            <BlurGate tier={tier} required="pro" minHeight="300px">
              <div className="space-y-2.5">
                {filtered.slice(1).map((r) => {
                  const isExpanded = currentReport?.date === r.date;
                  const dateLabel = new Date(r.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                  const isWatchedReport = r.netuid != null && isWatched(r.netuid);
                  return (
                    <div key={r.date} className={`ag-glass overflow-hidden transition-all ${
                      isWatchedReport
                        ? "ring-2 ring-blue-400/60 shadow-lg shadow-blue-500/20"
                        : ""
                    }`}>
                      <button
                        className="w-full flex items-start sm:items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors text-left gap-3"
                        onClick={() => isExpanded ? setCurrentReport(null) : loadReport(r.date)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-1 h-8 bg-gradient-to-b from-gray-600 to-gray-700 rounded-full flex-shrink-0" />
                          <span className="font-display text-sm font-semibold text-white truncate">
                            {r.subnet_name ? `${r.subnet_name} — ${dateLabel}` : dateLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.composite_score != null && (
                            <span className="font-mono text-emerald-400 font-semibold text-sm tabular-nums">{r.composite_score} aGap</span>
                          )}
                          <span className="text-gray-600 text-xs">{isExpanded ? "▲" : "▼"}</span>
                        </div>
                      </button>

                      {isExpanded && currentReport && (
                        <div className="border-t border-white/[0.08]">
                          <div className="px-6 py-5 prose prose-invert prose-sm max-w-none">
                            {renderLines(currentReport.content.split("\n"))}
                          </div>
                          <div className="px-6 pb-4 text-xs text-gray-600">
                            Generated {new Date(currentReport.generated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </BlurGate>
          )}
        </div>
      </main>
    </div>
  );
}
