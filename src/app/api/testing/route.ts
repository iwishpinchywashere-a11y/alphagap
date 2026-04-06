import { NextRequest, NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";

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
  blocklist: string[];
}

// ── Blob helpers — private access, same pattern as scan-latest.json ─────────

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
  // Use "private" access — same as how scan-latest.json is stored.
  // The store does not permit public blobs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await put(BLOB_NAME, JSON.stringify(data, null, 2), {
    access: "private" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

// ── GET — return tracked list ─────────────────────────────────────────────────

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  if (!token) return NextResponse.json({ tracked: [], blocklist: [] });
  const data = await readData(token);
  return NextResponse.json(data);
}

// ── POST — add a new pumper (or force-reset with _reset flag) ─────────────────

export async function POST(req: NextRequest) {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  if (!token) return NextResponse.json({ error: "no token" }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = await req.json() as any;

  // Secret reset: POST { _reset: true, _data: {...} } to force-write exact state
  if (body._reset === true && body._data) {
    try {
      await writeData(token, body._data as PumpTrackerData);
      return NextResponse.json({ ok: true, reset: true });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  const name: string | undefined = body.name;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const data = await readData(token);

  if (data.blocklist.some((b) => b.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: "blocklisted" }, { status: 409 });
  }

  const exists = data.tracked.some((p) => p.name.toLowerCase() === name.toLowerCase());
  if (exists) return NextResponse.json({ error: "already tracked" }, { status: 409 });

  const newEntry: TrackedPumper = {
    name,
    searchName: body.searchName || name.toLowerCase(),
    netuid: body.netuid ?? null,
    added_at: new Date().toISOString().split("T")[0],
    reason: body.reason || "manual add",
    pump_pct: body.pump_pct,
    pump_date: body.pump_date,
  };
  data.tracked.push(newEntry);
  try {
    await writeData(token, data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, entry: newEntry });
}

// ── DELETE — remove a pumper and blocklist it ─────────────────────────────────

export async function DELETE(req: NextRequest) {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  if (!token) return NextResponse.json({ error: "no token" }, { status: 500 });

  const { name } = await req.json() as { name: string };
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const data = await readData(token);
  const filtered = data.tracked.filter((p) => p.name.toLowerCase() !== name.toLowerCase());
  if (filtered.length === data.tracked.length) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  data.tracked = filtered;
  if (!data.blocklist.some((b) => b.toLowerCase() === name.toLowerCase())) {
    data.blocklist.push(name.toLowerCase());
  }

  try {
    await writeData(token, data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
