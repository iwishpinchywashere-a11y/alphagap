"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import SubnetLogo from "@/components/dashboard/SubnetLogo";

// ── Custom plan feature icons ────────────────────────────────────
function PIcon({ name, className = "w-3.5 h-3.5" }: { name: string; className?: string }) {
  const p = { viewBox: "0 0 16 16", fill: "none" as const, stroke: "currentColor" as const, strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className };
  if (name === "leaderboard") return <svg {...p}><rect x="1.5" y="9" width="3.5" height="5" rx="0.5"/><rect x="6.5" y="6" width="3.5" height="8" rx="0.5"/><rect x="11" y="3" width="3.5" height="11" rx="0.5"/></svg>;
  if (name === "signals")     return <svg {...p}><polygon points="9 1.5 3 9.5 8 9.5 7 14.5 13 6.5 8 6.5" strokeLinejoin="round"/></svg>;
  if (name === "reports")     return <svg {...p}><rect x="3" y="1.5" width="10" height="13" rx="1.5"/><line x1="5.5" y1="5" x2="10.5" y2="5"/><line x1="5.5" y1="7.5" x2="10.5" y2="7.5"/><line x1="5.5" y1="10" x2="8.5" y2="10"/></svg>;
  if (name === "filter")      return <svg {...p}><polygon points="1 2.5 15 2.5 9.5 8.5 9.5 13.5 6.5 15 6.5 8.5"/></svg>;
  if (name === "subnet")      return <svg {...p}><circle cx="8" cy="8" r="6"/><line x1="2" y1="8" x2="14" y2="8"/><path d="M8 2a8 8 0 010 12M8 2a8 8 0 000 12"/></svg>;
  if (name === "updates")     return <svg {...p}><circle cx="8" cy="8" r="5.5"/><polyline points="8 5.5 8 8 10 10"/></svg>;
  if (name === "check")       return <svg {...p}><polyline points="2.5 8 6 12 13.5 4"/></svg>;
  if (name === "lock")        return <svg {...p}><rect x="3.5" y="7" width="9" height="7.5" rx="1"/><path d="M5.5 7V5.5a2.5 2.5 0 015 0V7"/><circle cx="8" cy="10.5" r="1" fill="currentColor" stroke="none"/></svg>;
  if (name === "oracle")      return <svg {...p}><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>;
  if (name === "alerts")      return <svg {...p}><path d="M8 2A4 4 0 004 6v3.5L2.5 11.5h11L12 9.5V6A4 4 0 008 2z"/><path d="M6.5 11.5a1.5 1.5 0 003 0"/></svg>;
  if (name === "investing")   return <svg {...p}><polyline points="1 11 5 7 9 9.5 15 3.5"/><polyline points="11 3.5 15 3.5 15 7.5"/></svg>;
  if (name === "whale")       return <svg {...p}><path d="M1 9c2-4 4-6 7-6s5 2 7 6"/><path d="M2 12.5c1.5-2 3.5-3 6-3s4.5 1 6 3"/></svg>;
  if (name === "social")      return <svg {...p}><circle cx="5.5" cy="5.5" r="2.5"/><path d="M1 14c0-2.5 2-4 4.5-4"/><circle cx="11" cy="5.5" r="2.5"/><path d="M15 14c0-2.5-2-4-4.5-4S6 11.5 6 14"/></svg>;
  if (name === "discord")     return <svg {...p}><path d="M2.5 2.5h11a1 1 0 011 1v7a1 1 0 01-1 1H5.5l-3 2.5V3.5a1 1 0 011-1z"/><circle cx="5.5" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="7" r="1" fill="currentColor" stroke="none"/></svg>;
  if (name === "analytics")   return <svg {...p}><line x1="1" y1="14" x2="15" y2="14"/><rect x="2" y="10" width="3" height="4" rx="0.5"/><rect x="6.5" y="6.5" width="3" height="7.5" rx="0.5"/><rect x="11" y="8.5" width="3" height="5.5" rx="0.5"/></svg>;
  if (name === "performance") return <svg {...p}><path d="M4.5 14h7"/><line x1="8" y1="14" x2="8" y2="9.5"/><path d="M3.5 6l4.5-3.5L12.5 6v3.5H3.5z"/></svg>;
  if (name === "wallet")      return <svg {...p}><rect x="1.5" y="4.5" width="13" height="9" rx="1.5"/><path d="M1.5 7h13"/><circle cx="11.5" cy="10.5" r="1"/></svg>;
  if (name === "benchmarks")  return <svg {...p}><line x1="1" y1="4.5" x2="9.5" y2="4.5"/><line x1="1" y1="8" x2="13" y2="8"/><line x1="1" y1="11.5" x2="7" y2="11.5"/><circle cx="12" cy="4.5" r="1.5"/><circle cx="5.5" cy="11.5" r="1.5"/></svg>;
  if (name === "pumplab")     return <svg {...p}><line x1="5.5" y1="2" x2="10.5" y2="2"/><path d="M5.5 2v4.5L3 12.5a1 1 0 001 1h8a1 1 0 001-1L10.5 6.5V2"/></svg>;
  if (name === "index")       return <svg {...p}><line x1="1" y1="14" x2="15" y2="14"/><line x1="3" y1="14" x2="3" y2="11"/><line x1="6" y1="14" x2="6" y2="7"/><line x1="9" y1="14" x2="9" y2="5"/><line x1="12" y1="14" x2="12" y2="3"/></svg>;
  if (name === "rebalance")   return <svg {...p}><path d="M13.5 5A6 6 0 002 8"/><polyline points="13.5 1.5 13.5 5 10 5"/><path d="M2.5 11A6 6 0 0014 8"/><polyline points="2.5 14.5 2.5 11 6 11"/></svg>;
  if (name === "priority")    return <svg {...p}><polygon points="8 1.5 10 6 14.5 6 11 8.5 12.5 13 8 10.5 3.5 13 5 8.5 1.5 6 6 6"/></svg>;
  if (name === "search")      return <svg {...p}><circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="14.5" y2="14.5"/></svg>;
  if (name === "ai")          return <svg {...p}><circle cx="8" cy="4" r="2"/><circle cx="3" cy="12" r="2"/><circle cx="13" cy="12" r="2"/><line x1="7" y1="5.5" x2="4.5" y2="10"/><line x1="9" y1="5.5" x2="11.5" y2="10"/><line x1="4.5" y1="10" x2="11.5" y2="10"/></svg>;
  if (name === "trending")    return <svg {...p}><polyline points="1 11 5 7 9 9.5 15 3.5"/><polyline points="11 3.5 15 3.5 15 7.5"/></svg>;
  if (name === "dev")         return <svg {...p}><polyline points="5 11 3 8 5 5"/><polyline points="11 5 13 8 11 11"/><line x1="9" y1="4" x2="7" y2="12"/></svg>;
  if (name === "megaphone")   return <svg {...p}><path d="M2 6.5h2.5L11 3.5v9L4.5 9.5H2V6.5z"/><path d="M4.5 9.5v2.5a1.5 1.5 0 003 0V9.5"/><circle cx="13.5" cy="8" r="1.5"/></svg>;
  if (name === "chain")       return <svg {...p}><path d="M9.5 4.5L11 3a2.5 2.5 0 013.5 3.5L13 8"/><path d="M6.5 11.5L5 13a2.5 2.5 0 01-3.5-3.5L3 8"/><line x1="5.5" y1="10.5" x2="10.5" y2="5.5"/></svg>;
  if (name === "rocket")      return <svg {...p}><path d="M8 1.5C5.5 4 4 6.5 4 9l3 3c2.5-0.5 5-2 7.5-5C14.5 3.5 12 1.5 8 1.5z"/><path d="M4 9L2 11l1 3 3 1 2-2"/><circle cx="10" cy="6" r="1.5"/></svg>;
  if (name === "time")        return <svg {...p}><circle cx="8" cy="8" r="5.5"/><polyline points="8 5.5 8 8 10 10"/></svg>;
  if (name === "broadcast")   return <svg {...p}><path d="M1.5 12.5A9 9 0 018 3a9 9 0 016.5 9.5"/><path d="M3.5 10.5A5.5 5.5 0 018 5a5.5 5.5 0 014.5 5.5"/><path d="M5.5 8.5A2.5 2.5 0 018 7a2.5 2.5 0 012.5 2.5"/><circle cx="8" cy="10.5" r="1" fill="currentColor" stroke="none"/></svg>;
  if (name === "lag")         return <svg {...p}><circle cx="8" cy="8" r="5.5"/><polyline points="8 5.5 8 8 10 10"/><line x1="3.5" y1="3.5" x2="5" y2="5" strokeDasharray="1 1"/></svg>;
  return <svg {...p}><polyline points="2.5 8 6 12 13.5 4"/></svg>;
}

