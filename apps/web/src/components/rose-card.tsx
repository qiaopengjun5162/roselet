"use client";

import Link from "next/link";
import { useCallback } from "react";
import type { Rose } from "@/lib/api";
import { roseToSoundParams } from "@/lib/rose-sound";

const COLOR_MAP: Record<string, { emoji: string; label: string; border: string; glow: string }> = {
  red:    { emoji: "🌹", label: "红玫瑰", border: "border-l-rose-500/50",  glow: "hover:shadow-rose-500/10" },
  white:  { emoji: "🤍", label: "白玫瑰", border: "border-l-slate-400/40", glow: "hover:shadow-slate-400/8" },
  yellow: { emoji: "💛", label: "黄玫瑰", border: "border-l-amber-400/50", glow: "hover:shadow-amber-400/10" },
};

interface RoseCardProps {
  rose: Rose;
  showNickname?: boolean;
}

export function RoseCard({ rose, showNickname = false }: RoseCardProps) {
  const meta = COLOR_MAP[rose.color] ?? { emoji: "🌹", label: "玫瑰", border: "border-l-rose-500/40", glow: "hover:shadow-rose-500/8" };

  const handleMouseEnter = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const p = roseToSoundParams(rose);
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.type = p.waveform;
      osc.frequency.value = p.baseFreq * p.fx;
      const gain = ctx.createGain();
      gain.gain.value = 0.06;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      osc.onended = () => ctx.close();
    } catch { /* AudioContext 不可用时静默忽略 */ }
  }, [rose]);

  return (
    <Link href={`/rose/${rose.id}`} className="block group">
      <div
        className={`glass-card p-4 space-y-2 cursor-pointer border-l-2 ${meta.border} ${meta.glow}
          transition-all duration-200 h-full
          group-hover:border-l-[3px] group-hover:-translate-y-0.5 group-hover:bg-white/[0.07]`}
        onMouseEnter={handleMouseEnter}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">{meta.emoji}</span>
          <span className="text-sm text-slate-400">{meta.label}</span>
          {showNickname && rose.nickname && (
            <span className="text-xs text-slate-500 ml-auto">@{rose.nickname}</span>
          )}
        </div>
        <div className="space-y-1 text-sm">
          {rose.gratitude && (
            <p className="text-slate-300 line-clamp-2">
              <span className="text-yellow-400/80">🌹 </span>{rose.gratitude}
            </p>
          )}
          {rose.anxiety && (
            <p className="text-slate-300 line-clamp-2">
              <span className="text-sky-400/80">🌵 </span>{rose.anxiety}
            </p>
          )}
          {rose.hope && (
            <p className="text-slate-300 line-clamp-2">
              <span className="text-fuchsia-400/80">🌱 </span>{rose.hope}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
          {rose.like_count > 0 && (
            <span className="text-rose-400/80">❤️ {rose.like_count}</span>
          )}
          <span>{new Date(rose.created_at).toLocaleDateString("zh-CN")}</span>
        </div>
      </div>
    </Link>
  );
}
