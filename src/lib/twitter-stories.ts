/**
 * Story selection and writing for @AlphaGapTAO.
 *
 * REBUILT 2026-11-06. The previous bot tweeted the feed-digest's dev-commit
 * summaries ("Subnet fixes data handling, launches miner competition
 * bundle"), which read like changelogs. The account now talks about what
 * subnets SELL and EARN, in plain English, from the same research that
 * powers /benchmarks:
 *
 *   1. first_party - a subnet's own post with a figure or product news,
 *      flagged by the revenue-watch cron (revenue-mentions.json). "Vanta
 *      just passed $1M paid out to traders." Freshest, highest priority.
 *   2. research    - a revenue record from src/data/valuation.json that was
 *      re-read recently (the weekly research refresh). "Targon is showing
 *      $1.18M of platform revenue for the last 30 days on its own dashboard."
 *      One post per figure: the fingerprint carries as_of and the amount, so
 *      an unchanged record is never repeated.
 *   3. profile     - what a strong live product actually is, for subnets
 *      with no fresh number. Fallback only, one per subnet per month.
 *
 * Every figure in a post must appear verbatim in the facts handed to the
 * writer (see ALLOWED NUMBERS in the prompt and checkNumbers below); a post
 * that invents or rounds a number is rejected and the next story is tried.
 *
 * Pure functions plus one network call (writeDraft). No "@/" imports so the
 * module can be exercised from a plain script.
 */

import type { ResearchRecord } from "./valuation";
import type { RevenueMention } from "./revenue-mentions";

export type StoryKind = "first_party" | "research" | "profile";

export interface Story {
  fingerprint: string;
  kind: StoryKind;
  netuid: number;
  name: string;
  /** Higher posts first. */
  priority: number;
  /** ISO date the story is anchored to (post date or research as_of). */
  at: string;
  /** Plain sentences handed to the writer. */
  facts: string[];
  /** Exact numeric strings the post may contain. */
  numbers: string[];
  /** Appended under the post: the source post, or the benchmarks page. */
  link: string;
}

export interface PostedEntry {
  fingerprint: string;
  netuid: number;
  text: string;
  postedAt: string;
  kind?: StoryKind;
}

export const FIRST_PARTY_FRESH_DAYS = 10;
export const RESEARCH_FRESH_DAYS = 21;
export const SUBNET_COOLDOWN_DAYS = 4;
export const PROFILE_COOLDOWN_DAYS = 30;
export const PROFILE_MIN_QUALITY = 70;
export const BENCHMARKS_LINK = "alphagap.io/benchmarks";

const DAY = 86_400_000;

// ── Formatting helpers ──────────────────────────────────────────────────────

