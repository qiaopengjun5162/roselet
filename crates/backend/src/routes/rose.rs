use axum::Json;
use axum::extract::{Path, State};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::rose::{CreateRose, Rose};
use crate::state::AppState;

/// 创建一朵玫瑰
pub async fn create_rose(
    State(state): State<AppState>,
    Json(input): Json<CreateRose>,
) -> Result<Json<Rose>, AppError> {
    input.validate().map_err(AppError::BadRequest)?;

    let rose = sqlx::query_as::<_, Rose>(
        "INSERT INTO roses (color, gratitude, anxiety, hope) VALUES ($1, $2, $3, $4) RETURNING *",
    )
    .bind(&input.color)
    .bind(&input.gratitude)
    .bind(&input.anxiety)
    .bind(&input.hope)
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
