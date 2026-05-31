"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SubnetLogo from "@/components/dashboard/SubnetLogo";

// ── Types ─────────────────────────────────────────────────────────

interface Locker {
  coldkey: string;
  hotkey: string;
  lockedAlpha: number;
  unlockedAlpha: number;
  convictionAlpha: number;
  isOwner: boolean;
  lockType: "perpetual" | "decaying";
  lastUpdate: number;
}

interface ConvictionRow {
  netuid: number;
  name: string;
  priceUsd: number;
  totalLockedAlpha: number;
  totalUnlockedAlpha: number;
  totalConvictionAlpha: number;
  ownerCutAutoLock: boolean;
  king: Locker;
  lockers: Locker[];
  agap_score?: number;
  invest_score?: number;
  whale_signal?: string | null;
  emission_pct?: number;
  market_cap?: number;
  agap_signal?: "strong_buy" | "buy" | "watch" | "neutral";
}

interface ConvictionEvent {
  kind: string;
  netuid: number;
  name: string;
  hotkey: string;
  coldkey: string;
  amountAlpha: number;
  deltaAlpha: number;
  observedAtBlock: number;
  t: number;
}

interface ConvictionData {
  rows: ConvictionRow[];
  network: {
    totalLockedAlpha: number;
    totalConvictionAlpha: number;
    totalUnlockedAlpha: number;
    totalLockers: number;
    subnetCount: number;
    ownerLockedAlpha: number;
    decayingAlpha: number;
    decayingPct: number;
  };
  events: ConvictionEvent[];
  topSignals: ConvictionRow[];
  observedAtBlock: number;
  taoPrice: number;
  eurRate: number;
}

// ── Helpers ───────────────────────────────────────────────────────

type Currency = "alpha" | "usd";

function fmtAlpha(v: number, currency: Currency, price: number): string {
  if (currency === "usd") {
    const usd = v * price;
    if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
    if (usd >= 1e3) return `$${(usd / 1e3).toFixed(1)}k`;
    return `$${usd.toFixed(0)}`;
  }
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M α`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k α`;
  return `${v.toFixed(2)} α`;
}

function shortKey(k: string) { return `${k.slice(0, 6)}…${k.slice(-4)}`; }

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function convictionPct(lastUpdateBlock: number, observedAtBlock: number, lockType: "perpetual" | "decaying"): number {
  const blocks = Math.max(0, observedAtBlock - lastUpdateBlock);
  const halfLife = lockType === "perpetual" ? 648000 : 216000;
  return Math.round((1 - Math.exp(-blocks / halfLife)) * 100);
}

// ── Conviction Ring (SVG) ─────────────────────────────────────────

function ConvictionRing({ pct, size = 72 }: { pct: number; size?: number }) {
  const stroke = 4;
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const fill = Math.min(Math.max(pct, 0), 100);
  const dash = (fill / 100) * circ;
  const color = fill >= 70 ? "#4ade80" : fill >= 40 ? "#facc15" : "#374151";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} className="absolute inset-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

// ── Lock type pill ────────────────────────────────────────────────

function LockPill({ type }: { type?: "perpetual" | "decaying" }) {
  if (!type) return null;
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${
      type === "perpetual"
        ? "bg-green-500/10 text-green-400/80 border-green-500/20"
        : "bg-orange-500/10 text-orange-400/80 border-orange-500/20"
    }`}>{type === "perpetual" ? "∞ perp" : "↘ decay"}</span>
  );
}

// ── Signal chip ───────────────────────────────────────────────────

function SignalChip({ signal, row }: { signal?: string; row?: ConvictionRow }) {
  if (!signal || signal === "neutral") return null;
  const cfg = {
    strong_buy: { label: "Strong Buy", cls: "bg-green-500/20 text-green-300 border-green-500/40", icon: "⚡" },
    buy:        { label: "Buy",         cls: "bg-green-500/10 text-green-400/90 border-green-500/25", icon: "↑" },
    watch:      { label: "Watch",       cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25", icon: "◎" },
  }[signal];
  if (!cfg) return null;

  let title = "";
  if (row) {
    const parts: string[] = [];
    if (row.king?.lockType === "perpetual") parts.push("perpetual lock");
    if (row.totalLockedAlpha >= 50000) parts.push(`${(row.totalLockedAlpha / 1000).toFixed(0)}k α locked`);
    if (row.invest_score != null) parts.push(`invest ${row.invest_score}/100`);
    title = parts.join(" · ");
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls} whitespace-nowrap cursor-help`}
      title={title || undefined}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Featured Top-5 card ───────────────────────────────────────────

