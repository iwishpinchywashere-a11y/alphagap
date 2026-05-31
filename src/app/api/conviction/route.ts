/**
 * GET /api/conviction
 * Fetches on-chain conviction lock data from SubnetRadar's public API
 * and merges it with AlphaGap's aGap scores for cross-referenced insights.
 */

import { NextResponse } from "next/server";
import { get as blobGet } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

interface ConvictionLocker {
  coldkey: string;
  hotkey: string;
  lockedAlpha: number;
  unlockedAlpha: number;
  convictionAlpha: number;
  isOwner: boolean;
  lockType: "perpetual" | "decaying";
  lastUpdate: number;
  walletTotalAlpha?: number;
}

interface ConvictionRow {
  netuid: number;
  name: string;
  priceUsd: number;
  totalLockedAlpha: number;
  totalUnlockedAlpha: number;
  totalConvictionAlpha: number;
  ownerCutAutoLock: boolean;
  observedAtBlock: number;
  king: ConvictionLocker;
  lockers: ConvictionLocker[];
  // Enriched by us
  agap_score?: number;
  invest_score?: number;
  composite_score?: number;
  whale_signal?: string | null;
  emission_pct?: number;
  market_cap?: number;
  agap_signal?: "strong_buy" | "buy" | "watch" | "neutral";
}

interface ConvictionEvent {
  kind: string;
  netuid: number;
  name: string;
  hotkey: string;
  coldkey: string;
  amountAlpha: number;
  deltaAlpha: number;
  observedAtBlock: number;
  t: number;
}

interface SubnetRadarResponse {
  rows: ConvictionRow[];
  observedAtBlock: number;
  events: ConvictionEvent[];
  taoPrice: number;
  eurRate: number;
  cached: boolean;
}

interface LeaderboardEntry {
  netuid: number;
  name: string;
  composite_score: number;
  invest_agap?: number;
  whale_signal?: string | null;
  emission_pct?: number;
  market_cap?: number;
}

async function readBlob<T>(name: string): Promise<T | null> {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN || "";
    const result = await blobGet(name, { token, access: "private" });
    if (!result?.stream) return null;
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch { return null; }
}

function computeSignal(investScore?: number, lockedAlpha?: number, lockType?: string): ConvictionRow["agap_signal"] {
  if (!investScore || !lockedAlpha) return "neutral";
  const isPerp = lockType === "perpetual";
  const bigLock = lockedAlpha >= 50000;
  if (investScore >= 70 && isPerp && bigLock) return "strong_buy";
  if (investScore >= 55 && (isPerp || bigLock)) return "buy";
  if (investScore >= 40) return "watch";
  return "neutral";
}

export async function GET() {
  const [srData, scanData] = await Promise.all([
    fetch("https://subnetradar.com/api/alpha/conviction", {
      headers: { "User-Agent": "AlphaGap/1.0" },
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 300 }, // cache 5 min
    }).then(r => r.ok ? r.json() as Promise<SubnetRadarResponse> : null).catch(() => null),
    readBlob<{ leaderboard: LeaderboardEntry[] }>("scan-latest.json"),
  ]);

  if (!srData) {
    return NextResponse.json({ error: "Conviction data unavailable" }, { status: 503 });
  }

  const scoreMap = new Map<number, LeaderboardEntry>();
  for (const s of scanData?.leaderboard ?? []) {
    scoreMap.set(s.netuid, s);
  }

  // Enrich each row with aGap data
  const enriched: ConvictionRow[] = srData.rows
    .filter(r => r.totalLockedAlpha > 0)
    .sort((a, b) => b.totalConvictionAlpha - a.totalConvictionAlpha)
    .map(row => {
      const s = scoreMap.get(row.netuid);
      const investScore = s?.invest_agap;
      const signal = computeSignal(investScore, row.totalLockedAlpha, row.king?.lockType);
      return {
        ...row,
        agap_score: s?.composite_score,
        invest_score: s?.invest_agap,
        composite_score: s?.composite_score,
        whale_signal: s?.whale_signal ?? null,
        emission_pct: s?.emission_pct,
        market_cap: s?.market_cap,
        agap_signal: signal,
      };
    });

  // Network-level stats
  const totalLockedAlpha = enriched.reduce((s, r) => s + r.totalLockedAlpha, 0);
  const totalConvictionAlpha = enriched.reduce((s, r) => s + r.totalConvictionAlpha, 0);
  const totalUnlockedAlpha = enriched.reduce((s, r) => s + r.totalUnlockedAlpha, 0);
  const totalLockers = enriched.reduce((s, r) => s + r.lockers.length, 0);
  const ownerLockedAlpha = enriched
    .filter(r => r.king?.isOwner)
    .reduce((s, r) => s + r.totalLockedAlpha, 0);
  const decayingAlpha = enriched
    .filter(r => r.king?.lockType === "decaying")
    .reduce((s, r) => s + r.totalLockedAlpha, 0);

  // Strong conviction signals: where aGap invest score aligns with heavy locking
  const topSignals = enriched
    .filter(r => r.agap_signal === "strong_buy" || r.agap_signal === "buy")
    .slice(0, 5);

  return NextResponse.json({
    rows: enriched,
    network: {
      totalLockedAlpha,
      totalConvictionAlpha,
      totalUnlockedAlpha,
      totalLockers,
      subnetCount: enriched.length,
      ownerLockedAlpha,
      decayingAlpha,
      decayingPct: totalLockedAlpha > 0 ? Math.round((decayingAlpha / totalLockedAlpha) * 100) : 0,
    },
    events: srData.events ?? [],
    topSignals,
    observedAtBlock: srData.observedAtBlock,
    taoPrice: srData.taoPrice,
    eurRate: srData.eurRate,
  });
}
