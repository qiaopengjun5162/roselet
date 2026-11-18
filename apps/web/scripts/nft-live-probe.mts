/**
 * Live Devnet verification for the kit-based `mintRoseNft`.
 *
 * Calls the REAL production functions end to end: a wallet is registered with
 * the real `@wallet-standard/app` registry, `connectSolanaWallet()` discovers
 * and connects to it, and `mintRoseNft()` builds / partially signs / broadcasts
 * the transaction. The only simulated part is the wallet's key material: a
 * local Devnet keypair performs the Ed25519 signature a browser extension
 * would otherwise do behind its UI.
 *
 * Run (from the workspace root or apps/web):
 *   pnpm --filter web verify:solana-nft
 *
 * Env (all optional):
 *   NEXT_PUBLIC_SOLANA_RPC_URL / SOLANA_RPC_URL   default api.devnet.solana.com
 *   SOLANA_KEYPAIR        default ~/.config/solana/roselet-nft-demo.json
 *   SOLANA_PROXY          default http://127.0.0.1:7890; "none" = direct
 *   SOLANA_NFT_ROSE_ID    default a fresh random UUID
 *   SOLANA_NFT_NAME       default "kit 真机验证 <date>"
 *   ALLOW_MAINNET=1       required to run against a non-devnet RPC
 *
 * This broadcasts a real transaction and spends SOL. On mainnet that is real
 * money, hence the cluster guard below.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ProxyAgent, setGlobalDispatcher } from "undici";

// Node's built-in fetch ignores HTTP_PROXY, while kit's RPC uses that global
// fetch. undici's global dispatcher is shared with Node's internal fetch, so
// setting it here routes every SDK request through the proxy WITHOUT replacing
// `globalThis.fetch` (whose DOM Response type differs from undici's).
const proxyUrl = process.env.SOLANA_PROXY ?? "http://127.0.0.1:7890";
if (proxyUrl !== "none") setGlobalDispatcher(new ProxyAgent(proxyUrl));

// `lib/solana.ts` snapshots this env var at module load time, so it must be
// set before the dynamic import of any production module.
const RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  process.env.SOLANA_RPC_URL ??
  "https://api.devnet.solana.com";
process.env.NEXT_PUBLIC_SOLANA_RPC_URL = RPC;

if (!/devnet/i.test(RPC) && process.env.ALLOW_MAINNET !== "1") {
  throw new Error(
    "拒绝在非 Devnet 集群运行（会花费真 SOL）。确需在主网验证请显式设置 ALLOW_MAINNET=1",
  );
}

const kit = await import("@solana/kit");
const token = await import("@solana-program/token-2022");
const { mintRoseNft } = await import("../src/lib/rose-nft");
const { connectSolanaWallet, getWalletRegistry, listSolanaWallets } =
  await import("../src/lib/wallet");

type RegisteredWallet = Parameters<
  ReturnType<typeof import("@wallet-standard/app").getWallets>["register"]
>[0];

const keypairPath =
  process.env.SOLANA_KEYPAIR ??
  join(homedir(), ".config/solana/roselet-nft-demo.json");
const secret = new Uint8Array(JSON.parse(readFileSync(keypairPath, "utf8")));
const payer = await kit.createKeyPairSignerFromBytes(secret);
const roseId = process.env.SOLANA_NFT_ROSE_ID ?? crypto.randomUUID();
const roseName =
  process.env.SOLANA_NFT_NAME ??
  `kit 真机验证 ${new Date().toISOString().slice(0, 10)}`;
const rpc = kit.createSolanaRpc(RPC);

console.log("RPC             :", RPC);
console.log("payer           :", payer.address);
console.log("roseId          :", roseId);
console.log("NOTE            : 本脚本会真实广播交易并花费 SOL（Devnet 为测试币）");
const before = (await rpc.getBalance(payer.address).send()).value;
console.log("balance before  :", before, "lamports");

/** Emulates `solana:signTransaction`: add one signature, preserve the rest. */
let signaturesOnWire = 0;
let chainSeenByWallet = "(none)";
const account = {
  address: payer.address,
  chains: ["solana:devnet", "solana:mainnet"] as const,
  features: [] as string[],
};

const probeWallet = {
  version: "1.0.0",
  name: "Roselet Devnet Probe",
  icon: "data:image/svg+xml,<svg/>",
  chains: ["solana:devnet", "solana:mainnet"],
  accounts: [account],
  features: {
    "standard:connect": {
      version: "1.0.0",
      connect: async () => ({ accounts: [account] }),
    },
    "solana:signTransaction": {
      version: "1.0.0",
      supportedTransactionVersions: ["legacy", 0],
      signTransaction: async (
        ...inputs: { transaction: Uint8Array; chain?: string }[]
      ) =>
        Promise.all(
          inputs.map(async ({ transaction, chain }) => {
            chainSeenByWallet = chain ?? "(none)";
            const tx = kit.getTransactionDecoder().decode(transaction);
            const signatures = { ...tx.signatures } as Record<
              string,
              Uint8Array | null
            >;
            const present = Object.entries(signatures)
              .filter(([, s]) => s != null)
              .map(([address]) => address);
            signaturesOnWire = present.length;
            console.log(
              "  [wallet] pre-existing signatures:",
              present.length,
              present.map((a) => a.slice(0, 8)),
            );

            // Copy into a plain Uint8Array: kit brands messageBytes with
            // `ArrayBufferLike`, while WebCrypto's BufferSource requires a
            // concrete ArrayBuffer. The bytes signed are identical.
            const messageBytes = Uint8Array.from(tx.messageBytes);
            const sig = new Uint8Array(
              await crypto.subtle.sign(
                "Ed25519",
                payer.keyPair.privateKey,
                messageBytes,
              ),
            );
            signatures[payer.address] = sig;
            const signed = { ...tx, signatures } as typeof tx;
            return {
              signedTransaction: Uint8Array.from(
                kit.getTransactionEncoder().encode(signed),
              ),
            };
          }),
        ),
    },
    "standard:disconnect": {
      version: "1.0.0",
      disconnect: async () => {},
    },
  },
} as unknown as RegisteredWallet;

