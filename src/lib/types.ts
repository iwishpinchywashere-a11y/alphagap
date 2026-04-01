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
}
