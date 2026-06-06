use axum::Json;
use axum::extract::{Query, State};
use serde::Deserialize;

use crate::error::AppError;
use crate::models::pagination::{PaginatedResponse, Pagination};
use crate::models::rose::{Rose, RoseResponse};
use crate::state::AppState;

use super::resolve_nicknames;

#[derive(Debug, Deserialize)]
pub struct GardenQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub color: Option<String>,
}

pub async fn get_garden(
    State(state): State<AppState>,
    Query(query): Query<GardenQuery>,
) -> Result<Json<PaginatedResponse<RoseResponse>>, AppError> {
    let pagination = Pagination {
        page: query.page,
        per_page: query.per_page,
    };

    let (total, roses) = if let Some(ref color) = query.color {
        let valid_colors = ["red", "white", "yellow"];
        if !valid_colors.contains(&color.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Invalid color '{}'. Must be one of: {:?}",
                color, valid_colors
            )));
        }

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM roses WHERE color = $1 AND is_private = false",
        )
        .bind(color)
        .fetch_one(&state.pool)
        .await?;

        let roses = sqlx::query_as::<_, Rose>(
            "SELECT * FROM roses WHERE color = $1 AND is_private = false ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        )
        .bind(color)
        .bind(pagination.per_page())
        .bind(pagination.offset())
        .fetch_all(&state.pool)
        .await?;

        (total, roses)
    } else {
        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM roses WHERE is_private = false")
            .fetch_one(&state.pool)
            .await?;

        let roses = sqlx::query_as::<_, Rose>(
            "SELECT * FROM roses WHERE is_private = false ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        )
        .bind(pagination.per_page())
        .bind(pagination.offset())
        .fetch_all(&state.pool)
        .await?;

        (total, roses)
    };

    let page = pagination.page.unwrap_or(1).max(1);
    let data = resolve_nicknames(&state.pool, roses).await;

    Ok(Json(PaginatedResponse {
        data,
        total,
        page,
        per_page: pagination.per_page(),
    }))
}
