"use client";

import { useEffect, useState } from "react";
import { getTips, type Tip, type TipContext } from "@/lib/recommend";

interface TipTickerProps {
  context: TipContext;
}

export function TipTicker({ context }: TipTickerProps) {
  const [tips, setTips] = useState<Tip[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    getTips(context).then((nextTips) => {
      if (!alive) return;
      setTips(nextTips);
      setIndex(0);
    });
    return () => {
      alive = false;
    };
  }, [context]);

  useEffect(() => {
    if (tips.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % tips.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, [tips.length]);

  if (tips.length === 0) return null;

  // 别改回单行 truncate：390px 手机下最长的纸条会被切掉 48px、显示成「…」，
  // 小白看到的是一个坏掉的控件，而不是一句提示。允许换行（最多自然两行）。
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-amber-200/10 bg-amber-100/5 px-4 py-2.5 text-xs text-amber-100/80 shadow-[0_0_24px_rgba(251,191,36,0.08)] backdrop-blur">
      <p className="text-center leading-relaxed">
        <span className="mr-2 text-amber-200/70">小纸条</span>
        {tips[index]?.text}
      </p>
    </div>
  );
}
