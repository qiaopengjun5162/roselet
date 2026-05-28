use axum::Json;
use axum::extract::{Query, State};

use crate::error::AppError;
use crate::models::pagination::{PaginatedResponse, Pagination};
use crate::models::rose::{Rose, RoseResponse};
use crate::state::AppState;

use super::resolve_nicknames;

pub async fn get_garden(
    State(state): State<AppState>,
    Query(pagination): Query<Pagination>,
) -> Result<Json<PaginatedResponse<RoseResponse>>, AppError> {
    let total: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM roses").fetch_one(&state.pool).await?;

    let roses = sqlx::query_as::<_, Rose>(
        "SELECT * FROM roses ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    )
    .bind(pagination.per_page())
    .bind(pagination.offset())
    .fetch_all(&state.pool)
    .await?;

    let page = pagination.page.unwrap_or(1).max(1);
    let data = resolve_nicknames(&state.pool, roses).await;

    Ok(Json(PaginatedResponse {
        data,
        total,
        page,
        per_page: pagination.per_page(),
    }))
}
