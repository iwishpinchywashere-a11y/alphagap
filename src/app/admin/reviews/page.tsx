"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Review {
  id: string;
  userId: string;
  name: string;
  xHandle: string;
  review: string;
  status: "pending" | "approved" | "denied";
  submittedAt: string;
  approvedAt?: string;
}

export default function AdminReviewsPage() {
  const { data: session, status } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "denied">("pending");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = (session?.user as any)?.isAdmin ||
    (process.env.NEXT_PUBLIC_ADMIN_CHECK === "true");

  useEffect(() => {
    if (status === "loading") return;
    if (!isAdmin) { setLoading(false); return; }
    fetch("/api/reviews", { method: "PUT" })
      .then(r => r.json())
      .then(d => setReviews(d.reviews ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, isAdmin]);

  async function doAction(id: string, action: "approve" | "deny" | "delete") {
    if (action === "delete" && !confirm("Permanently delete this review?")) return;
    const res = await fetch("/api/reviews", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      if (action === "delete") {
        setReviews(prev => prev.filter(r => r.id !== id));
      } else {
        setReviews(prev => prev.map(r =>
          r.id === id
            ? {
                ...r,
                status: action === "approve" ? "approved" : "denied",
                approvedAt: action === "approve" ? new Date().toISOString() : r.approvedAt,
              }
            : r
        ));
      }
    }
  }

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

  const pendingCount = reviews.filter(r => r.status === "pending").length;
  const approvedCount = reviews.filter(r => r.status === "approved").length;
  const deniedCount = reviews.filter(r => r.status === "denied").length;
  const filtered = reviews.filter(r => r.status === filter);

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/dashboard">
                <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-8 w-auto" />
              </Link>
              <span className="text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded">ADMIN</span>
              <span className="text-xs font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded">REVIEWS</span>
            </div>
            <p className="text-gray-500 text-sm">Approve or deny subscriber reviews before they go live</p>
          </div>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            ← Admin
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-6">
          {([
            { key: "pending", label: "Pending", count: pendingCount, active: "bg-yellow-500/15 border-yellow-500/40 text-yellow-400" },
            { key: "approved", label: "Approved", count: approvedCount, active: "bg-green-500/15 border-green-500/40 text-green-400" },
            { key: "denied", label: "Denied", count: deniedCount, active: "bg-red-500/15 border-red-500/40 text-red-400" },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                filter === f.key
                  ? f.active
                  : "bg-gray-800/60 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600"
              }`}
            >
              {f.label}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                filter === f.key ? "bg-white/10" : "bg-gray-700 text-gray-400"
              }`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Review cards */}
        {filtered.length === 0 ? (
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-12 text-center text-gray-600 text-sm">
            No {filter} reviews
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(review => (
              <div key={review.id} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
                {/* Meta */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-600/30 border border-green-500/20 flex items-center justify-center text-green-400 font-bold text-sm flex-shrink-0">
                    {review.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white text-sm">{review.name}</span>
                      {review.xHandle && (
                        <span className="text-xs text-blue-400">@{review.xHandle}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600">
                      Submitted {new Date(review.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {review.approvedAt && ` · Approved ${new Date(review.approvedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                    </div>
                  </div>
                  <div className="ml-auto">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      review.status === "approved"
                        ? "bg-green-500/15 text-green-400 border-green-500/30"
                        : review.status === "denied"
                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                    }`}>
                      {review.status}
                    </span>
                  </div>
                </div>

                {/* Review text */}
                <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl px-5 py-4 mb-4">
                  <div className="text-green-500/40 text-3xl font-serif leading-none mb-1">&ldquo;</div>
                  <p className="text-gray-300 text-sm leading-relaxed">{review.review}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  {review.status === "pending" && (
                    <>
                      <button
                        onClick={() => doAction(review.id, "approve")}
                        className="px-5 py-2 bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 text-green-400 rounded-xl text-sm font-medium transition-colors"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => doAction(review.id, "deny")}
                        className="px-5 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium transition-colors"
                      >
                        ✕ Deny
                      </button>
                    </>
                  )}
                  {review.status === "approved" && (
                    <button
                      onClick={() => doAction(review.id, "deny")}
                      className="px-5 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 rounded-xl text-sm font-medium transition-colors"
                    >
                      Revoke Approval
                    </button>
                  )}
                  {review.status === "denied" && (
                    <button
                      onClick={() => doAction(review.id, "approve")}
                      className="px-5 py-2 bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 text-green-400 rounded-xl text-sm font-medium transition-colors"
                    >
                      ✓ Approve
                    </button>
                  )}
                  <button
                    onClick={() => doAction(review.id, "delete")}
                    className="ml-auto px-4 py-2 bg-red-900/20 hover:bg-red-900/40 border border-red-900/30 text-red-500 rounded-xl text-sm transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
