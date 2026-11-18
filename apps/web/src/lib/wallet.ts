/**
 * Browser-wallet session over the **Wallet Standard** (`wallet-standard`),
 * the protocol `@solana/kit` is designed to talk to.
 *
 * Why not `window.solana.signTransaction` (the Phantom legacy API)? That API
 * only accepts web3.js v1 `Transaction` objects and returns one, which would
 * force us to keep shipping `@solana/web3.js` just as a bridge. Kit builds
 * transactions as *bytes*, and Wallet Standard's `solana:signTransaction`
 * signs exactly those bytes — every current Solana wallet (Phantom, Solflare,
 * Backpack, …) implements it.
 *
 * The wire format in and out is the serialized transaction (`Uint8Array`),
 * which is also what `rpc.sendTransaction` wants. Nothing here depends on
 * `@solana/kit`, so this module stays light and easy to test.
 */

import { getWallets } from "@wallet-standard/app";

import { CLUSTER, type SolanaCluster } from "@/lib/solana";

/** Minimal shape of a Wallet Standard wallet account. */
interface StandardAccount {
  address: string;
  readonly chains: readonly string[];
}

/** The features we use, typed structurally against the Wallet Standard. */
interface StandardWallet {
  readonly name: string;
  readonly icon?: string;
  readonly chains: readonly string[];
  readonly features: {
    "standard:connect"?: {
      connect(): Promise<{ accounts: readonly StandardAccount[] }>;
    };
    "solana:signTransaction"?: {
      signTransaction(input: {
        account: StandardAccount;
        transaction: Uint8Array;
        chain: string;
      }): Promise<readonly { signedTransaction: Uint8Array }[]>;
    };
    "standard:disconnect"?: { disconnect(): Promise<void> };
  };
}

/** A connected wallet: an address plus the ability to sign wire transactions. */
export interface WalletSession {
  /** Base58 address of the selected account. */
  address: string;
  /** Sign a serialized transaction, returning it with the wallet's signature added. */
  signTransaction: (wireTransaction: Uint8Array) => Promise<Uint8Array>;
  /** Ask the wallet to disconnect (best effort). */
  disconnect: () => void;
}

/**
 * The exact registry instance this module reads from.
 *
 * Exposed for integration harnesses (e.g. the Devnet live probe) that need to
 * register a wallet programmatically. Bundlers can load a package twice —
 * once as ESM, once as CJS — and each copy has its own wallet list, so a
 * harness must register through THIS instance rather than importing
 * `@wallet-standard/app` on its own.
 */
export function getWalletRegistry(): ReturnType<typeof getWallets> {
  return getWallets();
}

/** Wallet Standard chain id for our configured cluster. */
export function solanaChainForCluster(cluster: SolanaCluster = CLUSTER): string {
  switch (cluster) {
    case "devnet":
      return "solana:devnet";
    case "mainnet-beta":
      return "solana:mainnet";
    default:
      // A custom RPC is almost always mainnet behind a proxy; saying "mainnet"
      // keeps wallets from signing for the wrong chain.
      return "solana:mainnet";
  }
}

/** Solana wallets currently registered with the page (empty when none installed). */
export function listSolanaWallets(): StandardWallet[] {
  return getWallets()
    .get()
    .filter((wallet) => {
      const chains = (wallet as { chains?: readonly string[] }).chains ?? [];
      return chains.some((chain) => chain.startsWith("solana:"));
    })
    .map((wallet) => wallet as unknown as StandardWallet);
}

/**
 * Connect to a Solana wallet and return a session.
 *
 * Prefers Phantom when several wallets are installed (the one our users
 * actually have), otherwise the first registered wallet. The account picker is
 * left to the wallet itself: `standard:connect` returns the accounts the user
 * approved, and we take the first.
 */
export async function connectSolanaWallet(): Promise<WalletSession> {
  const wallets = listSolanaWallets();
  if (wallets.length === 0) {
    throw new Error("未检测到 Solana 钱包（请安装 Phantom 等浏览器插件）");
  }
  const wallet = wallets.find((w) => /phantom/i.test(w.name)) ?? wallets[0];

  const connect = wallet.features["standard:connect"];
  if (!connect) {
    throw new Error(`钱包 ${wallet.name} 不支持标准连接，请更新钱包后重试`);
  }
  const { accounts } = await connect.connect();
  const account = accounts[0];
  if (!account) {
    throw new Error("钱包没有返回可用账户");
  }

  const signFeature = wallet.features["solana:signTransaction"];
  if (!signFeature) {
    throw new Error(`钱包 ${wallet.name} 不支持交易签名`);
  }
  const chain = solanaChainForCluster();

  return {
    address: account.address,
    signTransaction: async (wireTransaction) => {
      const outputs = await signFeature.signTransaction({
        account,
        transaction: wireTransaction,
        chain,
      });
      const signed = outputs[0]?.signedTransaction;
      if (!signed) {
        throw new Error("钱包没有返回已签名的交易");
      }
      return signed;
    },
    disconnect: () => {
      wallet.features["standard:disconnect"]?.disconnect().catch(() => {});
    },
  };
}
