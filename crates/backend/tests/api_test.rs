use axum::body::Body;
use axum::http::{Request, StatusCode};
use futures_util::StreamExt;
use http_body_util::BodyExt;
use roselet_backend::auth::create_access_token;
use roselet_backend::config::Config;
use serde_json::{Value, json};
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use tokio::net::TcpListener;
use tower::ServiceExt;
use uuid::Uuid;

async fn create_test_app() -> (axum::Router, PgPool) {
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

    sqlx::query("TRUNCATE feedbacks, refresh_tokens, likes, roses, users RESTART IDENTITY CASCADE")
        .execute(&pool)
        .await
        .expect("Failed to clean test data");

    let config = Config {
        database_url: database_url.clone(),
        port: 3001,
        jwt_secret: "test-secret".to_string(),
        allowed_origins: vec!["http://localhost:3000".to_string()],
        is_production: false,
    };
    let state = roselet_backend::state::AppState::new(pool.clone(), config);
    let app = roselet_backend::create_app(state);
    (app, pool)
}

async fn spawn_test_server() -> String {
    let (app, _) = create_test_app().await;
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("Failed to bind to port");
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.expect("Failed to serve");
    });

    // Give the server a moment to start
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    format!("http://{}", addr)
}

async fn register_user(base: &str, nickname: &str) -> Value {
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/auth/register", base))
        .json(&json!({ "nickname": nickname }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    res.json().await.unwrap()
}

async fn create_test_jwt(pool: &PgPool, nickname: &str) -> String {
    let user_id = sqlx::query_scalar("INSERT INTO users (nickname) VALUES ($1) RETURNING id")
        .bind(nickname)
        .fetch_one(pool)
        .await
        .unwrap();
    create_access_token(user_id, nickname, "test-secret".as_bytes()).unwrap()
}

// ==================== 原有测试 ====================

#[tokio::test]
async fn test_garden_empty() {
    let (app, _) = create_test_app().await;
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
    let (app, pool) = create_test_app().await;
    let token = create_test_jwt(&pool, "test-user").await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/rose")
                .header("content-type", "application/json")
                .header("Authorization", format!("Bearer {}", token))
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
    let status = response.status();
    if status != StatusCode::CREATED {
        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        eprintln!("错误: {}", String::from_utf8_lossy(&body_bytes));
        return;
    }
    assert_eq!(status, StatusCode::CREATED);
    let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
    let rose: Value = serde_json::from_slice(&body_bytes).unwrap();
    assert_eq!(rose["color"], "red");
    assert_eq!(rose["gratitude"], "感谢社区");
    assert_eq!(rose["anxiety"], "工作压力");
    assert_eq!(rose["hope"], "期待新项目");
}

#[tokio::test]
async fn test_create_rose_with_one_field() {
    let (app, pool) = create_test_app().await;
    let token = create_test_jwt(&pool, "test-user").await;
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/rose")
                .header("content-type", "application/json")
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::from(
                    serde_json::to_vec(&json!({ "color": "white", "gratitude": "感恩" })).unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let rose: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(rose["color"], "white");
    assert_eq!(rose["gratitude"], "感恩");
    assert!(rose["anxiety"].is_null());
    assert!(rose["hope"].is_null());
}

#[tokio::test]
async fn test_create_rose_invalid_color() {
    let (app, _) = create_test_app().await;
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/rose")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&json!({ "color": "blue", "gratitude": "感恩" })).unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_create_rose_empty_content() {
    let (app, _) = create_test_app().await;
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/rose")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&json!({ "color": "red" })).unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_get_rose_by_id() {
    let (app, pool) = create_test_app().await;
    let token = create_test_jwt(&pool, "get-rose-user").await;
    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/rose")
                .header("content-type", "application/json")
                .header("Authorization", format!("Bearer {}", token))
                .body(Body::from(
                    serde_json::to_vec(&json!({ "color": "yellow", "gratitude": "感恩测试" }))
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
    let (app, _) = create_test_app().await;
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
    let (app, pool) = create_test_app().await;
    let token = create_test_jwt(&pool, "multi-rose-user").await;
    for color in &["red", "white", "yellow"] {
        app.clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/rose")
                    .header("content-type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_vec(
                            &json!({ "color": color, "gratitude": format!("感恩{}", color) }),
                        )
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
    assert_eq!(roses["data"].as_array().unwrap().len(), 3);
    assert_eq!(roses["total"], 3);
}

#[tokio::test]
async fn test_garden_pagination() {
    let (app, pool) = create_test_app().await;
    let token = create_test_jwt(&pool, "pagination-user").await;
    for i in 0..5 {
        app.clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/rose")
                    .header("content-type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_vec(
                            &json!({ "color": "red", "gratitude": format!("感恩{}", i) }),
                        )
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

#[tokio::test]
async fn test_register_user() {
    let (app, _) = create_test_app().await;
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&json!({ "nickname": "alice" })).unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let result: Value = serde_json::from_slice(&body).unwrap();
    assert!(result["access_token"].as_str().is_some());
    assert!(result["refresh_token"].as_str().is_some());
    assert_eq!(result["user"]["nickname"], "alice");
}

#[tokio::test]
async fn test_register_empty_nickname() {
    let (app, _) = create_test_app().await;
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&json!({ "nickname": "" })).unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

// ==================== 新增测试 ====================

#[tokio::test]
async fn test_register_duplicate_nickname() {
    let base = spawn_test_server().await;
    let res1 = register_user(&base, "bob").await;
    assert!(res1["access_token"].as_str().is_some());
    let res2 = register_user(&base, "bob").await;
    assert!(res2["access_token"].as_str().is_some());
    assert_eq!(res1["user"]["id"], res2["user"]["id"]);
}

#[tokio::test]
async fn test_create_rose_with_jwt() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "carol").await;
    let token = auth["access_token"].as_str().unwrap();

    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "color": "red", "gratitude": "感恩测试" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let rose: Value = res.json().await.unwrap();
    assert_eq!(rose["color"], "red");
    assert_eq!(rose["gratitude"], "感恩测试");
    assert!(rose["user_id"].as_str().is_some());
    assert_eq!(rose["user_id"], auth["user"]["id"]);
}

#[tokio::test]
async fn test_create_rose_without_jwt() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/rose", base))
        .json(&json!({ "color": "white", "gratitude": "匿名感恩" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_garden_pagination_boundary() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();

    for i in 0..3 {
        client
            .post(format!("{}/api/rose", base))
            .json(&json!({ "color": "red", "gratitude": format!("r{}", i) }))
            .send()
            .await
            .unwrap();
    }

    // page=0, per_page=0 → clamped to page=1, per_page=1
    let res = client
        .get(format!("{}/api/garden?page=0&per_page=0", base))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["page"], 1);
    assert_eq!(body["per_page"], 1);

    // per_page=200 → clamped to 100
    let res = client
        .get(format!("{}/api/garden?page=1&per_page=200", base))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["per_page"], 100);

    // page far beyond data → empty
    let res = client
        .get(format!("{}/api/garden?page=99&per_page=10", base))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert!(body["data"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn test_get_rose_invalid_uuid() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();
    let res = client.get(format!("{}/api/rose/not-a-uuid", base)).send().await.unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_create_rose_malformed_json() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/rose", base))
        .header("Content-Type", "application/json")
        .body("not json")
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_websocket_receives_new_rose() {
    let base = spawn_test_server().await;
    let ws_url = base.replace("http://", "ws://") + "/api/ws";

    let (mut ws_stream, _) = tokio_tungstenite::connect_async(&ws_url)
        .await
        .expect("Failed to connect WebSocket");

    let client = reqwest::Client::new();
    let auth = register_user(&base, "ws-user").await;
    client
        .post(format!("{}/api/rose", base))
        .header(
            "Authorization",
            format!("Bearer {}", auth["access_token"].as_str().unwrap()),
        )
        .json(&json!({ "color": "red", "gratitude": "ws测试" }))
        .send()
        .await
        .unwrap();

    let msg = tokio::time::timeout(std::time::Duration::from_secs(2), ws_stream.next())
        .await
        .expect("Timeout waiting for WS message")
        .expect("WS stream ended")
        .expect("WS read error");

    let text = msg.to_text().unwrap();
    let rose: Value = serde_json::from_str(text).unwrap();
    assert_eq!(rose["color"], "red");
    assert_eq!(rose["gratitude"], "ws测试");

    ws_stream.close(None).await.ok();
}

#[tokio::test]
async fn test_private_rose_hidden_from_public_garden() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();
    let auth = register_user(&base, "private-gardener").await;
    let token = auth["access_token"].as_str().unwrap();

    client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "color": "red", "gratitude": "公开玫瑰" }))
        .send()
        .await
        .unwrap();

    let private = client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "color": "white", "gratitude": "私密玫瑰", "is_private": true }))
        .send()
        .await
        .unwrap();
    assert_eq!(private.status(), StatusCode::CREATED);
    let private_body: Value = private.json().await.unwrap();
    assert_eq!(private_body["is_private"], true);

    let garden: Value = client
        .get(format!("{}/api/garden", base))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(garden["total"], 1);
    assert_eq!(garden["data"][0]["gratitude"], "公开玫瑰");

    let mine: Value = client
        .get(format!("{}/api/my/roses", base))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(mine["total"], 2);
}

#[tokio::test]
async fn test_private_rose_detail_requires_owner() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();
    let owner = register_user(&base, "private-owner").await;
    let other = register_user(&base, "private-viewer").await;
    let owner_token = owner["access_token"].as_str().unwrap();
    let other_token = other["access_token"].as_str().unwrap();

    let created: Value = client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", owner_token))
        .json(&json!({ "color": "yellow", "gratitude": "只给自己看", "is_private": true }))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let rose_id = created["id"].as_str().unwrap();

    let no_auth = client.get(format!("{}/api/rose/{}", base, rose_id)).send().await.unwrap();
    assert_eq!(no_auth.status(), StatusCode::NOT_FOUND);

    let other_res = client
        .get(format!("{}/api/rose/{}", base, rose_id))
        .header("Authorization", format!("Bearer {}", other_token))
        .send()
        .await
        .unwrap();
    assert_eq!(other_res.status(), StatusCode::NOT_FOUND);

    let owner_res = client
        .get(format!("{}/api/rose/{}", base, rose_id))
        .header("Authorization", format!("Bearer {}", owner_token))
        .send()
        .await
        .unwrap();
    assert_eq!(owner_res.status(), StatusCode::OK);
    let body: Value = owner_res.json().await.unwrap();
    assert_eq!(body["gratitude"], "只给自己看");
    assert_eq!(body["is_private"], true);
}

