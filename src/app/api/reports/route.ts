import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";

export const dynamic = "force-dynamic";

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN!;

async function readBlob(pathname: string): Promise<unknown | null> {
  try {
    const result = await get(pathname, { token: TOKEN, access: "private" });
    if (!result?.stream) return null;
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  try {
    if (date) {
      const data = await readBlob(`reports/${date}.json`);
      if (!data) return NextResponse.json({ error: "Report not found" }, { status: 404 });
      return NextResponse.json(data);
    }

    // ── List: read report-index.json (one call, all dates) ────────────
    // Index format: { "YYYY-MM-DD": netuid } (old) or { "YYYY-MM-DD": { netuid, subnet_name, composite_score } } (new)
    const indexData = await readBlob("report-index.json") as Record<string, unknown> | null;

    if (!indexData || Object.keys(indexData).length === 0) {
      return NextResponse.json({ reports: [] });
    }

    // Sort dates newest-first
    const dates = Object.keys(indexData).sort((a, b) => b.localeCompare(a));

    // Separate dates into those with rich metadata (new format) vs just netuid (old format)
    const richEntries: { date: string; netuid: number; subnet_name: string; composite_score: number }[] = [];
    const legacyDates: string[] = [];

    for (const d of dates) {
      const entry = indexData[d];
      if (entry && typeof entry === "object") {
        const e = entry as { netuid: number; subnet_name?: string; composite_score?: number };
        richEntries.push({ date: d, netuid: e.netuid, subnet_name: e.subnet_name ?? `SN${e.netuid}`, composite_score: e.composite_score ?? 0 });
      } else if (typeof entry === "number") {
        legacyDates.push(d);
      }
    }

    // Fetch metadata for legacy entries (old format had only netuid) — parallel but capped
    const LEGACY_LIMIT = 60; // don't fetch more than this many old files per request
    const legacyToFetch = legacyDates.slice(0, LEGACY_LIMIT);
    const legacyResults = await Promise.all(
      legacyToFetch.map(async (d) => {
        const data = await readBlob(`reports/${d}.json`) as Record<string, unknown> | null;
        if (!data) return { date: d, netuid: indexData[d] as number };
        const { content: _content, ...meta } = data as { content?: unknown } & Record<string, unknown>;
        return meta as { date: string; netuid: number; subnet_name?: string; composite_score?: number };
      })
    );

    // Merge and sort newest-first
    const allReports = [...richEntries, ...legacyResults]
      .sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({ reports: allReports });
  } catch (e) {
    const msg = String(e);
    if (msg.includes("BlobNotFound") || msg.includes("not_found")) {
      return NextResponse.json(date ? { error: "Report not found" } : { reports: [] }, { status: date ? 404 : 200 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
