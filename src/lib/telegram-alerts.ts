// Telegram Alerts — shared types and Vercel Blob helpers
// Stores:
//   telegram-settings/{emailHash}.json  → user's Telegram connection + alert prefs
//   telegram-codes/{code}.json          → one-time connect codes (10-min TTL)
//   alerts-queue/{emailHash}.json       → pending alerts waiting to be sent

import { put, get as blobGet } from "@vercel/blob";
import crypto from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubnetScope = "all" | "watchlist" | number[];

export interface AlertType {
  enabled: boolean;
  threshold?: number; // e.g. % change required to fire
}

export interface AlertSettings {
  enabled: boolean;
  subnets: SubnetScope;
  scoreChange: AlertType;     // aGap score moves by threshold pts
  emissionChange: AlertType;  // emission % changes by threshold
  newSignal: AlertType;       // new signal generated (/signals)
  whaleActivity: AlertType;   // whale trade or volume spike (/flow)
  discordEntry: AlertType;    // new Discord entry on social page
  goingViralX: AlertType;     // going viral on X (social page)
  priceMove: AlertType;       // token price % move
}

export interface TelegramConnection {
  chatId: string;
  username?: string;
  firstName?: string;
  connectedAt: string;
  settings: AlertSettings;
}

export interface PendingAlert {
  id: string;
  type: string;
  netuid?: number;
  subnetName?: string;
  message: string;
  createdAt: string;
  sent: boolean;
}

export interface AlertQueue {
  alerts: PendingAlert[];
}

export interface TelegramCode {
  emailHash: string;
  email: string;
  expiresAt: number; // ms since epoch
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export function defaultAlertSettings(): AlertSettings {
  return {
    enabled: true,
    subnets: "watchlist",
    scoreChange: { enabled: true, threshold: 10 },
    emissionChange: { enabled: true, threshold: 25 },
    newSignal: { enabled: true },
    whaleActivity: { enabled: false },
    discordEntry: { enabled: false },
    goingViralX: { enabled: false },
    priceMove: { enabled: false, threshold: 10 },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function emailHash(email: string): string {
  return crypto.createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 32);
}

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
  } catch {
    return null;
  }
}

async function writeBlob(name: string, data: unknown): Promise<void> {
  await put(name, JSON.stringify(data), {
    access: "private",
    token: TOKEN(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

// ─── Telegram Connection ──────────────────────────────────────────────────────

export async function getTelegramConnection(email: string): Promise<TelegramConnection | null> {
  const hash = emailHash(email);
  return readBlob<TelegramConnection>(`telegram-settings/${hash}.json`);
}

export async function saveTelegramConnection(email: string, conn: TelegramConnection): Promise<void> {
  const hash = emailHash(email);
  await writeBlob(`telegram-settings/${hash}.json`, conn);
}

export async function deleteTelegramConnection(email: string): Promise<void> {
  const hash = emailHash(email);
  // We overwrite with a tombstone rather than delete (Vercel Blob delete is async)
  await writeBlob(`telegram-settings/${hash}.json`, null);
}

export async function getTelegramConnectionByHash(hash: string): Promise<TelegramConnection | null> {
  return readBlob<TelegramConnection>(`telegram-settings/${hash}.json`);
}

export async function saveTelegramConnectionByHash(hash: string, conn: TelegramConnection): Promise<void> {
  await writeBlob(`telegram-settings/${hash}.json`, conn);
}

// ─── One-time connect codes ───────────────────────────────────────────────────

function randomCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
}

export async function createConnectCode(email: string): Promise<string> {
  const hash = emailHash(email);
  // Invalidate old codes for this user by overwriting — we just create a new one
  const code = randomCode();
  const data: TelegramCode = {
    emailHash: hash,
    email,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  };
  await writeBlob(`telegram-codes/${code}.json`, data);
  return code;
}

export async function consumeConnectCode(code: string): Promise<TelegramCode | null> {
  const normalized = code.toUpperCase().trim();
  const data = await readBlob<TelegramCode>(`telegram-codes/${normalized}.json`);
  if (!data) return null;
  if (Date.now() > data.expiresAt) return null; // expired
  // Invalidate it
  await writeBlob(`telegram-codes/${normalized}.json`, { used: true, usedAt: Date.now() });
  return data;
}

// ─── Alert Queue ──────────────────────────────────────────────────────────────

export async function getAlertQueue(emailHash_: string): Promise<AlertQueue> {
  const data = await readBlob<AlertQueue>(`alerts-queue/${emailHash_}.json`);
  return data ?? { alerts: [] };
}

export async function saveAlertQueue(emailHash_: string, queue: AlertQueue): Promise<void> {
  await writeBlob(`alerts-queue/${emailHash_}.json`, queue);
}

export async function enqueueAlert(emailOrHash: string, alert: Omit<PendingAlert, "id" | "sent" | "createdAt">): Promise<void> {
  // Accept either email or pre-computed hash
  const hash = emailOrHash.includes("@") ? emailHash(emailOrHash) : emailOrHash;
  const queue = await getAlertQueue(hash);

  // ── Dedup: skip if ANY alert for the same subnet was queued in the last 15 min ──
  // Using subnet-level dedup (not per-type) prevents rapid-fire multi-type
  // alerts (e.g. priceMove + scoreChange firing simultaneously for SN8) from
  // appearing as duplicates to the user. Only ONE notification per subnet per
  // user within the 15-minute window is queued.
  const dedupeWindow = new Date(Date.now() - 15 * 60_000).toISOString();
  const isDuplicate = queue.alerts.some(
    a =>
      a.netuid === alert.netuid &&
      a.createdAt > dedupeWindow
  );
  if (isDuplicate) return;

  const newAlert: PendingAlert = {
    ...alert,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    sent: false,
  };
  // Keep at most 100 pending alerts per user
  queue.alerts = [newAlert, ...queue.alerts.filter(a => !a.sent)].slice(0, 100);
  await saveAlertQueue(hash, queue);
}
