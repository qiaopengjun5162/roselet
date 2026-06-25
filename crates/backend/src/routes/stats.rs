use axum::{Json, extract::State, http::HeaderMap};
use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

use crate::{auth, error::AppError, state::AppState};

#[derive(Debug, Serialize)]
pub struct UsageGoal {
    pub current: i64,
    pub goal: i64,
    pub percent: i64,
}

#[derive(Debug, Serialize)]
pub struct UsageStats {
    pub total_users: i64,
    pub total_roses: i64,
    pub public_roses: i64,
    pub private_roses: i64,
    pub total_likes: i64,
    pub total_feedback: i64,
    pub users_last_7_days: i64,
    pub roses_last_7_days: i64,
    pub feedback_last_7_days: i64,
    pub latest_rose_at: Option<DateTime<Utc>>,
    pub latest_feedback_at: Option<DateTime<Utc>>,
    pub user_goal: UsageGoal,
    pub private_rose_monthly_limit: i64,
}

#[derive(sqlx::FromRow)]
struct StatsRow {
    total_users: i64,
    total_roses: i64,
    public_roses: i64,
    private_roses: i64,
    total_likes: i64,
    total_feedback: i64,
    users_last_7_days: i64,
    roses_last_7_days: i64,
    feedback_last_7_days: i64,
    latest_rose_at: Option<DateTime<Utc>>,
    latest_feedback_at: Option<DateTime<Utc>>,
}

fn progress_to_goal(current: i64, goal: i64) -> UsageGoal {
    let percent = if goal <= 0 {
        0
    } else {
        ((current * 100) / goal).clamp(0, 100)
    };

    UsageGoal {
        current,
        goal,
        percent,
    }
}

fn header_admin_user_ids(headers: &HeaderMap) -> Option<Vec<String>> {
    headers
        .get("x-roselet-test-admin-ids")
        .and_then(|value| value.to_str().ok())
        .map(|value| {
            value
                .split(',')
                .map(|entry| entry.trim().to_string())
                .filter(|entry| !entry.is_empty())
                .collect::<Vec<_>>()
        })
        .filter(|ids| !ids.is_empty())
}

pub(crate) fn is_admin_user(user_id: Uuid, state: &AppState, headers: &HeaderMap) -> bool {
    let header_ids = header_admin_user_ids(headers);
    let configured_ids = if state.config.is_production {
        &state.config.admin_user_ids
    } else {
        header_ids.as_ref().unwrap_or(&state.config.admin_user_ids)
    };

    configured_ids.iter().any(|id| id == &user_id.to_string())
}

pub async fn get_usage_stats(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<UsageStats>, AppError> {
    let user_id = auth::require_active_user_id(&state.pool, &headers, &state.jwt_secret).await?;
    if !is_admin_user(user_id, &state, &headers) {
        return Err(AppError::Forbidden);
    }

    let row = sqlx::query_as::<_, StatsRow>(
        r#"
        SELECT
          (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS total_users,
          (SELECT COUNT(*) FROM roses) AS total_roses,
          (SELECT COUNT(*) FROM roses WHERE is_private = false) AS public_roses,
          (SELECT COUNT(*) FROM roses WHERE is_private = true) AS private_roses,
          (SELECT COUNT(*) FROM likes) AS total_likes,
          (SELECT COUNT(*) FROM feedbacks) AS total_feedback,
          (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND created_at >= now() - interval '7 days') AS users_last_7_days,
          (SELECT COUNT(*) FROM roses WHERE created_at >= now() - interval '7 days') AS roses_last_7_days,
          (SELECT COUNT(*) FROM feedbacks WHERE created_at >= now() - interval '7 days') AS feedback_last_7_days,
          (SELECT MAX(created_at) FROM roses) AS latest_rose_at,
          (SELECT MAX(created_at) FROM feedbacks) AS latest_feedback_at
        "#
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(UsageStats {
        total_users: row.total_users,
        total_roses: row.total_roses,
        public_roses: row.public_roses,
        private_roses: row.private_roses,
        total_likes: row.total_likes,
        total_feedback: row.total_feedback,
        users_last_7_days: row.users_last_7_days,
        roses_last_7_days: row.roses_last_7_days,
        feedback_last_7_days: row.feedback_last_7_days,
        latest_rose_at: row.latest_rose_at,
        latest_feedback_at: row.latest_feedback_at,
        user_goal: progress_to_goal(row.total_users, 100),
        private_rose_monthly_limit: state.config.private_rose_monthly_limit,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn progress_caps_at_goal() {
        assert_eq!(progress_to_goal(125, 100).percent, 100);
    }

    #[test]
    fn progress_handles_invalid_goal() {
        assert_eq!(progress_to_goal(10, 0).percent, 0);
    }
}
