"use client";

import { useRef, useState } from "react";

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

/** 三种玫瑰的花瓣配色，红/白/黄与 @roselet/core 的 COLOR_FALLBACK 一一对应。 */
export const ROSE_PALETTES: Record<string, Palette> = {
  red: { outer: "#e11d48", mid: "#f43f5e", inner: "#fb7185", deep: "#9f1239", stroke: "#881337", glow: "rgba(244,63,94,0.85)" },
  white: { outer: "#cbd5e1", mid: "#e2e8f0", inner: "#f8fafc", deep: "#94a3b8", stroke: "#94a3b8", glow: "rgba(226,232,240,0.8)" },
  yellow: { outer: "#ca8a04", mid: "#eab308", inner: "#fde047", deep: "#a16207", stroke: "#854d0e", glow: "rgba(234,179,8,0.85)" },
};

function paletteFor(color: string): Palette {
  return ROSE_PALETTES[color] ?? ROSE_PALETTES.red;
}

/**
 * 花头本身（不含茎和光点），供种花页和「种进花圃」动画复用。
 * 以 (0,0) 为花心，外层 6 瓣、中层 6 瓣、内层 5 瓣叠加成一朵层叠玫瑰。
 */
export function RoseBloom({ color, size = 130 }: { color: string; size?: number }) {
  const p = paletteFor(color);
  return (
    <svg width={size} height={size} viewBox="-70 -70 140 140" role="img" aria-label="玫瑰花" data-testid="rose-bloom">
      <g>
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse key={`o${a}`} cx="0" cy="-38" rx="27" ry="43" transform={`rotate(${a})`} fill={p.outer} stroke={p.stroke} strokeWidth="1.4" />
        ))}
        {[30, 90, 150, 210, 270, 330].map((a) => (
          <ellipse key={`m${a}`} cx="0" cy="-24" rx="19" ry="29" transform={`rotate(${a})`} fill={p.mid} stroke={p.stroke} strokeWidth="1" />
        ))}
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={`i${a}`} cx="0" cy="-12" rx="11" ry="18" transform={`rotate(${a})`} fill={p.inner} stroke={p.stroke} strokeWidth="0.8" />
        ))}
        <circle r="8" fill={p.deep} />
      </g>
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
 * 初心第二界面：一朵可以拖拽的 2D 玫瑰，花瓣/花苞/尖刺上各有一个闪亮光点。
 *
 * - 拖拽用 pointer 事件（鼠标 + 触摸统一），touch-action: none 防止拖动时页面滚动；
 * - 光点是独立按钮，pointerdown 时阻止冒泡，避免点光点误触发拖拽；
 * - 无障碍名称沿用 emoji（🌹/🌵/🌱），与既有测试和读屏习惯保持一致。
 */
export default function InteractiveRose({ color, activeField, filled, onFieldSelect }: InteractiveRoseProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ sx: number; sy: number; bx: number; by: number } | null>(null);
  const p = paletteFor(color);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-hotspot]")) return;
    drag.current = { sx: e.clientX, sy: e.clientY, bx: offset.x, by: offset.y };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* jsdom / 老浏览器无 capture */ }
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const d = drag.current;
    setOffset({ x: d.bx + e.clientX - d.sx, y: d.by + e.clientY - d.sy });
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
    gratitude: { left: "50%", top: "22%" },
    anxiety: { left: "26%", top: "70%" },
    hope: { left: "80%", top: "52%" },
  };

  return (
    <div className="relative flex flex-col items-center">
      <div
        className="relative w-[240px] h-[320px] max-w-full cursor-grab active:cursor-grabbing select-none touch-none"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        data-testid="rose-drag-area"
      >
        <svg width="240" height="320" viewBox="0 0 240 320" className="w-full h-full" role="img" aria-label="可以拖动的玫瑰花">
          {/* 茎 */}
          <path d="M120 150 Q112 225 122 306" stroke="#3f9142" strokeWidth="9" fill="none" strokeLinecap="round" />
          {/* 叶 */}
          <path d="M118 232 Q70 210 58 250 Q100 258 118 232 Z" fill="#4ade80" stroke="#16a34a" strokeWidth="1.5" />
          <path d="M120 268 Q176 248 186 288 Q142 294 120 268 Z" fill="#22c55e" stroke="#15803d" strokeWidth="1.5" />
          {/* 茎上的小刺（装饰） */}
          <path d="M117 205 L99 197 L116 212 Z" fill="#86efac" stroke="#4ade80" strokeWidth="1" />
          <path d="M120 285 L138 278 L121 292 Z" fill="#86efac" stroke="#4ade80" strokeWidth="1" />
          {/* 花萼 */}
          <path d="M100 142 L120 162 L140 142" fill="none" stroke="#16a34a" strokeWidth="6" strokeLinejoin="round" />
          {/* 侧枝 + 花苞 */}
          <path d="M120 196 Q176 196 196 168" stroke="#3f9142" strokeWidth="5" fill="none" strokeLinecap="round" />
          <g transform="translate(198 166)">
            <path d="M-15 4 Q0 -30 15 4 Q0 22 -15 4 Z" fill={p.mid} stroke={p.stroke} strokeWidth="1.5" />
            <path d="M0 -22 L0 20" stroke={p.stroke} strokeWidth="1" opacity="0.6" />
            <path d="M-9 16 L0 30 L9 16" fill="#4ade80" stroke="#16a34a" strokeWidth="1" />
          </g>
          {/* 主花头 */}
          <g transform="translate(120 96)">
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <ellipse key={`o${a}`} cx="0" cy="-38" rx="27" ry="43" transform={`rotate(${a})`} fill={p.outer} stroke={p.stroke} strokeWidth="1.4" />
            ))}
            {[30, 90, 150, 210, 270, 330].map((a) => (
              <ellipse key={`m${a}`} cx="0" cy="-24" rx="19" ry="29" transform={`rotate(${a})`} fill={p.mid} stroke={p.stroke} strokeWidth="1" />
            ))}
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={`i${a}`} cx="0" cy="-12" rx="11" ry="18" transform={`rotate(${a})`} fill={p.inner} stroke={p.stroke} strokeWidth="0.8" />
            ))}
            <circle r="8" fill={p.deep} />
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
            className={`absolute -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all hover:scale-110 ${
              h.active
                ? "scale-110 ring-2 ring-white/70"
                : h.filled
                  ? "ring-1 ring-white/40"
                  : "animate-pulse"
            }`}
            style={{
              left: pos[h.field].left,
              top: pos[h.field].top,
              background: `radial-gradient(circle, ${p.glow} 0%, transparent 70%)`,
              boxShadow: h.active ? `0 0 24px ${p.glow}` : undefined,
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
