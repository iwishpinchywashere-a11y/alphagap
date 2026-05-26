/**
 * GET /api/portfolio/restore-v3
 *
 * Restores the full portfolio after the May 2026 wipe.
 * Combines all 14 original April positions (from restore-v2) at $1,000 buy amounts
 * with 2 new positions (Targon SN4, Data Universe SN13) added May 25-26.
 *
 * Peak prices:
 *  - April positions: manualPeakPrices from the pre-wipe screenshot (same formula as restore-v2)
 *  - May positions: left unset (scan cron will track live peaks going forward)
 *
 * All 16 netuids are added to purchasedNetUids so the scan never re-buys them.
 */

import { NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";

export const dynamic = "force-dynamic";

const BUY_AMOUNT = 1000;

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
}

// manualPeakPrice = best known all-time-high USD price since the buy date.
// Sources: (1) pre-wipe screenshot P&L back-calculated, (2) TaoStats historical max × TAO price.
const POSITIONS: Array<{
  netuid: number; name: string; buyDate: string; buyAGapScore: number;
  buyPrice: number; manualPeakPrice?: number;
}> = [
  // ── Original April positions (from restore-v2, scaled to $1000) ───────────
  // manualPeakPrice column: use best known peak — either from pre-wipe screenshot
  // or from TaoStats find-peaks (max TAO price since buy × TAO price at time of peak).
  // For positions where manualPeakPrice is omitted, the scan will track peaks going forward.
  { netuid: 15,  name: "ORO",          buyDate: "2026-04-10", buyAGapScore: 84, buyPrice: 4.11,  manualPeakPrice: 18.50    }, // user recalled +350%
  { netuid: 97,  name: "distil",       buyDate: "2026-04-06", buyAGapScore: 82, buyPrice: 11.02, manualPeakPrice: 30.4912  }, // from pre-wipe screenshot
  { netuid: 85,  name: "Vidaio",       buyDate: "2026-03-31", buyAGapScore: 82, buyPrice: 3.89,  manualPeakPrice: 5.2698   }, // from pre-wipe screenshot
  { netuid: 11,  name: "TrajectoryRL", buyDate: "2026-03-31", buyAGapScore: 80, buyPrice: 3.89,  manualPeakPrice: 5.2616   }, // from pre-wipe screenshot
  { netuid: 51,  name: "lium.io",      buyDate: "2026-04-04", buyAGapScore: 85, buyPrice: 15.36, manualPeakPrice: 20.1646  }, // from pre-wipe screenshot
  { netuid: 71,  name: "Leadpoet",     buyDate: "2026-04-11", buyAGapScore: 81, buyPrice: 1.72,  manualPeakPrice: 2.2752   }, // TaoStats peak $2.2752 (Apr 14)
  { netuid: 50,  name: "Synth",        buyDate: "2026-04-06", buyAGapScore: 81, buyPrice: 2.98,  manualPeakPrice: 3.7706   }, // from pre-wipe screenshot
  { netuid: 74,  name: "Gittensor",    buyDate: "2026-04-11", buyAGapScore: 84, buyPrice: 0,     manualPeakPrice: 2.215    }, // TaoStats peak $2.215 (Apr 14)
  { netuid: 8,   name: "Vanta",        buyDate: "2026-04-02", buyAGapScore: 81, buyPrice: 8.45,  manualPeakPrice: 10.9344  }, // TaoStats peak $10.93 (Apr 19)
  { netuid: 120, name: "Affine",       buyDate: "2026-04-08", buyAGapScore: 81, buyPrice: 26.34, manualPeakPrice: 30.2620  }, // from pre-wipe screenshot
  { netuid: 7,   name: "Allways",      buyDate: "2026-04-17", buyAGapScore: 80, buyPrice: 1.07,  manualPeakPrice: 1.3874   }, // TaoStats peak $1.387 (Apr 21)
  { netuid: 62,  name: "Ridges",       buyDate: "2026-04-05", buyAGapScore: 81, buyPrice: 8.90,  manualPeakPrice: 8.9011   }, // TaoStats (no improvement vs buy)
  { netuid: 75,  name: "Hippius",      buyDate: "2026-04-04", buyAGapScore: 84, buyPrice: 8.18,  manualPeakPrice: 8.18     }, // TaoStats (no improvement vs buy)
  { netuid: 36,  name: "Autoppia",     buyDate: "2026-03-31", buyAGapScore: 80, buyPrice: 1.03,  manualPeakPrice: 4.0368   }, // TaoStats peak $4.04 (Apr 5) +292%
  // ── New May 2026 positions (auto-bought after the wipe reset purchasedNetUids) ─
  { netuid: 4,   name: "Targon",       buyDate: "2026-05-25", buyAGapScore: 83, buyPrice: 16.23  }, // scan will track peak
  { netuid: 13,  name: "Data Universe",buyDate: "2026-05-26", buyAGapScore: 80, buyPrice: 2.11   }, // scan will track peak
];

