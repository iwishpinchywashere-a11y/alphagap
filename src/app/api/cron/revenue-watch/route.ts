/**
 * GET /api/cron/revenue-watch  (daily)
 *
 * Reads the official X account of every subnet we have a handle for and
 * flags posts that talk about revenue, run rate, billing, paying customers
 * or alpha buybacks. Teams increasingly publish these as graphics (Lium's
 * "month in review" carries the $ figure only in the image), so a matched
 * post's images are read with Claude vision and the figures extracted.
 *
 * Output:
 *   - revenue-mentions.json (blob): every flagged post with extracted figures,
 *     90-day window, deduped by post id. /api/valuation joins it so the
 *     Revenue & Valuations page can show "from the team's X" under each row.
 *   - an owner email when a post carries a figure that is newer than, or
 *     differs from, the valuation record. The record itself is only changed
 *     by hand with a source URL (see memory: never edit valuation.json blind).
 *
 * ?dry=1 skips the blob write and the email. ?days=N widens the lookback.
 */

import { NextRequest, NextResponse } from "next/server";
import { put, get as blobGet } from "@vercel/blob";
import research from "@/data/valuation.json";
import { resolveSubnetHandles } from "@/lib/subnet-x-handles";
import { sendSystemAlertEmail } from "@/lib/email";
import type { ResearchRecord } from "@/lib/valuation";
import type { RevenueFigures, RevenueMention } from "@/lib/revenue-mentions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DESEARCH_API = "https://api.desearch.ai";
const DESEARCH_KEY = process.env.DESEARCH_API_KEY || "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const BLOB = "revenue-mentions.json";
const KEEP_DAYS = 90;

// Words a revenue / buyback announcement is likely to carry. "$" alone would
// match every $TAO mention, so a dollar sign must be followed by a digit.
const REVENUE_RE = /\b(revenue|ARR|MRR|run[- ]?rate|annuali[sz]ed|billed|billings?|invoiced|GPU spend|spend(?:ing)?\s+(?:grew|up|hit|reached|of)|month(?:ly)? in review|monthly metrics|paying customers|renters|customers? paid|buy[- ]?backs?|bought back|burn(?:ed|t)?\s+(?:\$|\d|[\d,.]+\s*(?:alpha|TAO|\$)|and)|GMV|gross merchandise|net revenue|top[- ]line)\b|\$\s?\d[\d,.]*\s?(?:k|K|m|M|B|bn)?\b/;

interface DPost {
  id: string;
  text: string;
  created_at: string;
  url?: string;
  user?: { username?: string; name?: string };
  media?: Array<{ media_url?: string; type?: string }>;
  like_count?: number;
  view_count?: number;
  is_retweet?: boolean;
  retweet?: unknown;
}

interface Store { updatedAt: string; mentions: RevenueMention[]; seen: Record<string, string> }

async function readStore(token: string): Promise<Store> {
  try {
    const b = await blobGet(BLOB, { token, access: "private", abortSignal: AbortSignal.timeout(8000) });
    if (!b?.stream) throw new Error("none");
    return JSON.parse(await new Response(b.stream).text());
  } catch { return { updatedAt: "", mentions: [], seen: {} }; }
}

/** Registry handles come from the scan's identity cache (6h refresh). */
async function readIdentities(token: string): Promise<Array<{ netuid: number; twitter: string | null }>> {
  try {
    const b = await blobGet("identity-cache.json", { token, access: "private", abortSignal: AbortSignal.timeout(8000) });
    if (!b?.stream) return [];
    return JSON.parse(await new Response(b.stream).text());
  } catch { return []; }
}

let desearchCostUsd = 0;   // Desearch reports cost_usd per call; summed for the run log

