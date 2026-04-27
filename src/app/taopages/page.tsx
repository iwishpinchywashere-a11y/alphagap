import type { Metadata } from "next";
import Link from "next/link";
import { TAO_PAGES_SUBNETS } from "@/lib/tao-pages-data";
import { computeLeaderboard } from "@/lib/signals";
import { getSubnetDescription } from "@/lib/subnet-plain-english";

export const revalidate = 3600; // Refresh every hour

export const metadata: Metadata = {
  title: "TAO Pages — The Bittensor Subnet Directory | AlphaGap",
  description:
    "Plain-English explanations for every major Bittensor subnet. Understand what each subnet does, what problem it solves, and how it compares to mainstream products — no jargon required.",
  openGraph: {
    title: "TAO Pages — The Bittensor Subnet Directory",
    description:
      "Plain-English explanations for every major Bittensor subnet. No jargon. No crypto experience required.",
    url: "https://www.alphagap.io/taopages",
    siteName: "AlphaGap",
    images: [{ url: "https://www.alphagap.io/api/og", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TAO Pages — The Bittensor Subnet Directory",
    description: "What is every Bittensor subnet, in plain English?",
    images: ["https://www.alphagap.io/api/og"],
  },
};

function fmtMcap(v: number): string {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}

const CATEGORY_COLORS: Record<string, string> = {
  "AI Infrastructure": "bg-blue-500/15 text-blue-300 border-blue-500/25",
  "Privacy AI": "bg-purple-500/15 text-purple-300 border-purple-500/25",
  "AI Model Evaluation": "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  "GPU Compute": "bg-orange-500/15 text-orange-300 border-orange-500/25",
  "Prop Trading": "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
  "AI Dev Tools": "bg-green-500/15 text-green-300 border-green-500/25",
  "Computer Vision": "bg-pink-500/15 text-pink-300 border-pink-500/25",
  "AI Model Training": "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  "Decentralized Cloud": "bg-teal-500/15 text-teal-300 border-teal-500/25",
  "AutoML": "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  "Drug Discovery AI": "bg-rose-500/15 text-rose-300 border-rose-500/25",
  "3D Generative AI": "bg-violet-500/15 text-violet-300 border-violet-500/25",
};

function categoryBadge(cat: string): string {
  return CATEGORY_COLORS[cat] ?? "bg-gray-500/15 text-gray-300 border-gray-500/25";
}

export default function TaoPagesIndex() {
  const leaderboard = computeLeaderboard();

  // Build a quick lookup: netuid → score row
  const scoreMap = new Map(leaderboard.map((s) => [s.netuid, s]));

  // Attach live metrics to each subnet, sort by market cap desc
  const subnets = TAO_PAGES_SUBNETS.map((s) => {
    const live = scoreMap.get(s.netuid);
    return {
      ...s,
      market_cap: live?.market_cap ?? 0,
      composite_score: live?.composite_score ?? 0,
      alpha_price: live?.alpha_price ?? 0,
    };
  }).sort((a, b) => b.market_cap - a.market_cap);

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh" }} className="text-gray-100">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            href="https://www.alphagap.io"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/alphagap_icon.svg" alt="AlphaGap" width={24} height={24} />
            <span className="font-medium">AlphaGap</span>
          </Link>
          <span className="text-xs text-gray-600 font-mono">TAO Pages</span>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-12">
        <div className="max-w-2xl">
          {/* Top badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/8 text-emerald-400 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Bittensor Subnet Directory
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">
            TAO Pages
          </h1>
          <p className="text-lg text-gray-400 leading-relaxed mb-3">
            The yellow pages for the Bittensor network. Plain-English explanations
            for every major subnet — what it does, what problem it solves, and what
            mainstream product it most resembles.
          </p>
          <p className="text-sm text-gray-600">
            No crypto jargon. No AI PhD required. Just honest answers.
          </p>
        </div>
      </section>

      {/* ── Subnet grid ────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subnets.map((s) => {
            const desc = getSubnetDescription(s.netuid);
            return (
              <Link
                key={s.netuid}
                href={`/taopages/${s.slug}`}
                className="group block rounded-xl border border-white/8 bg-white/3 hover:bg-white/5 hover:border-emerald-500/30 transition-all duration-200 p-5"
              >
                {/* Subnet name row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-base font-semibold text-white group-hover:text-emerald-300 transition-colors">
                        {s.name}
                      </h2>
                      <span className="text-[10px] font-mono text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">
                        SN{s.netuid}
                      </span>
                    </div>
                    <span
                      className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border ${categoryBadge(s.category)}`}
                    >
                      {s.category}
                    </span>
                  </div>
                  {s.market_cap > 0 && (
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold text-white">{fmtMcap(s.market_cap)}</div>
                      <div className="text-[10px] text-gray-600">market cap</div>
                    </div>
                  )}
                </div>

                {/* Blurb */}
                <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mb-3">
                  {desc.blurb}
                </p>

                {/* Analogy pill */}
                <div className="flex items-start gap-1.5">
                  <span className="text-[10px] text-gray-600 shrink-0 mt-0.5">Like:</span>
                  <span className="text-[10px] text-gray-500 leading-relaxed">{desc.analogy}</span>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-end mt-3">
                  <span className="text-[11px] text-emerald-600 group-hover:text-emerald-400 transition-colors font-medium">
                    Learn more →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/alphagap_icon.svg" alt="AlphaGap" width={20} height={20} className="opacity-60" />
            <span className="text-xs text-gray-600">
              TAO Pages by{" "}
              <a href="https://www.alphagap.io" className="text-gray-500 hover:text-gray-300 transition-colors">
                AlphaGap
              </a>
            </span>
          </div>
          <p className="text-xs text-gray-700 text-center sm:text-right max-w-sm">
            Market data updates hourly. AlphaGap is not affiliated with any subnet listed here.
            This page is for informational purposes only.
          </p>
        </div>
      </footer>
    </div>
  );
}
