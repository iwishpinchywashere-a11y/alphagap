/**
 * POST /api/bittensor/submit-proxy
 *
 * Accepts a signed proxy.addProxy extrinsic (hex) from the browser and
 * submits it to the Bittensor Finney mainnet via HTTP JSON-RPC.
 *
 * Splitting signing (Talisman/browser) from submission (server-side HTTP)
 * avoids WebSocket subscription issues in the browser.
 *
 * Body: { extrinsic: "0x..." }
 * Returns: { txHash: "0x..." } or { error: string }
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTier, canAccessUltra } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Bittensor Finney HTTP RPC endpoint
const BITTENSOR_RPC = "https://entrypoint-finney.opentensor.ai";

export async function POST(request: Request) {
  // Must be an Ultra subscriber
  const session = await getServerSession(authOptions);
  if (!canAccessUltra(getTier(session))) {
    return NextResponse.json({ error: "Ultra subscription required" }, { status: 403 });
  }

  let body: { extrinsic?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { extrinsic } = body;
  if (!extrinsic || typeof extrinsic !== "string" || !extrinsic.startsWith("0x")) {
    return NextResponse.json({ error: "extrinsic must be a hex string starting with 0x" }, { status: 400 });
  }

  try {
    const rpcRes = await fetch(BITTENSOR_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "author_submitExtrinsic",
        params: [extrinsic],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!rpcRes.ok) {
      const text = await rpcRes.text().catch(() => "");
      console.error(`[bittensor-submit] HTTP ${rpcRes.status}: ${text.slice(0, 200)}`);
      return NextResponse.json({ error: `RPC HTTP error: ${rpcRes.status}` }, { status: 502 });
    }

    const rpcData = await rpcRes.json();

    // JSON-RPC error
    if (rpcData.error) {
      const msg: string = rpcData.error?.message ?? JSON.stringify(rpcData.error);
      console.error("[bittensor-submit] RPC error:", msg);

      // "Priority is too low" / "AlreadyImported" means the tx is already on chain — treat as success
      const already = msg.toLowerCase().includes("already") ||
        msg.toLowerCase().includes("priority is too low") ||
        msg.toLowerCase().includes("duplicate");
      if (already) {
        return NextResponse.json({ txHash: null, alreadyExists: true });
      }

      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // rpcData.result = txHash on success
    const txHash: string = rpcData.result ?? null;
    console.log(`[bittensor-submit] Proxy tx submitted: ${txHash}`);
    return NextResponse.json({ txHash });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bittensor-submit] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
