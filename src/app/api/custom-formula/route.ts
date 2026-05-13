/**
 * GET  /api/custom-formula  → return saved custom weights for the current user
 * POST /api/custom-formula  → save custom weights for the current user
 *
 * Stored in Vercel Blob at: custom-formula/{emailHash}.json
 * No subscription gate — available to all logged-in users.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { put, get as blobGet } from "@vercel/blob";
import crypto from "crypto";

export interface CustomWeights {
  velo: number;
  flow: number;
  dev: number;
  evalW: number;
  prod: number;
  soc: number;
  aud: number;
  emPct: number;
  emChange: number;
}

function emailHash(email: string): string {
  return crypto.createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 32);
}

function blobKey(email: string) {
  return `custom-formula/${emailHash(email)}.json`;
}

async function getSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return session.user.email;
}

export async function GET() {
  const email = await getSession();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const blob = await blobGet(blobKey(email), {
      token: process.env.BLOB_READ_WRITE_TOKEN!,
      access: "private",
    });
    if (!blob?.stream) return NextResponse.json({ weights: null });

    const reader = blob.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const weights = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as CustomWeights;
    return NextResponse.json({ weights });
  } catch {
    return NextResponse.json({ weights: null });
  }
}

export async function POST(req: NextRequest) {
  const email = await getSession();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { weights: CustomWeights };
  const { weights } = body;

  // Validate: all values must be numbers 0-100 and sum to exactly 100
  const fields: (keyof CustomWeights)[] = ["velo", "flow", "dev", "evalW", "prod", "soc", "aud", "emPct", "emChange"];
  for (const f of fields) {
    if (typeof weights[f] !== "number" || weights[f] < 0 || weights[f] > 100) {
      return NextResponse.json({ error: `Invalid value for ${f}` }, { status: 400 });
    }
  }
  const total = fields.reduce((s, f) => s + weights[f], 0);
  if (total !== 100) {
    return NextResponse.json({ error: `Weights must sum to 100, got ${total}` }, { status: 400 });
  }

  await put(blobKey(email), JSON.stringify(weights), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: process.env.BLOB_READ_WRITE_TOKEN!,
  });

  return NextResponse.json({ ok: true });
}
