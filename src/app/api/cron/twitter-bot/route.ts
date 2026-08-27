/**
 * GET /api/cron/twitter-bot — 07:00 / 12:00 / 17:00 / 22:00 UTC.
 *
 * COMPLETE REBUILD (2026-08-26). The previous bot generated its own content
 * through nine parallel template paths and had produced, per user reports and
 * screenshots: duplicate pairs seconds apart in the same slot, months-old
 * "we flagged it at $4.11, now $13.65" retrospectives, and interchangeable
 * score-explainer filler. Root causes, in order of damage:
 *
 * 1. CONCURRENT DOUBLE-FIRE. Vercel crons are at-least-once; two invocations
 *    of the same slot occasionally run near-simultaneously. Both generated
 *    their own VARIANT WORDING of the same story (each invocation called the
 *    model independently), so the 70% word-overlap duplicate check could not
 *    catch what the other run had not yet posted. Pairs landed 1-60s apart.
 *
 * 2. A PARALLEL CONTENT PIPELINE. The bot wrote its own posts from raw data
 *    while the feed digest — materiality-gated, plain-language, fingerprint-
 *    deduped — already produced better versions of the same stories. Two
 *    generators, one good, and the bot used the other one.
 *
 * 3. RETROSPECTIVE TEMPLATES. "Evergreen" and "performance gain" paths
 *    existed specifically to re-post old calls. Old slop by construction.
 *
 * The rebuild:
 * - SINGLE SOURCE: the freshest un-posted feed-digest card. No evergreen, no
 *   retrospectives, no benchmark explainers. If there is no fresh card, we
 *   post NOTHING. Silence over slop.
 * - DETERMINISTIC TEXT: the tweet is composed mechanically from the card —
 *   no model call in this route at all. Concurrent duplicate runs therefore
 *   produce BYTE-IDENTICAL text, which the exact-match timeline check
 *   catches with certainty instead of probabilistically.
 * - TIMELINE AS THE ONLY TRUTH: the posted-log blob is advisory (Vercel Blob
 *   is eventually consistent and has burned this exact bot before). Every
 *   run fails closed on an unreadable timeline, enforces the 4h cooldown
 *   from X itself, then sleeps a RANDOM 5-25s and re-checks the live
 *   timeline immediately before sending, so the second of two concurrent
 *   runs sees the first one's tweet.
 */

