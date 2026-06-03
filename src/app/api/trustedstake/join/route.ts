/**
 * POST /api/trustedstake/join
 *
 * Ultra-gated. Forwards a signed membership registration to TrustedStake.
 * Body: { walletAddress: string, signature: string, message: string }
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTier, canAccessUltra } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const TS_BASE = "https://api.app.trustedstake.ai/api/v1";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const tier = getTier(session);
  if (!canAccessUltra(tier)) {
    return NextResponse.json({ error: "Ultra subscription required" }, { status: 403 });
  }

  let body: { walletAddress?: string; signature?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { walletAddress, signature, message } = body;
  if (!walletAddress || !signature || !message) {
    return NextResponse.json({ error: "walletAddress, signature, and message are required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${TS_BASE}/membership/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-signature": signature,
        "x-message": message,
        "x-wallet-address": walletAddress,
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`[ts-join] TrustedStake ${res.status}:`, JSON.stringify(data));
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