export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "No blob storage" }, { status: 500 });
  }

  try {
    // ── Fetch live scan for current prices (Gittensor has no historical price) ─
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

    const positions: Position[] = [];
    const log: string[] = [];

    for (const p of POSITIONS) {
      let buyPrice = p.buyPrice;

      if (buyPrice <= 0) {
        buyPrice = currentPrices[p.netuid] ?? 0;
        if (buyPrice <= 0) {
          log.push(`⚠️ SN${p.netuid} ${p.name}: no price available, skipping`);
          continue;
        }
        log.push(`SN${p.netuid} ${p.name}: using live price $${buyPrice.toFixed(4)} as buy price`);
      }

      const alphaTokens = BUY_AMOUNT / buyPrice;

      // Use manualPeakPrice directly from POSITIONS data (already in USD).
      // Take max with live price so scan doesn't immediately overwrite with a lower value.
      const manualPeakPrice = p.manualPeakPrice;
      const livePrice = currentPrices[p.netuid] ?? buyPrice;
      const effectivePeak = manualPeakPrice
        ? Math.max(manualPeakPrice, livePrice)
        : livePrice;

      positions.push({
        netuid: p.netuid,
        name: p.name,
        buyDate: p.buyDate,
        buyAGapScore: p.buyAGapScore,
        buyPriceUsd: buyPrice,
        amountUsd: BUY_AMOUNT,
        alphaTokens,
        ...(manualPeakPrice ? { manualPeakPrice } : {}),
        peakPrice: effectivePeak,
      });

      log.push(
        `✓ SN${p.netuid} ${p.name}: buy $${buyPrice.toFixed(4)} @ ${p.buyDate}${
          manualPeakPrice ? ` → peak $${manualPeakPrice.toFixed(4)}` : ""
        }`
      );
    }

    // purchasedNetUids: all restored + a few more that crossed 80 at some point
    // to prevent scan from re-buying subnets that have since dipped below 80
    const purchasedNetUids = positions.map(p => p.netuid);

    // ── Seed portfolio history ─────────────────────────────────────────────
    const history: Array<{ date: string; totalValue: number }> = [];
    const today = new Date().toISOString().slice(0, 10);
    const startDate = "2026-03-31";

    const dayMs = 24 * 60 * 60 * 1000;
    const start = new Date(startDate).getTime();
    const end = new Date(today).getTime();

    for (let t = start; t <= end; t += dayMs) {
      const date = new Date(t).toISOString().slice(0, 10);
      const totalValue = positions.reduce((sum, pos) => {
        if (pos.buyDate > date) return sum;
        if (date === today) {
          const live = currentPrices[pos.netuid] ?? pos.buyPriceUsd;
          return sum + pos.alphaTokens * live;
        }
        return sum + pos.amountUsd;
      }, 0);
      if (totalValue > 0) {
        history.push({ date, totalValue: Math.round(totalValue * 100) / 100 });
      }
    }

    const portfolio = { positions, history, purchasedNetUids };

    await put("portfolio.json", JSON.stringify(portfolio), {
      access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
    });
    // Write backup immediately so we have a safety copy
    await put("portfolio-backup.json", JSON.stringify(portfolio), {
      access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
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
