import type { CreateRose } from '@roselet/core';

export interface Recommendation {
  flower_language: { title: string; content: string; keywords: string[] };
  theme: { title: string; content: string; category: string };
  color_suggestion: { color: string; reason: string };
}

export interface GardenLayout {
  card_width: number;
  columns: number;
  gap: number;
  padding_x: number;
}

interface GlueMod {
  recommend: (json: string) => unknown;
  analyze_text: (text: string) => unknown;
  compute_layout: (width: number, is_web: boolean) => unknown;
  filter_roses: (json: string, filter: string) => unknown;
  __wbg_get_imports: () => Record<string, unknown>;
  default: (wasmBytes: ArrayBuffer) => Promise<void>;
}

let api: { recommend: (json: string) => unknown; analyze_text: (text: string) => unknown; compute_layout: (w: number, b: boolean) => unknown; filter_roses: (j: string, f: string) => unknown } | null = null;

/** 初始化 Rust WASM 模块 */
export async function initWasm(): Promise<boolean> {
  if (api) return true;
  try {
    const glue = await import('../../pkg/roselet_recommend') as unknown as GlueMod;
    const imports = glue.__wbg_get_imports();
    const fs = wx.getFileSystemManager();
    const wasmPath = '/pkg/roselet_recommend_bg.wasm';
    let wasmBytes: ArrayBuffer;
    try { wasmBytes = fs.readFileSync(wasmPath).buffer as ArrayBuffer; }
    catch { wasmBytes = fs.readFileSync(`/pkg/roselet_recommend_bg.wasm`).buffer as ArrayBuffer; }
    await WXWebAssembly.instantiate(wasmBytes, imports);
    await glue.default(wasmBytes);
    api = glue;
    return true;
  } catch (e) {
    console.warn('WASM load failed:', e);
    return false;
  }
}

export function getRecommendation(roses: CreateRose[]): Recommendation | null {
  if (!api) return null;
  try { return api.recommend(JSON.stringify(roses)) as Recommendation; } catch { return null; }
}

/** Rust 计算花园卡片布局 */
export function getLayout(screenWidth: number, isWeb: boolean): GardenLayout | null {
  if (!api) return null;
  try { return api.compute_layout(screenWidth, isWeb) as GardenLayout; } catch { return null; }
}

/** Rust 侧过滤玫瑰列表 */
export function filterRoses<T extends { color: string }>(roses: T[], colorFilter: string): T[] | null {
  if (!api) return null;
  try {
    const result = api.filter_roses(JSON.stringify(roses), colorFilter) as T[];
    return result;
  } catch { return null; }
}
