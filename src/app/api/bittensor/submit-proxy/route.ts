/**
 * POST /api/bittensor/submit-proxy
 *
 * Ultra-gated. Accepts { extrinsic: "0x..." } (a fully signed extrinsic hex
 * produced in the browser by signAndSend) and submits it to Bittensor Finney
 * via HTTP JSON-RPC author_submitExtrinsic.
 *
 * Returns { txHash } on success, { alreadyExists: true } if the proxy is
 * already registered, or { error } on failure.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTier, canAccessUltra } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BITTENSOR_HTTP = "https://entrypoint-finney.opentensor.ai";

export async function POST(request: Request) {
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
  if (!extrinsic) {
    return NextResponse.json({ error: "extrinsic is required" }, { status: 400 });
  }

  try {
    const rpcRes = await fetch(BITTENSOR_HTTP, {
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
      console.error(`[submit-proxy] HTTP ${rpcRes.status}:`, text.slice(0, 300));
      return NextResponse.json({ error: `RPC HTTP error: ${rpcRes.status}` }, { status: 502 });
    }

    const rpcData = await rpcRes.json();

    if (rpcData.error) {
      const msg: string = rpcData.error?.message ?? JSON.stringify(rpcData.error);
      const data: string = rpcData.error?.data ?? "";
      const full = data ? `${msg}: ${data}` : msg;
      console.error("[submit-proxy] RPC error:", full, "| raw data:", rpcData.error?.data);

      // "AlreadyImported" / "Priority is too low" / "Duplicate" / "already" = proxy
      // already exists on chain — treat as success
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
    console.log(`[submit-proxy] Proxy tx submitted: ${txHash}`);
    return NextResponse.json({ txHash });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[submit-proxy] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
