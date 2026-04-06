"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";

interface UserEntry {
  email: string;
  name: string;
  subscriptionStatus: "none" | "active" | "canceled" | "past_due" | "trialing";
  stripeCustomerId?: string;
  createdAt: string;
}
interface StripeStats {
  activeSubscriptions: number;
  mrr: number;
  totalRevenue: number;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: "bg-green-500/15 text-green-400 border-green-500/30",
    trialing: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    past_due: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    canceled: "bg-red-500/10 text-red-400 border-red-500/20",
    none: "bg-gray-800 text-gray-500 border-gray-700",
  };
  return map[status] ?? "bg-gray-800 text-gray-500 border-gray-700";
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [stats, setStats] = useState<StripeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionEmail, setActionEmail] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "pro" | "premium">("all");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = (session?.user as any)?.isAdmin ||
    (process.env.NEXT_PUBLIC_ADMIN_CHECK === "true");

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { setLoading(false); return; }
    // Only fetch if admin — avoids 403 spam
    if (!isAdmin) { setLoading(false); return; }
    Promise.all([
      fetch("/api/admin/users").then(r => r.json()),
      fetch("/api/admin/users?action=stripe-stats").then(r => r.json()),
    ]).then(([userData, stripeData]) => {
      setUsers(userData.users ?? []);
      setStats(stripeData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [status, isAdmin]);

  async function doAction(action: "grant" | "revoke" | "make-admin" | "delete", email: string) {
    if (action === "delete" && !confirm(`Permanently delete account: ${email}?`)) return;
    setActionLoading(true);
    setActionMsg("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, email }),
      });
      const data = await res.json();
      setActionMsg(data.message || data.error || "Done");
      if (res.ok) {
        if (action === "delete") {
          setUsers(prev => prev.filter(u => u.email !== email));
        } else {
          setUsers(prev => prev.map(u =>
            u.email === email
              ? { ...u, subscriptionStatus: action === "grant" ? "active" : action === "revoke" ? "canceled" : u.subscriptionStatus }
              : u
          ));
        }
      }
    } finally {
      setActionLoading(false);
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

  const active = users.filter(u => u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing").length;
  const proCount = users.filter(u => (u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing") && (u as any).subscriptionTier !== "premium").length;
  const premiumCount = users.filter(u => (u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing") && (u as any).subscriptionTier === "premium").length;

  const filteredUsers = users.filter(u => {
    if (filter === "pro") return (u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing") && (u as any).subscriptionTier !== "premium";
    if (filter === "premium") return (u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing") && (u as any).subscriptionTier === "premium";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/dashboard">
                <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-8 w-auto" />
              </Link>
              <span className="text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded">ADMIN</span>
            </div>
            <p className="text-gray-500 text-sm">Subscriber management dashboard</p>
          </div>
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            ← Dashboard
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Users", value: users.length },
            { label: "Active Subs", value: active },
            { label: "MRR", value: stats?.mrr != null ? `$${stats.mrr.toFixed(0)}` : "—" },
            { label: "Total Revenue", value: stats?.totalRevenue != null ? `$${stats.totalRevenue.toFixed(0)}` : "—" },
          ].map(s => (
            <div key={s.label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">{s.label}</div>
              <div className="text-2xl font-bold text-white tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Manual Access Control */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="font-semibold text-white mb-4">Manual Access Control</h2>
          <div className="flex gap-3 flex-wrap">
            <input
              type="email"
              value={actionEmail}
              onChange={e => setActionEmail(e.target.value)}
              placeholder="user@example.com"
              className="flex-1 min-w-[200px] bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-green-600"
            />
            <button
              onClick={() => doAction("grant", actionEmail)}
              disabled={!actionEmail || actionLoading}
              className="px-4 py-2 bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Grant Access
            </button>
            <button
              onClick={() => doAction("revoke", actionEmail)}
              disabled={!actionEmail || actionLoading}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Revoke Access
            </button>
            <button
              onClick={() => doAction("make-admin", actionEmail)}
              disabled={!actionEmail || actionLoading}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Make Admin
            </button>
          </div>
          {actionMsg && (
            <p className="text-sm text-green-400 mt-3">{actionMsg}</p>
          )}
        </div>

        {/* User List */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3 flex-wrap">
            {([
              { key: "all", label: "All Users", count: users.length },
              { key: "pro", label: "Pro Users", count: proCount },
              { key: "premium", label: "Premium Users", count: premiumCount },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  filter === f.key
                    ? "bg-green-500/15 border-green-500/40 text-green-400"
                    : "bg-gray-800/60 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600"
                }`}
              >
                {f.label}
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  filter === f.key ? "bg-green-500/20 text-green-300" : "bg-gray-700 text-gray-400"
                }`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-600 text-sm">No users in this category</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-600 border-b border-gray-800">
                    <th className="px-4 py-3">Name / Email</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 hidden md:table-cell">Joined</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Stripe ID</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user.email} className="border-b border-gray-800/60 hover:bg-gray-800/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-200">{user.name}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusBadge(user.subscriptionStatus)}`}>
                          {user.subscriptionStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 font-mono hidden lg:table-cell">
                        {user.stripeCustomerId?.slice(0, 14) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {user.subscriptionStatus !== "active" ? (
                            <button
                              onClick={() => doAction("grant", user.email)}
                              disabled={actionLoading}
                              className="text-xs px-2 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded transition-colors"
                            >
                              Grant
                            </button>
                          ) : (
                            <button
                              onClick={() => doAction("revoke", user.email)}
                              disabled={actionLoading}
                              className="text-xs px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded transition-colors"
                            >
                              Revoke
                            </button>
                          )}
                          <button
                            onClick={() => doAction("delete", user.email)}
                            disabled={actionLoading}
                            className="text-xs px-2 py-1 bg-red-900/30 hover:bg-red-900/60 text-red-500 border border-red-900/40 rounded transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
