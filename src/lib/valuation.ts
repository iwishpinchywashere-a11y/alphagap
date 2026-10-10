/**
 * Subnet Valuation Index: types and scoring.
 *
 * The research side (src/data/valuation.json) is produced by a per-subnet
 * research pass with a strict evidence rubric: every revenue, customer and
 * buyback claim carries a quote, a URL and a date, and a confidence tier.
 * The live side (market cap, emission share, owner-locked alpha) comes from
 * the chain via market-latest.json. This module joins the two and scores.
 *
 * Two numbers are deliberately kept apart:
 *   - the FUNDAMENTALS score (0-100): how much real business is here, judged
 *     from revenue, its confidence, growth, buybacks and product quality;
 *   - the P/S multiple: what the market is paying for each dollar of that
 *     revenue. Cheap or expensive is a judgement the reader makes with both
 *     numbers in front of them, not one we bake into a single figure.
 */

export type Confidence = "confirmed" | "self_reported" | "estimated" | "pre_revenue" | "unknown";
export type BuybackStatus = "active" | "announced" | "planned" | "none" | "unknown";
export type GrowthTrend = "accelerating" | "growing" | "flat" | "declining" | "unknown";
export type CustomerType = "enterprise" | "developer" | "consumer" | "mixed" | "none";

export interface ResearchRecord {
  netuid: number;
  name: string;
  status: "live" | "dead" | "unknown";
  product: {
    what_it_is: string;
    category: string;
    live_product: boolean;
    pricing_url: string | null;
    quality_score: number;
    quality_rationale: string;
  };
  revenue: {
    arr_usd: number | null;
    confidence: Confidence;
    basis: string;
    as_of: string | null;
    evidence: string;
    sources: string[];
  };
  growth: {
    trend: GrowthTrend;
    evidence: string;
    prior_arr_usd: number | null;
    prior_as_of: string | null;
  };
  customers: {
    named: string[];
    count: number | null;
    type: CustomerType;
    evidence: string;
  };
  buybacks: {
    status: BuybackStatus;
    mechanism: string;
    pct_of_revenue: number | null;
    usd_to_date: number | null;
    evidence: string;
    sources: string[];
  };
  notes: string;
  /** Set by the verification pass; absent means unverified. */
  verified?: { at: string; revenue_ok: boolean; buyback_ok: boolean; notes: string };
}

export interface LiveMarket {
  marketCapUsd: number | null;
  priceUsd: number | null;
  emissionPct: number | null;
  change30d: number | null;
  ownerLockedAlpha: number | null;     // alpha the subnet owner has locked (BIT-0011)
  ownerLockedUsd: number | null;
}

export interface ValuationRow extends ResearchRecord {
  live: LiveMarket;
  /** How much the research trusts the ARR figure, 0-1. */
  confidenceWeight: number;
  /** ARR x confidence weight: the revenue we are willing to count. */
  creditedArrUsd: number;
  /** Market cap / ARR. null when there is no ARR to divide by. */
  psMultiple: number | null;
  /** Annual buyback dollars / market cap, when both are known. */
  buybackYieldPct: number | null;
  /** 0-100 fundamentals score with its components, for the breakdown UI. */
  fundamentals: number;
  components: { revenue: number; buybacks: number; growth: number; product: number };
  /**
   * THE score shown on the index and used as the aGap product pillar:
   * product quality + a 0-20 business bonus (revenue, buybacks, growth).
   * Computed by lib/benchmarks computeProductScore; the API fills it in.
   */
  prodScore: number;
  /** 0-100 business side of the index (revenue 45 / buybacks 20 / growth 10, renormalised). */
  businessScore: number;
  rank: number;
  /** Legacy product benchmark (August research), joined by the API. */
  benchmark?: {
    score: number; cost_saving_pct: number; vs_provider: string; perf_delta: string; summary: string;
    dashboards: Array<{ label: string; url: string }>; sources: string[]; last_updated: string;
  } | null;
}

