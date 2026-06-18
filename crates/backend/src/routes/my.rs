use axum::Json;
use axum::extract::{Query, State};
use axum::http::HeaderMap;
use serde::Deserialize;

use crate::auth;
use crate::error::AppError;
use crate::models::pagination::{PaginatedResponse, Pagination};
use crate::models::rose::{Rose, RoseResponse};
use crate::state::AppState;

use super::resolve_nicknames;

#[derive(Debug, Deserialize)]
pub struct MyRosesQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub view: Option<String>,
}

pub async fn get_my_roses(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<MyRosesQuery>,
) -> Result<Json<PaginatedResponse<RoseResponse>>, AppError> {
    let user_id = auth::extract_user_id(&headers, &state.jwt_secret)
        .ok_or_else(|| AppError::Auth("missing or invalid token".into()))?;

    let pagination = Pagination {
        page: query.page,
        per_page: query.per_page,
    };

    let is_received = query.view.as_deref() == Some("received");

    let (total, roses) = if is_received {
        // 别人送给我的玫瑰
        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM roses WHERE recipient_user_id = $1",
        )
        .bind(user_id)
        .fetch_one(&state.pool)
        .await?;

        let roses = sqlx::query_as::<_, Rose>(
            "SELECT * FROM roses WHERE recipient_user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        )
        .bind(user_id)
        .bind(pagination.per_page())
        .bind(pagination.offset())
        .fetch_all(&state.pool)
        .await?;

        (total, roses)
    } else {
        // 我种的花（默认）
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
