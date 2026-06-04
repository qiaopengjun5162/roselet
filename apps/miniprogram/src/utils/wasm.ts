import Taro from "@tarojs/taro";
import { STATUS_BAR_HEIGHT } from "@/components/NavBar";
import type { CreateRose } from '@roselet/core';

export interface Recommendation { flower_language: { title: string; content: string; keywords: string[] }; theme: { title: string; content: string; category: string }; color_suggestion: { color: string; reason: string } }
export interface GardenLayout { card_width: number; columns: number; gap: number; padding_x: number }
export interface ValidationResult { valid: boolean; error: string | null; cleaned: { color: string; gratitude: string | null; anxiety: string | null; hope: string | null } | null }

interface GlueMod {
  recommend: (json: string) => unknown;
  analyze_text: (text: string) => unknown;
  compute_layout: (json: string) => unknown;
  filter_roses: (json: string, f: string) => unknown;
  validate_plant_input: (json: string) => unknown;
  format_plant_request_wasm: (json: string) => string;
  __wbg_get_imports: () => Record<string, unknown>;
  default: (b: ArrayBuffer) => Promise<void>;
}

let api: GlueMod | null = null;

export async function initWasm(): Promise<boolean> {
  if (api) return true;
  try {
    const glue = await import('../../pkg/roselet_recommend') as unknown as GlueMod;
    const imports = glue.__wbg_get_imports();
    const fs = wx.getFileSystemManager();
    let wasmBytes: ArrayBuffer;
    try { wasmBytes = fs.readFileSync('/pkg/roselet_recommend_bg.wasm').buffer as ArrayBuffer; }
    catch { return false; }
    await WXWebAssembly.instantiate(wasmBytes, imports);
    await glue.default(wasmBytes);
    api = glue;
    return true;
  } catch (e) { console.warn('WASM load failed:', e); return false; }
}

export function getRecommendation(roses: CreateRose[]): Recommendation | null {
  if (!api) return null;
  try { return api.recommend(JSON.stringify(roses)) as Recommendation; } catch { return null; }
}
export function getLayout(screenWidth: number): GardenLayout | null {
  if (!api) return null;
  try {
    const info = Taro.getSystemInfoSync();
    return api.compute_layout(JSON.stringify({
      width: screenWidth, height: info.windowHeight,
      safe_area_top: (info as any).safeArea?.top || STATUS_BAR_HEIGHT,
      safe_area_bottom: (info as any).safeArea?.bottom || 0,
      is_web: false
    })) as GardenLayout;
  } catch { return null; }
}
export function filterRoses<T extends { color: string }>(roses: T[], f: string): T[] | null {
  if (!api) return null;
  try { return api.filter_roses(JSON.stringify(roses), f) as T[]; } catch { return null; }
}
export function validatePlant(input: CreateRose): ValidationResult | null {
  if (!api) return null;
  try { return api.validate_plant_input(JSON.stringify(input)) as ValidationResult; } catch { return null; }
}
export function formatPlantRequest(input: CreateRose): string | null {
  if (!api) return null;
  try { return api.format_plant_request_wasm(JSON.stringify(input)); } catch { return null; }
}
