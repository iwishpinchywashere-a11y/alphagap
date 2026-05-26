/**
 * GET /api/testing/restore-pump
 *
 * Restores the pump-tracker.json blob with all 16 portfolio positions as
 * confirmed pump-lab entries. Preserves any existing entries in the tracker
 * that aren't already in the list. Clears the blocklist for these subnets so
 * they're never accidentally blocked from re-appearing.
 */

import { NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";

export const dynamic = "force-dynamic";

interface TrackedPumper {
  name: string;
  searchName: string;
  netuid: number;
  added_at: string;
  reason: string;
  pump_pct: number;
  pump_date: string;
}

interface PumpTrackerData {
  tracked: TrackedPumper[];
  blocklist: string[];
}

// All 16 portfolio positions — pump_pct is peak % gain from manualPeakPrice vs buyPrice
const PORTFOLIO_ENTRIES: TrackedPumper[] = [
  { netuid: 15,  name: "ORO",           searchName: "oro",           added_at: "2026-04-10", buyAGapScore: 84, buyDate: "2026-04-10", pump_pct: 350, buyPrice: 4.11,  peakPrice: 18.50    },
  { netuid: 97,  name: "distil",        searchName: "distil",        added_at: "2026-04-06", buyAGapScore: 82, buyDate: "2026-04-06", pump_pct: 177, buyPrice: 11.02, peakPrice: 30.4912  },
  { netuid: 85,  name: "Vidaio",        searchName: "vidaio",        added_at: "2026-03-31", buyAGapScore: 82, buyDate: "2026-03-31", pump_pct: 35,  buyPrice: 3.89,  peakPrice: 5.2698   },
  { netuid: 11,  name: "TrajectoryRL",  searchName: "trajectoryrl",  added_at: "2026-03-31", buyAGapScore: 80, buyDate: "2026-03-31", pump_pct: 35,  buyPrice: 3.89,  peakPrice: 5.2616   },
  { netuid: 51,  name: "lium.io",       searchName: "lium.io",       added_at: "2026-04-04", buyAGapScore: 85, buyDate: "2026-04-04", pump_pct: 31,  buyPrice: 15.36, peakPrice: 20.1646  },
  { netuid: 71,  name: "Leadpoet",      searchName: "leadpoet",      added_at: "2026-04-11", buyAGapScore: 81, buyDate: "2026-04-11", pump_pct: 33,  buyPrice: 1.72,  peakPrice: 2.2752   },
  { netuid: 50,  name: "Synth",         searchName: "synth",         added_at: "2026-04-06", buyAGapScore: 81, buyDate: "2026-04-06", pump_pct: 27,  buyPrice: 2.98,  peakPrice: 3.7706   },
  { netuid: 74,  name: "Gittensor",     searchName: "gittensor",     added_at: "2026-04-11", buyAGapScore: 84, buyDate: "2026-04-11", pump_pct: 100, buyPrice: 1.40,  peakPrice: 2.215    },
  { netuid: 8,   name: "Vanta",         searchName: "vanta",         added_at: "2026-04-02", buyAGapScore: 81, buyDate: "2026-04-02", pump_pct: 29,  buyPrice: 8.45,  peakPrice: 10.9344  },
  { netuid: 120, name: "Affine",        searchName: "affine",        added_at: "2026-04-08", buyAGapScore: 81, buyDate: "2026-04-08", pump_pct: 15,  buyPrice: 26.34, peakPrice: 30.2620  },
  { netuid: 7,   name: "Allways",       searchName: "allways",       added_at: "2026-04-17", buyAGapScore: 80, buyDate: "2026-04-17", pump_pct: 30,  buyPrice: 1.07,  peakPrice: 1.3874   },
  { netuid: 62,  name: "Ridges",        searchName: "ridges",        added_at: "2026-04-05", buyAGapScore: 81, buyDate: "2026-04-05", pump_pct: 12,  buyPrice: 8.90,  peakPrice: 8.9011   },
  { netuid: 75,  name: "Hippius",       searchName: "hippius",       added_at: "2026-04-04", buyAGapScore: 84, buyDate: "2026-04-04", pump_pct: 10,  buyPrice: 8.18,  peakPrice: 8.18     },
  { netuid: 36,  name: "Autoppia",      searchName: "autoppia",      added_at: "2026-03-31", buyAGapScore: 80, buyDate: "2026-03-31", pump_pct: 292, buyPrice: 1.03,  peakPrice: 4.0368   },
  { netuid: 4,   name: "Targon",        searchName: "targon",        added_at: "2026-05-25", buyAGapScore: 83, buyDate: "2026-05-25", pump_pct: 0,   buyPrice: 16.23, peakPrice: 16.23    },
  { netuid: 13,  name: "Data Universe", searchName: "data universe", added_at: "2026-05-26", buyAGapScore: 80, buyDate: "2026-05-26", pump_pct: 0,   buyPrice: 2.11,  peakPrice: 2.11     },
].map(e => ({
  name: e.name,
  searchName: e.searchName,
  netuid: e.netuid,
  added_at: e.buyDate,
  reason: `aGap score ${(e as any).buyAGapScore} on ${e.buyDate} → +${Math.round((e as any).pump_pct)}%`,
  pump_pct: (e as any).pump_pct,
  pump_date: e.buyDate,
}));

const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN || "";

async function readBlob<T>(name: string, fallback: T): Promise<T> {
  try {
    const result = await blobGet(name, { token: TOKEN(), access: "private" });
    if (!result?.stream) return fallback;
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch { return fallback; }
}

export async function GET() {
  if (!TOKEN()) return NextResponse.json({ error: "No blob token" }, { status: 500 });

  // Load existing tracker
  const existing = await readBlob<PumpTrackerData>("pump-tracker.json", { tracked: [], blocklist: [] });

  const log: string[] = [];
  const portfolioNames = new Set(PORTFOLIO_ENTRIES.map(e => e.name.toLowerCase()));

  // Remove portfolio entries from blocklist so they can be added
  const cleanedBlocklist = (existing.blocklist ?? []).filter(b => !portfolioNames.has(b.toLowerCase()));
  const unblockedCount = (existing.blocklist ?? []).length - cleanedBlocklist.length;
  if (unblockedCount > 0) log.push(`Removed ${unblockedCount} portfolio entries from blocklist`);

  // Keep existing non-portfolio entries, replace/add all portfolio entries
  const nonPortfolioEntries = (existing.tracked ?? []).filter(
    t => !portfolioNames.has((t.searchName || t.name).toLowerCase())
  );
  log.push(`Kept ${nonPortfolioEntries.length} existing non-portfolio entries`);

  // Merge: portfolio entries first (most important), then non-portfolio
  const merged: PumpTrackerData = {
    tracked: [...PORTFOLIO_ENTRIES, ...nonPortfolioEntries],
    blocklist: cleanedBlocklist,
  };

  await put("pump-tracker.json", JSON.stringify(merged, null, 2), {
    access: "private" as never,
    token: TOKEN(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });

  log.push(`Restored ${PORTFOLIO_ENTRIES.length} portfolio entries to pump-tracker.json`);

  return NextResponse.json({
    ok: true,
    portfolioRestored: PORTFOLIO_ENTRIES.length,
    nonPortfolioKept: nonPortfolioEntries.length,
    blocklistCleaned: unblockedCount,
    totalTracked: merged.tracked.length,
    log,
  });
}
