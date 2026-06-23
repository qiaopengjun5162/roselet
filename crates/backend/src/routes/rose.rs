use axum::Json;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth;
use crate::error::AppError;
use crate::models::rose::{CreateRose, Rose, RoseResponse, UpdateRose};
use crate::state::AppState;

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

    // 私有模式配额：每月最多 5 朵
    if is_private {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM roses WHERE user_id = $1 AND is_private = true AND date_trunc('month', created_at) = date_trunc('month', now())",
        )
        .bind(user_id)
        .fetch_one(&state.pool)
        .await?;
        if count >= 5 {
            return Err(AppError::BadRequest("本月私有名额已用完 (5/5)".into()));
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
    Json(input): Json<UpdateRose>,
) -> Result<Json<RoseResponse>, AppError> {
    input.validate().map_err(AppError::BadRequest)?;

    let user_id = auth::require_active_user_id(&state.pool, &headers, &state.jwt_secret).await?;

    let existing = sqlx::query_as::<_, Rose>("SELECT * FROM roses WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;

    if existing.user_id != Some(user_id) {
        return Err(AppError::Forbidden);
    }

    let color = input.color.as_deref().unwrap_or(&existing.color);
    let gratitude = match &input.gratitude {
        Some(v) => v.as_deref(),
        None => existing.gratitude.as_deref(),
    };
    let anxiety = match &input.anxiety {
        Some(v) => v.as_deref(),
        None => existing.anxiety.as_deref(),
    };
    let hope = match &input.hope {
        Some(v) => v.as_deref(),
        None => existing.hope.as_deref(),
    };

    let rose = sqlx::query_as::<_, Rose>(
        "UPDATE roses SET color = $1, gratitude = $2, anxiety = $3, hope = $4 WHERE id = $5 RETURNING *",
    )
    .bind(color)
    .bind(gratitude)
    .bind(anxiety)
    .bind(hope)
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

pub async fn delete_rose(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    let user_id = auth::require_active_user_id(&state.pool, &headers, &state.jwt_secret).await?;

    let existing = sqlx::query_as::<_, Rose>("SELECT * FROM roses WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;

    if existing.user_id != Some(user_id) {
        return Err(AppError::Forbidden);
    }

    sqlx::query("DELETE FROM roses WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await?;

    Ok(())
}
