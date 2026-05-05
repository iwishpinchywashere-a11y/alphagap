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
  type: "accumulating" | "distributing" | "volume_surge" | "yield_spike" | "yield_dip";
  strength: number;
  headline: string;
  detail: string;
  badge: string;
  badgeColor: string;
  netFlow?: number;
  whaleRatio?: number;
  price?: number;
  change24h?: number;
  dayKey: string;
  detectedAt: string;
}

// Unified feed item
interface FeedItem {
  id: string;
  ts: string; // ISO
  kind: "dev" | "whale" | "hf" | "flow";
  netuid: number;
  name: string;
  title: string;
  body: string;
  strength: number;
  url?: string;
  badge?: string;
  badgeColor?: string;
  extra?: string; // extra detail line
}

// ── Helpers ───────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function strengthBar(strength: number) {
  const filled = Math.round((strength / 100) * 5);
  return Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={`inline-block w-1 h-3 rounded-sm mx-px ${i < filled ? "bg-current" : "bg-gray-700"}`} />
  ));
}

function kindMeta(kind: FeedItem["kind"]) {
  switch (kind) {
    case "dev":
      return { icon: "⚡", label: "Dev", color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/25" };
    case "whale":
      return { icon: "🐋", label: "Whale", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/25" };
    case "hf":
      return { icon: "🤗", label: "HuggingFace", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/25" };
    case "flow":
      return { icon: "📈", label: "Flow", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25" };
  }
}

// ── Feed Card ──────────────────────────────────────────────────────

function FeedCard({ item }: { item: FeedItem }) {
  const meta = kindMeta(item.kind);

  return (
    <div className={`flex gap-3 p-4 rounded-2xl border ${meta.bg} hover:brightness-110 transition-all`}>
      {/* Logo */}
      <div className="flex-shrink-0 mt-0.5">
        <SubnetLogo netuid={item.netuid} name={item.name} size={36} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Top row: kind badge + subnet + time */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.color}`}>
            {meta.icon} {meta.label}
          </span>
          <span className="text-[10px] text-gray-600 font-mono">SN{item.netuid} · {item.name}</span>
          <span className="text-[10px] text-gray-700 ml-auto">{timeAgo(item.ts)}</span>
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-white leading-snug mb-1">{item.title}</p>

        {/* Body */}
        {item.body && (
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{item.body}</p>
        )}

        {/* Extra detail */}
        {item.extra && (
          <p className="text-xs text-gray-600 mt-1 italic">{item.extra}</p>
        )}

        {/* Footer: strength + link */}
        <div className="flex items-center gap-3 mt-2">
          <span className={`flex items-center gap-0.5 ${meta.color}`}>
            {strengthBar(item.strength)}
          </span>
          <span className="text-[10px] text-gray-600">{item.strength}/100</span>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              View →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Filter pill ────────────────────────────────────────────────────

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
        active
          ? "bg-white/10 border-white/30 text-white"
          : "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

const ALL_KINDS: FeedItem["kind"][] = ["dev", "whale", "hf", "flow"];

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FeedItem["kind"] | "all">("all");
  const [minStrength, setMinStrength] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sigRes, flowRes] = await Promise.allSettled([
        fetch("/api/signals?limit=100"),
        fetch("/api/flow-events"),
      ]);

      const merged: FeedItem[] = [];

      // Dev + HF signals
      if (sigRes.status === "fulfilled" && sigRes.value.ok) {
        const data = await sigRes.value.json();
        const signals: DevSignal[] = data.signals ?? [];
        for (const s of signals) {
          const kind: FeedItem["kind"] = s.signal_type === "hf_update" ? "hf" : "dev";
          merged.push({
            id: `sig-${s.id}`,
            ts: s.signal_date || s.created_at,
            kind,
            netuid: s.netuid,
            name: s.subnet_name ?? `SN${s.netuid}`,
            title: s.title,
            body: s.analysis || s.description,
            strength: s.strength,
            url: s.source_url,
            extra: s.analysis ? s.description : undefined,
          });
        }
      }

      // Flow / whale events
      if (flowRes.status === "fulfilled" && flowRes.value.ok) {
        const data = await flowRes.value.json();
        const events: FlowEvent[] = data.events ?? [];
        for (const e of events) {
          const kind: FeedItem["kind"] =
            e.type === "accumulating" || e.type === "distributing" ? "whale" : "flow";
          merged.push({
            id: `flow-${e.netuid}-${e.dayKey}-${e.type}`,
            ts: e.detectedAt,
            kind,
            netuid: e.netuid,
            name: e.name,
            title: e.headline,
            body: e.detail,
            strength: e.strength,
            badge: e.badge,
            badgeColor: e.badgeColor,
            extra: e.whaleRatio != null
              ? `Buy/sell ratio: ${e.whaleRatio.toFixed(2)}×`
              : undefined,
          });
        }
      }

      // Sort newest first
      merged.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
      setItems(merged);
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

  const visible = items.filter(item => {
    if (filter !== "all" && item.kind !== filter) return false;
    if (item.strength < minStrength) return false;
    return true;
  });

  const counts = {
    all: items.length,
    dev: items.filter(i => i.kind === "dev").length,
    whale: items.filter(i => i.kind === "whale").length,
    hf: items.filter(i => i.kind === "hf").length,
    flow: items.filter(i => i.kind === "flow").length,
  };

  const kindLabels: Record<FeedItem["kind"] | "all", string> = {
    all: `All (${counts.all})`,
    dev: `⚡ Dev (${counts.dev})`,
    whale: `🐋 Whale (${counts.whale})`,
    hf: `🤗 HuggingFace (${counts.hf})`,
    flow: `📈 Flow (${counts.flow})`,
  };

  return (
    <main className="flex-1 overflow-auto p-4 md:p-6 w-full max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1.5">
          <span className="text-3xl">📡</span>
          <h1 className="text-2xl font-black text-white tracking-tight">Signal Feed</h1>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">
          Live intelligence across all Bittensor subnets — dev activity, whale moves, HuggingFace drops, and capital flows.
        </p>
        {lastRefresh && (
          <p className="text-xs text-gray-700 mt-1">
            Updated {timeAgo(lastRefresh.toISOString())} · auto-refreshes every 5 min
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
          {kindLabels.all}
        </FilterPill>
        {ALL_KINDS.map(k => (
          <FilterPill key={k} active={filter === k} onClick={() => setFilter(k)}>
            {kindLabels[k]}
          </FilterPill>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-600">Min strength</span>
          <select
            value={minStrength}
            onChange={e => setMinStrength(Number(e.target.value))}
            className="bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-300 px-2 py-1"
          >
            <option value={0}>Any</option>
            <option value={40}>40+</option>
            <option value={60}>60+</option>
            <option value={75}>75+</option>
            <option value={90}>90+</option>
          </select>
        </div>
        <button
          onClick={load}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded-lg border border-gray-800 hover:border-gray-600"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-900/50 border border-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <p className="text-4xl mb-3">🔇</p>
          <p className="text-sm">No signals match your filters.</p>
          <button onClick={() => { setFilter("all"); setMinStrength(0); }} className="mt-3 text-xs text-gray-500 hover:text-gray-300 underline">
            Reset filters
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map(item => (
            <FeedCard key={item.id} item={item} />
          ))}
          {visible.length >= 100 && (
            <p className="text-center text-xs text-gray-700 py-4">Showing most recent 100 signals</p>
          )}
        </div>
      )}

    </main>
  );
}
