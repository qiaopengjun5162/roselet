use axum::Json;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use uuid::Uuid;

use crate::auth;
use crate::error::AppError;
use crate::models::rose::{CreateRose, Rose};
use crate::state::AppState;

fn extract_user_id(headers: &HeaderMap) -> Option<Uuid> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|token| token.strip_prefix("Bearer "))
        .and_then(auth::verify_token)
        .map(|claims| claims.sub)
}

/// 创建一朵玫瑰
pub async fn create_rose(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<CreateRose>,
) -> Result<Json<Rose>, AppError> {
    input.validate().map_err(AppError::BadRequest)?;

    let user_id = extract_user_id(&headers);

    let rose = sqlx::query_as::<_, Rose>(
        "INSERT INTO roses (color, gratitude, anxiety, hope, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(&input.color)
    .bind(&input.gratitude)
    .bind(&input.anxiety)
    .bind(&input.hope)
    .bind(user_id)
    .fetch_one(&state.pool)
    .await?;

    let _ = state.rose_tx.send(rose.clone());

    Ok(Json(rose))
}

/// 获取单朵玫瑰
pub async fn get_rose(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Rose>, AppError> {
    let rose = sqlx::query_as::<_, Rose>("SELECT * FROM roses WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(rose))
}
