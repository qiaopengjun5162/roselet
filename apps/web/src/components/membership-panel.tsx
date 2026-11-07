"use client";

import { useEffect, useRef, useState } from "react";
import {
  Connection,
  Transaction,
  TransactionInstruction,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import { SOLANA_MINT_EVENT, useMembership } from "@/app/membership-context";
import { getToken, uploadImageToIpfs } from "@/lib/api";

// Canonical SPL Memo program (Solana official docs / x402). Must match the
// backend's MEMO_PROGRAM_IDS or server-side verification will reject the tx.
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
// Step 1 targets Devnet. Switch to mainnet-beta when going live.
const SOLANA_CLUSTER = "devnet";
// Point this at the same cluster the backend verifies against (SOLANA_RPC_URL).
const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(SOLANA_CLUSTER);

export function MembershipPanel() {
  const {
    isMember,
    panelOpen,
    closePanel,
    mintTargetRoseId,
    clearMintTarget,
    toggleMember,
    walletAddress,
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
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  async function handleUpload() {
    if (!imageFile) return;
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

  async function handleMint() {
    setError(null);
    setStatus(null);

    if (!walletAddress) {
      setError("请先连接钱包");
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

    setBusy(true);
    try {
      const meta = {
        roseId: roseId.trim(),
        message: message.trim(),
        imageCid: imageCid.trim() || null,
        createdAt: new Date().toISOString(),
      };

      // Build a Solana Memo transaction (on Devnet) carrying the reference,
      // have the connected wallet sign it, then broadcast.
      const connection = new Connection(SOLANA_RPC_URL, "confirmed");
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      const feePayer = new PublicKey(walletAddress);
      const ix = new TransactionInstruction({
        programId: MEMO_PROGRAM_ID,
        keys: [],
        data: new TextEncoder().encode(JSON.stringify(meta)) as Buffer,
      });
      const tx = new Transaction({ feePayer, blockhash, lastValidBlockHeight }).add(ix);

      const provider = window.solana;
      if (!provider?.signTransaction) {
        throw new Error("当前钱包不支持签名交易");
      }
      const signed = await provider.signTransaction(tx);
      const signature = await connection.sendRawTransaction(
        signed.serialize() as Buffer,
      );
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );

      // Store the on-chain reference on the Roselet backend.
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/rose/${roseId.trim()}/solana`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
          },
          body: JSON.stringify({
            signature,
            account: walletAddress,
            wallet_address: walletAddress,
            ipfs_cid: imageCid.trim() || null,
            on_chain_metadata: meta,
          }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`后端保存失败（${res.status}）: ${text}`);
      }

      setStatus(
        `✅ 已上链！签名：${signature.slice(0, 12)}…\nSolana Explorer: https://explorer.solana.com/tx/${signature}?cluster=${SOLANA_CLUSTER}`,
      );
      setMessage("");
      setImageCid("");
      setImageFile(null);
      setImageGatewayUrl(null);
      // Let the rose detail page refresh its "已上链" badge.
      window.dispatchEvent(new Event(SOLANA_MINT_EVENT));
    } catch (e) {
      setError(e instanceof Error ? e.message : "上链失败");
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

        <p className="mb-4 text-xs text-slate-400">
          会员模式：连接 Solana 钱包，把玫瑰 / 图片 / 信息写进链上（当前 Devnet 测试网）。点右上角 ✕ 可收起面板去浏览玫瑰，在详情页点「把这朵玫瑰上链」会自动带入 ID。
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
          placeholder="例如 550e8400-e29b-41d4-a716-446655440000"
          className="mb-3 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 outline-none focus:border-rose-400 read-only:opacity-70"
        />

        <label className="mb-1 block text-xs text-slate-400">链上信息（玫瑰寄语）</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
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
            onChange={(e) => {
              setImageFile(e.target.files?.[0] ?? null);
              setUploadError(null);
            }}
            className="min-w-0 flex-1 text-xs text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-violet-500/20 file:px-2 file:py-1 file:text-xs file:text-violet-200"
          />
          <button
            onClick={handleUpload}
            disabled={!imageFile || uploading || busy}
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
          placeholder="bafy…（未配置上传服务时可手填已有 CID）"
          className="mb-4 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 outline-none focus:border-rose-400"
        />

        <button
          onClick={handleMint}
          disabled={busy || !walletAddress}
          className="w-full rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-400 disabled:opacity-40"
        >
          {busy ? "上链中…" : "🚀 上链"}
        </button>

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
