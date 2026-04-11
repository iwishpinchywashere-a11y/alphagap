// Discord Alpha Scanner — reads Bittensor subnet channels and classifies the chatter
// Runs as a cron (once per day) or on-demand via GET /api/discord-scan
// Results cached in Vercel Blob as discord-latest.json

import { NextResponse } from "next/server";
import { put, get } from "@vercel/blob";
import {
  fetchGuildChannels,
  fetchChannelMessages,
  filterSubnetChannels,
  parseNetuidFromChannel,
  getHoursAgoSnowflake,
  type DiscordAlphaResult,
  type DiscordMessage,
} from "@/lib/discord";

export const dynamic = "force-dynamic";
export const maxDuration = 240; // 4 min — fits Vercel Pro limit comfortably

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";

// Prioritise channels we can map to a netuid — cap at 120 to maximise coverage
const MAX_CHANNELS = 120;
// Messages per channel — more context = better AI analysis
const MESSAGES_PER_CHANNEL = 100;
// Minimum messages to bother analyzing — 1 so no channel with any activity is skipped
const MIN_MESSAGES_TO_ANALYZE = 1;
// Delay between channel fetches (ms)
const RATE_LIMIT_DELAY = 80;
// Minimum entries to surface on the social page — if below this, relax signal thresholds
const MIN_ENTRIES_TARGET = 10;

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
    // 24h window — gives every channel a full day to accumulate messages.
    // The cron runs every 3h so results refresh frequently with fresh data.
    const afterSnowflake = getHoursAgoSnowflake(24);

    // 2. Fetch messages from each channel
    const channelScans: Array<{
      channelId: string;
      channelName: string;
      netuid: number | null;
      messages: DiscordMessage[];
    }> = [];

    for (const channel of channelsToScan) {
      try {
        const messages = await fetchChannelMessages(DISCORD_TOKEN, channel.id, {
          limit: MESSAGES_PER_CHANNEL,
          after: afterSnowflake,
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

    // 3. Filter to channels with enough activity
    const activeChannels = channelScans.filter(c => c.messages.length >= MIN_MESSAGES_TO_ANALYZE);
    console.log(`[discord-scan] ${activeChannels.length} channels have ${MIN_MESSAGES_TO_ANALYZE}+ messages in last 24h`);

    // ── Early save: write raw counts to blob immediately so dashboard has
    // something even if AI analysis times out later
    if (process.env.BLOB_READ_WRITE_TOKEN && channelScans.length > 0) {
      const partial = {
        scannedAt: new Date().toISOString(),
        channelsScanned: channelsToScan.length,
        channelsWithActivity: activeChannels.length,
        alphaChannels: 0,
        partial: true,
        results: channelScans.map(c => ({
          channelId: c.channelId,
          channelName: c.channelName,
          netuid: c.netuid,
          subnetName: formatSubnetName(c.channelName),
          signal: c.messages.length >= MIN_MESSAGES_TO_ANALYZE ? "active" : "quiet",
          summary: `${c.messages.length} messages in the last 24h.`,
          keyInsights: [] as string[],
          messageCount: c.messages.length,
          uniquePosters: new Set(c.messages.filter(m => !m.author.bot).map(m => m.author.username)).size,
          scannedAt: new Date().toISOString(),
        } as DiscordAlphaResult)),
      };
      await put("discord-latest.json", JSON.stringify(partial), {
        access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
      }).catch(() => {});
      console.log("[discord-scan] Early partial save written");
    }

    // 4. Batch AI analysis — group channels into batches of 8 to minimize API calls
    const results: DiscordAlphaResult[] = [];
    const BATCH_SIZE = 8;

    for (let i = 0; i < activeChannels.length; i += BATCH_SIZE) {
      const batch = activeChannels.slice(i, i + BATCH_SIZE);
      const batchResults = await analyzeBatch(batch);
      results.push(...batchResults);
    }

    // Add quiet channels (no messages) as "quiet" without AI analysis
    for (const scan of channelScans) {
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

    // 5. Save to blob
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
    ]
  }
]

Rules:
- Be GENEROUS with "active" — if 3+ real humans posted anything substantive, it's active.
- Be STINGY with "quiet" and "noise" — only use these for truly dead channels.
- DO NOT underscore partnership/launch/integration events. These are rare and high-value — always score 85+.
- Summary must be SPECIFIC — mention actual topics, features, people, partner names, or events.
- keyInsights: 0 for quiet/noise, 1-3 for active, 1-5 for alpha. Name actual companies, projects, features.
- alphaScore reflects BOTH quality AND quantity. A channel where the founder announces a partnership = 90+.
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
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error("[discord-scan] AI batch failed:", res.status);
      return channels.map(ch => fallbackResult(ch));
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "[]";

    // Parse JSON, handle markdown code blocks
    const jsonText = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed: Array<{
      channelName: string;
      signal: "alpha" | "active" | "quiet" | "noise";
      alphaScore?: number;
      releaseHint?: boolean;
      summary: string;
      keyInsights: Array<{ text: string; type: string } | string>;
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

function fallbackResult(ch: {
  channelId: string;
  channelName: string;
  netuid: number | null;
  messages: DiscordMessage[];
}): DiscordAlphaResult {
  const uniquePosters = new Set(ch.messages.filter(m => !m.author.bot).map(m => m.author.username)).size;
  return {
    channelId: ch.channelId,
    channelName: ch.channelName,
    netuid: ch.netuid,
    subnetName: formatSubnetName(ch.channelName),
    signal: ch.messages.length >= 10 ? "active" : "quiet",
    alphaScore: ch.messages.length >= 10 ? 15 : 0,
    summary: `${ch.messages.length} messages from ${uniquePosters} posters in the last 24 hours.`,
    keyInsights: [],
    messageCount: ch.messages.length,
    uniquePosters,
    scannedAt: new Date().toISOString(),
  };
}

function formatSubnetName(channelName: string): string {
  // Convert "sn3-templar" → "Templar (SN3)" etc.
  const name = channelName.replace(/^sn[\-_]?\d+[\-_]?/, "").replace(/[\-_]/g, " ").trim();
  const netuid = parseNetuidFromChannel(channelName);
  const displayName = name
    ? name.charAt(0).toUpperCase() + name.slice(1)
    : `SN${netuid || "?"}`;
  return netuid ? `${displayName} (SN${netuid})` : displayName;
}
