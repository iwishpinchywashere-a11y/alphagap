"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import SubnetLogo from "@/components/dashboard/SubnetLogo";

// ── Types ─────────────────────────────────────────────────────────
interface AlphaPosition {
  netuid:     number;
  name:       string;
  staked_tao: number;
  staked_usd: number;
}

interface WalletEntry {
  address:        string;
  label?:         string;
  emoji?:         string;
  category?:      string;
  is_known:       boolean;
  total_tao:      number;
  free_tao:       number;
  staked_tao:     number;
  change_24h_tao: number;
  change_24h_pct: number;
  rank:           number;
}

interface ApiResponse {
  holders:   WalletEntry[];
  winners:   WalletEntry[];
  losers:    WalletEntry[];
  updatedAt: string;
}

type TabKey = "top" | "winners" | "known" | "tracked";

// ── Helpers ───────────────────────────────────────────────────────
function shortAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-5)}`;
}
function fmtTao(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M τ`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K τ`;
  return `${n.toFixed(1)} τ`;
}
function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtChange(n: number) {
  const s = n >= 0 ? "+" : "";
  if (Math.abs(n) >= 1_000_000) return `${s}${(n / 1_000_000).toFixed(2)}M τ`;
  if (Math.abs(n) >= 1_000)     return `${s}${(n / 1_000).toFixed(1)}K τ`;
  return `${s}${n.toFixed(1)} τ`;
}
function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Position drawer ───────────────────────────────────────────────
function PositionDrawer({ address }: { address: string }) {
  const [positions, setPositions] = useState<AlphaPosition[] | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/wallet-tracker?mode=detail&address=${encodeURIComponent(address)}`)
      .then(r => r.json())
      .then((d: { positions?: AlphaPosition[]; error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setPositions(d.positions ?? []);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 px-4 bg-gray-950/60 border-b border-gray-800/50">
        <div className="w-3.5 h-3.5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin flex-shrink-0" />
        <span className="text-xs text-gray-500">Loading positions…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-3 px-4 bg-gray-950/60 border-b border-gray-800/50">
        <p className="text-xs text-red-400">{error}</p>
      </div>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <div className="py-3 px-4 bg-gray-950/60 border-b border-gray-800/50">
        <p className="text-xs text-gray-600">No alpha token positions found.</p>
      </div>
    );
  }

  const totalTao = positions.reduce((s, p) => s + p.staked_tao, 0);
  const totalUsd = positions.reduce((s, p) => s + p.staked_usd, 0);

  return (
    <div className="bg-gray-950/70 border-b border-gray-800/50 px-4 py-3">
      {/* Summary */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wide">
          {positions.length} alpha token{positions.length !== 1 ? "s" : ""}
        </span>
        <span className="text-[10px] text-gray-600">·</span>
        <span className="text-[10px] text-gray-400">{fmtTao(totalTao)} total staked</span>
        {totalUsd > 0 && (
          <>
            <span className="text-[10px] text-gray-600">·</span>
            <span className="text-[10px] text-gray-400">{fmtUsd(totalUsd)}</span>
          </>
        )}
      </div>

      {/* Position grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {positions.map(pos => {
          const pct = totalTao > 0 ? (pos.staked_tao / totalTao) * 100 : 0;
          return (
            <div
              key={pos.netuid}
              className="flex items-center gap-2.5 bg-gray-900/70 border border-gray-800/80 rounded-lg px-3 py-2.5 hover:border-indigo-500/30 transition-colors"
            >
              <SubnetLogo netuid={pos.netuid} name={pos.name} size={24} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] text-gray-600 font-mono flex-shrink-0">SN{pos.netuid}</span>
                    <span className="text-xs font-semibold text-white truncate">{pos.name}</span>
                  </div>
                  <span className="text-[10px] text-gray-600 flex-shrink-0">{pct.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-medium text-indigo-300 tabular-nums">{fmtTao(pos.staked_tao)}</span>
                  {pos.staked_usd > 0 && (
                    <span className="text-[10px] text-gray-500 tabular-nums">{fmtUsd(pos.staked_usd)}</span>
                  )}
                </div>
                {/* Mini bar */}
                <div className="mt-1.5 h-0.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500/60 rounded-full"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-700 mt-2.5">
        TAO-equivalent values · click row again to collapse
      </p>
    </div>
  );
}

// ── Wallet Row ────────────────────────────────────────────────────
function WalletRow({
  wallet,
  tracked,
  onToggleTrack,
  showChange,
  expanded,
  onToggleExpand,
}: {
  wallet:         WalletEntry;
  tracked:        boolean;
  onToggleTrack:  (addr: string) => void;
  showChange:     boolean;
  expanded:       boolean;
  onToggleExpand: (addr: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(wallet.address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const rankColor =
    wallet.rank <= 3  ? "text-yellow-400 font-bold" :
    wallet.rank <= 10 ? "text-amber-400 font-semibold" :
                        "text-gray-600";

  const isPos       = wallet.change_24h_tao >= 0;
  const changeColor = isPos ? "text-green-400" : "text-red-400";

  return (
    <>
      <div
        onClick={() => onToggleExpand(wallet.address)}
        className={`group flex items-center gap-3 px-4 py-3 border-b border-gray-800/40 cursor-pointer transition-colors
          ${expanded         ? "bg-gray-800/40 border-l-2 border-l-indigo-400/70" :
            tracked          ? "bg-blue-950/20 border-l-2 border-l-blue-400/60"  :
            showChange       ? "bg-gradient-to-r from-green-950/10 to-transparent hover:bg-green-950/20" :
                               "hover:bg-gray-800/30"}
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

          {/* Staked / free */}
          <div className="flex items-center gap-3 mt-0.5">
            {wallet.staked_tao > 0 && (
              <span className="text-[10px] text-gray-600">
                <span className="text-gray-500">{fmtTao(wallet.staked_tao)}</span>
                <span className="ml-1 text-gray-700">staked</span>
              </span>
            )}
            {wallet.free_tao > 0 && (
              <span className="text-[10px] text-gray-700">{fmtTao(wallet.free_tao)} free</span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {showChange && (
            <div className="text-right">
              <div className={`text-sm font-bold tabular-nums ${changeColor}`}>{fmtChange(wallet.change_24h_tao)}</div>
              <div className={`text-[10px] tabular-nums ${changeColor} opacity-70`}>
                {isPos ? "+" : ""}{wallet.change_24h_pct.toFixed(1)}%
              </div>
            </div>
          )}

          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-white tabular-nums">{fmtTao(wallet.total_tao)}</div>
            {!showChange && wallet.change_24h_tao !== 0 && (
              <div className={`text-[10px] tabular-nums ${changeColor}`}>{fmtChange(wallet.change_24h_tao)}</div>
            )}
          </div>

          {/* Chevron */}
          <div className={`w-4 flex-shrink-0 text-gray-600 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Track button */}
          <button
            onClick={e => { e.stopPropagation(); onToggleTrack(wallet.address); }}
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

      {/* Expanded position drawer */}
      {expanded && <PositionDrawer address={wallet.address} />}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function WalletTrackerPage() {
  const { data: session } = useSession();

  const [holders,   setHolders]   = useState<WalletEntry[]>([]);
  const [winners,   setWinners]   = useState<WalletEntry[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [tracked,   setTracked]   = useState<Set<string>>(new Set());
  const [tab,       setTab]       = useState<TabKey>("top");
  const [search,    setSearch]    = useState("");
  const [expanded,  setExpanded]  = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/wallet-tracker")
      .then(r => r.json())
      .then((data: ApiResponse & { error?: string }) => {
        if (data.error) { setError(data.error); return; }
        setHolders(data.holders ?? []);
        setWinners(data.winners ?? []);
        setUpdatedAt(data.updatedAt ?? "");
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    try {
      const s = localStorage.getItem("alphagap_tracked_wallets");
      if (s) setTracked(new Set(JSON.parse(s) as string[]));
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

  const allWallets = useMemo(() => {
    const map = new Map<string, WalletEntry>();
    for (const w of holders) map.set(w.address, w);
    for (const w of winners) if (!map.has(w.address)) map.set(w.address, w);
    return [...map.values()];
  }, [holders, winners]);

  const displayWallets = useMemo(() => {
    let list: WalletEntry[] =
      tab === "top"     ? [...holders] :
      tab === "winners" ? [...winners] :
      tab === "known"   ? allWallets.filter(w => w.is_known) :
      /* tracked */       (() => {
        const base = allWallets.filter(w => tracked.has(w.address));
        const found = new Set(base.map(w => w.address));
        for (const addr of tracked) {
          if (!found.has(addr)) base.push({
            address: addr, is_known: false,
            total_tao: 0, free_tao: 0, staked_tao: 0,
            change_24h_tao: 0, change_24h_pct: 0, rank: 9999,
          });
        }
        return base;
      })();

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(w =>
        w.address.toLowerCase().includes(q) || w.label?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [holders, winners, allWallets, tab, tracked, search]);

  const isWinnersTab = tab === "winners";

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
            {updatedAt && <span className="ml-2 text-gray-600">Updated {timeAgo(updatedAt)}</span>}
          </p>
        </div>
        {trackedCount > 0 && (
          <span className="text-xs text-blue-400 font-medium flex-shrink-0">{trackedCount} tracked</span>
        )}
      </div>

      {/* Stats */}
      {!loading && !error && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Wallets indexed", value: holders.length.toString() },
            { label: "Big winners",     value: winners.length.toString() },
            { label: "You tracking",    value: trackedCount.toString() },
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
        <div className="flex gap-1 bg-gray-900/60 border border-gray-800 rounded-lg p-1">
          {([
            { key: "top",     label: "🏆 Top 200" },
            { key: "winners", label: "🚀 Big Winners" },
            { key: "known",   label: "👑 Known" },
            { key: "tracked", label: `🔔 Tracked${trackedCount > 0 ? ` (${trackedCount})` : ""}` },
          ] as { key: TabKey; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                tab === t.key
                  ? t.key === "winners" ? "bg-green-500/20 text-green-300" : "bg-gray-700 text-white"
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
          placeholder="Search address…"
          className="bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600 w-40"
        />
      </div>

      {/* Hint */}
      {!loading && !error && tab === "top" && (
        <p className="text-xs text-gray-600 px-1">
          💡 Click any wallet row to see their alpha token portfolio breakdown.
        </p>
      )}
      {isWinnersTab && !loading && !error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-950/30 border border-green-500/20 rounded-lg text-xs text-green-400/80">
          <span>🚀</span>
          <span>Wallets with the biggest <strong className="text-green-300">24-hour TAO gains</strong> — click any row for their portfolio.</span>
        </div>
      )}

      {/* List */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-950/40 text-[10px] text-gray-600 uppercase tracking-wide">
          <div className="w-8 text-center">Rank</div>
          <div className="flex-1">Wallet</div>
          {isWinnersTab && <div className="hidden sm:block text-right w-28 text-green-600">24h Gain</div>}
          <div className="hidden sm:block text-right w-28">Total TAO</div>
          <div className="w-4" />
          <div className="w-8" />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 gap-2">
            <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Fetching whale data…</span>
          </div>
        )}

        {error && !loading && (
          <div className="py-8 px-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && displayWallets.length === 0 && (
          <div className="py-12 text-center text-gray-600 text-sm">
            {tab === "tracked" ? "No wallets tracked yet — click 🔔 next to any wallet." : "No wallets found."}
          </div>
        )}

        {!loading && !error && displayWallets.map(wallet => (
          <WalletRow
            key={wallet.address}
            wallet={wallet}
            tracked={tracked.has(wallet.address)}
            onToggleTrack={toggleTrack}
            showChange={isWinnersTab}
            expanded={expanded === wallet.address}
            onToggleExpand={toggleExpand}
          />
        ))}
      </div>

      {/* Footer */}
      {!loading && !error && (
        <div className="text-xs text-gray-600 space-y-1 px-1">
          <p>Data from TaoMarketCap · Top 200 sorted by total TAO balance · refreshes every 20 min.</p>
          <p>🔔 Tracking saved locally. Click any wallet to view their full alpha token portfolio.</p>
          {session?.user && <p className="text-purple-500/70">🔒 Not linked anywhere — share carefully.</p>}
        </div>
      )}
    </main>
  );
}
