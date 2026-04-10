/**
 * GET /api/cron/audit-scan
 *
 * Runs every 6 hours via Vercel cron.
 * Fetches metagraph data for every active subnet and computes operational
 * health metrics:
 *   - Weight staleness: are validators actually updating weights?
 *   - Burn code detection: miners registered but never queried (incentive ≈ 0)
 *   - Collusion risk: trust Gini coefficient across validators
 *
 * Saves results to audit-data.json (read by /api/scan and /api/audits).
 * Also saves weekly snapshots for the formal audit history.
 */

import { NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";
import { getSubnetIdentities, getMetagraph } from "@/lib/taostats";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ── Types ──────────────────────────────────────────────────────────
export interface AuditFlag {
  type: "burn_code" | "stale_weights" | "collusion_risk" | "low_activity" | "no_validators" | "healthy";
  severity: "critical" | "warning" | "info";
  message: string;
}

export interface SubnetAudit {
  netuid: number;
  name: string;

  // Overall
  grade: "A" | "B" | "C" | "D" | "F";
  operationalScore: number; // 0-100

  // Validator health
  validatorCount: number;
  staleValidatorCount: number;
  staleValidatorPct: number;    // % validators with weights far behind median
  maxWeightLagBlocks: number;   // worst-case lag vs most recent validator

  // Miner health
  minerCount: number;
  zeroIncentiveMinerCount: number;
  zeroIncentiveMinerPct: number; // % miners with incentive ≈ 0 (burn proxy)
  activeMinerPct: number;

  // Collusion risk
  trustGini: number;            // 0-1, higher = more concentrated
  top3ValidatorTrustShare: number; // % of total trust held by top 3 validators

  // Flags
  flags: AuditFlag[];

  updatedAt: string;
}

export interface AuditData {
  subnets: Record<number, SubnetAudit>;
  updatedAt: string;
  totalScanned: number;
}

// ── Helpers ────────────────────────────────────────────────────────

/** Gini coefficient — 0 = perfect equality, 1 = complete concentration */
function gini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((s, v) => s + v, 0);
  if (sum === 0) return 0;
  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (2 * (i + 1) - n - 1) * sorted[i];
  }
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
): SubnetAudit {
  const now = new Date().toISOString();

  if (!neurons || neurons.length === 0) {
    return {
      netuid, name, grade: "F", operationalScore: 0,
      validatorCount: 0, staleValidatorCount: 0, staleValidatorPct: 0, maxWeightLagBlocks: 0,
      minerCount: 0, zeroIncentiveMinerCount: 0, zeroIncentiveMinerPct: 0, activeMinerPct: 0,
      trustGini: 0, top3ValidatorTrustShare: 0,
      flags: [{ type: "no_validators", severity: "warning", message: "No neuron data available" }],
      updatedAt: now,
    };
  }

  const validators = neurons.filter(n => n.validator_permit);
  const miners = neurons.filter(n => !n.validator_permit);

  // ── Weight staleness ─────────────────────────────────────────────
  // STALE_THRESHOLD: 7200 blocks ≈ 24h (Bittensor ~12s/block)
  // A validator is stale if its last_update is far behind the most
  // recently active validator in the same subnet.
  const STALE_THRESHOLD = 7200;
  let staleValidatorCount = 0;
  let maxWeightLagBlocks = 0;

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
    ? Math.round((staleValidatorCount / validators.length) * 100)
    : 0;

  // ── Zero-incentive miners (burn code proxy) ───────────────────────
  // Miners with incentive < 0.001 are effectively never queried.
  const INCENTIVE_THRESHOLD = 0.001;
  const activeMiners = miners.filter(n => n.active);
  const zeroIncentiveMiners = miners.filter(n => parseFloat(n.incentive || "0") < INCENTIVE_THRESHOLD);
  const zeroIncentiveMinerCount = zeroIncentiveMiners.length;
  const zeroIncentiveMinerPct = miners.length > 0
    ? Math.round((zeroIncentiveMinerCount / miners.length) * 100)
    : 0;
  const activeMinerPct = miners.length > 0
    ? Math.round((activeMiners.length / miners.length) * 100)
    : 0;

  // ── Trust concentration (collusion risk) ─────────────────────────
  // High Gini = one or few validators dominate trust = collusion signal
  const validatorTrusts = validators.map(v => parseFloat(v.trust || "0"));
  const trustGiniVal = gini(validatorTrusts);

  const totalTrust = validatorTrusts.reduce((s, t) => s + t, 0);
  const sortedTrusts = [...validatorTrusts].sort((a, b) => b - a);
  const top3Trust = sortedTrusts.slice(0, 3).reduce((s, t) => s + t, 0);
  const top3ValidatorTrustShare = totalTrust > 0
    ? Math.round((top3Trust / totalTrust) * 100)
    : 0;

  // ── Operational score (starts at 80, penalties applied) ──────────
  let score = 80;

  // Stale validators
  if (staleValidatorPct >= 90) score -= 30;
  else if (staleValidatorPct >= 70) score -= 22;
  else if (staleValidatorPct >= 50) score -= 14;
  else if (staleValidatorPct >= 25) score -= 7;
  else if (staleValidatorPct <= 5 && validators.length >= 5) score += 8; // freshness bonus

  // Burn code (zero-incentive miners)
  if (zeroIncentiveMinerPct >= 90) score -= 25;
  else if (zeroIncentiveMinerPct >= 70) score -= 18;
  else if (zeroIncentiveMinerPct >= 50) score -= 10;
  else if (zeroIncentiveMinerPct >= 30) score -= 5;
  else if (zeroIncentiveMinerPct <= 10 && miners.length >= 5) score += 5;

  // Collusion / trust concentration
  if (trustGiniVal >= 0.9) score -= 20;
  else if (trustGiniVal >= 0.75) score -= 12;
  else if (trustGiniVal >= 0.6) score -= 6;
  else if (trustGiniVal <= 0.35 && validators.length >= 8) score += 5; // healthy distribution

  // Not enough validators is a weak signal
  if (validators.length < 3) score -= 10;
  else if (validators.length >= 16) score += 5;

  score = Math.max(0, Math.min(100, Math.round(score)));

  // ── Build flags ───────────────────────────────────────────────────
  const flags: AuditFlag[] = [];

  if (zeroIncentiveMinerPct >= 80) {
    flags.push({
      type: "burn_code",
      severity: "critical",
      message: `${zeroIncentiveMinerPct}% of miners have zero incentive — possible burn code or miners not being queried`,
    });
  }

  if (staleValidatorPct >= 60) {
    flags.push({
      type: "stale_weights",
      severity: staleValidatorPct >= 80 ? "critical" : "warning",
      message: `${staleValidatorPct}% of validators have weights >24h stale (max lag: ${maxWeightLagBlocks.toLocaleString()} blocks)`,
    });
  }

  if (trustGiniVal >= 0.75) {
    flags.push({
      type: "collusion_risk",
      severity: trustGiniVal >= 0.9 ? "critical" : "warning",
      message: `Trust highly concentrated (Gini=${trustGiniVal.toFixed(2)}, top-3 hold ${top3ValidatorTrustShare}% of trust) — possible validator collusion`,
    });
  }

  if (activeMinerPct < 20 && miners.length >= 10) {
    flags.push({
      type: "low_activity",
      severity: "warning",
      message: `Only ${activeMinerPct}% of miners are active — network underutilized`,
    });
  }

  if (validators.length < 3) {
    flags.push({
      type: "no_validators",
      severity: "warning",
      message: `Only ${validators.length} validator(s) detected — insufficient decentralization`,
    });
  }

  if (flags.length === 0) {
    flags.push({
      type: "healthy",
      severity: "info",
      message: "All systems nominal — no anomalies detected",
    });
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
  const cronSecret = process.env.CRON_SECRET;
  if (!isVercelCron && cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  if (!token) return NextResponse.json({ error: "No blob token" }, { status: 500 });

  const startTime = Date.now();

  // Subnets permanently excluded from audits (Root network is not a real task subnet)
  const AUDIT_EXCLUDED_NETUIDS = new Set([0]);

  // Load subnet identities
  const allIdentities = await getSubnetIdentities().catch(() => []);
  if (allIdentities.length === 0) {
    return NextResponse.json({ error: "No subnet identities" }, { status: 500 });
  }
  const identities = allIdentities.filter(id => !AUDIT_EXCLUDED_NETUIDS.has(id.netuid));

  // Fetch metagraph in parallel batches of 8 to avoid rate limiting
  const BATCH_SIZE = 8;
  const results: Record<number, SubnetAudit> = {};
  let scanned = 0;
  let errors = 0;

  for (let i = 0; i < identities.length; i += BATCH_SIZE) {
    const batch = identities.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (id) => {
        const neurons = await getMetagraph(id.netuid);
        return { id, neurons };
      })
    );

    for (const r of batchResults) {
      if (r.status !== "fulfilled") { errors++; continue; }
      const { id, neurons } = r.value;
      results[id.netuid] = computeAudit(id.netuid, id.subnet_name || `SN${id.netuid}`, neurons);
      scanned++;
    }

    // Small delay between batches to be a good API citizen
    if (i + BATCH_SIZE < identities.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  const auditData: AuditData = {
    subnets: results,
    updatedAt: new Date().toISOString(),
    totalScanned: scanned,
  };

  // Save main audit file
  await put("audit-data.json", JSON.stringify(auditData), {
    access: "private", addRandomSuffix: false, allowOverwrite: true, token,
    contentType: "application/json",
  });

  // Save weekly snapshot (only overwrite if same day doesn't exist yet)
  const today = new Date().toISOString().slice(0, 10);
  const weekday = new Date().getDay(); // 0=Sunday
  if (weekday === 1) { // Every Monday — create a new weekly audit report
    const weekKey = `audit-history/${today}.json`;
    try {
      await put(weekKey, JSON.stringify(auditData), {
        access: "private", addRandomSuffix: false, allowOverwrite: false, token,
        contentType: "application/json",
      });
    } catch { /* already exists this week — skip */ }
  }

  const duration = Date.now() - startTime;
  const gradeBreakdown = Object.values(results).reduce((acc, a) => {
    acc[a.grade] = (acc[a.grade] || 0) + 1; return acc;
  }, {} as Record<string, number>);

  console.log(`[audit-scan] Done in ${duration}ms. ${scanned} scanned, ${errors} errors. Grades: ${JSON.stringify(gradeBreakdown)}`);

  return NextResponse.json({
    ok: true,
    duration_ms: duration,
    scanned,
    errors,
    grades: gradeBreakdown,
  });
}
