use axum::Json;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth;
use crate::error::AppError;
use crate::models::rose::{CreateRose, Rose, RoseResponse, UpdateRose};
use crate::state::AppState;

pub const DEFAULT_PRIVATE_ROSE_MONTHLY_LIMIT: i64 = 10;

fn private_quota_exceeded_message(limit: i64) -> String {
    format!("本月悄悄种下的机会已用完 ({}/{})", limit, limit)
}

async fn lookup_nickname(pool: &PgPool, user_id: Option<Uuid>) -> Option<String> {
    let uid = user_id?;
    sqlx::query_scalar("SELECT nickname FROM users WHERE id = $1 AND deleted_at IS NULL")
        .bind(uid)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
}

pub async fn create_rose(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<CreateRose>,
) -> Result<(StatusCode, Json<RoseResponse>), AppError> {
    input.validate().map_err(AppError::BadRequest)?;

    let user_id = match auth::require_active_user_id(&state.pool, &headers, &state.jwt_secret).await
    {
        Ok(user_id) => user_id,
        Err(AppError::Auth(_)) => return Err(AppError::Auth("请先登录再种花".into())),
        Err(other) => return Err(other),
    };

    let rate_key = format!("plant:{}", user_id);
    if !state.rate_limiter.check(&rate_key) {
        return Err(AppError::BadRequest("种花太频繁了，休息一下再来吧".into()));
    }

    let is_private = input.is_private.unwrap_or(false);

    // 私密是安全感，但仍需要一个温和上限，避免公共资源被无边界占用。
    if is_private {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM roses WHERE user_id = $1 AND is_private = true AND date_trunc('month', created_at) = date_trunc('month', now())",
        )
        .bind(user_id)
        .fetch_one(&state.pool)
        .await?;
        let limit = state.config.private_rose_monthly_limit;
        if count >= limit {
            return Err(AppError::BadRequest(private_quota_exceeded_message(limit)));
        }
    }

    // 处理接收人
    let recipient_user_id = if let Some(ref nickname) = input.recipient_nickname {
        let trimmed = nickname.trim();
        if trimmed.is_empty() {
            None
        } else {
            let sender_nickname: Option<String> = sqlx::query_scalar(
                "SELECT nickname FROM users WHERE id = $1 AND deleted_at IS NULL",
            )
            .bind(user_id)
            .fetch_optional(&state.pool)
            .await?;

            // 不能送给自己
            if sender_nickname.as_deref() == Some(trimmed) {
                return Err(AppError::BadRequest(
                    "花是送人的哦，送给自己直接种花就好".into(),
                ));
            }

            // 查找或创建接收人用户
            #[derive(sqlx::FromRow)]
            struct RecipientUser {
                id: Uuid,
                deleted_at: Option<chrono::DateTime<chrono::Utc>>,
            }

            let recipient = sqlx::query_as::<_, RecipientUser>(
                "SELECT id, deleted_at FROM users WHERE nickname = $1 LIMIT 1",
            )
            .bind(trimmed)
            .fetch_optional(&state.pool)
            .await?;

            match recipient {
                Some(RecipientUser {
                    id,
                    deleted_at: Some(deleted_at),
                }) => {
                    if auth::deletion_is_restorable(deleted_at, chrono::Utc::now()) {
                        Some(id)
                    } else {
                        auth::finalize_deleted_user(&state.pool, id).await?;
                        let created: (Uuid,) =
                            sqlx::query_as("INSERT INTO users (nickname) VALUES ($1) RETURNING id")
                                .bind(trimmed)
                                .fetch_one(&state.pool)
                                .await?;
                        Some(created.0)
                    }
                }
                Some(RecipientUser {
                    id,
                    deleted_at: None,
                }) => Some(id),
                None => {
                    let created: (Uuid,) =
                        sqlx::query_as("INSERT INTO users (nickname) VALUES ($1) RETURNING id")
                            .bind(trimmed)
                            .fetch_one(&state.pool)
                            .await?;
                    Some(created.0)
                }
            }
        }
    } else {
        None
    };

    let rose = sqlx::query_as::<_, Rose>(
        "INSERT INTO roses (color, gratitude, anxiety, hope, user_id, is_private, recipient_nickname, recipient_user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
    )
    .bind(&input.color)
    .bind(&input.gratitude)
    .bind(&input.anxiety)
    .bind(&input.hope)
    .bind(user_id)
    .bind(is_private)
    .bind(input.recipient_nickname.as_deref().map(|n| n.trim()).filter(|n| !n.is_empty()))
    .bind(recipient_user_id)
    .fetch_one(&state.pool)
    .await?;

    let nickname = lookup_nickname(&state.pool, rose.user_id).await;
    let response = RoseResponse::from_rose(rose.clone(), nickname, 0);

    if !is_private {
        let _ = state.rose_tx.send(response.clone());
    }

    let pool = state.pool.clone();
    let rose_id = rose.id;
    let color = input.color.clone();
    let gratitude = input.gratitude.clone();
    let anxiety = input.anxiety.clone();
    let hope = input.hope.clone();
    tokio::spawn(async move {
        if let Some(reply) = crate::ai::generate_reply(
            &color,
            gratitude.as_deref(),
            anxiety.as_deref(),
            hope.as_deref(),
        )
        .await
        {
            let _ = sqlx::query("UPDATE roses SET ai_reply = $1 WHERE id = $2")
                .bind(&reply)
                .bind(rose_id)
                .execute(&pool)
                .await;
        }
    });

    Ok((StatusCode::CREATED, Json(response)))
}

