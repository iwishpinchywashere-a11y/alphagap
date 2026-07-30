/**
 * POST /api/trustedstake/join
 *
 * Ultra-gated. Forwards a signed membership registration to TrustedStake so the
 * user never has to leave alphagap.io.
 *
 * TrustedStake removed the private-strategy share-link requirement (verified
 * 2026-07-30): /membership/register now accepts a signed registration for a
 * private strategy with no invite token. The only remaining gate is the
 * on-chain proxy — the wallet must have delegated a `Staking` proxy to
 * TS_PROXY_ADDRESS, and that delegation must be visible at a *finalized*
 * anchor block (`fromBlock`).
 *
 * The signed x-message.data schema is strict (extra keys are rejected):
 *   { proxy, strategyId, strategyTable, fromBlock, fromTimestamp }
 *
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
    return NextResponse.json(
      { error: "walletAddress, signature, and message are required" },
      { status: 400 }
    );
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
      // All mutation data must live inside the signed x-message.data —
      // TrustedStake rejects any unsigned body keys (code: UNSIGNED_BODY).
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
