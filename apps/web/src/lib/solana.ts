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
 * Base fee every Solana transaction pays: 5000 lamports per signature.
 * It is *not* a rent deposit — nothing is locked, nothing is refundable.
 */
export const BASE_FEE_LAMPORTS = 5_000;

/**
 * Compute-unit ceiling we request for a memo-only transaction. The memo
 * program is cheap (cost scales with payload bytes), so 20k CU is generous
 * while keeping `priority fee = price × limit` from ballooning.
 */
export const MEMO_COMPUTE_UNIT_LIMIT = 20_000;

/** Hard ceiling for the configured price, so an env typo cannot burn SOL. */
export const MAX_PRIORITY_FEE_MICRO_LAMPORTS = 1_000_000;

/**
 * Parse `NEXT_PUBLIC_SOLANA_PRIORITY_FEE_MICROLAMPORTS`.
 *
 * Default is 0 (no ComputeBudget instruction at all) — on Devnet a priority
 * fee is pointless. Set it on mainnet so a congested cluster does not leave
 * the memo tx queued indefinitely.
 */
export function parsePriorityFeeMicroLamports(
  raw: string | undefined | null,
): number {
  if (!raw) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.floor(value), MAX_PRIORITY_FEE_MICRO_LAMPORTS);
}

/** Configured compute-unit price (micro-lamports per CU); 0 = unset. */
export const PRIORITY_FEE_MICRO_LAMPORTS = parsePriorityFeeMicroLamports(
  process.env.NEXT_PUBLIC_SOLANA_PRIORITY_FEE_MICROLAMPORTS,
);

/** Priority fee in lamports: microLamports/CU × CU limit ÷ 1e6. */
export function priorityFeeLamports(
  microLamports: number = PRIORITY_FEE_MICRO_LAMPORTS,
  units: number = MEMO_COMPUTE_UNIT_LIMIT,
): number {
  if (microLamports <= 0 || units <= 0) return 0;
  return Math.ceil((microLamports * units) / 1_000_000);
}

/** Total lamports a single-signature memo tx is expected to spend. */
export function estimatedFeeLamports(
  microLamports: number = PRIORITY_FEE_MICRO_LAMPORTS,
  units: number = MEMO_COMPUTE_UNIT_LIMIT,
): number {
  return BASE_FEE_LAMPORTS + priorityFeeLamports(microLamports, units);
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

/** Solana Explorer URL for an account (a mint, a wallet, …). */
export function explorerAccountUrl(
  address: string,
  cluster: SolanaCluster = CLUSTER,
): string {
  const suffix = cluster === "devnet" ? "?cluster=devnet" : "";
  return `https://explorer.solana.com/address/${address}${suffix}`;
}

/* ------------------------------------------------------------------ *
 * Token-2022 NFT metadata
 * ------------------------------------------------------------------ */

/**
 * Byte limits of the token-metadata interface. They are **byte** limits, not
 * character limits: one Chinese character is 3 bytes in UTF-8, so a 32-byte
 * name holds only 10 Chinese characters. Truncating by `String.length` (UTF-16
 * code units) would produce an oversized field and the on-chain initialize
 * would fail with a length error.
 */
export const NFT_NAME_MAX_BYTES = 32;
export const NFT_SYMBOL_MAX_BYTES = 10;
export const NFT_URI_MAX_BYTES = 200;
export const NFT_FIELD_VALUE_MAX_BYTES = 200;

/** Only one ticker for the whole collection. */
export const ROSE_NFT_SYMBOL = "ROSE";

/** Fallback name when a rose has no words of its own. */
export const DEFAULT_ROSE_NAME = "Roselet Rose";

/** Public URL used as the NFT `uri` when the rose has no image. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://roselet-web.vercel.app";

/** UTF-8 length of a string, computed without `TextEncoder` (absent in jsdom). */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const ch of value) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x80) bytes += 1;
    else if (cp < 0x800) bytes += 2;
    else if (cp < 0x10000) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

/**
 * Truncate to at most `maxBytes` UTF-8 bytes without splitting a character.
 * Over-long input is cut, never rejected — a rose's words must not block
 * minting.
 */
export function truncateUtf8(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  let out = "";
  let bytes = 0;
  for (const ch of value) {
    const size = utf8ByteLength(ch);
    if (bytes + size > maxBytes) break;
    out += ch;
    bytes += size;
  }
  return out;
}

/** Fields written into the mint's inline metadata. */
export interface RoseNftFields {
  name: string;
  symbol: string;
  uri: string;
  /** Token-2022 `additionalMetadata` entries, as `[key, value]` tuples. */
  additionalMetadata: [string, string][];
}

export interface RoseNftFieldsInput {
  roseId: string;
  /** The rose's own words; becomes the NFT name (truncated) and the message. */
  roseName?: string | null;
  imageCid?: string | null;
  siteUrl?: string;
}

/**
 * Build the on-chain metadata for a rose NFT.
 *
 * `roseId` is the load-bearing field: the backend reads it back from chain
 * state and refuses the mint unless it matches the rose being updated. Without
 * it, a valid NFT for one rose could be replayed for another.
 */
export function buildRoseNftFields(input: RoseNftFieldsInput): RoseNftFields {
  const words = (input.roseName ?? "").trim();
  const name = truncateUtf8(words || DEFAULT_ROSE_NAME, NFT_NAME_MAX_BYTES);

  // A CID is the canonical image pointer; without one, link to the rose page
  // rather than inventing a fake `ipfs://` URI (the backend rejects an empty
  // uri, and a broken CID is worse than a working https link).
  const cid = (input.imageCid ?? "").trim();
  const uri = cid
    ? truncateUtf8(`ipfs://${cid}`, NFT_URI_MAX_BYTES)
    : truncateUtf8(
        `${(input.siteUrl ?? SITE_URL).replace(/\/+$/, "")}/rose/${input.roseId}`,
        NFT_URI_MAX_BYTES,
      );

  const additionalMetadata: [string, string][] = [["roseId", input.roseId]];
  const message = truncateUtf8(words, NFT_FIELD_VALUE_MAX_BYTES);
  if (message) additionalMetadata.push(["message", message]);

  return {
    name,
    symbol: truncateUtf8(ROSE_NFT_SYMBOL, NFT_SYMBOL_MAX_BYTES),
    uri,
    additionalMetadata,
  };
}

/**
 * Budget for one rose NFT (mint + inline metadata + ATA), used for the
 * "you need about this much SOL" hint. Measured on Devnet with the real mint
 * flow: 525-byte mint (3,317,240) + 170-byte ATA (1,513,840) = 4,831,080
 * lamports, plus ~10,000 in fees. Rounded up so the UI never understates it.
 * See `docs/SOLANA_MAINNET_ASSESSMENT.md` §10.
 */
export const ROSE_NFT_RENT_ESTIMATE_LAMPORTS = 5_000_000;

export const LAMPORTS_PER_SOL = 1_000_000_000;

/** Format lamports as a short SOL string, e.g. 4_500_000 → "0.0045". */
export function lamportsToSol(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}