// Register through the production module's OWN registry instance. Importing
// `@wallet-standard/app` here would give tsx a second ESM/CJS copy with a
// separate wallet list, and the session would see zero wallets.
getWalletRegistry().register(probeWallet);
const discovered = listSolanaWallets();
if (!discovered.some((w) => w.name === probeWallet.name)) {
  throw new Error("钱包注册表未发现探针钱包（会话层与注册表实例不一致）");
}
const session = await connectSolanaWallet();
if (session.address !== payer.address) {
  throw new Error(`钱包会话地址不一致: ${session.address}`);
}
console.log("wallet session  : Wallet Standard（真实注册表，已发现并连接）");

const result = await mintRoseNft({
  walletAddress: session.address,
  roseId,
  roseName,
  imageCid: null,
  signTransaction: session.signTransaction,
  onStep: (s) => console.log("  [step]", s),
});
console.log("chain given to wallet :", chainSeenByWallet);

// The mint path treats a finality timeout as a soft failure, so the account
// may not be visible yet. Poll briefly instead of failing the whole probe.
const readMint = () =>
  rpc
    .getAccountInfo(kit.address(result.mintAddress), {
      encoding: "jsonParsed",
      commitment: "finalized",
    })
    .send();
let accountInfo = await readMint();
for (let i = 0; i < 10 && !accountInfo.value; i++) {
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  accountInfo = await readMint();
}
const info = (
  accountInfo.value?.data as { parsed?: { info?: Record<string, unknown> } }
)?.parsed?.info;

const [ata] = await token.findAssociatedTokenPda({
  owner: payer.address,
  tokenProgram: token.TOKEN_2022_PROGRAM_ADDRESS,
  mint: kit.address(result.mintAddress),
});
const ataAccount = await rpc
  .getAccountInfo(ata, { encoding: "jsonParsed", commitment: "finalized" })
  .send();
const txInfo = await rpc
  .getTransaction(kit.signature(result.signature), {
    encoding: "base64",
    maxSupportedTransactionVersion: 0,
    commitment: "finalized",
  })
  .send();
const rawTx = txInfo?.transaction?.[0];
const after = (await rpc.getBalance(payer.address).send()).value;

console.log("\n=== RESULT ===");
console.log("mintAddress     :", result.mintAddress);
console.log("signature       :", result.signature);
console.log("name / uri      :", result.name, "/", result.uri);
console.log("mint sig kept   :", signaturesOnWire >= 1);

console.log("\n=== ON-CHAIN (jsonParsed / finalized) ===");
console.log("owner           :", accountInfo.value?.owner);
console.log("mint space/rent :", accountInfo.value?.space, "/", accountInfo.value?.lamports);
console.log("ATA space/rent  :", ataAccount.value?.space, "/", ataAccount.value?.lamports);
console.log("ATA amount      :", JSON.stringify(
  (ataAccount.value?.data as { parsed?: { info?: { tokenAmount?: unknown } } })?.parsed?.info?.tokenAmount,
));
console.log("decimals/supply :", info?.decimals, "/", info?.supply);
console.log("mintAuthority   :", info?.mintAuthority);
console.log("extensions      :", JSON.stringify(info?.extensions, null, 2).slice(0, 1600));
console.log("\ntx raw bytes    :", rawTx ? Buffer.from(rawTx, "base64").length : "(n/a)");
console.log("fee             :", txInfo?.meta?.fee, "err:", txInfo?.meta?.err);
console.log("balance after   :", after, "lamports");
console.log("total spent     :", Number(before - after), "lamports");

console.log("\n=== backend live test env ===");
console.log(`SOLANA_NFT_MINT=${result.mintAddress}`);
console.log(`SOLANA_NFT_ROSE_ID=${roseId}`);
console.log(`SOLANA_NFT_WALLET=${payer.address}`);
console.log(`SOLANA_RPC_URL=${RPC}`);

if (signaturesOnWire < 1) {
  throw new Error("mint signature was lost before wallet signing");
}
if (chainSeenByWallet !== "solana:devnet") {
  throw new Error(`unexpected chain passed to wallet: ${chainSeenByWallet}`);
}
if (info?.supply !== "1") {
  throw new Error(`unexpected supply: ${info?.supply}`);
}
console.log("\nPROBE OK");
