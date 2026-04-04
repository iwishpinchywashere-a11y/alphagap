import { NextRequest, NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";

export const dynamic = "force-dynamic";

const BLOB_NAME = "pump-tracker.json";

export interface TrackedPumper {
  name: string;          // display name
  searchName?: string;   // search fragment (if different from name)
  netuid?: number | null;
  added_at: string;
  reason?: string;
  pump_pct?: number;     // detected 7D pump % when added
  pump_date?: string;    // approximate date of pump peak
}

const DEFAULTS: TrackedPumper[] = [
  { name: "Beam",             searchName: "beam",    added_at: "2026-04-03", reason: "7D price pump" },
  { name: "Djinn",            searchName: "djinn",   added_at: "2026-04-03", reason: "7D price pump" },
  { name: "404 GEN",          searchName: "404",     added_at: "2026-04-03", reason: "7D price pump" },
  { name: "Tau",              searchName: "tau",     added_at: "2026-04-03", reason: "7D price pump" },
  { name: "Vidaio",           searchName: "vidaio",  added_at: "2026-04-03", reason: "7D price pump" },
];

async function readTracker(token: string): Promise<TrackedPumper[]> {
  try {
    const result = await blobGet(BLOB_NAME, { token, access: "private" });
    if (!result?.stream) return DEFAULTS;
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as TrackedPumper[];
    // Merge any missing defaults
    const existing = new Set(parsed.map((p) => p.name.toLowerCase()));
    const merged = [...parsed];
    for (const d of DEFAULTS) {
      if (!existing.has(d.name.toLowerCase())) merged.push(d);
    }
    return merged;
  } catch {
    return DEFAULTS;
  }
}

async function writeTracker(token: string, list: TrackedPumper[]) {
  await put(BLOB_NAME, JSON.stringify(list, null, 2), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

// GET — return the tracked list
export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  const list = await readTracker(token);
  return NextResponse.json({ tracked: list });
}

// POST — add a new pumper
export async function POST(req: NextRequest) {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  const body = await req.json() as Partial<TrackedPumper>;
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const list = await readTracker(token);
  const exists = list.some((p) => p.name.toLowerCase() === body.name!.toLowerCase());
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
  list.push(newEntry);
  await writeTracker(token, list);
  return NextResponse.json({ ok: true, entry: newEntry });
}

// DELETE — remove a pumper by name
export async function DELETE(req: NextRequest) {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  const { name } = await req.json() as { name: string };
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const list = await readTracker(token);
  const filtered = list.filter((p) => p.name.toLowerCase() !== name.toLowerCase());
  if (filtered.length === list.length) return NextResponse.json({ error: "not found" }, { status: 404 });

  await writeTracker(token, filtered);
  return NextResponse.json({ ok: true });
}
