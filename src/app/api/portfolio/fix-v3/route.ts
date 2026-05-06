/**
 * GET /api/portfolio/fix-v3
 *
 * Fixes remaining portfolio issues after restore-v2:
 *   1. Negative max P&L: sets peakPrice floor = buyPrice for all positions
 *   2. ORO (SN15): user recalls ~350% gain → sets manualPeakPrice = $18.50
 *   3. Janky chart: replaces flat 37-day history with clean step-function
 *      showing portfolio value stepping up as each position was bought,
 *      then using live prices for today
 *
 * This endpoint is idempotent — safe to run multiple times.
 * Once real peak prices are available from /api/portfolio/find-peaks,
 * use PATCH /api/portfolio { peaks: {...} } to overwrite with real data.
 */

import { NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";
import { loadPortfolio } from "../route";

export const dynamic = "force-dynamic";

// Known / recalled peak prices (USD) — best estimates before real data lookup
// ORO: user recalls ~350% gain. buyPrice=$4.11, 350% → $4.11*(1+3.5) = $18.495
// Others: set to buyPrice floor until find-peaks provides real data
const PEAK_FLOOR_OVERRIDES: Record<number, number> = {
  15: 18.50,   // ORO — user recalls ~350% peak
};

export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "No blob storage" }, { status: 500 });
  }

  try {
    // ── Fetch live prices ─────────────────────────────────────────
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
    } catch { /* use buy prices as fallback */ }

    const portfolio = await loadPortfolio();
    const changes: string[] = [];

    // ── 1. Fix peak prices ────────────────────────────────────────
    // Rule: manualPeakPrice must be >= buyPrice (floor at 0% P&L)
    // Plus apply PEAK_FLOOR_OVERRIDES for known recalled peaks
    for (const pos of portfolio.positions) {
      const override = PEAK_FLOOR_OVERRIDES[pos.netuid];
      const floor = pos.buyPriceUsd; // never worse than buy price
      const currentLive = currentPrices[pos.netuid] ?? pos.buyPriceUsd;

      let newPeak: number;
      if (override) {
        // Use the recalled override, but still take max with current price
        newPeak = Math.max(override, currentLive, floor);
        changes.push(`SN${pos.netuid} ${pos.name}: manualPeakPrice → $${newPeak.toFixed(4)} (override)`);
      } else if (pos.manualPeakPrice != null && pos.manualPeakPrice >= floor) {
        // Already correct — just ensure it's not below current live price
        newPeak = Math.max(pos.manualPeakPrice, currentLive);
        if (newPeak !== pos.manualPeakPrice) {
          changes.push(`SN${pos.netuid} ${pos.name}: manualPeakPrice raised to current live $${newPeak.toFixed(4)}`);
        } else {
          changes.push(`SN${pos.netuid} ${pos.name}: peak $${newPeak.toFixed(4)} unchanged (already valid)`);
        }
      } else {
        // Peak was missing or below buy price — set to max(live, buy)
        newPeak = Math.max(currentLive, floor);
        changes.push(`SN${pos.netuid} ${pos.name}: manualPeakPrice set to $${newPeak.toFixed(4)} (floor fix)`);
      }

      pos.manualPeakPrice = Math.round(newPeak * 10000) / 10000;
      pos.peakPrice = pos.manualPeakPrice;
    }

    // ── 2. Rebuild chart history ──────────────────────────────────
    // Clean step-function: portfolio value steps up by $100 on each buy date.
    // Only create anchor points at each distinct buy date + today.
    // Today's value uses live prices.
    const today = new Date().toISOString().slice(0, 10);

    // Collect unique buy dates, sorted
    const buyDates = [...new Set(portfolio.positions.map(p => p.buyDate))].sort();

    // Build step entries: each buy date → cost basis of positions bought so far
    const stepHistory: Array<{ date: string; totalValue: number }> = [];

    for (const date of buyDates) {
      const value = portfolio.positions.reduce((sum, pos) => {
        if (pos.buyDate > date) return sum;
        return sum + pos.amountUsd; // cost basis
      }, 0);
      stepHistory.push({ date, totalValue: Math.round(value * 100) / 100 });
    }

    // Add a mid-point entry a few days after last buy to show plateau
    // (gives the chart a "holding period" shape)
    const lastBuy = buyDates[buyDates.length - 1];
    const lastBuyMs = new Date(lastBuy).getTime();
    const midpointMs = lastBuyMs + Math.floor((Date.now() - lastBuyMs) / 2);
    const midDate = new Date(midpointMs).toISOString().slice(0, 10);
    if (midDate !== lastBuy && midDate !== today) {
      const midValue = portfolio.positions.reduce((sum, pos) => {
        if (pos.buyDate > midDate) return sum;
        return sum + pos.amountUsd;
      }, 0);
      stepHistory.push({ date: midDate, totalValue: Math.round(midValue * 100) / 100 });
    }

    // Today: live prices
    if (today > lastBuy) {
      const todayValue = portfolio.positions.reduce((sum, pos) => {
        const livePrice = currentPrices[pos.netuid] ?? pos.buyPriceUsd;
        return sum + pos.alphaTokens * livePrice;
      }, 0);
      stepHistory.push({ date: today, totalValue: Math.round(todayValue * 100) / 100 });
    }

    // Sort and dedupe by date
    stepHistory.sort((a, b) => a.date.localeCompare(b.date));
    portfolio.history = stepHistory.filter((h, i, arr) =>
      i === 0 || h.date !== arr[i - 1].date
    );

    changes.push(`History rebuilt: ${portfolio.history.length} entries (${portfolio.history[0]?.date} → ${portfolio.history[portfolio.history.length - 1]?.date})`);

    // ── Save ──────────────────────────────────────────────────────
    await put("portfolio.json", JSON.stringify(portfolio), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });

    return NextResponse.json({
      ok: true,
      changes,
      positionCount: portfolio.positions.length,
      historyEntries: portfolio.history.length,
      historyAnchors: portfolio.history.map(h => `${h.date}: $${h.totalValue.toFixed(0)}`),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
