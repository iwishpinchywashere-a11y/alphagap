/**
 * GET /api/trustedstake/anchor
 *
 * Reports the block height TrustedStake's own node has finalized.
 *
 * Why this exists: /membership/register verifies the user's proxy at a
 * `fromBlock` anchor, but rejects (PROXY_CHAIN_NOT_READY) any anchor their node
 * hasn't finalized yet — and their node runs well behind chain finality
 * (observed ~16 blocks / ~3 min on 2026-07-30). Registration signatures are
 * single-use (replaying one returns "Signature has already been used"), so a
 * premature anchor costs the user a *fresh wallet popup* on every retry. That
 * is exactly the 6-signature loop this route exists to prevent.
 *
 * TrustedStake exposes their finalized height only inside the error body of a
 * signed request, so we probe with an ephemeral server-side keypair for a
 * random address. The probe can never register anything — the address holds no
 * proxy, so it always fails PROXY_NOT_FOUND — it just makes them tell us their
 * height. The client then signs exactly once, against a known-good anchor.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTier, canAccessUltra } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const TS_BASE = "https://api.app.trustedstake.ai/api/v1";
const TS_STRATEGY_ID = "97d1325b-9ee9-4bd1-bd58-893d707f85c4";
const TS_PROXY_ADDRESS = "5CeJG2T47NxUAAc42q2zoU7qV1YFy4khL3ogHxooVjNKxUuw";
const TS_STRATEGY_TABLE = "custom_strategies";

export async function GET() {
  const session = await getServerSession(authOptions);
  const tier = getTier(session);
  if (!canAccessUltra(tier)) {
    return NextResponse.json({ error: "Ultra subscription required" }, { status: 403 });
  }

  try {
    const { Keyring } = await import("@polkadot/keyring");
    const { cryptoWaitReady, mnemonicGenerate } = await import("@polkadot/util-crypto");
    const { u8aToHex, stringToU8a } = await import("@polkadot/util");

    await cryptoWaitReady();
    const pair = new Keyring({ type: "sr25519", ss58Format: 42 }).addFromUri(mnemonicGenerate());

    // fromBlock is deliberately far in the future: their chain-readiness check
    // runs first, so this always returns their finalized height in the error.
    const message = JSON.stringify({
      action: "register_membership",
      timestamp: Date.now(),
      nonce: crypto.randomUUID(),
      data: {
        proxy: TS_PROXY_ADDRESS,
        strategyId: TS_STRATEGY_ID,
        strategyTable: TS_STRATEGY_TABLE,
        fromBlock: 99_000_000,
        fromTimestamp: Date.now(),
      },
    });

    const res = await fetch(`${TS_BASE}/membership/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-signature": u8aToHex(pair.sign(stringToU8a(message))),
        "x-message": message,
        "x-wallet-address": pair.address,
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(12000),
    });

    const data = await res.json().catch(() => ({}));
    const finalizedBlock = data?.details?.finalizedBlock;

    if (typeof finalizedBlock !== "number") {
      // Shape changed, or they answered something we didn't expect. The client
      // falls back to a fixed safety margin rather than guessing.
      return NextResponse.json({ finalizedBlock: null }, { status: 200 });
    }

    return NextResponse.json({ finalizedBlock }, { status: 200 });
  } catch {
    return NextResponse.json({ finalizedBlock: null }, { status: 200 });
  }
}
