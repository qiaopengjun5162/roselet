"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getRoseNft,
  recordRoseNft,
  type Rose,
  type SolanaNft,
} from "@/lib/api";
import { mintRoseNft } from "@/lib/rose-nft";
import type { SignTransactionFn } from "@/lib/solana-rpc";
import {
  CLUSTER,
  ROSE_NFT_ATA_RENT_LAMPORTS,
  ROSE_NFT_MINT_RENT_LAMPORTS,
  ROSE_NFT_RENT_ESTIMATE_LAMPORTS,
  clusterLabel,
  clusterSpendsRealSol,
  explorerAccountUrl,
  explorerTxUrl,
  lamportsToSol,
} from "@/lib/solana";
import { useOptionalMembership } from "@/app/membership-context";

/** Turn a raw SDK/RPC failure into something the user can act on. */
function withNftHint(message: string): string {
  if (/insufficient lamports|Attempt to debit|insufficient funds/i.test(message)) {
    return `${message}\n提示：钱包 SOL 不足。铸造需要约 ${lamportsToSol(
      ROSE_NFT_RENT_ESTIMATE_LAMPORTS,
    )} SOL 的账户租金（多数不可退回），外加少量手续费。`;
  }
  if (
    /Blockhash not found|block height exceeded|Transaction was not confirmed|simulation failed/i.test(
      message,
    )
  ) {
    return `${message}\n提示：请确认 Phantom 网络与当前集群（${clusterLabel(
      CLUSTER,
    )}）一致。`;
  }
  return message;
}

/**
 * Membership-only "mint this rose as a Token-2022 NFT" section.
 *
 * Renders nothing at all unless membership mode is on, so the default
 * (plain) experience has no Web3 surface. Split into an outer gate and an
 * inner section for the same reason as `rose-solana-mint`: a page rendered
 * without a `MembershipProvider` must never mount the inner component (and
 * therefore never calls the API).
 */
export function RoseNftMint({
  rose,
  canMint,
}: {
  rose: Rose;
  canMint: boolean;
}) {
  const membership = useOptionalMembership();
  if (!membership || !membership.isMember) return null;
  // Private roses cannot hold a public on-chain asset.
  if (rose.is_private) return null;

  return (
    <NftMintSection
      rose={rose}
      canMint={canMint}
      walletAddress={membership.walletAddress}
      signTransaction={membership.signTransaction}
      openPanel={membership.openPanel}
    />
  );
}

