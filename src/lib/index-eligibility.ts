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

/**
 * Below this, never. Between here and INDEX_MIN_MARKET_CAP_USD a subnet can
 * still qualify, but only by PROVING itself on the business side (see
 * isIndexEligible): real revenue, actually buying back, and growing. That is
 * the room for "a subnet like Bitcast" the index should leave open, without
 * reopening the door to pre-revenue small caps riding chain signals.
 */
export const INDEX_HARD_FLOOR_USD = 10_000_000;
/** Stated ARR a mid-band subnet needs before size is forgiven. */
export const INDEX_BAND_MIN_ARR_USD = 500_000;

/** Flattener for the weight taper. Lower = more concentrated. */
export const TAPER_OFFSET = 16;
/** No single position above this percentage, whatever it scores. */
export const MAX_WEIGHT = 25;

export interface IndexCandidate {
  netuid: number;
  name: string;
  invest_agap?: number;
  market_cap?: number;
  // Business fields the scan writes on every leaderboard row, used for the
  // mid-band exception. All optional so older rows still type-check.
  annual_revenue_usd?: number;
  revenue_confidence?: string;
  buyback_status?: string;
  growth_trend?: string;
}

export type IndexEligibility =
  | { eligible: true; via: "size" | "proven" }
  | { eligible: false; reason: string };

/**
 * Three bands:
 *  - >= $20M: eligible on size.
 *  - $10M to $20M: eligible only if ALL of these hold - stated ARR of at least
 *    $500K with confidence confirmed or self_reported, buybacks active, and
 *    revenue trend accelerating or growing. Any one failing keeps it out, and
 *    the reason names the failing leg so the page can say why.
 *  - < $10M: never, whatever the metrics.
 */
export function isIndexEligible(s: IndexCandidate): IndexEligibility {
  const mc = s.market_cap ?? 0;
  if (mc >= INDEX_MIN_MARKET_CAP_USD) return { eligible: true, via: "size" };
  if (mc < INDEX_HARD_FLOOR_USD) return { eligible: false, reason: `under the $${INDEX_HARD_FLOOR_USD / 1e6}M hard floor` };
  const arr = s.annual_revenue_usd ?? 0;
  const conf = s.revenue_confidence ?? "";
  if (!(arr >= INDEX_BAND_MIN_ARR_USD)) return { eligible: false, reason: arr > 0 ? "revenue under $500K" : "pre-revenue" };
  if (!(conf === "confirmed" || conf === "self_reported")) return { eligible: false, reason: `revenue only ${conf || "unverified"}` };
  if (s.buyback_status !== "active") return { eligible: false, reason: "no active buyback" };
  if (!(s.growth_trend === "accelerating" || s.growth_trend === "growing")) {
    return { eligible: false, reason: s.growth_trend === "declining" ? "revenue declining" : "revenue not growing" };
  }
  return { eligible: true, via: "proven" };
}

export interface IndexSelection<T extends IndexCandidate> {
  constituents: T[];
  /** Constituents admitted despite being ineligible, because fewer than INDEX_SIZE qualified. */
  belowFloorFills: T[];
  /** Highest-scoring subnets excluded by eligibility, with the reason, for display and logs. */
  excludedByFloor: Array<T & { exclusionReason: string }>;
  /** Constituents that got in through the mid-band proven-business exception. */
  provenExceptions: T[];
}

/**
 * Top N by investing score among eligible subnets (see isIndexEligible).
 * If fewer than N qualify the remainder is filled from the best ineligible
 * subnets, so the index is never under-diversified; that fill is reported so
 * it can be seen rather than happening silently.
 */
export function selectIndexConstituents<T extends IndexCandidate>(rows: T[], n: number = INDEX_SIZE): IndexSelection<T> {
  const ranked = [...rows]
    .filter(s => (s.invest_agap ?? 0) > 0)
    .sort((a, b) => (b.invest_agap ?? 0) - (a.invest_agap ?? 0));
  const verdict = new Map<T, IndexEligibility>(ranked.map(s => [s, isIndexEligible(s)]));
  const eligible = ranked.filter(s => verdict.get(s)!.eligible);
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
  const excludedByFloor = ranked
    .filter(s => !verdict.get(s)!.eligible && (s.invest_agap ?? 0) >= cut && !constituents.includes(s))
    .map(s => Object.assign({}, s, { exclusionReason: (verdict.get(s) as { eligible: false; reason: string }).reason }));
  const provenExceptions = constituents.filter(s => { const v = verdict.get(s); return v?.eligible && v.via === "proven"; });
  return { constituents, belowFloorFills, excludedByFloor, provenExceptions };
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
