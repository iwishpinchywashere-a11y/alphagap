import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTaoPageBySlug } from "@/lib/tao-pages-data";
import { getAllSubnetRows, findBySlug, getSubnetDbInfo } from "@/lib/tao-pages-slugs";
import { computeLeaderboard } from "@/lib/signals";
import { getSubnetDescription } from "@/lib/subnet-plain-english";
import { SUBNET_LOGOS } from "@/lib/subnet-logos";

export const revalidate = 3600;

export function generateStaticParams() {
  const rows = getAllSubnetRows();
  return rows.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const row = findBySlug(slug);
  if (!row) return {};

  const richData = getTaoPageBySlug(slug);
  const desc = getSubnetDescription(row.netuid, row.subnetType);

  const name = row.name;
  const title = `What is ${name}? | Bittensor SN${row.netuid} Explained — TAO Pages`;
  const description = `${desc.blurb} ${desc.analogy} Learn what ${name} does, what problem it solves, and how it compares to mainstream alternatives.`;
  const url = `https://www.alphagap.io/taopages/${slug}`;

  return {
    title,
    description,
    keywords: richData?.keywords?.join(", "),
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

function fmtMcap(v: number) {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}
function fmtPrice(v: number) {
  if (!v) return "—";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}
function scoreColor(s: number) {
  return s >= 70 ? "#4ade80" : s >= 40 ? "#facc15" : "#f87171";
}
function fmtScore(v: number) { return Math.round(v).toString(); }

const CATEGORY_COLORS: Record<string, { pill: string; glow: string; border: string; accent: string; iconBg: string }> = {
  "AI Infrastructure":   { pill: "bg-blue-500/15 text-blue-300",     glow: "shadow-blue-500/15",    border: "border-blue-500/20",    accent: "text-blue-400",    iconBg: "bg-blue-500/10" },
  "Privacy AI":          { pill: "bg-purple-500/15 text-purple-300", glow: "shadow-purple-500/15",  border: "border-purple-500/20",  accent: "text-purple-400",  iconBg: "bg-purple-500/10" },
  "AI Model Evaluation": { pill: "bg-cyan-500/15 text-cyan-300",     glow: "shadow-cyan-500/15",    border: "border-cyan-500/20",    accent: "text-cyan-400",    iconBg: "bg-cyan-500/10" },
  "GPU Compute":         { pill: "bg-orange-500/15 text-orange-300", glow: "shadow-orange-500/15",  border: "border-orange-500/20",  accent: "text-orange-400",  iconBg: "bg-orange-500/10" },
  "Prop Trading":        { pill: "bg-yellow-500/15 text-yellow-300", glow: "shadow-yellow-500/15",  border: "border-yellow-500/20",  accent: "text-yellow-400",  iconBg: "bg-yellow-500/10" },
  "AI Dev Tools":        { pill: "bg-green-500/15 text-green-300",   glow: "shadow-green-500/15",   border: "border-green-500/20",   accent: "text-green-400",   iconBg: "bg-green-500/10" },
  "Computer Vision":     { pill: "bg-pink-500/15 text-pink-300",     glow: "shadow-pink-500/15",    border: "border-pink-500/20",    accent: "text-pink-400",    iconBg: "bg-pink-500/10" },
  "AI Model Training":   { pill: "bg-indigo-500/15 text-indigo-300", glow: "shadow-indigo-500/15",  border: "border-indigo-500/20",  accent: "text-indigo-400",  iconBg: "bg-indigo-500/10" },
  "Decentralized Cloud": { pill: "bg-teal-500/15 text-teal-300",     glow: "shadow-teal-500/15",    border: "border-teal-500/20",    accent: "text-teal-400",    iconBg: "bg-teal-500/10" },
  "AutoML":              { pill: "bg-emerald-500/15 text-emerald-300", glow: "shadow-emerald-500/15", border: "border-emerald-500/20", accent: "text-emerald-400", iconBg: "bg-emerald-500/10" },
  "Drug Discovery AI":   { pill: "bg-rose-500/15 text-rose-300",     glow: "shadow-rose-500/15",    border: "border-rose-500/20",    accent: "text-rose-400",    iconBg: "bg-rose-500/10" },
  "3D Generative AI":    { pill: "bg-violet-500/15 text-violet-300", glow: "shadow-violet-500/15",  border: "border-violet-500/20",  accent: "text-violet-400",  iconBg: "bg-violet-500/10" },
};

const SUBNET_TYPE_COLORS: Record<string, { pill: string; glow: string; border: string; accent: string; iconBg: string }> = {
  Inference: { pill: "bg-blue-500/15 text-blue-300",     glow: "shadow-blue-500/15",    border: "border-blue-500/20",    accent: "text-blue-400",    iconBg: "bg-blue-500/10" },
  Training:  { pill: "bg-indigo-500/15 text-indigo-300", glow: "shadow-indigo-500/15",  border: "border-indigo-500/20",  accent: "text-indigo-400",  iconBg: "bg-indigo-500/10" },
  Compute:   { pill: "bg-orange-500/15 text-orange-300", glow: "shadow-orange-500/15",  border: "border-orange-500/20",  accent: "text-orange-400",  iconBg: "bg-orange-500/10" },
  Storage:   { pill: "bg-teal-500/15 text-teal-300",     glow: "shadow-teal-500/15",    border: "border-teal-500/20",    accent: "text-teal-400",    iconBg: "bg-teal-500/10" },
  Agents:    { pill: "bg-lime-500/15 text-lime-300",     glow: "shadow-lime-500/15",    border: "border-lime-500/20",    accent: "text-lime-400",    iconBg: "bg-lime-500/10" },
  Data:      { pill: "bg-sky-500/15 text-sky-300",       glow: "shadow-sky-500/15",     border: "border-sky-500/20",     accent: "text-sky-400",     iconBg: "bg-sky-500/10" },
  Finance:   { pill: "bg-yellow-500/15 text-yellow-300", glow: "shadow-yellow-500/15",  border: "border-yellow-500/20",  accent: "text-yellow-400",  iconBg: "bg-yellow-500/10" },
  Science:   { pill: "bg-rose-500/15 text-rose-300",     glow: "shadow-rose-500/15",    border: "border-rose-500/20",    accent: "text-rose-400",    iconBg: "bg-rose-500/10" },
  Creative:  { pill: "bg-violet-500/15 text-violet-300", glow: "shadow-violet-500/15",  border: "border-violet-500/20",  accent: "text-violet-400",  iconBg: "bg-violet-500/10" },
  Tools:     { pill: "bg-green-500/15 text-green-300",   glow: "shadow-green-500/15",   border: "border-green-500/20",   accent: "text-green-400",   iconBg: "bg-green-500/10" },
};

const DEFAULT_COLORS = { pill: "bg-gray-500/15 text-gray-300", glow: "shadow-gray-500/15", border: "border-gray-500/20", accent: "text-gray-400", iconBg: "bg-gray-500/10" };

const CATEGORY_ICONS: Record<string, string> = {
  "AI Infrastructure": "⚡", "Privacy AI": "🔐", "AI Model Evaluation": "🔬",
  "GPU Compute": "🖥", "Prop Trading": "📈", "AI Dev Tools": "🤖",
  "Computer Vision": "👁", "AI Model Training": "🧠", "Decentralized Cloud": "☁️",
  "AutoML": "⚙️", "Drug Discovery AI": "💊", "3D Generative AI": "🎨",
};

const SUBNET_TYPE_ICONS: Record<string, string> = {
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

// Simple SVG score ring
function ScoreRing({ score, size = 100 }: { score: number; size?: number }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(Math.max(score, 0), 100) / 100;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ * 0.25} strokeLinecap="round" />
      <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={size * 0.22} fontWeight="800" fontFamily="system-ui,sans-serif">
        {fmtScore(score)}
      </text>
    </svg>
  );
}

// ── Nav shared component ──────────────────────────────────────────

function PageNav({ name }: { name: string }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="https://www.alphagap.io" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-10 w-auto" />
          </Link>
          <span className="hidden sm:flex items-center gap-1.5 text-sm text-gray-600">
            <span>/</span>
            <Link href="/taopages" className="hover:text-gray-400 transition-colors">TAO Pages</Link>
            <span>/</span>
            <span className="text-gray-400">{name}</span>
          </span>
        </div>
        <Link
          href="https://www.alphagap.io/subscribe"
          className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-semibold rounded-lg hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/20 text-sm"
        >
          Get Access →
        </Link>
      </div>
    </nav>
  );
}

