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
    }

    #[test]
    fn test_options_count() {
        assert_eq!(COLORS.len(), 3);
    }
}
