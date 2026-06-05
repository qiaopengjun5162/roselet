mod emotion;
mod flowers;
mod keywords;

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
mod garden;
mod petal;
mod plant;
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
pub fn build_plant_body(color: &str, gratitude: &str, anxiety: &str, hope: &str) -> String {
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
#[derive(Debug, Serialize)]
pub struct FeedbackValidation {
    pub valid: bool,
    pub error: Option<String>,
}

impl Default for FeedbackValidation {
    fn default() -> Self {
        Self {
            valid: false,
            error: None,
        }
    }
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

    let mut validation = FeedbackValidation::default();

    // 验证逻辑
    let trimmed = input.content.trim();

    if trimmed.is_empty() {
        validation.error = Some("请输入反馈内容".to_string());
        return serde_wasm_bindgen::to_value(&validation).unwrap_or(JsValue::NULL);
    }

    if trimmed.len() < 5 {
        validation.error = Some("反馈内容至少需要 5 个字符".to_string());
        return serde_wasm_bindgen::to_value(&validation).unwrap_or(JsValue::NULL);
    }

    if trimmed.len() > 500 {
        validation.error = Some("反馈内容不能超过 500 个字符".to_string());
        return serde_wasm_bindgen::to_value(&validation).unwrap_or(JsValue::NULL);
    }

    validation.valid = true;
    serde_wasm_bindgen::to_value(&validation).unwrap_or(JsValue::NULL)
}

/// WASM: 处理文本内容（清理、截断等）
#[wasm_bindgen]
pub fn process_text_content(original: &str, max_length: Option<u32>) -> JsValue {
    let mut cleaned = original.trim().to_string();
    let original_len = cleaned.len();

    // 处理最大长度限制
    if let Some(max) = max_length {
        if cleaned.len() > max as usize {
            cleaned = cleaned.chars().take(max as usize).collect();
        }
    }

    let result = serde_json::json!({
        "original": original,
        "cleaned": cleaned,
        "original_length": original_len,
        "cleaned_length": cleaned.len(),
        "is_empty": cleaned.is_empty(),
        "truncated": max_length.is_some() && original_len != cleaned.len()
    });

    match serde_wasm_bindgen::to_value(&result) {
        Ok(value) => value,
        Err(_) => JsValue::NULL,
    }
}

/// WASM: 检查字符串是否包含敏感词（简单版本）
#[wasm_bindgen]
pub fn check_sensitive_words(text: &str, sensitive_words: JsValue) -> JsValue {
    let sensitive_words: Vec<String> = match serde_wasm_bindgen::from_value(sensitive_words) {
        Ok(words) => words,
        Err(_) => return JsValue::NULL,
    };

    let mut found_words = Vec::new();

    for word in &sensitive_words {
        if text.contains(word) {
            found_words.push(word.to_string());
        }
    }

    let result = serde_json::json!({
        "has_sensitive": !found_words.is_empty(),
        "found_words": found_words,
        "count": found_words.len()
    });

    match serde_wasm_bindgen::to_value(&result) {
        Ok(value) => value,
        Err(_) => JsValue::NULL,
    }
}

/// WASM: 字符串规范化（统一大小写、去除特殊字符）
#[wasm_bindgen]
pub fn normalize_string(text: &str, to_lowercase: bool) -> JsValue {
    let mut normalized = text.trim().to_string();

    if to_lowercase {
        normalized = normalized.to_lowercase();
    } else {
        normalized = normalized.to_uppercase();
    }

    // 去除常见特殊字符（保留中文字符）
    let re = regex::Regex::new(r"[^\w一-龥]");
    let normalized = match re {
        Ok(re) => re.replace_all(&normalized, "").to_string(),
        Err(_) => normalized,
    };

    let result = serde_json::json!({
        "original": text,
        "normalized": normalized,
        "length": normalized.len(),
        "is_empty": normalized.is_empty()
    });

    match serde_wasm_bindgen::to_value(&result) {
        Ok(value) => value,
        Err(_) => JsValue::NULL,
    }
}

/// WASM: 字符串验证（检查是否符合特定格式）
#[wasm_bindgen]
pub fn validate_string_format(text: &str, pattern: &str) -> JsValue {
    let re = regex::Regex::new(pattern);
    let is_match = match re {
        Ok(ref re) => re.is_match(text),
        Err(_) => false,
    };

    let matches = if is_match {
        re.as_ref().map(|re| re.captures(text))
            .map(|c| {
                let mut results = Vec::new();
                if let Some(c) = c {
                    for i in 0..c.len() {
                        if let Some(mat) = c.get(i) {
                            results.push(mat.as_str().to_string());
                        }
                    }
                }
                results
            })
            .unwrap_or(vec![])
    } else {
        vec![]
    };

    let result = serde_json::json!({
        "text": text,
        "pattern": pattern,
        "is_valid": is_match,
        "matches": matches
    });

    match serde_wasm_bindgen::to_value(&result) {
        Ok(value) => value,
        Err(_) => JsValue::NULL,
    }
}

/// WASM: 字符串分割
#[wasm_bindgen]
pub fn split_string(text: &str, delimiter: &str) -> JsValue {
    let parts: Vec<String> = text.split(delimiter).map(|s| s.to_string()).collect();

    let result = serde_json::json!({
        "original": text,
        "delimiter": delimiter,
        "parts": parts,
        "count": parts.len()
    });

    match serde_wasm_bindgen::to_value(&result) {
        Ok(value) => value,
        Err(_) => JsValue::NULL,
    }
}

/// WASM: 字符串统计信息
#[wasm_bindgen]
pub fn string_statistics(text: &str) -> JsValue {
    let char_count = text.chars().count();
    let word_count = text.split_whitespace().count();
    let line_count = text.lines().count();
    let byte_count = text.len();

    let result = serde_json::json!({
        "text": text,
        "char_count": char_count,
        "word_count": word_count,
        "line_count": line_count,
        "byte_count": byte_count,
        "is_empty": text.trim().is_empty()
    });

    match serde_wasm_bindgen::to_value(&result) {
        Ok(value) => value,
        Err(_) => JsValue::NULL,
    }
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
}
