use axum::Json;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use uuid::Uuid;

use crate::auth;
use crate::error::AppError;
use crate::models::rose::{CreateRose, Rose, UpdateRose};
use crate::state::AppState;

fn extract_user_id(headers: &HeaderMap) -> Option<Uuid> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|token| token.strip_prefix("Bearer "))
        .and_then(auth::verify_token)
        .map(|claims| claims.sub)
}

pub async fn create_rose(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<CreateRose>,
) -> Result<Json<Rose>, AppError> {
    input.validate().map_err(AppError::BadRequest)?;

    let user_id = extract_user_id(&headers);

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

    let _ = state.rose_tx.send(rose.clone());

    Ok(Json(rose))
}

pub async fn get_rose(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Rose>, AppError> {
    let rose = sqlx::query_as::<_, Rose>("SELECT * FROM roses WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(rose))
}

pub async fn update_rose(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateRose>,
) -> Result<Json<Rose>, AppError> {
    input.validate().map_err(AppError::BadRequest)?;

    let user_id = extract_user_id(&headers).ok_or(AppError::Forbidden)?;

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

    Ok(Json(rose))
}

pub async fn delete_rose(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    let user_id = extract_user_id(&headers).ok_or(AppError::Forbidden)?;

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
