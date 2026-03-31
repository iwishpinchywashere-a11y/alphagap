// Portfolio performance tracker
// Tracks mock $100 buys whenever a subnet's aGap score crosses 80
// Auto-buy logic runs inside /api/scan — this route handles reads

import { NextResponse } from "next/server";
import { get as blobGet } from "@vercel/blob";

export const dynamic = "force-dynamic";

export interface PortfolioPosition {
  netuid: number;
  name: string;
  buyDate: string;        // YYYY-MM-DD
  buyAGapScore: number;
  buyPriceUsd: number;    // alpha token price in USD at buy time
  amountUsd: number;      // always $100
  alphaTokens: number;    // amountUsd / buyPriceUsd
}

export interface PortfolioSnapshot {
  date: string;           // YYYY-MM-DD
  totalValue: number;     // USD
}

export interface Portfolio {
  positions: PortfolioPosition[];
  history: PortfolioSnapshot[];
}

export async function GET() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "No blob storage" }, { status: 500 });
    }

    // Load portfolio
    const portfolio = await loadPortfolio();

    // Load latest scan for current prices
    let currentPrices: Record<number, { price: number; change24h: number }> = {};
    let taoPrice = 0;

    try {
      const scanBlob = await blobGet("scan-latest.json", {
        token: process.env.BLOB_READ_WRITE_TOKEN!,
        access: "private",
      });
      if (scanBlob?.stream) {
        const reader = scanBlob.stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const scanData = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        taoPrice = scanData.taoPrice || 0;
        for (const entry of scanData.leaderboard || []) {
          if (entry.alpha_price != null) {
            currentPrices[entry.netuid] = {
              price: entry.alpha_price,
              change24h: entry.price_change_24h || 0,
            };
          }
        }
      }
    } catch {
      // Use buy prices as fallback
    }

    // Enrich positions with live pricing
    const enriched = portfolio.positions.map(pos => {
      const live = currentPrices[pos.netuid];
      const currentPrice = live?.price ?? pos.buyPriceUsd;
      const currentValue = pos.alphaTokens * currentPrice;
      const totalPnlUsd = currentValue - pos.amountUsd;
      const totalPnlPct = ((currentValue - pos.amountUsd) / pos.amountUsd) * 100;
      const change24h = live?.change24h ?? 0;
      const pnl24hUsd = currentValue * (change24h / 100);

      return {
        ...pos,
        currentPrice,
        currentValue,
        totalPnlUsd,
        totalPnlPct,
        change24h,
        pnl24hUsd,
      };
    });

    const totalValue = enriched.reduce((s, p) => s + p.currentValue, 0);
    const totalCost = enriched.reduce((s, p) => s + p.amountUsd, 0);
    const totalPnlUsd = totalValue - totalCost;
    const totalPnlPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

    return NextResponse.json({
      positions: enriched,
      history: portfolio.history,
      summary: {
        totalValue,
        totalCost,
        totalPnlUsd,
        totalPnlPct,
        positionCount: enriched.length,
        taoPrice,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function loadPortfolio(): Promise<Portfolio> {
  try {
    const blob = await blobGet("portfolio.json", {
      token: process.env.BLOB_READ_WRITE_TOKEN!,
      access: "private",
    });
    if (!blob?.stream) return { positions: [], history: [] };
    const reader = blob.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    return { positions: [], history: [] };
  }
}
