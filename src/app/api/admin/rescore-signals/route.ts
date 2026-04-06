/**
 * POST /api/admin/rescore-signals
 *
 * Deletes all dev_spike, flow_inflection, flow_spike, and flow_warning signals
 * from the last 48h, then re-detects them with the current scoring formulas.
 * Does NOT touch social signals or signals older than 48h.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { detectFlowInflections, insertSignal, scoreDevQuality } from "@/lib/signals";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const db = getDb();

  // 1. Delete stale scored signals from last 48h
  const deleted = db.prepare(
    `DELETE FROM signals
     WHERE signal_type IN ('dev_spike', 'flow_inflection', 'flow_spike', 'flow_warning')
     AND created_at > datetime('now', '-48 hours')`
  ).run();

  // 2. Re-detect flow signals (detectFlowInflections uses current snapshot data)
  const flowSignals = detectFlowInflections();
  for (const sig of flowSignals) insertSignal(sig);

  // 3. Re-detect dev spikes over 48h window with quality scoring
  const rows = db.prepare(
    `SELECT repo, netuid, COUNT(*) as recent_events,
            (SELECT COUNT(*) FROM github_events ge2
             WHERE ge2.repo = ge.repo
             AND ge2.created_at > datetime('now', '-7 days')) as week_events
     FROM github_events ge
     WHERE created_at > datetime('now', '-48 hours')
     AND event_type IN ('PushEvent', 'PullRequestEvent', 'ReleaseEvent')
     GROUP BY repo
     HAVING recent_events > 3`
  ).all() as Array<{ repo: string; netuid: number; recent_events: number; week_events: number }>;

  let devInserted = 0;
  for (const row of rows) {
    const dailyAvg = row.week_events / 7;
    if (row.recent_events > dailyAvg * 2 || row.recent_events > 10) {
      const events = db.prepare(
        `SELECT title, event_type FROM github_events
         WHERE repo = ? AND created_at > datetime('now', '-48 hours')
         AND event_type IN ('PushEvent', 'PullRequestEvent', 'ReleaseEvent')
         LIMIT 30`
      ).all(row.repo) as Array<{ title: string; event_type: string }>;

      const qualityScore = scoreDevQuality(events);
      const qualityLabel =
        qualityScore >= 85 ? "Major launch / release" :
        qualityScore >= 70 ? "Significant feature shipped" :
        qualityScore >= 55 ? "Active development" :
        qualityScore >= 40 ? "Routine dev work" :
        "Minor / infra updates";

      insertSignal({
        netuid: row.netuid,
        signal_type: "dev_spike",
        strength: qualityScore,
        title: `${qualityLabel}: ${row.recent_events} events in 48h`,
        description: `${row.repo} — ${row.recent_events} events in 48h vs ${dailyAvg.toFixed(1)} daily avg. Top events: ${events.slice(0, 3).map(e => e.title).join(" · ")}`,
        source: "github",
        source_url: `https://github.com/${row.repo}`,
      });
      devInserted++;
    }
  }

  return NextResponse.json({
    ok: true,
    deleted: deleted.changes,
    flow_signals: flowSignals.length,
    dev_signals: devInserted,
  });
}
