"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser, logout, type User } from "@/lib/api";
import { useOptionalMembership } from "@/app/membership-context";
import { WalletPicker } from "@/components/wallet-picker";
import { shortWalletAddress, toWalletOptions } from "@/lib/wallet-chains";

const BENEFITS = [
  {
    icon: "🪙",
    title: "玫瑰上链存证",
    detail: "把玫瑰寄语写成 Solana Memo，永久可查、不可篡改。",
  },
  {
    icon: "🖼️",
    title: "图片上传 IPFS",
    detail: "会员专属配额，图片存到 IPFS 后把 CID 一起上链。",
  },
  {
    icon: "🎖️",
    title: "玫瑰 NFT 纪念",
    detail: "用 Token-2022 把一朵玫瑰铸成 1-of-1 的链上纪念。",
  },
  {
    icon: "🔐",
    title: "Aleo 私密 Vault",
    detail: "私密链上记录，需要另外连接 Leo 钱包。",
  },
];

function shortAddress(address: string): string {
  return shortWalletAddress(address);
}

export default function MembershipPage() {
  const membership = useOptionalMembership();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const sync = () => setUser(getUser());
    sync();
    window.addEventListener("auth-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("auth-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const hasMembership = Boolean(membership?.hasMembership);
  const busy = Boolean(membership?.loggingIn);

  async function bindWallet(name: string) {
    const ok = await membership?.loginWithWallet(name);
    if (ok) setUser(getUser());
  }

  async function copyAddress() {
    if (!membership?.memberAddress) return;
    try {
      await navigator.clipboard.writeText(membership.memberAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the address is still visible */
    }
  }

  function handleLogout() {
    logout();
    router.push("/");
  }

  return (
    <main className="relative z-10 mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-violet-300/70">Membership</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">会员中心</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          会员不是订阅，也没有月费。它的含义只有一个：这个账号已经用钱包签名证明过归属。
          绑定之后，上链、图片、NFT 这些功能才会在服务端被允许。
        </p>
      </div>

      {!user ? (
        <section className="rounded-2xl border border-white/10 bg-[#0f081e]/90 p-6 backdrop-blur-xl">
          <h2 className="text-lg font-medium text-slate-100">先登录，再开通会员</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            两种方式都可以。钱包登录会自动创建账号；已有昵称账号的，登录后再绑定钱包即可。
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/login?mode=wallet"
              className="rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              钱包登录 · 开通会员
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
            >
              用昵称登录
            </Link>
          </div>
        </section>
      ) : !hasMembership ? (
        <section className="rounded-2xl border border-violet-400/25 bg-[#0f081e]/90 p-6 backdrop-blur-xl">
          <h2 className="text-lg font-medium text-slate-100">绑定钱包，开通会员</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            当前账号：<span className="text-slate-200">{user.nickname}</span>。
            连接钱包后会让你签一条消息，只验证归属，不发起交易、不扣手续费。
          </p>
          <div className="mt-4">
            <WalletPicker
              wallets={toWalletOptions(membership?.solanaWallets ?? [])}
              compact
              busy={busy}
              busyLabel="等待钱包签名…"
              actionLabel={(wallet) => `连接 ${wallet.name} 并绑定`}
              onPick={(wallet) => bindWallet(wallet.name)}
            />
          </div>
          {membership?.connectError && (
            <p className="mt-3 text-xs text-red-400" role="alert">{membership.connectError}</p>
          )}
        </section>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/5 p-6 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-violet-200/70">已开通会员</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-100">{user.nickname}</h2>
              </div>
              <span className="rounded-full border border-violet-400/40 bg-violet-500/20 px-2.5 py-1 text-[11px] text-violet-100">
                🌐 会员
              </span>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-slate-400">绑定钱包</dt>
                <dd className="flex items-center gap-2 font-mono text-slate-200">
                  <span title={membership?.memberAddress ?? ""}>
                    {membership?.memberAddress ? shortAddress(membership.memberAddress) : "—"}
                  </span>
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="rounded border border-white/15 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-white/5"
                  >
                    {copied ? "已复制" : "复制"}
                  </button>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-400">加入时间</dt>
                <dd className="text-slate-200">
                  {membership?.memberSince
                    ? new Date(membership.memberSince).toLocaleDateString("zh-CN")
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-400">签名会话</dt>
                <dd className={membership?.walletAddress ? "text-emerald-300" : "text-amber-300"}>
                  {membership?.walletAddress
                    ? "已连接，可以签名"
                    : "未连接，打开上链面板时会自动恢复"}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => membership?.openPanel()}
                className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400"
              >
                打开上链面板
              </button>
              {!membership?.isMember && (
                <button
                  type="button"
                  onClick={() => membership?.enterMemberView()}
                  className="rounded-lg border border-violet-400/40 px-4 py-2 text-sm text-violet-200 hover:bg-violet-500/10"
                >
                  进入会员版浏览
                </button>
              )}
              <Link
                href="/my"
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
              >
                我的花圃
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0f081e]/80 p-6 backdrop-blur-xl">
            <h2 className="text-base font-medium text-slate-100">会员可用功能</h2>
            <ul className="mt-4 space-y-3">
              {BENEFITS.map((benefit) => (
                <li key={benefit.title} className="flex gap-3">
                  <span aria-hidden="true" className="mt-0.5 text-base">{benefit.icon}</span>
                  <div>
                    <p className="text-sm text-slate-200">{benefit.title}</p>
                    <p className="text-xs leading-5 text-slate-400">{benefit.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-5 text-slate-500">
              会员目前免费，绑定钱包即开通，不会自动扣费，也没有订阅。
              钱包绑定后不建议共享设备；如果要换账号，先退出登录再使用另一个钱包。
            </p>
          </section>

          <div className="flex items-center justify-between px-1 text-sm">
            <Link href="/profile" className="text-slate-400 hover:text-rose-300">
              个人资料
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="text-slate-500 hover:text-red-400"
            >
              退出登录
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
