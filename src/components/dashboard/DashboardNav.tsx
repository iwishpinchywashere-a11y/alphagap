"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard } from "./DashboardProvider";

export default function DashboardNav() {
  const pathname = usePathname();
  const { signals, setSelectedSubnet } = useDashboard();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { href: "/dashboard", label: "Alpha Leaderboard" },
    { href: "/feed", label: "The Feed" },
    { href: "/powerrankings", label: "Power Rankings" },
    { href: "/alphagapindex", label: "AlphaGap Index" },
    { href: "/oracle", label: "Oracle" },
    { href: "/alerts", label: "Alerts" },
    { href: "/wallettracker", label: "Wallet Tracker" },
    { href: "/conviction", label: "Conviction" },
    { href: "/signals", label: "Dev Signals" },
    { href: "/flow", label: "Flow" },
    { href: "/social", label: "Social" },
    { href: "/audits", label: "Audit" },
    { href: "/benchmarks", label: "Benchmarks" },
    { href: "/reports", label: "Reports" },
    { href: "/analytics", label: "Analytics" },
    { href: "/performance", label: "Performance" },
    { href: "/taopages", label: "TAO Pages" },
    { href: "/watchlist", label: "My Watchlist" },
  ];

  const activeTab = tabs.find(t => t.href === pathname) ?? tabs[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={menuRef} className="relative border-b border-white/[0.06] bg-[#07090b]/60">
      {/* Trigger bar */}
      <button
        data-tour="nav-trigger"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
      >
        {/* Hamburger icon */}
        <div className="flex flex-col gap-[4px] flex-shrink-0">
          <span className={`block h-[2px] w-4 rounded-full transition-colors ${open ? "bg-emerald-400" : "bg-gray-500"}`} />
          <span className={`block h-[2px] w-4 rounded-full transition-colors ${open ? "bg-emerald-400" : "bg-gray-500"}`} />
          <span className={`block h-[2px] w-4 rounded-full transition-colors ${open ? "bg-emerald-400" : "bg-gray-500"}`} />
        </div>

        {/* Current page name — active pill */}
        <span className="ag-pill-tabs flex-1 max-w-full">
          <span className="ag-pill-tab ag-pill-tab-on inline-flex items-center">{activeTab.label}</span>
        </span>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded menu */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 bg-[#07090b]/95 backdrop-blur-xl border-b border-white/[0.08] shadow-2xl">
          {tabs.map((tab, i) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => { setSelectedSubnet(null); setOpen(false); }}
                className={`flex items-center justify-between px-4 py-3 text-sm transition-colors border-b border-white/[0.05] ${
                  tab.href === "/watchlist" ? "font-bold" : tab.href === "/oracle" || tab.href === "/alphagapindex" ? "font-semibold" : tab.href === "/alerts" ? "font-semibold" : "font-normal"
                } ${
                  isActive
                    ? tab.href === "/watchlist" ? "text-blue-400 bg-blue-500/5"
                      : tab.href === "/oracle" || tab.href === "/alphagapindex" ? "text-emerald-400 bg-emerald-500/5"
                      : tab.href === "/alerts" ? "text-red-400 bg-red-500/5"
                      : "text-emerald-400 bg-emerald-500/5"
                    : tab.href === "/watchlist" ? "text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                      : tab.href === "/oracle" || tab.href === "/alphagapindex" ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                      : tab.href === "/alerts" ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                } ${i === tabs.length - 1 ? "border-b-0" : ""}`}
              >
                <span>{tab.label}</span>
                {isActive && (
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tab.href === "/watchlist" ? "bg-blue-400" : tab.href === "/alerts" ? "bg-red-400" : "bg-emerald-400"}`} />


                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
