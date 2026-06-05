"use client";

import { useEffect } from "react";
import { computeSkyParams } from "@/lib/recommend";

function applyStage(hour: number) {
  computeSkyParams(hour).then((params) => {
    if (!params) return;
    document.body.style.background = params.gradient;
    document.documentElement.style.setProperty("--stars-opacity", String(params.stars));
    document.documentElement.style.setProperty("--nebula-opacity", String(params.nebula));
  });
}

export function DayNightBackground() {
  useEffect(() => {
    applyStage(new Date().getHours());
    const id = setInterval(() => applyStage(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);

  return null;
}
