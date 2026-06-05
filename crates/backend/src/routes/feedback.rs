use axum::{Json, extract::State, http::HeaderMap, http::StatusCode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{auth, error::AppError, state::AppState};

#[derive(Deserialize)]
pub struct FeedbackRequest {
    pub content: String,
}

#[derive(Serialize)]
pub struct FeedbackResponse {
    pub id: i64,
}

pub async fn submit_feedback(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<FeedbackRequest>,
) -> Result<(StatusCode, Json<FeedbackResponse>), AppError> {
    let content = body.content.trim().to_string();
    if content.chars().count() < 5 {
        return Err(AppError::BadRequest("反馈内容至少 5 个字".into()));
    }
    if content.chars().count() > 500 {
        return Err(AppError::BadRequest("反馈内容不超过 500 字".into()));
    }

    let user_id: Option<Uuid> = auth::extract_user_id(&headers, &state.jwt_secret);

    let id = sqlx::query_scalar!(
        "INSERT INTO feedbacks (user_id, content) VALUES ($1, $2) RETURNING id",
        user_id,
        content,
    )
    .fetch_one(&state.pool)
    .await?;

    Ok((StatusCode::CREATED, Json(FeedbackResponse { id })))
}
