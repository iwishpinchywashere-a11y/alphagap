import { NextRequest, NextResponse } from "next/server";
import { list, get } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  try {
    if (date) {
      // Fetch a specific report
      const result = await get(`reports/${date}.json`, {
        token: process.env.BLOB_READ_WRITE_TOKEN!,
        access: "private",
      });

      if (!result || !result.stream) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      const reader = result.stream.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const text = Buffer.concat(chunks).toString("utf-8");
      return NextResponse.json(JSON.parse(text));
    }

    // List all reports
    const { blobs } = await list({ prefix: "reports/", limit: 30 });
    const reports = blobs
      .map(b => {
        const dateMatch = b.pathname.match(/reports\/(\d{4}-\d{2}-\d{2})\.json/);
        return dateMatch ? { date: dateMatch[1], url: b.pathname, size: b.size, uploaded: b.uploadedAt } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b!.date.localeCompare(a!.date));

    return NextResponse.json({ reports });
  } catch (e) {
    const msg = String(e);
    if (msg.includes("BlobNotFound") || msg.includes("not_found")) {
      return NextResponse.json(date ? { error: "Report not found" } : { reports: [] }, { status: date ? 404 : 200 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
