/**
 * GET /api/portfolio/add-missed-buys
 *
 * Adds the two confirmed missed buys to the portfolio:
 *   - SN22 Desearch  — Apr 22 2026 (aGap score 91, highest scorer that day)
 *   - SN68 NOVA      — May 5  2026 (aGap score 84, highest scorer that day)
 *
 * For each:
 *   1. Fetches TaoStats pool history to get the exact price on the buy date
 *   2. Finds the all-time-high price since the buy date (same approach as find-peaks)
 *   3. Adds the position with correct buyPriceUsd, alphaTokens, manualPeakPrice
 *
 * Also rebuilds the portfolio chart history to include the new positions.
 * Makes no change if a position with the same netuid already exists.
 */

import { NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";
import { getPoolHistory, getTaoPrice } from "@/lib/taostats";
import { loadPortfolio } from "../route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUY_AMOUNT = 100;

const NEW_POSITIONS = [
  { netuid: 22, name: "Desearch",  buyDate: "2026-04-22", buyAGapScore: 91 },
  { netuid: 68, name: "NOVA",      buyDate: "2026-05-05", buyAGapScore: 84 },
];

export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "No blob storage" }, { status: 500 });
  }

  try {
    const [portfolio, taoPrice] = await Promise.all([
      loadPortfolio(),
      getTaoPrice(),
    ]);

    if (!taoPrice || taoPrice <= 0) {
      return NextResponse.json({ error: "Could not fetch TAO price" }, { status: 500 });
    }

    // Fetch current prices from scan for today's value
    let currentPrices: Record<number, number> = {};
    try {
      const scanBlob = await blobGet("scan-latest.json", {
        token: process.env.BLOB_READ_WRITE_TOKEN!,
        access: "private",
        abortSignal: AbortSignal.timeout(8000),
      });
      if (scanBlob?.stream) {
        const reader = scanBlob.stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
        const scan = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        for (const e of scan.leaderboard || []) {
          if (e.alpha_price) currentPrices[e.netuid] = e.alpha_price;
        }
      }
    } catch { /* use pool history prices as fallback */ }

    const log: string[] = [];
    const added: string[] = [];

    for (const np of NEW_POSITIONS) {
      // Skip if already in portfolio
      if (portfolio.positions.find(p => p.netuid === np.netuid)) {
        log.push(`⚠️ SN${np.netuid} ${np.name}: already in portfolio, skipping`);
        continue;
      }

      // Fetch pool history to get buy price and peak price
      const buyMs = new Date(np.buyDate).getTime();
      const daysSinceBuy = Math.ceil((Date.now() - buyMs) / 86400000) + 3;
      const history = await getPoolHistory(np.netuid, Math.max(daysSinceBuy, 45));

      // Find price on or nearest to buy date
      const buyDateEntries = history.filter(h => h.timestamp.slice(0, 10) <= np.buyDate);
      const buyEntry = buyDateEntries.length > 0
        ? buyDateEntries[buyDateEntries.length - 1] // last entry on/before buy date
        : history[0]; // fallback to first available

      if (!buyEntry) {
        log.push(`⚠️ SN${np.netuid} ${np.name}: no price data available, skipping`);
        continue;
      }

      const buyPriceTao = parseFloat(buyEntry.price);
      const buyPriceUsd = buyPriceTao * taoPrice;
      const alphaTokens = BUY_AMOUNT / buyPriceUsd;

      // Find max price since buy date
      const sinceEntry = history.filter(h => h.timestamp.slice(0, 10) >= np.buyDate);
      let maxPriceTao = buyPriceTao;
      let maxDate = np.buyDate;
      for (const h of sinceEntry) {
        const p = parseFloat(h.price);
        if (p > maxPriceTao) {
          maxPriceTao = p;
          maxDate = h.timestamp.slice(0, 10);
        }
      }

      // Also check current live price (scan gives more precise intraday price)
      const livePrice = currentPrices[np.netuid];
      const livePriceTao = livePrice ? livePrice / taoPrice : 0;
      if (livePriceTao > maxPriceTao) {
        maxPriceTao = livePriceTao;
        maxDate = new Date().toISOString().slice(0, 10);
      }

      // Convert peak to USD; floor at buy price (max P&L >= 0%)
      const maxPriceUsd = Math.max(maxPriceTao * taoPrice, buyPriceUsd);
      const manualPeakPrice = Math.round(maxPriceUsd * 10000) / 10000;
      const maxPnlPct = ((alphaTokens * manualPeakPrice - BUY_AMOUNT) / BUY_AMOUNT) * 100;

      const finalBuyPriceUsd = Math.round(buyPriceUsd * 10000) / 10000;

      portfolio.positions.push({
        netuid: np.netuid,
        name: np.name,
        buyDate: np.buyDate,
        buyAGapScore: np.buyAGapScore,
        buyPriceUsd: finalBuyPriceUsd,
        amountUsd: BUY_AMOUNT,
        alphaTokens: Math.round(alphaTokens * 10000) / 10000,
        manualPeakPrice,
        peakPrice: manualPeakPrice,
      });

      // Add to purchasedNetUids so it doesn't get auto-bought again
      if (!portfolio.purchasedNetUids) portfolio.purchasedNetUids = [];
      if (!portfolio.purchasedNetUids.includes(np.netuid)) {
        portfolio.purchasedNetUids.push(np.netuid);
      }

      const logEntry = `✓ SN${np.netuid} ${np.name}: bought ${np.buyDate} @ $${finalBuyPriceUsd.toFixed(4)}, peak $${manualPeakPrice.toFixed(4)} (${maxPnlPct >= 0 ? "+" : ""}${maxPnlPct.toFixed(1)}%) on ${maxDate}`;
      log.push(logEntry);
      added.push(`SN${np.netuid} ${np.name}`);
    }

    if (added.length === 0) {
      return NextResponse.json({ ok: true, added: 0, log, message: "No new positions added (all already present)" });
    }

    // ── Rebuild chart history ─────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const buyDates = [...new Set(portfolio.positions.map(p => p.buyDate))].sort();

    const stepHistory: Array<{ date: string; totalValue: number }> = [];
    for (const date of buyDates) {
      const value = portfolio.positions.reduce((sum, pos) =>
        pos.buyDate > date ? sum : sum + pos.amountUsd, 0);
      stepHistory.push({ date, totalValue: Math.round(value * 100) / 100 });
    }

    // Midpoint plateau
    const lastBuy = buyDates[buyDates.length - 1];
    const lastBuyMs = new Date(lastBuy).getTime();
    const midMs = lastBuyMs + Math.floor((Date.now() - lastBuyMs) / 2);
    const midDate = new Date(midMs).toISOString().slice(0, 10);
    if (midDate !== lastBuy && midDate !== today) {
      const midValue = portfolio.positions.reduce((sum, pos) =>
        pos.buyDate > midDate ? sum : sum + pos.amountUsd, 0);
      stepHistory.push({ date: midDate, totalValue: Math.round(midValue * 100) / 100 });
    }

    // Today with live prices
    if (today > lastBuy) {
      const todayValue = portfolio.positions.reduce((sum, pos) => {
        const live = currentPrices[pos.netuid] ?? pos.buyPriceUsd;
        return sum + pos.alphaTokens * live;
      }, 0);
      stepHistory.push({ date: today, totalValue: Math.round(todayValue * 100) / 100 });
    }

    stepHistory.sort((a, b) => a.date.localeCompare(b.date));
    portfolio.history = stepHistory.filter((h, i, arr) =>
      i === 0 || h.date !== arr[i - 1].date
    );

    log.push(`History rebuilt: ${portfolio.history.length} entries`);
    log.push(`History: ${portfolio.history.map(h => `${h.date}=$${h.totalValue.toFixed(0)}`).join(", ")}`);

    await put("portfolio.json", JSON.stringify(portfolio), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });

    return NextResponse.json({
      ok: true,
      added: added.length,
      addedPositions: added,
      positionCount: portfolio.positions.length,
      historyEntries: portfolio.history.length,
      taoPrice,
      log,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
