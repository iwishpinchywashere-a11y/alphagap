"use client";

import { useState, useEffect, useCallback } from "react";
import SubnetLogo from "@/components/dashboard/SubnetLogo";

// ── Types ─────────────────────────────────────────────────────────

interface DevSignal {
  id: number;
  netuid: number;
  signal_type: string;
  strength: number;
  title: string;
  description: string;
  source: string;
  source_url?: string;
  created_at: string;
  signal_date?: string;
  subnet_name?: string;
  analysis?: string;
}

interface FlowEvent {
  netuid: number;
  name: string;
  type: "accumulating" | "distributing" | "volume_surge" | "flow_spike" | "flow_inflection" | "flow_warning" | "yield_spike" | "yield_dip";
  strength: number;
  headline: string;
  detail: string;
  badge: string;
  badgeColor: string;
  netFlow?: number;
  whaleRatio?: number;
  volumeRatio?: number;
  price?: number;
  change24h?: number;
  apy_7d?: number;
  apy_1h?: number;
  apy_30d?: number;
  dayKey: string;
  detectedAt: string;
}

interface HotTweet {
  tweet_id: string;
  netuid: number;
  subnet_name: string;
  kol_handle: string;
  kol_name: string;
  kol_weight: number;
  kol_tier: number;
  kol_followers: number;
  tweet_text: string;
  tweet_url: string;
  engagement: number;
  heat_score: number;
  momentum_score: number;
  is_trending_now: boolean;
  detected_at: string;
  subnet_agap: number | null;
}

