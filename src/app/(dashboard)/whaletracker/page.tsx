"use client";

import React, { useEffect, useState } from "react";
import type { WhaleSignalEntry } from "@/lib/whale-tracker";

interface Stats {
  totalSignals: number;
  activeSignals: number;
  winRate14d: number;
  avgReturn14d: number;
  totalClosed: number;
}

interface ApiResponse {
  entries: WhaleSignalEntry[];
  stats: Stats;
}

function pct(price: number | undefined, entryPrice: number): string | null {
  if (price === undefined || entryPrice === 0) return null;
  const change = ((price - entryPrice) / entryPrice) * 100;
  return (change >= 0 ? "+" : "") + change.toFixed(1) + "%";
}

function pctClass(price: number | undefined, entryPrice: number): string {
  if (price === undefined || entryPrice === 0) return "text-gray-500";
  return price >= entryPrice ? "text-emerald-400" : "text-red-400";
}

function daysActive(entryAt: string): number {
  return Math.floor((Date.now() - new Date(entryAt).getTime()) / (24 * 60 * 60 * 1000));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPrice(p: number): string {
  if (p === 0) return "—";
  if (p < 0.01) return "$" + p.toFixed(6);
  if (p < 1) return "$" + p.toFixed(4);
  return "$" + p.toFixed(3);
}

function StatCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-1">
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${valueClass ?? "text-white"}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-600">{sub}</div>}
    </div>
  );
}

function SignalBadge({ signal }: { signal: "accumulating" | "distributing" }) {
  return signal === "accumulating" ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
      🐋 Accumulating
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/25">
      🔴 Distributing
    </span>
  );
}

