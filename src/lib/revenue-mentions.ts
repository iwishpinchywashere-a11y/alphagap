/**
 * Shapes written by /api/cron/revenue-watch (revenue-mentions.json) and read
 * by /api/valuation and the Revenue & Valuations page.
 */

export interface RevenueFigures {
  /** Period the figures describe, as the post states it ("10 Sep - 9 Oct 2026"). */
  period: string | null;
  /** Revenue / billing / spend for the stated period, USD. */
  revenue_usd: number | null;
  /** How long that period is: "week" | "month" | "30d" | "quarter" | "year" | null. */
  revenue_period: string | null;
  /** Annualised figure if the post states one (ARR, run rate), USD. */
  arr_usd: number | null;
  customers: number | null;
  /** Dollars of alpha bought back / burned, if stated. */
  buyback_usd: number | null;
  summary: string;
}

export interface RevenueMention {
  id: string;
  netuid: number;
  name: string;
  handle: string;
  url: string;
  postedAt: string;
  text: string;
  images: string[];
  figures: RevenueFigures | null;
  /** Annualised revenue implied by the post, on our 30-day x 12 basis when possible. */
  impliedArrUsd: number | null;
  /** Our record at the time the post was seen. */
  recordArrUsd: number | null;
  recordAsOf: string | null;
  flag: "new_figure" | "mention";
  seenAt: string;
}

