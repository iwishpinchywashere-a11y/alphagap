"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import SubnetDetailPanel from "@/components/dashboard/SubnetDetailPanel";
import SubnetHoverCard from "@/components/dashboard/SubnetHoverCard";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import AgIcon from "@/components/AgIcon";
import { scoreColor, flowColor, formatNum } from "@/lib/formatters";
import { getTier, canAccessPro, canAccessPremium } from "@/lib/subscription";
import type { SubnetScore } from "@/lib/types";
import { useWatchlist } from "@/components/dashboard/WatchlistProvider";


// [key, shortLabel, tooltip, fullName?]
// fullName is shown as the popup title when the label is abbreviated.
const COLUMNS: [keyof SubnetScore, string, string, string?][] = [
  ["composite_score", "aGap",    "AlphaGap Score (0-100). Our composite intelligence score. Identifies subnets where fundamentals significantly exceed current market valuation — the higher the score, the larger the opportunity gap our models have detected.", "AlphaGap Score"],
  ["agap_velo",       "Velo",    "aGap Velocity (0–100). Measures the speed and significance of a subnet's score movement. Weights both how fast the score is changing and how meaningful that level is — a move from 50→80 scores far higher than 1→20. 80–100 = explosive upward momentum. Below 30 = declining.", "Velocity"],
  ["flow_score",      "Flow",    "Momentum Score (0-100). Tracks price action across multiple timeframes, whale and smart money movements, and unusual volume surges. High flow = strong market momentum and accumulation signals.", "Flow / Momentum"],
  ["dev_score",       "Dev",     "Development Score (0-100). Measures the quality and velocity of real engineering work happening inside the subnet. Built on proprietary analysis of actual development activity.", "Development"],
  ["eval_score",      "eVal",    "Emissions-to-Valuation Score (0-100). Measures how much the Bittensor network is paying out to this subnet relative to what the market has priced in. High eVal = strong network conviction, undervalued by the market.", "Emissions-to-Valuation"],
  ["product_score",   "Prod",    "Product & Utility Score (0-100). Assesses real-world deployments and evidence of actual usage. Formally benchmarked subnets (highest confidence) are marked without a tilde. Estimated scores are shown as ~N. This column is the core early alpha detector: subnets building real product the market hasn't priced in.", "Product & Utility"],
  ["social_score",    "Soc",     "Social Velocity Score (0-100). Measures community awareness and KOL engagement across the Bittensor ecosystem.", "Social"],
  ["audit_score",     "Aud",     "Operational Health Score (0–100). Measures decentralisation, validator health, token distribution, and network security. Acts as a risk filter on the trading aGap score (low scores apply a penalty) and as a full positive component in the investing score. ≥70 = healthy (green), 50–69 = moderate (yellow), 30–49 = elevated risk (orange), <30 = high risk (red).", "Audit / Health"],
  ["emission_pct",    "Em %",    "Emission share — percentage of total Bittensor network emissions currently allocated to this subnet.", "Emission %"],
  ["emission_change_pct", "Em Δ","Recent change in emission allocation. Green = the network is voting more resources toward this subnet. Red = allocation is declining.", "Emission Change"],
  ["apy_7d",          "APY",    "7-day staking yield (annualised). Stake-weighted average APY across active validators on this subnet. Measures what stakers are actually earning right now, extrapolated to a full year.", "Staking APY (7d)"],
  ["alpha_price",     "Price",   "Current alpha token price in USD."],
  ["market_cap",      "MCap",    "Total market capitalization in USD.", "Market Cap"],
  ["price_change_1h", "1h %",    "Price change in the last 1 hour.", "1h Price Change"],
  ["price_change_24h","24h %",   "Price change in the last 24 hours.", "24h Price Change"],
  ["price_change_7d", "7d %",    "Price change over the last 7 days.", "7d Price Change"],
  ["price_change_30d","30d %",   "Price change over the last 30 days.", "30d Price Change"],
  ["net_flow_24h",    "24h Net", "Net USD flow in the last 24 hours. Positive = net buying pressure. A key early signal for institutional or whale accumulation.", "24h Net Flow"],
];

