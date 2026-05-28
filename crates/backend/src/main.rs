use axum::Router;
use axum::routing::{get, post};
use tower_http::cors::{Any, CorsLayer};

use roselet_backend::config::Config;
use roselet_backend::routes;
use roselet_backend::state::AppState;

#[tokio::main]
async fn main() {
    let config = Config::from_env();
    let pool = roselet_backend::db::create_pool(&config.database_url)
        .await
        .expect("Failed to connect to database");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    let state = AppState::new(pool);
    let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any);

    let app = Router::new()
        .route("/api/garden", get(routes::garden::get_garden))
        .route("/api/rose", post(routes::rose::create_rose))
        .route("/api/rose/{id}", get(routes::rose::get_rose))
        .route("/api/ws", get(routes::ws::ws_handler))
        .layer(cors)
        .with_state(state);

    let addr = format!("0.0.0.0:{}", config.port);
    println!("Roselet backend listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
