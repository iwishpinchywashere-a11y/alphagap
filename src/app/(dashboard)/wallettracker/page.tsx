"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import SubnetLogo from "@/components/dashboard/SubnetLogo";

// ── Types ─────────────────────────────────────────────────────────
interface WalletPosition {
  netuid: number;
  name?: string;
  balance_tao: number;
  balance_usd?: number;
}

interface TrackedWallet {
  address: string;
  label?: string;
  emoji?: string;
  category?: string;
  total_tao: number;
  total_usd: number;
  subnet_count: number;
  top_position: WalletPosition | null;
  positions: WalletPosition[];
  rank_by_tao: number;
  rank_by_usd: number;
  is_known: boolean;
}

interface ApiResponse {
  wallets: TrackedWallet[];
  updatedAt: string;
}

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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Row Component ─────────────────────────────────────────────────
function WalletRow({
  wallet,
  tracked,
  onToggleTrack,
  sortMode,
}: {
  wallet: TrackedWallet;
  tracked: boolean;
  onToggleTrack: (addr: string) => void;
  sortMode: "tao" | "usd" | "subnets";
}) {
  const [copied, setCopied] = useState(false);

  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(wallet.address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const rank = sortMode === "tao" ? wallet.rank_by_tao
             : sortMode === "usd" ? wallet.rank_by_usd
             : wallet.rank_by_tao;

  const rankColor = rank <= 3
    ? "text-yellow-400 font-bold"
    : rank <= 10
    ? "text-amber-400 font-semibold"
    : "text-gray-600";

  return (
    <div className={`group flex items-center gap-3 px-4 py-3 border-b border-gray-800/50 last:border-0 transition-colors hover:bg-gray-800/30 ${
      tracked ? "bg-blue-950/20 border-l-2 border-l-blue-400/60" : ""
    }`}>
      {/* Rank */}
      <div className={`w-8 text-center text-sm tabular-nums flex-shrink-0 ${rankColor}`}>
        {rank <= 100 && rank !== 9999 ? `#${rank}` : "—"}
      </div>

      {/* Address + label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {wallet.emoji && (
            <span className="text-base">{wallet.emoji}</span>
          )}
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

        {/* Top positions mini-bar */}
        {wallet.positions.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {wallet.positions.slice(0, 4).map((pos) => (
              <div key={pos.netuid} className="flex items-center gap-1">
                <SubnetLogo netuid={pos.netuid} name={pos.name ?? `SN${pos.netuid}`} size={14} />
                <span className="text-[10px] text-gray-600">{pos.name ?? `SN${pos.netuid}`}</span>
                <span className="text-[10px] text-gray-500">{fmtTao(pos.balance_tao)}</span>
              </div>
            ))}
            {wallet.subnet_count > 4 && (
              <span className="text-[10px] text-gray-600">+{wallet.subnet_count - 4} more</span>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-5 flex-shrink-0">
        {/* Total TAO */}
        <div className="text-right hidden sm:block">
          <div className="text-sm font-semibold text-white tabular-nums">{fmtTao(wallet.total_tao)}</div>
          {wallet.total_usd > 0 && (
            <div className="text-xs text-gray-500 tabular-nums">{fmtUsd(wallet.total_usd)}</div>
          )}
        </div>

        {/* Subnet count */}
        <div className="text-right hidden md:block w-14">
          <div className="text-sm text-gray-300 tabular-nums">{wallet.subnet_count}</div>
          <div className="text-[10px] text-gray-600">subnets</div>
        </div>

        {/* Track button */}
        <button
          onClick={() => onToggleTrack(wallet.address)}
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
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function WalletTrackerPage() {
  const { data: session } = useSession();
  const [wallets, setWallets]   = useState<TrackedWallet[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[] | null>(null);
  const [tracked, setTracked]   = useState<Set<string>>(new Set());
  const [tab, setTab]           = useState<"top" | "known" | "tracked">("top");
  const [sortMode, setSortMode] = useState<"tao" | "usd" | "subnets">("tao");
  const [search, setSearch]     = useState("");

  // Load data
  useEffect(() => {
    fetch("/api/wallet-tracker")
      .then(r => r.json())
      .then((data: ApiResponse & { debug?: string[] }) => {
        if ("error" in data) {
          setError(String((data as { error: string }).error));
          if (data.debug) setDebugInfo(data.debug);
          return;
        }
        setWallets(data.wallets ?? []);
        setUpdatedAt(data.updatedAt ?? "");
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  // Load tracked wallets from localStorage (client-side persistence for now)
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

  const sortedWallets = useMemo(() => {
    let list = [...wallets];
    if (sortMode === "usd")     list = list.sort((a, b) => b.total_usd - a.total_usd);
    if (sortMode === "tao")     list = list.sort((a, b) => b.total_tao - a.total_tao);
    if (sortMode === "subnets") list = list.sort((a, b) => b.subnet_count - a.subnet_count);
    return list;
  }, [wallets, sortMode]);

  const displayWallets = useMemo(() => {
    let list = sortedWallets;

    if (tab === "known")   list = list.filter(w => w.is_known);
    if (tab === "tracked") list = list.filter(w => tracked.has(w.address));

    // Known wallets + tracked wallets: include even if not in top-100 API result
    if (tab === "tracked") {
      const found = new Set(list.map(w => w.address));
      for (const addr of tracked) {
        if (!found.has(addr)) {
          list.push({
            address: addr,
            total_tao: 0, total_usd: 0, subnet_count: 0,
            top_position: null, positions: [],
            rank_by_tao: 9999, rank_by_usd: 9999,
            is_known: false,
          });
        }
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(w =>
        w.address.toLowerCase().includes(q) ||
        w.label?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [sortedWallets, tab, tracked, search]);

  const trackedCount = tracked.size;

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
            Top TAO wallets by stake — track the smart money.
            {updatedAt && (
              <span className="ml-2 text-gray-600">Updated {timeAgo(updatedAt)}</span>
            )}
          </p>
        </div>

        {trackedCount > 0 && (
          <div className="flex-shrink-0 text-right">
            <span className="text-xs text-blue-400 font-medium">{trackedCount} wallet{trackedCount !== 1 ? "s" : ""} tracked</span>
          </div>
        )}
      </div>

      {/* Stats bar */}
      {!loading && !error && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Wallets indexed", value: wallets.filter(w => w.total_tao > 0).length.toString() },
            { label: "Known addresses", value: wallets.filter(w => w.is_known).length.toString() },
            { label: "You tracking", value: trackedCount.toString() },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-white tabular-nums">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-900/60 border border-gray-800 rounded-lg p-1">
          {([
            { key: "top",     label: "🏆 Top Holders" },
            { key: "known",   label: "👑 Known Wallets" },
            { key: "tracked", label: `🔔 Tracked${trackedCount > 0 ? ` (${trackedCount})` : ""}` },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                tab === t.key
                  ? "bg-gray-700 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search address…"
            className="bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600 w-40"
          />
          <div className="flex gap-1 bg-gray-900/60 border border-gray-800 rounded-lg p-1">
            {([
              { key: "tao",     label: "τ TAO" },
              { key: "usd",     label: "$ USD" },
              { key: "subnets", label: "# Nets" },
            ] as const).map(s => (
              <button
                key={s.key}
                onClick={() => setSortMode(s.key)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                  sortMode === s.key
                    ? "bg-green-500/20 text-green-400"
                    : "text-gray-600 hover:text-gray-400"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Wallet list */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-950/40 text-[10px] text-gray-600 uppercase tracking-wide">
          <div className="w-8 text-center">Rank</div>
          <div className="flex-1">Wallet / Positions</div>
          <div className="hidden sm:block text-right w-28">TAO Stake</div>
          <div className="hidden md:block text-right w-14">Subnets</div>
          <div className="w-8" />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 gap-2">
            <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Fetching whale data…</span>
          </div>
        )}

        {error && (
          <div className="py-8 px-6">
            <p className="text-red-400 text-sm font-medium mb-1">{error}</p>
            {debugInfo && (
              <div className="mt-2 space-y-1">
                {debugInfo.map((d, i) => (
                  <p key={i} className="text-[11px] font-mono text-gray-600">{d}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && !error && displayWallets.length === 0 && (
          <div className="py-12 text-center text-gray-600 text-sm">
            {tab === "tracked"
              ? "No wallets tracked yet — click 🔔 next to any wallet to start tracking."
              : "No wallets found."}
          </div>
        )}

        {!loading && !error && displayWallets.map(wallet => (
          <WalletRow
            key={wallet.address}
            wallet={wallet}
            tracked={tracked.has(wallet.address)}
            onToggleTrack={toggleTrack}
            sortMode={sortMode}
          />
        ))}
      </div>

      {/* Info footer */}
      {!loading && !error && (
        <div className="text-xs text-gray-600 space-y-1 px-1">
          <p>
            Data from TaoStats · Shows wallets with the largest staked TAO-equivalent positions across all dTAO subnets.
            Balances update every ~30 min.
          </p>
          <p>
            🔔 Tracking is saved locally. Movement alerts via the Alerts system coming soon.
          </p>
          {session?.user && (
            <p className="text-purple-500/70">
              🔒 This page is not linked anywhere — share carefully.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
