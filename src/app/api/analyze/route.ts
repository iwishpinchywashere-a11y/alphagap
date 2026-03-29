import { NextResponse } from "next/server";
import { analyzePendingSignals } from "@/lib/analyzer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  try {
    const analyzed = await analyzePendingSignals();
    return NextResponse.json({ ok: true, analyzed });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  }
}
