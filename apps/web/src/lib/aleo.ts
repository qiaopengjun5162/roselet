import {
  Transaction,
  WalletAdapterNetwork,
  type AleoTransaction,
} from "@demox-labs/aleo-wallet-adapter-base";
import type { AleoVaultInputs } from "@/lib/recommend";

export const ALEO_PROGRAM_ID = process.env.NEXT_PUBLIC_ALEO_VAULT_PROGRAM_ID || "roselet_private_vault.aleo";
export const ALEO_NETWORK = WalletAdapterNetwork.Testnet;

export function createPrivateRoseTransaction(
  publicKey: string,
  inputs: AleoVaultInputs,
): AleoTransaction {
  const fee = Number(process.env.NEXT_PUBLIC_ALEO_EXECUTION_FEE_MICROCREDITS || "100000");
  if (!Number.isSafeInteger(fee) || fee <= 0) throw new Error("Aleo 执行费用配置无效");

  return Transaction.createTransaction(
    publicKey,
    ALEO_NETWORK,
    ALEO_PROGRAM_ID,
    "plant_private_rose",
    [inputs.rose_id, inputs.content_commitment, inputs.ai_reply_commitment, inputs.share_key],
    fee,
  );
}
