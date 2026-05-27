use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;

// Helper: create test app with real database
async fn create_test_app() -> axum::Router {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/roselet_test".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    // Clean test data
    sqlx::query("DELETE FROM roses")
        .execute(&pool)
        .await
        .expect("Failed to clean test data");

    let cors = tower_http::cors::CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any);

    axum::Router::new()
        .route(
            "/api/garden",
            axum::routing::get(roselet_backend::routes::garden::get_garden),
        )
        .route(
            "/api/rose",
            axum::routing::post(roselet_backend::routes::rose::create_rose),
        )
        .route(
            "/api/rose/{id}",
            axum::routing::get(roselet_backend::routes::rose::get_rose),
        )
        .layer(cors)
        .with_state(pool)
}

#[tokio::test]
async fn test_garden_empty() {
    let app = create_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/garden")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let roses: Value = serde_json::from_slice(&body).unwrap();
    assert!(roses.as_array().unwrap().is_empty());
}

#[tokio::test]
async fn test_create_rose() {
    let app = create_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/rose")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&json!({
                        "color": "red",
                        "gratitude": "感谢社区",
                        "anxiety": "工作压力",
                        "hope": "期待新项目"
                    }))
                    .unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let rose: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(rose["color"], "red");
    assert_eq!(rose["gratitude"], "感谢社区");
    assert_eq!(rose["anxiety"], "工作压力");
    assert_eq!(rose["hope"], "期待新项目");
    assert!(rose["id"].is_string());
    assert!(rose["created_at"].is_string());
}

#[tokio::test]
async fn test_create_rose_minimal() {
    let app = create_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/rose")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&json!({
                        "color": "white"
                    }))
                    .unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let rose: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(rose["color"], "white");
    assert!(rose["gratitude"].is_null());
    assert!(rose["anxiety"].is_null());
    assert!(rose["hope"].is_null());
}

#[tokio::test]
async fn test_get_rose_by_id() {
    let app = create_test_app().await;

    // Create a rose first
    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/rose")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&json!({
                        "color": "yellow",
                        "gratitude": "感恩测试"
                    }))
                    .unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    let body = create_response.into_body().collect().await.unwrap().to_bytes();
    let created: Value = serde_json::from_slice(&body).unwrap();
    let rose_id = created["id"].as_str().unwrap();

    // Get the rose by ID
    let get_response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/rose/{}", rose_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(get_response.status(), StatusCode::OK);

    let body = get_response.into_body().collect().await.unwrap().to_bytes();
    let rose: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(rose["id"], rose_id);
    assert_eq!(rose["color"], "yellow");
    assert_eq!(rose["gratitude"], "感恩测试");
}

#[tokio::test]
async fn test_garden_with_multiple_roses() {
    let app = create_test_app().await;

    // Create multiple roses
    let colors = vec!["red", "white", "yellow"];
    for color in &colors {
        app.clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/rose")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::to_vec(&json!({
                            "color": color,
                            "gratitude": format!("感恩{}", color)
                        }))
                        .unwrap(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
    }

    // Get garden
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/garden")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let roses: Value = serde_json::from_slice(&body).unwrap();
    let arr = roses.as_array().unwrap();

    assert_eq!(arr.len(), 3);
}
