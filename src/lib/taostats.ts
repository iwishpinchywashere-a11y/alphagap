const BASE_URL = "https://api.taostats.io/api";
const API_KEY = process.env.TAOSTATS_API_KEY || "";

interface TaoStatsResponse<T> {
  data: T[];
  pagination?: {
    current_page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
}

async function taoFetch<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: API_KEY },
    next: { revalidate: 0 },
  });

  if (res.status === 429) {
    console.warn(`TaoStats rate limited on ${path}, waiting 5s and retrying...`);
    await new Promise(r => setTimeout(r, 5000));
    const retry = await fetch(url.toString(), {
      headers: { Authorization: API_KEY },
      next: { revalidate: 0 },
    });
    if (!retry.ok) {
      console.warn(`TaoStats ${path} still failing after retry (${retry.status})`);
      return [] as T[];
    }
    const retryJson: TaoStatsResponse<T> = await retry.json();
    return retryJson.data || [];
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TaoStats ${path} failed (${res.status}): ${text}`);
  }

  const json: TaoStatsResponse<T> = await res.json();
  return json.data || [];
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
  return taoFetch<SubnetIdentity>("/subnet/identity/v1", { limit: "200" });
}

// ── TAO Flow ─────────────────────────────────────────────────────
export interface TaoFlow {
  netuid: number;
  tao_flow: number; // EMA value in rao (1e9 = 1 TAO)
}

export async function getTaoFlows(): Promise<TaoFlow[]> {
  return taoFetch<TaoFlow>("/dtao/tao_flow/v1", { limit: "200" });
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

export async function getSubnetPools(): Promise<SubnetPool[]> {
  return taoFetch<SubnetPool>("/dtao/pool/latest/v1", { limit: "200" });
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

export async function getSubnetEmissions(): Promise<SubnetEmission[]> {
  return taoFetch<SubnetEmission>("/dtao/subnet_emission/v1", { limit: "200" });
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
  return taoFetch<GithubActivity>("/dev_activity/latest/v1", { limit: "200" });
}

// ── TAO Price ────────────────────────────────────────────────────
export interface TaoPrice {
  price: string;
  volume_24h: string;
  market_cap: string;
  percent_change_24h: string;
}

export async function getTaoPrice(): Promise<number> {
  const data = await taoFetch<TaoPrice>("/price/latest/v1", { asset: "tao" });
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
  const params: Record<string, string> = { limit: "200", order: "alpha_desc" };
  if (netuid !== undefined) params.netuid = String(netuid);
  return taoFetch<ValidatorAlphaShares>("/dtao/hotkey_alpha_shares/latest/v1", params);
}

// ── Metagraph (neuron data per subnet) ──────────────────────────
export interface MetagraphNeuron {
  netuid: number;
  uid: number;
  hotkey: { ss58: string };
  coldkey: { ss58: string };
  stake: string;
  trust: string;
  consensus: string;
  incentive: string;
  dividends: string;
  emission: string;
  active: boolean;
  validator_permit: boolean;
  last_update: number;
}

export async function getMetagraph(netuid: number): Promise<MetagraphNeuron[]> {
  return taoFetch<MetagraphNeuron>("/metagraph/latest/v1", { netuid: String(netuid), limit: "200" });
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
  return taoFetch<NeuronRegistration>("/subnet/neuron/registration/v1", params);
}

// ── Registration Cost (demand for subnet slots) ─────────────────
export interface RegistrationCost {
  netuid: number;
  block_number: number;
  timestamp: string;
  cost: string; // in rao
}

export async function getRegistrationCosts(): Promise<RegistrationCost[]> {
  return taoFetch<RegistrationCost>("/subnet/registration_cost/latest/v1", { limit: "200" });
}

// ── Burned Alpha (deflationary signal) ──────────────────────────
export interface BurnedAlpha {
  netuid: number;
  block_number: number;
  timestamp: string;
  burned_alpha: string; // in rao
}

export async function getBurnedAlpha(): Promise<BurnedAlpha[]> {
  return taoFetch<BurnedAlpha>("/dtao/burned_alpha/v1", { limit: "200" });
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
  return taoFetch<SubnetEmissionHistory>("/dtao/subnet_emission/v1", {
    netuid: String(netuid),
    timestamp_start: String(since),
    limit: "200",
    order: "timestamp_asc",
  });
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
  return taoFetch<PoolHistory>("/dtao/pool/history/v1", {
    netuid: String(netuid),
    timestamp_start: String(since),
    limit: String(limit),
    order: "timestamp_asc",
  });
}

// ── Subnet Coldkey Distribution (concentration risk) ────────────
export interface ColdkeyDistribution {
  netuid: number;
  coldkey: { ss58: string };
  uid_count: number;
  total_stake: string;
}

export async function getColdkeyDistribution(netuid: number): Promise<ColdkeyDistribution[]> {
  return taoFetch<ColdkeyDistribution>("/subnet/distribution/coldkey/v1", { netuid: String(netuid), limit: "50" });
}

// ── Liquidity Distribution ──────────────────────────────────────
export interface LiquidityDistribution {
  netuid: number;
  tick: number;
  price: string;
  liquidity: string;
}

export async function getLiquidityDistribution(netuid: number): Promise<LiquidityDistribution[]> {
  return taoFetch<LiquidityDistribution>("/dtao/liquidity/distribution/v1", { netuid: String(netuid), limit: "200" });
}
