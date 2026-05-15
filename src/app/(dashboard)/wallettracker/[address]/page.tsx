"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
  address:     string;
  label?:      string;
  emoji?:      string;
  category?:   string;
  is_known:    boolean;
  total_tao:   number;
  free_tao:    number;
  staked_tao:  number;
  total_usd:   number;
  alpha_count: number;
  tao_price:   number;
  positions:   AlphaPosition[];
  trades:      TradeEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────
function shortAddr(addr: string) {
  return addr.length < 12 ? addr : `${addr.slice(0, 8)}…${addr.slice(-6)}`;
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
function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

// ── Stat Card ─────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: {
  label:   string;
  value:   string;
  sub?:    string;
  accent?: string;
}) {
  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 flex flex-col gap-1">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${accent ?? "text-white"}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 tabular-nums">{sub}</div>}
    </div>
  );
}

// ── Bell Button ───────────────────────────────────────────────────
function BellButton({ address }: { address: string }) {
  const [tracked, setTracked] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem("alphagap_tracked_wallets");
      if (s) {
        const arr = JSON.parse(s) as string[];
        setTracked(arr.includes(address));
      }
    } catch { /* ignore */ }
  }, [address]);

  function toggle() {
    setTracked(prev => {
      const next = !prev;
      try {
        const s   = localStorage.getItem("alphagap_tracked_wallets");
        const arr = s ? (JSON.parse(s) as string[]) : [];
        if (next) {
          if (!arr.includes(address)) arr.push(address);
        } else {
          const i = arr.indexOf(address);
          if (i !== -1) arr.splice(i, 1);
        }
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
  const params  = useParams<{ address: string }>();
  const router  = useRouter();
  const address = params?.address ?? "";

  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [copied,  setCopied]  = useState(false);

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

  function copyAddress() {
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // ── Loading skeleton ──
  if (loading) {
    return (
      <main className="flex-1 overflow-auto p-4 md:p-8 max-w-[1100px] mx-auto w-full">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/wallettracker" className="text-gray-600 hover:text-gray-300 transition-colors text-sm flex items-center gap-1">
            ← Whale Radar
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-6 h-6 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading wallet profile…</p>
        </div>
      </main>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <main className="flex-1 overflow-auto p-4 md:p-8 max-w-[1100px] mx-auto w-full">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/wallettracker" className="text-gray-600 hover:text-gray-300 transition-colors text-sm">
            ← Whale Radar
          </Link>
        </div>
        <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-8 text-center">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={load} className="mt-4 text-xs text-gray-500 hover:text-gray-300 underline">
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!profile) return null;

  const totalStakedUsd  = profile.positions.reduce((s, p) => s + p.staked_usd, 0);
  const freeUsd         = Math.round(profile.free_tao * profile.tao_price * 100) / 100;

  return (
    <main className="flex-1 overflow-auto p-4 md:p-8 max-w-[1100px] mx-auto w-full space-y-6">

      {/* ── Back nav ─────────────────────────────────────────────── */}
      <div>
        <Link
          href="/wallettracker"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Whale Radar
        </Link>
      </div>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2 min-w-0">
          {/* Label + emoji */}
          {(profile.label || profile.emoji) && (
            <div className="flex items-center gap-2">
              {profile.emoji && <span className="text-2xl leading-none">{profile.emoji}</span>}
              {profile.label && (
                <span className={`text-sm font-bold px-2.5 py-1 rounded-full border ${
                  profile.category === "founder"
                    ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                    : "bg-purple-500/15 text-purple-400 border-purple-500/30"
                }`}>
                  {profile.label}
                </span>
              )}
            </div>
          )}

          {/* Address row */}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-mono text-lg font-semibold text-white tracking-tight">
              {shortAddr(address)}
            </h1>
            <button
              onClick={copyAddress}
              className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-300 transition-colors px-2 py-0.5 rounded bg-gray-800/60 border border-gray-700/50"
            >
              {copied ? "✓ copied" : "⎘ copy full"}
            </button>
          </div>

          {/* Full address dimmed */}
          <p className="font-mono text-[10px] text-gray-700 break-all leading-relaxed">
            {address}
          </p>
        </div>

        {/* Track bell */}
        <BellButton address={address} />
      </div>

      {/* ── Stat cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Portfolio"
          value={fmtTao(profile.total_tao)}
          sub={fmtUsd(profile.total_usd)}
          accent="text-white"
        />
        <StatCard
          label="Alpha Staked"
          value={fmtTao(profile.staked_tao)}
          sub={totalStakedUsd > 0 ? fmtUsd(totalStakedUsd) : undefined}
          accent="text-indigo-300"
        />
        <StatCard
          label="Free TAO"
          value={fmtTao(profile.free_tao)}
          sub={freeUsd > 0 ? fmtUsd(freeUsd) : undefined}
          accent="text-gray-300"
        />
        <StatCard
          label="Alpha Tokens"
          value={profile.alpha_count.toString()}
          sub={profile.alpha_count === 1 ? "subnet" : "subnets"}
          accent="text-purple-300"
        />
      </div>

      {/* ── Holdings grid ────────────────────────────────────────── */}
      {profile.positions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">Alpha Holdings</h2>
            <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
              {profile.positions.length} token{profile.positions.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {profile.positions.map(pos => {
              const pct = profile.staked_tao > 0
                ? (pos.staked_tao / profile.staked_tao) * 100
                : 0;
              return (
                <div
                  key={pos.netuid}
                  className="group bg-gray-900/70 border border-gray-800 hover:border-indigo-500/40 rounded-xl p-3.5 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <SubnetLogo netuid={pos.netuid} name={pos.name} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-600 font-mono">SN{pos.netuid}</span>
                        <span className="text-xs font-semibold text-white truncate">{pos.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-bold text-indigo-300 tabular-nums">{fmtTao(pos.staked_tao)}</span>
                        {pos.staked_usd > 0 && (
                          <span className="text-[11px] text-gray-500 tabular-nums">{fmtUsd(pos.staked_usd)}</span>
                        )}
                        <span className="text-[10px] text-gray-600 ml-auto tabular-nums">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                  {/* Allocation bar */}
                  <div className="mt-2.5 h-0.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500/60 rounded-full transition-all"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Recent Activity ───────────────────────────────────────── */}
      {profile.trades.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Recent Activity</h2>

          <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-950/40 text-[10px] text-gray-600 uppercase tracking-wide">
              <div className="w-16">Action</div>
              <div>Subnet</div>
              <div className="text-right w-20">Amount</div>
              <div className="text-right w-14">When</div>
            </div>

            {profile.trades.slice(0, 30).map((trade, i) => {
              const isBuy = trade.action === "DELEGATE";
              return (
                <div
                  key={i}
                  className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-2.5 border-b border-gray-800/40 last:border-0 hover:bg-gray-800/20 transition-colors"
                >
                  {/* Action badge */}
                  <div className={`w-16 text-[10px] font-bold px-2 py-0.5 rounded-full text-center ${
                    isBuy
                      ? "bg-green-500/15 text-green-400 border border-green-500/20"
                      : "bg-red-500/15 text-red-400 border border-red-500/20"
                  }`}>
                    {isBuy ? "▲ STAKE" : "▼ UNSTAKE"}
                  </div>

                  {/* Subnet */}
                  <div className="flex items-center gap-2 min-w-0">
                    {trade.netuid != null && trade.netuid > 0 && (
                      <SubnetLogo netuid={trade.netuid} name={trade.subnet_name} size={16} />
                    )}
                    <span className="text-[10px] text-gray-500 font-mono flex-shrink-0">
                      SN{trade.netuid ?? "—"}
                    </span>
                    <span className="text-xs text-gray-300 truncate">{trade.subnet_name}</span>
                  </div>

                  {/* Amount */}
                  <div className="text-right w-20">
                    <div className={`text-xs font-semibold tabular-nums ${isBuy ? "text-green-400" : "text-red-400"}`}>
                      {fmtTao(trade.amount_tao)}
                    </div>
                    {trade.amount_usd > 0 && (
                      <div className="text-[10px] text-gray-600 tabular-nums">{fmtUsd(trade.amount_usd)}</div>
                    )}
                  </div>

                  {/* Time */}
                  <div className="text-right w-14 text-[10px] text-gray-600 tabular-nums">
                    {timeAgo(trade.timestamp)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {profile.positions.length === 0 && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl py-16 text-center">
          <p className="text-gray-600 text-sm">No alpha positions found for this wallet.</p>
        </div>
      )}

      {/* Footer */}
      <div className="text-[11px] text-gray-700 space-y-1 px-1 pb-4">
        <p>Position data from TaoMarketCap · Trade history from on-chain records · Amounts in TAO-equivalent</p>
        <p>🔔 Tracking is saved locally in your browser.</p>
      </div>
    </main>
  );
}
