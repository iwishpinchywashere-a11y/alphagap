# Weekly valuation research runbook

Re-researches every subnet's revenue, buybacks, growth, customers and product
quality, and ships the result to `src/data/valuation.json`.

**Why it runs weekly, on Saturday:** the index rebalance cron fires Sundays at
12:00 UTC and sizes positions from `invest_agap`, which is built on these
numbers. Research has to land first, with a day of slack to review anything
odd before real money is reweighted.

**Working directory:** `/Users/pinchy/Documents/Claude Code/alphagap`

---

## 1. Set up the scratch directory

```bash
S="$SCRATCH/research"   # any fresh dir outside the repo
mkdir -p "$S"
cp src/data/valuation.json "$S/out_batch_00.json"
```

**The seed is mandatory.** `merge-valuation-research.mjs --write` REPLACES
`valuation.json` with exactly the records it finds in the batch files. Without
`out_batch_00.json` every subnet no agent covered is deleted. Batches merge in
filename order and later files win by netuid, so the seed is the floor and
research overrides it.

## 2. Pick the batches

Everything gets researched, but spend the effort where it moves:

- **Wave 1, highest effort:** every subnet with `revenue.confidence` in
  `confirmed | self_reported | estimated`, plus any subnet appearing in the
  `revenue-mentions.json` blob in the last 45 days (the revenue-watch cron
  writes it). Roughly 40 subnets, about 8 per agent.
- **Wave 2, confirmation effort:** everything else, about 12 per agent. These
  are mostly pre-revenue; the job is to confirm that is still true and to catch
  slots that changed hands.

Write wave 1 to `out_batch_01..09.json` and wave 2 to `out_batch_11..19.json`.

## 3. Run the agents

One `general-purpose` agent per batch, in parallel, in the background. Give each
the prompt in **Appendix A**, substituting its subnet list and output path, and
adding any lead you already have (a known announcement, a first-party dashboard
or ledger URL worth re-deriving from).

## 4. Validate before merging. Do not skip this.

The merge script's `pick()` silently degrades any value outside its enum to a
default. A growth trend written as `"decelerating"` becomes `"unknown"` and
throws away a five-point penalty with no warning. Seven violations occurred
across twelve batches on 2026-10-27.

Check every researched record against:

| Field | Allowed |
|---|---|
| `status` | live, dead, unknown |
| `revenue.confidence` | confirmed, self_reported, estimated, pre_revenue, unknown |
| `revenue.customer_quality` | external, ecosystem, circular |
| `buybacks.status` | active, announced, planned, none, unknown |
| `growth.trend` | accelerating, growing, flat, declining, unknown |
| `customers.type` | enterprise, developer, consumer, mixed, none |

Also reject: any `arr_usd > 0` without a source URL or without a
`customer_quality`; any active/announced buyback without a source URL; any em
dash anywhere.

Fix violations by mapping to the nearest allowed value while preserving the
researcher's intent, and record what you changed. Common ones: "decelerating"
and "down" mean `declining`; "up" means `growing`; "mixed" is not a customer
quality; "ecosystem" and "retail" are not customer types.

## 5. Merge and verify

```bash
node scripts/merge-valuation-research.mjs "$S" --write
```

Then confirm nothing was lost:

- 128 records written.
- Every revenue subnet still carries `customer_quality`. The script preserves
  it now, but it silently dropped the field before 2026-10-28 because it
  rebuilds the revenue object key by key. If a new field is ever added to the
  schema, add it there too.
- Diff against the pre-merge copy and summarise: revenue changes, buyback status
  changes, tenant/status changes, the largest quality moves.

## 6. Ship

`npx tsc --noEmit -p .`, then commit, push, and `npx vercel --prod --yes`.
Scores only move once a scan runs against the new deploy, within about ten
minutes. Confirm by reading `scan-latest.json` from blob storage.

## 7. Report

Lead with revenue that moved and why, then buyback status changes, then slots
that changed hands, then the index top 10 before and after. Call out anything an
agent could not verify, and anything that looks like a measurement fault rather
than a real change.

