import { getDb } from "./db";
import * as taostats from "./taostats";

const RAO = 1e9;

/**
 * Collects revenue, emission, and sustainability data for all subnets.
 * Populates the subnet_revenue table with:
 * - Emission rate & network share
 * - Burned alpha (deflationary)
 * - TAO inflow/outflow (buy/sell volumes)
 * - Coverage ratio (inflow/outflow = sustainability)
 * - Liquidity depth
 * - Emission trend over 7d
 */
export async function collectRevenueData(): Promise<{ subnets: number; burnedAlphaSubnets: number }> {
  const db = getDb();
  let subnetCount = 0;
  let burnedAlphaSubnets = 0;
  const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");

  const insertRevenue = db.prepare(`
    INSERT OR REPLACE INTO subnet_revenue
      (netuid, timestamp, emission_tao, emission_share, burned_alpha,
       tao_inflow, tao_outflow, net_revenue, coverage_ratio,
       liquidity_depth, emission_trend_7d)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Get current emissions (already fetched in main collector, but we need totals)
  const emissionMap = new Map<number, { emissionTao: number }>();
  let totalEmission = 0;
  try {
    const emissions = await taostats.getSubnetEmissions();
    for (const e of emissions) {
      const emissionTao = parseFloat(e.alpha_rewards) / RAO;
      emissionMap.set(e.netuid, { emissionTao });
      totalEmission += emissionTao;
    }
  } catch (e) {
    console.error("Failed to fetch emissions for revenue:", e);
  }

  await new Promise(r => setTimeout(r, 500));

  // 2. Get burned alpha
  const burnedMap = new Map<number, number>();
  try {
    const burned = await taostats.getBurnedAlpha();
    for (const b of burned) {
      const burnedAmount = parseFloat(b.burned_alpha) / RAO;
      if (burnedAmount > 0) {
        burnedMap.set(b.netuid, burnedAmount);
        burnedAlphaSubnets++;
      }
    }
  } catch (e) {
    console.error("Failed to fetch burned alpha:", e);
  }

  await new Promise(r => setTimeout(r, 500));

  // 3. Get pool data for inflow/outflow/liquidity (re-use from current metrics)
  const poolData = db.prepare(
    `SELECT netuid, net_flow_24h, volume_24h, alpha_reserve, tao_reserve,
            market_cap, emission_rate
     FROM subnet_metrics
     WHERE netuid > 0
     GROUP BY netuid
     HAVING timestamp = MAX(timestamp)`
  ).all() as Array<{
    netuid: number;
    net_flow_24h: number | null;
    volume_24h: number | null;
    alpha_reserve: number | null;
    tao_reserve: number | null;
    market_cap: number | null;
    emission_rate: number | null;
  }>;

  // Also get previous emission data for trend calculation (7 days ago)
  const previousEmissions = db.prepare(
    `SELECT netuid, emission_rate
     FROM subnet_metrics
     WHERE timestamp < datetime('now', '-6 days')
     AND timestamp > datetime('now', '-8 days')
     GROUP BY netuid
     HAVING timestamp = MAX(timestamp)`
  ).all() as Array<{ netuid: number; emission_rate: number | null }>;
  const prevEmissionMap = new Map(previousEmissions.map(e => [e.netuid, e.emission_rate]));

  // 4. Get buy/sell volumes from pool data for coverage ratio
  let poolMap = new Map<number, taostats.SubnetPool>();
  try {
    const pools = await taostats.getSubnetPools();
    poolMap = new Map(pools.map(p => [p.netuid, p]));
  } catch (e) {
    console.error("Failed to fetch pools for revenue:", e);
  }

  // 5. Insert revenue data for all subnets
  const allNetuids = new Set([
    ...emissionMap.keys(),
    ...burnedMap.keys(),
    ...poolData.map(p => p.netuid),
  ]);

  for (const netuid of allNetuids) {
    if (netuid === 0) continue;

    const emission = emissionMap.get(netuid);
    const burned = burnedMap.get(netuid) || 0;
    const pool = poolMap.get(netuid);

    // Calculate inflow/outflow from pool buy/sell volumes
    const buyVol = pool ? parseFloat(pool.tao_buy_volume_24_hr || "0") / RAO : 0;
    const sellVol = pool ? parseFloat(pool.tao_sell_volume_24_hr || "0") / RAO : 0;
    const netRevenue = buyVol - sellVol;
    const coverageRatio = sellVol > 0 ? buyVol / sellVol : (buyVol > 0 ? 10 : 0);
    const liquidityDepth = pool ? parseFloat(pool.liquidity || "0") / RAO : 0;

    // Emission share
    const emissionShare = (emission && totalEmission > 0) ? emission.emissionTao / totalEmission : 0;

    // Emission trend: compare current vs 7d ago
    const currentEmission = emission?.emissionTao || 0;
    const prevEmission = prevEmissionMap.get(netuid);
    const emissionTrend = (prevEmission && prevEmission > 0)
      ? ((currentEmission - prevEmission) / prevEmission) * 100
      : null;

    insertRevenue.run(
      netuid,
      timestamp,
      currentEmission,
      emissionShare,
      burned,
      buyVol,
      sellVol,
      netRevenue,
      coverageRatio > 0 ? Math.min(coverageRatio, 10) : 0, // cap at 10x
      liquidityDepth,
      emissionTrend
    );
    subnetCount++;
  }

  return { subnets: subnetCount, burnedAlphaSubnets };
}
