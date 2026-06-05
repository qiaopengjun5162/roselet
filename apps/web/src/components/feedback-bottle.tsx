"use client";

import { useState, useCallback } from "react";
import { FeedbackForm } from "@/components/feedback-form";
import { StarBottle } from "@/components/star-bottle";

export function FeedbackBottle() {
  const [glow, setGlow] = useState("rgba(244,63,94,0.2)");

  const handleEmotionChange = useCallback((newGlow: string) => {
    setGlow(newGlow);
  }, []);

  return (
    <StarBottle
      delay={0}
      glowColor={glow}
      className="w-full max-w-md p-6 md:p-8 transition-all duration-700"
    >
      <h2 className="text-xs md:text-sm text-slate-400 tracking-wide mb-4 md:mb-6">
        为花圃留下你的声音
      </h2>
      <FeedbackForm onEmotionChange={handleEmotionChange} />
    </StarBottle>
  );
}
