/**
 * GET /api/valuation
 *
 * The Subnet Valuation Index: per-subnet research (revenue, growth,
 * customers, alpha buybacks, product quality; every claim with a quote, URL
 * and date) joined to live chain market data, scored and ranked.
 *
 * Research lives in src/data/valuation.json and changes by commit. Market
 * caps, emission shares and owner-locked alpha come from market-latest.json,
 * which the scan rewrites every 10 minutes from chain state, so P/S multiples
 * and buyback yields move with the market without a redeploy.
 */

import { NextResponse } from "next/server";
import { get as blobGet } from "@vercel/blob";
import research from "@/data/valuation.json";
import { scoreRow, rankRows, type ResearchRecord, type LiveMarket } from "@/lib/valuation";
import { BENCHMARK_MAP, computeProductScore } from "@/lib/benchmarks";
import { getValuationSignals } from "@/lib/valuation-signals";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

interface MarketLatest {
  taoUsd: number;
  observedAt: string;
  subnets: Record<string, {
    priceUsd: number; marketCapUsd: number; emissionPct: number | null; change30d: number;
    ownerLockedAlpha?: number | null; ownerPerpetualAlpha?: number | null;
  }>;
}

async function readMarket(): Promise<MarketLatest | null> {
  try {
    const b = await blobGet("market-latest.json", {
      token: process.env.BLOB_READ_WRITE_TOKEN || "", access: "private", abortSignal: AbortSignal.timeout(8000),
    });
    if (!b?.stream) return null;
    const r = b.stream.getReader(); const cs: Uint8Array[] = [];
    while (true) { const { done, value } = await r.read(); if (done) break; cs.push(value); }
    return JSON.parse(Buffer.concat(cs).toString("utf-8"));
  } catch { return null; }
}

export async function GET() {
  const market = await readMarket();
  const records = research as unknown as ResearchRecord[];

  const scored = records.map(r => {
    const m = market?.subnets?.[String(r.netuid)];
    const ownerLockedAlpha = m?.ownerLockedAlpha ?? null;
    const live: LiveMarket = {
      marketCapUsd: m?.marketCapUsd ?? null,
      priceUsd: m?.priceUsd ?? null,
      emissionPct: m?.emissionPct ?? null,
      change30d: m?.change30d ?? null,
      ownerLockedAlpha,
      ownerLockedUsd: ownerLockedAlpha != null && m?.priceUsd ? ownerLockedAlpha * m.priceUsd : null,
    };
    const scored1 = scoreRow(r, live);
    // Product benchmark from the August research pass: cost saving against
    // the centralised provider, findings, live dashboards. Still the best
    // "how good is the product" material we have; the valuation research
    // adds the business side on top of it.
    const b = BENCHMARK_MAP.get(r.netuid);
    const benchmark = b ? {
      score: b.benchmark_score,
      cost_saving_pct: b.cost_saving_pct,
      vs_provider: b.vs_provider,
      perf_delta: b.perf_delta,
      summary: b.benchmark_summary,
      dashboards: b.dashboards ?? [],
      sources: b.sources ?? [],
      last_updated: b.last_updated,
    } : null;
    // The one score: same number as the PROD pillar inside aGap.
    const prodScore = computeProductScore(r.netuid).score;
    const businessScore = getValuationSignals(r.netuid)?.businessScore ?? 0;
    return { ...scored1, benchmark, prodScore, businessScore };
  });
  const rows = rankRows(scored);

  const withArr = rows.filter(r => (r.revenue.arr_usd ?? 0) > 0);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const median = (xs: number[]) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };

  const summary = {
    subnets: rows.length,
    live: rows.filter(r => r.status === "live").length,
    withRevenue: withArr.length,
    confirmedArrUsd: sum(withArr.filter(r => r.revenue.confidence === "confirmed").map(r => r.revenue.arr_usd!)),
    reportedArrUsd: sum(withArr.filter(r => r.revenue.confidence === "self_reported").map(r => r.revenue.arr_usd!)),
    estimatedArrUsd: sum(withArr.filter(r => r.revenue.confidence === "estimated").map(r => r.revenue.arr_usd!)),
    totalStatedArrUsd: sum(withArr.map(r => r.revenue.arr_usd!)),
    creditedArrUsd: Math.round(sum(rows.map(r => r.creditedArrUsd))),
    buybacksActive: rows.filter(r => r.buybacks.status === "active").length,
    buybacksAnnounced: rows.filter(r => r.buybacks.status === "announced").length,
    buybacksPlanned: rows.filter(r => r.buybacks.status === "planned").length,
    medianPs: median(rows.map(r => r.psMultiple).filter((x): x is number => x != null)),
    revenueMarketCapUsd: sum(withArr.map(r => r.live.marketCapUsd ?? 0)),
    marketObservedAt: market?.observedAt ?? null,
    taoUsd: market?.taoUsd ?? null,
  };

  return NextResponse.json({ rows, summary }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