/** "$1,056,991" style. */
function full(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

/** Compact forms a writer might naturally reach for: "$1.06M", "$1.1M", "$806K". */
function compact(n: number): string[] {
  const out: string[] = [];
  if (n >= 1e9) { out.push(`$${(n / 1e9).toFixed(1)}B`, `$${(n / 1e9).toFixed(2)}B`); }
  else if (n >= 1e6) { out.push(`$${(n / 1e6).toFixed(1)}M`, `$${(n / 1e6).toFixed(2)}M`); }
  else if (n >= 1e3) { out.push(`$${Math.round(n / 1e3)}K`, `$${(n / 1e3).toFixed(1)}K`); }
  else out.push(`$${Math.round(n)}`);
  // "$1.0M" reads badly; also offer the integer form.
  if (n >= 1e6 && Number.isInteger(n / 1e6)) out.push(`$${n / 1e6}M`);
  if (n >= 1e3 && n < 1e6 && Number.isInteger(n / 1e3)) out.push(`$${n / 1e3}K`);
  return Array.from(new Set(out));
}

function moneyForms(n: number | null | undefined): string[] {
  if (!n || !Number.isFinite(n) || n <= 0) return [];
  return [full(n), ...compact(n)];
}

/** Numeric tokens exactly as they appear in a piece of text. */
export function numericTokens(text: string): string[] {
  const t = text.replace(/\bSN\s?\d+\b/gi, " ").replace(/\bsubnet\s+\d+\b/gi, " ");
  const re = /\$?\d[\d,]*(?:\.\d+)?\s?(?:[KMBkmb]\b|%|x\b)?/g;
  const out = new Set<string>();
  for (const m of t.match(re) ?? []) out.add(m.trim());
  return Array.from(out);
}

function norm(tok: string): string {
  return tok.toLowerCase().replace(/[\s,]/g, "");
}

/**
 * Every numeric token in the draft must be in the allowed list. Years and
 * the subnet number are exempt. Returns the offending tokens.
 */
export function checkNumbers(draft: string, allowed: string[]): string[] {
  const ok = new Set(allowed.map(norm));
  const bad: string[] = [];
  for (const tok of numericTokens(draft)) {
    const n = norm(tok);
    if (/^(19|20)\d\d$/.test(n)) continue;
    if (ok.has(n)) continue;
    // "$1.1M" against an allowed "$1.10M" and similar trailing-zero forms.
    if (ok.has(n.replace(/\.(\d)0([kmb%])$/, ".$1$2"))) continue;
    bad.push(tok);
  }
  return bad;
}

// ── Analyst-note hygiene ────────────────────────────────────────────────────

/**
 * Research notes are written for an internal audience and carry process
 * directives ("DO NOT re-adopt", "CARRIED FORWARD", "this cycle"). Drop those
 * sentences before the writer sees the text, so the post describes the
 * subnet rather than our workflow.
 */
const PROCESS_RE = /\b(DO NOT|MUST NOT|DISPUTED|PENDING A DECISION|CARRIED FORWARD|UNCHANGED|NOT re-measured|this cycle|this run|this pass|re-adopt|prior record|previous pass|measurement fault|WITHDRAWN|on an unattended run|owner decision|rebalance|KEPT at|RE-DERIVED|UPGRADED from|DOWNGRADED from|do not inherit|do not attribute|TWO INDEP)/i;

export function cleanNotes(text: string, maxLen: number): string {
  const sentences = (text || "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z0-9'"(])/);
  const kept: string[] = [];
  let len = 0;
  for (const s of sentences) {
    if (!s.trim() || PROCESS_RE.test(s)) continue;
    if (len + s.length > maxLen) break;
    kept.push(s.trim());
    len += s.length + 1;
  }
  return kept.join(" ");
}

function firstSentences(text: string, maxLen: number): string {
  return cleanNotes(text, maxLen) || (text || "").replace(/\s+/g, " ").slice(0, maxLen);
}

function daysOld(iso: string | null | undefined, now: number): number {
  if (!iso) return 9999;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? (now - t) / DAY : 9999;
}

const CONFIDENCE_WORDS: Record<string, string> = {
  confirmed: "confirmed from the subnet's own published numbers",
  self_reported: "the subnet's own self-reported figure, not independently verified",
  estimated: "AlphaGap's own estimate, not a figure the subnet has published",
};

// ── Story builders ──────────────────────────────────────────────────────────

