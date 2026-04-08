"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import BlurGate from "@/components/BlurGate";
import { getTier } from "@/lib/subscription";

// ── Types ──────────────────────────────────────────────────────────
interface HotTweet {
  tweet_id: string; netuid: number; subnet_name: string;
  kol_handle: string; kol_name: string; kol_weight: number; kol_tier: number;
  kol_followers: number; tweet_text: string; tweet_url: string;
  engagement: number; heat_score: number; momentum_score: number;
  is_trending_now: boolean; detected_at: string;
  subnet_agap: number | null;
}
interface XEntry {
  netuid: number; name: string; social_score: number; composite_score: number;
  market_cap: number | null; kol_boost: number;
  top_kol: string | null; top_kol_followers: number; tweet_count: number;
}
interface DiscordEntry {
  netuid: number; name: string; signal: "alpha" | "active";
  alphaScore: number;
  alphaTypes?: string[];
  summary: string; keyInsights: string[];
  messageCount: number; uniquePosters: number; scannedAt: string; lastActivityAt?: string;
  composite_score: number | null; social_score: number | null;
  releaseHint?: boolean;
}
interface KolRadarEntry {
  handle: string; name: string; tier: number; weight: number; followers: number;
  subnets: number[]; totalEngagement: number; topHeat: number; latestAt: string;
}
interface SocialStats {
  totalHotEvents: number; subnetsWithHeat: number; kolsTracked: number;
  tier1Count: number; tier2Count: number;
  discordChannelsScanned: number; discordAlphaCount: number; discordActiveCount: number;
}
interface SocialData {
  hotTweets: HotTweet[]; xLeaderboard: XEntry[];
  discordLeaderboard: DiscordEntry[]; kolRadar: KolRadarEntry[];
  lastPulse: string | null; stats: SocialStats;
}

