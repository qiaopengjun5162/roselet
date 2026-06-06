"use client";

import Link from "next/link";
import { useCallback, useState, useEffect } from "react";
import { formatDate, colorEmoji, colorLabel } from "@/lib/recommend";
import type { Rose } from "@/lib/api";
import { roseToSoundParams, playWithParams, type RoseSoundParams } from "@/lib/rose-sound";

// CSS 样式是 Web 专属，保留在 TS；emoji/label 来自 color.rs
const COLOR_CSS: Record<string, { border: string; glow: string }> = {
  red:    { border: "border-l-rose-500/50",  glow: "hover:shadow-rose-500/10" },
  white:  { border: "border-l-slate-400/40", glow: "hover:shadow-slate-400/8" },
  yellow: { border: "border-l-amber-400/50", glow: "hover:shadow-amber-400/10" },
};

interface RoseCardProps {
  rose: Rose;
  showNickname?: boolean;
}

export function RoseCard({ rose, showNickname = false }: RoseCardProps) {
  const [fmtDate, setFmtDate]         = useState("");
  const [soundParams, setSoundParams] = useState<RoseSoundParams | null>(null);

  useEffect(() => {
    formatDate(rose.created_at).then(d => { if (d) setFmtDate(d.short_cn || d.relative); });
    roseToSoundParams(rose).then(setSoundParams).catch(() => {});
  }, [rose]);

  const css = COLOR_CSS[rose.color] ?? { border: "border-l-rose-500/40", glow: "hover:shadow-rose-500/8" };

  const handleMouseEnter = useCallback(() => {
    if (!soundParams || typeof window === "undefined") return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.type = soundParams.waveform;
      osc.frequency.value = soundParams.baseFreq * soundParams.fx;
      const gain = ctx.createGain();
      gain.gain.value = 0.06;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
      osc.onended = () => ctx.close();
    } catch { /* AudioContext 不可用时静默忽略 */ }
  }, [soundParams]);

  return (
    <Link href={`/rose/${rose.id}`} className="block group">
      <div
        className={`glass-card p-4 space-y-2 cursor-pointer border-l-2 ${css.border} ${css.glow}
          transition-all duration-200 h-full
          group-hover:border-l-[3px] group-hover:-translate-y-0.5 group-hover:bg-white/[0.07]`}
        onMouseEnter={handleMouseEnter}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">{colorEmoji(rose.color)}</span>
          <span className="text-sm text-slate-400">{colorLabel(rose.color)}</span>
          {rose.is_private && (
            <span className="text-xs text-slate-600 ml-auto" title="仅自己可见">🔒</span>
          )}
          {showNickname && rose.nickname && (
            <span className="text-xs text-slate-500 ml-auto">@{rose.nickname}</span>
          )}
        </div>
        <div className="space-y-1 text-sm">
          {rose.gratitude && <p className="text-slate-300 line-clamp-2"><span className="text-yellow-400/80">🌹 </span>{rose.gratitude}</p>}
          {rose.anxiety   && <p className="text-slate-300 line-clamp-2"><span className="text-sky-400/80">🌵 </span>{rose.anxiety}</p>}
          {rose.hope      && <p className="text-slate-300 line-clamp-2"><span className="text-fuchsia-400/80">🌱 </span>{rose.hope}</p>}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
          {rose.like_count > 0 && <span className="text-rose-400/80">❤️ {rose.like_count}</span>}
          <span>{fmtDate || new Date(rose.created_at).toLocaleDateString("zh-CN")}</span>
        </div>
      </div>
    </Link>
  );
}
