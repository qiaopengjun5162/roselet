//! Solana on-chain references for roses (membership / Web3 mode).
//!
//! The backend only ever stores a *reference* to what the user put on-chain:
//! the transaction signature, the on-chain account, the wallet that signed,
//! an optional IPFS CID for an image, and the metadata the client claimed.
//! It never touches the user's private key — signing happens in the wallet
//! (browser / client) and the result is posted here.
//!
//! When `SOLANA_RPC_URL` is configured, the backend verifies the posted
//! transaction against a Solana RPC before storing it: it checks the tx
//! actually exists, its first signature matches what the client sent, its
//! fee payer is the claimed wallet, and it invoked the Memo program. This
//! prevents storing fabricated "on-chain" references. When the env var is
//! unset the check is skipped (dev / offline fallback).
//!
//! Verification waits for `finalized` commitment (a transaction that gets
//! reorged away on mainnet must never be stored as a mint reference) and
//! retries transient RPC failures / the brief not-yet-finalized window
//! instead of rejecting a legitimate mint. Semantic mismatches (wrong
//! signature / wallet / non-Memo / replay) are permanent and never retried.
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
use std::sync::LazyLock;
use tracing;
use uuid::Uuid;

use crate::auth;
use crate::error::AppError;
use crate::models::rose::Rose;
use crate::state::AppState;

/// Known SPL Memo program ids. `MemoSq4gq…` is the canonical v1/v2 program
/// used by the frontend and by Solana's own docs; `MemoSqLa…` is the v3
/// variant. Accept both so a tx built with either still verifies.
const MEMO_PROGRAM_IDS: [&str; 2] = [
    "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
    "MemoSqLaHNF36X2uS2FgoesJdziWCDCmHsu9wHHNfn9r",
];

static HTTP_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .expect("failed to build Solana RPC HTTP client")
});

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

    // Verify the transaction really exists on Solana before storing the
    // reference. Skipped (dev / offline fallback) when SOLANA_RPC_URL is unset;
    // production MUST set it, otherwise fabricated references can be stored.
    if let Some(rpc_url) = state.config.solana_rpc_url.as_deref() {
        verify_solana_mint(rpc_url, &signature, &wallet_address, &id.to_string()).await?;
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

/// How many times we try to fetch a tx from the RPC before giving up. A
/// freshly submitted mainnet tx may take a moment to reach `finalized`
/// commitment or to become visible, and public RPCs are rate-limited, so we
/// retry transient failures instead of rejecting a legitimate mint.
const TX_FETCH_MAX_ATTEMPTS: u32 = 4;
/// Initial backoff between fetch attempts; doubled each retry, capped.
const TX_FETCH_BASE_BACKOFF: std::time::Duration = std::time::Duration::from_secs(1);
const TX_FETCH_MAX_BACKOFF: std::time::Duration = std::time::Duration::from_secs(4);

/// Classified outcome of inspecting one RPC `getTransaction` response.
#[derive(Debug)]
enum FetchOutcome<'a> {
    /// A transaction object was returned; still needs semantic verification.
    Found(&'a JsonValue),
    /// RPC returned `null`: tx not found yet or not yet finalized.
    NotFound,
    /// Transport / parse / RPC-error: transient, safe to retry.
    Retryable(String),
}

/// Inspect a parsed `getTransaction` JSON-RPC response and classify whether the
/// caller should treat it as a found tx, a not-yet-available tx, or a transient
/// failure. Pure (no network) so it can be unit-tested directly.
fn classify_rpc_response(response: &JsonValue) -> FetchOutcome<'_> {
    if let Some(err) = response.get("error") {
        if !err.is_null() {
            return FetchOutcome::Retryable(format!("Solana RPC 返回错误: {err}"));
        }
    }
    let result = response.get("result").unwrap_or(&JsonValue::Null);
    if result.is_null() {
        FetchOutcome::NotFound
    } else {
        FetchOutcome::Found(result)
    }
}

