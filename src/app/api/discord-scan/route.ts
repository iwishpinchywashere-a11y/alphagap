// Discord Alpha Scanner — reads Bittensor subnet channels and classifies the chatter
// Runs as a cron (once per day) or on-demand via GET /api/discord-scan
// Results cached in Vercel Blob as discord-latest.json

import { NextResponse } from "next/server";
import { put, get } from "@vercel/blob";
import {
  fetchGuildChannels,
  fetchChannelMessages,
  fetchMessageById,
  filterSubnetChannels,
  parseNetuidFromChannel,
  getHoursAgoSnowflake,
  type DiscordAlphaResult,
  type DiscordMessage,
} from "@/lib/discord";
import { queryTaofluteMessages, type TaofluteMessage } from "@/lib/taoflute";

export const dynamic = "force-dynamic";
export const maxDuration = 240; // 4 min — fits Vercel Pro limit comfortably

async function readBlob<T>(name: string): Promise<T | null> {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return null;
    const result = await get(name, { token, access: "private" });
    if (!result?.stream) return null;
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch { return null; }
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";

// ── Bittensor Founder tracking ────────────────────────────────────────────────
// Const's known Discord usernames (case-insensitive, add more if display name changes)
// Match on username (account handle) AND global_name (display name).
// Const's display name is "const [τ, τ]" — username may differ; we catch both.
// Any account whose username OR display name starts with "const" is treated as the founder.
const FOUNDER_USERNAMES = new Set(["consttt", "constt", "const", "const.tt"]);
// Discord user IDs never change — more reliable than name matching
const FOUNDER_USER_IDS = new Set<string>([
  "229609371013029888", // const [τ, τ] — confirmed from live Bittensor Discord messages
]);

// Prioritise channels we can map to a netuid — keep under timeout budget
// 120 × (80ms delay + ~300ms fetch) ≈ 45s fetch + ~100s AI = ~145s well under 4min limit
const MAX_CHANNELS = 120;
// Messages per channel — Discord API hard cap is 100; keep at 100
const MESSAGES_PER_CHANNEL = 100;
// Minimum messages to bother analyzing — 1 so no channel with any activity is skipped
const MIN_MESSAGES_TO_ANALYZE = 1;
// Delay between channel fetches (ms)
const RATE_LIMIT_DELAY = 80;
// Founder post lookback window — longer than the regular 24h scan so we don't miss posts
// when the cron hiccups or Const posts outside the normal scan window
const FOUNDER_LOOKBACK_HOURS = 72;
// Minimum entries to surface on the social page — if below this, relax signal thresholds
const MIN_ENTRIES_TARGET = 10;
// Extra general/announcement channels to scan for Const posts (name substrings)
const FOUNDER_CHANNEL_PATTERNS = [
  "general", "announce", "ecosystem", "governance", "core-team",
  "const", "update", "news", "dev-chat", "builders", "official",
];
const MAX_FOUNDER_CHANNELS = 20;

// ── Deleted message detection ────────────────────────────────────────────────

export interface DeletedMessageResult {
  id: string;            // = messageId (dedup key)
  messageId: string;
  channelId: string;
  channelName: string;
  netuid: number | null;
  subnetName: string;
  content: string;
  username: string;
  postedAt: string;
  detectedAt: string;
  significant: boolean;
  sinister: boolean;     // legal/security/exit risk — triggers aGap penalty
  significance: string;  // AI explanation of why it matters
}

/**
 * Cross-reference taoflute's archive against our current Discord fetch.
 * Messages in taoflute but 404 on Discord = confirmed deleted.
 * AI classifies which deletions are worth surfacing.
 */
async function detectDeletedMessages(
  channelScans: Array<{
    channelId: string;
    channelName: string;
    netuid: number | null;
    messages: DiscordMessage[];
    founderOnly?: boolean;
  }>,
  token: string,
  alreadyProcessedIds: Set<string>
): Promise<DeletedMessageResult[]> {
  // Only scan mapped-subnet channels (less noise)
  const relevant = channelScans.filter(c => !c.founderOnly && c.netuid != null).slice(0, 60);
  if (relevant.length === 0) return [];

  const channelIds = relevant.map(c => c.channelId);

  // Query taoflute for messages from the last 36h in these channels
  const taofluteMessages = await queryTaofluteMessages(channelIds, 36);
  if (taofluteMessages.length === 0) return [];

  // Build set of message IDs we currently see on Discord
  const seenIds = new Set<string>();
  for (const scan of relevant) {
    for (const msg of scan.messages) seenIds.add(msg.id);
  }

  const channelMap = new Map(relevant.map(c => [c.channelId, c]));
  const cutoffMs = Date.now() - 36 * 60 * 60 * 1000;

  // Candidates: in taoflute but not in our Discord fetch
  const candidates = taofluteMessages.filter(tm => {
    if (seenIds.has(tm.messageId))           return false; // still live
    if (alreadyProcessedIds.has(tm.messageId)) return false; // already handled
    if (tm.content.length < 20)              return false; // too short
    const uname = tm.username.toLowerCase();
    if (uname.includes("bot") || uname.includes("webhook")) return false;
    if (tm.timestamp && new Date(tm.timestamp).getTime() < cutoffMs) return false;
    return true;
  });

  if (candidates.length === 0) return [];

  // Verify up to 25 candidates with Discord single-message API (rate-limit: 200ms gap)
  const MAX_VERIFY = 25;
  const confirmed: TaofluteMessage[] = [];

  for (const candidate of candidates.slice(0, MAX_VERIFY)) {
    const result = await fetchMessageById(token, candidate.channelId, candidate.messageId);
    if (result === "deleted") confirmed.push(candidate);
    await new Promise(r => setTimeout(r, 200));
  }

  if (confirmed.length === 0) return [];

  // AI classify confirmed deletions
  return classifyDeletedMessages(confirmed, channelMap);
}

async function classifyDeletedMessages(
  messages: TaofluteMessage[],
  channelMap: Map<string, { channelName: string; netuid: number | null }>
): Promise<DeletedMessageResult[]> {
  if (!ANTHROPIC_KEY || messages.length === 0) return [];

  const items = messages
    .map((m, i) => {
      const ch = channelMap.get(m.channelId);
      return `[${i}] Channel: #${ch?.channelName ?? m.channelId} | User: @${m.username} | Posted: ${m.timestamp}\nContent: "${m.content.slice(0, 500)}"`;
    })
    .join("\n\n");

  const prompt = `You are a Bittensor subnet intelligence analyst. Below are Discord messages that were DELETED from subnet channels after being posted.

${items}

For each message, determine if it's significant enough to surface to investors. Most deletions are NOT significant — be conservative. Only flag something if you are confident it would matter to a Bittensor investor.

SIGNIFICANT: Team/founders deleting disclosures, deleted partnership announcements, security warnings, legal/regulatory mentions, exit signals, explicit "don't share this" content, revealing project problems.
NOT SIGNIFICANT: Typo corrections, spam removal, casual chat, test messages, normal bot deletions.

SINISTER: Only true if content strongly suggests legal trouble, security exploit/hack, rug pull risk, insider trading, or deliberate cover-up of bad news.

Respond with a JSON array (one object per message, same order):
[
  {
    "index": 0,
    "significant": false,
    "sinister": false,
    "significance": "One sentence explaining why this is or isn't noteworthy (max 120 chars)"
  }
]

Rules:
- Be VERY conservative — false positives hurt trust. If in doubt: significant=false.
- sinister=true ONLY when there is strong evidence of harm to investors.
- Respond with ONLY the JSON array.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return buildUnclassifiedResults(messages, channelMap);

    const data = await res.json();
    const text = (data.content?.[0]?.text || "[]").replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed: Array<{ index: number; significant: boolean; sinister: boolean; significance: string }> =
      JSON.parse(text);

    const detectedAt = new Date().toISOString();
    return messages.map((m, i) => {
      const ai = parsed.find(p => p.index === i) ?? { significant: false, sinister: false, significance: "" };
      const ch = channelMap.get(m.channelId);
      return {
        id: m.messageId,
        messageId: m.messageId,
        channelId: m.channelId,
        channelName: ch?.channelName ?? "",
        netuid: ch?.netuid ?? null,
        subnetName: ch ? formatSubnetName(ch.channelName) : `SN?`,
        content: m.content,
        username: m.username,
        postedAt: m.timestamp,
        detectedAt,
        significant: ai.significant,
        sinister: ai.sinister,
        significance: ai.significance,
      };
    });
  } catch (e) {
    console.error("[discord-scan] Deleted classification error:", e);
    return buildUnclassifiedResults(messages, channelMap);
  }
}

function buildUnclassifiedResults(
  messages: TaofluteMessage[],
  channelMap: Map<string, { channelName: string; netuid: number | null }>
): DeletedMessageResult[] {
  const detectedAt = new Date().toISOString();
  return messages.map(m => {
    const ch = channelMap.get(m.channelId);
    return {
      id: m.messageId, messageId: m.messageId, channelId: m.channelId,
      channelName: ch?.channelName ?? "", netuid: ch?.netuid ?? null,
      subnetName: ch ? formatSubnetName(ch.channelName) : "",
      content: m.content, username: m.username, postedAt: m.timestamp,
      detectedAt, significant: false, sinister: false, significance: "",
    };
  });
}

export async function GET() {
  if (!DISCORD_TOKEN) {
    return NextResponse.json({ error: "DISCORD_TOKEN not configured" }, { status: 500 });
  }

  try {
    console.log("[discord-scan] Starting Discord channel scan...");

    // 1. Fetch all channels in the Bittensor guild
    const allChannels = await fetchGuildChannels(DISCORD_TOKEN);
    const subnetChannels = filterSubnetChannels(allChannels);

    console.log(`[discord-scan] Found ${allChannels.length} total channels, ${subnetChannels.length} subnet channels`);

    // Sort: prioritize channels we can map to a netuid
    const sorted = subnetChannels.sort((a, b) => {
      const aHasNetuid = parseNetuidFromChannel(a.name) !== null ? 1 : 0;
      const bHasNetuid = parseNetuidFromChannel(b.name) !== null ? 1 : 0;
      return bHasNetuid - aHasNetuid;
    });

    const channelsToScan = sorted.slice(0, MAX_CHANNELS);
    // Fetch 72h of messages — the full window needed for founder post detection.
    // Regular AI analysis uses only the 24h subset; founder scan uses all 72h.
    // This catches Const's posts even if the cron missed a run or two.
    const afterSnowflake72h = getHoursAgoSnowflake(FOUNDER_LOOKBACK_HOURS);
    // AI analysis window: 48h so team announcements posted yesterday aren't missed.
    // High-reaction messages (≥15 total reactions) are promoted up to 72h.
    const cutoff48h = Date.now() - 48 * 60 * 60 * 1000;
    const cutoff72h = Date.now() - 72 * 60 * 60 * 1000;

    // 2a. Identify general/announcement channels for founder-only scanning
    // These channels are NOT analyzed for alpha (skipped in AI batch) but ARE
    // included in analyzeFounderPosts so Const posts there are never missed.
    const subnetChannelIds = new Set(channelsToScan.map(c => c.id));
    const founderExtraChannels = allChannels
      .filter(ch => (ch.type === 0 || ch.type === 5) && !subnetChannelIds.has(ch.id))
      .filter(ch => {
        const name = ch.name.toLowerCase();
        return FOUNDER_CHANNEL_PATTERNS.some(p => name.includes(p));
      })
      .slice(0, MAX_FOUNDER_CHANNELS);

    console.log(`[discord-scan] Also scanning ${founderExtraChannels.length} general channels for founder posts`);

    // 2b. Fetch messages from each channel
    const channelScans: Array<{
      channelId: string;
      channelName: string;
      netuid: number | null;
      messages: DiscordMessage[];
      founderOnly?: boolean; // true = skip AI batch analysis, founder detection only
    }> = [];

    for (const channel of channelsToScan) {
      try {
        const messages = await fetchChannelMessages(DISCORD_TOKEN, channel.id, {
          limit: MESSAGES_PER_CHANNEL,
          after: afterSnowflake72h,
        });

        channelScans.push({
          channelId: channel.id,
          channelName: channel.name,
          netuid: parseNetuidFromChannel(channel.name),
          messages,
        });

        // Small delay between requests
        await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));
      } catch (e) {
        console.error(`[discord-scan] Failed to fetch ${channel.name}:`, e);
      }
    }

    // Fetch general channels (founder detection only — no AI batch)
    for (const channel of founderExtraChannels) {
      try {
        const messages = await fetchChannelMessages(DISCORD_TOKEN, channel.id, {
          limit: 50,
          after: afterSnowflake72h,
        });
        channelScans.push({
          channelId: channel.id,
          channelName: channel.name,
          netuid: null,
          messages,
          founderOnly: true,
        });
        await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));
      } catch (e) {
        console.error(`[discord-scan] Failed to fetch general channel ${channel.name}:`, e);
      }
    }

    // For AI analysis, include messages from the last 48h (expanded from 24h so that
    // high-signal announcements posted yesterday aren't silently dropped).
    // Additionally, any message with ≥15 total reactions is included up to 72h —
    // high community engagement is a strong signal regardless of age.
    // Exclude founderOnly channels — those are for Const detection only, not AI batch.
    const channelScans24h = channelScans
      .filter(c => !c.founderOnly)
      .map(c => ({
        ...c,
        messages: c.messages.filter(m => {
          const ts = new Date(m.timestamp).getTime();
          if (ts >= cutoff48h) return true; // within 48h → always include
          // High-reaction messages (≥15 total) included up to 72h
          const totalReactions = (m.reactions ?? []).reduce((s: number, r: { count: number }) => s + r.count, 0);
          if (ts >= cutoff72h && totalReactions >= 15) return true;
          return false;
        }),
      }));

    // 3. Filter to channels with enough activity
    const activeChannels = channelScans24h.filter(c => c.messages.length >= MIN_MESSAGES_TO_ANALYZE);
    console.log(`[discord-scan] ${activeChannels.length} channels have ${MIN_MESSAGES_TO_ANALYZE}+ messages in last 24h`);

    // 4. Batch AI analysis — group channels into batches of 6
    // (smaller batches prevent max_tokens truncation of the JSON response)
    const results: DiscordAlphaResult[] = [];
    const BATCH_SIZE = 6;
    // Time budget: bail out of AI batching if we're within 30s of the 240s hard limit
    const scanStart = Date.now();
    const AI_BUDGET_MS = 200_000; // 200s for AI (leaves 40s for fetching + overhead)

    for (let i = 0; i < activeChannels.length; i += BATCH_SIZE) {
      if (Date.now() - scanStart > AI_BUDGET_MS) {
        console.warn(`[discord-scan] Time budget reached — skipping remaining ${activeChannels.length - i} channels`);
        // Add fallback results for skipped channels
        for (const ch of activeChannels.slice(i)) results.push(fallbackResult(ch));
        break;
      }
      const batch = activeChannels.slice(i, i + BATCH_SIZE);
      const batchResults = await analyzeBatch(batch);
      results.push(...batchResults);
    }

    // ── Founder post detection (full 72h window) ───────────────────────────────
    // Returns one entry per channel Const posted in, pinned to the top.
    const founderResults = await analyzeFounderPosts(channelScans);
    if (founderResults.length > 0) {
      results.unshift(...founderResults); // pin all founder entries to top
      console.log(`[discord-scan] ${founderResults.length} founder channel entry(s) added`);
    }

    // Add quiet channels (no messages) as "quiet" without AI analysis
    for (const scan of channelScans24h) {
      if (scan.messages.length < MIN_MESSAGES_TO_ANALYZE) {
        results.push({
          channelId: scan.channelId,
          channelName: scan.channelName,
          netuid: scan.netuid,
          subnetName: formatSubnetName(scan.channelName),
          signal: "quiet",
          alphaScore: 0,
          summary: "No significant activity in the last 24 hours.",
          keyInsights: [],
          messageCount: scan.messages.length,
          uniquePosters: 0,
          scannedAt: new Date().toISOString(),
        });
      }
    }

    // Sort results: alpha first, then active, quiet, noise
    const signalOrder = { alpha: 0, active: 1, quiet: 2, noise: 3 };
    results.sort((a, b) => signalOrder[a.signal] - signalOrder[b.signal]);

    // ── Minimum 10 entries guarantee ─────────────────────────────────
    // If we have fewer than MIN_ENTRIES_TARGET alpha/active entries,
    // promote the best quiet channels (by message count) to "active"
    // so the social page always has enough to show.
    const surfaceable = results.filter(r => r.signal === "alpha" || r.signal === "active");
    if (surfaceable.length < MIN_ENTRIES_TARGET) {
      const deficit = MIN_ENTRIES_TARGET - surfaceable.length;
      const promotable = results
        .filter(r => r.signal === "quiet" && r.messageCount >= 1)
        .sort((a, b) => b.messageCount - a.messageCount)
        .slice(0, deficit);
      for (const entry of promotable) {
        entry.signal = "active";
        entry.alphaScore = Math.max(entry.alphaScore ?? 0, 10);
        if (!entry.summary || entry.summary.includes("No significant")) {
          entry.summary = `${entry.messageCount} messages from ${entry.uniquePosters} community members in the last 24h.`;
        }
      }
      console.log(`[discord-scan] Promoted ${promotable.length} quiet channels to meet minimum ${MIN_ENTRIES_TARGET} entries`);
      results.sort((a, b) => signalOrder[a.signal] - signalOrder[b.signal]);
    }

    // 5. Re-inject any manual entries from the previous blob so they survive the scan.
    // Manual entries (manualEntry: true) are written by hand and must not be overwritten
    // by automated scans. We merge them back in, skipping any whose netuid was just scanned.
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const prev = await readBlob<{ results: Array<Record<string, unknown>> }>("discord-latest.json");
        if (prev?.results) {
          const scannedNetuids = new Set(results.map(r => r.netuid));
          const manualEntries = prev.results.filter(
            r => r.manualEntry === true && !scannedNetuids.has(r.netuid as number)
          );
          if (manualEntries.length > 0) {
            console.log(`[discord-scan] Preserving ${manualEntries.length} manual entries`);
            results.push(...(manualEntries as unknown as DiscordAlphaResult[]));
          }
        }
      } catch { /* non-critical */ }
    }

    // Sort again after re-injecting manual entries
    const signalOrder2 = { alpha: 0, active: 1, quiet: 2, noise: 3 };
    results.sort((a, b) => signalOrder2[a.signal] - signalOrder2[b.signal]);

    // 6. Deleted message detection (runs only if we have time/token budget)
    // Adds at most ~20s: taoflute query + up to 25 × 200ms Discord verifications + AI
    const DELETED_SCAN_BUDGET_MS = 200_000; // only run if < 200s elapsed
    if (process.env.BLOB_READ_WRITE_TOKEN && Date.now() - scanStart < DELETED_SCAN_BUDGET_MS) {
      try {
        const prevDeleted = await readBlob<{ messages: DeletedMessageResult[] }>("discord-deleted.json");
        const alreadyProcessedIds = new Set((prevDeleted?.messages ?? []).map(m => m.id));

        console.log("[discord-scan] Running deleted message detection...");
        const delStart = Date.now();
        const newDeleted = await detectDeletedMessages(channelScans, DISCORD_TOKEN, alreadyProcessedIds);
        const significant = newDeleted.filter(d => d.significant).length;
        console.log(`[discord-scan] Deleted detection: ${newDeleted.length} verified, ${significant} significant (${Date.now() - delStart}ms)`);

        // Merge with previous — keep 7-day rolling window, dedup by messageId
        const cutoff7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const prev = (prevDeleted?.messages ?? []).filter(m => new Date(m.detectedAt).getTime() > cutoff7d);
        const existingIds = new Set(prev.map(m => m.id));
        const merged = [...prev, ...newDeleted.filter(m => !existingIds.has(m.id))];

        await put("discord-deleted.json", JSON.stringify({ updatedAt: new Date().toISOString(), messages: merged }), {
          access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
        });
      } catch (e) {
        console.error("[discord-scan] Deleted detection failed (non-fatal):", e);
      }
    }

    // 7. Save to blob
    const output = {
      scannedAt: new Date().toISOString(),
      channelsScanned: channelsToScan.length,
      channelsWithActivity: activeChannels.length,
      alphaChannels: results.filter(r => r.signal === "alpha").length,
      results,
    };

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      await put("discord-latest.json", JSON.stringify(output), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      console.log("[discord-scan] Saved discord-latest.json to blob");

      // Alert scanner is NOT triggered here — it runs on its own 5-min cron only.
    }

    return NextResponse.json({
      ok: true,
      channelsScanned: output.channelsScanned,
      channelsWithActivity: output.channelsWithActivity,
      alphaChannels: output.alphaChannels,
      topAlpha: results.filter(r => r.signal === "alpha").map(r => ({
        channel: r.channelName,
        netuid: r.netuid,
        summary: r.summary,
      })),
    });

  } catch (e) {
    console.error("[discord-scan] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST for reading cached results (used by dashboard)
export async function POST() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "No blob storage" }, { status: 500 });
    }

    const result = await get("discord-latest.json", {
      token: process.env.BLOB_READ_WRITE_TOKEN!,
      access: "private",
    });

    if (!result?.stream) {
      return NextResponse.json({ results: [], scannedAt: null });
    }

    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const data = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ── AI Analysis ──────────────────────────────────────────────────────────────

async function analyzeBatch(
  channels: Array<{
    channelId: string;
    channelName: string;
    netuid: number | null;
    messages: DiscordMessage[];
  }>
): Promise<DiscordAlphaResult[]> {
  if (!ANTHROPIC_KEY || channels.length === 0) return [];

  // Build the prompt with all channels in one call
  const channelTexts = channels.map(ch => {
    const uniquePosters = new Set(ch.messages.map(m => m.author.username)).size;
    const recentMsgs = ch.messages
      .filter(m => !m.author.bot) // skip bots
      .slice(-30) // last 30 human messages
      .map(m => {
        const reactions = m.reactions?.map(r => `${r.emoji.name}×${r.count}`).join(" ") || "";
        const embed = m.embeds?.[0];
        const embedText = embed ? ` [embed: ${embed.title || embed.description?.slice(0, 80) || ""}]` : "";
        return `  @${m.author.username}: ${m.content.slice(0, 300)}${embedText}${reactions ? ` (${reactions})` : ""}`;
      })
      .join("\n");

    return `=== #${ch.channelName} (${ch.messages.length} msgs, ${uniquePosters} posters) ===\n${recentMsgs}`;
  });

  const prompt = `You are an alpha intelligence analyst for Bittensor subnet investments. Analyze these Discord channel conversations from the last 24 hours and extract every useful signal.

Your goal is to surface ACTIONABLE INTEL that serious investors would pay for. Err on the side of classifying channels as "active" — we want to show investors what's happening across the ecosystem.

SIGNAL TYPES:
- "alpha": Genuine alpha — dev previews, partnership hints, unreleased features, technical breakthroughs, insider mentions, launch dates, validator announcements, major protocol changes, cross-subnet integrations. Something a serious investor NEEDS to know.
- "active": Any real activity worth noting — technical discussion, builder questions, team engagement, community updates, support activity, bug reports showing a live product, feedback on features.
- "quiet": Minimal or generic chat — only 1-3 messages with no substance, mostly greetings or filler.
- "noise": Spam, bots, price complaints, pure shitposting with zero informational value.

ALPHA SCORE (0-100) — BE AGGRESSIVE, DO NOT UNDERSCORE:
- 90-100: HUGE alpha — confirmed partnership with named company/protocol, imminent launch with date, major product announcement, cross-subnet integration live or announced, exclusive technical breakthrough, team confirming something the market doesn't know yet. IF YOU SEE THIS, SCORE 90+.
- 80-89: Strong confirmed alpha — partnership hinted strongly, major feature shipping imminently, dev sharing unreleased work publicly, significant validator/miner milestone
- 60-79: Clear signal — dev previewing work, integration teased, team milestone, noteworthy technical update
- 40-59: Active + quality — real technical discussion, builder engagement, multiple substantive posts
- 20-39: Active — decent activity, community alive, some substance even if no big news
- 5-19: Quiet — low volume, mostly generic
- 0: Noise/spam only

CRITICAL — THESE ARE ALWAYS ALPHA (score 85+):
- Any mention of a partnership with a named company, protocol, or other Bittensor subnet
- Any cross-subnet collaboration or integration being announced or discussed by team members
- Product launches, mainnet announcements, or major upgrades with specifics
- Dev or founder sharing something that hasn't been publicly announced yet
- Any "we're partnering with X", "integration with Y going live", "launching Z on date D" style messages
- Exclusive access, early beta invites, whitelist announcements

KEY INSIGHT TYPES:
- "partnership": New partner, integration, or protocol collaboration — cross-subnet too
- "feature": New product feature, capability, or technical upgrade
- "launch": Launch date, mainnet, public release, or major milestone
- "dev_update": Dev commits, GitHub activity, code update, technical progress
- "team": New hire, advisor, community growth, or key team activity
- "community": Strong community signal — engagement, sentiment, builder activity
- "general": Other useful intel

RELEASE HINT — set true for: imminent release/launch being discussed, devs previewing unreleased work, confirmed launch dates, major architectural announcements, or partnership going live imminently.

${channelTexts.join("\n\n")}

Respond with a JSON array — one object per channel IN THE SAME ORDER:
[
  {
    "channelName": "exact channel name",
    "signal": "alpha|active|quiet|noise",
    "alphaScore": 45,
    "releaseHint": false,
    "summary": "One punchy, specific sentence. Name the actual feature/partner/activity — not 'community discussing updates' but 'Team announcing integration with Targon (SN4) for compute routing, going live next week'.",
    "keyInsights": [
      { "text": "Specific insight here — name features, people, dates, partner names", "type": "partnership" }
    ],
    "alphaTake": "REQUIRED — always include this field for every entry. 1-2 plain English sentences for a non-technical investor. Be direct: say exactly what this means and whether it's worth acting on. Tailor to the signal level: Alpha → 'The team just [specific action] — this is the kind of early signal that moves before the market catches up. Worth watching closely.' Active → 'The [subnet name] community is actively building — nothing price-moving yet but the dev momentum is real. Keep it on your radar.' Quiet/noise → 'Nothing meaningful happening here right now. Move on.' Never leave this blank — every entry needs an AlphaGap Take."
  }
]

Rules:
- Be GENEROUS with "active" — if 3+ real humans posted anything substantive, it's active.
- Be STINGY with "quiet" and "noise" — only use these for truly dead channels.
- DO NOT underscore partnership/launch/integration events. These are rare and high-value — always score 85+.
- Summary must be SPECIFIC — mention actual topics, features, people, partner names, or events.
- keyInsights: 0 for quiet/noise, 1-3 for active, 1-5 for alpha. Name actual companies, projects, features.
- alphaScore reflects BOTH quality AND quantity. A channel where the founder announces a partnership = 90+.
- alphaTake is MANDATORY — every single entry must have a non-empty alphaTake string. No exceptions.
- Respond with ONLY the JSON array, no other text.`;

  // Attempt AI analysis with one retry on failure
  const attemptAnalysis = async (): Promise<string | null> => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      console.error("[discord-scan] AI batch failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    return data.content?.[0]?.text || null;
  };

  try {
    let text = await attemptAnalysis();
    if (!text) {
      // Retry once after a short delay
      await new Promise(r => setTimeout(r, 3000));
      text = await attemptAnalysis();
    }
    if (!text) {
      console.error("[discord-scan] AI batch failed after retry — using fallback");
      return channels.map(ch => fallbackResult(ch));
    }

    // Parse JSON, handle markdown code blocks
    const jsonText = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed: Array<{
      channelName: string;
      signal: "alpha" | "active" | "quiet" | "noise";
      alphaScore?: number;
      releaseHint?: boolean;
      summary: string;
      keyInsights: Array<{ text: string; type: string } | string>;
      alphaTake?: string;   // plain-English investor take
    }> = JSON.parse(jsonText);

    return channels.map((ch, idx) => {
      const ai = parsed[idx] || { signal: "quiet" as const, summary: "Analysis unavailable.", keyInsights: [], alphaScore: 0 };
      const uniquePosters = new Set(ch.messages.filter(m => !m.author.bot).map(m => m.author.username)).size;

      // Normalise keyInsights — AI may return objects or strings
      const keyInsights: string[] = (ai.keyInsights || []).map(k =>
        typeof k === "string" ? k : `${k.text}`
      );
      const alphaTypes: string[] = (ai.keyInsights || []).map(k =>
        typeof k === "object" && k.type ? k.type : "general"
      );

      // Compute alphaScore if AI didn't provide it
      const alphaScore = typeof ai.alphaScore === "number" && ai.alphaScore >= 0
        ? Math.min(100, ai.alphaScore)
        : ai.signal === "alpha" ? 70
        : ai.signal === "active" ? 35
        : ai.signal === "noise" ? 0
        : 10;

      const humanMsgs = ch.messages.filter(m => !m.author.bot);
      const lastActivityAt = humanMsgs.length > 0
        ? humanMsgs.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0].timestamp
        : undefined;

      return {
        channelId: ch.channelId,
        channelName: ch.channelName,
        netuid: ch.netuid,
        subnetName: formatSubnetName(ch.channelName),
        signal: ai.signal,
        alphaScore,
        alphaTypes,
        releaseHint: ai.releaseHint === true,
        summary: ai.summary,
        keyInsights,
        alphaTake: ai.alphaTake || defaultAlphaTake(ai.signal, ai.alphaScore),
        messageCount: ch.messages.length,
        uniquePosters,
        scannedAt: new Date().toISOString(),
        lastActivityAt,
      };
    });
  } catch (e) {
    console.error("[discord-scan] AI analysis error:", e);
    return channels.map(ch => fallbackResult(ch));
  }
}

