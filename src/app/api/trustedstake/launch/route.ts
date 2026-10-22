/**
 * GET /api/trustedstake/launch?address=<ss58>
 *
 * Ultra-gated. Returns the hosted TrustedStake join/manage link for the
 * AlphaGap Index (the "share link" from TrustedStake's distribution model).
 *
 * TrustedStake maintains the whole wallet flow behind this link: proxy grant,
 * real-pays-fee, membership registration and the initial allocation. The same
 * link also serves returning members - TrustedStake checks the wallet's
 * membership itself and opens the management view instead of re-registering.
 *
 * The URL itself is config, not code, so a newly issued link goes live with
 * an env change and no deploy:
 *   TRUSTEDSTAKE_JOIN_URL              issued joinUrl (https://app.trustedstake.ai/connect/l/{launchId})
 *   TRUSTEDSTAKE_RETURN_DESTINATION_ID destination id registered by TrustedStake (optional)
 * Falls back to the legacy private invite link until the new one is issued.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTier, canAccessUltra } from "@/lib/subscription";

export const dynamic = "force-dynamic";

const LEGACY_INVITE_URL =
  "https://app.trustedstake.ai/strat/invite/e6efd855f520660338db05c14baf5fd38a15c0e83e12b6c43b8307b2b9c9d237";

function baseUrl(): string {
  // Only a full https URL counts; an older env holding a bare token must not
  // break the button.
  for (const v of [process.env.TRUSTEDSTAKE_JOIN_URL, process.env.TRUSTEDSTAKE_SHARE_LINK]) {
    const s = (v ?? "").trim();
    if (/^https:\/\/app\.trustedstake\.ai\//.test(s)) return s;
  }
  return LEGACY_INVITE_URL;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!canAccessUltra(getTier(session))) {
    return NextResponse.json({ error: "Ultra subscription required" }, { status: 403 });
  }

  const address = new URL(request.url).searchParams.get("address") ?? "";
  let url: URL;
  try {
    url = new URL(baseUrl());
  } catch {
    return NextResponse.json({ error: "TrustedStake join link is not configured" }, { status: 500 });
  }

  // Only the documented parameters are added; origin, path and launch id stay
  // exactly as issued. `state` is opaque correlation data (base64url, <=256
  // chars) - never a wallet address or anything secret.
  const isLaunchLink = url.pathname.startsWith("/connect/");
  const returnDestinationId = (process.env.TRUSTEDSTAKE_RETURN_DESTINATION_ID ?? "").trim();
  if (isLaunchLink && returnDestinationId && /^[A-Za-z0-9_-]{1,64}$/.test(returnDestinationId)) {
    url.searchParams.set("returnDestinationId", returnDestinationId);
    const state = Buffer.from(JSON.stringify({ a: address.slice(0, 8), t: Date.now() }))
      .toString("base64url")
      .slice(0, 256);
    url.searchParams.set("state", state);
  }

  return NextResponse.json({
    url: url.href,
    hosted: isLaunchLink,
    returnConfigured: Boolean(isLaunchLink && returnDestinationId),
  });
}
