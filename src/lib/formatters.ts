export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatNum(n: number | undefined | null, decimals = 2): string {
  if (n == null) return "\u2014";
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(decimals);
}

export function signalColor(type: string): string {
  switch (type) {
    case "flow_inflection": return "text-green-400";
    case "flow_spike": return "text-emerald-400";
    case "flow_warning": return "text-red-400";
    case "dev_spike": return "text-blue-400";
    case "release": return "text-purple-400";
    case "hf_update": return "text-yellow-400";
    case "hf_drop": return "text-yellow-400";
    case "cross_signal": return "text-pink-400";
    case "price_surge": return "text-green-300";
    case "price_drop": return "text-red-400";
    case "buy_pressure": return "text-green-400";
    case "sell_pressure": return "text-red-400";
    case "social_buzz": return "text-cyan-400";
    default: return "text-gray-400";
  }
}

export function signalIcon(type: string): string {
  switch (type) {
    case "flow_inflection": return "\u2197";
    case "flow_spike": return "\u26A1";
    case "flow_warning": return "\u26A0";
    case "dev_spike": return "\uD83D\uDD28";
    case "release": return "\uD83D\uDE80";
    case "hf_update": return "\uD83E\uDD17";
    case "hf_drop": return "\uD83E\uDD17";
    case "cross_signal": return "\u2726";
    case "price_surge": return "\uD83D\uDCC8";
    case "price_drop": return "\uD83D\uDCC9";
    case "buy_pressure": return "\uD83D\uDFE2";
    case "sell_pressure": return "\uD83D\uDD34";
    case "social_buzz": return "\uD83D\uDCE3";
    default: return "\u2022";
  }
}

export function scoreColor(score: number): string {
  if (score >= 70) return "text-green-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
}

export function flowColor(flow: number | null | undefined): string {
  if (flow == null) return "text-gray-500";
  if (flow > 0) return "text-green-400";
  if (flow < 0) return "text-red-400";
  return "text-gray-500";
}

export function formatMcap(mcap: number | undefined | null): string | null {
  if (mcap == null) return null;
  if (mcap >= 1_000_000_000) return `$${(mcap / 1_000_000_000).toFixed(2)}B`;
  if (mcap >= 1_000_000) return `$${(mcap / 1_000_000).toFixed(1)}M`;
  return `$${(mcap / 1000).toFixed(0)}K`;
}
