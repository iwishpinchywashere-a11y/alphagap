/**
 * GET /api/cron/health-watch
 *
 * Runs every 30 minutes via Vercel Cron. Zero TaoStats calls.
 *
 * Watches the data pipeline and emails the owner when it breaks, so a
 * stale dashboard can never go unnoticed for days again:
 *   - scan-latest.json older than STALE_AFTER_MIN → "scan pipeline stale"
 *     (the usual cause is TaoStats credits hitting 0)
 *   - index-rebalance-latest.json older than REBALANCE_STALE_DAYS → "index not
 *     rebalancing" (the strategy is MANUAL_ONLY, so our cron is the only trigger)
 *   - re-alerts at most every REALERT_HOURS while the condition persists
 *   - sends a one-time "recovered" email when freshness returns
 */

import { NextRequest, NextResponse } from "next/server";
import { get as blobGet, put as blobPut } from "@vercel/blob";
import { sendSystemAlertEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const STALE_AFTER_MIN = 45; // scan cron runs every 10 min — 45 min means several consecutive failures
const REALERT_HOURS = 6;
// Index rebalance: the cron self-heals via a 5-day catch-up, so only alarm well
// past that — >9 days means the Sunday run AND the catch-up both failed.
const REBALANCE_STALE_DAYS = 9;
const REBALANCE_REALERT_HOURS = 24;

const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN || "";

async function readBlob<T>(name: string): Promise<T | null> {
  try {
    const result = await blobGet(name, { token: TOKEN(), access: "private", abortSignal: AbortSignal.timeout(8000) });
    if (!result?.stream) return null;
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch { return null; }
}

interface HealthState {
  alerting: boolean;
  lastAlertAt: string | null;
  lastRebalanceAlertAt?: string | null;
}

export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scan = await readBlob<{ lastScan?: string }>("scan-latest.json");
  const lastScan = scan?.lastScan ? new Date(scan.lastScan).getTime() : 0;
  const ageMin = lastScan ? Math.round((Date.now() - lastScan) / 60000) : Infinity;
  const isStale = ageMin > STALE_AFTER_MIN;

  const stateKey = "health-watch-state.json";
  const state = (await readBlob<HealthState>(stateKey)) ?? { alerting: false, lastAlertAt: null };
  let emailed: string | null = null;

  if (isStale) {
    const sinceLastAlert = state.lastAlertAt ? Date.now() - new Date(state.lastAlertAt).getTime() : Infinity;
    if (sinceLastAlert > REALERT_HOURS * 3600_000) {
      const ageLabel = Number.isFinite(ageMin) ? `${Math.floor(ageMin / 60)}h ${ageMin % 60}m` : "unknown (no scan blob)";
      await sendSystemAlertEmail("Scan pipeline is STALE — dashboard data frozen", [
        `The last successful scan was <strong style="color:#f59e0b;">${ageLabel} ago</strong> (${scan?.lastScan ?? "never"}).`,
        `Prices, scores, and signals on alphagap.io are frozen until the scan succeeds.`,
        `Most common cause: <strong style="color:#ffffff;">TaoStats credits at 0</strong> — check <a href="https://dash.taostats.io/billing" style="color:#10b981;">dash.taostats.io/billing</a>.`,
        `Also check the Vercel cron logs for /api/scan.`,
      ]).catch(err => console.error("[health-watch] email failed:", err));
      state.alerting = true;
      state.lastAlertAt = new Date().toISOString();
      emailed = "stale";
    }
  } else if (state.alerting) {
    await sendSystemAlertEmail("Scan pipeline RECOVERED", [
      `Fresh scan data is flowing again — last scan ${ageMin} minutes ago.`,
      `No action needed.`,
    ]).catch(err => console.error("[health-watch] email failed:", err));
    state.alerting = false;
    state.lastAlertAt = null;
    emailed = "recovered";
  }

  // ── Index rebalance staleness ────────────────────────────────────
  //
  // The strategy is set to MANUAL_ONLY on TrustedStake, so their engine never
  // rebalances on its own — /api/cron/index-rebalance is the ONLY thing that
  // triggers it. If that cron dies, the index silently stops tracking the
  // leaderboard with nothing to indicate it. This is the alarm for that.
  //
  // The cron self-heals via its own 5-day catch-up, so only alert well past
  // that: >9 days means both the Sunday run and the catch-up have failed.
  const reb = await readBlob<{ rebalancedAt?: string }>("index-rebalance-latest.json");
  const lastReb = reb?.rebalancedAt ? new Date(reb.rebalancedAt).getTime() : 0;
  const rebDays = lastReb ? (Date.now() - lastReb) / 86_400_000 : Infinity;
  const rebStale = rebDays > REBALANCE_STALE_DAYS;

  if (rebStale) {
    const since = state.lastRebalanceAlertAt ? Date.now() - new Date(state.lastRebalanceAlertAt).getTime() : Infinity;
    if (since > REBALANCE_REALERT_HOURS * 3600_000) {
      const label = Number.isFinite(rebDays) ? `${rebDays.toFixed(1)} days` : "unknown (no rebalance blob)";
      await sendSystemAlertEmail("AlphaGap Index has NOT rebalanced", [
        `The last index rebalance was <strong style="color:#f59e0b;">${label} ago</strong> (${reb?.rebalancedAt ?? "never"}).`,
        `The strategy is set to <strong style="color:#ffffff;">MANUAL_ONLY</strong> on TrustedStake, so nothing rebalances it except our own cron — the index is drifting from the Investing leaderboard until this is fixed.`,
        `Check the Vercel cron logs for <strong style="color:#ffffff;">/api/cron/index-rebalance</strong> (runs 12:00 UTC, acts on Sundays).`,
        `To rebalance immediately, POST /api/admin/trigger-index-rebalance.`,
      ]).catch(err => console.error("[health-watch] rebalance email failed:", err));
      state.lastRebalanceAlertAt = new Date().toISOString();
      emailed = emailed ? `${emailed}+rebalance` : "rebalance";
    }
  } else if (state.lastRebalanceAlertAt) {
    state.lastRebalanceAlertAt = null; // recovered — arm the alert again
  }

  await blobPut(stateKey, JSON.stringify(state), {
    access: "private", token: TOKEN(),
    addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    ageMin: Number.isFinite(ageMin) ? ageMin : null,
    isStale,
    rebalanceDays: Number.isFinite(rebDays) ? Number(rebDays.toFixed(2)) : null,
    rebStale,
    emailed,
  });
}
