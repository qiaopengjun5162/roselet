use axum::extract::State;
use axum::Json;
use sqlx::PgPool;

use crate::error::AppError;
use crate::models::rose::Rose;

pub async fn get_garden(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Rose>>, AppError> {
    let roses = sqlx::query_as::<_, Rose>("SELECT * FROM roses ORDER BY created_at DESC")
        .fetch_all(&pool)
        .await?;

    Ok(Json(roses))
}
