"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyContent() {
  const params = useSearchParams();
  const success = params.get("success") === "1";
  const error = params.get("error");

  if (success) {
    return (
      <div className="text-center">
        <div className="text-5xl mb-6">✅</div>
        <h1 className="text-2xl font-bold text-white mb-3">Email verified!</h1>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          Your email address has been confirmed. You&apos;re all set.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl text-sm hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/20"
        >
          Go to Dashboard →
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <div className="text-5xl mb-6">🔗</div>
        <h1 className="text-2xl font-bold text-white mb-3">Link expired or invalid</h1>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed max-w-xs mx-auto">
          This verification link has expired or already been used. Sign in and we&apos;ll send you a fresh one.
        </p>
        <Link
          href="/auth/signin"
          className="inline-block px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl text-sm hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/20"
        >
          Sign In →
        </Link>
      </div>
    );
  }

  // No params — landed here without a token
  return (
    <div className="text-center">
      <div className="text-5xl mb-6">📧</div>
      <h1 className="text-2xl font-bold text-white mb-3">Check your email</h1>
      <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">
        We&apos;ve sent a verification link to your email address. Click the link to confirm your account.
      </p>
      <p className="text-gray-600 text-xs mt-6">
        Didn&apos;t get it? Check your spam folder.
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-4">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-green-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/">
            <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-10 w-auto mx-auto mb-4" />
          </Link>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8">
          <Suspense fallback={<div className="text-center text-gray-500 text-sm">Loading…</div>}>
            <VerifyContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
