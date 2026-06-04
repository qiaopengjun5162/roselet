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
