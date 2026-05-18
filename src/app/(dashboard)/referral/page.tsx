"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { AffiliateStats } from "@/lib/referral";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-white/20 bg-white/10 hover:bg-white/20 transition-colors text-white whitespace-nowrap"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className="text-green-400">Copied!</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, green }: { label: string; value: string; sub?: string; green?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-1 ${green ? "border-green-500/30 bg-green-500/5" : "border-white/10 bg-white/5"}`}>
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${green ? "text-green-400" : "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

// ── Earnings calculator ────────────────────────────────────────────────────────

const TIERS = [
  { referrals: 5,  label: "Casual sharer" },
  { referrals: 20, label: "Active promoter" },
  { referrals: 50, label: "Power affiliate" },
  { referrals: 100,label: "Top earner" },
];

function EarningsCalc() {
  const [plan, setPlan] = useState<"pro" | "premium">("premium");
  const price = plan === "premium" ? 49 : 29;
  const commission = price * 0.20;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-semibold text-white text-lg">What could you earn?</h3>
        <div className="flex rounded-lg border border-white/10 overflow-hidden text-sm">
          {(["pro", "premium"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlan(p)}
              className={`px-4 py-1.5 font-medium transition-colors ${
                plan === p
                  ? "bg-green-500/20 text-green-400"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {p === "pro" ? "Pro ($29)" : "Premium ($49)"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TIERS.map(({ referrals, label }) => {
          const monthly = Math.round(referrals * commission);
          const yearly = monthly * 12;
          return (
            <div key={referrals} className="rounded-xl bg-black/30 border border-white/10 p-4 space-y-2 text-center">
              <p className="text-2xl font-bold text-white">{referrals}</p>
              <p className="text-xs text-gray-500">{label}</p>
              <div className="border-t border-white/10 pt-2 space-y-1">
                <p className="text-green-400 font-semibold text-sm">${monthly}/mo</p>
                <p className="text-xs text-gray-500">${yearly.toLocaleString()}/yr</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-600 text-center">
        Based on {Math.round(commission * 100) / 100}% commission per ${price}/mo subscriber · Lifetime — commissions never expire
      </p>
    </div>
  );
}

// ── Dashboard (logged-in users) ───────────────────────────────────────────────

function AffiliateDashboard({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [customCode, setCustomCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/referral/dashboard");
      if (res.ok) setStats(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  async function handleSetCode(e: React.FormEvent) {
    e.preventDefault();
    setCodeStatus(null);
    const res = await fetch("/api/referral/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customCode }),
    });
    const data: { code?: string; error?: string } = await res.json();
    if (data.error) {
      setCodeStatus({ ok: false, msg: data.error });
    } else {
      setCodeStatus({ ok: true, msg: `Code updated to ${data.code}` });
      setCustomCode("");
      loadStats();
    }
  }

  async function handleConnectStripe() {
    setConnectLoading(true);
    try {
      const res = await fetch("/api/referral/connect/onboard", { method: "POST" });
      const data: { url?: string; error?: string } = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error ?? "Failed to start Stripe Connect onboarding");
    } finally {
      setConnectLoading(false);
    }
  }

  const refLink = stats?.referralCode
    ? `https://alphagap.io/?ref=${stats.referralCode}`
    : "";

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Section header ── */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-gray-500 uppercase tracking-widest font-medium">Your account</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      {/* ── Referral link box ── */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Your referral link</h3>
          {stats?.referralCode && (
            <span className="text-xs font-mono bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded">
              {stats.referralCode}
            </span>
          )}
        </div>

        {refLink ? (
          <div className="flex items-center gap-2 bg-black/40 rounded-xl px-4 py-3 border border-white/10">
            <span className="text-sm text-gray-300 flex-1 truncate font-mono">{refLink}</span>
            <CopyButton text={refLink} />
          </div>
        ) : (
          <p className="text-sm text-gray-500">Generating your link…</p>
        )}

        {/* Custom code */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Want a custom code? Set it below (e.g. your username or brand).</p>
          <form onSubmit={handleSetCode} className="flex gap-2">
            <input
              type="text"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
              placeholder={stats?.referralCode ?? "YOURCODE"}
              className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 font-mono uppercase"
              maxLength={20}
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-300 transition-colors whitespace-nowrap"
            >
              Set code
            </button>
          </form>
          {codeStatus && (
            <p className={`text-xs ${codeStatus.ok ? "text-green-400" : "text-red-400"}`}>
              {codeStatus.msg}
            </p>
          )}
          <p className="text-xs text-gray-600">3–20 chars · letters, numbers, hyphens</p>
        </div>
      </div>

      {/* ── Payout setup ── */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <h3 className="font-semibold text-white">Payout setup</h3>

        {stats?.payoutsEnabled ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Payouts active
            </span>
            <span className="text-xs text-gray-500">Stripe Connect linked · transfers go directly to your bank</span>
          </div>
        ) : stats?.connectOnboarded ? (
          <div className="space-y-3">
            <p className="text-sm text-yellow-400">
              Your Stripe account setup is incomplete. Finish to enable automatic payouts.
            </p>
            <button
              onClick={handleConnectStripe}
              disabled={connectLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 transition-colors disabled:opacity-50"
            >
              {connectLoading ? "Redirecting…" : "Finish setup →"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Connect your bank account via Stripe. When someone you referred subscribes, the commission transfers automatically — no manual steps.
            </p>
            <button
              onClick={handleConnectStripe}
              disabled={connectLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-green-500/15 hover:bg-green-500/25 border border-green-500/40 text-green-300 transition-colors disabled:opacity-50"
            >
              {connectLoading ? (
                <span className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                  <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                </svg>
              )}
              Connect bank account
            </button>
          </div>
        )}
      </div>

      {/* ── Stats grid ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total referrals" value={String(stats.totalReferrals)} sub="All-time signups" />
          <StatCard label="Active subscribers" value={String(stats.activeReferrals)} sub="Currently paying" />
          <StatCard label="Total earned" value={formatDollars(stats.totalEarned)} sub="All-time paid out" green />
          <StatCard label="Pending" value={formatDollars(stats.pendingEarned)} sub="Next transfer" />
        </div>
      )}

      {/* ── Referrals table ── */}
      {stats && stats.recentReferrals.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-white">Your referrals</h3>
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Joined</th>
                  <th className="px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider text-right">Earned</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentReferrals.map((r, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-300 text-xs">{r.email}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(r.signedUpAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.status === "subscribed"
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-white/5 text-gray-500 border border-white/10"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 text-xs">
                      {r.commissionEarned > 0 ? (
                        <span className="text-green-400 font-medium">{formatDollars(r.commissionEarned)}</span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats && stats.recentReferrals.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center space-y-2">
          <p className="text-3xl">🚀</p>
          <p className="text-white font-medium">No referrals yet</p>
          <p className="text-sm text-gray-500">Share your link above and start earning passive income.</p>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReferralPage() {
  const { data: session, status } = useSession();

  const userId = (session?.user as { id?: string } | undefined)?.id ?? session?.user?.email ?? "";
  const userEmail = session?.user?.email ?? "";

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-4xl mx-auto px-4 py-14 space-y-14">

        {/* ── Hero ── */}
        <div className="text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Referral Program
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Earn{" "}
            <span className="text-green-400">20% for life</span>
            <br />on every subscriber you refer
          </h1>

          <p className="text-gray-400 text-lg max-w-xl mx-auto leading-relaxed">
            Share AlphaGap with your network. When someone subscribes through your link,
            you get 20% of every payment they make — forever.
          </p>

          {/* Key badges */}
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            {[
              { icon: "♾️", text: "Lifetime commissions" },
              { icon: "⚡", text: "Automatic Stripe payouts" },
              { icon: "🎯", text: "Custom referral codes" },
              { icon: "📊", text: "Real-time dashboard" },
            ].map(({ icon, text }) => (
              <span key={text} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300">
                <span>{icon}</span> {text}
              </span>
            ))}
          </div>
        </div>

        {/* ── Earnings calculator ── */}
        <EarningsCalc />

        {/* ── How it works ── */}
        <div className="space-y-5">
          <h2 className="text-xl font-semibold text-white text-center">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                step: "01",
                icon: "🔗",
                title: "Get your link",
                desc: "Sign in and grab your unique referral link. Customize it with your username or brand name.",
              },
              {
                step: "02",
                icon: "📣",
                title: "Share it anywhere",
                desc: "Post it on X/Twitter, Discord, Telegram, your newsletter — anywhere the Bittensor community lives.",
              },
              {
                step: "03",
                icon: "💸",
                title: "Get paid automatically",
                desc: "Every time a referred subscriber pays their monthly bill, 20% transfers directly to your bank. No invoicing, no waiting.",
              },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{icon}</span>
                  <span className="text-xs font-mono text-gray-600">{step}</span>
                </div>
                <p className="font-semibold text-white">{title}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Commission breakdown ── */}
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6 space-y-4">
          <h3 className="font-semibold text-white">Commission breakdown</h3>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            {[
              { plan: "Pro", price: "$29/mo", commission: "$5.80/mo", yearly: "$69.60/yr" },
              { plan: "Premium", price: "$49/mo", commission: "$9.80/mo", yearly: "$117.60/yr" },
              { plan: "Mixed (avg)", price: "$39/mo", commission: "$7.80/mo", yearly: "$93.60/yr" },
            ].map(({ plan, price, commission, yearly }) => (
              <div key={plan} className="rounded-xl bg-black/30 border border-white/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{plan}</span>
                  <span className="text-gray-500 text-xs">{price}</span>
                </div>
                <p className="text-green-400 font-bold text-xl">{commission}</p>
                <p className="text-gray-500 text-xs">{yearly} per subscriber</p>
                <p className="text-gray-600 text-xs">Forever · no cap · no expiry</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Dashboard / CTA ── */}
        {status === "loading" ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : status === "authenticated" ? (
          <AffiliateDashboard userId={userId} userEmail={userEmail} />
        ) : (
          /* Logged-out CTA */
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center space-y-5">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white">Ready to start earning?</h3>
              <p className="text-gray-400 text-sm">Sign in to generate your referral link and connect your bank for payouts.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-semibold bg-green-500/15 hover:bg-green-500/25 border border-green-500/40 text-green-300 transition-colors"
              >
                Sign in to get started
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/15 border border-white/20 text-white transition-colors"
              >
                Create an account
              </Link>
            </div>
          </div>
        )}

        {/* ── Fine print ── */}
        <p className="text-xs text-gray-600 text-center leading-relaxed">
          20% commission on every payment made by referred subscribers · Commissions are lifetime — they never expire ·
          Payouts via Stripe Connect direct to your bank · 90-day attribution window · Self-referrals are not eligible ·
          AlphaGap reserves the right to modify or terminate the program with 30 days notice
        </p>

      </div>
    </main>
  );
}
