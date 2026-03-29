import { NextResponse } from "next/server";
import { get } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ cached: false, error: "no token" }, { status: 404 });
    }

    // Use @vercel/blob get() to read private blob
    const result = await get("scan-latest.json", {
      token: process.env.BLOB_READ_WRITE_TOKEN,
      access: "private",
    });

    if (!result || !result.stream) {
      return NextResponse.json({ cached: false }, { status: 404 });
    }

    // Read the stream as text
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf-8");
    const data = JSON.parse(text);

    return NextResponse.json({ ...data, cached: true });
  } catch (e) {
    const msg = String(e);
    if (msg.includes("BlobNotFound") || msg.includes("not_found")) {
      return NextResponse.json({ cached: false }, { status: 404 });
    }
    console.error("[cached-scan] Error:", e);
    return NextResponse.json({ cached: false, error: msg }, { status: 404 });
  }
}