async function fetchPosts(handle: string, count: number): Promise<DPost[]> {
  try {
    const params = new URLSearchParams({ username: handle, count: String(count) });
    const res = await fetch(`${DESEARCH_API}/twitter/user/posts?${params}`, {
      headers: { Authorization: DESEARCH_KEY }, signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    // Desearch wraps the timeline as { user, tweets } (older docs said posts/results)
    if (typeof data?.cost_usd === "number") desearchCostUsd += data.cost_usd;
    if (Array.isArray(data)) return data;
    for (const k of ["tweets", "posts", "results"]) if (Array.isArray(data?.[k])) return data[k];
    return [];
  } catch { return []; }
}

/** Ask Claude to pull the numbers out of the post text and any attached graphics. */
async function extractFigures(text: string, images: string[], name: string): Promise<RevenueFigures | null> {
  if (!ANTHROPIC_KEY) return null;
  const content: Array<Record<string, unknown>> = [];
  for (const url of images.slice(0, 2)) content.push({ type: "image", source: { type: "url", url } });
  content.push({ type: "text", text:
`This is a post from the official X account of ${name}, a Bittensor subnet. Extract any business figures it states, from the text AND the image(s).

Return ONLY a JSON object:
{"period": string|null, "revenue_usd": number|null, "revenue_period": "week"|"month"|"30d"|"quarter"|"year"|null, "arr_usd": number|null, "customers": number|null, "buyback_usd": number|null, "summary": string}

Rules:
- revenue_usd is money the business took in (spend, billed, revenue, GMV) for the stated period; arr_usd only if the post itself states an annualised / run-rate figure. Never derive one from the other.
- Token price, market cap, emissions, TAO staked are NOT revenue: leave the fields null.
- buyback_usd is dollars of the subnet's own alpha bought back or burned with revenue.
- summary: one plain sentence with the figures and the period, no adjectives. If there are no business figures, every number is null and summary says what the post is about.

Post text:
"""${text.slice(0, 1500)}"""` });
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 400, messages: [{ role: "user", content }] }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = (data.content?.[0]?.text || "").replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    const j = JSON.parse(raw);
    const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);
    return {
      period: typeof j.period === "string" ? j.period : null,
      revenue_usd: num(j.revenue_usd), revenue_period: typeof j.revenue_period === "string" ? j.revenue_period : null,
      arr_usd: num(j.arr_usd), customers: num(j.customers), buyback_usd: num(j.buyback_usd),
      summary: String(j.summary || "").replace(/\u2014/g, "-").slice(0, 300),
    };
  } catch { return null; }
}

function impliedArr(f: RevenueFigures | null): number | null {
  if (!f) return null;
  if (f.revenue_usd != null) {
    switch (f.revenue_period) {
      case "week": return f.revenue_usd * 52;
      case "month": case "30d": return f.revenue_usd * 12;
      case "quarter": return f.revenue_usd * 4;
      case "year": return f.revenue_usd;
    }
  }
  return f.arr_usd;
}

