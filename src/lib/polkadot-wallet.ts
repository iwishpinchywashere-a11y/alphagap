/**
 * Thin wrapper around @polkadot/extension-dapp for wallet connect + message signing.
 * Always imported dynamically (browser-only). Never import at the top of any file.
 *
 * Usage:
 *   const { getWalletAccounts, signMessage } = await import("@/lib/polkadot-wallet");
 */

export interface WalletAccount {
  address: string;
  name: string;
  source: string; // "talisman" | "subwallet-js" | etc.
}

/**
 * Enables all installed extensions and returns all available accounts.
 * Throws if no extensions are found or user denies access.
 */
export async function getWalletAccounts(): Promise<WalletAccount[]> {
  const { web3Enable, web3Accounts } = await import("@polkadot/extension-dapp");

  const extensions = await web3Enable("AlphaGap Subnet Index");
  if (extensions.length === 0) {
    throw new Error(
      "No Polkadot wallet extension found. Please install Talisman or SubWallet."
    );
  }

  const accounts = await web3Accounts();
  if (accounts.length === 0) {
    throw new Error(
      "No accounts found. Please create or import an account in your wallet extension."
    );
  }

  return accounts.map((a) => ({
    address: a.address,
    name: a.meta.name ?? a.address.slice(0, 8) + "…",
    source: a.meta.source ?? "unknown",
  }));
}

/**
 * Signs a raw message bytes payload with the given address.
 * Returns a hex-encoded signature string.
 */
export async function signMessage(address: string, message: string): Promise<string> {
  const { web3FromAddress } = await import("@polkadot/extension-dapp");

  const injector = await web3FromAddress(address);
  if (!injector.signer?.signRaw) {
    throw new Error("Wallet does not support raw message signing.");
  }

  const { signature } = await injector.signer.signRaw({
    address,
    data: message,
    type: "bytes",
  });

  return signature;
}
