#!/usr/bin/env node
/**
 * Rebuild price history from chain state.
 *
 *   node scripts/backfill-chain-prices.mjs --history   re-derive price, market cap
 *        and emission for every snapshot in subnet-scores-history.json
 *   node scripts/backfill-chain-prices.mjs --daily     build price-daily-tao.json,
 *        one TAO close per subnet per day for the last 365 days
 *   add --write to save; without it the script reports what it would change.
 *
 * Why: between 2026-09-12 and 2026-09-19 the history held replayed prices (a
 * stale TaoStats copy, alternating between two cached values) plus holes where
 * a guard had blanked them. Every chart for that week was a flat line. The
 * archive node holds the real state at every block, so the true price at any
 * past hour is recoverable exactly; this script does that. Scores in each
 * snapshot are left untouched, only market fields are rewritten.
 *
 * Formulas match lib/market-data.ts (each one verified against live data):
 *   price  = SubnetTAO / SubnetAlphaIn                        (TAO)
 *   mcap   = price x (alphaIn + TotalAlphaStaked + SubnetProtocolAlpha)
 *   em %   = (SubnetTaoInEmission + SubnetExcessTao) / sum    (fraction in history)
 * USD values use TAO/USD at that same hour (CoinGecko hourly, <= 90 days).
 */

import fs from "node:fs";
import path from "node:path";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { get, put } from "@vercel/blob";

const ROOT = path.resolve(import.meta.dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const WRITE = process.argv.includes("--write");
const DO_HISTORY = process.argv.includes("--history");
const DO_DAILY = process.argv.includes("--daily");
if (!DO_HISTORY && !DO_DAILY) { console.log("pass --history and/or --daily (add --write to save)"); process.exit(1); }

const RAO = 1e9;
const BLOCK_MS = 12_000;
// Two in flight keeps well inside the archive node's historical-read budget.
const CONCURRENCY = 2;

const num = v => { if (v == null) return 0; if (typeof v === "number") return v; try { return Number(BigInt(String(v))); } catch { return 0; } };

async function readBlob(name) {
  const b = await get(name, { token: TOKEN, access: "private", abortSignal: AbortSignal.timeout(60_000) });
  const r = b.stream.getReader(); const cs = [];
  while (true) { const { done, value } = await r.read(); if (done) break; cs.push(value); }
  return JSON.parse(Buffer.concat(cs).toString("utf-8"));
}

async function pool(items, limit, fn) {
  let i = 0, done = 0;
  const out = new Array(items.length);
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      for (let attempt = 1; ; attempt++) {
        try { out[idx] = await fn(items[idx]); break; }
        catch (e) {
          // The public archive node has a burst budget for historical reads
          // ("Historical work rate limit exceeded"). It refills within a
          // couple of minutes, so wait it out rather than give up.
          const budget = /rate limit|budget/i.test(e.message);
          if (attempt >= (budget ? 12 : 3)) { out[idx] = null; console.warn(`  ${items[idx]}: ${e.message.slice(0, 120)}`); break; }
          await new Promise(r => setTimeout(r, budget ? 20_000 : 1500 * attempt));
        }
      }
      if (++done % 20 === 0) process.stdout.write(`  ${done}/${items.length}\n`);
    }
  }));
  return out;
}

const api = await ApiPromise.create({ provider: new WsProvider("wss://archive.chain.opentensor.ai:443"), noInitWarn: true });
const head = (await api.rpc.chain.getHeader()).number.toNumber();
const headTs = Number((await api.query.timestamp.now()).toString());
console.log(`archive head ${head} @ ${new Date(headTs).toISOString()}`);

/**
 * Block-time calibration. Blocks are nominally 12s but drift (7 days back
 * measured ~53 minutes off pure 12s arithmetic), so measure the real average
 * over the window once, then place every snapshot by interpolation. One
 * historical read instead of two per snapshot.
 */
let calib = null;
async function calibrate(oldestMs) {
  const back = Math.min(head - 1, Math.round((headTs - oldestMs) / BLOCK_MS) + 600);
  const at = await api.at(await api.rpc.chain.getBlockHash(head - back));
  const ts = Number((await at.query.timestamp.now()).toString());
  calib = { block: head - back, ts, msPerBlock: (headTs - ts) / back };
  console.log(`calibrated: ${(calib.msPerBlock / 1000).toFixed(3)}s per block over ${back} blocks`);
}
const estimateBlock = tMs => Math.min(head, Math.round(calib.block + (tMs - calib.ts) / calib.msPerBlock));

/** Price-only read at a timestamp: one historical call. */
async function priceAt(tMs) {
  const block = estimateBlock(tMs);
  const at = await api.at(await api.rpc.chain.getBlockHash(block));
  const dyn = (await at.call.subnetInfoRuntimeApi.getAllDynamicInfo()).toJSON().filter(Boolean);
  const rows = new Map();
  for (const d of dyn) {
    const aIn = num(d.alphaIn);
    if (d.netuid === 0 || aIn <= 0) continue;
    rows.set(d.netuid, { price: num(d.taoIn) / aIn, reg: num(d.networkRegisteredAt) });
  }
  return { block, rows };
}

