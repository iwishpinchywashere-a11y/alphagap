"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import SubnetLogo from "@/components/dashboard/SubnetLogo";

// ── Mini sparkline ────────────────────────────────────────────────
function MiniSparkline({ up }: { up: boolean }) {
  const pts = up
    ? "2,14 8,12 14,9 20,10 26,7 32,5 38,6 44,3 50,2"
    : "2,3 8,5 14,4 20,8 26,9 32,11 38,10 44,13 50,15";
  return (
    <svg width="52" height="18" className="opacity-70">
      <polyline points={pts} fill="none" stroke={up ? "#10b981" : "#ef4444"} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Mock dashboard row ────────────────────────────────────────────
function MockRow({ rank, name, netuid, agap, flow, dev, eval: evalScore, velo, price, change, emPct, emDelta, category, whale, surge }: {
  rank: number; name: string; netuid: number; agap: number; flow: number; dev: number;
  eval: number; velo: number; price: string; change: string;
  emPct: string; emDelta: string; category: string;
  whale?: boolean; surge?: boolean;
}) {
  const agapColor = agap >= 80 ? "text-green-400" : agap >= 60 ? "text-yellow-400" : "text-orange-400";
  const scoreColor = (s: number) => s >= 75 ? "text-green-400" : s >= 55 ? "text-yellow-400" : "text-orange-400";
  const veloColor = velo >= 70 ? "text-green-400" : velo >= 40 ? "text-yellow-400" : "text-red-400";
  const positive = !change.startsWith("-");
  const emUp = emDelta.startsWith("+");
  return (
    <tr className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
      <td className="px-3 py-2.5 text-xs text-gray-600 tabular-nums w-6">{rank}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <SubnetLogo netuid={netuid} name={name} size={20} />
          <span className="text-[10px] text-gray-600 font-mono">SN{netuid}</span>
          <span className="font-semibold text-gray-100 text-sm">{name}</span>
          {whale && <span className="text-xs">🐋</span>}
          {surge && <span className="text-xs">🤑</span>}
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500 border border-gray-700">{category}</span>
        </div>
      </td>
      <td className={`px-3 py-2.5 text-right font-bold tabular-nums text-lg ${agapColor}`}>{agap}</td>
      <td className={`px-3 py-2.5 text-right tabular-nums text-sm font-bold ${veloColor}`}>{velo}</td>
      <td className={`px-3 py-2.5 text-right tabular-nums text-sm font-semibold ${scoreColor(flow)}`}>{flow}</td>
      <td className={`px-3 py-2.5 text-right tabular-nums text-sm font-semibold ${scoreColor(dev)}`}>{dev}</td>
      <td className={`px-3 py-2.5 text-right tabular-nums text-sm font-semibold ${scoreColor(evalScore)}`}>{evalScore}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-xs text-gray-400">{emPct}</td>
      <td className={`px-3 py-2.5 text-right tabular-nums text-xs font-medium ${emUp ? "text-green-400" : "text-red-400"}`}>{emDelta}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-sm text-gray-300">{price}</td>
      <td className={`px-3 py-2.5 text-right tabular-nums text-sm font-medium ${positive ? "text-green-400" : "text-red-400"}`}>{change}</td>
    </tr>
  );
}

// ── Signal card mock ──────────────────────────────────────────────
function MockSignal({ type, subnet, title, insight, time }: {
  type: "github" | "hf"; subnet: string; title: string; insight: string; time: string;
}) {
  return (
    <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${type === "github" ? "bg-gray-800 text-gray-300 border-gray-700" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"}`}>
            {type === "github" ? "⌥ GitHub" : "🤗 HuggingFace"}
          </span>
          <span className="text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">{subnet}</span>
        </div>
        <span className="text-xs text-gray-600 shrink-0">{time}</span>
      </div>
      <h3 className="font-semibold text-gray-100 text-sm mb-2">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{insight}</p>
      <div className="mt-3 pt-3 border-t border-gray-800">
        <div className="text-xs font-semibold text-green-400 mb-1">AlphaGap Take</div>
        <p className="text-xs text-green-300/80 leading-relaxed">
          {type === "github"
            ? "Strong technical signal — team shipping consistently. Price hasn't reacted yet. Watching for catalyst."
            : "New model deployment signals active research. First mover advantage window open. Emission data trending up."}
        </p>
      </div>
    </div>
  );
}

// ── KOL heat card ─────────────────────────────────────────────────
function MockKolEvent({ kol, tier, subnet, heat, text, time }: {
  kol: string; tier: 1 | 2; subnet: string; heat: number; text: string; time: string;
}) {
  const heatColor = heat >= 85 ? "text-green-300 bg-green-500/15 border-green-500/30"
    : heat >= 65 ? "text-yellow-300 bg-yellow-500/10 border-yellow-500/25"
    : "text-orange-400 bg-orange-500/10 border-orange-500/20";
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-800/60 last:border-0">
      <div className={`text-xs px-1.5 py-0.5 rounded border font-bold shrink-0 ${tier === 1 ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-blue-500/15 text-blue-400 border-blue-500/25"}`}>
        T{tier}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-blue-400 font-semibold text-sm">@{kol}</span>
          <span className="text-xs text-gray-600 bg-gray-800 px-1.5 rounded font-mono">SN · {subnet}</span>
          <span className="text-xs text-gray-600">{time}</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{text}</p>
      </div>
      <div className={`text-sm font-bold tabular-nums px-2 py-0.5 rounded border ${heatColor} shrink-0`}>
        {heat}
      </div>
    </div>
  );
}

// ── Feature card ──────────────────────────────────────────────────
function FeatureCard({ icon, title, badge, children }: {
  icon: string; title: string; badge?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0d0d14] border border-white/[0.07] rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-white/[0.05]">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">{icon}</span>
          <h3 className="font-bold text-lg text-white">{title}</h3>
          {badge && (
            <span className="text-[10px] font-bold bg-green-500/15 text-green-400 border border-green-500/25 px-2 py-0.5 rounded-full ml-auto">
              {badge}
            </span>
          )}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
function SubscribeContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const pricingRef = useRef<HTMLDivElement>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [liveStats, setLiveStats] = useState({ subnets: 122, signals: 0, lastScan: "" });

  useEffect(() => {
    fetch("/api/cached-scan")
      .then(r => r.json())
      .then(d => setLiveStats({
        subnets: d.leaderboard?.length || 122,
        signals: d.signals?.length || 0,
        lastScan: d.lastScan || "",
      }))
      .catch(() => {});
  }, []);

  const minutesAgo = liveStats.lastScan
    ? Math.floor((Date.now() - new Date(liveStats.lastScan).getTime()) / 60000)
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subStatus = (session?.user as any)?.subscriptionStatus;
  const isSubscribed = subStatus === "active" || subStatus === "trialing";

  async function handleSubscribe(plan: "pro" | "premium" = "pro") {
    if (!session) {
      router.push("/auth/signup");
      return;
    }
    if (isSubscribed) {
      router.push("/dashboard");
      return;
    }
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setCheckoutLoading(false);
    }
  }

  const ctaLabel = checkoutLoading ? "Loading…"
    : isSubscribed ? "Open Dashboard →"
    : session ? "Subscribe →"
    : "Get Started →";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">

      {/* ── Sticky Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/85 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <Link href="/">
            <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-9 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            {session ? (
              <>
                <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">Dashboard</Link>
                <Link href="/account" className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg hover:border-gray-600 transition-colors">Account</Link>
              </>
            ) : (
              <>
                <Link href="/auth/signin" className="text-sm text-gray-400 hover:text-white transition-colors">Sign In</Link>
                <button
                  onClick={() => handleSubscribe("pro")}
                  className="text-sm bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold px-4 py-1.5 rounded-lg hover:from-green-400 hover:to-emerald-500 transition-all shadow-md shadow-green-500/20"
                >
                  Get Access
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {params.get("canceled") === "true" && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-300 text-sm text-center py-2 px-4">
          Payment was canceled. Your account is ready when you are — subscribe anytime below.
        </div>
      )}

      {/* ── Hero ── */}
      <section className="relative pt-36 pb-20 px-5">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: "linear-gradient(rgba(34,197,94,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.4) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }} />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-green-500/[0.06] rounded-full blur-[140px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold px-4 py-2 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            tracking millions of data points LIVE
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.08] mb-6">
            Find the next
            <br />
            <span className="flame-text">HOT</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-300 to-green-400"> Bittensor</span>
            {/* On mobile, "subnet" and "before" share a line naturally. On sm+, explicit break after "Bittensor" */}
            <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-300 to-green-400">{" "}subnet</span>
            {/* On mobile break before "everyone else", not between subnet/before */}
            <br className="sm:hidden" />
            {" "}before
            <br className="hidden sm:block" />
            {" "}everyone else.
          </h1>

          <p className="text-xl sm:text-2xl text-gray-300 max-w-2xl mx-auto mb-8 leading-relaxed">
            We save you hours of research time every day. While you sleep, we&apos;re scoring every subnet against 20+ signals so that when you wake up,
            the best opportunities are right in front of you.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <button
              onClick={() => handleSubscribe("pro")}
              disabled={checkoutLoading}
              className="px-9 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl hover:from-green-400 hover:to-emerald-500 transition-all shadow-2xl shadow-green-500/30 text-lg disabled:opacity-60"
            >
              {ctaLabel}
            </button>
            <button
              onClick={() => pricingRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="px-8 py-4 text-gray-400 hover:text-white transition-colors text-lg"
            >
              See pricing ↓
            </button>
          </div>
          <p className="text-xs text-gray-600 mb-12">Free to start · Pro $29/mo · Premium $49/mo · Cancel anytime</p>

          {/* What we monitor — graphic boxes */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-3xl mx-auto text-left">
            {[
              { icon: "🛠️", title: "Dev Activity", desc: "Every GitHub commit, release, and engineering milestone across all subnets" },
              { icon: "🐋", title: "Whale Wallets", desc: "Smart money flows, large stake moves, and whale buy/sell ratios in real time" },
              { icon: "📣", title: "Social Buzz", desc: "KOL tweets, community hype, and viral momentum before it hits the price" },
              { icon: "⛓️", title: "Emission Signals", desc: "On-chain allocation shifts — when the Bittensor network votes more TAO to a subnet" },
              { icon: "🚀", title: "Product Launches", desc: "New feature releases, live apps, and real-world deployments detected automatically" },
              { icon: "🕐", title: "128 Subnets · 24/7", desc: "Every active Bittensor subnet tracked continuously — nothing slips through" },
            ].map(item => (
              <div key={item.title} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 hover:border-green-500/20 hover:bg-white/[0.05] transition-colors">
                <div className="text-2xl mb-2">{item.icon}</div>
                <div className="text-sm font-semibold text-white mb-1">{item.title}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Problem ── */}
      <section className="py-20 px-5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            Tracking Bittensor manually<br />
            <span className="text-gray-500">is a full-time job.</span>
          </h2>
          <p className="text-gray-400 text-center max-w-xl mx-auto mb-12 leading-relaxed">
            128 teams. Dozens of platforms. Thousands of data points. Every single day.
            By the time you catch an opportunity on social media, the smart money has already moved.
          </p>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              {
                icon: "⏱",
                title: "Hours of daily research",
                desc: "Manually checking GitHub repos, HuggingFace profiles, Discord servers, Twitter, and on-chain data for 128 subnets would take 4+ hours every single day. Nobody has time for that.",
              },
              {
                icon: "📡",
                title: "Critical signals in the noise",
                desc: "A developer pushing a breakthrough model. A whale quietly staking 500+ TAO. Emissions doubling week over week. These signals are buried in technical platforms most investors never check.",
              },
              {
                icon: "🐢",
                title: "Markets react too slowly",
                desc: "Token prices lag behind fundamentals by days or weeks. The window between a team shipping real progress and the market pricing it in — that's where the alpha lives. But only if you find it first.",
              },
            ].map(c => (
              <div key={c.title} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
                <div className="text-3xl mb-4">{c.icon}</div>
                <h3 className="font-bold text-white mb-2">{c.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Showcase ── */}
      <section className="py-20 px-5 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3">
            Everything inside AlphaGap
          </h2>
          <p className="text-gray-500 text-center mb-14">Every page. Every feature. Built to give you an unfair advantage.</p>

          <div className="space-y-8">

            {/* Feature 1: Dashboard */}
            <FeatureCard icon="📊" title="Alpha Leaderboard" badge="CORE FEATURE">
              <div className="mb-4">
                <p className="text-sm text-gray-400 leading-relaxed mb-3">
                  Every one of the 128 Bittensor subnets scored, ranked, and sortable in real-time.
                  The <span className="text-green-400 font-semibold">aGap score</span> combines development activity,
                  price momentum, smart money signals, social buzz, and emissions value into one number.
                  The highest scores = the biggest opportunities right now.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {["Sort by any metric", "9 smart filters", "🐋 Whale signals", "🤑 Volume surges", "⚡ aGap Velocity score", "⚠️ Risk flags", "Category filters"].map(t => (
                    <span key={t} className="text-xs px-2 py-1 bg-gray-800 border border-gray-700 rounded-full text-gray-400">{t}</span>
                  ))}
                </div>
              </div>
              {/* Mock dashboard table */}
              <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] text-gray-600 border-b border-gray-800 font-medium">
                        <th className="px-3 py-2 w-6">#</th>
                        <th className="px-3 py-2">Subnet</th>
                        <th className="px-3 py-2 text-right">aGap</th>
                        <th className="px-3 py-2 text-right">Velo ⚡</th>
                        <th className="px-3 py-2 text-right">Flow</th>
                        <th className="px-3 py-2 text-right">Dev</th>
                        <th className="px-3 py-2 text-right">eVal</th>
                        <th className="px-3 py-2 text-right">Em %</th>
                        <th className="px-3 py-2 text-right">Em Δ</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-right">24h</th>
                      </tr>
                    </thead>
                    <tbody>
                      <MockRow rank={1} name="Templar" netuid={3} agap={87} flow={82} dev={91} eval={78} velo={85} emPct="18.2%" emDelta="+2.4%" category="Bandwidth" price="$0.284" change="+8.2%" whale={true} />
                      <MockRow rank={2} name="Gradients" netuid={56} agap={79} flow={91} dev={65} eval={88} velo={91} emPct="6.1%" emDelta="+5.8%" category="Training" price="$0.042" change="+12.4%" surge={true} />
                      <MockRow rank={3} name="Macrocosmos" netuid={13} agap={76} flow={71} dev={88} eval={72} velo={62} emPct="4.7%" emDelta="+0.3%" category="Data" price="$0.156" change="+3.1%" whale={true} />
                      <MockRow rank={4} name="Targon" netuid={4} agap={74} flow={68} dev={79} eval={82} velo={44} emPct="9.3%" emDelta="-1.2%" category="Inference" price="$0.093" change="-2.4%" />
                      <MockRow rank={5} name="Chutes" netuid={64} agap={71} flow={74} dev={85} eval={66} velo={78} emPct="3.9%" emDelta="+0.8%" category="Inference" price="$0.037" change="+5.7%" />
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-2 border-t border-gray-800 text-[10px] text-gray-600">
                  Showing 5 of {liveStats.subnets} subnets · Updated every 10 minutes
                </div>
              </div>
            </FeatureCard>

            {/* Feature 2: Signals */}
            <FeatureCard icon="🧠" title="AI Signal Intelligence">
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                Every GitHub commit and HuggingFace model deployment across all subnet repos is automatically analyzed by AI.
                You get a plain-English breakdown of <em>what was built</em>, <em>why it matters</em>,
                and most importantly — <span className="text-green-400 font-semibold">what it means for your investment</span>.
                No technical knowledge required.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <MockSignal
                  type="github"
                  subnet="Templar (SN3)"
                  title="Merged: Multi-node bandwidth optimization v2.3"
                  insight="Reduces validator latency by ~40% through parallel request batching. Third performance PR this week — sustained shipping velocity."
                  time="2h ago"
                />
                <MockSignal
                  type="hf"
                  subnet="Macrocosmos (SN13)"
                  title="New model: apex-data-7b-instruct-v2 deployed"
                  insight="7B parameter instruction-tuned model, 3rd deployment this month. Dataset size up 2x from v1. Active research program confirmed."
                  time="6h ago"
                />
              </div>
            </FeatureCard>

            {/* Feature 3: Social */}
            <FeatureCard icon="📡" title="Social Intelligence — KOL Radar & Discord Alpha">
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                We track <span className="text-white font-medium">300+ Bittensor KOLs on X/Twitter</span> in real-time,
                scoring every subnet mention with a <span className="text-green-400 font-semibold">Heat Score</span>.
                Plus, our AI reads every subnet channel in the Bittensor Discord every 3 hours —
                flagging genuine <span className="text-green-400">ALPHA</span> before it spreads.
              </p>
              <div className="bg-gray-950 rounded-xl border border-gray-800 p-4">
                <div className="text-xs text-gray-600 mb-3 font-medium uppercase tracking-wide">🔥 Hot KOL Activity</div>
                <MockKolEvent kol="const" tier={1} subnet="Templar" heat={95} text="Watching $SN3 Templar closely — bandwidth improvements are real, team is shipping consistently. This is what early Bittensor looked like before..." time="1h ago" />
                <MockKolEvent kol="taoshi_" tier={1} subnet="Gradients" heat={88} text="SN56 Gradients volume is surging. Emission share up 600% this week, markets haven't caught up yet. Worth a look." time="3h ago" />
                <MockKolEvent kol="jollygreenmoney" tier={2} subnet="Chutes" heat={72} text="The Chutes (SN64) developer update is impressive. Inference scaling improvements that could change validator economics significantly." time="5h ago" />
              </div>
            </FeatureCard>

            {/* Feature 4: Reports */}
            <FeatureCard icon="📝" title="Daily AI Deep-Dive Reports">
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                Every day, our AI generates a comprehensive deep-dive on the highest-scoring subnet.
                Think of it as having a <span className="text-white font-medium">crypto research analyst</span> on your team —
                covering the team, tech stack, recent progress, on-chain position, and investment thesis.
                All in plain English. Ready when you wake up.
              </p>
              <div className="bg-gray-950 rounded-xl border border-gray-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-1">Daily Report · Apr 2, 2026</div>
                    <h4 className="font-bold text-white text-lg">Templar (SN3) — Deep Dive</h4>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-400">87</div>
                    <div className="text-xs text-gray-600">aGap Score</div>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  {[
                    { label: "What they&apos;re building", text: "Decentralized AI bandwidth marketplace — miners provide compute, validators route intelligent workloads. Now in v2 with multi-node optimization." },
                    { label: "Recent progress", text: "3 performance PRs merged this week. 40% latency improvement. Emission share at 18.2% — 3rd highest in the network. Miner registrations up 34% in 30 days." },
                    { label: "Market position", text: "Price is down 8% over 30 days while fundamentals are strengthening. Classic alpha gap setup. Emission yield of 18% is not priced into current $84M market cap." },
                    { label: "Investment thesis", text: "Strong development velocity + rising emissions + underperforming price = textbook AlphaGap setup. Watching for catalyst to close the gap." },
                  ].map(s => (
                    <div key={s.label} className="bg-white/[0.02] rounded-lg p-3">
                      <div className="text-xs font-semibold text-gray-400 mb-1" dangerouslySetInnerHTML={{ __html: s.label }} />
                      <p className="text-xs text-gray-300 leading-relaxed">{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </FeatureCard>

            {/* Feature 5: Subnet Detail */}
            <FeatureCard icon="🔍" title="Subnet Deep Dives — 128 Individual Pages">
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                Every subnet gets its own dedicated intelligence page. Click any subnet in the dashboard
                to see its complete picture: score history charts, all detected signals over time, team links,
                GitHub/HuggingFace profiles, Discord channels, and real-time price data.
                Know everything about a subnet before you invest.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: "📈", label: "Score history charts", desc: "30/90 day trends" },
                  { icon: "📋", label: "All signals timeline", desc: "Every dev event" },
                  { icon: "🔗", label: "Team & social links", desc: "GitHub, X, Discord" },
                  { icon: "💰", label: "Price & market data", desc: "Live from TaoStats" },
                ].map(f => (
                  <div key={f.label} className="bg-gray-900/60 border border-gray-800 rounded-lg p-3 text-center">
                    <div className="text-xl mb-1.5">{f.icon}</div>
                    <div className="text-xs font-semibold text-gray-200">{f.label}</div>
                    <div className="text-[10px] text-gray-600 mt-0.5">{f.desc}</div>
                  </div>
                ))}
              </div>
            </FeatureCard>

            {/* Feature 5b: Whales */}
            <FeatureCard icon="🐋" title="Whale & Smart Money Tracker" badge="NEW">
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                A dedicated live feed of every whale wallet move, smart money flow, and unusual volume spike across all subnets.
                See exactly <span className="text-white font-medium">who is buying, who is selling, and how hard</span> — before the price moves.
              </p>
              <div className="grid sm:grid-cols-3 gap-3 mb-4">
                {[
                  { icon: "🐋", label: "Whale Accumulation", desc: "Buy/sell ratio flags wallets 2x+ larger on the buy side" },
                  { icon: "🤑", label: "Volume Surges", desc: "Detects 2.5x+ spikes vs 5-day rolling buy average" },
                  { icon: "⚡", label: "Flow Signals", desc: "Catches when net flow flips positive or spikes sharply" },
                ].map(f => (
                  <div key={f.label} className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
                    <div className="text-xl mb-1.5">{f.icon}</div>
                    <div className="text-xs font-semibold text-gray-200 mb-0.5">{f.label}</div>
                    <div className="text-[10px] text-gray-600">{f.desc}</div>
                  </div>
                ))}
              </div>
              <div className="bg-gray-950 rounded-xl border border-gray-800 divide-y divide-gray-800/60">
                {[
                  { netuid: 3, name: "Templar", badge: "🐋 WHALE BUY", badgeColor: "text-cyan-300", detail: "2.34x avg buy size vs sells · Net +$142K in 24h", velo: 85 },
                  { netuid: 64, name: "Chutes", badge: "🤑 VOL SURGE", badgeColor: "text-yellow-300", detail: "5.2x rolling average buy volume · Net +$89K in 24h", velo: 91 },
                  { netuid: 56, name: "Gradients", badge: "⚡ FLOW SPIKE", badgeColor: "text-purple-300", detail: "Flow spiked 3.1x vs yesterday · Accelerating inflows", velo: 78 },
                ].map(r => (
                  <div key={r.netuid} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] text-gray-600 font-mono">SN{r.netuid}</span>
                        <span className="font-semibold text-sm text-white">{r.name}</span>
                        <span className={`text-[10px] font-bold ${r.badgeColor}`}>{r.badge}</span>
                      </div>
                      <span className="text-xs text-gray-500">{r.detail}</span>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${r.velo >= 70 ? "text-green-400" : "text-yellow-400"}`}>{r.velo}</span>
                  </div>
                ))}
              </div>
            </FeatureCard>

            {/* Feature 5c: Pump Lab */}
            <FeatureCard icon="🧪" title="Pump Lab — Early Alpha Detector" badge="NEW">
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                Track subnets showing early signs of a pump <span className="text-white font-medium">before the crowd catches on</span>.
                Pump Lab monitors a curated watchlist for unusual staking inflows, volume acceleration, and social heat all converging at once.
                It&apos;s the closest thing to a heads-up the market will give you.
              </p>
              <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">🧪 Active Watch</span>
                  <span className="text-[10px] text-gray-600">Auto-detected · Updated every scan</span>
                </div>
                {[
                  { netuid: 3, name: "Templar", signals: ["🐋 Whales buying", "📈 Emissions +18%", "🔥 KOL heat 95"], score: 87 },
                  { netuid: 56, name: "Gradients", signals: ["🤑 5.2x vol surge", "⚡ Flow spiked 3x"], score: 79 },
                ].map(r => (
                  <div key={r.netuid} className="px-4 py-3 border-b border-gray-800/60 last:border-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-600 font-mono">SN{r.netuid}</span>
                        <span className="font-semibold text-sm text-white">{r.name}</span>
                      </div>
                      <span className="text-lg font-bold text-green-400">{r.score}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.signals.map(s => (
                        <span key={s} className="text-[10px] px-2 py-0.5 bg-gray-800 border border-gray-700 rounded-full text-gray-400">{s}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </FeatureCard>

            {/* Feature 6: Performance */}
            <FeatureCard icon="📈" title="Performance Tracker — Signals That Actually Work">
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                We put our money where our mouth is. AlphaGap automatically &apos;buys&apos; $100 of alpha
                tokens when a subnet hits aGap 80+ for the first time, then tracks how the position performs over time.
                See the real-world returns of following our signals — updated every scan.
              </p>
              <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-medium">Simulated Portfolio · Following aGap Signals</span>
                    <span className="text-sm font-bold text-green-400">+34.2% avg return</span>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-gray-600 border-b border-gray-800">
                      <th className="px-4 py-2 text-left">Subnet</th>
                      <th className="px-4 py-2 text-right">Entry Score</th>
                      <th className="px-4 py-2 text-right">Invested</th>
                      <th className="px-4 py-2 text-right">Current</th>
                      <th className="px-4 py-2 text-right">PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: "Templar", score: 84, inv: "$100", curr: "$142", pnl: "+42%", pos: true },
                      { name: "Gradients", score: 81, inv: "$100", curr: "$118", pnl: "+18%", pos: true },
                      { name: "Macrocosmos", score: 83, inv: "$100", curr: "$131", pnl: "+31%", pos: true },
                      { name: "Targon", score: 80, inv: "$100", curr: "$89", pnl: "-11%", pos: false },
                    ].map(r => (
                      <tr key={r.name} className="border-b border-gray-800/60">
                        <td className="px-4 py-2 text-gray-300 font-medium">{r.name}</td>
                        <td className="px-4 py-2 text-right text-yellow-400 font-bold">{r.score}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{r.inv}</td>
                        <td className="px-4 py-2 text-right text-gray-200">{r.curr}</td>
                        <td className={`px-4 py-2 text-right font-bold ${r.pos ? "text-green-400" : "text-red-400"}`}>{r.pnl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FeatureCard>

          </div>
        </div>
      </section>

      {/* ── Scoring breakdown ── */}
      <section className="py-20 px-5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">
            The <span className="text-green-400">aGap Score</span> — 5 signals. One number.
          </h2>
          <p className="text-gray-500 text-center text-sm mb-12 max-w-xl mx-auto">
            Every subnet is evaluated across five independent dimensions to produce the composite alpha gap score.
            The score answers one question: is this subnet undervalued by the market right now?
          </p>
          <div className="grid sm:grid-cols-5 gap-3">
            {[
              { label: "Dev Score", icon: "⚡", color: "from-green-500/20 to-emerald-500/10 border-green-500/20", desc: "GitHub commits, PRs, releases, HuggingFace models — measures actual shipping velocity" },
              { label: "Flow Score", icon: "🌊", color: "from-blue-500/20 to-cyan-500/10 border-blue-500/20", desc: "Price momentum + whale accumulation + volume surges + fear/greed — detects smart money" },
              { label: "eVal Score", icon: "⚖️", color: "from-purple-500/20 to-violet-500/10 border-purple-500/20", desc: "Emission allocation vs market cap — finds where the network is paying more than the market knows" },
              { label: "Social Score", icon: "📣", color: "from-yellow-500/20 to-amber-500/10 border-yellow-500/20", desc: "KOL heat events + Discord alpha signals — detects early buzz before it goes mainstream" },
              { label: "Price Lag", icon: "📉", color: "from-red-500/20 to-rose-500/10 border-red-500/20", desc: "Multi-timeframe price momentum vs fundamental quality — the bigger the lag, the bigger the gap" },
            ].map(s => (
              <div key={s.label} className={`bg-gradient-to-b ${s.color} border rounded-xl p-4 text-center`}>
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className="font-bold text-white text-sm mb-2">{s.label}</div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── vs manually ── */}
      <section className="py-20 px-5 bg-white/[0.01]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            AlphaGap vs. doing it yourself
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-6">
              <h3 className="font-bold text-red-400 mb-4">❌ Without AlphaGap</h3>
              <ul className="space-y-3 text-sm text-gray-400">
                {[
                  "Check 128 GitHub repos manually",
                  "Monitor HuggingFace for model releases",
                  "Track Discord in 50+ servers",
                  "Follow 300+ KOLs on Twitter",
                  "Manually calculate emission ratios",
                  "Watch on-chain transactions for whales",
                  "Cross-reference price vs fundamentals",
                  "Build your own scoring system",
                  "4–6 hours every single day",
                  "Still miss things",
                ].map(i => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5 shrink-0">✕</span>
                    {i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-6">
              <h3 className="font-bold text-green-400 mb-4">✓ With AlphaGap</h3>
              <ul className="space-y-3 text-sm text-gray-400">
                {[
                  "Open dashboard — top subnets ranked by aGap",
                  "Whale Tracker shows exactly who's buying",
                  "Volume surges flagged automatically",
                  "Pump Lab detects early momentum convergence",
                  "Signals analyzed and explained in plain English",
                  "Discord alpha surfaced automatically",
                  "KOL activity tracked and heat-scored",
                  "eVal ratio calculated every scan",
                  "aGap Velocity score shows momentum at a glance",
                  "5 minutes to review your daily alpha",
                  "Never miss a major development again",
                ].map(i => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section ref={pricingRef} className="py-24 px-5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">Simple, transparent pricing</h2>
          <p className="text-gray-500 text-center text-sm mb-12">
            Start free. Upgrade when you&apos;re ready. One missed 10x opportunity costs more than a year of AlphaGap.
          </p>

          <div className="grid sm:grid-cols-3 gap-5">

            {/* Free */}
            <div className="bg-[#0d0d14] border border-gray-800 rounded-3xl p-7 flex flex-col">
              <div className="mb-6">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Free</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">$0</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <p className="text-xs text-gray-600">Preview mode · No card required</p>
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {[
                  "Leaderboard preview (top 10 blurred)",
                  "1 signal preview",
                  "Whale tracker preview",
                  "Social feed headers only",
                  "Reports locked",
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-gray-500">
                    <span className="text-gray-700 shrink-0 mt-0.5">◦</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/dashboard"
                className="w-full text-center py-3 border border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200 rounded-xl text-sm font-medium transition-colors"
              >
                Go to Dashboard →
              </a>
            </div>

            {/* Pro */}
            <div className="relative bg-[#0d0d14] border border-green-500/40 rounded-3xl p-7 flex flex-col shadow-xl shadow-green-500/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-black text-[10px] font-bold px-3 py-1 rounded-full">
                  MOST POPULAR
                </span>
              </div>
              <div className="mb-6">
                <div className="text-xs font-bold text-green-500 uppercase tracking-wider mb-2">Pro</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">$29</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <p className="text-xs text-gray-600">Cancel anytime · Instant access</p>
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {[
                  "Full Alpha Leaderboard — all 128 subnets",
                  "All sorting & filtering",
                  "AI Signal Intelligence — all signals",
                  "Daily AI Deep-Dive Reports",
                  "All 128 Subnet Detail pages",
                  "Updated every 10 minutes",
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-gray-300">
                    <span className="text-green-400 shrink-0 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
                {[
                  "Whale & Smart Money Tracker",
                  "Social Intelligence & KOL Radar",
                  "Pump Lab · Performance Tracker",
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="text-gray-700 shrink-0 mt-0.5">✕</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe("pro")}
                disabled={checkoutLoading}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl py-3.5 text-sm hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/25 disabled:opacity-60"
              >
                {isSubscribed ? "Open Dashboard →" : checkoutLoading ? "Loading…" : session ? "Subscribe — $29/mo →" : "Get Pro — $29/mo →"}
              </button>
              <p className="text-center text-[11px] text-gray-700 mt-3">Powered by Stripe · Secure checkout</p>
            </div>

            {/* Premium */}
            <div className="relative bg-[#0d0d14] border border-purple-500/30 rounded-3xl p-7 flex flex-col">
              <div className="mb-6">
                <div className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Premium</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">$49</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <p className="text-xs text-gray-600">Cancel anytime · Instant access</p>
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {[
                  "Everything in Pro",
                  "🐋 Whale & Smart Money Tracker",
                  "📡 Social Intelligence & KOL Radar",
                  "🧪 Pump Lab — early alpha detector",
                  "📈 Performance Tracker",
                  "📊 Analytics & Scatter Plots",
                  "🏆 Benchmark Rankings",
                  "Discord Alpha Scanner",
                  "Full access to every page",
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-gray-300">
                    <span className="text-purple-400 shrink-0 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe("premium")}
                disabled={checkoutLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-violet-700 text-white font-bold rounded-xl py-3.5 text-sm hover:from-purple-500 hover:to-violet-600 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60"
              >
                {isSubscribed ? "Open Dashboard →" : checkoutLoading ? "Loading…" : session ? "Subscribe — $49/mo →" : "Get Premium — $49/mo →"}
              </button>
              <p className="text-center text-[11px] text-gray-700 mt-3">Powered by Stripe · Secure checkout</p>
            </div>

          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 px-5 bg-white/[0.01]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Frequently asked questions</h2>
          <div className="space-y-4">
            {[
              {
                q: "What exactly is Bittensor?",
                a: "Bittensor is a decentralized AI network where 128 independent subnet teams compete to build the best AI models and services. Each subnet has a native alpha token whose value is driven by the team's work and the network's allocation of emissions (TAO). AlphaGap helps you identify which subnets are undervalued before the market catches on.",
              },
              {
                q: "How often is the data updated?",
                a: "The main scan runs every 10 minutes, pulling fresh data from GitHub, HuggingFace, TaoStats, SubnetRadar, and on-chain sources. The KOL Twitter monitor runs every 2 hours. Discord channels are scanned every 3 hours. Daily reports are generated every morning.",
              },
              {
                q: "I'm not technical — will I understand it?",
                a: "Absolutely. Every signal is explained in plain English with an investment take. You don't need to understand the code — you need to understand what the signal means for the price. That's exactly what we translate for you.",
              },
              {
                q: "Can I cancel anytime?",
                a: "Yes. Cancel any time from your Account page and you won't be charged again. You keep access until the end of your billing period. No questions asked.",
              },
              {
                q: "Is this financial advice?",
                a: "No. AlphaGap provides intelligence and analysis tools to help you make better-informed decisions. All investment decisions are your own. Crypto markets are volatile — never invest more than you can afford to lose.",
              },
              {
                q: "What payment methods do you accept?",
                a: "All major credit and debit cards via Stripe. The payment is handled entirely by Stripe — we never see or store your card details.",
              },
            ].map(faq => (
              <details key={faq.q} className="group bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-medium text-white text-sm list-none select-none">
                  {faq.q}
                  <span className="text-gray-600 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            The market is inefficient.
            <br />
            <span className="text-green-400">That&apos;s your edge.</span>
          </h2>
          <p className="text-gray-400 text-lg mb-4 max-w-xl mx-auto leading-relaxed">
            Every day, Bittensor teams ship breakthroughs that the market takes days or weeks to price in.
            AlphaGap finds those windows before anyone else.
          </p>
          <p className="text-gray-500 text-base mb-10">
            $19/month. No long-term commitment. Cancel anytime.
          </p>
          <button
            onClick={() => handleSubscribe("pro")}
            disabled={checkoutLoading}
            className="px-10 py-5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl hover:from-green-400 hover:to-emerald-500 transition-all shadow-2xl shadow-green-500/30 text-xl disabled:opacity-60"
          >
            {ctaLabel}
          </button>
          <p className="text-xs text-gray-600 mt-4">Instant access · Secure checkout via Stripe</p>
        </div>
      </section>

      {/* ── Disclaimer ── */}
      <section className="py-10 px-5 border-t border-white/[0.04]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="font-semibold text-gray-500">Not financial advice.</span> AlphaGap is an educational intelligence tool designed to help you research Bittensor subnets more efficiently. Nothing on this platform constitutes financial, investment, or trading advice. All data, scores, signals, and analysis are provided for informational purposes only. Cryptocurrency and digital asset markets are highly volatile. Past signal performance does not guarantee future results. Always do your own research and never invest more than you can afford to lose. AlphaGap is not responsible for any investment decisions you make based on information provided on this platform.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-5 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-[10px] font-bold text-black">α</div>
            AlphaGap — Bittensor Subnet Intelligence
          </div>
          <div className="flex items-center gap-5 text-sm text-gray-600">
            <Link href="/dashboard" className="hover:text-gray-400 transition-colors">Dashboard</Link>
            <Link href="/auth/signin" className="hover:text-gray-400 transition-colors">Sign In</Link>
            <span>Built on Bittensor</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense>
      <SubscribeContent />
    </Suspense>
  );
}