#[tokio::test]
async fn test_private_rose_not_broadcast_to_public_ws() {
    let base = spawn_test_server().await;
    let ws_url = base.replace("http://", "ws://") + "/api/ws";
    let (mut ws_stream, _) = tokio_tungstenite::connect_async(&ws_url)
        .await
        .expect("Failed to connect WebSocket");

    let client = reqwest::Client::new();
    let auth = register_user(&base, "private-ws-user").await;
    let token = auth["access_token"].as_str().unwrap();

    let private = client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "color": "red", "gratitude": "ws private", "is_private": true }))
        .send()
        .await
        .unwrap();
    assert_eq!(private.status(), StatusCode::CREATED);

    let no_message =
        tokio::time::timeout(std::time::Duration::from_millis(200), ws_stream.next()).await;
    assert!(no_message.is_err());

    let public = client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "color": "red", "gratitude": "ws public" }))
        .send()
        .await
        .unwrap();
    assert_eq!(public.status(), StatusCode::CREATED);

    let msg = tokio::time::timeout(std::time::Duration::from_secs(2), ws_stream.next())
        .await
        .expect("Timeout waiting for WS message")
        .expect("WS stream ended")
        .expect("WS read error");
    let rose: Value = serde_json::from_str(msg.to_text().unwrap()).unwrap();
    assert_eq!(rose["gratitude"], "ws public");

    ws_stream.close(None).await.ok();
}

