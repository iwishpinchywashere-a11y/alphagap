"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── Types ────────────────────────────────────────────────────────
interface Signal {
  id: number;
  netuid: number;
  signal_type: string;
  strength: number;
  title: string;
  description: string;
  source: string;
  source_url?: string;
  analysis?: string;
  analysis_status?: string;
  created_at: string;
  signal_date?: string;
  subnet_name?: string;
}

interface SubnetScore {
  netuid: number;
  name: string;
  composite_score: number;
  flow_score: number;
  dev_score: number;
  eval_score: number;
  social_score: number;
  signal_count: number;
  top_signal?: string;
  alpha_price?: number;
  market_cap?: number;
  net_flow_24h?: number;
  emission_pct?: number;
  eval_ratio?: number;
  price_change_24h?: number;
  price_change_1h?: number;
}

// ── Helpers ──────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatNum(n: number | undefined | null, decimals = 2): string {
  if (n == null) return "\u2014";
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(decimals);
}

function signalColor(type: string): string {
  switch (type) {
    case "flow_inflection": return "text-green-400";
    case "flow_spike": return "text-emerald-400";
    case "flow_warning": return "text-red-400";
    case "dev_spike": return "text-blue-400";
    case "release": return "text-purple-400";
    case "hf_update": return "text-yellow-400";
    case "hf_drop": return "text-yellow-400";
    case "cross_signal": return "text-pink-400";
    case "price_surge": return "text-green-300";
    case "price_drop": return "text-red-400";
    case "buy_pressure": return "text-green-400";
    case "sell_pressure": return "text-red-400";
    case "social_buzz": return "text-cyan-400";
    default: return "text-gray-400";
  }
}

function signalIcon(type: string): string {
  switch (type) {
    case "flow_inflection": return "\u2197";
    case "flow_spike": return "\u26A1";
    case "flow_warning": return "\u26A0";
    case "dev_spike": return "\uD83D\uDD28";
    case "release": return "\uD83D\uDE80";
    case "hf_update": return "\uD83E\uDD17";
    case "hf_drop": return "\uD83E\uDD17";
    case "cross_signal": return "\u2726";
    case "price_surge": return "\uD83D\uDCC8";
    case "price_drop": return "\uD83D\uDCC9";
    case "buy_pressure": return "\uD83D\uDFE2";
    case "sell_pressure": return "\uD83D\uDD34";
    case "social_buzz": return "\uD83D\uDCE3";
    default: return "\u2022";
  }
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
}

function flowColor(flow: number | null | undefined): string {
  if (flow == null) return "text-gray-500";
  if (flow > 0) return "text-green-400";
  if (flow < 0) return "text-red-400";
  return "text-gray-500";
}

