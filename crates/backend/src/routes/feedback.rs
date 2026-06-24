use axum::{
    Json,
    extract::{Query, State},
    http::HeaderMap,
    http::StatusCode,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{auth, error::AppError, state::AppState};

#[derive(Deserialize)]
pub struct FeedbackRequest {
    pub content: Option<String>,
}

#[derive(Serialize)]
pub struct FeedbackResponse {
    pub id: i64,
}

#[derive(Debug, Deserialize)]
pub struct AdminFeedbackQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct AdminFeedbackItem {
    pub id: i64,
    pub user_id: Option<Uuid>,
    pub nickname: Option<String>,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct AdminFeedbackResponse {
    pub data: Vec<AdminFeedbackItem>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

#[derive(sqlx::FromRow)]
struct AdminFeedbackRow {
    id: i64,
    user_id: Option<Uuid>,
    nickname: Option<String>,
    content: String,
    created_at: DateTime<Utc>,
}

pub async fn submit_feedback(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<FeedbackRequest>,
) -> Result<(StatusCode, Json<FeedbackResponse>), AppError> {
    let content = body
        .content
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("缺少 content 字段".into()))?
        .trim()
        .to_string();
    if content.chars().count() < 5 {
        return Err(AppError::BadRequest("反馈内容至少 5 个字".into()));
    }
    if content.chars().count() > 500 {
        return Err(AppError::BadRequest("反馈内容不超过 500 字".into()));
    }

    let user_id: Option<Uuid> =
        auth::get_active_user_id(&state.pool, &headers, &state.jwt_secret).await?;

    let id = sqlx::query_scalar!(
        "INSERT INTO feedbacks (user_id, content) VALUES ($1, $2) RETURNING id",
        user_id,
        content,
    )
    .fetch_one(&state.pool)
    .await?;

    Ok((StatusCode::CREATED, Json(FeedbackResponse { id })))
}

pub async fn list_admin_feedback(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<AdminFeedbackQuery>,
) -> Result<Json<AdminFeedbackResponse>, AppError> {
    let user_id = auth::require_active_user_id(&state.pool, &headers, &state.jwt_secret).await?;
    if !crate::routes::stats::is_admin_user(user_id, &state, &headers) {
        return Err(AppError::Forbidden);
    }

    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(20).clamp(1, 50);
    let offset = (page - 1) * per_page;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM feedbacks")
        .fetch_one(&state.pool)
        .await?;

    let rows = sqlx::query_as::<_, AdminFeedbackRow>(
        r#"
        SELECT f.id, f.user_id, u.nickname, f.content, f.created_at
        FROM feedbacks f
        LEFT JOIN users u ON u.id = f.user_id AND u.deleted_at IS NULL
        ORDER BY f.created_at DESC, f.id DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.pool)
    .await?;

    let total_pages = if total == 0 {
        0
    } else {
        (total + per_page - 1) / per_page
    };

    Ok(Json(AdminFeedbackResponse {
        data: rows
            .into_iter()
            .map(|row| AdminFeedbackItem {
                id: row.id,
                user_id: row.user_id,
                nickname: row.nickname,
                content: row.content,
                created_at: row.created_at,
            })
            .collect(),
        total,
        page,
        per_page,
        total_pages,
    }))
}
