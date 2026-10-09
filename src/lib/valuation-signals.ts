/**
 * Per-subnet signals from the valuation research (src/data/valuation.json),
 * shaped for the scoring code in api/scan and lib/benchmarks.
 *
 * The research is the freshest, best-sourced view we have of what each
 * subnet actually is (status, product quality, revenue with a confidence
 * tier, buybacks, growth). Before this existed, product and revenue inputs
 * came from benchmarks.ts, which was researched in August and, for the 13
 * netuids that changed hands since, described a different project entirely.
 */

import research from "@/data/valuation.json";
import { CONFIDENCE_WEIGHT, type ResearchRecord, type BuybackStatus, type GrowthTrend, type Confidence } from "./valuation";

export interface ValuationSignals {
  status: "live" | "dead" | "unknown";
  qualityScore: number;        // 0-100 product quality from the research
  liveProduct: boolean;
  arrUsd: number;              // stated ARR, 0 if none
  confidence: Confidence;
  /** ARR x confidence weight (confirmed 1.0, self-reported 0.7, estimated 0.5). */
  creditedArrUsd: number;
  buybackStatus: BuybackStatus;
  buybackPctOfRevenue: number | null;
  growthTrend: GrowthTrend;
}

const BY_NETUID = new Map<number, ValuationSignals>(
  (research as unknown as ResearchRecord[]).map(r => {
    const arr = r.revenue.arr_usd ?? 0;
    return [r.netuid, {
      status: r.status,
      qualityScore: Math.max(0, Math.min(100, r.product.quality_score ?? 0)),
      liveProduct: !!r.product.live_product,
      arrUsd: arr,
      confidence: r.revenue.confidence,
      creditedArrUsd: arr * (CONFIDENCE_WEIGHT[r.revenue.confidence] ?? 0),
      buybackStatus: r.buybacks.status,
      buybackPctOfRevenue: r.buybacks.pct_of_revenue,
      growthTrend: r.growth.trend,
    }];
  }),
);

export function getValuationSignals(netuid: number): ValuationSignals | null {
  return BY_NETUID.get(netuid) ?? null;
}

/**
 * Revenue traction, 0-20, on CREDITED ARR so a self-reported $1M counts like
 * a confirmed $700K rather than like a confirmed $1M. Same ladder the
 * investing formula has always used.
 */
export function revenueTractionPts(creditedArrUsd: number): number {
  if (creditedArrUsd >= 10_000_000) return 20;
  if (creditedArrUsd >= 2_000_000) return 15;
  if (creditedArrUsd >= 1_000_000) return 10;
  if (creditedArrUsd >= 500_000) return 7;
  if (creditedArrUsd >= 100_000) return 4;
  if (creditedArrUsd > 0) return 2;
  return 0;
}

/**
 * Revenue-funded alpha buybacks, 0-10. Active with most of revenue committed
 * is the strongest long-term token signal a subnet can send; an announcement
 * is worth something, an intention very little. Owner-locked alpha is not a
 * buyback and is not here.
 */
export function buybackPts(status: BuybackStatus, pctOfRevenue: number | null): number {
  switch (status) {
    case "active": return (pctOfRevenue ?? 0) >= 50 ? 10 : 7;
    case "announced": return 3;
    case "planned": return 1;
    default: return 0;
  }
}

/** Growth adjustment for subnets that have revenue. Needs two dated figures to be non-zero. */
export function growthPts(trend: GrowthTrend, arrUsd: number): number {
  if (arrUsd <= 0) return 0;
  switch (trend) {
    case "accelerating": return 5;
    case "growing": return 3;
    case "declining": return -5;
    default: return 0;
  }
}
