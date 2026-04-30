/**
 * POST /api/alerts/test
 *
 * Sends a test Telegram message to the authenticated user's connected account.
 * Enqueues a test alert that the Railway bot will pick up and send.
 * Premium + connected Telegram required.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getTier, canAccessPremium } from "@/lib/subscription";
import { getTelegramConnection, enqueueAlert, emailHash } from "@/lib/telegram-alerts";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tier = getTier(session);
  if (!canAccessPremium(tier)) {
    return NextResponse.json({ error: "Premium subscription required" }, { status: 403 });
  }

  const conn = await getTelegramConnection(session.user.email);
  if (!conn?.chatId) {
    return NextResponse.json({ error: "Telegram not connected" }, { status: 404 });
  }

  await enqueueAlert(emailHash(session.user.email), {
    type: "test",
    message:
      "✅ *AlphaGap Alerts Connected!*\n\nYour Telegram alerts are working. You'll receive notifications here when your selected subnets hit your thresholds.\n\nManage your alerts at alphagap.io/alerts",
  });

  return NextResponse.json({ ok: true });
}
