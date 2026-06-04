"use client";

/**
 * Roselet 赛博星空背景 — 多层叠加架构
 * Layer 1: 深邃暗色基底 #05070f
 * Layer 2: 超大模糊光晕气泡 (暗紫 + 深海蓝)，mix-blend-mode: screen
 * Layer 3: SVG 分形噪点纹理 (opacity 0.03)，打破数码光滑感
 */
export function CyberBackground() {
  return (
    <div className="fixed inset-0 -z-50 overflow-hidden" aria-hidden="true">
      {/* Layer 1: 基底 */}
      <div className="absolute inset-0 bg-[#05070f]" />

      {/* Layer 2: 环境光晕气泡 */}
      {/* 左上暗紫光 */}
      <div
        className="absolute -left-[10%] -top-[5%] h-[70vw] w-[70vw] rounded-full bg-purple-900/20 blur-[130px]"
        style={{ mixBlendMode: "screen" }}
      />
      {/* 右下深海蓝光 */}
      <div
        className="absolute -right-[15%] -bottom-[10%] h-[80vw] w-[80vw] rounded-full bg-indigo-950/25 blur-[150px]"
        style={{ mixBlendMode: "screen" }}
      />
      {/* 中上玫瑰微光 */}
      <div
        className="absolute left-[30%] -top-[20%] h-[60vw] w-[60vw] rounded-full bg-rose-950/10 blur-[120px]"
        style={{ mixBlendMode: "screen" }}
      />

      {/* Layer 3: SVG 分形噪点纹理 */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.035]"
        style={{ mixBlendMode: "overlay" }}
      >
        <filter id="roselet-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.75"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#roselet-noise)" />
      </svg>

      {/* 细微的网格纹理 — 增加赛博感 */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.015]"
        style={{ mixBlendMode: "overlay" }}
      >
        <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path
            d="M 48 0 L 0 0 0 48"
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="0.5"
          />
        </pattern>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}
