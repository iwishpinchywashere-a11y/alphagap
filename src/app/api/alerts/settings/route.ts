/**
 * GET  /api/alerts/settings  → return current alert settings
 * POST /api/alerts/settings  → save alert settings
 *
 * Requires premium + connected Telegram.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getTier, canAccessPremium } from "@/lib/subscription";
import { getTelegramConnection, saveTelegramConnection } from "@/lib/telegram-alerts";
import type { AlertSettings } from "@/lib/telegram-alerts";

async function requirePremium() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { error: "Unauthorized", status: 401 };
  const tier = getTier(session);
  if (!canAccessPremium(tier)) return { error: "Premium subscription required", status: 403 };
  return { email: session.user.email };
}

export async function GET() {
  const auth = await requirePremium();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const conn = await getTelegramConnection(auth.email);
  if (!conn?.chatId) {
    return NextResponse.json({ error: "Telegram not connected" }, { status: 404 });
  }
  return NextResponse.json({ settings: conn.settings });
}

export async function POST(req: NextRequest) {
  const auth = await requirePremium();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const conn = await getTelegramConnection(auth.email);
  if (!conn?.chatId) {
    return NextResponse.json({ error: "Telegram not connected" }, { status: 404 });
  }

  const { settings } = await req.json() as { settings: AlertSettings };
  if (!settings) return NextResponse.json({ error: "Missing settings" }, { status: 400 });

  conn.settings = settings;
  await saveTelegramConnection(auth.email, conn);
  return NextResponse.json({ ok: true });
}
