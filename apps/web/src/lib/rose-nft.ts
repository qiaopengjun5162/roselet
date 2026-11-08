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
 *   versus ≈0.0088 SOL for the Metaplex layout. (Only the ATA's share of that
 *   is refundable — see `ROSE_NFT_MINT_RENT_LAMPORTS` in `lib/solana`.)
 *
 * - **Built with `@solana/kit` + `@solana-program/token-2022`.** These are the
 *   successors to `@solana/web3.js` v1 / `@solana/spl-token` (now
 *   maintenance-only). The instruction builders come from the Codama-generated
 *   program client, so the instruction layout is pinned to the published IDL
 *   rather than hand-assembled.
 *
 * - **The SDK is imported lazily.** Kit and the token-2022 client are loaded
 *   on the first mint click, so rendering the section never loads them (and
 *   jsdom unit tests can mock this module outright).
 *
 * - **The mint keypair never leaves the browser.** It is generated here, used
 *   to sign locally, and discarded. Consequence: a failed backend save can
 *   never be "retried by minting again" — that would create a second asset and
 *   cost another ~0.004 SOL. Retrying only re-submits the *same* mint address.
 */

import { buildRoseNftFields } from "@/lib/solana";
import {
  type SignTransactionFn,
  confirmSignature,
  fetchBlockhash,
  fetchRentExemptionLamports,
  loadKit,
  sendSignedTransaction,
} from "@/lib/solana-rpc";

export interface MintRoseNftInput {
  /** Wallet that pays, holds the mint authority and the update authority. */
  walletAddress: string;
  roseId: string;
  /** The rose's words; becomes the NFT name and the `message` field. */
  roseName?: string | null;
  imageCid?: string | null;
  /** Signs a compiled transaction (mint signature already attached) and
   *  returns the fully signed wire bytes. */
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
  const [kit, token, system] = await Promise.all([
    loadKit(),
    import("@solana-program/token-2022"),
    import("@solana-program/system"),
  ]);

  // Generated in the browser and thrown away after signing: nobody else ever
  // needs this key, because the mint authority is revoked in the same tx.
  const mintSigner = await kit.generateKeyPairSigner();
  const owner = kit.address(input.walletAddress);
  const walletSigner = kit.createNoopSigner(owner);

  const metadataPointer = token.extension("MetadataPointer", {
    authority: owner,
    metadataAddress: mintSigner.address,
  });
  const tokenMetadata = token.extension("TokenMetadata", {
    updateAuthority: owner,
    mint: mintSigner.address,
    name: fields.name,
    symbol: fields.symbol,
    uri: fields.uri,
    additionalMetadata: new Map(fields.additionalMetadata),
  });

  // Space = mint (+ MetadataPointer) + the TLV entry holding the metadata.
  // The mint account must be created with *exactly* the size of the extensions
  // it has at initialization (here: MetadataPointer only); the metadata
  // initializer reallocs it to the full size itself. Verified on Devnet:
  // pre-allocating the metadata space makes `InitializeMint2` fail with
  // `InvalidAccountData` every time.
  const spaceWithoutMetadata = token.getMintSize([metadataPointer]);
  const spaceWithMetadata = token.getMintSize([metadataPointer, tokenMetadata]);

  step("② 读取租金与最新区块…");
  // Fund for the FINAL size, not the initial one: the grown account must stay
  // rent-exempt or the transaction is rejected at the end.
  const [lamports, lifetime, [ata]] = await Promise.all([
    fetchRentExemptionLamports(spaceWithMetadata),
    fetchBlockhash(),
    token.findAssociatedTokenPda({
      owner,
      tokenProgram: token.TOKEN_2022_PROGRAM_ADDRESS,
      mint: mintSigner.address,
    }),
  ]);

