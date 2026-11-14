/**
 * Thin RPC helpers around `@solana/kit`.
 *
 * Everything that touches the network goes through here so the rest of the
 * app can deal in plain strings / bytes. The kit SDK is imported lazily (and
 * re-used between calls) so merely rendering a component never loads it —
 * which also keeps jsdom unit tests free of the SDK.
 */

import type { Blockhash, Signature } from "@solana/kit";

import { SOLANA_RPC_URL } from "@/lib/solana";

/** A compiled transaction the connected wallet will sign and return signed. */
export type SignTransactionFn = (
  wireTransaction: Uint8Array,
) => Promise<Uint8Array>;

/** Blockhash lifetime, the same shape kit's lifetime helpers expect. */
export interface BlockhashLifetime {
  blockhash: Blockhash;
  lastValidBlockHeight: bigint;
}

type Kit = typeof import("@solana/kit");
let kitPromise: Promise<Kit> | null = null;

/** Load `@solana/kit` once per page (callers just `await` it). */
export function loadKit(): Promise<Kit> {
  kitPromise ??= import("@solana/kit");
  return kitPromise;
}

function createRpc() {
  // Created per call: an Rpc client is a thin fetch wrapper and holds no state
  // worth caching across a config change.
  return loadKit().then((kit) => kit.createSolanaRpc(SOLANA_RPC_URL));
}

/**
 * Fetch a fresh blockhash for building a transaction.
 *
 * `finalized` (not `confirmed`) so the resulting lifetime window matches the
 * commitment the backend verifies at — a blockhash from a minority fork would
 * just expire sooner.
 */
export async function fetchBlockhash(): Promise<BlockhashLifetime> {
  const rpc = await createRpc();
  const { value } = await rpc
    .getLatestBlockhash({ commitment: "finalized" })
    .send();
  return {
    blockhash: value.blockhash,
    lastValidBlockHeight: value.lastValidBlockHeight,
  };
}

/** Rent-exempt minimum for an account of `space` bytes, in lamports. */
export async function fetchRentExemptionLamports(
  space: number,
): Promise<bigint> {
  const rpc = await createRpc();
  return rpc.getMinimumBalanceForRentExemption(BigInt(space)).send();
}

/**
 * Broadcast a signed wire transaction and return its signature.
 *
 * The wallet hands back wire bytes, so we decode them once with kit and let
 * its own factories produce both the RPC payload and the signature. Doing it
 * this way (instead of slicing `bytes[1..65]` and base58-encoding by hand)
 * keeps us correct if the signature count ever grows past one byte of
 * compact-u16, and gives `sendTransaction` the branded string it expects —
 * no `as never` cast needed.
 *
 * The signature comes from the wire itself, not from the RPC response, so the
 * caller gets an id even if the follow-up confirmation times out. The
 * transaction id is the *first* signature, which Solana requires to be the
 * fee payer's — exactly the wallet that just signed.
 */
export async function sendSignedTransaction(
  signedWire: Uint8Array,
  options: { skipPreflight: boolean; maxRetries: number },
): Promise<string> {
  const [kit, rpc] = await Promise.all([loadKit(), createRpc()]);
  const transaction = kit.getTransactionDecoder().decode(signedWire);
  const signature = kit.getSignatureFromTransaction(transaction);
  const base64 = kit.getBase64EncodedWireTransaction(transaction);

  await rpc
    .sendTransaction(base64, {
      encoding: "base64",
      skipPreflight: options.skipPreflight,
      maxRetries: BigInt(options.maxRetries),
    })
    .send();

  return signature;
}

/**
 * Wait until a transaction reaches `finalized` commitment.
 *
 * Kit has no one-shot "confirmTransaction" on the plain HTTP RPC (the bundled
 * helper wants a websocket subscription), so this polls `getSignatureStatuses`
 * — which is also friendlier to the proxied / rate-limited endpoints this app
 * runs against. Throws on an on-chain error, on blockhash expiry, or on
 * timeout; callers that treat "already broadcast" as success must catch and
 * downgrade.
 */
export async function confirmSignature(
  signature: string,
  lifetime: BlockhashLifetime,
  options: { timeoutMs?: number; pollMs?: number } = {},
): Promise<void> {
  const rpc = await createRpc();
  const timeoutMs = options.timeoutMs ?? 90_000;
  const pollMs = options.pollMs ?? 2_000;
  const deadline = Date.now() + timeoutMs;
  const sig = signature as Signature;

  for (;;) {
    const { value } = await rpc.getSignatureStatuses([sig]).send();
    const status = value[0];
    if (status?.err) {
      throw new Error(`链上交易执行失败: ${JSON.stringify(status.err)}`);
    }
    if (status?.confirmationStatus === "finalized") return;

    // Once the blockhash has expired the transaction can never land, so a
    // caller must not be left waiting for the whole timeout.
    const height = await rpc.getBlockHeight({ commitment: "finalized" }).send();
    if (height > lifetime.lastValidBlockHeight) {
      throw new Error("交易已过期（区块高度超过有效期）");
    }
    if (Date.now() > deadline) {
      throw new Error("等待链上最终确认超时");
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
