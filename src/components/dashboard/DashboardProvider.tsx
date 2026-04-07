"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Signal, SubnetScore } from "@/lib/types";

interface DashboardContextValue {
  signals: Signal[];
  setSignals: React.Dispatch<React.SetStateAction<Signal[]>>;
  leaderboard: SubnetScore[];
  taoPrice: number | null;
  scanning: boolean;
  scanStep: string | null;
  lastScan: string | null;
  scanResult: string | null;
  scanError: string | null;
  selectedSubnet: number | null;
  setSelectedSubnet: (id: number | null) => void;
  infoPopup: string | null;
  setInfoPopup: (key: string | null) => void;
  runScan: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside DashboardProvider");
  return ctx;
}

export default function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [leaderboard, setLeaderboard] = useState<SubnetScore[]>([]);
  const [taoPrice, setTaoPrice] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedSubnet, setSelectedSubnet] = useState<number | null>(null);
  const [infoPopup, setInfoPopup] = useState<string | null>(null);

  const hasAutoScanned = useRef(false);
  const analyzingRef = useRef(new Set<number>());

  const loadData = useCallback((data: Record<string, unknown>) => {
    setLeaderboard((data.leaderboard as SubnetScore[]) || []);
    setSignals((data.signals as Signal[]) || []);
    setTaoPrice((data.taoPrice as number) || null);
    const lastScanTime = data.lastScan
      ? new Date(data.lastScan as string).toLocaleTimeString()
      : new Date().toLocaleTimeString();
    setLastScan(lastScanTime);
    const duration = data.duration_ms ? `${((data.duration_ms as number) / 1000).toFixed(1)}s` : "";
    const counts = (data.counts || {}) as Record<string, number>;
    const cached = data.cached ? " (cached)" : "";
    setScanResult(
      `${counts.subnets || 0} subnets, ${counts.signals || 0} signals${duration ? ` in ${duration}` : ""}${cached}`
    );
  }, []);

  const runScan = useCallback(async () => {
    setScanning(true);
    setScanResult(null);
    setScanError(null);
    setScanStep("Scanning all sources...");
    try {
      const res = await fetch("/api/scan");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Scan failed (${res.status}): ${text}`);
      }
      const data = await res.json();
      loadData(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setScanError(msg);
    } finally {
      setScanning(false);
      setScanStep(null);
    }
  }, [loadData]);

  // Current schema version — must match SCAN_SCHEMA_VERSION in scan/route.ts.
  // If the cached blob has an older version, force a background rescan immediately
  // so the dashboard never shows stale-format data to the user.
  const CURRENT_SCHEMA_VERSION = 18;

  // On first mount: load cache instantly, then refresh in background if stale or wrong schema
  useEffect(() => {
    if (hasAutoScanned.current) return;
    hasAutoScanned.current = true;

    fetch("/api/cached-scan")
      .then((res) => {
        if (!res.ok) throw new Error("no cache");
        return res.json();
      })
      .then((data) => {
        loadData(data);
        const age = data.lastScan ? Date.now() - new Date(data.lastScan).getTime() : Infinity;
        const schemaStale = (data.schema_version ?? 0) < CURRENT_SCHEMA_VERSION;
        // Rescan if: data is >15 min old OR schema version is behind
        if (age > 15 * 60 * 1000 || schemaStale) runScan();
      })
      .catch(() => runScan());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData, runScan]);

  // Close info popup on any click outside
  useEffect(() => {
    if (!infoPopup) return;
    const handler = () => setInfoPopup(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [infoPopup]);

  // Auto-analyze signals that don't have AI analysis yet
  useEffect(() => {
    if (signals.length === 0 || scanning) return;
    const unanalyzed = signals.filter(
      (s) =>
        !s.analysis &&
        !(s.description || "").includes("🔧") &&
        (s.signal_type === "dev_spike" || s.signal_type === "hf_update") &&
        !analyzingRef.current.has(s.id)
    );
    if (unanalyzed.length === 0) return;

    const batch = unanalyzed.slice(0, 10);
    batch.forEach((sig) => analyzingRef.current.add(sig.id));

    const analyzeSignal = async (sig: Signal) => {
      const subnetData = leaderboard.find((s) => s.netuid === sig.netuid);
      try {
        const res = await fetch("/api/analyze-signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: sig.title,
            description: sig.description,
            subnet_name: sig.subnet_name,
            netuid: sig.netuid,
            source_url: sig.source_url,
            composite_score: subnetData?.composite_score,
            alpha_price: subnetData?.alpha_price,
            price_change_24h: subnetData?.price_change_24h,
            market_cap: subnetData?.market_cap,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.analysis) {
            setSignals((prev) =>
              prev.map((s) => (s.id === sig.id ? { ...s, description: data.analysis, analysis: data.analysis } : s))
            );
          }
        }
      } catch {
        // silently fail
      }
    };

    batch.forEach((sig, i) => setTimeout(() => analyzeSignal(sig), i * 500));
  }, [signals, leaderboard, scanning]);

  return (
    <DashboardContext.Provider
      value={{
        signals,
        setSignals,
        leaderboard,
        taoPrice,
        scanning,
        scanStep,
        lastScan,
        scanResult,
        scanError,
        selectedSubnet,
        setSelectedSubnet,
        infoPopup,
        setInfoPopup,
        runScan,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
