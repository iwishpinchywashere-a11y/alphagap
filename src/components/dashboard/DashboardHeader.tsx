"use client";

import { useDashboard } from "./DashboardProvider";

export default function DashboardHeader() {
  const { taoPrice, lastScan, scanResult, scanError, scanning } = useDashboard();

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
          <span className="text-xs text-green-400 animate-pulse">Refreshing…</span>
        )}
      </div>
    </header>
  );
}
