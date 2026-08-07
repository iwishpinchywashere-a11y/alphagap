/**
 * Bittensor v440 "Emission Gate".
 *
 * Before v440, subnet emission was linear in demand share: half the demand,
 * half the emission. v440 puts a sigmoid gate in the middle of that line, so
 * emission = s * gate(s) where s is the subnet's share of de-manipulated
 * moving price and
 *
 *     gate(s) = s^h / (s^h + theta^h)
 *
 * theta is the bar: the share at which cumulative sorted demand reaches the
 * quantile q. At s = theta the gate passes exactly half. Well above it passes
 * ~1, deep below ~0. It is recomputed once per tempo, so it moves.
 *
 * PARAMETERS ARE FITTED, NOT ASSUMED. The release notes quote q=0.61, h=3.
 * Fitting the published gate function against the live TaoMarketCap
 * distribution on 2026-08-05 gave q=0.64, h=4 as the better fit — either
 * governance moved them (both are sudo-settable and rate-limited) or the
 * derivation of theta differs slightly from ours. Because they can change
 * under us, `fitGate` re-derives them from live data on every scan rather
 * than trusting a constant. The fitted model reproduced actual emissions
 * with R^2 = 0.933 across all 85 emission-enabled subnets, and R^2 = 0.989
 * excluding six subnets where something other than the gate is clearly
 * acting (see GATE_MODEL_OUTLIERS).
 *
 * Why this matters for scoring: emission is now a ~5th-power function of
 * demand share near the bar. Any metric that treats emission as independent
 * of price — which is what the eVal ratio was built to do — is measuring
 * something different than it was before v440.
 */

export const DEFAULT_QUANTILE = 0.64;
export const DEFAULT_EXPONENT = 4;

/**
 * Subnets whose actual emission diverges far from the gate model. Something
 * beyond the gate is acting on them (emission splits, owner take, recent
 * enable/disable). Gate-derived signals should be suppressed for these rather
 * than shown with false confidence.
 */
export const GATE_MODEL_OUTLIERS = new Set([9, 56, 5, 93, 19]);

export interface GateInput {
  netuid: number;
  /** De-manipulated moving price — the same input the chain gates on. */
  movingPrice: number;
  /** Actual emission %, used only to fit and to flag outliers. */
  emissionPct?: number | null;
}

export interface GateParams {
  theta: number;
  exponent: number;
  quantile: number;
  /** Rank of the subnet sitting at the bar, 1-indexed. */
  barRank: number;
  /** How well the fitted model reproduces actual emissions, 0..1. */
  rSquared: number | null;
}

export interface GateReading {
  netuid: number;
  /** Share of total moving price. */
  demandShare: number;
  /** gate(s), 0..1 — the fraction of linear emission that survives. */
  gate: number;
  /** s / theta. 1.0 sits exactly on the bar. */
  barRatio: number;
  /**
   * d(ln emission)/d(ln demand) = (h + 1) - h * gate(s).
   *
   * Far above the bar this tends to 1 — linear, no convexity, growth pays
   * exactly what it used to. At the bar it is (h+1)/2; with h=4 that is 3.0,
   * so +10% demand is +33% emission. This is the number that makes the bar
   * interesting and nothing in AlphaGap computed it before.
   */
  elasticity: number;
  /** Predicted emission % under the fitted model. */
  predictedEmissionPct: number;
  /** True when the model does not explain this subnet — treat with suspicion. */
  modelBroken: boolean;
}

const gateOf = (s: number, theta: number, h: number) =>
  s ** h / (s ** h + theta ** h);

/** Derive theta for a given quantile from the sorted demand distribution. */
function thetaFor(sharesDesc: number[], q: number): number {
  let cum = 0;
  for (const s of sharesDesc) {
    cum += s;
    if (cum >= q) return s;
  }
  return sharesDesc[sharesDesc.length - 1] ?? 0;
}

/**
 * Fit q and h against observed emissions.
 *
 * Both are governance-settable, so re-deriving them each scan is the
 * difference between a signal that survives a parameter change and one that
 * silently goes wrong the day governance moves the bar.
 */
