import { NextRequest, NextResponse } from "next/server";
import { put, list as blobList, get as blobGet } from "@vercel/blob";

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

async function readData(token: string): Promise<PumpTrackerData> {
  try {
    const result = await blobGet(BLOB_NAME, { token, access: "private" });
    if (!result?.stream) return { tracked: [], blocklist: [] };
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const json = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    if (Array.isArray(json)) return { tracked: json, blocklist: [] };
    return { tracked: json.tracked ?? [], blocklist: json.blocklist ?? [] };
  } catch {
    return { tracked: [], blocklist: [] };
  }
}

async function writeData(token: string, data: PumpTrackerData) {
  await put(BLOB_NAME, JSON.stringify(data, null, 2), {
    access: "private" as never,
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
  const body = await req.json() as Partial<TrackedPumper>;
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
