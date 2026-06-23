use axum::http::HeaderMap;
use chrono::{DateTime, Duration, Utc};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub nickname: String,
    pub exp: usize,
}

pub const ACCOUNT_DELETION_COOLDOWN_DAYS: i64 = 30;

// ── Access Token (短生命周期 15min) ──

pub fn create_access_token(
    user_id: Uuid,
    nickname: &str,
    secret: &[u8],
) -> Result<String, AppError> {
    let exp = (Utc::now() + Duration::minutes(15)).timestamp() as usize;
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

// ── Refresh Token (长生命周期 7天，存 DB) ──

fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub async fn create_refresh_token(pool: &PgPool, user_id: Uuid) -> Result<String, AppError> {
    let token = Uuid::new_v4().to_string();
    let hash = hash_token(&token);
    let expires = Utc::now() + Duration::days(30);

    sqlx::query("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)")
        .bind(user_id)
        .bind(&hash)
        .bind(expires)
        .execute(pool)
        .await?;

    Ok(token)
}

pub async fn verify_refresh_token(pool: &PgPool, token: &str) -> Result<Option<Uuid>, AppError> {
    let hash = hash_token(token);
    let user_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT user_id FROM refresh_tokens WHERE token_hash = $1 AND revoked = false AND expires_at > now() LIMIT 1"
    )
    .bind(&hash)
    .fetch_optional(pool)
    .await?;

    Ok(user_id)
}

pub async fn revoke_refresh_tokens(pool: &PgPool, user_id: Uuid) -> Result<(), AppError> {
    sqlx::query("UPDATE refresh_tokens SET revoked = true WHERE user_id = $1")
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn revoke_refresh_token_by_value(pool: &PgPool, token: &str) -> Result<bool, AppError> {
    let hash = hash_token(token);
    let result = sqlx::query("UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1")
        .bind(&hash)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

// ── 提取用户 ID ──

pub fn extract_user_id(headers: &HeaderMap, secret: &[u8]) -> Option<Uuid> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|token| token.strip_prefix("Bearer "))
        .and_then(|t| verify_token(t, secret))
        .map(|claims| claims.sub)
}

pub async fn get_active_user_id(
    pool: &PgPool,
    headers: &HeaderMap,
    secret: &[u8],
) -> Result<Option<Uuid>, AppError> {
    let user_id = match extract_user_id(headers, secret) {
        Some(user_id) => user_id,
        None => return Ok(None),
    };

    let is_active = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL)",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(is_active.then_some(user_id))
}

pub async fn require_active_user_id(
    pool: &PgPool,
    headers: &HeaderMap,
    secret: &[u8],
) -> Result<Uuid, AppError> {
    get_active_user_id(pool, headers, secret)
        .await?
        .ok_or_else(|| AppError::Auth("missing or invalid token".into()))
}

pub fn deletion_restore_deadline(deleted_at: DateTime<Utc>) -> DateTime<Utc> {
    deleted_at + Duration::days(ACCOUNT_DELETION_COOLDOWN_DAYS)
}

pub fn deletion_is_restorable(deleted_at: DateTime<Utc>, now: DateTime<Utc>) -> bool {
    deletion_restore_deadline(deleted_at) > now
}

pub async fn finalize_deleted_user(pool: &PgPool, user_id: Uuid) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE users
         SET nickname = CONCAT('匿名用户-', LEFT(id::text, 8)),
             passphrase_hash = NULL
         WHERE id = $1 AND deleted_at IS NOT NULL",
    )
    .bind(user_id)
    .execute(pool)
    .await?;

    revoke_refresh_tokens(pool, user_id).await
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SECRET: &[u8] = b"test-secret-key-32-bytes-long!";

    #[test]
    fn test_create_and_verify_token() {
        let token = create_access_token(Uuid::nil(), "alice", TEST_SECRET).unwrap();
        let claims = verify_token(&token, TEST_SECRET).unwrap();
        assert_eq!(claims.nickname, "alice");
    }

    #[test]
    fn test_verify_token_wrong_secret() {
        let token = create_access_token(Uuid::nil(), "alice", TEST_SECRET).unwrap();
        assert!(verify_token(&token, b"wrong-secret").is_none());
    }

    #[test]
    fn test_verify_token_malformed() {
        assert!(verify_token("not-a-jwt", TEST_SECRET).is_none());
    }

    #[test]
    fn test_verify_token_empty() {
        assert!(verify_token("", TEST_SECRET).is_none());
    }

    #[test]
    fn test_hash_token_deterministic() {
        assert_eq!(hash_token("test123"), hash_token("test123"));
    }

    #[test]
    fn test_hash_token_different() {
        assert_ne!(hash_token("abc"), hash_token("def"));
    }

    #[test]
    fn test_deletion_restore_deadline() {
        let deleted_at = DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        assert_eq!(
            deletion_restore_deadline(deleted_at),
            DateTime::parse_from_rfc3339("2026-01-31T00:00:00Z")
                .unwrap()
                .with_timezone(&Utc)
        );
    }

    #[test]
    fn test_deletion_is_restorable() {
        let deleted_at = DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let before_deadline = DateTime::parse_from_rfc3339("2026-01-30T23:59:59Z")
            .unwrap()
            .with_timezone(&Utc);
        let at_deadline = DateTime::parse_from_rfc3339("2026-01-31T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        assert!(deletion_is_restorable(deleted_at, before_deadline));
        assert!(!deletion_is_restorable(deleted_at, at_deadline));
    }
}
