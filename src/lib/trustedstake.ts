// AlphaGap × TrustedStake — Manager API Client
// Manages the AlphaGap Subnet Index strategy on TrustedStake.
// Docs: https://trustedstake.gitbook.io/trustedstake/strategies/manager-api

const TS_BASE = "https://api.app.trustedstake.ai/api/v1/manager-api";
const TS_API_KEY = process.env.TRUSTEDSTAKE_API_KEY || "";
const TS_STRATEGY_ID = process.env.TRUSTEDSTAKE_STRATEGY_ID || "";

function tsHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TS_API_KEY}`,
  };
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface TSStrategy {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  isPublic: boolean;
  rebalanceFrequency: string;
  targetConstituents: { subnetWeights: Record<string, number> };
  rebalancingRules: {
    threshold: number;
    maxSlippage: number;
    minBalance: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TSRebalanceResult {
  queued: boolean;
  message: string;
}

export interface IndexHolding {
  netuid: number;
  name: string;
  invest_score: number;
  weight: number; // integer, all holdings sum to 100
}

// ── Weight normalisation ─────────────────────────────────────────────────────
// Takes top-N subnets by invest_agap score and converts to integer weights
// that sum to EXACTLY 100 using the largest-remainder method.

export function buildWeights(
  subnets: Array<{ netuid: number; name: string; invest_agap: number }>
): { weights: Record<string, number>; holdings: IndexHolding[] } {
  if (subnets.length === 0) throw new Error("No subnets provided");

  const total = subnets.reduce((s, e) => s + e.invest_agap, 0);
  if (total === 0) throw new Error("All invest_agap scores are 0");

  // Proportional floored weights + fractional remainder tracking
  const items = subnets.map(s => {
    const exact = (s.invest_agap / total) * 100;
    return { ...s, exact, floor: Math.floor(exact), frac: exact - Math.floor(exact) };
  });

  const remainder = 100 - items.reduce((s, e) => s + e.floor, 0);

  // Distribute remainder points to subnets with largest fractional parts
  items.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < remainder; i++) items[i].floor += 1;

  // Ensure no zero weights (minimum 1% per constituent)
  for (const item of items) {
    if (item.floor === 0) item.floor = 1;
  }

  // Re-sort by original invest_agap desc for display
  items.sort((a, b) => b.invest_agap - a.invest_agap);

  const weights: Record<string, number> = {};
  const holdings: IndexHolding[] = [];
  for (const item of items) {
    weights[String(item.netuid)] = item.floor;
    holdings.push({ netuid: item.netuid, name: item.name, invest_score: item.invest_agap, weight: item.floor });
  }

  // Final sanity check
  const weightSum = Object.values(weights).reduce((s, w) => s + w, 0);
  if (weightSum !== 100) {
    // Adjust the highest-weight entry to correct any rounding drift
    const topKey = Object.entries(weights).sort((a, b) => b[1] - a[1])[0][0];
    weights[topKey] += (100 - weightSum);
    const holding = holdings.find(h => String(h.netuid) === topKey);
    if (holding) holding.weight += (100 - weightSum);
  }

  return { weights, holdings };
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function getStrategy(): Promise<TSStrategy> {
  if (!TS_API_KEY || !TS_STRATEGY_ID) throw new Error("TrustedStake env vars not configured");
  const res = await fetch(`${TS_BASE}/strategies/${TS_STRATEGY_ID}`, {
    headers: tsHeaders(),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`TrustedStake GET strategy failed: ${res.status}`);
  const json = await res.json();
  return json.data as TSStrategy;
}

export async function updateStrategyWeights(
  weights: Record<string, number>,
  metadata?: { name?: string; description?: string }
): Promise<void> {
  if (!TS_API_KEY || !TS_STRATEGY_ID) throw new Error("TrustedStake env vars not configured");
  const body: Record<string, unknown> = {
    targetConstituents: { subnetWeights: weights },
  };
  if (metadata?.name) body.name = metadata.name;
  if (metadata?.description) body.description = metadata.description;

  const res = await fetch(`${TS_BASE}/strategies/${TS_STRATEGY_ID}`, {
    method: "PATCH",
    headers: tsHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TrustedStake PATCH weights failed: ${res.status} — ${text}`);
  }
}

export async function triggerRebalance(): Promise<TSRebalanceResult> {
  if (!TS_API_KEY || !TS_STRATEGY_ID) throw new Error("TrustedStake env vars not configured");
  const res = await fetch(`${TS_BASE}/strategies/${TS_STRATEGY_ID}/rebalance`, {
    method: "POST",
    headers: tsHeaders(),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TrustedStake rebalance failed: ${res.status} — ${text}`);
  }
  const json = await res.json();
  return { queued: true, message: json.message || "Rebalance queued" };
}
