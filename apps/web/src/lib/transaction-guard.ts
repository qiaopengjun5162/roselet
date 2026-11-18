/**
 * Verify what a wallet handed back BEFORE anything is broadcast.
 *
 * Why this exists (Wallet Standard explicitly permits it):
 *   "Returning a transaction rather than signatures allows multisig wallets,
 *    program wallets, and other wallets that use meta-transactions to return a
 *    modified, signed transaction."
 *   — @solana/wallet-standard-features, signTransaction.ts
 *
 * That is fine for a plain transfer, but NOT for our NFT mint: the mint
 * keypair is generated in the browser, signs locally, and is then discarded.
 * Its signature is bound to these exact message bytes. If a wallet rebuilds
 * the message or drops that signature, the transaction can never succeed —
 * and the user would only see an opaque RPC "signature verification failure"
 * after we already tried to broadcast.
 *
 * Catching it here means: zero broadcast, zero fee, and a Chinese error that
 * says what actually went wrong. Kept as a pure, SDK-free function so the
 * failure modes are unit-testable in jsdom.
 */

/** Decoded wire transaction, reduced to the two things we must compare. */
export interface WireTransactionView {
  /** Exact message bytes every signature is bound to. */
  readonly messageBytes: Uint8Array;
  /** Signer address -> signature bytes, or null when not signed yet. */
  readonly signatures: Readonly<Record<string, Uint8Array | null>>;
}

export interface WalletSignatureExpectation {
  /** Addresses that signed locally before the wallet saw the tx (the mint). */
  readonly requiredSigners: readonly string[];
  /** Address the wallet is expected to add — the fee payer. */
  readonly walletAddress: string;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

/**
 * Normalize a decoded kit transaction into a plain view.
 *
 * Takes `unknown` on purpose: kit brands `messageBytes` and `Signature` with
 * nominal types, and a wallet's bytes may cross realms. Reading the shape at
 * runtime avoids sprinkling `as never` casts through the minting code, and it
 * also fails loudly if a future SDK version changes the decoded layout.
 */
export function toWireTransactionView(transaction: unknown): WireTransactionView {
  if (!transaction || typeof transaction !== "object") {
    throw new Error("交易解码结果为空");
  }
  const raw = transaction as { messageBytes?: unknown; signatures?: unknown };
  if (!(raw.messageBytes instanceof Uint8Array) || !raw.signatures) {
    throw new Error("交易解码结果缺少 messageBytes / signatures");
  }

  const signatures: Record<string, Uint8Array | null> = {};
  for (const [address, signature] of Object.entries(
    raw.signatures as Record<string, unknown>,
  )) {
    if (signature == null) {
      signatures[address] = null;
    } else if (signature instanceof Uint8Array) {
      signatures[address] = Uint8Array.from(signature);
    } else {
      throw new Error(`交易签名格式异常（${address.slice(0, 8)}…）`);
    }
  }
  return {
    messageBytes: Uint8Array.from(raw.messageBytes),
    signatures,
  };
}

/**
 * Assert the wallet preserved the already-signed transaction and added its
 * own signature. Throws a user-facing Chinese error on any violation.
 */
export function assertWalletPreservedTransaction(
  before: WireTransactionView,
  after: WireTransactionView,
  expected: WalletSignatureExpectation,
): void {
  if (!bytesEqual(before.messageBytes, after.messageBytes)) {
    throw new Error(
      "钱包返回了与待签内容不同的交易（可能重建了交易）。已附加的 mint 签名会因此失效；本次未广播、未扣费。请换用支持「部分签名交易」的钱包，例如最新版 Phantom。",
    );
  }

  for (const signer of expected.requiredSigners) {
    const original = before.signatures[signer];
    if (!original) {
      throw new Error(
        `交易在交给钱包前就缺少 ${signer.slice(0, 8)}… 的签名；本次未广播、未扣费。`,
      );
    }
    const returned = after.signatures[signer];
    if (!returned || !bytesEqual(original, returned)) {
      throw new Error(
        "钱包丢失或改动了 mint 账户已附加的签名；本次未广播、未扣费。请重试，或在钱包设置里允许「部分签名交易」。",
      );
    }
  }

  // A wallet may ADD signatures (multisig), never drop one that was already
  // there. This covers signers beyond the mint if the tx ever grows one.
  for (const [address, signature] of Object.entries(before.signatures)) {
    if (!signature) continue;
    const returned = after.signatures[address];
    if (!returned || !bytesEqual(signature, returned)) {
      throw new Error(
        `钱包丢弃了 ${address.slice(0, 8)}… 已有的签名；本次未广播、未扣费。请重试或换一个钱包。`,
      );
    }
  }

  if (!after.signatures[expected.walletAddress]) {
    throw new Error(
      "钱包没有附加付款账户的签名；本次未广播、未扣费。请重新连接钱包后重试。",
    );
  }
}
