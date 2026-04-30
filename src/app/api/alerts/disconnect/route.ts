/**
 * POST /api/alerts/disconnect
 *
 * Removes the Telegram connection for the authenticated user.
 * Premium required.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getTier, canAccessPremium } from "@/lib/subscription";
import { deleteTelegramConnection } from "@/lib/telegram-alerts";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tier = getTier(session);
  if (!canAccessPremium(tier)) {
    return NextResponse.json({ error: "Premium subscription required" }, { status: 403 });
  }

  await deleteTelegramConnection(session.user.email);
  return NextResponse.json({ ok: true });
}
