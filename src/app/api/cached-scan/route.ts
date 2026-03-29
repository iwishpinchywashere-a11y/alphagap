import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // List blobs to find scan-latest.json
    const { blobs } = await list({ prefix: "scan-latest.json", limit: 1 });
    if (!blobs || blobs.length === 0) {
      return NextResponse.json({ cached: false }, { status: 404 });
    }

    const blob = blobs[0];
    // Fetch the blob content via its download URL
    const res = await fetch(blob.downloadUrl, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ cached: false }, { status: 404 });
    }

    const data = await res.json();
    return NextResponse.json({ ...data, cached: true });
  } catch (e) {
    console.error("[cached-scan] Error:", e);
    return NextResponse.json({ cached: false, error: String(e) }, { status: 404 });
  }
}
