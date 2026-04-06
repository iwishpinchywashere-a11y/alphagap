// Auto-detect pump lab additions — called by the main scan cron after each run.
// Checks the fresh leaderboard for any subnet with >30% 7D gain not yet tracked.
// Respects the blocklist — manually-deleted entries are never re-added.

import { NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BLOB_NAME = "pump-tracker.json";
const PUMP_THRESHOLD = 20; // % 7D gain to trigger auto-add

interface TrackedPumper {
  name: string;
  searchName?: string;
  netuid?: number | null;
  added_at: string;
  reason?: string;
  pump_pct?: number;
}

interface PumpTrackerData {
  tracked: TrackedPumper[];
  blocklist: string[];
}

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

// scan-latest.json is private — use blobGet with stream reader
async function readScanLatest(token: string): Promise<{ leaderboard?: Array<{ netuid: number; name: string; price_change_7d?: number }> }> {
  try {
    const result = await blobGet("scan-latest.json", { token, access: "private" });
    if (!result?.stream) return {};
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    return {};
  }
}

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  if (!token) return NextResponse.json({ error: "no blob token" }, { status: 500 });

  const [data, scan] = await Promise.all([
    readData(token),
    readScanLatest(token),
  ]);

  const leaderboard = scan.leaderboard ?? [];
  if (leaderboard.length === 0) {
    return NextResponse.json({ added: [], skipped: "no leaderboard data" });
  }

  const blocklist = new Set(data.blocklist.map((b) => b.toLowerCase()));
  const trackedNetuids = new Set(data.tracked.map((t) => t.netuid).filter(Boolean));
  const trackedNames = new Set(data.tracked.map((t) => (t.searchName || t.name).toLowerCase()));

  const toAdd = leaderboard.filter((s) => {
    if ((s.price_change_7d ?? 0) < PUMP_THRESHOLD) return false;
    if (blocklist.has(s.name.toLowerCase())) return false;  // respect manual deletes
    if (trackedNetuids.has(s.netuid)) return false;
    if (trackedNames.has(s.name.toLowerCase())) return false;
    if (data.tracked.some((t) =>
      s.name.toLowerCase().includes((t.searchName || t.name).toLowerCase()) ||
      (t.searchName || t.name).toLowerCase().includes(s.name.toLowerCase())
    )) return false;
    return true;
  });

  if (toAdd.length === 0) {
    return NextResponse.json({ added: [], message: "no new pumpers to add" });
  }

  const added: TrackedPumper[] = [];
  for (const sub of toAdd.slice(0, 10)) {
    const entry: TrackedPumper = {
      name: sub.name,
      searchName: sub.name.toLowerCase(),
      netuid: sub.netuid,
      added_at: new Date().toISOString().split("T")[0],
      reason: `Auto-detected: +${(sub.price_change_7d ?? 0).toFixed(0)}% 7D gain`,
      pump_pct: sub.price_change_7d ?? 0,
    };
    data.tracked.push(entry);
    trackedNetuids.add(sub.netuid);
    trackedNames.add(sub.name.toLowerCase());
    added.push(entry);
    console.log(`[pump-auto-detect] Added ${sub.name} SN${sub.netuid} (+${(sub.price_change_7d ?? 0).toFixed(0)}% 7D)`);
  }

  await writeData(token, data);

  return NextResponse.json({
    added: added.map((e) => ({ name: e.name, netuid: e.netuid, pump_pct: e.pump_pct })),
    totalTracked: data.tracked.length,
  });
}
