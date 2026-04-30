"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { getTier, canAccessPremium } from "@/lib/subscription";
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

function ThresholdInput({
  value,
  onChange,
  suffix = "%",
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={1}
        max={100}
        value={value}
        onChange={e => onChange(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
        className="w-14 px-2 py-1 bg-[#0f1117] border border-gray-700 rounded text-sm text-green-400 text-center focus:outline-none focus:border-green-500"
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
      // Merge with defaults so any new fields missing from stored settings get safe values
      setSettings({ ...defaultSettings(), ...(data.settings ?? {}) });
      setCode(null);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && isPremium) {
      loadStatus();
    }
  }, [status, isPremium, loadStatus]);

  // ── Poll while code is active (waiting for user to /start on Telegram) ─────
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
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-green-400 text-2xl animate-spin">⟳</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin");
    return null;
  }

  // ── Premium gate ───────────────────────────────────────────────────────────

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-gray-100 flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-6">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-3">Premium Required</h1>
          <p className="text-gray-400 mb-8">
            Telegram alerts are a <span className="text-green-400 font-semibold">Premium</span> feature.
            Upgrade to get real-time alerts directly in your Telegram when subnets hit your thresholds.
          </p>
          <a
            href="/pricing"
            className="inline-block px-8 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg transition-colors"
          >
            Upgrade to Premium
          </a>
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
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">📡</span>
            <h1 className="text-3xl font-bold text-white">Telegram Alerts</h1>
          </div>
          <p className="text-gray-400 text-sm ml-12">
            Get real-time notifications in Telegram when your subnets hit your thresholds.
          </p>
        </div>

        {/* ── Connection section ────────────────────────────────────────── */}
        <section className="bg-[#0f1117] border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Connection</h2>

          {connected ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 shadow shadow-green-500/50" />
                <span className="text-green-400 font-medium">Connected</span>
                {(connFirstName || connUsername) && (
                  <span className="text-gray-400 text-sm">
                    as {connFirstName || ""}{connUsername ? ` (@${connUsername})` : ""}
                  </span>
                )}
              </div>
              {connectedAt && (
                <p className="text-gray-600 text-xs mb-4">
                  Connected {new Date(connectedAt).toLocaleDateString()}
                </p>
              )}
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={sendTest}
                  className="px-4 py-2 text-sm bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors"
                >
                  {testSent ? "✓ Test sent!" : "Send test message"}
                </button>
                <button
                  onClick={disconnect}
                  disabled={disconnecting}
                  className="px-4 py-2 text-sm bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
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
                    className="px-5 py-2.5 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg transition-colors text-sm"
                  >
                    {generating ? "Generating…" : "Get connect code"}
                  </button>
                  {codeError && <p className="text-red-400 text-sm mt-2">{codeError}</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Step instructions */}
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
                      <span className="text-gray-300 pt-0.5">
                        Send the message:{" "}
                        <code className="bg-[#1a1f2e] text-green-400 px-2 py-0.5 rounded text-sm font-mono">
                          /start {code}
                        </code>
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 text-xs flex items-center justify-center font-bold">3</span>
                      <span className="text-gray-300 pt-0.5">This page will update automatically once connected</span>
                    </li>
                  </ol>

                  {/* Code display */}
                  <div className="bg-[#0a0a0f] border border-green-500/30 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Your connect code</p>
                      <p className="text-3xl font-mono font-bold tracking-[0.25em] text-green-400">{code}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-2">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Waiting for Telegram…
                      </div>
                      <p className="text-xs text-gray-600">Expires in 10 minutes</p>
                    </div>
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
        </section>

        {/* ── Alert settings (only show if connected) ───────────────────── */}
        {connected && (
          <>
            {/* Master toggle */}
            <section className="bg-[#0f1117] border border-gray-800 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Alerts</h2>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {settings.enabled ? "Alerts are active" : "All alerts paused"}
                  </p>
                </div>
                <Toggle
                  enabled={settings.enabled}
                  onChange={v => setSettings(s => ({ ...s, enabled: v }))}
                />
              </div>
            </section>

            {/* Alert types */}
            <section className="bg-[#0f1117] border border-gray-800 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-5">Alert types</h2>
              <div className="space-y-5">

                <AlertRow
                  icon="📊"
                  label="aGap score change"
                  description="Fire when a subnet's aGap score moves by at least"
                  enabled={settings.scoreChange.enabled}
                  threshold={settings.scoreChange.threshold}
                  thresholdSuffix="pts"
                  onToggle={v => updateAlert("scoreChange", { enabled: v })}
                  onThreshold={v => updateAlert("scoreChange", { threshold: v })}
                />

                <AlertRow
                  icon="⚡"
                  label="Emissions change"
                  description="Fire when a subnet's emission % changes by at least"
                  enabled={settings.emissionChange.enabled}
                  threshold={settings.emissionChange.threshold}
                  onToggle={v => updateAlert("emissionChange", { enabled: v })}
                  onThreshold={v => updateAlert("emissionChange", { threshold: v })}
                />

                <AlertRow
                  icon="🔮"
                  label="New signal"
                  description="Fire when a new alpha signal is posted on the signals page"
                  enabled={settings.newSignal.enabled}
                  onToggle={v => updateAlert("newSignal", { enabled: v })}
                />

                <AlertRow
                  icon="🐋"
                  label="Whale activity / volume spike"
                  description="Fire when a large trade or unusual volume spike is detected on the flow page"
                  enabled={settings.whaleActivity.enabled}
                  onToggle={v => updateAlert("whaleActivity", { enabled: v })}
                />

                <AlertRow
                  icon="💬"
                  label="Discord entry"
                  description="Fire when a notable new Discord post appears on the social page"
                  enabled={settings.discordEntry.enabled}
                  onToggle={v => updateAlert("discordEntry", { enabled: v })}
                />

                <AlertRow
                  icon="𝕏"
                  label="Going viral on X"
                  description="Fire when a subnet post is trending or going viral on X"
                  enabled={settings.goingViralX.enabled}
                  onToggle={v => updateAlert("goingViralX", { enabled: v })}
                />

                <AlertRow
                  icon="💰"
                  label="Price movement"
                  description="Fire when the subnet token price moves by at least"
                  enabled={settings.priceMove.enabled}
                  threshold={settings.priceMove.threshold}
                  onToggle={v => updateAlert("priceMove", { enabled: v })}
                  onThreshold={v => updateAlert("priceMove", { threshold: v })}
                />

              </div>
            </section>

            {/* Save */}
            <div className="flex items-center gap-4">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="px-6 py-2.5 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold rounded-lg transition-colors text-sm"
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
              {saveMsg && <span className="text-green-400 text-sm">{saveMsg}</span>}
            </div>
          </>
        )}

        {/* Footer note */}
        <p className="text-gray-700 text-xs text-center mt-12">
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
  onToggle,
  onThreshold,
}: {
  icon: string;
  label: string;
  description: string;
  enabled: boolean;
  threshold?: number;
  thresholdSuffix?: string;
  onToggle: (v: boolean) => void;
  onThreshold?: (v: number) => void;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 pb-5 border-b border-gray-800/60 last:border-0 last:pb-0 ${!enabled ? "opacity-50" : ""}`}>
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
        </div>
      </div>
      <Toggle enabled={enabled} onChange={onToggle} />
    </div>
  );
}