/// Ask a Solana RPC for `getTransaction` and verify the posted reference is
/// backed by a real, successful, wallet-signed Memo transaction.
///
/// Uses `finalized` commitment so a transaction that later gets reorged away
/// (rare but possible on mainnet) can never be stored as a mint reference. The
/// fetch is retried with backoff to ride out the brief window between signing
/// and finalization and transient RPC rate-limiting. Semantic verification
/// failures (wrong signature / wallet / non-Memo / replay) are permanent and
/// are *not* retried.
async fn verify_solana_mint(
    rpc_url: &str,
    signature: &str,
    wallet: &str,
    rose_id: &str,
) -> Result<(), AppError> {
    let mut backoff = TX_FETCH_BASE_BACKOFF;
    for attempt in 1..=TX_FETCH_MAX_ATTEMPTS {
        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getTransaction",
            "params": [signature, {
                "encoding": "jsonParsed",
                "commitment": "finalized",
                "maxSupportedTransactionVersion": 0
            }]
        });

        let response = match HTTP_CLIENT.post(rpc_url).json(&body).send().await {
            Ok(r) => r,
            Err(e) => {
                if attempt < TX_FETCH_MAX_ATTEMPTS {
                    tracing::warn!(attempt, "Solana RPC 请求失败，将重试核验: {e}");
                    sleep_backoff(backoff, &mut backoff).await;
                    continue;
                }
                return Err(AppError::Internal(format!("Solana RPC 请求失败: {e}")));
            }
        };

        let response = match response.json::<JsonValue>().await {
            Ok(r) => r,
            Err(e) => {
                if attempt < TX_FETCH_MAX_ATTEMPTS {
                    tracing::warn!(attempt, "Solana RPC 响应解析失败，将重试核验: {e}");
                    sleep_backoff(backoff, &mut backoff).await;
                    continue;
                }
                return Err(AppError::Internal(format!("Solana RPC 响应解析失败: {e}")));
            }
        };

        match classify_rpc_response(&response) {
            FetchOutcome::Found(result) => {
                // Permanent semantic check — never retried on failure.
                return verify_tx_result(result, signature, wallet, rose_id)
                    .map_err(AppError::BadRequest);
            }
            FetchOutcome::NotFound => {
                if attempt < TX_FETCH_MAX_ATTEMPTS {
                    tracing::debug!(attempt, "Solana 交易尚未最终确认，将重试核验");
                    sleep_backoff(backoff, &mut backoff).await;
                }
            }
            FetchOutcome::Retryable(msg) => {
                if attempt < TX_FETCH_MAX_ATTEMPTS {
                    tracing::warn!(attempt, "Solana RPC 暂不可用，将重试核验: {msg}");
                    sleep_backoff(backoff, &mut backoff).await;
                    continue;
                }
                return Err(AppError::Internal(format!("Solana RPC 核验失败: {msg}")));
            }
        }
    }

    Err(AppError::BadRequest(
        "链上暂时查不到这笔交易（可能尚未最终确认，请稍后重试）".into(),
    ))
}

/// Sleep for the current backoff, then double it (capped) for the next retry.
async fn sleep_backoff(current: std::time::Duration, store: &mut std::time::Duration) {
    tokio::time::sleep(current).await;
    *store = (*store * 2).min(TX_FETCH_MAX_BACKOFF);
}