// ── Main App ─────────────────────────────────────────────────────
export default function Home() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [leaderboard, setLeaderboard] = useState<SubnetScore[]>([]);
  const [taoPrice, setTaoPrice] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"signals" | "leaderboard">("leaderboard");
  const [selectedSubnet, setSelectedSubnet] = useState<number | null>(null);
  const [sortCol, setSortCol] = useState<keyof SubnetScore>("composite_score");
  const [sortAsc, setSortAsc] = useState(false);
  const [infoPopup, setInfoPopup] = useState<string | null>(null);
  const [signalSort, setSignalSort] = useState<"score" | "date">("score");
  const [searchQuery, setSearchQuery] = useState("");

  const hasAutoScanned = useRef(false);

  const handleSort = (col: keyof SubnetScore) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  const q = searchQuery.toLowerCase().trim();
  const sortedLeaderboard = [...leaderboard]
    .filter((sub) => !q || sub.name.toLowerCase().includes(q) || `sn${sub.netuid}`.includes(q))
    .sort((a, b) => {
      const av = a[sortCol] ?? -Infinity;
      const bv = b[sortCol] ?? -Infinity;
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

  // ── Run scan: calls /api/scan and stores everything in state ────
  // Load cached data, optionally refresh in background
  const loadData = useCallback((data: Record<string, unknown>) => {
    setLeaderboard((data.leaderboard as SubnetScore[]) || []);
    setSignals((data.signals as Signal[]) || []);
    setTaoPrice((data.taoPrice as number) || null);
    const lastScanTime = data.lastScan ? new Date(data.lastScan as string).toLocaleTimeString() : new Date().toLocaleTimeString();
    setLastScan(lastScanTime);
    const duration = data.duration_ms ? `${((data.duration_ms as number) / 1000).toFixed(1)}s` : "";
    const counts = (data.counts || {}) as Record<string, number>;
    const cached = data.cached ? " (cached)" : "";
    setScanResult(
      `${counts.subnets || 0} subnets, ${counts.signals || 0} signals${duration ? ` in ${duration}` : ""}${cached}`
    );
  }, []);

  const runScan = useCallback(async () => {
    setScanning(true);
    setScanResult(null);
    setScanError(null);
    setScanStep("Scanning all sources...");

    try {
      const res = await fetch("/api/scan");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Scan failed (${res.status}): ${text}`);
      }
      const data = await res.json();
      loadData(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setScanError(msg);
      console.error("Scan error:", e);
    } finally {
      setScanning(false);
      setScanStep(null);
    }
  }, [loadData]);

  // On first load: try cached data first, then refresh in background
  useEffect(() => {
    if (!hasAutoScanned.current) {
      hasAutoScanned.current = true;

      // Step 1: Load cached data instantly
      fetch("/api/cached-scan")
        .then((res) => {
          if (!res.ok) throw new Error("no cache");
          return res.json();
        })
        .then((data) => {
          loadData(data);
          // Check if cache is stale (>15 minutes old)
          const lastScanTime = data.lastScan ? new Date(data.lastScan).getTime() : 0;
          const cacheAge = Date.now() - lastScanTime;
          if (cacheAge > 15 * 60 * 1000) {
            // Cache is stale, refresh in background
            console.log("Cache is stale, refreshing...");
            runScan();
          }
        })
        .catch(() => {
          // No cache available, do a full scan
          console.log("No cache, running full scan...");
          runScan();
        });
    }
  }, [loadData, runScan]);

  // Close info popup when clicking anywhere else
  useEffect(() => {
    if (infoPopup) {
      const handler = () => setInfoPopup(null);
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [infoPopup]);

  // Lazy-load AI analysis for signals that don't have it
  const analyzingRef = useRef(new Set<number>());

  useEffect(() => {
    if (signals.length === 0 || scanning) return;

    // Auto-analyze ALL signals that don't have AI analysis (no 🔧 in description)
    const unanalyzed = signals.filter(
      (s) => !s.analysis && !(s.description || "").includes("🔧") && (s.signal_type === "dev_spike" || s.signal_type === "hf_update") && !analyzingRef.current.has(s.id)
    );
    if (unanalyzed.length === 0) return;

    // Analyze up to 5 at a time, staggered
    const batch = unanalyzed.slice(0, 5);
    for (const sig of batch) {
      analyzingRef.current.add(sig.id);
    }

    const analyzeSignal = async (sig: Signal) => {
      const subnetData = leaderboard.find((s) => s.netuid === sig.netuid);
      try {
        const res = await fetch("/api/analyze-signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: sig.title,
            description: sig.description,
            subnet_name: sig.subnet_name,
            netuid: sig.netuid,
            source_url: sig.source_url,
            composite_score: subnetData?.composite_score,
            alpha_price: subnetData?.alpha_price,
            price_change_24h: subnetData?.price_change_24h,
            market_cap: subnetData?.market_cap,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.analysis) {
            // Replace the description with the AI analysis
            setSignals((prev) =>
              prev.map((s) => (s.id === sig.id ? { ...s, description: data.analysis, analysis: data.analysis } : s))
            );
          }
        }
      } catch {
        // silently fail
      }
    };

    // Stagger calls with 500ms delay between each
    batch.forEach((sig, i) => {
      setTimeout(() => analyzeSignal(sig), i * 500);
    });
  }, [signals, leaderboard, scanning]);

  // Get detail for a selected subnet from the leaderboard/signals data we already have
  const getSubnetDetail = (netuid: number) => {
    setSelectedSubnet(netuid);
  };

  const selectedSubnetData = selectedSubnet != null
    ? leaderboard.find((s) => s.netuid === selectedSubnet)
    : null;

  const selectedSubnetSignals = selectedSubnet != null
    ? signals.filter((s) => s.netuid === selectedSubnet)
    : [];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">
            <span className="text-green-400">Alpha</span>
            <span className="text-blue-400">Gap</span>
          </h1>
          <span className="text-xs text-gray-500 border border-gray-700 rounded px-2 py-0.5">
            Bittensor Subnet Intelligence
          </span>
          {taoPrice != null && (
            <span className="text-xs text-gray-400">
              TAO ${taoPrice.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {lastScan && (
            <span className="text-xs text-gray-500">
              Last scan: {lastScan}
            </span>
          )}
          {scanResult && (
            <span className="text-xs text-green-400">{scanResult}</span>
          )}
          {scanError && (
            <span className="text-xs text-red-400 max-w-xs truncate" title={scanError}>
              Error: {scanError.slice(0, 60)}
            </span>
          )}
          <button
            onClick={runScan}
            disabled={scanning}
            className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-2 rounded text-sm hover:bg-green-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning
              ? (scanStep || "Scanning...")
              : "Scan All Sources"}
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="border-b border-gray-800 px-6 flex gap-1">
        {(["leaderboard", "signals"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSelectedSubnet(null); }}
            className={`px-4 py-3 text-sm capitalize transition-colors border-b-2 ${
              activeTab === tab
                ? "border-green-400 text-green-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab === "signals" && `Signals ${signals.length > 0 ? `(${signals.length})` : ""}`}
            {tab === "leaderboard" && "Alpha Leaderboard"}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 flex">
        {/* Left panel */}
        <div className="flex-1 overflow-auto p-6">
          {/* Loading state */}
          {scanning && signals.length === 0 && leaderboard.length === 0 && (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <div className="text-4xl mb-4 animate-spin">&#x21BB;</div>
              <h2 className="text-xl font-bold mb-2">Scanning All Sources</h2>
              <p className="text-gray-500 max-w-md mb-4">
                Pulling data from TaoStats, GitHub, HuggingFace, and Desearch.
                This takes 30-50 seconds on the first load.
              </p>
              <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-400 rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </div>
          )}

          {/* Empty state (not scanning) */}
          {!scanning && signals.length === 0 && leaderboard.length === 0 && (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <div className="text-6xl mb-4">&#x1F50D;</div>
              <h2 className="text-xl font-bold mb-2">No Data Yet</h2>
              <p className="text-gray-500 max-w-md mb-6">
                Hit the <span className="text-green-400">&quot;Scan All Sources&quot;</span> button to pull data from TaoStats, GitHub, and HuggingFace across all Bittensor subnets.
              </p>
              <button
                onClick={runScan}
                disabled={scanning}
                className="bg-green-500/20 border border-green-500/40 text-green-400 px-6 py-3 rounded-lg text-base hover:bg-green-500/30 transition-colors disabled:opacity-50"
              >
                Run First Scan
              </button>
            </div>
          )}

          {/* Signals Feed */}
          {activeTab === "signals" && signals.length > 0 && (
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
                  <span className="text-xs text-gray-500 mr-2">
                    {signals.length} signals
                  </span>
                  <button
                    onClick={() => setSignalSort("score")}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      signalSort === "score"
                        ? "bg-green-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    🏆 Top Score
                  </button>
                  <button
                    onClick={() => setSignalSort("date")}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      signalSort === "date"
                        ? "bg-green-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    🕐 Latest
                  </button>
                </div>
              </div>
              {[...signals]
                .filter((sig) => !q || (sig.subnet_name || "").toLowerCase().includes(q) || sig.title.toLowerCase().includes(q) || `sn${sig.netuid}`.includes(q))
                .sort((a, b) =>
                  signalSort === "score"
                    ? b.strength - a.strength
                    : new Date(b.signal_date || b.created_at).getTime() - new Date(a.signal_date || a.created_at).getTime()
                )
                .map((sig) => (
                <div
                  key={sig.id}
                  className={`bg-gray-900/50 border rounded-lg overflow-hidden transition-colors cursor-pointer ${
                    sig.strength >= 80
                      ? "border-green-800/60 signal-hot"
                      : sig.strength >= 50
                      ? "border-yellow-900/40"
                      : "border-gray-800"
                  } hover:border-gray-600`}
                  onClick={() => getSubnetDetail(sig.netuid)}
                >
                  {/* Header bar */}
                  <div className={`px-4 py-2.5 flex items-center justify-between ${
                    sig.strength >= 80 ? "bg-green-950/30" :
                    sig.strength >= 50 ? "bg-yellow-950/20" : "bg-gray-800/30"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`text-xl ${signalColor(sig.signal_type)}`}>
                        {signalIcon(sig.signal_type)}
                      </span>
                      <span className="text-xs font-medium text-gray-400 bg-gray-800 rounded px-2 py-0.5">
                        SN{sig.netuid}
                      </span>
                      <span className="font-semibold text-sm">
                        {sig.subnet_name || `Subnet ${sig.netuid}`}
                      </span>
                      <span className="text-xs text-gray-600 hidden sm:inline">
                        via {sig.source}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-600">
                        {sig.signal_date
                          ? new Date(sig.signal_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : sig.created_at ? timeAgo(sig.created_at) : ""}
                      </span>
                      <div className={`text-lg font-bold tabular-nums ${
                        sig.strength >= 80 ? "text-green-400" :
                        sig.strength >= 50 ? "text-yellow-400" : "text-gray-500"
                      }`}>
                        {sig.strength}
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-4 py-3">
                    <h3 className="font-medium text-sm mb-2">{sig.title}</h3>

                    {(sig.analysis || sig.description) ? (
                      <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4 mb-2 space-y-1">
                        {(sig.analysis || sig.description || "").split("\n").filter((l: string) => l.trim()).map((line: string, i: number) => {
                          const trimmed = line.trim();
                          // Skip markdown artifacts
                          if (trimmed === "---" || trimmed === "***") return null;
                          // Skip report title headers
                          if (trimmed.startsWith("# AlphaGap")) return null;
                          // Skip date/strength metadata lines
                          if (trimmed.startsWith("**Date:**") || trimmed.startsWith("**Signal Strength:**")) return null;
                          // Section headers: ## 🔧 What they built: or 🔧 What they built:
                          // Match lines starting with optional ## + any emoji + text with colon
                          if (trimmed.match(/^(#{1,3}\s+)?[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u) ||
                              trimmed.match(/^(#{1,3}\s+)?\*\*[🔧📡💡🎯🚀⚠️]/)) {
                            const headerText = trimmed.replace(/^#{1,3}\s+/, "").replace(/\*\*/g, "");
                            return (
                              <p key={i} className="text-sm font-bold text-green-400 mt-3 first:mt-0 pb-0.5">
                                {headerText}
                              </p>
                            );
                          }
                          // Bold text: **text** -> styled
                          const renderBold = (text: string) => {
                            const parts = text.split(/\*\*(.*?)\*\*/g);
                            return parts.map((part, j) =>
                              j % 2 === 1
                                ? <strong key={j} className="text-white font-semibold">{part}</strong>
                                : <span key={j}>{part}</span>
                            );
                          };
                          return (
                            <p key={i} className="text-sm text-gray-300 leading-relaxed">
                              {renderBold(trimmed)}
                            </p>
                          );
                        })}
                      </div>
                    ) : null}

                    {/* Footer with links */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              sig.strength >= 80 ? "bg-green-400" :
                              sig.strength >= 50 ? "bg-yellow-400" : "bg-gray-600"
                            }`}
                            style={{ width: `${sig.strength}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">
                          {sig.signal_type.replace(/_/g, " ")}
                        </span>
                      </div>
                      {sig.source_url && (
                        <a
                          href={sig.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View source
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Leaderboard */}
          {activeTab === "leaderboard" && leaderboard.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold">Alpha Leaderboard</h2>
                  <input
                    type="text"
                    placeholder="Search subnets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600/30 w-48"
                  />
                </div>
                <span className="text-xs text-gray-500">
                  aGap = Dev execution + Price lagging = Alpha opportunity
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-data">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left py-2 px-3">#</th>
                      <th className="text-left py-2 px-3">Subnet</th>
                      {([
                        ["composite_score", "aGap", "Alpha Gap Score (0-100). High when subnet is building hard but price hasn't caught up. Weighted: Dev activity 55%, Price lag 25%, Social gap 10%, Confidence 10%."],
                        ["flow_score", "Flow", "Flow Score (0-100). Based on 24h price change. High = price rising, Low = price falling. Uses absolute thresholds, not relative."],
                        ["dev_score", "Dev", "Development Score (0-100). Percentile rank of GitHub + HuggingFace activity. Measures commits, PRs, models published, and contributor count."],
                        ["eval_score", "eVal", "eVal Score (0-100). Emissions-to-Valuation ratio. Finds subnets where network emission share outpaces market cap — the network is paying them more than the market realizes. High eVal + low price = value gap."],
                        ["social_score", "Social", "Social Score (0-100). Social velocity from X/Twitter and Reddit. Measures mention count and engagement (likes, retweets, views)."],
                        ["alpha_price", "Price", ""],
                        ["market_cap", "MCap", ""],
                        ["price_change_1h", "1h %", ""],
                        ["price_change_24h", "24h %", ""],
                        ["net_flow_24h", "24h Net", ""],
                        ["signal_count", "Signals", ""],
                      ] as [keyof SubnetScore, string, string][]).map(([key, label, tooltip]) => (
                        <th
                          key={key}
                          className={`text-right py-2 px-3 cursor-pointer hover:text-gray-300 transition-colors select-none ${key === "composite_score" ? "text-green-400/80" : ""}`}
                          onClick={() => handleSort(key)}
                          style={key === "composite_score" ? { background: "rgba(16, 185, 129, 0.06)", borderLeft: "2px solid rgba(16, 185, 129, 0.15)" } : undefined}
                        >
                          {label}
                          {tooltip && (
                            <span
                              className="ml-1 text-gray-500 hover:text-gray-300 cursor-help relative inline-block"
                              onClick={(e) => { e.stopPropagation(); setInfoPopup(infoPopup === key ? null : key); }}
                            >
                              {"\u24D8"}
                              {infoPopup === key && (
                                <div className="absolute z-50 top-6 left-0 w-64 p-3 bg-gray-800 border border-gray-600 rounded-lg shadow-xl text-xs text-gray-300 font-normal whitespace-normal">
                                  {tooltip}
                                  <div className="mt-2 text-gray-500 text-[10px]">Click {"\u24D8"} again to close</div>
                                </div>
                              )}
                            </span>
                          )}
                          {sortCol === key && (
                            <span className="ml-1 text-green-400">
                              {sortAsc ? "\u25B2" : "\u25BC"}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLeaderboard.map((sub, i) => (
                      <tr
                        key={sub.netuid}
                        className="border-b border-gray-800/50 hover:bg-gray-900/50 cursor-pointer transition-colors"
                        onClick={() => getSubnetDetail(sub.netuid)}
                      >
                        <td className="py-2.5 px-3 text-gray-500">{i + 1}</td>
                        <td className="py-2.5 px-3" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-xs font-data">SN{sub.netuid}</span>
                            <span className="font-semibold">{sub.name}</span>
                          </div>
                          {sub.top_signal && (
                            <span className="text-xs text-gray-600 block mt-0.5">
                              {sub.top_signal}
                            </span>
                          )}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold text-lg ${scoreColor(sub.composite_score)}`}
                          style={{ background: "rgba(16, 185, 129, 0.06)", borderLeft: "2px solid rgba(16, 185, 129, 0.15)" }}>
                          {sub.composite_score}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${scoreColor(sub.flow_score)}`}>
                          {sub.flow_score}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${scoreColor(sub.dev_score)}`}>
                          {sub.dev_score}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${scoreColor(sub.eval_score || 0)}`}>
                          {sub.eval_score || 0}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${scoreColor(sub.social_score || 0)}`}>
                          {sub.social_score || 0}
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-400">
                          {sub.alpha_price != null ? `$${formatNum(sub.alpha_price, 2)}` : "\u2014"}
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-400">
                          {sub.market_cap != null ? `$${formatNum(sub.market_cap)}` : "\u2014"}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-medium ${
                          sub.price_change_1h == null ? "text-gray-600" :
                          sub.price_change_1h > 0 ? "text-green-400" :
                          sub.price_change_1h < 0 ? "text-red-400" : "text-gray-500"
                        }`}>
                          {sub.price_change_1h != null
                            ? `${sub.price_change_1h > 0 ? "+" : ""}${sub.price_change_1h.toFixed(1)}%`
                            : "\u2014"}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-medium ${
                          sub.price_change_24h == null ? "text-gray-600" :
                          sub.price_change_24h > 0 ? "text-green-400" :
                          sub.price_change_24h < 0 ? "text-red-400" : "text-gray-500"
                        }`}>
                          {sub.price_change_24h != null
                            ? `${sub.price_change_24h > 0 ? "+" : ""}${sub.price_change_24h.toFixed(1)}%`
                            : "\u2014"}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${flowColor(sub.net_flow_24h)}`}>
                          {sub.net_flow_24h != null
                            ? `${sub.net_flow_24h > 0 ? "+" : ""}${formatNum(sub.net_flow_24h)} \u03C4`
                            : "\u2014"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {sub.signal_count > 0 ? (
                            <span className="bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-xs">
                              {sub.signal_count}
                            </span>
                          ) : (
                            <span className="text-gray-600">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right panel - Subnet Detail (from in-memory data) */}
        {selectedSubnet !== null && selectedSubnetData && (
          <div className="w-96 border-l border-gray-800 overflow-auto p-4 bg-gray-900/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">
                SN{selectedSubnet} Detail
              </h3>
              <button
                onClick={() => setSelectedSubnet(null)}
                className="text-gray-500 hover:text-gray-300 text-sm"
              >
                &#x2715;
              </button>
            </div>

            {/* Subnet info from leaderboard data */}
            <div className="mb-4">
              <h4 className="font-medium text-sm">{selectedSubnetData.name}</h4>
            </div>

            {/* Metrics from leaderboard */}
            <div className="mb-4">
              <h4 className="text-xs text-gray-500 uppercase mb-2">Scores</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-800/50 rounded p-2">
                  <span className="text-gray-500 block">aGap Score</span>
                  <span className={`font-bold ${scoreColor(selectedSubnetData.composite_score)}`}>
                    {selectedSubnetData.composite_score}
                  </span>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <span className="text-gray-500 block">Dev</span>
                  <span className={scoreColor(selectedSubnetData.dev_score)}>
                    {selectedSubnetData.dev_score}
                  </span>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <span className="text-gray-500 block">Flow</span>
                  <span className={scoreColor(selectedSubnetData.flow_score)}>
                    {selectedSubnetData.flow_score}
                  </span>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <span className="text-gray-500 block">eVal</span>
                  <span className={scoreColor(selectedSubnetData.eval_score)}>
                    {selectedSubnetData.eval_score}
                  </span>
                  {selectedSubnetData.eval_ratio ? (
                    <span className="text-xs text-gray-500 block">{selectedSubnetData.eval_ratio}x</span>
                  ) : null}
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <span className="text-gray-500 block">Social</span>
                  <span className={scoreColor(selectedSubnetData.social_score)}>
                    {selectedSubnetData.social_score}
                  </span>
                </div>
              </div>
            </div>

            {/* Market data */}
            <div className="mb-4">
              <h4 className="text-xs text-gray-500 uppercase mb-2">Market Data</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-800/50 rounded p-2">
                  <span className="text-gray-500 block">Price</span>
                  <span className="text-white">
                    {selectedSubnetData.alpha_price != null
                      ? `$${formatNum(selectedSubnetData.alpha_price, 4)}`
                      : "\u2014"}
                  </span>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <span className="text-gray-500 block">MCap</span>
                  <span className="text-white">
                    {selectedSubnetData.market_cap != null
                      ? `$${formatNum(selectedSubnetData.market_cap)}`
                      : "\u2014"}
                  </span>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <span className="text-gray-500 block">24h Change</span>
                  <span className={
                    selectedSubnetData.price_change_24h == null ? "text-gray-500" :
                    selectedSubnetData.price_change_24h > 0 ? "text-green-400" :
                    selectedSubnetData.price_change_24h < 0 ? "text-red-400" : "text-gray-500"
                  }>
                    {selectedSubnetData.price_change_24h != null
                      ? `${selectedSubnetData.price_change_24h > 0 ? "+" : ""}${selectedSubnetData.price_change_24h.toFixed(1)}%`
                      : "\u2014"}
                  </span>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <span className="text-gray-500 block">24h Net Flow</span>
                  <span className={flowColor(selectedSubnetData.net_flow_24h)}>
                    {selectedSubnetData.net_flow_24h != null
                      ? `${selectedSubnetData.net_flow_24h > 0 ? "+" : ""}${formatNum(selectedSubnetData.net_flow_24h)} \u03C4`
                      : "\u2014"}
                  </span>
                </div>
              </div>
            </div>

            {/* Signals for this subnet */}
            {selectedSubnetSignals.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs text-gray-500 uppercase mb-2">
                  Signals ({selectedSubnetSignals.length})
                </h4>
                <div className="space-y-1.5">
                  {selectedSubnetSignals.slice(0, 10).map((sig) => (
                    <div key={sig.id} className="text-xs bg-gray-800/30 rounded p-2">
                      <div className="flex items-center gap-1.5">
                        <span className={signalColor(sig.signal_type)}>
                          {signalIcon(sig.signal_type)}
                        </span>
                        <span className="text-gray-400 truncate flex-1">{sig.title}</span>
                        <span className={`font-bold ${
                          sig.strength >= 80 ? "text-green-400" :
                          sig.strength >= 50 ? "text-yellow-400" : "text-gray-500"
                        }`}>
                          {sig.strength}
                        </span>
                      </div>
                      {sig.description && (
                        <p className="text-gray-600 mt-1">{sig.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-3 flex items-center justify-between text-xs text-gray-600">
        <span>AlphaGap v0.2 -- Bittensor Subnet Intelligence (Serverless)</span>
        <div className="flex items-center gap-4">
          <span>Sources: TaoStats + GitHub + HuggingFace + Desearch</span>
          <span>{leaderboard.length} subnets tracked</span>
        </div>
      </footer>
    </div>
  );
}
