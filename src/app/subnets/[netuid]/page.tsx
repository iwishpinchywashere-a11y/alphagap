"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────
interface ScoreRow {
  date: string;
  agap: number; flow: number; dev: number;
  eval: number; social: number;
  price: number; mcap: number; emission_pct: number;
}
interface PricePoint { timestamp: string; price: number; market_cap: number; volume: number }
interface EmissionPoint { pct: number; timestamp: string }
interface Signal {
  netuid: number; strength: number; signal_type: string;
  title: string; description: string; source: string;
  source_url?: string; signal_date?: string; created_at: string;
}
interface SubnetData {
  netuid: number; name: string;
  identity: {
    description?: string; summary?: string;
    github_repo?: string; twitter?: string;
    discord?: string; website?: string; tags?: string[];
  } | null;
  current: Record<string, number | string | boolean | null> | null;
  scoreHistory: ScoreRow[];
  emissionHistory: EmissionPoint[];
  priceHistory: PricePoint[];
  signals: Signal[];
  metagraph: { validators: number; miners: number; totalNeurons: number };
  lastScan: string | null;
}

// ── Reusable pure-SVG line chart ──────────────────────────────────
function LineChart({
  data,
  valueKey,
  label,
  color = "#4ade80",
  formatY = (v: number) => v.toFixed(1),
  minY,
  maxY,
}: {
  data: { x: string; y: number }[];
  valueKey?: string;
  label: string;
  color?: string;
  formatY?: (v: number) => string;
  minY?: number;
  maxY?: number;
}) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-28 text-gray-600 text-xs">
        Not enough data yet — accumulating…
      </div>
    );
  }

  const W = 600; const H = 120;
  const PAD = { top: 10, right: 12, bottom: 22, left: 44 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const values = data.map((d) => d.y);
  const rawMin = minY ?? Math.min(...values);
  const rawMax = maxY ?? Math.max(...values);
  const range = rawMax - rawMin || 1;
  const yMin = rawMin - range * 0.1;
  const yMax = rawMax + range * 0.1;

  const xS = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * cW;
  const yS = (v: number) => PAD.top + cH - ((v - yMin) / (yMax - yMin)) * cH;

  const pts = data.map((d, i) => `${xS(i).toFixed(1)},${yS(d.y).toFixed(1)}`).join(" ");
  const first = { x: xS(0), y: yS(data[0].y) };
  const last = { x: xS(data.length - 1), y: yS(data[data.length - 1].y) };
  const baseY = PAD.top + cH;
  const area = `${first.x.toFixed(1)},${baseY} ${pts} ${last.x.toFixed(1)},${baseY}`;

  const yTicks = [0.15, 0.5, 0.85].map((t) => yMin + (yMax - yMin) * t);
  const xLabels = data.length > 1
    ? [0, Math.floor((data.length - 1) / 2), data.length - 1].map((i) => ({
        x: xS(i),
        label: new Date(data[i].x + (data[i].x.length === 10 ? "T12:00:00" : "")).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      }))
    : [];

  const gradId = `grad-${label.replace(/\s/g, "")}`;
  const latestVal = data[data.length - 1].y;
  const firstVal = data[0].y;
  const isUp = latestVal >= firstVal;
  const lineCol = isUp ? color : "#f87171";

  void valueKey; // unused but part of API

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "120px" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineCol} stopOpacity="0.22" />
          <stop offset="100%" stopColor={lineCol} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={yS(v).toFixed(1)} x2={PAD.left + cW} y2={yS(v).toFixed(1)} stroke="#1f2937" strokeWidth="1" />
          <text x={PAD.left - 4} y={(yS(v) + 4).toFixed(1)} fill="#6b7280" fontSize="9" textAnchor="end">{formatY(v)}</text>
        </g>
      ))}
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke={lineCol} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {xLabels.map((l, i) => (
        <text key={i} x={l.x.toFixed(1)} y={H - 4} fill="#6b7280" fontSize="9" textAnchor="middle">{l.label}</text>
      ))}
      <circle cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="3.5" fill={lineCol} />
      <text x={(last.x - 6).toFixed(1)} y={(last.y - 6).toFixed(1)} fill={lineCol} fontSize="10" fontWeight="bold" textAnchor="end">
        {formatY(latestVal)}
      </text>
    </svg>
  );
}

