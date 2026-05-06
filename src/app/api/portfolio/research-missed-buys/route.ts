/**
 * GET /api/portfolio/research-missed-buys
 *
 * Research-only — makes NO changes to the portfolio.
 *
 * Reads subnet-scores-history.json (hourly snapshots, up to 90 days)
 * and finds every subnet that crossed aGap >= 80 between a start date
 * and today, that is NOT already in the portfolio's purchasedNetUids.
 *
 * Query params:
 *   since=YYYY-MM-DD  (default: 2026-04-17, day after last known portfolio buy)
 *   threshold=N       (default: 80)
 */

import { NextRequest, NextResponse } from "next/server";
import { get as blobGet } from "@vercel/blob";
import { loadPortfolio } from "../route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ScoreRow {
  agap: number;
  flow: number;
  dev: number;
  eval: number;
  social: number;
  price: number;
  mcap: number;
  emission_pct: number;
}

// Subnet name map (from scan route — main ones we care about)
const SUBNET_NAMES: Record<number, string> = {
  1: "Apex", 2: "Omron", 3: "τemplar", 4: "Targon", 5: "OTF",
  6: "NAS Chain", 7: "Allways", 8: "Vanta", 9: "Pretrain", 10: "Tensorage",
  11: "TrajectoryRL", 12: "Compute Horde", 13: "Data Universe", 14: "LLM Defender",
  15: "ORO", 16: "BitAgent", 17: "404-GEN", 18: "Cortex.t", 19: "Inference",
  20: "BitAgent", 21: "Any Logic", 22: "Desearch", 23: "NicheImage",
  24: "Quasar", 25: "Hivemind", 26: "Protein Folding", 27: "Compute",
  28: "ZkTensor", 29: "Coldint", 30: "Bettensor", 31: "NAS", 32: "It's AI",
  33: "Cerebras", 34: "BitMind", 35: "LogicNet", 36: "Autoppia",
  37: "Finetuning", 38: "SportsAI", 39: "Cliquemax", 40: "Chunking",
  41: "Sportstensor", 42: "Masa", 43: "Graphite", 44: "Score",
  45: "GenLayer", 46: "NAS", 47: "EvolAI", 48: "Nextplace",
  49: "Nepher Robotics", 50: "Synth", 51: "lium.io", 52: "Tetanus",
  53: "Voiceover", 54: "Mimic", 55: "Precog", 56: "Gradients",
  57: "Gaia", 58: "Dippy", 59: "Nineteen", 60: "SkyAgent",
  61: "RedTeam", 62: "Ridges", 63: "Celium", 64: "Chutes",
  65: "OrionLink", 66: "ninja", 67: "Quantum Tensor", 68: "NOVA",
  69: "Bitagent", 70: "BitTensor", 71: "Leadpoet", 72: "Pangu",
  73: "Agents Arena", 74: "Gittensor", 75: "Hippius", 76: "Storb",
  77: "NerveX", 78: "Taoplay", 79: "Stardust", 80: "Tensort",
  81: "TaoSec", 82: "GrainBrain", 83: "Autopilot", 84: "Commune",
  85: "Vidaio", 86: "HoloNetwork", 87: "Luminar Network", 88: "NetAgent",
  89: "Precog", 90: "Devel", 91: "Galaxy", 92: "Stardust",
  93: "BioAgent", 94: "Targon", 95: "Mining", 96: "Precog",
  97: "distil", 98: "TaoPlay", 99: "Autopilot", 100: "GoldFinder",
  101: "TaoSwap", 102: "TaoTensor", 103: "Bitmind", 104: "XTeam",
  105: "Cold Image", 106: "Synapse", 107: "OmniScore", 108: "Titan",
  109: "OpenKaito", 110: "MyShell", 111: "Mosaic", 112: "BitAds",
  113: "BitAgent", 114: "SOMA", 115: "TaoData", 116: "Dippy",
  117: "ChainData", 118: "TaoScan", 119: "GenLayer", 120: "Affine",
  121: "TaoAgents", 122: "TabCom", 123: "PromptIQ", 124: "BitVault",
  125: "Neural", 126: "NetTensor", 127: "BitSecure", 128: "NetChain",
};

