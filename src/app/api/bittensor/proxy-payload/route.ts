/**
 * GET /api/bittensor/proxy-payload?address=5G...
 *
 * Ultra-gated. Builds the proxy.addProxy signing payload server-side using
 * @polkadot/api connected to Bittensor Finney, and returns it as JSON for the
 * browser to sign with Talisman/SubWallet via signer.signPayload().
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTier, canAccessUltra } from "@/lib/subscription";
import { ApiPromise, WsProvider } from "@polkadot/api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BITTENSOR_WSS = "wss://entrypoint-finney.opentensor.ai:443";
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

    // Build the call
    const tx = api.tx.proxy.addProxy(TS_PROXY_ADDRESS, 0, 0);

    // Fetch everything needed for the signing payload in parallel
    const [nonce, latestBlockHash, genesisHash, runtimeVersion] = await Promise.all([
      api.rpc.system.accountNextIndex(address),
      api.rpc.chain.getBlockHash(),       // current tip (used for mortal era)
      api.rpc.chain.getBlockHash(0),       // genesis hash
      api.rpc.state.getRuntimeVersion(),
    ]);

    // Get the real signed extensions from the chain's registry.
    // Never hardcode these — if one name doesn't match the chain runtime,
    // Talisman crashes with "Oops".
    const signedExtensions = api.registry.signedExtensions;

    // Log for debugging
    console.log("[proxy-payload] signedExtensions:", signedExtensions);
    console.log("[proxy-payload] specVersion:", runtimeVersion.specVersion.toNumber());
    console.log("[proxy-payload] transactionVersion:", runtimeVersion.transactionVersion.toNumber());

    // Use mortal era (valid for ~2 hours from latest block) rather than immortal.
    // Immortal era requires blockHash=genesisHash which some wallets handle
    // differently; mortal era is simpler and explicit about which block it's for.
    const era = api.registry.createType("ExtrinsicEra", {
      current: latestBlockHash,
      period: 64, // ~64 blocks ≈ ~12 minutes
    });

    const signerPayload = {
      address,
      blockHash:          latestBlockHash.toHex(),
      blockNumber:        api.registry.createType("BlockNumber",
        await api.rpc.chain.getHeader(latestBlockHash).then(h => h.number.toHex())
      ).toHex(),
      era:                era.toHex(),
      genesisHash:        genesisHash.toHex(),
      method:             tx.method.toHex(),
      nonce:              nonce.toHex(),
      signedExtensions,
      specVersion:        runtimeVersion.specVersion.toHex(),
      tip:                "0x00000000000000000000000000000000",
      transactionVersion: runtimeVersion.transactionVersion.toHex(),
      version:            4,
    };

    return NextResponse.json({ payload: signerPayload });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[proxy-payload] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    api?.disconnect().catch(() => {});
  }
}