// ── Founder Post Analysis ─────────────────────────────────────────────────────
// Returns one entry PER CHANNEL Const posted in so summaries are channel-specific.

async function analyzeFounderPosts(
  channelScans: Array<{
    channelId: string;
    channelName: string;
    netuid: number | null;
    messages: DiscordMessage[];
  }>
): Promise<DiscordAlphaResult[]> {
  // Collect all messages from Const, grouped by channel
  const byChannel = new Map<string, {
    channelId: string;
    channelName: string;
    netuid: number | null;
    msgs: DiscordMessage[];
  }>();

  for (const scan of channelScans) {
    for (const msg of scan.messages) {
      if (msg.author.bot) continue;
      const uname = msg.author.username.toLowerCase();
      const displayName = (msg.author.global_name ?? "").toLowerCase();
      const isFounder =
        FOUNDER_USERNAMES.has(uname) ||
        FOUNDER_USER_IDS.has(msg.author.id) ||
        uname.startsWith("const") ||
        displayName.startsWith("const");
      if (isFounder && msg.content.trim().length > 15) {
        if (!byChannel.has(scan.channelName)) {
          byChannel.set(scan.channelName, {
            channelId: scan.channelId,
            channelName: scan.channelName,
            netuid: scan.netuid,
            msgs: [],
          });
        }
        byChannel.get(scan.channelName)!.msgs.push(msg);
      }
    }
  }

  if (byChannel.size === 0) {
    console.log("[discord-scan] No founder posts found in last 72h");
    return [];
  }

  const channelCount = byChannel.size;
  const totalMsgs = [...byChannel.values()].reduce((s, c) => s + c.msgs.length, 0);
  console.log(`[discord-scan] Found ${totalMsgs} founder message(s) across ${channelCount} channel(s)`);

  if (!ANTHROPIC_KEY) return [];

  // Build per-channel prompt sections
  const channelSections = [...byChannel.values()]
    .map(ch => {
      const lines = ch.msgs
        .map(m => `  "${m.content.slice(0, 500)}"`)
        .join("\n");
      return `=== #${ch.channelName} ===\n${lines}`;
    })
    .join("\n\n");

  const prompt = `You are an analyst for Bittensor subnet investors. The following are Discord messages posted by Const — the founder of Bittensor — in various subnet Discord channels in the last 72 hours. Each section is a separate channel.

${channelSections}

For EACH channel section, determine if the messages are SIGNIFICANT (not just greetings, "lol", one-word replies, or generic support). A message is significant if it reveals governance decisions, technical direction, security issues, subnet removals, partnerships, or anything an investor would want to know.

Respond with a JSON array — one object per channel, IN THE SAME ORDER as the sections above:
[
  {
    "channelName": "exact channel name without the # prefix",
    "significant": true or false,
    "alphaScore": 0-100,
    "summary": "One specific punchy sentence about what Const said HERE in this channel — quote or closely paraphrase his actual words. Do NOT generalize across channels.",
    "keyInsights": ["Direct quote or close paraphrase of key point 1 from this channel", "key point 2"],
    "alphaTake": "1-2 plain English sentences: what does THIS message mean for investors in this specific subnet? Is it actionable?"
  }
]

Rules:
- Each entry must only cover what Const said in THAT specific channel — no mixing across channels.
- If a channel's messages are not significant, set "significant": false (summary/keyInsights can be empty).
- alphaScore: 85-100 for governance/security/enforcement, 70-84 for technical direction or major commentary, 50-69 for notable but less critical posts.
- Respond with ONLY the JSON array, no other text.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const text = data.content?.[0]?.text || "[]";
    const jsonText = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();

    const aiResults: Array<{
      channelName: string;
      significant: boolean;
      alphaScore?: number;
      summary?: string;
      keyInsights?: string[];
      alphaTake?: string;
    }> = JSON.parse(jsonText);

    const entries: DiscordAlphaResult[] = [];
    const channelList = [...byChannel.values()];

    for (let i = 0; i < channelList.length; i++) {
      const ch = channelList[i];
      const ai = aiResults[i];

      if (!ai?.significant) {
        console.log(`[discord-scan] Founder post in #${ch.channelName} not significant — skipping`);
        continue;
      }

      const lastMsg = ch.msgs.at(-1);
      entries.push({
        channelId: `founder-const-${ch.channelId}`,
        channelName: `founder-const-${ch.channelName}`,
        netuid: ch.netuid,
        subnetName: `Const · ${formatSubnetName(ch.channelName)}`,
        signal: "alpha",
        alphaScore: Math.min(100, ai.alphaScore ?? 85),
        alphaTypes: ["founder"],
        releaseHint: (ai.alphaScore ?? 0) >= 80,
        summary: ai.summary || "The Bittensor founder posted in this channel.",
        keyInsights: ai.keyInsights ?? [],
        alphaTake: ai.alphaTake,
        founderPost: true,
        messageCount: ch.msgs.length,
        uniquePosters: 1,
        scannedAt: new Date().toISOString(),
        lastActivityAt: lastMsg?.timestamp,
      } as DiscordAlphaResult);
    }

    console.log(`[discord-scan] ${entries.length} significant founder channel(s) out of ${channelList.length}`);
    return entries;
  } catch (e) {
    console.error("[discord-scan] Founder analysis error:", e);
    return [];
  }
}

