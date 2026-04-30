/**
 * POST /api/alerts/connect
 *
 * Generates a one-time 6-char code for the authenticated user.
 * The user sends this code to the AlphaGap Telegram bot via /start CODE.
 * Requires premium subscription.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getTier, canAccessPremium } from "@/lib/subscription";
import { createConnectCode, getTelegramConnection } from "@/lib/telegram-alerts";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tier = getTier(session);
  if (!canAccessPremium(tier)) {
    return NextResponse.json({ error: "Premium subscription required" }, { status: 403 });
  }

  const code = await createConnectCode(session.user.email);
  return NextResponse.json({ code });
}

/**
 * GET /api/alerts/connect
 *
 * Returns current connection status for the authenticated user.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conn = await getTelegramConnection(session.user.email);
  if (!conn || !conn.chatId) {
    return NextResponse.json({ connected: false });
  }
  return NextResponse.json({
    connected: true,
    username: conn.username,
    firstName: conn.firstName,
    connectedAt: conn.connectedAt,
    settings: conn.settings,
  });
}
