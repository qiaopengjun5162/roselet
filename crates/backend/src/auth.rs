use chrono::{Duration, Utc};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub nickname: String,
    pub exp: usize,
}

pub fn create_token(user_id: Uuid, nickname: &str, secret: &[u8]) -> Result<String, AppError> {
    let exp = (Utc::now() + Duration::days(30)).timestamp() as usize;
    let claims = Claims {
        sub: user_id,
        nickname: nickname.to_string(),
        exp,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret),
    )
    .map_err(|e| AppError::Auth(e.to_string()))
}

pub fn verify_token(token: &str, secret: &[u8]) -> Option<Claims> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret),
        &Validation::default(),
    )
    .ok()
    .map(|data| data.claims)
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SECRET: &[u8] = b"test-secret";

    #[test]
    fn test_create_and_verify_token() {
        let user_id = Uuid::nil();
        let token = create_token(user_id, "alice", TEST_SECRET).unwrap();
        let claims = verify_token(&token, TEST_SECRET).unwrap();
        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.nickname, "alice");
    }

    #[test]
    fn test_verify_token_wrong_secret() {
        let user_id = Uuid::nil();
        let token = create_token(user_id, "alice", TEST_SECRET).unwrap();
        let result = verify_token(&token, b"wrong-secret");
        assert!(result.is_none());
    }

    #[test]
    fn test_verify_token_malformed() {
        let result = verify_token("not-a-jwt-token", TEST_SECRET);
        assert!(result.is_none());
    }

    #[test]
    fn test_verify_token_empty() {
        let result = verify_token("", TEST_SECRET);
        assert!(result.is_none());
    }
}
