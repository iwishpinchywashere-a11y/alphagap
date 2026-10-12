// TaoStats v1 (2026). The old /api/{resource}/v1 paths switch off on
// 2026-11-09. Same key, same host; paths are /v1/{plural}, sorting is
// order_by + order_dir, limit is capped at 200, addresses are plain SS58
// strings and single-item endpoints answer { data: {...} } with no array.
// taoFetch absorbs the sort/limit/envelope differences so call sites keep
// the shapes the rest of the app was written against.
const BASE_URL = "https://api.taostats.io/v1";
const API_KEY = process.env.TAOSTATS_API_KEY || "";

interface TaoStatsResponse<T> {
  data: T[] | T;
  pagination?: {
    current_page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
}

// revalidate: live market data = 30s, reference data (identities, metagraph) = 120s
/** Logged once per process so an exhausted account does not spam the logs. */
let creditWarningLogged = false;

/**
 * Process-level record of how TaoStats is behaving, published by the scan in
 * scan-latest.json so the health cron can email the owner when credits run
 * out. Both previous outages were discovered from screenshots of flat charts.
 */
export const taostatsStatus = {
  lastSuccessAt: null as string | null,
  lastCreditErrorAt: null as string | null,
  lastErrorAt: null as string | null,
};

/** v1 answers lists as { data: [...] } and single items as { data: {...} }. */
function unwrap<T>(json: TaoStatsResponse<T>): T[] {
  const d = json?.data;
  if (Array.isArray(d)) return d;
  return d && typeof d === "object" ? [d as T] : [];
}

const REQUEST_HEADERS = { Authorization: API_KEY, "User-Agent": "alphagap.io" };

async function taoFetch<T>(path: string, params: Record<string, string> = {}, revalidate = 60): Promise<T[]> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    // Legacy sort spelling ("timestamp_desc") -> v1 order_by / order_dir
    if (k === "order") {
      const m = /^(.*)_(asc|desc)$/.exec(v);
      if (m) { url.searchParams.set("order_by", m[1]); url.searchParams.set("order_dir", m[2]); }
      continue;
    }
    // v1 returns 400 above 200 rows instead of truncating
    if (k === "limit") { url.searchParams.set(k, String(Math.min(200, Number(v) || 200))); continue; }
    url.searchParams.set(k, v);
  }

  // cache: "no-store", always. With `next: { revalidate }` the Next.js data
  // cache could hand back an old response as a 200 long after TaoStats stopped
  // answering, and a 200 was all anyone checked. Callers that want caching do
  // it explicitly in a blob, where the age is visible and checked.
  void revalidate;
  const res = await fetch(url.toString(), {
    headers: REQUEST_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  // Exponential backoff with jitter. A single fixed 2s retry gave up on any
  // sustained rate limit and returned [], which surfaced as blank charts and
  // silently-missing data rather than an error anyone could see. Honour
  // Retry-After when TaoStats sends it.
  if (res.status === 429) {
    // Not all 429s are rate limits. When the account is out of credits
    // TaoStats also answers 429, with "Insufficient credits (remaining: 0)".
    // Backing off three times cannot fix a billing state; it just spends
    // ~15s per call to arrive at the same answer, which is what made subnet
    // pages take a minute to load. Fail fast and let callers fall back.
    const peek = await res.clone().text().catch(() => "");
    if (/insufficient credits/i.test(peek)) {
      taostatsStatus.lastCreditErrorAt = new Date().toISOString();
      if (!creditWarningLogged) {
        creditWarningLogged = true;
        console.error(
          "[taostats] OUT OF CREDITS - every TaoStats call is failing. " +
          "Top up at https://dash.taostats.io/billing. Serving cached data until then."
        );
      }
      return [] as T[];
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
      const header = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(header) && header > 0
        ? Math.min(header * 1000, 8000)
        : Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 400;
      console.warn(`TaoStats 429 on ${path} - attempt ${attempt}/3, waiting ${Math.round(wait)}ms`);
      await new Promise(r => setTimeout(r, wait));
      const retry = await fetch(url.toString(), {
        headers: REQUEST_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      }).catch(() => null);
      if (retry?.ok) {
        const retryJson: TaoStatsResponse<T> = await retry.json();
        return unwrap(retryJson);
      }
      if (retry && retry.status !== 429) {
        console.warn(`TaoStats ${path} failed after retry (${retry.status})`);
        return [] as T[];
      }
    }
    console.error(`TaoStats ${path} still rate limited after 3 retries - returning empty`);
    return [] as T[];
  }

  if (!res.ok) {
    taostatsStatus.lastErrorAt = new Date().toISOString();
    const text = await res.text();
    throw new Error(`TaoStats ${path} failed (${res.status}): ${text}`);
  }

  const json: TaoStatsResponse<T> = await res.json();
  taostatsStatus.lastSuccessAt = new Date().toISOString();
  return unwrap(json);
}

// ── Subnet Identity ──────────────────────────────────────────────
export interface SubnetIdentity {
  netuid: number;
  subnet_name: string;
  github_repo: string | null;
  subnet_contact: string | null;
  subnet_url: string | null;
  logo_url: string | null;
  discord: string | null;
  description: string | null;
  summary: string | null;
  tags: string[] | null;
  twitter: string | null;
}

export async function getSubnetIdentities(): Promise<SubnetIdentity[]> {
  return taoFetch<SubnetIdentity>("/subnets/identities", { limit: "200" }, 1800); // names change rarely
}

// ── TAO Flow ─────────────────────────────────────────────────────
export interface TaoFlow {
  netuid: number;
  tao_flow: number; // EMA value in rao (1e9 = 1 TAO)
}

export async function getTaoFlows(): Promise<TaoFlow[]> {
  // Retired with the /api/ endpoints (no v1 replacement). The scan reads
  // SubnetEmaTaoFlow from the chain instead; callers tolerate an empty list.
  return [];
}

// ── Subnet Pools ─────────────────────────────────────────────────
export interface SubnetPool {
  netuid: number;
  block_number: number;
  timestamp: string;
  name: string;
  symbol: string;
  market_cap: string;
  liquidity: string;
  total_tao: string;
  total_alpha: string;
  alpha_in_pool: string;
  alpha_staked: string;
  price: string;
  rank: number;
  root_prop: string;
  startup_mode: boolean;
  price_change_1_hour: string;
  price_change_1_day: string;
  price_change_1_week: string;
  price_change_1_month: string;
  tao_volume_24_hr: string;
  tao_buy_volume_24_hr: string;
  tao_sell_volume_24_hr: string;
  buys_24_hr: number;
  sells_24_hr: number;
  buyers_24_hr: number;
  sellers_24_hr: number;
}

export interface SubnetPoolDetail extends SubnetPool {
  fear_and_greed_index: string;
  fear_and_greed_sentiment: string;
  market_cap_change_1_day: string;
  alpha_volume_24_hr: string;
  alpha_buy_volume_24_hr: string;
  alpha_sell_volume_24_hr: string;
  highest_price_24_hr: string;
  lowest_price_24_hr: string;
  buys_24_hr: number;
  sells_24_hr: number;
  buyers_24_hr: number;
  sellers_24_hr: number;
  last_price: string;
  enabled_user_liquidity: boolean;
  seven_day_prices: Array<{ block_number: number; timestamp: string; price: string }>;
}

/**
 * One call, every subnet, and the rows carry the same extra fields the
 * per-subnet "pool detail" endpoint returns (fear and greed, 24h high/low,
 * seven-day prices). Verified against the live response on 2026-09-21: 52
 * fields per row. Anything needing those should come from here, once per
 * hour, rather than per subnet per page view.
 */
/**
 * v1 split the old pool row in two: /subnets/pools (reserves, price, caps)
 * and /subnets/pools/aggregate (24h volume, trade counts, % changes,
 * sentiment, seven-day prices). Merge them back into the shape the scan was
 * written against; fear_and_greed_* is kept as an alias of sentiment_*.
 */
type PoolBase = {
  netuid: number; block_number: number; timestamp: string; symbol: string;
  market_cap: string; liquidity: string; total_alpha: string; alpha_in_pool: string; alpha_staked: string;
  tao_in_pool: string; price: string; root_prop: string; startup_mode: boolean; subnet_protocol_alpha: string | null;
};
type PoolAggregate = Pick<SubnetPoolDetail,
  "price_change_1_hour" | "price_change_1_day" | "price_change_1_week" | "price_change_1_month" |
  "tao_volume_24_hr" | "tao_buy_volume_24_hr" | "tao_sell_volume_24_hr" | "buys_24_hr" | "sells_24_hr" |
  "buyers_24_hr" | "sellers_24_hr" | "market_cap_change_1_day" | "alpha_volume_24_hr" | "alpha_buy_volume_24_hr" |
  "alpha_sell_volume_24_hr" | "highest_price_24_hr" | "lowest_price_24_hr" | "last_price" | "seven_day_prices"> &
  { netuid: number; timestamp: string; sentiment_index: string | null; sentiment: string | null };

function mergePools(base: PoolBase[], agg: PoolAggregate[]): SubnetPoolDetail[] {
  const byNetuid = new Map(agg.map(a => [a.netuid, a]));
  const rows = base.map(b => {
    const a = byNetuid.get(b.netuid);
    return {
      ...b,
      total_tao: b.tao_in_pool,
      rank: 0,
      price_change_1_hour: a?.price_change_1_hour ?? "0", price_change_1_day: a?.price_change_1_day ?? "0",
      price_change_1_week: a?.price_change_1_week ?? "0", price_change_1_month: a?.price_change_1_month ?? "0",
      tao_volume_24_hr: a?.tao_volume_24_hr ?? "0", tao_buy_volume_24_hr: a?.tao_buy_volume_24_hr ?? "0",
      tao_sell_volume_24_hr: a?.tao_sell_volume_24_hr ?? "0",
      buys_24_hr: a?.buys_24_hr ?? 0, sells_24_hr: a?.sells_24_hr ?? 0, buyers_24_hr: a?.buyers_24_hr ?? 0, sellers_24_hr: a?.sellers_24_hr ?? 0,
      fear_and_greed_index: a?.sentiment_index ?? "0", fear_and_greed_sentiment: a?.sentiment ?? "",
      sentiment_index: a?.sentiment_index ?? null, sentiment: a?.sentiment ?? null,
      market_cap_change_1_day: a?.market_cap_change_1_day ?? "0",
      alpha_volume_24_hr: a?.alpha_volume_24_hr ?? "0", alpha_buy_volume_24_hr: a?.alpha_buy_volume_24_hr ?? "0",
      alpha_sell_volume_24_hr: a?.alpha_sell_volume_24_hr ?? "0",
      highest_price_24_hr: a?.highest_price_24_hr ?? "0", lowest_price_24_hr: a?.lowest_price_24_hr ?? "0",
      last_price: a?.last_price ?? b.price,
      enabled_user_liquidity: false,
      seven_day_prices: a?.seven_day_prices ?? [],
      // The aggregate row is the one whose timestamp says when the 24h stats were computed
      timestamp: a?.timestamp ?? b.timestamp,
    } as unknown as SubnetPoolDetail;
  });
  rows.sort((x, y) => Number(y.market_cap) - Number(x.market_cap));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

export async function getSubnetPools(): Promise<SubnetPoolDetail[]> {
  const [base, agg] = await Promise.all([
    taoFetch<PoolBase>("/subnets/pools", { limit: "200" }),
    taoFetch<PoolAggregate>("/subnets/pools/aggregate", { limit: "200" }),
  ]);
  return mergePools(base, agg);
}

// ── Subnet Pool Detail (same rows as the bulk call above) ─────────

export async function getSubnetPoolDetail(netuid: number): Promise<SubnetPoolDetail | null> {
  const [base, agg] = await Promise.all([
    taoFetch<PoolBase>("/subnets/pools", { netuid: String(netuid), limit: "1" }, 30),
    taoFetch<PoolAggregate>("/subnets/pools/aggregate", { netuid: String(netuid), limit: "1" }, 30),
  ]);
  const data = mergePools(base, agg);
  return data[0] || null;
}

// ── Subnet Emission ──────────────────────────────────────────────
export interface SubnetEmission {
  netuid: number;
  block_number: number;
  timestamp: string;
  tao_in_pool: string;
  alpha_in_pool: string;
  alpha_rewards: string;
}

interface EpochRow { netuid: number; block_number: number; timestamp: string; tao_in_emission: string; alpha_in_emission: string; alpha_out_emission: string }
/**
 * /subnets/epochs is per block per subnet, newest first. One page of 200 is
 * enough for a row per subnet on most blocks; keep the newest row per netuid.
 * Old field names are kept: alpha_rewards = alpha paid out per block.
 */
export async function getSubnetEmissions(): Promise<SubnetEmission[]> {
  const rows = await taoFetch<EpochRow>("/subnets/epochs", { limit: "200", order: "timestamp_desc" });
  const seen = new Map<number, SubnetEmission>();
  for (const r of rows) {
    if (seen.has(r.netuid)) continue;
    seen.set(r.netuid, { netuid: r.netuid, block_number: r.block_number, timestamp: r.timestamp,
      tao_in_pool: r.tao_in_emission, alpha_in_pool: r.alpha_in_emission, alpha_rewards: r.alpha_out_emission });
  }
  return [...seen.values()];
}

// ── GitHub Activity (from TaoStats) ──────────────────────────────
export interface GithubActivity {
  netuid: number;
  repo_url: string;
  as_of_day: string;
  commits_1d: number;
  prs_opened_1d: number;
  prs_merged_1d: number;
  issues_opened_1d: number;
  issues_closed_1d: number;
  reviews_1d: number;
  comments_1d: number;
  unique_contributors_1d: number;
  commits_7d: number;
  prs_opened_7d: number;
  prs_merged_7d: number;
  unique_contributors_7d: number;
  commits_30d: number;
  prs_merged_30d: number;
  unique_contributors_30d: number;
  last_event_at: string;
  days_since_last_event: number;
}

export async function getGithubActivity(): Promise<GithubActivity[]> {
  // Retired in v1 ("developer activity" has no replacement). Dev scores come
  // from our own GitHub scan; this was only ever the fallback.
  return [];
}

// ── TAO Price ────────────────────────────────────────────────────
export interface TaoPrice {
  price: string;
  volume_24h: string;
  market_cap: string;
  percent_change_24h: string;
}

export async function getTaoPrice(): Promise<number> {
  const data = await taoFetch<TaoPrice>("/price", { asset: "tao" }, 30);
  if (data.length > 0) {
    return parseFloat(data[0].price);
  }
  return 0;
}

// ── Validator Alpha Shares (who holds what) ─────────────────────
export interface ValidatorAlphaShares {
  block_number: number;
  timestamp: string;
  netuid: number;
  hotkey: { ss58: string; hex: string };
  shares: string;
  alpha: string; // in rao
}

export async function getValidatorAlphaShares(netuid?: number): Promise<ValidatorAlphaShares[]> {
  const params: Record<string, string> = { limit: "200" };   // v1 hotkey-shares has no sort; already alpha-desc
  if (netuid !== undefined) params.netuid = String(netuid);
  const rows = await taoFetch<Omit<ValidatorAlphaShares, "hotkey"> & { hotkey: string }>("/alpha/hotkey-shares", params);
  return rows.map(r => ({ ...r, hotkey: { ss58: r.hotkey, hex: "" } }));
}

// ── Metagraph (neuron data per subnet) ──────────────────────────
export interface MetagraphNeuron {
  netuid: number;
  uid: number;
  hotkey: { ss58: string };
  coldkey: { ss58: string };
  stake: string;
  trust: string;           // score miners receive from validators (0 for validators)
  validator_trust: string; // score validators receive based on weight consensus alignment
  consensus: string;
  incentive: string;
  dividends: string;
  emission: string;
  active: boolean;
  validator_permit: boolean;
  updated: number;         // blocks since this neuron last set weights
}

export async function getMetagraph(netuid: number): Promise<MetagraphNeuron[]> {
  // Bittensor subnets can have up to 256 neurons - use limit=500 to capture all in one page
  // v1 caps pages at 200 rows; a 256-UID subnet needs two.
  const rows: Array<Omit<MetagraphNeuron, "hotkey" | "coldkey"> & { hotkey: string; coldkey: string }> = [];
  for (let page = 1; page <= 3; page++) {
    const chunk = await taoFetch<typeof rows[number]>("/subnets/metagraph", { netuid: String(netuid), limit: "200", page: String(page) }, 600);
    rows.push(...chunk);
    if (chunk.length < 200) break;
  }
  return rows.map(r => ({ ...r, hotkey: { ss58: r.hotkey }, coldkey: { ss58: r.coldkey } }));
}

// ── Neuron Registrations ────────────────────────────────────────
export interface NeuronRegistration {
  netuid: number;
  uid: number;
  hotkey: { ss58: string };
  coldkey: { ss58: string };
  block_number: number;
  timestamp: string;
}

export async function getNeuronRegistrations(netuid: number, sinceTimestamp?: string): Promise<NeuronRegistration[]> {
  const params: Record<string, string> = { netuid: String(netuid), limit: "200", order: "timestamp_desc" };
  if (sinceTimestamp) params.timestamp_start = sinceTimestamp;
  return taoFetch<NeuronRegistration>("/subnets/neuron-registration-events", params);
}

// ── Registration Cost (demand for subnet slots) ─────────────────
export interface RegistrationCost {
  netuid: number;
  block_number: number;
  timestamp: string;
  cost: string; // in rao
}

export async function getRegistrationCosts(): Promise<RegistrationCost[]> {
  return taoFetch<RegistrationCost>("/subnets/registration-cost");
}

// ── Burned Alpha (deflationary signal) ──────────────────────────
export interface BurnedAlpha {
  netuid: number;
  block_number: number;
  timestamp: string;
  burned_alpha: string; // in rao
}

export async function getBurnedAlpha(): Promise<BurnedAlpha[]> {
  // v1 /subnets/burns rows carry `amount`; keep the old `burned_alpha` name.
  const rows = await taoFetch<Omit<BurnedAlpha, "burned_alpha"> & { amount: string }>("/subnets/burns", { limit: "200", order: "timestamp_desc" });
  return rows.map(r => ({ ...r, burned_alpha: r.amount }));
}

// ── Subnet Emission History ─────────────────────────────────────
export interface SubnetEmissionHistory {
  netuid: number;
  block_number: number;
  timestamp: string;
  tao_in_pool: string;
  alpha_in_pool: string;
  alpha_rewards: string;
}

export async function getSubnetEmissionHistory(netuid: number, days: number = 7): Promise<SubnetEmissionHistory[]> {
  const since = Math.floor((Date.now() - days * 86400000) / 1000); // unix seconds
  const rows = await taoFetch<EpochRow>("/subnets/epochs", {
    netuid: String(netuid),
    timestamp_start: String(since),
    limit: "200",
    order: "timestamp_asc",
  });
  return rows.map(r => ({ netuid: r.netuid, block_number: r.block_number, timestamp: r.timestamp,
    tao_in_pool: r.tao_in_emission, alpha_in_pool: r.alpha_in_emission, alpha_rewards: r.alpha_out_emission }));
}

// ── Pool History (price history) ────────────────────────────────
export interface PoolHistory {
  netuid: number;
  block_number: number;
  timestamp: string;
  price: string;
  market_cap: string;
  liquidity: string;
  tao_volume_24_hr: string;
}

export async function getPoolHistory(netuid: number, days: number = 365): Promise<PoolHistory[]> {
  const since = Math.floor((Date.now() - days * 86400000) / 1000); // unix seconds
  // TaoStats returns ~1 data point/day so days+20 covers the full range in one page
  const limit = Math.min(days + 20, 500);
  // Daily snapshots: v1 pages at 200, so a year is two pages.
  const out: PoolHistory[] = [];
  for (let page = 1; page <= Math.ceil(limit / 200); page++) {
    const chunk = await taoFetch<PoolHistory>("/subnets/pools/history", {
      netuid: String(netuid),
      timestamp_start: String(since),
      frequency: "by_day",
      limit: "200",
      page: String(page),
      order: "timestamp_asc",
    }, 3600);
    out.push(...chunk);
    if (chunk.length < 200) break;
  }
  return out;
  // (previous single-call form, kept for reference of the old parameters)
  void {
    netuid: String(netuid),
    timestamp_start: String(since),
    limit: String(limit),
    order: "timestamp_asc",
    // Daily candles. A 120s TTL meant re-fetching 92 days of history every
    // two minutes per subnet; an hour is still fresher than the data itself.
  };
}

// ── Subnet Coldkey Distribution (concentration risk) ────────────
export interface ColdkeyDistribution {
  netuid: number;
  coldkey: { ss58: string };
  uid_count: number;
  total_stake: string;
}

export async function getColdkeyDistribution(netuid: number): Promise<ColdkeyDistribution[]> {
  return taoFetch<ColdkeyDistribution>("/subnets/distribution/coldkey", { netuid: String(netuid) });   // no paging params on this route
}

// ── Liquidity Distribution ──────────────────────────────────────
export interface LiquidityDistribution {
  netuid: number;
  tick: number;
  price: string;
  liquidity: string;
}

export async function getLiquidityDistribution(netuid: number): Promise<LiquidityDistribution[]> {
  void netuid;
  return [];   // retired in v1 (user-liquidity routes have no replacement)
}

// ── Stake events (was /api/delegation/v1) ─────────────────────────
// v1 /subnets/stake-events: `coldkey` instead of `nominator`, `stake` /
// `unstake` instead of DELEGATE / UNDELEGATE, plain SS58 strings, 200 rows a
// page. Rows are returned in the old shape so the wallet tracker and wallet
// alerts keep working unchanged.
export interface StakeEvent {
  action: "DELEGATE" | "UNDELEGATE";
  timestamp: string;
  nominator: { ss58: string };
  hotkey: string;
  amount: string;        // rao
  usd: string | null;
  netuid: number | null;
  extrinsic_id: string | null;
  is_transfer?: boolean;
}
interface StakeEventRaw {
  action: string; timestamp: string; coldkey: string; hotkey: string; amount: string; usd: string | null;
  netuid: number | null; extrinsic_id: string | null; is_transfer?: boolean;
}
export async function fetchStakeEvents(opts: {
  coldkey?: string; netuid?: number; timestampStart?: number;
  /** Minimum amount in rao. v1 sorts stake events by timestamp only, so "largest first" is done with this floor. */
  amountMin?: number;
  /** Rows wanted; fetched 200 at a time, newest first. */
  max?: number;
}): Promise<StakeEvent[]> {
  const max = Math.max(1, Math.min(opts.max ?? 200, 1000));
  const out: StakeEvent[] = [];
  for (let page = 1; out.length < max && page <= Math.ceil(max / 200); page++) {
    const params: Record<string, string> = { limit: String(Math.min(200, max - out.length)), page: String(page), order: "timestamp_desc" };
    if (opts.coldkey) params.coldkey = opts.coldkey;
    if (opts.amountMin) params.amount_min = String(Math.round(opts.amountMin));
    if (opts.netuid != null) params.netuid = String(opts.netuid);
    if (opts.timestampStart) params.timestamp_start = String(opts.timestampStart);
    const chunk = await taoFetch<StakeEventRaw>("/subnets/stake-events", params);
    for (const r of chunk) {
      out.push({
        action: /unstake|remove/i.test(r.action) ? "UNDELEGATE" : "DELEGATE",
        timestamp: r.timestamp, nominator: { ss58: r.coldkey }, hotkey: r.hotkey,
        amount: r.amount, usd: r.usd, netuid: r.netuid, extrinsic_id: r.extrinsic_id, is_transfer: r.is_transfer,
      });
    }
    if (chunk.length < 200) break;
  }
  return out;
}