function FeaturedCard({
  row, rank, currency, taoPrice, observedAtBlock, isFresh,
}: {
  row: ConvictionRow; rank: number; currency: Currency; taoPrice: number;
  observedAtBlock: number; isFresh: boolean;
}) {
  const router = useRouter();
  const cvPct = row.king?.lastUpdate
    ? convictionPct(row.king.lastUpdate, observedAtBlock, row.king?.lockType ?? "perpetual")
    : null;
  const ringSize = 80;

  const glowClass =
    row.agap_signal === "strong_buy" ? "shadow-lg shadow-green-900/30 border-green-500/35" :
    row.agap_signal === "buy"        ? "border-green-500/20" :
    "border-white/6";

  const topBarClass =
    row.agap_signal === "strong_buy" ? "bg-gradient-to-r from-green-400 to-emerald-500" :
    row.agap_signal === "buy"        ? "bg-green-500/40" :
    row.agap_signal === "watch"      ? "bg-yellow-400/30" :
    "bg-white/4";

  return (
    <button
      onClick={() => router.push(`/subnets/${row.netuid}`)}
      className={`flex-shrink-0 w-44 flex flex-col rounded-2xl border overflow-hidden transition-all group text-left bg-[#0d1610] ${glowClass} hover:border-green-500/30 hover:bg-[#101a12]`}
    >
      {/* Top accent line */}
      <div className={`h-[2px] w-full ${topBarClass}`} />

      <div className="p-4 flex flex-col items-center gap-3 flex-1">
        {/* Rank + badges */}
        <div className="flex items-center justify-between w-full">
          <span className={`text-xs font-black ${rank === 1 ? "text-green-400" : rank <= 3 ? "text-gray-400" : "text-gray-600"}`}>
            #{rank}
          </span>
          <div className="flex items-center gap-1">
            {isFresh && (
              <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">NEW</span>
            )}
            {row.king?.isOwner && (
              <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-500/15 text-amber-400/80 border border-amber-500/20">owner</span>
            )}
          </div>
        </div>

        {/* Conviction ring + logo */}
        <div className="relative flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
          {cvPct !== null && <ConvictionRing pct={cvPct} size={ringSize} />}
          <SubnetLogo netuid={row.netuid} name={row.name} size={50} />
          {cvPct !== null && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#0d1610] border border-white/10 rounded-full px-1.5 py-px">
              <span className={`text-[8px] font-bold tabular-nums ${cvPct >= 70 ? "text-green-400" : cvPct >= 40 ? "text-yellow-400" : "text-gray-500"}`}>
                {cvPct}%
              </span>
            </div>
          )}
        </div>

        {/* Name */}
        <div className="text-center">
          <div className="text-sm font-bold text-white group-hover:text-green-300 transition-colors truncate max-w-[160px]">{row.name}</div>
          <div className="text-[10px] text-gray-600 font-mono">SN{row.netuid}</div>
        </div>

        {/* Locked amount */}
        <div className="text-center">
          <div className={`font-black tabular-nums ${rank === 1 ? "text-green-300 text-lg" : "text-green-400 text-base"}`}>
            {fmtAlpha(row.totalLockedAlpha, currency, taoPrice)}
          </div>
          <div className="mt-1"><LockPill type={row.king?.lockType} /></div>
        </div>

        {/* aGap + Invest score pills */}
        <div className="flex gap-1.5 w-full">
          <div className="flex-1 text-center bg-green-500/8 border border-green-500/15 rounded-lg py-1.5">
            <div className={`text-sm font-black ${
              row.agap_score != null && row.agap_score >= 70 ? "text-green-300" :
              row.agap_score != null && row.agap_score >= 50 ? "text-green-400/80" : "text-gray-500"
            }`}>{row.agap_score ?? "—"}</div>
            <div className="text-[8px] text-gray-700 uppercase tracking-widest">aGap</div>
          </div>
          <div className="flex-1 text-center bg-purple-500/8 border border-purple-500/15 rounded-lg py-1.5">
            <div className={`text-sm font-black ${
              row.invest_score != null && row.invest_score >= 70 ? "text-purple-300" :
              row.invest_score != null && row.invest_score >= 50 ? "text-purple-400/80" : "text-gray-500"
            }`}>{row.invest_score ?? "—"}</div>
            <div className="text-[8px] text-gray-700 uppercase tracking-widest">Invest</div>
          </div>
        </div>

        {/* Signal */}
        {row.agap_signal && row.agap_signal !== "neutral" && (
          <SignalChip signal={row.agap_signal} row={row} />
        )}
      </div>
    </button>
  );
}

