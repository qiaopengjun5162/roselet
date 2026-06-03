"use client";

import { useEffect } from "react";

// 全程深色，但每个时段有清晰可感知的色调差异
// 颜色设计原则：最暗时段亮度差 ≥ 30%，让切换效果真正可见
const TIME_STAGES = [
  // 凌晨 0-4：最深星空，冷蓝黑，星点最亮
  {
    from: 0, to: 4,
    gradient: "linear-gradient(150deg, #02040d 0%, #050818 50%, #030610 100%)",
    stars: 1.0, nebula: 0.22,
    label: "deep-night",
  },
  // 黎明 4-6：破晓，深紫红透出地平线，暗橙核心
  {
    from: 4, to: 6,
    gradient: "linear-gradient(175deg, #0e0408 0%, #1f0812 25%, #2a1008 50%, #180820 75%, #080614 100%)",
    stars: 0.65, nebula: 0.28,
    label: "dawn",
  },
  // 早晨 6-9：深酒红晨光，仍是夜的尾巴但有温度
  {
    from: 6, to: 9,
    gradient: "linear-gradient(160deg, #180810 0%, #2a1018 35%, #1a0e24 65%, #0e0a1a 100%)",
    stars: 0.25, nebula: 0.20,
    label: "morning",
  },
  // 上午 9-12：深靛蓝，最沉稳的时段，星云淡淡
  {
    from: 9, to: 12,
    gradient: "linear-gradient(150deg, #080c1a 0%, #0e1428 45%, #0a1020 80%, #08100e 100%)",
    stars: 0.08, nebula: 0.14,
    label: "forenoon",
  },
  // 下午 12-17：深墨绿蓝，稳定的日间底色，无星
  {
    from: 12, to: 17,
    gradient: "linear-gradient(145deg, #060e0c 0%, #0a1410 35%, #0c1018 65%, #080c14 100%)",
    stars: 0.0, nebula: 0.10,
    label: "afternoon",
  },
  // 傍晚 17-19：最美时段，深玫瑰暮色，紫红渐变强烈
  {
    from: 17, to: 19,
    gradient: "linear-gradient(165deg, #1a0610 0%, #2e0c1c 20%, #3a1020 40%, #1e0c2a 65%, #0c0818 100%)",
    stars: 0.35, nebula: 0.32,
    label: "dusk",
  },
  // 入夜 19-22：深紫星夜，玫瑰韵味未散，星光渐起
  {
    from: 19, to: 22,
    gradient: "linear-gradient(150deg, #0a061c 0%, #160a28 30%, #100820 60%, #08061a 100%)",
    stars: 0.75, nebula: 0.24,
    label: "evening",
  },
  // 深夜 22-24：回归纯粹星空
  {
    from: 22, to: 24,
    gradient: "linear-gradient(150deg, #02040d 0%, #050818 50%, #030610 100%)",
    stars: 1.0, nebula: 0.22,
    label: "night",
  },
] as const;

function getStage(hour: number) {
  return TIME_STAGES.find((s) => hour >= s.from && hour < s.to) ?? TIME_STAGES[0];
}

function applyStage(hour: number) {
  const stage = getStage(hour);
  document.body.style.background = stage.gradient;
  document.documentElement.style.setProperty("--stars-opacity", String(stage.stars));
  document.documentElement.style.setProperty("--nebula-opacity", String(stage.nebula));
}

export function DayNightBackground() {
  useEffect(() => {
    applyStage(new Date().getHours());
    const id = setInterval(() => applyStage(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);

  return null;
}
