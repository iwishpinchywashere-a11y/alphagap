import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// This endpoint is called periodically to follow subnet accounts in small batches
// Twitter allows ~15 follows per 15 minutes
export async function POST() {
  return NextResponse.json({
    message: "Use the Chrome browser to follow accounts — rate limit is per-session. Try again in 15 minutes.",
    tip: "Run the follow script in the browser console after the rate limit resets.",
  });
}

export async function GET() {
  return NextResponse.json({
    message: "POST to trigger a follow batch. Rate limit: ~15 follows per 15 minutes.",
  });
}
