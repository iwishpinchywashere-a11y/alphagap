import type { Metadata } from "next";
import Link from "next/link";
import { TAO_PAGES_SUBNETS } from "@/lib/tao-pages-data";
import { computeLeaderboard } from "@/lib/signals";
import { getSubnetDescription } from "@/lib/subnet-plain-english";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "TAO Pages — The Bittensor Subnet Directory | AlphaGap",
  description:
    "Plain-English explanations for every major Bittensor subnet. What each subnet does, what problem it solves, and how it compares to mainstream products — no jargon required.",
  openGraph: {
    title: "TAO Pages — The Bittensor Subnet Directory",
    description: "Plain-English explanations for every major Bittensor subnet. No jargon. No crypto experience required.",
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

const CATEGORY_COLORS: Record<string, { pill: string; glow: string; border: string; iconBg: string }> = {
  "AI Infrastructure":   { pill: "bg-blue-500/15 text-blue-300",    glow: "group-hover:shadow-blue-500/15",    border: "group-hover:border-blue-500/30",    iconBg: "bg-blue-500/10" },
  "Privacy AI":          { pill: "bg-purple-500/15 text-purple-300", glow: "group-hover:shadow-purple-500/15",  border: "group-hover:border-purple-500/30",  iconBg: "bg-purple-500/10" },
  "AI Model Evaluation": { pill: "bg-cyan-500/15 text-cyan-300",     glow: "group-hover:shadow-cyan-500/15",    border: "group-hover:border-cyan-500/30",    iconBg: "bg-cyan-500/10" },
  "GPU Compute":         { pill: "bg-orange-500/15 text-orange-300", glow: "group-hover:shadow-orange-500/15",  border: "group-hover:border-orange-500/30",  iconBg: "bg-orange-500/10" },
  "Prop Trading":        { pill: "bg-yellow-500/15 text-yellow-300", glow: "group-hover:shadow-yellow-500/15",  border: "group-hover:border-yellow-500/30",  iconBg: "bg-yellow-500/10" },
  "AI Dev Tools":        { pill: "bg-green-500/15 text-green-300",   glow: "group-hover:shadow-green-500/15",   border: "group-hover:border-green-500/30",   iconBg: "bg-green-500/10" },
  "Computer Vision":     { pill: "bg-pink-500/15 text-pink-300",     glow: "group-hover:shadow-pink-500/15",    border: "group-hover:border-pink-500/30",    iconBg: "bg-pink-500/10" },
  "AI Model Training":   { pill: "bg-indigo-500/15 text-indigo-300", glow: "group-hover:shadow-indigo-500/15",  border: "group-hover:border-indigo-500/30",  iconBg: "bg-indigo-500/10" },
  "Decentralized Cloud": { pill: "bg-teal-500/15 text-teal-300",     glow: "group-hover:shadow-teal-500/15",    border: "group-hover:border-teal-500/30",    iconBg: "bg-teal-500/10" },
  "AutoML":              { pill: "bg-emerald-500/15 text-emerald-300", glow: "group-hover:shadow-emerald-500/15", border: "group-hover:border-emerald-500/30", iconBg: "bg-emerald-500/10" },
  "Drug Discovery AI":   { pill: "bg-rose-500/15 text-rose-300",     glow: "group-hover:shadow-rose-500/15",    border: "group-hover:border-rose-500/30",    iconBg: "bg-rose-500/10" },
  "3D Generative AI":    { pill: "bg-violet-500/15 text-violet-300", glow: "group-hover:shadow-violet-500/15",  border: "group-hover:border-violet-500/30",  iconBg: "bg-violet-500/10" },
};

const DEFAULT_COLORS = { pill: "bg-gray-500/15 text-gray-300", glow: "group-hover:shadow-gray-500/15", border: "group-hover:border-gray-500/30", iconBg: "bg-gray-500/10" };

// Category icons
const CATEGORY_ICONS: Record<string, string> = {
  "AI Infrastructure": "⚡",
  "Privacy AI": "🔐",
  "AI Model Evaluation": "🔬",
  "GPU Compute": "🖥",
  "Prop Trading": "📈",
  "AI Dev Tools": "🤖",
  "Computer Vision": "👁",
  "AI Model Training": "🧠",
  "Decentralized Cloud": "☁️",
  "AutoML": "⚙️",
  "Drug Discovery AI": "💊",
  "3D Generative AI": "🎨",
};

export default function TaoPagesIndex() {
  const leaderboard = computeLeaderboard();
  const scoreMap = new Map(leaderboard.map((s) => [s.netuid, s]));

  const subnets = TAO_PAGES_SUBNETS.map((s) => {
    const live = scoreMap.get(s.netuid);
    return { ...s, market_cap: live?.market_cap ?? 0, composite_score: live?.composite_score ?? 0 };
  }).sort((a, b) => b.market_cap - a.market_cap);

  const totalMcap = subnets.reduce((sum, s) => sum + s.market_cap, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="https://www.alphagap.io" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-10 w-auto" />
          </Link>
          <Link
            href="https://www.alphagap.io/subscribe"
            className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-semibold rounded-lg hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/20 text-sm"
          >
            Get Access →
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative pt-36 pb-20 px-6">
        {/* Background grid */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(34,197,94,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.3) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-green-500/5 rounded-full blur-[120px]" />
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-emerald-500/3 rounded-full blur-[80px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Top badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-green-500/30 bg-green-500/8 text-green-400 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Bittensor Subnet Directory
          </div>

          {/* Bittensor icon */}
          <div className="flex justify-center mb-6">
            <svg viewBox="0 0 21.6 23.1" className="w-10 h-10" fill="currentColor">
              <path className="text-green-400" d="M13.1,17.7V8.3c0-2.4-1.9-4.3-4.3-4.3v15.1c0,2.2,1.7,4,3.9,4c0.1,0,0.1,0,0.2,0c1,0.1,2.1-0.2,2.9-0.9C13.3,22,13.1,20.5,13.1,17.7L13.1,17.7z"/>
              <path className="text-green-400" d="M3.9,0C1.8,0,0,1.8,0,4h17.6c2.2,0,3.9-1.8,3.9-4C21.6,0,3.9,0,3.9,0z"/>
            </svg>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            TAO Pages
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">
              Subnet Directory
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-8 leading-relaxed">
            The yellow pages for the Bittensor network. Plain-English explanations
            for every major subnet — what it does, the problem it solves, and
            <span className="text-green-400 font-medium"> what mainstream product it most resembles</span>.
          </p>
          <p className="text-sm text-gray-600 mb-12">No crypto jargon. No AI PhD required. Just honest answers.</p>

          {/* Stats row */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-center">
            {[
              { value: `${subnets.length}`, label: "Subnets Explained" },
              { value: fmtMcap(totalMcap), label: "Combined Market Cap" },
              { value: "100%", label: "Free to Read" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl sm:text-3xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-gray-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What are TAO Pages? ──────────────────────────────────── */}
      <section className="py-16 px-6 bg-white/[0.01]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            Why most people <span className="text-gray-500">don&apos;t understand</span> Bittensor
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-12 leading-relaxed">
            Bittensor has over 120 active subnets, each solving a different problem using decentralized AI.
            But the descriptions are technical, the whitepapers are dense, and the jargon is impenetrable.
            TAO Pages fixes that.
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: "🔬", title: "Too technical", desc: "Subnet descriptions assume PhD-level knowledge. Most investors have no idea what they're actually backing." },
              { icon: "🌐", title: "No clear comparison", desc: "Without a mainstream reference point, it's impossible to evaluate whether a subnet is doing something valuable." },
              { icon: "💡", title: "TAO Pages bridges the gap", desc: "One clear page per subnet. What it does, what problem it solves, and what company it most resembles." },
            ].map((c) => (
              <div key={c.title} className="bg-white/[0.03] border border-white/5 rounded-xl p-6 hover:border-green-500/20 transition-colors">
                <div className="text-3xl mb-4">{c.icon}</div>
                <h3 className="font-bold text-lg mb-2">{c.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Subnet grid ──────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3">
            Explore the <span className="text-green-400">Top Subnets</span>
          </h2>
          <p className="text-gray-500 text-center text-sm mb-12">Sorted by market cap. Click any subnet to read its full TAO Page.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subnets.map((s, idx) => {
              const desc = getSubnetDescription(s.netuid);
              const colors = CATEGORY_COLORS[s.category] ?? DEFAULT_COLORS;
              const icon = CATEGORY_ICONS[s.category] ?? "🔷";
              return (
                <Link
                  key={s.netuid}
                  href={`/taopages/${s.slug}`}
                  className={`group relative bg-[#0d0d14] border border-white/[0.06] rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${colors.glow} ${colors.border}`}
                >
                  {/* Rank badge */}
                  <div className="absolute top-4 right-4 text-xs font-mono text-gray-700">
                    #{idx + 1}
                  </div>

                  {/* Icon + name row */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-xl ${colors.iconBg} flex items-center justify-center text-2xl shrink-0 transition-transform duration-300 group-hover:scale-110`}>
                      {icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-base font-bold text-white group-hover:text-green-300 transition-colors">
                          {s.name}
                        </h2>
                        <span className="text-[10px] font-mono text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">
                          SN{s.netuid}
                        </span>
                      </div>
                      <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${colors.pill}`}>
                        {s.category}
                      </span>
                    </div>
                  </div>

                  {/* Blurb */}
                  <p className="text-sm text-gray-400 leading-relaxed line-clamp-2 mb-4">
                    {desc.blurb}
                  </p>

                  {/* Analogy */}
                  <div className="bg-white/[0.03] rounded-lg px-3 py-2 mb-4">
                    <p className="text-xs text-gray-500 leading-relaxed">
                      <span className="text-gray-600">Like: </span>{desc.analogy}
                    </p>
                  </div>

                  {/* Footer row: market cap + arrow */}
                  <div className="flex items-center justify-between">
                    {s.market_cap > 0 ? (
                      <div>
                        <div className="text-sm font-semibold text-white">{fmtMcap(s.market_cap)}</div>
                        <div className="text-[10px] text-gray-600">market cap</div>
                      </div>
                    ) : <div />}
                    <span className="text-xs text-green-600 group-hover:text-green-400 transition-colors font-medium">
                      Read more →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white/[0.01]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Want deeper intelligence
            <br />
            <span className="text-green-400">on every subnet?</span>
          </h2>
          <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
            AlphaGap tracks aGap scores, whale flows, developer activity, and signals
            across all 120+ Bittensor subnets in real time. Find the alpha gap before
            everyone else.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="https://www.alphagap.io/powerrankings"
              className="inline-flex px-10 py-5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl hover:from-green-400 hover:to-emerald-500 transition-all shadow-2xl shadow-green-500/30 text-xl"
            >
              Start for Free →
            </Link>
            <Link
              href="https://www.alphagap.io/subscribe"
              className="inline-flex px-8 py-5 border border-green-500/30 text-green-400 hover:border-green-500/60 transition-all rounded-xl text-lg font-medium"
            >
              Explore Premium
            </Link>
          </div>
          <p className="text-xs text-gray-600 mt-4">Free preview · Pro from $29/mo · Premium from $49/mo</p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="py-8 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-[10px] font-bold text-black">α</div>
            TAO Pages by AlphaGap — Bittensor Subnet Intelligence
          </div>
          <p className="text-xs text-gray-700 text-center sm:text-right max-w-sm">
            Market data updates hourly. Not financial advice. Not affiliated with any listed subnet.
          </p>
        </div>
      </footer>
    </div>
  );
}
