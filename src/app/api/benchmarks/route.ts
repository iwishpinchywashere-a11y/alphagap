import { NextResponse } from "next/server";
import { BENCHMARK_DATA } from "@/lib/benchmarks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    benchmarks: BENCHMARK_DATA,
    total: BENCHMARK_DATA.length,
    generated_at: new Date().toISOString(),
  });
}
