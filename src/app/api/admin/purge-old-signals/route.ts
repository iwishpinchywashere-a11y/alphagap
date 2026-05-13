/**
 * GET /api/admin/purge-old-signals
 *
 * One-shot (and safe to call repeatedly) admin endpoint that trims both
 * signals-history.json and flow-events.json to the last 3 days.
 *
 * Auth: ADMIN_SECRET header or ?secret= query param.
 */

import { NextRequest, NextResponse } from "next/server";
import { get as blobGet, put as blobPut } from "@vercel/blob";

export const dynamic = "force-dynamic";

const DAYS = 3;

function authOk(req: NextRequest): boolean {
  const secret = (process.env.ADMIN_SECRET || process.env.CRON_SECRET || "").trim();
  if (!secret) return true; // open in dev
  const header = req.headers.get("authorization") || "";
  const param  = req.nextUrl.searchParams.get("secret") || "";
  return header === `Bearer ${secret}` || param === secret;
}

async function readBlob<T>(name: string, token: string): Promise<T | null> {
  try {
    const b = await blobGet(name, { token, access: "private" });
    if (!b?.stream) return null;
    const reader = b.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch {
    return null;
  }
}

async function writeBlob(name: string, data: unknown, token: string): Promise<void> {
  await blobPut(name, JSON.stringify(data), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "No blob token" }, { status: 500 });
  }

  const cutoffIso  = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
  const cutoffDay  = cutoffIso.slice(0, 10); // "YYYY-MM-DD" — for dayKey comparisons

  const results: Record<string, { before: number; after: number }> = {};

  // ── 1. signals-history.json ──────────────────────────────────────
  type ScanSignal = { signal_date?: string; created_at: string; [k: string]: unknown };
  const signalHistory = await readBlob<ScanSignal[]>("signals-history.json", token);
  if (signalHistory) {
    const before = signalHistory.length;
    const pruned = signalHistory.filter(s => (s.signal_date || s.created_at) >= cutoffIso);
    await writeBlob("signals-history.json", pruned, token);
    results["signals-history.json"] = { before, after: pruned.length };
  } else {
    results["signals-history.json"] = { before: 0, after: 0 };
  }

  // ── 2. flow-events.json ──────────────────────────────────────────
  type FlowEvent = { dayKey: string; [k: string]: unknown };
  interface FlowStore { events: FlowEvent[]; updatedAt?: string }
  const flowStore = await readBlob<FlowStore>("flow-events.json", token);
  if (flowStore?.events) {
    const before = flowStore.events.length;
    const pruned = flowStore.events.filter(e => e.dayKey >= cutoffDay);
    await writeBlob("flow-events.json", { ...flowStore, events: pruned, updatedAt: new Date().toISOString() }, token);
    results["flow-events.json"] = { before, after: pruned.length };
  } else {
    results["flow-events.json"] = { before: 0, after: 0 };
  }

  return NextResponse.json({
    ok: true,
    cutoff: { iso: cutoffIso, day: cutoffDay },
    results,
    deletedTotal: Object.values(results).reduce((s, r) => s + (r.before - r.after), 0),
  });
}
