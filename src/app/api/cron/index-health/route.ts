/**
 * GET /api/cron/index-health — every 6 hours.
 *
 * Verifies what ACTUALLY happened on chain, not what we asked TrustedStake to
 * do. Every index problem so far reached us through a member complaining:
 *
 *   - a member sat with 100.83 TAO undeployed from Aug 09 to Aug 16, through a
 *     completed rebalance, while a wallet that joined six days later was fully
 *     deployed;
 *   - the strategy sat stuck at isRebalancing = true for 79 hours;
 *   - our own cron skipped a Sunday by 71 seconds.
 *
 * None of those were visible anywhere. Our side reported success in all three
 * cases, because "we queued a rebalance" and "member funds are deployed" are
 * different claims and we were only ever checking the first.
 *
 * So this checks the second. For every delegator: are they registered, do they
 * have the staking proxy, and do they actually hold stake? A wallet that has
 * been registered for over 48 hours with free TAO and zero positions is the
 * exact signature of the failures above.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStrategy } from "@/lib/trustedstake";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TS_BASE = "https://api.app.trustedstake.ai/api/v1/manager-api";
const STRATEGY_ID = process.env.TRUSTEDSTAKE_STRATEGY_ID || "";
const RPC = "wss://entrypoint-finney.opentensor.ai:443";

/** Undeployed this long after joining is a fault, not latency. */
const STALE_HOURS = 48;
/** Ignore dust — below this a wallet has nothing to deploy anyway. */
const MIN_TAO = 2;

interface Delegator { walletAddress: string; joinedAt: string; isActive?: boolean; leftAt?: string | null }

export async function GET(req: NextRequest) {
  if (req.headers.get("x-vercel-cron") !== "1") {
    if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const problems: Array<Record<string, unknown>> = [];
  const warnings: string[] = [];
  let checked = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let api: any = null;

  try {
    // ── Strategy-level health ────────────────────────────────────────
    const strategy = await getStrategy().catch(() => null);
    if (!strategy) {
      warnings.push("Could not read strategy from TrustedStake.");
    } else {
      const started = strategy.lastRebalanceStartedAt ? new Date(strategy.lastRebalanceStartedAt).getTime() : 0;
      const hours = started ? (Date.now() - started) / 3_600_000 : null;
      if (strategy.isRebalancing && hours != null && hours > 6) {
        problems.push({ kind: "stuck_rebalance", hours: Number(hours.toFixed(1)), since: strategy.lastRebalanceStartedAt });
      }
      if (hours != null && hours > 8 * 24) {
        problems.push({ kind: "no_recent_rebalance", hours: Number(hours.toFixed(1)) });
      }
      const weights = (strategy.targetConstituents?.subnetWeights ?? {}) as Record<string, number>;
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      if (Object.keys(weights).length === 0) problems.push({ kind: "no_weights_set" });
      else if (sum !== 100) problems.push({ kind: "weights_do_not_sum_to_100", sum });
    }

    // ── Per-delegator: did their money actually get deployed? ────────
    const res = await fetch(`${TS_BASE}/strategies/${STRATEGY_ID}/delegators`, {
      headers: { Authorization: `Bearer ${process.env.TRUSTEDSTAKE_API_KEY}` },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => null);
    const raw = body?.data ?? body;
    const delegators: Delegator[] = Array.isArray(raw) ? raw : (raw?.delegators ?? []);

    if (!delegators.length) {
      warnings.push("Delegator list empty or unreadable — per-member checks skipped.");
    } else {
      const { ApiPromise, WsProvider } = await import("@polkadot/api");
      api = await ApiPromise.create({ provider: new WsProvider(RPC), noInitWarn: true });
      const proxyTarget = strategy?.pureProxyAddress as string | undefined;

      for (const d of delegators) {
        if (d.isActive === false || d.leftAt) continue;
        const addr = d.walletAddress;
        checked++;
        try {
          const acct = await api.query.system.account(addr);
          const freeTao = Number(acct.data.free.toBigInt()) / 1e9;

          const [proxies] = (await api.query.proxy.proxies(addr)).toJSON() as [Array<{ delegate: string; proxyType: string }>, unknown];
          const hasProxy = proxyTarget ? proxies.some(p => p.delegate === proxyTarget) : proxies.length > 0;

          const stakeRaw = await api.call.stakeInfoRuntimeApi.getStakeInfoForColdkey(addr);
          let staked = 0;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const r of ((stakeRaw as any)?.toJSON?.() ?? [])) staked += Number(r.stake) / 1e9;

          const ageHours = (Date.now() - new Date(d.joinedAt).getTime()) / 3_600_000;

          // Registered, funded, past the grace window — and nothing deployed.
          if (staked <= 0.01 && freeTao >= MIN_TAO && ageHours > STALE_HOURS) {
            problems.push({
              kind: "member_funds_undeployed",
              wallet: addr,
              freeTao: Number(freeTao.toFixed(4)),
              joinedAt: d.joinedAt,
              hoursWaiting: Math.round(ageHours),
              hasProxy,
            });
          }
          // Registered but never completed the on-chain half — they will never
          // deploy and nothing tells them so.
          if (!hasProxy && freeTao >= MIN_TAO) {
            problems.push({ kind: "registered_without_proxy", wallet: addr, freeTao: Number(freeTao.toFixed(4)), joinedAt: d.joinedAt });
          }
        } catch (e) {
          warnings.push(`${addr.slice(0, 8)}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), problems, warnings }, { status: 500 });
  } finally {
    await api?.disconnect?.().catch(() => {});
  }

  // Loud, because the whole point is that these stopped being silent.
  for (const p of problems) console.error("[index-health] PROBLEM", JSON.stringify(p));
  if (!problems.length) console.log(`[index-health] OK — ${checked} delegators, all deployed`);

  return NextResponse.json({ ok: problems.length === 0, checked, problems, warnings });
}
