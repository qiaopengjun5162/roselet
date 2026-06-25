/* tslint:disable */
/* eslint-disable */

/**
 * WASM 入口：分析一段文字，返回对应的示波器音乐参数
 */
export function analyze_text(text: string): any;

export function apply_garden_cache_action_wasm(cache_json: string, action_json: string): string;

/**
 * WASM: 音频播放互斥策略（前景音频开始时暂停背景音乐，短音效不打断背景）
 */
export function audio_playback_policy_wasm(input_json: string): any;

/**
 * WASM: Rust API 客户端 — 构造 URL、请求体、分页计算
 */
export function build_garden_url(base_url: string, page: number, per_page: number, color: string): string;

export function build_optimistic_rose_wasm(plant_body_json: string, temp_id: string, now_iso: string, nickname: string): any;

export function build_plant_body(color: string, gratitude: string, anxiety: string, hope: string, is_private: boolean, recipient_nickname: string): string;

export function burstFireworks(cx: number, cy: number, count: number, id_offset: number): any;

export function color_emoji(color: string): string;

export function color_label(color: string): string;

export function color_options(): any;

/**
 * WASM: 根据屏幕参数和安全区计算卡片布局
 */
export function compute_layout(screen_json: string): any;

export function compute_pagination(total: number, page: number, per_page: number): any;

/**
 * WASM: 根据小时(0-23)返回天空参数 — 梯度/星空/星云/时段标签
 */
export function compute_sky_params_wasm(hour: number): any;

/**
 * WASM: 过滤玫瑰列表，返回 JSON
 */
export function filter_roses(roses_json: string, color_filter: string): any;

/**
 * WASM: 统一日期格式化 — { full_cn, short_cn, iso, weekday_cn, relative }
 */
export function format_date_wasm(iso_str: string): any;

/**
 * WASM: 格式化种花请求，返回可直接 POST 的 JSON 字符串
 */
export function format_plant_request_wasm(json: string): string;

/**
 * WASM: 生成花瓣配置列表（确定性随机，同 seed 同结果）
 */
export function generate_petals_wasm(count: number, seed: bigint): any;

export function generate_star_particles_wasm(count: number, seed: bigint): any;

export function getFireworkLaunches(): any;

/**
 * WASM: 获取页面小提示文案（Rust 统一维护，Web/小程序只负责展示）
 */
export function get_tips_wasm(context: string): any;

/**
 * WASM: 解析花圃 API 响应
 */
export function parse_garden_response_wasm(json: string): any;

/**
 * WASM: 解析单朵玫瑰响应
 */
export function parse_rose_response_wasm(json: string): any;

/**
 * WASM 入口：接收 JSON 字符串，返回推荐结果
 */
export function recommend(roses_json: string): any;

/**
 * WASM: 玫瑰属性 → 示波器音频参数（颜色/字段/长度/点赞 → fx/fy/waveform/baseFreq/phase/stroke/glow）
 */
export function rose_to_sound_params_wasm(rose_json: string): any;

/**
 * WASM: 发送 Action 给 Rust 状态机，返回新快照
 */
export function store_dispatch(action_json: string): any;

/**
 * WASM: 获取当前状态快照
 */
export function store_get_snapshot(): any;

/**
 * WASM: 验证反馈内容，返回 JSON (统一校验规则)
 */
export function validate_feedback_input(json: string): any;

/**
 * WASM: 验证种花表单，返回 JSON (Rust 侧统一校验规则)
 */
export function validate_plant_input(json: string): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly analyze_text: (a: number, b: number) => number;
    readonly apply_garden_cache_action_wasm: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly audio_playback_policy_wasm: (a: number, b: number) => number;
    readonly build_garden_url: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly build_optimistic_rose_wasm: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
    readonly build_plant_body: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => void;
    readonly burstFireworks: (a: number, b: number, c: number, d: number) => number;
    readonly color_emoji: (a: number, b: number, c: number) => void;
    readonly color_label: (a: number, b: number, c: number) => void;
    readonly color_options: () => number;
    readonly compute_layout: (a: number, b: number) => number;
    readonly compute_pagination: (a: number, b: number, c: number) => number;
    readonly compute_sky_params_wasm: (a: number) => number;
    readonly filter_roses: (a: number, b: number, c: number, d: number) => number;
    readonly format_date_wasm: (a: number, b: number) => number;
    readonly format_plant_request_wasm: (a: number, b: number, c: number) => void;
    readonly generate_petals_wasm: (a: number, b: bigint) => number;
    readonly generate_star_particles_wasm: (a: number, b: bigint) => number;
    readonly getFireworkLaunches: () => number;
    readonly get_tips_wasm: (a: number, b: number) => number;
    readonly parse_garden_response_wasm: (a: number, b: number) => number;
    readonly parse_rose_response_wasm: (a: number, b: number) => number;
    readonly recommend: (a: number, b: number) => number;
    readonly rose_to_sound_params_wasm: (a: number, b: number) => number;
    readonly store_dispatch: (a: number, b: number) => number;
    readonly store_get_snapshot: () => number;
    readonly validate_feedback_input: (a: number, b: number) => number;
    readonly validate_plant_input: (a: number, b: number) => number;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
