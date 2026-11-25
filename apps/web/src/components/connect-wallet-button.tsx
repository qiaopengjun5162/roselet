"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useOptionalMembership } from "@/app/membership-context";
import { WalletPicker } from "@/components/wallet-picker";
import { shortWalletAddress, toWalletOptions } from "@/lib/wallet-chains";

/**
 * The single place a wallet is connected.
 *
 * Before this, connecting meant four different things depending on the screen:
 * pick a wallet on /login, pick a wallet again in /membership, pick one a third
 * time inside the mint panel, or hit the lone "connect Leo Wallet" button on
 * /private-vault. This button opens one chooser that lists every chain the app
 * supports, so the answer to "where do I connect a wallet?" is always the same
 * corner of the screen.
 *
 * It renders nothing without a MembershipProvider, which keeps unit tests and
 * the plain Web3-free shell unaffected.
 */
export function ConnectWalletButton() {
  const membership = useOptionalMembership();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!membership) return null;

  const bound = Boolean(membership.memberAddress);
  const signing = Boolean(membership.walletAddress);
  const busy = membership.loggingIn;

  async function pickSolana(name: string) {
    const ok = await membership!.loginWithWallet(name);
    if (ok) {
      setOpen(false);
      router.push("/membership");
    }
  }

  function pickAleo() {
    setOpen(false);
    // Aleo's provider lives on the Vault page; without membership that page
    // only shows the upgrade gate, so send people to the membership centre
    // first rather than to a dead end.
    router.push(bound ? "/private-vault" : "/membership");
  }

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={bound ? "钱包已连接" : "连接钱包"}
        className={`whitespace-nowrap text-[13px] px-1.5 sm:px-3 py-1.5 rounded-full transition-all duration-200 ${
          bound
            ? "bg-violet-500/20 text-violet-200 border border-violet-400/40"
            : "text-violet-300/80 hover:text-violet-200 hover:bg-violet-500/10 border border-violet-400/25"
        }`}
        title={
          bound
            ? `会员钱包 ${shortWalletAddress(membership.memberAddress ?? "")}`
            : "连接钱包：可用 Solana 登录并开通会员，或进入 Aleo 私密 Vault"
        }
      >
        {bound ? (
          <>
            <span aria-hidden="true">🔗</span>
            <span className="hidden sm:inline"> {shortWalletAddress(membership.memberAddress ?? "")}</span>
          </>
        ) : (
          <>
            <span aria-hidden="true">🔗</span>
            <span className="hidden sm:inline"> 连接钱包</span>
          </>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-label="连接钱包"
            className="absolute right-0 top-full mt-2 z-50 w-[19rem] max-w-[calc(100vw-1.5rem)] rounded-xl border border-white/10 bg-[#0f081e]/95 p-4 backdrop-blur-xl shadow-2xl"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-100">
                  {bound ? "钱包已连接" : "连接钱包"}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                  {bound
                    ? "会员身份已绑定在账号上；重新连接只恢复签名能力。"
                    : "用 Solana 钱包登录并开通会员，不需要注册账号。"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="关闭"
                className="text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            </div>

            {bound && signing && (
              <div className="mb-3 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-[11px]">
                <span className="text-emerald-300">签名会话已连接，可以上链</span>
                <button
                  type="button"
                  onClick={membership.disconnectWallet}
                  className="text-rose-300 hover:text-rose-200"
                >
                  断开
                </button>
              </div>
            )}

            <WalletPicker
              wallets={toWalletOptions(membership.solanaWallets)}
              showExternal
              compact
              busy={busy}
              busyLabel="等待钱包签名…"
              actionLabel={(wallet) =>
                wallet.chain === "solana"
                  ? bound
                    ? `连接 ${wallet.name}`
                    : `使用 ${wallet.name} 登录`
                  : `去 ${wallet.name} 连接 Vault`
              }
              onPick={(wallet) => pickSolana(wallet.name)}
              onExternal={() => pickAleo()}
            />

            {membership.connectError && (
              <p className="mt-3 text-[11px] leading-4 text-red-400" role="alert">
                {membership.connectError}
              </p>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 text-[11px]">
              <Link
                href="/membership"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-violet-200"
              >
                {bound ? "会员中心 →" : "会员权益说明 →"}
              </Link>
              <Link
                href={bound ? "/private-vault" : "/membership"}
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-violet-200"
              >
                Aleo Vault
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
