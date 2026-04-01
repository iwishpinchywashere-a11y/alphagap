"use client";

import { useDashboard } from "./DashboardProvider";
import SocialLinks from "./SocialLinks";

export default function DashboardFooter() {
  const { leaderboard } = useDashboard();
  return (
    <footer className="border-t border-gray-800 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
      <div className="flex items-center gap-4">
        <span>AlphaGap v0.3 — Bittensor Subnet Intelligence</span>
        {leaderboard.length > 0 && <span>{leaderboard.length} subnets tracked</span>}
      </div>
      <SocialLinks />
    </footer>
  );
}
