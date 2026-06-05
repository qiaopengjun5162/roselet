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

const MIN_CHARS = 3;
const FADE_OUT_DELAY_MS = 2000;
const VOLUME_BASE = -35;
const VOLUME_RANGE = 15;

function buildEmotion(result: Record<string, unknown>): EmotionState {
  const key = (result.emotion as string) ?? "neutral";
  if (key === "neutral") return NEUTRAL;

  return {
    key,
    label: (result.emotion_label as string) ?? null,
    intensity: (result.intensity as number) ?? 0,
    glow: GLOW[key] ?? NEUTRAL.glow,
  };
}

export function useEmotionSound(text: string, debounceMs = 500) {
  const [emotion, setEmotion] = useState<EmotionState>(NEUTRAL);
  const synthRef = useRef<Tone.Synth | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const startedRef = useRef(false);
  const mountedRef = useRef(true);

  const ensureStarted = useCallback(async () => {
    if (!startedRef.current) {
      await Tone.start();
      startedRef.current = true;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const synth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.5, decay: 0.3, sustain: 0.8, release: 1.5 },
    }).toDestination();
    synth.volume.value = VOLUME_BASE;
    synthRef.current = synth;

    return () => {
      mountedRef.current = false;
      synth.dispose();
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const trimmed = text.trim();

    if (trimmed.length < MIN_CHARS) {
      synthRef.current?.volume.rampTo(-60, 0.5);
      setEmotion(NEUTRAL);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const result = await analyzeTextWasm(trimmed);
        if (!result || !mountedRef.current) return;

        const emotionState = buildEmotion(result);
        setEmotion(emotionState);

        const synth = synthRef.current;
        if (!synth) return;

        await ensureStarted();

        const waveform = (result.waveform as OscillatorType) ?? "sine";
        const baseFreq = (result.base_freq as number) ?? 220;

        synth.oscillator.type = waveform;
        synth.frequency.value = baseFreq;
        synth.volume.rampTo(VOLUME_BASE + emotionState.intensity * VOLUME_RANGE, 0.3);
        synth.triggerAttack(baseFreq, Tone.now());

        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            synthRef.current?.volume.rampTo(-60, 1.5);
          }
        }, FADE_OUT_DELAY_MS);
      } catch {
        // WASM load or Tone.js init failed — silently degrade, no audio feedback
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [text, debounceMs, ensureStarted]);

  return emotion;
}
