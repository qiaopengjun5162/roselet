"use client";

import { useId, useRef, useState } from "react";

/** 一朵玫瑰的三个可写部位，对应初心设想的花瓣/尖刺/花苞。 */
export type RoseField = "gratitude" | "anxiety" | "hope";

interface Palette {
  outer: string;
  mid: string;
  inner: string;
  deep: string;
  stroke: string;
  glow: string;
}

/**
 * 三种玫瑰的花瓣配色，红/白/黄与 @roselet/core 的 COLOR_FALLBACK 一一对应。
 * 每色由深到浅三层，配合 SVG 渐变画出水彩玫瑰的明暗层次。
 */
export const ROSE_PALETTES: Record<string, Palette> = {
  red: { outer: "#be123c", mid: "#e11d48", inner: "#fb7185", deep: "#881337", stroke: "rgba(251,113,133,0.35)", glow: "rgba(244,63,94,0.85)" },
  white: { outer: "#cbd5e1", mid: "#e2e8f0", inner: "#ffffff", deep: "#94a3b8", stroke: "rgba(255,255,255,0.45)", glow: "rgba(226,232,240,0.8)" },
  yellow: { outer: "#ca8a04", mid: "#eab308", inner: "#fef08a", deep: "#854d0e", stroke: "rgba(254,240,138,0.45)", glow: "rgba(234,179,8,0.85)" },
};

function paletteFor(color: string): Palette {
  return ROSE_PALETTES[color] ?? ROSE_PALETTES.red;
}

/** 一片从花心向外展开的花瓣（基部在原点、尖端朝上），顶端微卷。 */
const PETAL = "M0,0 C-16,-8 -27,-30 -13,-47 C-7,-54 -3,-49 0,-52 C3,-49 7,-54 13,-47 C27,-30 16,-8 0,0 Z";
function petalRing(count: number, scale: number, offset: number, fill: string, p: Palette, prefix: string) {
  return Array.from({ length: count }, (_, i) => {
    const a = offset + (i * 360) / count;
    return (
      <path
        key={`${prefix}-${i}`}
        d={PETAL}
        transform={`rotate(${a}) scale(${scale})`}
        fill={fill}
        stroke={p.stroke}
        strokeWidth={0.7}
      />
    );
  });
}

/**
 * 水彩玫瑰的花头（不含茎/叶/光点），种花页主花与花圃小花共用，风格一致。
 * uid 来自父组件的 useId()，保证同页多朵花的渐变 id 不重复（花圃里红白黄各一朵）。
 */
