"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard } from "./DashboardProvider";

export default function DashboardNav() {
  const pathname = usePathname();
  const { signals, setSelectedSubnet } = useDashboard();

  const tabs = [
    { href: "/dashboard", label: "Alpha Leaderboard" },
    { href: "/signals", label: `Signals${signals.length > 0 ? ` (${signals.length})` : ""}` },
    { href: "/reports", label: "Reports" },
    { href: "/analytics", label: "Analytics" },
    { href: "/performance", label: "Performance" },
  ];

  return (
    <nav className="border-b border-gray-800 px-6 flex gap-1">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            onClick={() => setSelectedSubnet(null)}
            className={`px-4 py-3 text-sm transition-colors border-b-2 ${
              isActive
                ? "border-green-400 text-green-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