// ── Chart card wrapper ────────────────────────────────────────────
function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</span>
        {subtitle && <span className="text-xs text-gray-600">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Score badge ───────────────────────────────────────────────────
function ScoreBadge({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div className="flex flex-col items-center bg-gray-800/60 rounded-lg px-4 py-3 min-w-[72px]">
      <span className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{label}</span>
      <span className={`text-2xl font-bold tabular-nums ${color}`}>{value ?? "—"}</span>
    </div>
  );
}

function scoreColor(s: number) {
  if (s >= 70) return "text-green-400";
  if (s >= 40) return "text-yellow-400";
  return "text-red-400";
}

function signalTypeColor(t: string) {
  switch (t) {
    case "dev_spike": return "text-blue-400";
    case "release": return "text-purple-400";
    case "hf_update": return "text-yellow-400";
    case "flow_inflection": return "text-green-400";
    case "social_buzz": return "text-cyan-400";
    default: return "text-gray-400";
  }
}

// ── Main page ─────────────────────────────────────────────────────
export default function SubnetDetailPage({ params }: { params: Promise<{ netuid: string }> }) {
  const { netuid } = use(params);
  const [data, setData] = useState<SubnetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/subnets/${netuid}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => setData(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [netuid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl animate-spin mb-4">⟳</div>
          <p className="text-gray-500">Loading subnet data…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-gray-400">{error || "Subnet not found"}</p>
          <Link href="/dashboard" className="mt-4 inline-block text-green-400 hover:underline text-sm">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const c = data.current;
  const price = (c?.alpha_price as number) || 0;
  const mcap = (c?.market_cap as number) || 0;
  const change24h = (c?.price_change_24h as number) || 0;
  const change7d = (c?.price_change_7d as number) || 0;
  const emissionPct = (c?.emission_pct as number) || 0;
  const agap = (c?.composite_score as number) || 0;
  const flow = (c?.flow_score as number) || 0;
  const dev = (c?.dev_score as number) || 0;
  const evalScore = (c?.eval_score as number) || 0;
  const social = (c?.social_score as number) || 0;

  // Build chart data series
  const agapSeries = data.scoreHistory.map((r) => ({ x: r.date, y: r.agap }));
  const flowSeries = data.scoreHistory.map((r) => ({ x: r.date, y: r.flow }));
  const devSeries = data.scoreHistory.map((r) => ({ x: r.date, y: r.dev }));
  const evalSeries = data.scoreHistory.map((r) => ({ x: r.date, y: r.eval }));
  const socialSeries = data.scoreHistory.map((r) => ({ x: r.date, y: r.social }));
  const priceSeries = data.priceHistory.map((r) => ({ x: r.timestamp, y: r.price }));
  const emissionSeries = data.emissionHistory.map((r) => ({ x: r.timestamp, y: r.pct }));

  const fmtPrice = (v: number) => v < 0.01 ? `$${v.toFixed(5)}` : v < 1 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
  const fmtMcap = (v: number) =>
    v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v.toFixed(0)}`;

  const changeColor = (v: number) => v > 0 ? "text-green-400" : v < 0 ? "text-red-400" : "text-gray-500";
  const fmtPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100">
      {/* Nav strip */}
      <div className="border-b border-gray-800 px-4 md:px-6 py-3 flex items-center gap-4">
        <a href="/dashboard">
          <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-10 w-auto" />
        </a>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/dashboard" className="hover:text-gray-300 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-300">{data.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">

        {/* ── Hero ──────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs text-gray-500 bg-gray-800 rounded px-2 py-0.5">SN{data.netuid}</span>
              {data.identity?.tags?.map((tag) => (
                <span key={tag} className="text-xs text-gray-600 bg-gray-800/60 rounded px-2 py-0.5">{tag}</span>
              ))}
            </div>
            <h1 className="text-3xl font-bold text-white mb-1">{data.name}</h1>
            {data.identity?.summary && (
              <p className="text-gray-400 text-sm max-w-2xl">{data.identity.summary}</p>
            )}
            {!data.identity?.summary && data.identity?.description && (
              <p className="text-gray-400 text-sm max-w-2xl">{data.identity.description}</p>
            )}

            {/* External links */}
            <div className="flex items-center gap-4 mt-3">
              {data.identity?.github_repo && (
                <a href={data.identity.github_repo} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
                  <span>⎇</span> GitHub
                </a>
              )}
              {data.identity?.twitter && (
                <a href={`https://x.com/${data.identity.twitter.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-300">
                  𝕏 Twitter
                </a>
              )}
              {data.identity?.discord && (
                <a href={data.identity.discord} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-300">
                  Discord
                </a>
              )}
              {data.identity?.website && (
                <a href={data.identity.website} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-300">
                  🌐 Website
                </a>
              )}
            </div>
          </div>

          {/* Price box */}
          <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-5 min-w-[220px]">
            <div className="text-xs text-gray-500 mb-1">Alpha Price</div>
            <div className="text-3xl font-bold text-white mb-1">{fmtPrice(price)}</div>
            <div className="flex items-center gap-3 text-sm">
              <span className={changeColor(change24h)}>{fmtPct(change24h)} 24h</span>
              <span className={changeColor(change7d)}>{fmtPct(change7d)} 7d</span>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-500">
              MCap <span className="text-white font-medium">{fmtMcap(mcap)}</span>
            </div>
          </div>
        </div>

        {/* ── AlphaGap Scores strip ─────────────────────────────── */}
        <div className="bg-gray-900/40 border border-green-900/30 rounded-xl p-4">
          <div className="text-xs text-green-400/70 uppercase tracking-wider mb-3 font-medium">AlphaGap Proprietary Scores</div>
          <div className="flex flex-wrap gap-3">
            <ScoreBadge label="aGap" value={agap} color={scoreColor(agap)} />
            <ScoreBadge label="Flow" value={flow} color={scoreColor(flow)} />
            <ScoreBadge label="Dev" value={dev} color={scoreColor(dev)} />
            <ScoreBadge label="eVal" value={evalScore} color={scoreColor(evalScore)} />
            <ScoreBadge label="Social" value={social} color={scoreColor(social)} />
            <div className="flex flex-col items-center bg-gray-800/60 rounded-lg px-4 py-3 min-w-[72px]">
              <span className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Emission</span>
              <span className="text-2xl font-bold tabular-nums text-blue-400">{emissionPct > 0 ? `${(emissionPct * 100).toFixed(1)}%` : "—"}</span>
            </div>
            <div className="flex flex-col items-center bg-gray-800/60 rounded-lg px-4 py-3 min-w-[72px]">
              <span className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Validators</span>
              <span className="text-2xl font-bold tabular-nums text-purple-400">{data.metagraph.validators}</span>
            </div>
            <div className="flex flex-col items-center bg-gray-800/60 rounded-lg px-4 py-3 min-w-[72px]">
              <span className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Miners</span>
              <span className="text-2xl font-bold tabular-nums text-orange-400">{data.metagraph.miners}</span>
            </div>
          </div>
        </div>

        {/* ── Price chart (full width) ──────────────────────────── */}
        <ChartCard title="Alpha Token Price" subtitle="30-day history · TaoStats">
          {priceSeries.length >= 2 ? (
            <LineChart
              data={priceSeries}
              label="Price"
              color="#4ade80"
              formatY={(v) => v < 0.01 ? `$${v.toFixed(5)}` : v < 1 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`}
            />
          ) : (
            <div className="h-28 flex items-center justify-center text-gray-600 text-xs">Price history loading…</div>
          )}
        </ChartCard>

        {/* ── Proprietary score charts — 2 cols ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="aGap Score" subtitle="AlphaGap composite · 90-day">
            <LineChart data={agapSeries} label="aGap" color="#4ade80" formatY={(v) => v.toFixed(0)} minY={0} maxY={100} />
          </ChartCard>
          <ChartCard title="Flow Score" subtitle="Price momentum + whale activity">
            <LineChart data={flowSeries} label="Flow" color="#34d399" formatY={(v) => v.toFixed(0)} minY={0} maxY={100} />
          </ChartCard>
          <ChartCard title="Dev Score" subtitle="GitHub + HuggingFace activity">
            <LineChart data={devSeries} label="Dev" color="#60a5fa" formatY={(v) => v.toFixed(0)} minY={0} maxY={100} />
          </ChartCard>
          <ChartCard title="eVal Score" subtitle="Emissions-to-valuation gap">
            <LineChart data={evalSeries} label="eVal" color="#a78bfa" formatY={(v) => v.toFixed(0)} minY={0} maxY={100} />
          </ChartCard>
          <ChartCard title="Social Score" subtitle="X · Discord · community sentiment">
            <LineChart data={socialSeries} label="Social" color="#22d3ee" formatY={(v) => v.toFixed(0)} minY={0} maxY={100} />
          </ChartCard>
          <ChartCard title="Emission %" subtitle="Share of total Bittensor emissions · 7-day">
            <LineChart
              data={emissionSeries.length >= 2 ? emissionSeries : agapSeries.map((r) => ({ x: r.x, y: emissionPct * 100 }))}
              label="Emission"
              color="#f59e0b"
              formatY={(v) => `${v.toFixed(2)}%`}
            />
          </ChartCard>
        </div>

        {/* ── Recent signals ────────────────────────────────────── */}
        {data.signals.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-gray-300 mb-3">Recent Signals</h2>
            <div className="space-y-2">
              {data.signals.slice(0, 10).map((sig, i) => (
                <div key={i} className={`bg-gray-900/50 border rounded-lg px-4 py-3 flex items-start gap-3 ${
                  sig.strength >= 80 ? "border-green-800/50" : sig.strength >= 50 ? "border-yellow-900/30" : "border-gray-800"
                }`}>
                  <div className={`text-lg shrink-0 ${signalTypeColor(sig.signal_type)}`}>
                    {sig.signal_type === "dev_spike" ? "🔨" : sig.signal_type === "release" ? "🚀" : sig.signal_type === "hf_update" ? "🤗" : sig.signal_type === "flow_inflection" ? "↗" : "•"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs text-gray-500">
                        {sig.signal_date
                          ? new Date(sig.signal_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : new Date(sig.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      <span className="text-xs text-gray-600">via {sig.source}</span>
                      {sig.source_url && (
                        <a href={sig.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline" onClick={(e) => e.stopPropagation()}>
                          View →
                        </a>
                      )}
                    </div>
                    <p className="text-sm text-gray-300">{sig.title}</p>
                  </div>
                  <div className={`text-base font-bold tabular-nums shrink-0 ${
                    sig.strength >= 80 ? "text-green-400" : sig.strength >= 50 ? "text-yellow-400" : "text-gray-500"
                  }`}>{sig.strength}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-xs text-gray-700 text-center pb-4">
          AlphaGap Subnet Intelligence · Prices from TaoStats · Scores proprietary
          {data.lastScan && <> · Last scan {new Date(data.lastScan).toLocaleTimeString()}</>}
        </div>
      </div>
    </div>
  );
}
