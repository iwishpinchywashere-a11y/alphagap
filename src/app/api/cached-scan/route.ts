import { NextResponse } from "next/server";
import { get } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ cached: false, error: "no token" }, { status: 404 });
    }

    // Use @vercel/blob get() to read private blob by pathname
    const blob = await get("scan-latest.json", {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    if (!blob || !blob.body) {
      return NextResponse.json({ cached: false }, { status: 404 });
    }

    // Read the response body as text then parse
    const text = await blob.text();
    const data = JSON.parse(text);

    return NextResponse.json({ ...data, cached: true });
  } catch (e) {
    const msg = String(e);
    // BlobNotFoundError means no cache exists yet
    if (msg.includes("BlobNotFound") || msg.includes("not_found")) {
      return NextResponse.json({ cached: false }, { status: 404 });
    }
    console.error("[cached-scan] Error:", e);
    return NextResponse.json({ cached: false, error: msg }, { status: 404 });
  }
}