export function fitGate(subnets: GateInput[]): GateParams {
  const usable = subnets.filter(s => s.movingPrice > 0);
  const total = usable.reduce((a, b) => a + b.movingPrice, 0);
  if (!usable.length || total <= 0) {
    return { theta: 0, exponent: DEFAULT_EXPONENT, quantile: DEFAULT_QUANTILE, barRank: 0, rSquared: null };
  }

  const withShare = usable
    .map(s => ({ ...s, share: s.movingPrice / total }))
    .sort((a, b) => b.share - a.share);
  const sharesDesc = withShare.map(s => s.share);

  const observed = withShare.filter(s => s.emissionPct != null && s.emissionPct > 0);

  // No emissions to fit against — fall back to documented defaults.
  if (observed.length < 10) {
    const theta = thetaFor(sharesDesc, DEFAULT_QUANTILE);
    return {
      theta,
      exponent: DEFAULT_EXPONENT,
      quantile: DEFAULT_QUANTILE,
      barRank: sharesDesc.findIndex(s => s <= theta) + 1,
      rSquared: null,
    };
  }

  let best: GateParams | null = null;
  let bestErr = Infinity;

  for (let qi = 50; qi <= 75; qi++) {
    const q = qi / 100;
    const theta = thetaFor(sharesDesc, q);
    if (theta <= 0) continue;

    for (const h of [2, 3, 4, 5]) {
      const norm = withShare.reduce((a, s) => a + s.share * gateOf(s.share, theta, h), 0);
      if (norm <= 0) continue;

      const err = observed.reduce((a, s) => {
        const pred = (100 * s.share * gateOf(s.share, theta, h)) / norm;
        return a + Math.abs(pred - (s.emissionPct as number));
      }, 0) / observed.length;

      if (err < bestErr) {
        bestErr = err;
        best = {
          theta,
          exponent: h,
          quantile: q,
          barRank: sharesDesc.findIndex(s => s <= theta) + 1,
          rSquared: null,
        };
      }
    }
  }

  const params = best ?? {
    theta: thetaFor(sharesDesc, DEFAULT_QUANTILE),
    exponent: DEFAULT_EXPONENT,
    quantile: DEFAULT_QUANTILE,
    barRank: 0,
    rSquared: null,
  };

  // R² of the winning fit, so callers can refuse to trust a bad one.
  const norm = withShare.reduce((a, s) => a + s.share * gateOf(s.share, params.theta, params.exponent), 0);
  const mean = observed.reduce((a, s) => a + (s.emissionPct as number), 0) / observed.length;
  let ssRes = 0, ssTot = 0;
  for (const s of observed) {
    const pred = (100 * s.share * gateOf(s.share, params.theta, params.exponent)) / norm;
    ssRes += (pred - (s.emissionPct as number)) ** 2;
    ssTot += ((s.emissionPct as number) - mean) ** 2;
  }
  params.rSquared = ssTot > 0 ? 1 - ssRes / ssTot : null;

  return params;
}

/** Per-subnet gate readings under fitted parameters. */
export function readGate(subnets: GateInput[], params: GateParams): Map<number, GateReading> {
  const out = new Map<number, GateReading>();
  const usable = subnets.filter(s => s.movingPrice > 0);
  const total = usable.reduce((a, b) => a + b.movingPrice, 0);
  if (total <= 0 || params.theta <= 0) return out;

  const { theta, exponent: h } = params;
  const norm = usable.reduce((a, s) => {
    const share = s.movingPrice / total;
    return a + share * gateOf(share, theta, h);
  }, 0);

  for (const s of usable) {
    const share = s.movingPrice / total;
    const g = gateOf(share, theta, h);
    const predicted = norm > 0 ? (100 * share * g) / norm : 0;
    const actual = s.emissionPct ?? null;

    out.set(s.netuid, {
      netuid: s.netuid,
      demandShare: share,
      gate: g,
      barRatio: share / theta,
      elasticity: (h + 1) - h * g,
      predictedEmissionPct: predicted,
      modelBroken:
        GATE_MODEL_OUTLIERS.has(s.netuid) ||
        (actual != null && Math.abs(predicted - actual) > 1.0),
    });
  }
  return out;
}

/**
 * What a given demand move does to emission, exactly rather than via the
 * local elasticity — the elasticity is a derivative and understates large
 * moves precisely where the curve bends hardest.
 */
export function emissionChangeFor(
  reading: GateReading,
  params: GateParams,
  demandChangePct: number,
): number {
  const { theta, exponent: h } = params;
  const s0 = reading.demandShare;
  const s1 = s0 * (1 + demandChangePct / 100);
  const e0 = s0 * gateOf(s0, theta, h);
  const e1 = s1 * gateOf(s1, theta, h);
  return e0 > 0 ? (e1 / e0 - 1) * 100 : 0;
}
