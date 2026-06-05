use serde::Serialize;
use wasm_bindgen::prelude::*;

#[derive(Serialize)]
pub struct ColorMeta {
    pub id: &'static str,
    pub label: &'static str,
    pub emoji: &'static str,
}

const COLORS: &[ColorMeta] = &[
    ColorMeta {
        id: "red",
        label: "红玫瑰",
        emoji: "🌹",
    },
    ColorMeta {
        id: "white",
        label: "白玫瑰",
        emoji: "🤍",
    },
    ColorMeta {
        id: "yellow",
        label: "黄玫瑰",
        emoji: "💛",
    },
];

fn find(color: &str) -> &'static ColorMeta {
    COLORS.iter().find(|c| c.id == color).unwrap_or(&COLORS[0])
}

#[wasm_bindgen]
pub fn color_emoji(color: &str) -> String {
    find(color).emoji.to_string()
}

#[wasm_bindgen]
pub fn color_label(color: &str) -> String {
    find(color).label.to_string()
}

#[wasm_bindgen]
pub fn color_options() -> JsValue {
    serde_wasm_bindgen::to_value(COLORS).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_known_colors() {
        assert_eq!(find("red").emoji, "🌹");
        assert_eq!(find("white").emoji, "🤍");
        assert_eq!(find("yellow").emoji, "💛");
        assert_eq!(find("red").label, "红玫瑰");
    }

    #[test]
    fn test_unknown_falls_back_to_red() {
        assert_eq!(find("purple").emoji, "🌹");
        assert_eq!(find("blue").emoji, "🌹");
        assert_eq!(find("green").emoji, "🌹");
    }

    #[test]
    fn test_empty_string_falls_back_to_red() {
        let meta = find("");
        assert_eq!(meta.id, "red");
        assert_eq!(meta.emoji, "🌹");
    }

    #[test]
    fn test_whitespace_falls_back() {
        assert_eq!(find("  ").id, "red");
    }

    #[test]
    fn test_case_sensitive() {
        assert_eq!(find("Red").id, "red");
        assert_eq!(find("RED").id, "red");
    }

    #[test]
    fn test_find_returns_static_reference() {
        let a = find("red");
        let b = find("red");
        // 两个调用返回同一个静态引用
        assert_eq!(a as *const ColorMeta, b as *const ColorMeta);
    }

    #[test]
    fn test_options_count() {
        assert_eq!(COLORS.len(), 3);
    }

    #[test]
    fn test_color_emoji_export() {
        assert_eq!(color_emoji("red"), "🌹");
        assert_eq!(color_emoji("white"), "🤍");
        assert_eq!(color_emoji("yellow"), "💛");
        assert_eq!(color_emoji("purple"), "🌹");
        assert_eq!(color_emoji(""), "🌹");
    }

    #[test]
    fn test_color_label_export() {
        assert_eq!(color_label("red"), "红玫瑰");
        assert_eq!(color_label("white"), "白玫瑰");
        assert_eq!(color_label("yellow"), "黄玫瑰");
        assert_eq!(color_label("purple"), "红玫瑰");
        assert_eq!(color_label(""), "红玫瑰");
    }

    #[test]
    fn test_color_options_data_integrity() {
        // 通过 serde_json 校验 COLORS 数据完整性（绕过 serde_wasm_bindgen）
        let json = serde_json::to_value(COLORS).unwrap();
        let arr = json.as_array().unwrap();
        assert_eq!(arr.len(), 3);
        for item in arr {
            assert!(item["id"].as_str().is_some());
            assert!(item["label"].as_str().is_some());
            assert!(item["emoji"].as_str().is_some());
        }
        let ids: Vec<&str> = arr.iter().map(|v| v["id"].as_str().unwrap()).collect();
        assert!(ids.contains(&"red"));
        assert!(ids.contains(&"white"));
        assert!(ids.contains(&"yellow"));
    }

    #[test]
    fn test_color_meta_serialization() {
        let meta = ColorMeta {
            id: "test",
            label: "测试",
            emoji: "🧪",
        };
        let json = serde_json::to_string(&meta).unwrap();
        assert!(json.contains("\"id\":\"test\""));
        assert!(json.contains("\"label\":\"测试\""));
        assert!(json.contains("\"emoji\":\"🧪\""));
    }
}
