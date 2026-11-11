/**
 * GET /api/cron/index-health - every 6 hours.
 *
 * Verifies what ACTUALLY happened on chain, not what we asked TrustedStake to
 * do. Every index problem so far reached us through a member complaining:
 *
 *   - a member sat with 100.83 TAO undeployed from Aug 09 to Aug 16, through a
 *     completed rebalance, while a wallet that joined six days later was fully
 *     deployed;
 *   - the strategy sat stuck at isRebalancing = true for 79 hours;
 *   - our own cron skipped a Sunday by 71 seconds;
 *   - (2026-11-11) three members were skipped by every rebalance from Oct 25
 *     to Nov 10. Bittensor's "authorization fix" runtime upgrade moved the
 *     proxy fee consent to proxy.realPaysFeeConsentV1 and dropped the legacy
 *     entries, TrustedStake's engine skips any wallet without the new entry,
 *     and nothing on either side said so. One of them also had 33 TAO
 *     deposited after joining that no rebalance ever deployed.
 *
 * None of those were visible anywhere. Our side reported success in all of
 * them, because "we queued a rebalance" and "member funds are on target" are
 * different claims and we were only ever checking the first.
 *
 * So this checks the second. For every active delegator: do they have the
 * staking proxy, do they have the fee consent, is their money deployed, and
 * does what they hold match the strategy's current target? Plus: did the
 * rebalance we queued actually start?
 */

