/**
 * Marketing opt-out.
 *
 * Commercial email needs a working unsubscribe: it is a legal requirement
 * (CAN-SPAM), and without one recipients mark mail as spam instead, which
 * damages the sending domain — the same domain that carries subscription
 * receipts and password resets.
 *
 * Opt-outs apply to ANNOUNCEMENTS ONLY. Transactional mail (billing, account)
 * is unaffected and must keep sending.
 */

import crypto from "crypto";
import { readBlob, writeBlob } from "./users";

const KEY = "admin/email-optouts.json";

const secret = () => process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET || "alphagap";

/** Signed token so an address cannot be opted out by a stranger guessing URLs. */
export function unsubToken(email: string): string {
  const e = email.toLowerCase().trim();
  const sig = crypto.createHmac("sha256", secret()).update(e).digest("hex").slice(0, 16);
  return `${Buffer.from(e).toString("base64url")}.${sig}`;
}

export function verifyUnsubToken(token: string): string | null {
  const [b64, sig] = (token || "").split(".");
  if (!b64 || !sig) return null;
  try {
    const email = Buffer.from(b64, "base64url").toString("utf-8");
    const expect = crypto.createHmac("sha256", secret()).update(email).digest("hex").slice(0, 16);
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect)) ? email : null;
  } catch {
    return null;
  }
}

export async function getOptOuts(): Promise<string[]> {
  return (await readBlob<string[]>(KEY)) ?? [];
}

export async function isOptedOut(email: string): Promise<boolean> {
  const list = await getOptOuts();
  return list.includes(email.toLowerCase().trim());
}

export async function addOptOut(email: string): Promise<void> {
  const e = email.toLowerCase().trim();
  const list = await getOptOuts();
  if (!list.includes(e)) await writeBlob(KEY, [...list, e]);
}
