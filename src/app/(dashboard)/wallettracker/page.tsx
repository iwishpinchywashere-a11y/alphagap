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
  alpha_count:    number;
  positions:      AlphaPosition[];
}

interface WinnerEntry {
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

type TabKey = "top" | "winners" | "known" | "tracked";

// ── Helpers ───────────────────────────────────────────────────────
function shortAddr(addr: string) {
  return addr.length < 12 ? addr : `${addr.slice(0, 6)}…${addr.slice(-5)}`;
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
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

// ── Position Drawer (instant — data already in props) ─────────────
function PositionDrawer({ positions }: { positions: AlphaPosition[] }) {
  const totalTao = positions.reduce((s, p) => s + p.staked_tao, 0);
  const totalUsd = positions.reduce((s, p) => s + p.staked_usd, 0);

  return (
    <div className="bg-gray-950/70 border-b border-gray-800/50 px-4 py-3">
      {/* Summary row */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wide">
          {positions.length} alpha token{positions.length !== 1 ? "s" : ""}
        </span>
        <span className="text-[10px] text-gray-700">·</span>
        <span className="text-[10px] text-gray-400 tabular-nums">{fmtTao(totalTao)} total</span>
        {totalUsd > 0 && (
          <>
            <span className="text-[10px] text-gray-700">·</span>
            <span className="text-[10px] text-gray-400 tabular-nums">{fmtUsd(totalUsd)}</span>
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
                  <span className="text-[10px] text-gray-600 flex-shrink-0 ml-1">{pct.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-medium text-indigo-300 tabular-nums">{fmtTao(pos.staked_tao)}</span>
                  {pos.staked_usd > 0 && (
                    <span className="text-[10px] text-gray-500 tabular-nums">{fmtUsd(pos.staked_usd)}</span>
                  )}
                </div>
                {/* Allocation bar */}
                <div className="mt-1.5 h-0.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500/60 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-700 mt-2.5">TAO-equivalent · click row again to collapse</p>
    </div>
  );
}

// ── Wallet Row (multi-asset list) ─────────────────────────────────
function WalletRow({
  wallet, tracked, onToggleTrack, expanded, onToggleExpand,
}: {
  wallet: WalletEntry;
  tracked: boolean;
  onToggleTrack: (addr: string) => void;
  expanded: boolean;
  onToggleExpand: (addr: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const rankColor =
    wallet.rank <= 3  ? "text-yellow-400 font-bold" :
    wallet.rank <= 10 ? "text-amber-400 font-semibold" : "text-gray-600";
  const changeColor = wallet.change_24h_tao >= 0 ? "text-green-400" : "text-red-400";

  return (
    <>
      <div
        onClick={() => onToggleExpand(wallet.address)}
        className={`group flex items-center gap-3 px-4 py-3 border-b border-gray-800/40 cursor-pointer transition-colors
          ${expanded ? "bg-gray-800/40 border-l-2 border-l-indigo-400/70" :
            tracked  ? "bg-blue-950/20 border-l-2 border-l-blue-400/60" :
                       "hover:bg-gray-800/25"}`}
      >
        {/* Rank */}
        <div className={`w-8 text-center text-sm tabular-nums flex-shrink-0 ${rankColor}`}>
          #{wallet.rank}
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
              }`}>{wallet.label}</span>
            )}
            <button
              onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(wallet.address).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="font-mono text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            >
              {shortAddr(wallet.address)}
              <span className="text-[10px] text-gray-600 group-hover:text-gray-500">{copied ? "✓" : "⎘"}</span>
            </button>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-medium text-indigo-400">
              {wallet.alpha_count} tokens
            </span>
            {wallet.staked_tao > 0 && (
              <span className="text-[10px] text-gray-600">{fmtTao(wallet.staked_tao)} staked</span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-white tabular-nums">{fmtTao(wallet.total_tao)}</div>
            {wallet.change_24h_tao !== 0 && (
              <div className={`text-[10px] tabular-nums ${changeColor}`}>{fmtChange(wallet.change_24h_tao)}</div>
            )}
          </div>

          <div className={`w-4 flex-shrink-0 text-gray-600 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <button
            onClick={e => { e.stopPropagation(); onToggleTrack(wallet.address); }}
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

      {expanded && <PositionDrawer positions={wallet.positions} />}
    </>
  );
}

// ── Winner Row (simple — no position drawer) ──────────────────────
function WinnerRow({
  wallet, tracked, onToggleTrack,
}: {
  wallet: WinnerEntry;
  tracked: boolean;
  onToggleTrack: (addr: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const changeColor = wallet.change_24h_tao >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className={`group flex items-center gap-3 px-4 py-3 border-b border-gray-800/40 transition-colors
      ${tracked ? "bg-blue-950/20 border-l-2 border-l-blue-400/60" : "hover:bg-gray-800/25 bg-gradient-to-r from-green-950/10 to-transparent"}`}
    >
      <div className="w-8 text-center text-sm tabular-nums flex-shrink-0 text-gray-600">#{wallet.rank}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {wallet.emoji && <span className="text-base leading-none">{wallet.emoji}</span>}
          {wallet.label && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
              wallet.category === "founder"
                ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
                : "bg-purple-500/15 text-purple-400 border border-purple-500/30"
            }`}>{wallet.label}</span>
          )}
          <button
            onClick={() => { navigator.clipboard.writeText(wallet.address).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="font-mono text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
          >
            {shortAddr(wallet.address)}
            <span className="text-[10px] text-gray-600 group-hover:text-gray-500">{copied ? "✓" : "⎘"}</span>
          </button>
        </div>
        {wallet.staked_tao > 0 && (
          <span className="text-[10px] text-gray-600 mt-0.5 block">{fmtTao(wallet.staked_tao)} staked</span>
        )}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <div className={`text-sm font-bold tabular-nums ${changeColor}`}>{fmtChange(wallet.change_24h_tao)}</div>
          <div className={`text-[10px] tabular-nums ${changeColor} opacity-70`}>+{wallet.change_24h_pct.toFixed(1)}%</div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-sm font-semibold text-white tabular-nums">{fmtTao(wallet.total_tao)}</div>
        </div>
        <button
          onClick={() => onToggleTrack(wallet.address)}
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
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function WalletTrackerPage() {
  const { data: session } = useSession();

  const [wallets,   setWallets]   = useState<WalletEntry[]>([]);
  const [winners,   setWinners]   = useState<WinnerEntry[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [winUpdatedAt, setWinUpdatedAt] = useState("");

  const [loading,    setLoading]    = useState(true);
  const [winLoading, setWinLoading] = useState(false);
  const [winLoaded,  setWinLoaded]  = useState(false);

  const [error,    setError]    = useState<string | null>(null);
  const [winError, setWinError] = useState<string | null>(null);

  const [tracked,  setTracked]  = useState<Set<string>>(new Set());
  const [tab,      setTab]      = useState<TabKey>("top");
  const [search,   setSearch]   = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Load main wallet list (filtered: ≥2 alpha tokens)
  useEffect(() => {
    fetch("/api/wallet-tracker")
      .then(r => r.json())
      .then((d: { wallets?: WalletEntry[]; error?: string; updatedAt?: string }) => {
        if (d.error) { setError(d.error); return; }
        setWallets(d.wallets ?? []);
        setUpdatedAt(d.updatedAt ?? "");
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  // Lazy-load winners only when that tab is first opened
  useEffect(() => {
    if (tab !== "winners" || winLoaded || winLoading) return;
    setWinLoading(true);
    fetch("/api/wallet-tracker?mode=winners")
      .then(r => r.json())
      .then((d: { winners?: WinnerEntry[]; error?: string; updatedAt?: string }) => {
        if (d.error) { setWinError(d.error); return; }
        setWinners(d.winners ?? []);
        setWinUpdatedAt(d.updatedAt ?? "");
        setWinLoaded(true);
      })
      .catch(e => setWinError(String(e)))
      .finally(() => setWinLoading(false));
  }, [tab, winLoaded, winLoading]);

  // Load tracked wallets from localStorage
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

  const trackedCount = tracked.size;
  const activeUpdatedAt = tab === "winners" ? winUpdatedAt : updatedAt;

  const displayWallets = useMemo(() => {
    let list = tab === "known"
      ? wallets.filter(w => w.is_known)
      : tab === "tracked"
      ? (() => {
          const base = wallets.filter(w => tracked.has(w.address));
          const found = new Set(base.map(w => w.address));
          for (const addr of tracked) {
            if (!found.has(addr)) base.push({
              address: addr, is_known: false, alpha_count: 0, positions: [],
              total_tao: 0, free_tao: 0, staked_tao: 0,
              change_24h_tao: 0, change_24h_pct: 0, rank: 9999,
            });
          }
          return base;
        })()
      : [...wallets];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(w =>
        w.address.toLowerCase().includes(q) ||
        w.label?.toLowerCase().includes(q) ||
        w.positions?.some(p => p.name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [wallets, tab, tracked, search]);

  const displayWinners = useMemo(() => {
    if (!search.trim()) return winners;
    const q = search.toLowerCase();
    return winners.filter(w =>
      w.address.toLowerCase().includes(q) || w.label?.toLowerCase().includes(q)
    );
  }, [winners, search]);

  return (
    <main className="flex-1 overflow-auto p-4 md:p-6 space-y-5 w-full">
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
            Top 200 multi-asset TAO wallets — active investors holding ≥2 alpha tokens.
            {activeUpdatedAt && <span className="ml-2 text-gray-600">Updated {timeAgo(activeUpdatedAt)}</span>}
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
            { label: "Qualified wallets", value: wallets.length.toString() },
            { label: "Avg alpha tokens",  value: wallets.length > 0 ? (wallets.reduce((s, w) => s + w.alpha_count, 0) / wallets.length).toFixed(1) : "—" },
            { label: "You tracking",      value: trackedCount.toString() },
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
            { key: "top",     label: "🎯 Multi-Asset Top 200" },
            { key: "winners", label: "🚀 Big Winners" },
            { key: "known",   label: "👑 Known" },
            { key: "tracked", label: `🔔 Tracked${trackedCount > 0 ? ` (${trackedCount})` : ""}` },
          ] as { key: TabKey; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                tab === t.key
                  ? t.key === "winners" ? "bg-green-500/20 text-green-300"
                  : t.key === "top"     ? "bg-indigo-500/20 text-indigo-300"
                  : "bg-gray-700 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >{t.label}</button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tab === "top" ? "Search wallet or token…" : "Search address…"}
          className="bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600 w-44"
        />
      </div>

      {/* List */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-950/40 text-[10px] text-gray-600 uppercase tracking-wide">
          <div className="w-8 text-center">Rank</div>
          <div className="flex-1">Wallet</div>
          {tab === "winners" && <div className="hidden sm:block text-right w-28 text-green-600">24h Gain</div>}
          <div className="hidden sm:block text-right w-28">Total TAO</div>
          {tab !== "winners" && <div className="w-4" />}
          <div className="w-8" />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-5 h-5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-sm text-gray-400 font-medium">Scanning 350+ wallets for alpha positions…</p>
              <p className="text-xs text-gray-600 mt-1">First load takes ~15s · cached for 45 min after that</p>
            </div>
          </div>
        )}
        {tab === "winners" && winLoading && (
          <div className="flex items-center justify-center py-12 gap-2">
            <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Fetching today's winners…</span>
          </div>
        )}

        {/* Errors */}
        {error && !loading && (
          <div className="py-8 px-6"><p className="text-red-400 text-sm">{error}</p></div>
        )}
        {winError && tab === "winners" && (
          <div className="py-8 px-6"><p className="text-red-400 text-sm">{winError}</p></div>
        )}

        {/* Empty */}
        {!loading && !error && tab !== "winners" && displayWallets.length === 0 && (
          <div className="py-12 text-center text-gray-600 text-sm">
            {tab === "tracked" ? "No wallets tracked yet — click 🔔 next to any wallet." : "No wallets found."}
          </div>
        )}

        {/* Main wallet list (top / known / tracked) */}
        {!loading && !error && tab !== "winners" && displayWallets.map(wallet => (
          <WalletRow
            key={wallet.address}
            wallet={wallet}
            tracked={tracked.has(wallet.address)}
            onToggleTrack={toggleTrack}
            expanded={expanded === wallet.address}
            onToggleExpand={addr => setExpanded(prev => prev === addr ? null : addr)}
          />
        ))}

        {/* Winners list */}
        {tab === "winners" && !winLoading && !winError && displayWinners.map(wallet => (
          <WinnerRow
            key={wallet.address}
            wallet={wallet}
            tracked={tracked.has(wallet.address)}
            onToggleTrack={toggleTrack}
          />
        ))}
      </div>

      {/* Footer */}
      {!loading && !error && (
        <div className="text-xs text-gray-600 space-y-1 px-1">
          <p>
            Only wallets holding ≥2 distinct alpha tokens shown (root network excluded) · data from TaoMarketCap · refreshes every 45 min.
          </p>
          <p>💡 Click any wallet row to instantly see their full alpha portfolio breakdown.</p>
          <p>🔔 Tracking saved locally in your browser.</p>
          {session?.user && <p className="text-purple-500/70">🔒 Not linked anywhere — share carefully.</p>}
        </div>
      )}
    </main>
  );
}
