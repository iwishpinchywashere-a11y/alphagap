/**
 * GET /api/cron/flow-snapshot
 *
 * Triggered fire-and-forget from /api/scan after each successful scan.
 * Reads scan-latest.json, derives whale / volume / yield flow events,
 * merges them into flow-events.json with a 48-hour rolling window, then
 * saves the result.
 *
 * Dedup key: netuid:type:dayKey  (e.g. "12:accumulating:2026-04-30")
 * Today's freshly-computed events always override stale same-day entries.
 */

import { NextRequest, NextResponse } from "next/server";
import { get as blobGet, put as blobPut } from "@vercel/blob";

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
  whale_signal?: "accumulating" | "distributing" | null;
  whale_ratio?: number | null;
  net_flow_24h?: number | null;
  volume_surge?: boolean;
  volume_surge_ratio?: number | null;
  alpha_price?: number | null;
  price_change_24h?: number | null;
  apy_1h?: number | null;
  apy_7d?: number | null;
  apy_30d?: number | null;
}

interface ScanLatest {
  leaderboard: LeaderboardEntry[];
  taoPrice?: number | null;
}

export interface PersistedFlowEvent {
  netuid: number;
  name: string;
  type:
    | "accumulating"
    | "distributing"
    | "volume_surge"
    | "yield_spike"
    | "yield_dip";
  strength: number;
  headline: string;
  detail: string;
  badge: string;
  badgeColor: string;
  netFlow?: number;
  whaleRatio?: number;
  volumeRatio?: number;
  price?: number;
  change24h?: number;
  apy_7d?: number;
  apy_1h?: number;
  apy_30d?: number;
  /** "2026-04-30" — used for dedup & 48h pruning */
  dayKey: string;
  /** ISO timestamp of when this event was first detected / last refreshed */
  detectedAt: string;
}

interface FlowEventsStore {
  events: PersistedFlowEvent[];
  updatedAt: string;
}

// ── Thresholds (mirror flow/page.tsx) ────────────────────────────

const YIELD_SPIKE_THRESHOLD = 1.25;
const YIELD_DIP_THRESHOLD   = 0.75;
const MIN_30D_APY           = 0.10;

// ── Number formatter ──────────────────────────────────────────────

function fmt(n: number, dec = 0): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(dec);
}

// ── Event builder ─────────────────────────────────────────────────

