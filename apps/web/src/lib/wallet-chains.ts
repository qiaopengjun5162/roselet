/**
 * Single source of truth for **which chains Roselet connects** and what each
 * one is for.
 *
 * Before this module the app grew a bespoke wallet list per screen — the login
 * page, the membership centre and the mint panel each rendered their own copy
 * of "detected Solana wallets", and the Aleo page carried yet another bare
 * "connect Leo Wallet" button. That is four entries for two chains, and every
 * new wallet meant editing three files.
 *
 * The wallet picker renders this registry instead: one entry per chain, one
 * component for the UI, one entry button. Adding a chain is a data change.
 *
 * `mode` decides how a chain gets connected:
 *  - `"inline"`  — the picker can connect it in place. Solana wallets expose
 *    the Wallet Standard on `window`, so no provider has to be mounted.
 *  - `"external"` — connecting needs a React provider that would otherwise be
 *    bundled onto every page (Aleo's adapter drags in the whole Leo SDK, and
 *    the product rule is that the plain app ships zero Web3 code). The picker
 *    links to the page that owns that provider instead of pretending it can
 *    connect from anywhere.
 */

export type WalletChainId = "solana" | "aleo";

export interface WalletChainMeta {
  id: WalletChainId;
  /** Display name, shown as the group heading. */
  label: string;
  /** What this chain is actually used for — users should not have to guess. */
  purpose: string;
  mode: "inline" | "external";
  /** Where `mode: "external"` sends the user. */
  href?: string;
}

export const WALLET_CHAINS: readonly WalletChainMeta[] = [
  {
    id: "solana",
    label: "Solana",
    purpose: "会员身份 · 玫瑰上链 · NFT 纪念",
    mode: "inline",
  },
  {
    id: "aleo",
    label: "Aleo",
    purpose: "私密 Vault · 需要单独连接",
    mode: "external",
    href: "/private-vault",
  },
];

/** A wallet the picker can render. */
export interface WalletOption {
  /** Stable id across chains: `"solana:Phantom"`. Safe as a React key. */
  id: string;
  chain: WalletChainId;
  name: string;
  icon?: string;
}

export function chainMeta(id: WalletChainId): WalletChainMeta {
  const found = WALLET_CHAINS.find((chain) => chain.id === id);
  if (!found) {
    // A typo in a chain id must not silently render nothing.
    throw new Error(`未注册的钱包链：${id}`);
  }
  return found;
}

/** Tag the Wallet Standard list with its chain so the picker can group it. */
export function toWalletOptions(
  wallets: readonly { name: string; icon?: string }[],
): WalletOption[] {
  return wallets.map((wallet) => ({
    id: `solana:${wallet.name}`,
    chain: "solana",
    name: wallet.name,
    icon: wallet.icon,
  }));
}

/**
 * Aleo ships exactly one adapter today (`LeoWalletAdapter`). It is declared
 * here rather than in the page so the picker has no second code path — when a
 * second Aleo wallet is added, it becomes another row in this array.
 */
export const ALEO_WALLET_OPTIONS: readonly WalletOption[] = [
  { id: "aleo:Leo Wallet", chain: "aleo", name: "Leo Wallet" },
];

export interface InstallLink {
  name: string;
  url: string;
}

/** Shown when no wallet for a chain is detected in the browser. */
export const INSTALL_LINKS: Record<WalletChainId, readonly InstallLink[]> = {
  solana: [
    { name: "Phantom", url: "https://phantom.app/download" },
    { name: "Solflare", url: "https://solflare.com/download" },
    { name: "Backpack", url: "https://backpack.app/download" },
  ],
  aleo: [{ name: "Leo Wallet", url: "https://leo.app/" }],
};

/** `5FHwkr…2UJnM` — short form for buttons and chips. */
export function shortWalletAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
