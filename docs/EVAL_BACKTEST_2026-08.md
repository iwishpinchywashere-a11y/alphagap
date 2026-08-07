# eVal backtest — 2026-08-06

**Verdict: the question cannot be answered with the data we retain. What weak
evidence exists leans against eVal, and none of it is significant.**

## Data

`subnet-scores-history.json` holds **720 hourly snapshots covering 2026-07-08 →
2026-08-07** — 30 days, ~120 subnets each, with `agap`, `flow`, `dev`, `eval`,
`social`, `price`, `mcap`, `emission_pct`.

Thirty days is the binding constraint. A 7-day forward test gives **4
non-overlapping cohorts** over the whole span and **3** post-gate. No t-statistic
computed on that is worth reading.

## The gate is visible in our own data

Independent of any announcement, the emission distribution breaks sharply
between **2026-07-27 and 2026-07-28**:

| date | top-8 share | bottom-94 share | rank at 80% |
|---|---|---|---|
| 2026-07-26 | 52.1% | 20.7% | 28 |
| 2026-07-27 | 52.3% | 20.0% | 27 |
| **2026-07-28** | **70.5%** | **3.4%** | **12** |
| 2026-08-06 | 61.6% | 5.0% | 15 |

That is v440 switching on, dated from our own history. It also means the sample
is split into two regimes with only ten days on the far side.

## Results — Q5 minus Q1, forward 7-day return

| segment | ranked by | spread | t | cohorts |
|---|---|---|---|---|
| pre-gate | **eval** | −0.87% | −0.58 | 16 |
| pre-gate | mcap | +8.59% | +3.31 | 16 |
| pre-gate | agap | +1.29% | +1.10 | 16 |
| post-gate | **eval** | −15.36% | −7.38 | 3 |
| post-gate | mcap | −13.19% | −3.92 | 3 |
| post-gate | agap | +0.25% | +0.09 | 3 |
| full | **eval** | −3.16% | −1.76 | 19 |
| full | mcap | +5.15% | +1.78 | 19 |
| full | agap | +1.12% | +1.04 | 19 |

Cohorts overlap (daily starts, 7-day horizon), so these t-values are inflated by
autocorrelation. Removing the overlap:

| segment | spread | t | independent cohorts |
|---|---|---|---|
| pre-gate | −1.02% | −0.20 | 3 |
| full | −5.84% | −1.02 | 4 |

**Nothing survives. No cut is significant.**

## The post-gate result is a size effect, not eVal

The eye-catching −15.36% must not be reported as an eVal finding. Ranking by
market cap over the same window gives −13.19%. The two spreads track each other
because post-gate eVal has become close to a size proxy — emission share is now
a ~5th-power function of demand share, so the largest subnets score highest on
the "undervalued" metric by construction. Small caps rallied over those ten
days; that is what both columns are measuring.

## What can honestly be said

1. **eVal shows no positive predictive power in any cut.** The best result
   anywhere is pre-gate at a 3-day horizon (+1.59%, t=+1.85), and it does not
   survive at 7 days.
2. **Direction leans negative** in 4 of 6 cuts — consistent with, though far
   weaker than, the stocks finding, where the analogous "cheap relative to
   fundamentals" leg returned −7.03%/quarter at t=−2.28.
3. **The post-gate collapse in eVal's meaning is real and demonstrable** even
   though its return impact is not: median evalRatio is 4.68 above the bar
   against 0.32 below, so a metric documented as "> 1 = undervalued" now points
   at the largest subnets.

## Recommendation

- **Do not rewrite eVal and ship it as validated.** We cannot validate it either
  way, and shipping a "fixed" score implies evidence we do not have.
- **Do fix the descriptive defect.** eVal claims to find undervaluation and
  post-gate ranks by size. That is wrong regardless of returns, and the fix
  (compare emission against gate-adjusted expected emission, not raw) does not
  depend on the backtest.
- **Raise history retention — this is the highest-value action here.** We keep
  720 hourly rows spanning 30 days. Downsampling anything older than a week to
  daily would cover two years in ~730 rows per subnet, the same storage, and
  would make a real backtest possible instead of this one. Every future question
  of this kind is blocked until that changes.
