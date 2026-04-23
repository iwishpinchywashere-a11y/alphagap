// Notification storage using Vercel Blob
// Each user's notifications stored as notifications/{emailHash}.json

import { put, get as blobGet } from "@vercel/blob";
import crypto from "crypto";
import type { NotificationStore } from "./notification-types";

export type { NotificationType, AppNotification, NotificationSnapshot, NotificationStore } from "./notification-types";

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

export async function getNotificationStore(email: string): Promise<NotificationStore> {
  const hash = emailHash(email);
  const data = await readBlob<NotificationStore>(`notifications/${hash}.json`);
  return data ?? { notifications: [], snapshot: null };
}

export async function saveNotificationStore(email: string, store: NotificationStore): Promise<void> {
  const hash = emailHash(email);
  // Keep only 50 most recent notifications to limit blob size
  const notifications = [...store.notifications]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 50);
  await writeBlob(`notifications/${hash}.json`, { ...store, notifications });
}