interface DiscordEntry {
  netuid: number;
  name: string;
  signal: "alpha" | "active";
  alphaScore: number;
  alphaTypes?: string[];
  summary: string;
  keyInsights: string[];
  alphaTake?: string;
  founderPost?: boolean;
  channelName?: string;
  subnetName?: string;
  messageCount: number;
  uniquePosters: number;
  scannedAt: string;
  lastActivityAt?: string;
  composite_score: number | null;
  social_score: number | null;
  releaseHint?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────

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

// Significance thresholds for flow events — only big moves
const FLOW_MIN: Record<string, number> = {
  accumulating:     65,
  distributing:     65,
  volume_surge:     70,
  yield_spike:      55,
  yield_dip:        55,
  flow_spike:       65,
  flow_inflection:  65,
  flow_warning:     65,
};

function isSignificantFlow(e: FlowEvent): boolean {
  return e.strength >= (FLOW_MIN[e.type] ?? 60);
}

// ── Tab bar ───────────────────────────────────────────────────────

type Tab = "all" | "flow" | "dev" | "x" | "discord";

function TabBar({
  active,
  counts,
  onChange,
}: {
  active: Tab;
  counts: Record<Tab, number>;
  onChange: (t: Tab) => void;
}) {
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "all",     label: "All",         icon: "📡" },
    { id: "flow",    label: "Flow",        icon: "🌊" },
    { id: "dev",     label: "Development", icon: "⚡" },
    { id: "x",       label: "X",           icon: "𝕏" },
    { id: "discord", label: "Discord",     icon: "💬" },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-4 scrollbar-hide">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            active === t.id
              ? "bg-white/10 border-white/25 text-white"
              : "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
          }`}
        >
          <span>{t.icon}</span>
          <span>{t.label}</span>
          {counts[t.id] > 0 && (
            <span className={`text-[10px] tabular-nums ${active === t.id ? "text-gray-300" : "text-gray-600"}`}>
              {counts[t.id]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Flow Card ──────────────────────────────────────────────────────

function FlowCard({ e }: { e: FlowEvent }) {
  const isWhale = e.type === "accumulating" || e.type === "distributing";
  const isVolume = e.type === "volume_surge";
  const isYield = e.type === "yield_spike" || e.type === "yield_dip";

  const accent = isWhale
    ? (e.type === "accumulating" ? "border-blue-500/30 bg-blue-500/5" : "border-red-500/30 bg-red-500/5")
    : isVolume
      ? "border-purple-500/30 bg-purple-500/5"
      : "border-yellow-500/30 bg-yellow-500/5";

  const badgeStyle = e.type === "accumulating"
    ? "bg-blue-500/20 text-blue-300"
    : e.type === "distributing"
      ? "bg-red-500/20 text-red-300"
      : isVolume
        ? "bg-purple-500/20 text-purple-300"
        : "bg-yellow-500/20 text-yellow-300";

  return (
    <div className={`flex gap-3 p-4 rounded-2xl border ${accent}`}>
      <div className="flex-shrink-0 mt-0.5">
        <SubnetLogo netuid={e.netuid} name={e.name} size={36} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${badgeStyle}`}>
            🌊 {e.badge}
          </span>
          <span className="text-[10px] text-gray-600 font-mono">SN{e.netuid} · {e.name}</span>
          <span className="text-[10px] text-gray-700 ml-auto">{timeAgo(e.detectedAt)}</span>
        </div>
        <p className="text-sm font-semibold text-white leading-snug mb-1">{e.headline}</p>
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{e.detail}</p>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-14 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-current"
                style={{ width: `${e.strength}%`, color: e.strength >= 75 ? "#4ade80" : e.strength >= 55 ? "#facc15" : "#fb923c" }}
              />
            </div>
            <span className="text-[10px] text-gray-600 tabular-nums">{e.strength}</span>
          </div>
          {e.whaleRatio != null && (
            <span className="text-[10px] text-gray-600">
              {e.whaleRatio.toFixed(2)}× ratio
            </span>
          )}
          {e.volumeRatio != null && (
            <span className="text-[10px] text-gray-600">
              {e.volumeRatio.toFixed(1)}× vol
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Dev Card ──────────────────────────────────────────────────────

function DevCard({ s }: { s: DevSignal }) {
  const isHF = s.signal_type === "hf_update";
  const accent = isHF
    ? "border-yellow-500/25 bg-yellow-500/5"
    : "border-indigo-500/25 bg-indigo-500/5";
  const badgeStyle = isHF
    ? "bg-yellow-500/20 text-yellow-300"
    : "bg-indigo-500/20 text-indigo-300";
  const icon = isHF ? "🤗" : "⚡";
  const label = isHF ? "HuggingFace" : "Dev";
  const ts = s.signal_date || s.created_at;

  return (
    <div className={`flex gap-3 p-4 rounded-2xl border ${accent}`}>
      <div className="flex-shrink-0 mt-0.5">
        <SubnetLogo netuid={s.netuid} name={s.subnet_name ?? `SN${s.netuid}`} size={36} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${badgeStyle}`}>
            {icon} {label}
          </span>
          <span className="text-[10px] text-gray-600 font-mono">SN{s.netuid} · {s.subnet_name ?? ""}</span>
          <span className="text-[10px] text-gray-700 ml-auto">{timeAgo(ts)}</span>
        </div>
        <p className="text-sm font-semibold text-white leading-snug mb-1">{s.title}</p>
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
          {s.analysis || s.description}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-14 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${s.strength}%`,
                  backgroundColor: s.strength >= 75 ? "#818cf8" : s.strength >= 55 ? "#facc15" : "#fb923c",
                }}
              />
            </div>
            <span className="text-[10px] text-gray-600 tabular-nums">{s.strength}</span>
          </div>
          {s.source_url && (
            <a
              href={s.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[10px] text-gray-600 hover:text-gray-300 transition-colors"
            >
              View →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── X Card ────────────────────────────────────────────────────────

function XCard({ t }: { t: HotTweet }) {
  const heatColor =
    t.heat_score >= 85 ? "border-green-500/30 bg-green-500/5" :
    t.heat_score >= 65 ? "border-emerald-500/25 bg-emerald-500/5" :
    t.heat_score >= 45 ? "border-yellow-500/20 bg-yellow-500/5" :
    "border-gray-700 bg-gray-900/40";

  const tierBadge =
    t.kol_tier === 1 ? "bg-green-500/20 text-green-300" :
    t.kol_tier === 2 ? "bg-blue-500/20 text-blue-300" :
    "bg-gray-700 text-gray-400";

  return (
    <div className={`p-4 rounded-2xl border ${heatColor}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <SubnetLogo netuid={t.netuid} name={t.subnet_name} size={32} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-bold text-gray-300">𝕏 {t.kol_name}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${tierBadge}`}>
              T{t.kol_tier}
            </span>
            <span className="text-[10px] text-gray-600">{fmtFollowers(t.kol_followers)} followers</span>
            <span className="text-[10px] text-gray-700 ml-auto">{timeAgo(t.detected_at)}</span>
          </div>
          {t.is_trending_now && (
            <span className="inline-block text-[10px] text-orange-400 mb-1">🔥 Trending now</span>
          )}
          <p className="text-xs text-gray-300 leading-relaxed line-clamp-3">{t.tweet_text}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-gray-600 font-mono">SN{t.netuid} · {t.subnet_name}</span>
            <span className="text-[10px] text-gray-600">🔥 {t.heat_score}</span>
            {t.engagement > 0 && (
              <span className="text-[10px] text-gray-600">{t.engagement.toLocaleString()} eng</span>
            )}
            <a
              href={t.tweet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[10px] text-gray-600 hover:text-gray-300 transition-colors"
            >
              View →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Discord Card ──────────────────────────────────────────────────

function DiscordCard({ d }: { d: DiscordEntry }) {
  const isAlpha = d.signal === "alpha";
  const accent = isAlpha
    ? "border-green-500/25 bg-green-500/5"
    : "border-blue-500/20 bg-blue-500/5";
  const badge = isAlpha
    ? "bg-green-500/20 text-green-300"
    : "bg-blue-500/20 text-blue-300";
  const ts = d.lastActivityAt || d.scannedAt;

  return (
    <div className={`p-4 rounded-2xl border ${accent}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <SubnetLogo netuid={d.netuid} name={d.subnetName ?? d.name} size={32} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${badge}`}>
              💬 {isAlpha ? "Alpha" : "Active"}
            </span>
            <span className="text-[10px] text-gray-600 font-mono">
              SN{d.netuid} · {d.subnetName ?? d.name}
            </span>
            {d.releaseHint && (
              <span className="text-[10px] text-purple-400">🚀 Release hint</span>
            )}
            {d.founderPost && (
              <span className="text-[10px] text-yellow-500">👑 Founder</span>
            )}
            <span className="text-[10px] text-gray-700 ml-auto">{timeAgo(ts)}</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed mb-1.5 line-clamp-2">{d.summary}</p>
          {d.keyInsights?.length > 0 && (
            <p className="text-xs text-gray-500 italic line-clamp-1">
              {d.keyInsights[0]}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600">
            <span>{d.messageCount} msgs</span>
            <span>{d.uniquePosters} posters</span>
            <span className="font-semibold text-gray-500">α {d.alphaScore}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function FeedPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Raw data
  const [devSignals, setDevSignals] = useState<DevSignal[]>([]);
  const [flowEvents, setFlowEvents] = useState<FlowEvent[]>([]);
  const [hotTweets, setHotTweets] = useState<HotTweet[]>([]);
  const [discordEntries, setDiscordEntries] = useState<DiscordEntry[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sigRes, flowRes, socialRes] = await Promise.allSettled([
        fetch("/api/cached-scan"),
        fetch("/api/flow-events"),
        fetch("/api/social"),
      ]);

      if (sigRes.status === "fulfilled" && sigRes.value.ok) {
        const data = await sigRes.value.json();
        const sigs: DevSignal[] = (data.signals ?? []).filter(
          (s: DevSignal) => s.signal_type === "dev_spike" || s.signal_type === "hf_update"
        );
        sigs.sort((a, b) => {
          const da = a.signal_date || a.created_at;
          const db = b.signal_date || b.created_at;
          if (db > da) return 1;
          if (db < da) return -1;
          return (b.strength ?? 0) - (a.strength ?? 0);
        });
        setDevSignals(sigs);
      }

      if (flowRes.status === "fulfilled" && flowRes.value.ok) {
        const data = await flowRes.value.json();
        const events: FlowEvent[] = (data.events ?? []).filter(isSignificantFlow);
        events.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
        setFlowEvents(events);
      }

      if (socialRes.status === "fulfilled" && socialRes.value.ok) {
        const data = await socialRes.value.json();
        const tweets: HotTweet[] = (data.hotTweets ?? []);
        tweets.sort((a, b) => b.heat_score - a.heat_score);
        setHotTweets(tweets);

        const discord: DiscordEntry[] = (data.discordLeaderboard ?? []);
        discord.sort((a, b) => (b.alphaScore ?? 0) - (a.alphaScore ?? 0));
        setDiscordEntries(discord);
      }

      setLastRefresh(new Date());
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [load]);

  const counts: Record<Tab, number> = {
    all:     flowEvents.length + devSignals.length + hotTweets.length + discordEntries.length,
    flow:    flowEvents.length,
    dev:     devSignals.length,
    x:       hotTweets.length,
    discord: discordEntries.length,
  };

  return (
    <main className="flex-1 overflow-auto p-4 md:p-6 w-full max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📡</span>
            <h1 className="text-xl font-black text-white tracking-tight">Signal Feed</h1>
          </div>
          <button
            onClick={load}
            className="text-xs text-gray-600 hover:text-gray-300 transition-colors px-2.5 py-1 rounded-lg border border-gray-800 hover:border-gray-600"
          >
            ↻ Refresh
          </button>
        </div>
        {lastRefresh && (
          <p className="text-xs text-gray-700">
            Updated {timeAgo(lastRefresh.toISOString())} · auto-refreshes every 5 min
          </p>
        )}
      </div>

      {/* Tabs */}
      <TabBar active={tab} counts={counts} onChange={setTab} />

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-900/50 border border-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* FLOW */}
          {(tab === "all" || tab === "flow") && flowEvents.length > 0 && (
            <section className="mb-6">
              {tab === "all" && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">🌊 Flow</span>
                  <span className="text-xs text-gray-700">significant moves only</span>
                </div>
              )}
              <div className="space-y-2.5">
                {flowEvents.map(e => (
                  <FlowCard key={`${e.netuid}-${e.dayKey}-${e.type}`} e={e} />
                ))}
              </div>
            </section>
          )}
          {tab === "flow" && flowEvents.length === 0 && (
            <Empty icon="🌊" label="No significant flow events right now" />
          )}

          {/* DEV */}
          {(tab === "all" || tab === "dev") && devSignals.length > 0 && (
            <section className="mb-6">
              {tab === "all" && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">⚡ Development</span>
                  <span className="text-xs text-gray-700">GitHub + HuggingFace</span>
                </div>
              )}
              <div className="space-y-2.5">
                {devSignals.map(s => (
                  <DevCard key={s.id} s={s} />
                ))}
              </div>
            </section>
          )}
          {tab === "dev" && devSignals.length === 0 && (
            <Empty icon="⚡" label="No development signals right now" />
          )}

          {/* X */}
          {(tab === "all" || tab === "x") && hotTweets.length > 0 && (
            <section className="mb-6">
              {tab === "all" && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">𝕏 X / Twitter</span>
                </div>
              )}
              <div className="space-y-2.5">
                {hotTweets.map(t => (
                  <XCard key={t.tweet_id} t={t} />
                ))}
              </div>
            </section>
          )}
          {tab === "x" && hotTweets.length === 0 && (
            <Empty icon="𝕏" label="No X activity detected yet" />
          )}

          {/* DISCORD */}
          {(tab === "all" || tab === "discord") && discordEntries.length > 0 && (
            <section className="mb-6">
              {tab === "all" && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">💬 Discord</span>
                </div>
              )}
              <div className="space-y-2.5">
                {discordEntries.map(d => (
                  <DiscordCard key={`${d.netuid}-${d.channelName ?? "main"}`} d={d} />
                ))}
              </div>
            </section>
          )}
          {tab === "discord" && discordEntries.length === 0 && (
            <Empty icon="💬" label="No Discord signals right now" />
          )}

          {/* All empty */}
          {tab === "all" && counts.all === 0 && (
            <Empty icon="📡" label="No signals available — check back soon" />
          )}
        </>
      )}
    </main>
  );
}

function Empty({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="text-center py-16 text-gray-600">
      <p className="text-3xl mb-3">{icon}</p>
      <p className="text-sm">{label}</p>
    </div>
  );
}
