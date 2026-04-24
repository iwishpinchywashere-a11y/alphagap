/**
 * POST /api/translate
 * Translates an array of strings to the target language using Claude Haiku + blob cache.
 * Requires authentication (language preference is a per-user feature).
 *
 * Body: { texts: string[], lang: "fr" | "es" }
 * Response: { translated: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { translateBatch, type Language } from "@/lib/translate";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { texts?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { texts, lang } = body;
  if (!Array.isArray(texts) || !lang || !["fr", "es"].includes(lang as string)) {
    return NextResponse.json({ error: "texts must be an array and lang must be 'fr' or 'es'" }, { status: 400 });
  }

  const translated = await translateBatch(texts as string[], lang as Language);
  return NextResponse.json({ translated });
}
