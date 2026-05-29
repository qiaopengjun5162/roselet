use axum::Json;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth;
use crate::error::AppError;
use crate::models::rose::{CreateRose, Rose, RoseResponse, UpdateRose};
use crate::state::AppState;

async fn lookup_nickname(pool: &PgPool, user_id: Option<Uuid>) -> Option<String> {
    let uid = user_id?;
    sqlx::query_scalar("SELECT nickname FROM users WHERE id = $1")
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
) -> Result<Json<RoseResponse>, AppError> {
    input.validate().map_err(AppError::BadRequest)?;

    let user_id = auth::extract_user_id(&headers, &state.jwt_secret);

    let rose = sqlx::query_as::<_, Rose>(
        "INSERT INTO roses (color, gratitude, anxiety, hope, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(&input.color)
    .bind(&input.gratitude)
    .bind(&input.anxiety)
    .bind(&input.hope)
    .bind(user_id)
    .fetch_one(&state.pool)
    .await?;

    let nickname = lookup_nickname(&state.pool, rose.user_id).await;
    let response = RoseResponse::from_rose(rose.clone(), nickname, 0);

    let _ = state.rose_tx.send(response.clone());

    // Generate AI reply in background
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

    Ok(Json(response))
}

pub async fn get_rose(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<RoseResponse>, AppError> {
    let rose = sqlx::query_as::<_, Rose>("SELECT * FROM roses WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;

    let nickname = lookup_nickname(&state.pool, rose.user_id).await;
    Ok(Json(RoseResponse::from_rose(rose, nickname, 0)))
}

pub async fn update_rose(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateRose>,
) -> Result<Json<RoseResponse>, AppError> {
    input.validate().map_err(AppError::BadRequest)?;

    let user_id = auth::extract_user_id(&headers, &state.jwt_secret).ok_or(AppError::Forbidden)?;

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
    Ok(Json(RoseResponse::from_rose(rose, nickname, 0)))
}

pub async fn delete_rose(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    let user_id = auth::extract_user_id(&headers, &state.jwt_secret).ok_or(AppError::Forbidden)?;

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
