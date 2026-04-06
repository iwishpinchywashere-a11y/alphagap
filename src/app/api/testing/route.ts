import { NextRequest, NextResponse } from "next/server";
import { put, list as blobList } from "@vercel/blob";

export const dynamic = "force-dynamic";

const BLOB_NAME = "pump-tracker.json";

export interface TrackedPumper {
  name: string;
  searchName?: string;
  netuid?: number | null;
  added_at: string;
  reason?: string;
  pump_pct?: number;
  pump_date?: string;
}

export interface PumpTrackerData {
  tracked: TrackedPumper[];
  blocklist: string[]; // names that were manually deleted — never auto-add again
}

// ── Blob helpers ──────────────────────────────────────────────────────────────
// Use blobList + public URL fetch pattern (same approach that worked before the
// access:"public" error — now works because we store the blob publicly).
// This avoids the blobGet caching issue where private reads return stale data.

async function readData(token: string): Promise<PumpTrackerData> {
  try {
    const { blobs } = await blobList({ token, prefix: BLOB_NAME });
    const blob = blobs.find((b) => b.pathname === BLOB_NAME);
    if (!blob) return { tracked: [], blocklist: [] };
    // Fetch with cache-busting so we always get the latest written version
    const res = await fetch(`${blob.url}?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return { tracked: [], blocklist: [] };
    const json = await res.json();
    if (Array.isArray(json)) return { tracked: json, blocklist: [] };
    return { tracked: json.tracked ?? [], blocklist: json.blocklist ?? [] };
  } catch {
    return { tracked: [], blocklist: [] };
  }
}

async function writeData(token: string, data: PumpTrackerData) {
  await put(BLOB_NAME, JSON.stringify(data, null, 2), {
    access: "public",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

// ── GET — return tracked list ─────────────────────────────────────────────────

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  const data = await readData(token);
  return NextResponse.json(data);
}

// ── POST — add a new pumper ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  const body = await req.json() as Partial<TrackedPumper> & { _reset?: boolean; _data?: PumpTrackerData };

  // Secret reset endpoint: POST with { _reset: true, _data: {...} } to force-write exact state
  if (body._reset && body._data) {
    await writeData(token, body._data);
    return NextResponse.json({ ok: true, reset: true });
  }

  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const data = await readData(token);

  // Don't add if blocklisted
  if (data.blocklist.some((b) => b.toLowerCase() === body.name!.toLowerCase())) {
    return NextResponse.json({ error: "blocklisted" }, { status: 409 });
  }

  const exists = data.tracked.some((p) => p.name.toLowerCase() === body.name!.toLowerCase());
  if (exists) return NextResponse.json({ error: "already tracked" }, { status: 409 });

  const newEntry: TrackedPumper = {
    name: body.name,
    searchName: body.searchName || body.name.toLowerCase(),
    netuid: body.netuid ?? null,
    added_at: new Date().toISOString().split("T")[0],
    reason: body.reason || "manual add",
    pump_pct: body.pump_pct,
    pump_date: body.pump_date,
  };
  data.tracked.push(newEntry);
  await writeData(token, data);
  return NextResponse.json({ ok: true, entry: newEntry });
}

// ── DELETE — remove a pumper and blocklist it so it can't be auto-added back ──

export async function DELETE(req: NextRequest) {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  const { name } = await req.json() as { name: string };
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const data = await readData(token);
  const filtered = data.tracked.filter((p) => p.name.toLowerCase() !== name.toLowerCase());
  if (filtered.length === data.tracked.length) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  data.tracked = filtered;
  // Add to blocklist so auto-detect never re-adds it
  if (!data.blocklist.some((b) => b.toLowerCase() === name.toLowerCase())) {
    data.blocklist.push(name.toLowerCase());
  }

  await writeData(token, data);
  return NextResponse.json({ ok: true });
}
