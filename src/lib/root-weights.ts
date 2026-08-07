/**
 * Root Reborn watcher.
 *
 * Root Reborn is LIVE on mainnet — the release PR (opentensor/subtensor #2968)
 * merged 2026-08-03 and mainnet reports spec_version 443. Press coverage saying
 * it is "a proposal under review" is out of date.
 *
 * But the part that matters to us ships switched off:
 *
 *   set_root_weights is disabled network-wide (RootWeightSettingEnabled =
 *   false). Until governance flips it, every fund runs the null strategy and
 *   dividends accumulate in place on the origin subnet.
 *
 * Verified against chain state on 2026-08-07, not just read from release notes:
 * subtensorModule.rootWeightSettingEnabled == false.
 *
 * WHY WE WATCH IT. When that flag flips, every validator publishes a weight
 * vector saying where it is allocating real capital across subnets. That is a
 * direct, on-chain, forward-looking read on what the best-informed actors on
 * the network are buying — a strictly better version of what AlphaGap
 * currently infers indirectly from flows and whale movement. It is also a
 * regime change for our own inputs: root_prop today reflects a passive stake
 * distribution, and afterwards it reflects active allocation decisions. The
 * same number will mean something different, exactly as eVal's did at v440.
 *
 * Deliberately a single raw JSON-RPC call against a precomputed storage key
 * rather than @polkadot/api. Building an ApiPromise downloads and decodes full
 * chain metadata (megabytes, seconds) which is far too heavy for a serverless
 * scan that only needs one boolean.
 */

/**
 * twox128("SubtensorModule") ++ twox128("RootWeightSettingEnabled").
 *
 * Precomputed so we never pull in metadata at runtime. Regenerate with:
 *   xxhashAsHex("SubtensorModule", 128) + xxhashAsHex("RootWeightSettingEnabled", 128).slice(2)
 * from @polkadot/util-crypto.
 */
const ROOT_WEIGHT_ENABLED_KEY =
  "0x658faa385070e074c85bf6b568cf055543f3dc4dfa03eb004921d663110b49b0";

const FINNEY_RPC = "https://entrypoint-finney.opentensor.ai";

export interface RootWeightStatus {
  /** True once governance enables validator root-weight setting. */
  enabled: boolean;
  /** False when the RPC failed — do NOT treat that as "disabled". */
  read: boolean;
  specVersion: number | null;
}

/**
 * Read the flag. On any failure `read` is false and `enabled` is false, so
 * callers can distinguish "confirmed off" from "we could not tell" — a failed
 * read silently reported as "off" would mean missing the flip entirely.
 */
export async function readRootWeightStatus(timeoutMs = 8000): Promise<RootWeightStatus> {
  const call = async (method: string, params: unknown[] = []) => {
    const res = await fetch(FINNEY_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`rpc ${res.status}`);
    return (await res.json())?.result;
  };

  try {
    const raw = await call("state_getStorage", [ROOT_WEIGHT_ENABLED_KEY]);
    // Absent means the storage item is at its default, which is false.
    // Only an explicit 0x01 counts as enabled.
    const enabled = raw === "0x01";

    let specVersion: number | null = null;
    try {
      const rt = await call("state_getRuntimeVersion");
      const sv = (rt as { specVersion?: number } | null)?.specVersion;
      if (typeof sv === "number") specVersion = sv;
    } catch { /* version is nice to have, not required */ }

    return { enabled, read: true, specVersion };
  } catch {
    return { enabled: false, read: false, specVersion: null };
  }
}