// ── Page footer shared component ──────────────────────────────────

function PageFooter({ name }: { name: string }) {
  return (
    <footer className="py-8 px-6 border-t border-white/5">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-[10px] font-bold text-black">α</div>
          TAO Pages by AlphaGap — Bittensor Subnet Intelligence
        </div>
        <p className="text-xs text-gray-700 text-center sm:text-right max-w-sm">
          Informational purposes only. Not financial advice. Not affiliated with {name} or its team.
        </p>
      </div>
    </footer>
  );
}

// ── Live metrics sidebar card ─────────────────────────────────────

function MetricsCard({
  compositeScore,
  flowScore,
  devScore,
  socialScore,
  mcap,
  price,
  emissionPct,
  colors,
}: {
  compositeScore: number;
  flowScore: number;
  devScore: number;
  socialScore: number;
  mcap: number;
  price: number;
  emissionPct: number;
  colors: { border: string; glow: string };
}) {
  if (mcap === 0 && compositeScore === 0) return null;
  return (
    <div className={`shrink-0 bg-[#0d0d14] border ${colors.border} rounded-2xl p-6 min-w-[220px] shadow-xl ${colors.glow}`}>
      {compositeScore > 0 && (
        <div className="flex flex-col items-center mb-4">
          <ScoreRing score={compositeScore} size={96} />
          <span className="text-xs text-gray-600 mt-1">aGap Score</span>
        </div>
      )}
      <div className="space-y-2.5">
        {mcap > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Market Cap</span>
            <span className="text-sm font-bold text-white">{fmtMcap(mcap)}</span>
          </div>
        )}
        {price > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Token Price</span>
            <span className="text-sm font-mono text-gray-200">{fmtPrice(price)}</span>
          </div>
        )}
        {emissionPct > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Network Share</span>
            <span className="text-sm font-mono text-gray-200">{(emissionPct * 100).toFixed(2)}%</span>
          </div>
        )}
        {compositeScore > 0 && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Flow Score</span>
              <span className="text-sm font-mono" style={{ color: scoreColor(flowScore) }}>{flowScore}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Dev Score</span>
              <span className="text-sm font-mono" style={{ color: scoreColor(devScore) }}>{devScore}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Social Score</span>
              <span className="text-sm font-mono" style={{ color: scoreColor(socialScore) }}>{socialScore}</span>
            </div>
          </>
        )}
      </div>
      <p className="text-[10px] text-gray-700 mt-3">Updates hourly · Not financial advice</p>
    </div>
  );
}

