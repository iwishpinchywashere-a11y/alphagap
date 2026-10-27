/**
 * GET /api/trustedstake/membership?address=<ss58>
 *
 * Ultra-gated. Checks whether a wallet is an active delegator of the
 * AlphaGap Index strategy via the TrustedStake manager API. This is the
 * source of truth for MEMBERSHIP - users join through the private invite
 * link on TrustedStake, and this endpoint lets AlphaGap detect it.
 *
 * MEMBERSHIP IS NOT ALLOCATION. TrustedStake were explicit about this
 * (2026-10-27): a wallet can be an active delegator with nothing deployed,
 * because the initial allocation is a separate approval and a separate
 * queued job. This endpoint therefore answers one question only. Whether
 * the money is actually working is read from the chain on the client
 * (stake per hotkey + free balance), never inferred from isMember.
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
    // activeOnly=true per TrustedStake: filter server-side rather than
    // pulling the full history and filtering here, so a long list of former
    // delegators can never push a current one out of the response.
    const url = `${TS_MANAGER_BASE}/strategies/${TS_STRATEGY_ID}/delegators?activeOnly=true`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TS_API_KEY}` },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `TrustedStake delegators lookup failed (${res.status})` }, { status: 502 });
    }
    const json = await res.json();
    const delegators: TSDelegator[] = json?.data?.delegators ?? [];
    // Exact wallet match. SS58 is case-sensitive base58, so the only
    // normalisation is trimming whitespace - never lowercase it, and never
    // match on a prefix or a truncated form.
    const wanted = address.trim();
    // The isActive / leftAt check is kept even with activeOnly=true: belt and
    // braces if the parameter is ever ignored by the API.
    const match = delegators.find(d => d.walletAddress?.trim() === wanted && d.isActive && !d.leftAt);

    return NextResponse.json({
      isMember: Boolean(match),
      joinedAt: match?.joinedAt ?? null,
      // Stated, not implied: this endpoint says nothing about whether the
      // member's TAO has been allocated. Callers read that from the chain.
      allocationKnown: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
