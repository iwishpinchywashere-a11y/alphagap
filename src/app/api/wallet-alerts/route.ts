/**
 * GET  /api/wallet-alerts  → connection status + wallet tracker prefs
 * POST /api/wallet-alerts  → save wallet tracker prefs (enabled, minUsdAmount, trackedWallets)
 *
 * Requires auth (any tier). Telegram must be connected to enable alerts.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  getTelegramConnection,
  saveTelegramConnection,
  defaultAlertSettings,
} from "@/lib/telegram-alerts";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conn = await getTelegramConnection(session.user.email);
  if (!conn?.chatId) {
    return NextResponse.json({
      connected: false,
      walletTracker: { enabled: false, minUsdAmount: 1000, trackedWallets: [] },
    });
  }

  const settings = conn.settings ?? defaultAlertSettings();
  return NextResponse.json({
    connected: true,
    username: conn.username,
    firstName: conn.firstName,
    walletTracker: settings.walletTracker ?? { enabled: false, minUsdAmount: 1000, trackedWallets: [] },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    enabled: boolean;
    minUsdAmount: number;
    trackedWallets: string[];
  };

  const conn = await getTelegramConnection(session.user.email);
  if (!conn?.chatId) {
    return NextResponse.json({ error: "Telegram not connected" }, { status: 400 });
  }

  const settings = conn.settings ?? defaultAlertSettings();
  settings.walletTracker = {
    enabled:        !!body.enabled,
    minUsdAmount:   Math.max(0, Number(body.minUsdAmount) || 0),
    trackedWallets: Array.isArray(body.trackedWallets) ? body.trackedWallets : [],
  };
  conn.settings = settings;

  await saveTelegramConnection(session.user.email, conn);
  return NextResponse.json({ ok: true });
}
