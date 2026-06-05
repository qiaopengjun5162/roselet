"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import * as Tone from "tone";
import { analyzeTextWasm } from "@/lib/recommend";

export interface EmotionState {
  key: string | null;
  label: string | null;
  intensity: number;
  glow: string;
}

const GLOW: Record<string, string> = {
  gratitude: "rgba(244,63,94,0.25)",
  anxiety: "rgba(14,165,233,0.25)",
  hope: "rgba(167,139,250,0.25)",
};

const NEUTRAL: EmotionState = {
  key: null,
  label: null,
  intensity: 0,
  glow: "rgba(244,63,94,0.12)",
};

export function useEmotionSound(text: string, debounceMs = 500) {
  const [emotion, setEmotion] = useState<EmotionState>(NEUTRAL);
  const synthRef = useRef<Tone.Synth | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const startedRef = useRef(false);

  const ensureStarted = useCallback(async () => {
    if (!startedRef.current) {
      await Tone.start();
      startedRef.current = true;
    }
  }, []);

  useEffect(() => {
    const synth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.5, decay: 0.3, sustain: 0.8, release: 1.5 },
    }).toDestination();
    synth.volume.value = -35;
    synthRef.current = synth;
    return () => {
      synth.dispose();
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const trimmed = text.trim();

    if (trimmed.length < 3) {
      if (synthRef.current) synthRef.current.volume.rampTo(-60, 0.5);
      setEmotion(NEUTRAL);
      return;
    }

    const timer = setTimeout(async () => {
      const result = await analyzeTextWasm(trimmed);
      if (!result) return;

      const key = (result.emotion as string) ?? "neutral";
      const baseFreq = (result.base_freq as number) ?? 220;
      const waveform = (result.waveform as OscillatorType) ?? "sine";
      const intensity = (result.intensity as number) ?? 0;

      setEmotion(
        key !== "neutral"
          ? { key, label: (result.emotion_label as string) ?? null, intensity, glow: GLOW[key] ?? NEUTRAL.glow }
          : NEUTRAL
      );

      if (synthRef.current) {
        await ensureStarted();
        synthRef.current.oscillator.type = waveform;
        synthRef.current.frequency.value = baseFreq;
        synthRef.current.volume.rampTo(-35 + intensity * 15, 0.3);

        try {
          synthRef.current.triggerAttack(baseFreq, Tone.now());
        } catch {
          // already playing
        }

        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = setTimeout(() => {
          synthRef.current?.volume.rampTo(-60, 1.5);
        }, 2000);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [text, debounceMs, ensureStarted]);

  return emotion;
}
