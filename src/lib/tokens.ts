// Short-lived auth tokens stored in Vercel Blob
// Used for email verification and password reset
// Key: auth-tokens/{token}.json → { email, type, expiry }

import { put, get as blobGet } from "@vercel/blob";

interface TokenRecord {
  email: string;
  type: "verify" | "reset";
  expiry: number; // Unix ms
  used?: boolean;
}

const TOKEN_KEY = () => process.env.BLOB_READ_WRITE_TOKEN || "";

async function writeToken(token: string, data: TokenRecord): Promise<void> {
  await put(`auth-tokens/${token}.json`, JSON.stringify(data), {
    access: "private",
    token: TOKEN_KEY(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readToken(token: string): Promise<TokenRecord | null> {
  try {
    const result = await blobGet(`auth-tokens/${token}.json`, {
      token: TOKEN_KEY(),
      access: "private",
    });
    if (!result?.stream) return null;
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as TokenRecord;
  } catch {
    return null;
  }
}

/** Generate a secure random hex token (64 chars) */
function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Create and store a new auth token. Returns the token string. */
export async function createToken(
  email: string,
  type: "verify" | "reset",
  ttlMs: number = 24 * 60 * 60 * 1000, // 24 hours default
): Promise<string> {
  const token = generateToken();
  await writeToken(token, {
    email: email.toLowerCase().trim(),
    type,
    expiry: Date.now() + ttlMs,
  });
  return token;
}

/**
 * Consume a token: validates it exists, hasn't expired, is the right type,
 * and hasn't been used. Marks it as used on success.
 * Returns the associated email, or null if invalid.
 */
export async function consumeToken(
  token: string,
  expectedType: "verify" | "reset",
): Promise<string | null> {
  if (!token || token.length < 32) return null;
  const record = await readToken(token);
  if (!record) return null;
  if (record.used) return null;
  if (record.type !== expectedType) return null;
  if (Date.now() > record.expiry) return null;

  // Mark as used so it can't be replayed
  await writeToken(token, { ...record, used: true });

  return record.email;
}
