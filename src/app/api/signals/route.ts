import { NextRequest, NextResponse } from "next/server";
import { getRecentSignals, getSubnetSignals } from "@/lib/signals";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const netuid = req.nextUrl.searchParams.get("netuid");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");

  const signals = netuid
    ? getSubnetSignals(parseInt(netuid), limit)
    : getRecentSignals(limit);

  return NextResponse.json({ signals });
}
