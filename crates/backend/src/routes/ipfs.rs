//! IPFS image upload proxy (membership / Web3 mode).
//!
//! The browser uploads an image to this backend as `multipart/form-data`; the
//! backend forwards it to a pinning service (Pinata) using a **server-side**
//! JWT. The credential never reaches the browser, and the client only receives
//! the resulting CID, which it can put into a Solana Memo transaction and store
//! via `/api/rose/{id}/solana`.
//!
//! When `PINATA_JWT` is not configured the route returns 503 with an actionable
//! message; the UI then falls back to letting the user type an existing CID.

use axum::Json;
use axum::extract::{Multipart, State};
use axum::http::HeaderMap;
use serde::Serialize;
use serde_json::Value as JsonValue;
use std::sync::LazyLock;
use std::time::Duration;

use crate::auth;
use crate::error::AppError;
use crate::state::AppState;

/// Max accepted image size (5 MiB). Rejected before hitting the pinning service.
pub const MAX_IMAGE_BYTES: usize = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES: [&str; 4] = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const IPFS_GATEWAY: &str = "https://gateway.pinata.cloud/ipfs";

static HTTP_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .expect("failed to build IPFS upload HTTP client")
});

#[derive(Debug, Serialize)]
pub struct IpfsUploadResponse {
    pub cid: String,
    pub gateway_url: String,
}

/// `POST /api/ipfs/upload` — authenticate, validate, pin, return the CID.
pub async fn upload_image(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<IpfsUploadResponse>, AppError> {
    // Pinning quota is paid for by Roselet, so require a logged-in, active user.
    auth::require_active_user_id(&state.pool, &headers, &state.jwt_secret).await?;

    let jwt = state.config.pinata_jwt.as_deref().ok_or_else(|| {
        AppError::ServiceUnavailable(
            "图片上传服务未配置（PINATA_JWT）；请手动填写图片 CID，或让管理员配置后重试".into(),
        )
    })?;

    // Only the first `file` field is used; any extra fields are ignored.
    let mut uploaded: Option<(String, String, Vec<u8>)> = None;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("上传数据解析失败: {e}")))?
    {
        if field.name() == Some("file") {
            let content_type =
                field.content_type().unwrap_or("application/octet-stream").to_string();
            let filename = field.file_name().unwrap_or("image").to_string();
            let bytes = field
                .bytes()
                .await
                .map_err(|e| AppError::BadRequest(format!("读取图片失败: {e}")))?
                .to_vec();
            uploaded = Some((content_type, filename, bytes));
            break;
        }
    }

    let (content_type, filename, bytes) =
        uploaded.ok_or_else(|| AppError::BadRequest("缺少 file 字段".into()))?;
    validate_upload(&content_type, bytes.len())?;
    let safe_name = sanitize_filename(&filename);

    let part = reqwest::multipart::Part::bytes(bytes)
        .file_name(safe_name.clone())
        .mime_str(&content_type)
        .map_err(|_| AppError::Internal("invalid image mime type".into()))?;
    let form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("network", "public")
        .text("name", safe_name);

    let response = HTTP_CLIENT
        .post(&state.config.pinata_upload_url)
        .bearer_auth(jwt)
        .multipart(form)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("IPFS 上传请求失败: {e}")))?;

    let status = response.status();
    let body: JsonValue = response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("IPFS 返回解析失败: {e}")))?;
    if !status.is_success() {
        return Err(AppError::BadRequest(format!(
            "IPFS 服务返回 {status}: {}",
            body.get("error").and_then(|v| v.as_str()).unwrap_or("未知错误")
        )));
    }

    let cid =
        parse_cid(&body).ok_or_else(|| AppError::Internal("IPFS 返回中缺少有效 CID".into()))?;

    Ok(Json(IpfsUploadResponse {
        gateway_url: format!("{IPFS_GATEWAY}/{cid}"),
        cid,
    }))
}

