/**
 * Cluster helpers shared by the web app's Solana surface.
 *
 * Deliberately free of `@solana/web3.js` imports: several components (e.g. the
 * rose detail mint section) render in jsdom tests that cannot load the SDK, and
 * they only need the configured cluster + link formatting.
 */

export type SolanaCluster = "devnet" | "mainnet-beta" | "custom";

/** Default RPC used when `NEXT_PUBLIC_SOLANA_RPC_URL` is not set. */
const DEFAULT_DEVNET_RPC = "https://api.devnet.solana.com";

/** RPC endpoint the web app talks to. Must match the backend's SOLANA_RPC_URL. */
export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || DEFAULT_DEVNET_RPC;

/**
 * Infer the cluster from the configured RPC endpoint. We only distinguish the
 * two clusters we ship against; any other endpoint (a custom/paid RPC host) is
 * "custom" and treated conservatively as possibly-mainnet by the UI, because
 * guessing wrong and telling the user "testnet" before a real-money action is
 * far worse than an extra warning.
 */
export function detectCluster(rpcUrl: string = SOLANA_RPC_URL): SolanaCluster {
  const url = rpcUrl.toLowerCase();
  if (url.includes("devnet")) return "devnet";
  if (url.includes("mainnet")) return "mainnet-beta";
  return "custom";
}

/** The cluster the app is currently configured for. */
export const CLUSTER: SolanaCluster = detectCluster();

/** Human-readable cluster label shown in the UI. */
export function clusterLabel(cluster: SolanaCluster = CLUSTER): string {
  switch (cluster) {
    case "devnet":
      return "Devnet 测试网";
    case "mainnet-beta":
      return "Solana 主网";
    default:
      return "自定义 RPC";
  }
}

/** Whether actions on this cluster spend real SOL (show a warning). */
export function clusterSpendsRealSol(cluster: SolanaCluster = CLUSTER): boolean {
  return cluster !== "devnet";
}

/** Tailwind classes for the cluster badge. */
export function clusterTone(cluster: SolanaCluster = CLUSTER): string {
  return cluster === "devnet"
    ? "bg-violet-500/15 text-violet-200"
    : "bg-rose-500/15 text-rose-200";
}

/**
 * Solana Explorer URL for a transaction on the given cluster.
 *
 * Mainnet/base explorer keeps the default cluster, so no `?cluster=` suffix is
 * appended there. "custom" endpoints are treated like mainnet (no suffix).
 */
export function explorerTxUrl(
  signature: string,
  cluster: SolanaCluster = CLUSTER,
): string {
  const suffix = cluster === "devnet" ? "?cluster=devnet" : "";
  return `https://explorer.solana.com/tx/${signature}${suffix}`;
}