// ── CTA section ───────────────────────────────────────────────────

function CtaSection({ name }: { name: string }) {
  return (
    <section className="py-24 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-4xl sm:text-5xl font-bold mb-6">
          Want real-time intelligence
          <br />
          <span className="text-green-400">on {name}?</span>
        </h2>
        <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
          AlphaGap tracks signals, whale flows, developer commits, and the aGap score
          for every Bittensor subnet — updated continuously. Find the alpha gap before
          everyone else.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
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
        <p className="text-xs text-gray-600">Free preview · Pro from $29/mo · Premium from $49/mo</p>
      </div>
    </section>
  );
}

// ── How Bittensor makes it work section ──────────────────────────

function HowBittensorSection({ name, subnetType }: { name: string; subnetType: string }) {
  const categoryLabel = subnetType.toLowerCase();
  return (
    <section className="py-20 px-6 bg-white/[0.01]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
          How does <span className="text-green-400">Bittensor</span> make this possible?
        </h2>
        <p className="text-gray-400 text-center max-w-xl mx-auto mb-16">
          {name} uses Bittensor&apos;s incentive layer to build something no single company could run alone.
        </p>
        <div className="space-y-10">
          {[
            {
              step: "01",
              title: "Miners compete",
              desc: `Participants (called miners) on the ${name} subnet compete to produce the best outputs for ${categoryLabel} tasks. Anyone with the right hardware can join.`,
            },
            {
              step: "02",
              title: "Validators score the work",
              desc: `Validators continuously evaluate miner outputs against objective benchmarks. The best performers rise, the worst are replaced. There&apos;s no human committee — the protocol decides.`,
            },
            {
              step: "03",
              title: "Rewards flow to the best",
              desc: `Miners are paid in the ${name} alpha token in proportion to how good their work is. This creates a continuous competitive pressure that drives quality up and cost down — structurally, not just as a promise.`,
            },
            {
              step: "04",
              title: "The whole network benefits",
              desc: `Because every participant is aligned toward the same goal — producing the best ${categoryLabel} results — the network improves continuously without requiring a central team to manage it.`,
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 font-bold font-mono text-sm">
                {item.step}
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Related subnets section ───────────────────────────────────────

function RelatedSubnets({
  currentSlug,
  currentSubnetType,
}: {
  currentSlug: string;
  currentSubnetType: string;
}) {
  const allRows = getAllSubnetRows();
  // Prefer same type, then any, exclude self
  const sameType = allRows.filter(
    (r) => r.slug !== currentSlug && r.subnetType === currentSubnetType
  );
  const others = allRows.filter(
    (r) => r.slug !== currentSlug && r.subnetType !== currentSubnetType
  );
  const related = [...sameType, ...others].slice(0, 5);

  return (
    <section className="py-16 px-6 bg-white/[0.01] border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-8 text-center">More TAO Pages</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {related.map((s) => {
            const logoUrl = SUBNET_LOGOS[s.netuid];
            const icon = SUBNET_TYPE_ICONS[s.subnetType] ?? "🔷";
            const tc = SUBNET_TYPE_COLORS[s.subnetType] ?? DEFAULT_COLORS;
            return (
              <Link
                key={s.netuid}
                href={`/taopages/${s.slug}`}
                className={`group bg-[#0d0d14] border border-white/[0.06] hover:${tc.border} rounded-xl p-4 text-center transition-all hover:scale-[1.03]`}
              >
                <div className={`w-10 h-10 mx-auto rounded-xl ${tc.iconBg} flex items-center justify-center text-xl mb-2 group-hover:scale-110 transition-transform overflow-hidden`}>
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={s.name} className="w-full h-full object-contain rounded-xl" />
                  ) : (
                    <span>{icon}</span>
                  )}
                </div>
                <div className="text-sm font-semibold text-white group-hover:text-green-300 transition-colors">{s.name}</div>
                <div className="text-[10px] font-mono text-gray-700 mt-0.5">SN{s.netuid}</div>
              </Link>
            );
          })}
        </div>
        <div className="text-center mt-6">
          <Link href="/taopages" className="text-sm text-green-600 hover:text-green-400 transition-colors">
            ← View all subnets
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default async function TaoPageDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Look up the subnet row (works for ALL subnets)
  const row = findBySlug(slug);
  if (!row) notFound();

  const { netuid, name, subnetType } = row;

  // Rich data only exists for the 12 featured subnets
  const richData = getTaoPageBySlug(slug);

  // DB info (description, website, github, discord)
  const dbInfo = getSubnetDbInfo(netuid);

  // Live metrics
  const leaderboard = computeLeaderboard();
  const live = leaderboard.find((s) => s.netuid === netuid);

  const mcap = live?.market_cap ?? 0;
  const price = live?.alpha_price ?? 0;
  const compositeScore = live?.composite_score ?? 0;
  const flowScore = live?.flow_score ?? 0;
  const devScore = live?.dev_score ?? 0;
  const socialScore = live?.social_score ?? 0;
  const emissionPct = live?.emission_pct ?? 0;

  const desc = getSubnetDescription(netuid, richData?.category ?? subnetType);

  const logoUrl = SUBNET_LOGOS[netuid] ?? null;

  // Rank by market cap
  const sortedByMcap = [...leaderboard]
    .filter((s) => (s.market_cap ?? 0) > 0)
    .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0));
  const mcapRank = sortedByMcap.findIndex((s) => s.netuid === netuid) + 1;

  // Colors — prefer rich data category, fall back to subnet type
  const colors =
    (richData ? CATEGORY_COLORS[richData.category] : null) ??
    SUBNET_TYPE_COLORS[subnetType] ??
    DEFAULT_COLORS;

  const icon =
    (richData ? CATEGORY_ICONS[richData.category] : null) ??
    SUBNET_TYPE_ICONS[subnetType] ??
    "🔷";

  // ── RICH PAGE (featured subnets) ─────────────────────────────────
  if (richData) {
    // Same as original — full landing page
    const related = getAllSubnetRows()
      .filter((s) => s.slug !== slug)
      .slice(0, 5);

    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
        <PageNav name={name} />

        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="relative pt-36 pb-20 px-6">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 opacity-[0.025]" style={{
              backgroundImage: `linear-gradient(rgba(34,197,94,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.3) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }} />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-green-500/5 rounded-full blur-[120px]" />
          </div>

          <div className="relative max-w-5xl mx-auto">
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${colors.border} ${colors.pill}`}>
                <span className="text-base">{icon}</span> {richData.category}
              </span>
              <span className="text-xs font-mono text-gray-600 bg-white/5 px-2.5 py-1.5 rounded-full border border-white/8">
                SN{netuid}
              </span>
              {mcapRank > 0 && (
                <span className="text-xs text-gray-500 bg-white/[0.04] px-2.5 py-1.5 rounded-full border border-white/8">
                  #{mcapRank} by market cap
                </span>
              )}
            </div>

            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
              <div className="max-w-2xl">
                <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-5">
                  {name}
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300 text-4xl sm:text-5xl md:text-6xl">
                    {richData.tagline}
                  </span>
                </h1>
                <p className="text-lg text-gray-400 leading-relaxed max-w-xl">
                  {desc.blurb}
                </p>
              </div>

              <MetricsCard
                compositeScore={compositeScore}
                flowScore={flowScore}
                devScore={devScore}
                socialScore={socialScore}
                mcap={mcap}
                price={price}
                emissionPct={emissionPct}
                colors={colors}
              />
            </div>
          </div>
        </section>

        {/* ── The one-line analogy ──────────────────────────────── */}
        <section className="px-6 pb-16">
          <div className="max-w-5xl mx-auto">
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-2xl px-8 py-6 flex items-start gap-4">
              <span className="text-3xl shrink-0 mt-0.5">💡</span>
              <div>
                <p className="text-xs font-semibold text-green-500 uppercase tracking-widest mb-2">The simplest explanation</p>
                <p className="text-lg sm:text-xl text-white font-medium leading-relaxed">
                  {desc.analogy}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Three-column: Problem / What it does / Edge ────────── */}
        <section className="py-20 px-6 bg-white/[0.01]">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3">
              Everything you need to <span className="text-green-400">understand {name}</span>
            </h2>
            <p className="text-gray-500 text-center text-sm mb-12">No jargon. No whitepapers. Just the facts.</p>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 hover:border-amber-500/20 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-2xl mb-4">🎯</div>
                <h3 className="font-bold text-lg mb-3 text-amber-300">The Problem</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{richData.problem}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 hover:border-green-500/20 transition-colors">
                <div className={`w-12 h-12 rounded-xl ${colors.iconBg} flex items-center justify-center text-2xl mb-4`}>{icon}</div>
                <h3 className={`font-bold text-lg mb-3 ${colors.accent}`}>What {name} Does</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc.blurb}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 hover:border-blue-500/20 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-2xl mb-4">⚔️</div>
                <h3 className="font-bold text-lg mb-3 text-blue-300">The Edge</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{richData.differentiator}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Mainstream comparison ───────────────────────────── */}
        <section className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3">
              What&apos;s the closest <span className="text-green-400">mainstream equivalent?</span>
            </h2>
            <p className="text-gray-500 text-center text-sm mb-12">The best way to understand a new technology is to compare it to something familiar.</p>
            <div className="grid sm:grid-cols-3 gap-6 items-center mb-12">
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 text-center">
                <div className="text-4xl mb-3">🏢</div>
                <div className="text-xs text-gray-600 uppercase tracking-widest mb-2">Mainstream</div>
                <div className="text-lg font-bold text-white">{richData.mainstream}</div>
                <div className="mt-3 space-y-1.5 text-left">
                  {["Centralized & controlled", "Single company profit", "Terms can change anytime"].map((d) => (
                    <div key={d} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="text-red-500">✗</span> {d}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-xl font-bold">
                  VS
                </div>
              </div>
              <div className={`bg-[#0d0d14] border ${colors.border} rounded-xl p-6 text-center shadow-lg`}>
                <div className="text-4xl mb-3">{icon}</div>
                <div className="text-xs text-gray-600 uppercase tracking-widest mb-2">Bittensor</div>
                <div className={`text-lg font-bold ${colors.accent}`}>{name}</div>
                <div className="mt-3 space-y-1.5 text-left">
                  {["Decentralized & open", "Rewards flow to miners", "No single point of failure"].map((d) => (
                    <div key={d} className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="text-green-400">✓</span> {d}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-2xl mx-auto text-center">
              {richData.differentiator}
            </p>
          </div>
        </section>

        {/* ── How Bittensor makes it work ───────────────────────── */}
        <section className="py-20 px-6 bg-white/[0.01]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
              How does <span className="text-green-400">Bittensor</span> make this possible?
            </h2>
            <p className="text-gray-400 text-center max-w-xl mx-auto mb-16">
              {name} uses Bittensor&apos;s incentive layer to build something no single company could run alone.
            </p>
            <div className="space-y-10">
              {[
                {
                  step: "01",
                  title: "Miners compete",
                  desc: `Participants (called miners) on the ${name} subnet compete to produce the best outputs for ${richData.category.toLowerCase()} tasks. Anyone with the right hardware can join.`,
                },
                {
                  step: "02",
                  title: "Validators score the work",
                  desc: `Validators continuously evaluate miner outputs against objective benchmarks. ${richData.benchmarkLabel ? `For ${name}, this includes ${richData.benchmarkLabel}.` : "The best performers rise, the worst are replaced."} There's no human committee — the protocol decides.`,
                },
                {
                  step: "03",
                  title: "Rewards flow to the best",
                  desc: `Miners are paid in the ${name} alpha token in proportion to how good their work is. This creates a continuous competitive pressure that drives quality up and cost down — structurally, not just as a promise.`,
                },
                {
                  step: "04",
                  title: "The whole network benefits",
                  desc: `Because every participant is aligned toward the same goal — producing the best ${richData.category.toLowerCase()} results — the network improves continuously without requiring a central team to manage it.`,
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-6 items-start">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 font-bold font-mono text-sm">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                    <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── aGap Score breakdown ─────────────────────────────── */}
        {compositeScore > 0 && (
          <section className="py-20 px-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
                The <span className="text-green-400">aGap Score</span> for {name}
              </h2>
              <p className="text-gray-400 text-center max-w-xl mx-auto mb-12">
                AlphaGap&apos;s proprietary composite score — how undervalued is this subnet right now?
                High aGap = the team is shipping hard but the price hasn&apos;t caught up yet.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mb-8">
                {[
                  { label: "Overall", score: compositeScore, desc: "Composite intelligence score" },
                  { label: "Flow", score: flowScore, desc: "Token momentum & whale activity" },
                  { label: "Dev", score: devScore, desc: "GitHub & development activity" },
                  { label: "Social", score: socialScore, desc: "Community & social buzz" },
                ].map(({ label, score, desc: sdesc }) => (
                  <div key={label} className="bg-[#0d0d14] border border-white/[0.06] rounded-xl p-5 text-center">
                    <div className="flex justify-center mb-2">
                      <ScoreRing score={score} size={72} />
                    </div>
                    <div className="font-semibold text-sm text-white mb-1">{label}</div>
                    <div className="text-[10px] text-gray-600">{sdesc}</div>
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-gray-600 max-w-lg mx-auto">
                Score data refreshes hourly from AlphaGap&apos;s scanning engine. These scores are for
                informational purposes only and do not constitute financial advice.
              </p>
            </div>
          </section>
        )}

        {/* ── FAQ ─────────────────────────────────────────────── */}
        <section className="py-20 px-6 bg-white/[0.01]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
              Frequently Asked Questions about <span className="text-green-400">{name}</span>
            </h2>
            <div className="space-y-6">
              {[
                {
                  q: `What is ${name} on Bittensor?`,
                  a: `${name} is Subnet ${netuid} (SN${netuid}) on the Bittensor network — a decentralized AI protocol built on the TAO blockchain. ${desc.blurb}`,
                },
                {
                  q: `What problem does ${name} solve?`,
                  a: richData.problem,
                },
                {
                  q: `How is ${name} different from ${richData.mainstream}?`,
                  a: richData.differentiator,
                },
                {
                  q: `What is the ${name} token?`,
                  a: `The ${name} subnet has its own alpha token on Bittensor's dTAO system. It trades in the Bittensor liquidity pool and its price reflects market demand for the subnet's services.${price > 0 ? ` The current token price is approximately ${fmtPrice(price)}.` : ""}${mcap > 0 ? ` Market cap is approximately ${fmtMcap(mcap)}.` : ""}`,
                },
                {
                  q: `Is ${name} a good investment?`,
                  a: `AlphaGap tracks ${name} using its aGap score — a composite of development activity, token flow, and social signals. This page is for informational purposes only and is not financial advice. Always do your own research before making any investment decisions.`,
                },
              ].map(({ q, a }) => (
                <div key={q} className="border-b border-white/5 pb-6">
                  <h3 className="text-base font-semibold text-white mb-2">{q}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CtaSection name={name} />

        {/* ── More TAO Pages ─────────────────────────────────── */}
        <section className="py-16 px-6 bg-white/[0.01] border-t border-white/5">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold mb-8 text-center">More TAO Pages</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {related.map((s) => {
                const rLogoUrl = SUBNET_LOGOS[s.netuid];
                const rIcon = SUBNET_TYPE_ICONS[s.subnetType] ?? "🔷";
                const rc = SUBNET_TYPE_COLORS[s.subnetType] ?? DEFAULT_COLORS;
                return (
                  <Link
                    key={s.netuid}
                    href={`/taopages/${s.slug}`}
                    className={`group bg-[#0d0d14] border border-white/[0.06] hover:border-opacity-50 ${rc.border} rounded-xl p-4 text-center transition-all hover:scale-[1.03]`}
                  >
                    <div className={`w-10 h-10 mx-auto rounded-xl ${rc.iconBg} flex items-center justify-center text-xl mb-2 group-hover:scale-110 transition-transform overflow-hidden`}>
                      {rLogoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={rLogoUrl} alt={s.name} className="w-full h-full object-contain rounded-xl" />
                      ) : (
                        <span>{rIcon}</span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-white group-hover:text-green-300 transition-colors">{s.name}</div>
                    <div className="text-[10px] font-mono text-gray-700 mt-0.5">SN{s.netuid}</div>
                  </Link>
                );
              })}
            </div>
            <div className="text-center mt-6">
              <Link href="/taopages" className="text-sm text-green-600 hover:text-green-400 transition-colors">
                ← View all subnets
              </Link>
            </div>
          </div>
        </section>

        <PageFooter name={name} />
      </div>
    );
  }

  // ── BASIC PAGE (non-featured subnets) ─────────────────────────────

  const tagline = desc.blurb;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      <PageNav name={name} />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative pt-36 pb-20 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: `linear-gradient(rgba(34,197,94,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.3) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }} />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-green-500/5 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-5xl mx-auto">
          {/* Top badges row */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${colors.border} ${colors.pill}`}>
              <span className="text-base">{icon}</span> {subnetType}
            </span>
            <span className="text-xs font-mono text-gray-600 bg-white/5 px-2.5 py-1.5 rounded-full border border-white/8">
              SN{netuid}
            </span>
            {mcapRank > 0 && (
              <span className="text-xs text-gray-500 bg-white/[0.04] px-2.5 py-1.5 rounded-full border border-white/8">
                #{mcapRank} by market cap
              </span>
            )}
          </div>

          {/* Headline */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div className="max-w-2xl">
              {logoUrl && (
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center overflow-hidden shrink-0 mb-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt={name} className="w-full h-full object-contain rounded-2xl" />
                </div>
              )}
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-5">
                {name}
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300 text-4xl sm:text-5xl md:text-6xl">
                  {tagline}
                </span>
              </h1>
            </div>

            <MetricsCard
              compositeScore={compositeScore}
              flowScore={flowScore}
              devScore={devScore}
              socialScore={socialScore}
              mcap={mcap}
              price={price}
              emissionPct={emissionPct}
              colors={colors}
            />
          </div>
        </div>
      </section>

      {/* ── Analogy callout ──────────────────────────────────────── */}
      {desc.analogy && (
        <section className="px-6 pb-16">
          <div className="max-w-5xl mx-auto">
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-2xl px-8 py-6 flex items-start gap-4">
              <span className="text-3xl shrink-0 mt-0.5">💡</span>
              <div>
                <p className="text-xs font-semibold text-green-500 uppercase tracking-widest mb-2">The simplest explanation</p>
                <p className="text-lg sm:text-xl text-white font-medium leading-relaxed">
                  {desc.analogy}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── What the team says ───────────────────────────────────── */}
      {(dbInfo?.description || dbInfo?.website || dbInfo?.github_url || dbInfo?.discord) && (
        <section className="py-20 px-6 bg-white/[0.01]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">
              What the team says about <span className="text-green-400">{name}</span>
            </h2>
            <p className="text-gray-500 text-sm mb-8">From the official subnet registry on Bittensor.</p>

            {dbInfo.description && (
              <div className="bg-[#0d0d14] border border-white/[0.06] rounded-2xl p-8 mb-6">
                <p className="text-gray-300 text-base leading-relaxed">{dbInfo.description}</p>
              </div>
            )}

            {/* Links */}
            <div className="flex flex-wrap gap-3">
              {dbInfo.website && (
                <a
                  href={dbInfo.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:text-white hover:border-white/20 transition-all"
                >
                  <span>🌐</span>
                  Website
                </a>
              )}
              {dbInfo.github_url && (
                <a
                  href={dbInfo.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:text-white hover:border-white/20 transition-all"
                >
                  <span>💻</span>
                  GitHub
                </a>
              )}
              {dbInfo.discord && (
                <a
                  href={dbInfo.discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:text-white hover:border-white/20 transition-all"
                >
                  <span>💬</span>
                  Discord
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── How Bittensor makes it work ──────────────────────────── */}
      <HowBittensorSection name={name} subnetType={subnetType} />

      {/* ── aGap Score ───────────────────────────────────────────── */}
      {compositeScore > 0 && (
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
              The <span className="text-green-400">aGap Score</span> for {name}
            </h2>
            <p className="text-gray-400 text-center max-w-xl mx-auto mb-12">
              AlphaGap&apos;s proprietary composite score — how undervalued is this subnet right now?
              High aGap = the team is shipping hard but the price hasn&apos;t caught up yet.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mb-8">
              {[
                { label: "Overall", score: compositeScore, desc: "Composite intelligence score" },
                { label: "Flow", score: flowScore, desc: "Token momentum & whale activity" },
                { label: "Dev", score: devScore, desc: "GitHub & development activity" },
                { label: "Social", score: socialScore, desc: "Community & social buzz" },
              ].map(({ label, score, desc: sdesc }) => (
                <div key={label} className="bg-[#0d0d14] border border-white/[0.06] rounded-xl p-5 text-center">
                  <div className="flex justify-center mb-2">
                    <ScoreRing score={score} size={72} />
                  </div>
                  <div className="font-semibold text-sm text-white mb-1">{label}</div>
                  <div className="text-[10px] text-gray-600">{sdesc}</div>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-gray-600 max-w-lg mx-auto">
              Score data refreshes hourly from AlphaGap&apos;s scanning engine. These scores are for
              informational purposes only and do not constitute financial advice.
            </p>
          </div>
        </section>
      )}

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white/[0.01]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
            Frequently Asked Questions about <span className="text-green-400">{name}</span>
          </h2>
          <div className="space-y-6">
            {[
              {
                q: `What is ${name} on Bittensor?`,
                a: `${name} is Subnet ${netuid} (SN${netuid}) on the Bittensor network — a decentralized AI protocol built on the TAO blockchain. ${desc.blurb}`,
              },
              {
                q: `What type of subnet is ${name}?`,
                a: `${name} is classified as a ${subnetType} subnet on Bittensor. ${desc.blurb}`,
              },
              {
                q: `How do I participate in ${name}?`,
                a: `To participate as a miner or validator on ${name} (SN${netuid}), you typically need to register on the subnet, meet hardware requirements, and follow the subnet's specific guidelines.${dbInfo?.github_url ? ` Start at the GitHub repository for technical documentation.` : ""} The Bittensor community Discord and documentation are also great resources.`,
              },
              {
                q: `What is the ${name} token?`,
                a: `The ${name} subnet has its own alpha token on Bittensor's dTAO system. It trades in the Bittensor liquidity pool and its price reflects market demand for the subnet's services.${price > 0 ? ` The current token price is approximately ${fmtPrice(price)}.` : ""}${mcap > 0 ? ` Market cap is approximately ${fmtMcap(mcap)}.` : ""}`,
              },
              {
                q: `Is ${name} a good investment?`,
                a: `AlphaGap tracks ${name} using its aGap score — a composite of development activity, token flow, and social signals. This page is for informational purposes only and is not financial advice. Always do your own research before making any investment decisions.`,
              },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-white/5 pb-6">
                <h3 className="text-base font-semibold text-white mb-2">{q}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaSection name={name} />

      <RelatedSubnets currentSlug={slug} currentSubnetType={subnetType} />

      <PageFooter name={name} />
    </div>
  );
}