// Fallback AlphaGap Take when the AI doesn't return one
function defaultAlphaTake(signal: string, alphaScore?: number): string {
  if (signal === "alpha" && (alphaScore ?? 0) >= 80) {
    return "Strong alpha signal — something significant is happening here. Worth digging into before the wider market notices.";
  }
  if (signal === "alpha") {
    return "Real alpha is surfacing in this channel — the community is discussing something that could matter. Keep this subnet on your radar.";
  }
  if (signal === "active") {
    return "Active community with builders engaging — no single big catalyst yet, but the momentum is real. Worth monitoring.";
  }
  return "Nothing actionable here right now. Move on.";
}

function fallbackResult(ch: {
  channelId: string;
  channelName: string;
  netuid: number | null;
  messages: DiscordMessage[];
}): DiscordAlphaResult {
  const uniquePosters = new Set(ch.messages.filter(m => !m.author.bot).map(m => m.author.username)).size;
  const signal = ch.messages.length >= 10 ? "active" as const : "quiet" as const;
  const alphaScore = ch.messages.length >= 10 ? 15 : 0;
  const subnetName = formatSubnetName(ch.channelName);

  // Build a real summary from the actual message content instead of a raw count
  const humanMsgs = ch.messages.filter(m => !m.author.bot);
  const summary = humanMsgs.length > 0
    ? `${subnetName} community is active — ${humanMsgs.length} messages from ${uniquePosters} contributors in the last 24h.`
    : `No significant activity in the last 24 hours.`;

  return {
    channelId: ch.channelId,
    channelName: ch.channelName,
    netuid: ch.netuid,
    subnetName,
    signal,
    alphaScore,
    summary,
    keyInsights: [],
    alphaTake: defaultAlphaTake(signal, alphaScore),
    messageCount: ch.messages.length,
    uniquePosters,
    scannedAt: new Date().toISOString(),
  };
}

function formatSubnetName(channelName: string): string {
  // Bittensor Discord uses: "λ・trajectory-rl・11", "ה・coldint・ex29", "ظ・nova・68"
  // Strip leading non-ASCII prefix char + interpunct (·, ・, etc.) and trailing ・number
  let name = channelName
    // Remove leading single non-ASCII char (Greek, Hebrew, Arabic, emoji) + separator
    .replace(/^[^\x00-\x7F][·・•‧\s\-_]/, "")
    // Remove trailing separator + number (e.g. "・68", "・ex29", "-68")
    .replace(/[·・•‧\s\-_]+(?:ex)?\d+$/, "")
    // Replace remaining separators with spaces
    .replace(/[·・•‧\s\-_]+/g, " ")
    // Strip sn-style prefixes
    .replace(/^sn\s?\d+\s?/i, "")
    .trim();

  const netuid = parseNetuidFromChannel(channelName);
  const displayName = name
    ? name.charAt(0).toUpperCase() + name.slice(1)
    : `SN${netuid || "?"}`;
  return netuid ? `${displayName} (SN${netuid})` : displayName;
}
