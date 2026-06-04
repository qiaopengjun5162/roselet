use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct PlantInput {
    pub color: String,
    pub gratitude: Option<String>,
    pub anxiety: Option<String>,
    pub hope: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub error: Option<String>,
    /// 清理后的数据（trim + 空字段转 null）
    pub cleaned: Option<CleanedPlant>,
}

#[derive(Debug, Serialize)]
pub struct CleanedPlant {
    pub color: String,
    pub gratitude: Option<String>,
    pub anxiety: Option<String>,
    pub hope: Option<String>,
}

const VALID_COLORS: &[&str] = &["red", "white", "yellow"];
const MAX_FIELD_LEN: usize = 500;
const MAX_TOTAL_LEN: usize = 1500;

/// Rust 驱动的表单验证 —— 两端共享同一套规则
pub fn validate_plant(input: &PlantInput) -> ValidationResult {
    // 颜色校验
    if !VALID_COLORS.contains(&input.color.as_str()) {
        return ValidationResult {
            valid: false,
            error: Some("请选择有效的玫瑰颜色".into()),
            cleaned: None,
        };
    }

    // 至少填写一项
    let g = input.gratitude.as_deref().unwrap_or("").trim();
    let a = input.anxiety.as_deref().unwrap_or("").trim();
    let h = input.hope.as_deref().unwrap_or("").trim();
    if g.is_empty() && a.is_empty() && h.is_empty() {
        return ValidationResult {
            valid: false,
            error: Some("至少填写一项".into()),
            cleaned: None,
        };
    }

    // 长度校验
    if g.len() > MAX_FIELD_LEN || a.len() > MAX_FIELD_LEN || h.len() > MAX_FIELD_LEN {
        return ValidationResult {
            valid: false,
            error: Some(format!("每项最多 {} 字", MAX_FIELD_LEN)),
            cleaned: None,
        };
    }

    // 总长度校验
    if g.len() + a.len() + h.len() > MAX_TOTAL_LEN {
        return ValidationResult {
            valid: false,
            error: Some("总字数超过限制".into()),
            cleaned: None,
        };
    }

    // 空字节注入防御
    if g.contains('\x00') || a.contains('\x00') || h.contains('\x00') {
        return ValidationResult {
            valid: false,
            error: Some("内容含非法字符".into()),
            cleaned: None,
        };
    }

    ValidationResult {
        valid: true,
        error: None,
        cleaned: Some(CleanedPlant {
            color: input.color.clone(),
            gratitude: if g.is_empty() { None } else { Some(g.to_string()) },
            anxiety: if a.is_empty() { None } else { Some(a.to_string()) },
            hope: if h.is_empty() { None } else { Some(h.to_string()) },
        }),
    }
}

/// Rust 驱动的 API 数据格式化 —— 接受原始输入，返回可直接发送给后端的 JSON
pub fn format_plant_request(input: &PlantInput) -> String {
    let result = validate_plant(input);
    if let Some(cleaned) = result.cleaned {
        serde_json::to_string(&cleaned).unwrap_or_else(|_| "{}".into())
    } else {
        String::from("{}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_input() {
        let input = PlantInput {
            color: "red".into(),
            gratitude: Some("感谢阳光".into()),
            anxiety: None,
            hope: None,
        };
        let r = validate_plant(&input);
        assert!(r.valid);
        assert!(r.cleaned.is_some());
        let c = r.cleaned.unwrap();
        assert_eq!(c.gratitude.unwrap(), "感谢阳光");
    }

    #[test]
    fn test_empty_rejected() {
        let input = PlantInput { color: "red".into(), gratitude: None, anxiety: None, hope: None };
        let r = validate_plant(&input);
        assert!(!r.valid);
        assert_eq!(r.error.unwrap(), "至少填写一项");
    }

    #[test]
    fn test_invalid_color() {
        let input = PlantInput { color: "blue".into(), gratitude: Some("hi".into()), anxiety: None, hope: None };
        let r = validate_plant(&input);
        assert!(!r.valid);
    }

    #[test]
    fn test_trim_whitespace() {
        let input = PlantInput { color: "white".into(), gratitude: None, anxiety: Some("  焦虑  ".into()), hope: None };
        let r = validate_plant(&input);
        assert!(r.valid);
        assert_eq!(r.cleaned.unwrap().anxiety.unwrap(), "焦虑");
    }

    #[test]
    fn test_null_byte_rejected() {
        let input = PlantInput { color: "red".into(), gratitude: Some("hi\x00there".into()), anxiety: None, hope: None };
        let r = validate_plant(&input);
        assert!(!r.valid);
    }

    #[test]
    fn test_max_length() {
        let input = PlantInput {
            color: "yellow".into(),
            gratitude: Some("x".repeat(501)),
            anxiety: None, hope: None,
        };
        let r = validate_plant(&input);
        assert!(!r.valid);
    }

    #[test]
    fn test_format_plant_request() {
        let input = PlantInput { color: "red".into(), gratitude: Some("  hello  ".into()), anxiety: None, hope: Some("world".into()) };
        let json = format_plant_request(&input);
        assert!(json.contains("\"gratitude\":\"hello\""));
        assert!(json.contains("\"hope\":\"world\""));
        assert!(json.contains("\"anxiety\":null"));
    }
}
