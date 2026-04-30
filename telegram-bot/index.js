/**
 * AlphaGap Telegram Bot — plain Node.js (no TypeScript build step)
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN   — from @BotFather
 *   ALPHAGAP_API_URL     — e.g. https://www.alphagap.io
 *   BOT_API_SECRET       — shared secret for Vercel API auth
 */

"use strict";

const TelegramBot = require("node-telegram-bot-api");

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
  const code = match && match[1] ? match[1].toUpperCase().trim() : null;

  if (!code) {
    await bot.sendMessage(
      chatId,
      "👋 *Welcome to AlphaGap Alerts\\!*\n\n" +
        "To connect your account:\n" +
        "1\\. Go to alphagap\\.io/alerts\n" +
        "2\\. Click *Get connect code*\n" +
        "3\\. Send `/start YOUR_CODE` here\n\n" +
        "You'll start receiving real\\-time Bittensor subnet alerts\\. 🚀",
      { parse_mode: "MarkdownV2" }
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
        username: msg.from && msg.from.username,
        firstName: msg.from && msg.from.first_name,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      await bot.sendMessage(
        chatId,
        `❌ *Invalid or expired code\\.*\n\nPlease go to alphagap\\.io/alerts and generate a new code\\.`,
        { parse_mode: "MarkdownV2" }
      );
      return;
    }

    const name = data.firstName || "friend";
    await bot.sendMessage(
      chatId,
      `✅ *Connected, ${name}\\!*\n\n` +
        "Your AlphaGap alerts are now active\\. You'll receive notifications here when your selected subnets hit your thresholds\\.\n\n" +
        "🔧 Manage your alert settings at alphagap\\.io/alerts\n\n" +
        "_Commands:_\n" +
        "• /status — see active alerts\n" +
        "• /stop — pause all alerts",
      { parse_mode: "MarkdownV2" }
    );
  } catch (err) {
    console.error("Error verifying code:", err);
    await bot.sendMessage(chatId, "❌ Something went wrong. Please try again or visit alphagap.io/alerts");
  }
});

// ─── /stop ────────────────────────────────────────────────────────────────────

bot.onText(/\/stop/, async (msg) => {
  const chatId = msg.chat.id.toString();
  await bot.sendMessage(
    chatId,
    "⏸️ To pause or disconnect your alerts, visit: alphagap.io/alerts"
  );
});

// ─── /status ─────────────────────────────────────────────────────────────────

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id.toString();
  await bot.sendMessage(
    chatId,
    "📊 Manage your alert settings at: alphagap.io/alerts"
  );
});

// ─── Queue poller (every 30s) ─────────────────────────────────────────────────

async function pollQueue() {
  try {
    const res = await fetch(`${ALPHAGAP_API_URL}/api/alerts/queue`, {
      headers: { Authorization: `Bearer ${BOT_API_SECRET}` },
    });

    if (!res.ok) {
      console.warn(`Queue poll failed: ${res.status}`);
      return;
    }

    const { items } = await res.json();
    if (!items || !items.length) return;

    const acks = [];

    for (const item of items) {
      for (const alert of item.alerts) {
        try {
          await bot.sendMessage(item.chatId, alert.message, { parse_mode: "Markdown" });
          acks.push({ hash: item.hash, id: alert.id });
          await sleep(50); // stay under Telegram 30 msg/s rate limit
        } catch (err) {
          // Bot was blocked or chat not found — mark as sent to clear queue
          if (
            err &&
            err.code === "ETELEGRAM" &&
            err.message &&
            (err.message.includes("blocked") ||
              err.message.includes("user not found") ||
              err.message.includes("chat not found"))
          ) {
            console.warn(`Chat ${item.chatId} unavailable — marking alert as sent`);
            acks.push({ hash: item.hash, id: alert.id });
          } else {
            console.error(`Failed to send to ${item.chatId}:`, err && err.message);
          }
        }
      }
    }

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
    console.error("Queue poll error:", err && err.message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
