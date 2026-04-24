"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import BlurGate from "@/components/BlurGate";
import { getTier } from "@/lib/subscription";
import { useWatchlist } from "@/components/dashboard/WatchlistProvider";
import type { SubnetAudit } from "@/app/api/cron/audit-scan/route";

// ── Score badge ───────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30"
    : score >= 65 ? "text-teal-400 bg-teal-400/10 border-teal-400/30"
    : score >= 45 ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
    : "text-red-400 bg-red-400/10 border-red-400/30";
  return (
    <span className={`inline-flex items-center justify-center w-11 h-11 rounded-xl border-2 font-bold text-base flex-shrink-0 ${color}`}>
      {score}
    </span>
  );
}

// ── Burn rate badge (inline) ──────────────────────────────────────
function BurnBadge({ pct }: { pct: number }) {
  const color =
    pct === 0 ? "text-emerald-400"
    : pct < 20 ? "text-teal-400"
    : pct < 50 ? "text-yellow-400"
    : pct < 80 ? "text-orange-400"
    : "text-red-400";
  return <span className={`font-semibold tabular-nums ${color}`}>{pct}%</span>;
}

// ── Generate plain-English bullet points from audit data ──────────
interface Bullet { icon: string; text: string; kind: "good" | "warn" | "bad" | "neutral" }

function getBullets(a: SubnetAudit): Bullet[] {
  const bullets: Bullet[] = [];

  // Validator health
  if (a.validatorCount === 0) {
    bullets.push({ icon: "🚫", text: "No validator data available", kind: "bad" });
  } else if (a.staleValidatorPct >= 80) {
    bullets.push({ icon: "🔴", text: `${a.staleValidatorPct}% of validators have stale weights — most haven't updated in over 24h`, kind: "bad" });
  } else if (a.staleValidatorPct >= 40) {
    bullets.push({ icon: "⚠️", text: `${a.staleValidatorPct}% of validators are behind on weight submissions (max lag ~${Math.round(a.maxWeightLagBlocks / 300)}h)`, kind: "warn" });
  } else {
    bullets.push({ icon: "✅", text: `${a.validatorCount} validators, ${100 - a.staleValidatorPct}% submitting fresh weights`, kind: "good" });
  }

  // Miner health
  if (a.minerCount === 0) {
    bullets.push({ icon: "🚫", text: "No miner data available", kind: "bad" });
  } else if (a.zeroIncentiveMinerPct >= 80) {
    bullets.push({ icon: "🔴", text: `${a.zeroIncentiveMinerPct}% of miners earning zero emissions — possible burn code or unqueried miners`, kind: "bad" });
  } else if (a.zeroIncentiveMinerPct >= 40) {
    bullets.push({ icon: "⚠️", text: `${a.zeroIncentiveMinerPct}% of miners have zero incentive out of ${a.minerCount} total`, kind: "warn" });
  } else {
    bullets.push({ icon: "✅", text: `${a.minerCount} miners, ${100 - a.zeroIncentiveMinerPct}% actively earning incentive`, kind: "good" });
  }

  // Trust / collusion
  if (a.trustGini >= 0.9) {
    bullets.push({ icon: "🔴", text: `Extreme trust concentration — top 3 validators control ${a.top3ValidatorTrustShare}% of all trust (Gini ${a.trustGini.toFixed(2)}) — collusion risk`, kind: "bad" });
  } else if (a.trustGini >= 0.75) {
    bullets.push({ icon: "⚠️", text: `High trust concentration — top 3 hold ${a.top3ValidatorTrustShare}% of trust (Gini ${a.trustGini.toFixed(2)})`, kind: "warn" });
  } else if (a.trustGini >= 0.5) {
    bullets.push({ icon: "⚠️", text: `Moderate trust concentration across validators (Gini ${a.trustGini.toFixed(2)}, top 3 hold ${a.top3ValidatorTrustShare}%)`, kind: "warn" });
  } else {
    bullets.push({ icon: "✅", text: `Healthy trust distribution across validators (Gini ${a.trustGini.toFixed(2)})`, kind: "good" });
  }

  // Emission burn rate
  if (a.burnedEmissionPct === 0) {
    bullets.push({ icon: "✅", text: "Zero emissions burned — miners keep all their rewards (fully sustainable)", kind: "good" });
  } else if (a.burnedEmissionPct < 20) {
    bullets.push({ icon: "✅", text: `Only ${a.burnedEmissionPct}% of miner emissions being burned — low burn, healthy economics`, kind: "good" });
  } else if (a.burnedEmissionPct < 60) {
    bullets.push({ icon: "⚠️", text: `${a.burnedEmissionPct}% of miner emissions burned — reduces miner profitability over time`, kind: "warn" });
  } else {
    bullets.push({ icon: "🔴", text: `${a.burnedEmissionPct}% of miner emissions burned — miners are net losers, unsustainable long-term`, kind: "bad" });
  }

  return bullets;
}

