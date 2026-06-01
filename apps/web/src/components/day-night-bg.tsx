"use client";

import { useEffect } from "react";

// 一天 8 个时段，每段定义渐变色和星空/星云透明度
const TIME_STAGES = [
  // 凌晨 0-4 深夜星空
  {
    from: 0, to: 4,
    gradient: "linear-gradient(150deg, #060810 0%, #090b18 40%, #0a0814 100%)",
    stars: 1.0, nebula: 0.18,
    label: "deep-night",
  },
  // 黎明 4-6 破晓橙紫
  {
    from: 4, to: 6,
    gradient: "linear-gradient(170deg, #1a0a0e 0%, #2d1020 40%, #1a1030 80%, #0d0c20 100%)",
    stars: 0.6, nebula: 0.20,
    label: "dawn",
  },
  // 早晨 6-9 暖橙玫瑰
  {
    from: 6, to: 9,
    gradient: "linear-gradient(160deg, #2a0e10 0%, #3d1a10 30%, #1e1428 70%, #120e20 100%)",
    stars: 0.2, nebula: 0.15,
    label: "morning",
  },
  // 上午 9-12 柔和蓝紫
  {
    from: 9, to: 12,
    gradient: "linear-gradient(150deg, #0e1020 0%, #141828 40%, #0e1218 80%, #0c1010 100%)",
    stars: 0.05, nebula: 0.10,
    label: "forenoon",
  },
  // 下午 12-17 静谧深蓝绿
  {
    from: 12, to: 17,
    gradient: "linear-gradient(150deg, #080e0c 0%, #0c1210 30%, #0e1018 70%, #090c14 100%)",
    stars: 0.0, nebula: 0.08,
    label: "afternoon",
  },
  // 傍晚 17-19 玫瑰暮色
  {
    from: 17, to: 19,
    gradient: "linear-gradient(160deg, #1e0c14 0%, #2e1020 30%, #1a0e28 70%, #0e0c1c 100%)",
    stars: 0.3, nebula: 0.22,
    label: "dusk",
  },
  // 入夜 19-22 紫粉星夜
  {
    from: 19, to: 22,
    gradient: "linear-gradient(150deg, #0e081a 0%, #140c22 35%, #0c0c1c 70%, #080a16 100%)",
    stars: 0.7, nebula: 0.20,
    label: "evening",
  },
  // 深夜 22-24 回到星空
  {
    from: 22, to: 24,
    gradient: "linear-gradient(150deg, #060810 0%, #090b18 40%, #0a0814 100%)",
    stars: 1.0, nebula: 0.18,
    label: "night",
  },
] as const;

function getStage(hour: number) {
  return TIME_STAGES.find((s) => hour >= s.from && hour < s.to) ?? TIME_STAGES[0];
}

function applyStage(hour: number) {
  const stage = getStage(hour);
  const body = document.body;
  body.style.background = stage.gradient;
  // 星空和星云透明度通过 CSS 变量控制
  document.documentElement.style.setProperty("--stars-opacity", String(stage.stars));
  document.documentElement.style.setProperty("--nebula-opacity", String(stage.nebula));
}

export function DayNightBackground() {
  useEffect(() => {
    applyStage(new Date().getHours());

    // 每分钟检查一次，整点前后平滑切换
    const id = setInterval(() => {
      applyStage(new Date().getHours());
    }, 60_000);

    return () => clearInterval(id);
  }, []);

  return null;
}
