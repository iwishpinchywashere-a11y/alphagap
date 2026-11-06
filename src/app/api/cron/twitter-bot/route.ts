/**
 * GET /api/cron/twitter-bot - 07:00 / 12:00 / 17:00 / 22:00 UTC.
 *
 * REBUILT AGAIN (2026-11-06). The 2026-08-26 rebuild fixed the double-posting
 * and the retrospectives by tweeting the feed-digest's freshest card. That
 * made the account a changelog: "Umi (SN78): Subnet fixes data handling,
 * launches miner competition bundle." Technically true, nobody cares.
 *
 * The account now posts plain-English product and revenue updates from the
 * same research that powers /benchmarks (see lib/twitter-stories):
 *   first_party  the subnet's own fresh post with a figure (revenue-watch)
 *   research     a recently re-read revenue record from valuation.json
 *   profile      what a strong live product is, when nothing fresher exists
 * A model (Sonnet 5) writes the post from a fixed fact sheet, and every
 * figure in the output is checked against the fact sheet before it can be
 * posted. A post that fails is dropped and the next story is tried.
 *
 * What is kept from the last rebuild, because it was right:
 * - TIMELINE AS THE ONLY TRUTH. Vercel Blob is eventually consistent; the
 *   posted log and the draft cache are advisory. Every run fails closed on an
 *   unreadable timeline, enforces the 4h cooldown from X itself, sleeps a
 *   random 5-25s and re-checks the live timeline before sending.
 * - SILENCE OVER SLOP. No qualifying story, no tweet.
 * The one thing given up is byte-identical text across concurrent runs: the
 * draft cache makes a re-run reuse the same wording when the cache has
 * caught up, and the 10-minute recheck covers the case where it has not.
 *
 * ?dry=1        pick and write, do not post
 * ?preview=N    write the top N stories, do not post (shows what is coming)
 */

