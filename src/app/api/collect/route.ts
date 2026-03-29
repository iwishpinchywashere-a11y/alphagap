import { NextResponse } from "next/server";
import { collectAll } from "@/lib/collectors";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
    message: "POST to this endpoint to trigger data collection",
  });
}
