use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;
use thiserror::Error;

/// 应用错误类型
#[derive(Debug, Error)]
pub enum AppError {
    #[error("资源不存在")]
    NotFound,

    #[error("无权操作")]
    Forbidden,

    #[error("{0}")]
    BadRequest(String),

    #[error("数据库错误: {0}")]
    Database(#[from] sqlx::Error),

    #[error("认证错误: {0}")]
    Auth(String),

    #[error("{0}")]
    Internal(String),

    /// A feature is intentionally unavailable (e.g. optional IPFS credentials
    /// not configured). Unlike `Internal`, the message is safe to show users.
    #[error("{0}")]
    ServiceUnavailable(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::NotFound => (StatusCode::NOT_FOUND, self.to_string()),
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            AppError::Forbidden => (StatusCode::FORBIDDEN, self.to_string()),
            AppError::Database(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "服务器内部错误".to_string(),
            ),
            AppError::Auth(_) => (StatusCode::UNAUTHORIZED, self.to_string()),
            AppError::Internal(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "服务器内部错误".to_string(),
            ),
            AppError::ServiceUnavailable(_) => (StatusCode::SERVICE_UNAVAILABLE, self.to_string()),
        };

        (status, Json(json!({ "error": message }))).into_response()
    }
}

/// True when a `sqlx` error is a unique-constraint violation.
///
/// The on-chain reference endpoints check "is this rose / mint already
/// recorded?" and then insert. Two concurrent requests can both pass that
/// check, so the unique index is the real guarantee — the equivalent of
/// Anchor's atomic `init`. Recognising the violation lets the loser of the race
/// get a 400 ("already recorded") instead of a 500.
pub fn is_unique_violation(err: &sqlx::Error) -> bool {
    err.as_database_error().map(|e| e.is_unique_violation()).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;

    #[tokio::test]
    async fn test_not_found_response() {
        let resp = AppError::NotFound.into_response();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
        let body = to_bytes(resp.into_body(), 1024).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["error"], "资源不存在");
    }

    #[tokio::test]
    async fn test_forbidden_response() {
        let resp = AppError::Forbidden.into_response();
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
        let body = to_bytes(resp.into_body(), 1024).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["error"], "无权操作");
    }

    #[tokio::test]
    async fn test_bad_request_response() {
        let resp = AppError::BadRequest("invalid input".to_string()).into_response();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(resp.into_body(), 1024).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["error"], "invalid input");
    }

    #[tokio::test]
    async fn test_auth_error_response() {
        let resp = AppError::Auth("token expired".to_string()).into_response();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
        let body = to_bytes(resp.into_body(), 1024).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert!(json["error"].as_str().unwrap().contains("token expired"));
    }

    #[test]
    fn test_error_display() {
        assert_eq!(AppError::NotFound.to_string(), "资源不存在");
        assert_eq!(AppError::Forbidden.to_string(), "无权操作");
        assert_eq!(AppError::BadRequest("x".to_string()).to_string(), "x");
        assert!(AppError::Auth("y".to_string()).to_string().contains("y"));
    }
}
