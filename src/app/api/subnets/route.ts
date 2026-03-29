import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const netuid = req.nextUrl.searchParams.get("netuid");

  if (netuid) {
    const subnet = db.prepare("SELECT * FROM subnets WHERE netuid = ?").get(parseInt(netuid));
    const metrics = db
      .prepare(
        "SELECT * FROM subnet_metrics WHERE netuid = ? ORDER BY timestamp DESC LIMIT 48"
      )
      .all(parseInt(netuid));
    const githubEvents = db
      .prepare(
        "SELECT * FROM github_events WHERE netuid = ? ORDER BY created_at DESC LIMIT 20"
      )
      .all(parseInt(netuid));
    const hfItems = db
      .prepare(
        "SELECT * FROM huggingface_items WHERE netuid = ? ORDER BY detected_at DESC LIMIT 20"
      )
      .all(parseInt(netuid));

    return NextResponse.json({ subnet, metrics, githubEvents, hfItems });
  }

  const subnets = db
    .prepare(
      `SELECT s.*, m.alpha_price, m.market_cap, m.net_flow_24h, m.emission_pct
       FROM subnets s
       LEFT JOIN (
         SELECT sm.* FROM subnet_metrics sm
         INNER JOIN (
           SELECT netuid, MAX(timestamp) as max_ts FROM subnet_metrics GROUP BY netuid
         ) latest ON sm.netuid = latest.netuid AND sm.timestamp = latest.max_ts
       ) m ON s.netuid = m.netuid
       WHERE s.netuid > 0
       ORDER BY m.market_cap DESC NULLS LAST`
    )
    .all();

  return NextResponse.json({ subnets });
}