/// Pure check over a `getTransaction` `result` object. Supports both
/// `encoding: jsonParsed` (accountKeys are objects, instructions carry
/// `programId`/`parsed`) and `encoding: json` (accountKeys are strings,
/// instructions carry `programIdIndex`). Kept network-free so it is unit
/// testable.
fn verify_tx_result(
    result: &JsonValue,
    signature: &str,
    wallet: &str,
    rose_id: &str,
) -> Result<(), String> {
    if result.is_null() {
        return Err("链上查不到这笔交易（签名不存在或尚未确认）".into());
    }
    if let Some(err) = result.pointer("/meta/err") {
        if !err.is_null() {
            return Err("链上交易执行失败".into());
        }
    }

    let signatures = result
        .pointer("/transaction/signatures")
        .and_then(|v| v.as_array())
        .ok_or("链上交易缺少签名字段")?;
    if signatures.first().and_then(|s| s.as_str()) != Some(signature) {
        return Err("交易签名与链上记录不一致".into());
    }

    // Solana guarantees accountKeys[0] is the fee payer and a required signer.
    let account_keys = result
        .pointer("/transaction/message/accountKeys")
        .and_then(|v| v.as_array())
        .ok_or("链上交易缺少 accountKeys")?;
    if account_keys.first().and_then(account_key_pubkey) != Some(wallet) {
        return Err("交易的付款账户与声明的钱包地址不一致".into());
    }

    let instructions = result
        .pointer("/transaction/message/instructions")
        .and_then(|v| v.as_array())
        .ok_or("链上交易缺少 instructions")?;
    let memo_ix = instructions
        .iter()
        .find(|ix| instruction_is_memo(ix, account_keys))
        .ok_or("交易未调用 Memo 程序，不是有效的上链记录")?;

    // When the RPC parsed the memo text, make sure it actually references
    // this rose — otherwise a previously-sent unrelated memo tx could be
    // replayed to claim a mint.
    if let Some(parsed) = memo_ix.get("parsed").and_then(|v| v.as_str()) {
        if !parsed.contains(rose_id) {
            return Err("链上记录内容与这朵玫瑰不匹配".into());
        }
    }
    Ok(())
}

fn account_key_pubkey(value: &JsonValue) -> Option<&str> {
    value
        .as_str()
        .or_else(|| value.get("pubkey").and_then(|p| p.as_str()))
}