function firstPartyStory(m: RevenueMention, rec: ResearchRecord | undefined, now: number): Story | null {
  const age = daysOld(m.postedAt, now);
  if (age > FIRST_PARTY_FRESH_DAYS) return null;
  const text = (m.text || "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  if (text.length < 40) return null;
  const date = m.postedAt.slice(0, 10);
  const facts: string[] = [
    `${m.name} (SN${m.netuid}) posted this on ${date} from its own account @${m.handle}: "${text.slice(0, 600)}"`,
  ];
  const numbers = new Set<string>(numericTokens(text));
  if (m.figures) {
    facts.push(`Figures extracted from that post: ${m.figures.summary}`);
    for (const n of [m.figures.revenue_usd, m.figures.arr_usd, m.figures.buyback_usd]) moneyForms(n).forEach(x => numbers.add(x));
    if (m.figures.customers) numbers.add(String(m.figures.customers)).add(m.figures.customers.toLocaleString("en-US"));
  }
  if (rec) {
    facts.push(`What ${rec.name} sells: ${firstSentences(rec.product.what_it_is, 320)}`);
    if ((rec.revenue.arr_usd ?? 0) > 0 && CONFIDENCE_WORDS[rec.revenue.confidence]) {
      facts.push(`AlphaGap's revenue record for it: about ${compact(rec.revenue.arr_usd!)[0]} a year (${CONFIDENCE_WORDS[rec.revenue.confidence]}, as of ${rec.revenue.as_of ?? "unknown"}); growth trend: ${rec.growth.trend}.`);
      moneyForms(rec.revenue.arr_usd).forEach(x => numbers.add(x));
    }
    if (rec.buybacks.status === "active") facts.push(`Buybacks: active. ${firstSentences(rec.buybacks.evidence, 220)}`);
    const caveats = cleanNotes(rec.notes, 260);
    if (caveats) facts.push(`Caveats to respect: ${caveats}`);
  }
  // Emissions, rewards and reserves are not revenue. The extractor sometimes
  // books them as a monthly revenue figure (Vanta's "$806K a month in network
  // trading rewards"), so a post built on that language loses the new-figure
  // bonus and the more specific post about the same subnet wins instead.
  const emissionTalk = /\b(emissions?|network (trading )?rewards|reserves?|payouts?|giveaway)\b/i.test(text);
  const figureBonus = m.flag === "new_figure" && !emissionTalk ? 20 : (m.figures?.buyback_usd ? 12 : 0);
  const specificity = Math.min(10, numericTokens(text).length * 2);
  return {
    fingerprint: `fp:${m.id}`,
    kind: "first_party",
    netuid: m.netuid,
    name: m.name,
    priority: 80 + figureBonus + specificity + Math.max(0, FIRST_PARTY_FRESH_DAYS - age),
    at: m.postedAt,
    facts,
    numbers: Array.from(numbers),
    link: m.url,
  };
}

function researchStory(rec: ResearchRecord, now: number): Story | null {
  if (rec.status !== "live") return null;
  const arr = rec.revenue.arr_usd ?? 0;
  if (arr <= 0 || !CONFIDENCE_WORDS[rec.revenue.confidence]) return null;
  // A record the research has marked as disputed is awaiting an owner
  // decision; whichever figure the post picked would be the wrong one.
  if (/\bDISPUTED\b/.test(rec.revenue.basis)) return null;
  const age = daysOld(rec.revenue.as_of, now);
  if (age > RESEARCH_FRESH_DAYS) return null;

  const basis = cleanNotes(rec.revenue.basis, 480);
  const growth = cleanNotes(rec.growth.evidence, 320);
  const buyback = cleanNotes(rec.buybacks.evidence, 240);
  const facts: string[] = [
    `What ${rec.name} (SN${rec.netuid}) sells: ${firstSentences(rec.product.what_it_is, 360)}`,
    `Revenue: about ${compact(arr)[0]} a year, roughly ${compact(arr / 12)[0]} a month, as of ${rec.revenue.as_of}. This is ${CONFIDENCE_WORDS[rec.revenue.confidence]}. How it was measured: ${basis}`,
    `Growth trend: ${rec.growth.trend}. ${growth}`,
  ];
  if (rec.growth.prior_arr_usd && rec.growth.prior_as_of) {
    facts.push(`Earlier checkpoint: ${compact(rec.growth.prior_arr_usd)[0]} a year as of ${rec.growth.prior_as_of}.`);
  }
  if (rec.buybacks.status === "active" || rec.buybacks.status === "announced") {
    facts.push(`Buybacks of its alpha token: ${rec.buybacks.status}. ${firstSentences(rec.buybacks.mechanism, 200)} ${buyback}`.trim());
  }
  if (rec.customers.named.length || rec.customers.count) {
    facts.push(`Customers: ${rec.customers.named.length ? "named ones include " + rec.customers.named.slice(0, 4).join(", ") + ". " : ""}${rec.customers.count ? `Count: ${rec.customers.count.toLocaleString("en-US")} (${rec.customers.type}).` : ""}`.trim());
  }
  if (rec.revenue.customer_quality === "circular") {
    facts.push(`Caveat: much of this revenue is paid by participants inside the subnet's own economy rather than outside customers. ${firstSentences(rec.revenue.customer_quality_note ?? "", 160)}`.trim());
  }
  const numbers = new Set<string>();
  moneyForms(arr).forEach(x => numbers.add(x));
  moneyForms(arr / 12).forEach(x => numbers.add(x));
  moneyForms(rec.growth.prior_arr_usd).forEach(x => numbers.add(x));
  moneyForms(rec.buybacks.usd_to_date).forEach(x => numbers.add(x));
  if (rec.buybacks.pct_of_revenue) numbers.add(`${rec.buybacks.pct_of_revenue}%`);
  if (rec.customers.count) numbers.add(String(rec.customers.count)).add(rec.customers.count.toLocaleString("en-US"));
  for (const f of facts) numericTokens(f).forEach(x => numbers.add(x));

  const sizeBonus = Math.min(20, Math.max(0, Math.log10(arr / 50_000) * 8));
  const trendBonus = rec.growth.trend === "accelerating" ? 10 : rec.growth.trend === "growing" ? 6 : rec.growth.trend === "declining" ? 4 : 0;
  const confBonus = rec.revenue.confidence === "confirmed" ? 8 : rec.revenue.confidence === "self_reported" ? 4 : 0;
  const buybackBonus = rec.buybacks.status === "active" ? 4 : 0;
  return {
    fingerprint: `rs:${rec.netuid}:${rec.revenue.as_of}:${Math.round(arr)}`,
    kind: "research",
    netuid: rec.netuid,
    name: rec.name,
    priority: 50 + sizeBonus + trendBonus + confBonus + buybackBonus + Math.max(0, (RESEARCH_FRESH_DAYS - age) / 3),
    at: rec.revenue.as_of ?? new Date(now).toISOString(),
    facts,
    numbers: Array.from(numbers),
    link: BENCHMARKS_LINK,
  };
}

function profileStory(rec: ResearchRecord, now: number): Story | null {
  if (rec.status !== "live" || !rec.product.live_product) return null;
  if ((rec.product.quality_score ?? 0) < PROFILE_MIN_QUALITY) return null;
  if ((rec.product.what_it_is || "").length < 120) return null;
  const month = new Date(now).toISOString().slice(0, 7);
  const facts: string[] = [
    `What ${rec.name} (SN${rec.netuid}) sells: ${firstSentences(rec.product.what_it_is, 420)}`,
    `Why the product rates well: ${cleanNotes(rec.product.quality_rationale, 320)}`,
  ];
  const arr = rec.revenue.arr_usd ?? 0;
  if (arr > 0 && CONFIDENCE_WORDS[rec.revenue.confidence]) {
    facts.push(`Revenue: about ${compact(arr)[0]} a year (${CONFIDENCE_WORDS[rec.revenue.confidence]}, as of ${rec.revenue.as_of}). Growth trend: ${rec.growth.trend}.`);
  } else {
    facts.push(`Revenue: none published yet (${rec.revenue.confidence.replace("_", " ")}). Say so plainly if you mention money at all.`);
  }
  if (rec.customers.named.length) facts.push(`Named customers or users: ${rec.customers.named.slice(0, 5).join(", ")}.`);
  if (rec.buybacks.status === "active") facts.push(`Buybacks of its alpha token: active. ${firstSentences(rec.buybacks.mechanism, 180)}`);
  const numbers = new Set<string>();
  moneyForms(arr).forEach(x => numbers.add(x));
  for (const f of facts) numericTokens(f).forEach(x => numbers.add(x));
  return {
    fingerprint: `pf:${rec.netuid}:${month}`,
    kind: "profile",
    netuid: rec.netuid,
    name: rec.name,
    priority: 20 + rec.product.quality_score / 5 + (arr > 0 ? 6 : 0),
    at: new Date(now).toISOString(),
    facts,
    numbers: Array.from(numbers),
    link: BENCHMARKS_LINK,
  };
}

// ── Selection ───────────────────────────────────────────────────────────────

export interface BuildInput {
  research: ResearchRecord[];
  mentions: RevenueMention[];
  posted: PostedEntry[];
  now?: number;
}

/**
 * All postable stories, best first. Applies: already-posted fingerprints,
 * the per-subnet cooldown, the longer profile cooldown, and "no two profiles
 * in a row" so the account does not drift into evergreen filler.
 */
export function buildStories({ research, mentions, posted, now = Date.now() }: BuildInput): Story[] {
  const byNetuid = new Map(research.map(r => [r.netuid, r]));
  const postedFp = new Set(posted.map(p => p.fingerprint));
  const lastBySubnet = new Map<number, number>();
  for (const p of posted) {
    const t = new Date(p.postedAt).getTime();
    if (Number.isFinite(t)) lastBySubnet.set(p.netuid, Math.max(lastBySubnet.get(p.netuid) ?? 0, t));
  }
  const lastPost = posted.length ? posted[posted.length - 1] : null;

  const stories: Story[] = [];
  for (const m of mentions) {
    const s = firstPartyStory(m, byNetuid.get(m.netuid), now);
    if (s) stories.push(s);
  }
  for (const r of research) {
    const s = researchStory(r, now);
    if (s) stories.push(s);
    const p = profileStory(r, now);
    if (p) stories.push(p);
  }

  return stories
    .filter(s => !postedFp.has(s.fingerprint))
    .filter(s => {
      const last = lastBySubnet.get(s.netuid) ?? 0;
      const cooldown = (s.kind === "profile" ? PROFILE_COOLDOWN_DAYS : SUBNET_COOLDOWN_DAYS) * DAY;
      return now - last > cooldown;
    })
    .filter(s => !(s.kind === "profile" && lastPost?.kind === "profile"))
    .sort((a, b) => b.priority - a.priority || b.at.localeCompare(a.at));
}

// ── Writing ─────────────────────────────────────────────────────────────────

/** 280 minus a 23-character URL minus the blank line before it. */
export const MAX_BODY = 255;
export const TARGET_BODY = 230;
const WRITE_ATTEMPTS = 3;
const BANNED = /\b(massive|huge|game[- ]?changer|exciting|excited|revolutionary|bullish|bearish|moon|insane|crazy|unbelievable|incredible|explosive|skyrocket|we flagged|alpha call|not financial advice|nfa|dyor)\b/i;

const SYSTEM = `You write posts for @AlphaGapTAO, an X account that reports what Bittensor subnets actually sell and earn. Readers are investors who want the substance without the marketing.

Write ONE post in plain English, between 150 and ${TARGET_BODY} characters (hard limit ${MAX_BODY}, count carefully, shorter is fine). Sound like a sharp analyst telling a friend what just happened, not a press release and not a changelog.

Shapes that work:
- "Vanta (SN8) just passed $1M paid out to traders: $1,056,991 to 140 traders since April, every payout on a public ledger. It sells prop-firm style trading evaluations, and buybacks of SN8 ran about $225K in October."
- "Targon (SN4) is showing $1.18M of platform revenue for the last 30 days on its own dashboard, from renting confidential GPU compute. About 80% of that is one fixed contract line that started in August; metered usage is around $233K a month."

Rules:
1. Open with the subnet name and the news or the number. Name the subnet as "Name (SNxx)" exactly once.
2. Say what the subnet sells in words a non-crypto reader understands, taken from the facts, not guessed from the name.
2b. TAO emissions, rewards or payouts funded by emissions, reserves, and capital allocated to users are NOT revenue. Never call them revenue, earnings or income. Revenue is only money paid by customers.
3. Every figure you use must appear EXACTLY as written in ALLOWED NUMBERS. Do not calculate, round, convert, annualise or combine numbers yourself. If a number you want is not in the list, leave it out.
4. Say where a figure comes from when it is the subnet's own ("on its own dashboard", "per its post", "self-reported") and say "by AlphaGap's estimate" when the facts say it is our estimate.
5. If the facts carry a caveat (declining, unverified, most of it from one line, paid by insiders), include it in one short clause. Honest beats hype.
6. No hype words, no exclamation marks, no emojis, no hashtags, no questions, no advice, no "we flagged", no price talk.
7. Never use the long dash character. Use a comma, a full stop or a plain hyphen.
8. The facts come from analyst notes; never mention the notes, the research process, or AlphaGap's workflow. Describe the subnet.
9. Output the post text only, no quotes, no preamble.`;

export interface WriteResult {
  text: string | null;
  reason?: string;
  attempts: number;
}

/**
 * Ask the model for a post, validate it against the story, retry once with
 * the violations spelled out. Returns null when no acceptable draft came back.
 */
export async function writeDraft(story: Story, apiKey: string, model = "claude-sonnet-5"): Promise<WriteResult> {
  const user = [
    `SUBNET: ${story.name} (SN${story.netuid})`,
    `STORY TYPE: ${story.kind === "first_party" ? "the subnet's own fresh post" : story.kind === "research" ? "a revenue figure from AlphaGap's research" : "what the product is (no fresh number)"}`,
    "",
    "FACTS:",
    ...story.facts.map(f => `- ${f}`),
    "",
    `ALLOWED NUMBERS: ${story.numbers.join(" | ") || "(none: write the post without any figures)"}`,
  ].join("\n");

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [{ role: "user", content: user }];
  let lastReason = "";
  for (let attempt = 1; attempt <= WRITE_ATTEMPTS; attempt++) {
    let raw: string;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 400, system: SYSTEM, messages }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { text: null, reason: `model ${res.status}: ${body.slice(0, 200)}`, attempts: attempt };
      }
      const json = await res.json() as { content?: Array<{ type: string; text?: string }> };
      raw = (json.content ?? []).filter(c => c.type === "text").map(c => c.text ?? "").join("").trim();
    } catch (e) {
      return { text: null, reason: `model error: ${String(e).slice(0, 80)}`, attempts: attempt };
    }

    const text = sanitise(raw);
    const problems = validate(text, story);
    if (!problems.length) return { text, attempts: attempt };
    lastReason = problems.join("; ");
    messages.push({ role: "assistant", content: raw });
    const fix = text.length > MAX_BODY
      ? `Your draft is ${text.length} characters. Cut it to under ${TARGET_BODY} by dropping a whole clause or the least important figure, not by abbreviating.`
      : `Rewrite it.`;
    messages.push({ role: "user", content: `${fix} Problems: ${lastReason}. Keep every rule. Output the post text only.` });
  }
  return { text: null, reason: lastReason, attempts: WRITE_ATTEMPTS };
}

