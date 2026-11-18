"use client";

import { useOptionalMembership } from "@/app/membership-context";

/**
 * 会员版状态条：让「切换到会员版」是看得见的界面状态，而不是只弹一个浮层。
 * 普通模式完全不渲染；会员模式提供「打开上链面板」和「返回普通版」两个出口。
 */
export function MembershipBanner() {
  const membership = useOptionalMembership();
  if (!membership?.isMember) return null;

  return (
    <div
      role="status"
      data-testid="membership-banner"
      className="z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-[12px] text-violet-100"
    >
      <span className="font-medium">🌐 会员版 · Web3 功能已解锁</span>
      <span className="hidden text-violet-200/70 sm:inline">
        连接钱包、上链等操作只在会员版出现
      </span>
      <button
        onClick={membership.openPanel}
        className="rounded-full border border-violet-400/40 px-2.5 py-0.5 text-violet-100 hover:bg-violet-500/20"
      >
        打开上链面板
      </button>
      <button
        onClick={membership.toggleMember}
        className="rounded-full px-2.5 py-0.5 text-violet-200/80 hover:bg-violet-500/20 hover:text-violet-50"
      >
        返回普通版
      </button>
    </div>
  );
}
