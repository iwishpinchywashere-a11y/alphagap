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
  get24hSnowflake,
  type DiscordAlphaResult,
  type DiscordMessage,
} from "@/lib/discord";

export const dynamic = "force-dynamic";
export const maxDuration = 240; // 4 min — fits Vercel Pro limit comfortably

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";

// Prioritise channels we can map to a netuid — cap at 80 to stay within time budget
const MAX_CHANNELS = 80;
// Messages per channel
const MESSAGES_PER_CHANNEL = 30;
// Minimum messages to bother analyzing
const MIN_MESSAGES_TO_ANALYZE = 2;
// Delay between channel fetches (ms) — small enough to finish in time
const RATE_LIMIT_DELAY = 100;

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
    const afterSnowflake = get24hSnowflake();

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

  const prompt = `You are an alpha intelligence analyst for Bittensor subnet investments. Analyze these Discord channel conversations from the last 24 hours.

For each channel, classify the signal, score it, and extract specific alpha insights.

SIGNAL TYPES:
- "alpha": Genuine alpha — dev previews, partnership hints, unreleased features, technical breakthroughs, insider mentions, launch dates, validator announcements. Something a serious investor NEEDS to know.
- "active": Good community energy, substantive technical discussion, healthy ecosystem engagement. No specific alpha but positive signal.
- "quiet": Low activity, routine/maintenance chat, generic questions.
- "noise": Spam, price talk only, complaints, shitposting, nothing of substance.

ALPHA SCORE (0-100): Score the overall investable signal quality + activity:
- 80-100: Confirmed alpha — partnership announcement, launch date, major feature drop, insider info from dev/team
- 60-79: Strong signals — dev previewing unreleased work, integration teased, validator discussing migration, team milestone
- 40-59: Active + quality — real technical discussion, community building, multiple engaged builders
- 20-39: Active but surface-level — decent activity, no specific alpha
- 1-19: Quiet — low volume, generic chat
- 0: Noise/spam/price talk only

ALPHA TYPES — tag each key insight with its type:
- "partnership": New partner, integration, or protocol collaboration being discussed or announced
- "feature": New product feature, capability, or technical upgrade being built or teased
- "launch": Launch date, mainnet, or public release being discussed or confirmed
- "dev_update": Dev commits, GitHub activity, code update, or technical milestone
- "team": New hire, advisor, or key team member announcement
- "general": Other alpha that doesn't fit above

RELEASE HINT — set releaseHint: true when you detect ANY of:
- An imminent release, update, or launch being discussed or teased (e.g. "dropping tomorrow", "v2 this week", "mainnet soon")
- Devs previewing unreleased features or showing early footage/demos
- A confirmed launch date or milestone timeline being shared
- A major architectural upgrade or breaking change being announced
- Partnership or integration going live imminently

${channelTexts.join("\n\n")}

Respond with a JSON array. One object per channel IN THE SAME ORDER as above:
[
  {
    "channelName": "exact channel name",
    "signal": "alpha|active|quiet|noise",
    "alphaScore": 45,
    "releaseHint": false,
    "summary": "One punchy sentence describing what is ACTUALLY happening — name the feature/partner/update if there is one.",
    "keyInsights": [
      { "text": "Dev teased v2 model releasing next week with 3× speed improvement", "type": "feature" },
      { "text": "Partnership with Chainlink confirmed in AMA", "type": "partnership" }
    ]
  }
]

Rules:
- Be STINGY with "alpha". Only tag alpha if there's genuinely investable information.
- Summary must be SPECIFIC — not "community is discussing updates" but "Team confirmed Ethereum bridge going live Thursday"
- keyInsights: 0 for quiet/noise, 1-4 for alpha/active. Name specific features, partners, dates, people. Never be vague.
- alphaScore must reflect BOTH quality (what was said) AND quantity (message count, unique posters). High message count + generic chat = max 35. Low message count + partnership hint = 65+.
- releaseHint almost always false — only true with concrete credible release signal.
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
