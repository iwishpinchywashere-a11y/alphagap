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

      {/* ── Directory list ───────────────────────────────────────── */}
      <div className="divide-y divide-white/[0.05]">
        {filtered.map((s) => (
          <Link
            key={s.netuid}
            href={`/taopages/${s.slug}`}
            className="group flex items-start gap-4 py-4 px-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-colors"
          >
            {/* Rank */}
            <span className="shrink-0 w-7 text-right text-xs font-mono text-gray-700 mt-1">
              {s.rank}
            </span>

            {/* Type icon */}
            <span className="shrink-0 text-xl mt-0.5">{TYPE_ICONS[s.subnetType]}</span>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-semibold text-white group-hover:text-emerald-300 transition-colors text-sm sm:text-base">
                  {s.name}
                </span>
                <span className="text-[10px] font-mono text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">
                  SN{s.netuid}
                </span>
                <span className={`hidden sm:inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border ${TYPE_COLORS[s.subnetType]}`}>
                  {s.subnetType}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed line-clamp-1 sm:line-clamp-none">
                {s.blurb}
              </p>
              <p className="hidden sm:block text-xs text-gray-600 mt-0.5 italic">
                {s.analogy}
              </p>
            </div>

            {/* Market cap */}
            <div className="shrink-0 text-right hidden sm:block">
              <div className="text-sm font-semibold text-white">{fmtMcap(s.market_cap)}</div>
              <div className="text-[10px] text-gray-600">mcap</div>
            </div>

            {/* Arrow */}
            <span className="shrink-0 text-gray-700 group-hover:text-emerald-500 transition-colors text-sm mt-1">→</span>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-600 py-12 text-sm">No subnets in this category yet.</p>
      )}
    </div>
  );
}
