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
  peakPrice?: number;     // highest alpha price seen since buy (updated by scan cron)
  manualPeakPrice?: number; // manually set peak — never overwritten by scan
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

      // Max P&L: manualPeakPrice (set via admin PATCH) takes priority over scan-tracked peakPrice
      const peakPrice = pos.manualPeakPrice ?? pos.peakPrice ?? null;
      const maxPnlUsd = peakPrice != null ? pos.alphaTokens * peakPrice - pos.amountUsd : null;
      const maxPnlPct = peakPrice != null ? ((pos.alphaTokens * peakPrice - pos.amountUsd) / pos.amountUsd) * 100 : null;

      return {
        ...pos,
        currentPrice,
        currentValue,
        totalPnlUsd,
        totalPnlPct,
        change24h,
        pnl24hUsd,
        peakPrice,
        maxPnlUsd,
        maxPnlPct,
      };
    });

    const totalValue = enriched.reduce((s, p) => s + p.currentValue, 0);
    const totalCost = enriched.reduce((s, p) => s + p.amountUsd, 0);
    const totalPnlUsd = totalValue - totalCost;
    const totalPnlPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

    // Max Return: sum of best-case gains across all positions with peak data
    const posWithPeak = enriched.filter(p => p.maxPnlUsd != null);
    const maxReturnUsd = posWithPeak.length > 0
      ? posWithPeak.reduce((s, p) => s + (p.maxPnlUsd ?? 0), 0)
      : null;
    const maxReturnPct = posWithPeak.length > 0 && totalCost > 0
      ? ((posWithPeak.reduce((s, p) => s + (p.alphaTokens * (p.peakPrice ?? 0)), 0) - posWithPeak.reduce((s, p) => s + p.amountUsd, 0)) / posWithPeak.reduce((s, p) => s + p.amountUsd, 0)) * 100
      : null;

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
        maxReturnUsd,
        maxReturnPct,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH /api/portfolio — update or remove position(s) by netuid
// Body: { netuid: number, remove?: boolean, ... } OR { netuids: number[], remove: true } for batch removal
export async function PATCH(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "No blob storage" }, { status: 500 });
  }
  try {
    const { put } = await import("@vercel/blob");
    const body = await req.json() as {
      netuid?: number;
      netuids?: number[];
      remove?: boolean;
      buyAGapScore?: number;
      buyPriceUsd?: number;
      buyDate?: string;
      peakPrice?: number;
      // Batch peak update: { peaks: { "85": 4.87, "11": 5.16, ... } }
      peaks?: Record<string, number>;
    };

    // Batch peak prices: { peaks: { "85": 4.87, "11": 5.16 } }
    if (body.peaks) {
      const portfolio = await loadPortfolio();
      for (const [netuidStr, price] of Object.entries(body.peaks)) {
        const netuid = parseInt(netuidStr, 10);
        const pos = portfolio.positions.find(p => p.netuid === netuid);
        if (pos) pos.manualPeakPrice = price;
      }
      await put("portfolio.json", JSON.stringify(portfolio), {
        access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
      });
      return NextResponse.json({ ok: true, action: "peaks_updated", count: Object.keys(body.peaks).length });
    }

    // Batch remove: { netuids: [3, 4, 15, ...], remove: true }
    if (body.netuids && body.remove) {
      const portfolio = await loadPortfolio();
      const toRemove = new Set(body.netuids);
      const removed = portfolio.positions.filter(p => toRemove.has(p.netuid));
      portfolio.positions = portfolio.positions.filter(p => !toRemove.has(p.netuid));
      await put("portfolio.json", JSON.stringify(portfolio), {
        access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
      });
      return NextResponse.json({ ok: true, action: "batch_removed", removed: removed.map(p => p.name), remaining: portfolio.positions.length });
    }

    const netuid = body.netuid!;
    const portfolio = await loadPortfolio();
    const idx = portfolio.positions.findIndex(p => p.netuid === netuid);
    if (idx === -1) {
      return NextResponse.json({ error: `No position with netuid ${netuid}` }, { status: 404 });
    }
    if (body.remove) {
      const removed = portfolio.positions.splice(idx, 1)[0];
      await put("portfolio.json", JSON.stringify(portfolio), {
        access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
      });
      return NextResponse.json({ ok: true, action: "removed", position: removed });
    }
    if (body.buyAGapScore !== undefined) portfolio.positions[idx].buyAGapScore = body.buyAGapScore;
    if (body.buyPriceUsd !== undefined) {
      portfolio.positions[idx].buyPriceUsd = body.buyPriceUsd;
      portfolio.positions[idx].alphaTokens = portfolio.positions[idx].amountUsd / body.buyPriceUsd;
    }
    if (body.buyDate !== undefined) portfolio.positions[idx].buyDate = body.buyDate;
    if (body.peakPrice !== undefined) {
      // Store as manualPeakPrice so the scan cron can never overwrite it
      portfolio.positions[idx].manualPeakPrice = body.peakPrice;
    }
    await put("portfolio.json", JSON.stringify(portfolio), {
      access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
    });
    return NextResponse.json({ ok: true, action: "updated", position: portfolio.positions[idx] });
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
