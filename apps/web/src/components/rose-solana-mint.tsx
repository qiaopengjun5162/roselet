"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getSolanaMint, type Rose, type SolanaMint } from "@/lib/api";
import { SOLANA_MINT_EVENT, useOptionalMembership } from "@/app/membership-context";

const SOLANA_CLUSTER = "devnet";

interface RoseSolanaMintProps {
  rose: Rose;
  /** Whether the current viewer owns the rose (may create a mint). */
  canMint: boolean;
}

/**
 * Membership-only Solana on-chain section for a rose detail page.
 *
 * In the default (plain) mode this renders nothing at all — no Web3 surface.
 * Deliberately split into an outer gate + an inner section so that pages
 * rendered without a MembershipProvider (e.g. unit tests) never mount the
 * inner component and therefore never call the Solana API.
 */
export function RoseSolanaMint({ rose, canMint }: RoseSolanaMintProps) {
  const membership = useOptionalMembership();
  if (!membership || !membership.isMember) return null;
  // Private roses cannot have a public Solana mint (backend rejects them).
  if (rose.is_private) return null;

  return (
    <SolanaMintSection
      roseId={rose.id}
      canMint={canMint}
      openMint={membership.openMint}
    />
  );
}

function SolanaMintSection({
  roseId,
  canMint,
  openMint,
}: {
  roseId: string;
  canMint: boolean;
  openMint: (roseId: string) => void;
}) {
  const [mint, setMint] = useState<SolanaMint | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    getSolanaMint(roseId)
      .then(setMint)
      .catch(() => setMint(null))
      .finally(() => setLoading(false));
  }, [roseId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // The membership panel fires this after a successful mint.
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener(SOLANA_MINT_EVENT, handler);
    return () => window.removeEventListener(SOLANA_MINT_EVENT, handler);
  }, [refresh]);

  if (loading) return null;

  if (mint) {
    const meta = mint.on_chain_metadata ?? {};
    const message = typeof meta.message === "string" ? meta.message : "";
    return (
      <section className="border-t border-violet-400/20 pt-5">
        <p className="text-sm font-medium text-violet-200">🌐 已在 Solana 留下链上记录</p>
        {message && <p className="mt-2 text-sm leading-relaxed text-slate-300">{message}</p>}
        {mint.ipfs_cid && (
          <p className="mt-1 break-all text-xs text-slate-400">图片 CID：{mint.ipfs_cid}</p>
        )}
        <a
          className="mt-3 inline-block text-xs text-violet-300 underline underline-offset-4 hover:text-violet-100"
          href={`https://explorer.solana.com/tx/${mint.signature}?cluster=${SOLANA_CLUSTER}`}
          target="_blank"
          rel="noreferrer"
        >
          查看链上交易
        </a>
      </section>
    );
  }

  if (!canMint) return null;

  return (
    <section className="border-t border-white/10 pt-5">
      <p className="text-sm font-medium text-slate-200">🌐 把这朵玫瑰写进 Solana</p>
      <p className="mt-1 text-xs text-slate-400">
        会员专属：连接钱包后，把这朵玫瑰的寄语 / 图片引用写到链上（当前 Devnet 测试网）。
      </p>
      <Button
        size="sm"
        onClick={() => openMint(roseId)}
        className="mt-3 border border-violet-400/40 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30"
      >
        🚀 把这朵玫瑰上链
      </Button>
    </section>
  );
}
