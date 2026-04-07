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
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

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
  const user = session?.user as any;
  const subscriptionStatus = user?.subscriptionStatus ?? "none";
  const subscriptionTier: "pro" | "premium" | null = user?.subscriptionTier ?? null;
  const isActive = subscriptionStatus === "active" || subscriptionStatus === "trialing";
  const isPro = isActive && subscriptionTier === "pro";
  const isPremium = isActive && subscriptionTier === "premium";
  const [portalError, setPortalError] = useState("");
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelDate, setCancelDate] = useState<string | null>(null);

  async function cancelSubscription() {
    setCancelLoading(true);
    try {
      const res = await fetch("/api/stripe/cancel", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setCancelDate(data.cancelDate);
        setCancelConfirm(false);
      } else {
        alert(data.error || "Failed to cancel. Please contact hello@getbeanstock.com");
      }
    } catch {
      alert("Failed to cancel. Please contact hello@getbeanstock.com");
    } finally {
      setCancelLoading(false);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    setPortalError("");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setPortalError(data.error || "Could not open billing portal. Please contact hello@getbeanstock.com");
      }
    } catch {
      setPortalError("Could not open billing portal. Please contact hello@getbeanstock.com");
    } finally {
      setPortalLoading(false);
    }
  }

  async function sendPasswordReset() {
    setResetLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: session?.user?.email }),
      });
      setResetSent(true);
    } finally {
      setResetLoading(false);
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
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-300 text-sm">Plan</span>
                <span className="text-white font-semibold">
                  {isPremium ? "AlphaGap Premium — $49/mo" : "AlphaGap Pro — $29/mo"}
                </span>
              </div>

              {/* Upgrade to Premium (only shown for Pro users) */}
              {isPro && (
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 mb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-purple-300 mb-1">Upgrade to Premium — $49/mo</div>
                      <div className="text-xs text-gray-500">Unlocks Whale Tracker, KOL Radar, Pump Lab, Discord Scanner & more</div>
                    </div>
                  </div>
                  <a
                    href="/checkout?plan=premium"
                    className="mt-3 w-full inline-block text-center bg-gradient-to-r from-purple-500 to-violet-600 text-white font-bold rounded-lg py-2.5 text-sm hover:from-purple-400 hover:to-violet-500 transition-all shadow-lg shadow-purple-500/20"
                  >
                    Upgrade to Premium →
                  </a>
                </div>
              )}

              {/* Billing portal */}
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {portalLoading ? "Opening…" : "Manage Billing & Invoices →"}
              </button>
              <p className="text-xs text-gray-600 mt-2 text-center">Update payment method or download invoices</p>
              {portalError && (
                <p className="text-xs text-red-400 mt-2 text-center">{portalError}</p>
              )}

              {/* Cancel subscription */}
              <div className="border-t border-gray-800 mt-5 pt-5">
                {cancelDate ? (
                  <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-4 py-3 text-center">
                    <p className="text-sm text-yellow-400 font-medium">Subscription cancelled</p>
                    <p className="text-xs text-gray-500 mt-1">
                      You&apos;ll keep full access until <span className="text-gray-300">{cancelDate}</span>
                    </p>
                  </div>
                ) : cancelConfirm ? (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-4">
                    <p className="text-sm text-red-400 font-medium mb-1">Are you sure?</p>
                    <p className="text-xs text-gray-500 mb-4">
                      You&apos;ll keep access until your current billing period ends. This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={cancelSubscription}
                        disabled={cancelLoading}
                        className="flex-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {cancelLoading ? "Cancelling…" : "Yes, cancel my subscription"}
                      </button>
                      <button
                        onClick={() => setCancelConfirm(false)}
                        disabled={cancelLoading}
                        className="px-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 rounded-lg py-2 text-sm transition-colors"
                      >
                        Keep it
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setCancelConfirm(true)}
                    className="w-full text-sm text-gray-600 hover:text-red-400 transition-colors py-1"
                  >
                    Cancel subscription
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                Subscribe to unlock full access to AlphaGap — all signals, dashboard, social intel, and daily reports.
              </p>
              <a
                href="/checkout?plan=pro"
                className="w-full inline-block text-center bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-lg py-2.5 text-sm hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/20"
              >
                Get Pro — $29/mo →
              </a>
              <a
                href="/checkout?plan=premium"
                className="w-full inline-block text-center mt-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white font-bold rounded-lg py-2.5 text-sm hover:from-purple-400 hover:to-violet-500 transition-all shadow-lg shadow-purple-500/20"
              >
                Get Premium — $49/mo →
              </a>
            </>
          )}
        </div>

        {/* Security */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Security</h2>
          {resetSent ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-green-400 text-sm text-center">
              Password reset email sent — check your inbox.
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-3">
                We&apos;ll email you a secure link to reset your password.
              </p>
              <button
                onClick={sendPasswordReset}
                disabled={resetLoading}
                className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {resetLoading ? "Sending…" : "Send Password Reset Email"}
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
