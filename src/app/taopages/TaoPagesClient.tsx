"use client";

import { useState } from "react";
import Link from "next/link";
import type { SubnetType } from "@/lib/tao-pages-data";

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
}

const ALL_TYPES: SubnetType[] = [
  "Inference",
  "Training",
  "Compute",
  "Storage",
  "Finance",
  "Science",
  "Creative",
  "Tools",
];

const TYPE_ICONS: Record<SubnetType, string> = {
  Inference: "⚡",
  Training: "🧠",
  Compute: "🖥",
  Storage: "☁️",
  Finance: "📈",
  Science: "🔬",
  Creative: "🎨",
  Tools: "🔧",
};

const TYPE_COLORS: Record<SubnetType, string> = {
  Inference: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  Training:  "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  Compute:   "bg-orange-500/15 text-orange-300 border-orange-500/25",
  Storage:   "bg-teal-500/15 text-teal-300 border-teal-500/25",
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

  const filtered = active ? subnets.filter((s) => s.subnetType === active) : subnets;

  // Counts per type for badges
  const counts = Object.fromEntries(
    ALL_TYPES.map((t) => [t, subnets.filter((s) => s.subnetType === t).length])
  ) as Record<SubnetType, number>;

  return (
    <div>
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
                <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform duration-200">
                  {icon}
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
                ) : <div />}
                <span className="text-[11px] text-gray-600 group-hover:text-emerald-500 transition-colors font-medium">
                  Read more →
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-600 py-12 text-sm">No subnets in this category yet.</p>
      )}
    </div>
  );
}
