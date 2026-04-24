/**
 * GET /api/cron/audit-scan
 *
 * Runs every 6 hours via Vercel cron.
 * Fetches metagraph data (TaoStats) + market/decentralisation data (TaoSwap)
 * for every active subnet and computes a composite operational health score.
 *
 * Metrics tracked:
 *   - Weight staleness        (metagraph)
 *   - Burn code detection     (metagraph)
 *   - Trust / Gini            (metagraph)
 *   - Nakamoto coefficient    (TaoSwap)
 *   - HHI normalised          (TaoSwap)
 *   - Top-10 share            (TaoSwap)
 *   - Emission miner burn %   (TaoSwap — more accurate than TaoStats)
 *   - Holders count           (TaoSwap)
 *   - Chain buy %             (TaoSwap)
 *   - Inflow / outflow        (TaoSwap)
 *   - Emission % + EMA %      (TaoSwap)
 *   - TAO in pool             (TaoSwap)
 */

import { NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";
import { getSubnetIdentities, getMetagraph } from "@/lib/taostats";
import { getTaoSwapSubnets, type TaoSwapSubnet } from "@/lib/taoswap";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ── Types ──────────────────────────────────────────────────────────
export interface AuditFlag {
  type:
    | "burn_code" | "stale_weights" | "collusion_risk"
    | "low_activity" | "no_validators"
    | "high_emission_burn" | "low_nakamoto" | "high_concentration"
    | "healthy";
  severity: "critical" | "warning" | "info";
  message: string;
}

export interface SubnetAudit {
  netuid: number;
  name: string;

  // ── Composite score ──────────────────────────────────────────────
  grade: "A" | "B" | "C" | "D" | "F";
  operationalScore: number;            // 0-100

  // ── Metagraph: validator health ──────────────────────────────────
  validatorCount: number;
  staleValidatorCount: number;
  staleValidatorPct: number;
  maxWeightLagBlocks: number;

  // ── Metagraph: miner health ──────────────────────────────────────
  minerCount: number;
  zeroIncentiveMinerCount: number;
  zeroIncentiveMinerPct: number;
  activeMinerPct: number;

  // ── Metagraph: trust / collusion ─────────────────────────────────
  trustGini: number;
  top3ValidatorTrustShare: number;

  // ── TaoSwap: decentralisation ────────────────────────────────────
  nakamotoCoefficient: number;         // min validators to control network
  hhiNormalized: number;               // 0-1, lower = more competitive
  top10Share: number;                  // 0-1 fraction held by top 10 addresses

  // ── TaoSwap: emission economics ──────────────────────────────────
  burnedEmissionPct: number;           // % of miner emissions burned (0=good, 100=all burned)
  emissionPercent: number | null;      // subnet's % of total network emissions
  emissionEmaPct: number | null;       // 7-day EMA expected emission %
  emissionChainBuysPct: number | null; // % of emissions recycled into buying token

  // ── TaoSwap: capital & adoption ──────────────────────────────────
  taoInPool: number | null;            // TAO in liquidity pool
  inflow: number | null;               // TAO flowing in
  outflow: number | null;              // TAO flowing out
  holdersCount: number | null;

  // ── Flags ────────────────────────────────────────────────────────
  flags: AuditFlag[];

  updatedAt: string;
}

export interface AuditData {
  subnets: Record<number, SubnetAudit>;
  updatedAt: string;
  totalScanned: number;
}

// ── Helpers ────────────────────────────────────────────────────────

function gini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((s, v) => s + v, 0);
  if (sum === 0) return 0;
  let numerator = 0;
  for (let i = 0; i < n; i++) numerator += (2 * (i + 1) - n - 1) * sorted[i];
  return Math.max(0, Math.min(1, numerator / (n * sum)));
}

function auditGrade(score: number, flags: AuditFlag[]): "A" | "B" | "C" | "D" | "F" {
  const hasCritical = flags.some(f => f.severity === "critical");
  if (score >= 80 && !hasCritical) return "A";
  if (score >= 65) return "B";
  if (score >= 45) return "C";
  if (score >= 25) return "D";
  return "F";
}

