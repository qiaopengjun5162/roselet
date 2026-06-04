interface PetalConfig { emoji:string; left:number; size:number; duration:number; delay:number; sway:number; opacity:number }
import Taro from "@tarojs/taro";
import type { CreateRose } from '@roselet/core';

export interface GardenLayout { card_width: number; columns: number; gap: number; padding_x: number; offset_top: number; offset_bottom: number }
export interface ValidationResult { valid: boolean; error: string | null; cleaned: { color: string; gratitude: string | null; anxiety: string | null; hope: string | null } | null }

interface GlueMod {
  recommend: (json: string) => unknown; analyze_text: (text: string) => unknown;
  compute_layout: (json: string) => unknown; filter_roses: (json: string, f: string) => unknown;
  validate_plant_input: (json: string) => unknown; format_plant_request_wasm: (json: string) => string;
  parse_garden_response_wasm: (json: string) => unknown; parse_rose_response_wasm: (json: string) => unknown;
  __wbg_get_imports: () => Record<string, unknown>; default: (b: ArrayBuffer) => Promise<void>;
}

let api: GlueMod | null = null;

export async function initWasm(): Promise<boolean> {
  if (api) return true;
  try {
    const glue = await import('../../pkg/roselet_recommend') as unknown as GlueMod;
    const imports = glue.__wbg_get_imports();
    const fs = wx.getFileSystemManager();
    try { var raw = fs.readFileSync("/pkg/roselet_recommend_bg.wasm"); } catch { console.warn("WASM file not found"); return false; }
    var wasmBytes = raw instanceof ArrayBuffer ? raw : new ArrayBuffer(0);
    if (wasmBytes.byteLength === 0) return false;
    await WXWebAssembly.instantiate(wasmBytes, imports);
    await glue.default(wasmBytes);
    api = glue; return true;
  } catch (e) { console.warn('WASM load failed:', e); return false; }
}

export function getRecommendation(roses: CreateRose[]) { if (!api) return null; try { return api.recommend(JSON.stringify(roses)); } catch { return null; } }
export function filterRoses<T extends { color: string }>(roses: T[], f: string): T[] | null { if (!api) return null; try { return api.filter_roses(JSON.stringify(roses), f) as T[]; } catch { return null; } }
export function validatePlant(input: CreateRose): ValidationResult | null { if (!api) return null; try { return api.validate_plant_input(JSON.stringify(input)) as ValidationResult; } catch { return null; } }

/// Rust 解析 API 响应 — 返回强类型验证后的数据
export function parseGardenResponse(json: string): { items: unknown[]; total: number } | null {
  if (!api) return null;
  try { return api.parse_garden_response_wasm(json) as { items: unknown[]; total: number }; } catch { return null; }
}

export function parseRoseResponse(json: string): unknown | null {
  if (!api) return null;
  try { return api.parse_rose_response_wasm(json) as unknown; } catch { return null; }
}

export function generatePetals(count: number, seed: number): PetalConfig[] | null {
  if (!api) return null;
  try { return api.generate_petals_wasm(count, seed) as PetalConfig[]; } catch { return null; }
}
