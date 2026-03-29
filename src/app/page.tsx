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
  subnet_name?: string;
}

interface SubnetScore {
  netuid: number;
  name: string;
  composite_score: number;
  flow_score: number;
  dev_score: number;
  hf_score: number;
  staking_score: number;
  revenue_score: number;
  social_score: number;
  signal_count: number;
  top_signal?: string;
  alpha_price?: number;
  market_cap?: number;
  net_flow_24h?: number;
  emission_pct?: number;
  price_change_24h?: number;
}

interface SubnetInfo {
  netuid: number;
  name: string;
  description: string;
  github_url: string;
  alpha_price?: number;
  market_cap?: number;
  net_flow_24h?: number;
  emission_pct?: number;
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
  if (n == null) return "—";
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
    case "flow_inflection": return "↗";
    case "flow_spike": return "⚡";
    case "flow_warning": return "⚠";
    case "dev_spike": return "🔨";
    case "release": return "🚀";
    case "hf_drop": return "🤗";
    case "cross_signal": return "✦";
    case "price_surge": return "📈";
    case "price_drop": return "📉";
    case "buy_pressure": return "🟢";
    case "sell_pressure": return "🔴";
    case "social_buzz": return "📣";
    default: return "•";
  }
}

function sourceIcon(source: string): string {
  switch (source) {
    case "taostats": return "τ";
    case "github": return "⌥";
    case "huggingface": return "🤗";
    default: return "•";
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
  const [subnets, setSubnets] = useState<SubnetInfo[]>([]);
  const [collecting, setCollecting] = useState(false);
  const [collectStep, setCollectStep] = useState<string | null>(null);
  const [lastCollect, setLastCollect] = useState<string | null>(null);
  const [collectResult, setCollectResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"signals" | "leaderboard">("signals");
  const [selectedSubnet, setSelectedSubnet] = useState<number | null>(null);
  const [subnetDetail, setSubnetDetail] = useState<Record<string, unknown> | null>(null);
  const [sortCol, setSortCol] = useState<keyof SubnetScore>("composite_score");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (col: keyof SubnetScore) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(false); // default descending
    }
  };

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    const av = a[sortCol] ?? -Infinity;
    const bv = b[sortCol] ?? -Infinity;
    if (av < bv) return sortAsc ? -1 : 1;
    if (av > bv) return sortAsc ? 1 : -1;
    return 0;
  });

  const fetchData = useCallback(async () => {
    try {
      const [sigRes, lbRes, subRes] = await Promise.all([
        fetch("/api/signals?limit=100"),
        fetch("/api/leaderboard"),
        fetch("/api/subnets"),
      ]);
      const sigData = await sigRes.json();
      const lbData = await lbRes.json();
      const subData = await subRes.json();
      setSignals(sigData.signals || []);
      setLeaderboard(lbData.leaderboard || []);
      setSubnets(subData.subnets || []);
    } catch {
      // silently fail on initial load before any collection
    }
  }, []);

  // Auto-scan on page load if no data
  const hasAutoScanned = useRef(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Auto-trigger scan when page loads and no data exists
  useEffect(() => {
    if (!hasAutoScanned.current && signals.length === 0 && leaderboard.length === 0 && !collecting) {
      hasAutoScanned.current = true;
      // Small delay to let initial fetch complete first
      const timer = setTimeout(() => {
        if (signals.length === 0 && leaderboard.length === 0) {
          runCollector();
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [signals.length, leaderboard.length, collecting]);

  const runCollector = async () => {
    setCollecting(true);
    setCollectResult(null);

    const steps = [
      { name: "TaoStats", url: "/api/collect/taostats" },
      { name: "GitHub", url: "/api/collect/github" },
      { name: "HuggingFace", url: "/api/collect/huggingface" },
      { name: "Social", url: "/api/collect/social" },
      { name: "Staking", url: "/api/collect/staking" },
      { name: "Revenue", url: "/api/collect/revenue" },
      { name: "AI Analysis", url: "/api/collect/analyze" },
    ];

    const startTime = Date.now();
    let completed = 0;
    let lastError: string | null = null;

    for (const step of steps) {
      setCollectStep(`⟳ ${step.name}... (${completed + 1}/${steps.length})`);
      try {
        const res = await fetch(step.url, { method: "POST" });
        const data = await res.json();
        if (!data.ok) {
          console.error(`${step.name} error:`, data.error);
        }
      } catch (e) {
        lastError = `${step.name}: ${e}`;
        console.error(`${step.name} error:`, e);
      }
      completed++;
      // Refresh data after each step so user sees progress
      if (completed === 1 || completed === 3 || completed === steps.length) {
        await fetchData();
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    setLastCollect(new Date().toLocaleTimeString());
    setCollectResult(`Done in ${elapsed}s`);
    setCollectStep(null);
    await fetchData();
    setCollecting(false);
  };

  const fetchSubnetDetail = async (netuid: number) => {
    setSelectedSubnet(netuid);
    try {
      const res = await fetch(`/api/subnets?netuid=${netuid}`);
      const data = await res.json();
      setSubnetDetail(data);
    } catch {
      setSubnetDetail(null);
    }
  };

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
        </div>
        <div className="flex items-center gap-4">
          {lastCollect && (
            <span className="text-xs text-gray-500">
              Last scan: {lastCollect}
            </span>
          )}
          {collectResult && (
            <span className="text-xs text-green-400">{collectResult}</span>
          )}
          <button
            onClick={runCollector}
            disabled={collecting}
            className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-2 rounded text-sm hover:bg-green-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {collecting
              ? (collectStep || "⟳ Scanning...")
              : "⚡ Scan All Sources"}
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="border-b border-gray-800 px-6 flex gap-1">
        {(["signals", "leaderboard"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSelectedSubnet(null); }}
            className={`px-4 py-3 text-sm capitalize transition-colors border-b-2 ${
              activeTab === tab
                ? "border-green-400 text-green-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab === "signals" && `⚡ Signals ${signals.length > 0 ? `(${signals.length})` : ""}`}
            {tab === "leaderboard" && "📊 Alpha Leaderboard"}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 flex">
        {/* Left panel */}
        <div className="flex-1 overflow-auto p-6">
          {/* Empty state */}
          {signals.length === 0 && leaderboard.length === 0 && subnets.length === 0 && (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-xl font-bold mb-2">No Data Yet</h2>
              <p className="text-gray-500 max-w-md mb-6">
                Hit the <span className="text-green-400">&quot;Scan All Sources&quot;</span> button to pull data from TaoStats, GitHub, and HuggingFace across all 128 Bittensor subnets.
              </p>
              <button
                onClick={runCollector}
                disabled={collecting}
                className="bg-green-500/20 border border-green-500/40 text-green-400 px-6 py-3 rounded-lg text-base hover:bg-green-500/30 transition-colors disabled:opacity-50"
              >
                {collecting
                  ? (collectStep || "⟳ Scanning all sources...")
                  : "⚡ Run First Scan"}
              </button>
            </div>
          )}

          {/* Signals Feed */}
          {activeTab === "signals" && signals.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Intelligence Feed</h2>
                <div className="flex items-center gap-3">
                  {signals.some(s => s.analysis_status === "analyzing") && (
                    <span className="text-xs text-yellow-400 animate-pulse">
                      🧠 AI analyzing signals...
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {signals.filter(s => s.analysis).length} analyzed / {signals.length} total
                  </span>
                </div>
              </div>
              {signals.map((sig) => (
                <div
                  key={sig.id}
                  className={`bg-gray-900/50 border rounded-lg overflow-hidden transition-colors cursor-pointer ${
                    sig.strength >= 80
                      ? "border-green-800/60 signal-hot"
                      : sig.strength >= 50
                      ? "border-yellow-900/40"
                      : "border-gray-800"
                  } hover:border-gray-600`}
                  onClick={() => fetchSubnetDetail(sig.netuid)}
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
                        {sig.created_at ? timeAgo(sig.created_at) : ""}
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

                    {/* AI Analysis — the star of the show */}
                    {sig.analysis ? (
                      <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-3 mb-2">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-xs font-medium text-green-400">🧠 AlphaGap Analysis</span>
                        </div>
                        <div className="space-y-2">
                          {sig.analysis.split("\n").filter(Boolean).map((line, i) => {
                            const isWhat = line.startsWith("🔍");
                            const isWhy = line.startsWith("💡");
                            const isAlpha = line.startsWith("🎯");
                            if (isWhat || isWhy || isAlpha) {
                              const [header, ...rest] = line.split(": ");
                              return (
                                <div key={i}>
                                  <span className={`text-xs font-bold ${
                                    isWhat ? "text-blue-400" : isWhy ? "text-yellow-400" : "text-green-400"
                                  }`}>{header}:</span>
                                  <span className="text-sm text-gray-300 ml-1">{rest.join(": ")}</span>
                                </div>
                              );
                            }
                            if (line.trim()) {
                              return <p key={i} className="text-sm text-gray-300">{line}</p>;
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    ) : sig.analysis_status === "analyzing" ? (
                      <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-3 mb-2">
                        <span className="text-xs text-yellow-400 animate-pulse">
                          🧠 Analyzing with AI...
                        </span>
                      </div>
                    ) : sig.description ? (
                      <p className="text-xs text-gray-500 mb-2">
                        {sig.description}
                      </p>
                    ) : null}

                    {/* Footer with links */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3">
                        {/* Strength bar */}
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
                          View source →
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
                <h2 className="text-lg font-bold">Alpha Leaderboard</h2>
                <span className="text-xs text-gray-500">
                  aGap = Dev execution + Price lagging = Alpha opportunity
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left py-2 px-3">#</th>
                      <th className="text-left py-2 px-3">Subnet</th>
                      {([
                        ["composite_score", "aGap"],
                        ["flow_score", "Flow"],
                        ["dev_score", "Dev"],
                        ["staking_score", "Staking"],
                        ["revenue_score", "Revenue"],
                        ["social_score", "Social"],
                        ["alpha_price", "Price"],
                        ["price_change_24h", "24h %"],
                        ["market_cap", "MCap"],
                        ["net_flow_24h", "24h Net"],
                        ["signal_count", "Signals"],
                      ] as [keyof SubnetScore, string][]).map(([key, label]) => (
                        <th
                          key={key}
                          className="text-right py-2 px-3 cursor-pointer hover:text-gray-300 transition-colors select-none"
                          onClick={() => handleSort(key)}
                        >
                          {label}
                          {sortCol === key && (
                            <span className="ml-1 text-green-400">
                              {sortAsc ? "▲" : "▼"}
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
                        onClick={() => fetchSubnetDetail(sub.netuid)}
                      >
                        <td className="py-2.5 px-3 text-gray-500">{i + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-xs">SN{sub.netuid}</span>
                            <span className="font-medium">{sub.name}</span>
                          </div>
                          {sub.top_signal && (
                            <span className="text-xs text-gray-600 block mt-0.5">
                              {sub.top_signal}
                            </span>
                          )}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${scoreColor(sub.composite_score)}`}>
                          {sub.composite_score}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${scoreColor(sub.flow_score)}`}>
                          {sub.flow_score}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${scoreColor(sub.dev_score)}`}>
                          {sub.dev_score}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${scoreColor(sub.staking_score || 0)}`}>
                          {sub.staking_score || 0}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${scoreColor(sub.revenue_score || 0)}`}>
                          {sub.revenue_score || 0}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${scoreColor(sub.social_score || 0)}`}>
                          {sub.social_score || 0}
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-400">
                          {sub.alpha_price != null ? `$${formatNum(sub.alpha_price, 2)}` : "—"}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-medium ${
                          sub.price_change_24h == null ? "text-gray-600" :
                          sub.price_change_24h > 0 ? "text-green-400" :
                          sub.price_change_24h < 0 ? "text-red-400" : "text-gray-500"
                        }`}>
                          {sub.price_change_24h != null
                            ? `${sub.price_change_24h > 0 ? "+" : ""}${sub.price_change_24h.toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-400">
                          {sub.market_cap != null ? `$${formatNum(sub.market_cap)}` : "—"}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${flowColor(sub.net_flow_24h)}`}>
                          {sub.net_flow_24h != null
                            ? `${sub.net_flow_24h > 0 ? "+" : ""}${formatNum(sub.net_flow_24h)} τ`
                            : "—"}
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

          {/* Subnets tab removed */}
        </div>

        {/* Right panel - Subnet Detail */}
        {selectedSubnet !== null && subnetDetail && (
          <div className="w-96 border-l border-gray-800 overflow-auto p-4 bg-gray-900/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">
                SN{selectedSubnet} Detail
              </h3>
              <button
                onClick={() => setSelectedSubnet(null)}
                className="text-gray-500 hover:text-gray-300 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Subnet info */}
            {(subnetDetail as { subnet?: SubnetInfo }).subnet && (
              <div className="mb-4">
                <h4 className="font-medium text-sm">
                  {((subnetDetail as { subnet: SubnetInfo }).subnet).name}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  {((subnetDetail as { subnet: SubnetInfo }).subnet).description}
                </p>
              </div>
            )}

            {/* Recent metrics */}
            {Array.isArray((subnetDetail as { metrics?: unknown[] }).metrics) &&
              ((subnetDetail as { metrics: unknown[] }).metrics).length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs text-gray-500 uppercase mb-2">Latest Metrics</h4>
                {(() => {
                  const m = ((subnetDetail as { metrics: Record<string, number>[] }).metrics)[0];
                  return (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-800/50 rounded p-2">
                        <span className="text-gray-500 block">Price</span>
                        <span className="text-white">${formatNum(m.alpha_price, 4)}</span>
                      </div>
                      <div className="bg-gray-800/50 rounded p-2">
                        <span className="text-gray-500 block">MCap</span>
                        <span className="text-white">${formatNum(m.market_cap)}</span>
                      </div>
                      <div className="bg-gray-800/50 rounded p-2">
                        <span className="text-gray-500 block">24h Flow</span>
                        <span className={flowColor(m.net_flow_24h)}>
                          {m.net_flow_24h > 0 ? "+" : ""}{formatNum(m.net_flow_24h)} τ
                        </span>
                      </div>
                      <div className="bg-gray-800/50 rounded p-2">
                        <span className="text-gray-500 block">7d Flow</span>
                        <span className={flowColor(m.net_flow_7d)}>
                          {m.net_flow_7d > 0 ? "+" : ""}{formatNum(m.net_flow_7d)} τ
                        </span>
                      </div>
                      <div className="bg-gray-800/50 rounded p-2">
                        <span className="text-gray-500 block">Emission</span>
                        <span className="text-white">
                          {m.emission_pct != null ? `${(m.emission_pct * 100).toFixed(2)}%` : "—"}
                        </span>
                      </div>
                      <div className="bg-gray-800/50 rounded p-2">
                        <span className="text-gray-500 block">Pool τ</span>
                        <span className="text-white">{formatNum(m.tao_reserve)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* GitHub Events */}
            {Array.isArray((subnetDetail as { githubEvents?: unknown[] }).githubEvents) &&
              ((subnetDetail as { githubEvents: unknown[] }).githubEvents).length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs text-gray-500 uppercase mb-2">
                  GitHub Activity ({((subnetDetail as { githubEvents: unknown[] }).githubEvents).length})
                </h4>
                <div className="space-y-1.5">
                  {((subnetDetail as { githubEvents: Array<{
                    id: number; event_type: string; title: string; author: string;
                    created_at: string; url: string;
                  }> }).githubEvents).slice(0, 10).map((ev) => (
                    <div key={ev.id} className="text-xs bg-gray-800/30 rounded p-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-blue-400">{ev.event_type}</span>
                        <span className="text-gray-600">by {ev.author}</span>
                        <span className="text-gray-600 ml-auto">{timeAgo(ev.created_at)}</span>
                      </div>
                      <div className="text-gray-400 mt-0.5 truncate">{ev.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HuggingFace Items */}
            {Array.isArray((subnetDetail as { hfItems?: unknown[] }).hfItems) &&
              ((subnetDetail as { hfItems: unknown[] }).hfItems).length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs text-gray-500 uppercase mb-2">
                  HuggingFace ({((subnetDetail as { hfItems: unknown[] }).hfItems).length})
                </h4>
                <div className="space-y-1.5">
                  {((subnetDetail as { hfItems: Array<{
                    id: number; item_type: string; name: string; downloads: number;
                    likes: number; url: string;
                  }> }).hfItems).slice(0, 10).map((item) => (
                    <div key={item.id} className="text-xs bg-gray-800/30 rounded p-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-yellow-400">{item.item_type}</span>
                        <span className="text-gray-400 truncate flex-1">{item.name}</span>
                      </div>
                      <div className="flex gap-3 mt-0.5 text-gray-600">
                        <span>↓ {item.downloads}</span>
                        <span>♥ {item.likes}</span>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline ml-auto"
                          >
                            View →
                          </a>
                        )}
                      </div>
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
        <span>AlphaGap v0.1 — Bittensor Subnet Intelligence</span>
        <div className="flex items-center gap-4">
          <span>Sources: TaoStats + GitHub + HuggingFace</span>
          <span>{subnets.length} subnets tracked</span>
        </div>
      </footer>
    </div>
  );
}