import { NextRequest, NextResponse } from "next/server";
import { getStrategy } from "@/lib/trustedstake";
import { get as blobGet, put as blobPut } from "@vercel/blob";
import { sendSystemAlertEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TS_BASE = "https://api.app.trustedstake.ai/api/v1/manager-api";
const STRATEGY_ID = process.env.TRUSTEDSTAKE_STRATEGY_ID || "";
const RPC = "wss://entrypoint-finney.opentensor.ai:443";

/** Undeployed this long after joining is a fault, not latency. */
const STALE_HOURS = 48;
/** Ignore dust - below this a wallet has nothing to deploy anyway. */
const MIN_TAO = 2;
/** Free TAO above this on a deployed wallet is a deposit nobody invested. The engine itself parks about 0.5. */
const IDLE_DEPOSIT_TAO = 3;
/** Off-target checks need enough stake to hold every position at all. */
const OFF_TARGET_MIN_STAKE = 5;
/** A non-target position carrying more than this share of managed value is a leftover, not dust. */
const STRAY_SHARE = 0.03;
/** A queued rebalance that has not started after this long never will on its own. */
const QUEUE_GRACE_HOURS = 12;

interface Delegator { walletAddress: string; joinedAt: string; isActive?: boolean; leftAt?: string | null }
interface Problem { kind: string; wallet?: string; [k: string]: unknown }

export async function GET(req: NextRequest) {
  if (req.headers.get("x-vercel-cron") !== "1") {
    if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const problems: Problem[] = [];
  const warnings: string[] = [];
  let checked = 0;
  let onTarget = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let api: any = null;

  try {
    // ── Strategy-level health ────────────────────────────────────────
    const strategy = await getStrategy().catch(() => null);
    let lastRunMs = 0;
    const target: Record<string, number> = (strategy?.targetConstituents?.subnetWeights ?? {}) as Record<string, number>;
    if (!strategy) {
      warnings.push("Could not read strategy from TrustedStake.");
    } else {
      lastRunMs = strategy.lastRebalanceStartedAt ? new Date(strategy.lastRebalanceStartedAt).getTime() : 0;
      const hours = lastRunMs ? (Date.now() - lastRunMs) / 3_600_000 : null;
      if (strategy.isRebalancing && hours != null && hours > 6) {
        problems.push({ kind: "stuck_rebalance", hours: Number(hours.toFixed(1)), since: strategy.lastRebalanceStartedAt });
      }
      if (hours != null && hours > 8 * 24) {
        problems.push({ kind: "no_recent_rebalance", hours: Number(hours.toFixed(1)) });
      }
      const sum = Object.values(target).reduce((a, b) => a + b, 0);
      if (Object.keys(target).length === 0) problems.push({ kind: "no_weights_set" });
      else if (sum !== 100) problems.push({ kind: "weights_do_not_sum_to_100", sum });

      // Did the run WE queued actually start? Our cron records the queue
      // time as rebalancedAt and reports success when the queue accepts it.
      // The Nov 8 12:00 queue did not execute until Nov 10 15:22.
      const queued = await readJson<{ rebalancedAt?: string }>("index-rebalance-latest.json");
      const queuedMs = queued?.rebalancedAt ? new Date(queued.rebalancedAt).getTime() : 0;
      if (queuedMs && Date.now() - queuedMs > QUEUE_GRACE_HOURS * 3_600_000 && lastRunMs < queuedMs) {
        problems.push({ kind: "rebalance_not_executed", queuedAt: queued!.rebalancedAt, hoursWaiting: Math.round((Date.now() - queuedMs) / 3_600_000), lastRunStartedAt: strategy.lastRebalanceStartedAt ?? null });
      }
    }

    // ── Per-delegator: did their money actually get deployed? ────────
    const res = await fetch(`${TS_BASE}/strategies/${STRATEGY_ID}/delegators?activeOnly=true`, {
      headers: { Authorization: `Bearer ${process.env.TRUSTEDSTAKE_API_KEY}` },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => null);
    const raw = body?.data ?? body;
    const delegators: Delegator[] = Array.isArray(raw) ? raw : (raw?.delegators ?? []);

    if (!delegators.length) {
      warnings.push("Delegator list empty or unreadable - per-member checks skipped.");
    } else {
      const { ApiPromise, WsProvider } = await import("@polkadot/api");
      api = await ApiPromise.create({ provider: new WsProvider(RPC), noInitWarn: true });
      const proxyTarget = strategy?.pureProxyAddress as string | undefined;
      const consentMap = api.query.proxy.realPaysFeeConsentV1 ?? api.query.proxy.realPaysFee;
      if (!consentMap?.entries) warnings.push("No fee-consent storage item on this runtime - consent checks skipped.");

      // Price per subnet, cached for the run, so stray positions are judged by value.
      const priceCache = new Map<number, number>();
      const priceOf = async (netuid: number): Promise<number> => {
        if (netuid === 0) return 1;
        const hit = priceCache.get(netuid);
        if (hit != null) return hit;
        try {
          const tao = Number((await api.query.subtensorModule.subnetTAO(netuid)).toString()) / 1e9;
          const alpha = Number((await api.query.subtensorModule.subnetAlphaIn(netuid)).toString()) / 1e9;
          const p = alpha > 0 ? tao / alpha : 0;
          priceCache.set(netuid, p);
          return p;
        } catch { return 0; }
      };

      // First pass: read everything. The managed hotkey is whichever one
      // carries the most positions across members (TrustedStake's validator);
      // members' own stakes on other hotkeys are theirs and are ignored.
      type Row = { d: Delegator; freeTao: number; hasProxy: boolean; consent: boolean | null; positions: Array<{ hotkey: string; netuid: number; alpha: number }> };
      const rows: Row[] = [];
      const hotkeyCount = new Map<string, number>();
      for (const d of delegators) {
        if (d.isActive === false || d.leftAt) continue;
        const addr = d.walletAddress;
        checked++;
        try {
          const acct = await api.query.system.account(addr);
          const freeTao = Number(acct.data.free.toBigInt()) / 1e9;
          const [proxies] = (await api.query.proxy.proxies(addr)).toJSON() as [Array<{ delegate: string; proxyType: string }>, unknown];
          const hasProxy = proxyTarget ? proxies.some(p => p.delegate === proxyTarget) : proxies.length > 0;
          let consent: boolean | null = null;
          if (consentMap?.entries && proxyTarget) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const entries: any[] = await consentMap.entries(addr);
            consent = entries.some(([key]) => (key?.args ?? []).length >= 2 && key.args[1].toString() === proxyTarget);
          }
          const stakeRaw = await api.call.stakeInfoRuntimeApi.getStakeInfoForColdkey(addr);
          const positions: Row["positions"] = [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const r of ((stakeRaw as any)?.toJSON?.() ?? [])) {
            const alpha = Number(r.stake) / 1e9;
            if (alpha <= 0.0001) continue;
            positions.push({ hotkey: String(r.hotkey), netuid: Number(r.netuid), alpha });
            hotkeyCount.set(String(r.hotkey), (hotkeyCount.get(String(r.hotkey)) ?? 0) + 1);
          }
          rows.push({ d, freeTao, hasProxy, consent, positions });
        } catch (e) {
          warnings.push(`${addr.slice(0, 8)}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      const managedHotkey = [...hotkeyCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      // Second pass: judge.
      for (const { d, freeTao, hasProxy, consent, positions } of rows) {
        const addr = d.walletAddress;
        const ageHours = (Date.now() - new Date(d.joinedAt).getTime()) / 3_600_000;
        const managed = managedHotkey ? positions.filter(p => p.hotkey === managedHotkey) : positions;
        let staked = 0;
        const valueBySubnet = new Map<number, number>();
        for (const p of managed) {
          const v = p.alpha * (await priceOf(p.netuid));
          staked += v;
          valueBySubnet.set(p.netuid, (valueBySubnet.get(p.netuid) ?? 0) + v);
        }
        const base = { wallet: addr, joinedAt: d.joinedAt, freeTao: Number(freeTao.toFixed(4)), stakedTao: Number(staked.toFixed(3)) };

        // Registered, funded, past the grace window - and nothing deployed.
        if (staked <= 0.01 && freeTao >= MIN_TAO && ageHours > STALE_HOURS) {
          problems.push({ kind: "member_funds_undeployed", ...base, hoursWaiting: Math.round(ageHours), hasProxy, consent });
        }
        // Registered but never completed the on-chain half - they will never
        // deploy and nothing tells them so.
        if (!hasProxy && freeTao >= MIN_TAO) {
          problems.push({ kind: "registered_without_proxy", ...base });
        }
        // Proxy in place but no fee consent: the engine skips this wallet on
        // every run, with money either deployed and drifting or idle.
        if (hasProxy && consent === false && (staked > 1 || freeTao >= MIN_TAO)) {
          problems.push({ kind: "missing_fee_consent", ...base });
        }
        // Deployed, yet a later deposit is sitting idle. A rebalance moves
        // existing stake; it does not pick up new free TAO on its own.
        if (staked > 1 && freeTao >= IDLE_DEPOSIT_TAO && hasProxy) {
          problems.push({ kind: "deposit_undeployed", ...base });
        }
        // Holdings versus the live target, only where the engine could have
        // acted: proxy and consent present, enough stake, joined before the
        // last run, and that run finished.
        if (
          Object.keys(target).length && hasProxy && consent !== false && staked >= OFF_TARGET_MIN_STAKE
          && lastRunMs && new Date(d.joinedAt).getTime() < lastRunMs && !strategy?.isRebalancing
        ) {
          const missing = Object.keys(target).filter(n => !valueBySubnet.has(Number(n)));
          const stray = [...valueBySubnet.entries()].filter(([n, v]) => target[String(n)] == null && v / staked > STRAY_SHARE).map(([n]) => n);
          if (missing.length || stray.length) {
            problems.push({ kind: "member_off_target", ...base, missingSubnets: missing.map(Number), straySubnets: stray, lastRunStartedAt: strategy?.lastRebalanceStartedAt ?? null });
          } else {
            onTarget++;
          }
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
  if (!problems.length) console.log(`[index-health] OK - ${checked} delegators, ${onTarget} on target`);

  // ── Tell the owner ────────────────────────────────────────────────
  // console.error alone is not an alarm: nobody reads Vercel logs. A member
  // who joined on 2026-08-18 sat 45 days with 2.59 TAO undeployed, flagged by
  // this cron every 6h the whole time, and it surfaced only when someone
  // thought to run the check by hand. Emails go to ADMIN_EMAILS (owner only,
  // never the member), deduped on the set of problems so a persistent issue
  // re-alerts daily rather than four times a day.
  const STATE = "index-health-state.json";
  const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
  const REALERT_MS = 24 * 3600_000;
  const signature = problems.map(p => `${p.kind}:${p.wallet ?? ""}`).sort().join("|");
  try {
    const prev = (await readJson<{ signature?: string; lastAlertAt?: string }>(STATE)) ?? {};
    const since = prev.lastAlertAt ? Date.now() - new Date(prev.lastAlertAt).getTime() : Infinity;
    if (problems.length > 0 && (prev.signature !== signature || since > REALERT_MS)) {
      const lines = problems.map(describe);
      lines.push(`Checked ${checked} delegators; ${onTarget} on the current target.`);
      await sendSystemAlertEmail(`AlphaGap Index: ${problems.length} problem${problems.length > 1 ? "s" : ""} found`, lines);
      await blobPut(STATE, JSON.stringify({ signature, lastAlertAt: new Date().toISOString() }), {
        access: "private", token: TOKEN, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
      });
    } else if (problems.length === 0 && prev.signature) {
      await sendSystemAlertEmail("AlphaGap Index: all members deployed and on target", [
        `The index problems previously reported have cleared. All ${checked} delegators are deployed and ${onTarget} match the current target.`,
      ]);
      await blobPut(STATE, JSON.stringify({ signature: "", lastAlertAt: null }), {
        access: "private", token: TOKEN, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
      });
    }
  } catch (e) {
    console.error("[index-health] alerting failed:", e);
  }

  return NextResponse.json({ ok: problems.length === 0, checked, onTarget, problems, warnings });
}

function describe(p: Problem): string {
  const w = String(p.wallet ?? "");
  const amber = (label: string) => `<strong style="color:#f59e0b;">${label}</strong>`;
  switch (p.kind) {
    case "member_funds_undeployed":
      return `${amber("Member funds undeployed")}: ${w} joined ${String(p.joinedAt).slice(0, 10)}, ${p.hoursWaiting}h ago, holding ${p.freeTao} TAO with nothing staked${p.hasProxy === false ? " (no staking proxy granted)" : p.consent === false ? " (no fee consent)" : ""}.`;
    case "registered_without_proxy":
      return `${amber("Registered without a proxy")}: ${w} is in the delegator list but never granted the staking proxy, so TrustedStake cannot stake for them. They now see a "Finish setup" prompt on /alphagapindex.`;
    case "missing_fee_consent":
      return `${amber("Missing fee consent")}: ${w} has the staking proxy but no proxy.realPaysFeeConsentV1 entry for the strategy proxy, so TrustedStake's engine skips this wallet on every rebalance (${p.stakedTao} TAO staked, ${p.freeTao} TAO free). The member must connect on TrustedStake and sign "Review permissions" under the "Fee permission required" banner. /alphagapindex now shows them this.`;
    case "deposit_undeployed":
      return `${amber("Deposit sitting idle")}: ${w} is deployed (${p.stakedTao} TAO staked) but holds ${p.freeTao} TAO free. Rebalances move existing stake and do not invest new deposits; this needs an allocation on TrustedStake.`;
    case "member_off_target":
      return `${amber("Member off target")}: ${w} (${p.stakedTao} TAO staked) is missing target subnets ${JSON.stringify(p.missingSubnets)} and holds stray positions ${JSON.stringify(p.straySubnets)} after the run that started ${String(p.lastRunStartedAt ?? "?").slice(0, 16)}. The engine did not act on this wallet.`;
    case "rebalance_not_executed":
      return `${amber("Queued rebalance never started")}: we queued a rebalance at ${String(p.queuedAt).slice(0, 16)} (${p.hoursWaiting}h ago) and TrustedStake's last run started ${String(p.lastRunStartedAt ?? "never").slice(0, 16)}. Ask TrustedStake, or POST /api/admin/trigger-index-rebalance to queue again.`;
    case "stuck_rebalance":
      return `${amber("Rebalance stuck")}: the strategy has reported isRebalancing for ${p.hours}h (since ${String(p.since).slice(0, 16)}).`;
    case "no_recent_rebalance":
      return `${amber("No recent rebalance")}: TrustedStake's last run started ${p.hours}h ago.`;
    default:
      return `${amber(p.kind)}: ${JSON.stringify(p)}`;
  }
}

async function readJson<T>(name: string): Promise<T | null> {
  const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
  try {
    const b = await blobGet(name, { token: TOKEN, access: "private", abortSignal: AbortSignal.timeout(8000) });
    if (!b?.stream) return null;
    const r = b.stream.getReader(); const cs: Uint8Array[] = [];
    while (true) { const { done, value } = await r.read(); if (done) break; cs.push(value); }
    return JSON.parse(Buffer.concat(cs).toString("utf-8"));
  } catch { return null; }
}
