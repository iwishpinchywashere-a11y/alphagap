/**
 * Wallet connect + message signing for the AlphaGap Index.
 * Always imported dynamically (browser-only). Never import at the top of any file.
 *
 * WHY THIS DOES NOT USE web3Enable.
 *
 * The previous version called `web3Enable("AlphaGap Subnet Index")`, which
 * enables EVERY installed extension at once and then pulls accounts from all
 * of them. With two wallets installed in one browser that produced three
 * separate reported problems:
 *
 *   - connecting was slow: web3Enable waits on its own injection timer and
 *     then on every extension's authorisation round-trip, so the slowest
 *     wallet sets the pace even when the user only cares about one;
 *   - the wrong wallet prompted first: both extensions pop their own approval
 *     dialog and the order is whatever the browser injects first, which is not
 *     stable between page loads;
 *   - a wallet chooser appeared only sometimes: that was the non-determinism
 *     showing through, not a feature — nothing in the old code ever asked
 *     which wallet to use.
 *
 * So we enumerate `window.injectedWeb3` ourselves without enabling anything,
 * let the caller present a picker, and enable exactly ONE extension. One
 * approval dialog, from the wallet the user actually chose, every time.
 *
 * Because we bypass web3Enable, `web3FromAddress` would not work either — it
 * reads a registry that only web3Enable populates. We keep the enabled
 * injector here and sign through it directly.
 */

import type { Signer } from "@polkadot/types/types";

export interface WalletAccount {
  address: string;
  name: string;
  source: string; // "talisman" | "subwallet-js" | "polkadot-js" | …
}

export interface InstalledWallet {
  /** Injection key, e.g. "talisman". Pass back to connectWallet(). */
  source: string;
  /** Human label for the picker. */
  name: string;
  version?: string;
}

/** Pretty names for the wallets people actually use on Bittensor. */
const WALLET_LABELS: Record<string, string> = {
  talisman: "Talisman",
  "subwallet-js": "SubWallet",
  "polkadot-js": "Polkadot.js",
  enkrypt: "Enkrypt",
  fearless: "Fearless Wallet",
  nova: "Nova Wallet",
};

interface InjectedLike {
  enable: (origin: string) => Promise<{
    accounts: { get: () => Promise<Array<{ address: string; name?: string }>> };
    // The full injected signer — signPayload as well as signRaw, so it can be
    // handed straight to tx.signAndSend for the proxy grant and unstake batch.
    signer?: Signer;
  }>;
  version?: string;
}

type InjectedWeb3 = Record<string, InjectedLike>;

const getInjectedWeb3 = (): InjectedWeb3 | undefined =>
  (window as unknown as { injectedWeb3?: InjectedWeb3 }).injectedWeb3;

/**
 * Extensions inject asynchronously, so a synchronous read right after load
 * finds nothing. Poll briefly instead of guessing a fixed delay: this returns
 * as soon as the first wallet appears rather than always waiting the worst
 * case, which is most of the perceived "connecting took a long time".
 */
async function waitForInjection(timeoutMs = 3000): Promise<InjectedWeb3> {
  const started = Date.now();
  for (;;) {
    const injected = getInjectedWeb3();
    if (injected && Object.keys(injected).length > 0) return injected;
    if (Date.now() - started > timeoutMs) return injected ?? {};
    await new Promise(r => setTimeout(r, 100));
  }
}

/** Which wallets are installed. Enables nothing, so it triggers no popups. */
export async function listWallets(): Promise<InstalledWallet[]> {
  const injected = await waitForInjection();
  return Object.keys(injected)
    .map(source => ({
      source,
      name: WALLET_LABELS[source] ?? source,
      version: injected[source]?.version,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Nothing in the extension API is guaranteed to settle.
 *
 * `enable()` resolves when the user approves the site in the wallet popup — but
 * if that popup never opens, or opened behind the browser window, or the user
 * previously dismissed or blocked this site (several wallets remember that and
 * silently never re-prompt), the promise simply hangs. A customer sat on a
 * spinner for ten minutes because of this. Never await an extension without a
 * deadline and a message that says what to actually do.
 */
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    p.then(v => { clearTimeout(timer); resolve(v); },
           e => { clearTimeout(timer); reject(e); });
  });
}

/** The injector we enabled, kept so signing does not need web3Enable. */
let activeInjector: Awaited<ReturnType<InjectedLike["enable"]>> | null = null;
let activeSource: string | null = null;

/**
 * Enable ONE extension and return its accounts.
 *
 * Pass the `source` from listWallets(). Omitting it is only safe when exactly
 * one wallet is installed; with several it would reintroduce the ambiguity
 * this module exists to remove, so it throws instead of guessing.
 */
export async function connectWallet(source?: string): Promise<WalletAccount[]> {
  const injected = await waitForInjection();
  const available = Object.keys(injected);

  if (available.length === 0) {
    throw new Error("No Polkadot wallet extension found. Please install Talisman or SubWallet.");
  }

  let chosen = source;
  if (!chosen) {
    if (available.length > 1) {
      throw new Error("MULTIPLE_WALLETS"); // caller must show the picker
    }
    chosen = available[0];
  }

  const target = injected[chosen];
  if (!target?.enable) throw new Error(`Wallet "${chosen}" is not available.`);

  const label = WALLET_LABELS[chosen] ?? chosen;
  const ext = await withTimeout(
    target.enable("AlphaGap Subnet Index"),
    30_000,
    `${label} did not respond. Open the ${label} extension — there may be a pending ` +
    `connection request waiting for approval, possibly behind this window. If you have ` +
    `previously rejected this site, remove it from the wallet's connected-sites or trusted-apps ` +
    `list and try again.`,
  );
  activeInjector = ext;
  activeSource = chosen;

  const accounts = await withTimeout(
    ext.accounts.get(),
    15_000,
    `${label} connected but did not return any accounts. Make sure the wallet is unlocked, ` +
    `then try again.`,
  );
  if (!accounts || accounts.length === 0) {
    throw new Error(
      `No accounts found in ${label}. Create or import an account, ` +
      `and make sure the account is visible to this site.`
    );
  }

  return accounts.map(a => ({
    address: a.address,
    name: a.name ?? a.address.slice(0, 8) + "…",
    source: chosen,
  }));
}

/**
 * Backwards-compatible shim. Throws MULTIPLE_WALLETS when a choice is needed,
 * which is the whole point — the old silent behaviour was the bug.
 */
export async function getWalletAccounts(): Promise<WalletAccount[]> {
  return connectWallet();
}

/** Signs a raw message with the connected wallet. Hex-encoded signature. */
export async function signMessage(address: string, message: string): Promise<string> {
  // Re-enable if the page reloaded or the caller signs before connecting.
  if (!activeInjector && activeSource) await connectWallet(activeSource);
  if (!activeInjector) {
    throw new Error("Wallet not connected. Connect a wallet before signing.");
  }
  if (!activeInjector.signer?.signRaw) {
    throw new Error("Wallet does not support raw message signing.");
  }

  const { signature } = await activeInjector.signer.signRaw({ address, data: message, type: "bytes" });
  return signature;
}

/** The signer for @polkadot/api transactions (proxy grant, unstake batches). */
export async function getSigner(): Promise<Signer> {
  if (!activeInjector && activeSource) await connectWallet(activeSource);
  if (!activeInjector?.signer) throw new Error("Wallet not connected.");
  return activeInjector.signer;
}

/** Which wallet is currently connected, if any. */
export const getActiveSource = () => activeSource;
