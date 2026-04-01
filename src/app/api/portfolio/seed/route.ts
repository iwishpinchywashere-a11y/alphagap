// One-time portfolio seeder — call once to bootstrap initial positions
// GET /api/portfolio/seed
// Seeds SN17 (Vidaio) at today's live price
// Seeds SN11 (Trajectory RL) at YESTERDAY's price (it hit aGap 80 yesterday)

import { NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";
import { loadPortfolio } from "../route";

export const dynamic = "force-dynamic";

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
    const leaderboard: Array<{
      netuid: number;
      name: string;
      alpha_price?: number;
      composite_score: number;
      price_change_24h?: number;
    }> = scanData.leaderboard || [];
    const taoPrice: number = scanData.taoPrice || 0;

    const portfolio = await loadPortfolio();
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const added: string[] = [];
    const skipped: string[] = [];

    // ── SN17 Vidaio — buy at today's price ───────────────────────
    if (portfolio.positions.some(p => p.netuid === 17)) {
      skipped.push("SN17 Vidaio (already in portfolio)");
    } else {
      const entry = leaderboard.find(e => e.netuid === 17);
      if (!entry?.alpha_price || entry.alpha_price <= 0) {
        skipped.push("SN17 Vidaio (no price data)");
      } else {
        const alphaTokens = BUY_AMOUNT / entry.alpha_price;
        portfolio.positions.push({
          netuid: 17,
          name: entry.name || "Vidaio",
          buyDate: today,
          buyAGapScore: 80, // score at time of buy signal
          buyPriceUsd: entry.alpha_price,
          amountUsd: BUY_AMOUNT,
          alphaTokens,
        });
        added.push(`SN17 ${entry.name} @ $${entry.alpha_price.toFixed(4)} (${alphaTokens.toFixed(2)} tokens) — TODAY`);
      }
    }

    // ── SN11 Trajectory RL — buy at YESTERDAY's price ────────────
    // It hit aGap 80 yesterday. Back-calculate yesterday's price from
    // today's price and the 24h price change %.
    if (portfolio.positions.some(p => p.netuid === 11)) {
      skipped.push("SN11 Trajectory RL (already in portfolio)");
    } else {
      const entry = leaderboard.find(e => e.netuid === 11);
      if (!entry?.alpha_price || entry.alpha_price <= 0) {
        skipped.push("SN11 Trajectory RL (no price data)");
      } else {
        // Back-calculate: yesterdayPrice = todayPrice / (1 + pctChange/100)
        const pctChange = entry.price_change_24h ?? 0;
        const yesterdayPrice = pctChange !== 0
          ? entry.alpha_price / (1 + pctChange / 100)
          : entry.alpha_price; // if no change data, use today's price
        const alphaTokens = BUY_AMOUNT / yesterdayPrice;
        portfolio.positions.push({
          netuid: 11,
          name: entry.name || "Trajectory RL",
          buyDate: yesterday,
          buyAGapScore: 80, // confirmed aGap score when it was spotted
          buyPriceUsd: yesterdayPrice,
          amountUsd: BUY_AMOUNT,
          alphaTokens,
        });
        const pctLabel = pctChange >= 0
          ? `+${pctChange.toFixed(1)}% since buy`
          : `${pctChange.toFixed(1)}% since buy`;
        added.push(`SN11 ${entry.name} @ $${yesterdayPrice.toFixed(4)} yesterday (${alphaTokens.toFixed(2)} tokens, ${pctLabel})`);
      }
    }

    // ── Seed portfolio value snapshot ─────────────────────────────
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

      // Also seed a yesterday entry at cost basis so the chart starts at $200
      const yesterdayTotal = portfolio.positions.reduce((sum, pos) => sum + pos.amountUsd, 0);
      const existingYesterdayIdx = portfolio.history.findIndex(h => h.date === yesterday);
      if (existingYesterdayIdx < 0) {
        portfolio.history.push({ date: yesterday, totalValue: yesterdayTotal });
      }
    }

    // Sort history chronologically
    portfolio.history.sort((a, b) => a.date.localeCompare(b.date));

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
