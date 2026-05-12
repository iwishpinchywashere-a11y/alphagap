// GET /api/discord-deleted
// Returns deleted Discord messages detected by the discord-scan cron.
// Only messages classified as significant by AI are surfaced.

import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import type { DeletedMessageResult } from "@/app/api/discord-scan/route";

export const dynamic = "force-dynamic";

export interface DeletedMessagesBlob {
  updatedAt: string;
  messages: DeletedMessageResult[];
}

export async function GET() {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return NextResponse.json({ messages: [], updatedAt: null });

    const blob = await get("discord-deleted.json", { token, access: "private" });
    if (!blob?.stream) return NextResponse.json({ messages: [], updatedAt: null });

    const reader = blob.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const data: DeletedMessagesBlob = JSON.parse(Buffer.concat(chunks).toString("utf-8"));

    // Only return significant messages (sinister ones first, then the rest)
    const significant = (data.messages ?? [])
      .filter(m => m.significant)
      .sort((a, b) => {
        // sinister first, then newest
        if (a.sinister !== b.sinister) return a.sinister ? -1 : 1;
        return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
      });

    return NextResponse.json({ messages: significant, updatedAt: data.updatedAt ?? null });
  } catch (e) {
    console.error("[discord-deleted] Error:", e);
    return NextResponse.json({ messages: [], updatedAt: null });
  }
}
