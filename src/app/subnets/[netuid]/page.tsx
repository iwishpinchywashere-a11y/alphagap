"use client";

import { use, useEffect, useRef, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SocialLinks from "@/components/dashboard/SocialLinks";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import LineChart, { type ChartPoint } from "@/components/charts/LineChart";
import AgIcon from "@/components/AgIcon";
import { BENCHMARK_MAP } from "@/lib/benchmarks";

// ── Types ─────────────────────────────────────────────────────────
interface ScoreRow { date: string; agap: number; flow: number; dev: number; eval: number; social: number; price: number; mcap: number; emission_pct: number }
interface PricePoint { timestamp: string; price: number }
interface EmissionPoint { pct: number; timestamp: string }
interface Signal { netuid: number; strength: number; signal_type: string; title: string; description: string; source: string; source_url?: string; signal_date?: string; created_at: string }
interface MarketStats {
  priceUsd: number; priceChangePct1h: number; priceChangePct24h: number;
  priceChangePct7d: number; priceChangePct30d: number;
  marketCapUsd: number; fdvUsd: number; volume24hUsd: number;
  high24hUsd: number; low24hUsd: number;
  circulatingSupply: number; alphaInPool: number; alphaStaked: number;
  buys24h: number | null; sells24h: number | null; buyers24h: number | null; sellers24h: number | null;
  fearGreedIndex: number; fearGreedSentiment: string;
  symbol: string; taoPrice: number;
}
interface RankPoint { date: string; rank: number }
interface SubnetData {
  netuid: number; name: string;
  identity: { description?: string; summary?: string; github_repo?: string; twitter?: string; discord?: string; website?: string; tags?: string[] } | null;
  current: Record<string, number | string | boolean | null> | null;
  scoreHistory: ScoreRow[];
  rankHistory: RankPoint[];
  emissionHistory: EmissionPoint[];
  priceHistory: PricePoint[];    // 92 days, always in initial response
  sevenDayPrices: PricePoint[];  // 7d 4h candles
  marketStats: MarketStats | null;
  signals: Signal[];
  metagraph: { validators: number; miners: number; totalNeurons: number };
  flowHistory: { x: string; y: number }[];
  lastScan: string | null;
}

type Timeframe = "1D" | "7D" | "1M" | "3M" | "1Y";

// ── Hub section types (audit + KOL chatter) ──────────────────────
interface AuditFlagRow { type: string; severity: string; message: string }
interface AuditDetail {
  grade: "A" | "B" | "C" | "D" | "F";
  operationalScore: number;
  nakamotoCoefficient: number;
  top10Share: number;
  holdersCount: number | null;
  flags: AuditFlagRow[];
}
interface HotTweet {
  tweet_id: string; netuid: number;
  kol_handle: string; kol_name: string;
  tweet_text: string; tweet_url?: string;
  heat_score: number;
}

const GRADE_COLORS: Record<string, string> = {
  A: "text-emerald-400",
  B: "text-green-400",
  C: "text-yellow-400",
  D: "text-orange-400",
  F: "text-red-400",
};

// ── Formatters ───────────────────────────────────────────────────
function fmtUsd(v: number, decimals?: number): string {
  if (v === 0) return "$0";
  if (decimals !== undefined) return `$${v.toFixed(decimals)}`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}
function fmtPrice(v: number): string {
  if (v === 0) return "$0.00";
  if (v < 0.000001) return `$${v.toFixed(8)}`;
  if (v < 0.0001) return `$${v.toFixed(6)}`;
  if (v < 0.01) return `$${v.toFixed(5)}`;
  if (v < 1) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}
function fmtNum(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}
function fmtPct(v: number): string { return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`; }
function pctColor(v: number): string { return v >= 0 ? "text-green-400" : "text-red-400"; }
function scoreColor(s: number): string { return s >= 70 ? "text-green-400" : s >= 40 ? "text-yellow-400" : "text-red-400"; }

// ── Subnet live dashboards ────────────────────────────────────────
const SUBNET_DASHBOARDS: Record<number, { label: string; url: string }[]> = {
  1:  [{ label: "Dashboard", url: "https://apex.macrocosmos.ai/" }],
  3:  [{ label: "Dashboard", url: "https://www.tplr.ai/dashboard" }],
  4:  [{ label: "Live Stats", url: "https://stats.targon.com/" }],
  8:  [{ label: "Tokenomics", url: "https://tokenomics.taoshi.io/" }],
  9:  [{ label: "Dashboard", url: "https://iota.macrocosmos.ai/" }],
  12: [{ label: "Grafana", url: "https://grafana.bittensor.church/d/subnet/metagraph-subnet?var-subnet=12" }],
  13: [{ label: "Data Dashboard", url: "https://sn13-dashboard.api.macrocosmos.ai/" }],
  27: [{ label: "GPU Marketplace", url: "https://compute.neuralinternet.ai/" }],
  34: [{ label: "Dashboard", url: "https://app.bitmind.ai/dashboard" }],
  46: [{ label: "Model Dashboard", url: "https://dashboard.resilabs.ai/" }, { label: "Portal", url: "https://portal.resilabs.ai/" }],
  64: [{ label: "Network Stats", url: "https://chutes.ai/app/research" }, { label: "Utilization", url: "https://chutes.ai/app/research/utilization" }],
  72: [{ label: "Coverage Map", url: "https://coverage.natix.network/" }],
  75: [{ label: "Network Stats", url: "https://hipstats.com/" }],
  78: [{ label: "Miner Stats", url: "https://subnet.loosh.ai/" }],
  82: [{ label: "Query Portal", url: "https://ask.hermes-subnet.ai/" }],
  93: [{ label: "Creator Stats", url: "https://stats.bitcast.network/" }],
};

// ── TAO Pages slug helper (mirrors tao-pages-slugs.ts logic) ─────
const TAOPAGES_EXPLICIT_SLUGS: Record<number, string> = {
  64: "chutes", 4: "targon", 120: "affine", 51: "lium", 8: "vanta",
  62: "ridges", 44: "score", 9: "iota", 75: "hippius", 56: "gradients",
  68: "nova", 17: "404gen", 104: "sn104", 86: "sn86", 100: "platform",
};
function taoPageSlug(netuid: number, name: string): string {
  if (TAOPAGES_EXPLICIT_SLUGS[netuid]) return TAOPAGES_EXPLICIT_SLUGS[netuid];
  return name
    .toLowerCase()
    .replace(/[τΤ]/g, "t")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `sn${netuid}`;
}

// ── Charts ────────────────────────────────────────────────────────
// All three chart types render through components/charts/LineChart, which
// draws in real pixels (no stretched viewBox) and scrubs with pointer events.

function parseTsMs(ts: string): number {
  if (/^\d+$/.test(ts)) { const n = parseInt(ts, 10); return n < 1e12 ? n * 1000 : n; }
  return Date.parse(ts);
}

function useIsMobile(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const on = () => setM(mq.matches); on();
    mq.addEventListener("change", on); return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

const axisTimeFor = (tf: Timeframe) => (t: number) => {
  const d = new Date(t);
  if (tf === "1D") return d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
  if (tf === "1Y") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const tipTimeFor = (tf: Timeframe) => (t: number) => {
  const d = new Date(t);
  if (tf === "1D" || tf === "7D") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function toPoints(data: PricePoint[]): ChartPoint[] {
  return data.map(p => ({ t: parseTsMs(p.timestamp), v: p.price }))
    .filter(p => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0)
    .sort((a, b) => a.t - b.t);
}

function PriceChart({ data, color, timeframe, onHover }: {
  data: PricePoint[]; color: string; timeframe: Timeframe; onHover?: (p: ChartPoint | null) => void;
}) {
  const mobile = useIsMobile();
  const pts = useMemo(() => toPoints(data), [data]);
  return (
    <LineChart points={pts} color={color} height={mobile ? 210 : 280}
      formatValue={fmtPrice} formatAxisTime={axisTimeFor(timeframe)} formatTooltipTime={tipTimeFor(timeframe)}
      showExtremes onHover={onHover} animateKey={`${timeframe}:${pts.length}`} />
  );
}

// Score history: one point per scan, ~30 min apart
function ScoreChart({ data, color, formatY = (v: number) => v.toFixed(0), invertY = false, height = 120 }: {
  data: { x: string; y: number }[]; color: string; label?: string; formatY?: (v: number) => string; invertY?: boolean; height?: number;
}) {
  const pts = useMemo(() => data.map(d => ({ t: parseTsMs(d.x), v: d.y })).filter(p => Number.isFinite(p.t) && Number.isFinite(p.v)).sort((a, b) => a.t - b.t), [data]);
  if (pts.length < 2) {
    return (
      <div className="flex items-center justify-center text-gray-600 text-xs text-center" style={{ height }}>
        No history yet - builds with each scan
      </div>
    );
  }
  return (
    <LineChart points={pts} color={color} height={height} invertY={invertY}
      formatValue={formatY}
      formatAxisTime={t => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      formatTooltipTime={t => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
      animateKey={pts.length} />
  );
}

// TAO Flow EMA: net TAO into/out of the pool, sampled every 10 min from chain state
type FlowTf = "1D" | "7D" | "1M" | "3M";
function TaoFlowChart({ allData }: { allData: { x: string; y: number }[] }) {
  const [tf, setTf] = useState<FlowTf>("7D");
  const mobile = useIsMobile();
  const cutoffMs: Record<FlowTf, number> = { "1D": 86400000, "7D": 7 * 86400000, "1M": 30 * 86400000, "3M": 90 * 86400000 };
  const pts = useMemo(() => {
    const since = Date.now() - cutoffMs[tf];
    return allData.map(d => ({ t: parseTsMs(d.x), v: d.y })).filter(p => Number.isFinite(p.t) && Number.isFinite(p.v) && p.t >= since).sort((a, b) => a.t - b.t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allData, tf]);
  const latest = pts.length ? pts[pts.length - 1].v : 0;
  const color = latest >= 0 ? "#4ade80" : "#f87171";
  // Decimals follow the plotted range so a flat EMA near zero does not print
  // the same "-0.001 τ" on every gridline.
  const span = pts.length ? Math.max(...pts.map(p => Math.abs(p.v))) : 1;
  const smallDecimals = span >= 1 ? 1 : Math.min(6, Math.max(3, Math.ceil(-Math.log10(span || 1)) + 2));
  const fmtFlow = (v: number) => {
    const abs = Math.abs(v); const sign = v >= 0 ? "+" : "-";
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}K τ`;
    if (abs >= 1) return `${sign}${abs.toFixed(1)} τ`;
    return `${sign}${abs.toFixed(smallDecimals)} τ`;
  };
  const fmtTime = (t: number) => {
    const d = new Date(t);
    return tf === "1D" ? d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (allData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <div className="text-gray-600 text-sm">TAO Flow EMA data collection in progress</div>
        <div className="text-gray-700 text-xs">Chart populates automatically every 10 minutes</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <div className="ag-pill-tabs">
          {(["1D", "7D", "1M", "3M"] as FlowTf[]).map(t => (
            <button key={t} onClick={() => setTf(t)} className={`ag-pill-tab !px-4 !py-1.5 text-xs ${tf === t ? "ag-pill-tab-on" : ""}`}>{t}</button>
          ))}
        </div>
        <span className="ml-auto font-mono text-[10.5px] text-gray-600 tabular-nums">{pts.length} points</span>
      </div>
      <LineChart points={pts} color={color} height={mobile ? 180 : 220} baseline={0}
        formatValue={fmtFlow} formatAxisTime={fmtTime}
        formatTooltipTime={t => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
        animateKey={`${tf}:${pts.length}`} />
      <p className="text-[11px] text-gray-700 leading-relaxed">
        TAO Flow EMA measures net TAO moving into or out of this subnet&apos;s liquidity pool (7-day exponential moving average, read from chain state). Sustained positive flow → emission share rising. Sustained negative flow → emission share falling. This is a leading indicator of where emissions are heading next.
      </p>
    </div>
  );
}

// ── Stat row item ─────────────────────────────────────────────────
function StatItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/[0.06] last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="text-right">
        <span className="text-xs text-white font-medium">{value}</span>
        {sub && <div className="text-[10px] text-gray-600">{sub}</div>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function SubnetDetailPage({ params }: { params: Promise<{ netuid: string }> }) {
  const { netuid } = use(params);
  const router = useRouter();
  const [data, setData] = useState<SubnetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("1M");

  // ── Watchlist (self-contained - subnet page is outside the dashboard layout) ──
  const [watchlist, setWatchlist] = useState<Set<number>>(new Set());
  const [watchlistBusy, setWatchlistBusy] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/watchlist").then(r => r.ok ? r.json() : null).then(d => {
      if (Array.isArray(d?.netuids)) setWatchlist(new Set(d.netuids.map(Number)));
    }).catch(() => {});
  }, []);
  const isWatched = useCallback((id: number) => watchlist.has(id), [watchlist]);
  const toggleWatchlist = useCallback(async (id: number) => {
    if (watchlistBusy) return;
    setWatchlistBusy(true);
    setWatchlistError(null);
    const watching = watchlist.has(id);
    // Optimistic update
    setWatchlist(prev => { const next = new Set(prev); watching ? next.delete(id) : next.add(id); return next; });
    try {
      const r = watching
        ? await fetch(`/api/watchlist?netuid=${id}`, { method: "DELETE" })
        : await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ netuid: Number(id) }) });
      if (!r.ok) {
        // Revert optimistic update - save failed
        setWatchlist(prev => { const next = new Set(prev); watching ? next.add(id) : next.delete(id); return next; });
        const err = await r.json().catch(() => ({}));
        setWatchlistError(err?.error || `Error ${r.status}`);
        return;
      }
      const d = await r.json();
      if (Array.isArray(d?.netuids)) {
        setWatchlist(new Set(d.netuids.map(Number)));
        // Notify the dashboard WatchlistProvider so it updates instantly on back-nav
        window.dispatchEvent(new CustomEvent("watchlist-saved", { detail: d.netuids }));
      }
    } catch {
      // Revert on network error
      setWatchlist(prev => { const next = new Set(prev); watching ? next.add(id) : next.delete(id); return next; });
      setWatchlistError("Network error - try again");
    } finally {
      setWatchlistBusy(false);
    }
  }, [watchlist, watchlistBusy]);

  // ── Hub sections: audit grade + KOL chatter (defensive, non-blocking) ──
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [hotTweets, setHotTweets] = useState<HotTweet[]>([]);
  useEffect(() => {
    const id = Number(netuid);
    if (!Number.isFinite(id)) return;
    fetch(`/api/audits?netuid=${id}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.audit?.grade) setAudit(d.audit as AuditDetail); })
      .catch(() => {});
    fetch("/api/social")
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!Array.isArray(d?.hotTweets)) return;
        const mine = (d.hotTweets as HotTweet[])
          .filter(t => t.netuid === id && !!t.tweet_text)
          .sort((a, b) => b.heat_score - a.heat_score)
          .slice(0, 3);
        setHotTweets(mine);
      })
      .catch(() => {});
  }, [netuid]);

  // 1Y price history lazy-loads only when the user picks 1Y
  const [yearHistory, setYearHistory] = useState<PricePoint[]>([]);
  const [yearLoading, setYearLoading] = useState(false);
  const yearFetched = useRef(false);

  useEffect(() => {
    fetch(`/api/subnets/${netuid}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData).catch((e) => setError(String(e))).finally(() => setLoading(false));
  }, [netuid]);

  // Lazy-load 365d history only when user explicitly picks 1Y
  useEffect(() => {
    if (timeframe !== "1Y") return;
    if (yearFetched.current) return;
    yearFetched.current = true;
    setYearLoading(true);
    fetch(`/api/subnets/${netuid}/prices`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: { priceHistory: PricePoint[] }) => setYearHistory(d.priceHistory || []))
      .catch((e) => console.warn("1Y price history failed:", e))
      .finally(() => setYearLoading(false));
  }, [timeframe, netuid]);

  // Robustly parse timestamp (ISO string or unix-second string)
  const parseTs = (ts: string): number => {
    if (/^\d+$/.test(ts)) { const n = parseInt(ts, 10); return n < 1e12 ? n * 1000 : n; }
    return new Date(ts).getTime();
  };

  // Select the right data series for the chosen timeframe.
  // 1M/3M use priceHistory (92d, always present in initial load) → no lag.
  // 1Y uses yearHistory (lazy-loaded on demand).
  const chartData = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    if (timeframe === "1D") {
      const pts = data.sevenDayPrices.filter((p) => parseTs(p.timestamp) >= now - 86400000);
      if (pts.length >= 2) return pts;
      // Fallback: last 2 daily candles when intraday data is unavailable
      return data.priceHistory.slice(-2);
    }
    if (timeframe === "7D") {
      if (data.sevenDayPrices.length >= 2) return data.sevenDayPrices;
      return data.priceHistory.filter((p) => parseTs(p.timestamp) >= now - 7 * 86400000);
    }
    if (timeframe === "1M") {
      return data.priceHistory.filter((p) => parseTs(p.timestamp) >= now - 30 * 86400000);
    }
    if (timeframe === "3M") {
      return data.priceHistory.filter((p) => parseTs(p.timestamp) >= now - 90 * 86400000);
    }
    return yearHistory; // 1Y
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, timeframe, yearHistory]);

  // Chart color based on whether price is up in the selected window
  const chartColor = useMemo(() => {
    if (chartData.length < 2) return "#4ade80";
    return chartData[chartData.length - 1].price >= chartData[0].price ? "#4ade80" : "#f87171";
  }, [chartData]);

  // Scrubbing: the header follows the finger/cursor like a brokerage app
  const [hoverPt, setHoverPt] = useState<ChartPoint | null>(null);
  useEffect(() => { setHoverPt(null); }, [timeframe]);

  // Price change for the selected timeframe, measured on the SAME USD series
  // the chart draws. The chain's change24h/7d/30d are TAO-denominated (alpha
  // per TAO), so on a page priced in dollars they disagreed with the line
  // whenever TAO itself moved: ORO once read -27.5% over a chart that fell
  // 13.7%. Number, colour and line now come from one series.
  const seriesChange = (from: number | undefined, to: number | undefined) =>
    from && to && from > 0 && Number.isFinite(from) && Number.isFinite(to) ? (to / from - 1) * 100 : null;
  const tfChangePct = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].price;
    const last = hoverPt ? hoverPt.v : chartData[chartData.length - 1].price;
    return seriesChange(first, last);
  }, [chartData, hoverPt]);

  // 1h / 24h / 7d / 30d in USD from our own hourly and daily series: the point
  // nearest each offset, accepted only if it is close enough to be that offset.
  const usdChanges = useMemo(() => {
    if (!data) return null;
    const live = data.marketStats?.priceUsd ?? 0;
    const now = Date.now();
    // Nearest point to the offset, but never a point younger than 3/4 of the
    // offset: the hourly series ends at the live price, and "1h ago" must not
    // resolve to it (that read +0.00%).
    const pick = (series: PricePoint[], hoursAgo: number, toleranceH: number) => {
      const target = now - hoursAgo * 3600_000, youngest = now - hoursAgo * 3600_000 * 0.75;
      let best: PricePoint | null = null, bestD = Infinity;
      for (const p of series) {
        const t = parseTsMs(p.timestamp); if (t > youngest) continue;
        const d = Math.abs(t - target); if (d < bestD) { bestD = d; best = p; }
      }
      return best && bestD <= toleranceH * 3600_000 ? best.price : undefined;
    };
    const hourly = data.sevenDayPrices, daily = data.priceHistory;
    return {
      h1: seriesChange(pick(hourly, 1, 1.5), live),
      h24: seriesChange(pick(hourly, 24, 2), live),
      d7: seriesChange(pick(hourly.length ? hourly : daily, 24 * 7, 24), live),
      d30: seriesChange(pick(daily, 24 * 30, 36), live),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (loading) return (
    <div className="min-h-screen bg-[#07090b] text-gray-100 ag-aurora flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl animate-spin mb-4 text-emerald-400">⟳</div>
        <p className="text-gray-500 text-sm">Loading subnet data…</p>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-[#07090b] text-gray-100 ag-aurora flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4 flex justify-center text-yellow-400"><AgIcon name="warning" /></div>
        <p className="text-gray-400">{error || "Subnet not found"}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-emerald-400 hover:underline text-sm">← Back to Dashboard</Link>
      </div>
    </div>
  );

  const ms = data.marketStats;
  const c = data.current;
  const agap = (c?.composite_score as number) || 0;
  const flow = (c?.flow_score as number) || 0;
  const dev = (c?.dev_score as number) || 0;
  const evalScore = (c?.eval_score as number) || 0;
  const social = (c?.social_score as number) || 0;
  const emissionPct = (c?.emission_pct as number) || 0;

  const agapSeries = data.scoreHistory.map((r) => ({ x: r.date, y: r.agap }));
  const flowSeries = data.scoreHistory.map((r) => ({ x: r.date, y: r.flow }));
  const devSeries = data.scoreHistory.map((r) => ({ x: r.date, y: r.dev }));
  const evalSeries = data.scoreHistory.map((r) => ({ x: r.date, y: r.eval }));
  const socialSeries = data.scoreHistory.map((r) => ({ x: r.date, y: r.social }));
  // Use scoreHistory for emission so the date range matches all other charts.
  // emissionHistory is collected separately and often only has a few days of data.
  const emissionSeries = data.scoreHistory.length > 0
    ? data.scoreHistory.map((r) => ({ x: r.date, y: r.emission_pct * 100 }))
    : data.emissionHistory.map((r) => ({ x: r.timestamp, y: r.pct }));
  const rankSeries = (data.rankHistory ?? []).map((r) => ({ x: r.date, y: r.rank }));
  const currentRank = rankSeries.length > 0 ? rankSeries[rankSeries.length - 1].y : null;

  const TIMEFRAMES: Timeframe[] = ["1D", "7D", "1M", "3M", "1Y"];

  // ── Hub: benchmark entry + similar subnets (same category) ─────
  const bench = BENCHMARK_MAP.get(data.netuid);
  const similarSubnets = bench
    ? [...BENCHMARK_MAP.values()]
        .filter(b => b.benchmark_category === bench.benchmark_category && b.subnet_id !== bench.subnet_id)
        .sort((a, b) => b.benchmark_score - a.benchmark_score)
        .slice(0, 3)
    : [];
  const auditFlags = (audit?.flags ?? []).slice(0, 3);

  return (
    <div className="min-h-screen bg-[#07090b] text-gray-100 ag-aurora">
      {/* Nav */}
      <div className="border-b border-white/[0.08] px-4 md:px-6 py-3 flex items-center gap-4">
        <a href="/dashboard">
          <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-10 w-auto" />
        </a>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/dashboard" className="hover:text-gray-300 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-300">{data.name}</span>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] xl:grid-cols-[1fr_240px] gap-6">

          {/* ── LEFT: Price chart + scores ───────────────────────── */}
          <div className="space-y-5">

            {/* Header - intentionally minimal (logo · SN · name) so mobile
                screenshots of the chart are clean and shareable; every action
                and link lives in the row below the chart */}
            <div className="ag-glass p-5 flex items-center gap-4">
              <div className="flex-shrink-0">
                <SubnetLogo netuid={data.netuid} name={data.name} size={52} />
              </div>
              <div className="min-w-0">
                <span className="inline-block font-mono text-[10.5px] uppercase tracking-[0.14em] bg-white/[0.05] border border-white/[0.08] rounded-full px-2.5 py-0.5 text-gray-400">SN{data.netuid}</span>
                <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-[-0.02em] text-white mt-1.5 truncate">{data.name}</h1>
              </div>
            </div>

            {/* Price hero */}
            <div className="ag-glass p-4 md:p-5">
              {/* Price + change for the selected window. While scrubbing, both follow the pointer. */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-display text-[2.35rem] leading-none md:text-5xl font-semibold tracking-[-0.03em] text-white tabular-nums">
                      {hoverPt ? fmtPrice(hoverPt.v) : ms ? fmtPrice(ms.priceUsd) : "-"}
                    </span>
                    {tfChangePct != null && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums border ${
                        tfChangePct >= 0 ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300" : "bg-red-500/10 border-red-500/25 text-red-300"}`}>
                        <span className="text-[10px]">{tfChangePct >= 0 ? "▲" : "▼"}</span>
                        {fmtPct(Math.abs(tfChangePct)).replace("+", "")}
                        <span className="font-mono text-[10px] opacity-70 ml-0.5">{timeframe}</span>
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] text-gray-500 tabular-nums">
                    {hoverPt
                      ? tipTimeFor(timeframe)(hoverPt.t)
                      : ms && ms.taoPrice > 0 && ms.priceUsd > 0
                        ? `${(ms.priceUsd / ms.taoPrice).toFixed(6)} TAO · τ ${fmtUsd(ms.taoPrice, 2)}`
                        : ""}
                  </div>
                </div>
              </div>

              {/* USD change at fixed offsets, from the same series as the chart */}
              {usdChanges && (
                <div className="grid grid-cols-4 gap-1.5 mt-3.5">
                  {([["1h", usdChanges.h1], ["24h", usdChanges.h24], ["7d", usdChanges.d7], ["30d", usdChanges.d30]] as const).map(([label, val]) => (
                    <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-2 py-1.5 text-center">
                      <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-gray-600">{label}</div>
                      <div className={`font-mono text-[12px] font-semibold tabular-nums ${val == null ? "text-gray-600" : pctColor(val)}`}>{val == null ? "-" : fmtPct(val)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Timeframe: full-width segmented control on phones */}
              <div className="ag-pill-tabs !flex w-full sm:!inline-flex sm:w-auto mt-3.5 mb-2">
                {TIMEFRAMES.map((tf) => (
                  <button key={tf} onClick={() => setTimeframe(tf)}
                    className={`ag-pill-tab flex-1 sm:flex-none !px-3 sm:!px-4 !py-1.5 text-xs text-center ${timeframe === tf ? "ag-pill-tab-on" : ""}`}>
                    {tf}
                  </button>
                ))}
              </div>

              {/* Chart */}
              <div className="-mx-1">
                {yearLoading && timeframe === "1Y" && chartData.length < 2
                  ? <div className="flex items-center justify-center h-[210px] md:h-[280px] text-gray-600 text-xs gap-2">
                      <span className="animate-spin">⟳</span> Loading 1Y price history…
                    </div>
                  : <PriceChart data={chartData} color={chartColor} timeframe={timeframe} onHover={setHoverPt} />
                }
              </div>

              {/* 24h range */}
              {ms && ms.high24hUsd > 0 && (
                <div className="mt-3 flex items-center gap-3 font-mono text-[10.5px] text-gray-500 tabular-nums">
                  <span><span className="text-gray-600">L</span> <span className="text-red-300">{fmtPrice(ms.low24hUsd)}</span></span>
                  <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden relative">
                    <div className="h-full bg-gradient-to-r from-red-400/70 to-emerald-400/70 rounded-full" style={{
                      width: ms.high24hUsd > ms.low24hUsd
                        ? `${Math.max(2, Math.min(100, (ms.priceUsd - ms.low24hUsd) / (ms.high24hUsd - ms.low24hUsd) * 100)).toFixed(1)}%`
                        : "50%"
                    }} />
                  </div>
                  <span><span className="text-gray-600">H</span> <span className="text-emerald-300">{fmtPrice(ms.high24hUsd)}</span></span>
                  <span className="text-gray-700 hidden sm:inline">24h range</span>
                </div>
              )}
            </div>

            {/* ── Actions & links (moved below the chart for clean shareable headers) ── */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => toggleWatchlist(data.netuid)}
                disabled={watchlistBusy}
                className={`flex items-center gap-1.5 text-xs font-medium rounded-full px-3.5 py-1.5 border transition-colors disabled:opacity-50 ${
                  isWatched(data.netuid)
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400"
                    : "bg-white/[0.05] border-white/[0.12] text-gray-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-400"
                }`}
                title={isWatched(data.netuid) ? "Remove from watchlist" : "Add to watchlist"}
              >
                {watchlistBusy ? "…" : isWatched(data.netuid) ? "★ Watching" : "☆ Watchlist"}
              </button>
              <button
                onClick={() => {
                  const q = `Give me a full investment analysis of ${data.name} (SN${data.netuid}). Cover: aGap score (${agap}/100), dev score (${dev}/100), social score (${social}/100), flow score (${flow}/100), current price action, emission %, whale activity, and whether this belongs in a long-term portfolio right now.`;
                  router.push(`/oracle?q=${encodeURIComponent(q)}`);
                }}
                className="flex items-center gap-1.5 text-xs font-medium rounded-full px-3.5 py-1.5 border bg-violet-500/10 border-violet-500/40 text-violet-400 hover:bg-violet-500/20 transition-colors"
                title="Ask Oracle about this subnet"
              >
                <AgIcon name="oracle" /> Ask Oracle
              </button>
              {data.identity?.website && (
                <a href={data.identity.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-white/[0.04] border border-white/[0.10] hover:border-white/[0.18] rounded-full px-3.5 py-1.5 transition-colors backdrop-blur-[14px]">
                  <AgIcon name="globe" /> Website
                </a>
              )}
              {data.identity?.github_repo && (
                <a href={data.identity.github_repo} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-white/[0.04] border border-white/[0.10] hover:border-white/[0.18] rounded-full px-3.5 py-1.5 transition-colors backdrop-blur-[14px]">
                  ⎇ GitHub
                </a>
              )}
              {data.identity?.twitter && (
                <a href={`https://x.com/${data.identity.twitter.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-white/[0.04] border border-white/[0.10] hover:border-white/[0.18] rounded-full px-3.5 py-1.5 transition-colors backdrop-blur-[14px]">
                  𝕏 X
                </a>
              )}
              {data.identity?.discord && (
                <a href={data.identity.discord} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-white/[0.04] border border-white/[0.10] hover:border-white/[0.18] rounded-full px-3.5 py-1.5 transition-colors backdrop-blur-[14px]">
                  Discord
                </a>
              )}
              {(SUBNET_DASHBOARDS[data.netuid] ?? []).map((d, i) => (
                <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-full px-3.5 py-1.5 transition-colors">
                  <AgIcon name="chart" /> {d.label}
                </a>
              ))}
              {watchlistError && (
                <span className="text-xs text-red-400">{watchlistError}</span>
              )}
            </div>

            {/* ── AlphaGap score charts ─────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-mono text-[11px] font-semibold text-gray-500 uppercase tracking-[0.16em]">AlphaGap Score History</h2>
                <span className="text-xs text-gray-600">
                  {data.scoreHistory.length > 0
                    ? `${data.scoreHistory.length} snapshot${data.scoreHistory.length !== 1 ? "s" : ""}`
                    : "No history yet"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "aGap", data: agapSeries, color: "#4ade80", current: agap },
                  { label: "Flow", data: flowSeries, color: "#34d399", current: flow },
                  { label: "Dev", data: devSeries, color: "#60a5fa", current: dev },
                  { label: "eVal", data: evalSeries, color: "#a78bfa", current: evalScore },
                  { label: "Social", data: socialSeries, color: "#22d3ee", current: social },
                ].map(({ label, data: d, color, current: cur, formatY }: { label: string; data: { x: string; y: number }[]; color: string; current: number; formatY?: (v: number) => string }) => (
                  <div key={label} className="ag-glass p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[10.5px] text-gray-500 uppercase tracking-[0.16em]">{label}</span>
                      <span className={`font-display text-lg font-semibold tabular-nums ${scoreColor(cur)}`}>
                        {formatY ? formatY(cur) : Math.round(cur)}
                      </span>
                    </div>
                    <ScoreChart data={d} color={color} label={label} formatY={formatY} />
                  </div>
                ))}
                {/* aGap Rank chart - inverted y-axis, rank 1 = top */}
                <div className="ag-glass p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0">
                      <span className="font-mono text-[10.5px] text-gray-500 uppercase tracking-[0.16em]">aGap Rank</span>
                      <span className="text-[10px] text-gray-600 ml-1.5 hidden sm:inline">best rank per day</span>
                    </div>
                    <span className="font-display text-lg font-semibold tabular-nums text-amber-400">
                      {currentRank != null ? `#${currentRank}` : "-"}
                    </span>
                  </div>
                  <ScoreChart
                    data={rankSeries}
                    color="#f59e0b"
                    label="aGap Rank"
                    formatY={(v) => `#${Math.round(v)}`}
                    invertY={true}
                  />
                </div>
              </div>
            </div>

            {/* ── TAO Flow EMA Chart ──────────────────────────────── */}
            <div className="ag-glass p-4 md:p-5">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-mono text-[11px] font-semibold text-gray-500 uppercase tracking-[0.16em]">TAO Flow EMA</h2>
                <span className="text-xs text-gray-600">emission trajectory indicator</span>
              </div>
              <TaoFlowChart allData={data.flowHistory ?? []} />
            </div>

            {/* ── Emission Trajectory ─────────────────────────────── */}
            {emissionSeries.length > 0 && (
              <div className="ag-glass !border-amber-500/20 p-4 md:p-5">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h2 className="font-mono text-[11px] font-semibold text-gray-500 uppercase tracking-[0.16em]">Emission Trajectory</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      This subnet&apos;s share of total TAO emissions over time. Rising emissions = network is rewarding this subnet more heavily - often a leading indicator of price action.
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <span className="font-display text-2xl font-semibold tabular-nums text-amber-400">
                      {(emissionPct * 100).toFixed(2)}%
                    </span>
                    {emissionSeries.length >= 2 && (() => {
                      const prev = emissionSeries[emissionSeries.length - 2]?.y ?? 0;
                      const curr = emissionSeries[emissionSeries.length - 1]?.y ?? 0;
                      const delta = curr - prev;
                      if (Math.abs(delta) < 0.001) return null;
                      return (
                        <div className={`text-xs font-medium tabular-nums mt-0.5 ${delta > 0 ? "text-green-400" : "text-red-400"}`}>
                          {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(3)}% vs last scan
                        </div>
                      );
                    })()}
                    <div className="text-xs text-gray-600 mt-0.5">current allocation</div>
                  </div>
                </div>
                <div className="mt-3">
                  <ScoreChart
                    data={emissionSeries}
                    color="#f59e0b"
                    label="Emission %"
                    formatY={(v) => `${v.toFixed(2)}%`}
                  />
                </div>
              </div>
            )}

            {/* Description */}
            {(data.identity?.summary || data.identity?.description) && (
              <p className="text-gray-400 text-sm max-w-2xl">{data.identity.summary || data.identity.description}</p>
            )}

            {/* ── Recent signals ─────────────────────────────────── */}
            {data.signals.length > 0 && (
              <div>
                <h2 className="font-mono text-[11px] font-semibold text-gray-500 uppercase tracking-[0.16em] mb-3">Recent Signals</h2>
                <div className="space-y-2">
                  {data.signals.slice(0, 8).map((sig, i) => (
                    <div key={i} className={`ag-glass !rounded-2xl px-4 py-3 flex items-start gap-3 ${
                      sig.strength >= 80 ? "!border-emerald-500/25" : sig.strength >= 50 ? "!border-yellow-500/15" : ""
                    }`}>
                      <div className="shrink-0 text-base">
                        {sig.signal_type === "dev_spike" ? <AgIcon name="bolt" /> : sig.signal_type === "release" ? <AgIcon name="rocket" /> : sig.signal_type === "hf_update" ? <AgIcon name="robot" /> : sig.signal_type === "flow_inflection" ? "↗" : "•"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-gray-500">
                            {new Date(sig.signal_date || sig.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          <span className="text-xs text-gray-600">via {sig.source}</span>
                          {sig.source_url && (
                            <a href={sig.source_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:underline">View →</a>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 truncate">{sig.title}</p>
                      </div>
                      <div className={`text-sm font-bold shrink-0 ${sig.strength >= 80 ? "text-green-400" : sig.strength >= 50 ? "text-yellow-400" : "text-gray-500"}`}>
                        {sig.strength}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Product Benchmark ──────────────────────────────── */}
            {bench && (
              <div>
                <h2 className="font-mono text-[11px] font-semibold text-gray-500 uppercase tracking-[0.16em] mb-3">Product Benchmark</h2>
                <div className="ag-glass p-4 md:p-5">
                  <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
                    <div className="shrink-0">
                      <span className={`font-display text-4xl md:text-5xl font-semibold tabular-nums ${scoreColor(bench.benchmark_score)}`}>
                        {bench.benchmark_score}
                      </span>
                      <span className="text-xs text-gray-600 ml-1.5">/ 100</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] bg-white/[0.05] border border-white/[0.08] rounded-full px-2.5 py-0.5 text-gray-400">
                          {bench.benchmark_category}
                        </span>
                        <span className="text-xs text-gray-500">vs {bench.vs_provider}</span>
                      </div>
                      <p className="text-sm text-emerald-400/90 mt-1.5">{bench.perf_delta}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed mt-3">{bench.benchmark_summary.split(" CAVEATS:")[0].split(" AUDIT:")[0]}</p>
                  {(bench.dashboards?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(bench.dashboards ?? []).map((d, i) => (
                        <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-full px-3 py-1 transition-colors">
                          <AgIcon name="chart" /> {d.label}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="font-mono text-[10px] text-gray-600 uppercase tracking-[0.16em] mt-4">
                    Product research, Aug 2026. Revenue and buybacks on the Revenue &amp; Valuations page.
                  </div>
                </div>
              </div>
            )}

            {/* ── Operational Audit ──────────────────────────────── */}
            {audit && (
              <div>
                <h2 className="font-mono text-[11px] font-semibold text-gray-500 uppercase tracking-[0.16em] mb-3">Operational Audit</h2>
                <div className="ag-glass p-4 md:p-5">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <span className={`font-display text-5xl font-semibold leading-none ${GRADE_COLORS[audit.grade] ?? "text-gray-400"}`}>
                      {audit.grade}
                    </span>
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`font-display text-2xl font-semibold tabular-nums ${scoreColor(audit.operationalScore)}`}>
                          {Math.round(audit.operationalScore)}
                        </span>
                        <span className="text-xs text-gray-600">/ 100</span>
                      </div>
                      <div className="font-mono text-[10px] text-gray-600 uppercase tracking-[0.16em] mt-0.5">Operational Score</div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 sm:ml-auto font-mono text-[11px] tabular-nums">
                      <div>
                        <span className="text-gray-600 uppercase mr-1.5">Nakamoto</span>
                        <span className="text-gray-300">{audit.nakamotoCoefficient}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 uppercase mr-1.5">Top 10</span>
                        <span className="text-gray-300">{(audit.top10Share * 100).toFixed(1)}%</span>
                      </div>
                      {audit.holdersCount != null && (
                        <div>
                          <span className="text-gray-600 uppercase mr-1.5">Holders</span>
                          <span className="text-gray-300">{fmtNum(audit.holdersCount)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {auditFlags.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {auditFlags.map((f, i) => (
                        <div key={i} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 ${
                          f.severity === "critical"
                            ? "border-red-500/25 bg-red-500/[0.06]"
                            : "border-amber-500/20 bg-amber-500/[0.05]"
                        }`}>
                          <span className={`shrink-0 mt-0.5 ${f.severity === "critical" ? "text-red-400" : "text-amber-400"}`}>
                            <AgIcon name="warning" />
                          </span>
                          <div className="min-w-0">
                            <span className={`font-mono text-[10px] uppercase tracking-[0.14em] mr-2 ${
                              f.severity === "critical" ? "text-red-400" : "text-amber-400"
                            }`}>{f.severity}</span>
                            <span className="text-xs text-gray-400">{f.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── KOL Chatter ────────────────────────────────────── */}
            {hotTweets.length > 0 && (
              <div>
                <h2 className="font-mono text-[11px] font-semibold text-gray-500 uppercase tracking-[0.16em] mb-3">KOL Chatter</h2>
                <div className="space-y-2">
                  {hotTweets.map((t) => (
                    <div key={t.tweet_id} className="ag-glass !rounded-2xl px-4 py-3 flex items-start gap-3">
                      <div className="shrink-0 w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.10] flex items-center justify-center font-display font-semibold text-sm text-gray-300">
                        {(t.kol_name || t.kol_handle || "?").trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm text-white font-medium">{t.kol_name}</span>
                          <span className="font-mono text-[10.5px] text-gray-500">@{t.kol_handle.replace(/^@/, "")}</span>
                          <span className="font-mono text-[10px] tabular-nums text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
                            HEAT {Math.round(t.heat_score)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed" style={{
                          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
                        }}>{t.tweet_text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Similar Subnets ────────────────────────────────── */}
            {similarSubnets.length > 0 && (
              <div>
                <h2 className="font-mono text-[11px] font-semibold text-gray-500 uppercase tracking-[0.16em] mb-3">Similar Subnets</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {similarSubnets.map((s) => (
                    <Link key={s.subnet_id} href={`/subnets/${s.subnet_id}`}
                      className="ag-glass ag-glass-hover p-3.5 flex items-center gap-3 group">
                      <SubnetLogo netuid={s.subnet_id} name={s.subnet_name} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-300 group-hover:text-white transition-colors truncate">{s.subnet_name}</div>
                        <div className="font-mono text-[10px] text-gray-600 uppercase tracking-[0.14em]">SN{s.subnet_id}</div>
                      </div>
                      <span className={`font-display text-lg font-semibold tabular-nums shrink-0 ${scoreColor(s.benchmark_score)}`}>
                        {s.benchmark_score}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Compact sidebar ───────────────────────────── */}
          <div className="space-y-3">

            {/* aGap score badge */}
            <div className="ag-glass !border-emerald-500/25 p-3.5">
              <div className="font-mono text-[10px] font-semibold text-emerald-400/70 uppercase tracking-[0.16em] mb-1.5">AlphaGap Score</div>
              <div className="flex items-baseline gap-2">
                <span className={`font-display text-3xl font-semibold tabular-nums ${scoreColor(agap)}`}>{agap}</span>
                <span className="text-xs text-gray-600">/ 100</span>
              </div>
            </div>

            {/* Market data */}
            <div className="ag-glass p-3.5">
              <div className="font-mono text-[10px] font-semibold text-gray-500 uppercase tracking-[0.16em] mb-2">Market Data</div>
              <StatItem label="Market Cap" value={ms ? fmtUsd(ms.marketCapUsd) : "-"} />
              <StatItem label="FDV" value={ms ? fmtUsd(ms.fdvUsd) : "-"} />
              <StatItem label="24h Volume" value={ms ? fmtUsd(ms.volume24hUsd) : "-"} />
              {/* Trade counts only exist in TaoStats. When it has none (null),
                  hide the row instead of showing "0 / 0", which reads as a dead market. */}
              {ms && ms.buys24h != null && ms.sells24h != null && (ms.buys24h > 0 || ms.sells24h > 0) && (
                <StatItem label="Buys / Sells" value={`${ms.buys24h} / ${ms.sells24h}`} sub="24h" />
              )}
              <StatItem label="Circ. Supply" value={ms ? fmtNum(ms.circulatingSupply) : "-"} />
              <StatItem label="In Pool" value={ms ? fmtNum(ms.alphaInPool) : "-"} />
              <StatItem label="Staked" value={ms ? fmtNum(ms.alphaStaked) : "-"} />
            </div>

            {/* Fear & Greed */}
            {ms && ms.fearGreedIndex > 0 && (
              <div className="ag-glass p-3.5">
                <div className="font-mono text-[10px] font-semibold text-gray-500 uppercase tracking-[0.16em] mb-2">Fear &amp; Greed</div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-lg font-bold ${ms.fearGreedIndex >= 75 ? "text-green-400" : ms.fearGreedIndex >= 50 ? "text-yellow-400" : ms.fearGreedIndex >= 25 ? "text-orange-400" : "text-red-400"}`}>
                    {Math.round(ms.fearGreedIndex)}
                  </span>
                  <span className={`text-xs font-medium ${ms.fearGreedIndex >= 75 ? "text-green-400" : ms.fearGreedIndex >= 50 ? "text-yellow-400" : ms.fearGreedIndex >= 25 ? "text-orange-400" : "text-red-400"}`}>
                    {ms.fearGreedSentiment}
                  </span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-400"
                    style={{ width: `${ms.fearGreedIndex}%` }} />
                </div>
              </div>
            )}

            {/* TAO Pages link */}
            <Link
              href={`/taopages/${taoPageSlug(data.netuid, data.name)}`}
              className="ag-glass ag-glass-hover !border-emerald-500/20 flex items-center justify-between p-3.5 group"
            >
              <div>
                <div className="font-mono text-[10px] font-semibold text-emerald-500 uppercase tracking-[0.16em] mb-0.5">TAO Pages</div>
                <div className="text-xs text-gray-400 group-hover:text-white transition-colors">Plain-English explainer for {data.name}</div>
              </div>
              <svg className="w-4 h-4 text-emerald-600 group-hover:text-emerald-400 transition-colors shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            {/* Network */}
            <div className="ag-glass p-3.5">
              <div className="font-mono text-[10px] font-semibold text-gray-500 uppercase tracking-[0.16em] mb-2">Network</div>
              <StatItem label="Validators" value={String(data.metagraph.validators)} />
              <StatItem label="Miners" value={String(data.metagraph.miners)} />
              <StatItem label="Neurons" value={String(data.metagraph.totalNeurons)} />
              <StatItem label="Emission" value={emissionPct > 0 ? `${(emissionPct * 100).toFixed(2)}%` : "-"} />
            </div>

            {data.lastScan && (
              <p className="text-[10px] text-gray-700 text-center">
                Scan: {new Date(data.lastScan).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
        <span>AlphaGap v0.3 - Bittensor Subnet Intelligence</span>
        <SocialLinks />
      </footer>
    </div>
  );
}
