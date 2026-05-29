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

let wasmModule: { recommend: (json: string) => unknown } | null = null;

async function loadWasm() {
  if (wasmModule) return wasmModule;
  try {
    const mod = await import("../../public/pkg/roselet_recommend.js");
    await mod.default();
    wasmModule = mod as unknown as { recommend: (json: string) => unknown };
    return wasmModule;
  } catch {
    return null;
  }
}

export async function getRecommendation(roses: RoseInput[]): Promise<Recommendation | null> {
  const mod = await loadWasm();
  if (!mod) return null;

  try {
    const result = mod.recommend(JSON.stringify(roses));
    return result as Recommendation;
  } catch {
    return null;
  }
}