import { NextRequest, NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";
import { fetchOwnRecentTweets, postTweet } from "@/lib/twitter-bot";
import research from "@/data/valuation.json";
import type { ResearchRecord } from "@/lib/valuation";
import type { RevenueMention } from "@/lib/revenue-mentions";
import { buildStories, writeDraft, composePost, type PostedEntry, type Story } from "@/lib/twitter-stories";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const LOG_BLOB = "twitter-posted-log-v2.json";
const DRAFTS_BLOB = "twitter-drafts.json";
const MENTIONS_BLOB = "revenue-mentions.json";

interface DraftStore { [fingerprint: string]: { text: string; writtenAt: string } }

async function readBlob<T>(name: string): Promise<T | null> {
  try {
    const b = await blobGet(name, { token: TOKEN, access: "private", abortSignal: AbortSignal.timeout(10000) });
    if (!b?.stream) return null;
    const r = b.stream.getReader(); const cs: Uint8Array[] = [];
    while (true) { const { done, value } = await r.read(); if (done) break; cs.push(value); }
    return JSON.parse(Buffer.concat(cs).toString("utf-8"));
  } catch { return null; }
}

async function writeBlob(name: string, data: unknown): Promise<void> {
  await put(name, JSON.stringify(data), {
    access: "private", addRandomSuffix: false, allowOverwrite: true, token: TOKEN, contentType: "application/json",
  }).catch(() => {});
}

const words = (t: string) => new Set(t.toLowerCase().replace(/https?:\/\/\S+/g, "").split(/\W+/).filter(w => w.length > 3));
function similarity(a: string, b: string): number {
  const wa = words(a), wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let n = 0; for (const w of wa) if (wb.has(w)) n++;
  return n / Math.min(wa.size, wb.size);
}

/** Cached draft if one exists, otherwise write one and remember it. */
async function draftFor(story: Story, drafts: DraftStore): Promise<{ text: string | null; reason?: string; cached: boolean }> {
  const hit = drafts[story.fingerprint];
  if (hit?.text) return { text: hit.text, cached: true };
  const r = await writeDraft(story, ANTHROPIC_KEY);
  if (r.text) drafts[story.fingerprint] = { text: r.text, writtenAt: new Date().toISOString() };
  return { text: r.text, reason: r.reason, cached: false };
}

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!isVercelCron && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!TOKEN || !ANTHROPIC_KEY) return NextResponse.json({ ok: false, reason: "missing BLOB token or ANTHROPIC_API_KEY" }, { status: 500 });
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const preview = Math.min(12, Number(req.nextUrl.searchParams.get("preview") || 0) || 0);

  const [mentionsStore, log, draftStore] = await Promise.all([
    readBlob<{ mentions?: RevenueMention[] }>(MENTIONS_BLOB),
    readBlob<{ posted: PostedEntry[] }>(LOG_BLOB),
    readBlob<DraftStore>(DRAFTS_BLOB),
  ]);
  const posted = (log?.posted ?? []).slice(-300);
  const drafts: DraftStore = draftStore ?? {};

  const stories = buildStories({
    research: research as unknown as ResearchRecord[],
    mentions: mentionsStore?.mentions ?? [],
    posted,
  });

  if (preview) {
    const out = [];
    for (const s of stories.slice(0, preview)) {
      const d = await draftFor(s, drafts);
      out.push({ kind: s.kind, netuid: s.netuid, name: s.name, priority: Math.round(s.priority), at: s.at, cached: d.cached, text: d.text ? composePost(d.text, s.link) : null, reason: d.reason });
    }
    await writeBlob(DRAFTS_BLOB, trimDrafts(drafts));
    return NextResponse.json({ ok: true, preview: true, candidates: stories.length, posts: out });
  }

  if (!stories.length) {
    return NextResponse.json({ ok: true, posted: false, reason: "no qualifying story" });
  }

  // ── Pick the best story that yields an acceptable draft ───────────
  let story: Story | null = null;
  let text = "";
  const rejected: Array<{ fingerprint: string; reason?: string }> = [];
  for (const s of stories.slice(0, 3)) {
    const d = await draftFor(s, drafts);
    if (d.text) { story = s; text = composePost(d.text, s.link); break; }
    rejected.push({ fingerprint: s.fingerprint, reason: d.reason });
  }
  await writeBlob(DRAFTS_BLOB, trimDrafts(drafts));
  if (!story) {
    return NextResponse.json({ ok: true, posted: false, reason: "no story produced an acceptable draft", rejected });
  }

  if (dry) return NextResponse.json({ ok: true, dry: true, kind: story.kind, subnet: story.netuid, text, rejected });

  // ── Guards against X itself; the blobs above are advisory only ────
  const own = await fetchOwnRecentTweets(15);
  if (own === null) {
    return NextResponse.json({ ok: true, posted: false, reason: "timeline unavailable - failing closed" });
  }
  const cooldown = Date.now() - 4 * 3600000;
  if (own.some(t => t.createdAt && new Date(t.createdAt).getTime() > cooldown)) {
    return NextResponse.json({ ok: true, posted: false, reason: "already tweeted this slot per X" });
  }
  for (const t of own) {
    if (similarity(text, t.text) >= 0.7) {
      return NextResponse.json({ ok: true, posted: false, reason: `near-duplicate of live tweet ${t.id}` });
    }
  }

  // ── Close the concurrency window ──────────────────────────────────
  await new Promise(r => setTimeout(r, 5000 + Math.floor(Math.random() * 20000)));
  const own2 = await fetchOwnRecentTweets(5);
  if (own2 === null) {
    return NextResponse.json({ ok: true, posted: false, reason: "recheck timeline unavailable - failing closed" });
  }
  const tenMin = Date.now() - 10 * 60000;
  if (own2.some(t => t.createdAt && new Date(t.createdAt).getTime() > tenMin)) {
    return NextResponse.json({ ok: true, posted: false, reason: "concurrent run posted first - standing down" });
  }

  const result = await postTweet(text);
  if (!result || result.error) {
    return NextResponse.json({ ok: false, reason: "post failed", error: result?.error }, { status: 500 });
  }

  const entry: PostedEntry = { fingerprint: story.fingerprint, netuid: story.netuid, kind: story.kind, text: text.slice(0, 160), postedAt: new Date().toISOString() };
  await writeBlob(LOG_BLOB, { posted: [...posted, entry] });

  console.log(`[twitter-bot] posted ${story.kind} SN${story.netuid} (${result.id})`);
  return NextResponse.json({ ok: true, posted: true, kind: story.kind, subnet: story.netuid, tweet: result.url, rejected });
}

/** Keep the draft cache to the newest 200 entries. */
function trimDrafts(d: DraftStore): DraftStore {
  const entries = Object.entries(d).sort((a, b) => b[1].writtenAt.localeCompare(a[1].writtenAt)).slice(0, 200);
  return Object.fromEntries(entries);
}