// Separate component for useSearchParams (requires Suspense boundary).
// When returning from Stripe (?welcome=true):
//   1. Calls /api/sync-subscription to pull live status directly from Stripe
//   2. Once active, does a hard redirect to /dashboard (drops ?welcome=true)
//      so the page reloads with the fresh session cookie — guaranteed to show Pro.
function WelcomeRefresh() {
  const searchParams = useSearchParams();
  const { update: updateSession } = useSession();

  useEffect(() => {
    if (searchParams.get("welcome") !== "true") return;

    let attempts = 0;
    const maxAttempts = 15;
    let timerId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (attempts >= maxAttempts) return;
      attempts++;
      try {
        // 1. Ask server to sync subscription status directly from Stripe API
        const res = await fetch("/api/sync-subscription", { method: "POST" });
        const data = await res.json() as { status?: string };
        if (data.status === "active" || data.status === "trialing") {
          // 2. Re-encode the JWT cookie with fresh data from blob
          await updateSession();
          // 3. Hard reload so the page reads the updated cookie
          window.location.replace("/dashboard");
          return;
        }
      } catch {
        // ignore, retry
      }
      timerId = setTimeout(poll, 2000);
    };

    timerId = setTimeout(poll, 1000);
    return () => clearTimeout(timerId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}

export default function LeaderboardPage() {
  const { leaderboard, taoPrice, scanning, signals, setSelectedSubnet, infoPopup, setInfoPopup } = useDashboard();
  const router = useRouter();
  const { data: session } = useSession();
  const tier = getTier(session);
  const isPro = canAccessPro(tier);
  const [sortCol, setSortCol] = useState<keyof SubnetScore>("composite_score");
  const [sortAsc, setSortAsc] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMinCap, setFilterMinCap] = useState(false);
  const [filterHasEmissions, setFilterHasEmissions] = useState(false);
  const [filterWhaleAccum, setFilterWhaleAccum] = useState(false);
  const [infoRect, setInfoRect] = useState<{ top: number; right: number } | null>(null);
  const [filterEmissionsRising, setFilterEmissionsRising] = useState(false);
  const [filterOversoldQuality, setFilterOversoldQuality] = useState(false);
  const [filterKolActive, setFilterKolActive] = useState(false);
  const [filterNetInflow, setFilterNetInflow] = useState(false);
  const [filterHighConviction, setFilterHighConviction] = useState(false);
  const [filterVolumeSurge, setFilterVolumeSurge] = useState(false);
  const [filterDeregWatch, setFilterDeregWatch] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [timeHorizon, setTimeHorizon] = useState<"trading" | "investing">("trading");
  const [showInvestingGate, setShowInvestingGate] = useState(false);
  const isPremium = canAccessPremium(tier);
  const { isWatched, watchlist } = useWatchlist();
  const [watchlistOnly, setWatchlistOnly] = useState(false);

  // ── Hover card (desktop only) ─────────────────────────────────────
  const [hoveredSub, setHoveredSub] = useState<SubnetScore | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setHoveredSub(null);
      setHoverPos(null);
    }, 120);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  // Sticky header: show a fixed clone of the thead once the real one scrolls off screen
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [stickyLeft, setStickyLeft] = useState(0);
  const [stickyWidth, setStickyWidth] = useState(0);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  // Ref to the inner table of the sticky clone — we translateX it to mirror horizontal scroll
  const stickyTableRef = useRef<HTMLTableElement>(null);
  // Measured widths of each real th so the clone columns match exactly
  const [colWidths, setColWidths] = useState<number[]>([]);
  // Left padding of the table wrapper (px-4 on mobile, 0 on desktop) — needed to align clone
  const [wrapperPadLeft, setWrapperPadLeft] = useState(0);

  // Measure real column widths and wrapper padding, keep them up-to-date
  useEffect(() => {
    const measure = () => {
      if (!theadRef.current || !tableWrapperRef.current) return;
      const ths = Array.from(theadRef.current.querySelectorAll("th"));
      setColWidths(ths.map((th) => th.getBoundingClientRect().width));
      setWrapperPadLeft(parseFloat(window.getComputedStyle(tableWrapperRef.current).paddingLeft) || 0);
    };
    const t = setTimeout(measure, 100);
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [leaderboard.length]);

  useEffect(() => {
    // Wait until leaderboard is rendered — tableWrapperRef is null when leaderboard is empty
    if (leaderboard.length === 0) return;

    const onWindowScroll = () => {
      if (!theadRef.current || !tableWrapperRef.current) return;
      const rect = theadRef.current.getBoundingClientRect();
      setStickyVisible(rect.bottom < 0);
      if (rect.bottom < 0) {
        const wRect = tableWrapperRef.current.getBoundingClientRect();
        setStickyLeft(wRect.left);
        setStickyWidth(wRect.width);
      }
    };
    // Mirror horizontal scroll by translating the clone table — works in all mobile browsers
    const onTableScroll = () => {
      if (stickyTableRef.current && tableWrapperRef.current) {
        stickyTableRef.current.style.transform = `translateX(-${tableWrapperRef.current.scrollLeft}px)`;
      }
    };
    window.addEventListener("scroll", onWindowScroll, { passive: true });
    const wrapper = tableWrapperRef.current;
    if (wrapper) wrapper.addEventListener("scroll", onTableScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onWindowScroll);
      if (wrapper) wrapper.removeEventListener("scroll", onTableScroll);
    };
  }, [leaderboard.length]);

  // Returns the aGap score for a subnet based on the active time horizon
  const activeAGap = (sub: SubnetScore) =>
    timeHorizon === "investing" ? (sub.invest_agap ?? sub.composite_score) : sub.composite_score;

  const handleSort = (col: keyof SubnetScore) => {
    if (!isPro) return; // free users cannot sort
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
  };

  const q = searchQuery.toLowerCase().trim();
  const sortedLeaderboard = [...leaderboard]
    .filter((sub) => !q || sub.name.toLowerCase().includes(q) || `sn${sub.netuid}`.includes(q))
    .filter((sub) => !filterMinCap || (sub.market_cap != null && sub.market_cap >= 5_000_000))
    .filter((sub) => !filterHasEmissions || (sub.emission_pct != null && sub.emission_pct > 0))
    .filter((sub) => !filterWhaleAccum || sub.whale_signal === "accumulating")
    .filter((sub) => !filterEmissionsRising || sub.emission_trend === "up")
    .filter((sub) => !filterOversoldQuality || ((sub.dev_score ?? 0) >= 50 && (sub.price_change_7d ?? 0) <= -20))
    .filter((sub) => !filterKolActive || (sub.social_score ?? 0) >= 60)
    .filter((sub) => !filterNetInflow || (sub.net_flow_24h != null && sub.net_flow_24h > 0))
    .filter((sub) => !filterHighConviction || (sub.emission_trend === "up" && sub.whale_signal === "accumulating" && (sub.dev_score ?? 0) >= 40))
    .filter((sub) => !filterVolumeSurge || sub.volume_surge === true)
    .filter((sub) => !filterDeregWatch || sub.dereg_top3 === true)
    .filter((sub) => !filterCategory || sub.category === filterCategory)
    .filter((sub) => !watchlistOnly || watchlist.has(sub.netuid))
    .sort((a, b) => {
      // In investing mode, sort the aGap column by invest_agap instead of composite_score
      const av = (sortCol === "composite_score" && timeHorizon === "investing")
        ? (a.invest_agap ?? a.composite_score)
        : (a[sortCol] ?? -Infinity);
      const bv = (sortCol === "composite_score" && timeHorizon === "investing")
        ? (b.invest_agap ?? b.composite_score)
        : (b[sortCol] ?? -Infinity);
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

  return (
    <main className="flex-1 flex overflow-x-hidden">
      {/* Refreshes session 3s after returning from Stripe payment */}
      <Suspense fallback={null}><WelcomeRefresh /></Suspense>
      <div className="ag-aurora bg-[#0a0a0f] flex-1 overflow-auto p-4 md:p-6 max-w-full">
        {/* Refreshing banner */}
        {scanning && leaderboard.length > 0 && (
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white/40 ag-glass rounded-xl px-3.5 py-2 mb-4">
            <span className="animate-spin text-emerald-400">&#x21BB;</span>
            <span>Refreshing data in background&hellip;</span>
          </div>
        )}

        {/* First-load spinner */}
        {scanning && leaderboard.length === 0 && (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <div className="text-4xl mb-4 animate-spin text-emerald-400">&#x21BB;</div>
            <h2 className="font-display font-semibold text-xl tracking-[-0.02em] mb-2">Loading Data&hellip;</h2>
            <p className="text-white/40 max-w-md mb-4">Pulling prices, dev activity, and signals from all sources.</p>
            <div className="w-64 h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-green-400 rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>
        )}

        {/* Empty state */}
        {!scanning && leaderboard.length === 0 && (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <div className="text-6xl mb-4">&#x1F50D;</div>
            <h2 className="font-display font-semibold text-xl tracking-[-0.02em] mb-2">Scanning…</h2>
            <p className="text-white/40 max-w-md">Fetching the latest subnet data.</p>
          </div>
        )}

        {leaderboard.length > 0 && (
          <div>
            {/* ── Hero Header ──────────────────────────────────────────── */}
            {/* NOTE: no overflow-hidden on the outer shell — it clips the filter dropdown. */}
            {/* Decorative elements are scoped inside their own overflow-hidden child instead. */}
            <div className="relative -mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-6 border-b border-white/[0.06]">
              <div className="relative px-4 md:px-6 pt-8 pb-5">
                {/* Title + subtitle */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h1 className="font-display font-semibold text-3xl md:text-[36px] tracking-[-0.03em] text-white leading-tight mb-1">
                      <AgIcon name="crown" className="w-7 h-7 text-emerald-300 inline-block align-[-0.12em] mr-2" />Alpha <span className="ag-gradient-text">Leaderboard</span>
                    </h1>
                  </div>
                  {scanning && (
                    <div className="flex-shrink-0 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35 px-3 py-1.5 rounded-full ag-glass">
                      <span className="ag-live-dot" />
                      <span className="text-emerald-400">Live</span>
                    </div>
                  )}
                </div>

                {/* Mono LIVE row */}
                <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white/35 mb-4">
                  <span className="ag-live-dot" />
                  Live · Updates every 10 min · {leaderboard.length} subnets
                </div>

                {/* Controls row */}
                <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Search subnets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/[0.035] backdrop-blur-xl border border-white/[0.08] rounded-full px-4 py-1.5 text-sm text-white/70 placeholder-white/25 focus:outline-none focus:border-emerald-500/30 w-full max-w-[180px]"
              />
              {/* Time Horizon toggle */}
              <div className="relative flex-shrink-0">
                {showInvestingGate && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowInvestingGate(false)} />
                    <div
                      className="absolute left-0 top-full mt-2 z-50 w-64 p-3.5 bg-[#0d1113]/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl shadow-2xl text-xs leading-relaxed"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-400 mb-1.5">
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 11V5.5"/><path d="M6 5.5C6 3 3.5 1.5 1.5 2C2 4.5 4 5.5 6 5.5z" fill="currentColor" strokeWidth="1"/><path d="M6 5.5C6 3 8.5 1.5 10.5 2C10 4.5 8 5.5 6 5.5z" fill="currentColor" strokeWidth="1"/></svg>
                        Investing Analysis
                      </div>
                      <p className="text-white/50 mb-3 leading-relaxed">Long-term aGap scoring designed for serious investors. Weights real product development, smart money positioning, and fundamental conviction — not short-term noise.</p>
                      <p className="text-white/30 text-[10px] mb-3">Available on Premium only.</p>
                      <a
                        href="/pricing"
                        className="block w-full text-center py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black rounded-lg font-semibold transition-all"
                      >
                        Upgrade to Premium →
                      </a>
                    </div>
                  </>
                )}
                <div className="ag-pill-tabs !p-1">
                  <button
                    onClick={() => { setTimeHorizon("trading"); setShowInvestingGate(false); }}
                    className={`ag-pill-tab !px-3.5 !py-1.5 flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${
                      timeHorizon === "trading" ? "ag-pill-tab-on" : ""
                    }`}
                    title="Trading (Short-Term): aGap optimised for 1–5 day price movements — rewards price lag, social buzz, and short-term reversal patterns."
                  >
                    <svg width="10" height="12" viewBox="0 0 10 13" fill="currentColor" className="flex-shrink-0">
                      <path d="M6.5 0.5L1 7.5h3.5L3 12.5l6-7H5.5L6.5 0.5z" strokeLinejoin="round"/>
                    </svg>
                    Trading
                  </button>
                  <button
                    onClick={() => {
                      if (!isPremium) {
                        setShowInvestingGate(v => !v);
                      } else {
                        setTimeHorizon("investing");
                        setShowInvestingGate(false);
                      }
                    }}
                    className={`ag-pill-tab !px-3.5 !py-1.5 flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${
                      timeHorizon === "investing" ? "ag-pill-tab-on" : ""
                    }`}
                    title={isPremium ? "Investing (Long-Term): aGap optimised for 1–6 month horizon — weights sustained development, real product utility, smart money positioning, and network emissions." : "Investing Analysis — Premium feature"}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                      <path d="M6 11V5.5"/>
                      <path d="M6 5.5C6 3 3.5 1.5 1.5 2C2 4.5 4 5.5 6 5.5z" fill="currentColor" strokeWidth="1"/>
                      <path d="M6 5.5C6 3 8.5 1.5 10.5 2C10 4.5 8 5.5 6 5.5z" fill="currentColor" strokeWidth="1"/>
                    </svg>
                    Investing{!isPremium && <span className="ml-1 text-emerald-500/50">✦</span>}
                  </button>
                </div>
              </div>

              {/* Time Horizon info popover */}
              {(() => {
                const thKey = "time-horizon-info";
                return (
                  <div className="relative flex-shrink-0">
                    <span
                      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-white/[0.14] text-[9px] text-white/30 hover:text-emerald-400 hover:border-emerald-400 cursor-pointer transition-colors"
                      onClick={(e) => { e.stopPropagation(); setInfoPopup(infoPopup === thKey ? null : thKey); }}
                    >
                      i
                    </span>
                    {infoPopup === thKey && (
                      <div
                        className="fixed inset-x-4 top-1/3 z-50 sm:absolute sm:inset-x-auto sm:top-6 sm:right-0 sm:w-72 p-3 bg-[#0d1113]/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl shadow-2xl text-xs text-white/70 leading-relaxed"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="font-display font-semibold text-emerald-400 mb-2">Time Horizon</div>
                        <div className="mb-2">
                          <span className="inline-flex items-center gap-1 text-white font-medium"><svg width="9" height="11" viewBox="0 0 10 13" fill="currentColor"><path d="M6.5 0.5L1 7.5h3.5L3 12.5l6-7H5.5L6.5 0.5z"/></svg>Trading</span>
                          <p className="text-white/50 mt-0.5">Scores subnets on a daily or weekly timeframe. Best for active traders looking to capitalise on near-term catalysts and momentum.</p>
                        </div>
                        <div className="mb-3">
                          <span className="inline-flex items-center gap-1 text-emerald-300 font-medium"><svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 11V5.5"/><path d="M6 5.5C6 3 3.5 1.5 1.5 2C2 4.5 4 5.5 6 5.5z" fill="currentColor" strokeWidth="1"/><path d="M6 5.5C6 3 8.5 1.5 10.5 2C10 4.5 8 5.5 6 5.5z" fill="currentColor" strokeWidth="1"/></svg>Investing</span>
                          <p className="text-white/50 mt-0.5">Scores subnets on a monthly timeframe — prioritising real product development, network health, smart money positioning, and fundamental conviction over short-term price noise.</p>
                        </div>
                        <p className="text-white/30 text-[10px] leading-relaxed border-t border-white/[0.08] pt-2">For educational purposes only. Not financial advice. Scores do not predict prices or future returns. Always do your own research.</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Filters popover */}
              {(() => {
                // Custom SVG icons — no stock emojis
                const IC = {
                  cap:      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="6" cy="6" r="4.5"/><path d="M4.5 7c0 .8.7 1.2 1.5 1.2s1.5-.4 1.5-1.2c0-.7-.5-1-1.5-1.4S4.5 4.9 4.5 4.2C4.5 3.4 5.2 3 6 3s1.5.4 1.5 1.2"/><path d="M6 2.5V3M6 9v.5"/></svg>,
                  emit:     <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 1v2M6 9v2M1 6h2M9 6h2M2.9 2.9l1.4 1.4M7.7 7.7l1.4 1.4M2.9 9.1l1.4-1.4M7.7 4.3l1.4-1.4"/><circle cx="6" cy="6" r="2"/></svg>,
                  whale:    <svg width="12" height="11" viewBox="0 0 13 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 8c1-1.5 2.5-2.5 4-2.5s3 1 4 1c1.5 0 3-1 3-2.5 0-1.2-1-2-2.5-2-1 0-1.5.5-2 1"/><path d="M11.5 8.5c-1 .8-2 1.2-3 1.2-1.2 0-2.5-.5-3.5-.5"/><path d="M4 5.5L5 3.5"/><path d="M7 5.5L8 3.5"/></svg>,
                  rising:   <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 9.5l3-3.5 2.5 2L10 3"/><path d="M7.5 3H10v2.5"/></svg>,
                  oversold: <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 1.5L9.5 7H2.5L6 1.5z"/><path d="M6 5v1.5M6 8.5v.5"/><path d="M3 9.5h6"/></svg>,
                  kol:      <svg width="12" height="11" viewBox="0 0 13 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 7.5V3.5L6.5 2v8L1.5 7.5z"/><rect x="6.5" y="3.5" width="2" height="5" rx=".5"/><path d="M9.5 4.5c.8.4 1 1 1 1.5s-.2 1.1-1 1.5"/></svg>,
                  inflow:   <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 1.5v6M3.5 5l2.5 2.5L8.5 5"/><path d="M2 9.5h8"/></svg>,
                  target:   <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="6" cy="6" r="4.5"/><circle cx="6" cy="6" r="2"/><circle cx="6" cy="6" r=".5" fill="currentColor"/></svg>,
                  surge:    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7.5l2-3 2 1.5 2-4 2 2.5 1.5-2"/></svg>,
                  shield:   <svg width="10" height="11" viewBox="0 0 11 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 1L1 3.5v3c0 2.5 2 4 4.5 5 2.5-1 4.5-2.5 4.5-5v-3L5.5 1z"/><path d="M5.5 5v1.5M5.5 8.5v.3"/></svg>,
                };
                const FILTERS = [
                  { icon: IC.cap,      color: "text-yellow-400",  label: ">$5M MCap",          active: filterMinCap,          set: setFilterMinCap },
                  { icon: IC.emit,     color: "text-cyan-400",    label: "Has Emissions",       active: filterHasEmissions,    set: setFilterHasEmissions },
                  { icon: IC.whale,    color: "text-blue-400",    label: "Whales Buying",       active: filterWhaleAccum,      set: setFilterWhaleAccum },
                  { icon: IC.rising,   color: "text-green-400",   label: "Emissions Rising",    active: filterEmissionsRising, set: setFilterEmissionsRising },
                  { icon: IC.oversold, color: "text-violet-400",  label: "Oversold Quality",    active: filterOversoldQuality, set: setFilterOversoldQuality },
                  { icon: IC.kol,      color: "text-orange-400",  label: "KOL Active",          active: filterKolActive,       set: setFilterKolActive },
                  { icon: IC.inflow,   color: "text-emerald-400", label: "Net Inflow",          active: filterNetInflow,       set: setFilterNetInflow },
                  { icon: IC.target,   color: "text-red-400",     label: "High Conviction",     active: filterHighConviction,  set: setFilterHighConviction },
                  { icon: IC.surge,    color: "text-amber-400",   label: "Volume Surge",        active: filterVolumeSurge,     set: setFilterVolumeSurge },
                  { icon: IC.shield,   color: "text-rose-400",    label: "Dereg Watch",         active: filterDeregWatch,      set: setFilterDeregWatch },
                ] as { icon: React.ReactNode; color: string; label: string; active: boolean; set: React.Dispatch<React.SetStateAction<boolean>> }[];
                const activeCount = FILTERS.filter(f => f.active).length + (filterCategory ? 1 : 0);
                // Collect unique categories from leaderboard for the category picker
                const allCategories = [...new Set(leaderboard.map(s => s.category).filter(Boolean) as string[])].sort();
                return (
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setFiltersOpen(v => !v)}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium border backdrop-blur-xl transition-all whitespace-nowrap ${activeCount > 0 ? "bg-gradient-to-b from-emerald-500/[0.18] to-emerald-500/[0.08] border-emerald-500/30 text-emerald-300 shadow-[0_6px_18px_-8px_rgba(52,211,153,0.35)]" : "bg-white/[0.035] border-white/[0.08] text-white/45 hover:text-white hover:border-white/[0.14]"}`}
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M1 2.5h10M3 6h6M5 9.5h2"/>
                      </svg>
                      <span>Filters</span>
                      {activeCount > 0 && (
                        <span className="bg-emerald-400 text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">{activeCount}</span>
                      )}
                      <svg width="7" height="5" viewBox="0 0 8 5" fill="currentColor" className="opacity-50">
                        {filtersOpen ? <path d="M4 0L8 5H0L4 0z"/> : <path d="M4 5L0 0h8L4 5z"/>}
                      </svg>
                    </button>
                    {filtersOpen && (
                      <>
                        {/* Backdrop — covers everything including footer */}
                        <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setFiltersOpen(false)} />

                        {/* Mobile: fixed bottom sheet. Desktop: absolute dropdown. */}
                        <div className="
                          fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl
                          sm:absolute sm:bottom-auto sm:left-auto sm:right-0 sm:top-full sm:mt-1 sm:rounded-xl sm:w-52
                          bg-[#0d1113]/95 backdrop-blur-xl border border-white/[0.1] shadow-2xl p-3
                          max-h-[70vh] overflow-y-auto
                        ">
                          <div className="flex items-center justify-between mb-2 px-1">
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium">Filter subnets</span>
                            {activeCount > 0 && (
                              <button
                                onClick={() => { FILTERS.forEach(f => f.set(false)); setFilterCategory(""); setFilterDeregWatch(false); }}
                                className="text-[10px] text-white/35 hover:text-red-400 transition-colors"
                              >
                                Clear all
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {FILTERS.map(({ icon, color, label, active, set }) => (
                              <button
                                key={label}
                                onClick={() => set(v => !v)}
                                className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors ${active ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400" : "hover:bg-white/[0.05] text-white/70 border border-transparent"}`}
                              >
                                <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${active ? "bg-emerald-500 border-emerald-500" : "border-white/20"}`}>
                                  {active && <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round"><path d="M1 4l2 2 4-4"/></svg>}
                                </span>
                                <span className={`flex-shrink-0 ${active ? "text-emerald-400" : color}`}>{icon}</span>
                                {label}
                              </button>
                            ))}
                          </div>
                          {/* Category picker */}
                          {allCategories.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/[0.08]">
                              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium px-1 mb-2">Category</div>
                              <div className="flex flex-wrap gap-1">
                                {allCategories.map(cat => (
                                  <button
                                    key={cat}
                                    onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border backdrop-blur-xl transition-colors ${filterCategory === cat ? "bg-emerald-500/[0.15] border-emerald-500/40 text-emerald-300" : "bg-white/[0.03] border-white/[0.1] text-white/45 hover:border-white/25 hover:text-white/80"}`}
                                  >
                                    {cat}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Watchlist filter button */}
              <button
                onClick={() => setWatchlistOnly(v => !v)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium border backdrop-blur-xl transition-colors ${
                  watchlistOnly
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-white/[0.035] border-white/[0.08] text-white/45 hover:text-white hover:border-white/[0.14]"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                My Watchlist
              </button>
                </div>{/* end controls row */}
              </div>{/* end hero inner padding */}
            </div>{/* end hero container */}

            {/* Mobile-only sticky CTA — sits above the horizontally-scrolling table */}
            {!isPro && (
              <div className="md:hidden mb-3 flex flex-col items-center gap-1.5 py-4 px-4 ag-glass rounded-2xl">
                <p className="text-xs text-white font-bold">Top 20 Subnets are hidden on the free plan</p>
                <a
                  href="/pricing"
                  className="font-sans px-8 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl text-base hover:from-green-400 hover:to-emerald-500 transition-all shadow-xl shadow-green-500/30"
                >
                  Get Access →
                </a>
                <p className="text-xs text-white/50">Scroll down to view free analysis</p>
              </div>
            )}

            {/* Fixed sticky header clone — appears once real thead scrolls off screen */}
            {stickyVisible && colWidths.length > 0 && (
              <div
                className="fixed top-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/[0.08] overflow-hidden"
                style={{ left: stickyLeft, width: stickyWidth, paddingLeft: wrapperPadLeft }}
              >
                {/* table-layout:fixed + measured widths = pixel-perfect column alignment.
                    translateX mirrors horizontal scroll without needing a scrollable container. */}
                <table
                  ref={stickyTableRef}
                  style={{ tableLayout: "fixed", width: colWidths.reduce((a, b) => a + b, 0), willChange: "transform" }}
                  className="text-sm font-data"
                >
                  <thead>
                    <tr className="font-mono text-[10px] text-white/35 uppercase tracking-widest">
                      <th className="text-left py-2.5 px-3 font-medium" style={{ width: colWidths[0] }}>#</th>
                      <th className="text-left py-2.5 px-3 font-medium" style={{ width: colWidths[1] }}>Subnet</th>
                      {COLUMNS.map(([key, label], i) => {
                        const w = colWidths[i + 2];
                        const isScore = key === "composite_score";
                        const baseStyle = isScore
                          ? (timeHorizon === "investing"
                              ? { background: "rgba(168,85,247,0.06)", borderLeft: "2px solid rgba(168,85,247,0.15)", width: w }
                              : { background: "rgba(16,185,129,0.06)", borderLeft: "2px solid rgba(16,185,129,0.15)", width: w })
                          : { width: w };
                        return (
                          <th
                            key={key}
                            className={`text-right py-2.5 px-3 font-medium cursor-pointer hover:text-white/70 select-none ${isScore ? (timeHorizon === "investing" ? "text-purple-400/80" : "text-emerald-400/80") : ""}`}
                            style={baseStyle}
                            onClick={() => handleSort(key)}
                          >
                            {isScore ? (timeHorizon === "investing" ? <span className="inline-flex items-center gap-1">aGap <AgIcon name="trendUp" className="w-3 h-3" /></span> : label) : label}
                            {sortCol === key && <span className="ml-1 text-emerald-400">{sortAsc ? "▲" : "▼"}</span>}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                </table>
              </div>
            )}

            <div ref={tableWrapperRef} className="ag-glass rounded-2xl overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
              <table className="w-full text-sm font-data min-w-[900px]">
                <thead ref={theadRef}>
                  <tr className="font-mono text-[10px] text-white/35 uppercase tracking-widest border-b border-white/[0.08]">
                    <th className="text-left py-2.5 px-3 font-medium w-8">#</th>
                    <th className="text-left py-2.5 px-3 font-medium">Subnet</th>
                    {COLUMNS.map(([key, label, tooltip]) => (
                      <React.Fragment key={key}>
                        <th
                          className={`text-right py-2.5 px-3 font-medium transition-colors select-none ${isPro ? "cursor-pointer hover:text-white/70" : "cursor-not-allowed opacity-60"} ${key === "composite_score" ? (timeHorizon === "investing" ? "text-purple-400/80" : "text-emerald-400/80") : ""}`}
                          onClick={() => handleSort(key)}
                          style={key === "composite_score" ? (timeHorizon === "investing" ? { background: "rgba(168, 85, 247, 0.06)", borderLeft: "2px solid rgba(168, 85, 247, 0.15)" } : { background: "rgba(16, 185, 129, 0.06)", borderLeft: "2px solid rgba(16, 185, 129, 0.15)" }) : undefined}
                        >
                          {key === "composite_score" ? (timeHorizon === "investing" ? <span className="inline-flex items-center gap-1">aGap <AgIcon name="trendUp" className="w-3 h-3" /></span> : label) : label}
                          {tooltip && (
                            <span
                              className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-white/[0.14] text-[9px] text-white/30 hover:text-emerald-400 hover:border-emerald-400 cursor-help normal-case tracking-normal"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (infoPopup === key) {
                                  setInfoPopup(null);
                                  setInfoRect(null);
                                } else {
                                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setInfoRect({ top: r.bottom + 6, right: window.innerWidth - r.right });
                                  setInfoPopup(key);
                                }
                              }}
                            >
                              i
                            </span>
                          )}
                          {sortCol === key && (
                            <span className="ml-1 text-emerald-400">{sortAsc ? "\u25B2" : "\u25BC"}</span>
                          )}
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedLeaderboard.map((sub, i) => {
                    const isLocked = !isPro && i < 20;
                    return (<React.Fragment key={sub.netuid}>
                    <tr
                      className={`border-b transition-colors ${isLocked ? "opacity-50 pointer-events-none select-none" : "cursor-pointer"} ${
                        activeAGap(sub) >= 80
                          ? (timeHorizon === "investing" ? "border-purple-500/20 bg-purple-900/10 hover:bg-purple-900/20" : "border-emerald-500/20 bg-emerald-900/15 hover:bg-emerald-900/25")
                          : i % 2 === 0
                          ? "border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03]"
                          : "border-white/[0.04] hover:bg-white/[0.03]"
                      }`}
                      style={isLocked ? { filter: "blur(3px)" } : undefined}
                      onClick={() => !isLocked && router.push(`/subnets/${sub.netuid}`)}
                      onMouseEnter={(e) => {
                        if (isLocked || window.innerWidth < 768) return;
                        cancelClose();
                        if (hoverTimer.current) clearTimeout(hoverTimer.current);
                        const mx = e.clientX;
                        const my = e.clientY;
                        hoverTimer.current = setTimeout(() => {
                          setHoveredSub(sub);
                          setHoverPos({ x: mx, y: my });
                        }, 260);
                      }}
                      onMouseLeave={() => {
                        if (hoverTimer.current) clearTimeout(hoverTimer.current);
                        scheduleClose();
                      }}
                    >
                      <td className="py-2 px-3 text-white text-xs tabular-nums font-medium">{i + 1}</td>
                      <td className="py-2 px-3">
                        {isLocked ? (
                          /* Fully blacked-out on locked rows — no name or logo visible */
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-white/[0.06] flex-shrink-0" />
                            <div className="w-8 h-3 rounded bg-white/[0.06] flex-shrink-0" />
                            <div className="w-24 h-3.5 rounded bg-white/[0.06]" />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <SubnetLogo netuid={sub.netuid} name={sub.name} size={20} />
                            <span className="text-[10px] text-white/30 font-mono tracking-tight">SN{sub.netuid}</span>
                            <span className={`font-semibold text-[15px] leading-tight ${isWatched(sub.netuid) ? "text-blue-400" : "text-white"}`}>{sub.name}</span>
                            {sub.has_campaign && <span title="Active Stitch3 marketing campaign" className="text-sm text-orange-400"><AgIcon name="flame" className="w-3.5 h-3.5" /></span>}
                            {sub.dereg_top3 && <span title="Top-3 deregistration risk — one of the 3 subnets with the lowest SubnetRadar health score" className="text-sm cursor-help text-red-400"><AgIcon name="warning" className="w-3.5 h-3.5" /></span>}
                          </div>
                        )}
                      </td>
                      <td className={`py-2 px-3 text-right font-mono font-bold text-lg tabular-nums ${scoreColor(activeAGap(sub))}`}
                        style={timeHorizon === "investing" ? { background: "rgba(168, 85, 247, 0.06)", borderLeft: "2px solid rgba(168, 85, 247, 0.15)" } : { background: "rgba(16, 185, 129, 0.06)", borderLeft: "2px solid rgba(16, 185, 129, 0.15)" }}>
                        {Math.round(activeAGap(sub))}
                      </td>
                      <td className={`py-2 px-3 text-right font-bold tabular-nums text-sm ${
                        sub.agap_velo == null ? "text-white/15" :
                        sub.agap_velo >= 70 ? "text-green-400" :
                        sub.agap_velo >= 40 ? "text-yellow-400" :
                        "text-red-500"
                      }`}>
                        {sub.agap_velo != null ? sub.agap_velo : "—"}
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold tabular-nums ${scoreColor(sub.flow_score)}`}>
                        {sub.whale_signal === "accumulating" && <span title={`Whale accumulation (${sub.whale_ratio}x)`} className="mr-0.5 text-xs text-cyan-300"><AgIcon name="whale" className="w-3 h-3 inline-block" /></span>}
                        {sub.whale_signal === "distributing" && <span title={`Whale distribution (${sub.whale_ratio}x)`} className="mr-0.5 text-xs opacity-50 text-red-400"><AgIcon name="trendDown" className="w-3 h-3 inline-block" /></span>}
                        {sub.volume_surge && <span title={`Volume surge: ${sub.volume_surge_ratio}x rolling average buy volume`} className="mr-0.5 text-xs text-yellow-300"><AgIcon name="money" className="w-3 h-3 inline-block" /></span>}
                        {sub.flow_score}
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold tabular-nums ${scoreColor(sub.dev_score)}`}>{sub.dev_score}</td>
                      <td className={`py-2 px-3 text-right font-semibold tabular-nums ${scoreColor(sub.eval_score || 0)}`}>{sub.eval_score || 0}</td>
                      <td className={`py-2 px-3 text-right font-semibold tabular-nums ${scoreColor(sub.product_score || 0)}`}>
                        {sub.product_score != null ? sub.product_score : "\u2014"}
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold tabular-nums ${scoreColor(sub.social_score || 0)}`}>{sub.social_score || 0}</td>
                      <td className={`py-2 px-3 text-right font-semibold tabular-nums ${
                        sub.audit_score == null ? "text-white/15"
                        : sub.audit_score >= 70 ? "text-green-400"
                        : sub.audit_score >= 50 ? "text-yellow-400"
                        : sub.audit_score >= 30 ? "text-orange-400"
                        : "text-red-400"
                      }`}>
                        {sub.audit_score ?? "—"}
                      </td>
                      <td className="py-2 px-3 text-right text-white/45 tabular-nums">
                        {sub.emission_pct != null && sub.emission_pct > 0 ? `${(sub.emission_pct * 100).toFixed(1)}%` : "\u2014"}
                      </td>
                      <td className={`py-2 px-3 text-right font-medium tabular-nums ${
                        sub.emission_change_pct == null ? "text-white/20" :
                        sub.emission_change_pct > 0 ? "text-green-400" :
                        sub.emission_change_pct < 0 ? "text-red-400" : "text-white/35"
                      }`}>
                        {sub.emission_change_pct != null && sub.emission_change_pct !== 0
                          ? `${sub.emission_change_pct > 0 ? "+" : ""}${sub.emission_change_pct.toFixed(1)}%`
                          : "\u2014"}
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold tabular-nums ${
                        sub.apy_7d == null ? "text-white/20" :
                        sub.apy_7d >= 0.50 ? "text-green-400" :
                        sub.apy_7d >= 0.35 ? "text-yellow-400" :
                        sub.apy_7d >= 0.20 ? "text-orange-400" : "text-white/35"
                      }`}>
                        {sub.apy_7d != null ? `${(sub.apy_7d * 100).toFixed(0)}%` : "\u2014"}
                      </td>
                      <td className="py-2 px-3 text-right text-white/70 tabular-nums font-medium">
                        {sub.alpha_price != null ? `$${formatNum(sub.alpha_price, 2)}` : "\u2014"}
                      </td>
                      <td className="py-2 px-3 text-right text-white/45 tabular-nums">
                        {sub.market_cap != null ? `$${formatNum(sub.market_cap)}` : "\u2014"}
                      </td>

                      {(["price_change_1h", "price_change_24h", "price_change_7d", "price_change_30d"] as const).map((col) => (
                        <td key={col} className={`py-2 px-3 text-right font-medium tabular-nums ${
                          sub[col] == null ? "text-white/20" :
                          (sub[col] as number) > 0 ? "text-green-400" :
                          (sub[col] as number) < 0 ? "text-red-400" : "text-white/35"
                        }`}>
                          {sub[col] != null
                            ? `${(sub[col] as number) > 0 ? "+" : ""}${(sub[col] as number).toFixed(1)}%`
                            : "\u2014"}
                        </td>
                      ))}
                      <td className={`py-2 px-3 text-right tabular-nums font-medium ${flowColor(sub.net_flow_24h)}`}>
                        {sub.net_flow_24h != null && taoPrice != null
                          ? `${sub.net_flow_24h > 0 ? "+" : ""}$${formatNum(Math.round(sub.net_flow_24h * taoPrice))}`
                          : sub.net_flow_24h != null
                          ? `${sub.net_flow_24h > 0 ? "+" : ""}${formatNum(sub.net_flow_24h)} τ`
                          : "\u2014"}
                      </td>
                    </tr>
                    {/* CTA injected in the middle of the locked section — desktop only */}
                    {!isPro && i === 9 && (
                      <tr className="hidden md:table-row">
                        <td colSpan={21} className="py-5 text-center bg-[#0a0a0f]/60">
                          <div className="inline-flex flex-col items-center gap-2">
                            <p className="text-xs text-white font-bold">Top 20 Subnets are hidden on the free plan</p>
                            <a href="/pricing" className="font-sans px-8 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl text-base hover:from-green-400 hover:to-emerald-500 transition-all shadow-xl shadow-green-500/30">
                              Get Access →
                            </a>
                            <p className="text-xs text-white/50">Scroll down to view free analysis</p>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>);
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Hover card — desktop only, shown after 260ms hover delay */}
      {hoveredSub && hoverPos && (
        <SubnetHoverCard
          sub={hoveredSub}
          mouseX={hoverPos.x}
          mouseY={hoverPos.y}
          taoPrice={taoPrice}
          onKeepAlive={cancelClose}
          onClose={scheduleClose}
        />
      )}

      <SubnetDetailPanel />

      {/* Column "i" tooltip — rendered at root level to escape overflow-x-auto clipping */}
      {infoPopup && infoRect && (() => {
        const col = COLUMNS.find(([k]) => k === infoPopup);
        if (!col) return null;
        return (
          <div
            className="fixed z-[200] w-72 p-3.5 bg-[#0d1113]/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl shadow-2xl text-xs text-white/70 font-normal whitespace-normal leading-relaxed"
            style={{ top: infoRect.top, right: infoRect.right }}
            onClick={() => { setInfoPopup(null); setInfoRect(null); }}
          >
            <div className="font-display font-semibold text-emerald-400 mb-1">{col[3] ?? col[1]}</div>
            {col[2]}
          </div>
        );
      })()}
    </main>
  );
}
