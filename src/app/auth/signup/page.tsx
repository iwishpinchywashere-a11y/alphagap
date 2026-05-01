"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Turnstile } from "@marsidev/react-turnstile";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function SignUpForm() {
  const params = useSearchParams();
  const plan = (params.get("plan") === "premium" ? "premium" : "pro") as "pro" | "premium";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!agreedToTerms) {
      setError("Please accept the Terms of Service & Privacy Policy to continue.");
      return;
    }

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError("Please complete the CAPTCHA check");
      return;
    }

    setLoading(true);
    try {
      // 1. Create account
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: email.toLowerCase().trim(),
          password,
          turnstileToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create account");
        setLoading(false);
        return;
      }

      // Session cookie is set by the signup API in the same request —
      // no separate create-session call needed. Go straight to checkout.
      window.location.href = `/checkout?plan=${plan}`;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-4">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-green-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/">
            <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-10 w-auto mx-auto mb-4" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">
            Then complete payment — cancel anytime
          </p>
          {plan && (
            <p className="text-xs text-green-400/80 mt-1 font-medium">
              Selected: AlphaGap {plan === "premium" ? "Premium ($49/mo)" : "Pro ($29/mo)"}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Your name"
              className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3.5 py-2.5 text-base text-gray-100 placeholder-gray-600 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600/30 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3.5 py-2.5 text-base text-gray-100 placeholder-gray-600 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600/30 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3.5 py-2.5 pr-10 text-base text-gray-100 placeholder-gray-600 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600/30 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Cloudflare Turnstile — only renders when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set */}
          {TURNSTILE_SITE_KEY && (
            <div className="flex flex-col items-center gap-2">
              <Turnstile
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={(token) => { setTurnstileToken(token); setTurnstileError(false); }}
                onExpire={() => setTurnstileToken("")}
                onError={() => { setTurnstileToken(""); setTurnstileError(true); }}
                options={{ theme: "dark", size: "normal" }}
              />
              {turnstileError && (
                <p className="text-xs text-amber-400 text-center leading-relaxed">
                  CAPTCHA check failed — this can happen with VPNs or certain browsers.
                  Try disabling your VPN, refreshing the page, or using a different browser.
                </p>
              )}
            </div>
          )}

          <label className="flex items-start gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-600 bg-gray-800 text-green-500 focus:ring-green-600 focus:ring-offset-gray-900"
            />
            <span className="text-xs text-gray-400 leading-relaxed">
              I have read and agree to the{" "}
              <Link href="/terms" target="_blank" className="text-green-400 hover:text-green-300 underline underline-offset-2 transition-colors">
                Terms of Service &amp; Privacy Policy
              </Link>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || !agreedToTerms}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-lg py-2.5 text-sm hover:from-green-400 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/20"
          >
            {loading ? "Setting up account…" : "Create Account & Subscribe →"}
          </button>

          <p className="text-center text-[11px] text-gray-600 leading-relaxed">
            You&apos;ll be redirected to Stripe to complete payment.
          </p>

          <p className="text-center text-xs text-gray-600">
            Already have an account?{" "}
            <Link href="/auth/signin" className="text-green-400 hover:text-green-300 transition-colors">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center"><div className="text-green-400 animate-spin text-2xl">⟳</div></div>}>
      <SignUpForm />
    </Suspense>
  );
}
