use axum::Json;
use axum::extract::{Query, State};
use axum::http::HeaderMap;

use crate::auth;
use crate::error::AppError;
use crate::models::pagination::{PaginatedResponse, Pagination};
use crate::models::rose::{Rose, RoseResponse};
use crate::state::AppState;

use super::resolve_nicknames;

fn require_user_id(headers: &HeaderMap, secret: &[u8]) -> Result<uuid::Uuid, AppError> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|token| token.strip_prefix("Bearer "))
        .and_then(|t| auth::verify_token(t, secret))
        .map(|claims| claims.sub)
        .ok_or(AppError::Forbidden)
}

pub async fn get_my_roses(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(pagination): Query<Pagination>,
) -> Result<Json<PaginatedResponse<RoseResponse>>, AppError> {
    let user_id = require_user_id(&headers, &state.jwt_secret)?;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM roses WHERE user_id = $1")
        .bind(user_id)
        .fetch_one(&state.pool)
        .await?;

    let roses = sqlx::query_as::<_, Rose>(
        "SELECT * FROM roses WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    )
    .bind(user_id)
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
