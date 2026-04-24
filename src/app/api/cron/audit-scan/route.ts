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

// ── Component scoring functions (each returns 0–100) ─────────────────
// These replace the old "start at 80, stack penalties" approach.
// Each metric is scored independently, then combined by weight.

function scoreNakamoto(n: number): number {
  if (n >= 20) return 100;
  if (n >= 15) return 90;
  if (n >= 10) return 78;
  if (n >= 7)  return 65;
  if (n >= 5)  return 52;
  if (n >= 4)  return 38;
  if (n >= 3)  return 25;
  if (n >= 2)  return 12;
  return 0;
}

function scoreBurn(pct: number | null): number {
  // Lower burn = better; null = unknown → neutral
  if (pct === null) return 50;
  if (pct <= 0)     return 100;
  if (pct <= 5)     return 92;
  if (pct <= 15)    return 80;
  if (pct <= 30)    return 65;
  if (pct <= 50)    return 45;
  if (pct <= 70)    return 22;
  if (pct <= 85)    return 8;
  return 0;
}

function scoreHHI(h: number): number {
  // Lower HHI = better
  if (h <= 0.05) return 100;
  if (h <= 0.10) return 88;
  if (h <= 0.20) return 72;
  if (h <= 0.35) return 55;
  if (h <= 0.50) return 35;
  if (h <= 0.65) return 18;
  return 5;
}

function scoreTop10(share: number): number {
  // Lower share = better (0–1 scale)
  if (share <= 0.30) return 100;
  if (share <= 0.45) return 82;
  if (share <= 0.60) return 62;
  if (share <= 0.75) return 42;
  if (share <= 0.85) return 22;
  return 8;
}

function scoreStaleVal(pct: number, valCount: number): number {
  // Lower staleness = better; no validators → neutral
  if (valCount === 0) return 50;
  if (pct === 0)      return 100;
  if (pct <= 10)      return 88;
  if (pct <= 25)      return 70;
  if (pct <= 50)      return 45;
  if (pct <= 75)      return 20;
  return 5;
}

function scoreHolders(count: number | null): number {
  // Higher = better; null → neutral
  if (count === null)  return 50;
  if (count >= 10000)  return 100;
  if (count >= 5000)   return 85;
  if (count >= 2000)   return 70;
  if (count >= 1000)   return 55;
  if (count >= 500)    return 40;
  if (count >= 100)    return 25;
  return 10;
}

function scoreChainBuy(pct: number | null): number {
  // Higher = better; null → neutral
  if (pct === null)  return 50;
  if (pct >= 50)     return 100;
  if (pct >= 25)     return 85;
  if (pct >= 10)     return 68;
  if (pct >= 5)      return 52;
  if (pct >= 2)      return 38;
  if (pct >= 0.5)    return 25;
  return 10;
}

function scoreTaoPool(tao: number | null): number {
  // Higher liquidity = better; null → neutral
  if (tao === null)    return 50;
  if (tao >= 100_000)  return 100;
  if (tao >= 50_000)   return 88;
  if (tao >= 20_000)   return 75;
  if (tao >= 5_000)    return 60;
  if (tao >= 1_000)    return 45;
  if (tao >= 200)      return 28;
  return 10;
}