---

## Appendix A: agent prompt

> You are updating AlphaGap's subnet valuation research. Today is {DATE}. The
> existing data was researched on {PREVIOUS_DATE}, so you are primarily looking
> for what has CHANGED since then, and verifying what is already recorded.
>
> Working directory: /Users/pinchy/Documents/Claude Code/alphagap
>
> YOUR SUBNETS: {LIST}
> {ANY KNOWN LEADS}
>
> STEP 1 - read the current records:
> `python3 -c "import json;d=json.load(open('src/data/valuation.json'));ids={IDS};print(json.dumps([r for r in d if r['netuid'] in ids],indent=1))"`
>
> STEP 2 - research each one. Source priority: first-party (the project's own
> site, pricing page, public dashboard, stats/API endpoint, on-chain buyback
> ledger, GitHub, their X account), then reputable secondary (SubConnect
> Bittensor Revenue Index, taooutsider.com, subnetalpha.ai, cryptobriefing.com).
> If x.com returns 403, read the timeline through the user's logged-in Chrome;
> there is no twitterapi.io key. Check whether the TaoStats API has credits
> before relying on it.
>
> STEP 3 - produce one JSON record per subnet with exactly these fields:
> netuid, name, status, product{what_it_is, category, live_product, pricing_url,
> quality_score, quality_rationale}, revenue{arr_usd, confidence, basis, as_of,
> evidence, sources, customer_quality, customer_quality_note},
> growth{trend, evidence, prior_arr_usd, prior_as_of},
> customers{named, count, type, evidence},
> buybacks{status, mechanism, pct_of_revenue, usd_to_date, evidence, sources},
> notes.
>
> RULES, which matter more than completeness:
> - NEVER invent a number. If you cannot verify a figure, KEEP the existing one
>   and say so in notes.
> - `arr_usd` is ANNUALISED and `basis` shows the arithmetic. Do not annualise a
>   single day, and say so if that is all you have.
> - confidence: confirmed = first-party dashboard/ledger/API or named press with
>   figures; self_reported = a team statement or an index relaying team numbers;
>   estimated = you derived it from public inputs; pre_revenue = you checked and
>   there is none; unknown = could not determine.
> - customer_quality: external = arm's-length buyers outside Bittensor;
>   ecosystem = arm's-length but the buyers are Bittensor projects; circular =
>   team, insiders or miners paying fees, or ecosystem sponsors whose payments
>   buy back ecosystem alpha. Set only when there is revenue, always with a note.
> - quality_score rates the PRODUCT ONLY: live, usable, documented,
>   differentiated, real users. Do not let revenue size, a large repo or a large
>   market cap inflate it.
> - buybacks "active" needs evidence of executed buys with a source URL.
> - Any `arr_usd > 0` and any active/announced buyback needs a source URL or the
>   record is rejected downstream.
> - `as_of` is the date of the DATA, not today.
> - If a slot changed hands, say so and research the CURRENT tenant.
> - Never use an em dash. Use a plain hyphen.
>
> STEP 4 - write the JSON array to {PATH} and confirm it parses.
>
> FINAL REPORT: one line per subnet on what changed versus the existing record,
> plus a clear list of what you could not verify.

## Appendix B: traps

- **Slot turnover is common.** 17 of 128 changed tenant or status in the 19 days
  to 2026-10-28. Always confirm who occupies a slot before trusting its name.
- **Squatted identities.** An abandoned subnet's on-chain identity can be renamed
  to anything, including "Bittensor". `api/scan` has an `UNUSABLE_CHAIN_NAMES`
  guard; add to it rather than letting a squatted name reach the leaderboard.
- **Emissions are not revenue.** Several subnets report emission income, validator
  yield or miner fees as revenue. Miner fees are `circular`. Emission income is
  not revenue at all.
- **Named logos are often investors or partners, not customers.**
- **Search summarisers attach the wrong company's revenue to a subnet** with a
  similar name. Verify the entity before recording a figure.
