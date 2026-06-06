mod emotion;
mod flowers;
mod keywords;
mod offline;

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Debug, Deserialize)]
pub struct RoseInput {
    pub color: String,
    pub gratitude: Option<String>,
    pub anxiety: Option<String>,
    pub hope: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Recommendation {
    pub flower_language: flowers::FlowerLanguage,
    pub theme: flowers::ThemeSuggestion,
    pub color_suggestion: flowers::ColorSuggestion,
}

/// 正面情绪关键词
const POSITIVE_WORDS: &[&str] = &[
    "感恩", "感谢", "幸福", "快乐", "开心", "期待", "希望", "温暖", "美好", "幸运", "知足", "珍惜",
    "爱", "喜欢",
];

/// 负面情绪关键词
const NEGATIVE_WORDS: &[&str] = &[
    "焦虑", "压力", "疲惫", "担心", "难过", "失落", "迷茫", "孤独", "害怕", "不安", "烦恼", "失眠",
    "忙碌", "累",
];

fn analyze_positive_negative(roses: &[RoseInput]) -> (usize, usize) {
    let mut positive = 0;
    let mut negative = 0;

    for rose in roses {
        let texts: Vec<&str> =
            [rose.gratitude.as_deref(), rose.anxiety.as_deref(), rose.hope.as_deref()]
                .into_iter()
                .flatten()
                .collect();

        for text in &texts {
            for word in POSITIVE_WORDS {
                if text.contains(word) {
                    positive += 1;
                }
            }
            for word in NEGATIVE_WORDS {
                if text.contains(word) {
                    negative += 1;
                }
            }
        }
    }

    (positive, negative)
}

fn recommend_internal(roses: &[RoseInput]) -> Recommendation {
    // 收集所有文本
    let all_text: String = roses
        .iter()
        .flat_map(|r| [r.gratitude.as_deref(), r.anxiety.as_deref(), r.hope.as_deref()])
        .flatten()
        .collect::<Vec<&str>>()
        .join(" ");

    // 提取关键词类别
    let categories = keywords::extract_categories(&all_text);

    // 花语推荐
    let flower_language = flowers::recommend_flower_language(&categories);

    // 主题推荐
    let theme = flowers::recommend_theme(&categories);

    // 颜色推荐
    let (positive, negative) = analyze_positive_negative(roses);
    let color_suggestion = flowers::recommend_color(positive, negative);

    Recommendation {
        flower_language,
        theme,
        color_suggestion,
    }
}

/// WASM 入口：接收 JSON 字符串，返回推荐结果
#[wasm_bindgen]
pub fn recommend(roses_json: &str) -> JsValue {
    let roses: Vec<RoseInput> = match serde_json::from_str(roses_json) {
        Ok(r) => r,
        Err(_) => {
            let empty: Vec<RoseInput> = vec![];
            let result = recommend_internal(&empty);
            return serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL);
        }
    };

    let result = recommend_internal(&roses);
    serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
}

/// WASM 入口：分析一段文字，返回对应的示波器音乐参数
#[wasm_bindgen]
pub fn analyze_text(text: &str) -> JsValue {
    let result = emotion::analyze_text_internal(text);
    serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
}

mod api_client;
mod audio;
mod color;
mod datefmt;
mod fireworks;
mod garden;
mod petal;
mod plant;
mod sky;
mod store;

use garden::{GardenLayout, GardenState, RoseItem};

/// WASM: 根据屏幕参数和安全区计算卡片布局
#[wasm_bindgen]
pub fn compute_layout(screen_json: &str) -> JsValue {
    use garden::ScreenInfo;
    let info: ScreenInfo = serde_json::from_str(screen_json).unwrap_or(ScreenInfo {
        width: 375,
        height: 667,
        safe_area_top: 0,
        safe_area_bottom: 0,
        is_web: false,
    });
    let layout = GardenLayout::compute(&info);
    serde_wasm_bindgen::to_value(&layout).unwrap()
}

/// WASM: 过滤玫瑰列表，返回 JSON
#[wasm_bindgen]
pub fn filter_roses(roses_json: &str, color_filter: &str) -> JsValue {
    let mut state = GardenState::new();
    if let Ok(roses) = serde_json::from_str::<Vec<RoseItem>>(roses_json) {
        state.set_roses(roses);
    }
    state.set_filter(color_filter.to_string());
    let filtered = state.filtered();
    serde_wasm_bindgen::to_value(&filtered).unwrap()
}

/// WASM: 解析花圃 API 响应
#[wasm_bindgen]
pub fn parse_garden_response_wasm(json: &str) -> JsValue {
    use garden::parse_garden_response;
    match parse_garden_response(json) {
        Ok((items, total)) => {
            let result = serde_json::json!({ "items": items, "total": total });
            serde_wasm_bindgen::to_value(&result).unwrap()
        }
        Err(e) => serde_wasm_bindgen::to_value(
            &serde_json::json!({ "items": [], "total": 0, "error": e }),
        )
        .unwrap(),
    }
}

