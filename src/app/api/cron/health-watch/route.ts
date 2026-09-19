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
 *
 * MARKET CHECKS (added 2026-09-19). The scan-age check above never fired in
 * any of the flat-chart incidents, because the scan kept running on time; it
 * was the DATA that was stale. "The scan ran" and "the prices are live" are
 * different claims, and only the first was being checked. So also:
 *   - market data not from a fresh chain read (scan-latest.marketHealth)
 *   - a replayed reading blocked by the scan's replay detector
 *   - TaoStats out of credits (dev activity, identities, trade counts degrade;
 *     prices do not, they come from the chain now)
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
  /** Per-issue alert timestamps for the market checks. */
  issues?: Record<string, string | null>;
}

interface MarketHealth {
  source: string; fresh: boolean; observedAt: string | null;
  recorded: boolean; replay: boolean; taoUsdSource: string;
  horizons: Record<string, boolean> | null;
}

const MARKET_STALE_MIN = 45;

export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scan = await readBlob<{
    lastScan?: string;
    marketHealth?: MarketHealth;
    taostats?: { lastSuccessAt: string | null; lastCreditErrorAt: string | null };
  }>("scan-latest.json");
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

  // ── Market data checks ───────────────────────────────────────────
  state.issues = state.issues ?? {};
  const issue = async (key: string, active: boolean, subject: string, lines: string[], recovered: string) => {
    const last = state.issues![key];
    if (active) {
      const since = last ? Date.now() - new Date(last).getTime() : Infinity;
      if (since > REALERT_HOURS * 3600_000) {
        await sendSystemAlertEmail(subject, lines).catch(err => console.error(`[health-watch] ${key} email failed:`, err));
        state.issues![key] = new Date().toISOString();
        emailed = emailed ? `${emailed}+${key}` : key;
      }
    } else if (last) {
      await sendSystemAlertEmail(recovered, ["No action needed."]).catch(() => {});
      state.issues![key] = null;
      emailed = emailed ? `${emailed}+${key}-recovered` : `${key}-recovered`;
    }
  };

  const mh = scan?.marketHealth;
  // Old scans (before this check existed) carry no marketHealth: say nothing.
  if (mh && !isStale) {
    const obsAgeMin = mh.observedAt ? Math.round((Date.now() - new Date(mh.observedAt).getTime()) / 60000) : Infinity;
    const marketStale = !mh.fresh || mh.source !== "chain" || obsAgeMin > MARKET_STALE_MIN;
    await issue("market", marketStale,
      "Subnet prices are NOT live - charts will not update",
      [
        `The scan is running, but its market data did not come from a fresh chain read.`,
        `Source: <strong style="color:#ffffff;">${mh.source}</strong>, fresh: <strong style="color:#f59e0b;">${mh.fresh}</strong>, block time ${mh.observedAt ?? "none"} (${Number.isFinite(obsAgeMin) ? obsAgeMin + " min ago" : "no reading"}).`,
        `While this lasts, prices are NOT written to chart history (by design, so charts show a gap instead of a fake flat line).`,
        `Likely cause: the Bittensor RPC (entrypoint-finney / archive.chain.opentensor.ai) is unreachable from Vercel. Check /api/scan logs for "[market]".`,
      ],
      "Subnet prices are live again");
    await issue("replay", mh.replay,
      "Replayed prices detected and blocked",
      [
        `The scan's replay detector found most subnet prices repeating values already recorded in the last 24 hours. Something upstream is serving a cached copy as live.`,
        `Those readings were NOT written to history. Check /api/scan logs for "PRICE REPLAY".`,
      ],
      "Price replay cleared");
  }

  const ts = scan?.taostats;
  const creditsOut = !!ts?.lastCreditErrorAt &&
    (!ts.lastSuccessAt || new Date(ts.lastCreditErrorAt) > new Date(ts.lastSuccessAt));
  await issue("taostats-credits", creditsOut,
    "TaoStats is OUT OF CREDITS",
    [
      `TaoStats is answering every call with "Insufficient credits".`,
      `<strong style="color:#ffffff;">Prices, market caps, emissions and charts are NOT affected</strong> (they come from the chain now).`,
      `Degraded until topped up: dev activity history, subnet identities (names/links), trade counts for whale scores, Fear &amp; Greed.`,
      `Top up at <a href="https://dash.taostats.io/billing" style="color:#10b981;">dash.taostats.io/billing</a>.`,
    ],
    "TaoStats credits restored");

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
    market: mh ?? null,
    taostatsCreditsOut: creditsOut,
    emailed,
  });
}
