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

// ── Portfolio types ───────────────────────────────────────────────
interface PortfolioPosition {
  netuid: number;
  name: string;
  buyDate: string;
  buyAGapScore: number;
  buyPriceUsd: number;
  amountUsd: number;
  alphaTokens: number;
  // enriched by API
  currentPrice: number;
  currentValue: number;
  totalPnlUsd: number;
  totalPnlPct: number;
  change24h: number;
  pnl24hUsd: number;
}

interface PortfolioData {
  positions: PortfolioPosition[];
  history: { date: string; totalValue: number }[];
  summary: {
    totalValue: number;
    totalCost: number;
    totalPnlUsd: number;
    totalPnlPct: number;
    positionCount: number;
    taoPrice: number;
  };
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
  emission_trend?: "up" | "down" | null;
  emission_change_pct?: number;
  eval_ratio?: number;
  price_change_24h?: number;
  price_change_1h?: number;
  price_change_7d?: number;
  price_change_30d?: number;
  has_campaign?: boolean;
  whale_ratio?: number;
  whale_signal?: "accumulating" | "distributing" | null;
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

// ── Portfolio chart — pure SVG, no dependencies ───────────────────
function PortfolioChart({ history }: { history: { date: string; totalValue: number }[] }) {
  const W = 800, H = 160;
  const PAD = { top: 12, right: 16, bottom: 28, left: 52 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const values = history.map(h => h.totalValue);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const padRange = range * 0.12;
  const yMin = minVal - padRange;
  const yMax = maxVal + padRange;

  const xScale = (i: number) => PAD.left + (i / Math.max(history.length - 1, 1)) * chartW;
  const yScale = (v: number) => PAD.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  const pts = history.map((h, i) => `${xScale(i).toFixed(1)},${yScale(h.totalValue).toFixed(1)}`);
  const polyPoints = pts.join(" ");

  const firstX = xScale(0);
  const lastX = xScale(history.length - 1);
  const baseY = PAD.top + chartH;
  const areaPoints = `${firstX.toFixed(1)},${baseY} ${polyPoints} ${lastX.toFixed(1)},${baseY}`;

  const isUp = values[values.length - 1] >= values[0];
  const lineColor = isUp ? "#4ade80" : "#f87171";
  const gradId = isUp ? "areaGreen" : "areaRed";
  const gradStop = isUp ? "#4ade80" : "#f87171";

  // Y axis labels — 3 ticks
  const yTicks = [yMin + (yMax - yMin) * 0.1, yMin + (yMax - yMin) * 0.5, yMin + (yMax - yMin) * 0.9];

  // X axis labels — first, middle, last
  const xLabels = [0, Math.floor((history.length - 1) / 2), history.length - 1]
    .filter((i, idx, arr) => arr.indexOf(i) === idx)
    .map(i => ({
      x: xScale(i),
      label: new Date(history[i].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));

  // Hover dots — just show the last value dot
  const lastPt = { x: xScale(history.length - 1), y: yScale(values[values.length - 1]) };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "160px" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={gradStop} stopOpacity="0.18" />
          <stop offset="100%" stopColor={gradStop} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line
            x1={PAD.left} y1={yScale(v).toFixed(1)}
            x2={PAD.left + chartW} y2={yScale(v).toFixed(1)}
            stroke="#1f2937" strokeWidth="1"
          />
          <text
            x={PAD.left - 6} y={(yScale(v) + 4).toFixed(1)}
            fill="#6b7280" fontSize="10" textAnchor="end"
          >
            ${v.toFixed(0)}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <polygon points={areaPoints} fill={`url(#${gradId})`} />

      {/* Line */}
      <polyline points={polyPoints} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* X axis labels */}
      {xLabels.map((l, i) => (
        <text key={i} x={l.x.toFixed(1)} y={H - 6} fill="#6b7280" fontSize="10" textAnchor="middle">{l.label}</text>
      ))}

      {/* Last point dot */}
      <circle cx={lastPt.x.toFixed(1)} cy={lastPt.y.toFixed(1)} r="4" fill={lineColor} />
      <text
        x={(lastPt.x + 8).toFixed(1)} y={(lastPt.y + 4).toFixed(1)}
        fill={lineColor} fontSize="11" fontWeight="bold"
      >
        ${values[values.length - 1].toFixed(2)}
      </text>
    </svg>
  );
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
  const [activeTab, setActiveTab] = useState<"signals" | "leaderboard" | "reports" | "performance">("leaderboard");
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [reports, setReports] = useState<Array<{ date: string }>>([]);
  const [currentReport, setCurrentReport] = useState<{ date: string; subnet_name: string; netuid: number; composite_score: number; content: string; generated_at: string } | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [selectedSubnet, setSelectedSubnet] = useState<number | null>(null);
  const [sortCol, setSortCol] = useState<keyof SubnetScore>("composite_score");
  const [sortAsc, setSortAsc] = useState(false);
  const [infoPopup, setInfoPopup] = useState<string | null>(null);
  const [signalSort, setSignalSort] = useState<"score" | "date">("score");
  const [searchQuery, setSearchQuery] = useState("");
  const [reportSearch, setReportSearch] = useState("");

  const hasAutoScanned = useRef(false);

  // Load portfolio when switching to the Performance tab
  useEffect(() => {
    if (activeTab !== "performance") return;
    setPortfolioLoading(true);
    fetch("/api/portfolio")
      .then(r => r.json())
      .then(data => { setPortfolioData(data); })
      .catch(() => {})
      .finally(() => setPortfolioLoading(false));
  }, [activeTab]);

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

    // Analyze up to 10 at a time (Haiku is fast, ~1-2s per call)
    const batch = unanalyzed.slice(0, 10);
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

  // Load reports list when reports tab is selected
  useEffect(() => {
    if (activeTab !== "reports") return;
    fetch("/api/reports")
      .then(r => r.json())
      .then(d => {
        setReports(d.reports || []);
        // Auto-load the latest report
        if (d.reports?.length > 0 && !currentReport) {
          loadReport(d.reports[0].date);
        }
      })
      .catch(() => {});
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadReport = async (date: string) => {
    setLoadingReport(true);
    try {
      const res = await fetch(`/api/reports?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentReport(data);
      }
    } catch { /* ignore */ }
    setLoadingReport(false);
  };

  const generateReport = async (netuid?: number) => {
    setLoadingReport(true);
    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(netuid ? { netuid } : {}),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentReport(data);
        // Refresh reports list
        fetch("/api/reports").then(r => r.json()).then(d => setReports(d.reports || [])).catch(() => {});
      }
    } catch { /* ignore */ }
    setLoadingReport(false);
  };

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
      <header className="border-b border-gray-800 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between flex-wrap gap-2 max-w-full overflow-hidden">
        <div className="flex items-center gap-4">
          <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-12 w-auto" />
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
        {(["leaderboard", "signals", "reports", "performance"] as const).map((tab) => (
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
            {tab === "reports" && "Reports"}
            {tab === "performance" && "Performance"}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 flex overflow-x-hidden">
        {/* Left panel */}
        <div className="flex-1 overflow-auto p-4 md:p-6 max-w-full">
          {/* Refreshing banner — shows over existing data when a background scan is running */}
          {scanning && (leaderboard.length > 0 || signals.length > 0) && (
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-900/60 border border-gray-700/40 rounded-lg px-3 py-2 mb-4">
              <span className="animate-spin text-green-400">&#x21BB;</span>
              <span>Refreshing data in background&hellip;</span>
            </div>
          )}

          {/* First-load spinner — only when no data at all yet */}
          {scanning && signals.length === 0 && leaderboard.length === 0 && (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <div className="text-4xl mb-4 animate-spin">&#x21BB;</div>
              <h2 className="text-xl font-bold mb-2">Loading Data&hellip;</h2>
              <p className="text-gray-500 max-w-md mb-4">
                Pulling prices, dev activity, and signals from all sources.
              </p>
              <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-400 rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </div>
          )}

          {/* Empty state — only after a completed scan with no results */}
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
                      <span className="text-sm font-bold text-white">
                        {sig.signal_date
                          ? new Date(sig.signal_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
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

                    {/* Market cap + aGap score mini-stats */}
                    {(() => {
                      const lb = leaderboard.find(s => s.netuid === sig.netuid);
                      const mcap = lb?.market_cap;
                      const agap = lb?.composite_score;
                      if (!lb) return null;
                      const mcapStr = mcap
                        ? mcap >= 1_000_000_000 ? `$${(mcap / 1_000_000_000).toFixed(2)}B`
                          : mcap >= 1_000_000 ? `$${(mcap / 1_000_000).toFixed(1)}M`
                          : `$${(mcap / 1000).toFixed(0)}K`
                        : null;
                      return (
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
                      );
                    })()}

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
              <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                <table className="w-full text-sm font-data min-w-[900px]">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left py-2 px-3">#</th>
                      <th className="text-left py-2 px-3">Subnet</th>
                      {([
                        ["composite_score", "aGap", "Alpha Gap Score (0-100). The core metric. Finds subnets building quality work where the price hasn't caught up yet. Formula: Dev quality (50pts) + Price lag across 24h/7d/30d (30pts) + Social gap (15pts) + Emission value gap (15pts) - Market cap penalty. A reversal bonus is added when a subnet is down long-term but starting to turn up short-term."],
                        ["flow_score", "Flow", "Flow & Momentum (0-100). Combines: (1) Price momentum across 24h, 7d, and 30d timeframes, (2) Whale activity — compares avg buy size vs avg sell size to detect whale accumulation 🐋 or distribution, (3) Reversal bonus when price is down long-term but turning up short-term. A 🐋 icon appears when whales are detected buying big."],
                        ["dev_score", "Dev", "Development Score (0-100). Measures actual GitHub + HuggingFace activity quality. Based on: daily commits, PRs merged, unique contributors, 7d/30d trends, and AI models/datasets published. Multiple subnets can share the same score — this is absolute quality, not a ranking."],
                        ["eval_score", "eVal", "Emissions-to-Valuation (0-100). Finds the gap between what the network pays a subnet (emissions) vs what the market values it (market cap). Factors: (1) Emission level — how much TAO the network allocates, (2) Valuation gap — emission share ÷ market cap share ratio, (3) Price trend divergence — price dropping while emissions stay high = widening gap, (4) Network participation — validator count + new miner registrations burning TAO to join. High eVal = validators and miners are betting on this subnet before the market catches on. Tiny mcap subnets are penalized for inflated ratios."],
                        ["social_score", "Social", "Social Velocity (0-100). Multi-source social intelligence: (1) X/Twitter — KOL-weighted mentions and engagement via Desearch. Top KOLs like const_reborn count up to 3× more. Velocity bonuses when buzz is accelerating. (2) Discord — daily scan of all Bittensor subnet channels. Alpha-grade discussion (dev previews, partnership hints, launch dates) adds up to +20pts. Active community engagement adds up to +12pts. (3) Stitch3 campaigns — active marketing adds +15pts. Low social + high dev = nobody knows yet = alpha gap."],
                        ["emission_pct", "Em %", "Emission share — the percentage of total Bittensor network emissions allocated to this subnet. Higher % means validators trust this subnet more. A rising emission % with flat price is a value gap signal."],
                        ["emission_change_pct", "Em Δ", "Daily change in emission %. Green = emissions increased since yesterday. Red = decreased. A subnet gaining emissions means the network is allocating more trust to it."],
                        ["alpha_price", "Price", "Current alpha token price in USD."],
                        ["market_cap", "MCap", "Total market capitalization in USD."],
                        ["price_change_1h", "1h %", "Price change in the last 1 hour."],
                        ["price_change_24h", "24h %", "Price change in the last 24 hours."],
                        ["price_change_7d", "7d %", "Price change over the last 7 days."],
                        ["price_change_30d", "30d %", "Price change over the last 30 days. Compare with dev activity — if dev is high but 30d price is down, that's a significant alpha gap."],
                        ["net_flow_24h", "24h Net", "Net USD flow in the last 24 hours (TAO converted at current price). Positive = more buying than selling. Negative = more selling than buying."],
                        ["signal_count", "Signals", "Number of intelligence signals detected for this subnet from GitHub commits, HuggingFace updates, and social media activity. Click to view details in the Signals tab."],
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
                              className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-600 text-[9px] text-gray-500 hover:text-green-400 hover:border-green-400 cursor-help relative"
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setInfoPopup(infoPopup === key ? null : key); }}
                            >
                              i
                              {infoPopup === key && (
                                <div className="absolute z-50 top-5 right-0 w-72 p-3 bg-gray-900 border border-green-800/50 rounded-lg shadow-xl text-xs text-gray-300 font-normal whitespace-normal leading-relaxed" onClick={(e) => e.stopPropagation()}>
                                  <div className="font-semibold text-green-400 mb-1">{label}</div>
                                  {tooltip}
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
                        className={`border-b cursor-pointer transition-colors ${
                          sub.composite_score >= 80
                            ? "border-green-500/30 bg-green-900/30 hover:bg-green-900/45"
                            : "border-gray-800/50 hover:bg-gray-900/50"
                        }`}
                        onClick={() => getSubnetDetail(sub.netuid)}
                      >
                        <td className="py-2.5 px-3 text-gray-500">{i + 1}</td>
                        <td className="py-2.5 px-3" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-xs font-data">SN{sub.netuid}</span>
                            <span className="font-semibold">{sub.name}</span>
                            {sub.has_campaign && <span title="Active Stitch3 marketing campaign" className="ml-1">🔥</span>}
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
                          {sub.whale_signal === "accumulating" && <span title={`Whale accumulation detected (${sub.whale_ratio}x buy/sell ratio)`}>🐋</span>}
                          {sub.whale_signal === "distributing" && <span title={`Whale distribution detected (${sub.whale_ratio}x buy/sell ratio)`} className="opacity-50">🔻</span>}
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
                          {sub.emission_pct != null && sub.emission_pct > 0
                            ? `${(sub.emission_pct * 100).toFixed(1)}%`
                            : "\u2014"}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-medium ${
                          sub.emission_change_pct == null ? "text-gray-600" :
                          sub.emission_change_pct > 0 ? "text-green-400" :
                          sub.emission_change_pct < 0 ? "text-red-400" : "text-gray-500"
                        }`}>
                          {sub.emission_change_pct != null && sub.emission_change_pct !== 0
                            ? `${sub.emission_change_pct > 0 ? "+" : ""}${sub.emission_change_pct.toFixed(1)}%`
                            : "\u2014"}
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
                        <td className={`py-2.5 px-3 text-right font-medium ${
                          sub.price_change_7d == null ? "text-gray-600" :
                          sub.price_change_7d > 0 ? "text-green-400" :
                          sub.price_change_7d < 0 ? "text-red-400" : "text-gray-500"
                        }`}>
                          {sub.price_change_7d != null
                            ? `${sub.price_change_7d > 0 ? "+" : ""}${sub.price_change_7d.toFixed(1)}%`
                            : "\u2014"}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-medium ${
                          sub.price_change_30d == null ? "text-gray-600" :
                          sub.price_change_30d > 0 ? "text-green-400" :
                          sub.price_change_30d < 0 ? "text-red-400" : "text-gray-500"
                        }`}>
                          {sub.price_change_30d != null
                            ? `${sub.price_change_30d > 0 ? "+" : ""}${sub.price_change_30d.toFixed(1)}%`
                            : "\u2014"}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${flowColor(sub.net_flow_24h)}`}>
                          {sub.net_flow_24h != null && taoPrice != null
                            ? `${sub.net_flow_24h > 0 ? "+" : ""}$${formatNum(Math.round(sub.net_flow_24h * taoPrice))}`
                            : sub.net_flow_24h != null
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

          {/* Reports */}
        {activeTab === "reports" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <h2 className="text-lg font-bold">Daily Deep Dive Reports</h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search reports..."
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-sm rounded px-3 py-1 text-gray-300 placeholder-gray-600 w-full sm:w-44 focus:outline-none focus:border-gray-500"
                />
                <span className="text-xs text-gray-600 hidden sm:inline">Auto-generated daily at 6am PT</span>
              </div>
            </div>

            {/* No reports at all */}
            {!loadingReport && reports.length === 0 && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 text-center">
                <div className="text-4xl mb-3">📊</div>
                <h3 className="text-lg font-bold mb-2">No Reports Yet</h3>
                <p className="text-gray-500 text-sm mb-4">Reports are auto-generated daily at 6am PT on the top aGap subnet.</p>
              </div>
            )}

            {/* All reports as cards, newest first */}
            <div className="space-y-3">
              {reports
                .filter(r => {
                  if (!reportSearch.trim()) return true;
                  const q = reportSearch.toLowerCase();
                  const dateStr = new Date(r.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toLowerCase();
                  const subnetName = (r as { date: string; subnet_name?: string }).subnet_name?.toLowerCase() || "";
                  return dateStr.includes(q) || subnetName.includes(q) || r.date.includes(q);
                })
                .map((r) => {
                  const isExpanded = currentReport?.date === r.date;
                  const dateLabel = new Date(r.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                  const meta = r as { date: string; subnet_name?: string; netuid?: number; composite_score?: number };
                  return (
                    <div key={r.date} className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                      {/* Card header — always visible, click to expand */}
                      <button
                        className="w-full flex items-start sm:items-center justify-between px-4 sm:px-5 py-3 hover:bg-gray-800/40 transition-colors text-left gap-2"
                        onClick={() => isExpanded ? setCurrentReport(null) : loadReport(r.date)}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                          <span className="text-xs text-green-400 font-medium uppercase tracking-wide shrink-0">Deep Dive</span>
                          <span className="text-sm font-semibold text-white truncate">
                            {meta.subnet_name ? `${meta.subnet_name} (SN${meta.netuid})` : dateLabel}
                          </span>
                          {meta.subnet_name && <span className="text-xs text-gray-500 shrink-0">{dateLabel}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {meta.composite_score != null && (
                            <span className="text-green-400 font-bold text-sm">{meta.composite_score} aGap</span>
                          )}
                          {loadingReport && isExpanded
                            ? <span className="text-xs text-gray-500 animate-pulse">Loading...</span>
                            : <span className="text-gray-600 text-xs">{isExpanded ? "▲" : "▼"}</span>
                          }
                        </div>
                      </button>

                      {/* Expanded report content */}
                      {isExpanded && currentReport && (
                        <div className="border-t border-gray-800">
                          <div className="px-6 py-5 prose prose-invert prose-sm max-w-none
                            prose-headings:text-green-400 prose-headings:font-bold prose-headings:mt-6 prose-headings:mb-3
                            prose-h1:text-xl prose-h1:border-b prose-h1:border-gray-800 prose-h1:pb-2
                            prose-h2:text-lg prose-p:text-gray-300 prose-p:leading-relaxed
                            prose-strong:text-white prose-li:text-gray-300 prose-hr:border-gray-800">
                            {currentReport.content.split("\n").map((line, i) => {
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
                            })}
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
          </div>
        )}

        {/* Performance tab */}
        {activeTab === "performance" && (
          <div className="space-y-6">
            {portfolioLoading && (
              <div className="flex items-center justify-center py-20 text-gray-500">
                <span className="animate-pulse text-2xl mr-3">◎</span>
                <span>Loading portfolio...</span>
              </div>
            )}

            {!portfolioLoading && portfolioData && portfolioData.positions.length === 0 && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-10 text-center">
                <div className="text-5xl mb-4">📈</div>
                <h3 className="text-lg font-bold mb-2">Portfolio Starts Building Soon</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto">
                  Every time a subnet&apos;s aGap score crosses <span className="text-green-400 font-semibold">80</span>, we auto-buy $100 of its alpha token.
                  Trigger a scan to seed your first positions.
                </p>
              </div>
            )}

            {!portfolioLoading && portfolioData && portfolioData.positions.length > 0 && (
              <>
                {/* Summary strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-1">Portfolio Value</div>
                    <div className="text-2xl font-bold text-white">
                      ${portfolioData.summary.totalValue.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-1">Total Return</div>
                    <div className={`text-2xl font-bold ${portfolioData.summary.totalPnlUsd >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {portfolioData.summary.totalPnlUsd >= 0 ? "+" : ""}${portfolioData.summary.totalPnlUsd.toFixed(2)}
                    </div>
                    <div className={`text-xs mt-0.5 ${portfolioData.summary.totalPnlPct >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {portfolioData.summary.totalPnlPct >= 0 ? "+" : ""}{portfolioData.summary.totalPnlPct.toFixed(1)}% all-time
                    </div>
                  </div>
                  <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-1">Cash Deployed</div>
                    <div className="text-2xl font-bold text-white">${portfolioData.summary.totalCost.toFixed(0)}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{portfolioData.summary.positionCount} positions × $100</div>
                  </div>
                  <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-1">Buy Signal</div>
                    <div className="text-2xl font-bold text-green-400">aGap ≥ 80</div>
                    <div className="text-xs text-gray-600 mt-0.5">auto-tracked</div>
                  </div>
                </div>

                {/* Portfolio value chart */}
                {portfolioData.history.length >= 2 && (
                  <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-5">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">Portfolio Value Over Time</div>
                    <PortfolioChart history={portfolioData.history} />
                  </div>
                )}

                {portfolioData.history.length < 2 && (
                  <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-5">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Portfolio Value Chart</div>
                    <div className="text-center py-6 text-gray-600 text-sm">
                      Chart builds as data accumulates — check back tomorrow 📊
                    </div>
                  </div>
                )}

                {/* Holdings table */}
                <div className="bg-gray-900/70 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Holdings</h3>
                    <span className="text-xs text-gray-600">$100 auto-buy when aGap ≥ 80</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 uppercase border-b border-gray-800/60">
                          <th className="text-left px-5 py-3">Subnet</th>
                          <th className="text-right px-3 py-3">aGap</th>
                          <th className="text-right px-3 py-3">Bought</th>
                          <th className="text-right px-3 py-3">Buy Price</th>
                          <th className="text-right px-3 py-3">Current</th>
                          <th className="text-right px-3 py-3">Tokens</th>
                          <th className="text-right px-3 py-3">Value</th>
                          <th className="text-right px-3 py-3">24h P&L</th>
                          <th className="text-right px-5 py-3">Total P&L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/40">
                        {portfolioData.positions.map(pos => (
                          <tr key={pos.netuid} className="hover:bg-gray-800/30 transition-colors">
                            <td className="px-5 py-3">
                              <div className="font-medium text-white">{pos.name}</div>
                              <div className="text-xs text-gray-500">SN{pos.netuid}</div>
                            </td>
                            <td className="text-right px-3 py-3">
                              <span className="text-green-400 font-semibold">{pos.buyAGapScore}</span>
                            </td>
                            <td className="text-right px-3 py-3 text-gray-400 text-xs whitespace-nowrap">
                              {new Date(pos.buyDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </td>
                            <td className="text-right px-3 py-3 text-gray-300 font-mono text-xs">
                              ${pos.buyPriceUsd < 0.01 ? pos.buyPriceUsd.toFixed(5) : pos.buyPriceUsd.toFixed(4)}
                            </td>
                            <td className="text-right px-3 py-3 font-mono text-xs">
                              <span className={pos.currentPrice >= pos.buyPriceUsd ? "text-green-400" : "text-red-400"}>
                                ${pos.currentPrice < 0.01 ? pos.currentPrice.toFixed(5) : pos.currentPrice.toFixed(4)}
                              </span>
                            </td>
                            <td className="text-right px-3 py-3 text-gray-400 font-mono text-xs">
                              {pos.alphaTokens >= 1000
                                ? `${(pos.alphaTokens / 1000).toFixed(1)}K`
                                : pos.alphaTokens.toFixed(1)}
                            </td>
                            <td className="text-right px-3 py-3 font-semibold">
                              ${pos.currentValue.toFixed(2)}
                            </td>
                            <td className="text-right px-3 py-3">
                              <span className={pos.pnl24hUsd >= 0 ? "text-green-400" : "text-red-400"}>
                                {pos.change24h >= 0 ? "+" : ""}{pos.change24h.toFixed(1)}%
                              </span>
                            </td>
                            <td className="text-right px-5 py-3">
                              <div className={`font-semibold ${pos.totalPnlUsd >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {pos.totalPnlUsd >= 0 ? "+" : ""}${pos.totalPnlUsd.toFixed(2)}
                              </div>
                              <div className={`text-xs ${pos.totalPnlPct >= 0 ? "text-green-500" : "text-red-500"}`}>
                                {pos.totalPnlPct >= 0 ? "+" : ""}{pos.totalPnlPct.toFixed(1)}%
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-gray-700">
                        <tr className="text-sm font-semibold">
                          <td className="px-5 py-3 text-gray-400" colSpan={6}>Total</td>
                          <td className="text-right px-3 py-3">${portfolioData.summary.totalValue.toFixed(2)}</td>
                          <td className="text-right px-3 py-3 text-gray-500">—</td>
                          <td className={`text-right px-5 py-3 ${portfolioData.summary.totalPnlUsd >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {portfolioData.summary.totalPnlUsd >= 0 ? "+" : ""}${portfolioData.summary.totalPnlUsd.toFixed(2)}
                            <div className="text-xs font-normal">
                              ({portfolioData.summary.totalPnlPct >= 0 ? "+" : ""}{portfolioData.summary.totalPnlPct.toFixed(1)}%)
                            </div>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Methodology note */}
                <div className="text-xs text-gray-600 text-center pb-2">
                  Simulated portfolio — $100 auto-invested per subnet at the moment its aGap score crosses 80.
                  Tracks real alpha token prices. Not financial advice.
                </div>
              </>
            )}
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
                    {selectedSubnetData.net_flow_24h != null && taoPrice != null
                      ? `${selectedSubnetData.net_flow_24h > 0 ? "+" : ""}$${formatNum(Math.round(selectedSubnetData.net_flow_24h * taoPrice))}`
                      : selectedSubnetData.net_flow_24h != null
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
