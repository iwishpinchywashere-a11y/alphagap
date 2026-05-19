"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { AdminAffiliateEntry } from "@/app/api/admin/affiliates/route";

function fmt(cents: number) {
  if (cents === 0) return "$0";
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(2)}`;
}

function statusDot(payouts: boolean, hasConnect: boolean) {
  if (payouts)    return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />Payouts on</span>;
  if (hasConnect) return <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-400"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />Onboarding</span>;
  return           <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500"><span className="w-1.5 h-1.5 rounded-full bg-gray-600 inline-block" />No Connect</span>;
}

export default function AdminAffiliatesPage() {
  const { data: session, status } = useSession();
  const [affiliates, setAffiliates] = useState<AdminAffiliateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"signups" | "earned" | "monthly" | "joined">("signups");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = (session?.user as any)?.isAdmin ||
    process.env.NEXT_PUBLIC_ADMIN_CHECK === "true";

  useEffect(() => {
    if (status === "loading") return;
    if (!isAdmin) { setLoading(false); return; }
    fetch("/api/admin/affiliates")
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setAffiliates(d.affiliates ?? []);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [status, isAdmin]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-green-400 text-2xl animate-spin">⟳</div>
      </div>
    );
  }

  if (status === "unauthenticated" || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-gray-400">Admin access required</p>
          <Link href="/auth/signin" className="text-green-400 hover:underline text-sm mt-2 block">Sign in</Link>
        </div>
      </div>
    );
  }

  // ── Aggregates ──────────────────────────────────────────────────
  const totalSignups   = affiliates.reduce((s, a) => s + a.totalSignups, 0);
  const totalPaid      = affiliates.reduce((s, a) => s + a.totalEarned, 0);
  const totalPending   = affiliates.reduce((s, a) => s + a.pendingEarned, 0);
  const totalMonthly   = affiliates.reduce((s, a) => s + a.monthlyEarnings, 0);
  const withConnect    = affiliates.filter(a => a.hasStripeConnect).length;

  // ── Filter + sort ───────────────────────────────────────────────
  const filtered = affiliates
    .filter(a => {
      if (!search) return true;
      const q = search.toLowerCase();
      return a.email.toLowerCase().includes(q) ||
             a.name.toLowerCase().includes(q) ||
             (a.referralCode ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === "signups") return b.totalSignups  - a.totalSignups;
      if (sort === "earned")  return b.totalEarned   - a.totalEarned;
      if (sort === "monthly") return b.monthlyEarnings - a.monthlyEarnings;
      // joined
      return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
    });

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/dashboard">
                <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-8 w-auto" />
              </Link>
              <span className="text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded">ADMIN</span>
              <span className="text-gray-600 text-sm">/</span>
              <span className="text-sm font-semibold text-purple-400">Affiliates</span>
            </div>
            <p className="text-gray-500 text-sm">Referral commission program — {affiliates.length} affiliate{affiliates.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Admin
            </Link>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {[
            { label: "Affiliates",     value: affiliates.length },
            { label: "Total Signups",  value: totalSignups },
            { label: "Paid Out",       value: fmt(totalPaid) },
            { label: "Pending",        value: fmt(totalPending) },
            { label: "This Month",     value: fmt(totalMonthly) },
          ].map(s => (
            <div key={s.label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">{s.label}</div>
              <div className="text-xl font-bold text-white tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs font-medium bg-green-500/10 border border-green-500/20 text-green-400 px-3 py-1 rounded-full">
            {withConnect} Stripe Connect linked
          </span>
          <span className="text-xs font-medium bg-purple-500/10 border border-purple-500/20 text-purple-400 px-3 py-1 rounded-full">
            {affiliates.filter(a => a.payoutsEnabled).length} payouts enabled
          </span>
          <span className="text-xs font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 rounded-full">
            {affiliates.reduce((s, a) => s + a.proSubs, 0)} Pro subs referred
          </span>
          <span className="text-xs font-medium bg-pink-500/10 border border-pink-500/20 text-pink-400 px-3 py-1 rounded-full">
            {affiliates.reduce((s, a) => s + a.premiumSubs, 0)} Premium subs referred
          </span>
        </div>

        {/* Filter / search bar */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search name, email, or code…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-900/60 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-600"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-600 mr-1">Sort:</span>
            {(["signups", "earned", "monthly", "joined"] as const).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                  sort === s
                    ? "bg-green-500/15 border-green-500/40 text-green-400"
                    : "bg-gray-800/60 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                {s === "signups" ? "Signups" : s === "earned" ? "Earned" : s === "monthly" ? "Monthly" : "Newest"}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-3xl mb-3">🤝</div>
              <p className="text-gray-500 text-sm">
                {affiliates.length === 0 ? "No affiliates yet" : "No affiliates match your search"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-600 border-b border-gray-800 bg-gray-900/40">
                    <th className="px-5 py-3 font-medium">Affiliate</th>
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium text-center">Signups</th>
                    <th className="px-4 py-3 font-medium text-center">
                      <span className="text-green-500">Pro</span> / <span className="text-purple-400">Premium</span>
                    </th>
                    <th className="px-4 py-3 font-medium text-right">This Month</th>
                    <th className="px-4 py-3 font-medium text-right">Pending</th>
                    <th className="px-4 py-3 font-medium text-right">Total Paid</th>
                    <th className="px-4 py-3 font-medium">Connect</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {filtered.map(a => (
                    <tr key={a.userId} className="hover:bg-gray-800/20 transition-colors">

                      {/* Name / email */}
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-gray-200 leading-tight">{a.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{a.email}</div>
                      </td>

                      {/* Code */}
                      <td className="px-4 py-3.5">
                        {a.referralCode ? (
                          <span className="font-mono text-xs font-semibold bg-gray-800 border border-gray-700 text-green-400 px-2 py-1 rounded">
                            {a.referralCode}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>

                      {/* Signups */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`font-bold tabular-nums ${a.totalSignups > 0 ? "text-white" : "text-gray-600"}`}>
                          {a.totalSignups}
                        </span>
                      </td>

                      {/* Pro / Premium */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                            a.proSubs > 0
                              ? "bg-green-500/10 border-green-500/30 text-green-400"
                              : "bg-gray-800 border-gray-700 text-gray-600"
                          }`}>
                            {a.proSubs} Pro
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                            a.premiumSubs > 0
                              ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                              : "bg-gray-800 border-gray-700 text-gray-600"
                          }`}>
                            {a.premiumSubs} Prem
                          </span>
                        </div>
                      </td>

                      {/* Monthly earnings */}
                      <td className="px-4 py-3.5 text-right">
                        <span className={`font-semibold tabular-nums ${a.monthlyEarnings > 0 ? "text-green-400" : "text-gray-600"}`}>
                          {fmt(a.monthlyEarnings)}
                        </span>
                        <div className="text-xs text-gray-600">/ mo</div>
                      </td>

                      {/* Pending */}
                      <td className="px-4 py-3.5 text-right">
                        <span className={`tabular-nums text-sm ${a.pendingEarned > 0 ? "text-yellow-400" : "text-gray-600"}`}>
                          {fmt(a.pendingEarned)}
                        </span>
                      </td>

                      {/* Total paid */}
                      <td className="px-4 py-3.5 text-right">
                        <span className={`tabular-nums text-sm font-medium ${a.totalEarned > 0 ? "text-white" : "text-gray-600"}`}>
                          {fmt(a.totalEarned)}
                        </span>
                      </td>

                      {/* Connect status */}
                      <td className="px-4 py-3.5">
                        {statusDot(a.payoutsEnabled, a.hasStripeConnect)}
                      </td>

                      {/* Joined */}
                      <td className="px-4 py-3.5 text-xs text-gray-500 hidden lg:table-cell">
                        {new Date(a.joinedAt).toLocaleDateString()}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-700 mt-4 text-center">
          Commission rate: 20% lifetime · Data updates live from Vercel Blob
        </p>

      </div>
    </div>
  );
}
