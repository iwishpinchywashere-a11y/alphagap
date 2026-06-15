"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function LandingPage() {
  const { data: session } = useSession();
  const [scrollY, setScrollY] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stats, setStats] = useState<{ subnets: number; signals: number; reports: number; leaderboard: any[] }>({ subnets: 0, signals: 0, reports: 0, leaderboard: [] });
  const [approvedReviews, setApprovedReviews] = useState<{ id: string; name: string; xHandle: string; review: string }[]>([]);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch approved reviews
  useEffect(() => {
    fetch("/api/reviews")
      .then(r => r.json())
      .then(d => setApprovedReviews(d.reviews ?? []))
      .catch(() => {});
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
          {session ? (
            <Link
              href="/dashboard"
              className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-semibold rounded-lg hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/20 text-sm"
            >
              Dashboard →
            </Link>
          ) : (
            <Link
              href="/subscribe"
              className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-semibold rounded-lg hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/20 text-sm"
            >
              Get Access →
            </Link>
          )}
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
              href="/powerrankings"
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl hover:from-green-400 hover:to-emerald-500 transition-all shadow-xl shadow-green-500/25 text-lg"
            >
              Start for Free →
            </Link>
            <Link
              href="/subscribe"
              className="px-8 py-4 border border-green-500/30 text-green-400 hover:border-green-500/60 hover:text-green-300 transition-all rounded-xl text-lg font-medium"
            >
              Explore Premium ↓
            </Link>
          </div>
          <p className="text-xs text-gray-600 mt-3">Free preview · Pro $29/mo · Premium $49/mo · Ultra $99/mo</p>
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
              {
                icon: (
                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" /></svg>
                ),
                title: "Wallet Tracker",
                desc: "Track any TAO wallet's positions",
                glow: "group-hover:shadow-teal-500/20",
                border: "group-hover:border-teal-400/30",
                iconBg: "bg-teal-500/10",
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
              {
                icon: "🔍",
                title: "Wallet Tracker",
                desc: "Track any TAO wallet across the entire network. See exactly who is staking where, monitor top wallets ranked by 24h movement, identify known wallets (validators, founders, whales), and look up any address to reveal their full subnet portfolio.",
                color: "from-teal-500/20 to-cyan-500/20",
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

      {/* TAO Oracle — Featured Premium Section */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-950/10 to-transparent pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-green-500/[0.04] rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-bold uppercase tracking-widest">New — Premium Feature</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ask the{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">TAO Oracle</span>
              {" "}anything
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Live AI chat using data from every Bittensor subnet — scores, signals, whale activity, dev momentum, and more. Ask anything, get instant answers in plain English.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-10 items-start">
            {/* Left: Mock chat UI */}
            <div className="bg-[#0d0d14] border border-white/10 rounded-2xl p-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
                <div className="w-9 h-9 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center text-lg">🔮</div>
                <div>
                  <div className="text-white text-sm font-semibold">AlphaGap Oracle</div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="text-green-400 text-xs">Live · Premium</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex justify-end">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-3 max-w-[85%] text-white">
                    Which subnets are whales accumulating right now?
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-green-500/15 border border-green-500/25 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">🔮</div>
                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3 text-gray-200 space-y-1.5">
                    <p><strong className="text-white">3 subnets with heavy smart-money flow:</strong></p>
                    <p>▸ <strong className="text-white">SN64 Chutes</strong> — buy/sell ratio 3.1× above avg, large wallets added positions in the last 6h</p>
                    <p>▸ <strong className="text-white">SN19</strong> — Const wallet bought 840 TAO, aGap 82</p>
                    <p>▸ <strong className="text-white">SN4 Targon</strong> — flow score spiking, unusual volume, smart money entering</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-3 max-w-[85%] text-white">
                    What&apos;s the biggest red flag right now?
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-green-500/15 border border-green-500/25 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">🔮</div>
                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3 text-gray-200">
                    ▸ <strong className="text-white">SN77</strong> has a Nakamoto coefficient of 1 — a single validator controls consensus. Critical centralisation risk worth avoiding until that changes.
                  </div>
                </div>
              </div>
            </div>

            {/* Right: what you can ask + CTA */}
            <div className="space-y-5">
              <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Ask anything — for example</p>
              <div className="space-y-3">
                {[
                  { icon: "🐋", label: "Smart money & whale flows", ex: "\"Who's accumulating before the next pump?\"" },
                  { icon: "⚡", label: "Dev momentum", ex: "\"Which subnets shipped the most code this week?\"" },
                  { icon: "📊", label: "Top picks with reasoning", ex: "\"Best long-term holds right now — top 3\"" },
                  { icon: "🚨", label: "Red flags & risks", ex: "\"What are the biggest centralisation risks?\"" },
                  { icon: "💬", label: "Social & KOL activity", ex: "\"What are KOLs buzzing about right now?\"" },
                ].map((q) => (
                  <div key={q.label} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-colors">
                    <span className="text-xl flex-shrink-0 leading-none mt-0.5">{q.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{q.label}</p>
                      <p className="text-xs text-gray-500 italic">{q.ex}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Included in Premium</p>
                <ul className="space-y-2 mb-5">
                  {[
                    "10 AI queries per day (20 on Ultra)",
                    "Pulls live data from every subnet scan",
                    "Scores, signals, whales, dev activity",
                    "Powered by Claude AI",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span className="text-green-400 flex-shrink-0 mt-0.5">✓</span>
                      <span className="text-gray-300">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/pricing"
                  className="w-full inline-flex items-center justify-center px-5 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/20 text-sm"
                >
                  Unlock the Oracle →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AlphaGap Index — Ultra feature showcase */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-950/10 to-transparent pointer-events-none" />
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-amber-400/[0.04] rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-full px-4 py-1.5 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">Ultra Exclusive Feature</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Introducing the{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">AlphaGap Index</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Stop picking individual subnets. Let AlphaGap&apos;s scoring engine do it for you — automatically allocating your TAO across the top 10 subnets and rebalancing every week.
            </p>
          </div>

          <div className="max-w-xl mx-auto">
            {/* How it works + CTA */}
            <div className="space-y-5">
              <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">How it works</p>
              <div className="space-y-3">
                {[
                  { step: "01", icon: "◈", title: "Score every subnet, every week", desc: "AlphaGap runs its full 20+ signal analysis across all 128 active subnets to generate fresh composite scores." },
                  { step: "02", icon: "◉", title: "Select the top 10", desc: "The 10 highest-scoring subnets become the Index constituents. Weight is proportional to score — higher scores get bigger allocations." },
                  { step: "03", icon: "⟳", title: "Auto-rebalance weekly", desc: "Winners stay in. Fading subnets are trimmed. New high-scorers replace them. Your TAO always tracks the best opportunities." },
                  { step: "04", icon: "◆", title: "Powered by TrustedStake", desc: "Execution happens automatically via TrustedStake — a non-custodial staking protocol. You stay in control of your TAO at all times." },
                ].map(s => (
                  <div key={s.step} className="flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-amber-400/15 transition-colors">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-[11px] font-bold text-amber-400">{s.step}</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span>{s.icon}</span>
                        <p className="text-sm font-semibold text-white">{s.title}</p>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white/[0.02] border border-amber-400/15 rounded-xl p-5">
                <p className="text-xs text-amber-400 uppercase tracking-widest font-semibold mb-3">Included in Ultra — $99/mo</p>
                <ul className="space-y-2 mb-5">
                  {[
                    "Auto-invest across the top 10 subnets",
                    "Weekly rebalancing — always tracks best opportunities",
                    "Non-custodial — you keep control of your TAO",
                    "20 Oracle queries/day included",
                    "Cancel anytime",
                  ].map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-400 flex-shrink-0 mt-0.5">✓</span>
                      <span className="text-gray-300">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/pricing"
                  className="w-full inline-flex items-center justify-center px-5 py-3 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black font-bold rounded-xl transition-all shadow-lg shadow-amber-400/20 text-sm"
                >
                  Unlock the Index — Ultra →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Telegram Alerts — Premium feature showcase */}
      <section className="py-24 px-6 relative overflow-hidden">
        {/* Background accent */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent pointer-events-none" />
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/[0.04] rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-5">
              <span className="text-blue-400 text-xs font-bold uppercase tracking-widest">Premium</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Don&apos;t watch the screen.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Let the screen watch for you.</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              AlphaGap Premium connects directly to your Telegram. The moment something worth acting on happens — price move, dev spike, whale accumulation, viral post — you get a ping. No dashboards. No FOMO.
            </p>
          </div>

          {/* Main layout: mock alert feed left + alert types right */}
          <div className="grid lg:grid-cols-2 gap-10 items-start">

            {/* Left: Telegram message mockups */}
            <div className="relative">
              {/* Phone chrome */}
              <div className="bg-[#0d0d14] border border-white/10 rounded-2xl p-4 shadow-2xl">
                {/* Chat header */}
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-black font-bold text-sm flex-shrink-0">α</div>
                  <div>
                    <div className="text-white text-sm font-semibold">AlphaGap Alerts Bot</div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                      <span className="text-gray-500 text-xs">online</span>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="space-y-3 text-sm">
                  {/* Whale alert */}
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3.5 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base">🐋</span>
                      <span className="font-semibold text-blue-300">Whale Activity — SN19 Nineteen</span>
                    </div>
                    <p className="text-gray-300 text-xs leading-relaxed">Unusual volume surge detected. Buy/sell ratio 3.1× above 7-day avg. Large wallets accumulating.</p>
                    <p className="text-gray-600 text-xs mt-1.5">just now</p>
                  </div>

                  {/* Dev signal */}
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-3.5 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base">🔮</span>
                      <span className="font-semibold text-green-300">Development Update — SN64 Chutes</span>
                    </div>
                    <p className="text-gray-300 text-xs leading-relaxed">4 commits · 3 contributors · New inference API deployed. Signal strength: <span className="text-green-400 font-semibold">82/100</span></p>
                    <p className="text-gray-600 text-xs mt-1.5">2 min ago</p>
                  </div>

                  {/* Discord alpha */}
                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3.5 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base">💬</span>
                      <span className="font-semibold text-indigo-300">Discord Alpha — SN9 Pretraining</span>
                    </div>
                    <p className="text-gray-300 text-xs leading-relaxed">High-signal post detected in main channel. Team announcement: testnet v2 launching this week.</p>
                    <p className="text-gray-600 text-xs mt-1.5">14 min ago</p>
                  </div>

                  {/* Emission alert */}
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3.5 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base">⚡</span>
                      <span className="font-semibold text-yellow-300">Emission Spike — SN8 Proprioception</span>
                    </div>
                    <p className="text-gray-300 text-xs leading-relaxed">Emission share ↑ 31% in last scan cycle. Network weight rotating in. aGap: <span className="text-yellow-400 font-semibold">+12 pts</span></p>
                    <p className="text-gray-600 text-xs mt-1.5">1 hr ago</p>
                  </div>

                  {/* Viral X */}
                  <div className="bg-gray-400/10 border border-gray-400/20 rounded-xl px-3.5 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base leading-none font-bold text-gray-300">𝕏</span>
                      <span className="font-semibold text-gray-300">Going Viral — SN11 Transcription</span>
                    </div>
                    <p className="text-gray-300 text-xs leading-relaxed">Post gaining rapid traction. 1.2K engagements in 2 hours. KOL thread breaking. Heat score: <span className="text-gray-300 font-semibold">78</span></p>
                    <p className="text-gray-600 text-xs mt-1.5">2 hr ago</p>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-3 -right-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl px-3 py-1.5 shadow-lg shadow-green-500/30">
                <span className="text-black text-xs font-bold">Premium only</span>
              </div>
            </div>

            {/* Right: Alert types + steps */}
            <div className="space-y-5">

              {/* 7 alert types */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-4">7 customisable alert types</p>
                <div className="space-y-3">
                  {[
                    { icon: "📊", label: "aGap Score Change", desc: "Catches momentum shifts the moment they happen" },
                    { icon: "⚡", label: "Emissions Change", desc: "Be first when validators rotate weight to a subnet" },
                    { icon: "🔮", label: "Development Updates", desc: "GitHub spikes & HuggingFace releases — filtered by signal strength" },
                    { icon: "🐋", label: "Whale Activity / Volume Surge", desc: "Large wallet moves & unusual volume detected from on-chain flow" },
                    { icon: "💬", label: "Discord Alpha", desc: "High-signal posts across all Bittensor subnet servers" },
                    { icon: "𝕏", label: "Going Viral on X", desc: "KOL posts catching fire — before the crowd piles in" },
                    { icon: "💰", label: "Price Movement", desc: "Your threshold, your subnets — once per 24h to avoid spam" },
                  ].map(a => (
                    <div key={a.label} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.10] transition-colors">
                      <span className="text-xl flex-shrink-0 leading-none mt-0.5">{a.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-white">{a.label}</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{a.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* How to get it */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 mt-2">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-4">Get set up in 60 seconds</p>
                <div className="space-y-2.5">
                  {[
                    "Upgrade to Premium ($49/mo)",
                    "Connect your Telegram in one tap",
                    "Pick exactly which alerts you want",
                    "Done — alerts arrive instantly",
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <span className="text-sm text-gray-300">{step}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/pricing"
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/20 text-sm"
                >
                  Unlock Telegram Alerts →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3">
            What people are saying about <span className="text-green-400">AlphaGap</span>
          </h2>
          <p className="text-gray-500 text-center text-sm mb-12">Real words from real subscribers. Not paid endorsements.</p>

          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {/* Approved user-submitted reviews */}
            {approvedReviews.map((r) => (
              <div
                key={r.id}
                className="break-inside-avoid bg-[#0d0d14] border border-white/[0.06] rounded-2xl p-5 hover:border-green-500/20 transition-colors"
              >
                <div className="text-green-500/40 text-4xl font-serif leading-none mb-2">&ldquo;</div>
                <p className="text-gray-300 text-sm leading-relaxed">{r.review}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, s) => (
                        <svg key={s} className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500 font-medium">{r.name}</span>
                    {r.xHandle && (
                      <span className="text-xs text-blue-400">@{r.xHandle}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-600">Verified subscriber</span>
                </div>
              </div>
            ))}

            {/* Hardcoded testimonials */}
            {[
              {
                quote: "I'm telling you guys. Personal testimony and I'm not paid for this whatsoever. I subscribed for $29/month and upgraded to premium. It paid for itself in 3–4 days with modest amounts of TAO trading subnets off signals. The AI is INSANELY fast. Highly recommend. I continue to be both impressed and addicted to subnets and what they are shipping!! 😎",
                highlight: "paid for itself in 3–4 days",
              },
              {
                quote: "It makes more sense when you subscribe. I made my $49 back day one. It's perfectly named because the alpha in this is crazy and could never be tracked by a single person. The AI has to be on overdrive!! 😎",
                highlight: "made my $49 back day one",
              },
              {
                quote: "Oro is straight up BEAST mode!! And we got the signal days ago. That one play could pay your monthly subscription with a $30 investment, because it's damn near doubled since I got in. You guys gotta shell out the money. Alpha Gap is printing.",
                highlight: "damn near doubled",
              },
              {
                quote: "Followed your call. Up 16 $TAO or so and a believer haha",
                highlight: "Up 16 $TAO",
              },
              {
                quote: "+20% since i bought the pro version of alphagap",
                highlight: "+20%",
              },
              {
                quote: "10% total portfolio up in 2 hours\nALPHAGAP IS LEGIT PRINTER",
                highlight: "10% total portfolio up in 2 hours",
              },
            ].map((t, i) => (
              <div
                key={i}
                className="break-inside-avoid bg-[#0d0d14] border border-white/[0.06] rounded-2xl p-5 hover:border-green-500/20 transition-colors"
              >
                {/* Quote mark */}
                <div className="text-green-500/40 text-4xl font-serif leading-none mb-2">&ldquo;</div>
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                  {t.quote.split(t.highlight).map((part, j, arr) => (
                    <span key={j}>
                      {part}
                      {j < arr.length - 1 && (
                        <span className="text-green-400 font-semibold">{t.highlight}</span>
                      )}
                    </span>
                  ))}
                </p>
                <div className="mt-3 flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, s) => (
                      <svg key={s} className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-xs text-gray-600">Verified subscriber</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

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
              href="/powerrankings"
              className="inline-flex px-10 py-5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold rounded-xl hover:from-green-400 hover:to-emerald-500 transition-all shadow-2xl shadow-green-500/30 text-xl"
            >
              Start for Free →
            </Link>
            <Link
              href="/subscribe"
              className="inline-flex px-8 py-5 border border-green-500/30 text-green-400 hover:border-green-500/60 transition-all rounded-xl text-lg font-medium"
            >
              Explore Premium
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
