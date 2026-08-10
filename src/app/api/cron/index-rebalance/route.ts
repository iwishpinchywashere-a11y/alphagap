/**
 * GET /api/cron/index-rebalance
 *
 * Scheduled daily at 12:00 UTC. Only rebalances when:
 *   - It's Sunday (UTC), OR
 *   - Last rebalance was >5 days ago (catches missed Sunday runs).
 *
 * 1. Reads scan-latest.json from Vercel Blob
 * 2. Takes the top 10 subnets by invest_agap score
 * 3. Normalises scores to integer weights summing to exactly 100
 * 4. PATCHes the AlphaGap Index strategy on TrustedStake
 * 5. Triggers a rebalance via TrustedStake API
 * 6. Writes index-rebalance-latest.json to Vercel Blob for display on /alphagapindex
 *
 * Also callable manually via POST /api/admin/trigger-index-rebalance
 * (see that route for admin-only manual trigger — always runs regardless of day).
 */

import { NextRequest, NextResponse } from "next/server";
import { get as blobGet, put } from "@vercel/blob";
import { buildWeights, updateStrategyWeights, triggerRebalance, getStrategy, type IndexHolding } from "@/lib/trustedstake";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
const REBALANCE_INTERVAL_DAYS = 5; // catch-up: rebalance if last run was >5 days ago
const MIN_INTERVAL_DAYS = 2;       // floor: never rebalance twice within 2 days
// Vercel crons are best-effort, not to-the-second, and `rebalancedAt` is stamped
// when the handler starts rather than when the cron fires. Both push the recorded
// time a little PAST the hour, so a run exactly N days later measures fractionally
// under N and trips the floor.
//
// That is not hypothetical. The Aug 7 run recorded 12:01:12; the Sunday Aug 9 cron
// fired at 12:00:00 and measured 1.9992 days, so it was skipped as "too soon" —
// blocked by 71 seconds. Worse, it cascades: the next run then lands mid-week on
// the overdue rule, which pushes the following Sunday inside the floor as well,
// and the schedule walks off Sunday permanently. A user reported exactly this as
// "no automatic rebalance for the past week".
const INTERVAL_JITTER_DAYS = 0.25; // 6h grace — absorbs cron jitter, still blocks same-day double runs

interface LeaderboardEntry {
  netuid: number;
  name: string;
  invest_agap?: number;
  composite_score?: number;
  market_cap?: number;
  alpha_price?: number;
  emission_pct?: number;
  category?: string;
}

