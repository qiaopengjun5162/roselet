use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

/// 应用错误类型
pub struct AppError(pub anyhow::Error);

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let error_msg = self.0.to_string();

        // 区分验证错误和服务器错误
        if error_msg.starts_with("Invalid") || error_msg.starts_with("At least") {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": error_msg })),
            )
                .into_response()
        } else {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Internal server error" })),
            )
                .into_response()
        }
    }
}

impl<E> From<E> for AppError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}
