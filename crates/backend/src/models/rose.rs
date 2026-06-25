use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rose {
    pub id: Uuid,
    pub color: String,
    pub gratitude: Option<String>,
    pub anxiety: Option<String>,
    pub hope: Option<String>,
    pub user_id: Option<Uuid>,
    pub ai_reply: Option<String>,
    pub is_private: bool,
    pub created_at: DateTime<Utc>,
    pub recipient_nickname: Option<String>,
    pub recipient_user_id: Option<Uuid>,
}

#[derive(Clone, Debug, Serialize)]
pub struct RoseResponse {
    pub id: Uuid,
    pub color: String,
    pub gratitude: Option<String>,
    pub anxiety: Option<String>,
    pub hope: Option<String>,
    pub user_id: Option<Uuid>,
    pub nickname: Option<String>,
    pub like_count: i64,
    pub ai_reply: Option<String>,
    pub is_private: bool,
    pub created_at: DateTime<Utc>,
    pub recipient_nickname: Option<String>,
    pub is_gift: bool,
}

impl RoseResponse {
    pub fn from_rose(rose: Rose, nickname: Option<String>, like_count: i64) -> Self {
        let is_gift = rose.recipient_nickname.is_some();
        Self {
            id: rose.id,
            color: rose.color,
            gratitude: rose.gratitude,
            anxiety: rose.anxiety,
            hope: rose.hope,
            user_id: rose.user_id,
            nickname,
            like_count,
            ai_reply: rose.ai_reply,
            is_private: rose.is_private,
            created_at: rose.created_at,
            recipient_nickname: rose.recipient_nickname,
            is_gift,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateRose {
    pub color: String,
    pub gratitude: Option<String>,
    pub anxiety: Option<String>,
    pub hope: Option<String>,
    pub is_private: Option<bool>,
    pub recipient_nickname: Option<String>,
}

impl CreateRose {
    pub fn validate(&self) -> Result<(), String> {
        let valid_colors = ["red", "white", "yellow"];
        if !valid_colors.contains(&self.color.as_str()) {
            return Err(format!(
                "Invalid color '{}'. Must be one of: {:?}",
                self.color, valid_colors
            ));
        }
        if self.gratitude.is_none() && self.anxiety.is_none() && self.hope.is_none() {
            return Err("At least one of gratitude, anxiety, or hope must be provided".to_string());
        }
        if let Some(ref text) = self.gratitude {
            if text.len() > 500 {
                return Err("Gratitude text too long (max 500 chars)".to_string());
            }
        }
        if let Some(ref text) = self.anxiety {
            if text.len() > 500 {
                return Err("Anxiety text too long (max 500 chars)".to_string());
            }
        }
        if let Some(ref text) = self.hope {
            if text.len() > 500 {
                return Err("Hope text too long (max 500 chars)".to_string());
            }
        }
        if let Some(ref nickname) = self.recipient_nickname {
            let trimmed = nickname.trim();
            if trimmed.is_empty() {
                return Err("Recipient nickname cannot be empty".to_string());
            }
            if trimmed.len() > 50 {
                return Err("Recipient nickname too long (max 50 chars)".to_string());
            }
        }
        Ok(())
    }
}

#[derive(Clone)]
pub struct UpdateRose {
    pub is_private: Option<bool>,
}

impl UpdateRose {
    pub fn validate(&self) -> Result<(), String> {
        match self.is_private {
            Some(true) => Ok(()),
            Some(false) => Err("私密玫瑰暂不支持重新公开".to_string()),
            None => Err("玫瑰内容种下后不能修改，只能更新玫瑰设置".to_string()),
        }
    }

    pub fn target_private(&self) -> Result<bool, String> {
        self.validate()?;
        match self.is_private {
            Some(true) => Ok(true),
            Some(false) => Err("私密玫瑰暂不支持重新公开".to_string()),
            None => Err("玫瑰内容种下后不能修改，只能更新玫瑰设置".to_string()),
        }
    }

    pub fn rejects_immutable_fields(raw: &serde_json::Value) -> bool {
        ["color", "gratitude", "anxiety", "hope"]
            .iter()
            .any(|field| raw.get(field).is_some())
    }
}

impl<'de> Deserialize<'de> for UpdateRose {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let raw = serde_json::Value::deserialize(deserializer)?;
        if Self::rejects_immutable_fields(&raw) {
            return Err(serde::de::Error::custom(
                "玫瑰内容种下后不能修改，只能更新玫瑰设置",
            ));
        }
        let is_private = match raw.get("is_private") {
            Some(value) => Some(
                value
                    .as_bool()
                    .ok_or_else(|| serde::de::Error::custom("is_private must be a boolean"))?,
            ),
            None => None,
        };
        Ok(Self { is_private })
    }
}

impl std::fmt::Debug for UpdateRose {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("UpdateRose").field("is_private", &self.is_private).finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_rose_valid() {
        let r = CreateRose {
            color: "red".into(),
            gratitude: Some("感谢".into()),
            anxiety: None,
            hope: None,
            is_private: None,
            recipient_nickname: None,
        };
        assert!(r.validate().is_ok());
    }
    #[test]
    fn test_create_rose_invalid_color() {
        let r = CreateRose {
            color: "blue".into(),
            gratitude: Some("test".into()),
            anxiety: None,
            hope: None,
            is_private: None,
            recipient_nickname: None,
        };
        assert!(r.validate().is_err());
    }
    #[test]
    fn test_create_rose_no_content() {
        let r = CreateRose {
            color: "red".into(),
            gratitude: None,
            anxiety: None,
            hope: None,
            is_private: None,
            recipient_nickname: None,
        };
        assert!(r.validate().is_err());
    }
    #[test]
    fn test_create_rose_max_length_gratitude() {
        let r = CreateRose {
            color: "red".into(),
            gratitude: Some("a".repeat(500)),
            anxiety: None,
            hope: None,
            is_private: None,
            recipient_nickname: None,
        };
        assert!(r.validate().is_ok());
    }
    #[test]
    fn test_create_rose_too_long_gratitude() {
        let r = CreateRose {
            color: "red".into(),
            gratitude: Some("a".repeat(501)),
            anxiety: None,
            hope: None,
            is_private: None,
            recipient_nickname: None,
        };
        assert!(r.validate().is_err());
    }
    #[test]
    fn test_create_rose_too_long_anxiety() {
        let r = CreateRose {
            color: "red".into(),
            gratitude: None,
            anxiety: Some("a".repeat(501)),
            hope: None,
            is_private: None,
            recipient_nickname: None,
        };
        assert!(r.validate().is_err());
    }
    #[test]
    fn test_create_rose_too_long_hope() {
        let r = CreateRose {
            color: "red".into(),
            gratitude: None,
            anxiety: None,
            hope: Some("a".repeat(501)),
            is_private: None,
            recipient_nickname: None,
        };
        assert!(r.validate().is_err());
    }

    #[test]
    fn test_update_rose_valid() {
        let r = UpdateRose {
            is_private: Some(true),
        };
        assert!(r.validate().is_ok());
    }

    #[test]
    fn test_update_rose_rejects_public_setting() {
        let r = UpdateRose {
            is_private: Some(false),
        };
        assert!(r.validate().is_err());
    }

    #[test]
    fn test_update_rose_requires_settings() {
        let r = UpdateRose { is_private: None };
        assert!(r.validate().is_err());
    }

    #[test]
    fn test_update_rose_rejects_immutable_fields() {
        let raw = serde_json::json!({ "gratitude": "改掉过去" });
        assert!(UpdateRose::rejects_immutable_fields(&raw));
    }

    #[test]
    fn test_update_rose_deserialize_rejects_content_changes() {
        let raw = serde_json::json!({ "color": "white", "gratitude": "改掉过去" });
        let parsed = serde_json::from_value::<UpdateRose>(raw);
        assert!(parsed.is_err());
    }

    #[test]
    fn test_update_rose_deserialize_accepts_private_setting() {
        let parsed: UpdateRose = serde_json::from_value(serde_json::json!({
            "is_private": true
        }))
        .unwrap();
        assert!(parsed.target_private().unwrap());
    }
}
