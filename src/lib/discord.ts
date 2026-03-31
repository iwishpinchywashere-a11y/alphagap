// Discord API client for Bittensor server channel scanning
// Guild ID: 799672011265015819 (Bittensor official Discord)

export const BITTENSOR_GUILD_ID = "799672011265015819";

export interface DiscordChannel {
  id: string;
  name: string;
  type: number; // 0 = text, 4 = category, 5 = announcement, 15 = forum
  parent_id?: string;
  topic?: string;
  position: number;
}

export interface DiscordMessage {
  id: string;
  content: string;
  author: { id: string; username: string; bot?: boolean };
  timestamp: string;
  reactions?: Array<{ count: number; emoji: { name: string } }>;
  attachments?: Array<{ filename: string; url: string }>;
  embeds?: Array<{ title?: string; description?: string; url?: string }>;
}

export interface DiscordChannelScan {
  channelId: string;
  channelName: string;
  netuid: number | null;
  messageCount: number;
  messages: DiscordMessage[];
  scannedAt: string;
}

export interface DiscordAlphaResult {
  channelId: string;
  channelName: string;
  netuid: number | null;
  subnetName: string;
  signal: "alpha" | "active" | "quiet" | "noise";
  summary: string;
  keyInsights: string[];
  messageCount: number;
  uniquePosters: number;
  scannedAt: string;
}

const DISCORD_BASE = "https://discord.com/api/v10";

function getAuthHeader(token: string): string {
  // Supports both "Bot TOKEN" format and raw user tokens
  if (token.startsWith("Bot ") || token.startsWith("Bearer ")) return token;
  return `Bot ${token}`;
}

// Convert timestamp to Discord snowflake ID (for message pagination)
function timestampToSnowflake(ms: number): string {
  return String(BigInt(ms - 1420070400000) * BigInt(4194304));
}

export async function fetchGuildChannels(token: string): Promise<DiscordChannel[]> {
  const res = await fetch(`${DISCORD_BASE}/guilds/${BITTENSOR_GUILD_ID}/channels`, {
    headers: { Authorization: getAuthHeader(token) },
  });
  if (!res.ok) throw new Error(`Discord channels fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchChannelMessages(
  token: string,
  channelId: string,
  options: { limit?: number; after?: string } = {}
): Promise<DiscordMessage[]> {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit || 50));
  if (options.after) params.set("after", options.after);

  const res = await fetch(`${DISCORD_BASE}/channels/${channelId}/messages?${params}`, {
    headers: { Authorization: getAuthHeader(token) },
  });

  if (res.status === 403) return []; // No access to channel
  if (res.status === 429) {
    // Rate limited — respect retry-after
    const retryAfter = parseFloat(res.headers.get("retry-after") || "1");
    await new Promise(r => setTimeout(r, retryAfter * 1000 + 200));
    return fetchChannelMessages(token, channelId, options);
  }
  if (!res.ok) return [];
  return res.json();
}

// Parse channel name → netuid (handles sn3, sn-3, sn_3, subnet-3, "templar" via name map etc.)
const SUBNET_NAME_MAP: Record<string, number> = {
  "templar": 3, "tplr": 3,
  "targon": 4,
  "kaito": 5,
  "numinous": 6,
  "vanta": 8,
  "cortex": 18, "zeus": 18,
  "trajectoryrl": 11, "trajectory": 11,
  "compute-horde": 12, "computehorde": 12,
  "macrocosmos": 13,
  "bitrecs": 16,
  "cortex-t": 18,
  "nineteen": 19,
  "groundlayer": 20,
  "ridges": 62,
  "chutes": 64,
  "bitmind": 34,
  "wombo": 17,
  "synth": 2, "dsperse": 2,
  "apex": 1,
  "iota": 9,
  "sturdy": 6,
  "hivetrain": 17,
  "nova": 68,
  "manifold": 5,
  "resi": 57,
  "redteam": 61,
  "grail": 81,
  "basilica": 39,
  "score": 44,
  "data-universe": 13, "datauniverse": 13,
  "pretrain": 9,
  "omega": 24,
  "protein": 25,
  "storage": 21,
  "vision": 23,
  "audio": 16,
  "video": 17,
};

export function parseNetuidFromChannel(channelName: string): number | null {
  const name = channelName.toLowerCase().replace(/[_\s]/g, "-");

  // Match sn3, sn-3, sn_3, subnet-3 patterns
  const snMatch = name.match(/(?:^|[\-_])sn[\-_]?(\d{1,3})(?:[\-_]|$)/)
    || name.match(/^sn(\d{1,3})/)
    || name.match(/subnet[\-_]?(\d{1,3})/);
  if (snMatch) {
    const n = parseInt(snMatch[1]);
    if (n > 0 && n <= 128) return n;
  }

  // Match numeric suffix: "3-templar", "templar-3"
  const numMatch = name.match(/^(\d{1,3})[\-_]/) || name.match(/[\-_](\d{1,3})$/);
  if (numMatch) {
    const n = parseInt(numMatch[1]);
    if (n > 0 && n <= 128) return n;
  }

  // Match known subnet names
  for (const [keyword, netuid] of Object.entries(SUBNET_NAME_MAP)) {
    if (name.includes(keyword)) return netuid;
  }

  return null;
}

// Filter channels to ones likely related to subnets
export function filterSubnetChannels(channels: DiscordChannel[]): DiscordChannel[] {
  return channels.filter(ch => {
    if (ch.type !== 0 && ch.type !== 5 && ch.type !== 15) return false; // text/announcement/forum only
    const name = ch.name.toLowerCase();

    // Explicit subnet patterns
    if (/sn[\-_]?\d+/.test(name)) return true;
    if (/subnet[\-_]?\d+/.test(name)) return true;
    if (/^\d+[\-_]/.test(name)) return true;
    if (/[\-_]\d+$/.test(name)) return true;

    // Known subnet names
    for (const keyword of Object.keys(SUBNET_NAME_MAP)) {
      if (name.includes(keyword)) return true;
    }

    return false;
  });
}

// Get Discord snowflake for 24 hours ago (to only fetch recent messages)
export function get24hSnowflake(): string {
  const ms = Date.now() - 24 * 60 * 60 * 1000;
  return timestampToSnowflake(ms);
}

export function get48hSnowflake(): string {
  const ms = Date.now() - 48 * 60 * 60 * 1000;
  return timestampToSnowflake(ms);
}
