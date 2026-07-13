/**
 * GET /api/cron/wallet-alerts
 *
 * Runs every 5 minutes via Vercel Cron.
 *
 * Queries TaoStats directly for each tracked wallet's recent delegation
 * events (stake/unstake). If an event is new and its USD value exceeds the
 * user's threshold, an alert is enqueued for the Railway bot to deliver.
 *
 * Dedup: event hashes stored in blob so each event only fires once.
 */

import { NextRequest, NextResponse } from "next/server";
import { list as blobList, get as blobGet, put as blobPut } from "@vercel/blob";
import { enqueueAlert } from "@/lib/telegram-alerts";
import type { TelegramConnection } from "@/lib/telegram-alerts";
import crypto from "crypto";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const TAOSTATS_KEY = () => process.env.TAOSTATS_API_KEY || "";
const RAO_PER_TAO  = 1_000_000_000;

// ── Auth ──────────────────────────────────────────────────────────

function authOk(req: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ── Blob helpers ──────────────────────────────────────────────────

const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN || "";

async function readBlob<T>(name: string): Promise<T | null> {
  try {
    const result = await blobGet(name, { token: TOKEN(), access: "private" });
    if (!result?.stream) return null;
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch { return null; }
}

async function writeBlob(name: string, data: unknown): Promise<void> {
  await blobPut(name, JSON.stringify(data), {
    access: "private", token: TOKEN(),
    addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
  });
}

// ── TaoStats types ────────────────────────────────────────────────

interface TSDelegation {
  action:    "DELEGATE" | "UNDELEGATE";
  timestamp: string;
  nominator: { ss58: string };
  amount:    string; // rao
  usd:       string | null;
  netuid:    number | null;
}

interface WalletAlertState {
  processedHashes: string[];
  updatedAt:       string;
}

// ── Fetch recent events for one wallet from TaoStats ──────────────

async function fetchRecentMoves(address: string, since: number): Promise<TSDelegation[]> {
  try {
    const url = `https://api.taostats.io/api/delegation/v1?nominator=${encodeURIComponent(address)}&limit=50&order=timestamp_desc&timestamp_start=${since}`;
    const r = await fetch(url, {
      headers: { Authorization: TAOSTATS_KEY() },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const j = await r.json() as { data?: TSDelegation[] };
    return (j.data ?? []).filter(d => d.netuid != null && d.netuid > 0);
  } catch { return []; }
}

function eventHash(address: string, d: TSDelegation): string {
  return crypto
    .createHash("sha256")
    .update(`${address}:${d.action}:${d.timestamp}:${d.amount}:${d.netuid ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}

// ── Formatters ────────────────────────────────────────────────────

function shortAddr(addr: string): string {
  return addr.length < 12 ? addr : `${addr.slice(0, 6)}…${addr.slice(-5)}`;
}
function fmtTao(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M τ`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K τ`;
  return `${n.toFixed(1)} τ`;
}
function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ── Main handler ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load dedup state
  const stateKey = "wallet-alerts-state-ts.json";
  const state = (await readBlob<WalletAlertState>(stateKey)) ?? {
    processedHashes: [],
    updatedAt: new Date().toISOString(),
  };
  const processed = new Set(state.processedHashes);

  // Look back 10 minutes (covers 5-min cron + buffer for TaoStats indexing lag)
  const since = Math.floor((Date.now() - 10 * 60 * 1000) / 1000);

  // ── Pass 1: collect all telegram users + their tracked wallets ──
  interface UserEntry {
    hash:          string;
    conn:          TelegramConnection;
    trackedWallets: string[];
    minUsd:        number;
  }
  const users: UserEntry[] = [];

  let cursor: string | undefined;
  do {
    const page = await blobList({
      prefix: "telegram-settings/",
      token: TOKEN(),
      access: "private",
      cursor,
    } as Parameters<typeof blobList>[0]);

    for (const blob of page.blobs) {
      const hash = blob.pathname.replace("telegram-settings/", "").replace(".json", "");
      const conn = await readBlob<TelegramConnection>(blob.pathname);
      if (!conn?.chatId) continue;
      const wt = conn.settings?.walletTracker;
      if (!wt?.enabled || !wt.trackedWallets?.length) continue;
      users.push({
        hash,
        conn,
        trackedWallets: wt.trackedWallets,
        minUsd: wt.minUsdAmount ?? 0,
      });
    }
    cursor = page.cursor;
  } while (cursor);

  if (!users.length) {
    return NextResponse.json({ ok: true, message: "No users with active wallet alerts" });
  }

  // Build netuid → subnet name map from the scan blob — zero TaoStats calls
  // (best-effort; falls back to "SNxx")
  const subnetNames = new Map<number, string>();
  try {
    const scan = await readBlob<{ leaderboard?: Array<{ netuid: number; name?: string }> }>("scan-latest.json");
    for (const s of scan?.leaderboard ?? []) {
      if (s.netuid != null && s.name) subnetNames.set(s.netuid, s.name);
    }
  } catch { /* non-fatal — alerts still send without names */ }

  // ── Pass 2: collect unique addresses across all users ────────────
  const allAddresses = new Set<string>();
  for (const u of users) for (const addr of u.trackedWallets) allAddresses.add(addr);

  console.log(`[wallet-alerts] ${users.length} users, ${allAddresses.size} unique wallets`);

  // ── Pass 3: fetch TaoStats events per wallet (5 concurrent) ──────
  const CONCURRENCY = 5;
  const addressList = [...allAddresses];
  const movesByAddr = new Map<string, TSDelegation[]>();

  for (let i = 0; i < addressList.length; i += CONCURRENCY) {
    const batch = addressList.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(addr => fetchRecentMoves(addr, since)));
    for (let j = 0; j < batch.length; j++) {
      if (results[j].length) movesByAddr.set(batch[j], results[j]);
    }
  }

  const totalEvents = [...movesByAddr.values()].reduce((s, v) => s + v.length, 0);
  console.log(`[wallet-alerts] ${totalEvents} recent events across ${movesByAddr.size} wallets`);

  if (!totalEvents) {
    return NextResponse.json({ ok: true, message: "No recent moves found" });
  }

  // ── Pass 4: match events → users → send alerts ───────────────────
  let alertsSent = 0;
  const newHashes: string[] = [];

  for (const u of users) {
    for (const addr of u.trackedWallets) {
      const events = movesByAddr.get(addr);
      if (!events?.length) continue;

      for (const ev of events) {
        const hash = eventHash(addr, ev);
        if (processed.has(hash)) continue; // already alerted

        const usdValue = parseFloat(ev.usd ?? "0") || 0;
        // Do NOT mark as processed when below threshold — if the user lowers
        // their minimum later this event should still be deliverable.
        if (usdValue < u.minUsd) continue;

        const taoAmount = parseInt(ev.amount || "0") / RAO_PER_TAO;
        const isBuy     = ev.action === "DELEGATE";
        const action    = isBuy ? "🟢 STAKED" : "🔴 UNSTAKED";
        const emoji     = isBuy ? "📈" : "📉";
        const snName    = ev.netuid != null ? subnetNames.get(ev.netuid) : undefined;
        const subnetLabel = snName ? `SN${ev.netuid} - ${snName}` : `SN${ev.netuid}`;

        const message = [
          `🐋 *Tracked Wallet Alert*`,
          ``,
          `${action} ${subnetLabel}`,
          ``,
          `💰 Amount: *${fmtTao(taoAmount)}* (~${fmtUsd(usdValue)})`,
          `👛 Wallet: \`${shortAddr(addr)}\``,
          `${emoji} [View wallet](https://alphagap.io/wallettracker/${addr})`,
        ].join("\n");

        await enqueueAlert(u.hash, {
          type:    "walletTracker",
          message,
          netuid:  ev.netuid ?? undefined,
        });

        newHashes.push(hash);
        alertsSent++;
      }
    }
  }

  // Persist processed hashes (keep last 2000 to bound size)
  const allHashes = [...processed, ...newHashes];
  state.processedHashes = allHashes.slice(-2000);
  state.updatedAt = new Date().toISOString();
  await writeBlob(stateKey, state);

  console.log(`[wallet-alerts] Done — ${alertsSent} alerts sent`);
  return NextResponse.json({ ok: true, uniqueWallets: allAddresses.size, totalEvents, alertsSent });
}
