"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import BlurGate from "@/components/BlurGate";
import { getTier } from "@/lib/subscription";
import { useWatchlist } from "@/components/dashboard/WatchlistProvider";
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
  if (value === "—") return <span className="text-gray-600">—</span>;
  if (raw == null || dir === "neutral") return <span className="text-gray-300 tabular-nums">{value}</span>;

  const [warn, crit] = thresholds ?? [50, 80];
  let cls = "text-emerald-400";

  if (dir === "high_good") {
    if      (raw <= crit)  cls = "text-red-400";
    else if (raw <= warn)  cls = "text-yellow-400";
    else                   cls = "text-emerald-400";
  } else {
    // low_good — lower is better
    if      (raw >= crit)  cls = "text-red-400";
    else if (raw >= warn)  cls = "text-yellow-400";
    else                   cls = "text-emerald-400";
  }

  return <span className={`tabular-nums font-medium ${cls}`}>{value}</span>;
}

// ── Column header ─────────────────────────────────────────────────
function ColHeader({ label, sub, onClick, sorted }: { label: string; sub?: string; onClick?: () => void; sorted?: boolean }) {
  return (
    <th
      className={`px-2.5 py-2 text-right whitespace-nowrap cursor-pointer select-none group ${sorted ? "text-green-400" : "text-gray-500 hover:text-gray-300"} transition-colors`}
      onClick={onClick}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide">{label}</div>
      {sub && <div className="text-[9px] font-normal text-gray-600 group-hover:text-gray-500">{sub}</div>}
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
  | "score" | "nakamoto" | "hhi" | "top10" | "burn"
  | "holders" | "chainBuy" | "netFlow" | "emission"
  | "ema" | "taoPool" | "staleVal" | "ziMiners" | "gini";

const SORT_DEFAULTS: Record<SortKey, "asc" | "desc"> = {
  score: "desc", nakamoto: "desc", hhi: "asc", top10: "asc", burn: "asc",
  holders: "desc", chainBuy: "desc", netFlow: "desc", emission: "desc",
  ema: "desc", taoPool: "desc", staleVal: "asc", ziMiners: "asc", gini: "asc",
};

function sortValue(a: SubnetAudit, key: SortKey): number {
  switch (key) {
    case "score":    return a.operationalScore;
    case "nakamoto": return a.nakamotoCoefficient;
    case "hhi":      return a.hhiNormalized;
    case "top10":    return a.top10Share;
    case "burn":     return a.burnedEmissionPct;
    case "holders":  return a.holdersCount ?? -1;
    case "chainBuy": return a.emissionChainBuysPct ?? -1;
    case "netFlow":  return (a.inflow ?? 0) - (a.outflow ?? 0);
    case "emission": return a.emissionPercent ?? -1;
    case "ema":      return a.emissionEmaPct ?? -1;
    case "taoPool":  return a.taoInPool ?? -1;
    case "staleVal": return a.staleValidatorPct;
    case "ziMiners": return a.zeroIncentiveMinerPct;
    case "gini":     return a.trustGini;
    default:         return 0;
  }
}

// ── Main page ─────────────────────────────────────────────────────
export default function AuditsPage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const router = useRouter();
  const { isWatched, watchlist } = useWatchlist();

  const [subnets, setSubnets]     = useState<SubnetAudit[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [expandedRow, setExpandedRow]     = useState<number | null>(null);
  const [sortKey, setSortKey]     = useState<SortKey>("score");
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/audits")
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setSubnets(data.subnets ?? []);
        setUpdatedAt(data.updatedAt ?? null);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

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
      const diff = sortValue(a, sortKey) - sortValue(b, sortKey);
      return sortDir === "desc" ? -diff : diff;
    });
    return list;
  }, [subnets, search, watchlistOnly, watchlist, sortKey, sortDir]);

  // Summary stats
  const avgScore    = subnets.length ? Math.round(subnets.reduce((s, a) => s + a.operationalScore, 0) / subnets.length) : 0;
  const critCount   = subnets.filter(s => s.flags.some(f => f.severity === "critical")).length;
  const avgNakamoto = subnets.length ? Math.round(subnets.reduce((s, a) => s + a.nakamotoCoefficient, 0) / subnets.length) : 0;
  const zeroBurnCount = subnets.filter(s => s.burnedEmissionPct === 0).length;

  const fmtTime = (iso: string) => {
    try { return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }); }
    catch { return iso; }
  };

  const pageContent = (
    <div className="space-y-4">

      {/* Stats strip */}
      {subnets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Subnets Audited",    value: `${subnets.length}`,    sub: "all active subnets" },
            { label: "Avg Audit Score",    value: `${avgScore}/100`,      sub: "ecosystem health" },
            { label: "Avg Nakamoto",       value: `${avgNakamoto}`,       sub: "decentralisation" },
            { label: "Zero Emission Burn", value: `${zeroBurnCount}`,     sub: "fully sustainable subnets" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className="text-xl font-bold text-white">{value}</div>
              <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search + watchlist */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search subnets…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600/30"
        />
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
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1200px]">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-950/40">
                  {/* Fixed left: rank + subnet */}
                  <th className="px-3 py-2.5 text-left w-8 text-[10px] text-gray-600 uppercase tracking-wide">#</th>
                  <th className="px-3 py-2.5 text-left text-[10px] text-gray-600 uppercase tracking-wide min-w-[160px]">Subnet</th>

                  {/* Score */}
                  <ColHeader label="Score" sub="0-100" onClick={() => handleSort("score")} sorted={sortKey === "score"} />

                  {/* Decentralisation */}
                  <ColHeader label="Nakamoto" sub="higher=safer" onClick={() => handleSort("nakamoto")} sorted={sortKey === "nakamoto"} />
                  <ColHeader label="HHI" sub="lower=better" onClick={() => handleSort("hhi")} sorted={sortKey === "hhi"} />
                  <ColHeader label="Top 10%" sub="supply held" onClick={() => handleSort("top10")} sorted={sortKey === "top10"} />

                  {/* Emission economics */}
                  <ColHeader label="Miner Burn" sub="% emiss burned" onClick={() => handleSort("burn")} sorted={sortKey === "burn"} />
                  <ColHeader label="Chain Buy%" sub="emiss recycled" onClick={() => handleSort("chainBuy")} sorted={sortKey === "chainBuy"} />
                  <ColHeader label="Emission%" sub="of network" onClick={() => handleSort("emission")} sorted={sortKey === "emission"} />
                  <ColHeader label="EMA%" sub="7d taoflow" onClick={() => handleSort("ema")} sorted={sortKey === "ema"} />

                  {/* Capital */}
                  <ColHeader label="TAO Pool" sub="liquidity" onClick={() => handleSort("taoPool")} sorted={sortKey === "taoPool"} />
                  <ColHeader label="Net Flow" sub="in − out" onClick={() => handleSort("netFlow")} sorted={sortKey === "netFlow"} />

                  {/* Adoption */}
                  <ColHeader label="Holders" sub="unique addrs" onClick={() => handleSort("holders")} sorted={sortKey === "holders"} />

                  {/* Metagraph health */}
                  <ColHeader label="Stale Val%" sub=">24h behind" onClick={() => handleSort("staleVal")} sorted={sortKey === "staleVal"} />
                  <ColHeader label="ZI Miners%" sub="zero incentive" onClick={() => handleSort("ziMiners")} sorted={sortKey === "ziMiners"} />
                  <ColHeader label="Gini" sub="trust conc." onClick={() => handleSort("gini")} sorted={sortKey === "gini"} />

                  {/* Expand */}
                  <th className="px-2 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filtered.map((audit, i) => {
                  const watched  = isWatched(audit.netuid);
                  const expanded = expandedRow === audit.netuid;
                  const netFlow  = (audit.inflow ?? 0) - (audit.outflow ?? 0);
                  const critFlags = audit.flags.filter(f => f.severity === "critical");

                  return (
                    <>
                    <tr
                      key={audit.netuid}
                      onClick={() => setExpandedRow(expanded ? null : audit.netuid)}
                      className={`cursor-pointer transition-colors ${
                        watched ? "bg-blue-950/30 hover:bg-blue-950/50" :
                        critFlags.length > 0 ? "bg-red-950/10 hover:bg-red-950/20" :
                        "hover:bg-gray-800/30"
                      }`}
                    >
                      {/* Rank */}
                      <td className="px-3 py-3 text-gray-600 text-xs tabular-nums text-center">{i + 1}</td>

                      {/* Subnet name */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <SubnetLogo netuid={audit.netuid} name={audit.name} size={24} />
                          <div>
                            <button
                              onClick={e => { e.stopPropagation(); router.push(`/subnets/${audit.netuid}`); }}
                              className="font-semibold text-white hover:text-green-400 transition-colors text-sm leading-tight block text-left"
                            >
                              {audit.name}
                            </button>
                            <span className="text-[10px] text-gray-600 font-mono">SN{audit.netuid}</span>
                          </div>
                          {watched && <span className="text-blue-400 text-xs">●</span>}
                        </div>
                      </td>

                      {/* Score */}
                      <td className="px-2.5 py-3 text-right">
                        <div className="flex justify-end">
                          <ScoreBadge score={audit.operationalScore} />
                        </div>
                      </td>

                      {/* Nakamoto */}
                      <td className="px-2.5 py-3 text-right">
                        <CellVal
                          value={audit.nakamotoCoefficient > 0 ? String(audit.nakamotoCoefficient) : "—"}
                          raw={audit.nakamotoCoefficient}
                          dir="high_good"
                          thresholds={[5, 10]}
                        />
                      </td>

                      {/* HHI */}
                      <td className="px-2.5 py-3 text-right">
                        <CellVal
                          value={num(audit.hhiNormalized)}
                          raw={audit.hhiNormalized}
                          dir="low_good"
                          thresholds={[0.20, 0.50]}
                        />
                      </td>

                      {/* Top 10% */}
                      <td className="px-2.5 py-3 text-right">
                        <CellVal
                          value={pct(audit.top10Share * 100, 1)}
                          raw={audit.top10Share * 100}
                          dir="low_good"
                          thresholds={[60, 80]}
                        />
                      </td>

                      {/* Miner burn % */}
                      <td className="px-2.5 py-3 text-right">
                        <CellVal
                          value={pct(audit.burnedEmissionPct, 1)}
                          raw={audit.burnedEmissionPct}
                          dir="low_good"
                          thresholds={[30, 70]}
                        />
                      </td>

                      {/* Chain buy % */}
                      <td className="px-2.5 py-3 text-right">
                        <CellVal
                          value={pct(audit.emissionChainBuysPct, 1)}
                          raw={audit.emissionChainBuysPct ?? 0}
                          dir="high_good"
                          thresholds={[10, 30]}
                        />
                      </td>

                      {/* Emission % */}
                      <td className="px-2.5 py-3 text-right">
                        <span className="text-gray-300 tabular-nums text-xs">
                          {pct(audit.emissionPercent, 2)}
                        </span>
                      </td>

                      {/* EMA % */}
                      <td className="px-2.5 py-3 text-right">
                        <span className="text-gray-300 tabular-nums text-xs">
                          {pct(audit.emissionEmaPct, 2)}
                        </span>
                      </td>

                      {/* TAO Pool */}
                      <td className="px-2.5 py-3 text-right">
                        <span className="text-gray-300 tabular-nums text-xs">{fmtTao(audit.taoInPool)}</span>
                      </td>

                      {/* Net flow */}
                      <td className="px-2.5 py-3 text-right">
                        {(audit.inflow != null || audit.outflow != null) ? (
                          <span className={`tabular-nums text-xs font-medium ${netFlow > 0 ? "text-emerald-400" : netFlow < 0 ? "text-red-400" : "text-gray-500"}`}>
                            {netFlow >= 0 ? "+" : ""}{fmtTao(netFlow)}
                          </span>
                        ) : <span className="text-gray-600">—</span>}
                      </td>

                      {/* Holders */}
                      <td className="px-2.5 py-3 text-right">
                        <CellVal
                          value={fmtK(audit.holdersCount)}
                          raw={audit.holdersCount}
                          dir="high_good"
                          thresholds={[500, 2000]}
                        />
                      </td>

                      {/* Stale validators % */}
                      <td className="px-2.5 py-3 text-right">
                        <CellVal
                          value={pct(audit.staleValidatorPct, 0)}
                          raw={audit.staleValidatorPct}
                          dir="low_good"
                          thresholds={[30, 70]}
                        />
                      </td>

                      {/* Zero-incentive miners % */}
                      <td className="px-2.5 py-3 text-right">
                        <CellVal
                          value={pct(audit.zeroIncentiveMinerPct, 0)}
                          raw={audit.zeroIncentiveMinerPct}
                          dir="low_good"
                          thresholds={[40, 80]}
                        />
                      </td>

                      {/* Trust Gini */}
                      <td className="px-2.5 py-3 text-right">
                        <CellVal
                          value={audit.trustGini.toFixed(2)}
                          raw={audit.trustGini}
                          dir="low_good"
                          thresholds={[0.5, 0.75]}
                        />
                      </td>

                      {/* Expand chevron */}
                      <td className="px-2 py-3 text-center">
                        <svg
                          className={`w-3.5 h-3.5 text-gray-600 mx-auto transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {expanded && (
                      <tr key={`${audit.netuid}-detail`}>
                        <td colSpan={18} className="p-0">
                          <ExpandedDetail audit={audit} />
                        </td>
                      </tr>
                    )}
                    </>
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
        <span className="ml-2">Click any column header to sort · Click a row to expand flags</span>
      </div>
    </div>
  );

  return (
    <main className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-screen-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Subnet Audits</h1>
            <p className="text-sm text-gray-500 mt-1">
              Composite operational health across every active subnet — decentralisation, miner economics, validator freshness, liquidity and adoption. Click any column to sort.
            </p>
          </div>
          {updatedAt && (
            <div className="shrink-0 text-right">
              <div className="text-[10px] text-gray-600 uppercase tracking-wider">Last updated</div>
              <div className="text-xs text-gray-400 mt-0.5">{fmtTime(updatedAt)}</div>
            </div>
          )}
        </div>

        <BlurGate tier={tier} required="premium" label="Unlock Subnet Audits →" minHeight="400px">
          {pageContent}
        </BlurGate>

      </div>
    </main>
  );
}
