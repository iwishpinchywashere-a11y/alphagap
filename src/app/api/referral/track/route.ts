import { NextResponse } from "next/server";
import { validateCode, COOKIE_NAME, COOKIE_DAYS } from "@/lib/referral";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  if (!process.env.REFERRAL_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.code || typeof body.code !== "string") {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const result = validateCode(body.code);
  if (!result.valid) {
    return NextResponse.json({ tracked: false, reason: "invalid_code" });
  }

  const maxAge = COOKIE_DAYS * 24 * 60 * 60;
  const response = NextResponse.json({ tracked: true });
  response.cookies.set(COOKIE_NAME, body.code.toUpperCase(), {
    maxAge,
    path: "/",
    httpOnly: false, // needs to be readable by client JS as backup
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
