"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import AlphaGapLogo from "@/components/AlphaGapLogo";

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
        <div className="text-5xl mb-6">🔗</div>
        <h1 className="text-2xl font-bold text-white mb-3">Invalid link</h1>
        <p className="text-gray-400 text-sm mb-6">This reset link is missing or malformed.</p>
        <Link href="/auth/signin" className="text-green-400 hover:text-green-300 text-sm transition-colors">
          Back to sign in →
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="text-5xl mb-6">🔐</div>
        <h1 className="text-2xl font-bold text-white mb-3">Password updated!</h1>
        <p className="text-gray-400 text-sm mb-8">Your password has been changed. Sign in with your new password.</p>
        <Link
          href="/auth/signin"
          className="inline-block px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl text-sm hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/20"
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
        <h1 className="text-2xl font-bold text-white">Create new password</h1>
        <p className="text-gray-500 text-sm mt-1">Enter a new password for your account</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
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
            className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600/30 transition-colors"
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
            className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600/30 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-lg py-2.5 text-sm hover:from-green-400 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/20"
        >
          {loading ? "Saving…" : "Set New Password →"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-4">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-green-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/">
            <div className="flex justify-center mb-4"><AlphaGapLogo height={40} /></div>
          </Link>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
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