/// WASM: 解析单朵玫瑰响应
#[wasm_bindgen]
pub fn parse_rose_response_wasm(json: &str) -> JsValue {
    use garden::parse_rose_response;
    match parse_rose_response(json) {
        Ok(rose) => serde_wasm_bindgen::to_value(&rose).unwrap(),
        Err(e) => serde_wasm_bindgen::to_value(&serde_json::json!({ "error": e })).unwrap(),
    }
}

#[wasm_bindgen]
pub fn build_optimistic_rose_wasm(
    plant_body_json: &str,
    temp_id: &str,
    now_iso: &str,
    nickname: &str,
) -> JsValue {
    match offline::build_optimistic_rose(plant_body_json, temp_id, now_iso, nickname) {
        Ok(rose) => serde_wasm_bindgen::to_value(&rose).unwrap_or(JsValue::NULL),
        Err(e) => serde_wasm_bindgen::to_value(&serde_json::json!({ "error": e })).unwrap(),
    }
}

#[wasm_bindgen]
pub fn apply_garden_cache_action_wasm(cache_json: &str, action_json: &str) -> String {
    match offline::apply_cache_action(cache_json, action_json) {
        Ok(cache) => serde_json::to_string(&cache).unwrap_or_else(|_| "{}".into()),
        Err(e) => serde_json::json!({ "roses": [], "total": 0, "page": 1, "filter": "", "updated_at": "", "error": e }).to_string(),
    }
}

/// WASM: 统一日期格式化 — { full_cn, short_cn, iso, weekday_cn, relative }
#[wasm_bindgen]
pub fn format_date_wasm(iso_str: &str) -> JsValue {
    use datefmt::format_date;
    serde_wasm_bindgen::to_value(&format_date(iso_str)).unwrap()
}

/// WASM: 生成花瓣配置列表（确定性随机，同 seed 同结果）
#[wasm_bindgen]
pub fn generate_petals_wasm(count: u32, seed: u64) -> JsValue {
    use petal::generate_petals;
    serde_wasm_bindgen::to_value(&generate_petals(count, seed)).unwrap()
}

/// WASM: Rust API 客户端 — 构造 URL、请求体、分页计算
#[wasm_bindgen]
pub fn build_garden_url(base_url: &str, page: u32, per_page: u32, color: &str) -> String {
    let client = api_client::ApiClient::new(base_url.to_string());
    client.build_garden_url(
        page,
        per_page,
        if color.is_empty() { None } else { Some(color) },
    )
}

#[wasm_bindgen]
pub fn build_plant_body(
    color: &str,
    gratitude: &str,
    anxiety: &str,
    hope: &str,
    is_private: bool,
) -> String {
    let client = api_client::ApiClient::default();
    client.build_plant_body(
        color,
        if gratitude.is_empty() {
            None
        } else {
            Some(gratitude)
        },
        if anxiety.is_empty() {
            None
        } else {
            Some(anxiety)
        },
        if hope.is_empty() { None } else { Some(hope) },
        is_private,
    )
}

#[wasm_bindgen]
pub fn compute_pagination(total: u32, page: u32, per_page: u32) -> JsValue {
    let client = api_client::ApiClient::default();
    serde_wasm_bindgen::to_value(&client.compute_pagination(total, page, per_page)).unwrap()
}

use std::sync::Mutex;
use store::{Store, StoreAction};

static STORE: Mutex<Option<Store>> = Mutex::new(None);

fn get_store() -> std::sync::MutexGuard<'static, Option<Store>> {
    let mut guard = STORE.lock().unwrap();
    if guard.is_none() {
        *guard = Some(Store::new());
    }
    guard
}

/// WASM: 发送 Action 给 Rust 状态机，返回新快照
#[wasm_bindgen]
pub fn store_dispatch(action_json: &str) -> JsValue {
    let action: StoreAction = serde_json::from_str(action_json).unwrap_or(StoreAction::Reset);
    let mut guard = get_store();
    let store = guard.as_mut().unwrap();
    let snapshot = store.dispatch(action);
    serde_wasm_bindgen::to_value(&snapshot).unwrap()
}

/// WASM: 获取当前状态快照
#[wasm_bindgen]
pub fn store_get_snapshot() -> JsValue {
    let guard = get_store();
    let store = guard.as_ref().unwrap();
    serde_wasm_bindgen::to_value(&store.snapshot()).unwrap()
}

use plant::{PlantInput, format_plant_request, validate_plant};

/// 验证反馈内容
#[derive(Debug, Serialize, Deserialize)]
pub struct FeedbackInput {
    pub content: String,
}

