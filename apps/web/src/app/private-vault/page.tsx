"use client";

import { useState } from "react";
import Link from "next/link";
import { DecryptPermission } from "@demox-labs/aleo-wallet-adapter-base";
import { WalletProvider, useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import { LeoWalletAdapter, LeoWalletName } from "@demox-labs/aleo-wallet-adapter-leo";
import { Button } from "@/components/ui/button";
import { ALEO_NETWORK, ALEO_PROGRAM_ID, createPrivateRoseTransaction } from "@/lib/aleo";
import { buildAleoVaultInputs, getRecommendation } from "@/lib/recommend";

function VaultForm() {
  const { wallet, publicKey, connected, connecting, select, connect, requestTransaction } = useWallet();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [error, setError] = useState("");

  async function connectWallet() {
    setError("");
    try {
      if (!wallet) {
        select(LeoWalletName);
        return;
      }
      await connect(DecryptPermission.UponRequest, ALEO_NETWORK, [ALEO_PROGRAM_ID]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "钱包连接失败");
    }
  }

  async function plantPrivateRose() {
    const note = content.trim();
    if (!note) {
      setError("请先写下一段只属于你的内容");
      return;
    }
    if (!publicKey || !requestTransaction) {
      setError("请先连接 Leo Wallet");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const recommendation = await getRecommendation([{ color: "white", anxiety: note }]);
      const summary = recommendation
        ? `${recommendation.flower_language.title}：${recommendation.theme.title}`
        : "一份只在本地生成的私密回应";
      const inputs = await buildAleoVaultInputs(
        crypto.randomUUID(),
        note,
        summary,
        crypto.randomUUID(),
      );
      const id = await requestTransaction(createPrivateRoseTransaction(publicKey, inputs));
      setAiSummary(summary);
      setTransactionId(id);
      setContent("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "私密玫瑰创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative z-10 mx-auto max-w-2xl px-4 py-12">
      <div className="space-y-8">
        <header>
          <p className="text-sm text-emerald-300">Aleo Private Vault</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-100">把真实留给自己</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
            原文和本地 AI 回应不会发送到 Roselet 后端。Aleo 只接收不可逆承诺，并把私密记录交给你的钱包。
          </p>
        </header>

        <section className="space-y-4 border-y border-white/10 py-6">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={500}
            placeholder="写下一段不想公开的感恩、焦虑或期待"
            className="min-h-40 w-full rounded-md border border-white/10 bg-black/20 p-4 text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">{content.length}/500</span>
            {!connected ? (
              <Button onClick={connectWallet} disabled={connecting} variant="outline">
                {connecting ? "连接中..." : wallet ? "确认连接" : "连接 Leo Wallet"}
              </Button>
            ) : (
              <Button onClick={plantPrivateRose} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-500">
                {submitting ? "等待钱包确认..." : "种下私密玫瑰"}
              </Button>
            )}
          </div>
          {publicKey && <p className="break-all text-xs text-slate-500">{publicKey}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </section>

        {transactionId && (
          <section className="space-y-3 border-l-2 border-emerald-400/50 pl-4">
            <h2 className="font-medium text-emerald-200">私密记录已交给钱包</h2>
            <p className="text-sm text-slate-300">{aiSummary}</p>
            <p className="break-all text-xs text-slate-500">钱包请求编号：{transactionId}</p>
          </section>
        )}

        <Link href="/plant" className="inline-block text-sm text-slate-400 hover:text-rose-300">
          返回普通种花
        </Link>
      </div>
    </main>
  );
}

export default function PrivateVaultPage() {
  const [wallets] = useState(() => [new LeoWalletAdapter({ appName: "Roselet" })]);
  return (
    <WalletProvider
      wallets={wallets}
      decryptPermission={DecryptPermission.UponRequest}
      network={ALEO_NETWORK}
      programs={[ALEO_PROGRAM_ID]}
      autoConnect
    >
      <VaultForm />
    </WalletProvider>
  );
}
