/**
 * GET /api/cron/whale-tracker
 *
 * Triggered fire-and-forget from /api/scan after each successful scan.
 * Reads scan-latest.json, compares whale signals to stored state,
 * opens/closes signal entries, and fills 7d/14d/30d price milestones.
 * Persists updated state to whale-tracker.json.
 */

import { NextRequest, NextResponse } from "next/server";
import { get as blobGet, put as blobPut } from "@vercel/blob";
import type { WhaleSignalEntry, WhaleTrackerState } from "@/lib/whale-tracker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN || "";

function authOk(req: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return true;
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.headers.get("x-vercel-cron") === "1"
  );
}

// ── Blob helpers ──────────────────────────────────────────────────

async function readBlob<T>(name: string): Promise<T | null> {
  try {
    const b = await blobGet(name, { token: TOKEN(), access: "private" });
    if (!b?.stream) return null;
    const reader = b.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch {
    return null;
  }
}

async function writeBlob(name: string, data: unknown): Promise<void> {
  await blobPut(name, JSON.stringify(data), {
    access: "private",
    token: TOKEN(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

// ── Types ─────────────────────────────────────────────────────────

interface LeaderboardEntry {
  netuid: number;
  name?: string;
  subnet_name?: string;
  alpha_price?: number | null;
  whale_signal?: "accumulating" | "distributing" | null;
}

interface ScanLatest {
  leaderboard: LeaderboardEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function msAgo(isoStr: string): number {
  return Date.now() - new Date(isoStr).getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Main handler ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [scan, state] = await Promise.all([
    readBlob<ScanLatest>("scan-latest.json"),
    readBlob<WhaleTrackerState>("whale-tracker.json"),
  ]);

  if (!scan?.leaderboard?.length) {
    return NextResponse.json({ ok: true, skipped: "no scan data" });
  }

  const now = new Date().toISOString();
  const entries: WhaleSignalEntry[] = state?.entries ?? [];
  const currentSignals: Record<number, "accumulating" | "distributing" | null> =
    state?.currentSignals ?? {};

  let newEntries = 0;
  let closedEntries = 0;
  let updatedMilestones = 0;

  // Build a map of leaderboard by netuid for fast lookup
  const lbMap = new Map<number, LeaderboardEntry>();
  for (const sub of scan.leaderboard) {
    lbMap.set(sub.netuid, sub);
  }

  // ── Process each subnet in the current scan ───────────────────

  for (const sub of scan.leaderboard) {
    const { netuid } = sub;
    const subnetName = sub.subnet_name ?? sub.name ?? `SN${netuid}`;
    const currentSignal = sub.whale_signal ?? null;
    const prevSignal = currentSignals[netuid] ?? null;
    const currentPrice = sub.alpha_price ?? 0;

    const hasChanged = currentSignal !== prevSignal;

    if (hasChanged) {
      // Close any existing active entry for this subnet
      const activeIdx = entries.findIndex(
        (e) => e.netuid === netuid && e.status === "active"
      );
      if (activeIdx !== -1) {
        entries[activeIdx].status = "closed";
        entries[activeIdx].exitAt = now;
        entries[activeIdx].exitPrice = currentPrice;
        closedEntries++;
      }

      // Open a new entry if there's a new signal
      if (currentSignal !== null) {
        entries.push({
          id: uuid(),
          netuid,
          subnetName,
          signal: currentSignal,
          entryPrice: currentPrice,
          entryAt: now,
          status: "active",
        });
        newEntries++;
      }

      // Update tracked signal
      currentSignals[netuid] = currentSignal;
    }
  }

  // ── Subnets that were tracked but are no longer in the scan ──

  for (const netuidStr of Object.keys(currentSignals)) {
    const netuid = Number(netuidStr);
    if (!lbMap.has(netuid) && currentSignals[netuid] !== null) {
      // Signal gone — close any active entry
      const activeIdx = entries.findIndex(
        (e) => e.netuid === netuid && e.status === "active"
      );
      if (activeIdx !== -1) {
        entries[activeIdx].status = "closed";
        entries[activeIdx].exitAt = now;
        entries[activeIdx].exitPrice = 0;
        closedEntries++;
      }
      currentSignals[netuid] = null;
    }
  }

  // ── Fill 7d / 14d / 30d milestones for ALL active entries ────

  for (const entry of entries) {
    if (entry.status !== "active") continue;
    const sub = lbMap.get(entry.netuid);
    if (!sub) continue;
    const currentPrice = sub.alpha_price ?? 0;
    if (!currentPrice) continue;

    const ageMs = msAgo(entry.entryAt);

    if (ageMs >= 7 * DAY_MS && entry.priceAt7d === undefined) {
      entry.priceAt7d = currentPrice;
      updatedMilestones++;
    }
    if (ageMs >= 14 * DAY_MS && entry.priceAt14d === undefined) {
      entry.priceAt14d = currentPrice;
      updatedMilestones++;
    }
    if (ageMs >= 30 * DAY_MS && entry.priceAt30d === undefined) {
      entry.priceAt30d = currentPrice;
      updatedMilestones++;
    }
  }

  // ── Cap at 500 entries (drop oldest closed ones) ─────────────

  const MAX_ENTRIES = 500;
  if (entries.length > MAX_ENTRIES) {
    // Sort: active first, then by entryAt desc; drop excess from the tail
    entries.sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return new Date(b.entryAt).getTime() - new Date(a.entryAt).getTime();
    });
    entries.splice(MAX_ENTRIES);
  }

  const newState: WhaleTrackerState = {
    entries,
    currentSignals,
    lastUpdatedAt: now,
  };

  await writeBlob("whale-tracker.json", newState);

  console.log(
    `[whale-tracker] new=${newEntries} closed=${closedEntries} milestones=${updatedMilestones} total=${entries.length}`
  );

  return NextResponse.json({ ok: true, newEntries, closedEntries, updatedMilestones });
}
