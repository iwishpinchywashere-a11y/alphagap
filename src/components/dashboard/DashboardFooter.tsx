"use client";

import { useDashboard } from "./DashboardProvider";
import SocialLinks from "./SocialLinks";

export default function DashboardFooter() {
  const { leaderboard } = useDashboard();
  return (
    <footer className="border-t border-gray-800 px-6 py-4 text-xs text-gray-600">
      {/* Disclaimer */}
      <div className="mb-3 text-xs text-gray-300 leading-relaxed max-w-4xl">
        <span className="text-white font-medium">Disclaimer:</span> AlphaGap and the aGap scoring system are provided for informational and educational purposes only. Nothing on this platform constitutes financial advice, investment advice, or a recommendation to buy or sell any asset. aGap scores reflect proprietary algorithmic analysis of on-chain and off-chain data — a high score does not guarantee or predict future price appreciation. Cryptocurrency investments involve substantial risk, including the possible loss of principal. Always conduct your own research and consult a qualified financial advisor before making investment decisions. Past performance is not indicative of future results.{" "}
        <a href="/terms" className="text-green-400 hover:text-green-300 underline underline-offset-2 transition-colors whitespace-nowrap">Terms &amp; Privacy Policy</a>
      </div>
      {/* Bottom row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span>AlphaGap v0.3 — Bittensor Subnet Intelligence</span>
          {leaderboard.length > 0 && <span>{leaderboard.length} subnets tracked</span>}
        </div>
        <SocialLinks />
      </div>
    </footer>
  );
}
