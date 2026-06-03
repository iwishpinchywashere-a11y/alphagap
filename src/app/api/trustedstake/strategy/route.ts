/**
 * GET /api/trustedstake/strategy
 *
 * Public endpoint. Fetches live strategy data, APY, and AUM from TrustedStake
 * public APIs and returns a combined payload for the AlphaGap Index page.
 *
 * Cached for 5 minutes (revalidate: 300).
 */

import { NextResponse } from "next/server";

export const revalidate = 300;

const TS_STRATEGY_ID = "97d1325b-9ee9-4bd1-bd58-893d707f85c4";
const TS_PUBLIC_BASE = "https://api.app.trustedstake.ai/api/v1";

export async function GET() {
  try {
    const [strategyRes, apyRes, aumRes] = await Promise.allSettled([
      fetch(`${TS_PUBLIC_BASE}/custom-strategies/${TS_STRATEGY_ID}`, {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`${TS_PUBLIC_BASE}/tmc-apy/${TS_STRATEGY_ID}`, {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`${TS_PUBLIC_BASE}/aum-snapshots/summary?strategyType=custom`, {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(10000),
      }),
    ]);

    // Strategy
    let name = "AlphaGap Subnet Index";
    let constituents: Record<string, number> = {};
    let proxyAddress = "5CeJG2T47NxUAAc42q2zoU7qV1YFy4khL3ogHxooVjNKxUuw";
    let strategyTable = "custom_strategies";
    let lastUpdated: string | null = null;

    if (strategyRes.status === "fulfilled" && strategyRes.value.ok) {
      const d = await strategyRes.value.json();
      const s = d.data ?? d;
      name = s.name ?? name;
      constituents = s.targetConstituents?.subnetWeights ?? {};
      proxyAddress = s.pureProxyAddress ?? proxyAddress;
      strategyTable = s.strategyTable ?? strategyTable;
      lastUpdated = s.updatedAt ?? null;
    }

    // APY
    let apy: number | null = null;
    if (apyRes.status === "fulfilled" && apyRes.value.ok) {
      const d = await apyRes.value.json();
      const raw = d.data?.apy ?? d.apy ?? null;
      if (raw != null) apy = Number(raw);
    }

    // AUM + delegators
    let aumTao: number | null = null;
    let delegatorsTotal: number | null = null;
    if (aumRes.status === "fulfilled" && aumRes.value.ok) {
      const d = await aumRes.value.json();
      const list: Array<{ strategyId?: string; aumTao?: number; totalDelegators?: number }> =
        d.data ?? d.strategies ?? d ?? [];
      const entry = Array.isArray(list)
        ? list.find((e) => e.strategyId === TS_STRATEGY_ID)
        : null;
      if (entry) {
        aumTao = entry.aumTao ?? null;
        delegatorsTotal = entry.totalDelegators ?? null;
      }
    }

    return NextResponse.json({
      strategyId: TS_STRATEGY_ID,
      name,
      apy,
      aumTao,
      delegatorsTotal,
      constituents,
      proxyAddress,
      strategyTable,
      lastUpdated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
