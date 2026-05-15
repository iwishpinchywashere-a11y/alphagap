"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import SubnetLogo from "@/components/dashboard/SubnetLogo";

// ── Types ─────────────────────────────────────────────────────────
interface AlphaPosition {
  netuid: number;
  name: string;
  staked_tao: number;
  staked_usd: number;
}

interface WalletEntry {
  address: string;
  label?: string;
  emoji?: string;
  category?: string;
  is_known: boolean;
  total_tao: number;
  free_tao: number;
  staked_tao: number;
  change_24h_tao: number;
  change_24h_pct: number;
  rank: number;
  alpha_count?: number;
  positions?: AlphaPosition[];
}

interface ApiResponse {
  holders:   WalletEntry[];
  winners:   WalletEntry[];
  losers:    WalletEntry[];
  updatedAt: string;
}

interface DiversifiedResponse {
  wallets:   WalletEntry[];
  updatedAt: string;
}

type TabKey = "top" | "winners" | "multi" | "known" | "tracked";

// ── Helpers ───────────────────────────────────────────────────────
function shortAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-5)}`;
}

function fmtTao(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M τ`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K τ`;
  return `${n.toFixed(1)} τ`;
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtChange(n: number): string {
  const sign = n >= 0 ? "+" : "";
  if (Math.abs(n) >= 1_000_000) return `${sign}${(n / 1_000_000).toFixed(2)}M τ`;
  if (Math.abs(n) >= 1_000)     return `${sign}${(n / 1_000).toFixed(1)}K τ`;
  return `${sign}${n.toFixed(1)} τ`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Wallet Row ────────────────────────────────────────────────────
function WalletRow({
  wallet,
  tracked,
  onToggleTrack,
  showChange = false,
  showAlpha  = false,
  expanded   = false,
  onToggleExpand,
}: {
  wallet: WalletEntry;
  tracked: boolean;
  onToggleTrack: (addr: string) => void;
  showChange?: boolean;
  showAlpha?: boolean;
  expanded?: boolean;
  onToggleExpand?: (addr: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(wallet.address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const rankColor = wallet.rank <= 3
    ? "text-yellow-400 font-bold"
    : wallet.rank <= 10
    ? "text-amber-400 font-semibold"
    : "text-gray-600";

  const isPos = wallet.change_24h_tao >= 0;
  const changeColor = isPos ? "text-green-400" : "text-red-400";

  const isClickable = showAlpha && wallet.positions && wallet.positions.length > 0;

  return (
    <>
      {/* Main row */}
      <div
        onClick={() => isClickable && onToggleExpand?.(wallet.address)}
        className={`group flex items-center gap-3 px-4 py-3 border-b border-gray-800/50 transition-colors
          ${tracked ? "bg-blue-950/20 border-l-2 border-l-blue-400/60" : ""}
          ${showChange ? "bg-gradient-to-r from-green-950/10 to-transparent" : ""}
          ${expanded ? "bg-gray-800/40 border-l-2 border-l-indigo-400/60" : ""}
          ${isClickable ? "cursor-pointer hover:bg-gray-800/40" : "hover:bg-gray-800/20"}
        `}
      >
        {/* Rank */}
        <div className={`w-8 text-center text-sm tabular-nums flex-shrink-0 ${showChange ? "text-gray-600" : rankColor}`}>
          #{wallet.rank <= 9999 ? wallet.rank : "—"}
        </div>

        {/* Address + label */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {wallet.emoji && <span className="text-base leading-none">{wallet.emoji}</span>}
            {wallet.label && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                wallet.category === "founder"
                  ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
                  : "bg-purple-500/15 text-purple-400 border border-purple-500/30"
              }`}>
                {wallet.label}
              </span>
            )}
            <button
              onClick={copy}
              className="font-mono text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            >
              {shortAddr(wallet.address)}
              <span className="text-[10px] text-gray-600 group-hover:text-gray-500">
                {copied ? "✓" : "⎘"}
              </span>
            </button>
          </div>

          {/* Sub-info */}
          <div className="flex items-center gap-3 mt-1">
            {showAlpha && wallet.alpha_count != null && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                🎯 {wallet.alpha_count} alpha tokens
              </span>
            )}
            {!showAlpha && wallet.staked_tao > 0 && (
              <span className="text-[10px] text-gray-600">
                {fmtTao(wallet.staked_tao)} <span className="text-gray-700">staked</span>
              </span>
            )}
            {!showAlpha && wallet.free_tao > 0 && (
              <span className="text-[10px] text-gray-700">{fmtTao(wallet.free_tao)} free</span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* 24h change for winners tab */}
          {showChange && (
            <div className="text-right">
              <div className={`text-sm font-bold tabular-nums ${changeColor}`}>
                {fmtChange(wallet.change_24h_tao)}
              </div>
              <div className={`text-[10px] tabular-nums ${changeColor} opacity-70`}>
                {isPos ? "+" : ""}{wallet.change_24h_pct.toFixed(1)}%
              </div>
            </div>
          )}

          {/* Total TAO */}
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-white tabular-nums">{fmtTao(wallet.total_tao)}</div>
            {!showChange && wallet.change_24h_tao !== 0 && (
              <div className={`text-[10px] tabular-nums ${changeColor}`}>
                {fmtChange(wallet.change_24h_tao)}
              </div>
            )}
          </div>

          {/* Expand chevron (multi-asset only) */}
          {isClickable && (
            <div className={`w-5 flex-shrink-0 text-gray-600 transition-transform ${expanded ? "rotate-180" : ""}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}

          {/* Track button */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleTrack(wallet.address); }}
            title={tracked ? "Stop tracking" : "Track this wallet"}
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              tracked
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/40 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/40"
                : "bg-gray-800/50 text-gray-500 border border-gray-700/50 hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/40"
            }`}
          >
            {tracked ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a3 3 0 01-2.83-2h5.66A3 3 0 0110 18z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Expanded: alpha position breakdown */}
      {expanded && wallet.positions && wallet.positions.length > 0 && (
        <div className="border-b border-gray-800/50 bg-gray-950/60 px-4 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
            {wallet.positions.map((pos) => (
              <div
                key={pos.netuid}
                className="flex items-center gap-2.5 bg-gray-900/60 border border-gray-800/60 rounded-lg px-3 py-2"
              >
                <SubnetLogo netuid={pos.netuid} name={pos.name} size={22} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-600 font-mono">SN{pos.netuid}</span>
                    <span className="text-xs font-semibold text-white truncate">{pos.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-medium text-indigo-300 tabular-nums">{fmtTao(pos.staked_tao)}</span>
                    {pos.staked_usd > 0 && (
                      <span className="text-[10px] text-gray-500 tabular-nums">{fmtUsd(pos.staked_usd)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-700 mt-2">
            TAO equivalent · click row to collapse
          </p>
        </div>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function WalletTrackerPage() {
  const { data: session } = useSession();

  const [holders,   setHolders]   = useState<WalletEntry[]>([]);
  const [winners,   setWinners]   = useState<WalletEntry[]>([]);
  const [diversified, setDiversified] = useState<WalletEntry[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [divUpdatedAt, setDivUpdatedAt] = useState("");

  const [loading,     setLoading]     = useState(true);
  const [divLoading,  setDivLoading]  = useState(false);
  const [divLoaded,   setDivLoaded]   = useState(false);

  const [error,     setError]     = useState<string | null>(null);
  const [divError,  setDivError]  = useState<string | null>(null);

  const [tracked,  setTracked]  = useState<Set<string>>(new Set());
  const [tab,      setTab]      = useState<TabKey>("top");
  const [search,   setSearch]   = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Load holders / winners on mount
  useEffect(() => {
    fetch("/api/wallet-tracker")
      .then(r => r.json())
      .then((data: ApiResponse & { error?: string; debug?: string[] }) => {
        if (data.error) { setError(data.error); return; }
        setHolders(data.holders ?? []);
        setWinners(data.winners ?? []);
        setUpdatedAt(data.updatedAt ?? "");
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  // Load diversified only when that tab is first selected
  useEffect(() => {
    if (tab !== "multi" || divLoaded || divLoading) return;
    setDivLoading(true);
    fetch("/api/wallet-tracker?mode=diversified")
      .then(r => r.json())
      .then((data: DiversifiedResponse & { error?: string }) => {
        if (data.error) { setDivError(data.error); return; }
        setDiversified(data.wallets ?? []);
        setDivUpdatedAt(data.updatedAt ?? "");
        setDivLoaded(true);
      })
      .catch(e => setDivError(String(e)))
      .finally(() => setDivLoading(false));
  }, [tab, divLoaded, divLoading]);

  // Load tracked wallets from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("alphagap_tracked_wallets");
      if (stored) setTracked(new Set(JSON.parse(stored) as string[]));
    } catch { /* ignore */ }
  }, []);

  function toggleTrack(addr: string) {
    setTracked(prev => {
      const next = new Set(prev);
      if (next.has(addr)) next.delete(addr); else next.add(addr);
      try { localStorage.setItem("alphagap_tracked_wallets", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  function toggleExpand(addr: string) {
    setExpanded(prev => prev === addr ? null : addr);
  }

  const trackedCount = tracked.size;

  // All unique wallets across both sources
  const allWallets = useMemo(() => {
    const map = new Map<string, WalletEntry>();
    for (const w of holders) map.set(w.address, w);
    for (const w of winners) if (!map.has(w.address)) map.set(w.address, w);
    for (const w of diversified) if (!map.has(w.address)) map.set(w.address, w);
    return [...map.values()];
  }, [holders, winners, diversified]);

  const displayWallets = useMemo(() => {
    let list: WalletEntry[] = [];

    if (tab === "top")     list = [...holders];
    if (tab === "winners") list = [...winners];
    if (tab === "multi")   list = [...diversified];
    if (tab === "known")   list = allWallets.filter(w => w.is_known);
    if (tab === "tracked") {
      list = allWallets.filter(w => tracked.has(w.address));
      const found = new Set(list.map(w => w.address));
      for (const addr of tracked) {
        if (!found.has(addr)) {
          list.push({
            address: addr, is_known: false,
            total_tao: 0, free_tao: 0, staked_tao: 0,
            change_24h_tao: 0, change_24h_pct: 0, rank: 9999,
          });
        }
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(w =>
        w.address.toLowerCase().includes(q) ||
        w.label?.toLowerCase().includes(q) ||
        w.positions?.some(p => p.name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [holders, winners, diversified, allWallets, tab, tracked, search]);

  const isWinnersTab = tab === "winners";
  const isMultiTab   = tab === "multi";

  const activeUpdatedAt = isMultiTab ? divUpdatedAt : updatedAt;

  return (
    <main className="flex-1 overflow-auto p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-white">🐋 Whale Radar</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30 uppercase tracking-wide">
              Secret
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Top TAO wallets — track the smart money.
            {activeUpdatedAt && (
              <span className="ml-2 text-gray-600">Updated {timeAgo(activeUpdatedAt)}</span>
            )}
          </p>
        </div>
        {trackedCount > 0 && (
          <div className="flex-shrink-0 text-right">
            <span className="text-xs text-blue-400 font-medium">{trackedCount} tracked</span>
          </div>
        )}
      </div>

      {/* Stats bar */}
      {!loading && !error && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Top holders",    value: holders.length.toString() },
            { label: "Multi-asset",    value: divLoaded ? diversified.length.toString() : "200" },
            { label: "You tracking",   value: trackedCount.toString() },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-white tabular-nums">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + search */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-900/60 border border-gray-800 rounded-lg p-1 flex-wrap">
          {([
            { key: "top",     label: "🏆 Top Holders" },
            { key: "winners", label: "🚀 Big Winners" },
            { key: "multi",   label: "🎯 Multi-Asset" },
            { key: "known",   label: "👑 Known" },
            { key: "tracked", label: `🔔 Tracked${trackedCount > 0 ? ` (${trackedCount})` : ""}` },
          ] as { key: TabKey; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                tab === t.key
                  ? t.key === "winners" ? "bg-green-500/20 text-green-300"
                  : t.key === "multi"   ? "bg-indigo-500/20 text-indigo-300"
                  : "bg-gray-700 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={isMultiTab ? "Search wallet or token…" : "Search address…"}
          className="bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600 w-44"
        />
      </div>

      {/* Tab banners */}
      {isWinnersTab && !loading && !error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-950/30 border border-green-500/20 rounded-lg text-xs text-green-400/80">
          <span className="text-base">🚀</span>
          <span>Wallets with the biggest <strong className="text-green-300">24-hour TAO gains</strong> — sorted by raw TAO increase today.</span>
        </div>
      )}
      {isMultiTab && (
        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-950/30 border border-indigo-500/20 rounded-lg text-xs text-indigo-400/80">
          <span className="text-base">🎯</span>
          <span>Top 200 wallets holding <strong className="text-indigo-300">2+ distinct alpha tokens</strong> — active investors, not single-subnet stakers. Click any row to see their full portfolio.</span>
        </div>
      )}

      {/* Wallet list */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-950/40 text-[10px] text-gray-600 uppercase tracking-wide">
          <div className="w-8 text-center">Rank</div>
          <div className="flex-1">Wallet</div>
          {isWinnersTab && <div className="hidden sm:block text-right w-28 text-green-600">24h Gain</div>}
          <div className="hidden sm:block text-right w-28">Total TAO</div>
          {isMultiTab && <div className="w-5" />}
          <div className="w-8" />
        </div>

        {/* Loading states */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2">
            <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Fetching whale data…</span>
          </div>
        )}
        {isMultiTab && divLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-5 h-5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-sm text-gray-400 font-medium">Building portfolio profiles…</p>
              <p className="text-xs text-gray-600 mt-1">Fetching positions across 350 wallets — takes ~15s, cached for 45 min after</p>
            </div>
          </div>
        )}

        {/* Errors */}
        {error && !loading && (
          <div className="py-8 px-6">
            <p className="text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}
        {divError && isMultiTab && (
          <div className="py-8 px-6">
            <p className="text-red-400 text-sm font-medium">{divError}</p>
          </div>
        )}

        {/* Empty states */}
        {!loading && !(isMultiTab && divLoading) && !error && displayWallets.length === 0 && (
          <div className="py-12 text-center text-gray-600 text-sm">
            {tab === "tracked"
              ? "No wallets tracked yet — click 🔔 next to any wallet to start tracking."
              : "No wallets found."}
          </div>
        )}

        {/* Rows */}
        {!loading && !(isMultiTab && divLoading) && !error && displayWallets.map(wallet => (
          <WalletRow
            key={wallet.address}
            wallet={wallet}
            tracked={tracked.has(wallet.address)}
            onToggleTrack={toggleTrack}
            showChange={isWinnersTab}
            showAlpha={isMultiTab}
            expanded={expanded === wallet.address}
            onToggleExpand={toggleExpand}
          />
        ))}
      </div>

      {/* Footer */}
      {!loading && !error && (
        <div className="text-xs text-gray-600 space-y-1 px-1">
          <p>
            Data from TaoMarketCap · Top Holders by total TAO · Big Winners by 24h gain · Multi-Asset = ≥2 alpha tokens.
            {isMultiTab ? " Portfolio data refreshes every 45 min." : " Refreshes every 20 min."}
          </p>
          <p>🔔 Tracking is saved locally in your browser.</p>
          {session?.user && (
            <p className="text-purple-500/70">🔒 This page is not linked anywhere — share carefully.</p>
          )}
        </div>
      )}
    </main>
  );
}
