// Watchlist storage using Vercel Blob
// Each user's watchlist is stored as watchlists/{emailHash}.json
// Format: { netuids: number[], updatedAt: string }

import { put, get as blobGet } from "@vercel/blob";
import crypto from "crypto";

interface WatchlistData {
  netuids: number[];
  updatedAt: string;
}

function emailHash(email: string): string {
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

export async function getWatchlist(email: string): Promise<number[]> {
  const hash = emailHash(email);
  const data = await readBlob<WatchlistData>(`watchlists/${hash}.json`);
  return data?.netuids ?? [];
}

export async function addToWatchlist(email: string, netuid: number): Promise<number[]> {
  const hash = emailHash(email);
  const existing = await readBlob<WatchlistData>(`watchlists/${hash}.json`);
  const netuids = existing?.netuids ?? [];
  if (!netuids.includes(netuid)) {
    netuids.push(netuid);
    await writeBlob(`watchlists/${hash}.json`, { netuids, updatedAt: new Date().toISOString() });
  }
  return netuids;
}

export async function removeFromWatchlist(email: string, netuid: number): Promise<number[]> {
  const hash = emailHash(email);
  const existing = await readBlob<WatchlistData>(`watchlists/${hash}.json`);
  const netuids = (existing?.netuids ?? []).filter((n) => n !== netuid);
  await writeBlob(`watchlists/${hash}.json`, { netuids, updatedAt: new Date().toISOString() });
  return netuids;
}

export async function saveWatchlist(email: string, netuids: number[]): Promise<number[]> {
  const hash = emailHash(email);
  await writeBlob(`watchlists/${hash}.json`, { netuids, updatedAt: new Date().toISOString() });
  return netuids;
}
