"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function WriteReviewPage() {
  const { data: session, status } = useSession();
  const user = session?.user as { subscriptionStatus?: string } | undefined;
  const isActive = user?.subscriptionStatus === "active" || user?.subscriptionStatus === "trialing";

  const [name, setName] = useState(session?.user?.name ?? "");
  const [xHandle, setXHandle] = useState("");
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-white font-semibold mb-2">Sign in required</p>
          <p className="text-gray-500 text-sm mb-6">Please sign in to write a review.</p>
          <Link href="/auth/signin" className="px-6 py-2.5 bg-green-500 text-black font-bold rounded-xl text-sm hover:bg-green-400 transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">⭐</div>
          <p className="text-white font-semibold mb-2">Pro or Premium required</p>
          <p className="text-gray-500 text-sm mb-6">Only active subscribers can write a review.</p>
          <Link href="/pricing" className="px-6 py-2.5 bg-green-500 text-black font-bold rounded-xl text-sm hover:bg-green-400 transition-colors">
            View Plans →
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!review.trim() || !name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), xHandle: xHandle.trim(), review: review.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, message: data.message ?? "Review submitted! It'll appear once approved." });
      } else {
        setResult({ ok: false, message: data.error ?? "Something went wrong. Please try again." });
      }
    } catch {
      setResult({ ok: false, message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (result?.ok) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-5">🎉</div>
          <h2 className="text-white text-xl font-bold mb-2">Thanks for your review!</h2>
          <p className="text-gray-400 text-sm mb-8">{result.message}</p>
          <Link href="/dashboard" className="px-6 py-2.5 bg-green-500 text-black font-bold rounded-xl text-sm hover:bg-green-400 transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-lg mx-auto px-4 py-14">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-8 transition-colors">
            ← Back to Dashboard
          </Link>
          <div className="text-4xl mb-4">⭐</div>
          <h1 className="text-2xl font-bold text-white mb-2">Write a Review</h1>
          <p className="text-gray-500 text-sm">Share your experience with AlphaGap. Reviews are subject to approval before appearing on the site.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Your Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alex M."
              maxLength={80}
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/60 transition-colors"
            />
          </div>

          {/* X Handle */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              X (Twitter) Handle <span className="text-gray-600 font-normal">— optional</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm select-none">@</span>
              <input
                type="text"
                value={xHandle}
                onChange={e => setXHandle(e.target.value.replace(/^@/, ""))}
                placeholder="yourhandle"
                maxLength={50}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-8 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/60 transition-colors"
              />
            </div>
          </div>

          {/* Review */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Your Review <span className="text-red-400">*</span>
            </label>
            <textarea
              value={review}
              onChange={e => setReview(e.target.value)}
              placeholder="Tell us how AlphaGap has helped you…"
              maxLength={1000}
              required
              rows={5}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/60 transition-colors resize-none"
            />
            <div className="text-right text-xs text-gray-600 mt-1">{review.length}/1000</div>
          </div>

          {result && !result.ok && (
            <div className="bg-red-900/20 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
              {result.message}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !review.trim() || !name.trim()}
            className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl text-sm hover:from-green-400 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/20"
          >
            {submitting ? "Submitting…" : "Submit Review →"}
          </button>

          <p className="text-center text-xs text-gray-600">
            Reviews are reviewed by our team before appearing on the site.
          </p>
        </form>
      </div>
    </div>
  );
}