async function getLastRebalancedAt(): Promise<Date | null> {
  try {
    const blob = await blobGet("index-rebalance-latest.json", { token: BLOB_TOKEN, access: "private" });
    if (!blob?.stream) return null;
    const reader = blob.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    return data.rebalancedAt ? new Date(data.rebalancedAt) : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  // ── Auth: Vercel cron header or CRON_SECRET bearer ───────────────
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const cronSecret = process.env.CRON_SECRET;
  if (!isVercelCron) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // ── Guard: only rebalance on Sunday or if overdue ────────────────
  //
  // This runs for EVERY scheduled invocation, however it authenticated. It used
  // to be nested inside `if (isVercelCron)`, so any invocation that didn't
  // carry `x-vercel-cron: 1` skipped the guard entirely and rebalanced — which
  // is what actually happened: the index was rebalancing daily at 12:00 UTC
  // instead of weekly, paying trading fees and slippage on members' funds every
  // day. Manual runs bypass this by calling runRebalance() directly (see
  // /api/admin/trigger-index-rebalance).
  const now = new Date();
  const isSunday = now.getUTCDay() === 0;
  const lastRun = await getLastRebalancedAt();
  const daysSinceLast = lastRun
    ? (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60 * 24)
    : null;

  // Hard floor: never rebalance twice in quick succession, even on a Sunday.
  if (daysSinceLast !== null && daysSinceLast < MIN_INTERVAL_DAYS - INTERVAL_JITTER_DAYS) {
    console.log(`[index-rebalance] Skipping — last run was only ${daysSinceLast.toFixed(3)}d ago`);
    return NextResponse.json({ skipped: true, reason: "too soon", daysSinceLast });
  }

  // A null daysSinceLast means we could not read the last run. Treat that as
  // "unknown", NOT as "overdue" — the old Infinity default turned an unreadable
  // blob into a daily rebalance. Unknown falls back to the Sunday rule.
  const isOverdue = daysSinceLast !== null && daysSinceLast > REBALANCE_INTERVAL_DAYS;

  if (!isSunday && !isOverdue) {
    console.log(`[index-rebalance] Skipping — not Sunday (last run ${daysSinceLast?.toFixed(1) ?? "unknown"}d ago)`);
    return NextResponse.json({ skipped: true, reason: "not Sunday", daysSinceLast });
  }

  console.log(`[index-rebalance] Running — isSunday=${isSunday}, daysSinceLast=${daysSinceLast?.toFixed(1) ?? "unknown"}`);
  return runRebalance();
}

export async function runRebalance(): Promise<NextResponse> {
  const startedAt = new Date().toISOString();
  console.log("[index-rebalance] Starting weekly rebalance...");

  // ── 1. Read scan-latest.json ─────────────────────────────────────
  let leaderboard: LeaderboardEntry[] = [];
  try {
    const blob = await blobGet("scan-latest.json", { token: BLOB_TOKEN, access: "private" });
    if (!blob?.stream) throw new Error("scan-latest.json blob has no stream");
    const reader = blob.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    leaderboard = parsed.leaderboard ?? [];
    console.log(`[index-rebalance] Loaded leaderboard: ${leaderboard.length} subnets`);
  } catch (e) {
    const msg = `Failed to read scan-latest.json: ${e}`;
    console.error(`[index-rebalance] ${msg}`);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  // ── 2. Select top 10 by invest_agap ─────────────────────────────
  const top10 = [...leaderboard]
    .filter(s => (s.invest_agap ?? 0) > 0)
    .sort((a, b) => (b.invest_agap ?? 0) - (a.invest_agap ?? 0))
    .slice(0, 10);

  if (top10.length < 5) {
    const msg = `Too few investable subnets (${top10.length}) — aborting to avoid bad rebalance`;
    console.error(`[index-rebalance] ${msg}`);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  console.log(`[index-rebalance] Top ${top10.length} subnets by invest_agap:`, top10.map(s => `SN${s.netuid}(${s.invest_agap})`).join(", "));

  // ── 3. Normalise to integer weights summing to 100 ───────────────
  let weights: Record<string, number>;
  let holdings: IndexHolding[];
  try {
    ({ weights, holdings } = buildWeights(
      top10.map(s => ({ netuid: s.netuid, name: s.name, invest_agap: s.invest_agap! }))
    ));
    console.log("[index-rebalance] Weights:", JSON.stringify(weights));
    console.log("[index-rebalance] Sum:", Object.values(weights).reduce((a, b) => a + b, 0));
  } catch (e) {
    const msg = `Weight normalisation failed: ${e}`;
    console.error(`[index-rebalance] ${msg}`);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  // ── 4 & 5. Push to TrustedStake ─────────────────────────────────
  let rebalanceResult: { queued: boolean; message: string } | null = null;
  let trustedStakeError: string | null = null;
  let stuckWarning: string | null = null;

  // A rebalance we queue can sit in TrustedStake's isRebalancing state without
  // ever executing. That is what happened on Aug 7: queued successfully, still
  // isRebalancing 79 hours later, no transactions produced — and because
  // triggerRebalance only confirms the QUEUE accepted it, we recorded
  // success:true and the page told members it had rebalanced. Check the real
  // state so a stuck run is visible instead of being reported as a success.
  try {
    const pre = await getStrategy();
    if (pre.isRebalancing && pre.lastRebalanceStartedAt) {
      const stuckHours = (Date.now() - new Date(pre.lastRebalanceStartedAt).getTime()) / 3600000;
      if (stuckHours > 6) {
        stuckWarning =
          `TrustedStake has been isRebalancing for ${stuckHours.toFixed(1)}h ` +
          `(since ${pre.lastRebalanceStartedAt}) — the previous rebalance never completed.`;
        console.error(`[index-rebalance] *** STUCK *** ${stuckWarning}`);
      }
    }
  } catch (e) {
    console.warn("[index-rebalance] Could not read strategy state:", e);
  }

  try {
    await updateStrategyWeights(weights, {
      description: `AlphaGap Subnet Index - Top 10 by aGap Investing Score. Rebalanced ${new Date().toDateString()}.`,
    });
    console.log("[index-rebalance] ✓ Weights pushed to TrustedStake");

    rebalanceResult = await triggerRebalance();
    console.log("[index-rebalance] ✓ Rebalance queued:", rebalanceResult.message);
  } catch (e) {
    trustedStakeError = String(e);
    console.error("[index-rebalance] TrustedStake error:", trustedStakeError);
    // Don't abort — still save the computed holdings to blob so the page reflects intent
  }

  // ── 6. Write index-rebalance-latest.json ────────────────────────
  const output = {
    rebalancedAt: startedAt,
    // Success means the queue accepted it, NOT that it executed. When the
    // previous run is still stuck, say so rather than showing a clean tick.
    success: trustedStakeError === null && stuckWarning === null,
    queuedOnly: trustedStakeError === null && stuckWarning !== null,
    stuckWarning: stuckWarning ?? undefined,
    trustedStakeError: trustedStakeError ?? undefined,
    rebalanceMessage: rebalanceResult?.message ?? undefined,
    holdingCount: holdings.length,
    holdings,
    weights,
  };

  try {
    await put("index-rebalance-latest.json", JSON.stringify(output), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      token: BLOB_TOKEN,
      contentType: "application/json",
    });
    console.log("[index-rebalance] ✓ index-rebalance-latest.json saved");
  } catch (e) {
    console.error("[index-rebalance] Failed to save blob:", e);
  }

  return NextResponse.json({
    success: trustedStakeError === null,
    rebalancedAt: startedAt,
    holdings,
    trustedStakeError: trustedStakeError ?? undefined,
  });
}
