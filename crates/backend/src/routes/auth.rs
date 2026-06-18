use axum::Json;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use serde::Serialize;
use uuid::Uuid;

use crate::auth;
use crate::error::AppError;
use crate::models::user::{AuthResponse, RegisterRequest, User};
use crate::state::AppState;

fn hash_passphrase(p: &str) -> String {
    use argon2::{Argon2, PasswordHasher, password_hash::SaltString, password_hash::rand_core::OsRng};
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(p.as_bytes(), &salt)
        .expect("Argon2 hashing should not fail")
        .to_string()
}

fn verify_passphrase(p: &str, hash: &str) -> bool {
    use argon2::{Argon2, PasswordHash, PasswordVerifier};
    PasswordHash::new(hash)
        .ok()
        .and_then(|parsed| Argon2::default().verify_password(p.as_bytes(), &parsed).ok())
        .is_some()
}

pub async fn register(
    State(state): State<AppState>,
    Json(input): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<AuthResponse>), AppError> {
    input.validate().map_err(AppError::BadRequest)?;

    let nickname = input.nickname.trim().to_string();
    let passphrase = input.passphrase.as_deref().map(|p| p.trim()).filter(|p| !p.is_empty());

    // 查用户是否已存在
    #[derive(sqlx::FromRow)]
    struct UserAuth {
        id: Uuid,
        passphrase_hash: Option<String>,
    }

    let existing: Option<UserAuth> = sqlx::query_as::<_, UserAuth>(
        "SELECT id, passphrase_hash FROM users WHERE nickname = $1",
    )
    .bind(&nickname)
    .fetch_optional(&state.pool)
    .await?;

    let user = match existing {
        // 用户存在且有密码 → 必须验证密码（Argon2id 验证）
        Some(UserAuth { id, passphrase_hash: Some(stored_hash) }) => {
            let is_valid = passphrase.as_deref()
                .map(|p| verify_passphrase(p, &stored_hash))
                .unwrap_or(false);
            if !is_valid {
                return Err(AppError::Auth(
                    if passphrase.is_some() { "密码错误" } else { "该昵称已设置密码，请输入密码" }.into(),
                ));
            }
            sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
                .bind(id)
                .fetch_one(&state.pool)
                .await?
        }
        // 用户存在但无密码 → 如果提供了密码就设上，否则直接登录
        Some(UserAuth { id, passphrase_hash: None }) => {
            if let Some(ref p) = passphrase {
                sqlx::query("UPDATE users SET passphrase_hash = $1 WHERE id = $2")
                    .bind(hash_passphrase(p))
                    .bind(id)
                    .execute(&state.pool)
                    .await?;
            }
            sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
                .bind(id)
                .fetch_one(&state.pool)
                .await?
        }
        // 新用户
        None => {
            let hash = passphrase.as_deref().map(hash_passphrase);
            sqlx::query_as::<_, User>(
                "INSERT INTO users (nickname, passphrase_hash) VALUES ($1, $2) RETURNING *",
            )
            .bind(&nickname)
            .bind(&hash)
            .fetch_one(&state.pool)
            .await?
        }
    };

    let access_token = auth::create_access_token(user.id, &user.nickname, &state.jwt_secret)?;
    let refresh_token = auth::create_refresh_token(&state.pool, user.id).await?;

    Ok((
        StatusCode::CREATED,
        Json(AuthResponse {
            access_token,
            refresh_token,
            user,
        }),
    ))
}

#[derive(Debug, Serialize)]
pub struct UserProfile {
    pub user: User,
    pub total_roses: i64,
    pub red_count: i64,
    pub white_count: i64,
    pub yellow_count: i64,
}

pub async fn profile(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<UserProfile>, AppError> {
    let user_id = auth::extract_user_id(&headers, &state.jwt_secret)
        .ok_or_else(|| AppError::Auth("missing or invalid token".into()))?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;

    let (total_roses, red_count, white_count, yellow_count) = sqlx::query_as::<_, (i64, i64, i64, i64)>(
        "SELECT COUNT(*), COUNT(*) FILTER (WHERE color = 'red'), COUNT(*) FILTER (WHERE color = 'white'), COUNT(*) FILTER (WHERE color = 'yellow') FROM roses WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(UserProfile {
        user,
        total_roses,
        red_count,
        white_count,
        yellow_count,
    }))
}

#[derive(Debug, serde::Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct RefreshResponse {
    pub access_token: String,
}

pub async fn refresh(
    State(state): State<AppState>,
    Json(input): Json<RefreshRequest>,
) -> Result<Json<RefreshResponse>, AppError> {
    let user_id = auth::verify_refresh_token(&state.pool, &input.refresh_token)
        .await?
        .ok_or_else(|| AppError::Auth("invalid or expired refresh token".into()))?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;

    let access_token = auth::create_access_token(user.id, &user.nickname, &state.jwt_secret)?;

    Ok(Json(RefreshResponse { access_token }))
}

#[derive(Debug, Serialize)]
pub struct LogoutResponse {
    pub success: bool,
}

pub async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<LogoutResponse>, AppError> {
    let user_id = auth::extract_user_id(&headers, &state.jwt_secret)
        .ok_or(AppError::Auth("missing or invalid token".into()))?;

    auth::revoke_refresh_tokens(&state.pool, user_id).await?;

    Ok(Json(LogoutResponse { success: true }))
}
