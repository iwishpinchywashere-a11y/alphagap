// User storage using Vercel Blob — no additional database needed
// Each user is stored as users/{emailHash}.json
// Stripe reverse lookups: stripe-customers/{customerId}.json

import { put, get as blobGet } from "@vercel/blob";
import crypto from "crypto";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus: "none" | "active" | "canceled" | "past_due" | "trialing";
  subscriptionPeriodEnd?: number; // Unix timestamp
  isAdmin?: boolean;
  subscriptionTier?: "pro" | "premium";
  createdAt: string;
  emailVerified?: boolean;
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

export async function getUserByEmail(email: string): Promise<User | null> {
  const hash = emailHash(email);
  return readBlob<User>(`users/${hash}.json`);
}

export async function createUser(user: User): Promise<void> {
  const hash = emailHash(user.email);
  await writeBlob(`users/${hash}.json`, user);
  // Update user list for admin
  await addToUserList(user);
}

export async function updateUser(email: string, updates: Partial<User>): Promise<User> {
  const existing = await getUserByEmail(email);
  if (!existing) throw new Error("User not found");
  const updated = { ...existing, ...updates };
  const hash = emailHash(email);
  await writeBlob(`users/${hash}.json`, updated);
  return updated;
}

export async function getUserByStripeCustomerId(customerId: string): Promise<User | null> {
  const data = await readBlob<{ email: string }>(`stripe-customers/${customerId}.json`);
  if (!data?.email) return null;
  return getUserByEmail(data.email);
}

export async function setStripeCustomerLookup(email: string, customerId: string): Promise<void> {
  await writeBlob(`stripe-customers/${customerId}.json`, { email: email.toLowerCase() });
}

// ── Admin user list ──────────────────────────────────────────────────
export interface UserListEntry {
  email: string;
  name: string;
  subscriptionStatus: User["subscriptionStatus"];
  stripeCustomerId?: string;
  createdAt: string;
}

export async function getUserList(): Promise<UserListEntry[]> {
  return (await readBlob<UserListEntry[]>("admin/user-list.json")) ?? [];
}

async function addToUserList(user: User): Promise<void> {
  const list = await getUserList();
  const existing = list.findIndex(u => u.email === user.email);
  const entry: UserListEntry = {
    email: user.email,
    name: user.name,
    subscriptionStatus: user.subscriptionStatus,
    stripeCustomerId: user.stripeCustomerId,
    createdAt: user.createdAt,
  };
  if (existing >= 0) list[existing] = entry;
  else list.unshift(entry);
  await writeBlob("admin/user-list.json", list);
}

export async function updateUserListEntry(email: string, updates: Partial<UserListEntry>): Promise<void> {
  const list = await getUserList();
  const idx = list.findIndex(u => u.email === email);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updates };
    await writeBlob("admin/user-list.json", list);
  }
}
