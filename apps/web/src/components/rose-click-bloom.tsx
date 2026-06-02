"use client";

import { useEffect, useState, useCallback } from "react";

interface BloomRose {
  id: number;
  x: number;
  y: number;
  emoji: string;
  size: number;
}

// 随机从三种玫瑰中选一个，大小略有差异让每次都不一样
const ROSE_EMOJIS = ["🌹", "🌸", "🌺"];

let nextId = 0;

export function RoseClickBloom() {
  const [blooms, setBlooms] = useState<BloomRose[]>([]);

  const handleClick = useCallback((e: MouseEvent) => {
    // 不在交互元素上触发（输入框、按钮、链接）
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (["input", "textarea", "button", "a", "select"].includes(tag)) return;

    const emoji = ROSE_EMOJIS[Math.floor(Math.random() * ROSE_EMOJIS.length)];
    const size = 20 + Math.random() * 16; // 20~36px

    const bloom: BloomRose = {
      id: nextId++,
      x: e.clientX,
      y: e.clientY,
      emoji,
      size,
    };

    setBlooms((prev) => [...prev, bloom]);

    // 动画 700ms 后销毁
    setTimeout(() => {
      setBlooms((prev) => prev.filter((b) => b.id !== bloom.id));
    }, 700);
  }, []);

  useEffect(() => {
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [handleClick]);

  if (blooms.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {blooms.map((bloom) => (
        <span
          key={bloom.id}
          className="absolute select-none animate-rose-bloom"
          style={{
            left: bloom.x,
            top: bloom.y,
            fontSize: bloom.size,
            transform: "translate(-50%, -50%)",
            lineHeight: 1,
          }}
        >
          {bloom.emoji}
        </span>
      ))}
    </div>
  );
}
