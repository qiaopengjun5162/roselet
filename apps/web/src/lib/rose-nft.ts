/**
 * Mint a rose as a Token-2022 NFT, entirely from the browser.
 *
 * Design notes (the "why" matters more than the "what" here):
 *
 * - **No custom on-chain program.** A program is only needed when a rule must
 *   be enforced *by the chain* (e.g. "a rose can be minted once", or a PDA
 *   holding the mint authority). For "let the owner mint their own rose", the
 *   user's wallet is the mint authority, so the stock Token-2022 program is
 *   enough: zero deployment, zero audit surface, and the platform still never
 *   touches a private key.
 *
 * - **Inline metadata, not Metaplex.** `MetadataPointer` → the mint itself
 *   means one account instead of four. Measured on Devnet: ≈0.004 SOL of rent
 *   versus ≈0.0088 SOL for the Metaplex layout. Rent is a refundable deposit,
 *   not a fee.
 *
 * - **The SDK is imported lazily.** `@solana/spl-token` pulls in
 *   `@noble/curves`, which needs `TextEncoder`; jsdom (used by the component
 *   tests) does not provide it. Keeping the imports inside the function means
 *   rendering the section never loads the SDK, only clicking "mint" does.
 *
 * - **The mint keypair never leaves the browser.** It is generated here, used
 *   to sign locally, and discarded. Consequence: a failed backend save can
 *   never be "retried by minting again" — that would create a second asset and
 *   cost another ~0.004 SOL. Retrying only re-submits the *same* mint address.
 */

import { SOLANA_RPC_URL, buildRoseNftFields } from "@/lib/solana";

/** The injected wallet's `signTransaction` (Phantom-compatible). */
export type SignTransactionFn = (
  transaction: unknown,
) => Promise<{ serialize: () => Uint8Array }>;

export interface MintRoseNftInput {
  /** Wallet that pays, holds the mint authority and the update authority. */
  walletAddress: string;
  roseId: string;
  /** The rose's words; becomes the NFT name and the `message` field. */
  roseName?: string | null;
  imageCid?: string | null;
  signTransaction: SignTransactionFn;
  /** Optional progress callback for the UI ("① …" style steps). */
  onStep?: (step: string) => void;
}

export interface MintRoseNftResult {
  mintAddress: string;
  signature: string;
  /** Metadata actually written on-chain — kept so a retry re-submits the same values. */
  name: string;
  uri: string;
}

/**
 * Build, sign and broadcast a single transaction that:
 *   1. allocates the mint account with room for inline metadata,
 *   2. points `MetadataPointer` at the mint itself,
 *   3. initializes a 0-decimal mint,
 *   4. writes name / symbol / uri,
 *   5. appends `roseId` (+ `message`) as additional metadata,
 *   6. creates the owner's associated token account,
 *   7. mints exactly 1,
 *   8. revokes the mint authority so no second copy can ever exist.
 *
 * All of that in one transaction: either the whole NFT exists or nothing does.
 * That matters because a half-built mint (supply 0, metadata set) would be
 * unusable and still cost rent.
 */
