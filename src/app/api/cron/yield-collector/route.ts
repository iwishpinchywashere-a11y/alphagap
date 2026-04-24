/**
 * GET /api/cron/yield-collector
 *
 * Runs every 2 hours. Fetches staking yield (APY) data from the TaoStats API
 * for every active subnet and writes the results to yield-latest.json in Vercel Blob.
 *
 * Output blob shape:
 *   {
 *     subnets: {
 *       [netuid: string]: {
 *         apy_7d: number;   // avg 7-day APY across top validators (0–1 scale)
 *         apy_1h: number;   // avg 1-hour APY (annualised)
 *         apy_30d: number;  // avg 30-day APY (annualised)
 *         validators: number;
 *       }
 *     },
 *     updatedAt: string;
 *   }
 *
 * The scan route and /api/yield-scores both read from this blob.
 */

import { NextRequest, NextResponse } from "next/server";
import { get as blobGet, put as blobPut } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
const TAOSTATS_KEY = process.env.TAOSTATS_API_KEY || "";
const BASE_URL = "https://api.taostats.io/api";

// Active mainnet subnets to collect (extend as new ones register)
const ACTIVE_NETUIDS = [
  1,2,3,4,5,6,7,8,9,10,
  11,12,13,14,15,16,17,18,19,20,
  21,22,23,24,25,26,27,28,29,30,
  31,32,33,34,35,36,37,38,39,40,
  41,42,43,44,45,46,47,48,49,50,
  51,52,53,54,55,56,57,58,59,60,
  61,62,63,64,65,66,67,68,69,70,
];

interface ValidatorYield {
  stake: number;
  one_hour_apy: number;
  one_day_apy: number;
  seven_day_apy: number;
  thirty_day_apy: number;
}

interface SubnetYield {
  apy_7d: number;
  apy_1h: number;
  apy_30d: number;
  validators: number;
}

async function fetchSubnetYield(netuid: number, retries = 1): Promise<SubnetYield | null> {
  const url = `${BASE_URL}/dtao/validator/yield/latest/v1?netuid=${netuid}&limit=100`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: TAOSTATS_KEY },
      signal: AbortSignal.timeout(12000),
    });
    if (res.status === 429) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 6000));
        return fetchSubnetYield(netuid, retries - 1);
      }
      return null;
    }
    if (!res.ok) return null;

    const json = await res.json() as { data?: ValidatorYield[] };
    const validators = json.data ?? [];
    if (validators.length === 0) return null;

    // Weight averages by stake so large validators dominate the average
    const totalStake = validators.reduce((s, v) => s + (v.stake || 0), 0);
    if (totalStake === 0) return null;

    let weighted7d = 0, weighted1h = 0, weighted30d = 0;
    for (const v of validators) {
      const w = (v.stake || 0) / totalStake;
      weighted7d  += (v.seven_day_apy  || 0) * w;
      weighted1h  += (v.one_hour_apy   || 0) * w;
      weighted30d += (v.thirty_day_apy || 0) * w;
    }

    return {
      apy_7d:  Math.round(weighted7d  * 10000) / 10000,
      apy_1h:  Math.round(weighted1h  * 10000) / 10000,
      apy_30d: Math.round(weighted30d * 10000) / 10000,
      validators: validators.length,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  // Auth: Vercel cron header or CRON_SECRET bearer
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const cronSecret = process.env.CRON_SECRET;
  if (!isVercelCron && cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  if (!TAOSTATS_KEY) {
    return NextResponse.json({ error: "TAOSTATS_API_KEY not configured" }, { status: 500 });
  }

  console.log("[yield-collector] Starting yield collection...");
  const results: Record<string, SubnetYield> = {};
  let collected = 0, failed = 0;

  // Fetch in batches of 5 with 1.2s delay between batches to stay under rate limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < ACTIVE_NETUIDS.length; i += BATCH_SIZE) {
    const batch = ACTIVE_NETUIDS.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(n => fetchSubnetYield(n)));
    for (let j = 0; j < batch.length; j++) {
      const r = batchResults[j];
      if (r) { results[String(batch[j])] = r; collected++; }
      else { failed++; }
    }
    // Brief pause between batches (skip after last batch)
    if (i + BATCH_SIZE < ACTIVE_NETUIDS.length) {
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  const blob = { subnets: results, updatedAt: new Date().toISOString() };

  await blobPut("yield-latest.json", JSON.stringify(blob), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: BLOB_TOKEN,
  });

  console.log(`[yield-collector] Done: ${collected} collected, ${failed} failed`);
  return NextResponse.json({ ok: true, collected, failed, updatedAt: blob.updatedAt });
}
