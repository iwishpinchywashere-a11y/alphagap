"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { getTier, canAccessPremium } from "@/lib/subscription";
import AgIcon from "@/components/AgIcon";
import type { AlertSettings } from "@/lib/telegram-alerts";

// ─── Sub-components ──────────────────────────────────────────────────────────

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? "bg-green-500" : "bg-gray-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function CopyBlock({
  label,
  value,
  displayValue,
  compact = false,
}: {
  label?: string;
  value: string;
  displayValue?: React.ReactNode;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  if (compact) {
    return (
      <button
        onClick={copy}
        className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.10] hover:border-emerald-400/40 px-3 py-1 rounded-full text-sm font-mono text-emerald-400 backdrop-blur-[14px] transition-colors"
      >
        <span className="tracking-widest">{value}</span>
        <span className="text-gray-500 text-xs">{copied ? "✓" : "copy"}</span>
      </button>
    );
  }
  return (
    <div className="bg-white/[0.03] border border-emerald-400/25 rounded-2xl p-4 backdrop-blur-[14px]">
      {label && <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500 mb-2">{label}</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xl font-mono font-semibold">
          {displayValue ?? <span className="text-green-400 tracking-widest">{value}</span>}
        </p>
        <button
          onClick={copy}
          className="flex-shrink-0 px-3.5 py-1.5 bg-emerald-400/10 hover:bg-emerald-400/20 border border-emerald-400/30 text-emerald-400 text-xs font-medium rounded-full transition-colors"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function ThresholdInput({
  value,
  onChange,
  suffix = "%",
  min = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => { setDraft(String(value)); }, [value]);

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={min}
        max={100}
        value={draft}
        onChange={e => {
          setDraft(e.target.value);
          const n = parseInt(e.target.value);
          if (!isNaN(n)) onChange(Math.max(min, Math.min(100, n)));
        }}
        onBlur={() => {
          const n = parseInt(draft);
          const clamped = isNaN(n) ? min : Math.max(min, Math.min(100, n));
          setDraft(String(clamped));
          onChange(clamped);
        }}
        className="w-14 px-2 py-1 bg-white/[0.04] border border-white/[0.10] rounded-lg text-sm text-emerald-400 text-center focus:outline-none focus:border-emerald-400/50"
      />
      <span className="text-gray-500 text-sm">{suffix}</span>
    </div>
  );
}

// ─── Default settings ─────────────────────────────────────────────────────────

function defaultSettings(): AlertSettings {
  return {
    enabled: true,
    subnets: "watchlist",
    scoreChange: { enabled: true, threshold: 10 },
    emissionChange: { enabled: true, threshold: 25 },
    newSignal: { enabled: true },
    whaleActivity: { enabled: false },
    discordEntry: { enabled: false },
    goingViralX: { enabled: false },
    priceMove: { enabled: false, threshold: 10 },
    constActivity: { enabled: false },
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [connected, setConnected] = useState(false);
  const [connUsername, setConnUsername] = useState<string | undefined>();
  const [connFirstName, setConnFirstName] = useState<string | undefined>();
  const [connectedAt, setConnectedAt] = useState<string | undefined>();

  const [code, setCode] = useState<string | null>(null);
  const [codeExpiry, setCodeExpiry] = useState<number>(0);
  const [generating, setGenerating] = useState(false);
  const [codeError, setCodeError] = useState("");

  const [settings, setSettings] = useState<AlertSettings>(defaultSettings());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [testSent, setTestSent] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [pollCount, setPollCount] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  const tier = getTier(session);
  const isPremium = canAccessPremium(tier);

  // ── Load connection status ─────────────────────────────────────────────────

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/alerts/connect");
    if (!res.ok) return;
    const data = await res.json();
    if (data.connected) {
      setConnected(true);
      setConnUsername(data.username);
      setConnFirstName(data.firstName);
      setConnectedAt(data.connectedAt);
      setSettings({ ...defaultSettings(), ...(data.settings ?? {}) });
      setCode(null);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && isPremium) {
      loadStatus();
    }
  }, [status, isPremium, loadStatus]);

  // ── Poll while code is active ──────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;
    const interval = setInterval(async () => {
      setPollCount(c => c + 1);
      const res = await fetch("/api/alerts/connect");
      if (!res.ok) return;
      const data = await res.json();
      if (data.connected) {
        setConnected(true);
        setConnUsername(data.username);
        setConnFirstName(data.firstName);
        setConnectedAt(data.connectedAt);
        setSettings({ ...defaultSettings(), ...(data.settings ?? {}) });
        setCode(null);
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [code, pollCount]);

  // ── Redirect if not authenticated ─────────────────────────────────────────

  if (status === "loading") {
    return (
      <div className="min-h-screen ag-aurora flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Feature showcase — not signed in OR signed in but not premium ─────────

  if (status === "unauthenticated" || !isPremium) {
    const isSignedOut = status === "unauthenticated";
    const alertFeatures: { icon: React.ReactNode; label: string; description: string }[] = [
      {
        icon: <AgIcon name="chart" className="w-5 h-5 text-green-400" />,
        label: "aGap Score Change",
        description: "Get notified the moment a subnet's composite aGap score moves by your threshold — catch momentum shifts before the market reacts.",
      },
      {
        icon: <AgIcon name="bolt" className="w-5 h-5 text-green-400" />,
        label: "Emissions Change",
        description: "Instant alert when a subnet's emission % allocation shifts significantly. Be first to know when validators rotate weight.",
      },
      {
        icon: <AgIcon name="oracle" className="w-5 h-5 text-green-400" />,
        label: "Development Updates",
        description: "Fires every time a GitHub commit spike or HuggingFace model update is detected for subnets on your watchlist. Set a minimum score threshold so you only see the most significant updates.",
      },
      {
        icon: <AgIcon name="whale" className="w-5 h-5 text-green-400" />,
        label: "Whale Activity",
        description: "Large wallets accumulating or distributing on your subnets trigger an immediate alert. See the flow page data before it's priced in.",
      },
      {
        icon: <AgIcon name="chat" className="w-5 h-5 text-green-400" />,
        label: "Discord Alpha",
        description: "AlphaGap scans every Bittensor subnet Discord in real time. When high-quality alpha is posted, you get it straight to Telegram.",
      },
      {
        icon: "𝕏",
        label: "Going Viral on X",
        description: "Top KOLs in the Bittensor ecosystem are tracked 24/7. When a subnet post catches fire, you'll know within minutes.",
      },
      {
        icon: <AgIcon name="money" className="w-5 h-5 text-green-400" />,
        label: "Price Movement",
        description: "Set your own % threshold. Only fires once per 24h per subnet, with a smart delta guard so you won't get spammed by small fluctuations.",
      },
    ];

    return (
      <div className="min-h-screen ag-aurora text-gray-100">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className="relative overflow-hidden">
          <div className="relative max-w-2xl mx-auto px-4 py-14 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/[0.04] border border-emerald-400/25 backdrop-blur-[14px] mb-5">
              <AgIcon name="radar" className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="font-display text-3xl md:text-[40px] font-semibold tracking-[-0.03em] text-white leading-tight mb-4">
              Real-Time Bittensor <span className="ag-gradient-text">Alerts</span><br />
              Straight to Telegram
            </h1>
            <p className="text-sm md:text-[14.5px] text-gray-400 leading-[1.65] max-w-xl mx-auto mb-4">
              Stop refreshing dashboards. AlphaGap monitors every subnet on your watchlist around the clock and pings you the moment something worth acting on happens.
            </p>
            <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-6">
              <span className="ag-live-dot" />
              <span>7 ALERT TYPES · WATCHLIST-SCOPED · INSTANT DELIVERY</span>
            </div>

            {/* How it works steps */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {[
                { step: "1", text: isSignedOut ? "Sign in & upgrade" : "Upgrade to Premium" },
                { step: "2", text: "Connect Telegram" },
                { step: "3", text: "Pick your alerts" },
                { step: "4", text: "Alerts arrive instantly" },
              ].map((s, i, arr) => (
                <React.Fragment key={s.step}>
                  <div className="flex items-center gap-1.5 bg-white/[0.035] border border-white/[0.08] rounded-full pl-1.5 pr-3 py-1 backdrop-blur-[14px]">
                    <span className="w-6 h-6 rounded-full bg-emerald-400/15 border border-emerald-400/35 text-emerald-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {s.step}
                    </span>
                    <span className="text-xs text-gray-400">{s.text}</span>
                  </div>
                  {i < arr.length - 1 && <span className="text-gray-700">→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-10">
          {/* Alert types */}
          <div className="ag-glass p-5 md:p-6 mb-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-400/80 mb-5">7 alert types · all customisable</h2>
            <div>
              <div className="space-y-5">
                {alertFeatures.map(f => (
                  <div key={f.label} className="flex items-start gap-4 pb-5 border-b border-white/[0.06] last:border-0 last:pb-0">
                    <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08]">
                      <span className="text-lg leading-none">{f.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white mb-1">{f.label}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{f.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Watchlist callout */}
          <div className="flex items-start gap-3 bg-emerald-400/[0.05] border border-emerald-400/20 rounded-2xl backdrop-blur-[14px] px-5 py-4 mb-8">
            <AgIcon name="target" className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-400" />
            <div>
              <p className="text-sm font-semibold text-white mb-1">Only the subnets you care about</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Every alert is scoped to your personal watchlist — no noise from subnets you don&apos;t follow. Add or remove subnets from your watchlist anytime and alerts update instantly.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <a
              href="/pricing"
              className="inline-block px-10 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-bold text-lg rounded-full transition-all shadow-xl shadow-green-500/25"
            >
              Upgrade to Premium →
            </a>
            {isSignedOut && (
              <div className="mt-3">
                <a
                  href="/auth/signin"
                  className="inline-block px-8 py-3 bg-white/[0.05] hover:bg-white/[0.09] text-white font-semibold rounded-full transition-colors border border-white/[0.10] backdrop-blur-[14px] text-sm"
                >
                  Sign In
                </a>
              </div>
            )}
            <p className="text-gray-600 text-xs mt-4">Premium plan · $49/mo · Cancel anytime</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function generateCode() {
    setGenerating(true);
    setCodeError("");
    try {
      const res = await fetch("/api/alerts/connect", { method: "POST" });
      const data = await res.json();
      if (data.code) {
        setCode(data.code);
        setCodeExpiry(Date.now() + 10 * 60 * 1000);
      } else {
        setCodeError(data.error || "Failed to generate code");
      }
    } catch {
      setCodeError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/alerts/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (res.ok) {
        setSaveMsg("Settings saved ✓");
        setTimeout(() => setSaveMsg(""), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTestSent(false);
    const res = await fetch("/api/alerts/test", { method: "POST" });
    if (res.ok) {
      setTestSent(true);
      setTimeout(() => setTestSent(false), 5000);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect your Telegram account? You won't receive any more alerts.")) return;
    setDisconnecting(true);
    await fetch("/api/alerts/disconnect", { method: "POST" });
    setConnected(false);
    setConnUsername(undefined);
    setConnFirstName(undefined);
    setConnectedAt(undefined);
    setCode(null);
    setDisconnecting(false);
  }

  function updateAlert<K extends keyof AlertSettings>(
    key: K,
    patch: Partial<AlertSettings[K]>
  ) {
    setSettings(prev => ({
      ...prev,
      [key]: { ...(prev[key] as object), ...patch },
    }));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen ag-aurora text-gray-100">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="relative max-w-2xl mx-auto px-4 pt-9 pb-5">
          <h1 className="font-display text-3xl md:text-[40px] font-semibold tracking-[-0.03em] text-white leading-tight mb-2 flex items-center gap-2.5">
            <AgIcon name="radar" className="w-7 h-7 text-emerald-400" />
            <span>Telegram <span className="ag-gradient-text">Alerts</span></span>
          </h1>
          <p className="text-sm md:text-[14.5px] text-gray-400 leading-[1.65] mb-4">
            Get real-time notifications in Telegram when your subnets hit your thresholds.
          </p>
          <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-wider text-gray-500 uppercase">
            <span className="ag-live-dot" />
            <span>{connected ? "CONNECTED" : "NOT CONNECTED"} · {settings.enabled ? "ALERTS ACTIVE" : "ALERTS PAUSED"} · WATCHLIST-SCOPED</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Watchlist explainer */}
        <div className="flex items-start gap-3 bg-emerald-400/[0.05] border border-emerald-400/20 rounded-2xl backdrop-blur-[14px] px-4 py-3 mb-6">
          <AgIcon name="eye" className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-400" />
          <p className="text-sm text-gray-300 leading-relaxed">
            Alerts fire only for subnets on{" "}
            <a href="/watchlist" className="text-green-400 hover:text-green-300 underline underline-offset-2">your watchlist</a>.
            {" "}Add subnets there to start receiving alerts for them.
          </p>
        </div>

        {/* ── Connection section ────────────────────────────────────────── */}
        <div className="ag-glass p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-400/80">Connection</h2>
            {connected && (
              <div className="ml-auto flex items-center gap-1.5">
                <span className="ag-live-dot" />
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-emerald-400">Connected</span>
              </div>
            )}
          </div>
          <div>
            {connected ? (
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-green-400 font-medium text-sm">
                    {(connFirstName || connUsername) && `as ${connFirstName || ""}${connUsername ? ` (@${connUsername})` : ""}`}
                  </span>
                </div>
                {connectedAt && (
                  <p className="text-gray-600 text-xs mb-4">
                    Connected {new Date(connectedAt).toLocaleDateString()}
                  </p>
                )}
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={sendTest}
                    className="px-4 py-2 text-sm bg-emerald-400/10 border border-emerald-400/30 text-emerald-400 rounded-full hover:bg-emerald-400/20 transition-colors"
                  >
                    {testSent ? "✓ Test sent!" : "Send test message"}
                  </button>
                  <button
                    onClick={disconnect}
                    disabled={disconnecting}
                    className="px-4 py-2 text-sm bg-red-500/10 border border-red-500/20 text-red-400 rounded-full hover:bg-red-500/20 transition-colors"
                  >
                    {disconnecting ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-gray-400 text-sm mb-5">
                  Connect your Telegram account to receive alerts. Takes 30 seconds.
                </p>

                {!code ? (
                  <div>
                    <button
                      onClick={generateCode}
                      disabled={generating}
                      className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 disabled:opacity-50 text-black font-bold rounded-full transition-all shadow-lg shadow-green-500/25 text-sm"
                    >
                      {generating ? "Generating…" : "Get connect code"}
                    </button>
                    {codeError && <p className="text-red-400 text-sm mt-2">{codeError}</p>}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <ol className="space-y-3 text-sm">
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 text-xs flex items-center justify-center font-bold">1</span>
                        <span className="text-gray-300 pt-0.5">
                          Open Telegram and search for{" "}
                          <a
                            href="https://t.me/alphagapalertsbot"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-400 hover:text-green-300 underline"
                          >
                            @alphagapalertsbot
                          </a>
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 text-xs flex items-center justify-center font-bold">2</span>
                        <span className="text-gray-300 pt-0.5">Copy and send this message:</span>
                      </li>
                    </ol>

                    <CopyBlock
                      label="Message to send"
                      value={`/start ${code}`}
                      displayValue={<><span className="text-gray-400">/start </span><span className="text-green-400 font-bold tracking-widest">{code}</span></>}
                    />

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">Just the code:</span>
                      <CopyBlock value={code} compact />
                    </div>

                    <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Waiting for Telegram… · Expires in 10 minutes
                    </div>

                    <button
                      onClick={generateCode}
                      className="text-xs text-gray-600 hover:text-gray-400 underline"
                    >
                      Generate a new code
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Alert settings (only show if connected) ───────────────────── */}
        {connected && (
          <>
            {/* Master toggle */}
            <div className="ag-glass mb-4">
              <div className="flex items-center gap-3 px-5 py-4">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-400/80">Alerts</h2>
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-gray-500 ml-1">
                  {settings.enabled ? "Active" : "Paused"}
                </span>
                <div className="ml-auto">
                  <Toggle
                    enabled={settings.enabled}
                    onChange={v => setSettings(s => ({ ...s, enabled: v }))}
                  />
                </div>
              </div>
            </div>

            {/* Alert types */}
            <div className="ag-glass p-5 mb-6">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-400/80 mb-5">Alert types</h2>
              <div>
                <div className="space-y-5">

                  <AlertRow
                    icon={<AgIcon name="chart" className="w-5 h-5 text-green-400" />}
                    label="aGap score change"
                    description="Fire when a subnet's aGap score moves by at least"
                    enabled={settings.scoreChange.enabled}
                    threshold={settings.scoreChange.threshold}
                    thresholdSuffix="pts"
                    onToggle={v => updateAlert("scoreChange", { enabled: v })}
                    onThreshold={v => updateAlert("scoreChange", { threshold: v })}
                  />

                  <AlertRow
                    icon={<AgIcon name="bolt" className="w-5 h-5 text-green-400" />}
                    label="Emissions change"
                    description="Fire when a subnet's emission % changes by at least"
                    enabled={settings.emissionChange.enabled}
                    threshold={settings.emissionChange.threshold}
                    onToggle={v => updateAlert("emissionChange", { enabled: v })}
                    onThreshold={v => updateAlert("emissionChange", { threshold: v })}
                  />

                  <AlertRow
                    icon={<AgIcon name="oracle" className="w-5 h-5 text-green-400" />}
                    label="Development Updates"
                    description="Fire when a new GitHub commit spike or HuggingFace model update is detected for a subnet on your watchlist"
                    enabled={settings.newSignal.enabled}
                    minScore={settings.newSignal.minScore ?? 0}
                    onToggle={v => updateAlert("newSignal", { enabled: v })}
                    onMinScore={v => updateAlert("newSignal", { minScore: v })}
                  />

                  <AlertRow
                    icon={<AgIcon name="whale" className="w-5 h-5 text-green-400" />}
                    label="Whale activity / volume spike"
                    description="Fire when a large trade or unusual volume spike is detected on the flow page"
                    enabled={settings.whaleActivity.enabled}
                    onToggle={v => updateAlert("whaleActivity", { enabled: v })}
                  />

                  <AlertRow
                    icon={<AgIcon name="chat" className="w-5 h-5 text-green-400" />}
                    label="Discord entry"
                    description="Fire when a notable new Discord post appears on the social page"
                    enabled={settings.discordEntry.enabled}
                    minScore={settings.discordEntry.minScore ?? 0}
                    onToggle={v => updateAlert("discordEntry", { enabled: v })}
                    onMinScore={v => updateAlert("discordEntry", { minScore: v })}
                  />

                  <AlertRow
                    icon="𝕏"
                    label="Going viral on X"
                    description="Fire when a subnet post is trending or going viral on X"
                    enabled={settings.goingViralX.enabled}
                    minScore={settings.goingViralX.minScore ?? 0}
                    onToggle={v => updateAlert("goingViralX", { enabled: v })}
                    onMinScore={v => updateAlert("goingViralX", { minScore: v })}
                  />

                  <AlertRow
                    icon={<AgIcon name="crown" className="w-5 h-5 text-green-400" />}
                    label="Const Tracker"
                    description="Fire when Bittensor founder Const stakes into or unstakes from any subnet"
                    enabled={settings.constActivity?.enabled ?? false}
                    onToggle={v => updateAlert("constActivity", { enabled: v })}
                  />

                  <AlertRow
                    icon={<AgIcon name="money" className="w-5 h-5 text-green-400" />}
                    label="Price movement"
                    description="Fire when the subnet token price moves by at least"
                    enabled={settings.priceMove.enabled}
                    threshold={settings.priceMove.threshold}
                    onToggle={v => updateAlert("priceMove", { enabled: v })}
                    onThreshold={v => updateAlert("priceMove", { threshold: v })}
                  />

                </div>
              </div>
            </div>

            {/* Save */}
            <div className="flex items-center gap-4">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="px-7 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 disabled:opacity-50 text-black font-bold rounded-full transition-all shadow-xl shadow-green-500/25 text-sm"
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
              {saveMsg && <span className="text-green-400 text-sm">{saveMsg}</span>}
            </div>
          </>
        )}

        {/* Footer note */}
        <p className="text-gray-700 text-xs text-center mt-10">
          {user?.email} · Premium plan · alphagap.io/alerts
        </p>
      </div>
    </div>
  );
}

// ─── AlertRow component ───────────────────────────────────────────────────────

function AlertRow({
  icon,
  label,
  description,
  enabled,
  threshold,
  thresholdSuffix = "%",
  minScore,
  onToggle,
  onThreshold,
  onMinScore,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  enabled: boolean;
  threshold?: number;
  thresholdSuffix?: string;
  minScore?: number;
  onToggle: (v: boolean) => void;
  onThreshold?: (v: number) => void;
  onMinScore?: (v: number) => void;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 pb-5 border-b border-white/[0.06] last:border-0 last:pb-0 ${!enabled ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3 flex-1">
        <span className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-xl leading-none">{icon}</span>
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 flex-wrap">
            {description}
            {threshold !== undefined && onThreshold && enabled && (
              <ThresholdInput
                value={threshold}
                onChange={onThreshold}
                suffix={thresholdSuffix}
              />
            )}
          </p>
          {minScore !== undefined && onMinScore && enabled && (
            <p className="text-xs text-gray-600 mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span>Min score:</span>
              <ThresholdInput
                value={minScore}
                onChange={onMinScore}
                suffix="/100"
                min={0}
              />
              <span className="text-gray-700">(0 = all)</span>
            </p>
          )}
        </div>
      </div>
      <Toggle enabled={enabled} onChange={onToggle} />
    </div>
  );
}