#[tokio::test]
async fn test_private_rose_monthly_quota() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();
    let auth = register_user(&base, "quota-user").await;
    let token = auth["access_token"].as_str().unwrap();

    for i in 0..5 {
        let res = client
            .post(format!("{}/api/rose", base))
            .header("Authorization", format!("Bearer {}", token))
            .json(&json!({ "color": "red", "gratitude": format!("private {}", i), "is_private": true }))
            .send()
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::CREATED);
    }

    let sixth = client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "color": "red", "gratitude": "too much", "is_private": true }))
        .send()
        .await
        .unwrap();
    assert_eq!(sixth.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_private_rose_like_requires_owner() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();
    let owner = register_user(&base, "private-like-owner").await;
    let other = register_user(&base, "private-like-other").await;
    let owner_token = owner["access_token"].as_str().unwrap();
    let other_token = other["access_token"].as_str().unwrap();

    let created: Value = client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", owner_token))
        .json(&json!({ "color": "white", "gratitude": "like secret", "is_private": true }))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let rose_id = created["id"].as_str().unwrap();

    let other_like = client
        .post(format!("{}/api/rose/{}/like", base, rose_id))
        .header("Authorization", format!("Bearer {}", other_token))
        .send()
        .await
        .unwrap();
    assert_eq!(other_like.status(), StatusCode::NOT_FOUND);

    let owner_like = client
        .post(format!("{}/api/rose/{}/like", base, rose_id))
        .header("Authorization", format!("Bearer {}", owner_token))
        .send()
        .await
        .unwrap();
    assert_eq!(owner_like.status(), StatusCode::OK);
    let body: Value = owner_like.json().await.unwrap();
    assert_eq!(body["liked"], true);
    assert_eq!(body["like_count"], 1);

    let owner_detail = client
        .get(format!("{}/api/rose/{}", base, rose_id))
        .header("Authorization", format!("Bearer {}", owner_token))
        .send()
        .await
        .unwrap();
    assert_eq!(owner_detail.status(), StatusCode::OK);
    let body: Value = owner_detail.json().await.unwrap();
    assert_eq!(body["is_private"], true);
    assert_eq!(body["like_count"], 1);
}

