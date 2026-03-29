import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("[cached-scan] No BLOB_READ_WRITE_TOKEN");
      return NextResponse.json({ cached: false, error: "no token" }, { status: 404 });
    }

    // List all blobs (no prefix filter to debug)
    const result = await list({ limit: 10 });
    console.log(`[cached-scan] Found ${result.blobs.length} blobs`);

    const scanBlob = result.blobs.find(b => b.pathname === "scan-latest.json");
    if (!scanBlob) {
      console.log("[cached-scan] scan-latest.json not found. Blobs:", result.blobs.map(b => b.pathname));
      return NextResponse.json({ cached: false }, { status: 404 });
    }

    console.log(`[cached-scan] Found blob: ${scanBlob.pathname}, size: ${scanBlob.size}, url: ${scanBlob.downloadUrl}`);

    // Fetch the blob content
    const res = await fetch(scanBlob.downloadUrl, { cache: "no-store" });
    if (!res.ok) {
      console.error(`[cached-scan] Failed to fetch blob content: ${res.status}`);
      return NextResponse.json({ cached: false }, { status: 404 });
    }

    const data = await res.json();
    console.log(`[cached-scan] Successfully loaded ${Object.keys(data).length} keys`);
    return NextResponse.json({ ...data, cached: true });
  } catch (e) {
    console.error("[cached-scan] Error:", e);
    return NextResponse.json({ cached: false, error: String(e) }, { status: 404 });
  }
}