const fmtUsd = (n: number | null) => n == null ? "-" : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`;

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const secret = process.env.CRON_SECRET;
  if (!isVercelCron && secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!DESEARCH_KEY) return NextResponse.json({ error: "No DESEARCH_API_KEY" }, { status: 500 });

  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  desearchCostUsd = 0;
  const store = await readStore(token);
  // First run looks back a month so the current month-in-review posts are caught; after that, 8 days.
  const days = Number(req.nextUrl.searchParams.get("days")) || (store.updatedAt ? 8 : 30);
  const since = Date.now() - days * 86_400_000;

  const records = new Map((research as unknown as ResearchRecord[]).map(r => [r.netuid, r]));
  const identities = await readIdentities(token);
  const handles = resolveSubnetHandles(identities);
  // Skip dead slots; a departed team's account would otherwise be read as the new tenant's.
  for (const [n] of handles) { const r = records.get(n); if (!r || r.status === "dead") handles.delete(n); }

  const found: RevenueMention[] = [];
  let scanned = 0, posts = 0, llmCalls = 0;
  const entries = [...handles.entries()];
  for (let i = 0; i < entries.length; i += 5) {
    await Promise.all(entries.slice(i, i + 5).map(async ([netuid, handle]) => {
      const list = await fetchPosts(handle, 20);
      scanned++;
      for (const p of list) {
        posts++;
        if (!p?.id || p.is_retweet || p.retweet) continue;
        const t = new Date(p.created_at).getTime();
        if (!isFinite(t) || t < since || store.seen[p.id]) continue;
        const text = (p.text || "").trim();
        const images = (p.media || []).filter(m => m.type === "photo" && m.media_url).map(m => m.media_url!);
        if (!REVENUE_RE.test(text) && !/review|metrics|update|recap|numbers|stats/i.test(text)) continue;
        if (!REVENUE_RE.test(text) && images.length === 0) continue;   // "update" with no image: not worth a vision call
        const r = records.get(netuid)!;
        const figures = await extractFigures(text, images, r.name); llmCalls++;
        const implied = impliedArr(figures);
        const hasFigure = !!figures && (figures.revenue_usd != null || figures.arr_usd != null || figures.buyback_usd != null);
        if (!hasFigure && !REVENUE_RE.test(text)) continue;             // vision found nothing and the text was only "update"
        const recArr = r.revenue.arr_usd ?? null;
        const newer = !r.revenue.as_of || p.created_at && new Date(p.created_at) > new Date(r.revenue.as_of);
        const differs = implied != null && (recArr == null || Math.abs(implied - recArr) / Math.max(recArr, 1) > 0.15);
        found.push({
          id: String(p.id), netuid, name: r.name, handle,
          url: p.url || `https://x.com/${handle}/status/${p.id}`,
          postedAt: new Date(t).toISOString(), text: text.slice(0, 400), images,
          figures, impliedArrUsd: implied, recordArrUsd: recArr, recordAsOf: r.revenue.as_of ?? null,
          flag: hasFigure && (newer || differs) ? "new_figure" : "mention",
          seenAt: new Date().toISOString(),
        });
      }
    }));
  }

  // Merge, prune, persist
  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  const mentions = [...found, ...store.mentions].filter(m => new Date(m.postedAt).getTime() > cutoff)
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  const seen: Record<string, string> = {};
  for (const [id, ts] of Object.entries(store.seen)) if (new Date(ts).getTime() > cutoff) seen[id] = ts;
  for (const m of found) seen[m.id] = m.postedAt;
  if (!dry && token) {
    await put(BLOB, JSON.stringify({ updatedAt: new Date().toISOString(), mentions, seen } satisfies Store), {
      access: "private", token, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
    });
  }

  // Owner digest: only posts that carry a figure we do not have yet
  const alerts = found.filter(m => m.flag === "new_figure");
  if (alerts.length && !dry) {
    const lines = alerts.map(m =>
      `<b>SN${m.netuid} ${m.name}</b> (@${m.handle}, ${m.postedAt.slice(0, 10)}): ${m.figures?.summary || m.text.slice(0, 160)}` +
      ` - implied ARR ${fmtUsd(m.impliedArrUsd)}${m.figures?.arr_usd ? ` (team states ${fmtUsd(m.figures.arr_usd)})` : ""}` +
      ` vs our record ${fmtUsd(m.recordArrUsd)} as of ${m.recordAsOf ?? "?"}. <a href="${m.url}">post</a>`);
    lines.push("Records are not changed automatically: verify the post, then update src/data/valuation.json with the URL as the source.");
    await sendSystemAlertEmail(`${alerts.length} subnet revenue post${alerts.length > 1 ? "s" : ""} to review`, lines).catch(e => console.error("[revenue-watch] email failed", e));
  }

  console.log(`[revenue-watch] handles ${scanned}, posts ${posts}, matched ${found.length}, alerts ${alerts.length}, vision calls ${llmCalls}, desearch $${desearchCostUsd.toFixed(3)}`);
  return NextResponse.json({ ok: true, dry, days, handles: scanned, posts, matched: found.length, alerts: alerts.length, visionCalls: llmCalls, desearchCostUsd: Math.round(desearchCostUsd * 1000) / 1000,
    found: found.map(m => ({ netuid: m.netuid, name: m.name, postedAt: m.postedAt, flag: m.flag, impliedArrUsd: m.impliedArrUsd, recordArrUsd: m.recordArrUsd, summary: m.figures?.summary, url: m.url })) });
}
