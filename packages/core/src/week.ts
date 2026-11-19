/**
 * 「一周后回来，看看自己长出了什么」——文案与降级实现。
 *
 * 权威实现在 `crates/recommend/src/week.rs`（Web / 小程序共用一套口径）；
 * 这里放两部分：
 *   1. 页面文案常量，避免入口卡片和回顾页各写一份；
 *   2. `buildWeekReviewFallback`：WASM 没加载出来时的等价实现。
 *
 * 两边口径必须一致（天数取整、未来时间归零、空字符串不算一条），
 * 由 `packages/core/src/__tests__/week.test.ts` 与 Rust 单测分别守住。
 */
import { RETURN_PROMISE } from "./product";

/** 承诺里的「一周」。 */
export const WEEK_DAYS = 7;

export type WeekKind = "gratitude" | "anxiety" | "hope";

/** 计算只需要这几列，不依赖完整 Rose。 */
export interface WeekRoseInput {
  id: string;
  created_at: string;
  gratitude?: string | null;
  anxiety?: string | null;
  hope?: string | null;
}

export interface WeekQuote {
  id: string;
  kind: WeekKind;
  text: string;
  age_days: number;
}

export interface WeekReview {
  total: number;
  in_week: number;
  days_since_first: number;
  days_until_ready: number;
  ready: boolean;
  counts: Record<WeekKind, number>;
  quotes: WeekQuote[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = WEEK_DAYS * DAY_MS;

/** 与 Rust `parse_created_at` 对齐：带时区/不带时区、带毫秒都认。 */
export function parseCreatedAtMs(raw: string): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // `2026-11-19T00:00:00` / `2026-11-19 00:00:00`（无时区）按 UTC 处理。
  const naive = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const isoLike = /(?:Z|[+-]\d{2}:?\d{2})$/.test(naive) ? naive : `${naive}Z`;
  const parsed = Date.parse(isoLike);
  return Number.isNaN(parsed) ? null : parsed;
}

export function buildWeekReviewFallback(
  roses: WeekRoseInput[],
  nowMs: number,
): WeekReview {
  const parsed = roses
    .map((rose) => ({ rose, ms: parseCreatedAtMs(rose.created_at) }))
    .filter((entry): entry is { rose: WeekRoseInput; ms: number } => entry.ms !== null)
    .sort((a, b) => b.ms - a.ms);

  const review: WeekReview = {
    total: roses.length,
    in_week: 0,
    days_since_first: 0,
    days_until_ready: WEEK_DAYS,
    ready: false,
    counts: { gratitude: 0, anxiety: 0, hope: 0 },
    quotes: [],
  };

  const oldest = parsed[parsed.length - 1];
  if (!oldest) return review;

  review.days_since_first = Math.floor(Math.max(0, nowMs - oldest.ms) / DAY_MS);
  review.days_until_ready = Math.max(0, WEEK_DAYS - review.days_since_first);
  review.ready = review.days_since_first >= WEEK_DAYS;

  const cutoff = nowMs - WEEK_MS;
  for (const { rose, ms } of parsed) {
    if (ms < cutoff) continue;
    review.in_week += 1;
    const ageDays = Math.floor(Math.max(0, nowMs - ms) / DAY_MS);
    const fields: [WeekKind, string | null | undefined][] = [
      ["gratitude", rose.gratitude],
      ["anxiety", rose.anxiety],
      ["hope", rose.hope],
    ];
    for (const [kind, raw] of fields) {
      const text = (raw ?? "").trim();
      if (!text) continue;
      review.counts[kind] += 1;
      review.quotes.push({ id: rose.id, kind, text, age_days: ageDays });
    }
  }

  return review;
}

// ---------- 页面文案（单源） ----------

export const WEEK_PAGE_TITLE = "这一周";
/** 满 7 天时的收尾句：把「长出了什么」说清楚，不要抽象口号。 */
export const WEEK_READY_FOOTER = "这些就是这一周长出来的东西。";
/** 未满 7 天：给一个具体的日期感，而不是让人天天来刷。 */
export const WEEK_PENDING_BODY = "到第 7 天，这里会把你写下的句子摊开给你看。";
export const WEEK_QUOTES_TITLE = "你写下的";
export const WEEK_NO_QUOTES = "这一周没有新的玫瑰。你写下的都还在「我的花圃」里。";
export const WEEK_EMPTY_BODY = `种下第一朵玫瑰，七天后回来${RETURN_PROMISE}。`;
/** 花圃 / 我的花圃 顶部的入口卡片。 */
export const WEEK_ENTRY_LABEL = "这一周长出了什么";

export function weekReadyHeadline(inWeek: number): string {
  return inWeek > 0 ? `这一周，你种下了 ${inWeek} 朵玫瑰` : "这一周没有新的玫瑰";
}

export function weekPendingHeadline(daysUntilReady: number): string {
  return daysUntilReady === 1 ? "还有 1 天" : `还有 ${daysUntilReady} 天`;
}

export function weekFirstRoseLine(daysSinceFirst: number): string {
  return daysSinceFirst > 0 ? `第 1 朵是 ${daysSinceFirst} 天前种的。` : "第 1 朵是今天种的。";
}

/**
 * 三类计数一行说清。
 * 为 0 的那类不显示 —— 「感恩 0 · 尖刺 1」读起来像在提醒你没做的事；
 * 三类都是 0 时返回空串，由调用方改成「总共 N 朵」。
 */
export function weekKindsLine(counts: Record<WeekKind, number>): string {
  const parts: [string, number][] = [
    ["感恩", counts.gratitude],
    ["尖刺", counts.anxiety],
    ["花苞", counts.hope],
  ];
  return parts
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label} ${count}`)
    .join(" · ");
}