function RoseHead({ color, uid }: { color: string; uid: string }) {
  const p = paletteFor(color);
  const id = (n: string) => `${uid}-${n}`;
  return (
    <g>
      <defs>
        {/* 外瓣：基部深 → 尖端浅，模拟水彩由内向外晕开 */}
        <linearGradient id={id("outer")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={p.outer} />
          <stop offset="45%" stopColor={p.mid} />
          <stop offset="100%" stopColor={p.inner} />
        </linearGradient>
        <linearGradient id={id("mid")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={p.mid} />
          <stop offset="100%" stopColor={p.inner} />
        </linearGradient>
        <radialGradient id={id("core")} cx="50%" cy="55%" r="60%">
          <stop offset="0%" stopColor={p.inner} />
          <stop offset="100%" stopColor={p.deep} />
        </radialGradient>
      </defs>
      {/* 由外到内四层，内层盖住外层根部，形成螺旋层叠。
          外层用 8 片且不过度放大，让相邻花瓣紧密重叠，避免在顶端缝隙露出深色背景弧。 */}
      {petalRing(8, 1.0, 0, `url(#${id("outer")})`, p, "l1")}
      {petalRing(6, 0.8, 24, `url(#${id("mid")})`, p, "l2")}
      {petalRing(5, 0.56, 18, `url(#${id("mid")})`, p, "l3")}
      {petalRing(4, 0.34, 45, `url(#${id("outer")})`, p, "l4")}
      {/* 卷心：三片小瓣螺旋收拢，全部压在内瓣范围内，避免露出黑边 */}
      {petalRing(3, 0.2, 20, `url(#${id("outer")})`, p, "core")}
      <ellipse rx="5" ry="5" fill={`url(#${id("core")})`} />
    </g>
  );
}

/**
 * 单朵花头（供「种进花圃」动画复用）：一朵画出来的水彩玫瑰，不再是 emoji。
 * 保留 ellipse 花心（既有守卫断言花瓣里有 ellipse）。
 */
export function RoseBloom({ color, size = 130 }: { color: string; size?: number }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="-70 -70 140 140" role="img" aria-label="玫瑰花" data-testid="rose-bloom">
      <RoseHead color={color} uid={uid} />
    </svg>
  );
}

interface HotspotConfig {
  field: RoseField;
  icon: string;
  active: boolean;
  filled: boolean;
  onClick: () => void;
}

interface InteractiveRoseProps {
  color: string;
  activeField: RoseField;
  filled: Record<RoseField, boolean>;
  onFieldSelect: (field: RoseField) => void;
}

/**
 * 初心第二界面：一朵可以拖拽的水彩玫瑰，花瓣/花苞/尖刺上各有一个闪亮光点。
 *
 * - 拖拽用 pointer 事件（鼠标 + 触摸统一）。touch-action: pan-y 让垂直滑动交还给
 *   页面滚动（手机上这朵花占据近半屏，若用 touch-none 会把页面滚死，用户滑不到
 *   下面的输入框和「种下玫瑰吧」）；触摸只跟水平方向拖，鼠标保持全方向；
 * - 光点是独立按钮，pointerdown 时阻止冒泡，避免点光点误触发拖拽；
 * - 无障碍名称沿用 emoji（🌹/🌵/🌱），与既有测试和读屏习惯保持一致。
 */
export default function InteractiveRose({ color, activeField, filled, onFieldSelect }: InteractiveRoseProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ sx: number; sy: number; bx: number; by: number } | null>(null);
  const p = paletteFor(color);
  const uid = useId().replace(/:/g, "");

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-hotspot]")) return;
    drag.current = { sx: e.clientX, sy: e.clientY, bx: offset.x, by: offset.y };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* jsdom / 老浏览器无 capture */ }
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const d = drag.current;
    // 触摸只跟随水平方向：垂直手势归页面滚动（touch-action: pan-y），
    // 否则手机上从花朵起手往上滑会被吞掉，滑不到下面。
    const vertical = e.pointerType === "mouse" ? d.by + e.clientY - d.sy : d.by;
    setOffset({ x: d.bx + e.clientX - d.sx, y: vertical });
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    drag.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* 同上 */ }
  }

  const hotspots: HotspotConfig[] = [
    { field: "gratitude", icon: "🌹", active: activeField === "gratitude", filled: filled.gratitude, onClick: () => onFieldSelect("gratitude") },
    { field: "anxiety", icon: "🌵", active: activeField === "anxiety", filled: filled.anxiety, onClick: () => onFieldSelect("anxiety") },
    { field: "hope", icon: "🌱", active: activeField === "hope", filled: filled.hope, onClick: () => onFieldSelect("hope") },
  ];
  const pos: Record<RoseField, { left: string; top: string }> = {
    gratitude: { left: "50%", top: "29%" },
    // 尖刺光点放在茎左侧中段空白处，不压住下面的叶子
    anxiety: { left: "20%", top: "55%" },
    hope: { left: "80%", top: "52%" },
  };

  return (
    <div className="relative flex flex-col items-center">
      <div
        className="relative w-[240px] h-[320px] max-w-full cursor-grab active:cursor-grabbing select-none touch-pan-y"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        data-testid="rose-drag-area"
      >
        <svg width="240" height="320" viewBox="0 0 240 320" className="w-full h-full" role="img" aria-label="可以拖动的玫瑰花">
          <defs>
            <linearGradient id={`${uid}-stem`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#2f6b3a" />
              <stop offset="100%" stopColor="#5aa564" />
            </linearGradient>
            <linearGradient id={`${uid}-leaf`} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#2f7d3f" />
              <stop offset="100%" stopColor="#7cc47f" />
            </linearGradient>
          </defs>
          {/* 茎：略弯，带水彩渐变 */}
          <path d="M120 148 Q110 226 124 308" stroke={`url(#${uid}-stem)`} strokeWidth="8" fill="none" strokeLinecap="round" />
          {/* 两片带中脉的叶子 */}
          <g>
            <path d="M117 236 C88 214 58 218 46 246 C70 258 100 256 117 236 Z" fill={`url(#${uid}-leaf)`} stroke="#2f7d3f" strokeWidth="1" />
            <path d="M115 238 Q80 236 50 245" stroke="#256b32" strokeWidth="1" fill="none" opacity="0.6" />
          </g>
          <g>
            <path d="M122 274 C150 252 182 258 192 286 C168 298 138 294 122 274 Z" fill={`url(#${uid}-leaf)`} stroke="#2f7d3f" strokeWidth="1" />
            <path d="M124 276 Q158 274 190 285" stroke="#256b32" strokeWidth="1" fill="none" opacity="0.6" />
          </g>
          {/* 茎上的小刺 */}
          <path d="M116 202 L100 194 L115 209 Z" fill="#5aa564" stroke="#2f6b3a" strokeWidth="1" />
          <path d="M122 292 L138 285 L123 299 Z" fill="#5aa564" stroke="#2f6b3a" strokeWidth="1" />
          {/* 花萼 */}
          <path d="M104 140 L120 160 L136 140" fill="none" stroke="#2f7d3f" strokeWidth="6" strokeLinejoin="round" />
          {/* 侧枝 + 小花苞（几片卷瓣，呼应主花的水彩质感） */}
          <path d="M120 198 Q172 198 190 166" stroke={`url(#${uid}-stem)`} strokeWidth="4" fill="none" strokeLinecap="round" />
          <g transform="translate(192 162)">
            <defs>
              <linearGradient id={`${uid}-bud`} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={p.outer} />
                <stop offset="100%" stopColor={p.inner} />
              </linearGradient>
            </defs>
            <path d="M0,8 C-14,2 -16,-18 -4,-28 C-1,-31 1,-31 4,-28 C16,-18 14,2 0,8 Z" fill={`url(#${uid}-bud)`} stroke={p.stroke} strokeWidth="1" />
            <path d="M0,-26 C-6,-16 -6,-2 0,6 M0,-26 C6,-16 6,-2 0,6" fill="none" stroke={p.deep} strokeWidth="0.8" opacity="0.5" />
            <path d="M-9 6 L0 18 L9 6" fill="#4a9d55" stroke="#2f7d3f" strokeWidth="1" />
          </g>
          {/* 主花头：水彩玫瑰 */}
          <g transform="translate(120 96)">
            <RoseHead color={color} uid={`${uid}-main`} />
          </g>
        </svg>

        {/* 三个闪亮光点，按部位定位在花头/花苞/尖刺附近 */}
        {hotspots.map((h) => (
          <button
            key={h.field}
            type="button"
            data-hotspot
            onClick={() => h.onClick()}
            onPointerDown={(e) => e.stopPropagation()}
            aria-pressed={h.active}
            aria-label={h.icon}
            className={`absolute -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center text-xl transition-all hover:scale-110 ${
              h.active
                ? "scale-110 ring-2 ring-white/80"
                : h.filled
                  ? "ring-1 ring-white/40"
                  : "animate-pulse"
            }`}
            style={{
              left: pos[h.field].left,
              top: pos[h.field].top,
              background: `radial-gradient(circle, ${p.glow} 0%, transparent 65%)`,
              boxShadow: h.active ? `0 0 16px ${p.glow}` : undefined,
            }}
          >
            <span aria-hidden="true">{h.icon}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-1">拖动花朵换个位置 · 点光点写那一栏</p>
    </div>
  );
}
