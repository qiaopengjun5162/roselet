//! Solana on-chain references for roses (membership / Web3 mode).
//!
//! The backend only ever stores a *reference* to what the user put on-chain:
//! the transaction signature, the on-chain account, the wallet that signed,
//! an optional IPFS CID for an image, and the metadata the client claimed.
//! It never touches the user's private key — signing happens in the wallet
//! (browser / client) and the result is posted here. On-chain verification
//! (checking the tx against a Solana RPC + program) is a later step.
//!
//! This intentionally mirrors `on_chain.rs` (Base Sepolia) but uses base58
//! (Solana) identifiers and a separate `solana_mints` table.

use axum::Json;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth;
use crate::error::AppError;
use crate::models::rose::Rose;
use crate::state::AppState;

// Bitcoin/Solana base58 alphabet (excludes 0 O I l).
const BASE58_CHARS: &[u8] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

#[derive(Debug, Deserialize)]
pub struct RecordSolanaMint {
    /// Transaction signature (base58, ~88 chars).
    pub signature: String,
    /// On-chain account the data was written to (base58, ~44 chars).
    pub account: String,
    /// Wallet that signed / owns the on-chain record (base58, ~44 chars).
    pub wallet_address: String,
    /// Optional IPFS CID of an image stored off-chain.
    #[serde(default)]
    pub ipfs_cid: Option<String>,
    /// Metadata the client claimed on-chain (rose color, message, etc.).
    pub on_chain_metadata: JsonValue,
}

