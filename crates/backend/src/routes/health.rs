use axum::Json;
use axum::extract::State;
use serde::Serialize;

use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub database: String,
    pub version: String,
}

pub async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    let db_healthy = sqlx::query("SELECT 1").fetch_one(&state.pool).await.is_ok();

    Json(HealthResponse {
        status: if db_healthy { "ok".to_string() } else { "degraded".to_string() },
        database: if db_healthy { "healthy".to_string() } else { "unhealthy".to_string() },
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_response_serialization() -> Result<(), serde_json::Error> {
        let response = HealthResponse {
            status: "ok".to_string(),
            database: "healthy".to_string(),
            version: "0.1.0".to_string(),
        };
        let json = serde_json::to_string(&response)?;
        assert!(json.contains("ok"));
        assert!(json.contains("healthy"));
        Ok(())
    }
}