/** Block whose timestamp is closest to (and not after) t. Two correction passes. */
async function blockAt(tMs) {
  let b = head - Math.round((headTs - tMs) / BLOCK_MS);
  for (let pass = 0; pass < 2; pass++) {
    const at = await api.at(await api.rpc.chain.getBlockHash(b));
    const ts = Number((await at.query.timestamp.now()).toString());
    const shift = Math.round((tMs - ts) / BLOCK_MS);
    if (shift === 0) break;
    b += shift;
  }
  return Math.min(b, head);
}

async function entries(at, item) {
  const out = new Map();
  // Items added by later runtime upgrades (SubnetProtocolAlpha, SubnetExcessTao)
  // do not exist at older blocks. Before they existed they were zero, so an
  // empty map is the correct reading, not an error.
  const q = at.query.subtensorModule[item];
  if (!q) return out;
  for (const [k, v] of await q.entries()) out.set(k.args.at(-1).toNumber(), num(v.toJSON()));
  return out;
}

async function marketAt(tMs, withSupply) {
  const block = await blockAt(tMs);
  const at = await api.at(await api.rpc.chain.getBlockHash(block));
  const dyn = (await at.call.subnetInfoRuntimeApi.getAllDynamicInfo()).toJSON().filter(Boolean);
  let staked = new Map(), protocol = new Map(), tin = new Map(), ex = new Map();
  if (withSupply) {
    [staked, protocol, tin, ex] = await Promise.all([
      entries(at, "totalAlphaStaked"), entries(at, "subnetProtocolAlpha"),
      entries(at, "subnetTaoInEmission"), entries(at, "subnetExcessTao"),
    ]);
  }
  let emTotal = 0;
  for (const d of dyn) if (d.netuid !== 0) emTotal += (tin.get(d.netuid) ?? 0) + (ex.get(d.netuid) ?? 0);
  const rows = new Map();
  for (const d of dyn) {
    if (d.netuid === 0) continue;
    const aIn = num(d.alphaIn) / RAO; if (aIn <= 0) continue;
    const price = (num(d.taoIn) / RAO) / aIn;
    rows.set(d.netuid, {
      price,
      reg: num(d.networkRegisteredAt),
      mcapTao: withSupply ? price * (aIn + ((staked.get(d.netuid) ?? 0) + (protocol.get(d.netuid) ?? 0)) / RAO) : null,
      emShare: withSupply && emTotal > 0 ? ((tin.get(d.netuid) ?? 0) + (ex.get(d.netuid) ?? 0)) / emTotal : null,
    });
  }
  return { block, rows };
}

// Registration blocks at head: prices from before a netuid's current
// registration belong to a different project and are not attributed to it.
const headRows = (await marketAt(headTs, false)).rows;
const regNow = new Map([...headRows].map(([id, r]) => [id, r.reg]));

// ── Hourly TAO/USD (CoinGecko returns hourly points for <= 90 days) ─────
async function hourlyTaoUsd() {
  const r = await fetch("https://api.coingecko.com/api/v3/coins/bittensor/market_chart?vs_currency=usd&days=90");
  const pts = (await r.json()).prices ?? [];
  return pts; // [ms, usd]
}
const taoUsdAt = (pts, ms) => {
  let best = null, bd = Infinity;
  for (const [t, u] of pts) { const d = Math.abs(t - ms); if (d < bd) { bd = d; best = u; } }
  return bd <= 3 * 3600_000 ? best : null;
};

