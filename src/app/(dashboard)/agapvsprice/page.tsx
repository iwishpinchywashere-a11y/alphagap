"use client";

import { useState, useEffect, useMemo } from "react";
import type { SubnetSeries } from "@/app/api/agapvsprice/route";

// ── Dual-axis SVG line chart ──────────────────────────────────────
function DualChart({ series }: { series: SubnetSeries }) {
  const W = 600, H = 160;
  const padL = 38, padR = 50, padT = 12, padB = 28;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const n = series.agap.length;
  if (n < 2) return null;

  const minA = Math.min(...series.agap),   maxA = Math.max(...series.agap);
  const minP = Math.min(...series.price),   maxP = Math.max(...series.price);
  const rangeA = maxA - minA || 1;
  const rangeP = maxP - minP || 1;

  const xOf = (i: number) => padL + (i / (n - 1)) * cW;
  const yA  = (v: number) => padT + cH - ((v - minA) / rangeA) * cH;
  const yP  = (v: number) => padT + cH - ((v - minP) / rangeP) * cH;

  const agapPath  = series.agap.map((v, i)  => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yA(v).toFixed(1)}`).join(" ");
  const pricePath = series.price.map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yP(v).toFixed(1)}`).join(" ");

  // X-axis tick labels (show 5 evenly spaced dates)
  const tickIdxs = [0, Math.floor(n * 0.25), Math.floor(n * 0.5), Math.floor(n * 0.75), n - 1];
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // Y-axis labels (left = aGap, right = price)
  const fmtPrice = (p: number) =>
    p >= 1 ? `$${p.toFixed(2)}` : p >= 0.01 ? `$${p.toFixed(3)}` : `$${p.toFixed(5)}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ display: "block" }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f}
          x1={padL} y1={padT + cH * (1 - f)} x2={padL + cW} y2={padT + cH * (1 - f)}
          stroke="#1f2937" strokeWidth="1"
        />
      ))}
      {/* Price line (amber) */}
      <path d={pricePath} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round" opacity="0.85" />
      {/* aGap line (green) */}
      <path d={agapPath}  fill="none" stroke="#22c55e" strokeWidth="2"   strokeLinejoin="round" />

      {/* Left Y axis — aGap */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + cH} stroke="#374151" strokeWidth="1" />
      {[minA, Math.round((minA + maxA) / 2), maxA].map((v, i) => (
        <text key={i} x={padL - 4} y={yA(v) + 4} textAnchor="end"
          fontSize="8" fill="#6b7280">{Math.round(v)}</text>
      ))}

      {/* Right Y axis — price */}
      <line x1={padL + cW} y1={padT} x2={padL + cW} y2={padT + cH} stroke="#374151" strokeWidth="1" />
      {[minP, (minP + maxP) / 2, maxP].map((v, i) => (
        <text key={i} x={padL + cW + 4} y={yP(v) + 4} textAnchor="start"
          fontSize="8" fill="#d97706">{fmtPrice(v)}</text>
      ))}

      {/* X-axis ticks */}
      {tickIdxs.filter(i => i < n).map((i) => (
        <text key={i} x={xOf(i)} y={H - 6} textAnchor="middle"
          fontSize="8" fill="#4b5563">
          {fmtDate(series.timestamps[i])}
        </text>
      ))}

      {/* Axis labels */}
      <text x={6} y={padT + cH / 2} textAnchor="middle" fontSize="7" fill="#22c55e"
        transform={`rotate(-90,6,${padT + cH / 2})`}>aGap</text>
      <text x={W - 6} y={padT + cH / 2} textAnchor="middle" fontSize="7" fill="#d97706"
        transform={`rotate(90,${W - 6},${padT + cH / 2})`}>Price</text>
    </svg>
  );
}

// ── Correlation badge ─────────────────────────────────────────────
function CorrBadge({ r }: { r: number }) {
  const abs = Math.abs(r);
  const label = abs >= 0.7 ? (r > 0 ? "Strong +" : "Strong −")
    : abs >= 0.4 ? (r > 0 ? "Moderate +" : "Moderate −")
    : "Weak";
  const color = abs >= 0.7
    ? r > 0 ? "text-green-400 bg-green-500/10 border-green-500/25"
            : "text-rose-400 bg-rose-500/10 border-rose-500/25"
    : abs >= 0.4
    ? r > 0 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/25"
            : "text-orange-400 bg-orange-500/10 border-orange-500/25"
    : "text-gray-400 bg-gray-500/10 border-gray-500/20";
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {label} r={r.toFixed(2)}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function AgapVsPricePage() {
  const [subnets, setSubnets] = useState<SubnetSeries[]>([]);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"correlation" | "agap" | "netuid">("correlation");
  const [minCorr, setMinCorr] = useState(0);

  useEffect(() => {
    fetch("/api/agapvsprice")
      .then(r => r.json())
      .then(d => {
        setSubnets(d.subnets ?? []);
        setSnapshotCount(d.snapshotCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let out = subnets.filter(s => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
          !String(s.netuid).includes(search)) return false;
      if (Math.abs(s.correlation) < minCorr) return false;
      return true;
    });
    if (sort === "agap")    out = [...out].sort((a, b) => b.latestAgap - a.latestAgap);
    if (sort === "netuid")  out = [...out].sort((a, b) => a.netuid - b.netuid);
    // "correlation" is already sorted by abs(r) desc from API
    return out;
  }, [subnets, search, sort, minCorr]);

  const strongPos = subnets.filter(s => s.correlation >= 0.7).length;
  const strongNeg = subnets.filter(s => s.correlation <= -0.7).length;
  const weak      = subnets.filter(s => Math.abs(s.correlation) < 0.4).length;

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Header */}
      <div className="relative border-b border-gray-800/50 px-6 py-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: "linear-gradient(rgba(34,197,94,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.4) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }} />
          <div className="absolute -top-12 left-1/3 w-96 h-48 bg-green-600/8 rounded-full blur-3xl" />
          <div className="absolute top-0 right-1/3 w-64 h-40 bg-amber-500/5 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-screen-xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/15 border border-green-500/25 flex items-center justify-center">
              <svg viewBox="0 0 20 20" className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 15l4-5 4 3 4-7 4 2" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 via-emerald-300 to-white bg-clip-text text-transparent">
              aGap vs Price
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase tracking-widest">
              Internal
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Dual-axis chart for every subnet — <span className="text-green-400">aGap score</span> vs <span className="text-amber-400">price</span> over time. Track whether our signal leads or follows the market.
            <span className="ml-3 text-gray-600">{snapshotCount} hourly snapshots · {subnets.length} subnets</span>
          </p>

          {/* Summary stats */}
          {!loading && (
            <div className="flex flex-wrap gap-4 mb-5 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-gray-400"><span className="text-white font-semibold">{strongPos}</span> subnets strong positive correlation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="text-gray-400"><span className="text-white font-semibold">{strongNeg}</span> strong negative</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-500" />
                <span className="text-gray-400"><span className="text-white font-semibold">{weak}</span> weak / no correlation</span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search subnet…"
              className="bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 w-44"
            />
            <div className="flex items-center gap-1 bg-gray-900/60 border border-gray-700 rounded-lg p-1">
              {(["correlation","agap","netuid"] as const).map(s => (
                <button key={s} onClick={() => setSort(s)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${sort === s ? "bg-green-500/20 text-green-400" : "text-gray-500 hover:text-gray-300"}`}>
                  {s === "correlation" ? "Correlation" : s === "agap" ? "aGap score" : "SN #"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="text-xs">Min |r|:</span>
              {[0, 0.3, 0.5, 0.7].map(v => (
                <button key={v} onClick={() => setMinCorr(v)}
                  className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${minCorr === v ? "border-green-500/40 text-green-400 bg-green-500/10" : "border-gray-700 text-gray-500 hover:text-gray-300"}`}>
                  {v === 0 ? "All" : v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chart grid */}
      <div className="max-w-screen-xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-600">No subnets match the current filter</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(s => (
              <div key={s.netuid} className="bg-[#0d0d16] border border-gray-800/60 rounded-2xl overflow-hidden hover:border-gray-700 transition-colors">
                {/* Card header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600 font-mono">SN{s.netuid}</span>
                    <span className="font-semibold text-white text-sm">{s.name}</span>
                  </div>
                  <CorrBadge r={s.correlation} />
                </div>
                {/* Chart */}
                <div className="px-2 pt-2 pb-1">
                  <DualChart series={s} />
                </div>
                {/* Footer stats */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-800/40">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                    <span className="text-xs text-gray-400">aGap <span className="text-green-400 font-bold">{s.latestAgap}</span></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                    <span className="text-xs text-gray-400">Price <span className="text-amber-400 font-bold">
                      {s.latestPrice >= 1 ? `$${s.latestPrice.toFixed(2)}` :
                       s.latestPrice >= 0.01 ? `$${s.latestPrice.toFixed(3)}` :
                       `$${s.latestPrice.toFixed(5)}`}
                    </span></span>
                  </div>
                  <div className="text-[10px] text-gray-600">{s.agap.length} pts</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="max-w-screen-xl mx-auto px-6 pb-10">
        <div className="flex items-center gap-6 text-xs text-gray-600 border-t border-gray-800/40 pt-4">
          <div className="flex items-center gap-2"><span className="w-6 h-0.5 bg-green-400 rounded" /> aGap score (left axis, 0–100)</div>
          <div className="flex items-center gap-2"><span className="w-6 h-0.5 bg-amber-400 rounded" style={{opacity:0.85}} /> Price in USD (right axis, normalized)</div>
          <span className="ml-auto">r = Pearson correlation coefficient over displayed window</span>
        </div>
      </div>
    </div>
  );
}