// ── Scoring ───────────────────────────────────────────────────────────────

/**
 * How much of a stated ARR figure to count. A self-reported number is not
 * nothing (the August verifier threw those away and was wrong to), but it is
 * not a dashboard either.
 */
export const CONFIDENCE_WEIGHT: Record<Confidence, number> = {
  confirmed: 1.0,
  self_reported: 0.7,
  estimated: 0.5,
  pre_revenue: 0,
  unknown: 0,
};

/** Component weights. Sum to 100. */
export const WEIGHTS = { revenue: 45, buybacks: 20, growth: 10, product: 25 } as const;

/**
 * Revenue component, 0-100. Log scale so a $10M business is not simply 100x
 * a $100K one: $50K -> ~0, $500K -> ~33, $5M -> ~67, $50M -> 100.
 */
export function revenueComponent(creditedArr: number): number {
  if (creditedArr <= 50_000) return 0;
  const v = (Math.log10(creditedArr) - Math.log10(50_000)) / 3; // 3 decades to 100
  return Math.round(Math.max(0, Math.min(1, v)) * 100);
}

export function buybackComponent(b: ResearchRecord["buybacks"]): number {
  switch (b.status) {
    case "active": {
      // Full marks for an active programme committing most of revenue.
      const pct = b.pct_of_revenue ?? 50;
      return Math.round(60 + 40 * Math.max(0, Math.min(1, pct / 100)));
    }
    case "announced": return 40;
    case "planned": return 15;
    default: return 0;
  }
}

export function growthComponent(trend: GrowthTrend): number {
  switch (trend) {
    case "accelerating": return 100;
    case "growing": return 75;
    case "flat": return 40;
    case "declining": return 10;
    default: return 30; // unknown: neither rewarded nor punished much
  }
}

export function scoreRow(r: ResearchRecord, live: LiveMarket): Omit<ValuationRow, "rank" | "prodScore" | "businessScore"> {
  const confidenceWeight = CONFIDENCE_WEIGHT[r.revenue.confidence] ?? 0;
  const arr = r.revenue.arr_usd ?? 0;
  const creditedArrUsd = arr * confidenceWeight;

  const components = {
    revenue: revenueComponent(creditedArrUsd),
    buybacks: buybackComponent(r.buybacks),
    growth: growthComponent(r.growth.trend),
    product: Math.max(0, Math.min(100, r.product.quality_score ?? 0)),
  };
  // A dead subnet scores zero regardless of what it once had.
  const fundamentals = r.status === "dead" ? 0 : Math.round(
    (components.revenue * WEIGHTS.revenue +
      components.buybacks * WEIGHTS.buybacks +
      components.growth * WEIGHTS.growth +
      components.product * WEIGHTS.product) / 100,
  );

  const psMultiple = arr > 0 && live.marketCapUsd && live.marketCapUsd > 0
    ? Math.round((live.marketCapUsd / arr) * 10) / 10
    : null;

  // Annual buyback dollars: explicit % of revenue if stated and the programme
  // is active, else nothing. We do not guess a percentage.
  const annualBuybackUsd = r.buybacks.status === "active" && r.buybacks.pct_of_revenue != null && arr > 0
    ? arr * (r.buybacks.pct_of_revenue / 100)
    : null;
  const buybackYieldPct = annualBuybackUsd != null && live.marketCapUsd && live.marketCapUsd > 0
    ? Math.round((annualBuybackUsd / live.marketCapUsd) * 1000) / 10
    : null;

  return { ...r, live, confidenceWeight, creditedArrUsd, psMultiple, buybackYieldPct, fundamentals, components };
}

export function rankRows(rows: Array<Omit<ValuationRow, "rank">>): ValuationRow[] {
  return [...rows]
    .sort((a, b) => b.prodScore - a.prodScore || (b.creditedArrUsd - a.creditedArrUsd) || (b.fundamentals - a.fundamentals))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
