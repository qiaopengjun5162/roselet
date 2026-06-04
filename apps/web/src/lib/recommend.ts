export interface RoseInput { color: string; gratitude?: string | null; anxiety?: string | null; hope?: string | null }
export interface FlowerLanguage { title: string; content: string; keywords: string[] }
export interface ThemeSuggestion { title: string; content: string; category: string }
export interface ColorSuggestion { color: string; reason: string }
export interface Recommendation { flower_language: FlowerLanguage; theme: ThemeSuggestion; color_suggestion: ColorSuggestion }
export interface GardenLayout { card_width: number; columns: number; gap: number; padding_x: number }
export interface ValidationResult { valid: boolean; error: string | null; cleaned: { color: string; gratitude: string | null; anxiety: string | null; hope: string | null } | null }

interface WasmMod {
  recommend: (json: string) => unknown;
  analyze_text: (text: string) => unknown;
  compute_layout: (json: string) => unknown;
  filter_roses: (json: string, f: string) => unknown;
  validate_plant_input: (json: string) => unknown;
  format_plant_request_wasm: (json: string) => string;
}

let wasmModule: WasmMod | null = null;
async function loadWasm(): Promise<WasmMod | null> {
  if (wasmModule) return wasmModule;
  try { const mod = await import("../../public/pkg/roselet_recommend.js"); await mod.default(); wasmModule = mod as unknown as WasmMod; return wasmModule; } catch { return null; }
}

export async function getRecommendation(roses: RoseInput[]): Promise<Recommendation | null> {
  const mod = await loadWasm(); if (!mod) return null;
  try { return mod.recommend(JSON.stringify(roses)) as Recommendation; } catch { return null; }
}
export async function analyzeTextWasm(text: string): Promise<Record<string, unknown> | null> {
  const mod = await loadWasm(); if (!mod) return null;
  try { return mod.analyze_text(text) as Record<string, unknown>; } catch { return null; }
}
export async function getLayout(screenWidth: number): Promise<GardenLayout | null> {
  const mod = await loadWasm(); if (!mod) return null;
  try {
    return mod.compute_layout(JSON.stringify({
      width: screenWidth, height: typeof window !== "undefined" ? window.innerHeight : 0,
      safe_area_top: 0, safe_area_bottom: 0, is_web: true
    })) as GardenLayout;
  } catch { return null; }
}
export async function filterRosesInWasm<T extends { color: string }>(roses: T[], f: string): Promise<T[] | null> {
  const mod = await loadWasm(); if (!mod) return null;
  try { return mod.filter_roses(JSON.stringify(roses), f) as T[]; } catch { return null; }
}

/// Rust 验证种花表单
export async function validatePlantInput(input: RoseInput): Promise<ValidationResult | null> {
  const mod = await loadWasm(); if (!mod) return null;
  try { return mod.validate_plant_input(JSON.stringify(input)) as ValidationResult; } catch { return null; }
}

/// Rust 格式化 API 请求数据
export async function formatPlantRequest(input: RoseInput): Promise<string | null> {
  const mod = await loadWasm(); if (!mod) return null;
  try { return mod.format_plant_request_wasm(JSON.stringify(input)); } catch { return null; }
}
