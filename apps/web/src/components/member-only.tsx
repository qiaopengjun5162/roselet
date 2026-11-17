"use client";

import type { ReactNode } from "react";
import { useOptionalMembership } from "@/app/membership-context";

/**
 * The one and only gate for Web3 UI in the plain app.
 *
 * CLAUDE.md「会员模式的默认关闭边界」要求默认普通模式零 Web3 痕迹。过去每个
 * 组件各自判断 isMember，结果漏了首页 / 种花页的 Aleo 链接、/private-vault
 * 整页和 RoseMemorial。现在所有 Web3 入口统一包这一层：非会员、以及没有
 * MembershipProvider 的页面/单测，一律不渲染（也不会挂载内部 hooks）。
 *
 * 新增任何 Web3 UI 时，必须先包 <MemberOnly>，不要另写一套判断。
 */
export function MemberOnly({ children }: { children: ReactNode }) {
  const membership = useOptionalMembership();
  if (!membership?.isMember) return null;
  return <>{children}</>;
}
