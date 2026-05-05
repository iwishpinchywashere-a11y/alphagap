// POST /api/admin/send-announcement
// Admin-only route to send the Telegram launch announcement email.
// Body: { test: true, testEmail: string }        → single test send
//       { test: false }                           → blast to all users

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserList } from "@/lib/users";
import { sendTelegramAnnouncementEmail } from "@/lib/email";

const ADMIN_EMAIL = "iwishpinchywashere@gmail.com";

export async function POST(req: NextRequest) {
  // Admin gate
  const session = await getServerSession(authOptions);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userEmail = (session?.user as any)?.email;
  if (!userEmail || userEmail !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  // ── Test send ─────────────────────────────────────────────────────────────
  if (body.test === true) {
    const testEmail: string = body.testEmail || ADMIN_EMAIL;
    const tier: "free" | "pro" | "premium" = body.tier || "premium";
    try {
      await sendTelegramAnnouncementEmail("Shane", testEmail, tier);
      return NextResponse.json({ ok: true, sent: 1, to: testEmail });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // ── Full blast ─────────────────────────────────────────────────────────────
  if (body.test === false) {
    const users = await getUserList();
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const u of users) {
      // Determine tier for personalisation
      const tier: "free" | "pro" | "premium" =
        u.subscriptionTier === "premium" ? "premium"
        : u.subscriptionTier === "pro" ? "pro"
        : "free";

      try {
        await sendTelegramAnnouncementEmail(u.name, u.email, tier);
        sent++;
        // Pace at ~2/sec to stay within Resend rate limits (100/min free tier)
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        failed++;
        errors.push(`${u.email}: ${String(err)}`);
      }
    }

    return NextResponse.json({ ok: true, total: users.length, sent, failed, errors });
  }

  return NextResponse.json({ error: "Pass test: true or test: false" }, { status: 400 });
}