/// 反馈验证结果
#[derive(Debug, Default, Serialize)]
pub struct FeedbackValidation {
    pub valid: bool,
    pub error: Option<String>,
}

fn validate_feedback_content(content: &str) -> FeedbackValidation {
    let mut validation = FeedbackValidation::default();
    let trimmed = content.trim();

    if trimmed.is_empty() {
        validation.error = Some("请输入反馈内容".to_string());
        return validation;
    }

    let char_count = trimmed.chars().count();
    if char_count < 5 {
        validation.error = Some("反馈内容至少需要 5 个字符".to_string());
        return validation;
    }

    if char_count > 500 {
        validation.error = Some("反馈内容不能超过 500 个字符".to_string());
        return validation;
    }

    validation.valid = true;
    validation
}

/// WASM: 验证种花表单，返回 JSON (Rust 侧统一校验规则)
#[wasm_bindgen]
pub fn validate_plant_input(json: &str) -> JsValue {
    let input: PlantInput = serde_json::from_str(json).unwrap_or(PlantInput {
        color: String::new(),
        gratitude: None,
        anxiety: None,
        hope: None,
    });
    let result = validate_plant(&input);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

/// WASM: 玫瑰属性 → 示波器音频参数（颜色/字段/长度/点赞 → fx/fy/waveform/baseFreq/phase/stroke/glow）
#[wasm_bindgen]
pub fn rose_to_sound_params_wasm(rose_json: &str) -> JsValue {
    let input: audio::RoseAudioInput =
        serde_json::from_str(rose_json).unwrap_or(audio::RoseAudioInput {
            color: "red".to_string(),
            gratitude: None,
            anxiety: None,
            hope: None,
            like_count: None,
        });
    serde_wasm_bindgen::to_value(&audio::rose_to_sound_params_internal(&input)).unwrap()
}

/// WASM: 根据小时(0-23)返回天空参数 — 梯度/星空/星云/时段标签
#[wasm_bindgen]
pub fn compute_sky_params_wasm(hour: u32) -> JsValue {
    serde_wasm_bindgen::to_value(&sky::compute_sky_params(hour)).unwrap()
}

/// WASM: 生成星尘粒子配置 — 确定性伪随机 left/delay/duration/size/opacity
#[derive(Debug, PartialEq, Serialize)]
struct StarParticle {
    left: f64,
    delay: f64,
    duration: f64,
    size: f64,
    opacity: f64,
}

fn generate_star_particles_internal(count: u32, seed: u64) -> Vec<StarParticle> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut particles = Vec::with_capacity(count as usize);
    let mut h = seed;

    for i in 0..count {
        let mut hasher = DefaultHasher::new();
        h.hash(&mut hasher);
        i.hash(&mut hasher);
        let hash = hasher.finish();

        let r1 = ((hash >> 16) & 0xFFFF) as f64 / 65535.0;
        let r2 = ((hash >> 32) & 0xFFFF) as f64 / 65535.0;
        let r3 = (hash & 0xFFFF) as f64 / 65535.0;
        let r4 = ((hash >> 48) as u8) as f64 / 255.0;
        let r5 = ((hash >> 40) as u8) as f64 / 255.0;

        particles.push(StarParticle {
            left: (r1 * 100.0 * 100.0).round() / 100.0,
            delay: (r2 * 10.0 * 100.0).round() / 100.0,
            duration: 15.0 + (r3 * 10.0 * 100.0).round() / 100.0,
            size: 1.0 + (r4 * 2.0 * 100.0).round() / 100.0,
            opacity: 0.15 + (r5 * 0.35 * 100.0).round() / 100.0,
        });

        h = hash.wrapping_add(1);
    }

    particles
}

#[wasm_bindgen]
pub fn generate_star_particles_wasm(count: u32, seed: u64) -> JsValue {
    serde_wasm_bindgen::to_value(&generate_star_particles_internal(count, seed)).unwrap()
}

/// WASM: 格式化种花请求，返回可直接 POST 的 JSON 字符串
#[wasm_bindgen]
pub fn format_plant_request_wasm(json: &str) -> String {
    let input: PlantInput = serde_json::from_str(json).unwrap_or(PlantInput {
        color: String::new(),
        gratitude: None,
        anxiety: None,
        hope: None,
    });
    format_plant_request(&input)
}

/// WASM: 验证反馈内容，返回 JSON (统一校验规则)
#[wasm_bindgen]
pub fn validate_feedback_input(json: &str) -> JsValue {
    let input: FeedbackInput = serde_json::from_str(json).unwrap_or(FeedbackInput {
        content: String::new(),
    });

    serde_wasm_bindgen::to_value(&validate_feedback_content(&input.content))
        .unwrap_or(JsValue::NULL)
}

