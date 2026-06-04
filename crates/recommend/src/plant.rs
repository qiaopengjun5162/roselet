use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct PlantInput {
    pub color: String,
    pub gratitude: Option<String>,
    pub anxiety: Option<String>,
    pub hope: Option<String>,
}

/// 校验错误枚举 — 跨端统一错误码
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ValidationError {
    InvalidColor,
    EmptyContent,
    FieldTooLong { max: usize },
    TotalTooLong { max: usize },
    NullByteInjection,
}

impl ValidationError {
    /// 错误码 → 中文提示
    pub fn message(&self) -> &'static str {
        match self {
            Self::InvalidColor => "请选择有效的玫瑰颜色",
            Self::EmptyContent => "至少填写一项",
            Self::FieldTooLong { max } => "单项超过字数限制",
            Self::TotalTooLong { max } => "总字数超过限制",
            Self::NullByteInjection => "内容含非法字符",
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ValidationError>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cleaned: Option<CleanedPlant>,
}

#[derive(Debug, Serialize)]
pub struct CleanedPlant {
    pub color: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gratitude: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anxiety: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hope: Option<String>,
}

const VALID_COLORS: &[&str] = &["red", "white", "yellow"];
const MAX_FIELD_LEN: usize = 500;
const MAX_TOTAL_LEN: usize = 1500;

/// Rust 驱动的表单验证 —— 返回类型化错误码，前端可做 i18n 映射
pub fn validate_plant(input: &PlantInput) -> ValidationResult {
    if !VALID_COLORS.contains(&input.color.as_str()) {
        return ValidationResult {
            valid: false,
            error: Some(ValidationError::InvalidColor),
            cleaned: None,
        };
    }

    let g = input.gratitude.as_deref().unwrap_or("").trim();
    let a = input.anxiety.as_deref().unwrap_or("").trim();
    let h = input.hope.as_deref().unwrap_or("").trim();

    if g.is_empty() && a.is_empty() && h.is_empty() {
        return ValidationResult {
            valid: false,
            error: Some(ValidationError::EmptyContent),
            cleaned: None,
        };
    }

    if g.len() > MAX_FIELD_LEN || a.len() > MAX_FIELD_LEN || h.len() > MAX_FIELD_LEN {
        return ValidationResult {
            valid: false,
            error: Some(ValidationError::FieldTooLong { max: MAX_FIELD_LEN }),
            cleaned: None,
        };
    }

    if g.len() + a.len() + h.len() > MAX_TOTAL_LEN {
        return ValidationResult {
            valid: false,
            error: Some(ValidationError::TotalTooLong { max: MAX_TOTAL_LEN }),
            cleaned: None,
        };
    }

    if g.contains('\x00') || a.contains('\x00') || h.contains('\x00') {
        return ValidationResult {
            valid: false,
            error: Some(ValidationError::NullByteInjection),
            cleaned: None,
        };
    }

    ValidationResult {
        valid: true,
        error: None,
        cleaned: Some(CleanedPlant {
            color: input.color.clone(),
            gratitude: if g.is_empty() {
                None
            } else {
                Some(g.to_string())
            },
            anxiety: if a.is_empty() {
                None
            } else {
                Some(a.to_string())
            },
            hope: if h.is_empty() {
                None
            } else {
                Some(h.to_string())
            },
        }),
    }
}

/// Rust 驱动的 API 数据格式化
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
        assert_eq!(r.cleaned.unwrap().gratitude.unwrap(), "感谢阳光");
    }

    #[test]
    fn test_empty_rejected() {
        let input = PlantInput {
            color: "red".into(),
            gratitude: None,
            anxiety: None,
            hope: None,
        };
        let r = validate_plant(&input);
        assert!(!r.valid);
        assert_eq!(r.error.unwrap(), ValidationError::EmptyContent);
    }

    #[test]
    fn test_invalid_color() {
        let input = PlantInput {
            color: "blue".into(),
            gratitude: Some("hi".into()),
            anxiety: None,
            hope: None,
        };
        assert_eq!(
            validate_plant(&input).error.unwrap(),
            ValidationError::InvalidColor
        );
    }

    #[test]
    fn test_trim_whitespace() {
        let input = PlantInput {
            color: "white".into(),
            gratitude: None,
            anxiety: Some("  焦虑  ".into()),
            hope: None,
        };
        let r = validate_plant(&input);
        assert!(r.valid);
        assert_eq!(r.cleaned.unwrap().anxiety.unwrap(), "焦虑");
    }

    #[test]
    fn test_null_byte_rejected() {
        let input = PlantInput {
            color: "red".into(),
            gratitude: Some("hi\x00there".into()),
            anxiety: None,
            hope: None,
        };
        assert_eq!(
            validate_plant(&input).error.unwrap(),
            ValidationError::NullByteInjection
        );
    }

    #[test]
    fn test_max_length() {
        let input = PlantInput {
            color: "yellow".into(),
            gratitude: Some("x".repeat(501)),
            anxiety: None,
            hope: None,
        };
        assert!(!validate_plant(&input).valid);
    }

    #[test]
    fn test_format_plant_request() {
        let input = PlantInput {
            color: "red".into(),
            gratitude: Some("  hello  ".into()),
            anxiety: None,
            hope: Some("world".into()),
        };
        let json = format_plant_request(&input);
        assert!(json.contains("\"gratitude\":\"hello\""));
        assert!(json.contains("\"hope\":\"world\""));
    }

    #[test]
    fn test_error_message_chinese() {
        assert_eq!(ValidationError::EmptyContent.message(), "至少填写一项");
        assert_eq!(
            ValidationError::InvalidColor.message(),
            "请选择有效的玫瑰颜色"
        );
    }
}
