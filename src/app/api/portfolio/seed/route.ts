// One-time portfolio seeder — call once to bootstrap initial positions
// GET /api/portfolio/seed
// Seeds SN17 (Vidaio) and SN11 (Trajectory RL) at today's live price

import { NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";
import { loadPortfolio } from "../route";

export const dynamic = "force-dynamic";

const SEED_POSITIONS = [
  { netuid: 17, label: "Vidaio" },
  { netuid: 11, label: "Trajectory RL" },
];

const BUY_AMOUNT = 100;

export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "No blob storage" }, { status: 500 });
  }

  try {
    // Load current scan data for live prices
    const scanBlob = await blobGet("scan-latest.json", {
      token: process.env.BLOB_READ_WRITE_TOKEN!,
      access: "private",
    });

    if (!scanBlob?.stream) {
      return NextResponse.json({ error: "No scan data — run a scan first" }, { status: 400 });
    }

    const reader = scanBlob.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const scanData = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    const leaderboard: Array<{ netuid: number; name: string; alpha_price?: number; composite_score: number }> = scanData.leaderboard || [];
    const taoPrice: number = scanData.taoPrice || 0;

    const portfolio = await loadPortfolio();
    const today = new Date().toISOString().slice(0, 10);
    const added: string[] = [];
    const skipped: string[] = [];

    for (const seed of SEED_POSITIONS) {
      // Skip if already have a position
      if (portfolio.positions.some(p => p.netuid === seed.netuid)) {
        skipped.push(`SN${seed.netuid} ${seed.label} (already in portfolio)`);
        continue;
      }

      const entry = leaderboard.find(e => e.netuid === seed.netuid);
      if (!entry?.alpha_price || entry.alpha_price <= 0) {
        skipped.push(`SN${seed.netuid} ${seed.label} (no price data)`);
        continue;
      }

      const alphaTokens = BUY_AMOUNT / entry.alpha_price;
      portfolio.positions.push({
        netuid: seed.netuid,
        name: entry.name || seed.label,
        buyDate: today,
        buyAGapScore: entry.composite_score,
        buyPriceUsd: entry.alpha_price,
        amountUsd: BUY_AMOUNT,
        alphaTokens,
      });
      added.push(`SN${seed.netuid} ${entry.name} @ $${entry.alpha_price.toFixed(4)} (${alphaTokens.toFixed(2)} tokens)`);
    }

    // Seed today's portfolio value snapshot
    if (portfolio.positions.length > 0) {
      const totalValue = portfolio.positions.reduce((sum, pos) => {
        const liveEntry = leaderboard.find(e => e.netuid === pos.netuid);
        const price = liveEntry?.alpha_price ?? pos.buyPriceUsd;
        return sum + pos.alphaTokens * price;
      }, 0);

      const existingIdx = portfolio.history.findIndex(h => h.date === today);
      if (existingIdx >= 0) {
        portfolio.history[existingIdx].totalValue = Math.round(totalValue * 100) / 100;
      } else {
        portfolio.history.push({ date: today, totalValue: Math.round(totalValue * 100) / 100 });
      }
    }

    await put("portfolio.json", JSON.stringify(portfolio), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });

    return NextResponse.json({
      ok: true,
      added,
      skipped,
      totalPositions: portfolio.positions.length,
      taoPrice,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
