// Bootstrap: sets isAdmin=true on blob records for all ADMIN_EMAILS users.
// No external secret needed — the endpoint can only promote emails already
// listed in the ADMIN_EMAILS env var, so there is nothing useful an attacker
// can do by calling it.

import { NextResponse } from "next/server";
import { getUserByEmail, updateUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET() {
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    return NextResponse.json({ error: "ADMIN_EMAILS env var is not set" }, { status: 400 });
  }

  const results: Array<{ email: string; status: string }> = [];

  for (const email of adminEmails) {
    try {
      const user = await getUserByEmail(email);
      if (!user) {
        results.push({ email, status: "not found — account must exist first" });
        continue;
      }
      if (user.isAdmin) {
        results.push({ email, status: "already admin ✓" });
        continue;
      }
      await updateUser(email, { isAdmin: true });
      results.push({ email, status: "updated → isAdmin=true ✓" });
    } catch (e) {
      results.push({ email, status: `error: ${String(e)}` });
    }
  }

  return NextResponse.json({ ok: true, results });
}