// ── Audit card ────────────────────────────────────────────────────
function AuditCard({ audit, rank, isWatched }: { audit: SubnetAudit; rank: number; isWatched: boolean }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const bullets = getBullets(audit);
  const critFlags = audit.flags.filter(f => f.severity === "critical");
  const warnFlags = audit.flags.filter(f => f.severity === "warning");

  return (
    <div
      className={`bg-gray-900/60 border rounded-xl overflow-hidden transition-colors ${
        isWatched
          ? "border-blue-400/70 ring-2 ring-blue-400/60 bg-blue-950/40 shadow-lg shadow-blue-500/30"
          : critFlags.length > 0
          ? "border-red-500/30 hover:border-red-500/50"
          : audit.operationalScore >= 80
          ? "border-emerald-500/20 hover:border-emerald-500/40"
          : "border-gray-800 hover:border-gray-700"
      }`}
    >
      {/* Main row — always visible */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Rank */}
        <span className="text-gray-600 text-sm tabular-nums w-5 text-center flex-shrink-0">{rank}</span>

        {/* Logo */}
        <div className="flex-shrink-0">
          <SubnetLogo netuid={audit.netuid} name={audit.name} size={28} />
        </div>

        {/* Name + SN */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={e => { e.stopPropagation(); router.push(`/subnets/${audit.netuid}`); }}
              className="font-bold text-white hover:text-green-400 transition-colors truncate"
            >
              {audit.name}
            </button>
            <span className="text-[10px] text-gray-600 font-mono flex-shrink-0">SN{audit.netuid}</span>
          </div>

          {/* Flag pills — visible on collapsed card */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {/* Burn rate always shown */}
            <span className="text-[10px] text-gray-500">
              ♻️ <BurnBadge pct={audit.burnedEmissionPct ?? 0} /> burned
            </span>
            {critFlags.map((f, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                🔴 {f.type.replace(/_/g, " ")}
              </span>
            ))}
            {warnFlags.map((f, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                ⚠ {f.type.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>

        {/* Validators / Miners — desktop only */}
        <div className="hidden md:flex flex-col items-end flex-none w-24 text-right">
          <span className="text-xs text-gray-400">{audit.validatorCount} validators</span>
          <span className="text-xs text-gray-500">{audit.minerCount} miners</span>
        </div>

        {/* Score badge + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <ScoreBadge score={audit.operationalScore} />
          <svg
            className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-800/60 px-4 pb-4 pt-3 bg-gray-950/30">
          {/* Bullet points */}
          <div className="space-y-2 mb-4">
            {bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-sm flex-shrink-0 leading-snug">{b.icon}</span>
                <p className={`text-sm leading-snug ${
                  b.kind === "bad" ? "text-red-300" :
                  b.kind === "warn" ? "text-yellow-200" :
                  b.kind === "good" ? "text-gray-200" : "text-gray-400"
                }`}>{b.text}</p>
              </div>
            ))}
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {[
              { label: "Stale Validators", value: `${audit.staleValidatorPct}%`, warn: audit.staleValidatorPct >= 50 },
              { label: "Zero-Incentive Miners", value: `${audit.zeroIncentiveMinerPct}%`, warn: audit.zeroIncentiveMinerPct >= 60 },
              { label: "Trust Gini", value: audit.trustGini.toFixed(2), warn: audit.trustGini >= 0.75 },
              { label: "Top-3 Trust Share", value: `${audit.top3ValidatorTrustShare}%`, warn: audit.top3ValidatorTrustShare >= 70 },
            ].map(({ label, value, warn }) => (
              <div key={label} className={`rounded-lg px-3 py-2 border text-center ${warn ? "bg-red-500/5 border-red-500/20" : "bg-gray-900/60 border-gray-800"}`}>
                <div className={`text-sm font-mono font-semibold tabular-nums ${warn ? "text-red-400" : "text-white"}`}>{value}</div>
                <div className="text-[10px] text-gray-600 mt-0.5 whitespace-nowrap">{label}</div>
              </div>
            ))}
          </div>

          {/* Full flag messages */}
          {audit.flags.filter(f => f.severity !== "info").length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] text-gray-600 uppercase tracking-wider">Audit Flags</div>
              {audit.flags.filter(f => f.severity !== "info").map((flag, i) => (
                <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 border text-xs ${
                  flag.severity === "critical"
                    ? "text-red-400 bg-red-500/5 border-red-500/20"
                    : "text-yellow-400 bg-yellow-500/5 border-yellow-500/20"
                }`}>
                  <span className="shrink-0">{flag.severity === "critical" ? "🔴" : "⚠️"}</span>
                  <span>{flag.message}</span>
                </div>
              ))}
            </div>
          )}

          {audit.maxWeightLagBlocks > 0 && (
            <div className="text-xs text-gray-600 mt-3 pt-3 border-t border-gray-800/40">
              Max weight lag: <span className="text-gray-400 font-mono">{audit.maxWeightLagBlocks.toLocaleString()} blocks</span>
              {" "}≈ {Math.round(audit.maxWeightLagBlocks / 300)}h behind the most recent validator
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────
export default function AuditsPage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const { isWatched, watchlist } = useWatchlist();

  const [subnets, setSubnets] = useState<SubnetAudit[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [watchlistOnly, setWatchlistOnly] = useState(false);

  useEffect(() => {
    fetch("/api/audits")
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        // Sort best → worst by default
        const sorted = (data.subnets ?? []).sort(
          (a: SubnetAudit, b: SubnetAudit) => b.operationalScore - a.operationalScore
        );
        setSubnets(sorted);
        setUpdatedAt(data.updatedAt ?? null);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return subnets.filter(s => {
      if (watchlistOnly && !watchlist.has(s.netuid)) return false;
      if (q && !s.name.toLowerCase().includes(q) && !`sn${s.netuid}`.includes(q)) return false;
      return true;
    });
  }, [subnets, search, watchlistOnly, watchlist]);

  // Summary stats
  const avgScore = subnets.length
    ? Math.round(subnets.reduce((s, a) => s + a.operationalScore, 0) / subnets.length)
    : 0;
  const critCount = subnets.filter(s => s.flags.some(f => f.severity === "critical")).length;
  const zeroBurnCount = subnets.filter(s => (s.burnedEmissionPct ?? 0) === 0).length;
  const avgBurn = subnets.length
    ? Math.round(subnets.reduce((s, a) => s + (a.burnedEmissionPct ?? 0), 0) / subnets.length)
    : 0;

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
    } catch { return iso; }
  };

  const pageContent = (
    <div className="space-y-4">
      {/* Stats strip */}
      {subnets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Subnets Audited", value: `${subnets.length}`, sub: "all active subnets" },
            { label: "Avg Operational Score", value: `${avgScore}/100`, sub: "ecosystem health" },
            { label: "Critical Flags", value: `${critCount}`, sub: "subnets with issues" },
            { label: "Zero Emission Burn", value: `${zeroBurnCount}`, sub: `avg burn ${avgBurn}% across all` },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className="text-xl font-bold text-white">{value}</div>
              <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search + watchlist filter */}
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
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border flex-shrink-0 ${
            watchlistOnly
              ? "bg-blue-600 border-blue-500 text-white"
              : "bg-gray-900/60 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          My Watchlist
        </button>
        <span className="text-xs text-gray-600 flex-shrink-0">{filtered.length} subnets</span>
      </div>

      {/* Column labels */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3 px-4 text-[10px] text-gray-600 uppercase tracking-wider">
          <span className="w-5 text-center">#</span>
          <span className="w-7" />
          <span className="flex-1">Subnet</span>
          <span className="hidden md:block w-24 text-right">Size</span>
          <span className="w-11 text-center">Score</span>
          <span className="w-4" />
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-gray-600 text-sm">Loading audit data…</div>
      ) : error ? (
        <div className="text-center py-16 text-gray-600 text-sm">
          {error.includes("first cron run pending")
            ? "Audit data not yet available — the first audit scan runs every 6 hours. Check back soon."
            : `Error: ${error}`}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600 text-sm">No subnets match your search.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((audit, i) => (
            <AuditCard
              key={audit.netuid}
              audit={audit}
              rank={i + 1}
              isWatched={isWatched(audit.netuid)}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <main className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-screen-xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Subnet Audits</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-xl">
              Operational health rankings for every active subnet — validator freshness, miner activity, trust concentration, and emission burn rate. Higher score = healthier network.
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
