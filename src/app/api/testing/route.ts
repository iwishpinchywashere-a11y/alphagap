import { NextRequest, NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";

export const dynamic = "force-dynamic";

const TRACKER_BLOB  = "pump-tracker.json";
const CACHE_BLOB    = "pump-autopsies-cache.json";

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

// Stored autopsy result — everything the page needs to render, no refetch required
export interface CachedAutopsy {
  pumpEvent:  unknown | null;   // PumpEvent — keep as unknown to avoid cross-file type issues
  findings:   unknown[];        // SignalFinding[]
  narrative:  string;
  research:   unknown | null;   // ResearchResult
  cachedAt:   string;
}

export type AutopsyCache = Record<string, CachedAutopsy>; // key = pumper.name

// ── Blob helpers ──────────────────────────────────────────────────────────────

const token = () => process.env.BLOB_READ_WRITE_TOKEN || "";

async function readBlob<T>(name: string, fallback: T): Promise<T> {
  try {
    const result = await blobGet(name, { token: token(), access: "private" });
    if (!result?.stream) return fallback;
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch {
    return fallback;
  }
}

async function writeBlob(name: string, data: unknown) {
  await put(name, JSON.stringify(data, null, 2), {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    access: "private" as any,
    token: token(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

function parseTrackerData(json: unknown): PumpTrackerData {
  if (Array.isArray(json)) return { tracked: json as TrackedPumper[], blocklist: [] };
  const j = json as Record<string, unknown>;
  return {
    tracked:   (j.tracked   as TrackedPumper[] | undefined) ?? [],
    blocklist: (j.blocklist as string[]        | undefined) ?? [],
  };
}

// ── GET — return tracked list + full autopsy cache ────────────────────────────

export async function GET() {
  if (!token()) return NextResponse.json({ tracked: [], blocklist: [], cache: {} });

  const [raw, cache] = await Promise.all([
    readBlob<unknown>(TRACKER_BLOB, { tracked: [], blocklist: [] }),
    readBlob<AutopsyCache>(CACHE_BLOB, {}),
  ]);

  const data = parseTrackerData(raw);
  return NextResponse.json({ ...data, cache });
}

// ── POST — add new pumper ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!token()) return NextResponse.json({ error: "no token" }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = await req.json() as any;

  // Secret force-reset
  if (body._reset === true && body._data) {
    try {
      await writeBlob(TRACKER_BLOB, body._data as PumpTrackerData);
      return NextResponse.json({ ok: true, reset: true });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  const name: string | undefined = body.name;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const raw = await readBlob<unknown>(TRACKER_BLOB, { tracked: [], blocklist: [] });
  const data = parseTrackerData(raw);

  if (data.blocklist.some((b) => b.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: "blocklisted" }, { status: 409 });
  }
  if (data.tracked.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: "already tracked" }, { status: 409 });
  }

  const newEntry: TrackedPumper = {
    name,
    searchName: body.searchName || name.toLowerCase(),
    netuid:     body.netuid ?? null,
    added_at:   new Date().toISOString().split("T")[0],
    reason:     body.reason || "manual add",
    pump_pct:   body.pump_pct,
    pump_date:  body.pump_date,
  };
  data.tracked.push(newEntry);

  try {
    await writeBlob(TRACKER_BLOB, data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, entry: newEntry });
}

// ── PATCH — save computed autopsy to cache ────────────────────────────────────

export async function PATCH(req: NextRequest) {
  if (!token()) return NextResponse.json({ error: "no token" }, { status: 500 });

  const body = await req.json() as { name: string; autopsy: CachedAutopsy };
  if (!body.name || !body.autopsy) {
    return NextResponse.json({ error: "name + autopsy required" }, { status: 400 });
  }

  const cache = await readBlob<AutopsyCache>(CACHE_BLOB, {});
  cache[body.name] = { ...body.autopsy, cachedAt: new Date().toISOString() };

  try {
    await writeBlob(CACHE_BLOB, cache);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// ── DELETE — remove pumper + blocklist + clear cache entry ───────────────────

export async function DELETE(req: NextRequest) {
  if (!token()) return NextResponse.json({ error: "no token" }, { status: 500 });

  const { name } = await req.json() as { name: string };
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const [raw, cache] = await Promise.all([
    readBlob<unknown>(TRACKER_BLOB, { tracked: [], blocklist: [] }),
    readBlob<AutopsyCache>(CACHE_BLOB, {}),
  ]);

  const data = parseTrackerData(raw);
  const filtered = data.tracked.filter((p) => p.name.toLowerCase() !== name.toLowerCase());
  if (filtered.length === data.tracked.length) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  data.tracked = filtered;
  if (!data.blocklist.some((b) => b.toLowerCase() === name.toLowerCase())) {
    data.blocklist.push(name.toLowerCase());
  }

  // Remove from cache too
  const cacheKey = Object.keys(cache).find(k => k.toLowerCase() === name.toLowerCase());
  if (cacheKey) delete cache[cacheKey];

  try {
    await Promise.all([
      writeBlob(TRACKER_BLOB, data),
      writeBlob(CACHE_BLOB, cache),
    ]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
