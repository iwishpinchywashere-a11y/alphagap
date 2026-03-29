import { getDb } from "./db";
import * as taostats from "./taostats";

const RAO = 1e9;

/**
 * Collects staking, validator, and metagraph data for all subnets.
 * Populates the subnet_staking table with:
 * - Validator count & alpha holdings
 * - Miner count & registration activity
 * - Incentive/trust distribution
 * - Registration cost (demand signal)
 * - Coldkey concentration (centralization risk)
 */
export async function collectStakingData(): Promise<{ subnets: number; validators: number }> {
  const db = getDb();
  let subnetCount = 0;
  let validatorCount = 0;
  const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");

  const insertStaking = db.prepare(`
    INSERT OR REPLACE INTO subnet_staking
      (netuid, timestamp, total_alpha_staked, validator_count, top_validator_share,
       registration_cost, miner_count, registrations_24h, deregistrations_24h,
       avg_incentive, avg_trust, coldkey_concentration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Get validator alpha shares (shows who holds alpha in each subnet)
  const alphaSharesMap = new Map<number, { totalAlpha: number; validatorCount: number; topShare: number }>();
  try {
    const shares = await taostats.getValidatorAlphaShares();

    // Group by netuid
    const bySubnet = new Map<number, Array<{ alpha: number }>>();
    for (const s of shares) {
      if (s.netuid == null || s.netuid === 0) continue;
      const alpha = parseFloat(s.alpha) / RAO;
      if (!bySubnet.has(s.netuid)) bySubnet.set(s.netuid, []);
      bySubnet.get(s.netuid)!.push({ alpha });
    }

    for (const [netuid, validators] of bySubnet) {
      const totalAlpha = validators.reduce((sum, v) => sum + v.alpha, 0);
      const topAlpha = validators.length > 0 ? Math.max(...validators.map(v => v.alpha)) : 0;
      const topShare = totalAlpha > 0 ? topAlpha / totalAlpha : 0;
      alphaSharesMap.set(netuid, {
        totalAlpha,
        validatorCount: validators.length,
        topShare,
      });
      validatorCount += validators.length;
    }
  } catch (e) {
    console.error("Failed to fetch validator alpha shares:", e);
  }

  await new Promise(r => setTimeout(r, 1500));

  // 2. Get registration costs (demand for subnet slots)
  const regCostMap = new Map<number, number>();
  try {
    const costs = await taostats.getRegistrationCosts();
    for (const c of costs) {
      regCostMap.set(c.netuid, parseFloat(c.cost) / RAO);
    }
  } catch (e) {
    console.error("Failed to fetch registration costs:", e);
  }

  await new Promise(r => setTimeout(r, 1500));

  // 3. Sample metagraph for a few key subnets (top 30 by market cap)
  // Full metagraph for all 128 would be too many API calls
  const topSubnets = db.prepare(
    `SELECT DISTINCT netuid FROM subnet_metrics
     WHERE market_cap IS NOT NULL AND netuid > 0
     ORDER BY market_cap DESC LIMIT 10`
  ).all() as Array<{ netuid: number }>;

  const metagraphMap = new Map<number, {
    minerCount: number;
    avgIncentive: number;
    avgTrust: number;
  }>();

  for (const sub of topSubnets) {
    try {
      const neurons = await taostats.getMetagraph(sub.netuid);
      if (neurons.length > 0) {
        const miners = neurons.filter(n => !n.validator_permit);
        const activeNeurons = neurons.filter(n => n.active);

        const avgIncentive = activeNeurons.length > 0
          ? activeNeurons.reduce((sum, n) => sum + parseFloat(n.incentive || "0"), 0) / activeNeurons.length
          : 0;
        const avgTrust = activeNeurons.length > 0
          ? activeNeurons.reduce((sum, n) => sum + parseFloat(n.trust || "0"), 0) / activeNeurons.length
          : 0;

        metagraphMap.set(sub.netuid, {
          minerCount: miners.length,
          avgIncentive,
          avgTrust,
        });
      }
      await new Promise(r => setTimeout(r, 500)); // rate limit
    } catch (e) {
      console.error(`Failed to fetch metagraph for SN${sub.netuid}:`, e);
    }
  }

  // 4. Get recent registration events for the top subnets
  const regCountMap = new Map<number, { regs: number; deregs: number }>();
  const since24h = new Date(Date.now() - 86400000).toISOString();

  // Only check top 10 subnets for registration events (expensive call)
  for (const sub of topSubnets.slice(0, 10)) {
    try {
      const regs = await taostats.getNeuronRegistrations(sub.netuid, since24h);
      regCountMap.set(sub.netuid, { regs: regs.length, deregs: 0 }); // deregistrations would need a separate endpoint
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      // ignore individual failures
    }
  }

  // 5. Insert everything into DB
  const allNetuids = new Set([
    ...alphaSharesMap.keys(),
    ...regCostMap.keys(),
    ...metagraphMap.keys(),
  ]);

  for (const netuid of allNetuids) {
    if (!netuid || netuid === 0) continue;

    const alpha = alphaSharesMap.get(netuid);
    const metagraph = metagraphMap.get(netuid);
    const regCost = regCostMap.get(netuid);
    const regCounts = regCountMap.get(netuid);

    insertStaking.run(
      netuid,
      timestamp,
      alpha?.totalAlpha || null,
      alpha?.validatorCount || null,
      alpha?.topShare || null,
      regCost || null,
      metagraph?.minerCount || null,
      regCounts?.regs || null,
      regCounts?.deregs || null,
      metagraph?.avgIncentive || null,
      metagraph?.avgTrust || null,
      null // coldkey concentration - would need separate per-subnet call
    );
    subnetCount++;
  }

  return { subnets: subnetCount, validators: validatorCount };
}
