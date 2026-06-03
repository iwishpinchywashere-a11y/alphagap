/**
 * POST /api/bittensor/submit-proxy
 *
 * Ultra-gated. Accepts { address, signature, payload } from the browser,
 * reconstructs the signed proxy.addProxy extrinsic server-side, and submits
 * it to Bittensor Finney via HTTP JSON-RPC.
 *
 * This keeps extrinsic encoding on the server where @polkadot/api is reliable,
 * and only signature production happens in the browser wallet extension.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTier, canAccessUltra } from "@/lib/subscription";
import { ApiPromise, WsProvider } from "@polkadot/api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BITTENSOR_WSS = "wss://entrypoint-finney.opentensor.ai:443";
const BITTENSOR_HTTP = "https://entrypoint-finney.opentensor.ai";
const TS_PROXY_ADDRESS = "5CeJG2T47NxUAAc42q2zoU7qV1YFy4khL3ogHxooVjNKxUuw";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!canAccessUltra(getTier(session))) {
    return NextResponse.json({ error: "Ultra subscription required" }, { status: 403 });
  }

  let body: { address?: string; signature?: string; payload?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { address, signature, payload } = body;
  if (!address || !signature || !payload) {
    return NextResponse.json({ error: "address, signature, and payload are required" }, { status: 400 });
  }

  let api: ApiPromise | null = null;
  try {
    // Reconnect to build the signed extrinsic
    const provider = new WsProvider(BITTENSOR_WSS);
    api = await ApiPromise.create({ provider });

    // Rebuild the same tx
    const tx = api.tx.proxy.addProxy(TS_PROXY_ADDRESS, 0, 0);

    // Inject the user's signature to produce the signed extrinsic
    tx.addSignature(
      address,
      signature as `0x${string}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload as any
    );

    const extrinsicHex = tx.toHex();
    await api.disconnect().catch(() => {});
    api = null;

    // Submit via HTTP RPC
    const rpcRes = await fetch(BITTENSOR_HTTP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "author_submitExtrinsic",
        params: [extrinsicHex],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!rpcRes.ok) {
      const text = await rpcRes.text().catch(() => "");
      console.error(`[bittensor-submit] HTTP ${rpcRes.status}:`, text.slice(0, 300));
      return NextResponse.json({ error: `RPC HTTP error: ${rpcRes.status}` }, { status: 502 });
    }

    const rpcData = await rpcRes.json();

    if (rpcData.error) {
      const msg: string = rpcData.error?.message ?? JSON.stringify(rpcData.error);
      const data: string = rpcData.error?.data ?? "";
      const full = data ? `${msg}: ${data}` : msg;
      console.error("[bittensor-submit] RPC error:", full);

      // "AlreadyImported" / "Priority is too low" / "Duplicate" = already on chain → success
      const already =
        full.toLowerCase().includes("already") ||
        full.toLowerCase().includes("priority is too low") ||
        full.toLowerCase().includes("duplicate") ||
        full.toLowerCase().includes("present");
      if (already) {
        return NextResponse.json({ txHash: null, alreadyExists: true });
      }

      return NextResponse.json({ error: full }, { status: 400 });
    }

    const txHash: string = rpcData.result ?? null;
    console.log(`[bittensor-submit] Proxy tx submitted: ${txHash}`);
    return NextResponse.json({ txHash });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bittensor-submit] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    api?.disconnect().catch(() => {});
  }
}
