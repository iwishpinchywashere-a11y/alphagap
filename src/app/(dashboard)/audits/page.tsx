"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import { getTier } from "@/lib/subscription";
import { useWatchlist } from "@/components/dashboard/WatchlistProvider";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { formatNum } from "@/lib/formatters";
import type { SubnetAudit } from "@/app/api/cron/audit-scan/route";

// ── Formatters ────────────────────────────────────────────────────
function pct(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "—";
  return `${v.toFixed(decimals)}%`;
}
function num(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(3);
}
function fmtK(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}
function fmtTao(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M τ`;
  if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(1)}K τ`;
  return `${v.toFixed(2)} τ`;
}
function fmtLoc(v: number | undefined): string {
  if (v === undefined) return "—";
  if (v === 0)         return "0";
  if (v >= 1_000_000)  return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)      return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

// ── Score badge ───────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 80 ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/40"
    : score >= 65 ? "text-teal-400 bg-teal-400/10 border-teal-400/40"
    : score >= 45 ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/40"
    : "text-red-400 bg-red-400/10 border-red-400/40";
  return (
    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border-2 font-bold text-sm tabular-nums flex-shrink-0 ${cls}`}>
      {score}
    </span>
  );
}

// ── Coloured cell value ───────────────────────────────────────────
type Dir = "high_good" | "low_good" | "neutral";
function CellVal({
  value, raw, dir = "neutral", thresholds,
}: {
  value: string;
  raw: number | null | undefined;
  dir?: Dir;
  thresholds?: [number, number]; // [warn, critical]
}) {
  if (value === "—") return <span className="text-gray-600 text-sm">—</span>;
  if (raw == null || dir === "neutral") return <span className="text-gray-300 tabular-nums text-sm">{value}</span>;

  const [warn, crit] = thresholds ?? [50, 80];
  let cls = "text-emerald-400";

  if (dir === "high_good") {
    // higher is better: below warn = red, warn–crit = yellow, above crit = green
    if      (raw < warn)   cls = "text-red-400";
    else if (raw < crit)   cls = "text-yellow-400";
    else                   cls = "text-emerald-400";
  } else {
    // low_good — lower is better: above crit = red, warn–crit = yellow, below warn = green
    if      (raw >= crit)  cls = "text-red-400";
    else if (raw >= warn)  cls = "text-yellow-400";
    else                   cls = "text-emerald-400";
  }

  return <span className={`tabular-nums font-medium text-sm ${cls}`}>{value}</span>;
}

// ── Info tooltip — portal-based so it escapes overflow clipping ────
function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.max(8, r.right - 224) });
    }
    setOpen(v => !v);
  }

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (!btnRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`text-[12px] leading-none transition-colors ${open ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
      >
        ⓘ
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, width: 224 }}
          className="bg-gray-950 border border-gray-600 rounded-lg px-3 py-2.5 text-[12px] text-gray-200 leading-relaxed shadow-2xl"
        >
          {text}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Column header ─────────────────────────────────────────────────
function ColHeader({ label, sub, tooltip, onClick, sorted }: {
  label: string;
  sub?: string;
  tooltip?: string;
  onClick?: () => void;
  sorted?: boolean;
}) {
  return (
    <th
      className={`px-1.5 py-2 text-right whitespace-nowrap cursor-pointer select-none ${sorted ? "text-green-400" : "text-gray-500 hover:text-gray-300"} transition-colors`}
      onClick={onClick}
    >
      <div className="flex items-center justify-end gap-1">
        {tooltip && <InfoTip text={tooltip} />}
        <div className="text-xs font-semibold uppercase tracking-wide">{label}</div>
      </div>
      {sub && <div className="text-[10px] font-normal text-gray-600 text-right">{sub}</div>}
    </th>
  );
}

