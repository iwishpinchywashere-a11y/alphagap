/**
 * The rules that decide WHICH subnets the AlphaGap Index holds and HOW the
 * ten positions are sized. One place, imported by the rebalance cron (which
 * moves member funds) and by the Index page (which previews it), so the two
 * can never disagree. No server-only imports here: the page is a client
 * component.
 */

export const INDEX_SIZE = 10;

/**
 * Hard liquidity floor for index eligibility, in USD market cap.
 *
 * This is deliberately NOT a score penalty. The investing score already
 * penalises size, but any penalty can be out-stacked by bonuses, and on
 * 2026-11-03 it was: SOMA ($9M), ORO ($9M) and Ingot ($6M), all pre-revenue,
 * sat at #7-#9 above engy ($41M, $1.46M ARR) and Vanta ($41M, $1.71M ARR).
 * The index concentrates real member funds into ten names, and a position
 * that cannot be exited without moving the price is a liquidity problem
 * however good the product is. Below this line a subnet can still score well
 * and rank well on the leaderboard; it just cannot be an index constituent.
 */
export const INDEX_MIN_MARKET_CAP_USD = 20_000_000;

/** Flattener for the weight taper. Lower = more concentrated. */
export const TAPER_OFFSET = 16;
/** No single position above this percentage, whatever it scores. */
export const MAX_WEIGHT = 25;

export interface IndexCandidate {
  netuid: number;
  name: string;
  invest_agap?: number;
  market_cap?: number;
}

export interface IndexSelection<T extends IndexCandidate> {
  constituents: T[];
  /** Constituents admitted from below the floor because fewer than INDEX_SIZE cleared it. */
  belowFloorFills: T[];
  /** Highest-scoring subnets excluded purely by the floor, for display and logs. */
  excludedByFloor: T[];
}

/**
 * Top N by investing score among subnets at or above the market-cap floor.
 * If fewer than N clear the floor the remainder is filled from the best
 * below-floor subnets, so the index is never under-diversified; that is the
 * "almost" in "small caps almost never make the index", and it is reported
 * so it can be seen.
 */
export function selectIndexConstituents<T extends IndexCandidate>(rows: T[], n: number = INDEX_SIZE): IndexSelection<T> {
  const ranked = [...rows]
    .filter(s => (s.invest_agap ?? 0) > 0)
    .sort((a, b) => (b.invest_agap ?? 0) - (a.invest_agap ?? 0));
  const eligible = ranked.filter(s => (s.market_cap ?? 0) >= INDEX_MIN_MARKET_CAP_USD);
  const constituents = eligible.slice(0, n);
  const belowFloorFills: T[] = [];
  if (constituents.length < n) {
    for (const s of ranked) {
      if (constituents.length >= n) break;
      if (!constituents.includes(s)) { constituents.push(s); belowFloorFills.push(s); }
    }
  }
  // Keep score order after any fills.
  constituents.sort((a, b) => (b.invest_agap ?? 0) - (a.invest_agap ?? 0));
  const cut = constituents.length ? (constituents[constituents.length - 1].invest_agap ?? 0) : 0;
  const excludedByFloor = ranked.filter(s => (s.market_cap ?? 0) < INDEX_MIN_MARKET_CAP_USD && (s.invest_agap ?? 0) >= cut && !constituents.includes(s));
  return { constituents, belowFloorFills, excludedByFloor };
}

/**
 * Preview of the taper buildWeights applies, as one-decimal percentages.
 * buildWeights (lib/trustedstake) does the same maths and then rounds to
 * integers summing to exactly 100; this is what the page shows.
 */
export function taperWeights(scores: number[]): number[] {
  if (scores.length === 0) return [];
  const min = Math.min(...scores);
  const basis = scores.map(v => Math.max(0, v - min) + TAPER_OFFSET);
  const total = basis.reduce((s, v) => s + v, 0);
  const cap = Math.max(MAX_WEIGHT, 100 / scores.length);
  const pct = basis.map(v => (total > 0 ? (v / total) * 100 : 0));
  for (let pass = 0; pass < 10; pass++) {
    const excess = pct.reduce((s, v) => s + Math.max(0, v - cap), 0);
    if (excess <= 1e-9) break;
    const under = pct.reduce((s, v) => s + (v < cap ? v : 0), 0);
    if (under <= 0) break;
    for (let i = 0; i < pct.length; i++) pct[i] = pct[i] > cap ? cap : pct[i] + excess * (pct[i] / under);
  }
  return pct.map(v => Math.round(v * 10) / 10);
}
