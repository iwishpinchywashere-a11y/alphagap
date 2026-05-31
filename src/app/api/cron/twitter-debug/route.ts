// Debug route - inspect lock state and test blob read/write
import { NextRequest, NextResponse } from "next/server";
import { get as blobGet, put as blobPut } from "@vercel/blob";

export const dynamic = "force-dynamic";

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";

async function readBlob<T>(name: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const b = await blobGet(name, { token: BLOB_TOKEN, access: "private" });
    if (!b?.stream) return { data: null, error: "no stream returned" };
    const reader = b.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const all = chunks.reduce((a, b) => {
      const c = new Uint8Array(a.length + b.length);
      c.set(a); c.set(b, a.length);
      return c;
    }, new Uint8Array(0));
    return { data: JSON.parse(Buffer.from(all).toString("utf-8")) as T, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function GET(req: NextRequest) {
  const hasToken = !!BLOB_TOKEN;
  const tokenPrefix = BLOB_TOKEN ? BLOB_TOKEN.slice(0, 8) + "..." : "MISSING";

  // Read current lock
  const lockResult = await readBlob<{ slotKey: string; lockedAt: string }>("twitter-post-lock.json");

  // Read posted log (just last entry + count)
  const postedResult = await readBlob<{ posted: Array<{ id: string; type: string; postedAt: string; tweetUrl: string }> }>("twitter-posted.json");
  const postedCount = postedResult.data?.posted?.length ?? 0;
  const lastPosted = postedResult.data?.posted?.slice(-1)[0] ?? null;

  // Test write/read roundtrip on the lock
  const testSlot = "debug-test-" + Date.now();
  const testLockedAt = new Date().toISOString();
  let writeError: string | null = null;
  let verifyResult: { data: unknown; error: string | null } | null = null;

  try {
    await blobPut(
      "twitter-post-lock.json",
      JSON.stringify({ slotKey: testSlot, lockedAt: testLockedAt }),
      { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", token: BLOB_TOKEN }
    );
  } catch (e) {
    writeError = String(e);
  }

  if (!writeError) {
    await new Promise(r => setTimeout(r, 300));
    verifyResult = await readBlob("twitter-post-lock.json");
  }

  // Restore the original lock (or clear it)
  let restoreError: string | null = null;
  if (lockResult.data) {
    try {
      await blobPut(
        "twitter-post-lock.json",
        JSON.stringify(lockResult.data),
        { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", token: BLOB_TOKEN }
      );
    } catch (e) {
      restoreError = String(e);
    }
  }

  const currentUtcHour = new Date().toISOString().slice(0, 13);

  return NextResponse.json({
    tokenPresent: hasToken,
    tokenPrefix,
    currentUtcHour,
    lock: {
      data: lockResult.data,
      error: lockResult.error,
    },
    postedLog: {
      count: postedCount,
      error: postedResult.error,
      last: lastPosted,
    },
    blobRoundtrip: {
      wrote: !writeError,
      writeError,
      readBack: verifyResult?.data,
      readError: verifyResult?.error,
      match: !writeError && !verifyResult?.error &&
        (verifyResult?.data as Record<string, unknown>)?.slotKey === testSlot &&
        (verifyResult?.data as Record<string, unknown>)?.lockedAt === testLockedAt,
    },
    restoreError,
  });
}
