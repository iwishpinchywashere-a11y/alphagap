import { NextResponse } from "next/server";
import { computeLeaderboard } from "@/lib/signals";

export const dynamic = "force-dynamic";

export async function GET() {
  const leaderboard = computeLeaderboard();
  return NextResponse.json({ leaderboard });
}
