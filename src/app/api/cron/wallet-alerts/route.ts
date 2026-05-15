/**
 * GET /api/cron/wallet-alerts
 *
 * Runs every 5 minutes via Vercel Cron.
 *
 * Fetches recent whale moves from SubnetRadar, then checks each
 * Telegram-connected user's tracked wallets. If a tracked wallet
 * made a stake/unstake move whose USD value exceeds their threshold,
 * an alert is enqueued for the Railway bot to deliver.
 *
 * Dedup: move hashes stored in blob so each move only fires once.
 */

import { NextRequest, NextResponse } from "next/server";
import { list as blobList, get as blobGet, put as blobPut } from "@vercel/blob";
import { enqueueAlert } from "@/lib/telegram-alerts";
import type { TelegramConnection } from "@/lib/telegram-alerts";
import { getTaoPrice } from "@/lib/taostats";
import crypto from "crypto";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

// ── Auth ──────────────────────────────────────────────────────────

function authOk(req: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return true; // local dev
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

// ── SubnetRadar types ─────────────────────────────────────────────

interface SRWhaleMove {
  type:       "stake" | "unstake" | "transfer";
  amount:     number;   // TAO
  from:       string;   // coldkey address
  netuid?:    number;
  name?:      string;   // subnet name
  timestamp?: string;
}

interface WalletAlertState {
  processedHashes: string[];   // hashes of already-alerted moves
  updatedAt:       string;
}

// ── Fetch helpers ─────────────────────────────────────────────────

async function fetchSRMoves(): Promise<SRWhaleMove[]> {
  try {
    const r = await fetch("https://subnetradar.com/api/whales", {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 AppleWebKit/537.36",
        "Accept":     "application/json",
        "Referer":    "https://subnetradar.com/",
      },
    });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.moves ?? []) as SRWhaleMove[];
  } catch { return []; }
}

function moveHash(m: SRWhaleMove): string {
  return crypto
    .createHash("sha256")
    .update(`${m.from}:${m.type}:${m.netuid ?? ""}:${m.amount}:${m.timestamp ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}

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

  // Load already-processed move hashes (dedup)
  const stateKey = "wallet-alerts-state.json";
  const state = (await readBlob<WalletAlertState>(stateKey)) ?? {
    processedHashes: [],
    updatedAt: new Date().toISOString(),
  };
  const processed = new Set(state.processedHashes);

  // Fetch moves + TAO price in parallel
  const [moves, taoPrice] = await Promise.all([
    fetchSRMoves(),
    getTaoPrice().catch(() => 0),
  ]);

  if (!moves.length) {
    return NextResponse.json({ ok: true, message: "No new moves found" });
  }

  console.log(`[wallet-alerts] ${moves.length} SR moves, TAO=$${taoPrice}`);

  // Filter to new stake/unstake moves only
  const newMoves = moves.filter(m =>
    (m.type === "stake" || m.type === "unstake") &&
    m.from &&
    !processed.has(moveHash(m))
  );

  if (!newMoves.length) {
    return NextResponse.json({ ok: true, message: "All moves already processed" });
  }

  // Build quick lookup: address → moves
  const movesByAddr = new Map<string, SRWhaleMove[]>();
  for (const m of newMoves) {
    if (!movesByAddr.has(m.from)) movesByAddr.set(m.from, []);
    movesByAddr.get(m.from)!.push(m);
  }

  // Iterate all telegram-connected users
  let cursor: string | undefined;
  let alertsSent = 0;

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

      const minUsd = wt.minUsdAmount ?? 0;

      for (const addr of wt.trackedWallets) {
        const addrMoves = movesByAddr.get(addr);
        if (!addrMoves) continue;

        for (const m of addrMoves) {
          const usdValue = m.amount * taoPrice;
          if (usdValue < minUsd) continue;

          const isBuy  = m.type === "stake";
          const action = isBuy ? "🟢 STAKED" : "🔴 UNSTAKED";
          const emoji  = isBuy ? "📈" : "📉";

          const subnetLabel = m.netuid != null
            ? `SN${m.netuid}${m.name ? ` · ${m.name}` : ""}`
            : "Unknown subnet";

          const message = [
            `🐋 *Tracked Wallet Alert*`,
            ``,
            `${action} ${subnetLabel}`,
            ``,
            `💰 Amount: *${fmtTao(m.amount)}* (~${fmtUsd(usdValue)})`,
            `👛 Wallet: \`${shortAddr(addr)}\``,
            `${emoji} [View wallet](https://alphagap.io/wallettracker)`,
          ].join("\n");

          await enqueueAlert(hash, {
            type:       "walletTracker",
            message,
            netuid:     m.netuid,
            subnetName: m.name,
          });

          alertsSent++;
        }
      }
    }

    cursor = page.cursor;
  } while (cursor);

  // Persist processed hashes (keep last 500 to bound size)
  const allHashes = [...processed, ...newMoves.map(moveHash)];
  state.processedHashes = allHashes.slice(-500);
  state.updatedAt = new Date().toISOString();
  await writeBlob(stateKey, state);

  console.log(`[wallet-alerts] Done — ${alertsSent} alerts enqueued for ${newMoves.length} new moves`);
  return NextResponse.json({ ok: true, newMoves: newMoves.length, alertsSent });
}
