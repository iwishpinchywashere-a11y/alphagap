/**
 * POST /api/alerts/verify
 *
 * Called by the Railway Telegram bot when a user sends /start CODE.
 * Authenticates via BOT_API_SECRET header.
 * Consumes the one-time code, links the Telegram chatId to the user, and
 * returns the user's first name so the bot can send a welcome message.
 *
 * Body: { code: string, chatId: string, username?: string, firstName?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  consumeConnectCode,
  saveTelegramConnectionByHash,
  getTelegramConnectionByHash,
  defaultAlertSettings,
} from "@/lib/telegram-alerts";

function authOk(req: NextRequest): boolean {
  const secret = (process.env.BOT_API_SECRET || "").trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code, chatId, username, firstName } = await req.json() as {
    code: string;
    chatId: string;
    username?: string;
    firstName?: string;
  };

  if (!code || !chatId) {
    return NextResponse.json({ error: "Missing code or chatId" }, { status: 400 });
  }

  const tokenData = await consumeConnectCode(code);
  if (!tokenData) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  // Load existing settings if reconnecting
  const existing = await getTelegramConnectionByHash(tokenData.emailHash);

  await saveTelegramConnectionByHash(tokenData.emailHash, {
    chatId,
    username,
    firstName,
    connectedAt: new Date().toISOString(),
    settings: existing?.settings ?? defaultAlertSettings(),
  });

  return NextResponse.json({
    ok: true,
    firstName: firstName ?? username ?? "there",
    email: tokenData.email,
  });
}