/// Validate the declared mime type and decoded size. Pure function: unit
/// tested without any network or database.
fn validate_upload(content_type: &str, size: usize) -> Result<(), AppError> {
    let base = content_type.split(';').next().unwrap_or("").trim().to_ascii_lowercase();
    if !ALLOWED_IMAGE_TYPES.contains(&base.as_str()) {
        return Err(AppError::BadRequest(format!(
            "仅支持 PNG / JPEG / WebP / GIF 图片，收到：{content_type}"
        )));
    }
    if size == 0 {
        return Err(AppError::BadRequest("图片内容为空".into()));
    }
    if size > MAX_IMAGE_BYTES {
        return Err(AppError::BadRequest("图片不能超过 5 MiB".into()));
    }
    Ok(())
}

/// Keep only a conservative filename charset; strip path separators and dots
/// used for traversal before handing the name to the pinning service.
fn sanitize_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
        .take(80)
        .collect();
    let trimmed = cleaned.trim_matches('.');
    if trimmed.is_empty() {
        "rose-image".to_string()
    } else {
        trimmed.to_string()
    }
}

/// Pinata v3 returns `{ data: { cid } }` (some versions `{ cid }`); the classic
/// `pinFileToIPFS` endpoint returns `{ IpfsHash }`. Accept all three, and only
/// accept plausible CIDv0/CIDv1 strings so a malformed upstream response can't
/// be stored as an "on-chain" reference.
fn parse_cid(body: &JsonValue) -> Option<String> {
    let raw = body
        .pointer("/data/cid")
        .or_else(|| body.get("cid"))
        .or_else(|| body.get("IpfsHash"))
        .and_then(|v| v.as_str())?
        .trim();
    if raw.is_empty() || raw.len() > 120 {
        return None;
    }
    let plausible_prefix = raw.starts_with("baf") || raw.starts_with("Qm");
    if !plausible_prefix || !raw.chars().all(|c| c.is_ascii_alphanumeric()) {
        return None;
    }
    Some(raw.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_upload_accepts_images_and_rejects_others() {
        assert!(validate_upload("image/png", 1024).is_ok());
        assert!(validate_upload("image/jpeg; charset=binary", 1024).is_ok());
        assert!(validate_upload("image/webp", MAX_IMAGE_BYTES).is_ok());
        assert!(validate_upload("text/html", 1024).is_err());
        assert!(validate_upload("application/octet-stream", 1024).is_err());
        assert!(validate_upload("image/png", 0).is_err());
        assert!(validate_upload("image/png", MAX_IMAGE_BYTES + 1).is_err());
    }

    #[test]
    fn sanitize_filename_strips_paths_and_unsafe_chars() {
        assert_eq!(sanitize_filename("../../etc/passwd.png"), "etcpasswd.png");
        assert_eq!(sanitize_filename("rose photo #1.png"), "rosephoto1.png");
        assert_eq!(sanitize_filename(""), "rose-image");
        assert_eq!(sanitize_filename("..."), "rose-image");
    }

    #[test]
    fn parse_cid_accepts_all_pinata_response_shapes() {
        let cid = "bafybeihgxdzljxb26q6nf3r3eifqeedsvt2eubqtskghpme66cgjyw4fra";
        assert_eq!(
            parse_cid(&serde_json::json!({"data": {"cid": cid}})).as_deref(),
            Some(cid)
        );
        assert_eq!(
            parse_cid(&serde_json::json!({"cid": cid})).as_deref(),
            Some(cid)
        );
        assert_eq!(
            parse_cid(&serde_json::json!({"IpfsHash": "QmYwAPJzv5CZsnAzt8auVZRnGiVzYQ"}))
                .as_deref(),
            Some("QmYwAPJzv5CZsnAzt8auVZRnGiVzYQ")
        );
    }

    #[test]
    fn parse_cid_rejects_missing_malformed_and_injected_values() {
        assert!(parse_cid(&serde_json::json!({})).is_none());
        assert!(parse_cid(&serde_json::json!({"cid": "not-a-cid"})).is_none());
        assert!(parse_cid(&serde_json::json!({"cid": "bafy/../../evil"})).is_none());
        assert!(parse_cid(&serde_json::json!({"cid": "bafy space"})).is_none());
        assert!(parse_cid(&serde_json::json!({"cid": "b".repeat(200)})).is_none());
    }
}