#[tokio::test]
async fn test_update_rose_by_owner() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "dave").await;
    let token = auth["access_token"].as_str().unwrap();
    let client = reqwest::Client::new();

    let res = client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "color": "red", "gratitude": "原始" }))
        .send()
        .await
        .unwrap();
    let rose: Value = res.json().await.unwrap();
    let rose_id = rose["id"].as_str().unwrap();

    let res = client
        .put(format!("{}/api/rose/{}", base, rose_id))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "color": "yellow", "gratitude": "已修改" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let updated: Value = res.json().await.unwrap();
    assert_eq!(updated["color"], "yellow");
    assert_eq!(updated["gratitude"], "已修改");
}

#[tokio::test]
async fn test_update_rose_forbidden() {
    let base = spawn_test_server().await;
    let auth1 = register_user(&base, "eve").await;
    let auth2 = register_user(&base, "frank").await;
    let client = reqwest::Client::new();

    let res = client
        .post(format!("{}/api/rose", base))
        .header(
            "Authorization",
            format!("Bearer {}", auth1["access_token"].as_str().unwrap()),
        )
        .json(&json!({ "color": "red", "gratitude": "eve的玫瑰" }))
        .send()
        .await
        .unwrap();
    let rose: Value = res.json().await.unwrap();
    let rose_id = rose["id"].as_str().unwrap();

    let res = client
        .put(format!("{}/api/rose/{}", base, rose_id))
        .header(
            "Authorization",
            format!("Bearer {}", auth2["access_token"].as_str().unwrap()),
        )
        .json(&json!({ "gratitude": "尝试修改" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_update_rose_no_auth() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "greg").await;
    let client = reqwest::Client::new();

    let res = client
        .post(format!("{}/api/rose", base))
        .header(
            "Authorization",
            format!("Bearer {}", auth["access_token"].as_str().unwrap()),
        )
        .json(&json!({ "color": "red", "gratitude": "greg的玫瑰" }))
        .send()
        .await
        .unwrap();
    let rose: Value = res.json().await.unwrap();
    let rose_id = rose["id"].as_str().unwrap();

    let res = client
        .put(format!("{}/api/rose/{}", base, rose_id))
        .json(&json!({ "gratitude": "未认证修改" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_delete_rose_by_owner() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "helen").await;
    let token = auth["access_token"].as_str().unwrap();
    let client = reqwest::Client::new();

    let res = client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "color": "white", "gratitude": "待删除" }))
        .send()
        .await
        .unwrap();
    let rose: Value = res.json().await.unwrap();
    let rose_id = rose["id"].as_str().unwrap();

    let res = client
        .delete(format!("{}/api/rose/{}", base, rose_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let res = client.get(format!("{}/api/rose/{}", base, rose_id)).send().await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_delete_rose_forbidden() {
    let base = spawn_test_server().await;
    let auth1 = register_user(&base, "ivan").await;
    let auth2 = register_user(&base, "judy").await;
    let client = reqwest::Client::new();

    let res = client
        .post(format!("{}/api/rose", base))
        .header(
            "Authorization",
            format!("Bearer {}", auth1["access_token"].as_str().unwrap()),
        )
        .json(&json!({ "color": "red", "gratitude": "ivan的玫瑰" }))
        .send()
        .await
        .unwrap();
    let rose: Value = res.json().await.unwrap();
    let rose_id = rose["id"].as_str().unwrap();

    let res = client
        .delete(format!("{}/api/rose/{}", base, rose_id))
        .header(
            "Authorization",
            format!("Bearer {}", auth2["access_token"].as_str().unwrap()),
        )
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_delete_rose_not_found() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "kate").await;
    let client = reqwest::Client::new();

    let res = client
        .delete(format!(
            "{}/api/rose/00000000-0000-0000-0000-000000000000",
            base
        ))
        .header(
            "Authorization",
            format!("Bearer {}", auth["access_token"].as_str().unwrap()),
        )
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_my_roses_requires_auth() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();
    let res = client.get(format!("{}/api/my/roses", base)).send().await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_my_roses_only_own() {
    let base = spawn_test_server().await;
    let auth1 = register_user(&base, "owner").await;
    let auth2 = register_user(&base, "other").await;
    let client = reqwest::Client::new();

    for i in 0..2 {
        client
            .post(format!("{}/api/rose", base))
            .header(
                "Authorization",
                format!("Bearer {}", auth1["access_token"].as_str().unwrap()),
            )
            .json(&json!({ "color": "red", "gratitude": format!("owner rose {}", i) }))
            .send()
            .await
            .unwrap();
    }

    client
        .post(format!("{}/api/rose", base))
        .header(
            "Authorization",
            format!("Bearer {}", auth2["access_token"].as_str().unwrap()),
        )
        .json(&json!({ "color": "white", "gratitude": "other rose" }))
        .send()
        .await
        .unwrap();

    let res = client
        .get(format!("{}/api/my/roses", base))
        .header(
            "Authorization",
            format!("Bearer {}", auth1["access_token"].as_str().unwrap()),
        )
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["total"], 2);
    assert_eq!(body["data"].as_array().unwrap().len(), 2);

    let res = client
        .get(format!("{}/api/my/roses", base))
        .header(
            "Authorization",
            format!("Bearer {}", auth2["access_token"].as_str().unwrap()),
        )
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["total"], 1);
    assert_eq!(body["data"].as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn test_my_roses_empty() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "lonely").await;
    let client = reqwest::Client::new();

    let res = client
        .get(format!("{}/api/my/roses", base))
        .header(
            "Authorization",
            format!("Bearer {}", auth["access_token"].as_str().unwrap()),
        )
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["total"], 0);
    assert!(body["data"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn test_my_roses_pagination() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "gardener").await;
    let client = reqwest::Client::new();

    for i in 0..5 {
        client
            .post(format!("{}/api/rose", base))
            .header(
                "Authorization",
                format!("Bearer {}", auth["access_token"].as_str().unwrap()),
            )
            .json(&json!({ "color": "red", "gratitude": format!("rose {}", i) }))
            .send()
            .await
            .unwrap();
    }

    let res = client
        .get(format!("{}/api/my/roses?page=1&per_page=2", base))
        .header(
            "Authorization",
            format!("Bearer {}", auth["access_token"].as_str().unwrap()),
        )
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["total"], 5);
    assert_eq!(body["data"].as_array().unwrap().len(), 2);
    assert_eq!(body["page"], 1);
    assert_eq!(body["per_page"], 2);
}

#[tokio::test]
async fn test_rose_includes_nickname() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "planter").await;
    let client = reqwest::Client::new();

    let res = client
        .post(format!("{}/api/rose", base))
        .header(
            "Authorization",
            format!("Bearer {}", auth["access_token"].as_str().unwrap()),
        )
        .json(&json!({ "color": "red", "gratitude": "test nickname" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let rose: Value = res.json().await.unwrap();
    assert_eq!(rose["nickname"], "planter");

    let rose_id = rose["id"].as_str().unwrap();
    let res = client.get(format!("{}/api/rose/{}", base, rose_id)).send().await.unwrap();
    let rose: Value = res.json().await.unwrap();
    assert_eq!(rose["nickname"], "planter");
}

#[tokio::test]
async fn test_garden_includes_nickname() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "gardener").await;
    let client = reqwest::Client::new();

    client
        .post(format!("{}/api/rose", base))
        .header(
            "Authorization",
            format!("Bearer {}", auth["access_token"].as_str().unwrap()),
        )
        .json(&json!({ "color": "yellow", "gratitude": "garden test" }))
        .send()
        .await
        .unwrap();

    let res = client.get(format!("{}/api/garden", base)).send().await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    let roses = body["data"].as_array().unwrap();
    assert_eq!(roses.len(), 1);

    let named = roses.iter().find(|r| r["nickname"] == "gardener").unwrap();
    assert_eq!(named["gratitude"], "garden test");
}

