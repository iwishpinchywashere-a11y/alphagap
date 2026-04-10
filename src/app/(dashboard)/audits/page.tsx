"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import BlurGate from "@/components/BlurGate";
import { getTier } from "@/lib/subscription";
import type { SubnetAudit, AuditFlag } from "@/app/api/cron/audit-scan/route";

// ── Helpers ──────────────────────────────────────────────────────
const GRADE_COLOR: Record<string, string> = {
  A: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  B: "text-teal-400 bg-teal-500/10 border-teal-500/30",
  C: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  D: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  F: "text-red-400 bg-red-500/10 border-red-500/30",
};
const GRADE_BAR: Record<string, string> = {
  A: "bg-emerald-500",
  B: "bg-teal-400",
  C: "bg-yellow-400",
  D: "bg-orange-400",
  F: "bg-red-500",
};
const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  warning:  "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  info:     "text-gray-400 bg-gray-800/50 border-gray-700/30",
};
const FLAG_ICON: Record<string, string> = {
  burn_code:      "🔥",
  stale_weights:  "⏱",
  collusion_risk: "⚠",
  low_activity:   "📉",
  no_validators:  "🚫",
  healthy:        "✓",
};

function ScoreBar({ value, grade }: { value: number; grade: string }) {
  return (
    <div className="relative h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${GRADE_BAR[grade] ?? "bg-gray-500"}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function MetricPill({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 border text-center ${warn ? "bg-red-500/5 border-red-500/20" : "bg-gray-900/60 border-gray-800"}`}>
      <div className={`text-xs font-mono font-semibold tabular-nums ${warn ? "text-red-400" : "text-white"}`}>{value}</div>
      <div className="text-[10px] text-gray-600 mt-0.5 whitespace-nowrap">{label}</div>
    </div>
  );
}

