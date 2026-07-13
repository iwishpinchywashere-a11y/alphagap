"use client";

import { useEffect, useState } from "react";
import { useDashboard } from "./DashboardProvider";

const STALE_AFTER_MS = 60 * 60 * 1000; // 1h — scan cron runs every 10 min

/**
 * Site-wide banner shown when the scan data powering prices/scores is old,
 * so users never mistake frozen numbers for live ones.
 */
export default function StaleDataBanner() {
  const { lastScanAt } = useDashboard();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!lastScanAt) return null;
  const ageMs = now - new Date(lastScanAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < STALE_AFTER_MS) return null;

  const hours = Math.floor(ageMs / 3600_000);
  const ageLabel = hours >= 48 ? `${Math.floor(hours / 24)} days` : hours >= 1 ? `${hours}h` : `${Math.floor(ageMs / 60000)}m`;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/25 px-4 py-2 text-center">
      <p className="text-amber-400 text-xs font-medium">
        {`⚠️ Data was last refreshed ${ageLabel} ago — prices and scores may not reflect current market conditions. We're working on restoring live updates.`}
      </p>
    </div>
  );
}