#[tokio::test]
async fn test_garden_filter_by_color() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "filter_test").await;
    let token = auth["access_token"].as_str().unwrap();
    let client = reqwest::Client::new();

    client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "color": "red", "gratitude": "r1" }))
        .send()
        .await
        .unwrap();
    client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "color": "red", "gratitude": "r2" }))
        .send()
        .await
        .unwrap();
    client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "color": "white", "gratitude": "w1" }))
        .send()
        .await
        .unwrap();

    let res = client.get(format!("{}/api/garden?color=red", base)).send().await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["total"], 2);
    assert_eq!(body["data"].as_array().unwrap().len(), 2);

    let res = client.get(format!("{}/api/garden?color=white", base)).send().await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["total"], 1);

    let res = client.get(format!("{}/api/garden?color=yellow", base)).send().await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["total"], 0);

    let res = client.get(format!("{}/api/garden?color=blue", base)).send().await.unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_user_profile() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "profiler").await;
    let token = auth["access_token"].as_str().unwrap();
    let client = reqwest::Client::new();

    client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "color": "red", "gratitude": "r1" }))
        .send()
        .await
        .unwrap();
    client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "color": "red", "gratitude": "r2" }))
        .send()
        .await
        .unwrap();
    client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "color": "white", "gratitude": "w1" }))
        .send()
        .await
        .unwrap();

    let res = client
        .get(format!("{}/api/user/profile", base))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["user"]["nickname"], "profiler");
    assert_eq!(body["total_roses"], 3);
    assert_eq!(body["red_count"], 2);
    assert_eq!(body["white_count"], 1);
    assert_eq!(body["yellow_count"], 0);
}

