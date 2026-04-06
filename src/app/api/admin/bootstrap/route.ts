// One-time bootstrap: sets isAdmin=true on blob records for all ADMIN_EMAILS users
// Protected by NEXTAUTH_SECRET — call with ?secret=<your_secret>

import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, updateUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    return NextResponse.json({ error: "ADMIN_EMAILS not set" }, { status: 400 });
  }

  const results: Array<{ email: string; status: string }> = [];

  for (const email of adminEmails) {
    try {
      const user = await getUserByEmail(email);
      if (!user) {
        results.push({ email, status: "not found — user must sign up first" });
        continue;
      }
      if (user.isAdmin) {
        results.push({ email, status: "already admin" });
        continue;
      }
      await updateUser(email, { isAdmin: true });
      results.push({ email, status: "updated → isAdmin=true" });
    } catch (e) {
      results.push({ email, status: `error: ${String(e)}` });
    }
  }

  return NextResponse.json({ ok: true, results });
}
