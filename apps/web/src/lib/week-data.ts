import { getMyRoses } from "@/lib/api";
import { buildWeekReview } from "@/lib/recommend";
import type { WeekReview } from "@roselet/core";

/**
 * 「这一周」的数据装填。
 *
 * `/week` 页和首页的回来提示共用这一份：列表按时间倒序，**超过一页时
 * 「第 1 朵」在最后一页**，只取第一页会把「第 1 朵是几天前」算成最近那一朵，
 * 于是永远差几天到 7 天，承诺永远不兑现。后端 per_page 上限 100。
 *
 * 最近 7 天的原话总在最新的一页里，所以只补最后一页就够，不必逐页翻。
 */
export const WEEK_PAGE_SIZE = 100;

export async function loadWeekReview(nowMs: number = Date.now()): Promise<WeekReview> {
  const first = await getMyRoses(1, WEEK_PAGE_SIZE);
  let roses = first.data;

  if (first.total > roses.length) {
    const lastPage = Math.ceil(first.total / WEEK_PAGE_SIZE);
    const last = await getMyRoses(lastPage, WEEK_PAGE_SIZE);
    roses = [...roses, ...last.data];
  }

  const review = await buildWeekReview(roses, nowMs);
  // 总数以服务端为准：超过两页时中间几页没取，`roses.length` 会偏小，
  // 页面就会对种了 250 朵的人说「总共 200 朵」。
  return { ...review, total: Math.max(first.total, review.total) };
}