function computeAudit(
  netuid: number,
  name: string,
  neurons: Awaited<ReturnType<typeof getMetagraph>>,
  ts: TaoSwapSubnet | null,
): SubnetAudit {
  const now = new Date().toISOString();

  // ── Pull TaoSwap fields ──────────────────────────────────────────
  const nakamotoCoefficient = ts?.nakamoto_coefficient ?? 0;
  const hhiNormalized       = ts?.hhi_normalized ?? 0;
  const top10Share          = ts?.top10_share ?? 0;           // 0-1
  const burnedEmissionPct   = ts?.emission_miner_burn ?? 0;   // already 0-100
  const emissionPercent     = ts?.emission_percent ?? null;
  const emissionEmaPct      = ts?.emission_ema_percent ?? null;
  const emissionChainBuysPct = ts?.emission_chain_buys_percent ?? null;
  const taoInPool           = ts?.root_in_pool ?? null;
  const inflow              = ts?.inflow ?? null;
  const outflow             = ts?.outflow ?? null;
  const holdersCount        = ts?.holders_count ?? null;

  // Empty neuron data guard
  if (!neurons || neurons.length === 0) {
    return {
      netuid, name, grade: "F", operationalScore: 0,
      validatorCount: 0, staleValidatorCount: 0, staleValidatorPct: 0, maxWeightLagBlocks: 0,
      minerCount: 0, zeroIncentiveMinerCount: 0, zeroIncentiveMinerPct: 0, activeMinerPct: 0,
      trustGini: 0, top3ValidatorTrustShare: 0,
      nakamotoCoefficient, hhiNormalized, top10Share,
      burnedEmissionPct, emissionPercent, emissionEmaPct, emissionChainBuysPct,
      taoInPool, inflow, outflow, holdersCount,
      flags: [{ type: "no_validators", severity: "warning", message: "No neuron data available" }],
      updatedAt: now,
    };
  }

  const validators = neurons.filter(n => n.validator_permit);
  const miners     = neurons.filter(n => !n.validator_permit);

  // ── Weight staleness ─────────────────────────────────────────────
  const STALE_THRESHOLD = 7200; // blocks ≈ 24h
  let staleValidatorCount = 0;
  let maxWeightLagBlocks  = 0;
  if (validators.length > 0) {
    const updateBlocks = validators.map(v => v.last_update || 0);
    const maxBlock = Math.max(...updateBlocks);
    for (const blk of updateBlocks) {
      const lag = maxBlock - blk;
      if (lag > maxWeightLagBlocks) maxWeightLagBlocks = lag;
      if (lag > STALE_THRESHOLD) staleValidatorCount++;
    }
  }
  const staleValidatorPct = validators.length > 0
    ? Math.round((staleValidatorCount / validators.length) * 100) : 0;

  // ── Zero-incentive miners ─────────────────────────────────────────
  const INCENTIVE_THRESHOLD = 0.001;
  const activeMiners        = miners.filter(n => n.active);
  const zeroIncentiveMiners = miners.filter(n => parseFloat(n.incentive || "0") < INCENTIVE_THRESHOLD);
  const zeroIncentiveMinerCount = zeroIncentiveMiners.length;
  const zeroIncentiveMinerPct   = miners.length > 0
    ? Math.round((zeroIncentiveMinerCount / miners.length) * 100) : 0;
  const activeMinerPct = miners.length > 0
    ? Math.round((activeMiners.length / miners.length) * 100) : 0;

  // ── Trust concentration ───────────────────────────────────────────
  const validatorTrusts      = validators.map(v => parseFloat(v.trust || "0"));
  const trustGiniVal         = gini(validatorTrusts);
  const totalTrust           = validatorTrusts.reduce((s, t) => s + t, 0);
  const sortedTrusts         = [...validatorTrusts].sort((a, b) => b - a);
  const top3Trust            = sortedTrusts.slice(0, 3).reduce((s, t) => s + t, 0);
  const top3ValidatorTrustShare = totalTrust > 0
    ? Math.round((top3Trust / totalTrust) * 100) : 0;

  // ── Composite score ───────────────────────────────────────────────
  // Base: 80. Penalties and bonuses from all data sources.
  let score = 80;

  // Validator staleness
  if      (staleValidatorPct >= 90) score -= 30;
  else if (staleValidatorPct >= 70) score -= 22;
  else if (staleValidatorPct >= 50) score -= 14;
  else if (staleValidatorPct >= 25) score -= 7;
  else if (staleValidatorPct <=  5 && validators.length >= 5) score += 8;

  // Zero-incentive miners (burn code proxy)
  if      (zeroIncentiveMinerPct >= 90) score -= 25;
  else if (zeroIncentiveMinerPct >= 70) score -= 18;
  else if (zeroIncentiveMinerPct >= 50) score -= 10;
  else if (zeroIncentiveMinerPct >= 30) score -= 5;
  else if (zeroIncentiveMinerPct <= 10 && miners.length >= 5) score += 5;

  // Trust Gini (collusion)
  if      (trustGiniVal >= 0.9)                           score -= 20;
  else if (trustGiniVal >= 0.75)                          score -= 12;
  else if (trustGiniVal >= 0.6)                           score -= 6;
  else if (trustGiniVal <= 0.35 && validators.length >= 8) score += 5;

  // Validator count
  if      (validators.length <  3) score -= 10;
  else if (validators.length >= 16) score += 5;

  // Emission burn rate (from TaoSwap — primary source)
  if      (burnedEmissionPct >= 80) score -= 22;
  else if (burnedEmissionPct >= 60) score -= 14;
  else if (burnedEmissionPct >= 40) score -= 7;
  else if (burnedEmissionPct >= 20) score -= 3;
  else if (burnedEmissionPct ===  0 && ts !== null) score += 5;

  // Nakamoto coefficient (TaoSwap)
  if      (nakamotoCoefficient >= 20) score += 10;
  else if (nakamotoCoefficient >= 15) score += 7;
  else if (nakamotoCoefficient >= 10) score += 4;
  else if (nakamotoCoefficient >=  5) score += 0;
  else if (nakamotoCoefficient ===  4) score -= 5;
  else if (nakamotoCoefficient ===  3) score -= 10;
  else if (nakamotoCoefficient ===  2) score -= 15;
  else if (nakamotoCoefficient <=  1 && ts !== null) score -= 20;

  // HHI (TaoSwap)
  if      (hhiNormalized <= 0.05) score += 5;
  else if (hhiNormalized <= 0.15) score += 2;
  else if (hhiNormalized >  0.60) score -= 12;
  else if (hhiNormalized >  0.40) score -= 5;

  // Top-10 share (TaoSwap, 0-1)
  if      (top10Share <= 0.40) score += 5;
  else if (top10Share >  0.85) score -= 10;
  else if (top10Share >  0.70) score -= 5;

  // Holders count (TaoSwap)
  if (holdersCount !== null) {
    if      (holdersCount >= 10000) score += 5;
    else if (holdersCount >=  5000) score += 3;
    else if (holdersCount >=  1000) score += 1;
    else if (holdersCount <    100) score -= 3;
  }

  // Chain buy % — emissions being recycled into buying (bullish)
  if (emissionChainBuysPct !== null) {
    if      (emissionChainBuysPct >= 50) score += 5;
    else if (emissionChainBuysPct >= 20) score += 2;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  // ── Flags ─────────────────────────────────────────────────────────
  const flags: AuditFlag[] = [];

  if (zeroIncentiveMinerPct >= 80) {
    flags.push({ type: "burn_code", severity: "critical",
      message: `${zeroIncentiveMinerPct}% of miners earning zero emissions — possible burn code` });
  }

  if (staleValidatorPct >= 60) {
    flags.push({ type: "stale_weights",
      severity: staleValidatorPct >= 80 ? "critical" : "warning",
      message: `${staleValidatorPct}% of validators have stale weights (max lag ~${Math.round(maxWeightLagBlocks / 300)}h)` });
  }

  if (trustGiniVal >= 0.75) {
    flags.push({ type: "collusion_risk",
      severity: trustGiniVal >= 0.9 ? "critical" : "warning",
      message: `High trust concentration (Gini ${trustGiniVal.toFixed(2)}, top-3 hold ${top3ValidatorTrustShare}% of trust)` });
  }

  if (burnedEmissionPct >= 60) {
    flags.push({ type: "high_emission_burn",
      severity: burnedEmissionPct >= 80 ? "critical" : "warning",
      message: `${burnedEmissionPct.toFixed(1)}% of miner emissions burned — ${burnedEmissionPct >= 80 ? "miners are net losers" : "reduces miner sustainability"}` });
  }

  if (nakamotoCoefficient > 0 && nakamotoCoefficient <= 2) {
    flags.push({ type: "low_nakamoto", severity: "critical",
      message: `Nakamoto coefficient is ${nakamotoCoefficient} — network can be controlled by just ${nakamotoCoefficient} validator(s)` });
  } else if (nakamotoCoefficient > 0 && nakamotoCoefficient <= 4) {
    flags.push({ type: "low_nakamoto", severity: "warning",
      message: `Nakamoto coefficient is ${nakamotoCoefficient} — low decentralisation, ${nakamotoCoefficient} validators could collude` });
  }

  if (hhiNormalized > 0.40) {
    flags.push({ type: "high_concentration",
      severity: hhiNormalized > 0.60 ? "critical" : "warning",
      message: `High HHI concentration (${hhiNormalized.toFixed(3)}) — stake distribution is very uneven` });
  }

  if (activeMinerPct < 20 && miners.length >= 10) {
    flags.push({ type: "low_activity", severity: "warning",
      message: `Only ${activeMinerPct}% of miners active — network underutilised` });
  }

  if (validators.length < 3) {
    flags.push({ type: "no_validators", severity: "warning",
      message: `Only ${validators.length} validator(s) — insufficient decentralisation` });
  }

  if (flags.length === 0) {
    flags.push({ type: "healthy", severity: "info",
      message: "All systems nominal — no anomalies detected" });
  }

  const grade = auditGrade(score, flags);

  return {
    netuid, name, grade, operationalScore: score,
    validatorCount: validators.length,
    staleValidatorCount, staleValidatorPct, maxWeightLagBlocks,
    minerCount: miners.length,
    zeroIncentiveMinerCount, zeroIncentiveMinerPct, activeMinerPct,
    trustGini: Math.round(trustGiniVal * 100) / 100,
    top3ValidatorTrustShare,
    nakamotoCoefficient, hhiNormalized,
    top10Share: Math.round(top10Share * 1000) / 1000,
    burnedEmissionPct: Math.round(burnedEmissionPct * 10) / 10,
    emissionPercent, emissionEmaPct, emissionChainBuysPct,
    taoInPool, inflow, outflow, holdersCount,
    flags,
    updatedAt: now,
  };
}

async function readBlob<T>(name: string, token: string): Promise<T | null> {
  try {
    const result = await blobGet(name, { token, access: "private" });
    if (!result?.stream) return null;
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch {
    return null;
  }
}

// ── Route ──────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const cronSecret   = process.env.CRON_SECRET;
  if (!isVercelCron && cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  if (!token) return NextResponse.json({ error: "No blob token" }, { status: 500 });

  const startTime = Date.now();
  const AUDIT_EXCLUDED = new Set([0]); // Root network

  // Fetch all data sources in parallel
  const [allIdentities, taoswapSubnets] = await Promise.all([
    getSubnetIdentities().catch(() => []),
    getTaoSwapSubnets().catch(() => []),
  ]);

  if (allIdentities.length === 0) {
    return NextResponse.json({ error: "No subnet identities" }, { status: 500 });
  }

  const identities = allIdentities.filter(id => !AUDIT_EXCLUDED.has(id.netuid));

  // Build TaoSwap lookup map by netuid
  const taoswapMap = new Map<number, TaoSwapSubnet>();
  for (const s of taoswapSubnets) {
    taoswapMap.set(s.id, s);
  }
  console.log(`[audit-scan] TaoSwap data loaded for ${taoswapMap.size} subnets`);

  // Fetch metagraph in parallel batches
  const BATCH_SIZE = 8;
  const results: Record<number, SubnetAudit> = {};
  let scanned = 0;
  let errors   = 0;

  for (let i = 0; i < identities.length; i += BATCH_SIZE) {
    const batch        = identities.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async id => {
        const neurons = await getMetagraph(id.netuid);
        return { id, neurons };
      })
    );

    for (const r of batchResults) {
      if (r.status !== "fulfilled") { errors++; continue; }
      const { id, neurons } = r.value;
      const ts = taoswapMap.get(id.netuid) ?? null;
      results[id.netuid] = computeAudit(id.netuid, id.subnet_name || `SN${id.netuid}`, neurons, ts);
      scanned++;
    }

    if (i + BATCH_SIZE < identities.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  const auditData: AuditData = {
    subnets: results,
    updatedAt: new Date().toISOString(),
    totalScanned: scanned,
  };

  await put("audit-data.json", JSON.stringify(auditData), {
    access: "private", addRandomSuffix: false, allowOverwrite: true, token,
    contentType: "application/json",
  });

  // Weekly Monday snapshot
  const weekday = new Date().getDay();
  if (weekday === 1) {
    const today   = new Date().toISOString().slice(0, 10);
    const weekKey = `audit-history/${today}.json`;
    try {
      await put(weekKey, JSON.stringify(auditData), {
        access: "private", addRandomSuffix: false, allowOverwrite: false, token,
        contentType: "application/json",
      });
    } catch { /* already exists */ }
  }

  const duration = Date.now() - startTime;
  const gradeBreakdown = Object.values(results).reduce((acc, a) => {
    acc[a.grade] = (acc[a.grade] || 0) + 1; return acc;
  }, {} as Record<string, number>);

  console.log(`[audit-scan] Done in ${duration}ms. ${scanned} scanned, ${errors} errors. Grades: ${JSON.stringify(gradeBreakdown)}`);

  return NextResponse.json({ ok: true, duration_ms: duration, scanned, errors, grades: gradeBreakdown });
}
