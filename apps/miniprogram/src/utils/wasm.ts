import type { CreateRose } from '@roselet/core';

export interface Recommendation {
  flower_language: { title: string; content: string; keywords: string[] };
  theme: { title: string; content: string; category: string };
  color_suggestion: { color: string; reason: string };
}

interface WasmMod {
  recommend: (json: string) => unknown;
  analyze_text: (text: string) => unknown;
  __wbg_set_wasm: (exports: unknown) => void;
}

let wasmMod: WasmMod | null = null;

/**
 * 初始化 Rust WASM 模块（通过 WXWebAssembly.instantiate 加载）。
 * 已初始化时直接返回 true，加载失败返回 false（降级为纯 JS 模式）。
 */
export async function initWasm(): Promise<boolean> {
  if (wasmMod) return true;
  try {
    const mod = await import('../../pkg/roselet_recommend') as unknown as WasmMod;
    const result = await WXWebAssembly.instantiate(
      '/pkg/roselet_recommend_bg.wasm',
      { './roselet_recommend_bg.js': mod }
    );
    mod.__wbg_set_wasm(result.instance.exports);
    wasmMod = mod;
    return true;
  } catch (e) {
    console.warn('WASM load failed, degraded mode:', e);
    return false;
  }
}

/**
 * 调用 WASM 推荐算法，传入用户已种的玫瑰列表，返回颜色建议。
 * WASM 未初始化或调用异常时返回 null。
 */
export function getRecommendation(roses: CreateRose[]): Recommendation | null {
  if (!wasmMod) return null;
  try {
    return wasmMod.recommend(JSON.stringify(roses)) as Recommendation;
  } catch {
    return null;
  }
}
