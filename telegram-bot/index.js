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
const fs = require("fs");

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

// ── Deployment-overlap guard ───────────────────────────────────────────────────
// During Railway rolling deploys, the old and new bot overlap for a few seconds.
// When the new bot starts polling Telegram, it gets a 409 Conflict error.
// Fix: when we see a 409, block all queue polling for 60 seconds.
let deployOverlapBlocked = false;

bot.on("polling_error", (error) => {
  if (error && error.message && error.message.includes("409 Conflict")) {
    if (!deployOverlapBlocked) {
      console.warn("⚠️  409 Conflict — old bot still running. Blocking queue polls for 60s.");
      deployOverlapBlocked = true;
      setTimeout(() => {
        deployOverlapBlocked = false;
        console.log("✅ Deployment overlap window closed — resuming queue polling.");
        pollQueue();
      }, 60_000);
    }
  }
});

// ─── /start CODE ──────────────────────────────────────────────────────────────

bot.onText(/\/start(?:\s+([A-Z0-9]{6}))?/i, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const code = match && match[1] ? match[1].toUpperCase().trim() : null;

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
        username: msg.from && msg.from.username,
        firstName: msg.from && msg.from.first_name,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      await bot.sendMessage(
        chatId,
        `❌ *Invalid or expired code.*\n\nPlease go to alphagap.io/alerts and generate a new code.\n\n_Error: ${data.error || "Unknown"}_`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const name = data.firstName || "friend";
    await bot.sendMessage(
      chatId,
      `✅ *Connected, ${name}!*\n\n` +
        "Your AlphaGap alerts are now active. You'll receive notifications here when your selected subnets hit your thresholds.\n\n" +
        "🔧 Manage your alert settings at alphagap.io/alerts\n\n" +
        "_Commands:_\n" +
        "• /status — see active alerts\n" +
        "• /stop — pause all alerts",
      { parse_mode: "Markdown" }
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

// ─── Queue poller ─────────────────────────────────────────────────────────────

// ── Persistent dedup cache ────────────────────────────────────────────────────
// Two independent keys per alert — BOTH must be clear to allow sending:
//   1. subnet key  "subnet:{chatId}:{netuid}"   → one alert per subnet per 60 min
//   2. message key "msg:{chatId}:{msgPrefix}"   → exact-text dedup regardless of netuid
//
// The map is written to disk after every real send so it survives bot restarts.

const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 60 minutes
const DEDUP_FILE = "/tmp/alphagap-dedup.json";

function loadDedupeCache() {
  try {
    const raw = fs.readFileSync(DEDUP_FILE, "utf-8");
    const data = JSON.parse(raw);
    const map = new Map();
    const cutoff = Date.now() - DEDUP_WINDOW_MS;
    for (const [k, v] of Object.entries(data)) {
      if (v > cutoff) map.set(k, v);
    }
    console.log(`📂 Loaded ${map.size} dedup entries from disk`);
    return map;
  } catch {
    console.log("📂 No dedup cache on disk — starting fresh");
    return new Map();
  }
}

function saveDedupeCache() {
  try {
    const obj = {};
    for (const [k, v] of recentlySent) obj[k] = v;
    fs.writeFileSync(DEDUP_FILE, JSON.stringify(obj));
  } catch (e) {
    console.warn("⚠️  Failed to persist dedup cache:", e && e.message);
  }
}

const recentlySent = loadDedupeCache();

function pruneDedupeCache() {
  const cutoff = Date.now() - DEDUP_WINDOW_MS;
  for (const [key, ts] of recentlySent) {
    if (ts < cutoff) recentlySent.delete(key);
  }
}

// ── Concurrent-poll guard ─────────────────────────────────────────────────────
let isPolling = false;

async function pollQueue() {
  if (isPolling) {
    console.log("⏭️  Skipping poll — previous run still in progress");
    return;
  }
  if (deployOverlapBlocked) {
    console.log("⏭️  Skipping poll — waiting for old bot instance to stop");
    return;
  }

  isPolling = true;
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
    let realSends = 0;
    let dedupSkips = 0;
    pruneDedupeCache();

    for (const item of items) {
      for (const alert of item.alerts) {
        const now = Date.now();
        const subnetKey = `subnet:${item.chatId}:${alert.netuid != null ? alert.netuid : "global"}`;
        const msgKey = `msg:${item.chatId}:${alert.message.slice(0, 120)}`;

        const subnetLastSent = recentlySent.get(subnetKey);
        if (subnetLastSent && now - subnetLastSent < DEDUP_WINDOW_MS) {
          console.log(
            `⏭️  Dedup(subnet): skip ${alert.type} SN${alert.netuid} id=${alert.id} chat=${item.chatId} — ` +
            `subnet notified ${Math.round((now - subnetLastSent) / 1000)}s ago`
          );
          acks.push({ hash: item.hash, id: alert.id });
          dedupSkips++;
          continue;
        }

        const msgLastSent = recentlySent.get(msgKey);
        if (msgLastSent && now - msgLastSent < DEDUP_WINDOW_MS) {
          console.log(
            `⏭️  Dedup(msg): skip ${alert.type} SN${alert.netuid} id=${alert.id} chat=${item.chatId} — ` +
            `identical message sent ${Math.round((now - msgLastSent) / 1000)}s ago`
          );
          acks.push({ hash: item.hash, id: alert.id });
          dedupSkips++;
          continue;
        }

        try {
          console.log(
            `📤 Sending ${alert.type} SN${alert.netuid} id=${alert.id} chat=${item.chatId} ` +
            `msg="${alert.message.slice(0, 60).replace(/\n/g, " ")}"`
          );
          await bot.sendMessage(item.chatId, alert.message, { parse_mode: "Markdown" });
          const ts = Date.now();
          recentlySent.set(subnetKey, ts);
          recentlySent.set(msgKey, ts);
          saveDedupeCache(); // persist immediately after each real send
          acks.push({ hash: item.hash, id: alert.id });
          realSends++;
          await sleep(50); // stay under Telegram 30 msg/s rate limit
        } catch (err) {
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
      console.log(`✉️  Poll complete — sent=${realSends} deduped=${dedupSkips} acked=${acks.length}`);
    }
  } catch (err) {
    console.error("Queue poll error:", err && err.message);
  } finally {
    isPolling = false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Startup delay ─────────────────────────────────────────────────────────────
// Wait 75s before first poll so the old bot instance is fully dead during
// Railway rolling deploys (prevents the overlap window from double-sending).
console.log("⏳ Waiting 75s before first queue poll (deployment overlap guard)...");
setTimeout(() => {
  console.log("✅ Startup delay complete — beginning queue polling.");
  pollQueue();
  setInterval(pollQueue, 30_000);
}, 75_000);

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
