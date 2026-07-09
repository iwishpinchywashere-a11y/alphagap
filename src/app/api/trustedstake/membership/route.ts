/**
 * GET /api/trustedstake/membership?address=<ss58>
 *
 * Ultra-gated. Checks whether a wallet is an active delegator of the
 * AlphaGap Index strategy via the TrustedStake manager API. This is the
 * source of truth for membership — users join through the private invite
 * link on TrustedStake, and this endpoint lets AlphaGap detect it.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTier, canAccessUltra } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const TS_MANAGER_BASE = "https://api.app.trustedstake.ai/api/v1/manager-api";
const TS_API_KEY = process.env.TRUSTEDSTAKE_API_KEY || "";
const TS_STRATEGY_ID = process.env.TRUSTEDSTAKE_STRATEGY_ID || "";

interface TSDelegator {
  walletAddress: string;
  joinedAt: string;
  leftAt: string | null;
  isActive: boolean;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const tier = getTier(session);
  if (!canAccessUltra(tier)) {
    return NextResponse.json({ error: "Ultra subscription required" }, { status: 403 });
  }

  const address = new URL(request.url).searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }
  if (!TS_API_KEY || !TS_STRATEGY_ID) {
    return NextResponse.json({ error: "TrustedStake env vars not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${TS_MANAGER_BASE}/strategies/${TS_STRATEGY_ID}/delegators`, {
      headers: { Authorization: `Bearer ${TS_API_KEY}` },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `TrustedStake delegators lookup failed (${res.status})` }, { status: 502 });
    }
    const json = await res.json();
    const delegators: TSDelegator[] = json?.data?.delegators ?? [];
    const match = delegators.find(d => d.walletAddress === address && d.isActive && !d.leftAt);

    return NextResponse.json({
      isMember: Boolean(match),
      joinedAt: match?.joinedAt ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
