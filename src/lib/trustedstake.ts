// AlphaGap × TrustedStake - Manager API Client
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
  /** Strategy pure proxy - the delegate members grant Staking rights to. */
  pureProxyAddress?: string;
  /** True while TrustedStake is executing a rebalance. Can get stuck. */
  isRebalancing?: boolean;
  lastRebalanceStartedAt?: string | null;
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
//
// MEDIUM TAPER (2026-10-27). Weights used to be score/sum, which barely
// expressed conviction: the top 10 scores sit in a narrow band, so the index
// came out near equal-weighted (best pick 11%, worst 9% - a 1.2x spread on a
// ranking we do a lot of work to produce). The basis is now the score's
// DISTANCE ABOVE THE WEAKEST HOLDING plus a floor, so the spread between
// picks drives sizing: a tight top 10 stays flattish, a top-heavy one tilts.
//
// TAPER_OFFSET is the flattener. Lower = more concentrated. At 16, the board
// on 2026-10-28 (scores 100 down to 76) prices at 16/15/12/10/9/9/8/8/7/6,
// against 12/11/11/10/10/10/9/9/9/9 under the old proportional scheme: a
// 2.7x spread top to bottom rather than 1.3x. Deliberately gentler than the
// 8 this shipped with (which gave 19/5, 3.8x) - the aim is to reward rank
// without shrinking the tenth name below a size worth holding.
// The exact shape moves with the score spread each week, by design.
const TAPER_OFFSET = 16;
// Hard ceiling on any single position. The taper is unbounded by design: if
// one subnet ever scores far above the rest (100 against a field of 50) it
// would take ~44% of every member's wallet. These are real funds in ten
// names, so no single subnet gets more than this regardless of score.
const MAX_WEIGHT = 25;

export function buildWeights(
  subnets: Array<{ netuid: number; name: string; invest_agap: number }>
): { weights: Record<string, number>; holdings: IndexHolding[] } {
  if (subnets.length === 0) throw new Error("No subnets provided");

  const total = subnets.reduce((s, e) => s + e.invest_agap, 0);
  if (total === 0) throw new Error("All invest_agap scores are 0");

  // Taper basis: distance above the weakest holding, plus the flattener.
  // Always positive, so a subnet can never price at zero.
  const minScore = Math.min(...subnets.map(s => s.invest_agap));
  const basisOf = (score: number) => Math.max(0, score - minScore) + TAPER_OFFSET;
  const basisTotal = subnets.reduce((s, e) => s + basisOf(e.invest_agap), 0);

  // Exact percentages, then pull anything over the ceiling back down and
  // share the excess across the rest in proportion to their own basis.
  // Looped because trimming one can push another over.
  const exactPct = new Map<number, number>(
    subnets.map(s => [s.netuid, (basisOf(s.invest_agap) / basisTotal) * 100]),
  );
  // A ceiling of 25 is impossible to satisfy with fewer than four holdings -
  // every entry pins to the cap, the excess has nowhere to go, and the
  // weights stop summing to 100. Raise the effective ceiling to whatever an
  // equal split would be whenever the configured one cannot be met.
  const cap = Math.max(MAX_WEIGHT, 100 / subnets.length);
  for (let pass = 0; pass < 10; pass++) {
    const over = [...exactPct.entries()].filter(([, v]) => v > cap + 1e-9);
    if (over.length === 0) break;
    let excess = 0;
    for (const [id, v] of over) { excess += v - cap; exactPct.set(id, cap); }
    const under = [...exactPct.entries()].filter(([, v]) => v < cap - 1e-9);
    const underTotal = under.reduce((s, [, v]) => s + v, 0);
    if (underTotal <= 0) break;
    for (const [id, v] of under) exactPct.set(id, v + excess * (v / underTotal));
  }

  // Floored weights + fractional remainder tracking
  const items = subnets.map(s => {
    const exact = exactPct.get(s.netuid) ?? 0;
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
    const drift = 100 - weightSum;
    // Correct on the heaviest entry, but when adding points skip anything
    // already at the ceiling - otherwise this last step could quietly push a
    // position past MAX_WEIGHT and undo the cap above.
    const ranked = Object.entries(weights).sort((a, b) => b[1] - a[1]);
    const target = drift > 0
      ? (ranked.find(([, w]) => w + drift <= cap) ?? ranked[ranked.length - 1])
      : ranked[0];
    const topKey = target[0];
    weights[topKey] += drift;
    const holding = holdings.find(h => String(h.netuid) === topKey);
    if (holding) holding.weight += drift;
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
    throw new Error(`TrustedStake PATCH weights failed: ${res.status} - ${text}`);
  }
}

export async function makeStrategyPublic(): Promise<void> {
  if (!TS_API_KEY || !TS_STRATEGY_ID) throw new Error("TrustedStake env vars not configured");
  const res = await fetch(`${TS_BASE}/strategies/${TS_STRATEGY_ID}`, {
    method: "PATCH",
    headers: tsHeaders(),
    body: JSON.stringify({ isPublic: true }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PATCH strategy failed: ${res.status} - ${text}`);
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
    throw new Error(`TrustedStake rebalance failed: ${res.status} - ${text}`);
  }
  const json = await res.json();
  return { queued: true, message: json.message || "Rebalance queued" };
}
