"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import AgIcon from "@/components/AgIcon";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="text-center">
        <div className="text-5xl mb-6 flex justify-center text-gray-300"><AgIcon name="link" /></div>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-white mb-3">Invalid link</h1>
        <p className="text-gray-400 text-sm mb-6">This reset link is missing or malformed.</p>
        <Link href="/auth/signin" className="text-emerald-400 hover:text-emerald-300 text-sm transition-colors">
          Back to sign in →
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="text-5xl mb-6 flex justify-center text-gray-300"><AgIcon name="key" /></div>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-white mb-3">Password updated!</h1>
        <p className="text-gray-400 text-sm mb-8">Your password has been changed. Sign in with your new password.</p>
        <Link
          href="/auth/signin"
          className="inline-block px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-full text-sm hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/20"
        >
          Sign In →
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reset password");
        if (data.error?.includes("expired") || data.error?.includes("invalid")) {
          setTimeout(() => router.push("/auth/signin"), 2500);
        }
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="text-center mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-white">Create new password</h1>
        <p className="text-gray-500 text-sm mt-1">Enter a new password for your account</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Min. 8 characters"
            className="w-full bg-white/[0.04] border border-white/[0.10] rounded-xl px-3.5 py-2.5 backdrop-blur-[14px] text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/20 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Repeat password"
            className="w-full bg-white/[0.04] border border-white/[0.10] rounded-xl px-3.5 py-2.5 backdrop-blur-[14px] text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/20 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-full py-2.5 text-sm hover:from-green-400 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/20"
        >
          {loading ? "Saving…" : "Set New Password →"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#07090b] ag-aurora flex flex-col items-center justify-center px-4">
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/">
            <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-10 w-auto mx-auto mb-4" />
          </Link>
        </div>
        <div className="ag-glass p-6">
          <Suspense fallback={<div className="text-center text-gray-500 text-sm py-8">Loading…</div>}>
            <ResetForm />
          </Suspense>
        </div>
        <p className="text-center text-xs text-gray-600 mt-4">
          <Link href="/auth/signin" className="text-gray-500 hover:text-gray-300 transition-colors">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
