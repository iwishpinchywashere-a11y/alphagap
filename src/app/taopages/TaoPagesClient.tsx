"use client";

import { useState } from "react";
import Link from "next/link";
import type { SubnetType } from "@/lib/tao-pages-data";
import { subnetAvatarColor } from "@/lib/subnet-logos";

export interface SubnetRow {
  netuid: number;
  slug: string;
  name: string;
  category: string;
  subnetType: SubnetType;
  blurb: string;
  analogy: string;
  market_cap: number;
  composite_score: number;
  rank: number;
  logoUrl?: string;
}

const ALL_TYPES: SubnetType[] = [
  "Inference",
  "Training",
  "Compute",
  "Storage",
  "Agents",
  "Data",
  "Finance",
  "Science",
  "Creative",
  "Tools",
];

const TYPE_ICONS: Record<SubnetType, string> = {
  Inference: "⚡",
  Training:  "🧠",
  Compute:   "🖥",
  Storage:   "☁️",
  Agents:    "🤖",
  Data:      "📊",
  Finance:   "📈",
  Science:   "🔬",
  Creative:  "🎨",
  Tools:     "🔧",
};

const TYPE_COLORS: Record<SubnetType, string> = {
  Inference: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  Training:  "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  Compute:   "bg-orange-500/15 text-orange-300 border-orange-500/25",
  Storage:   "bg-teal-500/15 text-teal-300 border-teal-500/25",
  Agents:    "bg-lime-500/15 text-lime-300 border-lime-500/25",
  Data:      "bg-sky-500/15 text-sky-300 border-sky-500/25",
  Finance:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
  Science:   "bg-rose-500/15 text-rose-300 border-rose-500/25",
  Creative:  "bg-violet-500/15 text-violet-300 border-violet-500/25",
  Tools:     "bg-green-500/15 text-green-300 border-green-500/25",
};

function fmtMcap(v: number): string {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}

export default function TaoPagesClient({ subnets }: { subnets: SubnetRow[] }) {
  const [active, setActive] = useState<SubnetType | null>(null);
  const [query, setQuery] = useState("");

  const filtered = subnets.filter((s) => {
    const matchesType = active ? s.subnetType === active : true;
    const q = query.trim().toLowerCase();
    const matchesQuery = q
      ? s.name.toLowerCase().includes(q) || s.blurb.toLowerCase().includes(q)
      : true;
    return matchesType && matchesQuery;
  });

  // Counts per type for badges (against query-filtered list)
  const queryFiltered = query.trim()
    ? subnets.filter((s) => {
        const q = query.trim().toLowerCase();
        return s.name.toLowerCase().includes(q) || s.blurb.toLowerCase().includes(q);
      })
    : subnets;
  const counts = Object.fromEntries(
    ALL_TYPES.map((t) => [t, queryFiltered.filter((s) => s.subnetType === t).length])
  ) as Record<SubnetType, number>;

  return (
    <div>
      {/* ── Search bar ──────────────────────────────────────────── */}
      <div className="relative mb-5">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search subnets by name or description…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.14] focus:border-green-500/40 focus:outline-none rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-gray-600 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        <button
          onClick={() => setActive(null)}
          className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
            active === null
              ? "bg-white/10 border-white/20 text-white"
              : "border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/15"
          }`}
        >
          All <span className="ml-1 opacity-50">{subnets.length}</span>
        </button>
        {ALL_TYPES.filter((t) => counts[t] > 0).map((type) => (
          <button
            key={type}
            onClick={() => setActive(active === type ? null : type)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
              active === type
                ? TYPE_COLORS[type]
                : "border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/15"
            }`}
          >
            <span>{TYPE_ICONS[type]}</span>
            {type}
            <span className="opacity-50">{counts[type]}</span>
          </button>
        ))}
      </div>

      {/* ── Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((s) => {
          const colors = TYPE_COLORS[s.subnetType];
          const icon = TYPE_ICONS[s.subnetType];
          const logoUrl = s.logoUrl;
          return (
            <Link
              key={s.netuid}
              href={`/taopages/${s.slug}`}
              className="group relative bg-[#0d0d14] border border-white/[0.06] hover:border-white/[0.14] rounded-2xl p-6 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/40 flex flex-col"
            >
              {/* Rank */}
              <span className="absolute top-4 right-4 text-[10px] font-mono text-gray-700">
                #{s.rank}
              </span>

              {/* Icon + name */}
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200 overflow-hidden ${logoUrl ? "bg-white/5" : subnetAvatarColor(s.netuid)}`}>
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt={s.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-base font-bold text-white/90">
                      {s.name.replace(/[^a-zA-Z0-9]/g, "")[0]?.toUpperCase() ?? String(s.netuid)}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors leading-tight">
                      {s.name}
                    </h2>
                    <span className="text-[10px] font-mono text-gray-600 bg-white/5 px-1.5 py-0.5 rounded shrink-0">
                      SN{s.netuid}
                    </span>
                  </div>
                  <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border ${colors}`}>
                    {s.subnetType}
                  </span>
                </div>
              </div>

              {/* Blurb */}
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mb-3 flex-1">
                {s.blurb}
              </p>

              {/* Analogy */}
              <div className="bg-white/[0.03] rounded-lg px-3 py-2 mb-4">
                <p className="text-[11px] text-gray-500 leading-snug">
                  <span className="text-gray-700">Like: </span>{s.analogy}
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                {s.market_cap > 0 ? (
                  <div>
                    <span className="text-sm font-semibold text-white">{fmtMcap(s.market_cap)}</span>
                    <span className="text-[10px] text-gray-600 ml-1">mcap</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-700">{icon}</span>
                    <span className="text-[10px] text-gray-700">{s.subnetType}</span>
                  </div>
                )}
                <span className="text-[11px] text-gray-600 group-hover:text-emerald-500 transition-colors font-medium">
                  Read more →
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-600 py-12 text-sm">
          {query ? `No subnets match "${query}"` : "No subnets in this category yet."}
        </p>
      )}
    </div>
  );
}
