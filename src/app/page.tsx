"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [stats, setStats] = useState<{ subnets: number; signals: number; reports: number }>({ subnets: 0, signals: 0, reports: 0 });

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch live stats
  useEffect(() => {
    fetch("/api/cached-scan")
      .then(r => r.json())
      .then(d => {
        setStats({
          subnets: d.leaderboard?.length || 122,
          signals: d.signals?.length || 0,
          reports: 1,
        });
      })
      .catch(() => setStats({ subnets: 122, signals: 40, reports: 1 }));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center font-bold text-sm text-black">α</div>
            <span className="text-lg font-bold tracking-tight">AlphaGap</span>
          </div>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-semibold rounded-lg hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/20 text-sm"
          >
            Launch Dashboard →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Animated background grid */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(34,197,94,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.3) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
              transform: `translateY(${scrollY * 0.1}px)`,
            }}
          />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-green-500/5 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Bittensor logo */}
          <div className="inline-flex items-center mb-8">
            <svg viewBox="0 0 21.6 23.1" className="w-10 h-10" fill="currentColor">
              <path className="text-green-400" d="M13.1,17.7V8.3c0-2.4-1.9-4.3-4.3-4.3v15.1c0,2.2,1.7,4,3.9,4c0.1,0,0.1,0,0.2,0c1,0.1,2.1-0.2,2.9-0.9C13.3,22,13.1,20.5,13.1,17.7L13.1,17.7z"/>
              <path className="text-green-400" d="M3.9,0C1.8,0,0,1.8,0,4h17.6c2.2,0,3.9-1.8,3.9-4C21.6,0,3.9,0,3.9,0z"/>
            </svg>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Bittensor Subnet
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">Intelligence Analytics</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Find the alpha gap before everyone else.
            Our AI scans thousands of data points across the Bittensor ecosystem to surface
            <span className="text-green-400 font-medium"> undervalued subnets </span>
            before the market catches on.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl hover:from-green-400 hover:to-emerald-500 transition-all shadow-xl shadow-green-500/25 text-lg"
            >
              Open the Dashboard
            </Link>
            <a
              href="#how-it-works"
              className="px-8 py-4 text-gray-400 hover:text-white transition-colors text-lg"
            >
              How it works ↓
            </a>
          </div>
        </div>
      </section>

      {/* The aGap Score */}
      <section className="py-12 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            The <span className="text-green-400">aGap</span> Score
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto mb-8 text-sm">
            Our proprietary composite score that answers one question:
            <span className="text-white font-semibold"> Is this subnet undervalued by the market?</span>
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { label: "Development", desc: "How actively is the team shipping?", icon: "⚡", color: "text-green-400" },
              { label: "Market Gap", desc: "Has the price caught up yet?", icon: "📉", color: "text-yellow-400" },
              { label: "Awareness", desc: "Does the market know about this?", icon: "👁", color: "text-blue-400" },
              { label: "Smart Money", desc: "Are insiders accumulating?", icon: "🐋", color: "text-purple-400" },
            ].map((c) => (
              <div key={c.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                <div className="text-2xl mb-2">{c.icon}</div>
                <div className={`font-semibold text-sm ${c.color}`}>{c.label}</div>
                <div className="text-xs text-gray-500 mt-1">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-6">
            128 teams are building.
            <br />
            <span className="text-gray-500">You have no idea what they&apos;re doing.</span>
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto text-lg leading-relaxed mb-12">
            Bittensor subnet teams are constantly developing, shipping updates, and pushing breakthroughs —
            but it&apos;s nearly impossible to track where and when they release new code, models, or features.
            Updates are scattered across dozens of technical platforms that most investors never check.
            By the time social media catches on, the opportunity has already moved.
          </p>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: "🔬",
                title: "Scattered across platforms",
                desc: "Teams push updates to technical platforms that most investors never check. Critical developments go unnoticed for days or weeks.",
              },
              {
                icon: "📉",
                title: "Markets react too late",
                desc: "Token prices stay flat while teams ship major upgrades. By the time Twitter finds out, the smart money has already moved.",
              },
              {
                icon: "💡",
                title: "The gap is your alpha",
                desc: "Between a team shipping a breakthrough and the market pricing it in — there's a window. We find that window before anyone else.",
              },
            ].map((card) => (
              <div key={card.title} className="bg-white/[0.03] border border-white/5 rounded-xl p-6 hover:border-green-500/20 transition-colors">
                <div className="text-3xl mb-4">{card.icon}</div>
                <h3 className="font-bold text-lg mb-2">{card.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-6 bg-white/[0.01]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            An AI brain that never sleeps
          </h2>
          <p className="text-gray-400 text-center max-w-xl mx-auto mb-16">
            AlphaGap continuously scans thousands of data sources, digests complex technical updates,
            and serves you actionable intelligence in plain English.
          </p>

          <div className="space-y-12">
            {[
              {
                step: "01",
                title: "Scan everything",
                desc: "We continuously monitor thousands of data points across the entire Bittensor ecosystem — development activity, on-chain metrics, social sentiment, and market data for all 128 subnets.",
                sources: ["Development", "On-chain", "Social", "Market Data"],
              },
              {
                step: "02",
                title: "Analyze with AI",
                desc: "Our proprietary AI engine digests complex technical updates and translates them into plain English. We tell you exactly what a subnet is building and why it matters — no technical knowledge required.",
                sources: ["AI Analysis", "Plain English", "Actionable Insights"],
              },
              {
                step: "03",
                title: "Find the gap",
                desc: "We cross-reference development quality against market awareness using multiple proprietary scoring algorithms. When a subnet is building hard but the market hasn't noticed — that's the alpha gap.",
                sources: ["Proprietary Scoring", "Gap Detection", "Multi-Signal"],
              },
              {
                step: "04",
                title: "Deliver actionable alpha",
                desc: "Every signal comes with a full intelligence breakdown and our take on the opportunity. Plus daily deep-dive reports on the top alpha gap subnets so you always know where the smart money should be looking.",
                sources: ["Signal Feed", "Daily Reports", "Leaderboard"],
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 font-bold font-mono text-sm">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-gray-400 leading-relaxed mb-3">{item.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {item.sources.map((s) => (
                      <span key={s} className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-gray-400">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16">
            Everything you need to find alpha
          </h2>

          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                icon: "📊",
                title: "Alpha Leaderboard",
                desc: "All 128 subnets ranked by our proprietary aGap score. See dev activity, price momentum, emission value, social buzz, and whale movements at a glance. Sort by any metric to find your edge.",
                color: "from-green-500/20 to-emerald-500/20",
              },
              {
                icon: "🧠",
                title: "AI Intelligence Feed",
                desc: "Every GitHub push and HuggingFace deployment — analyzed by AI and broken down into 4 sections: What they built, Why it matters, In simple terms, and The AlphaGap take. No technical knowledge required.",
                color: "from-blue-500/20 to-cyan-500/20",
              },
              {
                icon: "📝",
                title: "Daily Deep-Dive Reports",
                desc: "Each day, we generate a comprehensive analysis of the top aGap subnet — covering tech, team, progress, market position, and investment thesis. Like having a crypto research analyst on your team.",
                color: "from-purple-500/20 to-violet-500/20",
              },
              {
                icon: "🐋",
                title: "Whale Detection",
                desc: "We analyze buy/sell transaction sizes to detect when large wallets are accumulating before the crowd. A 🐋 icon flags subnets where whale average buy size dwarfs retail sells.",
                color: "from-yellow-500/20 to-amber-500/20",
              },
              {
                icon: "📡",
                title: "Emission Analysis",
                desc: "Our proprietary eVal metric detects when the network allocates more value to a subnet than the market realizes. When insiders are confident before retail catches on, that's your edge.",
                color: "from-red-500/20 to-rose-500/20",
              },
              {
                icon: "🔥",
                title: "Early Trend Detection",
                desc: "We monitor social campaigns, influencer activity, and marketing launches across the ecosystem. Get flagged when buzz is about to spike — before the crowd piles in.",
                color: "from-orange-500/20 to-amber-500/20",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-white/[0.03] border border-white/5 rounded-xl p-6 hover:border-green-500/20 transition-all group"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
                  {feature.icon}
                </div>
                <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* aGap section moved up to replace stats bar */}

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Stop guessing.
            <br />
            <span className="text-green-400">Start finding alpha.</span>
          </h2>
          <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
            Join the traders who see what the market doesn&apos;t.
            Free access. No account required. Updated every scan.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex px-10 py-5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl hover:from-green-400 hover:to-emerald-500 transition-all shadow-2xl shadow-green-500/30 text-xl"
          >
            Launch AlphaGap Dashboard →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-[10px] font-bold text-black">α</div>
            AlphaGap — Bittensor Subnet Intelligence
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <Link href="/dashboard" className="hover:text-gray-400 transition-colors">Dashboard</Link>
            <a href="https://x.com" className="hover:text-gray-400 transition-colors">X/Twitter</a>
            <span>Built on Bittensor</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
