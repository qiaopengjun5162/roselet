"use client";

import { RoseBloom } from "@/components/interactive-rose";

/**
 * 初心第三界面：玫瑰被种进一个小花圃，各色玫瑰都在。
 * 刚种下的那朵（color）最后从土里长出来，随后浮出一句感谢。
 * 纯 CSS 动画，不依赖音频或网络，成功页直接渲染即可。
 */
export function PlantingGarden({ color }: { color: string }) {
  // 花圃里的邻居：红白黄各一，象征社区里别人种下的花。
  const neighbors = ["white", "red", "yellow"];

  return (
    <div className="w-full max-w-sm mx-auto space-y-3 animate-text-reveal">
      <div className="relative rounded-xl bg-gradient-to-b from-transparent to-emerald-950/40 px-2 pt-2 pb-0 overflow-hidden">
        <div className="flex items-end justify-center gap-1 sm:gap-2">
          {neighbors.map((c, i) => (
            <div
              key={c}
              className="animate-sprout inline-block"
              style={{ animationDelay: `${0.3 + i * 0.25}s` }}
            >
              <RoseBloom color={c} size={54} />
            </div>
          ))}
          {/* 刚种下的这朵，最后长出并高亮 */}
          <div
            className="animate-sprout inline-block animate-plant-glow"
            style={{ animationDelay: "1.15s" }}
          >
            <RoseBloom color={color} size={64} />
          </div>
        </div>
        {/* 土壤 */}
        <div className="h-3 rounded-b-xl bg-gradient-to-b from-amber-900/70 to-amber-950/80 border-t border-amber-700/40" />
      </div>
      <p className="text-center text-sm text-rose-200/90 font-brush tracking-wider">
        谢谢你在社区种下的玫瑰
      </p>
    </div>
  );
}
