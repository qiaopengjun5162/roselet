"use client";

import { useEffect, useRef, useState } from "react";
import { SOLANA_MINT_EVENT, useMembership } from "@/app/membership-context";
import { getToken, uploadImageToIpfs } from "@/lib/api";
import {
  type RoseMemoMeta,
  type SendRoseMemoResult,
  sendRoseMemo,
} from "@/lib/rose-memo";
import { confirmSignature } from "@/lib/solana-rpc";
import {
  CLUSTER,
  PRIORITY_FEE_MICRO_LAMPORTS,
  clusterLabel,
  clusterSpendsRealSol,
  clusterTone,
  estimatedFeeLamports,
  explorerTxUrl,
  priorityFeeLamports,
} from "@/lib/solana";

/**
 * Append an actionable hint for the most common failure: the wallet is on a
 * different network than the app's configured cluster, so the tx is signed for
 * one chain but the app talks to another.
 */
function withNetworkHint(message: string): string {
  const networkish = [
    "Blockhash not found",
    "not confirmed",
    "Transaction was not confirmed",
    "Transaction simulation failed",
    "failed to send transaction",
    "block height exceeded",
  ];
  if (networkish.some((needle) => message.includes(needle))) {
    return `${message}\n提示：请确认 Phantom 网络与当前集群（${clusterLabel(CLUSTER)}）一致。`;
  }
  return message;
}