#[tokio::test]
async fn test_user_profile_no_auth() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();
    let res = client.get(format!("{}/api/user/profile", base)).send().await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_like_and_unlike() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "liker").await;
    let token = auth["access_token"].as_str().unwrap();
    let client = reqwest::Client::new();

    let res = client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "color": "red", "gratitude": "likeable" }))
        .send()
        .await
        .unwrap();
    let rose: Value = res.json().await.unwrap();
    let rose_id = rose["id"].as_str().unwrap();

    let res = client
        .post(format!("{}/api/rose/{}/like", base, rose_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["liked"], true);
    assert_eq!(body["like_count"], 1);

    let res = client
        .post(format!("{}/api/rose/{}/like", base, rose_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["liked"], false);
    assert_eq!(body["like_count"], 0);
}

#[tokio::test]
async fn test_like_no_auth() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();

    let res = client
        .post(format!("{}/api/rose/{}/like", base, Uuid::nil()))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_garden_includes_like_count() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "fan").await;
    let token = auth["access_token"].as_str().unwrap();
    let client = reqwest::Client::new();

    let res = client
        .post(format!("{}/api/rose", base))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "color": "yellow", "gratitude": "popular" }))
        .send()
        .await
        .unwrap();
    let rose: Value = res.json().await.unwrap();
    let rose_id = rose["id"].as_str().unwrap();

    client
        .post(format!("{}/api/rose/{}/like", base, rose_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    let res = client.get(format!("{}/api/garden", base)).send().await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["data"][0]["like_count"], 1);
}

