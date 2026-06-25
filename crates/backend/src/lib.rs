use axum::Router;
use axum::http::HeaderValue;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use tower_http::cors::{AllowOrigin, Any, CorsLayer};

pub mod ai;
pub mod auth;
pub mod config;
pub mod db;
pub mod error;
pub mod models;
pub mod rate_limit;
pub mod routes;
pub mod state;

use state::AppState;

pub fn create_app(state: AppState) -> Router {
    let origins: Vec<HeaderValue> = state
        .config
        .allowed_origins
        .iter()
        .filter_map(|o| o.parse::<HeaderValue>().ok())
        .collect();
    let cors = if origins.is_empty() {
        CorsLayer::permissive()
    } else {
        CorsLayer::new()
            .allow_origin(AllowOrigin::list(origins))
            .allow_methods(Any)
            .allow_headers(Any)
    };

    Router::new()
        .route("/health", get(routes::health::health_check))
        .route("/api/auth/register", post(routes::auth::register))
        .route("/api/auth/refresh", post(routes::auth::refresh))
        .route("/api/auth/logout", post(routes::auth::logout))
        .route(
            "/api/auth/deactivate",
            post(routes::auth::deactivate_account),
        )
        .route("/api/garden", get(routes::garden::get_garden))
        .route(
            "/api/activity/recent",
            get(routes::activity::get_recent_activity),
        )
        .route("/api/rose", post(routes::rose::create_rose))
        .route(
            "/api/rose/{id}",
            get(routes::rose::get_rose).put(routes::rose::update_rose),
        )
        .route("/api/my/roses", get(routes::my::get_my_roses))
        .route("/api/user/profile", get(routes::auth::profile))
        .route("/api/rose/{id}/like", post(routes::like::toggle_like))
        .route("/api/feedback", post(routes::feedback::submit_feedback))
        .route(
            "/api/admin/feedback",
            get(routes::feedback::list_admin_feedback),
        )
        .route("/api/stats", get(routes::stats::get_usage_stats))
        .route("/api/ws", get(routes::ws::ws_handler))
        .route("/swagger", get(routes::docs::swagger_ui))
        .route("/api/openapi.json", get(openapi_json))
        .layer(cors)
        .with_state(state)
}

async fn openapi_json() -> impl IntoResponse {
    match serde_json::from_str::<serde_json::Value>(include_str!("routes/openapi.json")) {
        Ok(json) => axum::response::Json(json).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to parse openapi.json: {}", e),
        )
            .into_response(),
    }
}
