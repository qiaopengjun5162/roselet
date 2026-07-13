"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  verifyRoseMemorial,
  type OnChainMint,
  type Rose,
} from "@/lib/api";

interface RoseMemorialProps {
  rose: Rose;
  mint: OnChainMint | null;
  canMint: boolean;
  onVerified: (mint: OnChainMint) => void;
}

export function RoseMemorial({ rose, mint, canMint, onVerified }: RoseMemorialProps) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "minting" | "verifying">("idle");
  const [error, setError] = useState("");

  if (mint) {
    return (
      <section className="border-t border-emerald-400/20 pt-5">
        <p className="text-sm font-medium text-emerald-200">已在 Base Sepolia 留下链上纪念版</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{mint.on_chain_message}</p>
        <a
          className="mt-3 inline-block text-xs text-emerald-300 underline underline-offset-4 hover:text-emerald-100"
          href={`https://sepolia.basescan.org/tx/${mint.tx_hash}`}
          target="_blank"
          rel="noreferrer"
        >
          查看已验证交易
        </a>
      </section>
    );
  }

  if (!canMint || rose.is_private) return null;

  async function handleMint() {
    const trimmed = message.trim();
    if (!trimmed) {
      setError("写下一句想永久留存的话");
      return;
    }

    setError("");
    setStatus("minting");
    try {
      const { mintRoseMemorial } = await import("@/lib/chain");
      const { txHash, walletAddress } = await mintRoseMemorial(rose.id, rose.color, trimmed);
      setStatus("verifying");
      const verified = await verifyRoseMemorial(rose.id, {
        tx_hash: txHash,
        wallet_address: walletAddress,
        message: trimmed,
      });
      onVerified(verified);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "链上纪念版创建失败");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <section className="border-t border-white/10 pt-5">
      <h2 className="text-base font-semibold text-slate-100">链上纪念版</h2>
      <p className="mt-1 text-sm text-slate-400">只把你选择的一句话和玫瑰颜色写入 Base Sepolia，完整内容仍保留在 Roselet。</p>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        maxLength={200}
        placeholder="写下一句想留存的话"
        className="mt-3 min-h-24 w-full rounded-md border border-white/10 bg-black/20 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">{message.trim().length}/200</span>
        <Button
          size="sm"
          onClick={handleMint}
          disabled={status !== "idle"}
          className="bg-emerald-600 hover:bg-emerald-500"
        >
          {status === "minting" ? "等待钱包确认..." : status === "verifying" ? "验证交易中..." : "创建纪念版"}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </section>
  );
}
