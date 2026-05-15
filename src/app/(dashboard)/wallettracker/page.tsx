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

interface SRWhaleWallet {
  address:        string;
  label?:         string;
  emoji?:         string;
  category?:      string;
  is_known:       boolean;
  move_count:     number;
  total_staked:   number;
  total_unstaked: number;
  net_tao:        number;
  last_action:    "stake" | "unstake";
  last_netuid?:   number;
  last_amount:    number;
  last_ts:        string;
  active_subnets: number[];
}

type TabKey = "top" | "winners" | "sr" | "known" | "tracked";

// ── Alert Settings Panel ──────────────────────────────────────────
interface WalletAlertPrefs {
  connected:      boolean;
  username?:      string;
  firstName?:     string;
  walletTracker: {
    enabled:        boolean;
    minUsdAmount:   number;
    trackedWallets: string[];
  };
}

function AlertSettingsPanel({ trackedWallets }: { trackedWallets: string[] }) {
  const [prefs,      setPrefs]      = useState<WalletAlertPrefs | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [expanded,   setExpanded]   = useState(false);

  // Local editable state (mirrors server)
  const [enabled,    setEnabled]    = useState(false);
  const [minUsd,     setMinUsd]     = useState(1000);

  // Telegram connect flow
  const [code,       setCode]       = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetch("/api/wallet-alerts")
      .then(r => r.ok ? r.json() : null)
      .then((d: WalletAlertPrefs | null) => {
        if (d) {
          setPrefs(d);
          setEnabled(d.walletTracker.enabled);
          setMinUsd(d.walletTracker.minUsdAmount ?? 1000);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Poll for Telegram connection after code is shown
  useEffect(() => {
    if (!code) return;
    const interval = setInterval(async () => {
      const r = await fetch("/api/alerts/connect").catch(() => null);
      if (!r?.ok) return;
      const d = await r.json() as { connected: boolean; username?: string; firstName?: string };
      if (d.connected) {
        clearInterval(interval);
        setCode(null);
        setPrefs(prev => prev ? { ...prev, connected: true, username: d.username, firstName: d.firstName } : prev);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [code]);

  async function generateCode() {
    setConnecting(true);
    try {
      const r = await fetch("/api/alerts/connect", { method: "POST" });
      const d = await r.json() as { code?: string };
      if (d.code) setCode(d.code);
    } finally {
      setConnecting(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/wallet-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, minUsdAmount: minUsd, trackedWallets }),
      });
      setPrefs(prev => prev ? {
        ...prev,
        walletTracker: { enabled, minUsdAmount: minUsd, trackedWallets },
      } : prev);
    } finally {
      setSaving(false);
    }
  }

  // Only show if user is logged in (prefs loaded, even if null means 401)
  if (loading) return null;
  if (!prefs) return null; // not logged in

  const isConnected = prefs.connected;
  const isDirty = enabled !== prefs.walletTracker.enabled || minUsd !== prefs.walletTracker.minUsdAmount;

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      {/* Header bar */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/60 hover:bg-gray-900/80 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">📱</span>
          <div>
            <div className="text-sm font-semibold text-white">Telegram Alerts for Tracked Wallets</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              {!isConnected
                ? "Connect Telegram to receive buy/sell alerts"
                : enabled
                ? `Active · alerting on moves ≥ $${minUsd.toLocaleString()}`
                : "Connected — alerts off"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              enabled
                ? "bg-green-500/15 text-green-400 border-green-500/30"
                : "bg-gray-700/40 text-gray-500 border-gray-700"
            }`}>
              {enabled ? "ON" : "OFF"}
            </span>
          )}
          <svg className={`w-4 h-4 text-gray-600 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="bg-gray-950/60 border-t border-gray-800/50 px-4 py-4 space-y-4">
          {!isConnected ? (
            /* ── Not connected: show connect flow ── */
            <div className="space-y-3">
              {!code ? (
                <>
                  <p className="text-sm text-gray-400">
                    Connect your Telegram account to receive alerts when tracked wallets buy or sell.
                  </p>
                  <button
                    onClick={generateCode}
                    disabled={connecting}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {connecting ? (
                      <span className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                    ) : "✈️"}
                    Connect Telegram
                  </button>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-300">Open Telegram and send this message to <strong className="text-white">@AlphaGapBot</strong>:</p>
                  <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5">
                    <code className="text-sm font-mono text-indigo-300 flex-1">/start {code}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(`/start ${code}`).catch(() => {})}
                      className="text-[10px] text-gray-600 hover:text-gray-400"
                    >
                      ⎘ copy
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                    <span className="text-[11px] text-gray-500">Waiting for you to send the code…</span>
                  </div>
                  <p className="text-[10px] text-gray-600">Code expires in 10 minutes</p>
                </div>
              )}
            </div>
          ) : (
            /* ── Connected: show settings ── */
            <div className="space-y-4">
              {/* Connected badge */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-400 font-bold">✓ Connected</span>
                {prefs.firstName && <span className="text-gray-500">as {prefs.firstName}{prefs.username ? ` (@${prefs.username})` : ""}</span>}
              </div>

              {/* Toggle */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-white">Alert me on buys &amp; sells</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    Get a Telegram message when any tracked wallet stakes or unstakes
                  </div>
                </div>
                <button
                  onClick={() => setEnabled(e => !e)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    enabled ? "bg-indigo-500" : "bg-gray-700"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    enabled ? "translate-x-5" : ""
                  }`} />
                </button>
              </div>

              {/* Min amount */}
              {enabled && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-white">
                    Only alert on transactions over
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={minUsd}
                      onChange={e => setMinUsd(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-32 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white tabular-nums focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-[11px] text-gray-600">USD equivalent</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[500, 1000, 5000, 10000].map(v => (
                      <button
                        key={v}
                        onClick={() => setMinUsd(v)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                          minUsd === v
                            ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                            : "text-gray-500 border-gray-700 hover:text-gray-300"
                        }`}
                      >
                        ${v.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tracked wallets count */}
              <div className="text-[11px] text-gray-600">
                Monitoring <span className="text-gray-400 font-medium">{trackedWallets.length}</span> wallet{trackedWallets.length !== 1 ? "s" : ""}
                {trackedWallets.length === 0 && " — track wallets above first"}
              </div>

              {/* Save button */}
              <button
                onClick={save}
                disabled={saving || !isDirty}
                className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : isDirty ? "Save changes" : "Saved ✓"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
function PositionDrawer({ positions, highlightName }: { positions: AlphaPosition[]; highlightName?: string }) {
  const totalTao = positions.reduce((s, p) => s + p.staked_tao, 0);
  const totalUsd = positions.reduce((s, p) => s + p.staked_usd, 0);

  // Put highlighted position first
  const sorted = highlightName
    ? [...positions].sort((a, b) => {
        const aH = a.name.toLowerCase().includes(highlightName) ? 1 : 0;
        const bH = b.name.toLowerCase().includes(highlightName) ? 1 : 0;
        return bH - aH;
      })
    : positions;

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
        {sorted.map(pos => {
          const pct       = totalTao > 0 ? (pos.staked_tao / totalTao) * 100 : 0;
          const isMatch   = !!highlightName && pos.name.toLowerCase().includes(highlightName);
          return (
            <div
              key={pos.netuid}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors ${
                isMatch
                  ? "bg-emerald-950/40 border border-emerald-500/40 ring-1 ring-emerald-500/20"
                  : "bg-gray-900/70 border border-gray-800/80 hover:border-indigo-500/30"
              }`}
            >
              <SubnetLogo netuid={pos.netuid} name={pos.name} size={24} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] text-gray-600 font-mono flex-shrink-0">SN{pos.netuid}</span>
                    <span className={`text-xs font-semibold truncate ${isMatch ? "text-emerald-300" : "text-white"}`}>
                      {pos.name}
                    </span>
                    {isMatch && <span className="text-[9px] font-bold text-emerald-400 flex-shrink-0">✓</span>}
                  </div>
                  <span className="text-[10px] text-gray-600 flex-shrink-0 ml-1">{pct.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs font-medium tabular-nums ${isMatch ? "text-emerald-300" : "text-indigo-300"}`}>
                    {fmtTao(pos.staked_tao)}
                  </span>
                  {pos.staked_usd > 0 && (
                    <span className="text-[10px] text-gray-500 tabular-nums">{fmtUsd(pos.staked_usd)}</span>
                  )}
                </div>
                {/* Allocation bar */}
                <div className="mt-1.5 h-0.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isMatch ? "bg-emerald-500/70" : "bg-indigo-500/60"}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
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
  wallet, tracked, onToggleTrack, expanded, onToggleExpand, highlightName,
}: {
  wallet: WalletEntry;
  tracked: boolean;
  onToggleTrack: (addr: string) => void;
  expanded: boolean;
  onToggleExpand: (addr: string) => void;
  highlightName?: string;
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

      {expanded && <PositionDrawer positions={wallet.positions} highlightName={highlightName} />}
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

// ── SR Whale Row ──────────────────────────────────────────────────
function SRWhaleRow({
  wallet, tracked, onToggleTrack, rank,
}: {
  wallet: SRWhaleWallet;
  tracked: boolean;
  onToggleTrack: (addr: string) => void;
  rank: number;
}) {
  const [copied, setCopied] = useState(false);
  const isNetBuyer  = wallet.net_tao > 0;
  const isNetSeller = wallet.net_tao < 0;
  const netColor    = isNetBuyer ? "text-green-400" : isNetSeller ? "text-red-400" : "text-gray-500";
  const netSign     = isNetBuyer ? "+" : "";

  return (
    <div className={`group flex items-center gap-3 px-4 py-3 border-b border-gray-800/40 transition-colors
      ${tracked ? "bg-blue-950/20 border-l-2 border-l-blue-400/60" : "hover:bg-gray-800/25"}`}
    >
      {/* Rank */}
      <div className="w-8 text-center text-sm tabular-nums flex-shrink-0 text-gray-600">#{rank}</div>

      {/* Address + last action */}
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
        {/* Last move */}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className={`text-[10px] font-semibold ${wallet.last_action === "stake" ? "text-green-400" : "text-red-400"}`}>
            {wallet.last_action === "stake" ? "▲ STAKED" : "▼ UNSTAKED"}
          </span>
          {wallet.last_netuid != null && (
            <span className="text-[10px] text-gray-500">SN{wallet.last_netuid}</span>
          )}
          <span className="text-[10px] text-gray-600 tabular-nums">{fmtTao(wallet.last_amount)}</span>
          <span className="text-[10px] text-gray-700">·</span>
          <span className="text-[10px] text-gray-600">{timeAgo(wallet.last_ts)}</span>
          {wallet.active_subnets.length > 1 && (
            <span className="text-[10px] text-indigo-500">{wallet.active_subnets.length} subnets</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right hidden sm:block">
          <div className={`text-sm font-semibold tabular-nums ${netColor}`}>
            {netSign}{fmtTao(Math.abs(wallet.net_tao))} net
          </div>
          <div className="text-[10px] text-gray-600 tabular-nums">
            {wallet.move_count} move{wallet.move_count !== 1 ? "s" : ""}
          </div>
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
  const [winners,    setWinners]    = useState<WinnerEntry[]>([]);
  const [srWhales,   setSrWhales]   = useState<SRWhaleWallet[]>([]);
  const [updatedAt,  setUpdatedAt]  = useState("");
  const [winUpdatedAt,  setWinUpdatedAt]  = useState("");
  const [srUpdatedAt,   setSrUpdatedAt]   = useState("");

  const [loading,    setLoading]    = useState(true);
  const [winLoading, setWinLoading] = useState(false);
  const [winLoaded,  setWinLoaded]  = useState(false);
  const [srLoading,  setSrLoading]  = useState(false);
  const [srLoaded,   setSrLoaded]   = useState(false);

  const [error,    setError]    = useState<string | null>(null);
  const [winError, setWinError] = useState<string | null>(null);
  const [srError,  setSrError]  = useState<string | null>(null);

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

  // Lazy-load SR whales when that tab is first opened
  useEffect(() => {
    if (tab !== "sr" || srLoaded || srLoading) return;
    setSrLoading(true);
    fetch("/api/wallet-tracker?mode=sr-whales")
      .then(r => r.json())
      .then((d: { whales?: SRWhaleWallet[]; error?: string; updatedAt?: string }) => {
        if (d.error) { setSrError(d.error); return; }
        setSrWhales(d.whales ?? []);
        setSrUpdatedAt(d.updatedAt ?? "");
        setSrLoaded(true);
      })
      .catch(e => setSrError(String(e)))
      .finally(() => setSrLoading(false));
  }, [tab, srLoaded, srLoading]);

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
  const activeUpdatedAt = tab === "winners" ? winUpdatedAt : tab === "sr" ? srUpdatedAt : updatedAt;

  // Detect if search is targeting a subnet name (matches at least one position name)
  const subnetSearchName = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || q.length < 2) return "";
    // Only treat as subnet search if it doesn't look like a wallet address/label
    const matchesSubnet = wallets.some(w =>
      w.positions?.some(p => p.name.toLowerCase().includes(q))
    );
    const matchesWallet = wallets.some(w =>
      w.address.toLowerCase().includes(q) || w.label?.toLowerCase().includes(q)
    );
    // Prefer subnet search when the term hits subnet names (and isn't purely a wallet search)
    return matchesSubnet && !matchesWallet ? q : matchesSubnet ? q : "";
  }, [wallets, search]);

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
      const q = search.trim().toLowerCase();
      list = list.filter(w =>
        w.address.toLowerCase().includes(q) ||
        w.label?.toLowerCase().includes(q) ||
        w.positions?.some(p => p.name.toLowerCase().includes(q))
      );
    }

    // When filtering by subnet name: sort by how much of that subnet each wallet holds
    if (subnetSearchName) {
      list = [...list].sort((a, b) => {
        const aPos = a.positions?.find(p => p.name.toLowerCase().includes(subnetSearchName))?.staked_tao ?? 0;
        const bPos = b.positions?.find(p => p.name.toLowerCase().includes(subnetSearchName))?.staked_tao ?? 0;
        return bPos - aPos;
      });
    }

    return list;
  }, [wallets, tab, tracked, search, subnetSearchName]);

  const displayWinners = useMemo(() => {
    if (!search.trim()) return winners;
    const q = search.toLowerCase();
    return winners.filter(w =>
      w.address.toLowerCase().includes(q) || w.label?.toLowerCase().includes(q)
    );
  }, [winners, search]);

  const displaySRWhales = useMemo(() => {
    if (!search.trim()) return srWhales;
    const q = search.toLowerCase();
    return srWhales.filter(w =>
      w.address.toLowerCase().includes(q) || w.label?.toLowerCase().includes(q)
    );
  }, [srWhales, search]);

  return (
    <main className="flex-1 overflow-auto p-4 md:p-8 space-y-5 max-w-[1400px] mx-auto w-full">
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
            { key: "sr",      label: "🐋 SR Whales" },
            { key: "known",   label: "👑 Known" },
            { key: "tracked", label: `🔔 Tracked${trackedCount > 0 ? ` (${trackedCount})` : ""}` },
          ] as { key: TabKey; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                tab === t.key
                  ? t.key === "winners" ? "bg-green-500/20 text-green-300"
                  : t.key === "top"     ? "bg-indigo-500/20 text-indigo-300"
                  : t.key === "sr"      ? "bg-cyan-500/20 text-cyan-300"
                  : "bg-gray-700 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >{t.label}</button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tab === "top" ? "Search subnet, wallet…" : "Search address…"}
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
          {tab === "sr"      && <div className="hidden sm:block text-right w-28 text-cyan-700">Net TAO</div>}
          {tab !== "winners" && tab !== "sr" && <div className="hidden sm:block text-right w-28">Total TAO</div>}
          {tab !== "winners" && tab !== "sr" && <div className="w-4" />}
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
        {tab === "sr" && srLoading && (
          <div className="flex items-center justify-center py-12 gap-2">
            <div className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Loading SubnetRadar whale data…</span>
          </div>
        )}

        {/* Errors */}
        {error && !loading && (
          <div className="py-8 px-6"><p className="text-red-400 text-sm">{error}</p></div>
        )}
        {winError && tab === "winners" && (
          <div className="py-8 px-6"><p className="text-red-400 text-sm">{winError}</p></div>
        )}
        {srError && tab === "sr" && (
          <div className="py-8 px-6"><p className="text-red-400 text-sm">{srError}</p></div>
        )}

        {/* Empty */}
        {!loading && !error && tab !== "winners" && tab !== "sr" && displayWallets.length === 0 && (
          <div className="py-12 text-center text-gray-600 text-sm">
            {tab === "tracked" ? "No wallets tracked yet — click 🔔 next to any wallet." : "No wallets found."}
          </div>
        )}
        {!srLoading && !srError && tab === "sr" && displaySRWhales.length === 0 && srLoaded && (
          <div className="py-12 text-center text-gray-600 text-sm">No whale data available.</div>
        )}

        {/* Subnet search banner */}
        {!loading && !error && tab !== "winners" && subnetSearchName && displayWallets.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-950/30 border-b border-emerald-800/30">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">🔍 Subnet filter</span>
            <span className="text-[10px] text-gray-500">—</span>
            <span className="text-[10px] text-emerald-300">
              {displayWallets.length} wallet{displayWallets.length !== 1 ? "s" : ""} holding <strong>{displayWallets[0]?.positions?.find(p => p.name.toLowerCase().includes(subnetSearchName))?.name ?? search.trim()}</strong>
              , sorted by largest position
            </span>
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
            highlightName={subnetSearchName || undefined}
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

        {/* SR Whales list */}
        {tab === "sr" && !srLoading && !srError && displaySRWhales.map((wallet, i) => (
          <SRWhaleRow
            key={wallet.address}
            wallet={wallet}
            rank={i + 1}
            tracked={tracked.has(wallet.address)}
            onToggleTrack={toggleTrack}
          />
        ))}
      </div>

      {/* Telegram alert settings */}
      {session?.user && trackedCount > 0 && (
        <AlertSettingsPanel trackedWallets={[...tracked]} />
      )}

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
