"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import SubnetLogo from "@/components/dashboard/SubnetLogo";

// ── Types ─────────────────────────────────────────────────────────
interface AlphaPosition {
  netuid:     number;
  name:       string;
  staked_tao: number;
  staked_usd: number;
}

interface TradeEntry {
  action:      "DELEGATE" | "UNDELEGATE";
  netuid:      number | null;
  subnet_name: string;
  amount_tao:  number;
  amount_usd:  number;
  timestamp:   string;
}

interface WalletProfile {
  address:        string;
  label?:         string;
  emoji?:         string;
  category?:      string;
  is_known:       boolean;
  total_tao:      number;
  free_tao:       number;
  staked_tao:     number;
  total_usd:      number;
  alpha_count:    number;
  tao_price:      number;
  // P&L
  total_pnl:      number;
  realized_pnl:   number;
  unrealized_pnl: number;
  roi_pct:        number | null;
  avg_hold_days:  number | null;
  positions:      AlphaPosition[];
  trades:         TradeEntry[];
  trades_failed?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────
function shortAddr(addr: string) {
  return addr.length < 12 ? addr : `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}
function fmtTao(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M τ`;
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(1)}K τ`;
  return `${sign}${abs.toFixed(1)} τ`;
}
function fmtTaoSigned(n: number) {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M τ`;
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(1)}K τ`;
  return `${sign}${abs.toFixed(1)} τ`;
}
function fmtUsd(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

// ── Metric tile (compact, dashboard-style) ────────────────────────
function Tile({
  label, value, sub, color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "green" | "red" | "white" | "indigo" | "violet" | "cyan";
}) {
  const valueClass =
    color === "green"  ? "text-green-400" :
    color === "red"    ? "text-red-400"   :
    color === "indigo" ? "text-indigo-300" :
    color === "violet" ? "text-violet-300" :
    color === "cyan"   ? "text-cyan-300"  :
    "text-white";

  return (
    <div className="bg-[#111318] border border-gray-800/80 rounded-xl px-4 py-3 flex flex-col gap-0.5">
      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{label}</div>
      <div className={`text-base sm:text-lg font-bold tabular-nums leading-tight ${valueClass}`}>{value}</div>
      {sub && <div className="text-sm font-medium text-white tabular-nums">{sub}</div>}
    </div>
  );
}

// ── Bell Button ───────────────────────────────────────────────────
function BellButton({ address }: { address: string }) {
  const [tracked, setTracked] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem("alphagap_tracked_wallets");
      if (s) setTracked((JSON.parse(s) as string[]).includes(address));
    } catch { /* ignore */ }
  }, [address]);

  function toggle() {
    setTracked(prev => {
      const next = !prev;
      try {
        const arr = JSON.parse(localStorage.getItem("alphagap_tracked_wallets") ?? "[]") as string[];
        if (next) { if (!arr.includes(address)) arr.push(address); }
        else { const i = arr.indexOf(address); if (i !== -1) arr.splice(i, 1); }
        localStorage.setItem("alphagap_tracked_wallets", JSON.stringify(arr));
      } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <button
      onClick={toggle}
      title={tracked ? "Untrack this wallet" : "Track this wallet"}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
        tracked
          ? "bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30"
          : "bg-gray-800/60 text-gray-400 border-gray-700/60 hover:bg-blue-500/15 hover:text-blue-400 hover:border-blue-500/30"
      }`}
    >
      {tracked ? (
        <>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a3 3 0 01-2.83-2h5.66A3 3 0 0110 18z" />
          </svg>
          Tracking
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Track Wallet
        </>
      )}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function WalletProfilePage() {
  const params   = useParams<{ address: string }>();
  const address  = params?.address ?? "";
  const [backHref, setBackHref] = useState("/wallettracker");

  // Client-only: read ?from= without useSearchParams (avoids Suspense requirement)
  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get("from") ?? "top";
    setBackHref(`/wallettracker?tab=${from}`);
  }, []);

  const [profile,        setProfile]        = useState<WalletProfile | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [copied,         setCopied]         = useState(false);
  const [tradesRetrying, setTradesRetrying] = useState(false);

  const load = useCallback(() => {
    if (!address) return;
    setLoading(true);
    setError(null);
    fetch(`/api/wallet-tracker?mode=wallet-profile&address=${encodeURIComponent(address)}`)
      .then(r => r.json())
      .then((d: WalletProfile & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setProfile(d);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [address]);

  useEffect(() => { load(); }, [load]);

  const retryTrades = useCallback(() => {
    if (!address || tradesRetrying) return;
    setTradesRetrying(true);
    fetch(`/api/wallet-tracker?mode=wallet-trades&address=${encodeURIComponent(address)}`)
      .then(r => r.json())
      .then((d: { trades?: TradeEntry[]; error?: string }) => {
        if (d.trades && d.trades.length >= 0) {
          setProfile(prev => prev ? { ...prev, trades: d.trades!, trades_failed: false } : prev);
        }
      })
      .catch(() => { /* leave trades_failed as-is */ })
      .finally(() => setTradesRetrying(false));
  }, [address, tradesRetrying]);

  function copyAddress() {
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) return (
    <main className="flex-1 overflow-auto p-4 md:p-8 max-w-[1100px] mx-auto w-full">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-300 mb-8">
        ← Whale Radar
      </Link>
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-6 h-6 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading wallet profile…</p>
      </div>
    </main>
  );

  if (error) return (
    <main className="flex-1 overflow-auto p-4 md:p-8 max-w-[1100px] mx-auto w-full">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-300 mb-8">
        ← Whale Radar
      </Link>
      <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-8 text-center space-y-3">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={load} className="text-xs text-gray-500 hover:text-gray-300 underline">Retry</button>
      </div>
    </main>
  );

  if (!profile) return null;

  const totalStakedUsd = profile.positions.reduce((s, p) => s + p.staked_usd, 0);
  const freeUsd        = Math.round(profile.free_tao * profile.tao_price * 100) / 100;
  const pnlColor       = (n: number) => n > 0 ? "green" : n < 0 ? "red" : "white";

  return (
    <main className="flex-1 overflow-auto p-4 md:p-8 max-w-[1100px] mx-auto w-full space-y-6">

      {/* ── Back nav ─────────────────────────────────────────────── */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-300 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Whale Radar
      </Link>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1.5 min-w-0">
          {(profile.label || profile.emoji) && (
            <div className="flex items-center gap-2">
              {profile.emoji && <span className="text-xl leading-none">{profile.emoji}</span>}
              {profile.label && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  profile.category === "founder"
                    ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                    : "bg-purple-500/15 text-purple-400 border-purple-500/30"
                }`}>{profile.label}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-mono text-base font-semibold text-white">{shortAddr(address)}</h1>
            <button
              onClick={copyAddress}
              className="text-[10px] text-gray-600 hover:text-gray-300 px-2 py-0.5 rounded bg-gray-800/60 border border-gray-700/50 transition-colors"
            >
              {copied ? "✓ copied" : "⎘ copy"}
            </button>
          </div>
          <p className="font-mono text-[9px] text-gray-700 break-all">{address}</p>
        </div>
        <BellButton address={address} />
      </div>

      {/* ── Row 1: Portfolio overview ────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <Tile
          label="Total Holdings"
          value={fmtTao(profile.total_tao)}
          sub={fmtUsd(profile.total_usd)}
          color="white"
        />
        <Tile
          label="Staked"
          value={fmtTao(profile.staked_tao)}
          sub={totalStakedUsd > 0 ? fmtUsd(totalStakedUsd) : undefined}
          color="indigo"
        />
        <Tile
          label="Free Balance"
          value={fmtTao(profile.free_tao)}
          sub={freeUsd > 0 ? fmtUsd(freeUsd) : undefined}
          color="white"
        />
        <Tile
          label="Total P&L"
          value={fmtTaoSigned(profile.total_pnl)}
          sub={profile.tao_price > 0 ? `${profile.total_pnl >= 0 ? "+" : ""}${fmtUsd(profile.total_pnl * profile.tao_price)}` : undefined}
          color={pnlColor(profile.total_pnl) as "green" | "red" | "white"}
        />
        <Tile
          label="ROI"
          value={profile.roi_pct != null
            ? `${profile.roi_pct >= 0 ? "+" : ""}${profile.roi_pct.toFixed(2)}%`
            : "—"}
          color={profile.roi_pct != null ? pnlColor(profile.roi_pct) as "green" | "red" | "white" : "white"}
        />
      </div>

      {/* ── Row 2: P&L breakdown ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile
          label="Unrealized P&L"
          value={fmtTaoSigned(profile.unrealized_pnl)}
          color={pnlColor(profile.unrealized_pnl) as "green" | "red" | "white"}
        />
        <Tile
          label="Realized P&L"
          value={fmtTaoSigned(profile.realized_pnl)}
          color={pnlColor(profile.realized_pnl) as "green" | "red" | "white"}
        />
        <Tile
          label="Avg Hold"
          value={profile.avg_hold_days != null
            ? profile.avg_hold_days >= 1
              ? `${profile.avg_hold_days.toFixed(1)}d`
              : `${Math.round(profile.avg_hold_days * 24)}h`
            : "—"}
          color="cyan"
        />
      </div>

      {/* ── Holdings table ───────────────────────────────────────── */}
      {profile.positions.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">Portfolio</h2>
            <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
              {profile.positions.length} token{profile.positions.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="bg-[#111318] border border-gray-800/80 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[2rem_1fr_auto_auto] sm:grid-cols-[2rem_1fr_auto_auto_auto] items-center gap-3 px-4 py-2.5 border-b border-gray-800 text-[9px] font-bold uppercase tracking-widest text-gray-600">
              <div>#</div>
              <div>Asset</div>
              <div className="text-right w-24">Amount</div>
              <div className="hidden sm:block text-right w-16">USD</div>
              <div className="text-right w-16">Alloc</div>
            </div>

            {profile.positions.map((pos, i) => {
              const pct = profile.staked_tao > 0 ? (pos.staked_tao / profile.staked_tao) * 100 : 0;
              return (
                <div
                  key={pos.netuid}
                  className="grid grid-cols-[2rem_1fr_auto_auto] sm:grid-cols-[2rem_1fr_auto_auto_auto] items-center gap-3 px-4 py-3 border-b border-gray-800/40 last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Rank */}
                  <div className="text-[10px] text-gray-700 tabular-nums">{i + 1}</div>

                  {/* Asset */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <SubnetLogo netuid={pos.netuid} name={pos.name} size={24} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-gray-600 font-mono">SN{pos.netuid}</span>
                        <span className="text-xs font-semibold text-white truncate">{pos.name}</span>
                      </div>
                      {/* Mini bar */}
                      <div className="mt-1 h-[3px] w-16 sm:w-24 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500/70 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right w-24">
                    <div className="text-sm font-semibold text-indigo-300 tabular-nums">{fmtTao(pos.staked_tao)}</div>
                  </div>

                  {/* USD */}
                  <div className="hidden sm:block text-right w-16">
                    <div className="text-xs text-gray-500 tabular-nums">{pos.staked_usd > 0 ? fmtUsd(pos.staked_usd) : "—"}</div>
                  </div>

                  {/* Allocation */}
                  <div className="text-right w-16">
                    <div className="text-xs text-gray-400 tabular-nums font-medium">{pct.toFixed(1)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Recent Trades table ──────────────────────────────────── */}
      {(profile.trades.length > 0 || profile.trades_failed) && (
        <section className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">Recent Trades</h2>
            {profile.trades_failed && (
              <button
                onClick={retryTrades}
                disabled={tradesRetrying}
                className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {tradesRetrying ? (
                  <>
                    <span className="w-2.5 h-2.5 border border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>
                    ↺ Retry
                  </>
                )}
              </button>
            )}
          </div>

          {profile.trades_failed && !tradesRetrying ? (
            <div className="bg-[#111318] border border-gray-800/80 rounded-xl px-6 py-10 flex flex-col items-center gap-3 text-center">
              <svg className="w-8 h-8 text-amber-500/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-gray-500">Trade history couldn&apos;t be loaded right now.</p>
              <button
                onClick={retryTrades}
                className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
              >
                Try again
              </button>
            </div>
          ) : profile.trades.length > 0 && (
            <div className="bg-[#111318] border border-gray-800/80 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[5rem_1fr_auto] sm:grid-cols-[5rem_1fr_auto_auto] items-center gap-3 px-4 py-2.5 border-b border-gray-800 text-[9px] font-bold uppercase tracking-widest text-gray-600">
                <div>Action</div>
                <div>Subnet</div>
                <div className="text-right w-24">Amount</div>
                <div className="hidden sm:block text-right w-14">When</div>
              </div>

              {profile.trades.map((trade, i) => {
                const isBuy = trade.action === "DELEGATE";
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[5rem_1fr_auto] sm:grid-cols-[5rem_1fr_auto_auto] items-center gap-3 px-4 py-2.5 border-b border-gray-800/40 last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Badge */}
                    <div className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-md w-fit ${
                      isBuy
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}>
                      {isBuy ? "▲" : "▼"} {isBuy ? "STAKE" : "UNSTAKE"}
                    </div>

                    {/* Subnet */}
                    <div className="flex items-center gap-2 min-w-0">
                      {trade.netuid != null && trade.netuid > 0 && (
                        <SubnetLogo netuid={trade.netuid} name={trade.subnet_name} size={16} />
                      )}
                      <span className="text-[9px] text-gray-600 font-mono flex-shrink-0">SN{trade.netuid ?? "—"}</span>
                      <span className="text-xs text-gray-300 truncate">{trade.subnet_name}</span>
                    </div>

                    {/* Amount */}
                    <div className="text-right w-24">
                      <div className={`text-xs font-semibold tabular-nums ${isBuy ? "text-green-400" : "text-red-400"}`}>
                        {fmtTao(trade.amount_tao)}
                      </div>
                      {trade.amount_usd > 0 && (
                        <div className="text-[10px] text-gray-600 tabular-nums">{fmtUsd(trade.amount_usd)}</div>
                      )}
                    </div>

                    {/* Time */}
                    <div className="hidden sm:block text-right w-14 text-[10px] text-gray-600 tabular-nums">
                      {timeAgo(trade.timestamp)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Empty */}
      {profile.positions.length === 0 && (
        <div className="bg-[#111318] border border-gray-800/80 rounded-xl py-16 text-center">
          <p className="text-gray-600 text-sm">No alpha positions found for this wallet.</p>
        </div>
      )}

      <div className="text-[10px] text-gray-700 pb-4">
        P&L calculated from on-chain delegation history (FIFO) · Amounts in TAO-equivalent · Based on available history
      </div>
    </main>
  );
}
