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

#[derive(Debug, Deserialize)]
pub struct UpdateRose {
    pub color: Option<String>,
    pub gratitude: Option<Option<String>>,
    pub anxiety: Option<Option<String>>,
    pub hope: Option<Option<String>>,
}

impl UpdateRose {
    pub fn validate(&self) -> Result<(), String> {
        if let Some(ref color) = self.color {
            let valid_colors = ["red", "white", "yellow"];
            if !valid_colors.contains(&color.as_str()) {
                return Err(format!(
                    "Invalid color '{}'. Must be one of: {:?}",
                    color, valid_colors
                ));
            }
        }
        if let Some(Some(ref text)) = self.gratitude {
            if text.len() > 500 {
                return Err("Gratitude text too long (max 500 chars)".to_string());
            }
        }
        if let Some(Some(ref text)) = self.anxiety {
            if text.len() > 500 {
                return Err("Anxiety text too long (max 500 chars)".to_string());
            }
        }
        if let Some(Some(ref text)) = self.hope {
            if text.len() > 500 {
                return Err("Hope text too long (max 500 chars)".to_string());
            }
        }
        Ok(())
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
            color: Some("white".to_string()),
            gratitude: None,
            anxiety: None,
            hope: None,
        };
        assert!(r.validate().is_ok());
    }

    #[test]
    fn test_update_rose_invalid_color() {
        let r = UpdateRose {
            color: Some("green".to_string()),
            gratitude: None,
            anxiety: None,
            hope: None,
        };
        assert!(r.validate().is_err());
    }

    #[test]
    fn test_update_rose_too_long() {
        let r = UpdateRose {
            color: None,
            gratitude: Some(Some("a".repeat(501))),
            anxiety: None,
            hope: None,
        };
        assert!(r.validate().is_err());
    }

    #[test]
    fn test_update_rose_clear_field() {
        let r = UpdateRose {
            color: None,
            gratitude: Some(None),
            anxiety: None,
            hope: None,
        };
        assert!(r.validate().is_ok());
    }
}
