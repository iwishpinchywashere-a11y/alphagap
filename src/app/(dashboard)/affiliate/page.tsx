"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { AffiliateStats } from "@/lib/referral";

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="ag-glass ag-glass-hover p-5 flex flex-col gap-1">
      <p className="text-[10.5px] text-gray-500 uppercase tracking-[0.16em]">{label}</p>
      <p className="font-display text-2xl font-semibold tracking-[-0.02em] text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-white/20 bg-white/10 hover:bg-white/20 transition-colors text-white"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AffiliatePage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customCode, setCustomCode] = useState("");
  const [customCodeStatus, setCustomCodeStatus] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/referral/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard");
      const data: AffiliateStats = await res.json();
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      loadStats();
    } else if (status === "unauthenticated") {
      setLoading(false);
      setError("You must be logged in to view this page.");
    }
  }, [status, loadStats]);

  async function handleSetCustomCode(e: React.FormEvent) {
    e.preventDefault();
    setCustomCodeStatus(null);
    const res = await fetch("/api/referral/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customCode }),
    });
    const data: { code?: string; error?: string } = await res.json();
    if (data.error) {
      setCustomCodeStatus(`Error: ${data.error}`);
    } else {
      setCustomCodeStatus(`Code set: ${data.code}`);
      loadStats();
    }
  }

  async function handleConnectStripe() {
    setConnectLoading(true);
    try {
      const res = await fetch("/api/referral/connect/onboard", { method: "POST" });
      const data: { url?: string; error?: string } = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Failed to start Stripe Connect onboarding");
      }
    } catch {
      alert("Failed to connect to Stripe");
    } finally {
      setConnectLoading(false);
    }
  }

  const referralLink = stats
    ? `https://alphagap.io/?ref=${stats.referralCode}`
    : "";

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07090b] ag-aurora flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#07090b] ag-aurora flex items-center justify-center px-4">
        <p className="text-red-400 text-sm">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07090b] ag-aurora text-white">
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-10">

        {/* ── Hero ── */}
        <div className="space-y-2">
          <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] leading-tight">
            Affiliate <span className="ag-gradient-text">Dashboard</span>
          </h1>
          <p className="text-[14.5px] text-gray-400 leading-relaxed">
            Earn{" "}
            <span className="text-emerald-400 font-semibold">20%</span> for every
            subscriber you refer. Paid automatically via Stripe every month.
          </p>
          <div className="flex items-center gap-2.5 pt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-gray-500">
            <span className="ag-live-dot flex-shrink-0" />
            <span>LIFETIME COMMISSIONS · AUTOMATIC STRIPE PAYOUTS</span>
          </div>
        </div>

        {/* ── Referral link ── */}
        <section className="ag-glass p-6 space-y-4">
          <h2 className="font-display font-semibold text-white">Your referral link</h2>
          <div className="flex items-center gap-3 bg-white/[0.035] backdrop-blur-md rounded-full px-4 py-3 border border-white/[0.08]">
            <span className="text-sm text-gray-300 flex-1 truncate font-mono">
              {referralLink}
            </span>
            <CopyButton text={referralLink} />
          </div>

          {/* Custom code form */}
          <form onSubmit={handleSetCustomCode} className="flex items-center gap-2">
            <input
              type="text"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              placeholder="Set custom code (e.g. JOHNDOE)"
              className="flex-1 bg-white/[0.035] border border-white/[0.08] backdrop-blur-md rounded-full px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/40"
              maxLength={20}
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-full text-sm font-medium bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.14] backdrop-blur-md transition-colors text-white whitespace-nowrap"
            >
              Set code
            </button>
          </form>
          {customCodeStatus && (
            <p
              className={`text-xs ${
                customCodeStatus.startsWith("Error") ? "text-red-400" : "text-green-400"
              }`}
            >
              {customCodeStatus}
            </p>
          )}
        </section>

        {/* ── Stripe Connect ── */}
        <section className="ag-glass p-6 space-y-3">
          <h2 className="font-display font-semibold text-white">Payout setup</h2>
          {stats?.payoutsEnabled ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Payouts active
              </span>
              <span className="text-xs text-gray-500">Stripe Connect linked</span>
            </div>
          ) : stats?.connectOnboarded ? (
            <div className="space-y-2">
              <p className="text-sm text-yellow-400">
                Your account setup is incomplete. Finish the Stripe onboarding to enable payouts.
              </p>
              <button
                onClick={handleConnectStripe}
                disabled={connectLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 transition-colors disabled:opacity-50"
              >
                {connectLoading ? "Redirecting…" : "Finish setup"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-400">
                Connect your bank account via Stripe to receive affiliate payouts.
              </p>
              <button
                onClick={handleConnectStripe}
                disabled={connectLoading}
                className="px-5 py-2.5 rounded-full text-sm font-bold bg-gradient-to-r from-emerald-400 to-green-400 text-black hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {connectLoading ? "Redirecting…" : "Connect bank account"}
              </button>
            </div>
          )}
        </section>

        {/* ── Stats grid ── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total referrals" value={String(stats.totalReferrals)} />
            <StatCard label="Active subscribers" value={String(stats.activeReferrals)} />
            <StatCard
              label="Total earned"
              value={formatDollars(stats.totalEarned)}
              sub="All-time paid out"
            />
            <StatCard
              label="Pending payout"
              value={formatDollars(stats.pendingEarned)}
              sub="Next transfer"
            />
          </div>
        )}

        {/* ── Recent referrals table ── */}
        {stats && stats.recentReferrals.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display font-semibold text-white">Recent referrals</h2>
            <div className="ag-glass overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-4 py-3 font-mono text-[10.5px] text-gray-500 font-medium uppercase tracking-[0.08em]">
                      Email
                    </th>
                    <th className="px-4 py-3 font-mono text-[10.5px] text-gray-500 font-medium uppercase tracking-[0.08em]">
                      Signed up
                    </th>
                    <th className="px-4 py-3 font-mono text-[10.5px] text-gray-500 font-medium uppercase tracking-[0.08em]">
                      Status
                    </th>
                    <th className="px-4 py-3 font-mono text-[10.5px] text-gray-500 font-medium uppercase tracking-[0.08em] text-right">
                      Commission
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentReferrals.map((r, i) => (
                    <tr
                      key={i}
                      className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-gray-300">{r.email}</td>
                      <td className="px-4 py-3 text-gray-400">{formatDate(r.signedUpAt)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.status === "subscribed"
                              ? "bg-green-500/10 text-green-400 border border-green-500/20"
                              : "bg-white/5 text-gray-500 border border-white/10"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {r.commissionEarned > 0 ? formatDollars(r.commissionEarned) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {stats && stats.recentReferrals.length === 0 && (
          <section className="ag-glass p-8 text-center space-y-2">
            <p className="text-gray-400">No referrals yet.</p>
            <p className="text-sm text-gray-600">
              Share your link above to start earning.
            </p>
          </section>
        )}

        {/* ── How it works ── */}
        <section className="space-y-4">
          <h2 className="font-display font-semibold text-white">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                step: "1",
                title: "Share your link",
                desc: "Copy your unique referral link and share it anywhere — Twitter, Discord, email, or your own site.",
              },
              {
                step: "2",
                title: "They subscribe",
                desc: "When someone signs up and subscribes to AlphaGap Pro or Premium using your link, you earn a commission.",
              },
              {
                step: "3",
                title: "You get paid",
                desc: "Earn 20% of every payment for 12 months. Commissions are transferred to your bank automatically via Stripe.",
              },
            ].map(({ step, title, desc }) => (
              <div
                key={step}
                className="ag-glass ag-glass-hover !rounded-xl p-5 space-y-2"
              >
                <div className="w-7 h-7 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-green-400">{step}</span>
                </div>
                <p className="font-medium text-white">{title}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Terms note ── */}
        <p className="text-xs text-gray-600 text-center">
          20% commission on each payment for the first 12 months per referred subscriber.
          Payouts via Stripe Connect. Self-referrals are not eligible.
        </p>
      </div>
    </main>
  );
}