export function MembershipPanel() {
  const {
    isMember,
    panelOpen,
    closePanel,
    mintTargetRoseId,
    clearMintTarget,
    toggleMember,
    walletAddress,
    signTransaction,
    connectError,
    connectWallet,
    disconnectWallet,
  } = useMembership();

  const [roseId, setRoseId] = useState("");
  const [message, setMessage] = useState("");
  const [imageCid, setImageCid] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageGatewayUrl, setImageGatewayUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set after a successful broadcast whose backend save failed. While set,
  // retrying must only re-save — broadcasting again would put a *second* memo
  // tx on-chain for the same rose, which is permanent and costs real SOL.
  const [pending, setPending] = useState<{
    signature: string;
    wallet: string;
    meta: RoseMemoMeta;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // A rose detail page can open the panel with the rose already selected.
  // Keep the input in sync whenever a new target is chosen.
  useEffect(() => {
    if (mintTargetRoseId) {
      setRoseId(mintTargetRoseId);
      setStatus(null);
      setError(null);
    }
  }, [mintTargetRoseId]);

  if (!isMember || !panelOpen) return null;

  const locked = Boolean(pending);

  async function handleUpload() {
    if (!imageFile || locked) return;
    setUploading(true);
    setUploadError(null);
    setStatus(null);
    try {
      const result = await uploadImageToIpfs(imageFile);
      setImageCid(result.cid);
      setImageGatewayUrl(result.gateway_url);
      setStatus(
        `✅ 图片已上传到 IPFS，CID 已自动填入：${result.cid.slice(0, 14)}…`,
      );
      setImageFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "图片上传失败");
    } finally {
      setUploading(false);
    }
  }

  /** POST the on-chain reference to the backend (which verifies it via RPC). */
  async function saveOnChainReference(
    signature: string,
    wallet: string,
    meta: RoseMemoMeta,
  ) {
    setProgress("⑤ 后端核验中…");
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const res = await fetch(`${apiBase}/api/rose/${meta.roseId}/solana`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: JSON.stringify({
        signature,
        account: wallet,
        wallet_address: wallet,
        ipfs_cid: meta.imageCid,
        on_chain_metadata: meta,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`后端保存失败（${res.status}）: ${text}`);
    }

    setProgress(null);
    setPending(null);
    setStatus(
      `✅ 已上链！签名：${signature.slice(0, 12)}…\nSolana Explorer: ${explorerTxUrl(signature)}`,
    );
    setMessage("");
    setImageCid("");
    setImageFile(null);
    setImageGatewayUrl(null);
    // Let the rose detail page refresh its "已上链" badge.
    window.dispatchEvent(new Event(SOLANA_MINT_EVENT));
  }

  async function handleMint() {
    setError(null);
    setStatus(null);

    if (!walletAddress || !signTransaction) {
      setError("请先连接钱包");
      return;
    }

    // Retry path: a previous attempt already broadcast a tx, only the backend
    // save failed. Re-save the same signature instead of broadcasting again.
    if (pending) {
      setBusy(true);
      try {
        await saveOnChainReference(pending.signature, pending.wallet, pending.meta);
      } catch (e) {
        setProgress(null);
        setError(e instanceof Error ? e.message : "后端保存失败");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!/^[0-9a-fA-F-]{36}$/.test(roseId.trim())) {
      setError("玫瑰 ID 格式不对（应为 UUID）");
      return;
    }
    if (message.trim().length === 0 && imageCid.trim().length === 0) {
      setError("至少填写「信息」或「图片 CID」之一");
      return;
    }

    const wallet = walletAddress;
    // Set once the RPC has accepted the tx. Used by the catch block to tell a
    // "broadcast failed" error from a "broadcast ok, bookkeeping failed" one —
    // only the former is safe to retry by building a new transaction.
    let pinned: {
      signature: string;
      wallet: string;
      meta: RoseMemoMeta;
    } | null = null;
    setBusy(true);
    try {
      const meta: RoseMemoMeta = {
        app: "roselet",
        roseId: roseId.trim(),
        message: message.trim(),
        imageCid: imageCid.trim() || null,
        createdAt: new Date().toISOString(),
      };

      // Build a Solana Memo transaction carrying the reference, have the
      // connected wallet sign it, then broadcast.
      const sent: SendRoseMemoResult = await sendRoseMemo({
        walletAddress: wallet,
        meta,
        signTransaction,
        onStep: setProgress,
      });

      // Pin the signature the moment the RPC accepts it. From here a retry must
      // only re-save: rebuilding the tx would put a *second* memo for the same
      // rose on-chain, which is permanent and costs real SOL.
      pinned = { signature: sent.signature, wallet, meta: sent.meta };
      setPending(pinned);

      // Wait for finality purely for UX. A timeout here is NOT a failure — the
      // tx may still land, and the backend (which polls at `finalized` with its
      // own retries) is the authority on whether it did.
      try {
        setProgress("④ 等待链上最终确认…");
        await confirmSignature(sent.signature, sent.lifetime);
      } catch {
        setProgress("④ 交易已广播，仍在等待最终确认…");
      }

      await saveOnChainReference(sent.signature, wallet, sent.meta);
    } catch (e) {
      setProgress(null);
      const reason = withNetworkHint(
        e instanceof Error ? e.message : "上链失败",
      );
      setError(
        pinned
          ? `${reason}\n交易已广播（${pinned.signature.slice(0, 10)}…），重试只会重新保存到后端，不会重复上链。`
          : reason,
      );
    } finally {
      setBusy(false);
    }
  }

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#0f081e]/95 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-rose-300">🌐 会员 · Web3 上链</h2>
          <button
            onClick={closePanel}
            className="text-slate-400 hover:text-slate-200"
            title="收起面板（仍保持会员模式，可继续浏览玫瑰）"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${clusterTone(CLUSTER)}`}
          >
            {CLUSTER === "devnet" ? "🟣" : "🔴"} {clusterLabel(CLUSTER)}
          </span>
          {clusterSpendsRealSol(CLUSTER) && (
            <span className="text-[10px] text-amber-300">
              ⚠️ 主网操作会消耗真 SOL，且不可撤销
            </span>
          )}
        </div>

        <p className="mb-4 text-xs text-slate-400">
          会员模式：连接 Solana 钱包，把玫瑰 / 图片 / 信息写进链上（{clusterLabel(CLUSTER)}）。点右上角 ✕ 可收起面板去浏览玫瑰，在详情页点「把这朵玫瑰上链」会自动带入 ID。
        </p>

        {walletAddress ? (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
            <span className="text-xs text-slate-300">钱包：{shortAddr}</span>
            <button
              onClick={disconnectWallet}
              className="text-xs text-rose-300 hover:text-rose-200"
            >
              断开
            </button>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            className="mb-4 w-full rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            🔌 连接钱包（Phantom）
          </button>
        )}
        {connectError && <p className="mb-3 text-xs text-red-400">{connectError}</p>}

        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs text-slate-400">
            玫瑰 ID（要上链的玫瑰）{mintTargetRoseId && <span className="ml-1 text-violet-300">· 已从当前玫瑰自动填入</span>}
          </label>
          {mintTargetRoseId && (
            <button
              onClick={clearMintTarget}
              className="text-xs text-violet-300/70 hover:text-violet-200"
            >
              手动输入其它玫瑰
            </button>
          )}
        </div>
        <input
          value={roseId}
          onChange={(e) => setRoseId(e.target.value)}
          readOnly={Boolean(mintTargetRoseId)}
          disabled={locked}
          placeholder="例如 550e8400-e29b-41d4-a716-446655440000"
          className="mb-3 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 outline-none focus:border-rose-400 read-only:opacity-70"
        />

        <label className="mb-1 block text-xs text-slate-400">链上信息（玫瑰寄语）</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          disabled={locked}
          placeholder="写一句想留在链上的话"
          className="mb-3 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 outline-none focus:border-rose-400"
        />

        <label className="mb-1 block text-xs text-slate-400">
          图片（选一张上传到 IPFS，可选）
        </label>
        <div className="mb-2 flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            aria-label="选择要上链的图片"
            disabled={locked}
            onChange={(e) => {
              setImageFile(e.target.files?.[0] ?? null);
              setUploadError(null);
            }}
            className="min-w-0 flex-1 text-xs text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-violet-500/20 file:px-2 file:py-1 file:text-xs file:text-violet-200"
          />
          <button
            onClick={handleUpload}
            disabled={!imageFile || uploading || busy || locked}
            className="shrink-0 rounded-lg border border-violet-400/40 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-500/10 disabled:opacity-40"
          >
            {uploading ? "上传中…" : "↑ 上传"}
          </button>
        </div>
        {uploadError && (
          <p className="mb-2 text-xs text-amber-300" role="alert">{uploadError}</p>
        )}
        {imageGatewayUrl && (
          <a
            href={imageGatewayUrl}
            target="_blank"
            rel="noreferrer"
            className="mb-2 block text-xs text-violet-300 underline"
          >
            查看已上传的图片（IPFS 网关）
          </a>
        )}

        <label className="mb-1 block text-xs text-slate-400">
          图片 CID（上传后自动填入；也可直接手填）
        </label>
        <input
          value={imageCid}
          onChange={(e) => setImageCid(e.target.value)}
          disabled={locked}
          placeholder="bafy…（未配置上传服务时可手填已有 CID）"
          className="mb-4 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 outline-none focus:border-rose-400"
        />

        <p className="mb-2 text-[10px] leading-relaxed text-slate-500">
          预估手续费 ≈ {estimatedFeeLamports().toLocaleString()} lamports（基础 5000
          {PRIORITY_FEE_MICRO_LAMPORTS > 0
            ? ` + 优先费 ${priorityFeeLamports()}`
            : "，未设优先费"}
          ）· Memo 存证不创建账户，因此没有租金押金
        </p>

        <button
          onClick={handleMint}
          disabled={busy || !walletAddress}
          className="w-full rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-400 disabled:opacity-40"
        >
          {busy
            ? "上链中…"
            : pending
              ? "↻ 重试保存（不重复上链）"
              : error
                ? "↻ 重试上链"
                : "🚀 上链"}
        </button>

        {progress && <p className="mt-3 text-xs text-slate-300">{progress}</p>}
        {pending && (
          <p className="mt-2 text-xs text-amber-300">
            交易已广播（签名 {pending.signature.slice(0, 10)}…），仅差后端保存。重试只会重新保存，不会重复上链。
          </p>
        )}

        {status && (
          <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-300">
            {status}
          </pre>
        )}
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <button
          onClick={toggleMember}
          className="mt-4 w-full text-center text-xs text-slate-500 hover:text-slate-300"
        >
          退出会员模式（回到普通界面）
        </button>
      </div>
    </div>
  );
}
