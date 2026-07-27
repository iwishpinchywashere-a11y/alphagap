"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import BlurGate from "@/components/BlurGate";
import AgIcon from "@/components/AgIcon";
import { getTier, canAccessPremium } from "@/lib/subscription";
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
  if (score >= 90) return "text-emerald-300 bg-emerald-500/15 border-emerald-500/40";
  if (score >= 75) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  if (score >= 60) return "text-yellow-300 bg-yellow-500/10 border-yellow-500/30";
  if (score >= 40) return "text-orange-400 bg-orange-500/10 border-orange-500/20";
  return "text-[#9aa39e] bg-white/[0.04] border-white/[0.08]";
}
function HeatFlames({ score }: { score: number }) {
  const n = score >= 90 ? 3 : score >= 75 ? 2 : score >= 50 ? 1 : 0;
  if (n === 0) return <span>·</span>;
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {Array.from({ length: n }).map((_, i) => (
        <AgIcon key={i} name="flame" className="w-3 h-3" />
      ))}
    </span>
  );
}
function tierBadge(tier: number): string {
  if (tier === 1) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/35";
  if (tier === 2) return "bg-blue-500/10 text-blue-400 border-blue-500/35";
  return "bg-white/[0.04] text-[#9aa39e] border-white/[0.14]";
}
function tierLabel(tier: number): string {
  if (tier === 1) return "T1";
  if (tier === 2) return "T2";
  return "T3";
}
function discordSignalStyle(signal: string): string {
  if (signal === "alpha") return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/35";
  if (signal === "active") return "bg-blue-500/10 text-blue-400 border border-blue-500/35";
  return "bg-white/[0.04] text-[#5d665f] border border-white/[0.08]";
}
function agapColor(score: number | null): string {
  if (score == null) return "text-[#5d665f]";
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-yellow-400";
  if (score >= 35) return "text-orange-400";
  return "text-[#9aa39e]";
}
function alphaTypeTag(type: string): React.ReactNode {
  const withIcon = (icon: React.ComponentProps<typeof AgIcon>["name"], label: string) => (
    <span className="inline-flex items-center gap-1">
      <AgIcon name={icon} className="w-3 h-3" /> {label}
    </span>
  );
  switch (type) {
    case "partnership": return withIcon("users", "partnership");
    case "feature":     return withIcon("bolt", "feature");
    case "launch":      return withIcon("rocket", "launch");
    case "dev_update":  return "⎇ dev update";
    case "team":        return withIcon("users", "team");
    default:            return type;
  }
}
function monogram(name: string, handle: string): string {
  const fromName = name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return fromName || handle.slice(0, 2).toUpperCase();
}