fn instruction_is_memo(ix: &JsonValue, account_keys: &[JsonValue]) -> bool {
    let is_memo = |p: &str| MEMO_PROGRAM_IDS.contains(&p);
    if let Some(p) = ix.get("programId").and_then(|v| v.as_str()) {
        return is_memo(p);
    }
    if ix.get("program").and_then(|v| v.as_str()) == Some("spl-memo") {
        return true;
    }
    if let Some(idx) = ix.get("programIdIndex").and_then(|v| v.as_u64()) {
        if let Some(key) = account_keys.get(idx as usize).and_then(account_key_pubkey) {
            return is_memo(key);
        }
    }
    false
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

    const SIG: &str = "4Ny5cFGvHt4sB7vV9q2mSDcnL1pQxW8kRjA3eKuZ6bTfMhPdYsXcGwNoEaLrJiUvQ9zBtSkDpFhCmXnReWaTyUqZoLvGeJrHaKdNfBsMxQcPwEtYiUoLrTvZaGjHnDkFpSmCxWbQeAyUtViRoLpNkMdJfHsGzXcBvTaQeWyUrIoP";
    const WALLET: &str = "5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCkP2UJnM";
    const OTHER: &str = "9xQeWvG816bUx9EPfzHqYjpuNcM8sKtVrLdJaB2mZoSwRhCnDkFpTgEyAiUoXlMbQzWe";
    const ROSE_ID: &str = "550e8400-e29b-41d4-a716-446655440000";
    const MEMO: &str = MEMO_PROGRAM_IDS[0];

    /// A `getTransaction` result in `jsonParsed` form.
    fn parsed_tx(signature: &str, fee_payer: &str, program_id: &str, parsed: &str) -> JsonValue {
        serde_json::json!({
            "meta": {"err": null},
            "transaction": {
                "signatures": [signature],
                "message": {
                    "accountKeys": [
                        {"pubkey": fee_payer, "signer": true, "writable": true},
                        {"pubkey": program_id, "signer": false, "writable": false}
                    ],
                    "instructions": [{
                        "program": "spl-memo",
                        "programId": program_id,
                        "parsed": parsed
                    }]
                }
            }
        })
    }

    #[test]
    fn verify_accepts_valid_parsed_memo_tx() {
        let memo = format!("{{\"roseId\":\"{ROSE_ID}\",\"message\":\"hi\"}}");
        assert!(verify_tx_result(&parsed_tx(SIG, WALLET, MEMO, &memo), SIG, WALLET, ROSE_ID).is_ok());
        // The v3 Memo program id is accepted too.
        assert!(verify_tx_result(
            &parsed_tx(SIG, WALLET, MEMO_PROGRAM_IDS[1], &memo),
            SIG, WALLET, ROSE_ID
        )
        .is_ok());
    }

    #[test]
    fn verify_supports_plain_json_encoding_program_id_index() {
        // encoding: json -> accountKeys are strings, instructions carry an index.
        let tx = serde_json::json!({
            "meta": {"err": null},
            "transaction": {
                "signatures": [SIG],
                "message": {
                    "accountKeys": [WALLET, MEMO],
                    "instructions": [{"programIdIndex": 1, "data": "abc"}]
                }
            }
        });
        // No `parsed` field, so the rose-id content check is skipped.
        assert!(verify_tx_result(&tx, SIG, WALLET, ROSE_ID).is_ok());
    }

    #[test]
    fn verify_rejects_missing_signature_mismatch_and_wrong_wallet() {
        assert!(verify_tx_result(&JsonValue::Null, SIG, WALLET, ROSE_ID).is_err());

        let memo = format!("{{\"roseId\":\"{ROSE_ID}\"}}");
        let err = verify_tx_result(&parsed_tx("different-sig", WALLET, MEMO, &memo), SIG, WALLET, ROSE_ID)
            .unwrap_err();
        assert!(err.contains("签名"));

        let err = verify_tx_result(&parsed_tx(SIG, OTHER, MEMO, &memo), SIG, WALLET, ROSE_ID)
            .unwrap_err();
        assert!(err.contains("钱包地址"));
    }

    #[test]
    fn verify_rejects_failed_tx_non_memo_and_replay() {
        let memo = format!("{{\"roseId\":\"{ROSE_ID}\"}}");
        let mut failed = parsed_tx(SIG, WALLET, MEMO, &memo);
        failed["meta"]["err"] = serde_json::json!({"InstructionError": [0, "Custom"]});
        assert!(verify_tx_result(&failed, SIG, WALLET, ROSE_ID)
            .unwrap_err()
            .contains("执行失败"));

        let not_memo = parsed_tx(SIG, WALLET, OTHER, &memo);
        assert!(verify_tx_result(&not_memo, SIG, WALLET, ROSE_ID)
            .unwrap_err()
            .contains("Memo"));

        // Valid memo tx, but for a *different* rose (replay attempt).
        let replay = parsed_tx(SIG, WALLET, MEMO, "{\"roseId\":\"another-rose\"}");
        assert!(verify_tx_result(&replay, SIG, WALLET, ROSE_ID)
            .unwrap_err()
            .contains("不匹配"));
    }

    #[test]
    fn classify_rpc_response_handles_found_notfound_and_error() {
        let found = serde_json::json!({"result": {"meta": {"err": null}}});
        assert!(matches!(classify_rpc_response(&found), FetchOutcome::Found(_)));

        // Explicit null result => not yet finalized / not found.
        let null_res = serde_json::json!({"result": null, "jsonrpc": "2.0"});
        assert!(matches!(classify_rpc_response(&null_res), FetchOutcome::NotFound));

        // Missing "result" key entirely => treated as not-found (safe retry).
        let no_res = serde_json::json!({"jsonrpc": "2.0"});
        assert!(matches!(classify_rpc_response(&no_res), FetchOutcome::NotFound));

        let err = serde_json::json!({"error": {"code": -32005, "message": "rate limited"}});
        match classify_rpc_response(&err) {
            FetchOutcome::Retryable(msg) => assert!(msg.contains("rate limited")),
            other => panic!("expected Retryable, got {other:?}"),
        }
    }
}
