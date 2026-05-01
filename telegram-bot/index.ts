/**
 * AlphaGap Telegram Bot
 *
 * Runs as a persistent service on Railway.
 *
 * Responsibilities:
 *   1. Listen for Telegram messages via long polling
 *   2. Handle /start CODE  → call Vercel /api/alerts/verify to link the user
 *   3. Handle /stop        → disable alerts for this chat
 *   4. Handle /status      → show what's active
 *   5. Every 30s poll Vercel /api/alerts/queue and send pending messages
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN   — from @BotFather
 *   ALPHAGAP_API_URL     — e.g. https://www.alphagap.io
 *   BOT_API_SECRET       — shared secret for Vercel API auth
 */

import TelegramBot from "node-telegram-bot-api";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALPHAGAP_API_URL = (process.env.ALPHAGAP_API_URL || "https://www.alphagap.io").replace(/\/$/, "");
const BOT_API_SECRET = process.env.BOT_API_SECRET;

if (!TELEGRAM_BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN is not set");
  process.exit(1);
}
if (!BOT_API_SECRET) {
  console.error("❌ BOT_API_SECRET is not set");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

console.log("🤖 AlphaGap Telegram bot started");

// ─── /start CODE ──────────────────────────────────────────────────────────────

bot.onText(/\/start(?:\s+([A-Z0-9]{6}))?/i, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const code = match?.[1]?.toUpperCase().trim();

  if (!code) {
    await bot.sendMessage(
      chatId,
      "👋 *Welcome to AlphaGap Alerts!*\n\n" +
        "To connect your account:\n" +
        "1. Go to *alphagap.io/alerts*\n" +
        "2. Click *Get connect code*\n" +
        "3. Send */start YOUR_CODE* here\n\n" +
        "You'll start receiving real-time Bittensor subnet alerts. 🚀",
      { parse_mode: "Markdown" }
    );
    return;
  }

  try {
    const res = await fetch(`${ALPHAGAP_API_URL}/api/alerts/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BOT_API_SECRET}`,
      },
      body: JSON.stringify({
        code,
        chatId,
        username: msg.from?.username,
        firstName: msg.from?.first_name,
      }),
    });

    const data = (await res.json()) as { ok?: boolean; error?: string; firstName?: string };

    if (!res.ok || !data.ok) {
      await bot.sendMessage(
        chatId,
        `❌ *Invalid or expired code.*\n\nPlease go to alphagap.io/alerts and generate a new code.\n\n_Error: ${data.error || "Unknown"}_`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      `✅ *Connected, ${data.firstName || "friend"}!*\n\n` +
        "Your AlphaGap alerts are now active. You'll receive notifications here when your selected subnets hit your thresholds.\n\n" +
        "🔧 Manage your alert settings at alphagap.io/alerts\n\n" +
        "_Commands:_\n" +
        "• /status — see active alerts\n" +
        "• /stop — pause all alerts",
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error("Error verifying code:", err);
    await bot.sendMessage(chatId, "❌ Something went wrong. Please try again or contact support.");
  }
});

// ─── /stop ────────────────────────────────────────────────────────────────────

bot.onText(/\/stop/, async (msg) => {
  const chatId = msg.chat.id.toString();
  // We can't easily look up the user by chatId without a reverse index
  // For now, instruct them to disable via the web UI
  await bot.sendMessage(
    chatId,
    "⏸️ To pause or disconnect your alerts, visit:\naphagap.io/alerts",
    { parse_mode: "Markdown" }
  );
});

// ─── /status ─────────────────────────────────────────────────────────────────

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id.toString();
  await bot.sendMessage(
    chatId,
    "📊 Manage your alert settings at:\nalphagap.io/alerts",
    { parse_mode: "Markdown" }
  );
});

// ─── Queue poller (every 30s) ─────────────────────────────────────────────────

interface PendingAlert {
  id: string;
  type: string;
  netuid?: number;
  subnetName?: string;
  message: string;
  createdAt: string;
  sent: boolean;
}

interface QueueItem {
  hash: string;
  chatId: string;
  alerts: PendingAlert[];
}

let isPolling = false;

