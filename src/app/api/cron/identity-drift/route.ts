/**
 * GET /api/cron/identity-drift
 *
 * Runs daily. One TaoStats request.
 *
 * Netuids get recycled — a subnet deregisters and a new project takes the
 * slot, but our hand-curated profiles (benchmarks.ts, tao-pages-data.ts) keep
 * describing the dead predecessor. In July 2026 this had drifted on ~59 of 129
 * subnets before anyone noticed. This watcher diffs the live on-chain subnet
 * name against our stored profile names and emails the owner when NEW drift
 * appears, so the next recycle is caught in a day instead of months.
 *
 * Only emails on newly-detected drift (deduped in a blob); auto-clears when a
 * name matches again. Ignores placeholder chain names (deprecated/unknown/…)
 * since those mean the operator hasn't set identity, not that our data is wrong.
 */

import { NextRequest, NextResponse } from "next/server";
import { get as blobGet, put as blobPut } from "@vercel/blob";
import { getSubnetIdentities } from "@/lib/taostats";
import { BENCHMARK_DATA } from "@/lib/benchmarks";
import { TAO_PAGES_SUBNETS } from "@/lib/tao-pages-data";
import { sendSystemAlertEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN || "";
const STATE_KEY = "identity-drift-state.json";

// Chain names that mean "operator hasn't set identity" — not our data being wrong.
const PLACEHOLDER = new Set(["", "deprecated", "unknown", "pending", "parked", "base"]);

function norm(s: string | null | undefined): string {
  // Fold homoglyphs Bittensor teams love (Greek τ for "t", 0/O and 1/l/i
  // confusion) BEFORE stripping — otherwise "hoτfloaτ" vs "hotfloat" and
  // "0xMarkets" vs "OxMarkets" read as drift when they're the same project.
  return (s || "")
    .toLowerCase()
    .replace(/τ/g, "t").replace(/ρ/g, "p").replace(/α/g, "a").replace(/ε/g, "e")
    .replace(/ο/g, "o").replace(/[0]/g, "o").replace(/[1]/g, "l")
    .replace(/[^a-z]/g, "");
}

// Same substring-tolerant match used in the one-time audit — handles
// "lium.io" vs "lium", "0xMarkets" vs "OxMarkets", etc.
function matches(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

interface DriftState {
  reported: Record<string, string>; // netuid -> chain name we last alerted on
  updatedAt: string;
}

async function readState(): Promise<DriftState> {
  try {
    const b = await blobGet(STATE_KEY, { token: TOKEN(), access: "private", abortSignal: AbortSignal.timeout(8000) });
    if (!b?.stream) return { reported: {}, updatedAt: "" };
    const reader = b.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as DriftState;
  } catch { return { reported: {}, updatedAt: "" }; }
}

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!isVercelCron && secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identities = await getSubnetIdentities().catch(() => []);
  if (identities.length === 0) {
    return NextResponse.json({ error: "No identities from TaoStats" }, { status: 502 });
  }

  // Our stored profile names by netuid
  const benchName = new Map<number, string>(BENCHMARK_DATA.map(b => [b.subnet_id, b.subnet_name]));
  const pageName = new Map<number, string>(TAO_PAGES_SUBNETS.map(p => [p.netuid, p.name]));

  interface Drift { netuid: number; chain: string; benchmark?: string; page?: string; }
  const drifts: Drift[] = [];

  for (const id of identities) {
    const chain = id.subnet_name || "";
    if (PLACEHOLDER.has(norm(chain))) continue; // operator hasn't set identity — not our error

    const b = benchName.get(id.netuid);
    const p = pageName.get(id.netuid);
    const bDrift = b && !matches(b, chain);
    const pDrift = p && !matches(p, chain);
    // Skip profiles we intentionally neutralized to "Subnet N"
    const neutralized = (p && /^subnet\s*\d+$/i.test(p)) || (b && /^subnet\s*\d+$/i.test(b));
    if ((bDrift || pDrift) && !neutralized) {
      drifts.push({
        netuid: id.netuid,
        chain,
        benchmark: bDrift ? b : undefined,
        page: pDrift ? p : undefined,
      });
    }
  }

  // Dedup against last-reported state; only alert on NEW or changed drift
  const state = await readState();
  const nextReported: Record<string, string> = {};
  const fresh: Drift[] = [];
  for (const d of drifts) {
    nextReported[d.netuid] = d.chain;
    if (state.reported[String(d.netuid)] !== d.chain) fresh.push(d);
  }

  let emailed = false;
  if (fresh.length > 0) {
    const lines = fresh.map(d => {
      const parts: string[] = [];
      if (d.page) parts.push(`TAO Page says "<strong>${d.page}</strong>"`);
      if (d.benchmark) parts.push(`benchmark says "<strong>${d.benchmark}</strong>"`);
      return `<strong style="color:#f59e0b;">SN${d.netuid}</strong> is now "<strong style="color:#fff;">${d.chain}</strong>" on-chain, but our ${parts.join(" and ")}.`;
    });
    lines.push(`These profiles likely describe a dead/renamed predecessor. Re-research and update <code>benchmarks.ts</code> + <code>tao-pages-data.ts</code>.`);
    await sendSystemAlertEmail(
      `${fresh.length} subnet profile${fresh.length > 1 ? "s" : ""} drifted from on-chain identity`,
      lines,
    ).catch(err => console.error("[identity-drift] email failed:", err));
    emailed = true;
  }

  await blobPut(STATE_KEY, JSON.stringify({ reported: nextReported, updatedAt: new Date().toISOString() } satisfies DriftState), {
    access: "private", token: TOKEN(), addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    totalDrift: drifts.length,
    newDrift: fresh.length,
    emailed,
    drifts: drifts.map(d => ({ netuid: d.netuid, chain: d.chain, ourBenchmark: d.benchmark, ourPage: d.page })),
  });
}
