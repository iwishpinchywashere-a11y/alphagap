import type { Metadata } from "next";
import Link from "next/link";
import { getAllSubnetRows } from "@/lib/tao-pages-slugs";
import { computeLeaderboard } from "@/lib/signals";
import { getSubnetDescription } from "@/lib/subnet-plain-english";
import { SUBNET_LOGOS } from "@/lib/subnet-logos";
import TaoPagesClient from "./TaoPagesClient";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "TAO Pages — The Bittensor Subnet Directory | AlphaGap",
  description:
    "Plain-English explanations for every Bittensor subnet. What each subnet does, the problem it solves, and how it compares to mainstream products — no jargon required.",
  openGraph: {
    title: "TAO Pages — The Bittensor Subnet Directory",
    description: "Plain-English explanations for every Bittensor subnet. No jargon. No crypto experience required.",
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

export default function TaoPagesIndex() {
  const leaderboard = computeLeaderboard();
  const scoreMap = new Map(leaderboard.map((s) => [s.netuid, s]));

  const allRows = getAllSubnetRows();

  // Build subnet cards: merge DB rows with live scores, blurbs, and logos
  const subnets = allRows
    .map((s) => {
      const live = scoreMap.get(s.netuid);
      const desc = getSubnetDescription(s.netuid, s.subnetType);
      return {
        netuid: s.netuid,
        slug: s.slug,
        name: s.name,
        category: s.subnetType,
        subnetType: s.subnetType,
        blurb: desc.blurb,
        analogy: desc.analogy,
        market_cap: live?.market_cap ?? 0,
        composite_score: live?.composite_score ?? 0,
        rank: 0,
        logoUrl: SUBNET_LOGOS[s.netuid] ?? undefined,
      };
    })
    .sort((a, b) => b.market_cap - a.market_cap)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/90 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="https://www.alphagap.io">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-9 w-auto" />
            </Link>
            <span className="text-gray-700">/</span>
            <span className="text-sm text-gray-400 font-medium">TAO Pages</span>
          </div>
          <Link
            href="https://www.alphagap.io"
            className="text-xs text-gray-600 hover:text-gray-300 transition-colors hidden sm:block"
          >
            alphagap.io →
          </Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <svg viewBox="0 0 21.6 23.1" className="w-6 h-6 shrink-0" fill="currentColor">
              <path className="text-green-400" d="M13.1,17.7V8.3c0-2.4-1.9-4.3-4.3-4.3v15.1c0,2.2,1.7,4,3.9,4c0.1,0,0.1,0,0.2,0c1,0.1,2.1-0.2,2.9-0.9C13.3,22,13.1,20.5,13.1,17.7L13.1,17.7z"/>
              <path className="text-green-400" d="M3.9,0C1.8,0,0,1.8,0,4h17.6c2.2,0,3.9-1.8,3.9-4C21.6,0,3.9,0,3.9,0z"/>
            </svg>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">TAO Pages</h1>
          </div>
          <p className="text-gray-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            The yellow pages for the Bittensor network. Plain-English explanations for every
            subnet — what it does, the problem it solves, and what mainstream product
            it most resembles. No jargon required.
          </p>
        </div>

        {/* ── Filterable directory (client component) ─────────────── */}
        <TaoPagesClient subnets={subnets} />
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-gray-600 text-xs">
            <div className="w-4 h-4 rounded bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-[8px] font-bold text-black">α</div>
            TAO Pages by <a href="https://www.alphagap.io" className="hover:text-gray-400 transition-colors ml-1">AlphaGap</a>
          </div>
          <p className="text-xs text-gray-700">
            Market data updates hourly · Not financial advice · Not affiliated with any listed subnet
          </p>
        </div>
      </footer>
    </div>
  );
}
