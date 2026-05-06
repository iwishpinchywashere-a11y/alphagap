/**
 * GET /api/portfolio/restore-v2
 *
 * Full portfolio restore from the screenshot taken before the wipe.
 * Reconstructs:
 *   - All 11 visible positions from the screenshot + Ridges/Hippius/Autoppia below fold
 *   - Correct buy dates from screenshot
 *   - Correct buy prices from nearest reports data
 *   - manualPeakPrices calculated from the MAX P&L % in the screenshot
 *   - Removes BitMind (SN34) which was wrongly added by today's auto-buy
 *   - Seeds portfolio history from earliest buy date to today
 *
 * Peak price formula: peakPrice = (maxPnlUsd / alphaTokens) + buyPrice
 * where alphaTokens = amountUsd / buyPrice
 */

import { NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";

export const dynamic = "force-dynamic";

const BUY_AMOUNT = 100;

interface Position {
  netuid: number;
  name: string;
  buyDate: string;
  buyAGapScore: number;
  buyPriceUsd: number;
  amountUsd: number;
  alphaTokens: number;
  manualPeakPrice?: number;
  peakPrice?: number;
  purchasedNetUids?: number[];
}

// ── Data extracted from screenshot ────────────────────────────────────────────
// Buy prices from the nearest available reports (alphagap.io/api/reports)
// Peak prices calculated as: (maxPnlUsd / alphaTokens) + buyPrice
// where maxPnlUsd = dollar amount shown in screenshot, alphaTokens = 100/buyPrice

const POSITIONS: Array<{
  netuid: number; name: string; buyDate: string; buyAGapScore: number;
  buyPrice: number; maxPnlUsd?: number; // maxPnlUsd from screenshot → sets manualPeakPrice
}> = [
  // ── From screenshot (sorted by max P&L) ───────────────────────────
  { netuid: 15,  name: "ORO",          buyDate: "2026-04-10", buyAGapScore: 84, buyPrice: 4.11,  maxPnlUsd: 191.20 },
  { netuid: 97,  name: "distil",       buyDate: "2026-04-06", buyAGapScore: 82, buyPrice: 11.02, maxPnlUsd: 176.69 },
  { netuid: 85,  name: "Vidaio",       buyDate: "2026-03-31", buyAGapScore: 82, buyPrice: 3.89,  maxPnlUsd: 35.47  },
  { netuid: 11,  name: "TrajectoryRL", buyDate: "2026-03-31", buyAGapScore: 80, buyPrice: 3.89,  maxPnlUsd: 35.26  },
  { netuid: 51,  name: "lium.io",      buyDate: "2026-04-04", buyAGapScore: 85, buyPrice: 15.36, maxPnlUsd: 31.28  },
  { netuid: 71,  name: "Leadpoet",     buyDate: "2026-04-11", buyAGapScore: 81, buyPrice: 1.72,  maxPnlUsd: 27.27  },
  { netuid: 50,  name: "Synth",        buyDate: "2026-04-06", buyAGapScore: 81, buyPrice: 2.98,  maxPnlUsd: 26.53  },
  { netuid: 74,  name: "Gittensor",    buyDate: "2026-04-11", buyAGapScore: 84, buyPrice: 0,     maxPnlUsd: 18.93  }, // price fetched live
  { netuid: 8,   name: "Vanta",        buyDate: "2026-04-02", buyAGapScore: 81, buyPrice: 8.45,  maxPnlUsd: 15.64  },
  { netuid: 120, name: "Affine",       buyDate: "2026-04-08", buyAGapScore: 81, buyPrice: 26.34, maxPnlUsd: 14.89  },
  { netuid: 7,   name: "Allways",      buyDate: "2026-04-17", buyAGapScore: 80, buyPrice: 1.07,  maxPnlUsd: 14.23  },
  // ── Below fold in screenshot (estimated from reports & buy pattern) ─
  { netuid: 62,  name: "Ridges",       buyDate: "2026-04-05", buyAGapScore: 81, buyPrice: 8.90  }, // Apr 5 report: $8.90
  { netuid: 75,  name: "Hippius",      buyDate: "2026-04-04", buyAGapScore: 84, buyPrice: 8.18  }, // Apr 4 report: $8.18
  { netuid: 36,  name: "Autoppia",     buyDate: "2026-03-31", buyAGapScore: 80, buyPrice: 1.03  }, // Mar 31 report: $1.03
];

export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "No blob storage" }, { status: 500 });
  }

  try {
    // ── Fetch live scan for current prices (needed for Gittensor) ─────
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
    } catch { /* use fallback prices */ }

    // ── Build positions ───────────────────────────────────────────────
    const positions: Position[] = [];
    const log: string[] = [];

    for (const p of POSITIONS) {
      let buyPrice = p.buyPrice;

      // Use live price if buy price unknown (e.g. Gittensor)
      if (buyPrice <= 0) {
        buyPrice = currentPrices[p.netuid] ?? 0;
        if (buyPrice <= 0) {
          log.push(`⚠️ SN${p.netuid} ${p.name}: no price available, skipping`);
          continue;
        }
        log.push(`SN${p.netuid} ${p.name}: using live price $${buyPrice.toFixed(4)} as buy price (historical unknown)`);
      }

      const alphaTokens = BUY_AMOUNT / buyPrice;

      // Calculate manualPeakPrice from screenshot MAX P&L $
      let manualPeakPrice: number | undefined;
      if (p.maxPnlUsd != null && p.maxPnlUsd > 0) {
        manualPeakPrice = (p.maxPnlUsd / alphaTokens) + buyPrice;
      }

      positions.push({
        netuid: p.netuid,
        name: p.name,
        buyDate: p.buyDate,
        buyAGapScore: p.buyAGapScore,
        buyPriceUsd: buyPrice,
        amountUsd: BUY_AMOUNT,
        alphaTokens,
        manualPeakPrice,
        peakPrice: manualPeakPrice ?? (currentPrices[p.netuid] ?? buyPrice),
      });

      log.push(
        `✓ SN${p.netuid} ${p.name}: buy $${buyPrice.toFixed(4)} @ ${p.buyDate}${
          manualPeakPrice ? ` → peak $${manualPeakPrice.toFixed(4)} (+${p.maxPnlUsd?.toFixed(2)})` : ""
        }`
      );
    }

    // ── purchasedNetUids: all positions ever bought (prevents re-buys) ─
    const purchasedNetUids = positions.map(p => p.netuid);

    // ── Seed portfolio history ────────────────────────────────────────
    // Build daily snapshots from Mar 31 (earliest buy) to today.
    // Value on each day = sum of positions bought on or before that day,
    // valued at buy price (we don't have daily historical prices).
    const history: Array<{ date: string; totalValue: number }> = [];
    const today = new Date().toISOString().slice(0, 10);
    const startDate = "2026-03-31"; // earliest buy date

    const dayMs = 24 * 60 * 60 * 1000;
    const start = new Date(startDate).getTime();
    const end = new Date(today).getTime();

    for (let t = start; t <= end; t += dayMs) {
      const date = new Date(t).toISOString().slice(0, 10);

      // Sum value of all positions bought on or before this date
      // Use buy price as baseline (approximate — we don't have daily prices)
      const totalValue = positions.reduce((sum, pos) => {
        if (pos.buyDate > date) return sum; // not yet bought
        // For today's snapshot, use current live price if available
        if (date === today) {
          const live = currentPrices[pos.netuid] ?? pos.buyPriceUsd;
          return sum + pos.alphaTokens * live;
        }
        // For past days: use buy price as baseline cost
        return sum + pos.amountUsd;
      }, 0);

      if (totalValue > 0) {
        history.push({ date, totalValue: Math.round(totalValue * 100) / 100 });
      }
    }

    const portfolio = { positions, history, purchasedNetUids };

    await put("portfolio.json", JSON.stringify(portfolio), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });

    return NextResponse.json({
      ok: true,
      positionsRestored: positions.length,
      historyEntries: history.length,
      log,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