function computeAudit(
  netuid: number,
  name: string,
  neurons: Awaited<ReturnType<typeof getMetagraph>>,
  ts: TaoSwapSubnet | null,
): SubnetAudit {
  const now = new Date().toISOString();

  // ── Pull TaoSwap fields ──────────────────────────────────────────
  const nakamotoCoefficient  = ts?.nakamoto_coefficient ?? 0;
  const hhiNormalized        = ts?.hhi_normalized ?? 0;
  const top10Share           = ts?.top10_share ?? 0;            // 0–1
  const burnedEmissionPct    = ts?.emission_miner_burn ?? null; // null = unknown
  const emissionPercent      = ts?.emission_percent ?? null;
  const emissionEmaPct       = ts?.emission_ema_percent ?? null;
  const emissionChainBuysPct = ts?.emission_chain_buys_percent ?? null;
  const taoInPool            = ts?.root_in_pool ?? null;
  const inflow               = ts?.inflow ?? null;
  const outflow              = ts?.outflow ?? null;
  const holdersCount         = ts?.holders_count ?? null;

  const hasNeuronData = neurons && neurons.length > 0;

  // ── Metagraph computations (only when we have neuron data) ────────
  let validators: typeof neurons = [];
  let miners:     typeof neurons = [];
  let staleValidatorCount   = 0;
  let maxWeightLagBlocks    = 0;
  let staleValidatorPct     = 0;
  let zeroIncentiveMinerCount = 0;
  let zeroIncentiveMinerPct   = 0;
  let activeMinerPct          = 0;
  let trustGiniVal            = 0;
  let top3ValidatorTrustShare = 0;

  if (hasNeuronData) {
    validators = neurons.filter(n => n.validator_permit);
    miners     = neurons.filter(n => !n.validator_permit);

    // Weight staleness — `updated` = blocks since last weight set; 7200 ≈ 24h
    const STALE_THRESHOLD = 7200;
    for (const v of validators) {
      const lag = v.updated ?? 0;
      if (lag > maxWeightLagBlocks) maxWeightLagBlocks = lag;
      if (lag > STALE_THRESHOLD) staleValidatorCount++;
    }
    staleValidatorPct = validators.length > 0
      ? Math.round((staleValidatorCount / validators.length) * 100) : 0;

    // Zero-incentive miners (displayed as a column, NOT used in scoring —
    // 80–98% ZI miners is normal in Bittensor and not a reliable quality signal)
    const INCENTIVE_THRESHOLD = 0.001;
    const activeMiners        = miners.filter(n => n.active);
    const zeroIncentiveMiners = miners.filter(n => parseFloat(n.incentive || "0") < INCENTIVE_THRESHOLD);
    zeroIncentiveMinerCount   = zeroIncentiveMiners.length;
    zeroIncentiveMinerPct     = miners.length > 0
      ? Math.round((zeroIncentiveMinerCount / miners.length) * 100) : 0;
    activeMinerPct = miners.length > 0
      ? Math.round((activeMiners.length / miners.length) * 100) : 0;

    // Validator concentration via dividend Gini
    const validatorDividends    = validators.map(v => parseFloat(v.dividends || "0"));
    trustGiniVal                = gini(validatorDividends);
    const totalDividends        = validatorDividends.reduce((s, t) => s + t, 0);
    const sortedDividends       = [...validatorDividends].sort((a, b) => b - a);
    const top3Dividends         = sortedDividends.slice(0, 3).reduce((s, t) => s + t, 0);
    top3ValidatorTrustShare     = totalDividends > 0
      ? Math.round((top3Dividends / totalDividends) * 100) : 0;
  }

  // ── Weighted composite score ──────────────────────────────────────
  //
  // Each component is scored 0–100 independently, then combined by weight.
  // Components are only included when their data source is available —
  // missing data never hard-zeros the score.
  //
  // Weights (design intent, sum to 100):
  //   Nakamoto   20  — security foundation
  //   Miner burn 20  — ecosystem sustainability
  //   HHI        15  — stake concentration
  //   Top-10     15  — token distribution
  //   Chain buy  10  — organic demand signal
  //   Holders     8  — adoption proxy
  //   TAO Pool    7  — liquidity depth
  //   Stale val   5  — validator operational health (metagraph only)
  //
  // Gini and ZI Miners excluded from scoring:
  //   ZI Miners — 80–98% is normal in Bittensor (slot-holders), very noisy
  //   Gini      — redundant with Nakamoto/HHI; kept as display column only

  const components: { score: number; weight: number }[] = [];

  if (ts !== null) {
    components.push({ score: scoreNakamoto(nakamotoCoefficient), weight: 20 });
    components.push({ score: scoreBurn(burnedEmissionPct),        weight: 20 });
    components.push({ score: scoreHHI(hhiNormalized),             weight: 15 });
    components.push({ score: scoreTop10(top10Share),              weight: 15 });
    components.push({ score: scoreChainBuy(emissionChainBuysPct), weight: 10 });
    components.push({ score: scoreHolders(holdersCount),          weight:  8 });
    components.push({ score: scoreTaoPool(taoInPool),             weight:  7 });
  }

  if (hasNeuronData) {
    components.push({ score: scoreStaleVal(staleValidatorPct, validators.length), weight: 5 });
  }

  let score: number;
  if (components.length === 0) {
    score = 0; // No data at all — truly unknown
  } else {
    const totalWeight = components.reduce((s, c) => s + c.weight, 0);
    const weightedSum = components.reduce((s, c) => s + c.score * c.weight, 0);
    score = Math.round(weightedSum / totalWeight);
  }

  // ── Flags ─────────────────────────────────────────────────────────
  const flags: AuditFlag[] = [];

  if (!hasNeuronData) {
    flags.push({ type: "no_validators", severity: "warning", message: "No metagraph data — scored on market metrics only" });
  }

  if (hasNeuronData && staleValidatorPct >= 60) {
    flags.push({ type: "stale_weights",
      severity: staleValidatorPct >= 80 ? "critical" : "warning",
      message: `${staleValidatorPct}% of validators have stale weights (max lag ~${Math.round(maxWeightLagBlocks / 300)}h)` });
  }

  if (hasNeuronData && trustGiniVal >= 0.75) {
    flags.push({ type: "collusion_risk",
      severity: trustGiniVal >= 0.9 ? "critical" : "warning",
      message: `High dividend concentration (Gini ${trustGiniVal.toFixed(2)}, top-3 validators hold ${top3ValidatorTrustShare}% of rewards)` });
  }

  const burnPct = burnedEmissionPct ?? 0;
  if (burnPct >= 60) {
    flags.push({ type: "high_emission_burn",
      severity: burnPct >= 80 ? "critical" : "warning",
      message: `${burnPct.toFixed(1)}% of miner emissions burned — ${burnPct >= 80 ? "miners are net losers" : "reduces miner sustainability"}` });
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

  if (hasNeuronData && activeMinerPct < 20 && miners.length >= 10) {
    flags.push({ type: "low_activity", severity: "warning",
      message: `Only ${activeMinerPct}% of miners active — network underutilised` });
  }

  if (hasNeuronData && validators.length < 3) {
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
    burnedEmissionPct: Math.round((burnedEmissionPct ?? 0) * 10) / 10,
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