import { NextRequest, NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";
import { fetchOwnRecentTweets, postTweet } from "@/lib/twitter-bot";
import type { FeedCard } from "@/app/api/cron/feed-digest/route";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
const LOG_BLOB = "twitter-posted-log-v2.json";
const FOOTER = "\n\nalphagap.io $TAO";
const MAX_LEN = 280;

interface PostedEntry { fingerprint: string; netuid: number; text: string; postedAt: string }

async function readBlob<T>(name: string): Promise<T | null> {
  try {
    const b = await blobGet(name, { token: TOKEN, access: "private", abortSignal: AbortSignal.timeout(10000) });
    if (!b?.stream) return null;
    const r = b.stream.getReader(); const cs: Uint8Array[] = [];
    while (true) { const { done, value } = await r.read(); if (done) break; cs.push(value); }
    return JSON.parse(Buffer.concat(cs).toString("utf-8"));
  } catch { return null; }
}

/**
 * Deterministic tweet from a card. Same card in, same bytes out — that
 * property is load-bearing for duplicate detection, not a style choice.
 */
function composeTweet(card: FeedCard): string {
  const bullets = (card.bullets ?? []).filter(Boolean);
  const head = `${card.name} (SN${card.netuid}): ${card.headline}`;
  let body = "";
  for (const b of bullets) {
    const candidate = body ? `${body}\n\n${b}` : b;
    if ((head + "\n\n" + candidate + FOOTER).length <= MAX_LEN) body = candidate;
    else break;
  }
  if (!body && card.body) {
    const room = MAX_LEN - head.length - FOOTER.length - 2;
    if (room > 60) body = card.body.slice(0, room - 1).replace(/\s+\S*$/, "") + ".";
  }
  return body ? `${head}\n\n${body}${FOOTER}` : `${head}${FOOTER}`;
}

const words = (t: string) => new Set(t.toLowerCase().replace(/https?:\/\/\S+/g, "").split(/\W+/).filter(w => w.length > 3));
function similarity(a: string, b: string): number {
  const wa = words(a), wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let n = 0; for (const w of wa) if (wb.has(w)) n++;
  return n / Math.min(wa.size, wb.size);
}

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!isVercelCron && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";

  // ── Pick the freshest un-posted card ─────────────────────────────
  const [cards, log] = await Promise.all([
    readBlob<FeedCard[]>("feed-digest.json"),
    readBlob<{ posted: PostedEntry[] }>(LOG_BLOB),
  ]);
  const posted = (log?.posted ?? []).slice(-300);
  const postedFp = new Set(posted.map(p => p.fingerprint));
  const dayAgo = Date.now() - 24 * 3600000;
  // One story per subnet per 5 days, even if its facts (and fingerprint)
  // evolve — the account should not orbit the same subnet.
  const subnetCutoff = Date.now() - 5 * 24 * 3600000;
  const recentSubnets = new Set(posted.filter(p => new Date(p.postedAt).getTime() > subnetCutoff).map(p => p.netuid));

  const candidates = (cards ?? [])
    .filter(c => new Date(c.writtenAt).getTime() > dayAgo)
    .filter(c => !postedFp.has(c.fingerprint))
    .filter(c => !recentSubnets.has(c.netuid))
    .sort((a, b) => b.materiality - a.materiality);

  if (!candidates.length) {
    // Silence over slop: no fresh card means no tweet this slot.
    return NextResponse.json({ ok: true, posted: false, reason: "no fresh un-posted card" });
  }
  const card = candidates[0];
  const text = composeTweet(card);

  if (dry) return NextResponse.json({ ok: true, dry: true, card: card.netuid, text });

  // ── Guards against X itself; the blob log above is advisory only ──
  const own = await fetchOwnRecentTweets(15);
  if (own === null) {
    return NextResponse.json({ ok: true, posted: false, reason: "timeline unavailable — failing closed" });
  }
  const cooldown = Date.now() - 4 * 3600000;
  const recent = own.find(t => t.createdAt && new Date(t.createdAt).getTime() > cooldown);
  if (recent) {
    return NextResponse.json({ ok: true, posted: false, reason: "already tweeted this slot per X" });
  }
  for (const t of own) {
    if (similarity(text, t.text) >= 0.7) {
      return NextResponse.json({ ok: true, posted: false, reason: `near-duplicate of live tweet ${t.id}` });
    }
  }

  // ── Close the concurrency window ─────────────────────────────────
  // Two at-least-once invocations pass the checks above together because
  // neither has posted yet. A random stagger breaks the tie: the earlier
  // sleeper posts; the later one re-reads the timeline and sees it. Text
  // is deterministic, so even a residual race produces an identical tweet,
  // which X itself rejects as a duplicate status.
  await new Promise(r => setTimeout(r, 5000 + Math.floor(Math.random() * 20000)));
  const own2 = await fetchOwnRecentTweets(5);
  if (own2 === null) {
    return NextResponse.json({ ok: true, posted: false, reason: "recheck timeline unavailable — failing closed" });
  }
  const tenMin = Date.now() - 10 * 60000;
  if (own2.some(t => t.createdAt && new Date(t.createdAt).getTime() > tenMin)) {
    return NextResponse.json({ ok: true, posted: false, reason: "concurrent run posted first — standing down" });
  }

  const result = await postTweet(text);
  if (!result || result.error) {
    return NextResponse.json({ ok: false, reason: "post failed", error: result?.error }, { status: 500 });
  }

  const entry: PostedEntry = { fingerprint: card.fingerprint, netuid: card.netuid, text: text.slice(0, 140), postedAt: new Date().toISOString() };
  await put(LOG_BLOB, JSON.stringify({ posted: [...posted, entry] }), {
    access: "private", addRandomSuffix: false, allowOverwrite: true, token: TOKEN, contentType: "application/json",
  }).catch(() => {});

  console.log(`[twitter-bot] posted SN${card.netuid} (${result.id})`);
  return NextResponse.json({ ok: true, posted: true, tweet: result.url, subnet: card.netuid });
}
