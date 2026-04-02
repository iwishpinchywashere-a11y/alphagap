/**
 * GET /api/admin/refresh-social-scores
 *
 * Zero-cost social score refresh — reads existing blob data only.
 * Recomputes social_score (v3 formula) and adjusts composite_score
 * without making any Desearch, GitHub, or Taostats API calls.
 *
 * Use this whenever heat events have been updated (after social-pulse runs)
 * and you want scores to reflect the latest KOL activity without waiting
 * for the next full scan.
 */

import { NextResponse } from "next/server";
import { get as blobGet, put } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// ── Blob helpers ────────────────────────────────────────────────
async function readBlob<T>(name: string, token: string): Promise<T | null> {
  try {
    const result = await blobGet(name, { token, access: "private" });
    if (!result?.stream) return null;
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch { return null; }
}

// ── Types ────────────────────────────────────────────────────────
interface HeatEvent {
  tweet_id: string; netuid: number; kol_handle: string; heat_score: number; detected_at: string;
}
interface DiscordResult {
  netuid: number | null; signal: "alpha" | "active" | "quiet" | "noise";
  uniquePosters: number; scannedAt: string;
}
interface LeaderboardEntry {
  netuid: number; name: string;
  composite_score: number; social_score: number; dev_score: number;
  [key: string]: unknown;
}

// ── Social Score v3 (mirrors scan/route.ts exactly) ─────────────
// Dedupe to best event per unique KOL — breadth of voices is the signal.
// To hit 90+: 2+ unique KOLs within 4h. To hit 100: 3+ KOLs + discord alpha.
function computeSocialScoreV3(
  netuid: number,
  hotEvents: HeatEvent[],
  discordMap: Map<number, { signal: string; uniquePosters: number; scannedAt: string }>,
  now: number,
): number {
  // Decay all events
  const allDecayed = hotEvents
    .filter(e => e.netuid === netuid)
    .map(e => {
      const hoursOld = (now - new Date(e.detected_at).getTime()) / 3600000;
      const freshness = hoursOld <= 4 ? 1.0 : Math.max(0, 1 - (hoursOld - 4) / 68);
      return { handle: e.kol_handle, heat: Math.round(e.heat_score * freshness), hoursOld };
    })
    .filter(e => e.heat >= 20);

  // Dedupe: best event per unique KOL
  const bestPerKol = new Map<string, { heat: number; hoursOld: number }>();
  for (const e of allDecayed) {
    const prev = bestPerKol.get(e.handle);
    if (!prev || e.heat > prev.heat) bestPerKol.set(e.handle, { heat: e.heat, hoursOld: e.hoursOld });
  }
  const uniqueKols = [...bestPerKol.entries()].sort((a, b) => b[1].heat - a[1].heat);

  // Stack unique voices with steep diminishing returns
  const weights = [0.55, 0.35, 0.20, 0.10];
  let kolPts = 0;
  for (let i = 0; i < Math.min(uniqueKols.length, weights.length); i++) {
    kolPts += uniqueKols[i][1].heat * weights[i];
  }
  kolPts = Math.min(70, Math.round(kolPts));

  // Cluster bonus: multiple DIFFERENT KOLs within 4h
  const recent4hKOLs = uniqueKols.filter(([, v]) => v.hoursOld <= 4).length;
  const clusterBonus = recent4hKOLs >= 3 ? 20 : recent4hKOLs >= 2 ? 10 : 0;

  // Discord freshness (max 18 pts)
  const disc = discordMap.get(netuid);
  let discordPts = 0;
  if (disc) {
    const discAgeHours = (now - new Date(disc.scannedAt).getTime()) / 3600000;
    const discFresh = discAgeHours <= 12 ? 1.0
      : discAgeHours <= 48 ? Math.max(0.4, 1 - (discAgeHours - 12) / 36 * 0.6)
      : 0.4;
    if (disc.signal === "alpha") {
      discordPts = Math.round(Math.min(18, (12 + Math.min(disc.uniquePosters, 6))) * discFresh);
    } else if (disc.signal === "active") {
      discordPts = Math.round(Math.min(10, (5 + Math.min(disc.uniquePosters, 5))) * discFresh);
    }
  }

  if (kolPts === 0 && discordPts === 0) return 0;
  return Math.min(100, Math.max(0, kolPts + clusterBonus + discordPts));
}

// Estimate what the OLD socialGap was (v2 formula) from stored social_score + dev_score.
// socialGap was based on mentions/engagement — we approximate from the stored social score.
function estimateOldSocialGap(oldSocialScore: number, devScore: number): number {
  if (devScore < 20) return 0; // socialGap only applied when devScore >= 20
  // Old social scores without KOL heat: 0 = no mentions, 15 = minimal/fallback, 45 = some organic
  if (oldSocialScore <= 3)  return 15;
  if (oldSocialScore <= 10) return 12;
  if (oldSocialScore <= 20) return 8;
  if (oldSocialScore <= 35) return 4;
  if (oldSocialScore <= 60) return 0;
  return -3; // high social previously penalized the gap slightly
}

// New socialMomentum component (replaces socialGap in aGap formula)
function computeSocialMomentum(socialScore: number): number {
  if (socialScore >= 80) return 20;
  if (socialScore >= 60) return 16;
  if (socialScore >= 40) return 11;
  if (socialScore >= 20) return 5;
  return 0;
}

// ── Route ────────────────────────────────────────────────────────
export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: "no token" }, { status: 500 });

  const [scanData, hotData, discordRaw] = await Promise.all([
    readBlob<{ leaderboard: LeaderboardEntry[]; [k: string]: unknown }>("scan-latest.json", token),
    readBlob<{ events: HeatEvent[] }>("social-hot.json", token),
    readBlob<DiscordResult[]>("discord-latest.json", token),
  ]);

  if (!scanData?.leaderboard?.length) {
    return NextResponse.json({ error: "scan-latest.json missing or empty" }, { status: 404 });
  }

  const hotEvents: HeatEvent[] = hotData?.events ?? [];
  const discordResults: DiscordResult[] = Array.isArray(discordRaw) ? discordRaw : [];

  // Build discord map
  const discordMap = new Map<number, { signal: string; uniquePosters: number; scannedAt: string }>();
  for (const d of discordResults) {
    if (d.netuid && d.netuid > 0) {
      discordMap.set(d.netuid, {
        signal: d.signal,
        uniquePosters: d.uniquePosters,
        scannedAt: d.scannedAt || new Date().toISOString(),
      });
    }
  }

  const now = Date.now();
  let updatedCount = 0;
  let socialChangedCount = 0;

  const updatedLeaderboard = scanData.leaderboard.map(entry => {
    const oldSocial = entry.social_score ?? 0;
    const devScore = entry.dev_score ?? 0;

    // Recompute social score with v3
    const newSocial = computeSocialScoreV3(entry.netuid, hotEvents, discordMap, now);

    // Estimate what old socialGap contributed to composite
    const oldGap = estimateOldSocialGap(oldSocial, devScore);
    const newMomentum = computeSocialMomentum(newSocial);

    // Adjust composite: remove old gap, add new momentum
    const delta = newMomentum - oldGap;
    const newComposite = Math.max(1, Math.min(100, Math.round(entry.composite_score + delta)));

    if (newSocial !== oldSocial) socialChangedCount++;
    if (newComposite !== entry.composite_score) updatedCount++;

    return {
      ...entry,
      social_score: newSocial,
      composite_score: newComposite,
    };
  });

  // Re-sort by composite score
  updatedLeaderboard.sort((a, b) => b.composite_score - a.composite_score);

  // Write back both blobs
  const updatedScan = {
    ...scanData,
    leaderboard: updatedLeaderboard,
    socialRefreshedAt: new Date().toISOString(),
  };

  await Promise.all([
    put("scan-latest.json", JSON.stringify(updatedScan), {
      access: "private", token, allowOverwrite: true,
    }),
    put("scan-prices.json", JSON.stringify(updatedScan), {
      access: "private", token, allowOverwrite: true,
    }),
  ]);

  const topChanged = updatedLeaderboard
    .filter(e => e.social_score > 0)
    .slice(0, 8)
    .map(e => ({ name: e.name, social: e.social_score, agap: e.composite_score }));

  return NextResponse.json({
    ok: true,
    subnetsProcessed: updatedLeaderboard.length,
    socialScoresChanged: socialChangedCount,
    compositeScoresChanged: updatedCount,
    hotEventsUsed: hotEvents.length,
    top: topChanged,
  });
}