if (DO_HISTORY) {
  console.log("\n== re-deriving prices in subnet-scores-history.json ==");
  const hist = await readBlob("subnet-scores-history.json");
  const stamps = Object.keys(hist).sort();
  // Everything from Sep 12 on is suspect: the replay alternated between two
  // stale copies, which slips past a same-as-last-hour check, so flagging
  // individual snapshots is not trustworthy. Re-derive the whole window, plus
  // any older snapshot that has no price at all.
  const WINDOW_START = process.env.REPAIR_FROM || "2026-09-12T00:00:00.000Z";
  const targets = stamps.filter(t => t >= WINDOW_START ||
    Object.values(hist[t]).filter(r => typeof r.price === "number").length < 50);
  const usd = await hourlyTaoUsd();
  console.log(`${stamps.length} snapshots, ${targets.length} to re-derive (from ${targets[0]}), ${usd.length} hourly TAO/USD points`);
  await calibrate(new Date(targets[0]).getTime());
  const results = await pool(targets, CONCURRENCY, async ts => ({ ts, m: await priceAt(new Date(ts).getTime()) }));

  // Apply onto a copy. On --write this is repeated against a FRESH read of the
  // blob just before saving: the scan rewrites history every 10 minutes and
  // this run takes several, so applying to the copy read at the start would
  // clobber rows the scan added meanwhile.
  const apply = (h) => {
    let rewritten = 0, cleared = 0, skipped = 0;
    results.forEach((res, i) => {
      const ts = targets[i];
      if (!h[ts]) return;
      if (!res) {
        // Unreadable (archive budget). Blank it rather than leave a stale
        // price that would draw a spike among the repaired ones.
        for (const row of Object.values(h[ts])) { if (row.price !== undefined) { delete row.price; delete row.mcap; cleared++; } }
        skipped++;
        return;
      }
      const rate = taoUsdAt(usd, new Date(ts).getTime());
      for (const [id, row] of Object.entries(h[ts])) {
        const c = res.m.rows.get(Number(id));
        if (!c || !rate) {
          if (row.price !== undefined) { delete row.price; delete row.mcap; cleared++; }
          continue;
        }
        const newUsd = c.price * rate;
        // Market cap = supply x price. The recorded supply (mcap / price) was
        // right even when the price was stale and moves slowly, so keep it and
        // apply the true price. Without a usable old pair, leave mcap unset.
        if (typeof row.mcap === "number" && typeof row.price === "number" && row.price > 0) {
          row.mcap = (row.mcap / row.price) * newUsd;
        } else {
          delete row.mcap;
        }
        row.price = newUsd;
        rewritten++;
      }
    });
    return { rewritten, cleared, skipped };
  };

  const stats = apply(hist);
  console.log(`rewritten ${stats.rewritten} rows, cleared ${stats.cleared}, unreadable snapshots blanked ${stats.skipped}`);
  const sample = targets.slice(-8).map(t => `${t.slice(5, 16)} ${hist[t]["28"]?.price?.toFixed(4)}`).join(" | ");
  console.log(`SN28 last 8: ${sample}`);
  const vals = targets.map(t => hist[t]["28"]?.price).filter(v => typeof v === "number");
  console.log(`SN28 distinct prices in window: ${new Set(vals).size}/${vals.length}`);

  if (WRITE) {
    const fresh = await readBlob("subnet-scores-history.json");
    const s2 = apply(fresh);
    fs.writeFileSync(path.join(process.env.TMPDIR || "/tmp", "history-repaired.json"), JSON.stringify(fresh));
    await put("subnet-scores-history.json", JSON.stringify(fresh), { access: "private", addRandomSuffix: false, allowOverwrite: true, token: TOKEN, contentType: "application/json" });
    console.log(`history WRITTEN onto fresh copy (${Object.keys(fresh).length} snapshots, ${s2.rewritten} rows)`);
  }
}

if (DO_DAILY) {
  console.log("\n== building price-daily-tao.json (365 days) ==");
  const days = [];
  // Deep reads cost the archive more the further back they go (60d ~2s,
  // 120d ~8s, 200d+ exhausts the budget in one read), so default to the 3M
  // range here; the scan fills older days one per run.
  const DAYS = Number(process.argv.find(a => a.startsWith("--days="))?.split("=")[1] ?? 95);
  for (let i = DAYS; i >= 1; i--) {
    const d = new Date(headTs - i * 86400_000);
    days.push(d.toISOString().slice(0, 10));
  }
  await calibrate(new Date(`${days[0]}T00:00:00Z`).getTime());
  const results = await pool(days, CONCURRENCY, async day => ({ day, m: await priceAt(new Date(`${day}T23:59:00Z`).getTime()) }));
  // Merge into whatever the scan has already written rather than replace it.
  let archive;
  try { archive = await readBlob("price-daily-tao.json"); } catch { archive = null; }
  archive = archive ?? { days: {} };
  archive.savedAt = new Date().toISOString();
  archive.reg = Object.fromEntries([...regNow].map(([k, v]) => [String(k), v]));
  let kept = 0, dropped = 0;
  for (const res of results) {
    if (!res) continue;
    const row = {};
    for (const [id, c] of res.m.rows) {
      if (regNow.get(id) !== c.reg) { dropped++; continue; } // earlier occupant of this netuid
      row[id] = c.price; kept++;
    }
    archive.days[res.day] = row;
  }
  // Today, from head.
  archive.days[new Date(headTs).toISOString().slice(0, 10)] = Object.fromEntries([...headRows].map(([id, r]) => [String(id), r.price]));
  console.log(`${Object.keys(archive.days).length} days, ${kept} closes kept, ${dropped} dropped (recycled netuids)`);
  const s28 = Object.keys(archive.days).sort().filter((_, i, a) => i % 60 === 0 || i === a.length - 1).map(d => `${d} ${archive.days[d]["28"]?.toFixed(5) ?? "-"}`).join(" | ");
  console.log(`SN28 sample: ${s28}`);
  if (WRITE) {
    await put("price-daily-tao.json", JSON.stringify(archive), { access: "private", addRandomSuffix: false, allowOverwrite: true, token: TOKEN, contentType: "application/json" });
    console.log("daily archive WRITTEN");
  }
}

await api.disconnect();
process.exit(0);
