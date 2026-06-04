export interface RoseInput {
  color: string;
  gratitude?: string | null;
  anxiety?: string | null;
  hope?: string | null;
}

export interface FlowerLanguage { title: string; content: string; keywords: string[] }
export interface ThemeSuggestion { title: string; content: string; category: string }
export interface ColorSuggestion { color: string; reason: string }

export interface Recommendation {
  flower_language: FlowerLanguage;
  theme: ThemeSuggestion;
  color_suggestion: ColorSuggestion;
}

export interface GardenLayout {
  card_width: number;
  columns: number;
  gap: number;
  padding_x: number;
}

interface WasmMod {
  recommend: (json: string) => unknown;
  analyze_text: (text: string) => unknown;
  compute_layout: (width: number, is_web: boolean) => unknown;
  filter_roses: (json: string, filter: string) => unknown;
}

let wasmModule: WasmMod | null = null;

async function loadWasm(): Promise<WasmMod | null> {
  if (wasmModule) return wasmModule;
  try {
    const mod = await import("../../public/pkg/roselet_recommend.js");
    await mod.default();
    wasmModule = mod as unknown as WasmMod;
    return wasmModule;
  } catch { return null; }
}

export async function getRecommendation(roses: RoseInput[]): Promise<Recommendation | null> {
  const mod = await loadWasm();
  if (!mod) return null;
  try { return mod.recommend(JSON.stringify(roses)) as Recommendation; } catch { return null; }
}

export async function analyzeTextWasm(text: string): Promise<Record<string, unknown> | null> {
  const mod = await loadWasm();
  if (!mod) return null;
  try { return mod.analyze_text(text) as Record<string, unknown>; } catch { return null; }
}

/** Rust 计算花园卡片布局 */
export async function getLayout(screenWidth: number): Promise<GardenLayout | null> {
  const mod = await loadWasm();
  if (!mod) return null;
  try { return mod.compute_layout(screenWidth, true) as GardenLayout; } catch { return null; }
}

/** Rust 侧过滤玫瑰列表 */
export async function filterRosesInWasm<T extends { color: string }>(roses: T[], colorFilter: string): Promise<T[] | null> {
  const mod = await loadWasm();
  if (!mod) return null;
  try {
    const filtered = mod.filter_roses(JSON.stringify(roses), colorFilter) as T[];
    return filtered;
  } catch { return null; }
}
