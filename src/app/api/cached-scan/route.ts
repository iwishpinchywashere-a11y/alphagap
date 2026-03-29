import { NextResponse } from "next/server";
import { head } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Check if cached scan exists
    const blobInfo = await head("scan-latest.json");
    if (!blobInfo?.url) {
      return NextResponse.json({ cached: false }, { status: 404 });
    }

    // Fetch the cached JSON from the public blob URL
    const res = await fetch(blobInfo.url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ cached: false }, { status: 404 });
    }

    const data = await res.json();
    return NextResponse.json({ ...data, cached: true });
  } catch {
    return NextResponse.json({ cached: false }, { status: 404 });
  }
}
