// POST /api/admin/send-announcement
// Admin-only route to send the Telegram launch announcement email.
// Body: { test: true, testEmail: string }        → single test send
//       { test: false }                           → blast to all users

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserList } from "@/lib/users";
import { sendTelegramAnnouncementEmail, sendWalletTrackerAnnouncementEmail } from "@/lib/email";

const ADMIN_EMAIL = "iwishpinchywashere@gmail.com";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAuthorised(req: NextRequest, session: any): boolean {
  // Allow via CRON_SECRET bearer token (for server-side / curl calls)
  const secret = (process.env.CRON_SECRET || "").trim();
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  // Allow via admin session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userEmail = (session?.user as any)?.email;
  return !!(userEmail && userEmail === ADMIN_EMAIL);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAuthorised(req, session)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const emailType: string = body.type || "telegram"; // "telegram" | "wallet-tracker"

  function getSendFn(tier: "free" | "pro" | "premium") {
    return emailType === "wallet-tracker"
      ? (n: string, e: string) => sendWalletTrackerAnnouncementEmail(n, e, tier)
      : (n: string, e: string) => sendTelegramAnnouncementEmail(n, e, tier);
  }

  // ── Test send ─────────────────────────────────────────────────────────────
  if (body.test === true) {
    const testEmail: string = body.testEmail || ADMIN_EMAIL;
    const tier: "free" | "pro" | "premium" = body.tier || "premium";
    try {
      await getSendFn(tier)("Shane", testEmail);
      return NextResponse.json({ ok: true, sent: 1, to: testEmail, type: emailType, tier });
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
      const tier: "free" | "pro" | "premium" =
        u.subscriptionTier === "premium" ? "premium"
        : u.subscriptionTier === "pro" ? "pro"
        : "free";

      try {
        await getSendFn(tier)(u.name, u.email);
        sent++;
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