export function sanitise(raw: string): string {
  return raw
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/[—–―]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function validate(text: string, story: Story): string[] {
  const problems: string[] = [];
  if (text.length > MAX_BODY) problems.push(`too long (${text.length} chars, limit ${MAX_BODY})`);
  if (text.length < 100) problems.push("too short");
  if (!/[.)"']$/.test(text)) problems.push("ends mid-sentence; finish with a full stop");
  if (!new RegExp(`\\(SN${story.netuid}\\)`).test(text)) problems.push(`must name the subnet as "${story.name} (SN${story.netuid})" once`);
  if ((text.match(/\(SN\d+\)/g) ?? []).length > 1) problems.push("name the subnet once only");
  if (/#\w+/.test(text)) problems.push("no hashtags");
  if (/!/.test(text)) problems.push("no exclamation marks");
  if (/\?/.test(text)) problems.push("no questions");
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) problems.push("no emojis");
  const banned = text.match(BANNED);
  if (banned) problems.push(`banned word "${banned[0]}"`);
  const bad = checkNumbers(text, story.numbers);
  if (bad.length) problems.push(`figures not in ALLOWED NUMBERS: ${bad.join(", ")}`);
  if (/\b(research notes?|analyst|our record|the facts|this record|AlphaGap's workflow)\b/i.test(text)) problems.push("do not refer to the notes or the research process");
  return problems;
}

/** Body plus the source line. X counts any URL as 23 characters. */
export function composePost(body: string, link: string): string {
  return `${body}\n\n${link}`;
}
