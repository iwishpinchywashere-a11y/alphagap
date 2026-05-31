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

type Currency = "alpha" | "usd" | "tao";

function fmtAlpha(v: number, currency: Currency, price: number): string {
  if (currency === "usd") {
    const usd = v * price;
    if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
    if (usd >= 1e3) return `$${(usd / 1e3).toFixed(1)}k`;
    return `$${usd.toFixed(0)}`;
  }
  if (currency === "tao") {
    const tao = v * price / price; // alpha → tao approximation via price ratio
    if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M τ`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k τ`;
    return `${v.toFixed(0)} τ`;
  }
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M α`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k α`;
  return `${v.toFixed(2)} α`;
}

function shortKey(k: string) {
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ScoreBadge({ score, label }: { score?: number; label: string }) {
  if (score == null) return <span className="text-gray-700 text-[10px]">—</span>;
  const color =
    score >= 75 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" :
    score >= 60 ? "text-green-400 bg-green-500/10 border-green-500/30" :
    score >= 45 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/25" :
    score >= 30 ? "text-orange-400 bg-orange-500/10 border-orange-500/25" :
    "text-red-400 bg-red-500/10 border-red-500/20";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-xs font-bold tabular-nums px-1.5 py-0.5 rounded border ${color}`}>{score}</span>
      <span className="text-[9px] text-gray-600 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function SignalBadge({ signal, row }: { signal?: string; row?: ConvictionRow }) {
  if (!signal || signal === "neutral") return null;
  const cfg = {
    strong_buy: { label: "⚡ Strong Buy", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
    buy:        { label: "📈 Buy Signal", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
    watch:      { label: "👀 Watch",      cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  }[signal] ?? null;
  if (!cfg) return null;

  // Build human-readable reason
  let reason = "";
  if (row) {
    const parts: string[] = [];
    if (row.king?.lockType === "perpetual") parts.push("perpetual lock");
    if (row.totalLockedAlpha >= 50000) parts.push(`${(row.totalLockedAlpha/1000).toFixed(0)}k α locked`);
    if (row.invest_score != null) parts.push(`invest score ${row.invest_score}/100`);
    if (parts.length) reason = parts.join(" · ");
  }

  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls} whitespace-nowrap cursor-help`}
      title={reason || undefined}
    >
      {cfg.label}
    </span>
  );
}

// ── Conviction progress (BIT-0011 formula) ───────────────────────

function convictionPct(lastUpdateBlock: number, observedAtBlock: number, lockType: "perpetual" | "decaying"): number {
  const blocks = Math.max(0, observedAtBlock - lastUpdateBlock);
  const halfLife = lockType === "perpetual" ? 648000 : 216000;
  return Math.round((1 - Math.exp(-blocks / halfLife)) * 100);
}

// ── Top 5 Leaderboard ────────────────────────────────────────────