function buildEvents(
  leaderboard: LeaderboardEntry[],
  taoPrice: number | null,
  dayKey: string,
  detectedAt: string
): PersistedFlowEvent[] {
  const out: PersistedFlowEvent[] = [];

  for (const sub of leaderboard) {
    const name = sub.name ?? `SN${sub.netuid}`;

    // ── Whale accumulation ─────────────────────────────────────
    if (sub.whale_signal === "accumulating" && sub.whale_ratio != null) {
      const flowUsd =
        sub.net_flow_24h != null && taoPrice != null
          ? sub.net_flow_24h * taoPrice
          : null;
      const strength = Math.round(
        Math.min(95, 50 + (sub.whale_ratio - 2) * 15)
      );
      out.push({
        netuid: sub.netuid,
        name,
        type: "accumulating",
        strength,
        headline: `${sub.whale_ratio}x avg buy size vs sells — whales accumulating`,
        detail:
          flowUsd != null
            ? `Net ${flowUsd > 0 ? "+" : ""}$${fmt(Math.abs(Math.round(flowUsd)))} in 24h · ${sub.whale_ratio}x whale buy/sell ratio`
            : `${sub.whale_ratio}x whale buy/sell ratio detected`,
        badge: "🐋 WHALE BUY",
        badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
        netFlow: sub.net_flow_24h ?? undefined,
        whaleRatio: sub.whale_ratio,
        price: sub.alpha_price ?? undefined,
        change24h: sub.price_change_24h ?? undefined,
        dayKey,
        detectedAt,
      });
    }

    // ── Whale distribution ─────────────────────────────────────
    if (sub.whale_signal === "distributing" && sub.whale_ratio != null) {
      const flowUsd =
        sub.net_flow_24h != null && taoPrice != null
          ? sub.net_flow_24h * taoPrice
          : null;
      const strength = Math.round(
        Math.max(30, Math.min(85, 50 + (1 / sub.whale_ratio - 2) * 10))
      );
      out.push({
        netuid: sub.netuid,
        name,
        type: "distributing",
        strength,
        headline: `${sub.whale_ratio}x sell pressure — smart money exiting`,
        detail:
          flowUsd != null
            ? `Net ${flowUsd > 0 ? "+" : "-"}$${fmt(Math.abs(Math.round(flowUsd)))} in 24h · ${sub.whale_ratio}x whale sell/buy ratio`
            : `${sub.whale_ratio}x whale sell-side pressure`,
        badge: "🔻 WHALE SELL",
        badgeColor: "bg-red-500/20 text-red-400 border-red-500/30",
        netFlow: sub.net_flow_24h ?? undefined,
        whaleRatio: sub.whale_ratio,
        price: sub.alpha_price ?? undefined,
        change24h: sub.price_change_24h ?? undefined,
        dayKey,
        detectedAt,
      });
    }

    // ── Volume surge ───────────────────────────────────────────
    if (sub.volume_surge && sub.volume_surge_ratio != null) {
      const buyVolUsd =
        sub.net_flow_24h != null && taoPrice != null && sub.net_flow_24h > 0
          ? sub.net_flow_24h * taoPrice
          : null;
      const r = sub.volume_surge_ratio;
      const strength =
        r >= 10 ? 95 : r >= 7 ? 85 : r >= 5 ? 75 : r >= 3.5 ? 65 : 55;
      out.push({
        netuid: sub.netuid,
        name,
        type: "volume_surge",
        strength,
        headline: `${r}x unusual buy volume vs 5-day average`,
        detail:
          buyVolUsd != null
            ? `+$${fmt(Math.round(buyVolUsd))} net buying · ${r}x rolling avg volume`
            : `${r}x rolling average buy volume`,
        badge: "🤑 VOL SURGE",
        badgeColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
        volumeRatio: r,
        netFlow: sub.net_flow_24h ?? undefined,
        price: sub.alpha_price ?? undefined,
        change24h: sub.price_change_24h ?? undefined,
        dayKey,
        detectedAt,
      });
    }

    // ── Yield divergence ───────────────────────────────────────
    if (
      sub.apy_1h != null &&
      sub.apy_30d != null &&
      sub.apy_30d >= MIN_30D_APY
    ) {
      const ratio = sub.apy_1h / sub.apy_30d;
      const apy1hPct  = (sub.apy_1h  * 100).toFixed(0);
      const apy30dPct = (sub.apy_30d * 100).toFixed(0);

      if (ratio >= YIELD_SPIKE_THRESHOLD) {
        const pctAbove = Math.round((ratio - 1) * 100);
        const strength = Math.round(
          Math.min(90, 50 + (ratio - 1.25) * 120)
        );
        out.push({
          netuid: sub.netuid,
          name,
          type: "yield_spike",
          strength,
          headline: `Staking yield spiked ${pctAbove}% above 30-day baseline`,
          detail: `1H APY ${apy1hPct}% vs 30d avg ${apy30dPct}% — sudden shift in staking dynamics. Could signal validator exit, emissions change, or stake redistribution.`,
          badge: "📈 YIELD SPIKE",
          badgeColor: "bg-lime-500/20 text-lime-300 border-lime-500/30",
          price: sub.alpha_price ?? undefined,
          change24h: sub.price_change_24h ?? undefined,
          apy_7d: sub.apy_7d ?? undefined,
          apy_1h: sub.apy_1h,
          apy_30d: sub.apy_30d,
          dayKey,
          detectedAt,
        });
      } else if (ratio <= YIELD_DIP_THRESHOLD) {
        const pctBelow = Math.round((1 - ratio) * 100);
        const strength = Math.round(
          Math.max(30, Math.min(75, 40 + (1 - ratio - 0.25) * 80))
        );
        out.push({
          netuid: sub.netuid,
          name,
          type: "yield_dip",
          strength,
          headline: `Staking yield compressed ${pctBelow}% below 30-day baseline`,
          detail: `1H APY ${apy1hPct}% vs 30d avg ${apy30dPct}% — yield compression often follows large stake inflows or increased competition among validators.`,
          badge: "📉 YIELD DIP",
          badgeColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
          price: sub.alpha_price ?? undefined,
          change24h: sub.price_change_24h ?? undefined,
          apy_7d: sub.apy_7d ?? undefined,
          apy_1h: sub.apy_1h,
          apy_30d: sub.apy_30d,
          dayKey,
          detectedAt,
        });
      }
    }
  }

  return out;
}

// ── Main handler ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [scan, store] = await Promise.all([
    readBlob<ScanLatest>("scan-latest.json"),
    readBlob<FlowEventsStore>("flow-events.json"),
  ]);

  if (!scan?.leaderboard?.length) {
    return NextResponse.json({ ok: true, skipped: "no scan data" });
  }

  const now        = new Date();
  const detectedAt = now.toISOString();
  const dayKey     = detectedAt.slice(0, 10); // "2026-04-30"

  // Generate fresh events from current scan
  const freshEvents = buildEvents(
    scan.leaderboard,
    scan.taoPrice ?? null,
    dayKey,
    detectedAt
  );

  // Load existing stored events, prune anything older than 48 hours
  const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString().slice(0, 10);
  const storedEvents: PersistedFlowEvent[] = (store?.events ?? []).filter(
    (e) => e.dayKey >= cutoff
  );

  // Merge: today's fresh events override any stored entry with same dedup key
  const mergedMap = new Map<string, PersistedFlowEvent>();

  // Start with stored (older events become the base)
  for (const e of storedEvents) {
    mergedMap.set(`${e.netuid}:${e.type}:${e.dayKey}`, e);
  }
  // Fresh events always win for their day
  for (const e of freshEvents) {
    mergedMap.set(`${e.netuid}:${e.type}:${e.dayKey}`, e);
  }

  const merged = [...mergedMap.values()].sort(
    (a, b) =>
      new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime() ||
      b.strength - a.strength
  );

  await writeBlob("flow-events.json", {
    events: merged,
    updatedAt: detectedAt,
  } satisfies FlowEventsStore);

  console.log(
    `[flow-snapshot] ${freshEvents.length} fresh events, ${storedEvents.length} stored → ${merged.length} merged`
  );

  return NextResponse.json({
    ok: true,
    fresh: freshEvents.length,
    stored: storedEvents.length,
    total: merged.length,
  });
}
