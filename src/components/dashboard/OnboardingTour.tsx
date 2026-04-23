"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

const TOUR_KEY = "alphagap_tour_v1";

const STEPS = [
  {
    title: "Welcome to AlphaGap 👋",
    body: "The only tool built to surface alpha in Bittensor subnets before the market catches on. Our AI scans product development updates, on-chain signals, whale and smart money movement, X posts, Discord chatter, and price reversal signals to rank subnets by how undervalued they actually are.",
    target: null,
  },
  {
    title: "Navigating AlphaGap",
    body: "Everything lives in the menu up here. Tap it any time to jump between pages — each one gives you a different edge on the ecosystem.",
    target: "nav-trigger",
    arrow: true,
  },
  {
    title: "🏆 Alpha Leaderboard",
    body: "Your home base. Every subnet ranked by aGap score — the higher the score, the bigger the gap between real value and market price. Tap any i button in the column headers to learn what each score means. Use the Trading toggle for short-term opportunities and Investing for a long-term outlook.",
    target: "nav-trigger",
    arrow: true,
  },
  {
    title: "⚡ Signals",
    body: "AI-scored developer activity updated in real time. When a team ships a meaningful upgrade, new model, or protocol change — it shows up here, often before the price reacts.",
    target: "nav-trigger",
    arrow: true,
  },
  {
    title: "📋 Reports",
    body: "Daily AI-written deep-dives on the highest-ranked subnet. Covers product maturity, dev velocity, market position, and the key catalysts and risks worth knowing about.",
    target: "nav-trigger",
    arrow: true,
  },
  {
    title: "📡 Social Intelligence",
    body: "Track what 300+ KOLs are saying on X and scan subnet Discord channels for early signals. Catch narratives and announcements before they hit the price.",
    target: "nav-trigger",
    arrow: true,
  },
  {
    title: "📊 Benchmarks",
    body: "Real performance data comparing Bittensor subnets against centralized competitors like AWS, Google Cloud, and OpenAI, and more. Know which ones are genuinely better — not just hyped.",
    target: "nav-trigger",
    arrow: true,
  },
  {
    title: "🐋 Whales",
    body: "Follow smart money. Monitor large wallet accumulation patterns, buy/sell ratios, and staking conviction across the ecosystem in real time.",
    target: "nav-trigger",
    arrow: true,
  },
  {
    title: "📈 Analytics",
    body: "Dive into historical aGap score trends, subnet rankings over time, and signal activity charts. See how opportunities have evolved and spot patterns before they repeat.",
    target: "nav-trigger",
    arrow: true,
  },
  {
    title: "🎯 Performance",
    body: "Track how AlphaGap's calls have played out. See which high-scoring subnets followed through with price action — and use the track record to sharpen your conviction.",
    target: "nav-trigger",
    arrow: true,
  },
  {
    title: "🧪 Pump Lab",
    body: "Test your thesis before you commit. Simulate how changes in dev activity, social momentum, or whale accumulation would affect a subnet's aGap score — your personal alpha sandbox.",
    target: "nav-trigger",
    arrow: true,
  },
  {
    title: "🔖 My Watchlist",
    body: "Pin the subnets you care about and AlphaGap builds a personalised feed around them. Watched subnets are highlighted blue across every page, and you get smart alerts when scores move 20+ points, new reports drop, whale or volume flow signals fire, or major buzz hits Discord or X. Hit 'My Watchlist' in the menu any time to add or remove subnets.",
    target: "nav-trigger",
    arrow: true,
  },
  {
    title: "You're all set 🚀",
    body: "Head to the Alpha Leaderboard and find your first opportunity. A high aGap score means the market is sleeping on something — your edge is waking up before everyone else does.",
    target: null,
  },
];

