/**
 * PATCH /api/user/language
 * Saves language preference ("en" | "fr" | "es") to the user's blob.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { language } = body;
  if (!language || !["en", "fr", "es"].includes(language)) {
    return NextResponse.json({ error: "language must be one of: en, fr, es" }, { status: 400 });
  }

  await updateUser(session.user.email, { language: language as "en" | "fr" | "es" });
  return NextResponse.json({ ok: true, language });
}
