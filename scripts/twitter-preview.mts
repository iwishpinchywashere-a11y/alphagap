// Preview what @AlphaGapTAO would post next, without posting.
//   npx tsx scripts/twitter-preview.mts [N]
// Lists the ranked stories from live data (valuation.json, revenue-mentions.json,
// the posted log), then writes drafts for the top N with the same model and
// checks the route uses. Costs N model calls. Needs BLOB_READ_WRITE_TOKEN and
// ANTHROPIC_API_KEY in .env.local.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { get } from "@vercel/blob";
import { buildStories, writeDraft, composePost, validate } from "../src/lib/twitter-stories";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
const pick = (k: string) => (env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
const tok = pick("BLOB_READ_WRITE_TOKEN");
const key = pick("ANTHROPIC_API_KEY");
const N = Number(process.argv[2] || 6);

async function blob<T>(name: string): Promise<T | null> {
  try { const r = await get(name, { access: "private", token: tok }); return JSON.parse(await new Response(r!.stream).text()); } catch { return null; }
}

const research = JSON.parse(fs.readFileSync(path.join(root, "src/data/valuation.json"), "utf8"));
const mentions = (await blob<{ mentions: any[] }>("revenue-mentions.json"))?.mentions ?? [];
const posted = (await blob<{ posted: any[] }>("twitter-posted-log-v2.json"))?.posted ?? [];

const stories = buildStories({ research, mentions, posted });
const kinds: Record<string, number> = {};
for (const s of stories) kinds[s.kind] = (kinds[s.kind] ?? 0) + 1;
console.log(`stories: ${stories.length}`, kinds);
for (const s of stories.slice(0, 20)) console.log(`  ${String(Math.round(s.priority)).padStart(3)}  ${s.kind.padEnd(11)} SN${String(s.netuid).padEnd(4)} ${s.name.padEnd(14)} ${s.at.slice(0, 10)}  nums=${s.numbers.length}`);

if (process.env.SHOW_FACTS) {
  for (const s of stories.slice(0, Number(process.env.SHOW_FACTS))) {
    console.log(`\n==== FACTS ${s.kind} SN${s.netuid} ${s.name} ====`);
    for (const f of s.facts) console.log("-", f);
    console.log("NUMBERS:", s.numbers.join(" | "));
  }
}

console.log("\n==== DRAFTS ====");
for (const s of stories.slice(0, N)) {
  const t0 = Date.now();
  const r = await writeDraft(s, key);
  console.log(`\n--- ${s.kind} SN${s.netuid} ${s.name} (${r.attempts} attempt${r.attempts > 1 ? "s" : ""}, ${((Date.now() - t0) / 1000).toFixed(1)}s) ---`);
  if (r.text) { console.log(composePost(r.text, s.link)); console.log(`[${r.text.length} chars body; validate=${validate(r.text, s).join("; ") || "ok"}]`); }
  else console.log("REJECTED:", r.reason);
}