// ── Expanded row detail ───────────────────────────────────────────
function ExpandedDetail({ audit }: { audit: SubnetAudit }) {
  const critFlags = audit.flags.filter(f => f.severity === "critical");
  const warnFlags = audit.flags.filter(f => f.severity === "warning");
  return (
    <div className="px-4 py-3 bg-gray-950/60 border-t border-gray-800/50 space-y-3">
      {/* Flag messages */}
      {[...critFlags, ...warnFlags].length > 0 && (
        <div className="space-y-1.5">
          {[...critFlags, ...warnFlags].map((flag, i) => (
            <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 border text-xs ${
              flag.severity === "critical"
                ? "text-red-300 bg-red-500/5 border-red-500/20"
                : "text-yellow-300 bg-yellow-500/5 border-yellow-500/20"
            }`}>
              <span className="shrink-0">{flag.severity === "critical" ? "🔴" : "⚠️"}</span>
              <span>{flag.message}</span>
            </div>
          ))}
        </div>
      )}
      {/* Extra detail grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {[
          { label: "Max Weight Lag", value: audit.maxWeightLagBlocks > 0 ? `${Math.round(audit.maxWeightLagBlocks/300)}h` : "0h" },
          { label: "Stale Validators", value: `${audit.staleValidatorCount} / ${audit.validatorCount}` },
          { label: "Zero-Inc Miners",  value: `${audit.zeroIncentiveMinerCount} / ${audit.minerCount}` },
          { label: "Top-3 Trust",      value: `${audit.top3ValidatorTrustShare}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-2">
            <div className="text-gray-600 text-[10px] mb-0.5">{label}</div>
            <div className="text-gray-300 font-mono font-semibold">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sort key type ─────────────────────────────────────────────────
type SortKey =
  | "score" | "agap" | "marketCap" | "nakamoto" | "hhi" | "top10" | "burn"
  | "holders" | "chainBuy"
  | "taoPool" | "staleVal" | "ziMiners" | "loc30d" | "conviction";

const SORT_DEFAULTS: Record<SortKey, "asc" | "desc"> = {
  score: "desc", agap: "desc", marketCap: "desc", nakamoto: "desc", hhi: "asc", top10: "asc", burn: "asc",
  holders: "desc", chainBuy: "desc",
  taoPool: "desc", staleVal: "asc", ziMiners: "asc", loc30d: "desc", conviction: "desc",
};

/**
 * Conviction Score (0–100) — BIT-0011 on-chain commitment signal.
 * Built from signals already in the leaderboard:
 *   • alpha_staked_pct  → 0–50 pts  (primary: % of supply locked, not in DEX)
 *   • tao_locked        → 0–30 pts  (capital depth / liquidity confidence)
 *   • const_buy/sell    → –10–20 pts (team skin-in-the-game)
 */
function convictionScore(
  alphaStakedPct: number | undefined,
  taoLocked: number | undefined,
  constBuy: number | undefined,
  constSell: number | undefined,
): number {
  // 1. Alpha staked %
  const staked = alphaStakedPct ?? 0;
  const stakedPts =
    staked >= 75 ? 50 :
    staked >= 65 ? 40 :
    staked >= 55 ? 30 :
    staked >= 45 ? 20 :
    staked >= 35 ? 10 : 0;

  // 2. TAO in pool (liquidity conviction)
  const locked = taoLocked ?? 0;
  const lockedPts =
    locked >= 15_000 ? 30 :
    locked >= 8_000  ? 22 :
    locked >= 3_000  ? 15 :
    locked >= 1_000  ? 8  :
    locked >= 200    ? 3  : 0;

  // 3. Team (Const) net buy/sell
  const netConst = (constBuy ?? 0) - (constSell ?? 0);
  const constPts =
    netConst >= 2_000 ? 20 :
    netConst >= 1_000 ? 15 :
    netConst >= 300   ? 10 :
    netConst > 0      ? 5  :
    netConst <= -500  ? -10 :
    netConst <= -200  ? -5  : 0;

  return Math.max(0, Math.min(100, stakedPts + lockedPts + constPts));
}

// Small LOC-based adjustment to audit score (+4 to −3)
function locAuditAdj(loc30d: number | undefined): number {
  if (loc30d === undefined) return 0;
  if (loc30d >= 20_000) return 4;
  if (loc30d >=  5_000) return 3;
  if (loc30d >=  1_000) return 2;
  if (loc30d >=    100) return 1;
  if (loc30d === 0)     return -3; // no code activity in 30d
  return 0;
}

// sortValue needs the agap + marketCap + loc30d + conviction maps passed in
function sortValue(a: SubnetAudit, key: SortKey, agapMap: Map<number, number>, mcapMap: Map<number, number | undefined>, loc30dMap: Map<number, number | undefined>, convMap: Map<number, number>): number {
  switch (key) {
    case "score":      return a.operationalScore + locAuditAdj(loc30dMap.get(a.netuid));
    case "agap":       return agapMap.get(a.netuid) ?? -1;
    case "marketCap":  return mcapMap.get(a.netuid) ?? -1;
    case "nakamoto":   return a.nakamotoCoefficient;
    case "hhi":        return a.hhiNormalized;
    case "top10":      return a.top10Share;
    case "burn":       return a.burnedEmissionPct;
    case "holders":    return a.holdersCount ?? -1;
    case "chainBuy":   return a.emissionChainBuysPct ?? -1;
    case "taoPool":    return a.taoInPool ?? -1;
    case "staleVal":   return a.staleValidatorPct;
    case "ziMiners":   return a.zeroIncentiveMinerPct;
    case "loc30d":     return loc30dMap.get(a.netuid) ?? -1;
    case "conviction": return convMap.get(a.netuid) ?? -1;
    default:           return 0;
  }
}

// ── Main page ─────────────────────────────────────────────────────
export default function AuditsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const tier = getTier(session);
  const isPremium = tier === "premium";
  const router = useRouter();
  const { isWatched, watchlist } = useWatchlist();
  const { leaderboard } = useDashboard();

  // Build netuid → aGap composite_score lookup
  const agapMap = useMemo(
    () => new Map(leaderboard.map(s => [s.netuid, s.composite_score])),
    [leaderboard]
  );

  // Build netuid → market cap (USD) from leaderboard — same source as main dashboard
  const marketCapUsdMap = useMemo(
    () => new Map(leaderboard.map(s => [s.netuid, s.market_cap as number | undefined])),
    [leaderboard]
  );

  // Build netuid → loc_30d from leaderboard (lines of code added+deleted in past 30 days)
  const loc30dMap = useMemo(
    () => new Map(leaderboard.map(s => [s.netuid, s.loc_30d])),
    [leaderboard]
  );

  // Build netuid → conviction score from leaderboard signals
  const convictionMap = useMemo(
    () => new Map(leaderboard.map(s => [
      s.netuid,
      convictionScore(s.alpha_staked_pct, s.tao_locked, s.const_buy_tao, s.const_sell_tao),
    ])),
    [leaderboard]
  );

  const [subnets, setSubnets]     = useState<SubnetAudit[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [sortKey, setSortKey]     = useState<SortKey>("score");
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("desc");

  // Only fetch real data once we know the user is premium
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!isPremium) { setLoading(false); return; }
    fetch("/api/audits")
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setSubnets(data.subnets ?? []);
        setUpdatedAt(data.updatedAt ?? null);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [sessionStatus, isPremium]);

  // Placeholder rows shown blurred to non-premium users
  const base = { grade: "B" as const, activeMinerPct: 70, trustGini: 0.3, emissionPercent: 1.2, emissionEmaPct: 1.1, marketCap: null, inflow: null, outflow: null, updatedAt: "", avgVTrust: null };
  const PREVIEW_ROWS: SubnetAudit[] = [
    { ...base, netuid: 1,  name: "Apex",         grade: "A", operationalScore: 84, nakamotoCoefficient: 12, hhiNormalized: 0.11, top10Share: 0.42, burnedEmissionPct: 0,   emissionChainBuysPct: 6.2,  holdersCount: 4821, taoInPool: 18400, staleValidatorPct: 4,  staleValidatorCount: 0, zeroIncentiveMinerPct: 18, zeroIncentiveMinerCount: 9,  validatorCount: 18, minerCount: 50, maxWeightLagBlocks: 200,  top3ValidatorTrustShare: 38, flags: [] },
    { ...base, netuid: 4,  name: "Targon",        grade: "B", operationalScore: 78, nakamotoCoefficient: 9,  hhiNormalized: 0.18, top10Share: 0.51, burnedEmissionPct: 0,   emissionChainBuysPct: 4.1,  holdersCount: 3102, taoInPool: 11200, staleValidatorPct: 8,  staleValidatorCount: 1, zeroIncentiveMinerPct: 22, zeroIncentiveMinerCount: 11, validatorCount: 12, minerCount: 50, maxWeightLagBlocks: 400,  top3ValidatorTrustShare: 44, flags: [] },
    { ...base, netuid: 9,  name: "iota",          grade: "B", operationalScore: 72, nakamotoCoefficient: 7,  hhiNormalized: 0.22, top10Share: 0.58, burnedEmissionPct: 2.1, emissionChainBuysPct: 3.4,  holdersCount: 2890, taoInPool: 9800,  staleValidatorPct: 12, staleValidatorCount: 2, zeroIncentiveMinerPct: 30, zeroIncentiveMinerCount: 15, validatorCount: 16, minerCount: 50, maxWeightLagBlocks: 800,  top3ValidatorTrustShare: 49, flags: [{ type: "stale_weights" as const, severity: "warning" as const, message: "3 validators have stale weights" }] },
    { ...base, netuid: 13, name: "Data Universe", grade: "C", operationalScore: 67, nakamotoCoefficient: 5,  hhiNormalized: 0.31, top10Share: 0.63, burnedEmissionPct: 5.3, emissionChainBuysPct: 2.1,  holdersCount: 1950, taoInPool: 7100,  staleValidatorPct: 19, staleValidatorCount: 3, zeroIncentiveMinerPct: 41, zeroIncentiveMinerCount: 21, validatorCount: 16, minerCount: 50, maxWeightLagBlocks: 1400, top3ValidatorTrustShare: 56, flags: [] },
    { ...base, netuid: 22, name: "Desearch",      grade: "C", operationalScore: 61, nakamotoCoefficient: 4,  hhiNormalized: 0.38, top10Share: 0.69, burnedEmissionPct: 8.7, emissionChainBuysPct: 1.3,  holdersCount: 1340, taoInPool: 5200,  staleValidatorPct: 25, staleValidatorCount: 4, zeroIncentiveMinerPct: 48, zeroIncentiveMinerCount: 24, validatorCount: 16, minerCount: 50, maxWeightLagBlocks: 2200, top3ValidatorTrustShare: 62, flags: [{ type: "low_nakamoto" as const, severity: "critical" as const, message: "Nakamoto coefficient below threshold" }] },
    { ...base, netuid: 64, name: "Chutes",        grade: "D", operationalScore: 55, nakamotoCoefficient: 3,  hhiNormalized: 0.45, top10Share: 0.74, burnedEmissionPct: 14,  emissionChainBuysPct: 0.8,  holdersCount: 980,  taoInPool: 3400,  staleValidatorPct: 33, staleValidatorCount: 5, zeroIncentiveMinerPct: 55, zeroIncentiveMinerCount: 28, validatorCount: 15, minerCount: 50, maxWeightLagBlocks: 3600, top3ValidatorTrustShare: 71, flags: [] },
  ];

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(SORT_DEFAULTS[key]);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = subnets.filter(s => {
      if (watchlistOnly && !watchlist.has(s.netuid)) return false;
      if (q && !s.name.toLowerCase().includes(q) && !`sn${s.netuid}`.includes(q)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const diff = sortValue(a, sortKey, agapMap, marketCapUsdMap, loc30dMap, convictionMap) - sortValue(b, sortKey, agapMap, marketCapUsdMap, loc30dMap, convictionMap);
      return sortDir === "desc" ? -diff : diff;
    });
    return list;
  }, [subnets, search, watchlistOnly, watchlist, sortKey, sortDir, agapMap, loc30dMap]);

  const fmtTime = (iso: string) => {
    try { return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }); }
    catch { return iso; }
  };

  const pageContent = (
    <div className="space-y-4">

      {/* Search + watchlist */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setWatchlistOnly(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border flex-shrink-0 transition-colors ${
            watchlistOnly ? "bg-blue-600 border-blue-500 text-white" : "bg-gray-900/60 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          My Watchlist
        </button>
        <input
          type="text"
          placeholder="Search subnets…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-48 md:w-56 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600/30"
        />
        <span className="text-xs text-gray-600 flex-shrink-0">{filtered.length} subnets</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-600 text-sm">Loading audit data…</div>
      ) : error ? (
        <div className="text-center py-16 text-gray-600 text-sm">
          {error.includes("first cron run") ? "Audit data not yet available — runs every 6 hours." : `Error: ${error}`}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600 text-sm">No subnets match your search.</div>
      ) : (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-x-auto">
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-950/40">
                  {/* Fixed left: rank + subnet */}
                  <th className="px-2 py-2 text-left w-6 text-xs text-gray-600 uppercase tracking-wide">#</th>
                  <th className="px-2 py-2 text-left text-xs text-gray-600 uppercase tracking-wide min-w-[130px]">Subnet</th>

                  {/* Audit Score */}
                  <ColHeader label="Audit Score" sub="0-100"
                    tooltip="Operational health score (0–100) built from on-chain metagraph data and TaoSwap metrics: decentralisation, miner burn economics, validator freshness, liquidity, and adoption. Includes a small ±4 pt adjustment for 30-day code volume. Higher is better."
                    onClick={() => handleSort("score")} sorted={sortKey === "score"} />

                  {/* aGap Score */}
                  <ColHeader label="aGap Score" sub="composite"
                    tooltip="AlphaGap's composite intelligence score combining developer activity (GitHub commits, model releases), on-chain fundamentals, and market signals. This is our overall subnet quality rating."
                    onClick={() => handleSort("agap")} sorted={sortKey === "agap"} />

                  {/* Market Cap */}
                  <ColHeader label="Mkt Cap" sub="USD"
                    tooltip="Total market capitalisation of this subnet's alpha token in USD. Calculated as token price × circulating supply."
                    onClick={() => handleSort("marketCap")} sorted={sortKey === "marketCap"} />

                  {/* Conviction */}
                  <ColHeader label="Conviction" sub="BIT-0011"
                    tooltip="On-chain commitment score (0–100) based on BIT-0011 Conviction mechanics. Scores alpha staked % (locked supply not in DEX), TAO pool depth, and team net-buy activity. High conviction = more capital locked, harder to exit silently."
                    onClick={() => handleSort("conviction")} sorted={sortKey === "conviction"} />

                  {/* Holders */}
                  <ColHeader label="Holders" sub="unique addrs"
                    tooltip="Number of unique wallet addresses holding this subnet's alpha token. A rough proxy for community size and real-world adoption."
                    onClick={() => handleSort("holders")} sorted={sortKey === "holders"} />

                  {/* Decentralisation */}
                  <ColHeader label="Nakamoto" sub="higher=safer"
                    tooltip="Minimum number of validators needed to collude and control 51% of the network. Higher means more decentralised and harder to attack. Anything below 3 is a critical risk."
                    onClick={() => handleSort("nakamoto")} sorted={sortKey === "nakamoto"} />
                  <ColHeader label="HHI" sub="lower=better"
                    tooltip="Herfindahl-Hirschman Index — measures stake concentration. 0 = perfectly competitive, 1 = complete monopoly. Below 0.20 is healthy; above 0.50 is a red flag."
                    onClick={() => handleSort("hhi")} sorted={sortKey === "hhi"} />
                  <ColHeader label="Top 10%" sub="supply held"
                    tooltip="Percentage of the total alpha token supply held by the top 10 wallet addresses. Lower means ownership is more distributed across the community."
                    onClick={() => handleSort("top10")} sorted={sortKey === "top10"} />

                  {/* Emission economics */}
                  <ColHeader label="Miner Burn" sub="% emiss burned"
                    tooltip="Percentage of miner emissions that are burned instead of paid out. Very high burn (80%+) means miners are net losers and may leave. 0% is ideal — miners keep all rewards."
                    onClick={() => handleSort("burn")} sorted={sortKey === "burn"} />
                  <ColHeader label="Chain Buy%" sub="emiss recycled"
                    tooltip="Percentage of emissions that are recycled back into buying the subnet's own token on-chain. This creates organic buy pressure. Higher is generally better for token holders."
                    onClick={() => handleSort("chainBuy")} sorted={sortKey === "chainBuy"} />

                  {/* Capital */}
                  <ColHeader label="TAO Pool" sub="liquidity"
                    tooltip="Total TAO locked in this subnet's liquidity pool. More liquidity means tighter spreads, less price impact when buying or selling, and generally more market confidence."
                    onClick={() => handleSort("taoPool")} sorted={sortKey === "taoPool"} />

                  {/* Metagraph health */}
                  <ColHeader label="Stale Val%" sub=">24h behind"
                    tooltip="Percentage of validators whose on-chain weights are more than 24 hours old. High staleness means validators aren't actively scoring miners — a sign of neglect or automation failure."
                    onClick={() => handleSort("staleVal")} sorted={sortKey === "staleVal"} />
                  <ColHeader label="ZI Miners%" sub="zero incentive"
                    tooltip="Percentage of registered miners currently receiving zero incentive. High values mean many registered miners aren't contributing useful work, wasting network slots."
                    onClick={() => handleSort("ziMiners")} sorted={sortKey === "ziMiners"} />
                  <ColHeader label="VTrust" sub="validator align"
                    tooltip="Average validator trust score (0–1.0) across all validators. Measures how aligned each validator's weight-setting is with the honest stake-weighted majority. 1.0 = perfect consensus. Low VTrust means validators disagree on which miners are good — often a sign of manipulation, spam, or poor coordination." />


                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filtered.map((audit, i) => {
                  const watched  = isWatched(audit.netuid);

                  const critFlags = audit.flags.filter(f => f.severity === "critical");

                  return (
                    <tr
                      key={audit.netuid}
                      onClick={() => router.push(`/subnets/${audit.netuid}`)}
                      className={`cursor-pointer transition-colors ${
                        watched ? "bg-blue-950/30 hover:bg-blue-950/50" :
                        critFlags.length > 0 ? "bg-red-950/10 hover:bg-red-950/20" :
                        "hover:bg-gray-800/30"
                      }`}
                    >
                      {/* Rank */}
                      <td className="px-2 py-2 text-gray-600 text-sm tabular-nums text-center">{i + 1}</td>

                      {/* Subnet name */}
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <SubnetLogo netuid={audit.netuid} name={audit.name} size={24} />
                          <div>
                            <button
                              onClick={e => { e.stopPropagation(); router.push(`/subnets/${audit.netuid}`); }}
                              className="font-semibold text-white hover:text-green-400 transition-colors text-sm leading-tight block text-left"
                            >
                              {audit.name}
                            </button>
                            <span className="text-xs text-gray-600 font-mono">SN{audit.netuid}</span>
                          </div>
                          {watched && <span className="text-blue-400 text-xs">●</span>}
                        </div>
                      </td>

                      {/* Audit Score (includes small LOC adjustment) */}
                      <td className="px-1.5 py-2 text-right">
                        <div className="flex justify-end">
                          <ScoreBadge score={Math.max(0, Math.min(100, audit.operationalScore + locAuditAdj(loc30dMap.get(audit.netuid))))} />
                        </div>
                      </td>

                      {/* aGap Score */}
                      <td className="px-1.5 py-2 text-right">
                        {(() => {
                          const agap = agapMap.get(audit.netuid);
                          if (agap == null) return <span className="text-gray-600">—</span>;
                          return (
                            <span className={`tabular-nums font-semibold text-sm ${agap >= 70 ? "text-emerald-400" : agap >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                              {Math.round(agap)}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Market Cap */}
                      <td className="px-1.5 py-2 text-right">
                        {(() => {
                          const mcap = marketCapUsdMap.get(audit.netuid);
                          if (mcap == null) return <span className="text-gray-600 text-sm">—</span>;
                          return <span className="text-gray-300 tabular-nums text-sm">${formatNum(mcap)}</span>;
                        })()}
                      </td>

                      {/* Conviction score */}
                      <td className="px-1.5 py-2 text-right">
                        {(() => {
                          const cv = convictionMap.get(audit.netuid);
                          if (cv == null) return <span className="text-gray-600 text-sm">—</span>;
                          const label = cv >= 70 ? "HIGH" : cv >= 40 ? "MED" : "LOW";
                          const cls =
                            cv >= 70 ? "text-emerald-400" :
                            cv >= 40 ? "text-yellow-400" :
                            "text-red-400";
                          return (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={`tabular-nums font-bold text-sm ${cls}`}>{cv}</span>
                              <span className={`text-[9px] font-semibold uppercase tracking-wide ${cls} opacity-70`}>{label}</span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Holders */}
                      <td className="px-1.5 py-2 text-right">
                        <CellVal
                          value={fmtK(audit.holdersCount)}
                          raw={audit.holdersCount}
                          dir="high_good"
                          thresholds={[500, 2000]}
                        />
                      </td>

                      {/* Nakamoto */}
                      <td className="px-1.5 py-2 text-right">
                        <CellVal
                          value={audit.nakamotoCoefficient > 0 ? String(audit.nakamotoCoefficient) : "—"}
                          raw={audit.nakamotoCoefficient}
                          dir="high_good"
                          thresholds={[5, 10]}
                        />
                      </td>

                      {/* HHI */}
                      <td className="px-1.5 py-2 text-right">
                        <CellVal
                          value={num(audit.hhiNormalized)}
                          raw={audit.hhiNormalized}
                          dir="low_good"
                          thresholds={[0.20, 0.50]}
                        />
                      </td>

                      {/* Top 10% */}
                      <td className="px-1.5 py-2 text-right">
                        <CellVal
                          value={pct(audit.top10Share * 100, 1)}
                          raw={audit.top10Share * 100}
                          dir="low_good"
                          thresholds={[60, 80]}
                        />
                      </td>

                      {/* Miner burn % */}
                      <td className="px-1.5 py-2 text-right">
                        <CellVal
                          value={pct(audit.burnedEmissionPct, 1)}
                          raw={audit.burnedEmissionPct}
                          dir="low_good"
                          thresholds={[30, 70]}
                        />
                      </td>

                      {/* Chain buy % */}
                      <td className="px-1.5 py-2 text-right">
                        <CellVal
                          value={pct(audit.emissionChainBuysPct, 1)}
                          raw={audit.emissionChainBuysPct ?? 0}
                          dir="high_good"
                          thresholds={[1, 8]}
                        />
                      </td>


                      {/* TAO Pool */}
                      <td className="px-1.5 py-2 text-right">
                        <span className="text-gray-300 tabular-nums text-sm">{fmtTao(audit.taoInPool)}</span>
                      </td>

                      {/* Stale validators % */}
                      <td className="px-1.5 py-2 text-right">
                        <CellVal
                          value={pct(audit.staleValidatorPct, 0)}
                          raw={audit.staleValidatorPct}
                          dir="low_good"
                          thresholds={[30, 70]}
                        />
                      </td>

                      {/* Zero-incentive miners % */}
                      <td className="px-1.5 py-2 text-right">
                        <CellVal
                          value={pct(audit.zeroIncentiveMinerPct, 0)}
                          raw={audit.zeroIncentiveMinerPct}
                          dir="low_good"
                          thresholds={[40, 80]}
                        />
                      </td>

                      {/* VTrust — avg validator trust alignment */}
                      <td className="px-1.5 py-2 text-right">
                        {audit.avgVTrust != null ? (
                          <CellVal
                            value={audit.avgVTrust.toFixed(2)}
                            raw={audit.avgVTrust}
                            dir="high_good"
                            thresholds={[0.5, 0.8]}
                          />
                        ) : (
                          <span className="text-gray-600 text-sm">—</span>
                        )}
                      </td>


                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-gray-600 px-1 flex-wrap">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-400" /> Good</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-yellow-400" /> Caution</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-400" /> Risk</span>
        <span className="ml-2">Click any column header to sort · Click a row to view subnet</span>
      </div>
    </div>
  );

  // Session still loading — show nothing to avoid flash
  if (sessionStatus === "loading") {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-gray-600 text-sm">Loading…</div>
      </main>
    );
  }

  // Gated — render blurred preview + overlay (same pattern as power rankings)
  if (!session || !isPremium) {
    const isSignedOut = !session;
    // Build a fake filtered list using placeholder data
    const previewTable = (
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-950/40">
                <th className="px-3 py-2.5 text-left w-8 text-xs text-gray-600 uppercase tracking-wide">#</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-600 uppercase tracking-wide min-w-[140px]">Subnet</th>
                <th className="px-2.5 py-2 text-right text-xs text-gray-600 uppercase tracking-wide">Audit Score</th>
                <th className="px-2.5 py-2 text-right text-xs text-gray-600 uppercase tracking-wide">aGap</th>
                <th className="px-2.5 py-2 text-right text-xs text-gray-600 uppercase tracking-wide">Mkt Cap</th>
                <th className="px-2.5 py-2 text-right text-xs text-gray-600 uppercase tracking-wide">Holders</th>
                <th className="px-2.5 py-2 text-right text-xs text-gray-600 uppercase tracking-wide">Nakamoto</th>
                <th className="px-2.5 py-2 text-right text-xs text-gray-600 uppercase tracking-wide">HHI</th>
                <th className="px-2.5 py-2 text-right text-xs text-gray-600 uppercase tracking-wide">Miner Burn</th>
                <th className="px-2.5 py-2 text-right text-xs text-gray-600 uppercase tracking-wide">Stale Val%</th>
                <th className="px-2.5 py-2 text-right text-xs text-gray-600 uppercase tracking-wide">ZI Miners%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {PREVIEW_ROWS.map((audit, i) => {
                const agap = agapMap.get(audit.netuid);
                const mcap = marketCapUsdMap.get(audit.netuid);
                return (
                  <tr key={audit.netuid} className="hover:bg-gray-800/20">
                    <td className="px-2 py-2 text-gray-600 text-sm tabular-nums text-center">{i + 1}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <SubnetLogo netuid={audit.netuid} name={audit.name} size={24} />
                        <div>
                          <div className="font-semibold text-white text-sm">{audit.name}</div>
                          <div className="text-xs text-gray-600 font-mono">SN{audit.netuid}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-1.5 py-2 text-right"><div className="flex justify-end"><ScoreBadge score={audit.operationalScore} /></div></td>
                    <td className="px-1.5 py-2 text-right">
                      {agap != null ? <span className={`tabular-nums font-semibold text-sm ${agap >= 70 ? "text-emerald-400" : agap >= 40 ? "text-yellow-400" : "text-red-400"}`}>{Math.round(agap)}</span> : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-1.5 py-2 text-right">
                      {mcap != null ? <span className="text-gray-300 tabular-nums text-sm">${formatNum(mcap)}</span> : <span className="text-gray-600 text-sm">—</span>}
                    </td>
                    <td className="px-1.5 py-2 text-right"><CellVal value={fmtK(audit.holdersCount)} raw={audit.holdersCount} dir="high_good" thresholds={[500, 2000]} /></td>
                    <td className="px-1.5 py-2 text-right"><CellVal value={String(audit.nakamotoCoefficient)} raw={audit.nakamotoCoefficient} dir="high_good" thresholds={[5, 10]} /></td>
                    <td className="px-1.5 py-2 text-right"><CellVal value={num(audit.hhiNormalized)} raw={audit.hhiNormalized} dir="low_good" thresholds={[0.20, 0.50]} /></td>
                    <td className="px-1.5 py-2 text-right"><CellVal value={pct(audit.burnedEmissionPct, 1)} raw={audit.burnedEmissionPct} dir="low_good" thresholds={[30, 70]} /></td>
                    <td className="px-1.5 py-2 text-right"><CellVal value={pct(audit.staleValidatorPct, 0)} raw={audit.staleValidatorPct} dir="low_good" thresholds={[30, 70]} /></td>
                    <td className="px-1.5 py-2 text-right"><CellVal value={pct(audit.zeroIncentiveMinerPct, 0)} raw={audit.zeroIncentiveMinerPct} dir="low_good" thresholds={[40, 80]} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );

    return (
      <main className="flex-1 overflow-auto">

        {/* ── Hero header ─────────────────────────────────────────── */}
        <div className="relative overflow-hidden border-b border-gray-800/50">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          <div className="absolute -top-20 left-1/4 w-96 h-96 bg-green-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative max-w-screen-2xl mx-auto px-4 md:px-6 pt-10 pb-7">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 via-emerald-300 to-white bg-clip-text text-transparent">
                🔍 Subnet Audits
              </h1>
              <span className="text-xs bg-yellow-900/50 text-yellow-400 border border-yellow-800/40 rounded-full px-2 py-0.5 font-medium">Premium</span>
            </div>
            <p className="text-gray-500 text-sm max-w-2xl mb-5">
              Deep operational health across every active subnet — decentralisation scores, miner burn economics, validator freshness, liquidity, and adoption. On-chain data you can't get anywhere else.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: "Decentralisation", icon: "🌐" },
                { label: "Miner Economics", icon: "⛏️" },
                { label: "Validator Health", icon: "✅" },
                { label: "Liquidity", icon: "💧" },
              ].map(({ label, icon }) => (
                <span key={label} className="text-xs bg-gray-800/60 border border-gray-700/40 rounded-full px-3 py-1.5 text-gray-400">
                  {icon} {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6 space-y-5">

          {/* Blurred preview + overlay */}
          <div className="relative">
            {/* Blurred table preview */}
            <div className="blur-sm pointer-events-none select-none opacity-60">
              {previewTable}
            </div>

            {/* Gradient fade at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none" />

            {/* Overlay CTA */}
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="bg-gray-950/90 border border-gray-700/60 rounded-2xl p-6 md:p-8 text-center max-w-sm mx-4 shadow-2xl backdrop-blur-sm">
                <div className="text-4xl mb-3">📊</div>
                <h2 className="text-lg font-bold text-white mb-2">Subnet Audits</h2>
                <p className="text-gray-400 text-sm mb-1 leading-relaxed">
                  Deep operational intelligence — decentralisation scores, miner burn economics, validator health, and more across all {PREVIEW_ROWS.length > 0 ? "119" : ""} active subnets.
                </p>
                <p className="text-gray-500 text-xs mb-5">
                  {isSignedOut ? "Sign in to access. Available on Premium." : "Available on Premium only."}
                </p>
                {isSignedOut ? (
                  <div className="flex flex-col gap-2">
                    <Link
                      href="/subscribe"
                      className="block w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-bold rounded-xl transition-all shadow-lg shadow-green-500/30 text-sm"
                    >
                      Upgrade to Premium →
                    </Link>
                    <Link
                      href="/auth/signin"
                      className="block w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors text-sm border border-gray-700"
                    >
                      Sign In
                    </Link>
                  </div>
                ) : (
                  <Link
                    href="/subscribe"
                    className="block w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-bold rounded-xl transition-all shadow-lg shadow-green-500/30 text-sm"
                  >
                    Upgrade to Premium →
                  </Link>
                )}
                <p className="text-xs text-gray-600 mt-3">Premium · $49/mo · Includes all Pro features</p>
              </div>
            </div>
          </div>

        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto">

      {/* ── Hero header ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-gray-800/50">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="absolute -top-20 left-1/4 w-96 h-96 bg-green-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-screen-2xl mx-auto px-4 md:px-6 pt-10 pb-7">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 via-emerald-300 to-white bg-clip-text text-transparent">
              🔍 Subnet Audits
            </h1>
          </div>
          <p className="text-gray-500 text-sm max-w-2xl mb-5">
            Deep operational health across every active subnet — decentralisation, miner burn economics, validator freshness, liquidity and adoption. Click any column header to sort.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: "Decentralisation", icon: "🌐" },
              { label: "Miner Economics", icon: "⛏️" },
              { label: "Validator Health", icon: "✅" },
              { label: "Liquidity", icon: "💧" },
            ].map(({ label, icon }) => (
              <span key={label} className="text-xs bg-gray-800/60 border border-gray-700/40 rounded-full px-3 py-1.5 text-gray-400">
                {icon} {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full px-4 md:px-8 py-6 space-y-5">

        {pageContent}

      </div>
    </main>
  );
}
