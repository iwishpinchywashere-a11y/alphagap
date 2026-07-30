"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getTier, canAccessUltra } from "@/lib/subscription";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import type { SubnetScore } from "@/lib/types";

/* ── Constants ───────────────────────────────────────────────────────────── */
const TS_STRATEGY_ID = "97d1325b-9ee9-4bd1-bd58-893d707f85c4";
const TS_PROXY_ADDRESS = "5CeJG2T47NxUAAc42q2zoU7qV1YFy4khL3ogHxooVjNKxUuw";
const TS_STRATEGY_TABLE = "custom_strategies";
// Bittensor ProxyType enum: ["Any", "NonTransfer", "Governance", "Staking"].
// We grant "Staking" only — the least-privilege type, and the one TrustedStake
// documents. It lets them rebalance stake but NOT transfer the user's TAO.
const TS_PROXY_TYPE = "Staking";
// Joining a PRIVATE strategy still requires an invite — the register endpoint
// rejects it otherwise ("Cannot join private strategy without a share link").
// The signed data takes the share link's UUID as `shareLinkId`; it does NOT
// take the token. Passing the token under any name (shareToken / shareLink /
// inviteToken / …) is rejected by the schema whitelist — that mismatch is why
// every earlier attempt failed. Both values below identify the same link.
const TS_SHARE_LINK_ID = "d17c4847-6316-4bec-a709-0f1cb63ecd73";
// Fallback only: the same invite as a link, if on-site registration ever fails.
const TS_INVITE_URL = "https://app.trustedstake.ai/strat/invite/e6efd855f520660338db05c14baf5fd38a15c0e83e12b6c43b8307b2b9c9d237";

/* ── SVG Icons ───────────────────────────────────────────────────────────── */
const IconChart = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const IconShield = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const IconZap = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);
const IconTarget = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
  </svg>
);
const IconRefresh = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);
const IconLayers = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
  </svg>
);
const IconTrend = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);
const IconDollar = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </svg>
);
const IconUsers = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const IconGlobe = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
);
const IconArrow = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);
const IconCheck = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconChevron = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const IconWallet = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 010-4h14v4" /><path d="M3 5v14a2 2 0 002 2h16v-5" />
    <path d="M18 12a2 2 0 100 4 2 2 0 000-4z" />
  </svg>
);
const IconLoader = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 11-6.219-8.56" />
  </svg>
);
const IconX = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 65) return "text-yellow-400";
  return "text-orange-400";
}

function formatTao(tao: number | null): string {
  if (tao == null) return "—";
  if (tao >= 1000) return `${(tao / 1000).toFixed(1)}k TAO`;
  return `${tao.toFixed(1)} TAO`;
}

/* ── Types ───────────────────────────────────────────────────────────────── */
interface StrategyData {
  strategyId: string;
  name: string;
  apy: number | null;
  aumTao: number | null;
  delegatorsTotal: number | null;
  constituents: Record<string, number>;
  proxyAddress: string;
  strategyTable: string;
  lastUpdated: string | null;
}

interface WalletAccount {
  address: string;
  name: string;
  source: string;
}

type ProxyStep = "idle" | "proxy-connecting" | "proxy-pending" | "proxy-done" | "proxy-error";
type RegisterStep = "idle" | "awaiting" | "success" | "register-error";
type LeaveStep = "idle" | "leaving" | "success" | "error";