// ── Leaderboard row ───────────────────────────────────────────────

function LeaderboardRow({
  row, rank, currency, taoPrice, observedAtBlock, expanded, onToggle,
}: {
  row: ConvictionRow; rank: number; currency: Currency; taoPrice: number;
  observedAtBlock: number; expanded: boolean; onToggle: () => void;
}) {
  const router = useRouter();

  const cvPct = row.king?.lastUpdate
    ? convictionPct(row.king.lastUpdate, observedAtBlock, row.king?.lockType ?? "perpetual")
    : null;

  const communityLockers = row.lockers.filter(l => !l.isOwner);
  const communityAlpha = communityLockers.reduce((s, l) => s + l.lockedAlpha, 0);
  const commPct = row.totalLockedAlpha > 0
    ? Math.round((communityAlpha / row.totalLockedAlpha) * 100) : 0;
  const skinPct = row.market_cap && row.market_cap > 0
    ? ((row.totalLockedAlpha * row.priceUsd) / row.market_cap * 100).toFixed(1)
    : null;

  const signalBar = {
    strong_buy: "bg-green-400",
    buy: "bg-green-500/50",
    watch: "bg-yellow-400/60",
    neutral: "bg-white/4",
  }[row.agap_signal ?? "neutral"] ?? "bg-white/4";

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      row.agap_signal === "strong_buy" ? "border-green-500/25 bg-green-950/10" :
      row.agap_signal === "buy"        ? "border-green-500/12 bg-green-950/5" :
      "border-white/5 bg-[#0d1610]/60"
    }`}>
      <button onClick={onToggle} className="w-full flex items-stretch text-left hover:bg-white/[0.02] transition-colors">
        {/* Left signal bar */}
        <div className={`w-[3px] flex-shrink-0 ${signalBar}`} />

        <div className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0">
          {/* Rank */}
          <div className="w-5 flex-shrink-0 text-center">
            <span className={`text-xs font-black tabular-nums ${rank <= 3 ? "text-green-400" : "text-gray-600"}`}>{rank}</span>
          </div>

          {/* Logo + name */}
          <div className="flex items-center gap-2.5 w-40 flex-shrink-0 min-w-0">
            <SubnetLogo netuid={row.netuid} name={row.name} size={32} />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{row.name}</div>
              <div className="text-[10px] text-gray-600 font-mono">SN{row.netuid}</div>
            </div>
          </div>

          {/* Lock type */}
          <div className="hidden sm:flex items-center gap-1.5 w-28 flex-shrink-0">
            <LockPill type={row.king?.lockType} />
            {row.king?.isOwner && <span className="text-[9px] text-amber-500/60">owner</span>}
          </div>

          {/* Locked + maturity bar */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-green-400 tabular-nums">
              {fmtAlpha(row.totalLockedAlpha, currency, taoPrice)}
            </div>
            {cvPct !== null && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${cvPct >= 70 ? "bg-green-400" : cvPct >= 40 ? "bg-yellow-400" : "bg-gray-600"}`}
                    style={{ width: `${cvPct}%` }} />
                </div>
                <span className="text-[9px] text-gray-600 tabular-nums">{cvPct}%</span>
              </div>
            )}
          </div>

          {/* aGap score */}
          <div className="hidden lg:flex flex-col items-center gap-0.5 flex-shrink-0 w-12">
            <span className={`text-sm font-black tabular-nums ${
              row.agap_score != null && row.agap_score >= 70 ? "text-green-300" :
              row.agap_score != null && row.agap_score >= 50 ? "text-green-400/70" : "text-gray-500"
            }`}>{row.agap_score ?? "—"}</span>
            <span className="text-[8px] text-gray-700 uppercase tracking-widest">aGap</span>
          </div>

          {/* Invest score */}
          <div className="hidden lg:flex flex-col items-center gap-0.5 flex-shrink-0 w-12">
            <span className={`text-sm font-black tabular-nums ${
              row.invest_score != null && row.invest_score >= 70 ? "text-purple-300" :
              row.invest_score != null && row.invest_score >= 50 ? "text-purple-400/70" : "text-gray-500"
            }`}>{row.invest_score ?? "—"}</span>
            <span className="text-[8px] text-gray-700 uppercase tracking-widest">Invest</span>
          </div>

          {/* Signal */}
          <div className="hidden md:flex w-28 justify-end flex-shrink-0">
            <SignalChip signal={row.agap_signal} row={row} />
          </div>

          {/* Chevron */}
          <span className={`text-gray-700 text-[9px] flex-shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>▼</span>
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-white/5 bg-black/20">
          {row.lockers.map((locker, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-2.5 border-b border-white/4 last:border-0">
              <div className="flex gap-1.5">
                {locker.isOwner && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400/80 border border-amber-500/20">owner</span>}
                <LockPill type={locker.lockType} />
              </div>
              <div className="flex-1 min-w-0">
                <a href={`https://taostats.io/account/${locker.coldkey}`} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] font-mono text-gray-600 hover:text-green-400 transition-colors truncate block">
                  {shortKey(locker.coldkey)}
                </a>
              </div>
              <div className="text-xs font-bold text-green-400 tabular-nums flex-shrink-0">
                {locker.lockedAlpha >= 1000 ? `${(locker.lockedAlpha / 1000).toFixed(1)}k` : locker.lockedAlpha.toFixed(0)} α
              </div>
            </div>
          ))}

          {/* Footer */}
          <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between gap-4 flex-wrap bg-black/10">
            <div className="flex items-center gap-4 text-[10px] text-gray-600 flex-wrap">
              {skinPct !== null && (
                <span>Skin in game: <span className={`font-semibold ${parseFloat(skinPct) >= 5 ? "text-cyan-400" : "text-white"}`}>{skinPct}%</span></span>
              )}
              {communityAlpha > 0 && (
                <span>Community: <span className="text-purple-400 font-semibold">{commPct}%</span></span>
              )}
              {row.whale_signal && (
                <span className={row.whale_signal === "accumulating" ? "text-cyan-400 font-medium" : "text-orange-400 font-medium"}>
                  🐋 Whales {row.whale_signal}
                </span>
              )}
              {row.emission_pct != null && (
                <span>Emission: <span className="text-white font-semibold">{row.emission_pct.toFixed(2)}%</span></span>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Link href={`/subnets/${row.netuid}`}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200 transition-colors">
                View SN{row.netuid} →
              </Link>
              <button
                onClick={e => {
                  e.stopPropagation();
                  const q = `Analyze ${row.name} (SN${row.netuid}) conviction lock. ${(row.totalLockedAlpha / 1000).toFixed(0)}k α locked (${row.king?.lockType ?? "perpetual"}${row.king?.isOwner ? ", owner" : ""}). aGap: ${row.agap_score ?? "N/A"}/100, Invest: ${row.invest_score ?? "N/A"}/100. Is this a bullish signal?`;
                  router.push(`/oracle?q=${encodeURIComponent(q)}`);
                }}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
              >
                🔮 Ask Oracle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Intelligence Sidebar ──────────────────────────────────────────

function IntelligenceSidebar({ rows, events }: { rows: ConvictionRow[]; events: ConvictionEvent[] }) {
  const strongBuys = rows.filter(r => r.agap_signal === "strong_buy");
  const buys = rows.filter(r => r.agap_signal === "buy");
  const highConvLowScore = rows.filter(r => r.totalLockedAlpha >= 100000 && (r.invest_score ?? 0) < 40);
  const whaleAligned = rows.filter(r => r.whale_signal === "accumulating" && (r.invest_score ?? 0) >= 50);

  return (
    <div className="space-y-4">
      {/* Intelligence panel */}
      <div className="bg-[#0d1610] border border-green-500/12 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
          <span className="text-sm">🧠</span>
          <span className="text-xs font-bold text-white">aGap Intelligence</span>
          <span className="ml-auto text-[9px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">Exclusive</span>
        </div>

        {strongBuys.length > 0 && (
          <div className="px-4 py-3 border-b border-white/5">
            <div className="text-[9px] font-bold text-green-400 uppercase tracking-widest mb-2.5">⚡ Strong Conviction</div>
            <div className="space-y-1.5">
              {strongBuys.slice(0, 4).map(r => (
                <Link key={r.netuid} href={`/subnets/${r.netuid}`}
                  className="flex items-center justify-between hover:bg-white/3 rounded-lg px-1.5 py-1 transition-colors group">
                  <div className="flex items-center gap-2 min-w-0">
                    <SubnetLogo netuid={r.netuid} name={r.name} size={18} />
                    <span className="text-xs font-semibold text-white group-hover:text-green-300 transition-colors truncate">{r.name}</span>
                    <span className="text-[10px] text-gray-700 flex-shrink-0">SN{r.netuid}</span>
                  </div>
                  <span className="text-[10px] font-bold text-green-400 flex-shrink-0 ml-2">{r.invest_score ?? "—"}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {buys.length > 0 && (
          <div className="px-4 py-3 border-b border-white/5">
            <div className="text-[9px] font-bold text-green-500/70 uppercase tracking-widest mb-2.5">↑ Buy Signals</div>
            <div className="space-y-1.5">
              {buys.slice(0, 4).map(r => (
                <Link key={r.netuid} href={`/subnets/${r.netuid}`}
                  className="flex items-center justify-between hover:bg-white/3 rounded-lg px-1.5 py-1 transition-colors group">
                  <div className="flex items-center gap-2 min-w-0">
                    <SubnetLogo netuid={r.netuid} name={r.name} size={18} />
                    <span className="text-xs font-semibold text-white group-hover:text-green-300 transition-colors truncate">{r.name}</span>
                    <span className="text-[10px] text-gray-700 flex-shrink-0">SN{r.netuid}</span>
                  </div>
                  <span className="text-[10px] font-bold text-green-400/70 flex-shrink-0 ml-2">{r.invest_score ?? "—"}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {whaleAligned.length > 0 && (
          <div className="px-4 py-3 border-b border-white/5">
            <div className="text-[9px] font-bold text-cyan-400/80 uppercase tracking-widest mb-2.5">🐋 Whale + Conviction</div>
            <div className="space-y-1.5">
              {whaleAligned.slice(0, 3).map(r => (
                <Link key={r.netuid} href={`/subnets/${r.netuid}`}
                  className="flex items-center justify-between hover:bg-white/3 rounded-lg px-1.5 py-1 transition-colors group">
                  <span className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors truncate">{r.name}</span>
                  <span className="text-[10px] text-cyan-400/70 flex-shrink-0 ml-2">accumulating</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {highConvLowScore.length > 0 && (
          <div className="px-4 py-3">
            <div className="text-[9px] font-bold text-yellow-400/70 uppercase tracking-widest mb-2.5">⚠ High Lock, Low Score</div>
            <div className="space-y-1.5">
              {highConvLowScore.slice(0, 3).map(r => (
                <Link key={r.netuid} href={`/subnets/${r.netuid}`}
                  className="flex items-center justify-between hover:bg-white/3 rounded-lg px-1.5 py-1 transition-colors group">
                  <span className="text-xs font-semibold text-gray-400 group-hover:text-yellow-300 transition-colors truncate">{r.name}</span>
                  <span className="text-[10px] text-yellow-400/60 flex-shrink-0 ml-2">{(r.totalLockedAlpha / 1000).toFixed(0)}k α</span>
                </Link>
              ))}
            </div>
            <p className="text-[9px] text-gray-700 mt-2 leading-relaxed">Heavy on-chain lock, fundamentals unconfirmed — watch for catalyst.</p>
          </div>
        )}

        {strongBuys.length === 0 && buys.length === 0 && (
          <div className="px-4 py-6 text-center text-[10px] text-gray-700">No actionable signals right now.</div>
        )}
      </div>

      {/* Activity feed */}
      <div className="bg-[#0d1610] border border-white/5 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          <span className="text-xs font-bold text-white">Recent Activity</span>
        </div>
        <div className="divide-y divide-white/4 max-h-72 overflow-y-auto">
          {events.length === 0 ? (
            <div className="px-4 py-6 text-center text-[10px] text-gray-700">No recent events.</div>
          ) : events.slice(0, 15).map((ev, i) => (
            <div key={i} className="px-4 py-2.5 flex items-start gap-3 hover:bg-white/2 transition-colors">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500/40 flex-shrink-0 mt-1.5" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px]">
                  <span className="font-semibold text-white">{ev.name}</span>
                  <span className="text-gray-500"> locked </span>
                  <span className="font-bold text-green-400">
                    {ev.deltaAlpha >= 1000 ? `${(ev.deltaAlpha / 1000).toFixed(1)}k` : ev.deltaAlpha.toFixed(0)} α
                  </span>
                </div>
                <div className="text-[9px] text-gray-700 mt-0.5">{timeAgo(ev.t)} · SN{ev.netuid}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function ConvictionPage() {
  const [data, setData] = useState<ConvictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>("alpha");
  const [expandedNetuid, setExpandedNetuid] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/conviction")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setData)
      .catch(e => setError(`Failed to load conviction data: ${e}`))
      .finally(() => setLoading(false));
  }, []);

  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    if (!searchQuery.trim()) return data.rows;
    const q = searchQuery.trim().toLowerCase().replace(/^sn/i, "");
    return data.rows.filter(r => r.name.toLowerCase().includes(q) || String(r.netuid).includes(q));
  }, [data, searchQuery]);

  const freshNetuids = useMemo(() => {
    if (!data?.events) return new Set<number>();
    const cutoff = Date.now() - 72 * 3600 * 1000;
    return new Set(data.events.filter(e => e.t > cutoff).map(e => e.netuid));
  }, [data]);

  const taoPrice = data?.taoPrice ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070d0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading conviction data…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#070d0a] flex items-center justify-center">
        <div className="text-red-400 text-sm">{error ?? "No data"}</div>
      </div>
    );
  }

  const { network, events } = data;
  const top5 = data.rows.slice(0, 5);

  return (
    <div className="min-h-screen bg-[#070d0a] text-white">

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="relative border-b border-white/5 overflow-hidden">
        <div className="absolute top-0 left-1/3 w-96 h-32 bg-green-600/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-64 h-24 bg-purple-600/6 rounded-full blur-3xl pointer-events-none" />

        <div className="relative px-4 md:px-12 py-7 max-w-screen-2xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <h1 className="text-2xl font-black bg-gradient-to-r from-green-400 via-emerald-300 to-white bg-clip-text text-transparent leading-tight">
                  Conviction
                </h1>
                <span className="text-xs font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full">Intelligence</span>
              </div>
              <p className="text-xs text-gray-500 max-w-lg leading-relaxed">
                Founders and investors lock α on-chain to signal long-term commitment. Conviction grows the longer it stays locked — cross-referenced with aGap scores to surface where smart money aligns with fundamentals.
              </p>
              <p className="text-[10px] text-gray-700 mt-1.5">
                BIT-0011 · Block #{data.observedAtBlock.toLocaleString()} · Data via SubnetRadar
              </p>
            </div>

            {/* Currency toggle */}
            <div className="flex items-center gap-0.5 bg-black/40 border border-white/8 rounded-xl p-1 flex-shrink-0">
              {(["alpha", "usd"] as Currency[]).map(c => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    currency === c
                      ? "bg-green-500/20 text-green-300 border border-green-500/30"
                      : "text-gray-600 hover:text-gray-400"
                  }`}>
                  {c === "alpha" ? "α Alpha" : "$ USD"}
                </button>
              ))}
            </div>
          </div>

          {/* Stats strip */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Subnets locking", value: String(network.subnetCount), highlight: false },
              { label: "Total locked",     value: fmtAlpha(network.totalLockedAlpha, currency, taoPrice), highlight: true },
              { label: "Conviction α",     value: fmtAlpha(network.totalConvictionAlpha, currency, taoPrice), highlight: false },
              { label: "Unlocked / sellable", value: fmtAlpha(network.totalUnlockedAlpha, currency, taoPrice), highlight: false },
              { label: "Owner-locked",     value: fmtAlpha(network.ownerLockedAlpha, currency, taoPrice), highlight: false },
              { label: "Active lockers",   value: String(network.totalLockers), highlight: false },
              { label: "Decaying locks",   value: `${network.decayingPct}%`, highlight: false },
            ].map(stat => (
              <div key={stat.label}
                className={`rounded-xl px-4 py-2.5 border ${
                  stat.highlight
                    ? "bg-green-950/30 border-green-500/20"
                    : "bg-[#0d1610] border-white/5"
                }`}
              >
                <div className={`text-sm font-black tabular-nums ${stat.highlight ? "text-green-300" : "text-white"}`}>
                  {stat.value}
                </div>
                <div className="text-[9px] text-gray-600 uppercase tracking-widest mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-12 py-7 max-w-screen-2xl mx-auto">

        {/* ── Top 5 featured strip ───────────────────────── */}
        {top5.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Top 5 by conviction</span>
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-[9px] text-gray-700">ring = maturity · hover signal badge for reason</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {top5.map((row, i) => (
                <FeaturedCard
                  key={row.netuid}
                  row={row}
                  rank={i + 1}
                  currency={currency}
                  taoPrice={taoPrice}
                  observedAtBlock={data.observedAtBlock}
                  isFresh={freshNetuids.has(row.netuid)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Two-column layout ──────────────────────────── */}
        <div className="flex gap-6 items-start">

          {/* ── Full leaderboard ───────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Full leaderboard</span>
              <div className="flex-1 h-px bg-white/5" />

              {/* Search */}
              <div className="relative flex items-center">
                <svg className="absolute left-2.5 w-3 h-3 text-gray-600 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                </svg>
                <input
                  type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search subnet…"
                  className="pl-7 pr-6 py-1.5 rounded-lg text-xs bg-[#0d1610] border border-white/8 text-gray-300 placeholder-gray-700 focus:outline-none focus:border-green-500/30 w-36"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2 text-gray-600 hover:text-gray-400">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              <span className="text-[10px] text-gray-700 flex-shrink-0">{filteredRows.length} subnets</span>
            </div>

            {/* Column headers */}
            <div className="hidden lg:flex items-center gap-3 pl-4 pr-4 mb-1.5 text-[9px] text-gray-700 uppercase tracking-widest">
              <div className="w-1 flex-shrink-0" />
              <div className="w-5 ml-3" />
              <div className="w-40">Subnet</div>
              <div className="w-28">Lock</div>
              <div className="flex-1">Locked α · Maturity</div>
              <div className="w-12 text-center">aGap</div>
              <div className="w-12 text-center">Invest</div>
              <div className="w-28 text-right">Signal</div>
              <div className="w-4" />
            </div>

            <div className="space-y-1.5">
              {filteredRows.length === 0 ? (
                <div className="text-center py-16 text-gray-700 text-sm">No subnets found.</div>
              ) : filteredRows.map((row, i) => (
                <LeaderboardRow
                  key={row.netuid}
                  row={row}
                  rank={i + 1}
                  currency={currency}
                  taoPrice={taoPrice}
                  observedAtBlock={data.observedAtBlock}
                  expanded={expandedNetuid === row.netuid}
                  onToggle={() => setExpandedNetuid(expandedNetuid === row.netuid ? null : row.netuid)}
                />
              ))}
            </div>
          </div>

          {/* ── Sidebar ───────────────────────────────── */}
          <div className="hidden xl:block w-72 flex-shrink-0">
            <IntelligenceSidebar rows={data.rows} events={events} />
          </div>
        </div>

        {/* ── Explainer ─────────────────────────────────── */}
        <div className="mt-10 pt-5 border-t border-white/4">
          <p className="text-[10px] text-gray-700 max-w-2xl leading-relaxed">
            <span className="text-gray-500 font-semibold">BIT-0011 conviction</span> — α locked to a hotkey accrues conviction over time:{" "}
            <code className="text-green-500/60 bg-green-500/5 px-1 rounded">1 − exp(−blocks/648,000)</code> perpetual,{" "}
            <code className="text-orange-400/50 bg-orange-500/5 px-1 rounded">1 − exp(−blocks/216,000)</code> decaying.
            AlphaGap cross-references these on-chain locks with our invest score formula to surface where smart money aligns with subnet fundamentals.
          </p>
        </div>
      </div>
    </div>
  );
}
