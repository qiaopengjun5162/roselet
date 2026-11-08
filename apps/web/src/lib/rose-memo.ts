/**
 * The "轻量存证" (memo evidence) path: one SPL Memo transaction carrying the
 * rose's claim, signed by the user's wallet.
 *
 * Extracted from `MembershipPanel` so the component only orchestrates UI and
 * every `@solana/*` import lives behind this module (and `solana-rpc`). The
 * transaction is built with `@solana/kit` + `@solana-program/memo`, and signed
 * over plain wire bytes — see `lib/wallet.ts` for why.
 */

import type { Instruction } from "@solana/kit";

import {
  MEMO_COMPUTE_UNIT_LIMIT,
  PRIORITY_FEE_MICRO_LAMPORTS,
} from "@/lib/solana";
import {
  type BlockhashLifetime,
  type SignTransactionFn,
  fetchBlockhash,
  loadKit,
  sendSignedTransaction,
} from "@/lib/solana-rpc";

/** Canonical SPL Memo program (Solana official docs / x402). Must match the
 *  backend's `MEMO_PROGRAM_IDS` or server-side verification will reject it. */
export const MEMO_PROGRAM_ADDRESS = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

/** The exact payload that goes into the on-chain memo. */
export interface RoseMemoMeta {
  /**
   * Domain tag. A Solana memo is unstructured text, so unlike an Anchor account
   * it carries no discriminator: without this tag any app's JSON memo that
   * mentions a rose id would look like a Roselet claim. The backend rejects a
   * memo whose `app` is a different product.
   */
  app: "roselet";
  roseId: string;
  message: string;
  imageCid: string | null;
  createdAt: string;
}

export interface SendRoseMemoInput {
  /** Wallet that pays the fee and signs the memo. */
  walletAddress: string;
  /** Payload written verbatim into the memo. */
  meta: RoseMemoMeta;
  /** Signs a compiled transaction and returns the signed wire bytes. */
  signTransaction: SignTransactionFn;
  /** Progress callback for the UI ("① …" style steps). */
  onStep?: (step: string) => void;
}

export interface SendRoseMemoResult {
  signature: string;
  /** Needed by the caller to wait for finality (soft failure on timeout). */
  lifetime: BlockhashLifetime;
  meta: RoseMemoMeta;
}

/**
 * Build, sign and broadcast a memo transaction. Returns as soon as the RPC has
 * accepted it — finality is the caller's concern, because a timeout there must
 * not trigger a re-broadcast (that would cost real SOL and write twice).
 */
export async function sendRoseMemo(
  input: SendRoseMemoInput,
): Promise<SendRoseMemoResult> {
  const step = (label: string) => input.onStep?.(label);
  const kit = await loadKit();
  const [{ getAddMemoInstruction }, { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction }] =
    await Promise.all([
      import("@solana-program/memo"),
      import("@solana-program/compute-budget"),
    ]);

  step("① 准备交易…");
  const lifetime = await fetchBlockhash();
  const feePayer = kit.createNoopSigner(kit.address(input.walletAddress));

  const instructions: Instruction[] = [];
  if (PRIORITY_FEE_MICRO_LAMPORTS > 0) {
    // Cap the CU limit *before* setting a price: priority fee is
    // price × limit, so an unset limit means paying for the 200k default.
    instructions.push(
      getSetComputeUnitLimitInstruction({ units: MEMO_COMPUTE_UNIT_LIMIT }),
      getSetComputeUnitPriceInstruction({ microLamports: PRIORITY_FEE_MICRO_LAMPORTS }),
    );
  }
  instructions.push(
    getAddMemoInstruction({
      memo: JSON.stringify(input.meta),
      // The memo program only checks signatures it is given; passing the fee
      // payer keeps the "wallet attested to this text" reading explicit.
      signers: [feePayer],
    }),
  );

  const message = kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    (tx) => kit.setTransactionMessageFeePayerSigner(feePayer, tx),
    (tx) => kit.setTransactionMessageLifetimeUsingBlockhash(lifetime, tx),
    (tx) => kit.appendTransactionMessageInstructions(instructions, tx),
  );
  const compiled = kit.compileTransaction(message);
  const wire = Uint8Array.from(kit.getTransactionEncoder().encode(compiled));

  step("② 等待钱包签名…");
  const signed = await input.signTransaction(wire);

  step("③ 广播交易…");
  // Preflight is skipped deliberately: its simulation can reject a tx the
  // cluster would accept, and the RPC's own rebroadcast helps in congestion.
  const signature = await sendSignedTransaction(signed, {
    skipPreflight: true,
    maxRetries: 5,
  });

  return { signature, lifetime, meta: input.meta };
}
