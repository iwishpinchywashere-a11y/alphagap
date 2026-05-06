/**
 * GET /api/portfolio/find-peaks
 *
 * Fetches real price history for every portfolio position via TaoStats
 * and computes the actual all-time-high since each subnet's buy date.
 *
 * Returns recommended manualPeakPrice values (in USD, using current TAO price).
 * Review the output, then POST to /api/portfolio with the peaks payload to apply.
 */

import { NextResponse } from "next/server";
import { getPoolHistory, getTaoPrice } from "@/lib/taostats";
import { loadPortfolio } from "../route";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [portfolio, taoPrice] = await Promise.all([
      loadPortfolio(),
      getTaoPrice(),
    ]);

    if (!taoPrice || taoPrice <= 0) {
      return NextResponse.json({ error: "Could not fetch TAO price" }, { status: 500 });
    }

    const results: Array<{
      netuid: number;
      name: string;
      buyDate: string;
      buyPriceUsd: number;
      currentManualPeak?: number;
      historicalMaxTao: number;
      historicalMaxUsd: number;
      maxPnlPct: number;
      alphaTokens: number;
      dataPoints: number;
      note: string;
    }> = [];

    const recommendedPeaks: Record<string, number> = {};

    for (const pos of portfolio.positions) {
      try {
        // Calculate days since buy date to fetch enough history
        const buyMs = new Date(pos.buyDate).getTime();
        const daysSinceBuy = Math.ceil((Date.now() - buyMs) / 86400000) + 5;

        const history = await getPoolHistory(pos.netuid, Math.max(daysSinceBuy, 40));

        // Filter to only entries on or after buy date
        const sinceEntry = history.filter(h => h.timestamp.slice(0, 10) >= pos.buyDate);

        if (sinceEntry.length === 0) {
          results.push({
            netuid: pos.netuid,
            name: pos.name,
            buyDate: pos.buyDate,
            buyPriceUsd: pos.buyPriceUsd,
            currentManualPeak: pos.manualPeakPrice,
            historicalMaxTao: 0,
            historicalMaxUsd: pos.buyPriceUsd,
            maxPnlPct: 0,
            alphaTokens: pos.alphaTokens,
            dataPoints: 0,
            note: "No history data found since buy date — using buy price as floor",
          });
          recommendedPeaks[String(pos.netuid)] = pos.buyPriceUsd;
          continue;
        }

        // Find max price in TAO since buy date
        let maxPriceTao = 0;
        let maxTimestamp = "";
        for (const h of sinceEntry) {
          const p = parseFloat(h.price);
          if (p > maxPriceTao) {
            maxPriceTao = p;
            maxTimestamp = h.timestamp.slice(0, 10);
          }
        }

        // Convert to USD using current TAO price (approximation)
        const maxPriceUsd = maxPriceTao * taoPrice;

        // Use max of (historicalMaxUsd, buyPriceUsd) so peak never < buy price
        const peakUsd = Math.max(maxPriceUsd, pos.buyPriceUsd);
        const alphaTokens = pos.alphaTokens;
        const maxPnlPct = ((alphaTokens * peakUsd - pos.amountUsd) / pos.amountUsd) * 100;

        // Round to 4 decimal places
        const roundedPeak = Math.round(peakUsd * 10000) / 10000;

        results.push({
          netuid: pos.netuid,
          name: pos.name,
          buyDate: pos.buyDate,
          buyPriceUsd: pos.buyPriceUsd,
          currentManualPeak: pos.manualPeakPrice,
          historicalMaxTao: Math.round(maxPriceTao * 100000) / 100000,
          historicalMaxUsd: roundedPeak,
          maxPnlPct: Math.round(maxPnlPct * 10) / 10,
          alphaTokens: Math.round(alphaTokens * 1000) / 1000,
          dataPoints: sinceEntry.length,
          note: `Peak on ${maxTimestamp}, TAO=$${taoPrice.toFixed(2)}`,
        });

        recommendedPeaks[String(pos.netuid)] = roundedPeak;
      } catch (err) {
        results.push({
          netuid: pos.netuid,
          name: pos.name,
          buyDate: pos.buyDate,
          buyPriceUsd: pos.buyPriceUsd,
          currentManualPeak: pos.manualPeakPrice,
          historicalMaxTao: 0,
          historicalMaxUsd: pos.buyPriceUsd,
          maxPnlPct: 0,
          alphaTokens: pos.alphaTokens,
          dataPoints: 0,
          note: `Error: ${String(err)}`,
        });
        recommendedPeaks[String(pos.netuid)] = pos.buyPriceUsd;
      }
    }

    // Sort by maxPnlPct descending
    results.sort((a, b) => b.maxPnlPct - a.maxPnlPct);

    return NextResponse.json({
      taoPrice,
      note: "Peak prices use current TAO price as USD converter — approximation. Review and apply via PATCH /api/portfolio { peaks: {...} }",
      applyPayload: { peaks: recommendedPeaks },
      results,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
