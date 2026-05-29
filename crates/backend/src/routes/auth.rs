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
    let user_id = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|token| token.strip_prefix("Bearer "))
        .and_then(|t| auth::verify_token(t, &state.jwt_secret))
        .map(|claims| claims.sub)
        .ok_or(AppError::Forbidden)?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;

    let total_roses: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM roses WHERE user_id = $1")
        .bind(user_id)
        .fetch_one(&state.pool)
        .await?;

    let red_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM roses WHERE user_id = $1 AND color = 'red'")
            .bind(user_id)
            .fetch_one(&state.pool)
            .await?;

    let white_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM roses WHERE user_id = $1 AND color = 'white'")
            .bind(user_id)
            .fetch_one(&state.pool)
            .await?;

    let yellow_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM roses WHERE user_id = $1 AND color = 'yellow'")
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