export default function OnboardingTour() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Show once per browser on first dashboard visit — logged in or not.
  // Paid subscribers get it reset in /activating so they see it fresh after payment.
  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem(TOUR_KEY)) {
      setVisible(true);
    }
  }, []);

  const currentStep = STEPS[step];

  const refreshTarget = useCallback(() => {
    if (!currentStep.target) { setTargetRect(null); return; }
    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (el) setTargetRect(el.getBoundingClientRect());
  }, [currentStep.target]);

  useEffect(() => {
    if (!visible) return;
    refreshTarget();
    window.addEventListener("resize", refreshTarget);
    window.addEventListener("scroll", refreshTarget, true);
    return () => {
      window.removeEventListener("resize", refreshTarget);
      window.removeEventListener("scroll", refreshTarget, true);
    };
  }, [visible, refreshTarget]);

  const dismiss = useCallback(() => {
    localStorage.setItem(TOUR_KEY, "done");
    setVisible(false);
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else dismiss();
  }, [step, dismiss]);

  const back = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  if (!mounted || !visible) return null;

  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const PAD = 8; // padding around spotlight

  // Card position: below target or centered
  const cardStyle: React.CSSProperties = targetRect
    ? {
        position: "fixed",
        top: targetRect.bottom + 16,
        left: Math.min(
          Math.max(12, targetRect.left - 8),
          window.innerWidth - 332 // keep within viewport
        ),
        width: 320,
        zIndex: 9995,
      }
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 340,
        zIndex: 9995,
      };

  const portal = (
    <>
      {/* Click blocker — catches all clicks behind the card */}
      <div className="fixed inset-0 z-[9990]" />

      {/* Dark overlay with SVG spotlight hole */}
      <div className="fixed inset-0 z-[9991] pointer-events-none">
        {targetRect ? (
          <svg className="absolute inset-0 w-full h-full" style={{ overflow: "visible" }}>
            <defs>
              <mask id="tour-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={targetRect.left - PAD}
                  y={targetRect.top - PAD}
                  width={targetRect.width + PAD * 2}
                  height={targetRect.height + PAD * 2}
                  rx="8"
                  fill="black"
                />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.78)" mask="url(#tour-mask)" />
          </svg>
        ) : (
          <div className="absolute inset-0 bg-black/75" />
        )}
      </div>

      {/* Pulsing highlight ring around target */}
      {targetRect && (
        <div
          className="fixed z-[9992] rounded-lg pointer-events-none"
          style={{
            top: targetRect.top - PAD,
            left: targetRect.left - PAD,
            width: targetRect.width + PAD * 2,
            height: targetRect.height + PAD * 2,
            boxShadow: "0 0 0 2px rgb(74 222 128), 0 0 16px 4px rgba(74,222,128,0.35)",
            animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
          }}
        />
      )}

      {/* Tour card */}
      <div style={cardStyle} className="pointer-events-auto">
        {/* Arrow pointing up to target */}
        {targetRect && currentStep.arrow && (
          <div
            className="absolute -top-2 w-4 h-4 bg-gray-900 border-l border-t border-gray-700 rotate-45"
            style={{ left: Math.min(24, targetRect.width / 2) }}
          />
        )}

        <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
          {/* Progress bar */}
          <div className="h-0.5 bg-gray-800">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          <div className="p-5">
            {/* Step counter */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                {step + 1} / {STEPS.length}
              </span>
              <button
                onClick={dismiss}
                className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
              >
                Skip all
              </button>
            </div>

            <h3 className="font-bold text-white text-base mb-2 leading-snug">
              {currentStep.title}
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              {currentStep.body}
            </p>

            {/* Dot indicators */}
            <div className="flex items-center gap-1.5 mt-4 mb-4">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`rounded-full transition-all ${
                    i === step
                      ? "w-4 h-1.5 bg-green-400"
                      : "w-1.5 h-1.5 bg-gray-700 hover:bg-gray-500"
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={back}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-700 transition-colors"
                >
                  ← Back
                </button>
              )}
              <button
                onClick={next}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-green-500 hover:bg-green-400 text-black transition-colors"
              >
                {isLast ? "Start exploring →" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(portal, document.body);
}
