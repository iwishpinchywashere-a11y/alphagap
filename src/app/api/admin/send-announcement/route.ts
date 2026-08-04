// POST /api/admin/send-announcement
// Admin-only route to send the Telegram launch announcement email.
// Body: { test: true, testEmail: string }        → single test send
//       { test: false }                           → blast to all users

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserList } from "@/lib/users";
import { sendTelegramAnnouncementEmail, sendWalletTrackerAnnouncementEmail, sendOracleAnnouncementEmail, sendConvictionAnnouncementEmail, sendIndexAnnouncementEmail } from "@/lib/email";
import { isOptedOut } from "@/lib/unsubscribe";

// A blast of ~400 at a 500ms throttle needs ~3.5 minutes. Without this the
// function is killed partway through, delivering to a fraction of the list
// with no record of who received it — and no safe way to retry.
export const maxDuration = 300;

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

  const emailType: string = body.type || "telegram"; // "telegram" | "wallet-tracker" | "oracle" | "conviction"

  function getSendFn(tier: "free" | "pro" | "premium") {
    if (emailType === "wallet-tracker") return (n: string, e: string) => sendWalletTrackerAnnouncementEmail(n, e, tier);
    if (emailType === "oracle")         return (n: string, e: string) => sendOracleAnnouncementEmail(n, e, tier);
    if (emailType === "conviction")     return (n: string, e: string) => sendConvictionAnnouncementEmail(n, e, tier);
    return (n: string, e: string) => sendTelegramAnnouncementEmail(n, e, tier);
  }

  // ── Test send ─────────────────────────────────────────────────────────────
  if (body.test === true) {
    const testEmail: string = body.testEmail || ADMIN_EMAIL;
    const tier: "free" | "pro" | "premium" = body.tier || "premium";
    try {
      if (emailType === "index") {
        await sendIndexAnnouncementEmail("Shane", testEmail, body.ultra === true);
        return NextResponse.json({ ok: true, sent: 1, to: testEmail, type: emailType, ultra: body.ultra === true });
      }
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

    let skipped = 0;

    for (const u of users) {
      // Announcements are marketing: never send to someone who opted out.
      if (await isOptedOut(u.email)) { skipped++; continue; }

      const tier: "free" | "pro" | "premium" =
        u.subscriptionTier === "premium" ? "premium"
        : u.subscriptionTier === "pro" ? "pro"
        : "free";

      try {
        if (emailType === "index") {
          // The Index email segments on Ultra, not the three legacy tiers:
          // Ultra subscribers already have access, everyone else gets the
          // launch announcement WITHOUT the paywalled holdings.
          await sendIndexAnnouncementEmail(u.name, u.email, u.subscriptionTier === "ultra");
        } else {
          await getSendFn(tier)(u.name, u.email);
        }
        sent++;
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        failed++;
        errors.push(`${u.email}: ${String(err)}`);
      }
    }

    return NextResponse.json({ ok: true, total: users.length, sent, skipped, failed, errors });
  }

  return NextResponse.json({ error: "Pass test: true or test: false" }, { status: 400 });
}