export async function GET(req: NextRequest) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: "No blob token" }, { status: 500 });

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since") ?? "2026-04-17";
  const threshold = parseInt(url.searchParams.get("threshold") ?? "80", 10);

  try {
    // Load portfolio to get already-purchased subnets
    const portfolio = await loadPortfolio();
    const purchasedNetUids = new Set<number>([
      ...(portfolio.purchasedNetUids ?? []),
      ...portfolio.positions.map(p => p.netuid),
    ]);

    // Load score history blob
    const histBlob = await blobGet("subnet-scores-history.json", {
      token,
      access: "private",
      abortSignal: AbortSignal.timeout(30000),
    });

    if (!histBlob?.stream) {
      return NextResponse.json({ error: "subnet-scores-history.json not found" }, { status: 404 });
    }

    const reader = histBlob.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const scoreHistory: Record<string, Record<string, ScoreRow>> =
      JSON.parse(Buffer.concat(chunks).toString("utf-8"));

    // ── For each snapshot, find subnets at threshold+ ─────────────────
    // Group by date (YYYY-MM-DD), take the MAX agap score seen that day
    const dailyMaxBySubnet: Record<string, Record<number, { agap: number; price: number }>> = {};

    for (const [ts, snap] of Object.entries(scoreHistory)) {
      const date = ts.slice(0, 10); // "2026-04-22"
      if (date < sinceParam) continue; // before our window

      for (const [netuidStr, row] of Object.entries(snap)) {
        const netuid = parseInt(netuidStr, 10);
        if (row.agap < threshold) continue;

        if (!dailyMaxBySubnet[date]) dailyMaxBySubnet[date] = {};
        const existing = dailyMaxBySubnet[date][netuid];
        if (!existing || row.agap > existing.agap) {
          dailyMaxBySubnet[date][netuid] = { agap: row.agap, price: row.price };
        }
      }
    }

    // ── Find first date each subnet crossed threshold ──────────────────
    // Track: firstDate, peak score, and whether already in portfolio
    const subnetFirstCross: Record<number, {
      firstDate: string;
      peakScore: number;
      peakDate: string;
      buyPrice: number;
      alreadyOwned: boolean;
      name: string;
      datesAbove80: string[];
    }> = {};

    for (const [date, subnets] of Object.entries(dailyMaxBySubnet).sort()) {
      for (const [netuidNum, { agap, price }] of Object.entries(subnets).map(([k, v]) => [parseInt(k), v] as [number, typeof v])) {
        if (!subnetFirstCross[netuidNum]) {
          subnetFirstCross[netuidNum] = {
            firstDate: date,
            peakScore: agap,
            peakDate: date,
            buyPrice: price,
            alreadyOwned: purchasedNetUids.has(netuidNum),
            name: SUBNET_NAMES[netuidNum] ?? `SN${netuidNum}`,
            datesAbove80: [date],
          };
        } else {
          if (agap > subnetFirstCross[netuidNum].peakScore) {
            subnetFirstCross[netuidNum].peakScore = agap;
            subnetFirstCross[netuidNum].peakDate = date;
          }
          if (!subnetFirstCross[netuidNum].datesAbove80.includes(date)) {
            subnetFirstCross[netuidNum].datesAbove80.push(date);
          }
        }
      }
    }

    // ── Separate: missed (not owned) vs already owned ──────────────────
    const missed = Object.entries(subnetFirstCross)
      .filter(([, v]) => !v.alreadyOwned)
      .map(([netuidStr, v]) => ({
        netuid: parseInt(netuidStr),
        ...v,
        daysAbove80: v.datesAbove80.length,
      }))
      .sort((a, b) => a.firstDate.localeCompare(b.firstDate));

    const alreadyOwned = Object.entries(subnetFirstCross)
      .filter(([, v]) => v.alreadyOwned)
      .map(([netuidStr, v]) => ({
        netuid: parseInt(netuidStr),
        ...v,
        daysAbove80: v.datesAbove80.length,
      }))
      .sort((a, b) => a.firstDate.localeCompare(b.firstDate));

    // ── Date coverage ──────────────────────────────────────────────────
    const allSnapshotDates = [...new Set(
      Object.keys(scoreHistory).map(ts => ts.slice(0, 10))
    )].filter(d => d >= sinceParam).sort();

    return NextResponse.json({
      researchOnly: true,
      since: sinceParam,
      threshold,
      snapshotDatesInWindow: allSnapshotDates.length,
      oldestSnapshot: Object.keys(scoreHistory).sort()[0]?.slice(0, 10) ?? "none",
      newestSnapshot: Object.keys(scoreHistory).sort().at(-1)?.slice(0, 10) ?? "none",
      missedBuys: missed,
      alreadyOwnedAbove80: alreadyOwned,
      summary: {
        totalMissed: missed.length,
        totalAlreadyOwned: alreadyOwned.length,
        dateRange: `${sinceParam} → today`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
