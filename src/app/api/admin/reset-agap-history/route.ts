/**
 * GET /api/admin/reset-agap-history
 *
 * One-time reset: wipes agap-history.json so the next full scan
 * recomputes all EMA values from scratch using the current formula.
 *
 * Use when formula weights change significantly and old EMA values
 * would otherwise take many scans to decay to the correct range.
 */

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: "no token" }, { status: 500 });

  await put("agap-history.json", JSON.stringify({}), {
    access: "private",
    token,
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
  });

  return NextResponse.json({
    ok: true,
    message: "agap-history.json reset to {}. Next full scan will recompute all EMA values from scratch.",
  });
}
