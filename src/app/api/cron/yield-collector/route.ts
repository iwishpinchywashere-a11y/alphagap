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

// Fetch the full list of registered netuids from the TaoStats subnet API.
// This is the authoritative source — always current as new subnets register.
// Falls back to a static 0-130 range if the API call fails.
async function getActiveNetuids(): Promise<number[]> {
  try {
    const res = await fetch(`${BASE_URL}/subnet/latest/v1?limit=200`, {
      headers: { Authorization: TAOSTATS_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`subnet list ${res.status}`);
    const json = await res.json() as { data?: { netuid: number }[] };
    const ids = (json.data ?? [])
      .map(s => s.netuid)
      .filter(n => typeof n === "number" && n >= 0);
    if (ids.length > 0) {
      console.log(`[yield-collector] Found ${ids.length} registered subnets (max netuid ${Math.max(...ids)})`);
      return ids;
    }
  } catch (e) {
    console.warn("[yield-collector] Could not fetch subnet list, using static fallback:", e);
  }
  // Static fallback: 0-130
  return Array.from({ length: 131 }, (_, i) => i);
}

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

async function fetchSubnetYield(netuid: number, retries = 2): Promise<SubnetYield | null> {
  const url = `${BASE_URL}/dtao/validator/yield/latest/v1?netuid=${netuid}&limit=100`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: TAOSTATS_KEY },
      signal: AbortSignal.timeout(12000),
    });
    if (res.status === 429) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 8000));
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

  const activeNetuids = await getActiveNetuids();
  console.log(`[yield-collector] Starting yield collection for ${activeNetuids.length} subnets...`);
  const results: Record<string, SubnetYield> = {};
  let collected = 0, failed = 0;

  // Rate limit: 60 req/min = 1 req/sec.
  // Sequential with 1.1s gap = ~55 req/min — safe buffer under the limit.
  // 129 subnets × 1.1s = ~142s total, well within maxDuration 300.
  for (let i = 0; i < activeNetuids.length; i++) {
    const netuid = activeNetuids[i];
    const r = await fetchSubnetYield(netuid);
    if (r) { results[String(netuid)] = r; collected++; }
    else { failed++; console.log(`[yield-collector] No data for netuid ${netuid}`); }
    // 1.1s gap between every request — stays safely under 60 req/min
    if (i < activeNetuids.length - 1) {
      await new Promise(r => setTimeout(r, 1100));
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
