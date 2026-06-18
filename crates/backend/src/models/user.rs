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
    pub passphrase: Option<String>,
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
        if let Some(ref p) = self.passphrase {
            let trimmed = p.trim();
            if trimmed.is_empty() {
                return Err("Passphrase cannot be empty if provided".to_string());
            }
            if trimmed.len() < 4 {
                return Err("Passphrase must be at least 4 characters".to_string());
            }
            if trimmed.len() > 100 {
                return Err("Passphrase too long (max 100 chars)".to_string());
            }
        }
        Ok(())
    }
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub user: User,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_valid() {
        let r = RegisterRequest {
            nickname: "alice".to_string(),
            passphrase: None,
        };
        assert!(r.validate().is_ok());
    }

    #[test]
    fn test_validate_empty() {
        let r = RegisterRequest {
            nickname: "".to_string(),
            passphrase: None,
        };
        assert!(r.validate().is_err());
    }

    #[test]
    fn test_validate_whitespace_only() {
        let r = RegisterRequest {
            nickname: "   ".to_string(),
            passphrase: None,
        };
        assert!(r.validate().is_err());
    }

    #[test]
    fn test_validate_max_length() {
        let r = RegisterRequest {
            nickname: "a".repeat(50),
            passphrase: None,
        };
        assert!(r.validate().is_ok());
    }

    #[test]
    fn test_validate_too_long() {
        let r = RegisterRequest {
            nickname: "a".repeat(51),
            passphrase: None,
        };
        assert!(r.validate().is_err());
    }

    #[test]
    fn test_validate_trimmed() {
        let r = RegisterRequest {
            nickname: " alice ".to_string(),
            passphrase: None,
        };
        assert!(r.validate().is_ok());
    }
}
