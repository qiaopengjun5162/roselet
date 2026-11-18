/**
 * WASM-unavailable fallbacks shared by the Web app and the mini-program.
 *
 * `crates/recommend` (Rust WASM) is the single authority for these behaviours.
 * When the WASM bundle cannot load, both front-ends must degrade to the *same*
 * output Rust would produce, otherwise the first paint and the request body
 * differ from the normal path. `crates/recommend/src/contract.rs` reads this
 * file at test time and fails if the data or the semantics drift.
 */

export type TipContext = "home" | "login" | "plant" | "garden";
export interface Tip { text: string }
export interface ColorMeta { id: string; label: string; emoji: string }

/** Must match crates/recommend/src/color.rs `COLORS` — values AND order. */
export const COLOR_FALLBACK: readonly ColorMeta[] = [
  { id: "red", label: "红玫瑰", emoji: "🌹" },
  { id: "white", label: "白玫瑰", emoji: "🤍" },
  { id: "yellow", label: "黄玫瑰", emoji: "💛" },
];

/** Web-side lookup tables. The Rust contract test reads these literals. */
export const COLOR_EMOJI_FALLBACK: Record<string, string> = { red: "🌹", white: "🤍", yellow: "💛" };
export const COLOR_LABEL_FALLBACK: Record<string, string> = { red: "红玫瑰", white: "白玫瑰", yellow: "黄玫瑰" };

/**
 * color.rs `find()` returns the FIRST registered colour for an unknown id.
 * Derive the fallback from COLOR_FALLBACK[0] instead of duplicating the emoji
 * and label a third time — the Rust contract test asserts this derivation.
 */
export const UNKNOWN_COLOR_EMOJI_FALLBACK = COLOR_FALLBACK[0].emoji;
export const UNKNOWN_COLOR_LABEL_FALLBACK = COLOR_FALLBACK[0].label;

export function colorEmojiFallback(color: string): string {
  return COLOR_EMOJI_FALLBACK[color] ?? UNKNOWN_COLOR_EMOJI_FALLBACK;
}
export function colorLabelFallback(color: string): string {
  return COLOR_LABEL_FALLBACK[color] ?? UNKNOWN_COLOR_LABEL_FALLBACK;
}
/** Return a copy so callers cannot mutate the shared table. */
export function colorOptionsFallback(): ColorMeta[] {
  return COLOR_FALLBACK.map((meta) => ({ ...meta }));
}

/** One tip per context, each copied from crates/recommend/src/tips.rs. */
export const TIP_FALLBACKS: Record<TipContext, Tip[]> = {
  home: [{ text: "这里不是朋友圈，不用表现得很好。种下一点真实就可以。" }],
  login: [{ text: "可以不设密码，像把钥匙藏在花盆底下；但设了密码，别人就不容易误进你的花圃。" }],
  plant: [{ text: "不知道写哪一栏？只写一栏也可以，一朵花不需要一次说完全部心事。" }],
  garden: [{ text: "花圃里看到的是公开玫瑰；私密玫瑰只留在自己的小角落。" }],
};

/** audio.rs `playback_policy_internal`: only foreground + playing background stops it. */
export interface PlaybackPolicyInput {
  starting: "background" | "foreground" | "effect";
  background_playing: boolean;
}
export function audioPlaybackPolicyFallback(input: PlaybackPolicyInput): { stop_background: boolean } {
  return { stop_background: input.background_playing && input.starting === "foreground" };
}

/** api_client.rs `build_garden_url`: empty and "all" filters are omitted. */
export function buildGardenUrlFallback(baseUrl: string, page: number, perPage: number, color?: string): string {
  const filter = color && color !== "all" ? `&color=${color}` : "";
  return `${baseUrl}/api/garden?page=${page}&per_page=${perPage}${filter}`;
}

export interface PlantBodyInput {
  color: string;
  gratitude?: string | null;
  anxiety?: string | null;
  hope?: string | null;
  is_private?: boolean;
  recipient_nickname?: string;
}

/**
 * api_client.rs `build_plant_body`: blank text becomes `None` and is skipped by
 * serde, `is_private: false` is skipped, and an empty recipient is skipped.
 * The old TS fallbacks emitted `anxiety: null, hope: null` instead, which made
 * the request body differ from the WASM path when WASM failed to load.
 */
export function buildPlantBodyFallback(input: PlantBodyInput): string {
  const body: Record<string, string | boolean> = { color: input.color };
  if (input.gratitude) body.gratitude = input.gratitude;
  if (input.anxiety) body.anxiety = input.anxiety;
  if (input.hope) body.hope = input.hope;
  if (input.is_private) body.is_private = true;
  if (input.recipient_nickname) body.recipient_nickname = input.recipient_nickname;
  return JSON.stringify(body);
}
