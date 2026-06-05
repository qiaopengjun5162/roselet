interface FeedbackValidation { valid: boolean; error?: string }

interface WasmMod {
  recommend: (json: string) => unknown; analyze_text: (text: string) => unknown;
  compute_layout: (json: string) => unknown; filter_roses: (json: string, f: string) => unknown;
  validate_plant_input: (json: string) => unknown;
  parse_garden_response_wasm: (json: string) => unknown; parse_rose_response_wasm: (json: string) => unknown;
  validate_feedback_input: (json: string) => unknown;
  format_date_wasm: (iso: string) => unknown;
  generate_petals_wasm: (count: number, seed: bigint) => unknown;
  rose_to_sound_params_wasm: (rose_json: string) => unknown;
  color_emoji: (color: string) => string;
  color_label: (color: string) => string;
  compute_sky_params_wasm: (hour: number) => unknown;
  generate_star_particles_wasm: (count: number, seed: bigint) => unknown;
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

export async function validateFeedback(content: string): Promise<FeedbackValidation> {
  const mod = await loadWasm();
  if (!mod) return { valid: false, error: "WASM 加载失败" };
  try {
    return mod.validate_feedback_input(JSON.stringify({ content })) as FeedbackValidation;
  } catch {
    return { valid: false, error: "验证失败" };
  }
}

// 导出其他已有的 WASM 功能
export { getRecommendation, analyzeTextWasm, getLayout, filterRosesInWasm, validatePlantInput, parseGardenResponse, parseRoseResponse, formatDate, generatePetals, roseToSoundParamsWasm, computeSkyParams, generateStarParticles, colorEmoji, colorLabel } from "./recommend";