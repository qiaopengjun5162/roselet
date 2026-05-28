use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub nickname: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub nickname: String,
}

impl RegisterRequest {
    pub fn validate(&self) -> Result<(), String> {
        let nick = self.nickname.trim();
        if nick.is_empty() {
            return Err("Nickname cannot be empty".to_string());
        }
        if nick.len() > 50 {
            return Err("Nickname too long (max 50 chars)".to_string());
        }
        Ok(())
    }
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: User,
}
