use axum::Json;
use axum::extract::State;

use crate::auth;
use crate::error::AppError;
use crate::models::user::{AuthResponse, RegisterRequest, User};
use crate::state::AppState;

pub async fn register(
    State(state): State<AppState>,
    Json(input): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    input.validate().map_err(AppError::BadRequest)?;

    let nickname = input.nickname.trim().to_string();

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (nickname) VALUES ($1) ON CONFLICT (nickname) DO UPDATE SET nickname = EXCLUDED.nickname RETURNING *",
    )
    .bind(&nickname)
    .fetch_one(&state.pool)
    .await?;

    let token = auth::create_token(user.id, &user.nickname);

    Ok(Json(AuthResponse { token, user }))
}
