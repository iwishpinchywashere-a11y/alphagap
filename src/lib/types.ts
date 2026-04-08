export interface Signal {
  id: number;
  netuid: number;
  signal_type: string;
  strength: number;
  title: string;
  description: string;
  source: string;
  source_url?: string;
  analysis?: string;
  analysis_status?: string;
  created_at: string;
  signal_date?: string;
  subnet_name?: string;
}

export interface PortfolioPosition {
  netuid: number;
  name: string;
  buyDate: string;
  buyAGapScore: number;
  buyPriceUsd: number;
  amountUsd: number;
  alphaTokens: number;
  currentPrice: number;
  currentValue: number;
  totalPnlUsd: number;
  totalPnlPct: number;
  change24h: number;
  pnl24hUsd: number;
  peakPrice?: number;
  maxPnlUsd?: number;
  maxPnlPct?: number;
}

export interface PortfolioData {
  positions: PortfolioPosition[];
  history: { date: string; totalValue: number }[];
  summary: {
    totalValue: number;
    totalCost: number;
    totalPnlUsd: number;
    totalPnlPct: number;
    positionCount: number;
    taoPrice: number;
    maxReturnUsd: number | null;
    maxReturnPct: number | null;
  };
}

export interface SubnetScore {
  netuid: number;
  name: string;
  composite_score: number;
  flow_score: number;
  dev_score: number;
  eval_score: number;
  social_score: number;
  signal_count: number;
  top_signal?: string;
  alpha_price?: number;
  market_cap?: number;
  net_flow_24h?: number;
  emission_pct?: number;
  emission_trend?: "up" | "down" | null;
  emission_change_pct?: number;
  eval_ratio?: number;
  price_change_24h?: number;
  price_change_1h?: number;
  price_change_7d?: number;
  price_change_30d?: number;
  has_campaign?: boolean;
  whale_ratio?: number;
  whale_signal?: "accumulating" | "distributing" | null;
  miner_burn_pct?: number;
  tao_locked?: number;
  dereg_risk?: boolean;
  dereg_top3?: boolean;
  fear_greed?: number;
  category?: string;
  sparkline_prices?: number[];
  volume_surge?: boolean;
  volume_surge_ratio?: number;
  alpha_staked_pct?: number;
  sector_rotation?: boolean;
  product_score?: number;        // 0–100 — benchmark vs centralized (100) / website scan (80) / milestone (80) / heuristic (60)
  utility_estimated?: boolean;   // true = heuristic, website, or milestone score (not formally benchmarked)
  product_source?: "benchmark" | "website" | "milestone" | "heuristic";  // which tier scored this
  benchmark_score?: number;      // raw benchmark score 0–100
  benchmark_category?: string;   // e.g. "Serverless AI Compute"
  cost_saving_pct?: number;      // % cost savings vs centralized provider
  vs_provider?: string;          // e.g. "AWS Lambda / Google Cloud AI"
  benchmark_summary?: string;    // human-readable benchmark findings
  annual_revenue_usd?: number;   // estimated annual revenue
  momentum_boost?: number;       // MOMENTUM pillar score (signed, ±15 max)
  agap_velo?: number;            // aGap Velocity score 0-100
  invest_agap?: number;          // Investing (long-term) aGap score 0-100
}
