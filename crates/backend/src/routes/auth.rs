use axum::Json;
use axum::extract::State;
use axum::http::HeaderMap;
use serde::Serialize;

use crate::auth;
use crate::error::AppError;
use crate::models::user::{AuthResponse, RegisterRequest, User};
use crate::state::AppState;

pub async fn register(
    State(state): State<AppState>,
    Json(input): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    input.validate().map_err(AppError::BadRequest)?;

    let nickname = input.nickname.trim().to_string();

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (nickname) VALUES ($1) ON CONFLICT (nickname) DO UPDATE SET nickname = EXCLUDED.nickname RETURNING *",
    )
    .bind(&nickname)
    .fetch_one(&state.pool)
    .await?;

    let token = auth::create_token(user.id, &user.nickname, &state.jwt_secret)?;

    Ok(Json(AuthResponse { token, user }))
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
    let user_id = auth::extract_user_id(&headers, &state.jwt_secret).ok_or(AppError::Forbidden)?;

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
