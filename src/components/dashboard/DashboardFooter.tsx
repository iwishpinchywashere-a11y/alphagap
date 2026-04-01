"use client";

import { useDashboard } from "./DashboardProvider";

export default function DashboardFooter() {
  const { leaderboard } = useDashboard();
  return (
    <footer className="border-t border-gray-800 px-6 py-3 flex items-center justify-between text-xs text-gray-600">
      <span>AlphaGap v0.3 — Bittensor Subnet Intelligence</span>
      <div className="flex items-center gap-4">
        <span>Sources: TaoStats · GitHub · HuggingFace · Desearch · Discord</span>
        {leaderboard.length > 0 && <span>{leaderboard.length} subnets tracked</span>}
      </div>
    </footer>
  );
}
