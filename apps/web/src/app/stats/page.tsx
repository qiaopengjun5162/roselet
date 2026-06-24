"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAdminFeedback, getToken, getUsageStats, type AdminFeedbackItem, type UsageStats } from "@/lib/api";

type LoadState = "loading" | "ready" | "forbidden" | "error";
type FeedbackState = "idle" | "loading" | "ready" | "error";

const NUMBER_FORMATTER = new Intl.NumberFormat("zh-CN");

function formatCount(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "暂无";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StatsPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [feedbackState, setFeedbackState] = useState<FeedbackState>("idle");
  const [feedbackItems, setFeedbackItems] = useState<AdminFeedbackItem[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      router.push("/login?redirect=/stats");
      return;
    }

    let alive = true;
    getUsageStats()
      .then((data) => {
        if (!alive) return;
        setStats(data);
        setState("ready");
        setFeedbackState("loading");
        getAdminFeedback()
          .then((feedback) => {
            if (!alive) return;
            setFeedbackItems(feedback.data);
            setFeedbackState("ready");
          })
          .catch(() => {
            if (!alive) return;
            setFeedbackState("error");
          });
      })
      .catch((error) => {
        if (!alive) return;
        setState(error instanceof Error && error.message === "STATS_FORBIDDEN" ? "forbidden" : "error");
      });

    return () => {
      alive = false;
    };
  }, [router]);

  if (state === "loading") {
    return (
      <main className="relative z-10 min-h-full px-4 pt-24 pb-10">
        <p className="text-center text-slate-500">加载数据中...</p>
      </main>
    );
  }

  if (state === "forbidden") {
    return (
      <main className="relative z-10 min-h-full px-4 pt-24 pb-10">
        <div className="mx-auto max-w-xl rounded-3xl border border-amber-300/20 bg-amber-300/10 p-6 text-center">
          <h1 className="text-xl text-amber-100">无权限访问应用后台</h1>
          <p className="mt-2 text-sm text-amber-100/70">
            这个页面只开放给后台管理员。如果需要公开数据，后续应单独提供脱敏的公开统计页。
          </p>
        </div>
      </main>
    );
  }

  if (state === "error" || !stats) {
    return (
      <main className="relative z-10 min-h-full px-4 pt-24 pb-10">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-400/20 bg-red-500/10 p-6 text-center">
          <h1 className="text-xl text-red-200">数据暂时加载失败</h1>
          <p className="mt-2 text-sm text-red-100/70">统计接口可能还没有部署完成，稍后再试即可。</p>
        </div>
      </main>
    );
  }

  const cards = [
    ["注册用户", stats.total_users],
    ["玫瑰总数", stats.total_roses],
    ["公开玫瑰", stats.public_roses],
    ["私密玫瑰", stats.private_roses],
    ["点赞次数", stats.total_likes],
    ["反馈条数", stats.total_feedback],
  ] as const;

  const weekCards = [
    ["近 7 天新增用户", stats.users_last_7_days],
    ["近 7 天新增玫瑰", stats.roses_last_7_days],
    ["近 7 天反馈", stats.feedback_last_7_days],
  ] as const;

  return (
    <main className="relative z-10 min-h-full px-4 pt-20 pb-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-slate-950/45 p-6 shadow-[0_0_45px_rgba(244,63,94,0.08)] backdrop-blur-xl md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-rose-300/70">Roselet Live</p>
              <h1
                className="mt-3 text-3xl font-light tracking-[0.22em] text-slate-100 md:text-5xl"
                style={{ fontFamily: '"Ma Shan Zheng", "STXingkai", "KaiTi", cursive' }}
              >
                使用动态
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
                这里先看最朴素的信号：有没有人注册、有没有人种花、最近 7 天是否还在发生互动。
                如果接近 100 个真实用户，我们再考虑买服务器、域名和更完整的运营后台。
              </p>
            </div>
            <Link
              href="/plant"
              className="rounded-full border border-rose-300/30 bg-rose-500/15 px-5 py-2 text-sm text-rose-100 transition hover:bg-rose-500/25"
            >
              去种一朵玫瑰
            </Link>
          </div>
        </section>

        <section className="rounded-[2rem] border border-amber-300/15 bg-amber-300/[0.06] p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-amber-200/80">第一阶段目标</p>
              <p className="mt-2 text-3xl font-semibold text-amber-100">
                {formatCount(stats.user_goal.current)} / {formatCount(stats.user_goal.goal)}
              </p>
            </div>
            <p className="text-right text-sm text-amber-100/70">距离是否值得买服务器的判断线</p>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-950/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-300"
              style={{ width: `${stats.user_goal.percent}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-amber-100/60">当前进度 {stats.user_goal.percent}%</p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(([label, value]) => (
            <article key={label} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <p className="text-xs tracking-[0.2em] text-slate-500">{label}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-100">{formatCount(value)}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {weekCards.map(([label, value]) => (
            <article key={label} className="rounded-3xl border border-emerald-300/10 bg-emerald-300/[0.04] p-5">
              <p className="text-sm text-emerald-100/70">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-100">{formatCount(value)}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
            <p className="text-sm text-slate-400">最近一朵玫瑰</p>
            <p className="mt-2 text-lg text-slate-100">{formatDate(stats.latest_rose_at)}</p>
          </article>
          <article className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
            <p className="text-sm text-slate-400">最近一条反馈</p>
            <p className="mt-2 text-lg text-slate-100">{formatDate(stats.latest_feedback_at)}</p>
          </article>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-slate-950/40 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.25em] text-rose-300/70">Feedback Inbox</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-100">最近反馈</h2>
            </div>
            <p className="text-sm text-slate-500">只对管理员可见</p>
          </div>

          {feedbackState === "loading" && (
            <p className="mt-5 text-sm text-slate-500">反馈加载中...</p>
          )}
          {feedbackState === "error" && (
            <p className="mt-5 text-sm text-amber-200">反馈暂时加载失败</p>
          )}
          {feedbackState === "ready" && feedbackItems.length === 0 && (
            <p className="mt-5 text-sm text-slate-500">暂无具体反馈。</p>
          )}
          {feedbackItems.length > 0 && (
            <div className="mt-5 space-y-3">
              {feedbackItems.map((item) => (
                <article key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{item.nickname || "匿名用户"}</span>
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{item.content}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
