import Link from "next/link";
import type { Rose } from "@/lib/api";

const COLOR_MAP: Record<string, { emoji: string; label: string }> = {
  red:    { emoji: "🌹", label: "红玫瑰" },
  white:  { emoji: "🤍", label: "白玫瑰" },
  yellow: { emoji: "💛", label: "黄玫瑰" },
};

interface RoseCardProps {
  rose: Rose;
  showNickname?: boolean;
}

export function RoseCard({ rose, showNickname = false }: RoseCardProps) {
  const meta = COLOR_MAP[rose.color] ?? { emoji: "🌹", label: "玫瑰" };

  return (
    <Link href={`/rose/${rose.id}`}>
      <div className="glass-card p-4 space-y-2 cursor-pointer hover:border-white/25 hover:-translate-y-0.5 transition-all h-full">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{meta.emoji}</span>
          <span className="text-sm text-slate-400">{meta.label}</span>
        </div>
        <div className="space-y-1 text-sm">
          {rose.gratitude && (
            <p className="text-slate-300">
              <span className="text-yellow-400">🌹 </span>{rose.gratitude}
            </p>
          )}
          {rose.anxiety && (
            <p className="text-slate-300">
              <span className="text-sky-400">🌵 </span>{rose.anxiety}
            </p>
          )}
          {rose.hope && (
            <p className="text-slate-300">
              <span className="text-fuchsia-400">🌱 </span>{rose.hope}
            </p>
          )}
        </div>
        <p className="text-xs text-slate-500 pt-1">
          {showNickname && rose.nickname && (
            <span className="mr-2">{rose.nickname}</span>
          )}
          {rose.like_count > 0 && (
            <span className="mr-2 text-rose-400">❤️ {rose.like_count}</span>
          )}
          {new Date(rose.created_at).toLocaleDateString("zh-CN")}
        </p>
      </div>
    </Link>
  );
}
