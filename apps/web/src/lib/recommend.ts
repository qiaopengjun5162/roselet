export interface RoseInput { color: string; gratitude?: string | null; anxiety?: string | null; hope?: string | null }
export interface Recommendation { flower_language: { title: string; content: string; keywords: string[] }; theme: { title: string; content: string; category: string }; color_suggestion: { color: string; reason: string } }
export interface GardenLayout { card_width: number; columns: number; gap: number; padding_x: number; offset_top: number; offset_bottom: number }
export interface ValidationResult { valid: boolean; error: string | null; cleaned: { color: string; gratitude: string | null; anxiety: string | null; hope: string | null } | null }

interface WasmMod {
  recommend: (json: string) => unknown; analyze_text: (text: string) => unknown;
  compute_layout: (json: string) => unknown; filter_roses: (json: string, f: string) => unknown;
  validate_plant_input: (json: string) => unknown;
  parse_garden_response_wasm: (json: string) => unknown; parse_rose_response_wasm: (json: string) => unknown;
  validate_feedback_input: (json: string) => unknown;
  format_date_wasm: (iso: string) => unknown;
  generate_petals_wasm: (count: number, seed: bigint) => unknown;
  rose_to_sound_params_wasm: (rose_json: string) => unknown;
  compute_sky_params_wasm: (hour: number) => unknown;
  generate_star_particles_wasm: (count: number, seed: bigint) => unknown;
  build_garden_url: (base_url: string, page: number, per_page: number, color: string) => string;
  build_plant_body: (color: string, gratitude: string, anxiety: string, hope: string) => string;
  color_emoji: (color: string) => string;
  color_label: (color: string) => string;
}

let wasmModule: WasmMod | null = null;
async function loadWasm(): Promise<WasmMod | null> {
  if (wasmModule) return wasmModule;
  try { const mod = await import("../../public/pkg/roselet_recommend.js"); await mod.default(); wasmModule = mod as unknown as WasmMod; return wasmModule; } catch { return null; }
}

export async function getRecommendation(roses: RoseInput[]): Promise<Recommendation | null> { const mod = await loadWasm(); if (!mod) return null; try { return mod.recommend(JSON.stringify(roses)) as Recommendation; } catch { return null; } }
export async function analyzeTextWasm(text: string): Promise<Record<string, unknown> | null> { const mod = await loadWasm(); if (!mod) return null; try { return mod.analyze_text(text) as Record<string, unknown>; } catch { return null; } }
export async function getLayout(screenWidth: number): Promise<GardenLayout | null> { const mod = await loadWasm(); if (!mod) return null; try { return mod.compute_layout(JSON.stringify({ width: screenWidth, height: 0, safe_area_top: 0, safe_area_bottom: 0, is_web: true })) as GardenLayout; } catch { return null; } }
export async function filterRosesInWasm<T extends { color: string }>(roses: T[], f: string): Promise<T[] | null> { const mod = await loadWasm(); if (!mod) return null; try { return mod.filter_roses(JSON.stringify(roses), f) as T[]; } catch { return null; } }
export async function validatePlantInput(input: RoseInput): Promise<ValidationResult | null> { const mod = await loadWasm(); if (!mod) return null; try { return mod.validate_plant_input(JSON.stringify(input)) as ValidationResult; } catch { return null; } }

export async function parseGardenResponse(json: string): Promise<{ items: unknown[]; total: number } | null> { const mod = await loadWasm(); if (!mod) return null; try { return mod.parse_garden_response_wasm(json) as { items: unknown[]; total: number }; } catch { return null; } }
export async function parseRoseResponse(json: string): Promise<unknown | null> { const mod = await loadWasm(); if (!mod) return null; try { return mod.parse_rose_response_wasm(json) as unknown; } catch { return null; } }

export async function formatDate(iso: string): Promise<{ full_cn: string; short_cn: string; iso: string; weekday_cn: string; relative: string } | null> {
  const mod = await loadWasm(); if (!mod) return null;
  try { return mod.format_date_wasm(iso) as any; } catch { return null; }
}

export async function generatePetals(count: number, seed: bigint) {
  const mod = await loadWasm(); if (!mod) return null;
  try { return mod.generate_petals_wasm(count, seed) as {emoji:string;left:number;size:number;duration:number;delay:number;sway:number;opacity:number}[]; } catch { return null; }
}

export async function roseToSoundParamsWasm(roseJson: string): Promise<Record<string, unknown> | null> {
  const mod = await loadWasm(); if (!mod) return null;
  try { return mod.rose_to_sound_params_wasm(roseJson) as Record<string, unknown>; } catch { return null; }
}

export interface SkyParams { gradient: string; stars: number; nebula: number; label: string }

export async function computeSkyParams(hour: number): Promise<SkyParams | null> {
  const mod = await loadWasm(); if (!mod) return null;
  try { return mod.compute_sky_params_wasm(hour) as SkyParams; } catch { return null; }
}

export interface StarParticle { left: number; delay: number; duration: number; size: number; opacity: number }

export async function generateStarParticles(count: number, seed: bigint): Promise<StarParticle[] | null> {
  const mod = await loadWasm(); if (!mod) return null;
  try { return mod.generate_star_particles_wasm(count, seed) as StarParticle[]; } catch { return null; }
}

// Rust WASM URL/body builders — replaces TS template-literal construction
export async function buildGardenUrl(baseUrl: string, page: number, perPage: number, color?: string): Promise<string> {
  const mod = await loadWasm();
  if (!mod) return `${baseUrl}/api/garden?page=${page}&per_page=${perPage}${color ? `&color=${color}` : ""}`;
  try { return mod.build_garden_url(baseUrl, page, perPage, color ?? ""); } catch { return `${baseUrl}/api/garden?page=${page}&per_page=${perPage}${color ? `&color=${color}` : ""}`; }
}

export async function buildPlantBody(color: string, gratitude?: string | null, anxiety?: string | null, hope?: string | null): Promise<string> {
  const mod = await loadWasm();
  if (!mod) return JSON.stringify({ color, gratitude, anxiety, hope });
  try { return mod.build_plant_body(color, gratitude ?? "", anxiety ?? "", hope ?? ""); } catch { return JSON.stringify({ color, gratitude, anxiety, hope }); }
}

// 颜色元数据 — 同步调用（WASM 已加载则走 Rust，否则 TS 兜底保证首屏不闪）
const _CE: Record<string, string> = { red: "🌹", white: "🤍", yellow: "💛" };
const _CL: Record<string, string> = { red: "红玫瑰", white: "白玫瑰", yellow: "黄玫瑰" };
export function colorEmoji(color: string): string { try { return wasmModule?.color_emoji(color) ?? _CE[color] ?? "🌸"; } catch { return _CE[color] ?? "🌸"; } }
export function colorLabel(color: string): string { try { return wasmModule?.color_label(color) ?? _CL[color] ?? color; } catch { return _CL[color] ?? color; } }

// Fireworks — 粒子算法全量 Rust WASM 驱动
export async function burstFireworks(cx: number, cy: number, count: number, idOffset: number) {
  const mod = await loadWasm();
  if (!mod) return [];
  try { return mod.burstFireworks(cx, cy, count, idOffset) as { id: number; x: number; y: number; color: string; tx: number; ty: number; size: number; delay: number; duration: number }[]; } catch { return []; }
}
export async function getFireworkLaunches() {
  const mod = await loadWasm();
  if (!mod) return [];
  try { return mod.getFireworkLaunches() as { cx: number; cy: number; count: number; delay_ms: number }[]; } catch { return []; }
}
