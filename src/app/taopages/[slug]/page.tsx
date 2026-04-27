import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  TAO_PAGES_SUBNETS,
  getTaoPageBySlug,
} from "@/lib/tao-pages-data";
import { computeLeaderboard } from "@/lib/signals";
import { getSubnetDescription } from "@/lib/subnet-plain-english";

export const revalidate = 3600; // ISR: refresh every hour

/** Pre-build all known TAO Page slugs at deploy time */
export function generateStaticParams() {
  return TAO_PAGES_SUBNETS.map((s) => ({ slug: s.slug }));
}

/** Per-page SEO metadata */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const subnet = getTaoPageBySlug(slug);
  if (!subnet) return {};

  const desc = getSubnetDescription(subnet.netuid);
  const title = `What is ${subnet.name}? | Bittensor SN${subnet.netuid} Explained — TAO Pages`;
  const description = `${desc.blurb} ${desc.analogy} Find out what ${subnet.name} does, what problem it solves, and how it compares to mainstream products.`;
  const url = `https://www.alphagap.io/taopages/${slug}`;

  return {
    title,
    description,
    keywords: subnet.keywords.join(", "),
    openGraph: {
      title,
      description,
      url,
      siteName: "AlphaGap TAO Pages",
      images: [{ url: "https://www.alphagap.io/api/og", width: 1200, height: 630 }],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["https://www.alphagap.io/api/og"],
    },
    alternates: { canonical: url },
  };
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtMcap(v: number): string {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}
function fmtPrice(v: number): string {
  if (!v) return "—";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}
function fmtScore(v: number): string {
  return Math.round(v).toString();
}
function scoreColor(s: number): string {
  return s >= 70 ? "#4ade80" : s >= 40 ? "#facc15" : "#f87171";
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
  AutoML: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  "Drug Discovery AI": "bg-rose-500/15 text-rose-300 border-rose-500/25",
  "3D Generative AI": "bg-violet-500/15 text-violet-300 border-violet-500/25",
};

function categoryBadge(cat: string): string {
  return CATEGORY_COLORS[cat] ?? "bg-gray-500/15 text-gray-300 border-gray-500/25";
}