export default function WhaleTrackerPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/whale-tracker")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: ApiResponse) => setData(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const activeEntries =
    data?.entries.filter((e) => e.status === "active") ?? [];
  const closedEntries =
    data?.entries.filter((e) => e.status === "closed") ?? [];

  // Sort active by most recently opened
  activeEntries.sort(
    (a, b) => new Date(b.entryAt).getTime() - new Date(a.entryAt).getTime()
  );
  // Sort closed by most recently closed
  closedEntries.sort(
    (a, b) =>
      new Date(b.exitAt ?? b.entryAt).getTime() -
      new Date(a.exitAt ?? a.entryAt).getTime()
  );

  const collectionStartDate =
    data?.entries.length
      ? formatDate(
          data.entries.reduce((earliest, e) =>
            e.entryAt < earliest.entryAt ? e : earliest
          ).entryAt
        )
      : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          🐋 Whale Signal Tracker
        </h1>
        <p className="mt-1 text-gray-400 text-sm">
          Back-testing whale entry signals across Bittensor subnets
        </p>
      </div>

      {loading && (
        <div className="text-gray-500 text-sm animate-pulse">Loading whale signal data…</div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 rounded-lg p-4 text-sm">
          Failed to load data: {error}
        </div>
      )}

      {!loading && !error && data && data.entries.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <div className="text-4xl mb-3">🐋</div>
          <div className="text-lg font-semibold text-gray-300 mb-2">
            Tracking started — whale signal history will build up over time.
          </div>
          <div className="text-sm text-gray-500">
            Check back in a few days once signals have been detected and recorded.
          </div>
        </div>
      )}

      {!loading && !error && data && data.entries.length > 0 && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Total Signals"
              value={String(data.stats.totalSignals)}
            />
            <StatCard
              label="Active"
              value={String(data.stats.activeSignals)}
              valueClass="text-cyan-400"
            />
            <StatCard
              label="14d Win Rate"
              value={
                data.stats.totalClosed > 0
                  ? data.stats.winRate14d.toFixed(1) + "%"
                  : "—"
              }
              sub="accumulating signals +10%"
              valueClass={
                data.stats.winRate14d >= 50 ? "text-emerald-400" : "text-red-400"
              }
            />
            <StatCard
              label="Avg 14d Return"
              value={
                data.stats.totalClosed > 0
                  ? (data.stats.avgReturn14d >= 0 ? "+" : "") +
                    data.stats.avgReturn14d.toFixed(1) +
                    "%"
                  : "—"
              }
              sub="accumulating signals"
              valueClass={
                data.stats.avgReturn14d >= 0 ? "text-emerald-400" : "text-red-400"
              }
            />
          </div>

          {/* Active Signals */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-3 text-gray-200">
              Active Signals
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({activeEntries.length})
              </span>
            </h2>

            {activeEntries.length === 0 ? (
              <div className="text-sm text-gray-600 italic">
                No active whale signals right now.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="text-left py-2 pr-4">Subnet</th>
                      <th className="text-left py-2 pr-4">Signal</th>
                      <th className="text-right py-2 pr-4">Entry Price</th>
                      <th className="text-right py-2 pr-4">Entry Date</th>
                      <th className="text-right py-2 pr-4">Days Active</th>
                      <th className="text-right py-2">Current P&amp;L %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEntries.map((e) => {
                      const days = daysActive(e.entryAt);
                      // Active entries don't have a "current price" stored —
                      // we show the most recent milestone as a proxy if available,
                      // otherwise blank
                      const latestPrice =
                        e.priceAt7d ?? e.priceAt14d ?? e.priceAt30d;
                      const plStr = pct(latestPrice, e.entryPrice);
                      const plClass = pctClass(latestPrice, e.entryPrice);
                      return (
                        <tr
                          key={e.id}
                          className="border-b border-gray-900 hover:bg-gray-900/50 transition-colors"
                        >
                          <td className="py-3 pr-4 font-medium">
                            <span className="text-white">{e.subnetName}</span>
                            <span className="ml-2 text-xs text-gray-600">
                              SN{e.netuid}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <SignalBadge signal={e.signal} />
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums text-gray-300">
                            {formatPrice(e.entryPrice)}
                          </td>
                          <td className="py-3 pr-4 text-right text-gray-400">
                            {formatDate(e.entryAt)}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums text-gray-400">
                            {days}d
                          </td>
                          <td className={`py-3 text-right tabular-nums font-medium ${plClass}`}>
                            {plStr ?? (
                              <span className="text-gray-700 font-normal text-xs">
                                &lt;7d
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Signal History */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-3 text-gray-200">
              Signal History
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({closedEntries.length})
              </span>
            </h2>

            {closedEntries.length === 0 ? (
              <div className="text-sm text-gray-600 italic">
                No closed signals yet — history accumulates over time.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="text-left py-2 pr-4">Subnet</th>
                      <th className="text-left py-2 pr-4">Signal</th>
                      <th className="text-right py-2 pr-4">Entry Price</th>
                      <th className="text-right py-2 pr-4">7d</th>
                      <th className="text-right py-2 pr-4">14d</th>
                      <th className="text-right py-2 pr-4">30d</th>
                      <th className="text-right py-2">Status / Exit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedEntries.map((e) => {
                      return (
                        <tr
                          key={e.id}
                          className="border-b border-gray-900 hover:bg-gray-900/50 transition-colors"
                        >
                          <td className="py-3 pr-4">
                            <span className="font-medium text-white">
                              {e.subnetName}
                            </span>
                            <span className="ml-2 text-xs text-gray-600">
                              SN{e.netuid}
                            </span>
                            <div className="text-xs text-gray-600 mt-0.5">
                              {formatDate(e.entryAt)}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <SignalBadge signal={e.signal} />
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums text-gray-300">
                            {formatPrice(e.entryPrice)}
                          </td>
                          <td className={`py-3 pr-4 text-right tabular-nums font-medium ${pctClass(e.priceAt7d, e.entryPrice)}`}>
                            {pct(e.priceAt7d, e.entryPrice) ?? (
                              <span className="text-gray-700 font-normal">—</span>
                            )}
                          </td>
                          <td className={`py-3 pr-4 text-right tabular-nums font-medium ${pctClass(e.priceAt14d, e.entryPrice)}`}>
                            {pct(e.priceAt14d, e.entryPrice) ?? (
                              <span className="text-gray-700 font-normal">—</span>
                            )}
                          </td>
                          <td className={`py-3 pr-4 text-right tabular-nums font-medium ${pctClass(e.priceAt30d, e.entryPrice)}`}>
                            {pct(e.priceAt30d, e.entryPrice) ?? (
                              <span className="text-gray-700 font-normal">—</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <div className="text-xs text-gray-500">
                              Closed {e.exitAt ? formatDate(e.exitAt) : "—"}
                            </div>
                            {e.exitPrice !== undefined && e.exitPrice > 0 && (
                              <div className={`text-xs font-medium tabular-nums ${pctClass(e.exitPrice, e.entryPrice)}`}>
                                Exit: {formatPrice(e.exitPrice)}{" "}
                                <span>
                                  ({pct(e.exitPrice, e.entryPrice)})
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Disclaimer */}
          <div className="text-xs text-gray-700 border-t border-gray-900 pt-4">
            {collectionStartDate && (
              <>Data collection started {collectionStartDate}. </>
            )}
            Win rates require 30+ signals to be statistically meaningful.
          </div>
        </>
      )}
    </div>
  );
}