// ── Mini sparkline ────────────────────────────────────────────────
function MiniSparkline({ up }: { up: boolean }) {
  const pts = up
    ? "2,14 8,12 14,9 20,10 26,7 32,5 38,6 44,3 50,2"
    : "2,3 8,5 14,4 20,8 26,9 32,11 38,10 44,13 50,15";
  return (
    <svg width="52" height="18" className="opacity-70">
      <polyline points={pts} fill="none" stroke={up ? "#10b981" : "#ef4444"} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Mock dashboard row ────────────────────────────────────────────
function MockRow({ rank, name, netuid, agap, flow, dev, eval: evalScore, velo, price, change, emPct, emDelta, category, whale, surge }: {
  rank: number; name: string; netuid: number; agap: number; flow: number; dev: number;
  eval: number; velo: number; price: string; change: string;
  emPct: string; emDelta: string; category: string;
  whale?: boolean; surge?: boolean;
}) {
  const agapColor = agap >= 80 ? "text-green-400" : agap >= 60 ? "text-yellow-400" : "text-orange-400";
  const scoreColor = (s: number) => s >= 75 ? "text-green-400" : s >= 55 ? "text-yellow-400" : "text-orange-400";
  const veloColor = velo >= 70 ? "text-green-400" : velo >= 40 ? "text-yellow-400" : "text-red-400";
  const positive = !change.startsWith("-");
  const emUp = emDelta.startsWith("+");
  return (
    <tr className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
      <td className="px-3 py-2.5 text-xs text-gray-600 tabular-nums w-6">{rank}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <SubnetLogo netuid={netuid} name={name} size={20} />
          <span className="text-[10px] text-gray-600 font-mono">SN{netuid}</span>
          <span className="font-semibold text-gray-100 text-sm">{name}</span>
          {whale && <span className="text-xs">🐋</span>}
          {surge && <span className="text-xs">🤑</span>}
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500 border border-gray-700">{category}</span>
        </div>
      </td>
      <td className={`px-3 py-2.5 text-right font-bold tabular-nums text-lg ${agapColor}`}>{agap}</td>
      <td className={`px-3 py-2.5 text-right tabular-nums text-sm font-bold ${veloColor}`}>{velo}</td>
      <td className={`px-3 py-2.5 text-right tabular-nums text-sm font-semibold ${scoreColor(flow)}`}>{flow}</td>
      <td className={`px-3 py-2.5 text-right tabular-nums text-sm font-semibold ${scoreColor(dev)}`}>{dev}</td>
      <td className={`px-3 py-2.5 text-right tabular-nums text-sm font-semibold ${scoreColor(evalScore)}`}>{evalScore}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-xs text-gray-400">{emPct}</td>
      <td className={`px-3 py-2.5 text-right tabular-nums text-xs font-medium ${emUp ? "text-green-400" : "text-red-400"}`}>{emDelta}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-sm text-gray-300">{price}</td>
      <td className={`px-3 py-2.5 text-right tabular-nums text-sm font-medium ${positive ? "text-green-400" : "text-red-400"}`}>{change}</td>
    </tr>
  );
}

// ── Signal card mock ──────────────────────────────────────────────
function MockSignal({ type, subnet, title, insight, time }: {
  type: "github" | "hf"; subnet: string; title: string; insight: string; time: string;
}) {
  return (
    <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${type === "github" ? "bg-gray-800 text-gray-300 border-gray-700" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"}`}>
            {type === "github" ? "⌥ GitHub" : "🤗 HuggingFace"}
          </span>
          <span className="text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">{subnet}</span>
        </div>
        <span className="text-xs text-gray-600 shrink-0">{time}</span>
      </div>
      <h3 className="font-semibold text-gray-100 text-sm mb-2">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{insight}</p>
      <div className="mt-3 pt-3 border-t border-gray-800">
        <div className="text-xs font-semibold text-green-400 mb-1">AlphaGap Take</div>
        <p className="text-xs text-green-300/80 leading-relaxed">
          {type === "github"
            ? "Strong technical signal — team shipping consistently. Price hasn't reacted yet. Watching for catalyst."
            : "New model deployment signals active research. First mover advantage window open. Emission data trending up."}
        </p>
      </div>
    </div>
  );
}

// ── KOL heat card ─────────────────────────────────────────────────
function MockKolEvent({ kol, tier, subnet, heat, text, time }: {
  kol: string; tier: 1 | 2; subnet: string; heat: number; text: string; time: string;
}) {
  const heatColor = heat >= 85 ? "text-green-300 bg-green-500/15 border-green-500/30"
    : heat >= 65 ? "text-yellow-300 bg-yellow-500/10 border-yellow-500/25"
    : "text-orange-400 bg-orange-500/10 border-orange-500/20";
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-800/60 last:border-0">
      <div className={`text-xs px-1.5 py-0.5 rounded border font-bold shrink-0 ${tier === 1 ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-blue-500/15 text-blue-400 border-blue-500/25"}`}>
        T{tier}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-blue-400 font-semibold text-sm">@{kol}</span>
          <span className="text-xs text-gray-600 bg-gray-800 px-1.5 rounded font-mono">SN · {subnet}</span>
          <span className="text-xs text-gray-600">{time}</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{text}</p>
      </div>
      <div className={`text-sm font-bold tabular-nums px-2 py-0.5 rounded border ${heatColor} shrink-0`}>
        {heat}
      </div>
    </div>
  );
}

// ── Feature card ──────────────────────────────────────────────────
function FeatureCard({ icon, title, badge, children }: {
  icon: string; title: string; badge?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0d0d14] border border-white/[0.07] rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-white/[0.05]">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-green-400 flex-shrink-0"><PIcon name={icon} className="w-5 h-5" /></span>
          <h3 className="font-bold text-lg text-white">{title}</h3>
          {badge && (
            <span className="text-[10px] font-bold bg-green-500/15 text-green-400 border border-green-500/25 px-2 py-0.5 rounded-full ml-auto">
              {badge}
            </span>
          )}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Upgrade confirmation modal ────────────────────────────────────
function UpgradeModal({ plan, proratedAmount, onConfirm, onCancel, loading }: {
  plan: "premium" | "ultra";
  proratedAmount: number | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const isUltra = plan === "ultra";
  const planName = isUltra ? "Ultra" : "Premium";
  const monthlyPrice = isUltra ? "$99" : "$49";
  const features = isUltra
    ? [
        { icon: "index",     text: "AlphaGap Index — auto-invest your TAO into the top 10 subnets" },
        { icon: "oracle",    text: "TAO Oracle — 20 queries/day (2× Premium)" },
        { icon: "priority",  text: "Priority access to new Ultra-only features" },
      ]
    : [
        { icon: "performance", text: "Portfolio performance tracker — simulated $100 auto-buys" },
        { icon: "signals",     text: "aGap Velocity score — momentum signals before the market" },
        { icon: "investing",   text: "Investing aGap — long-term value scoring" },
        { icon: "whale",       text: "Whale accumulation & smart-money signals" },
        { icon: "analytics",   text: "Full price history, sparklines & volume surge alerts" },
        { icon: "ai",          text: "AI-generated subnet reports" },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="bg-[#111118] border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isUltra ? "bg-amber-400/15 border border-amber-400/30 text-amber-400" : "bg-green-500/15 border border-green-500/30 text-green-400"}`}>
            <PIcon name={isUltra ? "priority" : "check"} className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-lg">Upgrade to {planName}</div>
            <div className="text-xs text-gray-500">Charged instantly to your card on file</div>
          </div>
        </div>

        {/* What you get */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 mb-5 space-y-2.5">
          {features.map(({ icon, text }) => (
            <div key={text} className="flex items-start gap-2.5">
              <span className={`flex-shrink-0 mt-0.5 ${isUltra ? "text-amber-400" : "text-green-400"}`}><PIcon name={icon} className="w-4 h-4" /></span>
              <span className="text-sm text-gray-300">{text}</span>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div className="border border-gray-800 rounded-xl p-4 mb-5 space-y-2">
          {proratedAmount !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Due today <span className="text-gray-600 text-xs">(prorated credit applied)</span></span>
              <span className="font-bold text-white">${(proratedAmount / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Then monthly</span>
            <span className="font-semibold text-white">{monthlyPrice} / mo</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm font-medium hover:border-gray-600 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 ${isUltra ? "bg-amber-400 hover:bg-amber-300 text-black" : "bg-green-500 hover:bg-green-400 text-black"}`}
          >
            {loading ? "Upgrading…" : "Confirm Upgrade →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
function SubscribeContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [liveStats, setLiveStats] = useState({ subnets: 122, signals: 0, lastScan: "" });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<"premium" | "ultra">("premium");
  const [proratedAmount, setProratedAmount] = useState<number | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  useEffect(() => {
    fetch("/api/cached-scan")
      .then(r => r.json())
      .then(d => setLiveStats({
        subnets: d.leaderboard?.length || 122,
        signals: d.signals?.length || 0,
        lastScan: d.lastScan || "",
      }))
      .catch(() => {});
  }, []);

  const minutesAgo = liveStats.lastScan
    ? Math.floor((Date.now() - new Date(liveStats.lastScan).getTime()) / 60000)
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subStatus = (session?.user as any)?.subscriptionStatus;
  const isSubscribed = subStatus === "active" || subStatus === "trialing";

  async function handleSubscribe(plan: "pro" | "premium" | "ultra" = "premium") {
    if (!session) {
      router.push("/pricing");
      return;
    }
    const currentTier = (session?.user as any)?.subscriptionTier as string | undefined;
    const tierRank: Record<string, number> = { pro: 1, premium: 2, ultra: 3 };
    if (isSubscribed && (tierRank[currentTier ?? ""] ?? 0) >= (tierRank[plan] ?? 0)) {
      router.push("/dashboard");
      return;
    }
    // Subscribed user upgrading — show confirmation modal with prorated amount
    if (isSubscribed && (plan === "premium" || plan === "ultra")) {
      setCheckoutLoading(true);
      setUpgradePlan(plan);
      try {
        const res = await fetch(`/api/stripe/upgrade-preview?plan=${plan}`);
        const data = await res.json();
        setProratedAmount(data.amountDue ?? null);
      } catch {
        setProratedAmount(null);
      } finally {
        setCheckoutLoading(false);
      }
      setShowUpgradeModal(true);
      return;
    }
    // New subscriber — go through Stripe Checkout
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function confirmUpgrade() {
    setUpgradeLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: upgradePlan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setUpgradeLoading(false);
    }
  }

  const ctaLabel = checkoutLoading ? "Loading…"
    : isSubscribed ? "Open Dashboard →"
    : session ? "Subscribe →"
    : "Get Started →";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {showUpgradeModal && (
        <UpgradeModal
          plan={upgradePlan}
          proratedAmount={proratedAmount}
          onConfirm={confirmUpgrade}
          onCancel={() => setShowUpgradeModal(false)}
          loading={upgradeLoading}
        />
      )}

      {/* ── Sticky Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/85 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <Link href="/">
            <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-9 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            {session ? (
              <>
                <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">Dashboard</Link>
                <Link href="/account" className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg hover:border-gray-600 transition-colors">Account</Link>
              </>
            ) : (
              <>
                <Link href="/auth/signin" className="text-sm text-gray-400 hover:text-white transition-colors">Sign In</Link>
                <button
                  onClick={() => handleSubscribe("pro")}
                  className="text-sm bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold px-4 py-1.5 rounded-lg hover:from-green-400 hover:to-emerald-500 transition-all shadow-md shadow-green-500/20"
                >
                  Get Access
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {params.get("canceled") === "true" && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-300 text-sm text-center py-2 px-4">
          Payment was canceled. Your account is ready when you are — subscribe anytime below.
        </div>
      )}

      {/* ── Hero ── */}
      <section className="relative pt-36 pb-20 px-5">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: "linear-gradient(rgba(34,197,94,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.4) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }} />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-green-500/[0.06] rounded-full blur-[140px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold px-4 py-2 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            tracking millions of data points LIVE
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.08] mb-6">
            Find the next
            <br />
            <span className="flame-text">HOT</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-300 to-green-400"> Bittensor</span>
            {/* On sm+, explicit break after "Bittensor" */}
            <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-300 to-green-400">{" "}subnet</span>
            {" "}before
            {/* On mobile, break after "before" so "subnet before" share a line */}
            <br className="sm:hidden" />
            <br className="hidden sm:block" />
            {" "}everyone else.
          </h1>

          <p className="text-xl sm:text-2xl text-gray-300 max-w-2xl mx-auto mb-8 leading-relaxed">
            We save you hours of research time every day. While you sleep, we&apos;re scoring every subnet against 20+ signals so that when you wake up,
            the best opportunities are right in front of you.
          </p>

          {/* Plan cards */}
          <div className="grid sm:grid-cols-3 gap-5 max-w-5xl mx-auto mb-12 text-left pt-5">

            {/* Free */}
            <div className="bg-[#0d0d14] border border-gray-800 rounded-3xl p-7 flex flex-col">
              <div className="mb-6">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Free</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">$0</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <p className="text-xs text-gray-600">Preview mode · No card required</p>
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {[
                  "Leaderboard preview (top 10 blurred)",
                  "1 signal preview",
                  "Whale tracker preview",
                  "Social feed headers only",
                  "Reports locked",
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-gray-500">
                    <span className="text-gray-700 shrink-0 mt-0.5">◦</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/powerrankings"
                className="w-full text-center py-3 border border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200 rounded-xl text-sm font-medium transition-colors"
              >
                Start For Free →
              </a>
            </div>

            {/* Premium */}
            <div className="relative bg-[#0d0d14] border border-purple-500/40 rounded-3xl p-7 pt-9 flex flex-col shadow-xl shadow-purple-500/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-purple-500 to-violet-600 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                  MOST POPULAR
                </span>
              </div>
              <div className="mb-6">
                <div className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Premium</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">$49</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <p className="text-xs text-gray-600">Cancel anytime · Instant access</p>
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {([
                  { icon: "leaderboard", text: "Full Alpha Leaderboard — all 128 subnets" },
                  { icon: "signals",     text: "AI Signal Intelligence — all signals" },
                  { icon: "reports",     text: "Daily AI Deep-Dive Reports" },
                  { icon: "oracle",      text: "Oracle — 10 queries/day" },
                  { icon: "investing",   text: "Investing Analysis" },
                  { icon: "whale",       text: "Whale & Smart Money Tracker" },
                  { icon: "social",      text: "Twitter/X social momentum feed" },
                  { icon: "discord",     text: "Discord scanner" },
                  { icon: "pumplab",     text: "Pump Lab" },
                  { icon: "performance", text: "Performance Tracker" },
                  { icon: "wallet",      text: "Wallet Tracker" },
                  { icon: "analytics",   text: "Analytics & Scatter Plots" },
                  { icon: "benchmarks",  text: "Benchmark Rankings" },
                ] as { icon: string; text: string }[]).map(f => (
                  <li key={f.text} className="flex items-start gap-2 text-xs text-gray-300">
                    <span className="text-purple-400 shrink-0 mt-0.5"><PIcon name={f.icon} /></span>
                    {f.text}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe("premium")}
                disabled={checkoutLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-violet-700 text-white font-bold rounded-xl py-3.5 text-sm hover:from-purple-500 hover:to-violet-600 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60"
              >
                {isSubscribed ? "Open Dashboard →" : checkoutLoading ? "Loading…" : session ? "Subscribe — $49/mo →" : "Get Premium — $49/mo →"}
              </button>
              <p className="text-center text-[11px] text-gray-700 mt-3">Powered by Stripe · Secure checkout</p>
            </div>

            {/* Ultra */}
            <div className="relative bg-gradient-to-b from-amber-950/40 to-[#0d0d14] border border-amber-400/40 rounded-3xl p-7 pt-9 flex flex-col shadow-xl shadow-amber-400/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-amber-400 to-orange-400 text-black text-[10px] font-bold px-3 py-1 rounded-full">
                  MOST POWERFUL
                </span>
              </div>
              <div className="mb-6">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Ultra</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">$99</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <p className="text-xs text-gray-600">Cancel anytime · Instant access</p>
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {([
                  { icon: "leaderboard", text: "Full Alpha Leaderboard — all 128 subnets" },
                  { icon: "signals",     text: "AI Signal Intelligence — all signals" },
                  { icon: "reports",     text: "Daily AI Deep-Dive Reports" },
                  { icon: "whale",       text: "Whale & Smart Money Tracker" },
                  { icon: "social",      text: "Twitter/X social momentum feed" },
                  { icon: "pumplab",     text: "Pump Lab" },
                  { icon: "wallet",      text: "Wallet Tracker" },
                  { icon: "index",       text: "AlphaGap Index — auto-invest TAO into top 10 subnets" },
                  { icon: "rebalance",   text: "Weekly auto-rebalancing" },
                  { icon: "oracle",      text: "Oracle — 20 queries/day (2× Premium)" },
                  { icon: "priority",    text: "Priority access to new Ultra features" },
                ] as { icon: string; text: string }[]).map(f => (
                  <li key={f.text} className="flex items-start gap-2 text-xs text-gray-300">
                    <span className="text-amber-400 shrink-0 mt-0.5"><PIcon name={f.icon} /></span>
                    {f.text}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe("ultra")}
                disabled={checkoutLoading}
                className="w-full bg-gradient-to-r from-amber-400 to-orange-400 text-black font-bold rounded-xl py-3.5 text-sm hover:from-amber-300 hover:to-orange-300 transition-all shadow-lg shadow-amber-400/25 disabled:opacity-60"
              >
                {isSubscribed ? "Open Dashboard →" : checkoutLoading ? "Loading…" : session ? "Subscribe — $99/mo →" : "Get Ultra — $99/mo →"}
              </button>
              <p className="text-center text-[11px] text-gray-700 mt-3">Powered by Stripe · Secure checkout</p>
            </div>

          </div>

          {/* What we monitor — graphic boxes */}
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest text-center mb-4">Harness The Power Of:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-3xl mx-auto text-left">
            {([
              { icon: "dev",       title: "Dev Activity",        desc: "Every GitHub commit, release, and engineering milestone across all subnets" },
              { icon: "whale",     title: "Whale Wallets",       desc: "Smart money flows, large stake moves, and whale buy/sell ratios in real time" },
              { icon: "megaphone", title: "Social Buzz",         desc: "KOL tweets, community hype, and viral momentum before it hits the price" },
              { icon: "chain",     title: "Emission Signals",    desc: "On-chain allocation shifts — when the Bittensor network votes more TAO to a subnet" },
              { icon: "rocket",    title: "Product Launches",    desc: "New feature releases, live apps, and real-world deployments detected automatically" },
              { icon: "time",      title: "128 Subnets · 24/7",  desc: "Every active Bittensor subnet tracked continuously — nothing slips through" },
            ] as { icon: string; title: string; desc: string }[]).map(item => (
              <div key={item.title} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 hover:border-green-500/20 hover:bg-white/[0.05] transition-colors">
                <div className="mb-2 text-green-400"><PIcon name={item.icon} className="w-6 h-6" /></div>
                <div className="text-sm font-semibold text-white mb-1">{item.title}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Problem ── */}
      <section className="py-20 px-5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            Tracking Bittensor manually<br />
            <span className="text-gray-500">is a full-time job.</span>
          </h2>
          <p className="text-gray-400 text-center max-w-xl mx-auto mb-12 leading-relaxed">
            128 teams. Dozens of platforms. Thousands of data points. Every single day.
            By the time you catch an opportunity on social media, the smart money has already moved.
          </p>
          <div className="grid sm:grid-cols-3 gap-5">
            {([
              {
                icon: "time",
                title: "Hours of daily research",
                desc: "Manually checking GitHub repos, HuggingFace profiles, Discord servers, Twitter, and on-chain data for 128 subnets would take 4+ hours every single day. Nobody has time for that.",
              },
              {
                icon: "broadcast",
                title: "Critical signals in the noise",
                desc: "A developer pushing a breakthrough model. A whale quietly staking 500+ TAO. Emissions doubling week over week. These signals are buried in technical platforms most investors never check.",
              },
              {
                icon: "lag",
                title: "Markets react too slowly",
                desc: "Token prices lag behind fundamentals by days or weeks. The window between a team shipping real progress and the market pricing it in — that's where the alpha lives. But only if you find it first.",
              },
            ] as { icon: string; title: string; desc: string }[]).map(c => (
              <div key={c.title} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
                <div className="mb-4 text-gray-400"><PIcon name={c.icon} className="w-7 h-7" /></div>
                <h3 className="font-bold text-white mb-2">{c.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Showcase ── */}
      <section className="py-20 px-5 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3">
            Everything inside AlphaGap
          </h2>
          <p className="text-gray-500 text-center mb-14">Every page. Every feature. Built to give you an unfair advantage.</p>

          <div className="space-y-8">

            {/* Feature 1: Dashboard */}
            <FeatureCard icon="leaderboard" title="Alpha Leaderboard" badge="CORE FEATURE">
              <div className="mb-4">
                <p className="text-sm text-gray-400 leading-relaxed mb-3">
                  Every one of the 128 Bittensor subnets scored, ranked, and sortable in real-time.
                  The <span className="text-green-400 font-semibold">aGap score</span> combines development activity,
                  price momentum, smart money signals, social buzz, and emissions value into one number.
                  The highest scores = the biggest opportunities right now.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {["Sort by any metric", "9 smart filters", "🐋 Whale signals", "🤑 Volume surges", "⚡ aGap Velocity score", "⚠️ Risk flags", "Category filters"].map(t => (
                    <span key={t} className="text-xs px-2 py-1 bg-gray-800 border border-gray-700 rounded-full text-gray-400">{t}</span>
                  ))}
                </div>
              </div>
              {/* Mock dashboard table */}
              <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] text-gray-600 border-b border-gray-800 font-medium">
                        <th className="px-3 py-2 w-6">#</th>
                        <th className="px-3 py-2">Subnet</th>
                        <th className="px-3 py-2 text-right">aGap</th>
                        <th className="px-3 py-2 text-right">Velo ⚡</th>
                        <th className="px-3 py-2 text-right">Flow</th>
                        <th className="px-3 py-2 text-right">Dev</th>
                        <th className="px-3 py-2 text-right">eVal</th>
                        <th className="px-3 py-2 text-right">Em %</th>
                        <th className="px-3 py-2 text-right">Em Δ</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-right">24h</th>
                      </tr>
                    </thead>
                    <tbody>
                      <MockRow rank={1} name="Score" netuid={44} agap={88} flow={84} dev={89} eval={82} velo={91} emPct="12.4%" emDelta="+4.1%" category="Vision AI" price="$0.412" change="+9.3%" whale={true} />
                      <MockRow rank={2} name="Chutes" netuid={64} agap={82} flow={88} dev={91} eval={79} velo={85} emPct="8.6%" emDelta="+6.2%" category="Inference" price="$0.091" change="+14.1%" surge={true} />
                      <MockRow rank={3} name="ninja" netuid={66} agap={79} flow={76} dev={94} eval={71} velo={74} emPct="5.2%" emDelta="+1.8%" category="Agents" price="$0.057" change="+5.4%" whale={true} />
                      <MockRow rank={4} name="Affine" netuid={120} agap={75} flow={69} dev={83} eval={77} velo={68} emPct="9.1%" emDelta="-0.9%" category="Training" price="$0.238" change="-1.7%" />
                      <MockRow rank={5} name="distil" netuid={97} agap={72} flow={71} dev={87} eval={68} velo={79} emPct="3.4%" emDelta="+2.3%" category="Training" price="$0.019" change="+7.8%" />
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-2 border-t border-gray-800 text-[10px] text-gray-600">
                  Showing 5 of {liveStats.subnets} subnets · Updated every 10 minutes
                </div>
              </div>
            </FeatureCard>

            {/* Feature 2: Signals */}
            <FeatureCard icon="ai" title="AI Signal Intelligence">
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                Every GitHub commit and HuggingFace model deployment across all subnet repos is automatically analyzed by AI.
                You get a plain-English breakdown of <em>what was built</em>, <em>why it matters</em>,
                and most importantly — <span className="text-green-400 font-semibold">what it means for your investment</span>.
                No technical knowledge required.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <MockSignal
                  type="github"
                  subnet="Score (SN44)"
                  title="Merged: Real-time dispatch pipeline v3.1"
                  insight="Cuts alert-to-action latency by 55% across enterprise camera networks. Fourth infra PR this sprint — team is in full shipping mode."
                  time="2h ago"
                />
                <MockSignal
                  type="hf"
                  subnet="distil (SN97)"
                  title="New model: distil-qwen3-4.8b-v2 deployed"
                  insight="4.8B student model beats the 5.25B benchmark ceiling on 14/17 eval axes. Second major release this month — distillation pipeline maturing fast."
                  time="5h ago"
                />
              </div>
            </FeatureCard>

            {/* Feature 3: Social */}
            <FeatureCard icon="broadcast" title="Social Intelligence — KOL Radar & Discord Alpha">
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                We track <span className="text-white font-medium">300+ Bittensor KOLs on X/Twitter</span> in real-time,
                scoring every subnet mention with a <span className="text-green-400 font-semibold">Heat Score</span>.
                Plus, our AI reads every subnet channel in the Bittensor Discord every 3 hours —
                flagging genuine <span className="text-green-400">ALPHA</span> before it spreads.
              </p>
              <div className="bg-gray-950 rounded-xl border border-gray-800 p-4">
                <div className="text-xs text-gray-600 mb-3 font-medium uppercase tracking-wide flex items-center gap-1.5"><PIcon name="signals" className="w-3 h-3 text-orange-400" /> Hot KOL Activity</div>
                <MockKolEvent kol="const" tier={1} subnet="Score" heat={97} text="SN44 Score just signed PwC France as a strategic partner. Enterprise physical AI is the unlock — this is the real world use case we've been waiting for..." time="1h ago" />
                <MockKolEvent kol="taoshi_" tier={1} subnet="Chutes" heat={91} text="Chutes (SN64) just crossed 9 trillion tokens served. 85% cheaper than AWS and growing 40% month over month. The infra layer is won." time="2h ago" />
                <MockKolEvent kol="jollygreenmoney" tier={2} subnet="ninja" heat={74} text="SN66 ninja's coding agent arena is undervalued. Miners fixing real GitHub bugs scored on quality — this is how you benchmark agents properly." time="4h ago" />
              </div>
            </FeatureCard>

            {/* Feature 4: Reports */}
            <FeatureCard icon="reports" title="Daily AI Deep-Dive Reports">
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                Every day, our AI generates a comprehensive deep-dive on the highest-scoring subnet.
                Think of it as having a <span className="text-white font-medium">crypto research analyst</span> on your team —
                covering the team, tech stack, recent progress, on-chain position, and investment thesis.
                All in plain English. Ready when you wake up.
              </p>
              <div className="bg-gray-950 rounded-xl border border-gray-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-1">Daily Report · May 19, 2026</div>
                    <h4 className="font-bold text-white text-lg">Score (SN44) — Deep Dive</h4>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-400">91</div>
                    <div className="text-xs text-gray-600">aGap Score</div>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  {[
                    { label: "What they&apos;re building", text: "Score turns enterprise camera feeds into real-time operational intelligence — physical AI for logistics, retail, and security. PwC France signed as strategic partner." },
                    { label: "Recent progress", text: "4 inference PRs merged this week. PwC France partnership announced. Emission share at 21.4% — 2nd highest in the network. Enterprise pilots up 3 new sites in 30 days." },
                    { label: "Market position", text: "Price up 12% since the PwC announcement but still massively undervalued vs the TAM. Real-world revenue + top-tier emissions not yet priced into current market cap." },
                    { label: "Investment thesis", text: "Enterprise partnership validation + highest conviction score on-chain + rising emissions = textbook AlphaGap setup. This is physical AI with paying customers." },
                  ].map(s => (
                    <div key={s.label} className="bg-white/[0.02] rounded-lg p-3">
                      <div className="text-xs font-semibold text-gray-400 mb-1" dangerouslySetInnerHTML={{ __html: s.label }} />
                      <p className="text-xs text-gray-300 leading-relaxed">{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </FeatureCard>

            {/* Feature 5: Subnet Detail */}
            <FeatureCard icon="search" title="Subnet Deep Dives — 128 Individual Pages">
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                Every subnet gets its own dedicated intelligence page. Click any subnet in the dashboard
                to see its complete picture: score history charts, all detected signals over time, team links,
                GitHub/HuggingFace profiles, Discord channels, and real-time price data.
                Know everything about a subnet before you invest.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([
                  { icon: "trending",  label: "Score history charts", desc: "30/90 day trends" },
                  { icon: "signals",   label: "All signals timeline", desc: "Every dev event" },
                  { icon: "social",    label: "Team & social links", desc: "GitHub, X, Discord" },
                  { icon: "analytics", label: "Price & market data", desc: "Live from TaoStats" },
                ] as { icon: string; label: string; desc: string }[]).map(f => (
                  <div key={f.label} className="bg-gray-900/60 border border-gray-800 rounded-lg p-3 text-center">
                    <div className="mb-1.5 flex justify-center text-green-400"><PIcon name={f.icon} className="w-5 h-5" /></div>
                    <div className="text-xs font-semibold text-gray-200">{f.label}</div>
                    <div className="text-[10px] text-gray-600 mt-0.5">{f.desc}</div>
                  </div>
                ))}
              </div>
            </FeatureCard>

            {/* Feature 5b: Whales */}
            <FeatureCard icon="whale" title="Whale & Smart Money Tracker" badge="NEW">
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                A dedicated live feed of every whale wallet move, smart money flow, and unusual volume spike across all subnets.
                See exactly <span className="text-white font-medium">who is buying, who is selling, and how hard</span> — before the price moves.
              </p>
              <div className="grid sm:grid-cols-3 gap-3 mb-4">
                {([
                  { icon: "whale",    label: "Whale Accumulation", desc: "Buy/sell ratio flags wallets 2x+ larger on the buy side" },
                  { icon: "trending", label: "Volume Surges", desc: "Detects 2.5x+ spikes vs 5-day rolling buy average" },
                  { icon: "signals",  label: "Flow Signals", desc: "Catches when net flow flips positive or spikes sharply" },
                ] as { icon: string; label: string; desc: string }[]).map(f => (
                  <div key={f.label} className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
                    <div className="mb-1.5 text-green-400"><PIcon name={f.icon} className="w-5 h-5" /></div>
                    <div className="text-xs font-semibold text-gray-200 mb-0.5">{f.label}</div>
                    <div className="text-[10px] text-gray-600">{f.desc}</div>
                  </div>
                ))}
              </div>
              <div className="bg-gray-950 rounded-xl border border-gray-800 divide-y divide-gray-800/60">
                {[
                  { netuid: 44, name: "Score", badge: "🐋 WHALE BUY", badgeColor: "text-cyan-300", detail: "2.34x avg buy size vs sells · Net +$142K in 24h", velo: 91 },
                  { netuid: 64, name: "Chutes", badge: "🤑 VOL SURGE", badgeColor: "text-yellow-300", detail: "5.2x rolling average buy volume · Net +$89K in 24h", velo: 88 },
                  { netuid: 66, name: "ninja", badge: "⚡ FLOW SPIKE", badgeColor: "text-purple-300", detail: "Flow spiked 3.1x vs yesterday · Accelerating inflows", velo: 76 },
                ].map(r => (
                  <div key={r.netuid} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] text-gray-600 font-mono">SN{r.netuid}</span>
                        <span className="font-semibold text-sm text-white">{r.name}</span>
                        <span className={`text-[10px] font-bold ${r.badgeColor}`}>{r.badge}</span>
                      </div>
                      <span className="text-xs text-gray-500">{r.detail}</span>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${r.velo >= 70 ? "text-green-400" : "text-yellow-400"}`}>{r.velo}</span>
                  </div>
                ))}
              </div>
            </FeatureCard>

            {/* Feature 5c: Pump Lab */}
            <FeatureCard icon="pumplab" title="Pump Lab — Early Alpha Detector" badge="NEW">
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                Track subnets showing early signs of a pump <span className="text-white font-medium">before the crowd catches on</span>.
                Pump Lab monitors a curated watchlist for unusual staking inflows, volume acceleration, and social heat all converging at once.
                It&apos;s the closest thing to a heads-up the market will give you.
              </p>
              <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium uppercase tracking-wide flex items-center gap-1.5"><PIcon name="pumplab" className="w-3 h-3" /> Active Watch</span>
                  <span className="text-[10px] text-gray-600">Auto-detected · Updated every scan</span>
                </div>
                {[
                  { netuid: 44, name: "Score", signals: ["🐋 Whales buying", "📈 Emissions +21%", "🔥 KOL heat 97"], score: 91 },
                  { netuid: 97, name: "distil", signals: ["🤑 5.2x vol surge", "⚡ Flow spiked 3x"], score: 82 },
                ].map(r => (
                  <div key={r.netuid} className="px-4 py-3 border-b border-gray-800/60 last:border-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-600 font-mono">SN{r.netuid}</span>
                        <span className="font-semibold text-sm text-white">{r.name}</span>
                      </div>
                      <span className="text-lg font-bold text-green-400">{r.score}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.signals.map(s => (
                        <span key={s} className="text-[10px] px-2 py-0.5 bg-gray-800 border border-gray-700 rounded-full text-gray-400">{s}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </FeatureCard>

            {/* Feature 5d: Wallet Tracker */}
            <FeatureCard icon="wallet" title="Wallet Tracker — Follow the Smart Money" badge="NEW">
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                Track <span className="text-white font-medium">any TAO wallet</span> across the entire Bittensor network.
                See the top wallets ranked by 24h movement, their complete alpha positions across every subnet,
                and whether they&apos;re staking or pulling out. Known wallets — validators, founders, whales — are
                labelled automatically so you always know <span className="text-green-400 font-semibold">who&apos;s really moving the market</span>.
              </p>
              <div className="grid sm:grid-cols-3 gap-3 mb-4">
                {([
                  { icon: "performance", label: "Top Wallets",    desc: "Ranked by TAO balance & 24h movement with known wallet labels" },
                  { icon: "index",       label: "Alpha Positions", desc: "See exactly which subnets a wallet is staked into and for how much" },
                  { icon: "search",      label: "Any Address",    desc: "Look up any SS58 address instantly to reveal their full portfolio" },
                ] as { icon: string; label: string; desc: string }[]).map(f => (
                  <div key={f.label} className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
                    <div className="mb-1.5 text-green-400"><PIcon name={f.icon} className="w-5 h-5" /></div>
                    <div className="text-xs font-semibold text-gray-200 mb-0.5">{f.label}</div>
                    <div className="text-[10px] text-gray-600">{f.desc}</div>
                  </div>
                ))}
              </div>
              <div className="bg-gray-950 rounded-xl border border-gray-800 divide-y divide-gray-800/60">
                <div className="px-4 py-2 flex items-center justify-between border-b border-gray-800">
                  <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wide">Top Movers · Last 24h</span>
                  <span className="text-[10px] text-gray-600">TAO staked</span>
                </div>
                {[
                  { label: "🐋 const", address: "5CXs...9h4J", category: "Founder", tao: "24,812 τ", change: "+1,240 τ", pos: true, subnets: "SN1, SN9, SN64" },
                  { label: "🏦 Opentensor Foundation", address: "5HZ9...2mWq", category: "Foundation", tao: "18,340 τ", change: "+890 τ", pos: true, subnets: "SN3, SN44, SN97" },
                  { label: "⚡ Unknown Whale", address: "5EkQ...7rPx", category: "Whale", tao: "8,204 τ", change: "-2,100 τ", pos: false, subnets: "SN64, SN66" },
                ].map(r => (
                  <div key={r.address} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-white">{r.label}</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-500">{r.category}</span>
                      </div>
                      <span className="text-[10px] text-gray-600">{r.subnets}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-300 font-medium">{r.tao}</div>
                      <div className={`text-[10px] font-bold ${r.pos ? "text-green-400" : "text-red-400"}`}>{r.change}</div>
                    </div>
                  </div>
                ))}
              </div>
            </FeatureCard>

            {/* Feature 6: Performance */}
            <FeatureCard icon="trending" title="Performance Tracker — Signals That Actually Work">
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                We put our money where our mouth is. AlphaGap automatically &apos;buys&apos; $100 of alpha
                tokens when a subnet hits aGap 80+ for the first time, then tracks how the position performs over time.
                See the real-world returns of following our signals — updated every scan.
              </p>
              <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-medium">Simulated Portfolio · Following aGap Signals</span>
                    <span className="text-sm font-bold text-green-400">+34.2% avg return</span>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-gray-600 border-b border-gray-800">
                      <th className="px-4 py-2 text-left">Subnet</th>
                      <th className="px-4 py-2 text-right">Entry Score</th>
                      <th className="px-4 py-2 text-right">Invested</th>
                      <th className="px-4 py-2 text-right">Current</th>
                      <th className="px-4 py-2 text-right">PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: "Score", score: 88, inv: "$100", curr: "$156", pnl: "+56%", pos: true },
                      { name: "Chutes", score: 85, inv: "$100", curr: "$134", pnl: "+34%", pos: true },
                      { name: "ninja", score: 82, inv: "$100", curr: "$118", pnl: "+18%", pos: true },
                      { name: "distil", score: 80, inv: "$100", curr: "$91", pnl: "-9%", pos: false },
                    ].map(r => (
                      <tr key={r.name} className="border-b border-gray-800/60">
                        <td className="px-4 py-2 text-gray-300 font-medium">{r.name}</td>
                        <td className="px-4 py-2 text-right text-yellow-400 font-bold">{r.score}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{r.inv}</td>
                        <td className="px-4 py-2 text-right text-gray-200">{r.curr}</td>
                        <td className={`px-4 py-2 text-right font-bold ${r.pos ? "text-green-400" : "text-red-400"}`}>{r.pnl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FeatureCard>

            {/* Feature 7: AlphaGap Index — Ultra Exclusive */}
            <div className="bg-gradient-to-b from-amber-950/30 to-[#0d0d14] border border-amber-400/25 rounded-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-amber-400/10">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-amber-400"><PIcon name="index" className="w-5 h-5" /></span>
                  <h3 className="font-bold text-lg text-white">AlphaGap Index — Auto-Invest in the Top 10</h3>
                  <span className="text-[10px] font-bold bg-amber-400/15 text-amber-400 border border-amber-400/25 px-2 py-0.5 rounded-full ml-auto">ULTRA ONLY</span>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-400 leading-relaxed mb-5">
                  The AlphaGap Index is a <span className="text-white font-medium">managed portfolio strategy</span> that automatically allocates your TAO across the top-scoring subnets every week. Instead of picking individual subnets, you own the entire leaderboard — auto-rebalanced as scores shift.
                </p>

                {/* How it works steps */}
                <div className="grid sm:grid-cols-3 gap-3 mb-5">
                  {[
                    { step: "1", icon: "leaderboard", title: "Score every subnet", desc: "AlphaGap runs its full 20+ signal analysis across all 128 subnets every week" },
                    { step: "2", icon: "priority",    title: "Select the top 10", desc: "The 10 highest composite aGap scores become the Index constituents for that week" },
                    { step: "3", icon: "rebalance",   title: "Auto-rebalance", desc: "Your TAO is redistributed weekly — winners stay in, falling subnets are trimmed" },
                  ].map(s => (
                    <div key={s.step} className="bg-amber-950/20 border border-amber-400/15 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-5 h-5 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-[10px] font-bold text-amber-400">{s.step}</span>
                        <span className="text-amber-400"><PIcon name={s.icon} className="w-4 h-4" /></span>
                      </div>
                      <div className="text-xs font-semibold text-white mb-1">{s.title}</div>
                      <div className="text-[10px] text-gray-500 leading-relaxed">{s.desc}</div>
                    </div>
                  ))}
                </div>

                {/* Mock index table */}
                <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden mb-5">
                  <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                    <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide flex items-center gap-1.5"><PIcon name="index" className="w-3 h-3" /> AlphaGap Index — Current Top 10</span>
                    <span className="text-[10px] text-gray-600">Rebalanced weekly</span>
                  </div>
                  {[
                    { rank: 1, name: "Score",   netuid: 44,  score: 88, weight: "18%", change: "+4.1%" },
                    { rank: 2, name: "Chutes",  netuid: 64,  score: 82, weight: "15%", change: "+6.2%" },
                    { rank: 3, name: "ninja",   netuid: 66,  score: 79, weight: "13%", change: "+5.4%" },
                    { rank: 4, name: "Affine",  netuid: 120, score: 75, weight: "11%", change: "-1.7%" },
                    { rank: 5, name: "distil",  netuid: 97,  score: 72, weight: "10%", change: "+7.8%" },
                  ].map(r => (
                    <div key={r.rank} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/50 last:border-0">
                      <span className="text-[10px] text-gray-600 w-3 tabular-nums">{r.rank}</span>
                      <span className="text-[10px] text-gray-600 font-mono">SN{r.netuid}</span>
                      <span className="text-sm font-semibold text-gray-200 flex-1">{r.name}</span>
                      <span className="text-sm font-bold text-amber-400 tabular-nums">{r.score}</span>
                      <span className="text-[10px] text-gray-500 tabular-nums w-8 text-right">{r.weight}</span>
                      <span className={`text-[10px] font-bold tabular-nums w-12 text-right ${r.change.startsWith("+") ? "text-green-400" : "text-red-400"}`}>{r.change}</span>
                    </div>
                  ))}
                  <div className="px-4 py-2 text-[10px] text-gray-600 border-t border-gray-800">Showing top 5 of 10 constituents</div>
                </div>

                <a href="/pricing" className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black font-bold rounded-xl transition-all shadow-lg shadow-amber-400/20 text-sm">
                  Unlock Ultra — $99/mo →
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Scoring breakdown ── */}
      <section className="py-20 px-5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">
            The <span className="text-green-400">aGap Score</span> — 5 signals. One number.
          </h2>
          <p className="text-gray-500 text-center text-sm mb-12 max-w-xl mx-auto">
            Every subnet is evaluated across five independent dimensions to produce the composite alpha gap score.
            The score answers one question: is this subnet undervalued by the market right now?
          </p>
          <div className="grid sm:grid-cols-5 gap-3">
            {([
              { label: "Dev Score",    icon: "dev",        iColor: "text-green-400",  color: "from-green-500/20 to-emerald-500/10 border-green-500/20", desc: "GitHub commits, PRs, releases, HuggingFace models — measures actual shipping velocity" },
              { label: "Flow Score",   icon: "whale",      iColor: "text-blue-400",   color: "from-blue-500/20 to-cyan-500/10 border-blue-500/20", desc: "Price momentum + whale accumulation + volume surges + fear/greed — detects smart money" },
              { label: "eVal Score",   icon: "benchmarks", iColor: "text-purple-400", color: "from-purple-500/20 to-violet-500/10 border-purple-500/20", desc: "Emission allocation vs market cap — finds where the network is paying more than the market knows" },
              { label: "Social Score", icon: "megaphone",  iColor: "text-yellow-400", color: "from-yellow-500/20 to-amber-500/10 border-yellow-500/20", desc: "KOL heat events + Discord alpha signals — detects early buzz before it goes mainstream" },
              { label: "Price Lag",    icon: "lag",        iColor: "text-red-400",    color: "from-red-500/20 to-rose-500/10 border-red-500/20", desc: "Multi-timeframe price momentum vs fundamental quality — the bigger the lag, the bigger the gap" },
            ] as { label: string; icon: string; iColor: string; color: string; desc: string }[]).map(s => (
              <div key={s.label} className={`bg-gradient-to-b ${s.color} border rounded-xl p-4 text-center`}>
                <div className={`mb-2 flex justify-center ${s.iColor}`}><PIcon name={s.icon} className="w-6 h-6" /></div>
                <div className="font-bold text-white text-sm mb-2">{s.label}</div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── vs manually ── */}
      <section className="py-20 px-5 bg-white/[0.01]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            AlphaGap vs. doing it yourself
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-6">
              <h3 className="font-bold text-red-400 mb-4">✕ Without AlphaGap</h3>
              <ul className="space-y-3 text-sm text-gray-400">
                {[
                  "Check 128 GitHub repos manually",
                  "Monitor HuggingFace for model releases",
                  "Track Discord in 50+ servers",
                  "Follow 300+ KOLs on Twitter",
                  "Manually calculate emission ratios",
                  "Watch on-chain transactions for whales",
                  "Cross-reference price vs fundamentals",
                  "Build your own scoring system",
                  "4–6 hours every single day",
                  "Still miss things",
                ].map(i => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5 shrink-0">✕</span>
                    {i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-6">
              <h3 className="font-bold text-green-400 mb-4">✓ With AlphaGap</h3>
              <ul className="space-y-3 text-sm text-gray-400">
                {[
                  "Open dashboard — top subnets ranked by aGap",
                  "Whale Tracker shows exactly who's buying",
                  "Volume surges flagged automatically",
                  "Pump Lab detects early momentum convergence",
                  "Signals analyzed and explained in plain English",
                  "Discord alpha surfaced automatically",
                  "KOL activity tracked and heat-scored",
                  "eVal ratio calculated every scan",
                  "aGap Velocity score shows momentum at a glance",
                  "Wallet Tracker reveals smart money positioning instantly",
                  "5 minutes to review your daily alpha",
                  "Never miss a major development again",
                ].map(i => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>


      {/* ── FAQ ── */}
      <section className="py-20 px-5 bg-white/[0.01]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Frequently asked questions</h2>
          <div className="space-y-4">
            {[
              {
                q: "What exactly is Bittensor?",
                a: "Bittensor is a decentralized AI network where 128 independent subnet teams compete to build the best AI models and services. Each subnet has a native alpha token whose value is driven by the team's work and the network's allocation of emissions (TAO). AlphaGap helps you identify which subnets are undervalued before the market catches on.",
              },
              {
                q: "How often is the data updated?",
                a: "The main scan runs every 10 minutes, pulling fresh data from GitHub, HuggingFace, TaoStats, SubnetRadar, and on-chain sources. The KOL Twitter monitor runs every 2 hours. Discord channels are scanned every 3 hours. Daily reports are generated every morning.",
              },
              {
                q: "I'm not technical — will I understand it?",
                a: "Absolutely. Every signal is explained in plain English with an investment take. You don't need to understand the code — you need to understand what the signal means for the price. That's exactly what we translate for you.",
              },
              {
                q: "Can I cancel anytime?",
                a: "Yes. Cancel any time from your Account page and you won't be charged again. You keep access until the end of your billing period. No questions asked.",
              },
              {
                q: "Is this financial advice?",
                a: "No. AlphaGap provides intelligence and analysis tools to help you make better-informed decisions. All investment decisions are your own. Crypto markets are volatile — never invest more than you can afford to lose.",
              },
              {
                q: "What payment methods do you accept?",
                a: "All major credit and debit cards via Stripe. The payment is handled entirely by Stripe — we never see or store your card details.",
              },
            ].map(faq => (
              <details key={faq.q} className="group bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-medium text-white text-sm list-none select-none">
                  {faq.q}
                  <span className="text-gray-600 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            The market is inefficient.
            <br />
            <span className="text-green-400">That&apos;s your edge.</span>
          </h2>
          <p className="text-gray-400 text-lg mb-4 max-w-xl mx-auto leading-relaxed">
            Every day, Bittensor teams ship breakthroughs that the market takes days or weeks to price in.
            AlphaGap finds those windows before anyone else.
          </p>
          <p className="text-gray-500 text-base mb-10">
            From $49/month. No long-term commitment. Cancel anytime.
          </p>
          <button
            onClick={() => handleSubscribe("premium")}
            disabled={checkoutLoading}
            className="px-10 py-5 bg-gradient-to-r from-purple-600 to-violet-700 text-white font-bold rounded-xl hover:from-purple-500 hover:to-violet-600 transition-all shadow-2xl shadow-purple-500/30 text-xl disabled:opacity-60"
          >
            {ctaLabel}
          </button>
          <p className="text-xs text-gray-600 mt-4">Instant access · Secure checkout via Stripe</p>
        </div>
      </section>

      {/* ── Disclaimer ── */}
      <section className="py-10 px-5 border-t border-white/[0.04]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm text-gray-300 leading-relaxed">
            <span className="font-semibold text-white">Not financial advice.</span> AlphaGap is an educational intelligence tool designed to help you research Bittensor subnets more efficiently. Nothing on this platform constitutes financial, investment, or trading advice. All data, scores, signals, and analysis are provided for informational purposes only. Cryptocurrency and digital asset markets are highly volatile. Past signal performance does not guarantee future results. Always do your own research and never invest more than you can afford to lose. AlphaGap is not responsible for any investment decisions you make based on information provided on this platform.
          </p>
          <p className="mt-4">
            <a href="/terms" className="text-green-400 hover:text-green-300 text-sm underline underline-offset-2 transition-colors">
              Terms of Service &amp; Privacy Policy
            </a>
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-5 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-[10px] font-bold text-black">α</div>
            AlphaGap — Bittensor Subnet Intelligence
          </div>
          <div className="flex items-center gap-5 text-sm text-gray-600">
            <Link href="/dashboard" className="hover:text-gray-400 transition-colors">Dashboard</Link>
            <Link href="/auth/signin" className="hover:text-gray-400 transition-colors">Sign In</Link>
            <span>Built on Bittensor</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense>
      <SubscribeContent />
    </Suspense>
  );
}