// ── Score gauge (simple SVG arc) ──────────────────────────────────
function ScoreGauge({ score, label }: { score: number; label: string }) {
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const color = scoreColor(score);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="90" height="90" viewBox="0 0 90 90">
        {/* Track */}
        <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        {/* Progress */}
        <circle
          cx="45"
          cy="45"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
        />
        {/* Score text */}
        <text
          x="45"
          y="49"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize="18"
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
        >
          {fmtScore(score)}
        </text>
      </svg>
      <span className="text-[11px] text-gray-500 text-center leading-tight">{label}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────
export default async function TaoPageDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const subnet = getTaoPageBySlug(slug);
  if (!subnet) notFound();

  // Fetch live data
  const leaderboard = computeLeaderboard();
  const live = leaderboard.find((s) => s.netuid === subnet.netuid);

  const mcap = live?.market_cap ?? 0;
  const price = live?.alpha_price ?? 0;
  const compositeScore = live?.composite_score ?? 0;
  const flowScore = live?.flow_score ?? 0;
  const devScore = live?.dev_score ?? 0;
  const socialScore = live?.social_score ?? 0;
  const emissionPct = live?.emission_pct ?? 0;

  // Get plain-English blurb
  const desc = getSubnetDescription(subnet.netuid);

  // Rank among all subnets by market cap
  const sortedByMcap = [...leaderboard]
    .filter((s) => (s.market_cap ?? 0) > 0)
    .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0));
  const mcapRank = sortedByMcap.findIndex((s) => s.netuid === subnet.netuid) + 1;

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh" }} className="text-gray-100">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            href="/taopages"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            ← TAO Pages
          </Link>
          <Link
            href="https://www.alphagap.io"
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/alphagap_icon.svg" alt="AlphaGap" width={18} height={18} className="opacity-50" />
            AlphaGap
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="mb-12">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs font-mono text-gray-600 bg-white/5 px-2 py-1 rounded">
              SN{subnet.netuid}
            </span>
            <span
              className={`inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${categoryBadge(subnet.category)}`}
            >
              {subnet.category}
            </span>
            {mcapRank > 0 && mcapRank <= 20 && (
              <span className="text-[11px] text-gray-500 bg-white/4 px-2.5 py-0.5 rounded-full border border-white/8">
                #{mcapRank} by market cap
              </span>
            )}
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 tracking-tight">
            {subnet.name}
          </h1>
          <p className="text-lg text-gray-400 leading-relaxed max-w-2xl">
            {subnet.tagline}
          </p>
        </section>

        {/* ── Two-column layout: content + sidebar ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left: content (2/3 width) */}
          <div className="lg:col-span-2 space-y-8">

            {/* In plain English */}
            <section className="rounded-xl border border-white/8 bg-white/3 p-6">
              <h2 className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-4">
                In Plain English
              </h2>
              <p className="text-gray-200 text-base leading-relaxed mb-4">
                {desc.blurb}
              </p>
              {/* Analogy */}
              <div className="flex items-start gap-3 bg-emerald-500/6 border border-emerald-500/15 rounded-lg px-4 py-3">
                <span className="text-emerald-400 text-lg mt-0.5">💡</span>
                <p className="text-sm text-gray-300 leading-relaxed">
                  <span className="font-semibold text-emerald-400">Think of it like: </span>
                  {desc.analogy}
                </p>
              </div>
            </section>

            {/* The Problem */}
            <section className="rounded-xl border border-white/8 bg-white/3 p-6">
              <h2 className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-4">
                The Problem It Solves
              </h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                {subnet.problem}
              </p>
            </section>

            {/* Think of it like (mainstream comparison) */}
            <section className="rounded-xl border border-white/8 bg-white/3 p-6">
              <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-4">
                The Closest Mainstream Equivalent
              </h2>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400 text-sm font-bold shrink-0">
                  ≈
                </div>
                <p className="text-white font-semibold">{subnet.mainstream}</p>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                {subnet.differentiator}
              </p>
            </section>

            {/* What makes it different */}
            <section className="rounded-xl border border-white/8 bg-white/3 p-6">
              <h2 className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-4">
                Why It&apos;s Built on Bittensor
              </h2>
              <p className="text-gray-300 text-sm leading-relaxed mb-4">
                {subnet.name} uses Bittensor&apos;s incentive layer — a system where
                participants (called miners) compete to produce the best outputs, and are
                paid in proportion to how good their results are. This creates continuous
                competitive pressure that improves quality and drives down cost without
                requiring a central company to manage it.
              </p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Every subnet on Bittensor is essentially a competitive market for a
                specific type of work. {subnet.name} applies this model to{" "}
                {subnet.category.toLowerCase()} — meaning the network self-optimizes
                over time, with no single entity controlling the outcome.
              </p>
            </section>

            {/* Benchmark info if available */}
            {subnet.benchmarkLabel && (
              <section className="rounded-xl border border-white/8 bg-white/3 p-6">
                <h2 className="text-xs font-semibold text-cyan-400 uppercase tracking-widest mb-3">
                  How It&apos;s Measured
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-cyan-500">📊</span>
                  <p className="text-sm text-gray-300">
                    Performance is tracked using: <span className="text-cyan-300 font-medium">{subnet.benchmarkLabel}</span>
                  </p>
                </div>
              </section>
            )}

          </div>

          {/* Right: sidebar (1/3 width) */}
          <div className="space-y-5">

            {/* Key metrics card */}
            {(mcap > 0 || price > 0) && (
              <div className="rounded-xl border border-white/8 bg-white/3 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
                  Market Data
                </h3>
                <div className="space-y-3">
                  {mcap > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Market Cap</span>
                      <span className="text-sm font-semibold text-white">{fmtMcap(mcap)}</span>
                    </div>
                  )}
                  {price > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Token Price</span>
                      <span className="text-sm font-mono text-gray-200">{fmtPrice(price)}</span>
                    </div>
                  )}
                  {emissionPct > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Network Share</span>
                      <span className="text-sm font-mono text-gray-200">
                        {(emissionPct * 100).toFixed(2)}%
                      </span>
                    </div>
                  )}
                  {mcapRank > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Mcap Rank</span>
                      <span className="text-sm text-gray-200">#{mcapRank}</span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-gray-700 mt-4 leading-relaxed">
                  Data updates hourly. Not financial advice.
                </p>
              </div>
            )}

            {/* AlphaGap score card */}
            {compositeScore > 0 && (
              <div className="rounded-xl border border-white/8 bg-white/3 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
                  AlphaGap Score
                </h3>
                <p className="text-[10px] text-gray-700 mb-5 leading-relaxed">
                  A composite intelligence score based on development activity, token flow,
                  community signals, and on-chain data.
                </p>
                <div className="flex items-center justify-around mb-4">
                  <ScoreGauge score={compositeScore} label="Overall" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded-lg bg-white/3">
                    <div className="text-sm font-bold" style={{ color: scoreColor(flowScore) }}>
                      {fmtScore(flowScore)}
                    </div>
                    <div className="text-[10px] text-gray-600">Flow</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/3">
                    <div className="text-sm font-bold" style={{ color: scoreColor(devScore) }}>
                      {fmtScore(devScore)}
                    </div>
                    <div className="text-[10px] text-gray-600">Dev</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/3">
                    <div className="text-sm font-bold" style={{ color: scoreColor(socialScore) }}>
                      {fmtScore(socialScore)}
                    </div>
                    <div className="text-[10px] text-gray-600">Social</div>
                  </div>
                </div>
              </div>
            )}

            {/* Want deeper intel CTA */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <h3 className="text-sm font-semibold text-emerald-300 mb-2">
                Want deeper intel on {subnet.name}?
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                AlphaGap tracks signals, whale flows, developer activity, and aGap score
                trends across all Bittensor subnets in real time.
              </p>
              <a
                href="https://www.alphagap.io"
                className="block text-center text-xs font-semibold text-emerald-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg px-4 py-2.5 transition-colors"
              >
                Explore AlphaGap →
              </a>
            </div>

            {/* Related TAO Pages */}
            <div className="rounded-xl border border-white/8 bg-white/3 p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                More TAO Pages
              </h3>
              <ul className="space-y-2">
                {TAO_PAGES_SUBNETS.filter((s) => s.slug !== slug)
                  .slice(0, 5)
                  .map((s) => (
                    <li key={s.netuid}>
                      <Link
                        href={`/taopages/${s.slug}`}
                        className="flex items-center justify-between text-xs text-gray-500 hover:text-gray-200 transition-colors py-0.5"
                      >
                        <span>{s.name}</span>
                        <span className="text-gray-700 font-mono text-[10px]">SN{s.netuid}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
              <Link
                href="/taopages"
                className="block text-center text-[11px] text-emerald-600 hover:text-emerald-400 transition-colors mt-4"
              >
                View all subnets →
              </Link>
            </div>

          </div>
        </div>

        {/* ── Bottom FAQ for SEO ───────────────────────────────── */}
        <section className="mt-14 border-t border-white/5 pt-10">
          <h2 className="text-xl font-bold text-white mb-6">
            Frequently Asked Questions about {subnet.name}
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-200 mb-2">
                What is {subnet.name} on Bittensor?
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {subnet.name} is Subnet {subnet.netuid} on the Bittensor network — a decentralized
                AI protocol built on top of the TAO blockchain. {desc.blurb}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-200 mb-2">
                What problem does {subnet.name} solve?
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">{subnet.problem}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-200 mb-2">
                How is {subnet.name} different from {subnet.mainstream}?
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">{subnet.differentiator}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-200 mb-2">
                What is the {subnet.name} token ticker?
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                The {subnet.name} subnet token is an alpha token on Bittensor&apos;s dTAO system.
                It trades on the Bittensor liquidity pool and its price reflects the market&apos;s
                assessment of the subnet&apos;s value within the network.{" "}
                {price > 0 && `The current token price is approximately ${fmtPrice(price)}.`}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10 mt-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/alphagap_icon.svg" alt="AlphaGap" width={20} height={20} className="opacity-60" />
            <span className="text-xs text-gray-600">
              TAO Pages by{" "}
              <a
                href="https://www.alphagap.io"
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                AlphaGap
              </a>
            </span>
          </div>
          <p className="text-xs text-gray-700 text-center sm:text-right max-w-sm">
            This page is for informational purposes only and does not constitute financial advice.
            AlphaGap is not affiliated with {subnet.name} or its team.
          </p>
        </div>
      </footer>
    </div>
  );
}
