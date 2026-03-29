import { NextResponse } from "next/server";
import { collectAll, collectAllFast } from "@/lib/collectors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    // On Vercel, use the fast version that fits in 60s
    // Locally, use the full version with direct GitHub polling
    const isVercel = !!process.env.VERCEL;
    const result = isVercel ? await collectAllFast() : await collectAll();
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
    message: "POST to this endpoint to trigger data collection",
  });
}
