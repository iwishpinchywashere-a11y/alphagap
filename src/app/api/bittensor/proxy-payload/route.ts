/**
 * GET /api/bittensor/proxy-payload?address=5G...
 *
 * Ultra-gated. Builds the proxy.addProxy signing payload server-side using
 * @polkadot/api connected to Bittensor Finney, and returns it as JSON for the
 * browser to sign with Talisman/SubWallet.
 *
 * Returns: { payload: SignerPayloadJSON } — pass directly to signer.signPayload()
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTier, canAccessUltra } from "@/lib/subscription";
import { ApiPromise, WsProvider } from "@polkadot/api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BITTENSOR_WSS = "wss://entrypoint-finney.opentensor.ai:443";
// TrustedStake shared proxy address for custom strategies
const TS_PROXY_ADDRESS = "5CeJG2T47NxUAAc42q2zoU7qV1YFy4khL3ogHxooVjNKxUuw";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!canAccessUltra(getTier(session))) {
    return NextResponse.json({ error: "Ultra subscription required" }, { status: 403 });
  }

  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address query param required" }, { status: 400 });
  }

  let api: ApiPromise | null = null;
  try {
    const provider = new WsProvider(BITTENSOR_WSS);
    api = await ApiPromise.create({ provider });

    // Build the proxy.addProxy call
    // proxyType 0 = first variant (Any) — allows TrustedStake to execute staking ops
    const tx = api.tx.proxy.addProxy(TS_PROXY_ADDRESS, 0, 0);

    // Build the signing payload — this needs to be done while connected to the
    // chain so we get the correct nonce, blockHash, genesisHash, specVersion etc.
    const { nonce, blockHash, genesisHash, runtimeVersion } = await Promise.all([
      api.rpc.system.accountNextIndex(address),
      api.rpc.chain.getBlockHash(),
      api.rpc.chain.getBlockHash(0),
      api.rpc.state.getRuntimeVersion(),
    ]).then(([nonce, blockHash, genesisHash, rv]) => ({
      nonce,
      blockHash: blockHash.toHex(),
      genesisHash: genesisHash.toHex(),
      runtimeVersion: rv,
    }));

    // Construct the SignerPayloadJSON that Talisman/SubWallet's signPayload expects
    const signerPayload = {
      address,
      blockHash,
      blockNumber: "0x00000000", // mortal era — not needed for immortal
      era: "0x00",              // immortal era (0x00)
      genesisHash,
      method: tx.method.toHex(),
      nonce: nonce.toHex(),
      signedExtensions: runtimeVersion.toJSON().apis
        ? undefined
        : undefined,
      specVersion: (runtimeVersion as unknown as { specVersion: { toHex(): string } }).specVersion.toHex(),
      tip: "0x00000000000000000000000000000000",
      transactionVersion: (runtimeVersion as unknown as { transactionVersion: { toHex(): string } }).transactionVersion.toHex(),
      version: 4,
    };

    return NextResponse.json({ payload: signerPayload });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[proxy-payload]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    api?.disconnect().catch(() => {});
  }
}
