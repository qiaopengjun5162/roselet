"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getToken } from "@/lib/api";
import { loadWeekReview } from "@/lib/week-data";
import {
  WEEK_EMPTY_BODY,
  WEEK_NO_QUOTES,
  WEEK_PAGE_TITLE,
  WEEK_PENDING_BODY,
  WEEK_QUOTES_TITLE,
  WEEK_READY_FOOTER,
  WEEK_DAYS,
  weekFirstRoseLine,
  weekKindsLine,
  weekPendingHeadline,
  weekReadyHeadline,
} from "@roselet/core";
import type { WeekKind, WeekReview } from "@roselet/core";

// 分页与「第 1 朵在最后一页」的坑都在 lib/week-data，页面只管渲染。

const KIND_EMOJI: Record<WeekKind, string> = {
  gratitude: "🌹",
  anxiety: "🌵",
  hope: "🌱",
};

type LoadState = "loading" | "error" | "done";

export default function WeekPage() {
  const router = useRouter();
  const [review, setReview] = useState<WeekReview | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await loadWeekReview();
      if (cancelled) return;
      setReview(result);
      setState("done");
    })().catch(() => {
      if (!cancelled) setState("error");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="relative h-full px-4 pb-10 pt-10 z-10">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="space-y-2 text-center">
          <div className="text-4xl">🌿</div>
          <h1 className="text-xl font-semibold text-rose-200">{WEEK_PAGE_TITLE}</h1>
        </div>

        {state === "loading" && (
          <p className="text-center text-sm text-slate-500 animate-pulse py-10">加载中...</p>
        )}

        {state === "error" && (
          <div className="text-center space-y-4 py-10">
            <p className="text-sm text-rose-300">没能读到这一周。</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              重试
            </Button>
          </div>
        )}

        {state === "done" && review && review.total === 0 && (
          <div className="text-center space-y-4 py-10">
            <p className="text-5xl">🌱</p>
            <p className="text-sm text-slate-400 leading-relaxed">{WEEK_EMPTY_BODY}</p>
            <Link href="/plant">
              <Button className="bg-gradient-to-r from-rose-500 to-pink-500 border-0">
                种第一朵玫瑰
              </Button>
            </Link>
          </div>
        )}

        {state === "done" && review && review.total > 0 && !review.ready && (
          <div className="glass-card p-6 space-y-3 text-center" data-testid="week-pending">
            <p className="text-5xl font-bold text-rose-200 tabular-nums" data-testid="week-countdown">
              {weekPendingHeadline(review.days_until_ready)}
            </p>
            <p className="text-sm text-slate-400 leading-relaxed">{WEEK_PENDING_BODY}</p>
            <p className="text-xs text-slate-500">
              {weekFirstRoseLine(review.days_since_first)}共 {review.total} 朵，这一周 {review.in_week} 朵。
            </p>
            <Link href="/plant" className="inline-block pt-1">
              <Button variant="outline">再种一朵</Button>
            </Link>
          </div>
        )}

        {state === "done" && review && review.total > 0 && review.ready && (
          <div className="space-y-4">
            <div className="glass-card p-6 space-y-2 text-center">
              <h2 className="text-lg font-semibold text-rose-200" data-testid="week-headline">
                {weekReadyHeadline(review.in_week)}
              </h2>
              <p className="text-xs text-slate-500">
                {weekFirstRoseLine(review.days_since_first)}
                {weekKindsLine(review.counts) || `总共 ${review.total} 朵`}
              </p>
            </div>

            {review.quotes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center leading-relaxed px-4">
                {WEEK_NO_QUOTES}
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 px-1">{WEEK_QUOTES_TITLE}</p>
                {review.quotes.map((quote) => (
                  <Link
                    key={`${quote.id}-${quote.kind}`}
                    href={`/rose/${quote.id}`}
                    className="glass-card flex items-start gap-3 p-4 hover:bg-white/[0.07] transition-colors"
                    data-testid="week-quote"
                  >
                    <span className="text-xl leading-none pt-0.5">{KIND_EMOJI[quote.kind]}</span>
                    <span className="flex-1 text-sm text-slate-300 leading-relaxed break-words">
                      {quote.text}
                    </span>
                    <span className="text-[11px] text-slate-600 whitespace-nowrap pt-1">
                      {quote.age_days === 0 ? "今天" : `${quote.age_days} 天前`}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            <p className="text-sm text-rose-200/80 text-center leading-relaxed">
              {WEEK_READY_FOOTER}
            </p>

            <div className="text-center pt-2">
              <Link href="/plant">
                <Button className="bg-gradient-to-r from-rose-500 to-pink-500 border-0">
                  再种一朵
                </Button>
              </Link>
            </div>
          </div>
        )}

        <p className="text-[11px] text-slate-600 text-center">每 {WEEK_DAYS} 天一轮，从你种下第一朵那天开始算。</p>
      </div>
    </main>
  );
}
