"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-green-400 text-2xl animate-spin">⟳</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin");
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subscriptionStatus = (session?.user as any)?.subscriptionStatus ?? "none";
  const isActive = subscriptionStatus === "active" || subscriptionStatus === "trialing";

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setPortalLoading(false);
    }
  }

  async function subscribe() {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setCheckoutLoading(false);
    }
  }

  const statusConfigMap = {
    active: { label: "Active", color: "text-green-400 bg-green-500/10 border-green-500/30" },
    trialing: { label: "Trial", color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
    past_due: { label: "Payment Past Due", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" },
    canceled: { label: "Canceled", color: "text-gray-400 bg-gray-800 border-gray-700" },
    none: { label: "No Subscription", color: "text-gray-400 bg-gray-800 border-gray-700" },
  };
  const statusConfig = statusConfigMap[subscriptionStatus as keyof typeof statusConfigMap] ?? { label: subscriptionStatus, color: "text-gray-400 bg-gray-800 border-gray-700" };

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-12">
      <div className="max-w-lg mx-auto">
        {/* Nav */}
        <div className="flex items-center justify-between mb-10">
          <Link href="/dashboard">
            <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-9 w-auto" />
          </Link>
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            ← Dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white mb-8">Account Settings</h1>

        {/* Profile */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Profile</h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-black font-bold text-lg">
              {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <div className="font-semibold text-white">{session?.user?.name}</div>
              <div className="text-sm text-gray-500">{session?.user?.email}</div>
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Subscription</h2>

          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-300 text-sm">Status</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>

          {isActive ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <span className="text-gray-300 text-sm">Plan</span>
                <span className="text-white font-semibold">AlphaGap Pro — $19/month</span>
              </div>
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {portalLoading ? "Opening portal…" : "Manage Billing & Invoices →"}
              </button>
              <p className="text-xs text-gray-600 mt-2 text-center">Cancel, update payment, or download invoices</p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                Subscribe to unlock full access to AlphaGap — all signals, dashboard, social intel, and daily reports.
              </p>
              <button
                onClick={subscribe}
                disabled={checkoutLoading}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-lg py-2.5 text-sm hover:from-green-400 hover:to-emerald-500 transition-all disabled:opacity-50 shadow-lg shadow-green-500/20"
              >
                {checkoutLoading ? "Loading…" : "Subscribe for $19/month →"}
              </button>
            </>
          )}
        </div>

        {/* Sign out */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Session</h2>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