  const instructions = [
    system.getCreateAccountInstruction({
      payer: walletSigner,
      newAccount: mintSigner,
      lamports,
      space: BigInt(spaceWithoutMetadata),
      programAddress: token.TOKEN_2022_PROGRAM_ADDRESS,
    }),
    // The pointer must be initialized *before* the mint, and before any
    // metadata is written into the account.
    token.getInitializeMetadataPointerInstruction({
      mint: mintSigner.address,
      authority: owner,
      metadataAddress: mintSigner.address,
    }),
    // `InitializeMint2` skips the rent sysvar account; decimals 0 and no
    // freeze authority — the owner can never be locked out of their own rose.
    token.getInitializeMint2Instruction({
      mint: mintSigner.address,
      decimals: 0,
      mintAuthority: owner,
      freezeAuthority: null,
    }),
    token.getInitializeTokenMetadataInstruction({
      metadata: mintSigner.address,
      updateAuthority: owner,
      mint: mintSigner.address,
      mintAuthority: walletSigner,
      name: fields.name,
      symbol: fields.symbol,
      uri: fields.uri,
    }),
    // `getInitializeTokenMetadataInstruction` only writes name/symbol/uri, so
    // the fields the backend verifies (roseId, message) are appended here.
    ...fields.additionalMetadata.map(([field, value]) =>
      token.getUpdateTokenMetadataFieldInstruction({
        metadata: mintSigner.address,
        updateAuthority: walletSigner,
        field: token.tokenMetadataField("Key", [field]),
        value,
      }),
    ),
    token.getCreateAssociatedTokenInstruction({
      payer: walletSigner,
      ata,
      owner,
      mint: mintSigner.address,
      tokenProgram: token.TOKEN_2022_PROGRAM_ADDRESS,
    }),
    token.getMintToInstruction({
      mint: mintSigner.address,
      token: ata,
      mintAuthority: walletSigner,
      amount: 1n,
    }),
    // 1-of-1: after this the supply can never grow.
    token.getSetAuthorityInstruction({
      owned: mintSigner.address,
      owner: walletSigner,
      authorityType: token.AuthorityType.MintTokens,
      newAuthority: null,
    }),
  ];

  const message = kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    (tx) => kit.setTransactionMessageFeePayerSigner(walletSigner, tx),
    (tx) => kit.setTransactionMessageLifetimeUsingBlockhash(lifetime, tx),
    (tx) => kit.appendTransactionMessageInstructions(instructions, tx),
  );

  // The mint account must sign its own creation; the wallet signs as payer and
  // as every authority above. Both signatures must be on the tx before it is
  // broadcast, otherwise the runtime rejects it. `partiallySign…` signs with
  // every signer the message carries keys for (here: the freshly generated mint
  // keypair) and leaves the wallet's noop signer untouched; Wallet Standard
  // signing then preserves the mint signature and adds the wallet's own.
  const signedByMint = await kit.partiallySignTransactionMessageWithSigners(
    message,
  );
  const wire = Uint8Array.from(kit.getTransactionEncoder().encode(signedByMint));

  step("③ 等待钱包签名…");
  const signed = await input.signTransaction(wire);

  step("④ 广播交易…");
  // Preflight stays ON here (unlike the memo path): a failure is cheap to
  // catch before broadcast, and a rejected simulation costs nothing. It is
  // also what surfaces a wallet that dropped the mint account's signature.
  let signature: string;
  try {
    signature = await sendSignedTransaction(signed, {
      skipPreflight: false,
      maxRetries: 5,
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    if (/signature|signer/i.test(reason)) {
      throw new Error(
        `钱包没有保留 mint 账户的签名，交易未广播（未扣费）。请重试；若反复失败，请换一个钱包。原始错误：${reason}`,
      );
    }
    throw e;
  }

  step("⑤ 等待链上最终确认…");
  // A timeout here is NOT a failure. The tx is already broadcast and may still
  // land; the backend re-reads the mint at `finalized` with its own retries and
  // is the authority on whether it exists. Throwing would make the UI offer a
  // "retry mint", which would create a *second* NFT for the same rose.
  try {
    await confirmSignature(signature, lifetime);
  } catch {
    step("⑤ 交易已广播，仍在等待最终确认…");
  }

  return {
    mintAddress: mintSigner.address,
    signature,
    name: fields.name,
    uri: fields.uri,
  };
}