// ── AuditCard ────────────────────────────────────────────────────
function AuditCard({ audit }: { audit: SubnetAudit }) {
  const [expanded, setExpanded] = useState(false);
  const critFlags = audit.flags.filter(f => f.severity === "critical");
  const warnFlags = audit.flags.filter(f => f.severity === "warning");
  const hasCritical = critFlags.length > 0;

  return (
    <div className={`bg-gray-900/50 border rounded-xl overflow-hidden transition-all ${
      hasCritical ? "border-red-500/30" : audit.grade === "A" ? "border-emerald-500/20" : "border-gray-800"
    }`}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-800/30 transition-colors text-left"
      >
        {/* Grade badge */}
        <span className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center text-sm font-bold ${GRADE_COLOR[audit.grade] ?? ""}`}>
          {audit.grade}
        </span>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{audit.name}</span>
            <span className="text-xs text-gray-600">SN{audit.netuid}</span>
          </div>
          <div className="mt-1.5 w-48">
            <ScoreBar value={audit.operationalScore} grade={audit.grade} />
          </div>
        </div>

        {/* Score */}
        <span className={`shrink-0 text-lg font-bold tabular-nums ${
          audit.grade === "A" ? "text-emerald-400" :
          audit.grade === "B" ? "text-teal-400" :
          audit.grade === "C" ? "text-yellow-400" :
          audit.grade === "D" ? "text-orange-400" : "text-red-400"
        }`}>{audit.operationalScore}</span>

        {/* Flag summary */}
        <div className="shrink-0 flex gap-1">
          {critFlags.length > 0 && (
            <span className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5">
              {critFlags.length} critical
            </span>
          )}
          {warnFlags.length > 0 && (
            <span className="text-[10px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded px-1.5 py-0.5">
              {warnFlags.length} warn
            </span>
          )}
        </div>

        {/* Expand chevron */}
        <svg
          className={`w-4 h-4 text-gray-600 shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-800/50 space-y-4">
          {/* Metric pills */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricPill
              label="Stale Validators"
              value={`${audit.staleValidatorPct}%`}
              warn={audit.staleValidatorPct >= 50}
            />
            <MetricPill
              label="Zero-Incentive Miners"
              value={`${audit.zeroIncentiveMinerPct}%`}
              warn={audit.zeroIncentiveMinerPct >= 60}
            />
            <MetricPill
              label="Trust Gini"
              value={audit.trustGini.toFixed(2)}
              warn={audit.trustGini >= 0.75}
            />
            <MetricPill
              label="Top-3 Trust Share"
              value={`${audit.top3ValidatorTrustShare}%`}
              warn={audit.top3ValidatorTrustShare >= 70}
            />
          </div>

          {/* Validator / Miner counts */}
          <div className="grid grid-cols-2 gap-3">
            {/* Validator staleness bar */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Validators</span>
                <span className="text-xs text-gray-400">
                  {audit.validatorCount - audit.staleValidatorCount} fresh / {audit.validatorCount} total
                </span>
              </div>
              <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                {audit.validatorCount > 0 && (
                  <>
                    <div
                      className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full"
                      style={{ width: `${((audit.validatorCount - audit.staleValidatorCount) / audit.validatorCount) * 100}%` }}
                    />
                    {audit.staleValidatorPct > 0 && (
                      <div
                        className="absolute inset-y-0 bg-orange-400/70 rounded-full"
                        style={{
                          left: `${((audit.validatorCount - audit.staleValidatorCount) / audit.validatorCount) * 100}%`,
                          width: `${audit.staleValidatorPct}%`,
                        }}
                      />
                    )}
                  </>
                )}
              </div>
              <div className="flex gap-3 mt-2">
                <span className="text-[10px] text-emerald-400/70 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Fresh
                </span>
                <span className="text-[10px] text-orange-400/70 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-orange-400" /> Stale (&gt;24h)
                </span>
              </div>
            </div>

            {/* Miner activity bar */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Miners</span>
                <span className="text-xs text-gray-400">
                  {audit.minerCount - audit.zeroIncentiveMinerCount} active / {audit.minerCount} total
                </span>
              </div>
              <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                {audit.minerCount > 0 && (
                  <>
                    <div
                      className="absolute inset-y-0 left-0 bg-blue-500 rounded-full"
                      style={{ width: `${100 - audit.zeroIncentiveMinerPct}%` }}
                    />
                    {audit.zeroIncentiveMinerPct > 0 && (
                      <div
                        className="absolute inset-y-0 right-0 bg-red-500/60 rounded-full"
                        style={{ width: `${audit.zeroIncentiveMinerPct}%` }}
                      />
                    )}
                  </>
                )}
              </div>
              <div className="flex gap-3 mt-2">
                <span className="text-[10px] text-blue-400/70 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500" /> Getting incentive
                </span>
                <span className="text-[10px] text-red-400/70 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Zero incentive
                </span>
              </div>
            </div>
          </div>

          {/* Trust concentration visual */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Validator Trust Distribution</span>
              <span className={`text-xs font-mono ${audit.trustGini >= 0.75 ? "text-red-400" : audit.trustGini >= 0.5 ? "text-yellow-400" : "text-emerald-400"}`}>
                Gini = {audit.trustGini.toFixed(2)}
              </span>
            </div>
            <div className="flex items-end gap-0.5 h-8">
              {/* Visual trust bar — just shows if top-3 dominate */}
              <div
                className={`rounded-sm ${audit.top3ValidatorTrustShare >= 70 ? "bg-red-500/70" : "bg-yellow-400/70"}`}
                style={{ height: "100%", width: `${audit.top3ValidatorTrustShare}%` }}
                title={`Top 3 validators: ${audit.top3ValidatorTrustShare}% of total trust`}
              />
              <div
                className="bg-gray-600/40 rounded-sm"
                style={{ height: "60%", width: `${100 - audit.top3ValidatorTrustShare}%` }}
                title="Remaining validators"
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-gray-600">Top 3 validators hold {audit.top3ValidatorTrustShare}% of trust</span>
              <span className="text-[10px] text-gray-600">Remaining {100 - audit.top3ValidatorTrustShare}%</span>
            </div>
          </div>

          {/* Audit flags */}
          <div className="space-y-2">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Audit Findings</div>
            {audit.flags.map((flag: AuditFlag, i: number) => (
              <div key={i} className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 border text-xs ${SEVERITY_COLOR[flag.severity] ?? ""}`}>
                <span className="shrink-0 text-base leading-none">{FLAG_ICON[flag.type] ?? "•"}</span>
                <span className="leading-relaxed">{flag.message}</span>
              </div>
            ))}
          </div>

          {/* Weight lag detail */}
          {audit.maxWeightLagBlocks > 0 && (
            <div className="text-xs text-gray-600 border-t border-gray-800/50 pt-3">
              Max weight lag: <span className="text-gray-400 font-mono">{audit.maxWeightLagBlocks.toLocaleString()} blocks</span>
              <span className="ml-1">≈ {Math.round(audit.maxWeightLagBlocks / 300)} hours behind most recent validator</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
type SortKey = "score_desc" | "score_asc" | "grade" | "stale" | "burn" | "collusion";

export default function AuditsPage() {
  const { data: session } = useSession();
  const tier = getTier(session);

  const [subnets, setSubnets] = useState<SubnetAudit[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    grades: Record<string, number>;
    criticalCount: number;
    avgScore: number;
  } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("score_desc");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterFlag, setFilterFlag] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    fetch("/api/audits")
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setSubnets(data.subnets ?? []);
        setSummary(data.summary ?? null);
        setUpdatedAt(data.updatedAt ?? null);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => {
    let list = [...subnets];

    if (filterGrade !== "all") list = list.filter(s => s.grade === filterGrade);
    if (filterFlag !== "all") list = list.filter(s => s.flags.some(f => f.type === filterFlag));

    if (sortKey === "score_desc") {
      list.sort((a, b) => b.operationalScore - a.operationalScore);
    } else if (sortKey === "score_asc") {
      list.sort((a, b) => a.operationalScore - b.operationalScore);
    } else if (sortKey === "grade") {
      const order = { A: 0, B: 1, C: 2, D: 3, F: 4 };
      list.sort((a, b) => (order[a.grade] ?? 5) - (order[b.grade] ?? 5));
    } else if (sortKey === "stale") {
      list.sort((a, b) => b.staleValidatorPct - a.staleValidatorPct);
    } else if (sortKey === "burn") {
      list.sort((a, b) => b.zeroIncentiveMinerPct - a.zeroIncentiveMinerPct);
    } else if (sortKey === "collusion") {
      list.sort((a, b) => b.trustGini - a.trustGini);
    }

    return list;
  }, [subnets, sortKey, filterGrade, filterFlag]);

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
      });
    } catch { return iso; }
  };

  const pageContent = (
    <div className="space-y-4">
      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["A", "B", "C", "D", "F"] as const).map(g => (
            <button
              key={g}
              onClick={() => setFilterGrade(filterGrade === g ? "all" : g)}
              className={`rounded-xl border p-3 text-center transition-all ${
                filterGrade === g
                  ? GRADE_COLOR[g]
                  : "bg-gray-900/50 border-gray-800 hover:border-gray-700"
              }`}
            >
              <div className={`text-2xl font-bold ${filterGrade === g ? "" : "text-white"}`}>
                {summary.grades[g] ?? 0}
              </div>
              <div className={`text-xs mt-0.5 ${filterGrade === g ? "opacity-80" : "text-gray-500"}`}>
                Grade {g}
              </div>
            </button>
          ))}
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
            <div className="text-2xl font-bold text-red-400">{summary.criticalCount}</div>
            <div className="text-xs text-red-400/60 mt-0.5">Critical Flags</div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-3 text-center">
            <div className="text-2xl font-bold text-white">{summary.avgScore}</div>
            <div className="text-xs text-gray-500 mt-0.5">Avg Op. Score</div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-600">Sort by:</span>
        {(
          [
            { key: "score_desc", label: "Score (high→low)" },
            { key: "score_asc",  label: "Score (low→high)" },
            { key: "grade",      label: "Grade" },
            { key: "stale",      label: "Stale Validators" },
            { key: "burn",       label: "Burn Code" },
            { key: "collusion",  label: "Collusion Risk" },
          ] as { key: SortKey; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={`text-xs rounded-lg px-2.5 py-1.5 border transition-colors ${
              sortKey === key
                ? "bg-green-500/15 text-green-400 border-green-500/30"
                : "bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-700"
            }`}
          >
            {label}
          </button>
        ))}

        <span className="text-xs text-gray-600 ml-2">Filter:</span>
        {(
          [
            { key: "all",           label: "All" },
            { key: "burn_code",     label: "🔥 Burn Code" },
            { key: "stale_weights", label: "⏱ Stale Weights" },
            { key: "collusion_risk",label: "⚠ Collusion" },
          ] as { key: string; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterFlag(key)}
            className={`text-xs rounded-lg px-2.5 py-1.5 border transition-colors ${
              filterFlag === key
                ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                : "bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-700"
            }`}
          >
            {label}
          </button>
        ))}

        <span className="ml-auto text-xs text-gray-600">
          {sorted.length} subnet{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Audit cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-600 text-sm">Loading audit data…</div>
      ) : error ? (
        <div className="text-center py-12 text-gray-600 text-sm">
          {error.includes("first cron run pending")
            ? "Audit data not yet available — the first audit scan runs every 6 hours. Check back soon."
            : `Error: ${error}`}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-600 text-sm">No subnets match this filter.</div>
      ) : (
        <div className="space-y-2">
          {sorted.map(audit => <AuditCard key={audit.netuid} audit={audit} />)}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 px-4">
        <div>
          <h1 className="text-lg font-semibold text-white">Subnet Audits</h1>
          <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
            Operational health analysis —
            <span className="text-gray-400"> ⏱ weight staleness</span>,
            <span className="text-gray-400"> 🔥 burn code detection</span>,
            <span className="text-gray-400"> ⚠ collusion risk</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] text-gray-600 uppercase tracking-wider">Last updated</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {updatedAt ? fmtTime(updatedAt) : "—"}
          </div>
        </div>
      </div>

      <BlurGate tier={tier} required="premium" label="Unlock Subnet Audits →" minHeight="400px">
        {pageContent}
      </BlurGate>
    </div>
  );
}
