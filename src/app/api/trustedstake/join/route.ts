/**
 * POST /api/trustedstake/join
 *
 * Ultra-gated. Registers the user as a member of the (private) AlphaGap Index
 * without them ever leaving alphagap.io.
 *
 * Endpoint: POST /api/v1/share-links/{token}/join
 *
 * This — not /membership/register — is the endpoint for joining a private
 * strategy. /membership/register always answers "Cannot join private strategy
 * without a share link" no matter how the invite is supplied, because it has no
 * way to accept one: its `shareLinkId` field passes validation but does not
 * satisfy the private-strategy check.
 *
 * The contract here is far simpler than /membership/register:
 *   - the invite token is in the URL path, so nothing about it is signed
 *   - `action` MUST be "join_via_share_link" (the endpoint names the expected
 *     action in its error if you get it wrong)
 *   - `data` may be empty — no proxy, no strategyId, no fromBlock
 *   - NO on-chain anchor block is involved, so TrustedStake's node lag cannot
 *     cause a failure, and one signature is always enough
 *
 * Note it does not require the on-chain proxy either; membership and the proxy
 * are independent. We still set the proxy up first, because without it
 * TrustedStake cannot actually stake on the user's behalf.
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

// Private, unlimited-use, non-expiring invite for the AlphaGap Index. Kept
// server-side so the client bundle never carries it.
const TS_SHARE_TOKEN =
  process.env.TRUSTEDSTAKE_SHARE_TOKEN ??
  "e6efd855f520660338db05c14baf5fd38a15c0e83e12b6c43b8307b2b9c9d237";

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
    const res = await fetch(`${TS_BASE}/share-links/${TS_SHARE_TOKEN}/join`, {
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

    // This endpoint reports failure as 200 + { success: false, error }, so the
    // HTTP status alone is not a reliable signal.
    if (!res.ok || data?.success === false) {
      return NextResponse.json(
        { error: data?.error ?? data?.message ?? `Join failed (${res.status})` },
        { status: res.ok ? 400 : res.status }
      );
    }

    return NextResponse.json({ ok: true, delegator: data?.data ?? null });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