impl RecordSolanaMint {
    fn validate(&self) -> Result<(), String> {
        if normalize_base58(&self.signature, 86, 88).is_none() {
            return Err("交易签名格式不正确（应为 base58）".into());
        }
        if normalize_base58(&self.account, 32, 44).is_none() {
            return Err("链上账户格式不正确（应为 base58）".into());
        }
        if normalize_base58(&self.wallet_address, 32, 44).is_none() {
            return Err("钱包地址格式不正确（应为 base58）".into());
        }
        if !self.on_chain_metadata.is_object() || self.on_chain_metadata.as_object().map(|o| o.is_empty()).unwrap_or(true) {
            return Err("链上元数据必须是一个非空 JSON 对象".into());
        }
        if let Some(cid) = &self.ipfs_cid {
            let cid = cid.trim();
            if cid.is_empty() || cid.len() > 120 {
                return Err("IPFS CID 格式不正确".into());
            }
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SolanaMint {
    pub signature: String,
    pub account: String,
    pub wallet_address: String,
    pub ipfs_cid: Option<String>,
    pub on_chain_metadata: JsonValue,
    pub minted_at: DateTime<Utc>,
}

pub async fn get_solana_mint(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<Option<SolanaMint>>, AppError> {
    let rose = load_visible_rose(&state.pool, &headers, &state.config.jwt_secret, id).await?;
    if rose.is_private {
        return Err(AppError::NotFound);
    }

    let mint = sqlx::query_as::<_, SolanaMint>(
        "SELECT signature, account, wallet_address, ipfs_cid, on_chain_metadata, minted_at
         FROM solana_mints WHERE rose_id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?;
    Ok(Json(mint))
}

pub async fn record_solana_mint(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(input): Json<RecordSolanaMint>,
) -> Result<Json<SolanaMint>, AppError> {
    input.validate().map_err(AppError::BadRequest)?;
    let user_id = auth::require_active_user_id(&state.pool, &headers, &state.jwt_secret).await?;
    let rose = sqlx::query_as::<_, Rose>("SELECT * FROM roses WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;

    if rose.user_id != Some(user_id) {
        return Err(AppError::Forbidden);
    }
    if rose.is_private {
        return Err(AppError::BadRequest("私密玫瑰不能创建 Solana 链上记录".into()));
    }

    let existing: Option<Uuid> =
        sqlx::query_scalar("SELECT rose_id FROM solana_mints WHERE rose_id = $1")
            .bind(id)
            .fetch_optional(&state.pool)
            .await?;
    if existing.is_some() {
        return Err(AppError::BadRequest("这朵玫瑰已有 Solana 链上记录".into()));
    }

    let signature = normalize_base58(&input.signature, 86, 88).expect("validated signature");
    let account = normalize_base58(&input.account, 32, 44).expect("validated account");
    let wallet_address =
        normalize_base58(&input.wallet_address, 32, 44).expect("validated wallet address");
    let ipfs_cid = input.ipfs_cid.as_ref().map(|c| c.trim().to_string());

    let duplicate: Option<Uuid> =
        sqlx::query_scalar("SELECT rose_id FROM solana_mints WHERE signature = $1")
            .bind(&signature)
            .fetch_optional(&state.pool)
            .await?;
    if duplicate.is_some() {
        return Err(AppError::BadRequest("这笔交易已被记录".into()));
    }

    let mint = sqlx::query_as::<_, SolanaMint>(
        "INSERT INTO solana_mints
         (rose_id, signature, account, wallet_address, ipfs_cid, on_chain_metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING signature, account, wallet_address, ipfs_cid, on_chain_metadata, minted_at",
    )
    .bind(id)
    .bind(signature)
    .bind(account)
    .bind(wallet_address)
    .bind(ipfs_cid)
    .bind(&input.on_chain_metadata)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(mint))
}

async fn load_visible_rose(
    pool: &PgPool,
    headers: &HeaderMap,
    jwt_secret: &str,
    id: Uuid,
) -> Result<Rose, AppError> {
    let rose = sqlx::query_as::<_, Rose>("SELECT * FROM roses WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound)?;

    if rose.is_private {
        let user_id = auth::get_active_user_id(pool, headers, jwt_secret.as_bytes()).await?;
        let is_recipient = user_id.is_some()
            && rose.recipient_user_id.is_some()
            && user_id == rose.recipient_user_id;
        if user_id != rose.user_id && !is_recipient {
            return Err(AppError::NotFound);
        }
    }
    Ok(rose)
}

/// Normalize a Solana base58 identifier: trim, validate charset, lowercase
/// (base58 is case-sensitive but we keep it canonical by trimming only).
fn normalize_base58(value: &str, min_len: usize, max_len: usize) -> Option<String> {
    let value = value.trim();
    let bytes = value.as_bytes();
    if bytes.len() < min_len || bytes.len() > max_len {
        return None;
    }
    if !bytes.iter().all(|b| BASE58_CHARS.contains(b)) {
        return None;
    }
    Some(value.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // 44-char base58 address (valid Solana-style charset, correct length band).
    const ADDR: &str = "5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCkP2UJnM";

    #[test]
    fn accepts_valid_base58_address_and_signature() {
        assert_eq!(ADDR.len(), 44);
        assert_eq!(normalize_base58(ADDR, 32, 44), Some(ADDR.to_string()));
        // Signature is the address repeated twice => 88 chars.
        let sig = ADDR.repeat(2);
        assert_eq!(sig.len(), 88);
        assert_eq!(normalize_base58(&sig, 86, 88), Some(sig.clone()));
    }

    #[test]
    fn rejects_non_base58_and_wrong_length() {
        // Contains '0' and 'O' which are not in the base58 alphabet.
        assert!(normalize_base58("0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O", 32, 44).is_none());
        // Too short for a signature.
        assert!(normalize_base58("abc", 86, 88).is_none());
    }

    #[test]
    fn validate_rejects_empty_metadata_and_bad_cid() {
        let mut input = RecordSolanaMint {
            signature: ADDR.repeat(2),
            account: ADDR.to_string(),
            wallet_address: ADDR.to_string(),
            ipfs_cid: None,
            on_chain_metadata: JsonValue::Object(Default::default()),
        };
        assert!(input.validate().is_err()); // empty metadata object

        input.on_chain_metadata = serde_json::json!({"color": "red", "message": "hi"});
        assert!(input.validate().is_ok());

        input.ipfs_cid = Some("x".repeat(200));
        assert!(input.validate().is_err()); // CID too long
    }
}
