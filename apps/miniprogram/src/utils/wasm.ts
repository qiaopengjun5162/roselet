import type { CreateRose } from '@roselet/core';

export interface Recommendation {
  flower_language: { title: string; content: string; keywords: string[] };
  theme: { title: string; content: string; category: string };
  color_suggestion: { color: string; reason: string };
}

interface GlueMod {
  recommend: (json: string) => unknown;
  analyze_text: (text: string) => unknown;
  __wbg_get_imports: () => Record<string, unknown>;
  default: (wasmBytes: ArrayBuffer) => Promise<void>;
}

let wasmMod: { recommend: (json: string) => unknown; analyze_text: (text: string) => unknown } | null = null;

/**
 * 初始化 Rust WASM 模块。
 * 使用胶水代码自带的 __wbg_get_imports() 获取正确的 import 对象，
 * 通过 wx.getFileSystemManager 读取 WASM 字节，调用 WXWebAssembly.instantiate。
 */
export async function initWasm(): Promise<boolean> {
  if (wasmMod) return true;
  try {
    const glue = await import('../../pkg/roselet_recommend') as unknown as GlueMod;
    const imports = glue.__wbg_get_imports();

    // 微信小程序中通过文件系统管理器读取 WASM 二进制
    const fs = wx.getFileSystemManager();
    const wasmPath = `${wx.env.USER_DATA_PATH}/pkg/roselet_recommend_bg.wasm`;
    let wasmBytes: ArrayBuffer;
    try {
      wasmBytes = fs.readFileSync(wasmPath).buffer as ArrayBuffer;
    } catch {
      // 生产构建时 WASM 在包内路径
      wasmBytes = fs.readFileSync('/pkg/roselet_recommend_bg.wasm').buffer as ArrayBuffer;
    }

    const { instance } = await WXWebAssembly.instantiate(wasmBytes, imports);

    // 调用 default init 完成内部状态绑定
    await glue.default(wasmBytes);

    wasmMod = { recommend: glue.recommend, analyze_text: glue.analyze_text };
    return true;
  } catch (e) {
    console.warn('WASM load failed, degraded mode:', e);
    return false;
  }
}

/**
 * 调用 WASM 推荐算法，WASM 未初始化时返回 null。
 */
export function getRecommendation(roses: CreateRose[]): Recommendation | null {
  if (!wasmMod) return null;
  try {
    return wasmMod.recommend(JSON.stringify(roses)) as Recommendation;
  } catch {
    return null;
  }
}