// ── Score Badge ────────────────────────────────────────────────────
function AlphaScore({ score }: { score: number }) {
  const cls =
    score >= 80 ? "text-emerald-300 border-emerald-500/50 bg-emerald-500/10"
    : score >= 60 ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/[0.06]"
    : score >= 40 ? "text-yellow-400 border-yellow-500/40 bg-yellow-500/[0.06]"
    : "text-orange-400 border-orange-500/30 bg-orange-500/5";
  return (
    <div className="text-right shrink-0 min-w-[52px]">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border font-mono font-semibold text-sm tabular-nums ${cls}`}>{score}</div>
      <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-[#5d665f] mt-1 text-center">alpha</div>
    </div>
  );
}

// ── Section Header ─────────────────────────────────────────────────
function SectionHeader({
  icon, title, subtitle, right,
}: { icon: React.ReactNode; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.08]">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h2 className="font-display font-semibold text-white text-[17px] tracking-tight">{title}</h2>
        </div>
        {subtitle && <p className="text-xs text-[#5d665f] mt-0.5 ml-7">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

// ── Sort Toggle ────────────────────────────────────────────────────
function SortToggle({ value, onChange }: { value: "score" | "latest"; onChange: (v: "score" | "latest") => void }) {
  return (
    <div className="ag-pill-tabs" style={{ padding: 3 }}>
      {(["score", "latest"] as const).map(v => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`ag-pill-tab ${value === v ? "ag-pill-tab-on" : ""}`}
          style={{ padding: "6px 14px", fontSize: "11.5px" }}
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
  const [searchQuery, setSearchQuery] = useState("");
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
    <main className="flex-1 flex items-center justify-center bg-[#07090b]">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#5d665f] text-sm">Loading social intelligence…</p>
      </div>
    </main>
  );

  if (error || !data) return (
    <main className="flex-1 flex items-center justify-center bg-[#07090b]">
      <div className="text-center">
        <AgIcon name="warning" className="w-10 h-10 text-red-400 mb-4 mx-auto" />
        <p className="text-[#9aa39e]">Failed to load social data</p>
        <p className="text-[#5d665f] text-sm mt-1">{error}</p>
      </div>
    </main>
  );

  const { hotTweets: rawHotTweets, xLeaderboard: rawXLeaderboard, discordLeaderboard: rawDiscordLeaderboard, kolRadar } = data;

  const subnetMatchesSearch = (name: string | undefined, netuid: number | null | undefined) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase().replace(/^sn/i, "");
    return (name ?? "").toLowerCase().includes(q) || String(netuid ?? "").includes(q);
  };

  const discordLeaderboard = (watchlistOnly
    ? rawDiscordLeaderboard.filter(d => watchlist.has(d.netuid))
    : rawDiscordLeaderboard
  ).filter(d => !d.founderPost && subnetMatchesSearch(d.name, d.netuid)).slice().sort((a, b) =>
    discordSort === "latest"
      ? new Date(b.lastActivityAt ?? b.scannedAt).getTime() - new Date(a.lastActivityAt ?? a.scannedAt).getTime()
      : (b.alphaScore ?? 0) - (a.alphaScore ?? 0)
  );
  const hotTweets = (watchlistOnly ? rawHotTweets.filter(t => watchlist.has(t.netuid)) : rawHotTweets)
    .filter(t => subnetMatchesSearch(t.subnet_name, t.netuid))
    .slice().sort((a, b) =>
      tweetsSort === "latest"
        ? new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
        : (b.momentum_score ?? b.heat_score) - (a.momentum_score ?? a.heat_score)
    );
  const xLeaderboard = (watchlistOnly ? rawXLeaderboard.filter(s => watchlist.has(s.netuid)) : rawXLeaderboard)
    .filter(s => subnetMatchesSearch(s.name, s.netuid));

  return (
    <div className="min-h-screen bg-[#07090b] text-white ag-aurora">

      {/* ── Hero Header ── */}
      <div className="relative">
        <div className="max-w-screen-xl mx-auto px-4 md:px-6 pt-10 pb-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl md:text-[40px] font-semibold tracking-[-0.03em] mb-2 leading-tight">
                Social <span className="ag-gradient-text">Radar</span>
              </h1>
              <p className="text-[#9aa39e] text-sm md:text-[14.5px] max-w-xl leading-relaxed mb-3">
                Real-time KOL activity, Twitter heat, and Discord alpha across all Bittensor subnets.
              </p>
            </div>
            <button
              onClick={() => {
                const q = `Based on current social signals: What are the top 3 most actionable alpha opportunities in Bittensor right now? Look at KOL tweet activity, Discord alpha channels, and subnet momentum. Give me specific subnets with reasoning.`;
                router.push(`/oracle?q=${encodeURIComponent(q)}`);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border bg-violet-500/[0.07] border-violet-500/30 text-violet-300 hover:bg-violet-500/15 transition-colors text-xs font-medium backdrop-blur-xl"
            >
              <AgIcon name="oracle" className="w-3.5 h-3.5" /> Ask Oracle
            </button>
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
        <div className="flex items-center gap-3 flex-wrap">
          <div className="ag-pill-tabs flex-wrap" style={{ padding: 4 }}>
            {([
              { id: "discord",      label: "Discord Alpha",   icon: <AgIcon name="chat" className="w-3.5 h-3.5" /> },
              ...(deletedMessages.length > 0 ? [{ id: "discord-deleted", label: "Deleted Msgs", icon: <AgIcon name="warning" className="w-3.5 h-3.5" /> }] : []),
              { id: "hot-tweets",   label: "Viral KOL Tweets",icon: <AgIcon name="flame" className="w-3.5 h-3.5" /> },
              { id: "x-leaderboard",label: "Top on X",        icon: "𝕏" },
              { id: "kol-radar",    label: "KOL Radar",       icon: <AgIcon name="target" className="w-3.5 h-3.5" /> },
            ] as { id: string; label: string; icon: React.ReactNode }[]).map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="ag-pill-tab inline-flex items-center"
                style={{ padding: "7px 14px", fontSize: "12px" }}
              >
                <span className="mr-1.5 inline-flex items-center">{icon}</span>{label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setWatchlistOnly(v => !v)}
            className={`ag-pill-tab flex items-center gap-1.5 border border-white/[0.08] ${watchlistOnly ? "ag-pill-tab-on" : ""}`}
            style={{ padding: "8px 14px", fontSize: "12px" }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            My Watchlist
          </button>

          {/* Search bar */}
          <div className="relative flex items-center ml-auto">
            <svg className="absolute left-3 w-3.5 h-3.5 text-[#5d665f] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search subnet…"
              className="pl-8 pr-7 py-2 rounded-full text-xs bg-white/[0.035] border border-white/[0.08] text-[#eef2f0] placeholder-[#5d665f] focus:outline-none focus:border-emerald-500/40 w-40 backdrop-blur-xl transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 text-[#5d665f] hover:text-[#eef2f0]">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>

        {/* ── Founder Signal ── */}
        {(() => {
          const founderEntries = rawDiscordLeaderboard
            .filter(d => d.founderPost && subnetMatchesSearch(d.name, d.netuid));
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
            <div className="bg-amber-500/[0.04] border border-amber-500/40 rounded-[20px] overflow-hidden ring-1 ring-amber-500/20 shadow-lg shadow-amber-500/10 backdrop-blur-xl">
              <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-500/[0.08] via-transparent to-transparent border-b border-amber-500/20">
                <div className="flex items-center gap-2.5">
                  <AgIcon name="crown" className="w-5 h-5 text-amber-300" />
                  <div>
                    <h2 className="font-display font-semibold text-amber-300 text-sm tracking-tight">Const · Bittensor Founder</h2>
                    <p className="text-xs text-amber-500/70 mt-0.5">
                      {founderEntries.length === 1
                        ? <>Posted in {channelLabel(founderEntries[0])}{mostRecentAt && ` · ${timeAgo(mostRecentAt)}`}</>
                        : `Posted in ${founderEntries.length} Discord channels`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-display text-2xl font-semibold tabular-nums leading-none ${topScore >= 70 ? "text-emerald-400" : "text-yellow-400"}`}>{topScore}</div>
                  <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-[#5d665f] mt-1">alpha score</div>
                </div>
              </div>

              <div className="divide-y divide-amber-500/10">
                {founderEntries.map((entry, idx) => (
                  <div key={idx} className="px-5 py-4">
                    {founderEntries.length > 1 && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">In {channelLabel(entry)}</span>
                        {entry.netuid != null && entry.netuid > 0 && (
                          <span className="text-[10px] text-amber-500/60 bg-amber-500/[0.08] border border-amber-500/20 px-1.5 py-0.5 rounded font-mono leading-none">SN{entry.netuid}</span>
                        )}
                        {(entry.lastActivityAt ?? entry.scannedAt) && (
                          <span className="text-[10px] text-amber-500/50 font-mono">{timeAgo(entry.lastActivityAt ?? entry.scannedAt!)}</span>
                        )}
                        <span className={`text-[10px] font-bold tabular-nums ml-auto font-mono ${(entry.alphaScore ?? 0) >= 70 ? "text-emerald-400" : "text-yellow-400"}`}>{entry.alphaScore ?? "—"}</span>
                      </div>
                    )}
                    {entry.summary && <p className="text-sm text-gray-100 leading-relaxed mb-2">{entry.summary}</p>}
                    {entry.keyInsights && entry.keyInsights.length > 0 && (
                      <ul className="space-y-1 mb-2">
                        {entry.keyInsights.map((insight, ii) => (
                          <li key={ii} className="flex items-start gap-1.5 text-sm text-[#c6cdc9] leading-relaxed">
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
        <div id="discord" className="ag-glass overflow-hidden">
          <SectionHeader
            icon={<AgIcon name="chat" className="w-4.5 h-4.5 text-emerald-400" />}
            title="Discord Alpha"
            subtitle="AI scans every channel — scores quality + quantity of alpha signals"
            right={<SortToggle value={discordSort} onChange={setDiscordSort} />}
          />

          {/* Sneak peek for non-premium */}
          {/* !canAccessPremium (NOT tier !== "premium") — the string check
              showed the sneak-peek to ULTRA users too, duplicating card #1 */}
          {discordLeaderboard.length > 0 && !canAccessPremium(tier) && (() => { const d = discordLeaderboard[0]; return (
            <div className="divide-y divide-white/[0.06] border-b border-white/[0.06]">
              <DiscordRow d={d} index={0} isWatched={isWatched(d.netuid)} onSubnetClick={() => router.push(`/subnets/${d.netuid}`)} />
            </div>
          ); })()}

          <BlurGate tier={tier} required="premium" minHeight="200px">
            <div className="divide-y divide-white/[0.06]">
              {discordLeaderboard.length === 0 ? (
                <div className="p-8 text-center text-[#5d665f] text-sm">No Discord data yet — run /api/discord-scan to populate</div>
              ) : discordLeaderboard.map((d, i) => (
                <DiscordRow key={d.netuid} d={d} index={i} isWatched={isWatched(d.netuid)} onSubnetClick={() => router.push(`/subnets/${d.netuid}`)} />
              ))}
            </div>
          </BlurGate>
        </div>

        {/* ── Deleted Discord Messages ── */}
        {deletedMessages.length > 0 && (
          <div id="discord-deleted" className="bg-red-500/[0.03] border border-red-500/30 rounded-[20px] overflow-hidden ring-1 ring-red-500/10 backdrop-blur-xl">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-red-500/[0.07] via-transparent to-transparent border-b border-red-500/20">
              <div>
                <div className="flex items-center gap-2">
                  <AgIcon name="warning" className="w-4.5 h-4.5 text-red-300" />
                  <h2 className="font-display font-semibold text-red-300 text-[17px] tracking-tight">Deleted Discord Messages</h2>
                </div>
                <p className="text-xs text-red-500/60 mt-0.5 ml-7">AI-flagged messages deleted from subnet Discords — potentially significant</p>
              </div>
              <span className="font-mono text-[11px] text-red-400/70 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full shrink-0">
                {deletedMessages.length} flagged
              </span>
            </div>
            <BlurGate tier={tier} required="premium" minHeight="120px">
              <div className="divide-y divide-red-500/10">
                {deletedMessages.map(msg => (
                  <div key={msg.id} className={`px-5 py-4 hover:bg-red-500/5 transition-colors ${msg.sinister ? "bg-red-500/[0.05]" : ""}`}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {msg.netuid != null && (
                          <button onClick={() => router.push(`/subnets/${msg.netuid}`)} className="flex items-center gap-1.5 hover:text-red-300 transition-colors">
                            <span className="font-mono text-[10.5px] text-[#5d665f] bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 rounded">SN{msg.netuid}</span>
                            <span className="font-semibold text-sm text-gray-200">{msg.subnetName}</span>
                          </button>
                        )}
                        {msg.sinister && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-red-500/20 text-red-400 border border-red-500/40 shrink-0 inline-flex items-center gap-1"><AgIcon name="warning" className="w-3 h-3" /> SINISTER</span>
                        )}
                      </div>
                      <span className="font-mono text-[10.5px] text-[#5d665f] shrink-0 whitespace-nowrap">detected {timeAgo(msg.detectedAt)}</span>
                    </div>
                    <div className="font-mono text-[11px] text-[#5d665f] mb-2">@{msg.username} · posted {timeAgo(msg.postedAt)} · then deleted</div>
                    <div className="bg-white/[0.03] border border-red-500/20 rounded-xl px-3 py-2.5 mb-2">
                      <p className="text-[10px] font-bold text-red-500/60 uppercase tracking-widest mb-1.5">Deleted message</p>
                      <p className="text-sm text-gray-200 leading-relaxed">{msg.content}</p>
                    </div>
                    {msg.significance && (
                      <div className="border-l-2 border-red-500/40 bg-red-500/5 rounded-r-lg px-3 py-2">
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Why this was flagged</p>
                        <p className="text-xs text-[#c6cdc9] leading-relaxed">{msg.significance}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </BlurGate>
          </div>
        )}

        {/* ── Hot KOL Tweets ── */}
        <div id="hot-tweets">
          <div className="flex items-center justify-between gap-3 mb-4 mt-2">
            <div>
              <h2 className="font-display font-semibold text-white text-lg tracking-tight flex items-center gap-2">
                <AgIcon name="flame" className="w-5 h-5 text-emerald-400" />Viral KOL Tweets
              </h2>
              <p className="text-xs text-[#5d665f] mt-0.5 ml-7">Tier 1 & 2 KOL posts mentioning Bittensor subnets</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-[#5d665f]">{hotTweets.length} events</span>
              <SortToggle value={tweetsSort} onChange={setTweetsSort} />
            </div>
          </div>

          {/* Sneak peek */}
          {hotTweets.length > 0 && !canAccessPremium(tier) && (() => { const t = hotTweets[0]; return (
            <div className="mb-4">
              <TweetTable tweets={[t]} expandedTweet={expandedTweet} onExpand={setExpandedTweet} onSubnetClick={(n) => router.push(`/subnets/${n}`)} isWatched={() => false} showHeader />
            </div>
          ); })()}

          <BlurGate tier={tier} required="premium" minHeight="300px">
            {hotTweets.length === 0 ? (
              <div className="ag-glass p-10 text-center text-[#5d665f] text-sm">No heat events yet. Pulse runs every 10 minutes — check back soon.</div>
            ) : (
              <TweetTable tweets={hotTweets} expandedTweet={expandedTweet} onExpand={setExpandedTweet} onSubnetClick={(n) => router.push(`/subnets/${n}`)} isWatched={isWatched} showHeader />
            )}
          </BlurGate>
        </div>

        {/* ── Top Subnets on X ── */}
        <div id="x-leaderboard" className="ag-glass overflow-hidden">
          <SectionHeader
            icon="𝕏"
            title="Top Subnets on X"
            subtitle="Ranked by social score — includes KOL heat boost"
          />
          <BlurGate tier={tier} required="premium" minHeight="200px">
            <div className="divide-y divide-white/[0.06]">
              {xLeaderboard.length === 0 ? (
                <div className="p-8 text-center text-[#5d665f] text-sm">No X data yet</div>
              ) : xLeaderboard.map((s, i) => (
                <div
                  key={s.netuid}
                  className={`px-4 py-3.5 flex items-center gap-3 hover:bg-white/[0.03] cursor-pointer transition-colors ${isWatched(s.netuid) ? "bg-blue-950/40 ring-inset ring-1 ring-blue-400/30" : ""}`}
                  onClick={() => router.push(`/subnets/${s.netuid}`)}
                >
                  <span className={`font-display text-lg font-semibold w-7 text-right tabular-nums shrink-0 ${i === 0 ? "text-emerald-400 [text-shadow:0_0_18px_rgba(52,211,153,.35)]" : "text-[#5d665f]"}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10.5px] text-[#5d665f] bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 rounded">SN{s.netuid}</span>
                      <span className="font-semibold text-sm text-gray-100 truncate">{s.name}</span>
                      {s.kol_boost >= 60 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shrink-0 font-bold inline-flex items-center gap-1"><AgIcon name="flame" className="w-3 h-3" /> KOL</span>
                      )}
                    </div>
                    {s.top_kol && (
                      <div className="font-mono text-[11px] text-[#5d665f] mt-0.5">
                        Top: @{s.top_kol} · {fmtFollowers(s.top_kol_followers)} followers · {s.tweet_count} event{s.tweet_count !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-base font-semibold tabular-nums text-emerald-400">{s.social_score}</div>
                    <div className={`font-mono text-[11px] tabular-nums ${agapColor(s.composite_score)}`}>aGap {s.composite_score}</div>
                  </div>
                </div>
              ))}
            </div>
          </BlurGate>
        </div>

        {/* ── KOL Radar ── */}
        <div id="kol-radar" className="ag-glass overflow-hidden">
          <SectionHeader
            icon={<AgIcon name="target" className="w-4.5 h-4.5 text-emerald-400" />}
            title="KOL Radar"
            subtitle="Most active KOLs covering Bittensor subnets in the last 72h"
          />
          <BlurGate tier={tier} required="premium" minHeight="200px">
            {kolRadar.length === 0 ? (
              <div className="p-8 text-center text-[#5d665f] text-sm">No KOL activity detected yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left font-mono text-[10px] text-[#5d665f] border-b border-white/[0.08] bg-white/[0.02]">
                      <th className="px-4 py-2.5 font-medium uppercase tracking-[0.16em]">KOL</th>
                      <th className="px-4 py-2.5 text-right font-medium uppercase tracking-[0.16em]">Followers</th>
                      <th className="px-4 py-2.5 text-right font-medium uppercase tracking-[0.16em]">Subnets</th>
                      <th className="px-4 py-2.5 text-right font-medium uppercase tracking-[0.16em]">Engagement</th>
                      <th className="px-4 py-2.5 text-right font-medium uppercase tracking-[0.16em]">Peak Heat</th>
                      <th className="px-4 py-2.5 text-right font-medium uppercase tracking-[0.16em] hidden sm:table-cell">Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kolRadar.map((k) => (
                      <tr key={k.handle} className="border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${tierBadge(k.tier)}`}>{tierLabel(k.tier)}</span>
                            <div>
                              <a href={`https://x.com/${k.handle}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 font-medium hover:underline">
                                @{k.handle}
                              </a>
                              <div className="text-xs text-[#5d665f]">{k.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-[#c6cdc9] tabular-nums font-mono text-[13px]">{fmtFollowers(k.followers)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-white font-semibold tabular-nums font-mono text-[13px]">{k.subnets.length}</span>
                          <div className="font-mono text-[10px] text-[#5d665f]">SN{k.subnets.slice(0, 3).join(", SN")}{k.subnets.length > 3 ? "…" : ""}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-[#c6cdc9] tabular-nums font-mono text-[13px]">{fmtEngagement(k.totalEngagement)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold tabular-nums font-mono text-[13px] ${heatColor(k.topHeat).split(" ")[0]}`}>
                            {k.topHeat} <HeatFlames score={k.topHeat} />
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[11px] text-[#5d665f] hidden sm:table-cell">{timeAgo(k.latestAt)}</td>
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

  const rankColors = ["text-emerald-400", "text-gray-300", "text-orange-400", "text-[#5d665f]", "text-[#5d665f]"];

  return (
    <div className="px-4 md:px-6 py-5 max-w-screen-xl mx-auto">
      <div className="flex items-baseline gap-2.5 mb-3">
        <h2 className="font-display font-semibold text-white text-lg tracking-tight">Most Buzzing Right Now</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5d665f]">combined X + Discord heat</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {ranked.map((entry, i) => {
          const hasX = entry.xScore > 0;
          const hasDiscord = entry.discordScore > 0;
          const tweetHeat = tweetHeatBySubnet.get(entry.netuid) ?? 0;

          return (
            <button
              key={entry.netuid}
              onClick={() => onNavigate(entry.netuid)}
              className="ag-glass ag-glass-hover flex sm:flex-col items-center sm:items-start gap-2.5 sm:gap-2.5 px-4 py-3 text-left group"
            >
              {/* Rank + logo + name */}
              <div className="flex items-center gap-2 w-full">
                <span className={`font-display text-sm font-semibold tabular-nums flex-shrink-0 ${rankColors[i]} ${i === 0 ? "[text-shadow:0_0_18px_rgba(52,211,153,.35)]" : ""}`}>#{i + 1}</span>
                <SubnetLogo netuid={entry.netuid} name={entry.name} size={24} />
                <span className="font-semibold text-white text-xs truncate min-w-0 flex-1 group-hover:text-emerald-300 transition-colors">{entry.name}</span>
                <span className="font-mono text-[10px] text-[#5d665f] flex-shrink-0 sm:hidden">SN{entry.netuid}</span>
              </div>

              {/* Signal badges + score */}
              <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                {hasX && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[#9aa39e] flex-shrink-0">
                    𝕏 {entry.xScore}
                  </span>
                )}
                {hasDiscord && entry.topDiscordSignal && (
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${entry.topDiscordSignal === "alpha" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-blue-500/10 border-blue-500/30 text-blue-400"}`}>
                    <span className="inline-flex items-center gap-1"><AgIcon name="chat" className="w-3 h-3" /> {entry.topDiscordSignal}</span>
                  </span>
                )}
                {tweetHeat >= 60 && (
                  <span className="text-[10px] flex-shrink-0 text-orange-400"><HeatFlames score={tweetHeat} /></span>
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
    <div className={`px-4 py-3.5 hover:bg-white/[0.03] transition-colors ${isWatched ? "bg-blue-950/40 ring-inset ring-1 ring-blue-400/30" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="font-display text-sm font-semibold text-[#5d665f] w-5 text-right tabular-nums mt-1 shrink-0">{index + 1}</span>
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <button onClick={onSubnetClick} className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
              <span className="font-mono text-[10.5px] text-[#5d665f] bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 rounded">SN{d.netuid}</span>
              <span className="font-semibold text-sm text-gray-100">{d.name}</span>
            </button>
            <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-[0.08em] shrink-0 ${discordSignalStyle(d.signal)}`}>{d.signal.toUpperCase()}</span>
            {d.releaseHint && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-yellow-500/15 text-yellow-300 border border-yellow-500/40 shrink-0 inline-flex items-center gap-1"><AgIcon name="rocket" className="w-3 h-3" /> RELEASE HINT</span>
            )}
            {d.alphaTypes?.filter((t, i, arr) => arr.indexOf(t) === i).filter(t => t !== "general").map(type => (
              <span key={type} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.04] text-[#9aa39e] border border-white/[0.08] shrink-0">
                {alphaTypeTag(type)}
              </span>
            ))}
          </div>

          {/* Meta */}
          <div className="font-mono text-[11px] text-[#5d665f] mb-2">
            {d.messageCount} msgs · {d.uniquePosters} posters · {timeAgo(d.lastActivityAt ?? d.scannedAt)}
          </div>

          {/* Summary */}
          {d.summary && <p className="text-sm text-gray-100 leading-relaxed mb-2">{d.summary}</p>}

          {/* Key insights */}
          {d.keyInsights && d.keyInsights.length > 0 && (
            <ul className="space-y-1 mb-2">
              {d.keyInsights.map((insight, ii) => (
                <li key={ii} className="flex items-start gap-1.5 text-sm text-[#c6cdc9] leading-relaxed">
                  <span className="text-emerald-400 mt-0.5 shrink-0">›</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          )}

          {/* AlphaGap Take */}
          {d.alphaTake && (
            <div className="border-l-2 border-emerald-500/40 bg-emerald-500/5 rounded-r-lg px-3 py-2.5">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">AlphaGap Take</p>
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

// ── Tweet Grid (extracted for sneak-peek reuse) ────────────────────
function TweetTable({ tweets, expandedTweet, onExpand, onSubnetClick, isWatched }: {
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {tweets.map((t) => {
        const isExpanded = expandedTweet === t.tweet_id;
        const score = t.momentum_score ?? t.heat_score;
        return (
          <div
            key={t.tweet_id}
            className={`ag-glass ag-glass-hover p-5 cursor-pointer flex flex-col ${isWatched(t.netuid) ? "ring-1 ring-blue-400/30" : ""}`}
            onClick={() => onExpand(isExpanded ? null : t.tweet_id)}
          >
            {/* Who row */}
            <div className="flex items-center gap-3 mb-3">
              <span className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-semibold text-xs text-emerald-400 border border-white/[0.14] bg-gradient-to-br from-[#1c2f28] to-[#0d1713]">
                {monogram(t.kol_name, t.kol_handle)}
              </span>
              <div className="min-w-0 flex-1">
                <a
                  href={`https://x.com/${t.kol_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-semibold text-[13.5px] text-white hover:text-emerald-300 truncate transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  {t.kol_name || `@${t.kol_handle}`}
                </a>
                <div className="font-mono text-[10.5px] text-[#5d665f] truncate">
                  @{t.kol_handle} · {tierLabel(t.kol_tier)} · w{t.kol_weight} · {fmtFollowers(t.kol_followers)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`font-mono text-[11px] px-2.5 py-1 rounded-full border ${heatColor(score)}`}>
                  <span className="inline-flex items-center gap-1"><AgIcon name="flame" className="w-3 h-3" /> {score}</span>
                </span>
                {t.is_trending_now && (
                  <span className="flex items-center gap-1 font-mono text-[9px] tracking-[0.14em] text-emerald-400">
                    <span className="ag-live-dot" style={{ width: 4, height: 4 }} />LIVE
                  </span>
                )}
              </div>
            </div>

            {/* Tweet text */}
            <p className={`text-[13.5px] text-[#9aa39e] leading-relaxed ${isExpanded ? "" : "line-clamp-3"}`}>{t.tweet_text}</p>
            <a
              href={t.tweet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-500/80 hover:text-emerald-400 hover:underline mt-1.5 block"
              onClick={e => e.stopPropagation()}
            >
              {isExpanded ? "Open tweet ↗" : "View on X ↗"}
            </a>

            {/* Meta row */}
            <div className="flex items-center gap-4 mt-auto pt-3.5 font-mono text-[10.5px] text-[#5d665f]">
              <span title="total interactions" className="inline-flex items-center gap-1"><AgIcon name="heart" className="w-3 h-3" /><AgIcon name="repost" className="w-3 h-3" /> {fmtEng(t.engagement)}</span>
              <span className={agapColor(t.subnet_agap)}>aGap {t.subnet_agap ?? "—"}</span>
              <button
                className="hover:text-emerald-400 transition-colors truncate"
                onClick={e => { e.stopPropagation(); onSubnetClick(t.netuid); }}
              >
                SN{t.netuid} · {t.subnet_name}
              </button>
              <span className="ml-auto whitespace-nowrap">{timeAgoLocal(t.detected_at)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
