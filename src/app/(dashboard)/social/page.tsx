"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import BlurGate from "@/components/BlurGate";
import { getTier } from "@/lib/subscription";
import { useWatchlist } from "@/components/dashboard/WatchlistProvider";
import SubnetLogo from "@/components/dashboard/SubnetLogo";

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
  alphaTake?: string;
  founderPost?: boolean;
  channelContext?: string;
  channelName?: string;
  subnetName?: string;
  messageCount: number; uniquePosters: number; scannedAt: string; lastActivityAt?: string;
  composite_score: number | null; social_score: number | null;
  releaseHint?: boolean;
}
interface DeletedMessage {
  id: string; messageId: string; channelId: string; channelName: string;
  netuid: number | null; subnetName: string; content: string;
  username: string; postedAt: string; detectedAt: string;
  significant: boolean; sinister: boolean; significance: string;
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
function alphaTypeTag(type: string): string {
  switch (type) {
    case "partnership": return "🤝 partnership";
    case "feature":     return "⚡ feature";
    case "launch":      return "🚀 launch";
    case "dev_update":  return "⎇ dev update";
    case "team":        return "👤 team";
    default:            return type;
  }
}

// ── Score Badge ────────────────────────────────────────────────────
function AlphaScore({ score }: { score: number }) {
  const cls =
    score >= 80 ? "text-green-300 border-green-500/50 bg-green-500/10"
    : score >= 60 ? "text-green-400 border-green-500/40 bg-green-500/8"
    : score >= 40 ? "text-yellow-400 border-yellow-500/40 bg-yellow-500/8"
    : "text-orange-400 border-orange-500/30 bg-orange-500/5";
  return (
    <div className="text-right shrink-0 min-w-[52px]">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border-2 font-bold text-sm tabular-nums ${cls}`}>{score}</div>
      <div className="text-[10px] text-gray-600 mt-0.5 text-center">alpha</div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3.5 hover:border-gray-700 transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base">{icon}</span>
        <div className="text-xs text-gray-500 font-medium">{label}</div>
      </div>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Section Header ─────────────────────────────────────────────────
function SectionHeader({
  icon, title, subtitle, right,
}: { icon: string; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="relative flex items-center justify-between px-5 py-4 bg-gradient-to-r from-green-950/30 via-emerald-950/10 to-transparent border-b border-gray-800/50">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-green-500 to-emerald-600 rounded-l-xl" />
      <div>
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h2 className="font-bold text-white">{title}</h2>
        </div>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5 ml-7">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

// ── Sort Toggle ────────────────────────────────────────────────────
function SortToggle({ value, onChange }: { value: "score" | "latest"; onChange: (v: "score" | "latest") => void }) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-800/80 rounded-lg p-0.5">
      {(["score", "latest"] as const).map(v => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${value === v ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"}`}
        >
          {v === "score" ? "Top Score" : "Latest"}
        </button>
      ))}
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
  const { isWatched, watchlist } = useWatchlist();
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [discordSort, setDiscordSort] = useState<"score" | "latest">("score");
  const [tweetsSort, setTweetsSort] = useState<"score" | "latest">("score");
  const [deletedMessages, setDeletedMessages] = useState<DeletedMessage[]>([]);

  useEffect(() => {
    fetch("/api/social")
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/discord-deleted")
      .then(r => r.json())
      .then((data: { messages: DeletedMessage[] }) => {
        if (Array.isArray(data.messages)) setDeletedMessages(data.messages);
      })
      .catch(() => {/* non-critical */});
  }, []);

  if (loading) return (
    <main className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin mx-auto mb-4" />
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

  const { hotTweets: rawHotTweets, xLeaderboard: rawXLeaderboard, discordLeaderboard: rawDiscordLeaderboard, kolRadar, lastPulse, stats } = data;
  const pulseAge = lastPulse ? Math.floor((Date.now() - new Date(lastPulse).getTime()) / 60000) : null;
  const pulseFresh = pulseAge !== null && pulseAge < 15;

  const discordLeaderboard = (watchlistOnly
    ? rawDiscordLeaderboard.filter(d => watchlist.has(d.netuid))
    : rawDiscordLeaderboard
  ).filter(d => !d.founderPost).slice().sort((a, b) =>
    discordSort === "latest"
      ? new Date(b.lastActivityAt ?? b.scannedAt).getTime() - new Date(a.lastActivityAt ?? a.scannedAt).getTime()
      : (b.alphaScore ?? 0) - (a.alphaScore ?? 0)
  );
  const hotTweets = (watchlistOnly ? rawHotTweets.filter(t => watchlist.has(t.netuid)) : rawHotTweets).slice().sort((a, b) =>
    tweetsSort === "latest"
      ? new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
      : (b.momentum_score ?? b.heat_score) - (a.momentum_score ?? a.heat_score)
  );
  const xLeaderboard = watchlistOnly ? rawXLeaderboard.filter(s => watchlist.has(s.netuid)) : rawXLeaderboard;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden border-b border-gray-800/50">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="absolute -top-20 left-1/4 w-96 h-96 bg-green-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-10 right-1/3 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-screen-xl mx-auto px-4 md:px-6 pt-8 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 via-emerald-300 to-white bg-clip-text text-transparent mb-1">
                📡 Social Intelligence
              </h1>
              <p className="text-gray-500 text-sm max-w-xl">
                Real-time KOL activity, Twitter heat, and Discord alpha across all Bittensor subnets.
              </p>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${pulseFresh ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-gray-800/60 border-gray-700 text-gray-500"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${pulseFresh ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
              {pulseAge !== null ? `Last pulse ${pulseAge}m ago` : "Pulse pending"}
              <span className="text-gray-600 hidden sm:inline">· {stats.tier1Count + stats.tier2Count} KOLs tracked</span>
            </div>
          </div>

          {/* Stats chips */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { val: stats.totalHotEvents,          label: "hot events",      color: "text-green-400" },
              { val: stats.subnetsWithHeat,          label: "subnets buzzing", color: "text-green-400" },
              { val: stats.kolsTracked,              label: "KOLs tracked",    color: "text-blue-400" },
              { val: stats.discordChannelsScanned,   label: "channels scanned",color: "text-purple-400" },
              { val: stats.discordAlphaCount,        label: "alpha signals",   color: "text-yellow-400" },
            ].map(({ val, label, color }) => (
              <span key={label} className="text-xs bg-gray-800/60 border border-gray-700/40 rounded-full px-3 py-1.5 text-gray-400">
                <span className={`font-bold ${color}`}>{val}</span> {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Top 5 Most Buzzing ── */}
      <SocialBuzzLeaderboard
        xLeaderboard={rawXLeaderboard}
        discordLeaderboard={rawDiscordLeaderboard}
        hotTweets={rawHotTweets}
        onNavigate={(netuid) => router.push(`/subnets/${netuid}`)}
      />

      <main className="max-w-screen-xl mx-auto px-4 md:px-6 py-6 space-y-5">

        {/* ── Section Nav ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: "discord",      label: "Discord Alpha",   icon: "💬" },
            ...(deletedMessages.length > 0 ? [{ id: "discord-deleted", label: "Deleted Msgs", icon: "🗑️" }] : []),
            { id: "hot-tweets",   label: "Viral KOL Tweets",icon: "🔥" },
            { id: "x-leaderboard",label: "Top on X",        icon: "𝕏" },
            { id: "kol-radar",    label: "KOL Radar",       icon: "🎯" },
          ].map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-700 text-gray-400 hover:border-green-600/50 hover:text-green-400 transition-colors bg-gray-900/60"
            >
              <span>{icon}</span>{label}
            </button>
          ))}
          <button
            onClick={() => setWatchlistOnly(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              watchlistOnly ? "bg-blue-600 border-blue-500 text-white" : "bg-gray-900/60 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            My Watchlist
          </button>
        </div>

        {/* ── Founder Signal ── */}
        {(() => {
          const founderEntries = rawDiscordLeaderboard.filter(d => d.founderPost);
          if (founderEntries.length === 0) return null;

          const subnetNameMap = new Map<number, string>(rawXLeaderboard.map(e => [e.netuid, e.name]));
          const channelLabel = (entry: typeof founderEntries[0]): string => {
            if (entry.netuid != null && entry.netuid > 0) {
              const name = subnetNameMap.get(entry.netuid);
              if (name) return `${name} Discord`;
            }
            if (entry.subnetName) {
              const stripped = entry.subnetName.replace(/^Const\s*·\s*/i, "").replace(/\s*\(SN\d+\)$/i, "").trim();
              if (stripped) return `${stripped} Discord`;
            }
            const raw = (entry.channelName ?? "").replace(/^founder-const-/, "").replace(/[·・•‧\-_]/g, " ").trim();
            return raw ? `${raw} Discord` : "Bittensor Discord";
          };

          const topScore = Math.max(...founderEntries.map(e => e.alphaScore ?? 0));
          const mostRecentAt = founderEntries.map(e => e.lastActivityAt ?? e.scannedAt).sort().at(-1);

          return (
            <div className="bg-amber-950/20 border border-amber-500/40 rounded-xl overflow-hidden ring-1 ring-amber-500/20 shadow-lg shadow-amber-500/10">
              <div className="relative flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-950/40 via-yellow-950/10 to-transparent border-b border-amber-500/20">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-yellow-600 rounded-l-xl" />
                <div className="flex items-center gap-2">
                  <span className="text-xl">👑</span>
                  <div>
                    <h2 className="font-bold text-amber-300 text-sm">Const · Bittensor Founder</h2>
                    <p className="text-xs text-amber-500/70 mt-0.5">
                      {founderEntries.length === 1
                        ? <>Posted in {channelLabel(founderEntries[0])}{mostRecentAt && ` · ${timeAgo(mostRecentAt)}`}</>
                        : `Posted in ${founderEntries.length} Discord channels`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold tabular-nums leading-none ${topScore >= 70 ? "text-green-400" : "text-yellow-400"}`}>{topScore}</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">alpha score</div>
                </div>
              </div>

              <div className="divide-y divide-amber-500/10">
                {founderEntries.map((entry, idx) => (
                  <div key={idx} className="px-5 py-4">
                    {founderEntries.length > 1 && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">In {channelLabel(entry)}</span>
                        {entry.netuid != null && entry.netuid > 0 && (
                          <span className="text-[10px] text-amber-500/60 bg-amber-900/30 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono leading-none">SN{entry.netuid}</span>
                        )}
                        {(entry.lastActivityAt ?? entry.scannedAt) && (
                          <span className="text-[10px] text-amber-500/50">{timeAgo(entry.lastActivityAt ?? entry.scannedAt!)}</span>
                        )}
                        <span className={`text-[10px] font-bold tabular-nums ml-auto ${(entry.alphaScore ?? 0) >= 70 ? "text-green-400" : "text-yellow-400"}`}>{entry.alphaScore ?? "—"}</span>
                      </div>
                    )}
                    {entry.summary && <p className="text-sm text-gray-100 leading-relaxed mb-2">{entry.summary}</p>}
                    {entry.keyInsights && entry.keyInsights.length > 0 && (
                      <ul className="space-y-1 mb-2">
                        {entry.keyInsights.map((insight, ii) => (
                          <li key={ii} className="flex items-start gap-1.5 text-sm text-gray-300 leading-relaxed">
                            <span className="text-amber-400 mt-0.5 shrink-0">›</span>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {entry.alphaTake && (
                      <div className="border-l-2 border-amber-500/60 bg-amber-500/5 rounded-r-lg px-3 py-2.5">
                        <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">AlphaGap Take</p>
                        <p className="text-xs text-gray-200 leading-relaxed">{entry.alphaTake}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Discord Alpha ── */}
        <div id="discord" className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
          <SectionHeader
            icon="💬"
            title="Discord Alpha"
            subtitle="AI scans every channel — scores quality + quantity of alpha signals"
            right={<SortToggle value={discordSort} onChange={setDiscordSort} />}
          />

          {/* Sneak peek for non-premium */}
          {discordLeaderboard.length > 0 && tier !== "premium" && (() => { const d = discordLeaderboard[0]; return (
            <div className="divide-y divide-gray-800/60 border-b border-gray-800/60">
              <DiscordRow d={d} index={0} isWatched={isWatched(d.netuid)} onSubnetClick={() => router.push(`/subnets/${d.netuid}`)} />
            </div>
          ); })()}

          <BlurGate tier={tier} required="premium" minHeight="200px">
            <div className="divide-y divide-gray-800/60">
              {discordLeaderboard.length === 0 ? (
                <div className="p-8 text-center text-gray-600 text-sm">No Discord data yet — run /api/discord-scan to populate</div>
              ) : discordLeaderboard.map((d, i) => (
                <DiscordRow key={d.netuid} d={d} index={i} isWatched={isWatched(d.netuid)} onSubnetClick={() => router.push(`/subnets/${d.netuid}`)} />
              ))}
            </div>
          </BlurGate>
        </div>

        {/* ── Deleted Discord Messages ── */}
        {deletedMessages.length > 0 && (
          <div id="discord-deleted" className="bg-red-950/20 border border-red-500/30 rounded-xl overflow-hidden ring-1 ring-red-500/10">
            <div className="relative flex items-center justify-between px-5 py-4 bg-gradient-to-r from-red-950/40 via-red-950/10 to-transparent border-b border-red-500/20">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500 to-orange-600 rounded-l-xl" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🗑️</span>
                  <h2 className="font-bold text-red-300">Deleted Discord Messages</h2>
                </div>
                <p className="text-xs text-red-500/60 mt-0.5 ml-7">AI-flagged messages deleted from subnet Discords — potentially significant</p>
              </div>
              <span className="text-xs text-red-400/70 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full font-medium shrink-0">
                {deletedMessages.length} flagged
              </span>
            </div>
            <BlurGate tier={tier} required="premium" minHeight="120px">
              <div className="divide-y divide-red-500/10">
                {deletedMessages.map(msg => (
                  <div key={msg.id} className={`px-5 py-4 hover:bg-red-500/5 transition-colors ${msg.sinister ? "bg-red-950/20" : ""}`}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {msg.netuid != null && (
                          <button onClick={() => router.push(`/subnets/${msg.netuid}`)} className="flex items-center gap-1.5 hover:text-red-300 transition-colors">
                            <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded font-mono">SN{msg.netuid}</span>
                            <span className="font-semibold text-sm text-gray-200">{msg.subnetName}</span>
                          </button>
                        )}
                        {msg.sinister && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-red-500/20 text-red-400 border border-red-500/40 shrink-0">🚨 SINISTER</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-600 shrink-0 whitespace-nowrap">detected {timeAgo(msg.detectedAt)}</span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">@{msg.username} · posted {timeAgo(msg.postedAt)} · then deleted</div>
                    <div className="bg-gray-900/70 border border-red-500/20 rounded-lg px-3 py-2.5 mb-2">
                      <p className="text-[10px] font-bold text-red-500/60 uppercase tracking-widest mb-1.5">Deleted message</p>
                      <p className="text-sm text-gray-200 leading-relaxed">{msg.content}</p>
                    </div>
                    {msg.significance && (
                      <div className="border-l-2 border-red-500/40 bg-red-500/5 rounded-r-lg px-3 py-2">
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Why this was flagged</p>
                        <p className="text-xs text-gray-300 leading-relaxed">{msg.significance}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </BlurGate>
          </div>
        )}

        {/* ── Hot KOL Tweets ── */}
        <div id="hot-tweets" className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
          <SectionHeader
            icon="🔥"
            title="Viral KOL Tweets"
            subtitle="Tier 1 & 2 KOL posts mentioning Bittensor subnets"
            right={
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-600">{hotTweets.length} events</span>
                <SortToggle value={tweetsSort} onChange={setTweetsSort} />
              </div>
            }
          />

          {/* Sneak peek */}
          {hotTweets.length > 0 && tier !== "premium" && (() => { const t = hotTweets[0]; return (
            <div className="overflow-x-auto border-b border-gray-800/60">
              <TweetTable tweets={[t]} expandedTweet={expandedTweet} onExpand={setExpandedTweet} onSubnetClick={(n) => router.push(`/subnets/${n}`)} isWatched={() => false} showHeader />
            </div>
          ); })()}

          <BlurGate tier={tier} required="premium" minHeight="300px">
            {hotTweets.length === 0 ? (
              <div className="p-10 text-center text-gray-600 text-sm">No heat events yet. Pulse runs every 10 minutes — check back soon.</div>
            ) : (
              <div className="overflow-x-auto">
                <TweetTable tweets={hotTweets} expandedTweet={expandedTweet} onExpand={setExpandedTweet} onSubnetClick={(n) => router.push(`/subnets/${n}`)} isWatched={isWatched} showHeader />
              </div>
            )}
          </BlurGate>
        </div>

        {/* ── Top Subnets on X ── */}
        <div id="x-leaderboard" className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
          <SectionHeader
            icon="𝕏"
            title="Top Subnets on X"
            subtitle="Ranked by social score — includes KOL heat boost"
          />
          <BlurGate tier={tier} required="premium" minHeight="200px">
            <div className="divide-y divide-gray-800/60">
              {xLeaderboard.length === 0 ? (
                <div className="p-8 text-center text-gray-600 text-sm">No X data yet</div>
              ) : xLeaderboard.map((s, i) => (
                <div
                  key={s.netuid}
                  className={`px-4 py-3.5 flex items-center gap-3 hover:bg-gray-800/30 cursor-pointer transition-colors ${isWatched(s.netuid) ? "bg-blue-950/40 ring-inset ring-1 ring-blue-400/30" : ""}`}
                  onClick={() => router.push(`/subnets/${s.netuid}`)}
                >
                  <span className="text-xs text-gray-600 w-6 text-right tabular-nums font-mono shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded font-mono">SN{s.netuid}</span>
                      <span className="font-semibold text-sm text-gray-100 truncate">{s.name}</span>
                      {s.kol_boost >= 60 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-green-500/15 text-green-400 border-green-500/30 shrink-0 font-bold">🔥 KOL</span>
                      )}
                    </div>
                    {s.top_kol && (
                      <div className="text-xs text-gray-600 mt-0.5">
                        Top: @{s.top_kol} · {fmtFollowers(s.top_kol_followers)} followers · {s.tweet_count} event{s.tweet_count !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold tabular-nums text-green-400">{s.social_score}</div>
                    <div className={`text-xs tabular-nums ${agapColor(s.composite_score)}`}>aGap {s.composite_score}</div>
                  </div>
                </div>
              ))}
            </div>
          </BlurGate>
        </div>

        {/* ── KOL Radar ── */}
        <div id="kol-radar" className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
          <SectionHeader
            icon="🎯"
            title="KOL Radar"
            subtitle="Most active KOLs covering Bittensor subnets in the last 72h"
          />
          <BlurGate tier={tier} required="premium" minHeight="200px">
            {kolRadar.length === 0 ? (
              <div className="p-8 text-center text-gray-600 text-sm">No KOL activity detected yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-600 border-b border-gray-800 bg-gray-950/40">
                      <th className="px-4 py-2.5 font-semibold uppercase tracking-wide">KOL</th>
                      <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wide">Followers</th>
                      <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wide">Subnets</th>
                      <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wide">Engagement</th>
                      <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wide">Peak Heat</th>
                      <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wide hidden sm:table-cell">Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kolRadar.map((k) => (
                      <tr key={k.handle} className="border-b border-gray-800/60 hover:bg-gray-800/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded border font-bold ${tierBadge(k.tier)}`}>{tierLabel(k.tier)}</span>
                            <div>
                              <a href={`https://x.com/${k.handle}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-medium hover:underline">
                                @{k.handle}
                              </a>
                              <div className="text-xs text-gray-600">{k.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300 tabular-nums font-medium">{fmtFollowers(k.followers)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-white font-bold tabular-nums">{k.subnets.length}</span>
                          <div className="text-xs text-gray-600">SN{k.subnets.slice(0, 3).join(", SN")}{k.subnets.length > 3 ? "…" : ""}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300 tabular-nums font-medium">{fmtEngagement(k.totalEngagement)}</td>
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

      </main>
    </div>
  );
}

// ── Social Buzz Leaderboard ───────────────────────────────────────
function SocialBuzzLeaderboard({
  xLeaderboard,
  discordLeaderboard,
  hotTweets,
  onNavigate,
}: {
  xLeaderboard: XEntry[];
  discordLeaderboard: DiscordEntry[];
  hotTweets: HotTweet[];
  onNavigate: (netuid: number) => void;
}) {
  // Build composite buzz score per subnet
  const buzzMap = new Map<number, {
    netuid: number;
    name: string;
    xScore: number;
    discordScore: number;
    tweetCount: number;
    topKol: string | null;
    topDiscordSignal: "alpha" | "active" | null;
    buzzScore: number;
  }>();

  // Seed from X leaderboard
  for (const x of xLeaderboard) {
    buzzMap.set(x.netuid, {
      netuid: x.netuid,
      name: x.name,
      xScore: x.social_score ?? 0,
      discordScore: 0,
      tweetCount: x.tweet_count ?? 0,
      topKol: x.top_kol,
      topDiscordSignal: null,
      buzzScore: 0,
    });
  }

  // Merge Discord alpha scores
  for (const d of discordLeaderboard) {
    const existing = buzzMap.get(d.netuid);
    const discScore = d.alphaScore ?? 0;
    if (existing) {
      existing.discordScore = discScore;
      if (d.signal === "alpha" || d.signal === "active") {
        existing.topDiscordSignal = d.signal;
      }
    } else {
      buzzMap.set(d.netuid, {
        netuid: d.netuid,
        name: d.name ?? d.subnetName ?? `SN${d.netuid}`,
        xScore: 0,
        discordScore: discScore,
        tweetCount: 0,
        topKol: null,
        topDiscordSignal: d.signal,
        buzzScore: 0,
      });
    }
  }

  // Add heat boost from hot tweets (unique subnets → more tweets = higher buzz)
  for (const t of hotTweets) {
    const existing = buzzMap.get(t.netuid);
    if (existing) {
      existing.tweetCount = Math.max(existing.tweetCount, 1);
    }
  }

  // Compute final buzz score: X (40%) + Discord (40%) + tweet heat bonus (20%)
  const tweetHeatBySubnet = new Map<number, number>();
  for (const t of hotTweets) {
    tweetHeatBySubnet.set(t.netuid, Math.max(tweetHeatBySubnet.get(t.netuid) ?? 0, t.heat_score ?? 0));
  }

  const ranked = [...buzzMap.values()]
    .map(e => ({
      ...e,
      buzzScore: e.xScore * 0.4 + e.discordScore * 0.4 + (tweetHeatBySubnet.get(e.netuid) ?? 0) * 0.2,
    }))
    .filter(e => e.buzzScore > 0)
    .sort((a, b) => b.buzzScore - a.buzzScore)
    .slice(0, 5);

  if (ranked.length === 0) return null;

  const rankColors = ["text-yellow-400", "text-gray-300", "text-orange-400", "text-gray-500", "text-gray-600"];

  return (
    <div className="border-b border-gray-800/50 px-4 md:px-6 py-4 max-w-screen-xl mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full" />
        <span className="text-xs font-bold uppercase tracking-widest text-green-500/80">Most Buzzing Right Now</span>
        <span className="text-[10px] text-gray-600">combined X + Discord heat</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
        {ranked.map((entry, i) => {
          const hasX = entry.xScore > 0;
          const hasDiscord = entry.discordScore > 0;
          const tweetHeat = tweetHeatBySubnet.get(entry.netuid) ?? 0;

          return (
            <button
              key={entry.netuid}
              onClick={() => onNavigate(entry.netuid)}
              className="flex sm:flex-col items-center sm:items-start gap-2.5 sm:gap-2 px-3 py-2.5 rounded-xl bg-gray-900/60 border border-gray-700/50 hover:border-green-500/30 hover:bg-gray-800/60 transition-all text-left group"
            >
              {/* Rank + logo + name */}
              <div className="flex items-center gap-2 w-full">
                <span className={`text-xs font-black tabular-nums flex-shrink-0 ${rankColors[i]}`}>#{i + 1}</span>
                <SubnetLogo netuid={entry.netuid} name={entry.name} size={24} />
                <span className="font-semibold text-white text-xs truncate min-w-0 flex-1 group-hover:text-green-300 transition-colors">{entry.name}</span>
                <span className="text-[10px] text-gray-600 font-mono flex-shrink-0 sm:hidden">SN{entry.netuid}</span>
              </div>

              {/* Signal badges + score */}
              <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                {hasX && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400 flex-shrink-0">
                    𝕏 {entry.xScore}
                  </span>
                )}
                {hasDiscord && entry.topDiscordSignal && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${entry.topDiscordSignal === "alpha" ? "bg-green-500/15 border-green-500/30 text-green-400" : "bg-blue-500/15 border-blue-500/30 text-blue-400"}`}>
                    💬 {entry.topDiscordSignal}
                  </span>
                )}
                {tweetHeat >= 60 && (
                  <span className="text-[10px] flex-shrink-0">{heatFlame(tweetHeat)}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Discord Row (extracted for sneak-peek reuse) ───────────────────
function DiscordRow({ d, index, isWatched, onSubnetClick }: {
  d: DiscordEntry; index: number; isWatched: boolean; onSubnetClick: () => void;
}) {
  return (
    <div className={`px-4 py-3.5 hover:bg-gray-800/30 transition-colors ${isWatched ? "bg-blue-950/40 ring-inset ring-1 ring-blue-400/30" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="text-xs text-gray-600 w-5 text-right tabular-nums mt-1 shrink-0 font-mono">{index + 1}</span>
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <button onClick={onSubnetClick} className="flex items-center gap-1.5 hover:text-green-400 transition-colors">
              <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded font-mono">SN{d.netuid}</span>
              <span className="font-semibold text-sm text-gray-100">{d.name}</span>
            </button>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${discordSignalStyle(d.signal)}`}>{d.signal.toUpperCase()}</span>
            {d.releaseHint && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shrink-0">🚀 RELEASE HINT</span>
            )}
            {d.alphaTypes?.filter((t, i, arr) => arr.indexOf(t) === i).filter(t => t !== "general").map(type => (
              <span key={type} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-400 border border-gray-700 shrink-0">
                {alphaTypeTag(type)}
              </span>
            ))}
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-600 mb-2">
            {d.messageCount} msgs · {d.uniquePosters} posters · {timeAgo(d.lastActivityAt ?? d.scannedAt)}
          </div>

          {/* Summary */}
          {d.summary && <p className="text-sm text-gray-100 leading-relaxed mb-2">{d.summary}</p>}

          {/* Key insights */}
          {d.keyInsights && d.keyInsights.length > 0 && (
            <ul className="space-y-1 mb-2">
              {d.keyInsights.map((insight, ii) => (
                <li key={ii} className="flex items-start gap-1.5 text-sm text-gray-300 leading-relaxed">
                  <span className="text-green-400 mt-0.5 shrink-0">›</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          )}

          {/* AlphaGap Take */}
          {d.alphaTake && (
            <div className="border-l-2 border-green-500/40 bg-green-500/5 rounded-r-lg px-3 py-2.5">
              <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-1">AlphaGap Take</p>
              <p className="text-xs text-gray-200 leading-relaxed">{d.alphaTake}</p>
            </div>
          )}
        </div>

        {/* Score badge */}
        <AlphaScore score={d.alphaScore ?? 0} />
      </div>
    </div>
  );
}

// ── Tweet Table (extracted for sneak-peek reuse) ───────────────────
function TweetTable({ tweets, expandedTweet, onExpand, onSubnetClick, isWatched, showHeader }: {
  tweets: HotTweet[];
  expandedTweet: string | null;
  onExpand: (id: string | null) => void;
  onSubnetClick: (netuid: number) => void;
  isWatched: (netuid: number) => boolean;
  showHeader: boolean;
}) {
  function fmtFollowers(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
  }
  function fmtEng(n: number): string {
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }
  function timeAgoLocal(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <table className="w-full text-sm">
      {showHeader && (
        <thead>
          <tr className="text-left text-xs text-gray-600 border-b border-gray-800 bg-gray-950/40">
            <th className="px-4 py-2.5 font-semibold uppercase tracking-wide w-20">Score</th>
            <th className="px-4 py-2.5 font-semibold uppercase tracking-wide">KOL</th>
            <th className="px-4 py-2.5 font-semibold uppercase tracking-wide">Subnet</th>
            <th className="px-4 py-2.5 font-semibold uppercase tracking-wide hidden lg:table-cell">Tweet</th>
            <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wide">Engagement</th>
            <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wide hidden sm:table-cell">aGap</th>
            <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wide">Time</th>
          </tr>
        </thead>
      )}
      <tbody>
        {tweets.map((t) => {
          const isExpanded = expandedTweet === t.tweet_id;
          const score = t.momentum_score ?? t.heat_score;
          return (
            <tr
              key={t.tweet_id}
              className={`border-b border-gray-800/60 hover:bg-gray-800/30 cursor-pointer transition-colors ${isWatched(t.netuid) ? "bg-blue-950/40 ring-inset ring-1 ring-blue-400/30" : ""}`}
              onClick={() => onExpand(isExpanded ? null : t.tweet_id)}
            >
              {/* Score */}
              <td className="px-4 py-3">
                <div className="flex flex-col items-start gap-1">
                  {t.is_trending_now && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/40 leading-none">🟢 LIVE</span>
                  )}
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold ${heatColor(score)}`}>
                    {score}
                  </div>
                </div>
              </td>

              {/* KOL */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded border font-bold ${tierBadge(t.kol_tier)}`}>{tierLabel(t.kol_tier)}</span>
                  <div>
                    <a href={`https://x.com/${t.kol_handle}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-medium hover:underline" onClick={e => e.stopPropagation()}>
                      @{t.kol_handle}
                    </a>
                    <div className="text-xs text-gray-600">{fmtFollowers(t.kol_followers)} followers</div>
                  </div>
                </div>
              </td>

              {/* Subnet */}
              <td className="px-4 py-3">
                <button className="text-left hover:text-green-400 transition-colors" onClick={e => { e.stopPropagation(); onSubnetClick(t.netuid); }}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded font-mono">SN{t.netuid}</span>
                    <span className="font-medium text-gray-100 text-sm">{t.subnet_name}</span>
                  </div>
                </button>
              </td>

              {/* Tweet */}
              <td className="px-4 py-3 hidden lg:table-cell max-w-xs">
                <div className={`text-xs text-gray-400 leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>{t.tweet_text}</div>
                <a href={t.tweet_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 block" onClick={e => e.stopPropagation()}>
                  {isExpanded ? "Open tweet ↗" : "View on X ↗"}
                </a>
              </td>

              {/* Engagement */}
              <td className="px-4 py-3 text-right">
                <span className="text-white font-bold tabular-nums">{fmtEng(t.engagement)}</span>
                <div className="text-xs text-gray-600">interactions</div>
              </td>

              {/* aGap */}
              <td className="px-4 py-3 text-right hidden sm:table-cell">
                <span className={`font-bold tabular-nums ${agapColor(t.subnet_agap)}`}>{t.subnet_agap ?? "—"}</span>
              </td>

              {/* Time */}
              <td className="px-4 py-3 text-right text-xs text-gray-500 whitespace-nowrap">{timeAgoLocal(t.detected_at)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
