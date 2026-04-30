/**
 * GET /api/alerts/queue
 *
 * Called by the Railway Telegram bot every 30s.
 * Returns all unsent alerts for all users, including their chatId.
 * Authenticates via BOT_API_SECRET header.
 *
 * Response: { items: Array<{ hash: string, chatId: string, alerts: PendingAlert[] }> }
 *
 * POST /api/alerts/queue/ack is handled by a separate route.
 * This GET also accepts a ?ack=id1,id2,id3 param to acknowledge inline.
 */

import { NextRequest, NextResponse } from "next/server";
import { list as blobList, get as blobGet } from "@vercel/blob";
import { saveAlertQueue } from "@/lib/telegram-alerts";
import type { AlertQueue, TelegramConnection } from "@/lib/telegram-alerts";

function authOk(req: NextRequest): boolean {
  const secret = process.env.BOT_API_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN || "";

async function readPrivateBlob<T>(name: string): Promise<T | null> {
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

export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // List all alert queues
  let cursor: string | undefined;
  const items: { hash: string; chatId: string; alerts: AlertQueue["alerts"] }[] = [];

  do {
    const page = await blobList({
      prefix: "alerts-queue/",
      token: TOKEN(),
      access: "private",
      cursor,
    } as Parameters<typeof blobList>[0]);

    for (const blob of page.blobs) {
      const hash = blob.pathname.replace("alerts-queue/", "").replace(".json", "");
      const queue = await readPrivateBlob<AlertQueue>(blob.pathname);
      if (!queue) continue;

      const unsent = queue.alerts.filter(a => !a.sent);
      if (!unsent.length) continue;

      // Look up the user's chatId
      const conn = await readPrivateBlob<TelegramConnection>(`telegram-settings/${hash}.json`);
      if (!conn?.chatId || !conn?.settings?.enabled) continue;

      items.push({ hash, chatId: conn.chatId, alerts: unsent });
    }

    cursor = page.cursor;
  } while (cursor);

  // Handle inline ack param: ?ack=hash:id1,hash:id2
  const ack = req.nextUrl.searchParams.get("ack");
  if (ack) {
    const pairs = ack.split(",").map(p => p.split(":"));
    const byHash: Record<string, Set<string>> = {};
    for (const [hash, id] of pairs) {
      if (!byHash[hash]) byHash[hash] = new Set();
      byHash[hash].add(id);
    }
    await Promise.all(
      Object.entries(byHash).map(async ([hash, ids]) => {
        const queue = await readPrivateBlob<AlertQueue>(`alerts-queue/${hash}.json`);
        if (!queue) return;
        queue.alerts = queue.alerts.map(a => ids.has(a.id) ? { ...a, sent: true } : a);
        await saveAlertQueue(hash, queue);
      })
    );
  }

  return NextResponse.json({ items });
}

/**
 * POST /api/alerts/queue — acknowledge sent alerts
 * Body: { acks: Array<{ hash: string, id: string }> }
 */
export async function POST(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { acks } = await req.json() as { acks: { hash: string; id: string }[] };
  if (!Array.isArray(acks)) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  // Group by hash
  const byHash: Record<string, Set<string>> = {};
  for (const { hash, id } of acks) {
    if (!byHash[hash]) byHash[hash] = new Set();
    byHash[hash].add(id);
  }

  await Promise.all(
    Object.entries(byHash).map(async ([hash, ids]) => {
      const queue = await readPrivateBlob<AlertQueue>(`alerts-queue/${hash}.json`);
      if (!queue) return;
      queue.alerts = queue.alerts.map(a => ids.has(a.id) ? { ...a, sent: true } : a);
      await saveAlertQueue(hash, queue);
    })
  );

  return NextResponse.json({ ok: true });
}
