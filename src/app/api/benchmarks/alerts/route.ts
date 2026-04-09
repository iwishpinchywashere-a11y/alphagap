import { NextResponse } from "next/server";
import { get } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json([]);

  try {
    const blob = await get("benchmark-alerts.json", { token, access: "private" });
    if (!blob?.stream) return NextResponse.json([]);
    const reader = blob.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch {
    return NextResponse.json([]);
  }
}
