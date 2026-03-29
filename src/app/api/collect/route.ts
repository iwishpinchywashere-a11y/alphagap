import { NextResponse } from "next/server";
import { collectAll } from "@/lib/collectors";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Local dev: calls all collectors sequentially in one request
// On Vercel, use the individual endpoints instead (each under 60s)
export async function POST() {
  try {
    const result = await collectAll();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to this endpoint to trigger data collection. On Vercel, use individual endpoints: /api/collect/taostats, /api/collect/github, etc.",
  });
}