// ── Fireworks WASM exports ──

pub use fireworks::FireworkParticle;

#[wasm_bindgen(js_name = burstFireworks)]
pub fn burst_fireworks_wasm(cx: f64, cy: f64, count: usize, id_offset: usize) -> JsValue {
    serde_wasm_bindgen::to_value(&fireworks::burst_js(cx, cy, count, id_offset)).unwrap()
}

#[wasm_bindgen(js_name = getFireworkLaunches)]
pub fn get_firework_launches_wasm() -> JsValue {
    serde_wasm_bindgen::to_value(&fireworks::get_launches()).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_roses() {
        let result = recommend_internal(&[]);
        assert_eq!(result.color_suggestion.color, "red");
    }

    #[test]
    fn test_gratitude_rose() {
        let roses = vec![RoseInput {
            color: "red".to_string(),
            gratitude: Some("感恩家人的陪伴".to_string()),
            anxiety: None,
            hope: None,
        }];
        let result = recommend_internal(&roses);
        assert_eq!(result.flower_language.title, "热烈的爱与感恩");
    }

    #[test]
    fn test_friendship_rose() {
        let roses = vec![RoseInput {
            color: "yellow".to_string(),
            gratitude: Some("和伙伴一起冒险".to_string()),
            anxiety: None,
            hope: None,
        }];
        let result = recommend_internal(&roses);
        assert_eq!(result.flower_language.title, "友谊长存");
    }

    #[test]
    fn test_work_stress() {
        let roses = vec![RoseInput {
            color: "red".to_string(),
            gratitude: None,
            anxiety: Some("工作压力很大".to_string()),
            hope: None,
        }];
        let result = recommend_internal(&roses);
        assert_eq!(result.flower_language.title, "奋斗的力量");
        assert_eq!(result.color_suggestion.color, "red");
    }

    #[test]
    fn test_positive_mood_suggests_yellow() {
        let roses = vec![
            RoseInput {
                color: "red".to_string(),
                gratitude: Some("感恩幸福的一天".to_string()),
                anxiety: None,
                hope: Some("期待明天".to_string()),
            },
            RoseInput {
                color: "yellow".to_string(),
                gratitude: Some("开心快乐".to_string()),
                anxiety: None,
                hope: None,
            },
        ];
        let result = recommend_internal(&roses);
        assert_eq!(result.color_suggestion.color, "yellow");
    }

    #[test]
    fn test_theme_suggestion_avoids_covered() {
        let roses = vec![RoseInput {
            color: "red".to_string(),
            gratitude: Some("感恩朋友".to_string()),
            anxiety: None,
            hope: None,
        }];
        let result = recommend_internal(&roses);
        // 已覆盖 gratitude 和 friendship，应推荐其他主题
        assert!(result.theme.category != "友情");
    }

    #[test]
    fn test_positive_negative_counts_multiple_fields() {
        let roses = vec![RoseInput {
            color: "red".to_string(),
            gratitude: Some("感恩幸福".to_string()),
            anxiety: Some("焦虑压力".to_string()),
            hope: Some("期待希望".to_string()),
        }];
        assert_eq!(analyze_positive_negative(&roses), (4, 2));
    }

    #[test]
    fn test_feedback_validation_empty() {
        let result = validate_feedback_content("   ");
        assert!(!result.valid);
        assert_eq!(result.error.as_deref(), Some("请输入反馈内容"));
    }

    #[test]
    fn test_feedback_validation_too_short() {
        let result = validate_feedback_content("四字");
        assert!(!result.valid);
        assert_eq!(result.error.as_deref(), Some("反馈内容至少需要 5 个字符"));
    }

    #[test]
    fn test_feedback_validation_too_long_uses_chars() {
        let result = validate_feedback_content(&"花".repeat(501));
        assert!(!result.valid);
        assert_eq!(result.error.as_deref(), Some("反馈内容不能超过 500 个字符"));
    }

    #[test]
    fn test_feedback_validation_valid() {
        let result = validate_feedback_content("这个反馈刚刚好");
        assert!(result.valid);
        assert!(result.error.is_none());
    }

    #[test]
    fn test_star_particles_empty() {
        assert!(generate_star_particles_internal(0, 42).is_empty());
    }

    #[test]
    fn test_star_particles_deterministic_and_in_range() {
        let first = generate_star_particles_internal(5, 42);
        let second = generate_star_particles_internal(5, 42);
        assert_eq!(first, second);
        for particle in first {
            assert!((0.0..=100.0).contains(&particle.left));
            assert!((0.0..=10.0).contains(&particle.delay));
            assert!((15.0..=25.0).contains(&particle.duration));
            assert!((1.0..=3.0).contains(&particle.size));
            assert!((0.15..=0.5).contains(&particle.opacity));
        }
    }
}
