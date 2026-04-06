"use client";

import { useRef, useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useDashboard } from "./DashboardProvider";

export default function DashboardHeader() {
  const { taoPrice, lastScan, scanResult, scanError, scanning } = useDashboard();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  const subStatus: string = user?.subscriptionStatus ?? "none";
  const isAdmin: boolean = user?.isAdmin ?? false;
  const isActive = subStatus === "active" || subStatus === "trialing";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : null;

  return (
    <header className="border-b border-gray-800 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between flex-wrap gap-2 max-w-full overflow-hidden">
      <div className="flex items-center gap-4">
        <a href="/dashboard">
          <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-12 w-auto" />
        </a>
        <span className="text-xs text-gray-500 border border-gray-700 rounded px-2 py-0.5 hidden sm:inline">
          Bittensor Subnet Intelligence
        </span>
        {taoPrice != null && (
          <span className="text-xs text-gray-400">TAO ${taoPrice.toFixed(2)}</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {lastScan && (
          <span className="text-xs text-gray-500 hidden sm:inline">Last scan: {lastScan}</span>
        )}
        {scanResult && (
          <span className="text-xs text-green-400 hidden sm:inline">{scanResult}</span>
        )}
        {scanError && (
          <span className="text-xs text-red-400 max-w-xs truncate hidden sm:inline" title={scanError}>
            Error: {scanError.slice(0, 60)}
          </span>
        )}
        {scanning && (
          <span className="text-xs text-green-400 animate-pulse hidden sm:inline">Refreshing…</span>
        )}

        {/* User avatar button */}
        <div className="relative flex-shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-800 border border-gray-700 hover:border-green-500/50 transition-colors"
            title={session ? (session.user?.name ?? "Account") : "Sign in"}
          >
            {initials ? (
              <span className="text-xs font-bold text-green-400">{initials}</span>
            ) : (
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              {session ? (
                <>
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
                        {initials ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{session.user?.name}</div>
                        <div className="text-xs text-gray-500 truncate">{session.user?.email}</div>
                      </div>
                    </div>
                    <div className="mt-2.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        isActive
                          ? "text-green-400 bg-green-500/10 border-green-500/30"
                          : "text-gray-500 bg-gray-800 border-gray-700"
                      }`}>
                        {isActive ? "✓ Pro Subscriber" : "No subscription"}
                      </span>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <Link
                      href="/account"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Account Settings
                    </Link>
                    {!isActive && (
                      <Link
                        href="/subscribe"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-green-400 hover:bg-gray-800 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Upgrade to Pro
                      </Link>
                    )}
                    {isActive && (
                      <button
                        onClick={async () => {
                          setOpen(false);
                          const res = await fetch("/api/stripe/portal", { method: "POST" });
                          const d = await res.json();
                          if (d.url) window.location.href = d.url;
                        }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors text-left"
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        Manage Billing
                      </button>
                    )}
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-gray-800 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Admin Panel
                      </Link>
                    )}
                  </div>

                  {/* Sign out */}
                  <div className="border-t border-gray-800 py-1">
                    <button
                      onClick={() => { setOpen(false); signOut({ callbackUrl: "/" }); }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors text-left"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-1">
                  <Link
                    href="/auth/signin"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-green-400 hover:bg-gray-800 transition-colors"
                  >
                    Create Account
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