/* ── Component ───────────────────────────────────────────────────────────── */
export default function AlphaGapIndexPage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const isUltra = canAccessUltra(tier);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const { leaderboard } = useDashboard();

  // Last rebalance date + ACTUAL strategy holdings from TrustedStake cron
  const [lastRebalancedAt, setLastRebalancedAt] = useState<string | null>(null);
  const [actualHoldings, setActualHoldings] = useState<Array<{ netuid: number; name: string; invest_score: number; weight: number }>>([]);
  React.useEffect(() => {
    fetch("/api/index-status")
      .then(r => r.json())
      .then(d => {
        if (d.rebalancedAt) setLastRebalancedAt(d.rebalancedAt);
        if (Array.isArray(d.holdings) && d.holdings.length > 0) setActualHoldings(d.holdings);
      })
      .catch(() => {});
  }, []);

  // ── Live strategy data ──────────────────────────────────────────────────
  const [strategyData, setStrategyData] = useState<StrategyData | null>(null);
  useEffect(() => {
    fetch("/api/trustedstake/strategy")
      .then(r => r.json())
      .then((d: StrategyData) => setStrategyData(d))
      .catch(() => {});
  }, []);

  // ── Wallet state ────────────────────────────────────────────────────────
  const [walletAccounts, setWalletAccounts] = useState<WalletAccount[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  // ── Membership state ────────────────────────────────────────────────────
  const [isMember, setIsMember] = useState(false);
  // Step 1: proxy setup (independent of Step 2)
  const [proxyStep, setProxyStep] = useState<ProxyStep>("idle");
  const [proxyError, setProxyError] = useState<string | null>(null);
  // Step 2: membership register (independent of Step 1)
  const [registerStep, setRegisterStep] = useState<RegisterStep>("idle");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerWaitNote, setRegisterWaitNote] = useState<string | null>(null);
  const [leaveStep, setLeaveStep] = useState<LeaveStep>("idle");
  const [leaveError, setLeaveError] = useState<string | null>(null);

  // Membership check — TrustedStake's delegator list is the source of truth.
  const checkMembership = useCallback(async (address: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/trustedstake/membership?address=${encodeURIComponent(address)}`);
      if (!res.ok) return false;
      const data = await res.json();
      return data.isMember === true;
    } catch {
      return false;
    }
  }, []);

  // Restore membership when address changes: localStorage for instant paint,
  // then sync with TrustedStake.
  useEffect(() => {
    if (!selectedAddress) { setIsMember(false); return; }
    const stored = localStorage.getItem(`alphagap-ts-member-${selectedAddress}`);
    setIsMember(stored === "true");

    let cancelled = false;
    checkMembership(selectedAddress).then(member => {
      if (cancelled) return;
      setIsMember(member);
      if (member) localStorage.setItem(`alphagap-ts-member-${selectedAddress}`, "true");
      else localStorage.removeItem(`alphagap-ts-member-${selectedAddress}`);
    });
    return () => { cancelled = true; };
  }, [selectedAddress, checkMembership]);

  // ── Connect wallet ──────────────────────────────────────────────────────
  const connectWallet = useCallback(async () => {
    setWalletConnecting(true);
    setWalletError(null);
    try {
      const { getWalletAccounts } = await import("@/lib/polkadot-wallet");
      const accounts = await getWalletAccounts();
      setWalletAccounts(accounts);
      if (accounts.length === 1) {
        setSelectedAddress(accounts[0].address);
      } else {
        setShowAccountPicker(true);
      }
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : "Failed to connect wallet");
    } finally {
      setWalletConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setSelectedAddress(null);
    setWalletAccounts([]);
    setIsMember(false);
    setRegisterStep("idle");
    setLeaveStep("idle");
    setRegisterError(null);
    setLeaveError(null);
  }, []);

  // ── Proxy setup (on-chain tx, fully in-browser via signAndSend) ───────
  //
  // Architecture: @polkadot/api handles all chain-specific payload encoding
  // internally, exactly like TrustedStake's own app. signAndSend triggers the
  // Talisman/SubWallet popup and manages signing + submission in one call.
  //
  // Flow:
  //   1. Dynamic import @polkadot/api (browser only)
  //   2. WsProvider + ApiPromise.create() → connects to chain, downloads metadata
  //   3. api.tx.proxy.addProxy(TS_PROXY_ADDRESS, 0, 0) → build the call
  //   4. web3FromAddress(selectedAddress) → get injector from Talisman/SubWallet
  //   5. signAndSend with 45-second timeout race
  //   6. Resolve on isReady/isBroadcast/isInBlock/isFinalized (tx is on its way)
  //   7. api.disconnect()
  //
  const handleSetupProxy = useCallback(async () => {
    if (!selectedAddress) return;
    setProxyStep("proxy-connecting");
    setProxyError(null);

    try {
      const { ApiPromise, WsProvider } = await import("@polkadot/api");
      const provider = new WsProvider("wss://entrypoint-finney.opentensor.ai:443");
      const api = await ApiPromise.create({ provider });

      try {
        // ── Pre-check: proxy already exists? ─────────────────────────────
        // Skip the transaction entirely if the proxy is already set up.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const proxiesResult: any = await api.query.proxy.proxies(selectedAddress);
        const proxyDefs = proxiesResult[0] ?? proxiesResult;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const alreadySet = Array.isArray(proxyDefs) && proxyDefs.some(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p: any) => (p.delegate?.toString() ?? p.toJSON()?.delegate) === TS_PROXY_ADDRESS
        );
        // NOTE: any proxy type to TrustedStake satisfies their membership check,
        // so an existing `Any` proxy from the old flow still counts — we just
        // never *create* one (see TS_PROXY_TYPE below).
        if (alreadySet) {
          setProxyStep("proxy-done");
          return;
        }

        // ── Build and sign the proxy.addProxy transaction ─────────────────
        const tx = api.tx.proxy.addProxy(TS_PROXY_ADDRESS, TS_PROXY_TYPE, 0);
        const { web3FromAddress } = await import("@polkadot/extension-dapp");
        const injector = await web3FromAddress(selectedAddress);

        setProxyStep("proxy-pending");

        await new Promise<void>((resolve, reject) => {
          let unsub: (() => void) | null = null;

          const timeout = setTimeout(() => {
            unsub?.();
            resolve(); // Tx was submitted — advance even if callback is slow
          }, 45_000);

          const subPromise = tx.signAndSend(
            selectedAddress,
            { signer: injector.signer },
            ({ status, dispatchError }) => {
              if (dispatchError) {
                clearTimeout(timeout);
                unsub?.();
                if (dispatchError.isModule) {
                  try {
                    const decoded = api.registry.findMetaError(dispatchError.asModule);
                    if (decoded.name === "Duplicate") { resolve(); return; }
                    reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`));
                  } catch {
                    reject(new Error(dispatchError.toString()));
                  }
                } else {
                  reject(new Error(dispatchError.toString()));
                }
              } else if (status.isReady || status.isBroadcast || status.isInBlock || status.isFinalized) {
                clearTimeout(timeout);
                unsub?.();
                resolve();
              } else if (status.isDropped || status.isInvalid) {
                clearTimeout(timeout);
                unsub?.();
                reject(new Error("Transaction was dropped or invalid"));
              }
            }
          );

          subPromise.then((fn) => { unsub = fn; }).catch((err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      } finally {
        api.disconnect().catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("cancelled") || msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("user rejected")) {
        setProxyStep("idle");
        return;
      }
      setProxyError(msg);
      setProxyStep("proxy-error");
      return;
    }

    setProxyStep("proxy-done");
  }, [selectedAddress]);

  // ── Join flow ───────────────────────────────────────────────────────────
  // Fully on-site. TrustedStake dropped the private-strategy share-link
  // requirement (verified 2026-07-30), so /membership/register now accepts a
  // signed registration for our private strategy with no invite token.
  //
  // The only gate left is on-chain: the wallet's proxy to TrustedStake must be
  // visible at a *finalized* anchor block. So we
  //   1. read the finalized head,
  //   2. confirm the proxy exists in state at that exact block,
  //   3. sign { proxy, strategyId, strategyTable, fromBlock, fromTimestamp }
  //      (strict schema — any extra key is rejected as INVALID_SIGNED_DATA),
  //   4. POST it through our Ultra-gated /api/trustedstake/join route.
  // Codes flagged retryable (chain not yet finalized / node unavailable) are
  // retried; PROXY_NOT_FOUND means step 1 hasn't finalized yet, so we wait too.
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);
  useEffect(() => stopPolling, [stopPolling]);

  const confirmMembership = useCallback((address: string) => {
    stopPolling();
    localStorage.setItem(`alphagap-ts-member-${address}`, "true");
    setIsMember(true);
    setRegisterStep("success");
  }, [stopPolling]);

  const handleJoin = useCallback(async () => {
    if (!selectedAddress) return;
    stopPolling();
    setRegisterStep("awaiting");
    setRegisterError(null);

    // Already in? Never make an existing member sign anything.
    if (await checkMembership(selectedAddress)) { confirmMembership(selectedAddress); return; }

    const { ApiPromise, WsProvider } = await import("@polkadot/api");
    const { signMessage } = await import("@/lib/polkadot-wallet");
    const api = await ApiPromise.create({
      provider: new WsProvider("wss://entrypoint-finney.opentensor.ai:443"),
      noInitWarn: true,
    });

    try {
      // ── Find an anchor block that is BOTH finalized on TrustedStake's node
      //    and old enough to contain the proxy — before touching the wallet.
      //
      // Registration signatures are single-use, so every failed attempt costs
      // the user a fresh popup. We therefore do all the waiting up front and
      // request exactly one signature, when we know it can succeed.
      let anchor: number | null = null;

      for (let attempt = 0; attempt < 40; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 12_000));

        // TrustedStake's node runs behind chain finality. Ask how far.
        // If the probe is unavailable, fall back to a conservative margin.
        const tsRes = await fetch("/api/trustedstake/anchor").catch(() => null);
        const tsBlock = tsRes?.ok ? (await tsRes.json().catch(() => ({})))?.finalizedBlock : null;

        const ourHash = await api.rpc.chain.getFinalizedHead();
        const ourBlock = (await api.rpc.chain.getHeader(ourHash)).number.toNumber();
        const candidate = typeof tsBlock === "number"
          ? Math.min(tsBlock, ourBlock)
          : ourBlock - 40;

        // The proxy must be visible in state at that exact block.
        const apiAt = await api.at(await api.rpc.chain.getBlockHash(candidate));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [defs] = (await apiAt.query.proxy.proxies(selectedAddress)) as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasProxy = defs?.toJSON?.()?.some?.((p: any) => p.delegate === TS_PROXY_ADDRESS);

        setRegisterWaitNote(
          hasProxy
            ? null
            : "Waiting for the network to confirm your proxy — this usually takes a few minutes."
        );

        if (hasProxy) { anchor = candidate; break; }
      }

      if (anchor === null) {
        setRegisterError("The network hasn't confirmed your proxy yet. Your proxy transaction is safe — click Try Again in a few minutes.");
        setRegisterStep("register-error");
        return;
      }

      setRegisterWaitNote(null);

      // ── One signature, one attempt. ──────────────────────────────────────
      const message = JSON.stringify({
        action: "register_membership",
        timestamp: Date.now(),
        nonce: crypto.randomUUID(),
        data: {
          proxy: TS_PROXY_ADDRESS,
          strategyId: TS_STRATEGY_ID,
          strategyTable: TS_STRATEGY_TABLE,
          shareLinkId: TS_SHARE_LINK_ID,
          fromBlock: anchor,
          fromTimestamp: Date.now(),
        },
      });
      const signature = await signMessage(selectedAddress, message);

      const res = await fetch("/api/trustedstake/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: selectedAddress, signature, message }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) { confirmMembership(selectedAddress); return; }

      // It may still have landed even if the response looked unhappy.
      if (await checkMembership(selectedAddress)) { confirmMembership(selectedAddress); return; }

      setRegisterError(
        data?.code === "PROXY_CHAIN_NOT_READY"
          ? "TrustedStake's node is still catching up to the network. Nothing is wrong with your wallet — click Try Again in a few minutes."
          : (data?.message ?? data?.error ?? `Registration failed (${res.status})`)
      );
      setRegisterStep("register-error");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/cancelled|rejected/i.test(msg)) { setRegisterStep("idle"); return; }
      setRegisterError(msg);
      setRegisterStep("register-error");
    } finally {
      setRegisterWaitNote(null);
      api.disconnect().catch(() => {});
    }
  }, [selectedAddress, checkMembership, confirmMembership, stopPolling]);

  const handleCheckStatus = useCallback(async () => {
    if (!selectedAddress) return;
    setRegisterError(null);
    if (await checkMembership(selectedAddress)) {
      confirmMembership(selectedAddress);
    } else {
      setRegisterError("Not registered yet — complete the join on TrustedStake with this wallet, then check again.");
      setRegisterStep("register-error");
    }
  }, [selectedAddress, checkMembership, confirmMembership]);

  // ── Leave flow ──────────────────────────────────────────────────────────
  const handleLeave = useCallback(async () => {
    if (!selectedAddress) return;
    setLeaveStep("leaving");
    setLeaveError(null);

    try {
      // 1. Build unregister message
      const messageObj = {
        action: "unregister_membership",
        timestamp: Date.now(),
        nonce: crypto.randomUUID(),
        data: {
          proxy: TS_PROXY_ADDRESS,
          strategyId: TS_STRATEGY_ID,
          strategyTable: TS_STRATEGY_TABLE,
        },
      };
      const messageString = JSON.stringify(messageObj);

      // 2. Sign
      const { signMessage } = await import("@/lib/polkadot-wallet");
      const signature = await signMessage(selectedAddress, messageString);

      // 3. POST to leave API
      const leaveRes = await fetch("/api/trustedstake/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: selectedAddress,
          signature,
          message: messageString,
        }),
      });
      const leaveData = await leaveRes.json();
      if (!leaveRes.ok) {
        const detail = leaveData.message ?? leaveData.error ?? `Unregister failed (${leaveRes.status})`;
        throw new Error(detail);
      }

      // 4. Clear membership
      localStorage.removeItem(`alphagap-ts-member-${selectedAddress}`);
      setIsMember(false);
      setLeaveStep("success");
      setRegisterStep("idle");
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : "Failed to leave strategy");
      setLeaveStep("error");
    }
  }, [selectedAddress]);

  const lastRebalancedLabel = useMemo(() => {
    if (!lastRebalancedAt) return "—";
    const d = new Date(lastRebalancedAt);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }, [lastRebalancedAt]);

  // Top 10 by invest_agap (the live aGap investing score)
  const top10 = useMemo(() => {
    return [...leaderboard]
      .filter(s => (s.invest_agap ?? 0) > 0)
      .sort((a, b) => (b.invest_agap ?? 0) - (a.invest_agap ?? 0))
      .slice(0, 10)
      .map((s, i) => {
        const score = s.invest_agap ?? 0;
        return { rank: i + 1, subnet: s, score };
      });
  }, [leaderboard]);

  // Show the ACTUAL strategy holdings (weights set at the last rebalance) so the
  // table matches what members really hold. Falls back to a live top-10 preview
  // only when no rebalance snapshot exists yet.
  const holdings = useMemo(() => {
    if (actualHoldings.length > 0) {
      return actualHoldings.map((ah, i) => {
        const live = leaderboard.find(l => l.netuid === ah.netuid);
        return {
          rank: i + 1,
          subnet: live ?? ({ netuid: ah.netuid, name: ah.name } as SubnetScore),
          score: ah.invest_score,
          weight: ah.weight,
        };
      });
    }
    const totalScore = top10.reduce((sum, h) => sum + h.score, 0);
    return top10.map(h => ({
      ...h,
      weight: totalScore > 0 ? Math.round((h.score / totalScore) * 1000) / 10 : 0,
    }));
  }, [actualHoldings, leaderboard, top10]);

  // Live APY from TrustedStake — no fabricated fallback; the pill hides when unavailable
  const liveApy = strategyData?.apy ?? null;

  return (
    <main className="flex-1 overflow-auto bg-[#07090b] text-white ag-aurora">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 opacity-[0.018]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative w-full px-6 md:px-16 lg:px-24 pt-12 pb-10 text-center flex flex-col items-center">
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] uppercase px-3.5 py-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Ultra Exclusive
            </span>
            <span className="ag-glass !rounded-full inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] uppercase px-3.5 py-1.5 text-gray-400">
              <IconShield className="w-3 h-3" /> Non-Custodial
            </span>
            <span className="ag-glass !rounded-full inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] uppercase px-3.5 py-1.5 text-gray-400">
              <IconRefresh className="w-3 h-3" /> Weekly Rebalance
            </span>
            <span className="ag-glass !rounded-full inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] uppercase px-3.5 py-1.5 text-gray-400">
              Powered by TrustedStake
            </span>
          </div>

          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-semibold tracking-[-0.03em] leading-[1.02] mb-6">
            <span className="block text-white">AlphaGap</span>
            <span className="block ag-gradient-text">Subnet Index</span>
          </h1>

          <p className="font-display text-white text-2xl sm:text-3xl font-medium tracking-tight max-w-4xl leading-snug mb-4">
            Connect your wallet. Deploy your TAO.<br />
            <span className="ag-gradient-text">We do everything else.</span>
          </p>
          <p className="text-gray-400 text-sm sm:text-base max-w-3xl leading-relaxed mb-8">
            aGap picks the top 10 subnets. TrustedStake auto-buys the tokens, manages the portfolio, and rebalances weekly. You sit back, collect APY, and let the formula do the work.
          </p>

          {/* ── Live stats pills ── */}
          {liveApy != null && (
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              <div className="ag-glass !rounded-full flex items-center gap-2 px-4 py-2 text-emerald-400">
                <IconTrend className="w-4 h-4" />
                <span className="font-mono font-semibold text-sm tabular-nums">{liveApy.toFixed(2)}% APY</span>
                <span className="font-mono text-emerald-600 text-[10px] uppercase tracking-[0.14em]">14d</span>
              </div>
            </div>
          )}

          {/* 3-step visual */}
          <div className="flex flex-wrap justify-center items-center gap-3 mb-10">
            {[
              { n: "1", label: "Connect wallet", icon: <IconShield className="w-4 h-4" /> },
              { n: "2", label: "Deploy your TAO", icon: <IconZap className="w-4 h-4" /> },
              { n: "3", label: "Collect APY & relax", icon: <IconTrend className="w-4 h-4" /> },
            ].map((step, i) => (
              <React.Fragment key={step.n}>
                <div className="ag-glass !rounded-full flex items-center gap-2.5 px-4 py-2.5 font-medium text-sm text-gray-200">
                  <span className="text-emerald-400">{step.icon}</span>
                  <span className="font-mono text-white/40 text-xs">{step.n}</span>
                  <span>{step.label}</span>
                </div>
                {i < 2 && <IconArrow className="w-4 h-4 text-gray-700 hidden sm:block" />}
              </React.Fragment>
            ))}
          </div>

          {/* ── Hero CTA — smart flow ── */}
          {!isUltra ? (
            <a href="/pricing" className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black font-bold text-base rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95 mb-8">
              Subscribe to Ultra — $99/mo <IconArrow className="w-4 h-4" />
            </a>
          ) : !selectedAddress ? (
            <div className="flex flex-col items-center gap-3 mb-8">
              <button
                onClick={connectWallet}
                disabled={walletConnecting}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-400 to-green-400 hover:from-emerald-300 hover:to-green-300 disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold text-base rounded-xl transition-all shadow-lg shadow-emerald-500/25 active:scale-95"
              >
                {walletConnecting ? (
                  <><IconLoader className="w-4 h-4 animate-spin" /> Connecting…</>
                ) : (
                  <><IconWallet className="w-4 h-4" /> Connect Wallet</>
                )}
              </button>
              {walletError && (
                <p className="text-sm text-red-400 max-w-xs text-center">{walletError}</p>
              )}
              <p className="text-xs text-gray-500">Supports Talisman &amp; SubWallet</p>
            </div>
          ) : isMember ? (
            <div className="flex flex-col items-center gap-3 mb-8">
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-sm">
                <IconCheck className="w-4 h-4" /> Active Member
              </div>
              <p className="text-xs text-gray-500 font-mono">{selectedAddress.slice(0, 10)}…{selectedAddress.slice(-6)}</p>
              <button
                onClick={handleLeave}
                disabled={leaveStep === "leaving"}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors underline underline-offset-2"
              >
                {leaveStep === "leaving" ? "Leaving…" : "Leave Strategy"}
              </button>
              {leaveError && <p className="text-xs text-red-400">{leaveError}</p>}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 mb-8">
              <div className="ag-glass !rounded-full flex items-center gap-2 text-xs text-gray-400 px-3.5 py-1.5">
                <IconWallet className="w-3.5 h-3.5" />
                <span className="font-mono">{selectedAddress.slice(0, 10)}…{selectedAddress.slice(-6)}</span>
                <button onClick={disconnectWallet} className="text-gray-600 hover:text-gray-400 ml-1 transition-colors"><IconX className="w-3.5 h-3.5" /></button>
              </div>
              <p className="text-sm text-gray-400">Wallet connected — scroll down to join the Index</p>
            </div>
          )}

          {/* Account picker modal */}
          {showAccountPicker && walletAccounts.length > 1 && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAccountPicker(false)} />
              <div className="relative z-10 w-full max-w-sm rounded-[20px] border border-white/10 bg-[#0b0e10] p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-white text-lg">Select Account</h3>
                  <button onClick={() => setShowAccountPicker(false)} className="text-gray-500 hover:text-gray-300 transition-colors"><IconX className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2">
                  {walletAccounts.map(acc => (
                    <button
                      key={acc.address}
                      onClick={() => {
                        setSelectedAddress(acc.address);
                        setShowAccountPicker(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/6 bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <IconWallet className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{acc.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{acc.address.slice(0, 12)}…{acc.address.slice(-6)}</div>
                      </div>
                      <span className="text-xs text-gray-600 flex-shrink-0 ml-auto">{acc.source}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 w-full max-w-lg">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-emerald-500/30" />
            <span className="font-mono text-[10px] text-gray-500 tracking-[0.2em] uppercase whitespace-nowrap">Fundamental · Systematic · Non-custodial</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-emerald-500/30" />
          </div>
        </div>
      </section>

      <div className="px-6 md:px-12">

        {/* ── HOLDINGS (first thing after hero) ───────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <p className="font-mono text-[11px] text-emerald-400/80 uppercase tracking-[0.18em] mb-2">Live Portfolio</p>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-white">Current Index <span className="ag-gradient-text">Holdings</span></h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="ag-glass !rounded-full flex items-center gap-2 font-mono text-[11px] text-gray-400 px-4 py-2">
                <IconRefresh className="w-3 h-3" />
                Last rebalanced: <span className="text-gray-300 font-medium ml-1">{lastRebalancedLabel}</span>
              </div>
            </div>
          </div>

          <div className="ag-glass overflow-hidden relative">
            <div className="flex h-[3px] w-full">
              {holdings.map((h, i) => (
                <div key={h.subnet.netuid} style={{ width: `${h.weight}%`, background: `hsl(${150 - i * 10}, 65%, ${52 - i * 1.5}%)` }} />
              ))}
            </div>
            <div className="relative">
              <div>
                {holdings.length === 0 ? (
                  <p className="px-6 py-12 text-center text-gray-500 text-sm">Loading index data…</p>
                ) : (
                <div className="relative">
                  <div className={!isUltra ? "blur-3xl select-none pointer-events-none" : ""}>
                  <div className="md:hidden divide-y divide-white/[0.04]">
                    {holdings.map((h) => {
                      const s = h.subnet;
                      const change24h = s.price_change_24h ?? null;
                      const change30d = s.price_change_30d ?? null;
                      const emission = s.emission_pct != null ? s.emission_pct * 100 : null;
                      const apy = s.apy_7d != null ? s.apy_7d * 100 : null;
                      const isOpen = expandedRow === s.netuid;
                      return (
                        <div key={s.netuid}>
                          <button className="w-full text-left px-4 py-4 flex items-center gap-3 hover:bg-white/[0.03] transition-colors" onClick={() => isUltra && setExpandedRow(isOpen ? null : s.netuid)}>
                            <span className="text-xs font-bold text-gray-600 w-5 tabular-nums flex-shrink-0">{h.rank}</span>
                            <div className="flex-shrink-0">
                              <SubnetLogo netuid={s.netuid} name={s.name} size={36} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-100 text-base truncate">{s.name}</div>
                              <div className="text-xs text-gray-500">SN{s.netuid} · {s.category ?? s.benchmark_category ?? "—"}</div>
                            </div>
                            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                              <span className={`text-sm font-bold tabular-nums ${scoreColor(h.score)}`}>{h.score}</span>
                              <span className="text-xs text-gray-500">{h.weight}%</span>
                            </div>
                            {isUltra && <IconChevron className={`w-4 h-4 text-gray-600 flex-shrink-0 transition-transform ml-1 ${isOpen ? "rotate-180" : ""}`} />}
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-4 bg-emerald-500/[0.03] border-t border-white/[0.04]">
                              <div className="grid grid-cols-2 gap-2 pt-3 mb-3">
                                {[
                                  { label: "24h", value: change24h != null ? `${change24h >= 0 ? "+" : ""}${change24h.toFixed(1)}%` : "—", color: change24h != null ? (change24h >= 0 ? "text-emerald-400" : "text-red-400") : "text-gray-600" },
                                  { label: "30d", value: change30d != null ? `${change30d >= 0 ? "+" : ""}${change30d.toFixed(1)}%` : "—", color: change30d != null ? (change30d >= 0 ? "text-emerald-400" : "text-red-400") : "text-gray-600" },
                                  { label: "EM %", value: emission != null ? `${emission.toFixed(1)}%` : "—", color: "text-gray-300" },
                                  { label: "APY", value: apy != null ? `${apy.toFixed(0)}%` : "—", color: apy != null && apy >= 20 ? "text-emerald-400" : apy != null && apy >= 10 ? "text-yellow-400" : apy != null ? "text-orange-400" : "text-gray-600" },
                                ].map(stat => (
                                  <div key={stat.label} className="bg-white/[0.03] rounded-lg px-3 py-2">
                                    <div className="text-xs text-gray-500 mb-0.5">{stat.label}</div>
                                    <div className={`text-sm font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs text-gray-500">aGap</span>
                                <div className="ag-scorebar flex-1 !h-1.5">
                                  <i style={{ width: `${h.score}%` }} />
                                </div>
                                <span className={`text-xs font-bold tabular-nums ${scoreColor(h.score)}`}>{h.score}</span>
                              </div>
                              {s.benchmark_summary && (
                                <p className="text-sm text-gray-400 leading-relaxed">{s.benchmark_summary.slice(0, 200)}{s.benchmark_summary.length > 200 ? "…" : ""}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="px-6 py-4 text-left font-mono text-[10.5px] font-medium text-gray-500 uppercase tracking-[0.16em] w-10">#</th>
                          <th className="px-4 py-4 text-left font-mono text-[10.5px] font-medium text-gray-500 uppercase tracking-[0.16em]">Subnet</th>
                          <th className="px-4 py-4 text-left font-mono text-[10.5px] font-medium text-gray-500 uppercase tracking-[0.16em] hidden lg:table-cell">Category</th>
                          <th className="px-4 py-4 text-right font-mono text-[10.5px] font-medium text-gray-500 uppercase tracking-[0.16em]">aGap</th>
                          <th className="px-4 py-4 text-right font-mono text-[10.5px] font-medium text-gray-500 uppercase tracking-[0.16em]">Weight</th>
                          <th className="px-4 py-4 text-right font-mono text-[10.5px] font-medium text-gray-500 uppercase tracking-[0.16em]">24h</th>
                          <th className="px-4 py-4 text-right font-mono text-[10.5px] font-medium text-gray-500 uppercase tracking-[0.16em] hidden lg:table-cell">30d</th>
                          <th className="px-4 py-4 text-right font-mono text-[10.5px] font-medium text-gray-500 uppercase tracking-[0.16em] hidden lg:table-cell">EM %</th>
                          <th className="px-4 py-4 text-right font-mono text-[10.5px] font-medium text-gray-500 uppercase tracking-[0.16em] hidden lg:table-cell">APY</th>
                          <th className="px-4 py-4 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {holdings.map((h) => {
                          const s = h.subnet;
                          const change24h = s.price_change_24h ?? null;
                          const change30d = s.price_change_30d ?? null;
                          const emission = s.emission_pct != null ? s.emission_pct * 100 : null;
                          const apy = s.apy_7d != null ? s.apy_7d * 100 : null;
                          return (
                            <React.Fragment key={s.netuid}>
                              <tr className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors group ${isUltra ? "cursor-pointer" : ""}`} onClick={() => isUltra && setExpandedRow(expandedRow === s.netuid ? null : s.netuid)}>
                                <td className="px-6 py-4"><span className="text-xs font-bold text-gray-500 tabular-nums">{h.rank}</span></td>
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-3 relative">
                                    <div>
                                      <SubnetLogo netuid={s.netuid} name={s.name} size={32} />
                                    </div>
                                    <div>
                                      <div className="font-semibold text-gray-100 text-sm">{s.name}</div>
                                      <div className="text-xs text-gray-500">SN{s.netuid}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4 hidden lg:table-cell"><span className="text-xs text-gray-400 font-medium">{s.category ?? s.benchmark_category ?? "—"}</span></td>
                                <td className="px-4 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="ag-scorebar w-14 !h-1">
                                      <i style={{ width: `${h.score}%` }} />
                                    </div>
                                    <span className={`text-sm font-bold tabular-nums ${scoreColor(h.score)}`}>{h.score}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-right"><span className="text-sm font-semibold text-gray-300 tabular-nums">{h.weight}%</span></td>
                                <td className="px-4 py-4 text-right">
                                  {change24h != null ? <span className={`text-sm font-bold tabular-nums ${change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>{change24h >= 0 ? "+" : ""}{change24h.toFixed(1)}%</span> : <span className="text-gray-600 text-sm">—</span>}
                                </td>
                                <td className="px-4 py-4 text-right hidden lg:table-cell">
                                  {change30d != null ? <span className={`text-sm font-bold tabular-nums ${change30d >= 0 ? "text-emerald-400" : "text-red-400"}`}>{change30d >= 0 ? "+" : ""}{change30d.toFixed(1)}%</span> : <span className="text-gray-600 text-sm">—</span>}
                                </td>
                                <td className="px-4 py-4 text-right hidden lg:table-cell"><span className="text-sm text-gray-300 tabular-nums font-medium">{emission != null ? `${emission.toFixed(1)}%` : "—"}</span></td>
                                <td className="px-4 py-4 text-right hidden lg:table-cell">
                                  <span className={`text-sm font-semibold tabular-nums ${apy != null && apy >= 20 ? "text-emerald-400" : apy != null && apy >= 10 ? "text-yellow-400" : apy != null ? "text-orange-400" : "text-gray-600"}`}>
                                    {apy != null ? `${apy.toFixed(0)}%` : "—"}
                                  </span>
                                </td>
                                <td className="px-4 py-4">{isUltra && <IconChevron className={`w-4 h-4 text-gray-700 group-hover:text-gray-500 transition-all ${expandedRow === s.netuid ? "rotate-180" : ""}`} />}</td>
                              </tr>
                              {expandedRow === s.netuid && (
                                <tr className="border-b border-white/[0.04] bg-emerald-500/[0.03]">
                                  <td colSpan={10} className="px-6 py-3">
                                    <p className="text-sm text-gray-300 leading-relaxed pl-10">
                                      <span className="font-semibold text-emerald-400">aGap Score: {h.score} · </span>
                                      {s.benchmark_summary ? s.benchmark_summary.slice(0, 200) + (s.benchmark_summary.length > 200 ? "…" : "") : "No summary available."}
                                    </p>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                  {!isUltra && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-auto" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(8,8,16,0.88) 0%, rgba(8,8,16,0.5) 100%)" }}>
                      <a
                        href="/subscribe"
                        className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black font-black text-lg rounded-2xl transition-all shadow-2xl shadow-amber-500/30 active:scale-95"
                      >
                        <IconZap className="w-5 h-5" />
                        Upgrade to Ultra
                        <IconArrow className="w-5 h-5" />
                      </a>
                      <p className="text-sm text-gray-400">Unlock live holdings · $99/mo</p>
                    </div>
                  )}
                </div>
                )}
                <div className="px-4 md:px-6 py-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                  {isUltra ? (
                    <p className="text-sm text-gray-400">Tap any row to see the investment thesis.</p>
                  ) : (
                    <a href="/pricing" className="text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors flex items-center gap-1.5">
                      <IconShield className="w-3.5 h-3.5 flex-shrink-0" /> Upgrade to Ultra to reveal the top 10 subnets →
                    </a>
                  )}
                  <p className="text-sm text-gray-500 italic">Live allocations update post-rebalance</p>
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ── JOIN THE INDEX (first occurrence — right under holdings) ────── */}
        <section id="join-section" className="py-16 border-b border-white/5">
          <p className="font-mono text-[11px] text-emerald-400/80 uppercase tracking-[0.18em] mb-4">Delegation</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-3">Deploy Your <span className="ag-gradient-text">TAO</span></h2>
          <p className="text-gray-400 text-base mb-8 max-w-2xl">
            {isUltra
              ? "Two steps to start earning. First, set up your wallet proxy (one-time, on-chain). Then sign one message to join — all without leaving AlphaGap. No TAO leaves your wallet."
              : "The AlphaGap Index is exclusive to Ultra subscribers. Upgrade to deploy your TAO into the top 10 subnets automatically."}
          </p>

          {!isUltra && (
            <a href="/pricing" className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black font-bold text-base rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95">
              Upgrade to Ultra — $99/mo <IconArrow className="w-4 h-4" />
            </a>
          )}

          {isUltra && !selectedAddress && (
            <div className="ag-glass p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <p className="font-display font-semibold text-white text-lg mb-1">Connect your wallet to get started</p>
                <p className="text-gray-400 text-sm">Supports Talisman and SubWallet browser extensions.</p>
              </div>
              <button onClick={connectWallet} disabled={walletConnecting} className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-400 to-green-400 hover:from-emerald-300 hover:to-green-300 disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                {walletConnecting ? <><IconLoader className="w-4 h-4 animate-spin" /> Connecting…</> : <><IconWallet className="w-4 h-4" /> Connect Wallet</>}
              </button>
            </div>
          )}

          {isUltra && selectedAddress && isMember && (
            <div className="rounded-[20px] border border-emerald-500/25 bg-emerald-500/5 backdrop-blur-xl p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center"><IconCheck className="w-4 h-4 text-emerald-400" /></div>
                    <span className="font-bold text-emerald-400 text-lg">Active Member</span>
                  </div>
                  <p className="text-gray-400 text-sm font-mono">{selectedAddress}</p>
                  <p className="text-gray-500 text-xs mt-1">Your wallet is registered with the AlphaGap Subnet Index strategy.</p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <a href={`https://app.trustedstake.ai/?strategy=${TS_STRATEGY_ID}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-sm font-semibold rounded-xl transition-colors">
                    Manage on TrustedStake <IconArrow className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={handleLeave} disabled={leaveStep === "leaving"} className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-white/[0.03] hover:bg-red-500/10 border border-white/8 hover:border-red-500/25 text-gray-500 hover:text-red-400 text-sm rounded-xl transition-all">
                    {leaveStep === "leaving" ? <><IconLoader className="w-3.5 h-3.5 animate-spin" /> Leaving…</> : "Leave Strategy"}
                  </button>
                  {leaveError && <p className="text-xs text-red-400 text-center">{leaveError}</p>}
                </div>
              </div>
            </div>
          )}

          {isUltra && selectedAddress && !isMember && (
            <div className="space-y-4">
              <div className={`rounded-[20px] border p-6 backdrop-blur-xl transition-all ${proxyStep === "proxy-done" ? "border-emerald-500/25 bg-emerald-500/5 opacity-70" : proxyStep === "proxy-connecting" || proxyStep === "proxy-pending" ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/[0.08] bg-white/[0.035]"}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${proxyStep === "proxy-done" ? "bg-emerald-500/20 text-emerald-400" : proxyStep === "proxy-connecting" || proxyStep === "proxy-pending" ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-gray-400"}`}>
                    {proxyStep === "proxy-done" ? <IconCheck className="w-4 h-4" /> : proxyStep === "proxy-connecting" || proxyStep === "proxy-pending" ? <IconLoader className="w-4 h-4 animate-spin" /> : "1"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-white text-base mb-1">Authorise TrustedStake as Proxy</p>
                    <p className="text-gray-400 text-sm mb-4">One-time on-chain transaction. Your wallet signs a message authorising TrustedStake to execute staking on your behalf — your TAO never moves without your instruction.</p>
                    {proxyStep === "idle" && <button onClick={handleSetupProxy} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-black font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95">Set Up Proxy <IconArrow className="w-3.5 h-3.5" /></button>}
                    {proxyStep === "proxy-connecting" && <p className="text-gray-400 text-sm flex items-center gap-2"><IconLoader className="w-4 h-4 animate-spin text-emerald-400" /> Connecting to Bittensor network…</p>}
                    {proxyStep === "proxy-pending" && <p className="text-gray-400 text-sm flex items-center gap-2"><IconLoader className="w-4 h-4 animate-spin text-emerald-400" /> Check your wallet — sign the proxy transaction…</p>}
                    {proxyStep === "proxy-error" && <div className="space-y-3"><p className="text-red-400 text-sm">{proxyError}</p><button onClick={handleSetupProxy} className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/8 text-gray-300 font-semibold text-sm rounded-xl transition-all">Retry</button></div>}
                    {proxyStep === "proxy-done" && <p className="text-emerald-400 text-sm font-medium"><IconCheck className="w-3.5 h-3.5 inline mr-1.5" />Proxy authorised — continue to step 2</p>}
                  </div>
                </div>
              </div>
              <div className={`rounded-[20px] border p-6 backdrop-blur-xl transition-all ${proxyStep !== "proxy-done" ? "border-white/5 bg-white/[0.01] opacity-40 pointer-events-none" : registerStep === "success" ? "border-emerald-500/25 bg-emerald-500/5" : "border-white/[0.08] bg-white/[0.035]"}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${registerStep === "success" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-gray-400"}`}>
                    {registerStep === "success" ? <IconCheck className="w-4 h-4" /> : "2"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-white text-base mb-1">Join the Index</p>
                    <p className="text-gray-400 text-sm mb-4">The AlphaGap Index is a private strategy — access is exclusive to AlphaGap Ultra. Sign one message to confirm your membership. You stay right here; no other site, no extra account.</p>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 mb-4">
                      <p className="text-amber-200/90 text-sm font-semibold mb-1">How much TAO goes in?</p>
                      <p className="text-gray-400 text-sm">All of it. The index uses whatever TAO is in the wallet you connect — there&apos;s no amount to type in. <strong className="text-gray-300">So connect a wallet holding only what you want invested.</strong> Your TAO never leaves your wallet, and you can pull out any time.</p>
                    </div>
                    <p className="text-xs text-gray-500 font-mono mb-4 break-all">Wallet: {selectedAddress}</p>
                    {registerStep === "success" ? (
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm"><IconCheck className="w-4 h-4" /> Membership confirmed — you&apos;re in!</div>
                    ) : registerStep === "register-error" ? (
                      <div className="space-y-3">
                        <p className="text-sm text-red-400">{registerError}</p>
                        <div className="flex flex-wrap gap-3">
                          <button onClick={handleJoin} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-400 to-green-400 text-black font-bold text-sm rounded-xl transition-all active:scale-95">Try Again <IconRefresh className="w-3.5 h-3.5" /></button>
                          <button onClick={handleCheckStatus} className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/8 text-gray-300 font-semibold text-sm rounded-xl transition-all">Check Status <IconRefresh className="w-3.5 h-3.5" /></button>
                          <a href={TS_INVITE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors">Join on TrustedStake instead <IconArrow className="w-3.5 h-3.5" /></a>
                        </div>
                      </div>
                    ) : registerStep === "awaiting" ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-gray-400 text-sm"><IconLoader className="w-4 h-4 animate-spin text-emerald-400" /> {registerWaitNote ?? "Registering your membership…"}</div>
                        <p className="text-xs text-gray-500">Keep this tab open. Your wallet will ask you to sign <strong className="text-gray-400">once</strong>, and only when the network is ready — if no popup has appeared yet, nothing is stuck.</p>
                      </div>
                    ) : (
                      <button onClick={handleJoin} disabled={proxyStep !== "proxy-done"} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-400 to-green-400 hover:from-emerald-300 hover:to-green-300 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                        Join the Index <IconArrow className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── THE PROBLEM ─────────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <p className="font-mono text-[11px] text-emerald-400/80 uppercase tracking-[0.18em] mb-4">Why This Exists</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight mb-8">
            128 subnets.<br />
            <span className="text-gray-500">One portfolio.</span><br />
            <span className="ag-gradient-text">Zero guesswork.</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: <IconLayers className="w-5 h-5" />, color: "text-red-400 bg-red-500/10 border-red-500/20", title: "Too Many Subnets", desc: "128 subnets and counting. New ones launch weekly. You can't track them all." },
              { icon: <IconShield className="w-5 h-5" />, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", title: "Too Much Complexity", desc: "Validator selection, dTAO mechanics, stake allocation — it takes 1,400+ hours to master." },
              { icon: <IconChart className="w-5 h-5" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", title: "Impossible To React", desc: "The Bittensor ecosystem evolves faster than any human can track. Our AI scores every subnet in real time — so the index always reflects what's happening now, not last week." },
            ].map(p => (
              <div key={p.title} className="ag-glass ag-glass-hover flex gap-4 p-5">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${p.color}`}>{p.icon}</div>
                <div>
                  <div className="font-display font-semibold text-white text-lg mb-1">{p.title}</div>
                  <p className="text-base text-gray-400 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── APY SECTION ──────────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <p className="font-mono text-[11px] text-emerald-400/80 uppercase tracking-[0.18em] mb-4">The Yield</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-3">APY compounds fast.<br /><span className="ag-gradient-text">Really fast.</span></h2>
          <p className="text-gray-400 text-lg mb-10 max-w-2xl">Bittensor subnets pay out emissions continuously. When that yield is automatically reinvested — across 10 of the highest-performing subnets — it compounds in ways most TAO holders never experience.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { label: "1 TAO invested", apy: 25, years: 3, result: "~1.95 TAO", note: "at 25% APY, 3 years" },
              { label: "10 TAO invested", apy: 30, years: 3, result: "~21.9 TAO", note: "at 30% APY, 3 years" },
              { label: "100 TAO invested", apy: 35, years: 5, result: "~452 TAO", note: "at 35% APY, 5 years" },
            ].map(c => (
              <div key={c.label} className="ag-glass ag-glass-hover p-6 text-center">
                <p className="text-[10.5px] uppercase tracking-[0.16em] text-gray-500 mb-2.5">{c.label}</p>
                <p className="font-display text-4xl font-semibold tracking-tight ag-gradient-text mb-1.5 tabular-nums">{c.result}</p>
                <p className="font-mono text-[10.5px] text-gray-500">{c.note}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: <IconTrend className="w-5 h-5" />, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", title: "Emissions every block", desc: "Bittensor pays out emissions continuously — not monthly, not quarterly. Every block." },
              { icon: <IconRefresh className="w-5 h-5" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", title: "Auto-compounded", desc: "Gain exposure to a curated basket of high-yielding alpha tokens — aGap's top picks — while earning sustainable, healthy yields that compound automatically across every position." },
              { icon: <IconDollar className="w-5 h-5" />, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", title: "Spread across top 10", desc: "10 high-conviction subnets means your APY isn't riding on any single subnet's performance." },
            ].map(f => (
              <div key={f.title} className="ag-glass ag-glass-hover flex gap-4 p-5">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${f.color}`}>{f.icon}</div>
                <div>
                  <div className="font-display font-semibold text-white text-lg mb-1">{f.title}</div>
                  <p className="text-base text-gray-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-4">Illustrative projections only. APY varies by subnet and market conditions.</p>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <p className="font-mono text-[11px] text-emerald-400/80 uppercase tracking-[0.18em] mb-4">The System</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-10">How it <span className="ag-gradient-text">works</span></h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { n: "01", icon: <IconChart className="w-5 h-5" />, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", title: "AlphaGap Watches All 128", body: "Live data across every subnet — benchmarks, whale flows, founder signals, emissions." },
              { n: "02", icon: <IconTarget className="w-5 h-5" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", title: "aGap Scores Each One", body: "Our formula ranks every subnet on performance, revenue, on-chain signals, and team execution." },
              { n: "03", icon: <IconTrend className="w-5 h-5" />, color: "text-violet-400 bg-violet-500/10 border-violet-500/20", title: "Top 10 Selected", body: "Weekly, the 10 highest-conviction subnets form the index. No emotion — only data." },
              { n: "04", icon: <IconZap className="w-5 h-5" />, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", title: "TrustedStake Executes", body: "Your TAO is deployed and rebalanced automatically. Yield compounded. You do nothing." },
            ].map(s => (
              <div key={s.n} className="ag-glass ag-glass-hover relative p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${s.color}`}>{s.icon}</div>
                  <span className="font-mono text-xs text-white/25 tabular-nums">{s.n}</span>
                </div>
                <div className="font-display font-semibold text-white text-lg mb-2">{s.title}</div>
                <p className="text-base text-gray-400 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── aGAP METHODOLOGY ─────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <p className="font-mono text-[11px] text-emerald-400/80 uppercase tracking-[0.18em] mb-4">The Formula</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-3">aGap Investing <span className="ag-gradient-text">Methodology</span></h2>
          <p className="text-gray-400 text-lg mb-10 max-w-2xl">Built for long-term investing — not trading. We back subnets with real products, real customers, and real teams.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: <IconTarget className="w-5 h-5" />, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Real-World Performance", detail: "Head-to-head benchmarks against centralised competitors. Not self-reported metrics." },
              { icon: <IconDollar className="w-5 h-5" />, color: "text-green-400 bg-green-500/10 border-green-500/20", label: "Revenue Potential", detail: "Real customers, product traction, and clear paths to monetisation." },
              { icon: <IconTrend className="w-5 h-5" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", label: "On-Chain Signals", detail: "Whale accumulation, stake velocity, and validator confidence — before narratives catch up." },
              { icon: <IconUsers className="w-5 h-5" />, color: "text-violet-400 bg-violet-500/10 border-violet-500/20", label: "Team & Execution", detail: "Shipping cadence, founder track record, and real community health." },
            ].map(f => (
              <div key={f.label} className="ag-glass ag-glass-hover flex gap-4 p-5">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${f.color}`}>{f.icon}</div>
                <div>
                  <div className="font-display font-semibold text-white text-lg mb-1">{f.label}</div>
                  <p className="text-base text-gray-400 leading-relaxed">{f.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── TRUSTEDSTAKE ─────────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <p className="font-mono text-[11px] text-emerald-400/80 uppercase tracking-[0.18em] mb-4">Our Partner</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-3">TrustedStake <span className="ag-gradient-text">Infrastructure</span></h2>
          <p className="text-gray-400 text-lg mb-10 max-w-2xl">Non-custodial enterprise staking for Bittensor. Trusted by Kraken Institutional, Talisman, and SubWallet.
            <a href="https://trustedstake.ai" target="_blank" rel="noopener noreferrer" className="ml-2 text-emerald-400 hover:text-emerald-300 transition-colors">trustedstake.ai →</a>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <IconShield className="w-5 h-5" />, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", title: "Non-Custodial", desc: "Your TAO never leaves your wallet. Ever." },
              { icon: <IconZap className="w-5 h-5" />, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", title: "One-Click Deploy", desc: "Connect your wallet, set your amount, done." },
              { icon: <IconRefresh className="w-5 h-5" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", title: "Auto Rebalancing", desc: "Index rotates weekly. TrustedStake handles the rest." },
              { icon: <IconTrend className="w-5 h-5" />, color: "text-violet-400 bg-violet-500/10 border-violet-500/20", title: "Yield Compounding", desc: "Root network yield automatically reinvested into your positions." },
              { icon: <IconTarget className="w-5 h-5" />, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", title: "Best Validators", desc: "Continuous monitoring picks the highest-yielding validators per subnet." },
              { icon: <IconGlobe className="w-5 h-5" />, color: "text-rose-400 bg-rose-500/10 border-rose-500/20", title: "Enterprise Security", desc: "Same standards as their Kraken Institutional partnership." },
            ].map(f => (
              <div key={f.title} className="ag-glass ag-glass-hover flex gap-4 p-5">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${f.color}`}>{f.icon}</div>
                <div>
                  <div className="font-display font-semibold text-white text-lg mb-1">{f.title}</div>
                  <p className="text-base text-gray-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── JOIN THE INDEX (second occurrence — compact mid-page CTA) ──── */}
        <section className="py-16 border-b border-white/5">
          <div className="relative rounded-[20px] overflow-hidden border border-emerald-500/20 backdrop-blur-xl p-8 md:p-10" style={{ background: "radial-gradient(ellipse 80% 80% at 50% 0%, rgba(52,211,153,0.08) 0%, rgba(255,255,255,0.03) 60%)" }}>
            <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)", backgroundSize: "30px 30px" }} />
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
              <div>
                <p className="font-mono text-[11px] text-emerald-400/80 uppercase tracking-[0.18em] mb-3">Start Earning</p>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-white mb-2">Ready to deploy your <span className="ag-gradient-text">TAO</span>?</h2>
                <p className="text-gray-400 text-base max-w-md">Connect your wallet and join the AlphaGap Index — aGap picks the top 10, TrustedStake handles everything else.</p>
              </div>
              <div className="flex-shrink-0">
                {!isUltra ? (
                  <a href="/pricing" className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black font-bold text-base rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95 whitespace-nowrap">
                    Upgrade to Ultra — $99/mo <IconArrow className="w-4 h-4" />
                  </a>
                ) : isMember ? (
                  <div className="flex items-center gap-3 px-6 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                    <IconCheck className="w-5 h-5 text-emerald-400" />
                    <span className="font-bold text-emerald-400">Active Member</span>
                  </div>
                ) : selectedAddress ? (
                  <a href="#join-section" onClick={e => { e.preventDefault(); document.getElementById("join-section")?.scrollIntoView({ behavior: "smooth" }); }} className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-400 to-green-400 hover:from-emerald-300 hover:to-green-300 text-black font-bold text-base rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 whitespace-nowrap">
                    Complete Registration <IconArrow className="w-4 h-4" />
                  </a>
                ) : (
                  <button onClick={connectWallet} disabled={walletConnecting} className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-400 to-green-400 hover:from-emerald-300 hover:to-green-300 disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold text-base rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 whitespace-nowrap">
                    {walletConnecting ? <><IconLoader className="w-4 h-4 animate-spin" /> Connecting…</> : <><IconWallet className="w-4 h-4" /> Connect Wallet &amp; Join</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── ORACLE SECTION ───────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <div className="relative rounded-[20px] overflow-hidden border border-emerald-500/15 backdrop-blur-xl p-8 md:p-12" style={{ background: "radial-gradient(ellipse 80% 80% at 0% 50%, rgba(52,211,153,0.07) 0%, rgba(255,255,255,0.03) 60%)" }}>
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative flex flex-col md:flex-row gap-8 items-center justify-between">
              <div>
                <p className="font-mono text-[11px] text-emerald-400/80 uppercase tracking-[0.18em] mb-4">Intelligence Layer</p>
                <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-3">AlphaGap watches.<br />The Index <span className="ag-gradient-text">acts</span>.</h2>
                <p className="text-gray-400 text-lg mb-6 max-w-lg">Scores stay current between rebalances — live data, whale movements, founder signals, benchmark updates. Not a spreadsheet.</p>
                <a href="/oracle" className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-base font-semibold rounded-xl transition-colors">
                  Ask the Oracle <IconArrow className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section className="py-16 border-b border-white/5">
          <p className="font-mono text-[11px] text-emerald-400/80 uppercase tracking-[0.18em] mb-4 text-center">Questions</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-8 text-center">Common <span className="ag-gradient-text">questions</span></h2>
          <div className="space-y-2 max-w-3xl mx-auto">
            {[
              { q: "Is my TAO safe?", a: "Yes. Non-custodial — your TAO never leaves your wallet. TrustedStake only executes delegations on your behalf via a proxy you control." },
              { q: "What wallets are supported?", a: "Talisman and SubWallet. Both are Bittensor-native and available as browser extensions." },
              { q: "How often does the index rebalance?", a: "Weekly — every Sunday the index re-targets the top 10 subnets by aGap Investing Score." },
              { q: "What does it cost?", a: "Index access is included in Ultra for $99/mo." },
              { q: "What is a proxy address?", a: "A TrustedStake proxy is a Bittensor account you authorize to move stake on your behalf. You set it up once in the TrustedStake app, and it allows automated rebalancing without needing your signature every time." },
              { q: "How do I leave the strategy?", a: "Click 'Leave Strategy' in the delegation section above. Your TAO stays in your wallet — you're just unregistering from the automated strategy." },
            ].map((faq, i) => (
              <div key={faq.q} className="ag-glass !rounded-2xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                >
                  <span className="font-display font-semibold text-white text-base">{faq.q}</span>
                  <IconChevron className={`w-4 h-4 text-gray-600 flex-shrink-0 transition-transform ${expandedFaq === i ? "rotate-180" : ""}`} />
                </button>
                {expandedFaq === i && (
                  <div className="px-5 pb-4 border-t border-white/5">
                    <p className="text-base text-gray-300 leading-relaxed pt-4">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <section className="py-16">
          <div className="relative rounded-[20px] overflow-hidden border border-amber-500/20 backdrop-blur-xl p-10 text-center" style={{ background: "radial-gradient(ellipse 80% 80% at 50% 0%, rgba(245,158,11,0.07) 0%, rgba(255,255,255,0.03) 60%)" }}>
            <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)", backgroundSize: "30px 30px" }} />
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
                <svg className="w-6 h-6 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              </div>
              {isUltra ? (
                <>
                  <h2 className="font-display text-3xl font-semibold tracking-tight text-white mb-3">You&apos;re ready to deploy</h2>
                  <p className="text-gray-500 text-sm mb-7 max-w-md mx-auto leading-relaxed">
                    {isMember
                      ? "Your wallet is registered with the AlphaGap Subnet Index. Sit back — TrustedStake handles everything from here."
                      : "Connect your wallet and join the Index above to start earning. The entire flow takes under 2 minutes."}
                  </p>
                  {isMember ? (
                    <a href="https://app.trustedstake.ai" target="_blank" rel="noopener noreferrer" className="inline-block bg-gradient-to-r from-emerald-400 to-green-400 hover:from-emerald-300 hover:to-green-300 text-black text-sm font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                      Manage on TrustedStake →
                    </a>
                  ) : (
                    <button
                      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                      className="inline-block bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black text-sm font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                    >
                      Connect Wallet →
                    </button>
                  )}
                </>
              ) : (
                <>
                  <h2 className="font-display text-3xl font-semibold tracking-tight text-white mb-3">Unlock the Index</h2>
                  <p className="text-gray-500 text-sm mb-7 max-w-md mx-auto leading-relaxed">The AlphaGap Subnet Index is exclusive to Ultra. Upgrade for live holdings, portfolio deploy, and 20 Oracle queries per day.</p>
                  <a href="/pricing" className="inline-block bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black text-sm font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95">
                    Upgrade to Ultra →
                  </a>
                </>
              )}
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
