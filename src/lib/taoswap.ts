/**
 * TaoSwap API client
 * Base: https://api.taoswap.org
 * No auth required for public endpoints.
 */

const TAOSWAP_BASE = "https://api.taoswap.org";

export interface TaoSwapSubnet {
  id: number;                              // netuid
  symbol: string;
  name: string;
  price: number;
  market_cap: number;
  total_supply: number;

  // Emission mechanics
  emission_value: number | null;
  emission_percent: number | null;         // subnet's share of total network emissions (%)
  emission_miner_burn: number | null;      // % of miner emissions being burned (0=good, 100=all burned)
  emission_evolution_d_1: number | null;
  emission_evolution_d_30: number | null;
  emission_chain_buys: number | null;
  emission_chain_buys_percent: number | null; // % of emissions recycled into buying token
  emission_ema_percent: number | null;     // 7-day EMA of taoflow emission %

  // Pool / liquidity
  tao_in_emission: number | null;
  alpha_in_emission: number | null;
  alpha_out_emission: number | null;
  root_in_pool: number | null;             // TAO in the liquidity pool
  alpha_in_pool: number | null;
  alpha_stake: number;
  alpha_outstanding: number;

  // Capital flows
  inflow: number | null;                   // TAO flowing into subnet pool
  outflow: number | null;                  // TAO flowing out of subnet pool

  // Decentralisation metrics
  hhi_normalized: number;                  // Herfindahl-Hirschman Index (0=competitive, 1=monopoly)
  nakamoto_coefficient: number;            // min validators needed to control network (higher=safer)
  top10_share: number;                     // fraction of supply held by top 10 addresses (0–1)

  // Adoption
  holders_count: number;
  active_miners: number | null;

  // Network params
  registration_cost: number;
  blocks_since_epoch: number;
  tempo: number;
  mechanism_count: number;
}

export async function getTaoSwapSubnets(): Promise<TaoSwapSubnet[]> {
  try {
    // Note: trailing slash required — /subnets (no slash) returns a 301 redirect
    const res = await fetch(`${TAOSWAP_BASE}/subnets/?limit=300`, {
      headers: { "User-Agent": "AlphaGap/1.0" },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) {
      console.warn(`[taoswap] /subnets/ returned ${res.status}`);
      return [];
    }
    const data = await res.json();
    // API returns paginated format: { results: [...], count: N, next: ..., previous: ... }
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results as TaoSwapSubnet[];
    console.warn("[taoswap] unexpected response shape:", Object.keys(data || {}));
    return [];
  } catch (e) {
    console.warn("[taoswap] fetch failed:", e);
    return [];
  }
}
