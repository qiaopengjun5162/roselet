export interface RoseInput {
  color: string;
  gratitude?: string | null;
  anxiety?: string | null;
  hope?: string | null;
}

export interface FlowerLanguage {
  title: string;
  content: string;
  keywords: string[];
}

export interface ThemeSuggestion {
  title: string;
  content: string;
  category: string;
}

export interface ColorSuggestion {
  color: string;
  reason: string;
}

export interface Recommendation {
  flower_language: FlowerLanguage;
  theme: ThemeSuggestion;
  color_suggestion: ColorSuggestion;
}

interface WasmMod {
  recommend: (json: string) => unknown;
  analyze_text: (text: string) => unknown;
}

let wasmModule: WasmMod | null = null;

async function loadWasm(): Promise<WasmMod | null> {
  if (wasmModule) return wasmModule;
  try {
    const mod = await import("../../public/pkg/roselet_recommend.js");
    await mod.default();
    wasmModule = mod as unknown as WasmMod;
    return wasmModule;
  } catch {
    return null;
  }
}

export async function getRecommendation(roses: RoseInput[]): Promise<Recommendation | null> {
  const mod = await loadWasm();
  if (!mod) return null;
  try {
    return mod.recommend(JSON.stringify(roses)) as Recommendation;
  } catch {
    return null;
  }
}

// Rust WASM 实现的情绪分析，返回与 SoundParams 兼容的对象
export async function analyzeTextWasm(text: string): Promise<Record<string, unknown> | null> {
  const mod = await loadWasm();
  if (!mod) return null;
  try {
    return mod.analyze_text(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}
