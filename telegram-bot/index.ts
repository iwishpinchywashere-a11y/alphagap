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
import * as fs from "fs";

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
// When the new bot starts polling Telegram, it gets a 409 Conflict error because
// the old bot is still active. During this window, BOTH bots poll the alert
// queue and can send the same alert twice. Fix: when we see a 409, block all
// queue polling for 60 seconds so the old bot fully shuts down before we start.
let deployOverlapBlocked = false;

bot.on("polling_error", (error: Error & { code?: string }) => {
  if (error?.message?.includes("409 Conflict")) {
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

// ── Persistent dedup cache ────────────────────────────────────────────────────
// The dedup map survives bot restarts by persisting to disk.
// This is the last line of defence against any duplicates that slip through
// the server-side guards (scanner cooldown + enqueueAlert time-based dedup).
//
// Two independent dedup keys per alert:
//   1. subnet key  — "subnet:{chatId}:{netuid}"    (one alert per subnet per 60 min)
//   2. message key — "msg:{chatId}:{msgPrefix}"    (exact-message dedup, catches edge
//                                                   cases where netuid is wrong/missing)
//
// Both checks must be clear for an alert to be sent. If EITHER matches, it's a dup.

const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 60 minutes
const DEDUP_FILE = "/tmp/alphagap-dedup.json";

function loadDedupeCache(): Map<string, number> {
  try {
    const raw = fs.readFileSync(DEDUP_FILE, "utf-8");
    const data = JSON.parse(raw) as Record<string, number>;
    const map = new Map<string, number>();
    const cutoff = Date.now() - DEDUP_WINDOW_MS;
    for (const [k, v] of Object.entries(data)) {
      if (v > cutoff) map.set(k, v); // discard expired entries
    }
    console.log(`📂 Loaded ${map.size} dedup entries from disk (${DEDUP_FILE})`);
    return map;
  } catch {
    console.log("📂 No dedup cache on disk — starting fresh");
    return new Map();
  }
}

function saveDedupeCache(): void {
  try {
    const obj: Record<string, number> = {};
    for (const [k, v] of recentlySent) obj[k] = v;
    fs.writeFileSync(DEDUP_FILE, JSON.stringify(obj));
  } catch (e) {
    console.warn("⚠️  Failed to persist dedup cache to disk:", e);
  }
}

const recentlySent = loadDedupeCache();

// Build both dedup keys for an alert. An alert is suppressed if ANY key is hot.
function dedupeKeys(chatId: string, alert: PendingAlert): { subnetKey: string; msgKey: string } {
  const subnetKey = `subnet:${chatId}:${alert.netuid ?? "global"}`;
  // Use first 120 chars of message as key — identical messages for the same chat
  // are always duplicates regardless of alert type / netuid field correctness.
  const msgKey = `msg:${chatId}:${alert.message.slice(0, 120)}`;
  return { subnetKey, msgKey };
}

// Prune expired entries from the map (and immediately save to disk)
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
  // Block during deployment overlap window (after 409 Conflict from Telegram)
  if (deployOverlapBlocked) {
    console.log("⏭️  Skipping poll — waiting for old bot instance to stop (deployment overlap)");
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
    let realSends = 0;
    let dedupSkips = 0;
    pruneDedupeCache();

    for (const item of items) {
      for (const alert of item.alerts) {
        const { subnetKey, msgKey } = dedupeKeys(item.chatId, alert);
        const now = Date.now();

        const subnetLastSent = recentlySent.get(subnetKey);
        const msgLastSent = recentlySent.get(msgKey);

        if (subnetLastSent && now - subnetLastSent < DEDUP_WINDOW_MS) {
          console.log(
            `⏭️  Dedup(subnet): skip ${alert.type} SN${alert.netuid} id=${alert.id} chat=${item.chatId} — ` +
            `subnet notified ${Math.round((now - subnetLastSent) / 1000)}s ago`
          );
          acks.push({ hash: item.hash, id: alert.id });
          dedupSkips++;
          continue;
        }

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
      console.log(`✉️  Poll complete — sent=${realSends} deduped=${dedupSkips} acked=${acks.length}`);
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

// ── Startup delay ─────────────────────────────────────────────────────────────
// During Railway rolling deploys, the old and new bot overlap for up to 60s.
// The old bot gets a 409 Conflict from Telegram and blocks its own queue polls.
// But both instances can still race to poll the queue in the first few seconds
// before the 409 arrives. Waiting 75s before the first poll guarantees the old
// instance is fully dead before we touch the queue.
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
