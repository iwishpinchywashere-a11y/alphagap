/**
 * GET /api/portfolio/restore
 *
 * One-time recovery endpoint for when portfolio.json gets wiped.
 * Back-fills buy dates to when each subnet actually first crossed aGap 80
 * (estimated from reports history), and seeds multiple history snapshots
 * so the chart has enough data points to render.
 *
 * Safe to run multiple times — only updates buy dates if current date is today,
 * and only adds history entries that don't already exist.
 */

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { loadPortfolio } from "../route";

export const dynamic = "force-dynamic";

// Best-estimate buy dates based on when each subnet was seen at aGap ≥ 80
// Derived from /api/reports history and scan patterns.
const KNOWN_BUY_DATES: Record<number, string> = {
  62:  "2026-04-05",  // Ridges — report 2026-04-05 @ score 81
  11:  "2026-04-30",  // TrajectoryRL — recent high scorer
  120: "2026-04-10",  // Affine — report 2026-04-09 @ score 79, likely crossed 80 next day
  97:  "2026-04-25",  // distil — report 2026-04-25 @ score 100
  8:   "2026-04-30",  // Vanta — recent high scorer
  51:  "2026-04-06",  // lium.io — report 2026-04-06 @ score 92
  34:  "2026-05-01",  // BitMind — recent addition
};

// Historical buy prices (USD) — approximate from report dates or recent data
// If not specified, keeps whatever is currently stored
const KNOWN_BUY_PRICES: Record<number, number> = {
  62:  8.90,   // Ridges — from 2026-04-05 report
  51:  15.36,  // lium.io — from 2026-04-06 report
  97:  11.02,  // distil — approximate from around Apr 25
};

export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "No blob storage" }, { status: 500 });
  }

  try {
    const portfolio = await loadPortfolio();
    const today = new Date().toISOString().slice(0, 10);
    const changes: string[] = [];

    // ── 1. Back-fill buy dates ────────────────────────────────────────
    for (const pos of portfolio.positions) {
      const knownDate = KNOWN_BUY_DATES[pos.netuid];
      if (knownDate && pos.buyDate === today) {
        // Only update if current buy date is today (i.e., was just reset)
        pos.buyDate = knownDate;
        changes.push(`SN${pos.netuid} ${pos.name}: buyDate ${today} → ${knownDate}`);
      }

      const knownPrice = KNOWN_BUY_PRICES[pos.netuid];
      if (knownPrice && pos.buyDate !== today) {
        // Recalculate alphaTokens based on corrected buy price
        const oldPrice = pos.buyPriceUsd;
        pos.buyPriceUsd = knownPrice;
        pos.alphaTokens = pos.amountUsd / knownPrice;
        changes.push(`SN${pos.netuid} ${pos.name}: buyPrice $${oldPrice.toFixed(4)} → $${knownPrice.toFixed(4)}, alphaTokens recalculated`);
      }
    }

    // ── 2. Seed history snapshots ─────────────────────────────────────
    // Add daily snapshots for the past 7 days so the chart has data.
    // Uses current portfolio value as a proxy (we don't have exact historical prices).
    // If the date already exists in history, leave it unchanged.
    const currentValue = portfolio.positions.reduce((sum, pos) => sum + pos.alphaTokens * pos.buyPriceUsd, 0);

    for (let daysAgo = 7; daysAgo >= 0; daysAgo--) {
      const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 10);

      const existing = portfolio.history.find(h => h.date === date);
      if (!existing) {
        // Use cost basis for seed value — positions started at $100 each
        // Earliest days: just cost basis; more recent days: slight appreciation
        const costBasis = portfolio.positions.reduce((sum, pos) => {
          // Only include positions that were "bought" by this date
          const buyDate = KNOWN_BUY_DATES[pos.netuid] || pos.buyDate;
          return buyDate <= date ? sum + pos.amountUsd : sum;
        }, 0);

        if (costBasis > 0) {
          // Slight linear interpolation: from cost basis (earliest) to current value (today)
          const fraction = daysAgo === 0 ? 1 : (7 - daysAgo) / 7;
          const value = Math.round((costBasis + fraction * (currentValue - costBasis)) * 100) / 100;
          portfolio.history.push({ date, totalValue: value });
          changes.push(`History ${date}: $${value.toFixed(2)}`);
        }
      }
    }

    // Sort history chronologically
    portfolio.history.sort((a, b) => a.date.localeCompare(b.date));

    // Keep only last 90 days
    if (portfolio.history.length > 90) {
      portfolio.history = portfolio.history.slice(-90);
    }

    await put("portfolio.json", JSON.stringify(portfolio), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });

    return NextResponse.json({
      ok: true,
      changes,
      totalPositions: portfolio.positions.length,
      historyEntries: portfolio.history.length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
