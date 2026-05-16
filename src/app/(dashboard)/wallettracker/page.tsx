"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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

interface TSWhaleWallet {
  address:        string;
  label?:         string;
  emoji?:         string;
  category?:      string;
  is_known:       boolean;
  subnet_count:   number;
  total_usd:      number;
  net_usd:        number;
  last_action:    "DELEGATE" | "UNDELEGATE";
  last_netuid:    number;
  last_usd:       number;
  last_ts:        string;
  active_subnets: number[];
}

type TabKey = "top" | "winners" | "sr" | "ts" | "known" | "tracked";

// ── Add Wallet Input ──────────────────────────────────────────────
function AddWalletInput({ fromTab }: { fromTab: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function isValidAddress(a: string) {
    return /^5[A-Za-z0-9]{47}$/.test(a.trim());
  }

  function navigate(addr: string) {
    router.push(`/wallettracker/${addr}?from=${fromTab}`);
  }

  function handleGo() {
    const addr = value.trim();
    if (!addr) return;
    if (!isValidAddress(addr)) {
      setError("Invalid TAO address — should start with 5 and be 48 characters");
      return;
    }
    navigate(addr);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").trim();
    if (isValidAddress(pasted)) {
      e.preventDefault();
      navigate(pasted);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-2xl group">
          {/* glow ring on focus */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500/20 via-indigo-500/20 to-cyan-500/20 opacity-0 group-focus-within:opacity-100 blur-sm transition-opacity duration-300 pointer-events-none" />
          <div className="relative flex items-center bg-gray-950/80 border border-gray-700/60 rounded-xl overflow-hidden focus-within:border-violet-500/50 transition-colors">
            <span className="pl-3 text-gray-600 flex-shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              value={value}
              onChange={e => { setValue(e.target.value); setError(null); }}
              onPaste={handlePaste}
              onKeyDown={e => e.key === "Enter" && handleGo()}
              placeholder="Paste a TAO wallet address…"
              spellCheck={false}
              className={`flex-1 bg-transparent px-3 py-2.5 text-[10px] sm:text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none`}
            />
            <button
              onClick={handleGo}
              disabled={!value.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border-l border-gray-700/60 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              <span className="hidden sm:inline">View</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {error && <p className="text-[10px] text-red-400 px-1">{error}</p>}
    </div>
  );
}

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

  const [enabled,    setEnabled]    = useState(false);
  const [minUsd,     setMinUsd]     = useState(1000);

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

  if (loading) return null;
  if (!prefs) return null;

  const isConnected = prefs.connected;
  const isDirty = enabled !== prefs.walletTracker.enabled || minUsd !== prefs.walletTracker.minUsdAmount;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-800/60 bg-gray-950/70 backdrop-blur-sm">
      {/* subtle blue glow in top-right when active */}
      {isConnected && enabled && (
        <div className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full bg-blue-500/10 blur-2xl" />
      )}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isConnected && enabled
              ? "bg-blue-500/20 border border-blue-500/30"
              : "bg-gray-800/60 border border-gray-700/50"
          }`}>
            <span className="text-sm">✈️</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Telegram Wallet Alerts</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              {!isConnected
                ? "Connect to get notified when tracked wallets move"
                : enabled
                ? `Live · alerting on moves ≥ $${minUsd.toLocaleString()}`
                : "Connected — alerts paused"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {isConnected && (
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
              enabled
                ? "bg-green-500/15 text-green-400 border-green-500/30"
                : "bg-gray-700/40 text-gray-500 border-gray-700"
            }`}>
              {enabled ? "● LIVE" : "PAUSED"}
            </span>
          )}
          <svg className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-800/50 px-5 py-4 space-y-4">
          {!isConnected ? (
            <div className="space-y-3">
              {!code ? (
                <>
                  <p className="text-sm text-gray-400">Connect your Telegram to receive real-time alerts when tracked wallets buy or sell.</p>
                  <button
                    onClick={generateCode}
                    disabled={connecting}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {connecting ? <span className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /> : "✈️"}
                    Connect Telegram
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-300">Open Telegram and send this to <strong className="text-white">@AlphaGapBot</strong>:</p>
                  <div className="flex items-center gap-2 bg-gray-900/80 border border-gray-700/60 rounded-xl px-4 py-3">
                    <code className="text-sm font-mono text-violet-300 flex-1">/start {code}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(`/start ${code}`).catch(() => {})}
                      className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
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
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 font-semibold">Connected</span>
                {prefs.firstName && <span className="text-gray-500">as {prefs.firstName}{prefs.username ? ` (@${prefs.username})` : ""}</span>}
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-white">Alert me on buys &amp; sells</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Get pinged when any tracked wallet stakes or unstakes</div>
                </div>
                <button
                  onClick={() => setEnabled(e => !e)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? "bg-violet-500" : "bg-gray-700"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-5" : ""}`} />
                </button>
              </div>
              {enabled && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Only alert on moves over</label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">$</span>
                    <input
                      type="number" min={0} step={100} value={minUsd}
                      onChange={e => setMinUsd(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-32 bg-gray-900/80 border border-gray-700/60 rounded-lg px-3 py-1.5 text-sm text-white tabular-nums focus:outline-none focus:border-violet-500/50 transition-colors"
                    />
                    <span className="text-[11px] text-gray-600">USD equivalent</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[500, 1000, 5000, 10000].map(v => (
                      <button key={v} onClick={() => setMinUsd(v)}
                        className={`text-[10px] px-2.5 py-0.5 rounded-full border transition-colors ${
                          minUsd === v ? "bg-violet-500/20 text-violet-300 border-violet-500/40" : "text-gray-500 border-gray-700 hover:text-gray-300"
                        }`}>
                        ${v.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-[11px] text-gray-600">
                Monitoring <span className="text-gray-400 font-medium">{trackedWallets.length}</span> wallet{trackedWallets.length !== 1 ? "s" : ""}
                {trackedWallets.length === 0 && " — track wallets below first"}
              </div>
              <button
                onClick={save}
                disabled={saving || !isDirty}
                className="px-4 py-2 bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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

// rank medal
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-sm">🥇</span>;
  if (rank === 2) return <span className="text-sm">🥈</span>;
  if (rank === 3) return <span className="text-sm">🥉</span>;
  return <span className={`text-xs tabular-nums font-mono ${rank <= 10 ? "text-amber-500/80" : "text-gray-600"}`}>#{rank}</span>;
}

// track bell button
function TrackButton({ tracked, onToggle }: { tracked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle(); }}
      title={tracked ? "Stop tracking" : "Track this wallet"}
      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 ${
        tracked
          ? "bg-blue-500/20 text-blue-400 border border-blue-500/40 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/40"
          : "bg-gray-800/60 text-gray-600 border border-gray-700/40 hover:bg-blue-500/15 hover:text-blue-400 hover:border-blue-500/40"
      }`}
    >
      {tracked ? (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a3 3 0 01-2.83-2h5.66A3 3 0 0110 18z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      )}
    </button>
  );
}

// wallet label chip
function LabelChip({ label, category }: { label: string; category?: string }) {
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
      category === "founder"
        ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
        : "bg-purple-500/15 text-purple-400 border border-purple-500/25"
    }`}>{label}</span>
  );
}

// ── Position Drawer ───────────────────────────────────────────────
function PositionDrawer({ positions, highlightName }: { positions: AlphaPosition[]; highlightName?: string }) {
  const totalTao = positions.reduce((s, p) => s + p.staked_tao, 0);
  const totalUsd = positions.reduce((s, p) => s + p.staked_usd, 0);

  const sorted = highlightName
    ? [...positions].sort((a, b) => {
        const aH = a.name.toLowerCase().includes(highlightName) ? 1 : 0;
        const bH = b.name.toLowerCase().includes(highlightName) ? 1 : 0;
        return bH - aH;
      })
    : positions;

  return (
    <div className="bg-gray-950/90 border-b border-gray-800/40 px-4 py-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">
          {positions.length} alpha position{positions.length !== 1 ? "s" : ""}
        </span>
        <span className="text-gray-700">·</span>
        <span className="text-[10px] text-gray-400 tabular-nums">{fmtTao(totalTao)} total</span>
        {totalUsd > 0 && (
          <>
            <span className="text-gray-700">·</span>
            <span className="text-[10px] text-gray-400 tabular-nums">{fmtUsd(totalUsd)}</span>
          </>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {sorted.map(pos => {
          const pct     = totalTao > 0 ? (pos.staked_tao / totalTao) * 100 : 0;
          const isMatch = !!highlightName && pos.name.toLowerCase().includes(highlightName);
          return (
            <div key={pos.netuid}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors ${
                isMatch
                  ? "bg-emerald-950/50 border border-emerald-500/40 ring-1 ring-emerald-500/15"
                  : "bg-gray-900/60 border border-gray-800/60 hover:border-violet-500/20"
              }`}
            >
              <SubnetLogo netuid={pos.netuid} name={pos.name} size={24} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[9px] text-gray-600 font-mono flex-shrink-0">SN{pos.netuid}</span>
                    <span className={`text-xs font-semibold truncate ${isMatch ? "text-emerald-300" : "text-white"}`}>{pos.name}</span>
                    {isMatch && <span className="text-[9px] font-bold text-emerald-400 flex-shrink-0">✓</span>}
                  </div>
                  <span className="text-[9px] text-gray-600 flex-shrink-0">{pct.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs font-medium tabular-nums ${isMatch ? "text-emerald-300" : "text-violet-300"}`}>
                    {fmtTao(pos.staked_tao)}
                  </span>
                  {pos.staked_usd > 0 && (
                    <span className="text-[9px] text-gray-500 tabular-nums">{fmtUsd(pos.staked_usd)}</span>
                  )}
                </div>
                <div className="mt-1.5 h-0.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isMatch ? "bg-emerald-500/70" : "bg-violet-500/50"}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-700 mt-3">TAO-equivalent · click row again to collapse</p>
    </div>
  );
}

// ── On-demand Position Drawer ─────────────────────────────────────
function OnDemandPositionDrawer({ address }: { address: string }) {
  const [positions, setPositions] = useState<AlphaPosition[] | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`/api/wallet-tracker?mode=wallet-detail&address=${encodeURIComponent(address)}`)
      .then(r => r.json())
      .then((d: { positions?: AlphaPosition[]; error?: string }) => {
        if (d.error) { setError("Could not load positions"); return; }
        setPositions(d.positions ?? []);
      })
      .catch(() => setError("Could not load positions"))
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) return (
    <div className="bg-gray-950/90 border-b border-gray-800/40 px-4 py-5 flex items-center gap-2">
      <div className="w-3.5 h-3.5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
      <span className="text-xs text-gray-500">Loading portfolio…</span>
    </div>
  );
  if (error) return (
    <div className="bg-gray-950/90 border-b border-gray-800/40 px-4 py-4">
      <p className="text-xs text-gray-600">{error}</p>
    </div>
  );
  if (!positions?.length) return (
    <div className="bg-gray-950/90 border-b border-gray-800/40 px-4 py-4">
      <p className="text-xs text-gray-600">No alpha positions found for this wallet.</p>
    </div>
  );
  return <PositionDrawer positions={positions} />;
}

// ── Wallet Row ────────────────────────────────────────────────────
function WalletRow({
  wallet, tracked, onToggleTrack, highlightName, fromTab,
}: {
  wallet: WalletEntry; tracked: boolean; onToggleTrack: (addr: string) => void;
  highlightName?: string; fromTab: string;
}) {
  const router = useRouter();
  const changeColor = wallet.change_24h_tao >= 0 ? "text-emerald-400" : "text-red-400";
  const changeBg    = wallet.change_24h_tao >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20";

  return (
    <div
      onClick={() => router.push(`/wallettracker/${wallet.address}?from=${fromTab}`)}
      className={`group relative flex items-center gap-3 px-4 py-3.5 border-b border-gray-800/30 cursor-pointer transition-all duration-150
        ${tracked
          ? "bg-blue-950/20 border-l-2 border-l-blue-500/60 pl-3.5"
          : "hover:bg-white/[0.02] border-l-2 border-l-transparent"}`}
    >
      {/* hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-gradient-to-r from-violet-500/[0.03] to-transparent" />

      {/* Rank */}
      <div className="w-7 flex items-center justify-center flex-shrink-0 hidden sm:flex">
        <RankBadge rank={wallet.rank} />
      </div>

      {/* Address + label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {wallet.emoji && <span className="text-sm leading-none">{wallet.emoji}</span>}
          {wallet.label && <LabelChip label={wallet.label} category={wallet.category} />}
          <span className="font-mono text-xs text-gray-400 group-hover:text-gray-200 transition-colors truncate">
            {shortAddr(wallet.address)}
          </span>
          {highlightName && wallet.positions?.some(p => p.name.toLowerCase().includes(highlightName)) && (
            <span className="text-[9px] font-bold text-emerald-400">✓</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-semibold text-violet-400/80 bg-violet-500/10 px-1.5 py-0.5 rounded-md border border-violet-500/15">
            {wallet.alpha_count} tokens
          </span>
          {wallet.staked_tao > 0 && (
            <span className="text-[10px] text-gray-600">{fmtTao(wallet.staked_tao)} staked</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="text-right hidden sm:block">
          <div className="text-sm font-bold text-white tabular-nums">{fmtTao(wallet.total_tao)}</div>
          {wallet.change_24h_tao !== 0 && (
            <div className={`text-[10px] tabular-nums font-semibold px-1.5 py-0.5 rounded-md border ${changeColor} ${changeBg} mt-0.5`}>
              {fmtChange(wallet.change_24h_tao)}
            </div>
          )}
        </div>
        <svg className="w-3.5 h-3.5 text-gray-700 group-hover:text-gray-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <TrackButton tracked={tracked} onToggle={() => onToggleTrack(wallet.address)} />
      </div>
    </div>
  );
}

// ── Winner Row ────────────────────────────────────────────────────
function WinnerRow({
  wallet, tracked, onToggleTrack, fromTab,
}: {
  wallet: WinnerEntry; tracked: boolean; onToggleTrack: (addr: string) => void; fromTab: string;
}) {
  const router = useRouter();
  const isGain = wallet.change_24h_tao >= 0;

  return (
    <div
      className={`group relative flex items-center gap-3 px-4 py-3.5 border-b border-gray-800/30 transition-all duration-150 cursor-pointer
        ${tracked
          ? "bg-blue-950/20 border-l-2 border-l-blue-500/60 pl-3.5"
          : "hover:bg-white/[0.02] border-l-2 border-l-transparent"}`}
      onClick={() => router.push(`/wallettracker/${wallet.address}?from=${fromTab}`)}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-gradient-to-r from-emerald-500/[0.03] to-transparent" />

      <div className="w-7 flex items-center justify-center flex-shrink-0 hidden sm:flex">
        <RankBadge rank={wallet.rank} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {wallet.emoji && <span className="text-sm leading-none">{wallet.emoji}</span>}
          {wallet.label && <LabelChip label={wallet.label} category={wallet.category} />}
          <span className="font-mono text-xs text-gray-400 group-hover:text-gray-200 transition-colors">
            {shortAddr(wallet.address)}
          </span>
        </div>
        {wallet.staked_tao > 0 && (
          <span className="text-[10px] text-gray-600 mt-1 block">{fmtTao(wallet.staked_tao)} staked</span>
        )}
      </div>

      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="text-right">
          <div className={`text-sm font-bold tabular-nums ${isGain ? "text-emerald-400" : "text-red-400"}`}>
            {fmtChange(wallet.change_24h_tao)}
          </div>
          <div className={`text-[10px] tabular-nums ${isGain ? "text-emerald-500/70" : "text-red-500/70"}`}>
            {isGain ? "+" : ""}{wallet.change_24h_pct.toFixed(1)}%
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-sm font-semibold text-white/80 tabular-nums">{fmtTao(wallet.total_tao)}</div>
        </div>
        <svg className="w-3.5 h-3.5 text-gray-700 group-hover:text-gray-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <TrackButton tracked={tracked} onToggle={() => onToggleTrack(wallet.address)} />
      </div>
    </div>
  );
}

// ── TaoStats Whale Row ────────────────────────────────────────────
function TSWhaleRow({
  wallet, tracked, onToggleTrack, rank, fromTab,
}: {
  wallet: TSWhaleWallet; tracked: boolean; onToggleTrack: (addr: string) => void; rank: number; fromTab: string;
}) {
  const router   = useRouter();
  const isBuy    = wallet.net_usd > 0;
  const netColor = isBuy ? "text-emerald-400" : wallet.net_usd < 0 ? "text-red-400" : "text-gray-500";

  return (
    <div
      className={`group relative flex items-center gap-3 px-4 py-3.5 border-b border-gray-800/30 transition-all duration-150 cursor-pointer
        ${tracked ? "bg-blue-950/20 border-l-2 border-l-blue-500/60 pl-3.5" : "hover:bg-white/[0.02] border-l-2 border-l-transparent"}`}
      onClick={() => router.push(`/wallettracker/${wallet.address}?from=${fromTab}`)}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-gradient-to-r from-violet-500/[0.03] to-transparent" />

      <div className="w-7 flex items-center justify-center flex-shrink-0 hidden sm:flex">
        <RankBadge rank={rank} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {wallet.emoji && <span className="text-sm leading-none">{wallet.emoji}</span>}
          {wallet.label && <LabelChip label={wallet.label} category={wallet.category} />}
          <span className="font-mono text-xs text-gray-400 group-hover:text-gray-200 transition-colors">
            {shortAddr(wallet.address)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`text-[10px] font-bold ${wallet.last_action === "DELEGATE" ? "text-emerald-400" : "text-red-400"}`}>
            {wallet.last_action === "DELEGATE" ? "▲" : "▼"} {wallet.last_action === "DELEGATE" ? "STAKED" : "UNSTAKED"}
          </span>
          <span className="text-[10px] text-gray-600">SN{wallet.last_netuid}</span>
          {wallet.last_usd > 0 && <span className="text-[10px] text-gray-500 tabular-nums">{fmtUsd(wallet.last_usd)}</span>}
          <span className="text-[10px] text-gray-700">·</span>
          <span className="text-[10px] text-gray-600">{timeAgo(wallet.last_ts)}</span>
          {wallet.active_subnets.length > 1 && (
            <span className="text-[10px] text-violet-500 bg-violet-500/10 px-1.5 py-0.5 rounded-md border border-violet-500/20">
              {wallet.subnet_count} subnets
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="text-right hidden sm:block">
          <div className={`text-sm font-semibold tabular-nums ${netColor}`}>
            {wallet.net_usd > 0 ? "+" : ""}{fmtUsd(Math.abs(wallet.net_usd))} net
          </div>
          <div className="text-[10px] text-gray-600 tabular-nums">{fmtUsd(wallet.total_usd)} total</div>
        </div>
        <svg className="w-3.5 h-3.5 text-gray-700 group-hover:text-gray-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <TrackButton tracked={tracked} onToggle={() => onToggleTrack(wallet.address)} />
      </div>
    </div>
  );
}

// ── SR Whale Row ──────────────────────────────────────────────────
function SRWhaleRow({
  wallet, tracked, onToggleTrack, rank, fromTab,
}: {
  wallet: SRWhaleWallet; tracked: boolean; onToggleTrack: (addr: string) => void; rank: number; fromTab: string;
}) {
  const router      = useRouter();
  const isNetBuyer  = wallet.net_tao > 0;
  const isNetSeller = wallet.net_tao < 0;
  const netColor    = isNetBuyer ? "text-emerald-400" : isNetSeller ? "text-red-400" : "text-gray-500";

  return (
    <div
      className={`group relative flex items-center gap-3 px-4 py-3.5 border-b border-gray-800/30 transition-all duration-150 cursor-pointer
        ${tracked ? "bg-blue-950/20 border-l-2 border-l-blue-500/60 pl-3.5" : "hover:bg-white/[0.02] border-l-2 border-l-transparent"}`}
      onClick={() => router.push(`/wallettracker/${wallet.address}?from=${fromTab}`)}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-gradient-to-r from-cyan-500/[0.03] to-transparent" />

      <div className="w-7 flex items-center justify-center flex-shrink-0 hidden sm:flex">
        <RankBadge rank={rank} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {wallet.emoji && <span className="text-sm leading-none">{wallet.emoji}</span>}
          {wallet.label && <LabelChip label={wallet.label} category={wallet.category} />}
          <span className="font-mono text-xs text-gray-400 group-hover:text-gray-200 transition-colors">
            {shortAddr(wallet.address)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`text-[10px] font-bold ${wallet.last_action === "stake" ? "text-emerald-400" : "text-red-400"}`}>
            {wallet.last_action === "stake" ? "▲" : "▼"} {wallet.last_action === "stake" ? "STAKED" : "UNSTAKED"}
          </span>
          {wallet.last_netuid != null && <span className="text-[10px] text-gray-600">SN{wallet.last_netuid}</span>}
          <span className="text-[10px] text-gray-500 tabular-nums">{fmtTao(wallet.last_amount)}</span>
          <span className="text-[10px] text-gray-700">·</span>
          <span className="text-[10px] text-gray-600">{timeAgo(wallet.last_ts)}</span>
          {wallet.active_subnets.length > 1 && (
            <span className="text-[10px] text-cyan-500 bg-cyan-500/10 px-1.5 py-0.5 rounded-md border border-cyan-500/20">
              {wallet.active_subnets.length} subnets
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="text-right hidden sm:block">
          <div className={`text-sm font-semibold tabular-nums ${netColor}`}>
            {isNetBuyer ? "+" : ""}{fmtTao(Math.abs(wallet.net_tao))} net
          </div>
          <div className="text-[10px] text-gray-600 tabular-nums">{wallet.move_count} move{wallet.move_count !== 1 ? "s" : ""}</div>
        </div>
        <svg className="w-3.5 h-3.5 text-gray-700 group-hover:text-gray-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <TrackButton tracked={tracked} onToggle={() => onToggleTrack(wallet.address)} />
      </div>
    </div>
  );
}

// ── Loading Skeleton Rows ─────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-800/30 animate-pulse">
          <div className="w-7 hidden sm:block">
            <div className="h-3 w-6 bg-gray-800/80 rounded mx-auto" />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-36 bg-gray-800/80 rounded" />
            <div className="h-2.5 w-20 bg-gray-800/50 rounded" />
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1">
            <div className="h-3 w-16 bg-gray-800/80 rounded" />
            <div className="h-2 w-10 bg-gray-800/50 rounded" />
          </div>
          <div className="w-8 h-8 rounded-full bg-gray-800/60" />
        </div>
      ))}
    </>
  );
}

// ── Tab config ────────────────────────────────────────────────────
const TAB_CONFIG = [
  {
    key: "top"     as TabKey,
    label: "🎯 Top Wallets",
    info: "Biggest alpha portfolio holders right now — wallets with the most TAO staked across 2+ subnets.",
    accent: "violet",
    activeClass: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  },
  {
    key: "winners" as TabKey,
    label: "🚀 Big Winners",
    info: "Who made the most TAO in the last 24h. Useful for spotting wallets riding current momentum.",
    accent: "emerald",
    activeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  {
    key: "sr"      as TabKey,
    label: "🐋 Active Movers",
    info: "Wallets actively staking or unstaking right now. Great for seeing what's being bought or sold in real time.",
    accent: "cyan",
    activeClass: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  },
  {
    key: "ts"      as TabKey,
    label: "📊 Big Deployers",
    info: "Wallets that deployed the most capital into alpha subnets over the last 30 days — the biggest committed buyers.",
    accent: "purple",
    activeClass: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  },
  {
    key: "known"   as TabKey,
    label: "👑 Known",
    info: "Labelled wallets belonging to known founders, teams, or notable figures in the Bittensor ecosystem.",
    accent: "amber",
    activeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
];

// ── Main Page ─────────────────────────────────────────────────────
export default function WalletTrackerPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [wallets,   setWallets]   = useState<WalletEntry[]>([]);
  const [winners,   setWinners]   = useState<WinnerEntry[]>([]);
  const [srWhales,  setSrWhales]  = useState<SRWhaleWallet[]>([]);
  const [tsWhales,  setTsWhales]  = useState<TSWhaleWallet[]>([]);

  const [updatedAt,    setUpdatedAt]    = useState("");
  const [winUpdatedAt, setWinUpdatedAt] = useState("");
  const [srUpdatedAt,  setSrUpdatedAt]  = useState("");
  const [tsUpdatedAt,  setTsUpdatedAt]  = useState("");

  const [loading,    setLoading]    = useState(true);
  const [winLoading, setWinLoading] = useState(false);
  const [winLoaded,  setWinLoaded]  = useState(false);
  const [srLoading,  setSrLoading]  = useState(false);
  const [srLoaded,   setSrLoaded]   = useState(false);
  const [tsLoading,  setTsLoading]  = useState(false);
  const [tsLoaded,   setTsLoaded]   = useState(false);

  const [error,    setError]    = useState<string | null>(null);
  const [winError, setWinError] = useState<string | null>(null);
  const [srError,  setSrError]  = useState<string | null>(null);
  const [tsError,  setTsError]  = useState<string | null>(null);

  const [tracked, setTracked] = useState<Set<string>>(new Set());
  const [tab,     setTab]     = useState<TabKey>("top");
  const [search,  setSearch]  = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as TabKey | null;
    const valid = new Set<TabKey>(["top", "winners", "sr", "ts", "known", "tracked"]);
    if (t && valid.has(t)) setTab(t);
  }, []);

  function changeTab(t: TabKey) {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url.toString());
  }

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

  useEffect(() => {
    if (tab !== "winners" || winLoaded || winLoading) return;
    setWinLoading(true);
    fetch("/api/wallet-tracker?mode=winners")
      .then(r => r.json())
      .then((d: { winners?: WinnerEntry[]; error?: string; updatedAt?: string }) => {
        if (d.error) { setWinError(d.error); return; }
        setWinners(d.winners ?? []); setWinUpdatedAt(d.updatedAt ?? ""); setWinLoaded(true);
      })
      .catch(e => setWinError(String(e)))
      .finally(() => setWinLoading(false));
  }, [tab, winLoaded, winLoading]);

  useEffect(() => {
    if (tab !== "ts" || tsLoaded || tsLoading) return;
    setTsLoading(true);
    fetch("/api/wallet-tracker?mode=taostats-whales")
      .then(r => r.json())
      .then((d: { whales?: TSWhaleWallet[]; error?: string; updatedAt?: string }) => {
        if (d.error) { setTsError(d.error); return; }
        setTsWhales(d.whales ?? []); setTsUpdatedAt(d.updatedAt ?? ""); setTsLoaded(true);
      })
      .catch(e => setTsError(String(e)))
      .finally(() => setTsLoading(false));
  }, [tab, tsLoaded, tsLoading]);

  useEffect(() => {
    if (tab !== "sr" || srLoaded || srLoading) return;
    setSrLoading(true);
    fetch("/api/wallet-tracker?mode=sr-whales")
      .then(r => r.json())
      .then((d: { whales?: SRWhaleWallet[]; error?: string; updatedAt?: string }) => {
        if (d.error) { setSrError(d.error); return; }
        setSrWhales(d.whales ?? []); setSrUpdatedAt(d.updatedAt ?? ""); setSrLoaded(true);
      })
      .catch(e => setSrError(String(e)))
      .finally(() => setSrLoading(false));
  }, [tab, srLoaded, srLoading]);

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

  const subnetSearchName = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || q.length < 2) return "";
    const matchesSubnet = wallets.some(w => w.positions?.some(p => p.name.toLowerCase().includes(q)));
    const matchesWallet = wallets.some(w => w.address.toLowerCase().includes(q) || w.label?.toLowerCase().includes(q));
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
    return winners.filter(w => w.address.toLowerCase().includes(q) || w.label?.toLowerCase().includes(q));
  }, [winners, search]);

  const displaySRWhales = useMemo(() => {
    if (!search.trim()) return srWhales;
    const q = search.toLowerCase();
    return srWhales.filter(w => w.address.toLowerCase().includes(q) || w.label?.toLowerCase().includes(q));
  }, [srWhales, search]);

  const displayTSWhales = useMemo(() => {
    if (!search.trim()) return tsWhales;
    const q = search.toLowerCase();
    return tsWhales.filter(w => w.address.toLowerCase().includes(q) || w.label?.toLowerCase().includes(q));
  }, [tsWhales, search]);

  const tabIsLoading =
    loading ||
    (tab === "winners" && winLoading) ||
    (tab === "sr" && srLoading) ||
    (tab === "ts" && tsLoading);

  const activeTabConfig = TAB_CONFIG.find(t => t.key === tab);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <main className="flex-1 overflow-auto">
      {/* ── Hero header ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-gray-800/60 bg-gray-950">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(139,92,246,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.6) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Glow orbs */}
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -top-10 right-1/4 w-48 h-48 rounded-full bg-cyan-500/8 blur-3xl pointer-events-none" />

        <div className="relative max-w-[1400px] mx-auto px-4 md:px-8 py-7">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              {/* Badge row */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                  Live · Whale Radar
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400/80 border border-amber-500/20 uppercase tracking-wide">
                  Alpha Intelligence
                </span>
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                  Whale Tracker
                </span>
              </h1>
              <p className="text-sm text-gray-500 mt-1.5 max-w-lg">
                Top TAO wallets actively holding alpha tokens across 2+ subnets — updated every 45 min.
              </p>
            </div>

            {/* Quick stats */}
            {!loading && !error && (
              <div className="flex gap-2.5 sm:gap-3 flex-shrink-0">
                {[
                  { label: "Wallets", value: wallets.length.toString(), icon: "👛", color: "violet" },
                  { label: "Avg tokens", value: wallets.length > 0 ? (wallets.reduce((s, w) => s + w.alpha_count, 0) / wallets.length).toFixed(1) : "—", icon: "⚡", color: "cyan" },
                  { label: "Tracking", value: trackedCount.toString(), icon: "🔔", color: "blue" },
                ].map(({ label, value, icon, color }) => (
                  <div key={label}
                    className={`bg-gray-900/60 border rounded-xl px-3.5 py-2.5 text-center min-w-[72px] backdrop-blur-sm ${
                      color === "violet" ? "border-violet-500/20" :
                      color === "cyan"   ? "border-cyan-500/20" :
                      "border-blue-500/20"
                    }`}>
                    <div className="text-base mb-0.5">{icon}</div>
                    <div className={`text-lg font-black tabular-nums ${
                      color === "violet" ? "text-violet-300" :
                      color === "cyan"   ? "text-cyan-300" :
                      "text-blue-300"
                    }`}>{value}</div>
                    <div className="text-[9px] text-gray-600 uppercase tracking-wide font-semibold mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search bar */}
          <div className="mt-5">
            <AddWalletInput fromTab={tab} />
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-5 space-y-4">
        {/* Telegram alerts */}
        {session?.user && (
          <AlertSettingsPanel trackedWallets={[...tracked]} />
        )}

        {/* Tab bar + search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Tabs */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 flex-1">
            <div className="flex gap-1 w-max">
              {([
                ...TAB_CONFIG,
                {
                  key: "tracked" as TabKey,
                  label: `🔔 Tracked${trackedCount > 0 ? ` (${trackedCount})` : ""}`,
                  info: "Wallets you're personally tracking. Click the 🔔 bell on any wallet to add it here.",
                  accent: "blue",
                  activeClass: "bg-blue-500/15 text-blue-300 border-blue-500/30",
                },
              ]).map(t => (
                <div key={t.key} className="relative flex-shrink-0 group/tab">
                  <button
                    onClick={() => changeTab(t.key)}
                    className={`whitespace-nowrap px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all duration-150 ${
                      tab === t.key
                        ? t.activeClass
                        : "border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
                    }`}
                  >
                    {t.label}
                  </button>
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 z-50 opacity-0 group-hover/tab:opacity-100 transition-opacity duration-150">
                    <div className="bg-gray-900 border border-gray-700/60 rounded-xl px-3.5 py-2.5 text-[11px] text-gray-300 leading-snug shadow-2xl backdrop-blur-sm">
                      {t.info}
                    </div>
                    <div className="w-2 h-2 bg-gray-900 border-r border-b border-gray-700/60 rotate-45 mx-auto -mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="relative flex-shrink-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === "top" ? "Search subnet, wallet…" : "Search address…"}
              className="bg-gray-900/60 border border-gray-700/50 rounded-xl pl-8 pr-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600/80 w-full sm:w-48 transition-colors"
            />
          </div>
        </div>

        {/* Subnet filter banner */}
        {!loading && !error && tab !== "winners" && subnetSearchName && displayWallets.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-950/30 border border-emerald-800/30 rounded-xl">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">🔍 Subnet filter</span>
            <span className="text-gray-700 text-[10px]">—</span>
            <span className="text-[10px] text-emerald-300">
              {displayWallets.length} wallet{displayWallets.length !== 1 ? "s" : ""} holding{" "}
              <strong>{displayWallets[0]?.positions?.find(p => p.name.toLowerCase().includes(subnetSearchName))?.name ?? search.trim()}</strong>
              , sorted by largest position
            </span>
          </div>
        )}

        {/* Main list card */}
        <div className="bg-gray-950/60 border border-gray-800/50 rounded-2xl overflow-hidden backdrop-blur-sm">
          {/* Column header */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/50 bg-gray-900/40">
            <div className="w-7 hidden sm:block" />
            <div className="flex-1 text-[9px] font-bold text-gray-600 uppercase tracking-widest">Wallet</div>
            {tab === "winners" && <div className="hidden sm:block text-right w-28 text-[9px] font-bold text-emerald-700/70 uppercase tracking-widest">24h Gain</div>}
            {tab === "sr"      && <div className="hidden sm:block text-right w-28 text-[9px] font-bold text-cyan-700/70 uppercase tracking-widest">Net TAO</div>}
            {tab === "ts"      && <div className="hidden sm:block text-right w-28 text-[9px] font-bold text-purple-700/70 uppercase tracking-widest">Net USD</div>}
            {tab !== "winners" && tab !== "sr" && tab !== "ts" && (
              <div className="hidden sm:block text-right w-28 text-[9px] font-bold text-gray-600 uppercase tracking-widest">Total TAO</div>
            )}
            <div className="w-8" />
          </div>

          {/* Loading skeleton */}
          {tabIsLoading && <SkeletonRows />}

          {/* Errors */}
          {error && !loading && (
            <div className="py-10 px-6 text-center">
              <div className="text-2xl mb-2">⚠️</div>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          {winError && tab === "winners" && (
            <div className="py-10 px-6 text-center">
              <p className="text-red-400 text-sm">{winError}</p>
            </div>
          )}
          {srError && tab === "sr" && (
            <div className="py-10 px-6 text-center">
              <p className="text-red-400 text-sm">{srError}</p>
            </div>
          )}
          {tsError && tab === "ts" && (
            <div className="py-10 px-6 text-center">
              <p className="text-red-400 text-sm">{tsError}</p>
            </div>
          )}

          {/* Empty states */}
          {!tabIsLoading && !error && tab !== "winners" && tab !== "sr" && tab !== "ts" && displayWallets.length === 0 && (
            <div className="py-16 text-center">
              <div className="text-3xl mb-3">{tab === "tracked" ? "🔔" : "🔍"}</div>
              <p className="text-gray-500 text-sm font-medium">
                {tab === "tracked" ? "No wallets tracked yet" : "No wallets found"}
              </p>
              {tab === "tracked" && (
                <p className="text-gray-600 text-xs mt-1">Click the 🔔 bell next to any wallet to start tracking</p>
              )}
            </div>
          )}
          {!tabIsLoading && !srError && tab === "sr" && displaySRWhales.length === 0 && srLoaded && (
            <div className="py-16 text-center text-gray-600 text-sm">No whale data available.</div>
          )}

          {/* Top / Known / Tracked */}
          {!tabIsLoading && !error && tab !== "winners" && tab !== "sr" && tab !== "ts" && displayWallets.map(wallet => (
            <WalletRow
              key={wallet.address}
              wallet={wallet}
              tracked={tracked.has(wallet.address)}
              onToggleTrack={toggleTrack}
              highlightName={subnetSearchName || undefined}
              fromTab={tab}
            />
          ))}

          {/* Winners */}
          {tab === "winners" && !winLoading && !winError && displayWinners.map(wallet => (
            <WinnerRow
              key={wallet.address}
              wallet={wallet}
              tracked={tracked.has(wallet.address)}
              onToggleTrack={toggleTrack}
              fromTab={tab}
            />
          ))}

          {/* SR Whales */}
          {tab === "sr" && !srLoading && !srError && displaySRWhales.map((wallet, i) => (
            <SRWhaleRow
              key={wallet.address}
              wallet={wallet}
              rank={i + 1}
              tracked={tracked.has(wallet.address)}
              onToggleTrack={toggleTrack}
              fromTab={tab}
            />
          ))}

          {/* TaoStats Whales */}
          {tab === "ts" && !tsLoading && !tsError && displayTSWhales.map((wallet, i) => (
            <TSWhaleRow
              key={wallet.address}
              wallet={wallet}
              rank={i + 1}
              tracked={tracked.has(wallet.address)}
              onToggleTrack={toggleTrack}
              fromTab={tab}
            />
          ))}
        </div>

        {/* Footer hints */}
        {!loading && !error && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[10px] text-gray-700 px-1 pb-2">
            <span>🐋 Holding ≥2 alpha tokens · refreshes every 45 min</span>
            <span>💡 Click any row to view full wallet profile</span>
            <span>🔔 Tracking is saved locally in your browser</span>
            {session?.user && <span className="text-violet-700/60">🔒 Alerts are private to your account</span>}
          </div>
        )}
      </div>
    </main>
  );
}
