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
    { href: "/powerrankings", label: "Power Rankings" },
    { href: "/watchlist", label: "My Watchlist" },
    { href: "/signals", label: `Signals${signals.length > 0 ? ` (${signals.length})` : ""}` },
    { href: "/reports", label: "Reports" },
    { href: "/whales", label: "Whales" },
    { href: "/social", label: "Social" },
    { href: "/analytics", label: "Analytics" },
    { href: "/benchmarks", label: "Benchmarks" },
    { href: "/performance", label: "Performance" },
    { href: "/audits", label: "Audits (Beta)" },
    { href: "/testing", label: "Pump Lab" },
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
    <div ref={menuRef} className="relative border-b border-gray-800">
      {/* Trigger bar */}
      <button
        data-tour="nav-trigger"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 w-full px-4 py-3 text-left hover:bg-gray-900/40 transition-colors"
      >
        {/* Hamburger icon */}
        <div className="flex flex-col gap-[4px] flex-shrink-0">
          <span className={`block h-[2px] w-4 rounded-full transition-colors ${open ? "bg-green-400" : "bg-gray-500"}`} />
          <span className={`block h-[2px] w-4 rounded-full transition-colors ${open ? "bg-green-400" : "bg-gray-500"}`} />
          <span className={`block h-[2px] w-4 rounded-full transition-colors ${open ? "bg-green-400" : "bg-gray-500"}`} />
        </div>

        {/* Current page name */}
        <span className="text-sm font-medium text-green-400 flex-1">{activeTab.label}</span>

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
        <div className="absolute top-full left-0 right-0 z-50 bg-[#0a0a0f] border-b border-gray-800 shadow-xl">
          {tabs.map((tab, i) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => { setSelectedSubnet(null); setOpen(false); }}
                className={`flex items-center justify-between px-4 py-3 text-sm transition-colors border-b border-gray-800/50 ${
                  isActive
                    ? "text-green-400 bg-green-500/5"
                    : "text-gray-400 hover:text-white hover:bg-gray-900/60"
                } ${i === tabs.length - 1 ? "border-b-0" : ""}`}
              >
                <span>{tab.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
