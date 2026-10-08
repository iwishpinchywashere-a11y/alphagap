#!/usr/bin/env node
/**
 * Merge the per-batch research (and verification) output into
 * src/data/valuation.json, validating every record against the schema the
 * page and scoring expect.
 *
 *   node scripts/merge-valuation-research.mjs <research-dir> [--write]
 *
 * research-dir holds out_batch_NN.json (researcher output, one array each)
 * and optionally verify_NN.json (verifier output, which overrides the
 * researcher's revenue/buybacks/growth and stamps `verified`).
 *
 * Validation is strict on purpose: a record that fails is reported and left
 * out rather than shipped with a hole, because the page renders every field.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const dir = process.argv[2];
const WRITE = process.argv.includes("--write");
if (!dir) { console.error("usage: merge-valuation-research.mjs <research-dir> [--write]"); process.exit(1); }

const CONF = new Set(["confirmed", "self_reported", "estimated", "pre_revenue", "unknown"]);
const BUY = new Set(["active", "announced", "planned", "none", "unknown"]);
const GROWTH = new Set(["accelerating", "growing", "flat", "declining", "unknown"]);
const CTYPE = new Set(["enterprise", "developer", "consumer", "mixed", "none"]);
const STATUS = new Set(["live", "dead", "unknown"]);

const str = (v, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const numOrNull = v => (typeof v === "number" && Number.isFinite(v) ? v : null);
const urls = v => (Array.isArray(v) ? v.filter(u => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 8) : []);
const pick = (set, v, fallback) => (set.has(v) ? v : fallback);

function normalise(r, problems) {
  const netuid = Number(r?.netuid);
  if (!Number.isInteger(netuid)) { problems.push(`bad netuid ${JSON.stringify(r?.netuid)}`); return null; }
  const p = r.product ?? {}, rv = r.revenue ?? {}, g = r.growth ?? {}, c = r.customers ?? {}, b = r.buybacks ?? {};
  const out = {
    netuid,
    name: str(r.name, 60) || `SN${netuid}`,
    status: pick(STATUS, r.status, "unknown"),
    product: {
      what_it_is: str(p.what_it_is),
      category: str(p.category, 60) || "Uncategorised",
      live_product: !!p.live_product,
      pricing_url: urls([p.pricing_url])[0] ?? null,
      quality_score: Math.max(0, Math.min(100, Math.round(numOrNull(p.quality_score) ?? 0))),
      quality_rationale: str(p.quality_rationale),
    },
    revenue: {
      arr_usd: numOrNull(rv.arr_usd),
      confidence: pick(CONF, rv.confidence, "unknown"),
      basis: str(rv.basis),
      as_of: /^\d{4}-\d{2}(-\d{2})?$/.test(rv.as_of ?? "") ? rv.as_of : null,
      evidence: str(rv.evidence),
      sources: urls(rv.sources),
    },
    growth: {
      trend: pick(GROWTH, g.trend, "unknown"),
      evidence: str(g.evidence),
      prior_arr_usd: numOrNull(g.prior_arr_usd),
      prior_as_of: /^\d{4}-\d{2}(-\d{2})?$/.test(g.prior_as_of ?? "") ? g.prior_as_of : null,
    },
    customers: {
      named: Array.isArray(c.named) ? c.named.filter(x => typeof x === "string").map(x => x.slice(0, 60)).slice(0, 12) : [],
      count: numOrNull(c.count),
      type: pick(CTYPE, c.type, "none"),
      evidence: str(c.evidence),
    },
    buybacks: {
      status: pick(BUY, b.status, "unknown"),
      mechanism: str(b.mechanism),
      pct_of_revenue: numOrNull(b.pct_of_revenue),
      usd_to_date: numOrNull(b.usd_to_date),
      evidence: str(b.evidence),
      sources: urls(b.sources),
    },
    notes: str(r.notes, 900),
  };
  // Consistency rules. These are the mistakes a researcher most often makes.
  if (out.revenue.arr_usd != null && out.revenue.arr_usd > 0 && ["pre_revenue", "unknown"].includes(out.revenue.confidence)) {
    problems.push(`SN${netuid}: ARR ${out.revenue.arr_usd} with confidence ${out.revenue.confidence}; downgrading ARR to null`);
    out.revenue.arr_usd = null;
  }
  if (out.revenue.arr_usd != null && out.revenue.arr_usd > 0 && out.revenue.sources.length === 0) {
    problems.push(`SN${netuid}: ARR with no source URL; set to unknown`);
    out.revenue.arr_usd = null; out.revenue.confidence = "unknown";
  }
  if (["active", "announced"].includes(out.buybacks.status) && out.buybacks.sources.length === 0) {
    problems.push(`SN${netuid}: buyback ${out.buybacks.status} with no source URL; set to unknown`);
    out.buybacks.status = "unknown";
  }
  if (out.revenue.arr_usd === 0) out.revenue.arr_usd = null;
  return out;
}

const files = fs.readdirSync(dir).filter(f => /^out_batch_\d+\.json$/.test(f)).sort();
const verifyFiles = fs.readdirSync(dir).filter(f => /^verify_\d+\.json$/.test(f)).sort();
const problems = [];
const byId = new Map();
for (const f of files) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { problems.push(`${f}: unparseable (${e.message})`); continue; }
  if (!Array.isArray(arr)) { problems.push(`${f}: not an array`); continue; }
  for (const r of arr) { const n = normalise(r, problems); if (n) byId.set(n.netuid, n); }
}
let verified = 0;
for (const f of verifyFiles) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { problems.push(`${f}: unparseable (${e.message})`); continue; }
  for (const v of arr) {
    const rec = byId.get(Number(v?.netuid));
    if (!rec) continue;
    const patched = normalise({ ...rec, revenue: v.revenue ?? rec.revenue, buybacks: v.buybacks ?? rec.buybacks, growth: v.growth ?? rec.growth }, problems);
    if (!patched) continue;
    patched.notes = [rec.notes, v.notes ? `Verifier: ${str(v.notes, 400)}` : ""].filter(Boolean).join(" ").slice(0, 900);
    patched.verified = { at: new Date().toISOString().slice(0, 10), revenue_ok: v.verdict !== "rejected", buyback_ok: v.verdict !== "rejected", notes: str(v.changed, 300) };
    byId.set(patched.netuid, patched);
    verified++;
  }
}

const rows = [...byId.values()].sort((a, b) => a.netuid - b.netuid);
const withArr = rows.filter(r => (r.revenue.arr_usd ?? 0) > 0);
console.log(`batches ${files.length}, records ${rows.length}, verified ${verified}`);
console.log(`revenue>0: ${withArr.length} | confirmed ${withArr.filter(r => r.revenue.confidence === "confirmed").length}, self_reported ${withArr.filter(r => r.revenue.confidence === "self_reported").length}, estimated ${withArr.filter(r => r.revenue.confidence === "estimated").length}`);
console.log(`buybacks: active ${rows.filter(r => r.buybacks.status === "active").length}, announced ${rows.filter(r => r.buybacks.status === "announced").length}, planned ${rows.filter(r => r.buybacks.status === "planned").length}`);
console.log(`stated ARR total: $${(withArr.reduce((s, r) => s + r.revenue.arr_usd, 0) / 1e6).toFixed(1)}M`);
if (problems.length) { console.log(`\n${problems.length} problems:`); for (const p of problems.slice(0, 40)) console.log("  " + p); }
if (WRITE) {
  fs.writeFileSync(path.join(ROOT, "src/data/valuation.json"), JSON.stringify(rows, null, 1));
  console.log(`\nwrote src/data/valuation.json (${rows.length} records)`);
}
