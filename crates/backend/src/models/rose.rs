use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// 玫瑰数据模型
#[derive(Clone, Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rose {
    pub id: Uuid,
    pub color: String,
    pub gratitude: Option<String>,
    pub anxiety: Option<String>,
    pub hope: Option<String>,
    pub user_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// 玫瑰 API 响应（包含种植者昵称）
#[derive(Clone, Debug, Serialize)]
pub struct RoseResponse {
    pub id: Uuid,
    pub color: String,
    pub gratitude: Option<String>,
    pub anxiety: Option<String>,
    pub hope: Option<String>,
    pub user_id: Option<Uuid>,
    pub nickname: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl RoseResponse {
    pub fn from_rose(rose: Rose, nickname: Option<String>) -> Self {
        Self {
            id: rose.id,
            color: rose.color,
            gratitude: rose.gratitude,
            anxiety: rose.anxiety,
            hope: rose.hope,
            user_id: rose.user_id,
            nickname,
            created_at: rose.created_at,
        }
    }
}

/// 创建玫瑰请求
#[derive(Debug, Deserialize)]
pub struct CreateRose {
    pub color: String,
    pub gratitude: Option<String>,
    pub anxiety: Option<String>,
    pub hope: Option<String>,
}

impl CreateRose {
    /// 验证输入数据
    pub fn validate(&self) -> Result<(), String> {
        let valid_colors = ["red", "white", "yellow"];
        if !valid_colors.contains(&self.color.as_str()) {
            return Err(format!(
                "Invalid color '{}'. Must be one of: {:?}",
                self.color, valid_colors
            ));
        }

        // 至少需要填写一项内容
        if self.gratitude.is_none() && self.anxiety.is_none() && self.hope.is_none() {
            return Err("At least one of gratitude, anxiety, or hope must be provided".to_string());
        }

        // 验证内容长度
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

        Ok(())
    }
}

/// 编辑玫瑰请求
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
