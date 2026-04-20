import { NextResponse } from "next/server";
import { get as blobGet } from "@vercel/blob";
import { KOL_DATABASE } from "@/lib/kol-database";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

interface HeatEvent {
  tweet_id: string; netuid: number; subnet_name: string;
  kol_handle: string; kol_name: string; kol_weight: number; kol_tier: number;
  tweet_text: string; tweet_url: string;
  engagement: number; heat_score: number; detected_at: string;
}
interface SocialHot { events: HeatEvent[]; seen_ids: string[]; last_pulse: string }
interface DiscordResult {
  channelId: string; channelName: string; netuid: number | null; subnetName: string;
  signal: "alpha" | "active" | "quiet" | "noise";
  summary: string; keyInsights: string[];
  messageCount: number; uniquePosters: number; scannedAt: string;
}
interface DiscordOutput {
  scannedAt: string;
  channelsScanned: number;
  channelsWithActivity: number;
  alphaChannels: number;
  results: DiscordResult[];
}
interface LeaderboardEntry {
  netuid: number; name: string; composite_score: number; social_score: number;
  dev_score: number; market_cap?: number; alpha_price?: number;
  price_change_24h?: number; emission_pct?: number;
}

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";

  const [scanLatest, socialHot, discordRaw] = await Promise.all([
    readBlob<{ leaderboard: LeaderboardEntry[] }>("scan-latest.json", token),
    readBlob<SocialHot>("social-hot.json", token),
    readBlob<DiscordOutput>("discord-latest.json", token),
  ]);

  const leaderboard: LeaderboardEntry[] = scanLatest?.leaderboard ?? [];
  const hotEvents: HeatEvent[] = socialHot?.events ?? [];
  const discordData: DiscordResult[] = discordRaw?.results ?? [];

  const leaderMap = new Map(leaderboard.map(s => [s.netuid, s]));

  // ── Hot KOL Tweets — ranked by heat × recency decay ─────────────
  // Raw heat_score only reflects KOL weight + engagement. A 2-day-old tweet
  // with high engagement should NOT outrank a fresh tweet gaining momentum.
  // Decay formula: full score for <3h, fading to 15% at 48h.
  const kolMap = new Map(KOL_DATABASE.map(k => [k.handle.toLowerCase(), k]));
  const now = Date.now();
  function recencyDecay(detectedAt: string): number {
    const ageHours = (now - new Date(detectedAt).getTime()) / 3_600_000;
    if (ageHours < 3)  return 1.00;  // trending now
    if (ageHours < 12) return 0.80;  // same day
    if (ageHours < 24) return 0.60;  // yesterday
    if (ageHours < 48) return 0.35;  // getting old
    return 0.15;                      // nearly expired
  }
  const hotTweets = hotEvents
    .map(e => ({
      ...e,
      kol_followers: kolMap.get(e.kol_handle.toLowerCase())?.followers ?? 0,
      subnet_agap: leaderMap.get(e.netuid)?.composite_score ?? null,
      momentum_score: Math.round(e.heat_score * recencyDecay(e.detected_at)),
      is_trending_now: (now - new Date(e.detected_at).getTime()) < 6 * 3_600_000,
    }))
    .sort((a, b) => b.momentum_score - a.momentum_score)
    .slice(0, 30);

  // ── X/Twitter Leaderboard — top 20 by social_score ──────────────────
  // Attach best heat event per subnet + KOL followers
  const xLeaderboard = leaderboard
    .filter(s => s.social_score > 0)
    .sort((a, b) => b.social_score - a.social_score)
    .slice(0, 20)
    .map(s => {
      const subnetHeat = hotEvents.filter(e => e.netuid === s.netuid);
      const topHeat = subnetHeat.sort((a, b) => b.heat_score - a.heat_score)[0] ?? null;
      const maxHeat = topHeat ? topHeat.heat_score : 0;
      return {
        netuid: s.netuid, name: s.name,
        social_score: s.social_score,
        composite_score: s.composite_score,
        market_cap: s.market_cap ?? null,
        kol_boost: maxHeat,                     // 0 if no heat event
        top_kol: topHeat?.kol_handle ?? null,
        top_kol_followers: topHeat ? (kolMap.get(topHeat.kol_handle.toLowerCase())?.followers ?? 0) : 0,
        tweet_count: subnetHeat.length,
      };
    });

  // ── Discord Leaderboard — top 20 by signal quality ──────────────────
  const signalRank = { alpha: 3, active: 2, quiet: 1, noise: 0 } as const;
  const discordLeaderboard = discordData
    .filter(d => d.netuid !== null && (d.signal === "alpha" || d.signal === "active"))
    .sort((a, b) => {
      const sr = signalRank[b.signal] - signalRank[a.signal];
      if (sr !== 0) return sr;
      // Manual entries (marked with manualEntry flag) sort to top within their signal tier
      const am = (a as any).manualEntry ? 1 : 0;
      const bm = (b as any).manualEntry ? 1 : 0;
      if (bm !== am) return bm - am;
      // Then by alphaScore, then uniquePosters
      const as_ = (a as any).alphaScore ?? 0;
      const bs_ = (b as any).alphaScore ?? 0;
      if (bs_ !== as_) return bs_ - as_;
      return b.uniquePosters - a.uniquePosters;
    })
    .slice(0, 20)
    .map(d => ({
      netuid: d.netuid!,
      name: d.subnetName || leaderMap.get(d.netuid!)?.name || `SN${d.netuid}`,
      signal: d.signal,
      summary: d.summary,
      keyInsights: d.keyInsights ?? [],
      alphaScore: (d as any).alphaScore ?? null,
      alphaTypes: (d as any).alphaTypes ?? [],
      releaseHint: (d as any).releaseHint ?? false,
      manualEntry: (d as any).manualEntry ?? false,
      messageCount: d.messageCount,
      uniquePosters: d.uniquePosters,
      scannedAt: d.scannedAt,
      lastActivityAt: (d as any).lastActivityAt ?? null,
      composite_score: leaderMap.get(d.netuid!)?.composite_score ?? null,
      social_score: leaderMap.get(d.netuid!)?.social_score ?? null,
    }));

  // ── KOL Radar — which KOLs have the most recent heat activity ───────
  const kolActivity = new Map<string, {
    handle: string; name: string; tier: number; weight: number; followers: number;
    subnets: Set<number>; totalEngagement: number; topHeat: number; latestAt: string;
  }>();
  for (const e of hotEvents) {
    const kol = kolMap.get(e.kol_handle.toLowerCase());
    if (!kol) continue;
    const entry = kolActivity.get(e.kol_handle) ?? {
      handle: kol.handle, name: kol.name, tier: kol.tier, weight: kol.weight,
      followers: kol.followers, subnets: new Set<number>(), totalEngagement: 0,
      topHeat: 0, latestAt: e.detected_at,
    };
    entry.subnets.add(e.netuid);
    entry.totalEngagement += e.engagement;
    entry.topHeat = Math.max(entry.topHeat, e.heat_score);
    if (e.detected_at > entry.latestAt) entry.latestAt = e.detected_at;
    kolActivity.set(e.kol_handle, entry);
  }
  const kolRadar = [...kolActivity.values()]
    .sort((a, b) => b.topHeat - a.topHeat || b.totalEngagement - a.totalEngagement)
    .slice(0, 15)
    .map(k => ({ ...k, subnets: [...k.subnets] }));

  // ── Stats ────────────────────────────────────────────────────────────
  const tier1Kols = KOL_DATABASE.filter(k => k.tier === 1);
  const tier2Kols = KOL_DATABASE.filter(k => k.tier === 2);
  const subnetsWithHeat = new Set(hotEvents.map(e => e.netuid)).size;

  return NextResponse.json({
    hotTweets,
    xLeaderboard,
    discordLeaderboard,
    kolRadar,
    lastPulse: socialHot?.last_pulse ?? null,
    stats: {
      totalHotEvents: hotEvents.length,
      subnetsWithHeat,
      kolsTracked: KOL_DATABASE.length,
      tier1Count: tier1Kols.length,
      tier2Count: tier2Kols.length,
      discordChannelsScanned: discordRaw?.channelsScanned ?? discordData.length,
      discordAlphaCount: discordData.filter(d => d.signal === "alpha").length,
      discordActiveCount: discordData.filter(d => d.signal === "active").length,
    },
  });
}