function Top5Leaderboard({
  rows, currency, taoPrice, observedAtBlock, recentEvents,
}: {
  rows: ConvictionRow[]; currency: Currency; taoPrice: number;
  observedAtBlock: number; recentEvents: ConvictionEvent[];
}) {
  const top5 = rows.slice(0, 5);
  const rankColors = [
    "from-amber-500/25 to-amber-600/10 border-amber-500/40",
    "from-gray-300/15 to-gray-400/8 border-gray-500/30",
    "from-orange-600/20 to-orange-700/8 border-orange-600/30",
    "from-gray-800/60 to-gray-900/40 border-gray-700/50",
    "from-gray-800/60 to-gray-900/40 border-gray-700/50",
  ];
  const rankNums = ["1st", "2nd", "3rd", "4th", "5th"];

  // Subnets that had a new lock event recently
  const freshNetuids = new Set(recentEvents.map(e => e.netuid));

  return (
    <div className="mb-8 space-y-2">
      {top5.map((row, i) => {
        const cvPct = row.king?.lastUpdate
          ? convictionPct(row.king.lastUpdate, observedAtBlock, row.king?.lockType ?? "perpetual")
          : null;
        const ownerLockers = row.lockers.filter(l => l.isOwner);
        const communityLockers = row.lockers.filter(l => !l.isOwner);
        const communityAlpha = communityLockers.reduce((s, l) => s + l.lockedAlpha, 0);
        const ownerAlpha = ownerLockers.reduce((s, l) => s + l.lockedAlpha, 0);
        const commPct = row.totalLockedAlpha > 0
          ? Math.round((communityAlpha / row.totalLockedAlpha) * 100) : 0;
        const skinPct = row.market_cap && row.market_cap > 0
          ? ((row.totalLockedAlpha * row.priceUsd) / row.market_cap * 100).toFixed(1)
          : null;
        const isFresh = freshNetuids.has(row.netuid);

        return (
          <div key={row.netuid}
            className={`bg-gradient-to-r ${rankColors[i]} border rounded-xl p-4 flex items-center gap-4 flex-wrap sm:flex-nowrap`}
          >
            {/* Rank + logo */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-center w-8">
                <div className={`text-xs font-black tabular-nums ${i === 0 ? "text-amber-400 text-base" : "text-gray-500"}`}>
                  {rankNums[i]}
                </div>
              </div>
              <Link href={`/subnets/${row.netuid}`} className="flex-shrink-0">
                <SubnetLogo netuid={row.netuid} name={row.name} size={i === 0 ? 44 : 36} />
              </Link>
            </div>

            {/* Name + badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/subnets/${row.netuid}`}
                  className={`font-bold text-white hover:text-amber-300 transition-colors ${i === 0 ? "text-base" : "text-sm"}`}>
                  {row.name}
                </Link>
                <span className="text-[10px] text-gray-500 font-mono">SN{row.netuid}</span>
                {isFresh && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 uppercase tracking-widest">New lock</span>
                )}
                <SignalBadge signal={row.agap_signal} row={row} />
              </div>

              {/* Sub-stats row */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[10px] text-gray-500">
                {row.king?.lockType && (
                  <span className={`font-bold ${row.king.lockType === "perpetual" ? "text-emerald-400" : "text-orange-400"}`}>
                    {row.king.lockType}
                  </span>
                )}
                {cvPct !== null && (
                  <span title="How far to maximum conviction (BIT-0011 formula)">
                    <span className="text-gray-600">Conviction maturity:</span>{" "}
                    <span className={`font-semibold ${cvPct >= 70 ? "text-emerald-400" : cvPct >= 40 ? "text-yellow-400" : "text-gray-400"}`}>
                      {cvPct}%
                    </span>
                  </span>
                )}
                {skinPct !== null && (
                  <span title="Locked α ÷ market cap — how much of the subnet is actually committed">
                    <span className="text-gray-600">Skin in game:</span>{" "}
                    <span className={`font-semibold ${parseFloat(skinPct) >= 5 ? "text-cyan-400" : "text-gray-400"}`}>
                      {skinPct}%
                    </span>
                  </span>
                )}
                {communityAlpha > 0 && (
                  <span title="Community (non-owner) vs owner locks">
                    <span className="text-gray-600">Community:</span>{" "}
                    <span className="text-violet-400 font-semibold">{commPct}%</span>
                  </span>
                )}
                <span><span className="text-gray-600">{row.lockers.length} locker{row.lockers.length !== 1 ? "s" : ""}</span></span>
              </div>

              {/* Conviction maturity bar */}
              {cvPct !== null && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden max-w-[160px]">
                    <div
                      className={`h-full rounded-full transition-all ${cvPct >= 70 ? "bg-emerald-400" : cvPct >= 40 ? "bg-yellow-400" : "bg-gray-500"}`}
                      style={{ width: `${cvPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-gray-600">max conv.</span>
                </div>
              )}
            </div>

            {/* Locked amount + aGap scores */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <div className={`font-black text-amber-300 tabular-nums ${i === 0 ? "text-lg" : "text-sm"}`}>
                  {fmtAlpha(row.totalLockedAlpha, currency, taoPrice)}
                </div>
                <div className="text-[10px] text-gray-600 mt-0.5">locked</div>
              </div>

              <div className="flex gap-2.5">
                <ScoreBadge score={row.agap_score} label="aGap" />
                <ScoreBadge score={row.invest_score} label="Invest" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Locker Row ────────────────────────────────────────────────────

function LockerRow({ locker, totalWalletAlpha }: { locker: Locker; totalWalletAlpha?: number }) {
  const pct = totalWalletAlpha && totalWalletAlpha > 0
    ? Math.min(100, Math.round((locker.lockedAlpha / totalWalletAlpha) * 100))
    : 100;

  return (
    <div className="flex items-center gap-3 text-xs py-2 px-4 border-b border-white/5 last:border-0">
      <div className="flex gap-1.5 flex-wrap flex-shrink-0">
        {locker.isOwner && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">owner</span>
        )}
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
          locker.lockType === "perpetual"
            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
            : "bg-orange-500/15 text-orange-400 border-orange-500/30"
        }`}>{locker.lockType}</span>
      </div>

      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <a href={`https://taostats.io/account/${locker.coldkey}`} target="_blank" rel="noopener noreferrer"
          className="text-[10px] font-mono text-gray-400 hover:text-blue-400 transition-colors truncate"
          title={locker.coldkey}
        >
          coldkey: {shortKey(locker.coldkey)}
        </a>
        <a href={`https://taostats.io/hotkey/${locker.hotkey}`} target="_blank" rel="noopener noreferrer"
          className="text-[10px] font-mono text-gray-500 hover:text-blue-400 transition-colors truncate"
          title={locker.hotkey}
        >
          hotkey: {shortKey(locker.hotkey)}
        </a>
      </div>

      <div className="flex-shrink-0 text-right">
        <div className="font-bold text-amber-300 tabular-nums">{locker.lockedAlpha >= 1000 ? `${(locker.lockedAlpha/1000).toFixed(1)}k` : locker.lockedAlpha.toFixed(0)} α</div>
        <div className="flex items-center gap-1 mt-1 justify-end">
          <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400/70 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-gray-500 text-[10px] tabular-nums w-8 text-right">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

// ── King Card (full leaderboard row) ─────────────────────────────

function KingCard({
  row, rank, currency, taoPrice, expanded, onToggle,
}: {
  row: ConvictionRow; rank: number; currency: Currency; taoPrice: number;
  expanded: boolean; onToggle: () => void;
}) {
  const router = useRouter();
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  const unlockedPct = row.totalLockedAlpha > 0
    ? Math.round((row.totalUnlockedAlpha / (row.totalLockedAlpha + row.totalUnlockedAlpha + 0.001)) * 100)
    : 0;

  return (
    <div className={`border border-gray-800 rounded-xl overflow-hidden transition-all ${
      row.agap_signal === "strong_buy" ? "border-emerald-500/40 bg-emerald-950/10 ring-1 ring-emerald-500/20" :
      row.agap_signal === "buy" ? "border-green-500/30 bg-green-950/5" :
      "bg-gray-900/40"
    }`}>
      {/* Main row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        {/* Rank */}
        <div className="w-7 flex-shrink-0 text-center">
          {medal
            ? <span className="text-lg leading-none">{medal}</span>
            : <span className="text-xs font-bold text-gray-500 tabular-nums">#{rank}</span>}
        </div>

        {/* Logo + name */}
        <div className="flex items-center gap-2.5 flex-shrink-0 w-36 min-w-0">
          <SubnetLogo netuid={row.netuid} name={row.name} size={36} />
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{row.name}</div>
            <div className="text-[10px] text-gray-500 font-mono">SN{row.netuid}</div>
          </div>
        </div>

        {/* Lock type + owner badges */}
        <div className="flex gap-1.5 flex-wrap flex-shrink-0 hidden sm:flex">
          {row.king?.isOwner && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">owner</span>
          )}
          {row.king?.lockType && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
              row.king.lockType === "perpetual"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-orange-500/15 text-orange-400 border-orange-500/30"
            }`}>{row.king.lockType}</span>
          )}
        </div>

        {/* Locked amount */}
        <div className="flex-1 min-w-0 text-right sm:text-left">
          <div className="text-sm font-black text-amber-300 tabular-nums">
            {fmtAlpha(row.totalLockedAlpha, currency, taoPrice)}
          </div>
          {unlockedPct > 0 && (
            <div className="text-[10px] text-gray-500">{unlockedPct}% unlocked</div>
          )}
        </div>

        {/* aGap scores */}
        <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
          <ScoreBadge score={row.agap_score} label="aGap" />
          <ScoreBadge score={row.invest_score} label="Invest" />
        </div>

        {/* Signal */}
        <div className="hidden md:block flex-shrink-0 w-24 text-right">
          <SignalBadge signal={row.agap_signal} row={row} />
        </div>

        {/* Chevron */}
        <span className={`text-gray-600 text-[10px] flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}>▼</span>
      </button>

      {/* Expanded: locker details + oracle CTA */}
      {expanded && (
        <div className="border-t border-white/5 bg-black/20">
          {/* Locker list */}
          {row.lockers.map((locker, i) => (
            <LockerRow
              key={i}
              locker={locker}
              totalWalletAlpha={row.totalLockedAlpha}
            />
          ))}

          {/* AlphaGap insight row */}
          <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
              {row.agap_score != null && (
                <span>aGap: <span className="text-white font-semibold">{row.agap_score}/100</span></span>
              )}
              {row.invest_score != null && (
                <span>Invest: <span className="text-white font-semibold">{row.invest_score}/100</span></span>
              )}
              {row.whale_signal && (
                <span className={`font-medium ${row.whale_signal === "accumulating" ? "text-cyan-400" : "text-orange-400"}`}>
                  🐋 Whales {row.whale_signal}
                </span>
              )}
              {row.emission_pct != null && (
                <span>Emission: <span className="text-white font-semibold">{row.emission_pct.toFixed(2)}%</span></span>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Link href={`/subnets/${row.netuid}`}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200 transition-colors"
              >
                View SN{row.netuid}
              </Link>
              <button
                onClick={() => {
                  const q = `Analyze ${row.name} (SN${row.netuid}) for investment. It has ${(row.totalLockedAlpha/1000).toFixed(0)}k α locked in conviction (${row.king?.lockType ?? "perpetual"} lock${row.king?.isOwner ? ", owner" : ""}). aGap score: ${row.agap_score ?? "N/A"}/100, Invest score: ${row.invest_score ?? "N/A"}/100. Is this conviction signal bullish? Should I add it to my portfolio?`;
                  router.push(`/oracle?q=${encodeURIComponent(q)}`);
                }}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors"
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

// ── Insight Panel ─────────────────────────────────────────────────

function InsightPanel({ rows }: { rows: ConvictionRow[] }) {
  const strongBuys = rows.filter(r => r.agap_signal === "strong_buy");
  const buys = rows.filter(r => r.agap_signal === "buy");
  const highConvLowScore = rows.filter(r =>
    r.totalLockedAlpha >= 100000 && (r.invest_score ?? 0) < 40
  );
  const whaleAligned = rows.filter(r =>
    r.whale_signal === "accumulating" && (r.invest_score ?? 0) >= 50
  );

  if (strongBuys.length === 0 && buys.length === 0) return null;

  return (
    <div className="bg-gray-900/50 border border-green-500/20 rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🧠</span>
        <h2 className="text-sm font-bold text-white">AlphaGap Conviction Intelligence</h2>
        <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Exclusive</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {strongBuys.length > 0 && (
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-3">
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">⚡ Strong Conviction + High Invest Score</div>
            <div className="space-y-1.5">
              {strongBuys.slice(0, 3).map(r => (
                <div key={r.netuid} className="flex items-center justify-between">
                  <Link href={`/subnets/${r.netuid}`} className="text-xs font-semibold text-white hover:text-emerald-300 transition-colors">
                    {r.name} <span className="text-gray-500 font-normal">SN{r.netuid}</span>
                  </Link>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-amber-300">{(r.totalLockedAlpha/1000).toFixed(0)}k α locked</span>
                    <span className="text-emerald-400 font-bold">{r.invest_score}/100</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">Owner/founder locked perpetually AND our invest formula rates these highly — highest conviction we track.</p>
          </div>
        )}

        {buys.length > 0 && (
          <div className="bg-green-950/20 border border-green-500/25 rounded-lg p-3">
            <div className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-2">📈 Buy Signals — Conviction + Momentum</div>
            <div className="space-y-1.5">
              {buys.slice(0, 3).map(r => (
                <div key={r.netuid} className="flex items-center justify-between">
                  <Link href={`/subnets/${r.netuid}`} className="text-xs font-semibold text-white hover:text-green-300 transition-colors">
                    {r.name} <span className="text-gray-500 font-normal">SN{r.netuid}</span>
                  </Link>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-amber-300">{(r.totalLockedAlpha/1000).toFixed(0)}k α locked</span>
                    <span className="text-green-400 font-bold">{r.invest_score}/100</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {whaleAligned.length > 0 && (
          <div className="bg-cyan-950/20 border border-cyan-500/25 rounded-lg p-3">
            <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-2">🐋 Whale + Conviction Alignment</div>
            <div className="space-y-1.5">
              {whaleAligned.slice(0, 3).map(r => (
                <div key={r.netuid} className="flex items-center justify-between">
                  <Link href={`/subnets/${r.netuid}`} className="text-xs font-semibold text-white hover:text-cyan-300 transition-colors">
                    {r.name} <span className="text-gray-500 font-normal">SN{r.netuid}</span>
                  </Link>
                  <span className="text-[10px] text-cyan-400">Whales buying + locked</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">On-chain whale accumulation AND conviction locks — double signal.</p>
          </div>
        )}

        {highConvLowScore.length > 0 && (
          <div className="bg-yellow-950/20 border border-yellow-500/25 rounded-lg p-3">
            <div className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest mb-2">⚠️ High Conviction, Low aGap Score</div>
            <div className="space-y-1.5">
              {highConvLowScore.slice(0, 3).map(r => (
                <div key={r.netuid} className="flex items-center justify-between">
                  <Link href={`/subnets/${r.netuid}`} className="text-xs font-semibold text-white hover:text-yellow-300 transition-colors">
                    {r.name} <span className="text-gray-500 font-normal">SN{r.netuid}</span>
                  </Link>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-amber-300">{(r.totalLockedAlpha/1000).toFixed(0)}k α locked</span>
                    <span className="text-yellow-400">{r.invest_score ?? "—"}/100</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">Heavy on-chain conviction but our formula hasn&apos;t confirmed fundamentals yet — watch for catalyst.</p>
          </div>
        )}
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
  const [activeTab, setActiveTab] = useState<"kings" | "events">("kings");
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
    return data.rows.filter(r =>
      r.name.toLowerCase().includes(q) || String(r.netuid).includes(q)
    );
  }, [data, searchQuery]);

  const taoPrice = data?.taoPrice ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading conviction data…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center text-red-400 text-sm">{error ?? "No data"}</div>
      </div>
    );
  }

  const { network, events } = data;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="relative border-b border-gray-800/50 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.15) 1px,transparent 1px)",
          backgroundSize: "32px 32px",
        }} />
        <div className="absolute top-0 right-1/3 w-80 h-40 bg-amber-600/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative px-4 md:px-8 py-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-white bg-clip-text text-transparent leading-tight mb-1">
                💎 Conviction
              </h1>
              <p className="text-sm text-gray-400 max-w-xl">
                On-chain commitment to a Bittensor subnet. Founders and whales lock α to a hotkey — conviction grows the longer it stays locked. Cross-referenced with aGap scores for investment signals.
              </p>
              <p className="text-[11px] text-gray-600 mt-1.5">
                Unlock τ = blocks (~21 days for 50%) · Build half-life ~62 days · BIT-0011 · Block #{network.subnetCount > 0 ? data.observedAtBlock.toLocaleString() : "—"}
              </p>
            </div>
            {/* Currency toggle */}
            <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-0.5 flex-shrink-0">
              {(["alpha", "usd"] as Currency[]).map(c => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                    currency === c ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-gray-500 hover:text-gray-300"
                  }`}>
                  {c === "alpha" ? "α" : c.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Network stats */}
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Subnets locked", value: String(network.subnetCount) },
              { label: "Total locked", value: fmtAlpha(network.totalLockedAlpha, currency, taoPrice) },
              { label: "Total conviction", value: fmtAlpha(network.totalConvictionAlpha, currency, taoPrice) },
              { label: "Available to sell", value: fmtAlpha(network.totalUnlockedAlpha, currency, taoPrice) },
              { label: "Owner-locked", value: fmtAlpha(network.ownerLockedAlpha, currency, taoPrice) },
              { label: "Active lockers", value: String(network.totalLockers) },
            ].map(stat => (
              <div key={stat.label} className="bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-2.5">
                <div className="text-base font-black text-amber-300 tabular-nums">{stat.value}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="px-4 md:px-8 py-6">

        {/* ── AlphaGap Intelligence Panel ───────────────── */}
        <InsightPanel rows={data.rows} />

        {/* ── Top 5 Leaderboard ─────────────────────────── */}
        {data.rows.length >= 1 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-sm font-bold text-amber-300">👑 Top 5 by Conviction</span>
              <span className="text-[10px] text-gray-600">highest locked α · hover signals for reasoning</span>
            </div>
            <Top5Leaderboard
              rows={data.rows}
              currency={currency}
              taoPrice={taoPrice}
              observedAtBlock={data.observedAtBlock}
              recentEvents={events}
            />
          </div>
        )}

        {/* ── Tabs + search ─────────────────────────────── */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex gap-1">
            {(["kings", "events"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                  activeTab === tab
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                    : "border-gray-800 text-gray-500 hover:text-gray-300"
                }`}>
                {tab === "kings" ? `👑 King Leaderboard` : `⚡ Recent Activity`}
              </button>
            ))}
          </div>

          {activeTab === "kings" && (
            <div className="relative flex items-center ml-auto">
              <svg className="absolute left-2.5 w-3.5 h-3.5 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search subnet…"
                className="pl-7 pr-7 py-1.5 rounded-lg text-xs bg-gray-900/60 border border-gray-800 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600 w-36"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 text-gray-500 hover:text-gray-300">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          )}

          {activeTab === "kings" && (
            <span className="text-[10px] text-gray-600">{filteredRows.length} ranked</span>
          )}
        </div>

        {/* ── King Leaderboard ──────────────────────────── */}
        {activeTab === "kings" && (
          <>
            {/* Column headers */}
            <div className="hidden lg:flex items-center gap-3 px-4 mb-1.5 text-[10px] text-gray-600 uppercase tracking-widest">
              <div className="w-7" />
              <div className="w-36">Subnet</div>
              <div className="w-28">Lock type</div>
              <div className="flex-1">Locked</div>
              <div className="w-28 text-center">aGap / Invest</div>
              <div className="w-24 text-right">Signal</div>
              <div className="w-5" />
            </div>

            <div className="space-y-2">
              {filteredRows.length === 0 ? (
                <div className="text-center py-12 text-gray-600">No conviction data found.</div>
              ) : filteredRows.map((row, i) => (
                <KingCard
                  key={row.netuid}
                  row={row}
                  rank={i + 1}
                  currency={currency}
                  taoPrice={taoPrice}
                  expanded={expandedNetuid === row.netuid}
                  onToggle={() => setExpandedNetuid(expandedNetuid === row.netuid ? null : row.netuid)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Activity feed ─────────────────────────────── */}
        {activeTab === "events" && (
          <div className="space-y-2">
            {events.length === 0 ? (
              <div className="text-center py-12 text-gray-600">No recent conviction events.</div>
            ) : events.map((ev, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-semibold text-white">{ev.name}</span>
                    <span className="text-gray-500"> · SN{ev.netuid}</span>
                    <span className="text-gray-400"> locked </span>
                    <span className="font-bold text-amber-300">
                      {ev.deltaAlpha >= 1000 ? `${(ev.deltaAlpha/1000).toFixed(1)}k` : ev.deltaAlpha.toFixed(0)} α
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <a href={`https://taostats.io/account/${ev.coldkey}`} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] font-mono text-gray-600 hover:text-blue-400 transition-colors">
                      {shortKey(ev.coldkey)}
                    </a>
                    <span className="text-[10px] text-gray-700">{timeAgo(ev.t)}</span>
                  </div>
                </div>
                <Link href={`/subnets/${ev.netuid}`}
                  className="text-[11px] font-medium px-2.5 py-1 rounded border border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors flex-shrink-0">
                  View →
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* ── Explainer ─────────────────────────────────── */}
        <div className="mt-10 pt-6 border-t border-gray-800/50">
          <p className="text-xs text-gray-600 max-w-2xl leading-relaxed">
            <span className="text-gray-400 font-semibold">What is conviction?</span> BIT-0011 is a Bittensor governance primitive that locks α to a hotkey on a subnet. Conviction grows over time using{" "}
            <code className="text-amber-400/80 bg-amber-500/5 px-1 rounded">1 − exp(−blocks/648,000)</code> for perpetual locks and{" "}
            <code className="text-orange-400/80 bg-orange-500/5 px-1 rounded">1 − exp(−blocks/216,000)</code> for decaying locks.
            AlphaGap cross-references these on-chain signals with our aGap investing score to identify where market conviction aligns with fundamental strength.
            Data via SubnetRadar public API.
          </p>
        </div>
      </main>
    </div>
  );
}
