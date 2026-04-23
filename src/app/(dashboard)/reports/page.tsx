"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import BlurGate from "@/components/BlurGate";
import { getTier, canAccessPro } from "@/lib/subscription";
import { useWatchlist } from "@/components/dashboard/WatchlistProvider";

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
    if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold text-green-400 mt-6 mb-3 border-b border-gray-800 pb-2">{line.slice(2)}</h1>;
    if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold text-green-400 mt-5 mb-2">{line.slice(3)}</h2>;
    if (line.startsWith("### ")) return <h3 key={i} className="text-md font-semibold text-green-300 mt-4 mb-2">{line.slice(4)}</h3>;
    if (line.startsWith("---")) return <hr key={i} className="border-gray-800 my-4" />;
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
      // Pro/premium: render everything
      return (
        <div className="px-6 py-5 prose prose-invert prose-sm max-w-none">
          {renderLines(report.content.split("\n"))}
        </div>
      );
    }

    // Free tier: show first 2 ## sections (subnet description + raw technical),
    // blur everything from the 3rd ## section onward
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
    <main className="flex-1 overflow-auto p-4 md:p-6">
      <div className="space-y-4">
        <div className="mb-4">
          <h2 className="text-lg font-bold">Daily Deep Dive Reports</h2>
          <p className="text-sm text-gray-500 mt-0.5">Daily deep-dives on the top-ranked subnet. Covers product maturity, developer velocity, market position, and the key catalysts and risks worth knowing — published every morning before the market reacts.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          {!isPro && (
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full border border-gray-700">🔒 Analysis sections — Pro only</span>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search reports..."
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-sm rounded px-3 py-1 text-gray-300 placeholder-gray-600 w-full sm:w-44 focus:outline-none focus:border-gray-500"
            />
            <button
              onClick={() => setWatchlistOnly(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                watchlistOnly
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              My Watchlist
            </button>
            <span className="text-xs text-gray-600">Auto-generated daily at 7am PT</span>
          </div>
        </div>

        {!loadingReport && reports.length === 0 && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 text-center">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="text-lg font-bold mb-2">No Reports Yet</h3>
            <p className="text-gray-500 text-sm">Reports are auto-generated daily at 7am PT on the top aGap subnet.</p>
          </div>
        )}

        {/* Latest report — always accessible (free tier gets first 2 sections) */}
        {filtered.slice(0, 1).map((r) => {
          const isExpanded = currentReport?.date === r.date;
          const dateLabel = new Date(r.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
          const isWatchedReport = r.netuid != null && isWatched(r.netuid);
          return (
            <div key={r.date} className={`bg-gray-900/50 border rounded-lg overflow-hidden ${isWatchedReport ? "border-blue-400/70 ring-2 ring-blue-400/60 bg-blue-950/40 shadow-lg shadow-blue-500/30" : "border-gray-800"}`}>
              <button
                className="w-full flex items-start sm:items-center justify-between px-4 sm:px-5 py-3 hover:bg-gray-800/40 transition-colors text-left gap-2"
                onClick={() => isExpanded ? setCurrentReport(null) : loadReport(r.date)}
              >
                <div className="flex items-center gap-0 min-w-0">
                  <span className="text-sm font-semibold text-white truncate">
                    {r.subnet_name ? `${r.subnet_name} — ${dateLabel}` : dateLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.composite_score != null && (
                    <span className="text-green-400 font-bold text-sm">{r.composite_score} aGap</span>
                  )}
                  {loadingReport && isExpanded
                    ? <span className="text-xs text-gray-500 animate-pulse">Loading...</span>
                    : <span className="text-gray-600 text-xs">{isExpanded ? "▲" : "▼"}</span>
                  }
                </div>
              </button>

              {isExpanded && currentReport && (
                <div className="border-t border-gray-800">
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
            <div className="space-y-3">
              {filtered.slice(1).map((r) => {
                const isExpanded = currentReport?.date === r.date;
                const dateLabel = new Date(r.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                const isWatchedReport = r.netuid != null && isWatched(r.netuid);
                return (
                  <div key={r.date} className={`bg-gray-900/50 border rounded-lg overflow-hidden ${isWatchedReport ? "border-blue-400/70 ring-2 ring-blue-400/60 bg-blue-950/40 shadow-lg shadow-blue-500/30" : "border-gray-800"}`}>
                    <button
                      className="w-full flex items-start sm:items-center justify-between px-4 sm:px-5 py-3 hover:bg-gray-800/40 transition-colors text-left gap-2"
                      onClick={() => isExpanded ? setCurrentReport(null) : loadReport(r.date)}
                    >
                      <div className="flex items-center gap-0 min-w-0">
                        <span className="text-sm font-semibold text-white truncate">
                          {r.subnet_name ? `${r.subnet_name} — ${dateLabel}` : dateLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {r.composite_score != null && (
                          <span className="text-green-400 font-bold text-sm">{r.composite_score} aGap</span>
                        )}
                        <span className="text-gray-600 text-xs">{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {isExpanded && currentReport && (
                      <div className="border-t border-gray-800">
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
  );
}
