"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import SubnetDetailPanel from "@/components/dashboard/SubnetDetailPanel";
import { signalColor, signalIcon, timeAgo, formatMcap } from "@/lib/formatters";

export default function SignalsPage() {
  const { signals, leaderboard, scanning, setSelectedSubnet } = useDashboard();
  const router = useRouter();
  void setSelectedSubnet;
  const [signalSort, setSignalSort] = useState<"score" | "date">("score");
  const [searchQuery, setSearchQuery] = useState("");

  const q = searchQuery.toLowerCase().trim();

  // YYYY-MM-DD slice works for both date-only strings and full ISO timestamps.
  // Plain string comparison (> < ===) on YYYY-MM-DD is reliable lexicographic order.
  const day = (sig: (typeof signals)[number]) =>
    (sig.signal_date || sig.created_at || "1970-01-01").slice(0, 10);

  const byScore = useMemo(() =>
    [...signals].sort((a, b) => {
      const sa = Number(a.strength) || 0;
      const sb = Number(b.strength) || 0;
      if (sb !== sa) return sb - sa;           // highest score first
      const da = day(a); const db = day(b);
      if (db > da) return 1;                   // newer date first (tiebreak)
      if (db < da) return -1;
      return a.netuid - b.netuid;              // final stable tiebreak
    }), [signals]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDate = useMemo(() =>
    [...signals].sort((a, b) => {
      const da = day(a); const db = day(b);
      if (db > da) return 1;                   // newer day first
      if (db < da) return -1;
      const sa = Number(a.strength) || 0;
      const sb = Number(b.strength) || 0;
      if (sb !== sa) return sb - sa;           // within same day: highest score first
      return a.netuid - b.netuid;              // final stable tiebreak
    }), [signals]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = signalSort === "score" ? byScore : byDate;
  const sorted = base.filter(
    (sig) => !q || (sig.subnet_name || "").toLowerCase().includes(q) || sig.title.toLowerCase().includes(q) || `sn${sig.netuid}`.includes(q)
  );

  return (
    <main className="flex-1 flex overflow-x-hidden">
      <div className="flex-1 overflow-auto p-4 md:p-6 max-w-full">
        {scanning && signals.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-900/60 border border-gray-700/40 rounded-lg px-3 py-2 mb-4">
            <span className="animate-spin text-green-400">&#x21BB;</span>
            <span>Refreshing signals in background&hellip;</span>
          </div>
        )}

        {scanning && signals.length === 0 && (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <div className="text-4xl mb-4 animate-spin">&#x21BB;</div>
            <h2 className="text-xl font-bold mb-2">Loading Signals&hellip;</h2>
            <p className="text-gray-500 max-w-md mb-4">Scanning GitHub, HuggingFace, X, and Discord.</p>
            <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-green-400 rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>
        )}

        {!scanning && signals.length === 0 && (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <div className="text-6xl mb-4">📡</div>
            <h2 className="text-xl font-bold mb-2">No Signals Yet</h2>
            <p className="text-gray-500 max-w-md">Signals refresh automatically every 10 minutes.</p>
          </div>
        )}

        {signals.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold">Intelligence Feed</h2>
                <input
                  type="text"
                  placeholder="Search signals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600/30 w-48"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 mr-2">{signals.length} signals</span>
                <button
                  onClick={() => setSignalSort("score")}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${signalSort === "score" ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                >
                  🏆 Top Score
                </button>
                <button
                  onClick={() => setSignalSort("date")}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${signalSort === "date" ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                >
                  🕐 Latest
                </button>
              </div>
            </div>

            {sorted.map((sig) => {
              const lb = leaderboard.find((s) => s.netuid === sig.netuid);
              const mcapStr = formatMcap(lb?.market_cap);
              const agap = lb?.composite_score;

              return (
                <div
                  key={`${sig.netuid}-${sig.signal_type}-${(sig.signal_date || sig.created_at || "").slice(0, 10)}`}
                  className={`bg-gray-900/50 border rounded-lg overflow-hidden transition-colors cursor-pointer ${
                    sig.strength >= 80 ? "border-green-800/60 signal-hot" :
                    sig.strength >= 50 ? "border-yellow-900/40" : "border-gray-800"
                  } hover:border-gray-600`}
                  onClick={() => router.push(`/subnets/${sig.netuid}`)}
                >
                  {/* Header */}
                  <div className={`px-4 py-2.5 flex items-center justify-between ${
                    sig.strength >= 80 ? "bg-green-950/30" :
                    sig.strength >= 50 ? "bg-yellow-950/20" : "bg-gray-800/30"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`text-xl ${signalColor(sig.signal_type)}`}>{signalIcon(sig.signal_type)}</span>
                      <span className="text-xs font-medium text-gray-400 bg-gray-800 rounded px-2 py-0.5">SN{sig.netuid}</span>
                      <span className="font-semibold text-sm">{sig.subnet_name || `Subnet ${sig.netuid}`}</span>
                      <span className="text-xs text-gray-600 hidden sm:inline">via {sig.source}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-white">
                        {sig.signal_date
                          ? new Date(sig.signal_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : sig.created_at ? timeAgo(sig.created_at) : ""}
                      </span>
                      <div className={`text-lg font-bold tabular-nums ${
                        sig.strength >= 80 ? "text-green-400" :
                        sig.strength >= 50 ? "text-yellow-400" : "text-gray-500"
                      }`}>{sig.strength}</div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-4 py-3">
                    <h3 className="font-medium text-sm mb-2">{sig.title}</h3>

                    {/* Market cap + aGap badges */}
                    {lb && (
                      <div className="flex items-center gap-3 mb-3">
                        {mcapStr && (
                          <span className="text-xs text-gray-400 bg-gray-800 rounded px-2 py-0.5">
                            Market Cap: <span className="text-white font-medium">{mcapStr}</span>
                          </span>
                        )}
                        {agap != null && (
                          <span className="text-xs text-gray-400 bg-gray-800 rounded px-2 py-0.5">
                            aGap Score: <span className={`font-medium ${agap >= 80 ? "text-green-400" : agap >= 50 ? "text-yellow-400" : "text-gray-300"}`}>{agap}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {(sig.analysis || sig.description) ? (
                      <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4 mb-2 space-y-1">
                        {(sig.analysis || sig.description || "").split("\n").filter((l) => l.trim()).map((line, i) => {
                          const trimmed = line.trim();
                          if (trimmed === "---" || trimmed === "***") return null;
                          if (trimmed.startsWith("# AlphaGap")) return null;
                          if (trimmed.startsWith("**Date:**") || trimmed.startsWith("**Signal Strength:**")) return null;
                          if (trimmed.match(/^(#{1,3}\s+)?[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u) ||
                              trimmed.match(/^(#{1,3}\s+)?\*\*[🔧📡💡🎯🚀⚠️]/)) {
                            const headerText = trimmed.replace(/^#{1,3}\s+/, "").replace(/\*\*/g, "");
                            return <p key={i} className="text-sm font-bold text-green-400 mt-3 first:mt-0 pb-0.5">{headerText}</p>;
                          }
                          const renderBold = (text: string) => {
                            const parts = text.split(/\*\*(.*?)\*\*/g);
                            return parts.map((part, j) =>
                              j % 2 === 1
                                ? <strong key={j} className="text-white font-semibold">{part}</strong>
                                : <span key={j}>{part}</span>
                            );
                          };
                          return <p key={i} className="text-sm text-gray-300 leading-relaxed">{renderBold(trimmed)}</p>;
                        })}
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${sig.strength >= 80 ? "bg-green-400" : sig.strength >= 50 ? "bg-yellow-400" : "bg-gray-600"}`}
                            style={{ width: `${sig.strength}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">{sig.signal_type.replace(/_/g, " ")}</span>
                      </div>
                      {sig.source_url && (
                        <a href={sig.source_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}>
                          View source
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SubnetDetailPanel />
    </main>
  );
}
