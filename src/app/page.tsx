"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stats, setStats] = useState<{ subnets: number; signals: number; reports: number; leaderboard: any[] }>({ subnets: 0, signals: 0, reports: 0, leaderboard: [] });

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch live stats + leaderboard preview
  useEffect(() => {
    fetch("/api/cached-scan")
      .then(r => r.json())
      .then(d => {
        setStats({
          subnets: d.leaderboard?.length || 122,
          signals: d.signals?.length || 0,
          reports: 1,
          leaderboard: d.leaderboard || [],
        });
      })
      .catch(() => setStats({ subnets: 122, signals: 40, reports: 1, leaderboard: [] }));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/alphagap_logo_dark.svg" alt="AlphaGap" className="h-12 w-auto" />
          </div>
          <Link
            href="/subscribe"
            className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-semibold rounded-lg hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/20 text-sm"
          >
            Get Access →
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
              Start for Free →
            </Link>
            <Link
              href="/subscribe"
              className="px-8 py-4 border border-green-500/30 text-green-400 hover:border-green-500/60 hover:text-green-300 transition-all rounded-xl text-lg font-medium"
            >
              See Plans ↓
            </Link>
          </div>
          <p className="text-xs text-gray-600 mt-3">Free preview · Pro from $29/mo · Premium from $49/mo</p>
        </div>
      </section>

      {/* What We Track */}
      <section className="py-20 px-6 relative overflow-hidden">
        {/* Subtle radial glow behind grid */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-green-500/[0.03] rounded-full blur-[100px]" />

        <div className="relative max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3">
            What We <span className="text-green-400">Track</span>
          </h2>
          <p className="text-gray-500 text-center mb-12 text-sm">Thousands of data points. Every subnet. Every day.</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              // Row 1: Development Updates — Emission Shifts — Miner Activity — Price Lag
              {
                icon: (
                  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                ),
                title: "Development Updates",
                desc: "Every commit, PR & release",
                glow: "group-hover:shadow-gray-500/20",
                border: "group-hover:border-gray-400/30",
                iconBg: "bg-gray-500/10",
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" /></svg>
                ),
                title: "Emission Shifts",
                desc: "Network value signals",
                glow: "group-hover:shadow-emerald-500/20",
                border: "group-hover:border-emerald-400/30",
                iconBg: "bg-emerald-500/10",
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" /></svg>
                ),
                title: "Miner Activity",
                desc: "Registration & growth",
                glow: "group-hover:shadow-purple-500/20",
                border: "group-hover:border-purple-400/30",
                iconBg: "bg-purple-500/10",
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
                ),
                title: "Price Lag",
                desc: "When markets fall behind execution",
                glow: "group-hover:shadow-red-500/20",
                border: "group-hover:border-red-400/30",
                iconBg: "bg-red-500/10",
              },
              // Row 2: Social Velocity — Reddit Chatter — Discord Buzz — Whale Watching
              {
                icon: (
                  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                ),
                title: "Social Velocity",
                desc: "Tweets, threads & hype",
                glow: "group-hover:shadow-gray-400/20",
                border: "group-hover:border-gray-300/30",
                iconBg: "bg-gray-400/10",
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5c1.5-2 3-3 4.5-3s3 2 4.5 2 3-1 4.5-3" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 8.5c1.5-2 3-3 4.5-3s3 2 4.5 2 3-1 4.5-3" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 18.5c1.5-2 3-3 4.5-3s3 2 4.5 2 3-1 4.5-3" /></svg>
                ),
                title: "Unusual Volume",
                desc: "We spot the start of big price movements",
                glow: "group-hover:shadow-cyan-500/20",
                border: "group-hover:border-cyan-400/30",
                iconBg: "bg-cyan-500/10",
              },
              {
                icon: <span className="text-3xl">💬</span>,
                title: "Discord Buzz",
                desc: "Server activity & alerts",
                glow: "group-hover:shadow-indigo-500/20",
                border: "group-hover:border-indigo-400/30",
                iconBg: "bg-indigo-500/10",
              },
              {
                icon: <span className="text-3xl">🐋</span>,
                title: "Whale Watching",
                desc: "Large wallet accumulation",
                glow: "group-hover:shadow-blue-500/20",
                border: "group-hover:border-blue-400/30",
                iconBg: "bg-blue-500/10",
              },
            ].map((item) => (
              <div
                key={item.title}
                className={`group relative bg-[#0d0d14] border border-white/[0.06] rounded-2xl p-6 text-center transition-all duration-300 hover:scale-[1.03] ${item.glow} hover:shadow-lg cursor-default ${item.border}`}
              >
                {/* Icon container with glow ring */}
                <div className={`w-14 h-14 mx-auto rounded-xl ${item.iconBg} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
                  <div className="text-white">{item.icon}</div>
                </div>
                <div className="font-semibold text-white text-sm mb-1">{item.title}</div>
                <div className="text-xs text-gray-500">{item.desc}</div>
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

      {/* The aGap Score */}
      <section className="py-20 px-6 bg-white/[0.01]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            The <span className="text-green-400">aGap</span> Score
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto mb-10 text-lg">
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
              <div key={c.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
                <div className="text-3xl mb-3">{c.icon}</div>
                <div className={`font-semibold ${c.color}`}>{c.label}</div>
                <div className="text-xs text-gray-500 mt-1">{c.desc}</div>
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

      {/* aGap section moved below "How it works" */}

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
            Free to start. Pro from $29/mo. Cancel anytime.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex px-10 py-5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl hover:from-green-400 hover:to-emerald-500 transition-all shadow-2xl shadow-green-500/30 text-xl"
            >
              Start for Free →
            </Link>
            <Link
              href="/subscribe"
              className="inline-flex px-8 py-5 border border-green-500/30 text-green-400 hover:border-green-500/60 transition-all rounded-xl text-lg font-medium"
            >
              See Plans
            </Link>
          </div>
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