pub async fn get_rose(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<RoseResponse>, AppError> {
    let rose = sqlx::query_as::<_, Rose>("SELECT * FROM roses WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;

    if rose.is_private {
        let user_id = auth::get_active_user_id(&state.pool, &headers, &state.jwt_secret).await?;
        // 允许创建者和接收人查看私有玫瑰
        let is_recipient = user_id.is_some()
            && rose.recipient_user_id.is_some()
            && user_id == rose.recipient_user_id;
        if user_id != rose.user_id && !is_recipient {
            return Err(AppError::NotFound);
        }
    }

    let nickname = lookup_nickname(&state.pool, rose.user_id).await;
    let like_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM likes WHERE rose_id = $1")
        .bind(rose.id)
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);
    Ok(Json(RoseResponse::from_rose(rose, nickname, like_count)))
}

pub async fn update_rose(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(raw_input): Json<serde_json::Value>,
) -> Result<Json<RoseResponse>, AppError> {
    let input: UpdateRose =
        serde_json::from_value(raw_input).map_err(|e| AppError::BadRequest(e.to_string()))?;
    let user_id = auth::require_active_user_id(&state.pool, &headers, &state.jwt_secret).await?;

    let existing = sqlx::query_as::<_, Rose>("SELECT * FROM roses WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;

    if existing.user_id != Some(user_id) {
        return Err(AppError::Forbidden);
    }

    let target_private = input.target_private().map_err(AppError::BadRequest)?;

    if target_private && !existing.is_private {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM roses WHERE user_id = $1 AND is_private = true AND date_trunc('month', created_at) = date_trunc('month', now())",
        )
        .bind(user_id)
        .fetch_one(&state.pool)
        .await?;
        let limit = state.config.private_rose_monthly_limit;
        if count >= limit {
            return Err(AppError::BadRequest(private_quota_exceeded_message(limit)));
        }
    }

    let rose =
        sqlx::query_as::<_, Rose>("UPDATE roses SET is_private = $1 WHERE id = $2 RETURNING *")
            .bind(target_private)
            .bind(id)
            .fetch_one(&state.pool)
            .await?;

    let nickname = lookup_nickname(&state.pool, rose.user_id).await;
    let like_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM likes WHERE rose_id = $1")
        .bind(rose.id)
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);
    Ok(Json(RoseResponse::from_rose(rose, nickname, like_count)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_private_quota_message_uses_current_limit() {
        assert_eq!(DEFAULT_PRIVATE_ROSE_MONTHLY_LIMIT, 10);
        assert_eq!(
            private_quota_exceeded_message(DEFAULT_PRIVATE_ROSE_MONTHLY_LIMIT),
            "本月悄悄种下的机会已用完 (10/10)"
        );
    }
}
