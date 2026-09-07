#!/usr/bin/env node
/**
 * Re-run the subnet logo audit and refresh /public/subnets.
 *
 * Why this exists: logos used to be hotlinked from subnet teams' own sites,
 * GitHub raw URLs, S3 buckets and Vercel preview deployments. Those URLs
 * belong to other people and move without warning — an audit on 2026-09-07
 * found 32 of 95 had rotted, each one silently falling back to a coloured
 * initials avatar. Everything is self-hosted now, and this script is how the
 * set gets refreshed when new subnets register or a logo changes.
 *
 * Usage:  node scripts/refresh-subnet-logos.mjs [--write]
 *
 * Without --write it only reports: which local files are missing, which
 * subnets have no logo at all, and which upstream sources have newer art.
 * With --write it downloads into public/subnets and rewrites the map.
 *
 * Source preference, best first:
 *   1. the file we already serve (if the subnet still exists)
 *   2. TaoStats subnet-identity logo_url
 *   3. the team's GitHub org avatar (github.com/<org>.png) — very stable
 *
 * Requires TAOSTATS_API_KEY in .env.local.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "subnets");
const MAP_FILE = path.join(ROOT, "src", "lib", "subnet-logos.ts");
const WRITE = process.argv.includes("--write");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, "");
}

const EXT_BY_TYPE = [[/svg/, "svg"], [/png/, "png"], [/jpe?g/, "jpg"], [/webp/, "webp"], [/gif/, "gif"]];

/** Returns the extension if the URL serves a real image, else null. */
async function probe(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    const hit = EXT_BY_TYPE.find(([re]) => re.test(ct));
    if (!hit) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 0 ? { ext: hit[1], buf } : null;
  } catch { return null; }
}

async function mapWithConcurrency(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }));
  return out;
}

const taoHeaders = { Authorization: process.env.TAOSTATS_API_KEY || "" };
const identityRes = await fetch("https://api.taostats.io/api/subnet/identity/v1?limit=200", { headers: taoHeaders })
  .catch(() => null);
const identities = identityRes?.ok ? await identityRes.json().then(j => j.data || []) : [];
if (!identities.length) {
  // Usually a 429 (rate limit or exhausted credits). GitHub avatars still
  // work, so continue, but say so - a silent 0 here looks like "no new logos".
  console.warn(`WARNING: TaoStats identities unavailable (${identityRes ? "HTTP " + identityRes.status : "network error"}).`);
  console.warn("         Falling back to GitHub org avatars only; re-run later for the full set.");
}
const live = await fetch("https://www.alphagap.io/api/cached-scan")
  .then(r => r.json()).then(j => (j.leaderboard || []).map(s => ({ netuid: s.netuid, name: s.name })));

if (!live.length) { console.error("Could not read the live subnet list — aborting."); process.exit(1); }
console.log(`live subnets: ${live.length} | identities: ${identities.length}`);

const idById = Object.fromEntries(identities.map(i => [i.netuid, i]));
const existing = Object.fromEntries(
  (fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR) : [])
    .map(f => [f.match(/^sn(\d+)[.-]/)?.[1], f]).filter(([id]) => id),
);
// Hand-placed entries (data: URIs, bespoke art) live only in the map, with no
// file on disk. Without this they look "missing" and would get overwritten by
// whatever upstream happens to serve.
const currentMap = fs.readFileSync(MAP_FILE, "utf8");
const mapBody = currentMap.match(/SUBNET_LOGOS[^{]*\{([\s\S]*?)\n\};/)?.[1] ?? "";
for (const line of mapBody.split("\n")) {
  const m = line.match(/^\s*(\d+):\s*"([^"]+)"/);
  if (m && !/^\/subnets\//.test(m[2])) existing[m[1]] ??= "(inline)";
}

const results = await mapWithConcurrency(live, 10, async (s) => {
  if (existing[s.netuid]) return { ...s, status: "have", file: existing[s.netuid] };

  const candidates = [];
  const tao = idById[s.netuid]?.logo_url;
  if (tao) candidates.push(["taostats", tao]);
  const org = (idById[s.netuid]?.github_repo || "").match(/github\.com\/([^/\s]+)/i)?.[1];
  if (org) candidates.push(["github", `https://github.com/${org}.png?size=200`]);

  for (const [src, url] of candidates) {
    const img = await probe(url);
    if (img) {
      const file = `sn${s.netuid}.${img.ext}`;
      if (WRITE) { fs.mkdirSync(OUT_DIR, { recursive: true }); fs.writeFileSync(path.join(OUT_DIR, file), img.buf); }
      return { ...s, status: WRITE ? "added" : "available", file, src };
    }
  }
  return { ...s, status: "missing" };
});

const by = (st) => results.filter(r => r.status === st);
console.log(`  already served: ${by("have").length}`);
console.log(`  ${WRITE ? "added" : "available to add"}: ${by(WRITE ? "added" : "available").length}`);
for (const r of by(WRITE ? "added" : "available")) console.log(`    SN${r.netuid} ${r.name} (${r.src})`);
const missing = by("missing");
console.log(`  no logo found anywhere: ${missing.length}`);
for (const r of missing) console.log(`    SN${r.netuid} ${r.name}`);

if (!WRITE) {
  console.log("\nDry run. Re-run with --write to download and update the map.");
  process.exit(0);
}

// Rewrite the map, preserving any hand-placed entry (data: URIs, custom art).
const prev = fs.readFileSync(MAP_FILE, "utf8");
const body = prev.match(/SUBNET_LOGOS[^{]*\{([\s\S]*?)\n\};/)[1];
const manual = {};
for (const line of body.split("\n")) {
  const m = line.match(/^\s*(\d+):\s*"([^"]+)"/);
  if (m && !/^\/subnets\/sn\d+\.\w+$/.test(m[2])) manual[+m[1]] = m[2];
}
const files = Object.fromEntries(fs.readdirSync(OUT_DIR).map(f => [f.match(/^sn(\d+)\./)?.[1], f]).filter(([id]) => id));
const nameById = Object.fromEntries(live.map(s => [s.netuid, s.name]));
const rows = [];
for (const id of [...new Set([...Object.keys(files), ...Object.keys(manual)])].map(Number).sort((a, b) => a - b)) {
  const url = manual[id] ?? `/subnets/${files[id]}`;
  rows.push(`  ${id}: ${JSON.stringify(url)}, // ${nameById[id] ?? ""}`.replace(/ \/\/ $/, ","));
}
const header = prev.slice(0, prev.indexOf("export const SUBNET_LOGOS"));
const tail = prev.slice(prev.indexOf("\n};", prev.indexOf("SUBNET_LOGOS")));
fs.writeFileSync(MAP_FILE, `${header}export const SUBNET_LOGOS: Record<number, string> = {\n${rows.join("\n")}${tail}`);
console.log(`\nWrote ${rows.length} entries to src/lib/subnet-logos.ts`);
