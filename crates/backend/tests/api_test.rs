use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;

async fn create_test_app() -> axum::Router {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/roselet_test".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    sqlx::query("DELETE FROM roses")
        .execute(&pool)
        .await
        .expect("Failed to clean test data");

    let state = roselet_backend::state::AppState::new(pool);
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
        .route(
            "/api/ws",
            axum::routing::get(roselet_backend::routes::ws::ws_handler),
        )
        .layer(cors)
        .with_state(state)
}

#[tokio::test]
async fn test_garden_empty() {
    let app = create_test_app().await;

    let response = app
        .oneshot(Request::builder().uri("/api/garden").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let roses: Value = serde_json::from_slice(&body).unwrap();
    assert!(roses["data"].as_array().unwrap().is_empty());
    assert_eq!(roses["total"], 0);
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
}

#[tokio::test]
async fn test_create_rose_with_one_field() {
    let app = create_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/rose")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&json!({
                        "color": "white",
                        "gratitude": "感恩"
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
    assert_eq!(rose["gratitude"], "感恩");
    assert!(rose["anxiety"].is_null());
    assert!(rose["hope"].is_null());
}

#[tokio::test]
async fn test_create_rose_invalid_color() {
    let app = create_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/rose")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&json!({
                        "color": "blue",
                        "gratitude": "感恩"
                    }))
                    .unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_create_rose_empty_content() {
    let app = create_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/rose")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&json!({
                        "color": "red"
                    }))
                    .unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_get_rose_by_id() {
    let app = create_test_app().await;

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
async fn test_get_rose_not_found() {
    let app = create_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/rose/00000000-0000-0000-0000-000000000000")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_garden_with_multiple_roses() {
    let app = create_test_app().await;

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

    let response = app
        .oneshot(Request::builder().uri("/api/garden").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let roses: Value = serde_json::from_slice(&body).unwrap();
    let arr = roses["data"].as_array().unwrap();

    assert_eq!(arr.len(), 3);
    assert_eq!(roses["total"], 3);
}

#[tokio::test]
async fn test_garden_pagination() {
    let app = create_test_app().await;

    for i in 0..5 {
        app.clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/rose")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::to_vec(&json!({
                            "color": "red",
                            "gratitude": format!("感恩{}", i)
                        }))
                        .unwrap(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
    }

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/garden?page=1&per_page=2")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let page1: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(page1["data"].as_array().unwrap().len(), 2);
    assert_eq!(page1["total"], 5);
    assert_eq!(page1["page"], 1);
    assert_eq!(page1["per_page"], 2);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/garden?page=3&per_page=2")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let page3: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(page3["data"].as_array().unwrap().len(), 1);
    assert_eq!(page3["total"], 5);
    assert_eq!(page3["page"], 3);
}