// ── In-memory dedup ───────────────────────────────────────────────────────────
// The alert-scanner can fire multiple times in quick succession (5-min cron +
// fire-and-forget from scan/social/discord). Blob storage has no atomic ops,
// so concurrent scanner instances can race past all server-side guards and
// enqueue the same alert 2-3 times. This in-memory map is the guaranteed
// last line of defence — the bot is a single process, no race conditions.
//
// Key: "{chatId}:{type}:{netuid}"  →  timestamp of last send
const recentlySent = new Map<string, number>();
const DEDUP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Subnet-level dedup: regardless of alert type, only ONE notification per
// subnet per user within the dedup window. This prevents rapid-fire alerts
// (e.g. priceMove + scoreChange firing simultaneously for the same subnet)
// from looking like duplicates to the user.
function dedupeKey(chatId: string, alert: PendingAlert): string {
  return `${chatId}:${alert.netuid ?? "global"}`;
}

// Prune entries older than the window to keep the map small
function pruneDedupeCache(): void {
  const cutoff = Date.now() - DEDUP_WINDOW_MS;
  for (const [key, ts] of recentlySent) {
    if (ts < cutoff) recentlySent.delete(key);
  }
}

async function pollQueue(): Promise<void> {
  // Prevent concurrent runs — if the previous poll is still awaiting blob
  // writes or Telegram sends, skip this tick rather than double-delivering.
  if (isPolling) {
    console.log("⏭️  Skipping poll — previous run still in progress");
    return;
  }
  isPolling = true;
  try {
    const res = await fetch(`${ALPHAGAP_API_URL}/api/alerts/queue`, {
      headers: {
        Authorization: `Bearer ${BOT_API_SECRET}`,
      },
    });

    if (!res.ok) {
      console.warn(`Queue poll failed: ${res.status}`);
      return;
    }

    const { items } = (await res.json()) as { items: QueueItem[] };

    if (!items?.length) return;

    const acks: { hash: string; id: string }[] = [];
    pruneDedupeCache();

    for (const item of items) {
      for (const alert of item.alerts) {
        const dk = dedupeKey(item.chatId, alert);
        const lastSentAt = recentlySent.get(dk);
        if (lastSentAt && Date.now() - lastSentAt < DEDUP_WINDOW_MS) {
          // Duplicate — already sent this alert type+subnet recently.
          // Still ack it so it clears the queue.
          console.log(`⏭️  Dedup (subnet): skipping ${alert.type} for SN${alert.netuid} to ${item.chatId} — subnet already notified ${Math.round((Date.now() - lastSentAt) / 1000)}s ago`);
          acks.push({ hash: item.hash, id: alert.id });
          continue;
        }

        try {
          console.log(`📤 Sending ${alert.type} for SN${alert.netuid} to chat ${item.chatId}`);
          await bot.sendMessage(item.chatId, alert.message, { parse_mode: "Markdown" });
          recentlySent.set(dk, Date.now());
          acks.push({ hash: item.hash, id: alert.id });
          // Small delay to stay under Telegram rate limit (30 msg/s)
          await sleep(50);
        } catch (err: unknown) {
          const error = err as { code?: string; message?: string };
          // Bot was blocked or user doesn't exist → mark as sent anyway to clear queue
          if (
            error?.code === "ETELEGRAM" &&
            (error?.message?.includes("blocked") ||
              error?.message?.includes("user not found") ||
              error?.message?.includes("chat not found"))
          ) {
            console.warn(`User ${item.chatId} blocked the bot or chat not found — marking as sent`);
            acks.push({ hash: item.hash, id: alert.id });
          } else {
            console.error(`Failed to send to ${item.chatId}:`, err);
          }
        }
      }
    }

    // Acknowledge sent alerts
    if (acks.length) {
      await fetch(`${ALPHAGAP_API_URL}/api/alerts/queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${BOT_API_SECRET}`,
        },
        body: JSON.stringify({ acks }),
      });
      console.log(`✉️  Sent ${acks.length} alert(s)`);
    }
  } catch (err) {
    console.error("Queue poll error:", err);
  } finally {
    isPolling = false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start polling immediately, then every 30s
pollQueue();
setInterval(pollQueue, 30_000);

// ─── Graceful shutdown ────────────────────────────────────────────────────────

process.on("SIGTERM", () => {
  console.log("Shutting down bot...");
  bot.stopPolling();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Shutting down bot...");
  bot.stopPolling();
  process.exit(0);
});
