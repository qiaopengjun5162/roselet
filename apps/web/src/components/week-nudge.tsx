"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WEEK_NUDGE_LABEL } from "@roselet/core";
import { getToken } from "@/lib/api";
import { loadWeekReview } from "@/lib/week-data";

/**
 * 首页的「回来」提示。
 *
 * 「一周后回来，看看自己长出了什么」是产品对外唯一的回来理由，但回访的人
 * 打开首页看到的和第一天一模一样 —— 得靠自己想起来去 /my 才找得到入口。
 *
 * 三条规矩：
 *   1. 只在**真的满 7 天**时才出现，未满一个字都不说（不催、不打卡）；
 *   2. 非登录用户不请求、不渲染（首页不能替访客发一个「我的」请求）；
 *   3. 读失败就当作没有 —— 首页不能因为一个提示而报错。
 */
export function WeekNudge() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    loadWeekReview()
      .then((review) => {
        if (!cancelled && review.ready && review.total > 0) setReady(true);
      })
      .catch(() => {
        // 提示是锦上添花，读不到就当没有。
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;

  return (
    <Link
      href="/week"
      data-testid="week-nudge"
      className="inline-flex items-center gap-2 rounded-full glass-card px-4 py-2 text-sm text-rose-200 hover:bg-white/[0.07] transition-colors"
    >
      <span aria-hidden="true">🌿</span>
      {WEEK_NUDGE_LABEL}
      <span className="text-slate-500" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