export async function mintRoseNft(
  input: MintRoseNftInput,
): Promise<MintRoseNftResult> {
  const step = (label: string) => input.onStep?.(label);
  const fields = buildRoseNftFields({
    roseId: input.roseId,
    roseName: input.roseName,
    imageCid: input.imageCid,
  });

  step("① 生成 mint 密钥对…");
  const [{ Connection, Keypair, PublicKey, SystemProgram, Transaction }, token, meta] =
    await Promise.all([
      import("@solana/web3.js"),
      import("@solana/spl-token"),
      import("@solana/spl-token-metadata"),
    ]);

  // Generated in the browser and thrown away after signing: nobody else ever
  // needs this key, because the mint authority is revoked in the same tx.
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;
  const owner = new PublicKey(input.walletAddress);
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");

  const metadata = {
    mint,
    name: fields.name,
    symbol: fields.symbol,
    uri: fields.uri,
    additionalMetadata: fields.additionalMetadata,
  };

  // Space = mint (+ MetadataPointer) + the TLV entry holding the metadata.
  // Every Token-2022 extension is stored as `[2-byte type][2-byte length][data]`,
  // and `pack` returns just the data, so the entry needs 4 extra bytes.
  const METADATA_TLV_HEADER_BYTES = 4;
  const mintLen = token.getMintLen([token.ExtensionType.MetadataPointer]);
  const metadataLen = METADATA_TLV_HEADER_BYTES + meta.pack(metadata).length;

  step("② 读取租金与最新区块…");
  const [lamports, { blockhash, lastValidBlockHeight }] = await Promise.all([
    // Fund for the FINAL size, not the initial one — see the `space` comment
    // below: the account starts small and the metadata initializer reallocs it,
    // and the runtime rejects the tx if the grown account is not rent-exempt.
    connection.getMinimumBalanceForRentExemption(mintLen + metadataLen),
    connection.getLatestBlockhash("finalized"),
  ]);

  const ata = token.getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    token.TOKEN_2022_PROGRAM_ID,
  );

  const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight });
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: owner,
      newAccountPubkey: mint,
      // Exactly the mint size — *not* mint + metadata. Token-2022's
      // `InitializeMint` rejects an account that is larger than the extensions
      // it currently has (`InvalidAccountData`), and the metadata initializer
      // grows the account itself. Verified on Devnet: pre-allocating the
      // metadata space makes instruction #3 fail every time.
      space: mintLen,
      lamports,
      programId: token.TOKEN_2022_PROGRAM_ID,
    }),
    // The pointer must be initialized *before* the mint, and before any
    // metadata is written into the account.
    token.createInitializeMetadataPointerInstruction(
      mint,
      owner,
      mint,
      token.TOKEN_2022_PROGRAM_ID,
    ),
    // `Mint2` skips the rent sysvar account; decimals 0 and no freeze
    // authority — the owner can never be locked out of their own rose.
    token.createInitializeMint2Instruction(
      mint,
      0,
      owner,
      null,
      token.TOKEN_2022_PROGRAM_ID,
    ),
    meta.createInitializeInstruction({
      programId: token.TOKEN_2022_PROGRAM_ID,
      metadata: mint,
      updateAuthority: owner,
      mint,
      mintAuthority: owner,
      name: fields.name,
      symbol: fields.symbol,
      uri: fields.uri,
    }),
    // `createInitializeInstruction` only writes name/symbol/uri, so the fields
    // the backend verifies (roseId, message) are appended here.
    ...fields.additionalMetadata.map(([field, value]) =>
      meta.createUpdateFieldInstruction({
        programId: token.TOKEN_2022_PROGRAM_ID,
        metadata: mint,
        updateAuthority: owner,
        field,
        value,
      }),
    ),
    token.createAssociatedTokenAccountInstruction(
      owner,
      ata,
      owner,
      mint,
      token.TOKEN_2022_PROGRAM_ID,
    ),
    token.createMintToInstruction(
      mint,
      ata,
      owner,
      1,
      [],
      token.TOKEN_2022_PROGRAM_ID,
    ),
    // 1-of-1: after this the supply can never grow.
    token.createSetAuthorityInstruction(
      mint,
      owner,
      token.AuthorityType.MintTokens,
      null,
      [],
      token.TOKEN_2022_PROGRAM_ID,
    ),
  );

  // The mint account must sign its own creation; the wallet signs as payer and
  // as every authority above. Both signatures must be on the tx before it is
  // broadcast, otherwise the runtime rejects it.
  tx.partialSign(mintKeypair);

  step("③ 等待钱包签名…");
  const signed = await input.signTransaction(tx);
  if (!signed) throw new Error("钱包没有返回已签名的交易");

  step("④ 广播交易…");
  // `serialize` is where a wallet that dropped the mint signature fails. That
  // happens *before* broadcast, so nothing is spent — but the raw error
  // ("Missing signature for public key …") is unreadable, so explain it.
  let raw: Uint8Array;
  try {
    raw = signed.serialize();
  } catch (e) {
    throw new Error(
      `钱包没有保留 mint 账户的签名，交易未广播（未扣费）。请重试；若反复失败，请改用 Phantom。原始错误：${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  // Preflight stays ON here (unlike the memo path): a failure is cheap to
  // catch before broadcast, and a rejected simulation costs nothing.
  const signature = await connection.sendRawTransaction(raw, {
    maxRetries: 5,
  });

  step("⑤ 等待链上最终确认…");
  // A timeout here is NOT a failure. The tx is already broadcast and may still
  // land; the backend re-reads the mint at `finalized` with its own retries and
  // is the authority on whether it exists. Throwing would make the UI offer a
  // "retry mint", which would create a *second* NFT for the same rose.
  try {
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "finalized",
    );
  } catch {
    step("⑤ 交易已广播，仍在等待最终确认…");
  }

  return {
    mintAddress: mint.toBase58(),
    signature,
    name: fields.name,
    uri: fields.uri,
  };
}
