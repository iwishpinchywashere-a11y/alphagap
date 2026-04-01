"use client";

import { useDashboard } from "./DashboardProvider";
import { scoreColor, flowColor, formatNum, signalColor, signalIcon } from "@/lib/formatters";

export default function SubnetDetailPanel() {
  const { selectedSubnet, setSelectedSubnet, leaderboard, signals, taoPrice } = useDashboard();

  if (selectedSubnet === null) return null;

  const data = leaderboard.find((s) => s.netuid === selectedSubnet);
  if (!data) return null;

  const subnetSignals = signals.filter((s) => s.netuid === selectedSubnet);

  return (
    <div className="w-96 border-l border-gray-800 overflow-auto p-4 bg-gray-900/30 shrink-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold">SN{selectedSubnet} Detail</h3>
        <button
          onClick={() => setSelectedSubnet(null)}
          className="text-gray-500 hover:text-gray-300 text-sm"
        >
          &#x2715;
        </button>
      </div>

      <div className="mb-4">
        <h4 className="font-medium text-sm">{data.name}</h4>
      </div>

      {/* Scores */}
      <div className="mb-4">
        <h4 className="text-xs text-gray-500 uppercase mb-2">Scores</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-800/50 rounded p-2">
            <span className="text-gray-500 block">aGap Score</span>
            <span className={`font-bold ${scoreColor(data.composite_score)}`}>{data.composite_score}</span>
          </div>
          <div className="bg-gray-800/50 rounded p-2">
            <span className="text-gray-500 block">Dev</span>
            <span className={scoreColor(data.dev_score)}>{data.dev_score}</span>
          </div>
          <div className="bg-gray-800/50 rounded p-2">
            <span className="text-gray-500 block">Flow</span>
            <span className={scoreColor(data.flow_score)}>{data.flow_score}</span>
          </div>
          <div className="bg-gray-800/50 rounded p-2">
            <span className="text-gray-500 block">eVal</span>
            <span className={scoreColor(data.eval_score)}>{data.eval_score}</span>
            {data.eval_ratio ? <span className="text-xs text-gray-500 block">{data.eval_ratio}x</span> : null}
          </div>
          <div className="bg-gray-800/50 rounded p-2">
            <span className="text-gray-500 block">Social</span>
            <span className={scoreColor(data.social_score)}>{data.social_score}</span>
          </div>
        </div>
      </div>

      {/* Market data */}
      <div className="mb-4">
        <h4 className="text-xs text-gray-500 uppercase mb-2">Market Data</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-800/50 rounded p-2">
            <span className="text-gray-500 block">Price</span>
            <span className="text-white">
              {data.alpha_price != null ? `$${formatNum(data.alpha_price, 4)}` : "\u2014"}
            </span>
          </div>
          <div className="bg-gray-800/50 rounded p-2">
            <span className="text-gray-500 block">MCap</span>
            <span className="text-white">
              {data.market_cap != null ? `$${formatNum(data.market_cap)}` : "\u2014"}
            </span>
          </div>
          <div className="bg-gray-800/50 rounded p-2">
            <span className="text-gray-500 block">24h Change</span>
            <span className={
              data.price_change_24h == null ? "text-gray-500" :
              data.price_change_24h > 0 ? "text-green-400" :
              data.price_change_24h < 0 ? "text-red-400" : "text-gray-500"
            }>
              {data.price_change_24h != null
                ? `${data.price_change_24h > 0 ? "+" : ""}${data.price_change_24h.toFixed(1)}%`
                : "\u2014"}
            </span>
          </div>
          <div className="bg-gray-800/50 rounded p-2">
            <span className="text-gray-500 block">24h Net Flow</span>
            <span className={flowColor(data.net_flow_24h)}>
              {data.net_flow_24h != null && taoPrice != null
                ? `${data.net_flow_24h > 0 ? "+" : ""}$${formatNum(Math.round(data.net_flow_24h * taoPrice))}`
                : data.net_flow_24h != null
                ? `${data.net_flow_24h > 0 ? "+" : ""}${formatNum(data.net_flow_24h)} τ`
                : "\u2014"}
            </span>
          </div>
        </div>
      </div>

      {/* Signals for this subnet */}
      {subnetSignals.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs text-gray-500 uppercase mb-2">Signals ({subnetSignals.length})</h4>
          <div className="space-y-1.5">
            {subnetSignals.slice(0, 10).map((sig) => (
              <div key={sig.id} className="text-xs bg-gray-800/30 rounded p-2">
                <div className="flex items-center gap-1.5">
                  <span className={signalColor(sig.signal_type)}>{signalIcon(sig.signal_type)}</span>
                  <span className="text-gray-400 truncate flex-1">{sig.title}</span>
                  <span className={`font-bold ${
                    sig.strength >= 80 ? "text-green-400" :
                    sig.strength >= 50 ? "text-yellow-400" : "text-gray-500"
                  }`}>{sig.strength}</span>
                </div>
                {sig.description && <p className="text-gray-600 mt-1">{sig.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
