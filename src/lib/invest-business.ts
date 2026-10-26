/**
 * Business credit for the investing score: one capped budget for everything
 * that follows from "this subnet has revenue".
 *
 * Before 2026-10-26 the same fact was rewarded in five separate places
 * (revenue traction 0-20, buybacks 0-10, growth -5..5, market validation
 * 0-5, proven product 0-15) on top of the product pillar, which already
 * carries the business bonus inside the prod score. A $750K subnet with a
 * buyback hit the top rung of nearly every ladder and tied at 100 with a
 * $16.8M one. Two changes:
 *
 *  1. Size and quality scale the credit. Revenue credit runs on a log curve
 *     from $50K (0) to $20M (full), multiplied by confidence (confirmed /
 *     self-reported / estimated) and by who the customers are (external /
 *     ecosystem / circular). Buyback and growth credit scale with the same
 *     factor, so a buyback of a small, partly circular revenue stream is
 *     worth a fraction of a buyback of a large external one.
 *  2. One cap. Revenue + buyback + growth + market validation share a
 *     40-point budget (was 55 across five uncapped ladders), and the
 *     proven-product bonus runs on the research QUALITY score (which
 *     excludes the business bonus) with a max of 10.
 */

import type { BuybackStatus, Confidence, GrowthTrend, RevenueCustomerQuality } from "./valuation";
import { CONFIDENCE_WEIGHT, CUSTOMER_QUALITY_WEIGHT } from "./valuation";
import { buybackPts, growthPts } from "./valuation-signals";

export const BUSINESS_CREDIT_CAP = 40;
const REV_CREDIT_MAX = 30;
// Steepens the log curve so $750K sits at ~0.3 of $20M rather than ~0.45.
const SIZE_EXPONENT = 1.5;
const SIZE_FLOOR_USD = 50_000;
const SIZE_FULL_USD = 20_000_000;

/** 0 at $50K and below, 1 at $20M and above, log-linear between. */
export function revenueSizeFactor(arrUsd: number): number {
  if (!(arrUsd > SIZE_FLOOR_USD)) return 0;
  const f = Math.log10(arrUsd / SIZE_FLOOR_USD) / Math.log10(SIZE_FULL_USD / SIZE_FLOOR_USD);
  return Math.pow(Math.max(0, Math.min(1, f)), SIZE_EXPONENT);
}

export interface BusinessCreditInput {
  /** Stated ARR (not confidence-weighted). */
  arrUsd: number;
  confidence: Confidence;
  customerQuality: RevenueCustomerQuality | null;
  buybackStatus: BuybackStatus;
  buybackPctOfRevenue: number | null;
  growthTrend: GrowthTrend;
  /** Formally benchmarked / researched product (market validation only applies then). */
  isBenchmarked: boolean;
  /** Research product-quality score, 0-100, excludes the business bonus. */
  qualityScore: number | null;
  /** Fallback when there is no research quality score. */
  productScore: number;
  /**
   * Legacy path: milestone estimate for subnets the research marks unknown.
   * Treated as "estimated" confidence with unknown customers.
   */
  legacyEstimatedArrUsd?: number;
}

export interface BusinessCredit {
  sizeFactor: number;
  qualityMult: number;
  revenue: number;
  buyback: number;
  growth: number;
  marketValidation: number;
  /** Capped sum of the four above. */
  business: number;
  provenProduct: number;
  /** business + provenProduct: what enters the raw investing score. */
  total: number;
}

export function investBusinessCredit(i: BusinessCreditInput): BusinessCredit {
  const legacy = i.legacyEstimatedArrUsd != null && i.legacyEstimatedArrUsd > 0 && !(i.arrUsd > 0);
  const arr = legacy ? (i.legacyEstimatedArrUsd as number) : i.arrUsd;
  const confMult = legacy ? CONFIDENCE_WEIGHT.estimated : (CONFIDENCE_WEIGHT[i.confidence] ?? 0);
  const custMult = i.customerQuality ? CUSTOMER_QUALITY_WEIGHT[i.customerQuality] : 1;
  const sizeFactor = revenueSizeFactor(arr);
  const qualityMult = confMult * custMult;
  const scale = sizeFactor * qualityMult;

  const revenue = REV_CREDIT_MAX * scale;

  // Buybacks and growth are only as meaningful as the revenue behind them.
  // A floor keeps an active buyback worth something even on a small stream.
  const bbScale = arr > 0 ? Math.max(0.3, scale) : 0;
  const buyback = buybackPts(i.buybackStatus, i.buybackPctOfRevenue) * bbScale;
  const growthRaw = growthPts(i.growthTrend, arr);
  const growth = growthRaw < 0 ? growthRaw : growthRaw * bbScale; // declining stays a full penalty

  const marketValidation = i.isBenchmarked ? 1 + 4 * scale : 0;

  const business = Math.min(BUSINESS_CREDIT_CAP, revenue + buyback + growth + marketValidation);

  // Proven product: quality of the product itself, not its revenue (that is
  // the budget above). Max 10, was 15 keyed off the prod score that already
  // contained the business bonus.
  const q = i.qualityScore ?? i.productScore;
  let provenProduct = 0;
  if (i.isBenchmarked) {
    if      (q >= 90) provenProduct = 10;
    else if (q >= 78) provenProduct = 6;
    else if (q >= 65) provenProduct = 3;
  }

  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    sizeFactor: r(sizeFactor), qualityMult: r(qualityMult),
    revenue: r(revenue), buyback: r(buyback), growth: r(growth), marketValidation: r(marketValidation),
    business: r(business), provenProduct,
    total: r(business + provenProduct),
  };
}