#[tokio::test]
async fn test_feedback_authenticated() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "feedbacker").await;
    let client = reqwest::Client::new();

    // 登录用户提交反馈，返回 201 并包含 id
    let res = client
        .post(format!("{}/api/feedback", base))
        .header(
            "Authorization",
            format!("Bearer {}", auth["access_token"].as_str().unwrap()),
        )
        .json(&json!({ "content": "功能很棒，期待更多特性" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body: Value = res.json().await.unwrap();
    assert!(body["id"].is_number());
}

#[tokio::test]
async fn test_feedback_anonymous() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();

    // 匿名用户（无 token）提交反馈，同样成功
    let res = client
        .post(format!("{}/api/feedback", base))
        .json(&json!({ "content": "匿名反馈内容" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body: Value = res.json().await.unwrap();
    assert!(body["id"].is_number());
}

#[tokio::test]
async fn test_feedback_too_short() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();

    // 反馈内容过短
    let res = client
        .post(format!("{}/api/feedback", base))
        .json(&json!({ "content": "太短" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    let body: Value = res.json().await.unwrap();
    assert!(body["error"].is_string());
    assert!(body["error"].as_str().unwrap().contains("至少 5 个字"));
}

#[tokio::test]
async fn test_feedback_too_long() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();

    // 反馈内容过长
    let long_content = "a".repeat(501);
    let res = client
        .post(format!("{}/api/feedback", base))
        .json(&json!({ "content": long_content }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    let body: Value = res.json().await.unwrap();
    assert!(body["error"].is_string());
    assert!(body["error"].as_str().unwrap().contains("不超过 500 字"));
}

#[tokio::test]
async fn test_feedback_empty_content() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();

    // 反馈内容为空
    let res = client
        .post(format!("{}/api/feedback", base))
        .json(&json!({ "content": "" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    let body: Value = res.json().await.unwrap();
    assert!(body["error"].is_string());
    assert!(body["error"].as_str().unwrap().contains("至少 5 个字"));
}

#[tokio::test]
async fn test_feedback_whitespace_only() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();

    // 反馈内容只有空白字符
    let res = client
        .post(format!("{}/api/feedback", base))
        .json(&json!({ "content": "   \n\t  " }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    let body: Value = res.json().await.unwrap();
    assert!(body["error"].is_string());
    assert!(body["error"].as_str().unwrap().contains("至少 5 个字"));
}

#[tokio::test]
async fn test_feedback_malformed_json() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();

    // JSON 格式错误
    let res = client
        .post(format!("{}/api/feedback", base))
        .header("Content-Type", "application/json")
        .body("{ invalid json }")
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_feedback_no_content_field() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();

    // 缺少 content 字段
    let res = client
        .post(format!("{}/api/feedback", base))
        .json(&json!({ "message": "缺少 content 字段" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}

// ── Refresh / Logout 集成测试 ──

#[tokio::test]
async fn test_refresh_success() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "refresh-test").await;
    let refresh_token = auth["refresh_token"].as_str().unwrap();

    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/auth/refresh", base))
        .json(&json!({ "refresh_token": refresh_token }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    let new_access_token = body["access_token"].as_str().unwrap();
    assert!(!new_access_token.is_empty());
    // 验证新 token 也可用于认证
    let profile_res = client
        .get(format!("{}/api/user/profile", base))
        .header("Authorization", format!("Bearer {}", new_access_token))
        .send()
        .await
        .unwrap();
    assert_eq!(profile_res.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_refresh_invalid_token() {
    let base = spawn_test_server().await;

    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/auth/refresh", base))
        .json(&json!({ "refresh_token": "not-a-valid-uuid" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_refresh_after_logout() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "logout-refresh").await;
    let access_token = auth["access_token"].as_str().unwrap();
    let refresh_token = auth["refresh_token"].as_str().unwrap();

    let client = reqwest::Client::new();

    // 登出
    let res = client
        .post(format!("{}/api/auth/logout", base))
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 登出后用旧 refresh_token 刷新应失败
    let res = client
        .post(format!("{}/api/auth/refresh", base))
        .json(&json!({ "refresh_token": refresh_token }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_logout_success() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "logout-test").await;
    let refresh_token = auth["refresh_token"].as_str().unwrap();

    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/auth/logout", base))
        .header("Authorization", format!("Bearer {}", refresh_token))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert!(body["success"].as_bool().unwrap());
}

#[tokio::test]
async fn test_logout_no_token() {
    let base = spawn_test_server().await;

    let client = reqwest::Client::new();
    let res = client.post(format!("{}/api/auth/logout", base)).send().await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_logout_expired_token() {
    let base = spawn_test_server().await;

    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/auth/logout", base))
        .header("Authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJuaWNrbmFtZSI6ImZha2UiLCJleHAiOjk5OTk5OTk5OTl9.invalid-signature")
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_deactivate_account_revokes_access_and_hides_profile() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "deactivate-me").await;
    let access_token = auth["access_token"].as_str().unwrap();
    let refresh_token = auth["refresh_token"].as_str().unwrap();

    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/auth/deactivate", base))
        .header("Authorization", format!("Bearer {}", access_token))
        .json(&json!({ "reason": "user_requested" }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["success"], true);
    assert!(body["restore_deadline"].as_str().is_some());

    let profile_res = client
        .get(format!("{}/api/user/profile", base))
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await
        .unwrap();
    assert_eq!(profile_res.status(), StatusCode::UNAUTHORIZED);

    let refresh_res = client
        .post(format!("{}/api/auth/refresh", base))
        .json(&json!({ "refresh_token": refresh_token }))
        .send()
        .await
        .unwrap();
    assert_eq!(refresh_res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_register_restores_deleted_user_within_cooldown() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "phoenix").await;
    let user_id = auth["user"]["id"].as_str().unwrap().to_string();
    let access_token = auth["access_token"].as_str().unwrap();

    let client = reqwest::Client::new();
    let deactivate = client
        .post(format!("{}/api/auth/deactivate", base))
        .header("Authorization", format!("Bearer {}", access_token))
        .json(&json!({ "reason": "user_requested" }))
        .send()
        .await
        .unwrap();
    assert_eq!(deactivate.status(), StatusCode::OK);

    let restored = client
        .post(format!("{}/api/auth/register", base))
        .json(&json!({ "nickname": "phoenix" }))
        .send()
        .await
        .unwrap();
    assert_eq!(restored.status(), StatusCode::CREATED);
    let body: Value = restored.json().await.unwrap();
    assert_eq!(body["user"]["id"], user_id);
    assert!(body["user"]["deleted_at"].is_null());
}

#[tokio::test]
async fn test_register_creates_new_user_after_cooldown_finalization() {
    let (app, pool) = create_test_app().await;
    let old_id: Uuid = sqlx::query_scalar("INSERT INTO users (nickname, deleted_at) VALUES ($1, now() - interval '31 days') RETURNING id")
        .bind("expired-user")
        .fetch_one(&pool)
        .await
        .unwrap();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&json!({ "nickname": "expired-user" })).unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let auth: Value = serde_json::from_slice(&body).unwrap();
    let new_id = Uuid::parse_str(auth["user"]["id"].as_str().unwrap()).unwrap();
    assert_ne!(new_id, old_id);

    let renamed: String = sqlx::query_scalar("SELECT nickname FROM users WHERE id = $1")
        .bind(old_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(renamed.starts_with("匿名用户-"));
}

// ── Health / Swagger / OpenAPI 集成测试 ──

#[tokio::test]
async fn test_health_check() {
    let (app, _) = create_test_app().await;
    let response = app
        .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let result: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(result["status"], "ok");
    assert_eq!(result["database"], "healthy");
    assert!(result["version"].as_str().is_some());
}

#[tokio::test]
async fn test_health_check_reqwest() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();
    let res = client.get(format!("{}/health", base)).send().await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["status"], "ok");
    assert_eq!(body["database"], "healthy");
}

#[tokio::test]
async fn test_swagger_ui_returns_html() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();
    let res = client.get(format!("{}/swagger", base)).send().await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = res.text().await.unwrap();
    assert!(body.contains("<html"));
    assert!(body.contains("swagger"));
}

#[tokio::test]
async fn test_openapi_json() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();
    let res = client.get(format!("{}/api/openapi.json", base)).send().await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert!(body["openapi"].as_str().is_some());
    assert!(body["info"].is_object());
    assert!(body["paths"].is_object());
}

#[tokio::test]
async fn test_openapi_json_paths() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();
    let res = client.get(format!("{}/api/openapi.json", base)).send().await.unwrap();
    let body: Value = res.json().await.unwrap();
    assert!(body["paths"]["/auth/register"].is_object());
    assert!(body["paths"]["/rose"].is_object());
    assert!(body["paths"]["/garden"].is_object());
    assert!(body["paths"]["/feedback"].is_object());
}