// ── Helpers ────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
function fmtEngagement(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function fmtMcap(v: number | null): string {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function heatColor(score: number): string {
  if (score >= 90) return "text-green-300 bg-green-500/20 border-green-500/40";
  if (score >= 75) return "text-green-400 bg-green-500/15 border-green-500/30";
  if (score >= 60) return "text-yellow-300 bg-yellow-500/15 border-yellow-500/30";
  if (score >= 40) return "text-orange-400 bg-orange-500/10 border-orange-500/20";
  return "text-gray-400 bg-gray-800 border-gray-700";
}
function heatFlame(score: number): string {
  if (score >= 90) return "🔥🔥🔥";
  if (score >= 75) return "🔥🔥";
  if (score >= 50) return "🔥";
  return "·";
}
function tierBadge(tier: number): string {
  if (tier === 1) return "bg-green-500/20 text-green-400 border-green-500/40";
  if (tier === 2) return "bg-blue-500/20 text-blue-400 border-blue-500/40";
  return "bg-gray-700 text-gray-400 border-gray-600";
}
function tierLabel(tier: number): string {
  if (tier === 1) return "T1";
  if (tier === 2) return "T2";
  return "T3";
}
function discordSignalStyle(signal: string): string {
  if (signal === "alpha") return "bg-green-500/20 text-green-400 border border-green-500/40";
  if (signal === "active") return "bg-blue-500/20 text-blue-400 border border-blue-500/40";
  return "bg-gray-800 text-gray-500 border border-gray-700";
}
function agapColor(score: number | null): string {
  if (score == null) return "text-gray-600";
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  if (score >= 35) return "text-orange-400";
  return "text-gray-500";
}

// ── Stat Card ──────────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-lg px-4 py-3">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="text-xl font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────
export default function SocialPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const tier = getTier(session);
  const [data, setData] = useState<SocialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTweet, setExpandedTweet] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/social")
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <main className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl animate-spin mb-4 text-green-400">⟳</div>
        <p className="text-gray-500 text-sm">Loading social intelligence…</p>
      </div>
    </main>
  );

  if (error || !data) return (
    <main className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-gray-400">Failed to load social data</p>
        <p className="text-gray-600 text-sm mt-1">{error}</p>
      </div>
    </main>
  );

  const { hotTweets, xLeaderboard, discordLeaderboard, kolRadar, lastPulse, stats } = data;
  const pulseAge = lastPulse ? Math.floor((Date.now() - new Date(lastPulse).getTime()) / 60000) : null;

  return (
    <main className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-screen-xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Social Intelligence</h1>
            <p className="text-sm text-gray-500 mt-1">
              Real-time KOL activity, Twitter heat, and Discord alpha across all Bittensor subnets.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2 py-1 rounded-full border font-medium ${pulseAge !== null && pulseAge < 15 ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-gray-800 border-gray-700 text-gray-500"}`}>
              {pulseAge !== null ? `⚡ Last pulse ${pulseAge}m ago` : "⚡ Pulse pending"}
            </span>
            <span className="text-gray-600">Checking {stats.tier1Count + stats.tier2Count} KOLs every 10 min</span>
          </div>
        </div>

        {/* ── Section Nav ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: "discord", label: "Discord Alpha", icon: "💬" },
            { id: "hot-tweets", label: "Viral KOL Tweets", icon: "🔥" },
            { id: "x-leaderboard", label: "Top on X", icon: "𝕏" },
            { id: "kol-radar", label: "KOL Radar", icon: "📡" },
          ].map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white transition-colors bg-gray-900/60"
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* ── Stats Bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard label="Hot Events" value={stats.totalHotEvents} sub="last 72h" />
          <StatCard label="Subnets Buzzing" value={stats.subnetsWithHeat} sub="have KOL heat" />
          <StatCard label="KOLs Tracked" value={stats.kolsTracked} sub={`T1: ${stats.tier1Count} · T2: ${stats.tier2Count}`} />
          <StatCard label="Discord Scanned" value={stats.discordChannelsScanned} sub="subnet channels" />
          <StatCard label="Discord Alpha" value={stats.discordAlphaCount} sub="channels signalling" />
          <StatCard label="Discord Active" value={stats.discordActiveCount} sub="channels engaged" />
        </div>

        {/* ── Discord Alpha ── */}
        <div id="discord" className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="font-bold text-white">💬 Discord Alpha</h2>
            <p className="text-xs text-gray-500 mt-0.5">AI scans every channel — scores quality + quantity of alpha signals</p>
          </div>
          {/* Sneak peek: top 1 entry visible to all tiers */}
          {discordLeaderboard.length > 0 && tier !== "premium" && (() => { const d = discordLeaderboard[0]; return (
            <div className="divide-y divide-gray-800/60">
              <div className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-600 w-5 text-right tabular-nums mt-0.5 shrink-0">1</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => router.push(`/subnets/${d.netuid}`)} className="flex items-center gap-1.5 hover:text-green-400 transition-colors">
                        <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded font-mono">SN{d.netuid}</span>
                        <span className="font-semibold text-sm text-gray-200">{d.name}</span>
                      </button>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${discordSignalStyle(d.signal)}`}>{d.signal.toUpperCase()}</span>
                      {d.releaseHint && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shrink-0">🚀 RELEASE HINT</span>}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">{d.messageCount} msgs · {d.uniquePosters} posters · {timeAgo(d.lastActivityAt ?? d.scannedAt)}</div>
                    {d.summary && <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{d.summary}</p>}
                    {d.keyInsights && d.keyInsights.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {d.keyInsights.slice(0, 2).map((insight, ii) => (
                          <li key={ii} className="flex items-start gap-1.5 text-xs text-gray-500 leading-relaxed">
                            <span className="text-green-500 mt-0.5 shrink-0">›</span><span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="text-right shrink-0 min-w-[48px]">
                    <div className={`text-lg font-bold tabular-nums leading-none ${(d.alphaScore ?? 0) >= 70 ? "text-green-400" : (d.alphaScore ?? 0) >= 45 ? "text-yellow-400" : "text-orange-400"}`}>{d.alphaScore ?? "—"}</div>
                    <div className="text-[10px] text-gray-600 mt-0.5">alpha</div>
                  </div>
                </div>
              </div>
            </div>
          ); })()}
          <BlurGate tier={tier} required="premium" minHeight="200px">
          <div className="divide-y divide-gray-800/60">
            {discordLeaderboard.length === 0 ? (
              <div className="p-6 text-center text-gray-600 text-sm">No Discord data yet — run /api/discord-scan to populate</div>
            ) : discordLeaderboard.map((d, i) => (
              <div
                key={d.netuid}
                className="px-4 py-3 hover:bg-gray-800/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-600 w-5 text-right tabular-nums mt-0.5 shrink-0">{i + 1}</span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => router.push(`/subnets/${d.netuid}`)}
                        className="flex items-center gap-1.5 hover:text-green-400 transition-colors"
                      >
                        <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded font-mono">SN{d.netuid}</span>
                        <span className="font-semibold text-sm text-gray-200">{d.name}</span>
                      </button>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${discordSignalStyle(d.signal)}`}>
                        {d.signal.toUpperCase()}
                      </span>
                      {d.releaseHint && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shrink-0">
                          🚀 RELEASE HINT
                        </span>
                      )}
                      {d.alphaTypes?.filter((t, i, arr) => arr.indexOf(t) === i).filter(t => t !== "general").map(type => (
                        <span key={type} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 border border-gray-700 shrink-0">
                          {type === "partnership" ? "🤝 partnership" :
                           type === "feature" ? "⚡ feature" :
                           type === "launch" ? "🚀 launch" :
                           type === "dev_update" ? "⎇ dev update" :
                           type === "team" ? "👤 team" : type}
                        </span>
                      ))}
                    </div>

                    <div className="text-xs text-gray-600 mt-0.5">
                      {d.messageCount} msgs · {d.uniquePosters} posters · {timeAgo(d.lastActivityAt ?? d.scannedAt)}
                    </div>

                    {d.summary && (
                      <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{d.summary}</p>
                    )}

                    {d.keyInsights && d.keyInsights.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {d.keyInsights.map((insight, ii) => (
                          <li key={ii} className="flex items-start gap-1.5 text-xs text-gray-500 leading-relaxed">
                            <span className="text-green-500 mt-0.5 shrink-0">›</span>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="text-right shrink-0 min-w-[48px]">
                    <div className={`text-lg font-bold tabular-nums leading-none ${
                      (d.alphaScore ?? 0) >= 70 ? "text-green-400" :
                      (d.alphaScore ?? 0) >= 45 ? "text-yellow-400" :
                      (d.alphaScore ?? 0) >= 20 ? "text-orange-400" :
                      "text-gray-600"
                    }`}>
                      {d.alphaScore ?? "—"}
                    </div>
                    <div className="text-[10px] text-gray-600 mt-0.5">alpha</div>
                    {d.composite_score != null && (
                      <>
                        <div className={`text-xs font-semibold tabular-nums mt-1 ${agapColor(d.composite_score)}`}>{d.composite_score}</div>
                        <div className="text-[10px] text-gray-600">aGap</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          </BlurGate>
        </div>

        {/* ── Hot KOL Tweets ── */}
        <div id="hot-tweets" className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-white">🔥 Viral KOL Tweets</h2>
              <p className="text-xs text-gray-500 mt-0.5">Tier 1 &amp; 2 KOL posts mentioning Bittensor subnets — sorted by heat score</p>
            </div>
            <span className="text-xs text-gray-600">{hotTweets.length} events</span>
          </div>

          {/* Sneak peek: top 1 tweet visible to all tiers */}
          {hotTweets.length > 0 && tier !== "premium" && (() => { const t = hotTweets[0]; return (
            <div className="overflow-x-auto border-b border-gray-800/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-600 border-b border-gray-800">
                    <th className="px-4 py-2.5 w-16">Score</th>
                    <th className="px-4 py-2.5">KOL</th>
                    <th className="px-4 py-2.5">Subnet</th>
                    <th className="px-4 py-2.5 hidden lg:table-cell">Tweet</th>
                    <th className="px-4 py-2.5 text-right">Engagement</th>
                    <th className="px-4 py-2.5 text-right hidden sm:table-cell">aGap</th>
                    <th className="px-4 py-2.5 text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800/60 hover:bg-gray-800/30 cursor-pointer transition-colors" onClick={() => setExpandedTweet(expandedTweet === t.tweet_id ? null : t.tweet_id)}>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-0.5">
                        {t.is_trending_now && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/40 leading-none">🟢 LIVE</span>}
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold ${heatColor(t.momentum_score ?? t.heat_score)}`}>{t.momentum_score ?? t.heat_score}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold ${tierBadge(t.kol_tier)}`}>{tierLabel(t.kol_tier)}</span>
                        <div>
                          <a href={`https://x.com/${t.kol_handle}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline font-medium" onClick={e => e.stopPropagation()}>@{t.kol_handle}</a>
                          <div className="text-xs text-gray-600">{fmtFollowers(t.kol_followers)} followers</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-left hover:text-green-400 transition-colors" onClick={e => { e.stopPropagation(); router.push(`/subnets/${t.netuid}`); }}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded font-mono">SN{t.netuid}</span>
                          <span className="font-medium text-gray-200 text-sm">{t.subnet_name}</span>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell max-w-xs">
                      <div className={`text-xs text-gray-400 leading-relaxed ${expandedTweet === t.tweet_id ? "" : "truncate"}`}>{t.tweet_text}</div>
                      <a href={t.tweet_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 block" onClick={e => e.stopPropagation()}>View on X ↗</a>
                    </td>
                    <td className="px-4 py-3 text-right"><span className="text-xs text-gray-300 font-medium">{fmtEngagement(t.engagement)}</span></td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell"><span className={`text-xs font-semibold ${agapColor(t.subnet_agap)}`}>{t.subnet_agap ?? "—"}</span></td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500 whitespace-nowrap">{timeAgo(t.detected_at)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ); })()}
          <BlurGate tier={tier} required="premium" minHeight="300px">
          {hotTweets.length === 0 ? (
            <div className="p-8 text-center text-gray-600 text-sm">
              No heat events yet. Pulse runs every 10 minutes — check back soon.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-600 border-b border-gray-800">
                    <th className="px-4 py-2.5 w-16">Score</th>
                    <th className="px-4 py-2.5">KOL</th>
                    <th className="px-4 py-2.5">Subnet</th>
                    <th className="px-4 py-2.5 hidden lg:table-cell">Tweet</th>
                    <th className="px-4 py-2.5 text-right">Engagement</th>
                    <th className="px-4 py-2.5 text-right hidden sm:table-cell">aGap</th>
                    <th className="px-4 py-2.5 text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {hotTweets.map((t) => {
                    const isExpanded = expandedTweet === t.tweet_id;
                    return (
                      <tr
                        key={t.tweet_id}
                        className="border-b border-gray-800/60 hover:bg-gray-800/30 cursor-pointer transition-colors"
                        onClick={() => setExpandedTweet(isExpanded ? null : t.tweet_id)}
                      >
                        {/* Momentum Score */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-0.5">
                            {t.is_trending_now && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/40 leading-none">🟢 LIVE</span>
                            )}
                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold ${heatColor(t.momentum_score ?? t.heat_score)}`}>
                              {t.momentum_score ?? t.heat_score}
                            </div>
                          </div>
                        </td>

                        {/* KOL */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold ${tierBadge(t.kol_tier)}`}>
                              {tierLabel(t.kol_tier)}
                            </span>
                            <div>
                              <a
                                href={`https://x.com/${t.kol_handle}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline font-medium"
                                onClick={e => e.stopPropagation()}
                              >
                                @{t.kol_handle}
                              </a>
                              <div className="text-xs text-gray-600">{fmtFollowers(t.kol_followers)} followers</div>
                            </div>
                          </div>
                        </td>

                        {/* Subnet */}
                        <td className="px-4 py-3">
                          <button
                            className="text-left hover:text-green-400 transition-colors"
                            onClick={e => { e.stopPropagation(); router.push(`/subnets/${t.netuid}`); }}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded font-mono">SN{t.netuid}</span>
                              <span className="font-medium text-gray-200 text-sm">{t.subnet_name}</span>
                            </div>
                          </button>
                        </td>

                        {/* Tweet preview */}
                        <td className="px-4 py-3 hidden lg:table-cell max-w-xs">
                          <div className={`text-xs text-gray-400 leading-relaxed ${isExpanded ? "" : "truncate"}`}>
                            {t.tweet_text}
                          </div>
                          {!isExpanded && (
                            <a
                              href={t.tweet_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline mt-0.5 block"
                              onClick={e => e.stopPropagation()}
                            >
                              View on X ↗
                            </a>
                          )}
                          {isExpanded && (
                            <a
                              href={t.tweet_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline mt-1 inline-block"
                              onClick={e => e.stopPropagation()}
                            >
                              Open tweet ↗
                            </a>
                          )}
                        </td>

                        {/* Engagement */}
                        <td className="px-4 py-3 text-right">
                          <span className="text-white font-semibold tabular-nums">{fmtEngagement(t.engagement)}</span>
                          <div className="text-xs text-gray-600">interactions</div>
                        </td>

                        {/* aGap */}
                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                          <span className={`font-bold tabular-nums ${agapColor(t.subnet_agap)}`}>
                            {t.subnet_agap ?? "—"}
                          </span>
                        </td>

                        {/* Time */}
                        <td className="px-4 py-3 text-right text-xs text-gray-500 whitespace-nowrap">
                          {timeAgo(t.detected_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </BlurGate>
        </div>

        {/* ── Top Subnets on X ── */}
        <div id="x-leaderboard" className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="font-bold text-white">𝕏 Top Subnets on X</h2>
            <p className="text-xs text-gray-500 mt-0.5">Ranked by social score — includes KOL heat boost</p>
          </div>
          <BlurGate tier={tier} required="premium" minHeight="200px">
          <div className="divide-y divide-gray-800/60">
            {xLeaderboard.length === 0 ? (
              <div className="p-6 text-center text-gray-600 text-sm">No X data yet</div>
            ) : xLeaderboard.map((s, i) => (
              <div
                key={s.netuid}
                className="px-4 py-3 flex items-center gap-3 hover:bg-gray-800/30 cursor-pointer transition-colors"
                onClick={() => router.push(`/subnets/${s.netuid}`)}
              >
                <span className="text-xs text-gray-600 w-5 text-right tabular-nums">{i + 1}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded font-mono">SN{s.netuid}</span>
                    <span className="font-medium text-sm text-gray-200 truncate">{s.name}</span>
                    {s.kol_boost >= 60 && (
                      <span className="text-xs px-1.5 py-0.5 rounded border bg-green-500/15 text-green-400 border-green-500/30 shrink-0">
                        KOL 🔥
                      </span>
                    )}
                  </div>
                  {s.top_kol && (
                    <div className="text-xs text-gray-600 mt-0.5">
                      Top: @{s.top_kol} · {fmtFollowers(s.top_kol_followers)} followers · {s.tweet_count} event{s.tweet_count !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="text-base font-bold tabular-nums text-green-400">{s.social_score}</div>
                  <div className={`text-xs tabular-nums ${agapColor(s.composite_score)}`}>aGap {s.composite_score}</div>
                </div>
              </div>
            ))}
          </div>
          </BlurGate>
        </div>

        {/* ── KOL Radar ── */}
        <div id="kol-radar" className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="font-bold text-white">📡 KOL Radar</h2>
            <p className="text-xs text-gray-500 mt-0.5">Which KOLs have been most active about Bittensor subnets in the last 72h</p>
          </div>
          <BlurGate tier={tier} required="premium" minHeight="200px">
          {kolRadar.length === 0 ? (
            <div className="p-6 text-center text-gray-600 text-sm">No KOL activity detected yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-600 border-b border-gray-800">
                    <th className="px-4 py-2.5">KOL</th>
                    <th className="px-4 py-2.5 text-right">Followers</th>
                    <th className="px-4 py-2.5 text-right">Subnets Covered</th>
                    <th className="px-4 py-2.5 text-right">Total Engagement</th>
                    <th className="px-4 py-2.5 text-right">Peak Heat</th>
                    <th className="px-4 py-2.5 text-right hidden sm:table-cell">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {kolRadar.map((k) => (
                    <tr key={k.handle} className="border-b border-gray-800/60 hover:bg-gray-800/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold ${tierBadge(k.tier)}`}>
                            {tierLabel(k.tier)}
                          </span>
                          <div>
                            <a
                              href={`https://x.com/${k.handle}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline font-medium"
                            >
                              @{k.handle}
                            </a>
                            <div className="text-xs text-gray-600">{k.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 tabular-nums">{fmtFollowers(k.followers)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-white font-semibold tabular-nums">{k.subnets.length}</span>
                        <div className="text-xs text-gray-600">
                          SN{k.subnets.slice(0, 3).join(", SN")}{k.subnets.length > 3 ? "…" : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 tabular-nums">{fmtEngagement(k.totalEngagement)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold tabular-nums text-sm ${heatColor(k.topHeat).split(" ")[0]}`}>
                          {k.topHeat} {heatFlame(k.topHeat)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500 hidden sm:table-cell">{timeAgo(k.latestAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </BlurGate>
        </div>


      </div>
    </main>
  );
}
