/**
 * GET /api/cron/health-watch
 *
 * Runs every 30 minutes via Vercel Cron. Zero TaoStats calls.
 *
 * Watches the data pipeline and emails the owner when it breaks, so a
 * stale dashboard can never go unnoticed for days again:
 *   - scan-latest.json older than STALE_AFTER_MIN → "scan pipeline stale"
 *     (the usual cause is TaoStats credits hitting 0)
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

  await blobPut(stateKey, JSON.stringify(state), {
    access: "private", token: TOKEN(),
    addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
  }).catch(() => {});

  return NextResponse.json({ ok: true, ageMin: Number.isFinite(ageMin) ? ageMin : null, isStale, emailed });
}
