use axum::extract::{Path, State};
use axum::Json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::rose::{CreateRose, Rose};

pub async fn create_rose(
    State(pool): State<PgPool>,
    Json(input): Json<CreateRose>,
) -> Result<Json<Rose>, AppError> {
    let rose = sqlx::query_as::<_, Rose>(
        "INSERT INTO roses (color, gratitude, anxiety, hope) VALUES ($1, $2, $3, $4) RETURNING *",
    )
    .bind(&input.color)
    .bind(&input.gratitude)
    .bind(&input.anxiety)
    .bind(&input.hope)
    .fetch_one(&pool)
    .await?;

    Ok(Json(rose))
}

pub async fn get_rose(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Rose>, AppError> {
    let rose = sqlx::query_as::<_, Rose>("SELECT * FROM roses WHERE id = $1")
        .bind(id)
        .fetch_one(&pool)
        .await?;

    Ok(Json(rose))
}
