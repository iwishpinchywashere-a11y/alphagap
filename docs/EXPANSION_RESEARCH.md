# Can we "AlphaGap" other assets? — Research Report (2026-07-28)

Deep research on extending the aGap methodology (building activity vs market
recognition) from Bittensor subnets to (a) general cryptocurrencies and
(b) public stocks. All pricing/ToS claims were fetched from primary sources
on 2026-07-27/28; items that couldn't be verified first-hand are marked.

## TL;DR

- **The thesis is BETTER SUPPORTED IN STOCKS than in crypto.** Top-journal
  finance literature says crypto returns are driven by momentum + attention;
  dev activity mostly fails as a return predictor (one direct null result;
  Santiment's own backtest lost to holding BTC). In equities, the exact
  "building > price" idea is an established, documented anomaly:
  patent/R&D efficiency (JFE 2013), insider buying (RFS 2001), hiring
  velocity (Deutsche Bank / academic work).
- **Crypto expansion is cheap and open lane** (~$129/mo MVP; nobody sells a
  packaged cross-token "dev gap" score) — but the score should be honest:
  dev activity as a viability/rug filter combined with momentum/attention,
  not as the alpha engine.
- **Stocks expansion has a shockingly strong $0 data core** (SEC EDGAR,
  USPTO patents, GitHub, Greenhouse/Lever job boards) and a clean legal
  path for publishing scores (Lowe v. SEC publisher's exclusion) — the only
  real cost/complexity is market-data display licensing.

## 1. Crypto expansion (top 200–500 tokens)

### Recommended MVP stack (~$129/mo)

| Layer | Pick | Cost |
|---|---|---|
| Dev activity | Electric Capital **Open Dev Data** (CC BY 4.0 — commercial + derivatives OK with attribution) mapping tokens→GitHub orgs, + own GitHub GraphQL pipeline (5k req/hr PAT; nightly cron covers 500 tokens easily) | $0 |
| Prices/mcap/volume | **CoinGecko Analyst** ($129/mo, 500K credits, commercial) or CMC Startup ($79) | $79–129 |
| Social | twitterapi.io (already paid) — cashtag counts + z-scores; upgrade later to LunarCrush Builder (~$240/mo, price UNVERIFIED first-party) | $0 |
| DeFi fundamentals | DefiLlama free API (TVL) | $0 |

### Full v2 (~$380–470/mo)
Add **Santiment Sanbase Max $249/mo** — one API for exchange netflows, whale
transfers, holder concentration, social volume AND a dev-activity
cross-check (80K calls/mo covers 500 tokens daily). NOTE: the $49 tier lags
restricted metrics by 30 days — useless for a live score; Max is the floor.
Smart-money upgrade: Nansen Pro $49/mo + credits (design for weekly/top-100
sweeps — daily 500-token Smart Money pulls burn ~$750/mo in credits).

### Skip (enterprise/sales-gated)
Glassnode API (~$999/mo), Amberdata, Arkham (unpublished), The Tie,
CryptoQuant (BTC/ETH-centric).

### Red flags
1. **CoinGecko ToS bans "deriving from" the Data / redistribution without an
   Executed Agreement** — display your score, not their raw data; keep
   attribution; or use CMC/DefiLlama for the price leg. Email CoinGecko for
   written blessing.
2. Electric Capital attribution mandatory (CC BY 4.0). Pin taxonomy
   snapshots per scoring run (v1.2 changed multichain attribution).
3. Dev-signal integrity: forks/mirrors inflate commits; bots; private repos
   under-count; dev activity is countercyclical (tags whole bear markets).
   Count GitHub *events*, filter bots, and never sell dev-alone as alpha.

### Evidence check (crypto)
- MSR/IEEE 2019 ("Striking Gold in Software Repositories"): dev activity vs
  market cap — insignificant. Popularity (stars) correlates; commits don't.
- Liu & Tsyvinski (RFS 2021), Liu/Tsyvinski/Wu (JoF 2022): crypto cross-
  section priced by market/size/momentum + attention. No dev factor.
- Santiment's own dev-activity portfolio backtest underperformed BTC.
- Defensible uses: **declining dev = red flag** (negative screen); dev
  networks predict co-movement (Science Advances 2021).
- Competition: nobody packages a cross-token "dev gap" score (FCAS is dead;
  Santiment sells raw metrics at $49/mo; Token Terminal ~$99/mo;
  Nansen $49–69/mo). Open lane — but possibly open because the naive signal
  doesn't work.

## 2. Stocks expansion

### "Building velocity" data — the $0 core is excellent
- **SEC EDGAR (free, 10 req/s, same-day latency verified):** Form 4 insider
  buys (STRONG evidence: Lakonishok & Lee RFS 2001 — purchases predict
  ~4.8%/12mo, ~7.4% small caps; Cohen/Malloy/Pomorski: opportunistic buys
  ~82bps/mo), 13F flows (MODERATE: cloning works despite 45-day lag), 8-K
  product-announcement cadence, full-text search.
- **USPTO PatentsView (free, 45 req/min):** patents/citations scaled by R&D =
  "Innovative Efficiency" (Hirshleifer/Hsu/Li JFE 2013) — the literal
  academic version of the aGap: investors underreact to hard-to-process
  building output. STRONG, slow-decay.
- **Greenhouse + Lever public job-board JSON (free, no auth):** hiring
  velocity for most tech companies. Evidence MODERATE-STRONG (LinkUp/DB
  research). Paid upgrade: TheirStack $100/mo or Coresignal $199/mo for
  non-ATS coverage.
- **GitHub (free):** dev velocity for developer-tool companies.
- Earnings-call NLP: API Ninjas $39/mo (commercial OK) or EarningsCall.biz
  $60–155/mo — evidence MODERATE but fast decay (crowded).
- Skip at this budget: Sensor Tower/data.ai (~$74k/yr median), Similarweb
  full API, Ahrefs ($14,990/yr), Semrush, Revelio, LinkUp (quote-only).

### Market data + THE licensing minefield (the real cost)
- Self-serve tiers of Polygon(→**Massive**)/Alpaca/Finnhub/Alpha Vantage/
  EODHD are **personal-use only — none permit displaying data to your
  subscribers**. Finnhub even bans sharing "derived results."
- **Derived scores change the analysis**: Nasdaq/CTA don't charge display
  fees on true derived data ("cannot be reverse engineered… not a
  reasonable substitute"). Cheapest vendor whose license EXPLICITLY permits
  non-reversible derived output: **Twelve Data Grow $79/mo**.
- Showing actual prices: EOD/15-min-delayed carries no per-user exchange
  fees, but needs a vendor display license: **Intrinio Startup $333/mo**
  ("Display & Commercial Use", no exchange paperwork) is the cleanest;
  FMP Data Display Agreement or Massive Business contract as alternates.
  Real-time SIP display ≈ $2–3/user/mo exchange fees + ~$1k/mo/network
  redistribution fees — skip until scale.
- **Never ship yfinance in a paid product** (no license exists at all).

### Regulatory (clean)
Publishing impersonal 0–100 scores to all subscribers on a regular schedule
sits inside the Investment Advisers Act **publisher's exclusion**
(Lowe v. SEC, 472 U.S. 181 (1985)) — the Motley Fool/Zacks/Danelfin model.
Keep it: (1) impersonal (never 1-on-1 "what should I buy"), (2) disinterested
(disclose positions; no paid touting — §17(b)), (3) regular cadence (not
event-timed alerts). Standard disclaimer set: not an RIA/broker, not
personalized advice, past performance ≠ future results, DYOR, risk of loss,
liability limits. FINRA: N/A for pure publishers. Never fabricate/cherry-pick
performance claims (that's what actually gets newsletters sued).

### Sentiment (stocks)
twitterapi.io (already paid; $0.15/1k tweets) is the verified cheap path.
Reddit official API requires a commercial agreement (~$0.24/1k calls);
StockTwits dev program closed to new registrations (partnership only);
ApeWisdom free but commercially undefined.

## 3. Verdict & recommended path

1. **Crypto first** (fastest, cheapest, reuses ~80% of the AlphaGap engine:
   scan cron, blob storage, scoring, UI, X bot):
   - Phase 1 (~$129/mo): top-200 tokens; score = momentum + attention +
     dev-viability filter (honest weighting per the evidence), shipped as a
     new section/product on alphagap.io.
   - Phase 2 (+$249): Santiment for netflows/whales ("Flow" page analog).
   - Position dev data as *quality/rug screen*, momentum/attention as the
     timing engine — that's what the literature supports.
2. **Stocks second** (stronger thesis, defensible moat, more build):
   - MVP (~$120/mo): EDGAR insider+13F + PatentsView + hiring velocity +
     GitHub, scores-only display via Twelve Data Grow ($79) + API Ninjas
     transcripts ($39). No price display initially → no licensing pain.
   - Scale: Intrinio Startup ($333/mo) when you want price charts.
   - Danelfin at $840/yr proves retail pays premium for exactly this shape.
3. **Both share one honest rule:** publish the methodology, show wins AND
   losses (the /performance track-record idea), never personalize.

## Source index
Crypto APIs: coingecko.com/en/api/pricing · coingecko.com/en/api_terms ·
coinmarketcap.com/api/pricing · app.santiment.net/pricing ·
about.artemis.ai/pricing · github.com/electric-capital/open-dev-data ·
docs.nansen.ai/getting-started/credits · dune.com/pricing · docs.llama.fi
Stocks data: sec.gov (EDGAR access docs) · patentsview.org ·
developers.greenhouse.io/job-board.html · github.com/lever/postings-api ·
coresignal.com/pricing · theirstack.com/en/pricing · api-ninjas.com/pricing ·
earningscall.biz/api-pricing
Licensing: massive.com/pricing + legal ToS · alpaca.markets/support/
redistribute-alpaca-api · finnhub.io/terms-of-service ·
alphavantage.co/terms_of_service · twelvedata.com/terms ·
eodhd.com/financial-apis/terms-conditions · intrinio.com/pricing ·
CTA Schedule of Market Data Charges (nyse.com/publicdocs/ctaplan) ·
utpplan.com/DOC/datapolicies.pdf
Evidence: ieeexplore.ieee.org/document/8816811 · academic.oup.com/rfs (Liu &
Tsyvinski) · onlinelibrary.wiley.com/doi/10.1111/jofi.13119 ·
science.org/doi/10.1126/sciadv.abd2204 · Hirshleifer/Hsu/Li JFE 2013 ·
lsvasset.com (Lakonishok & Lee) · quantpedia.com 13F cloning ·
supreme.justia.com/cases/federal/us/472/181 (Lowe v. SEC) ·
katten.com (Seeking Alpha dismissal)
