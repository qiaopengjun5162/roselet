use axum::Json;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use serde::Serialize;
use uuid::Uuid;

use crate::auth;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct LikeResponse {
    pub liked: bool,
    pub like_count: i64,
}

pub async fn toggle_like(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(rose_id): Path<Uuid>,
) -> Result<Json<LikeResponse>, AppError> {
    let user_id = auth::extract_user_id(&headers, &state.jwt_secret)
        .ok_or_else(|| AppError::Auth("missing or invalid token".into()))?;

    let rose = sqlx::query_as::<_, (Option<Uuid>, bool)>(
        "SELECT user_id, is_private FROM roses WHERE id = $1",
    )
    .bind(rose_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    if rose.1 && rose.0 != Some(user_id) {
        return Err(AppError::NotFound);
    }

    let existing =
        sqlx::query_scalar::<_, Uuid>("SELECT id FROM likes WHERE user_id = $1 AND rose_id = $2")
            .bind(user_id)
            .bind(rose_id)
            .fetch_optional(&state.pool)
            .await?;

    if existing.is_some() {
        sqlx::query("DELETE FROM likes WHERE user_id = $1 AND rose_id = $2")
            .bind(user_id)
            .bind(rose_id)
            .execute(&state.pool)
            .await?;
    } else {
        sqlx::query("INSERT INTO likes (user_id, rose_id) VALUES ($1, $2)")
            .bind(user_id)
            .bind(rose_id)
            .execute(&state.pool)
            .await?;
    }

    let like_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM likes WHERE rose_id = $1")
        .bind(rose_id)
        .fetch_one(&state.pool)
        .await?;

    Ok(Json(LikeResponse {
        liked: existing.is_none(),
        like_count,
    }))
}
