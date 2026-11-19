import Link from "next/link";
import { WEEK_ENTRY_LABEL } from "@roselet/core";

/**
 * 「这一周」的入口卡片。
 *
 * 种完反馈写着「一周后回来，看看自己长出了什么」；如果没有任何入口，
 * 回来的人只能看到一个和七分钟前一模一样的花圃。卡片只做导航，
 * 是否显示交给调用方（未登录时没有「我的这一周」）。
 */
export function WeekEntryCard() {
  return (
    <Link
      href="/week"
      className="glass-card flex items-center justify-between gap-3 p-4 hover:bg-white/[0.07] transition-colors"
    >
      <span className="flex items-center gap-2 text-sm text-slate-300" data-testid="week-entry">
        <span className="text-lg">🌿</span>
        {WEEK_ENTRY_LABEL}
      </span>
      <span className="text-xs text-slate-500" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