function NftMintSection({
  rose,
  canMint,
  walletAddress,
  signTransaction,
  openPanel,
}: {
  rose: Rose;
  canMint: boolean;
  walletAddress: string | null;
  /** Wallet Standard signer from the membership context; null until connected. */
  signTransaction: SignTransactionFn | null;
  openPanel: () => void;
}) {
  const [nft, setNft] = useState<SolanaNft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set once the mint transaction is on the cluster. While set, a retry only
  // re-submits the same mint address to the backend — minting again would
  // create a second NFT and cost another ~0.005 SOL.
  const [pending, setPending] = useState<{
    mintAddress: string;
    signature: string;
    wallet: string;
  } | null>(null);

  const refresh = useCallback(() => {
    getRoseNft(rose.id)
      .then(setNft)
      .catch(() => setNft(null))
      .finally(() => setLoading(false));
  }, [rose.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function save(mintAddress: string, wallet: string) {
    setStep("⑥ 后端核验链上状态…");
    const stored = await recordRoseNft(rose.id, {
      mint_address: mintAddress,
      wallet_address: wallet,
    });
    setNft(stored);
    setPending(null);
    setStep(null);
    setError(null);
  }

  async function handleMint() {
    setError(null);

    if (pending) {
      setBusy(true);
      try {
        await save(pending.mintAddress, pending.wallet);
      } catch (e) {
        setStep(null);
        setError(e instanceof Error ? e.message : "保存失败");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!walletAddress || !signTransaction) {
      openPanel();
      return;
    }

    setBusy(true);
    try {
      const result = await mintRoseNft({
        walletAddress,
        roseId: rose.id,
        // The rose's own words become the NFT name (truncated to 32 bytes) and
        // the full text is stored again in the `message` metadata field.
        roseName: rose.gratitude ?? rose.hope ?? rose.anxiety ?? "",
        signTransaction,
        onStep: setStep,
      });

      setPending({
        mintAddress: result.mintAddress,
        signature: result.signature,
        wallet: walletAddress,
      });
      await save(result.mintAddress, walletAddress);
    } catch (e) {
      setStep(null);
      setError(withNftHint(e instanceof Error ? e.message : "铸造失败"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  if (nft) {
    const roseIdField = nft.additional_metadata?.find(
      (field) => field.key.toLowerCase() === "roseid",
    );
    return (
      <section className="border-t border-amber-400/20 pt-5">
        <p className="text-sm font-medium text-amber-200">🌹 已铸成链上 NFT</p>
        <dl className="mt-2 space-y-1 text-xs text-slate-400">
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-500">名称</dt>
            <dd className="break-all text-slate-300">{nft.name}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-500">Mint</dt>
            <dd className="break-all">
              <a
                className="text-amber-300 underline underline-offset-4 hover:text-amber-100"
                href={explorerAccountUrl(nft.mint_address, CLUSTER)}
                target="_blank"
                rel="noreferrer"
              >
                {nft.mint_address}
              </a>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-500">URI</dt>
            <dd className="break-all text-slate-300">{nft.uri}</dd>
          </div>
          {roseIdField && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-slate-500">绑定玫瑰</dt>
              <dd className="break-all text-slate-300">{roseIdField.value}</dd>
            </div>
          )}
        </dl>
        <p className="mt-2 text-[10px] text-slate-500">
          供应量 1、增发权限已撤销，链上无法再增发第二枚。
        </p>
      </section>
    );
  }

  if (!canMint) return null;

  return (
    <section className="border-t border-white/10 pt-5">
      <p className="text-sm font-medium text-slate-200">🌹 铸成链上 NFT</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        以这朵玫瑰的寄语作为 NFT 元数据，铸造一枚 Token-2022 NFT（{clusterLabel(CLUSTER)}
        ）。铸造后供应量固定为 1，增发权限当场撤销。
      </p>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
        成本约 {lamportsToSol(ROSE_NFT_RENT_ESTIMATE_LAMPORTS)} SOL：其中{" "}
        {lamportsToSol(ROSE_NFT_MINT_RENT_LAMPORTS)} SOL 是 NFT 本身的账户租金，
        <span className="text-slate-400">会永久锁在链上</span>
        （这枚 NFT 不设关闭权限、供应量固定为 1，无法退还）；
        {lamportsToSol(ROSE_NFT_ATA_RENT_LAMPORTS)} SOL 是持有账户（ATA）的租金，
        销毁后关闭该账户可退回。手续费仅约 0.00002 SOL。 比「轻量存证」贵约 1000
        倍，换来的是一枚可转让、可被钱包识别的链上资产。
      </p>
      {clusterSpendsRealSol(CLUSTER) && (
        <p className="mt-2 text-[10px] text-amber-300">
          ⚠️ 当前连接的是主网，铸造会消耗真 SOL 且不可撤销
        </p>
      )}

      <Button
        size="sm"
        onClick={handleMint}
        disabled={busy}
        className="mt-3 border border-amber-400/40 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
      >
        {busy
          ? "铸造中…"
          : pending
            ? "↻ 重试保存（不重复铸造）"
            : walletAddress
              ? "🌹 铸成 NFT"
              : "🔌 先连接钱包"}
      </Button>

      {step && <p className="mt-3 text-xs text-slate-300">{step}</p>}
      {pending && (
        <p className="mt-2 text-xs text-amber-300">
          交易已广播（mint {pending.mintAddress.slice(0, 8)}…），仅差后端保存。
          重试只会重新提交，不会重复铸造。
        </p>
      )}
      {pending && (
        <a
          className="mt-1 inline-block text-[10px] text-amber-300/80 underline underline-offset-4"
          href={explorerTxUrl(pending.signature, CLUSTER)}
          target="_blank"
          rel="noreferrer"
        >
          查看铸造交易
        </a>
      )}
      {error && (
        <p className="mt-3 whitespace-pre-wrap text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
