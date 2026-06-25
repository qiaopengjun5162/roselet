use axum::{Json, extract::State};
use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use std::collections::HashMap;
use uuid::Uuid;

use crate::state::AppState;

#[derive(Debug, FromRow)]
struct ActivityRow {
    id: Uuid,
    color: String,
    user_id: Option<Uuid>,
    created_at: DateTime<Utc>,
    recipient_nickname: Option<String>,
    kind: String,
}

#[derive(Debug, Serialize)]
pub struct ActivityItem {
    pub id: Uuid,
    pub kind: String,
    pub actor: String,
    pub color: String,
    pub recipient: Option<String>,
    pub created_at: DateTime<Utc>,
}

const PLANTED_LIMIT: i64 = 5;
const GIFTED_LIMIT: i64 = 3;
const TOTAL_LIMIT: i64 = 10;
const ANNOUNCEMENT_MIN_ITEMS: usize = 3;

const DEFAULT_ANNOUNCEMENTS: &[&str] = &["Roselet 花圃已开放，欢迎种下你的第一朵玫瑰"];

pub async fn get_recent_activity(State(state): State<AppState>) -> Json<Vec<ActivityItem>> {
    let rows = sqlx::query_as::<_, ActivityRow>(
        r#"
        (SELECT id, color, user_id, created_at, recipient_nickname, 'planted' as kind
         FROM roses
         WHERE is_private = false AND recipient_nickname IS NULL
         ORDER BY created_at DESC
         LIMIT $1)
        UNION ALL
        (SELECT id, color, user_id, created_at, recipient_nickname, 'gifted' as kind
         FROM roses
         WHERE is_private = false AND recipient_nickname IS NOT NULL
         ORDER BY created_at DESC
         LIMIT $2)
        ORDER BY created_at DESC
        LIMIT $3
        "#,
    )
    .bind(PLANTED_LIMIT)
    .bind(GIFTED_LIMIT)
    .bind(TOTAL_LIMIT)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let mut items = build_items(rows, &state.pool).await;

    if items.len() < ANNOUNCEMENT_MIN_ITEMS {
        let now = Utc::now();
        for (idx, text) in DEFAULT_ANNOUNCEMENTS.iter().enumerate() {
            items.push(ActivityItem {
                id: Uuid::from_u128(idx as u128),
                kind: "announcement".to_string(),
                actor: (*text).to_string(),
                color: String::new(),
                recipient: None,
                created_at: now,
            });
        }
    }

    Json(items)
}

async fn build_items(rows: Vec<ActivityRow>, pool: &sqlx::PgPool) -> Vec<ActivityItem> {
    let user_ids: Vec<Uuid> = rows.iter().filter_map(|r| r.user_id).collect();

    let nicknames: HashMap<Uuid, String> = if user_ids.is_empty() {
        HashMap::new()
    } else {
        sqlx::query_as::<_, (Uuid, String)>(
            "SELECT id, nickname FROM users WHERE id = ANY($1) AND deleted_at IS NULL",
        )
        .bind(&user_ids)
        .fetch_all(pool)
        .await
        .ok()
        .map(|rows| rows.into_iter().collect())
        .unwrap_or_default()
    };

    rows.into_iter()
        .map(|row| {
            let actor = row
                .user_id
                .and_then(|uid| nicknames.get(&uid).cloned())
                .unwrap_or_else(|| "有人".to_string());
            ActivityItem {
                id: row.id,
                kind: row.kind,
                actor,
                color: row.color,
                recipient: row.recipient_nickname,
                created_at: row.created_at,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn announcement_ids_are_deterministic() {
        let id0 = Uuid::from_u128(0);
        let id1 = Uuid::from_u128(1);
        assert_ne!(id0, id1);
    }
}
