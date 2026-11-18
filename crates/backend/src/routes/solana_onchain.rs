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

/// Domain tag written into every memo we accept (`{"app":"roselet", …}`).
///
/// Anchor prepends an 8-byte discriminator to every `#[account]` so a program
/// cannot read account A as type B. A memo has no byte prefix and no owner
/// program of ours, so the equivalent has to be *inside* the payload: a memo
/// must declare the application it belongs to before we treat it as a rose
/// claim. Optional for older clients, but validated whenever present.
const MEMO_APP_TAG: &str = "roselet";

/// JSON field names in the memo payload. Kept as constants rather than inline
/// literals so the cross-language contract test below can assert that the
/// TypeScript interface declares exactly the keys this Rust parser reads.
const MEMO_APP_FIELD: &str = "app";
const MEMO_ROSE_ID_FIELD: &str = "roseId";

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
        if !self.on_chain_metadata.is_object()
            || self.on_chain_metadata.as_object().map(|o| o.is_empty()).unwrap_or(true)
        {
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
        return Err(AppError::BadRequest(
            "私密玫瑰不能创建 Solana 链上记录".into(),
        ));
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
    //
    // The verified call also returns the memo *as the chain holds it*. That
    // value — not the client's copy — is what gets stored: a client can claim
    // any metadata it likes, but the row is supposed to describe the chain.
    let on_chain_metadata = match state.config.solana_rpc_url.as_deref() {
        Some(rpc_url) => {
            let verified = verify_solana_mint(
                rpc_url,
                &signature,
                &wallet_address,
                &account,
                &id.to_string(),
            )
            .await?;
            if verified != input.on_chain_metadata {
                tracing::info!(
                    rose_id = %id,
                    "客户端声明的元数据与链上 memo 不一致，以链上为准"
                );
            }
            verified
        }
        None => input.on_chain_metadata.clone(),
    };

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
    .bind(&on_chain_metadata)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        // The pre-checks above give friendly messages, but two concurrent
        // requests can both pass them. The unique indexes are the real
        // guarantee (the equivalent of Anchor's atomic `init`), so a race must
        // surface as "already recorded" rather than a 500.
        if crate::error::is_unique_violation(&e) {
            AppError::BadRequest("这朵玫瑰已有 Solana 链上记录".into())
        } else {
            AppError::Database(e)
        }
    })?;
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
    account: &str,
    rose_id: &str,
) -> Result<JsonValue, AppError> {
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
                return verify_tx_result(result, signature, wallet, account, rose_id)
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
///
/// Returns the memo payload as the chain holds it, which the caller stores as
/// the authoritative `on_chain_metadata`.
fn verify_tx_result(
    result: &JsonValue,
    signature: &str,
    wallet: &str,
    account: &str,
    rose_id: &str,
) -> Result<JsonValue, String> {
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

    // `account` is stored as "the account this record lives on". A memo writes
    // to no account, so the honest references are the fee payer or an account
    // the transaction actually touched. Checking membership stops the field
    // from being a free-form string a client can point anywhere.
    if !account_keys.iter().any(|key| account_key_pubkey(key) == Some(account)) {
        return Err("声明的链上账户不在这笔交易里".into());
    }

    let instructions = result
        .pointer("/transaction/message/instructions")
        .and_then(|v| v.as_array())
        .ok_or("链上交易缺少 instructions")?;

    let mut memo_error = String::new();
    for ix in instructions.iter().filter(|ix| instruction_is_memo(ix, account_keys)) {
        // Fail closed: a memo whose text the RPC did not return cannot be
        // checked against this rose, and "cannot check" must not mean "pass".
        let Some(text) = ix.get("parsed").and_then(|v| v.as_str()) else {
            memo_error = "链上记录无法读回 Memo 文本".to_string();
            continue;
        };
        match parse_rose_memo(text, rose_id) {
            Ok(payload) => return Ok(payload),
            Err(e) => memo_error = e,
        }
    }

    if memo_error.is_empty() {
        Err("交易未调用 Memo 程序，不是有效的上链记录".into())
    } else {
        Err(memo_error)
    }
}

/// Parse the memo text of a roselet claim.
///
/// This replaces a `text.contains(rose_id)` check, which accepted any memo that
/// merely *quoted* the id — another application's payload, or a note that
/// happens to embed the string, both passed. Requiring a JSON object whose
/// `roseId` field equals the rose is the memo-equivalent of Anchor's
/// discriminator: the payload has to be *shaped* like a claim, not just mention
/// one. `app` is validated when present so two products sharing a memo format
/// cannot cross-claim.
fn parse_rose_memo(text: &str, rose_id: &str) -> Result<JsonValue, String> {
    let parsed: JsonValue = serde_json::from_str(text.trim())
        .map_err(|_| "链上记录不是有效的 JSON（可能来自其它应用）".to_string())?;
    let object = parsed.as_object().ok_or("链上记录不是 JSON 对象，无法确认属于这朵玫瑰")?;

    if let Some(app) = object.get(MEMO_APP_FIELD).and_then(|v| v.as_str()) {
        if !app.eq_ignore_ascii_case(MEMO_APP_TAG) {
            return Err(format!("链上记录属于其它应用（app={app}）"));
        }
    }

    let declared = object
        .get(MEMO_ROSE_ID_FIELD)
        .and_then(|v| v.as_str())
        .map(str::trim)
        .ok_or("链上记录缺少 roseId 字段，无法确认属于这朵玫瑰")?;
    if !declared.eq_ignore_ascii_case(rose_id) {
        return Err("链上记录内容与这朵玫瑰不匹配".into());
    }
    Ok(parsed)
}

fn account_key_pubkey(value: &JsonValue) -> Option<&str> {
    value.as_str().or_else(|| value.get("pubkey").and_then(|p| p.as_str()))
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
///
/// Shared with `solana_nft`, which validates mint / wallet addresses the same
/// way. Deliberately `pub(crate)`: this is not part of the HTTP API contract.
pub(crate) fn normalize_base58(value: &str, min_len: usize, max_len: usize) -> Option<String> {
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
        let memo = format!("{{\"app\":\"roselet\",\"roseId\":\"{ROSE_ID}\",\"message\":\"hi\"}}");
        let verified = verify_tx_result(
            &parsed_tx(SIG, WALLET, MEMO, &memo),
            SIG,
            WALLET,
            WALLET,
            ROSE_ID,
        )
        .expect("valid roselet memo");
        // The payload we hand back is the chain's copy, which becomes the
        // stored `on_chain_metadata` — not whatever the client claimed.
        assert_eq!(verified["roseId"], ROSE_ID);
        assert_eq!(verified["message"], "hi");

        // The v3 Memo program id is accepted too.
        assert!(
            verify_tx_result(
                &parsed_tx(SIG, WALLET, MEMO_PROGRAM_IDS[1], &memo),
                SIG,
                WALLET,
                WALLET,
                ROSE_ID
            )
            .is_ok()
        );
    }

    /// A memo whose text the RPC did not return cannot be checked against this
    /// rose, so it must be rejected. `encoding: json` produces exactly this
    /// shape (no `parsed` field); the backend always asks for `jsonParsed`, and
    /// this test pins the rule that "cannot read" never means "accept".
    #[test]
    fn verify_fails_closed_when_memo_text_is_unavailable() {
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
        let err = verify_tx_result(&tx, SIG, WALLET, WALLET, ROSE_ID).unwrap_err();
        assert!(err.contains("无法读回"), "{err}");
    }

    #[test]
    fn verify_rejects_missing_signature_mismatch_and_wrong_wallet() {
        assert!(verify_tx_result(&JsonValue::Null, SIG, WALLET, WALLET, ROSE_ID).is_err());

        let memo = format!("{{\"roseId\":\"{ROSE_ID}\"}}");
        let err = verify_tx_result(
            &parsed_tx("different-sig", WALLET, MEMO, &memo),
            SIG,
            WALLET,
            WALLET,
            ROSE_ID,
        )
        .unwrap_err();
        assert!(err.contains("签名"));

        let err = verify_tx_result(
            &parsed_tx(SIG, OTHER, MEMO, &memo),
            SIG,
            WALLET,
            WALLET,
            ROSE_ID,
        )
        .unwrap_err();
        assert!(err.contains("钱包地址"));
    }

    /// The previous check was `text.contains(rose_id)`, which accepted any memo
    /// that merely *quoted* the id. These are the three shapes that slipped
    /// through: a note that embeds the id, an id with a suffix, and an
    /// unrelated non-JSON memo.
    #[test]
    fn verify_rejects_memo_that_only_quotes_the_rose_id() {
        let quoted = format!("{{\"note\":\"{ROSE_ID}\"}}");
        let err = verify_tx_result(
            &parsed_tx(SIG, WALLET, MEMO, &quoted),
            SIG,
            WALLET,
            WALLET,
            ROSE_ID,
        )
        .unwrap_err();
        assert!(err.contains("roseId"), "{err}");

        let suffixed = format!("{{\"roseId\":\"{ROSE_ID}-2\"}}");
        let err = verify_tx_result(
            &parsed_tx(SIG, WALLET, MEMO, &suffixed),
            SIG,
            WALLET,
            WALLET,
            ROSE_ID,
        )
        .unwrap_err();
        assert!(err.contains("不匹配"), "{err}");

        let err = verify_tx_result(
            &parsed_tx(SIG, WALLET, MEMO, "thanks for the roses"),
            SIG,
            WALLET,
            WALLET,
            ROSE_ID,
        )
        .unwrap_err();
        assert!(err.contains("JSON"), "{err}");
    }

    /// `app` is the memo-side discriminator: another product using the same
    /// memo format must not be able to claim our roses.
    #[test]
    fn verify_rejects_memo_from_another_application() {
        let memo = format!("{{\"app\":\"otherapp\",\"roseId\":\"{ROSE_ID}\"}}");
        let err = verify_tx_result(
            &parsed_tx(SIG, WALLET, MEMO, &memo),
            SIG,
            WALLET,
            WALLET,
            ROSE_ID,
        )
        .unwrap_err();
        assert!(err.contains("其它应用"), "{err}");
    }

    /// `account` is client-supplied and stored as "the account this record
    /// lives on", so it must at least be part of the transaction.
    #[test]
    fn verify_rejects_account_outside_the_transaction() {
        let memo = format!("{{\"roseId\":\"{ROSE_ID}\"}}");
        let err = verify_tx_result(
            &parsed_tx(SIG, WALLET, MEMO, &memo),
            SIG,
            WALLET,
            OTHER,
            ROSE_ID,
        )
        .unwrap_err();
        assert!(err.contains("不在这笔交易"), "{err}");
    }

    #[test]
    fn verify_rejects_failed_tx_non_memo_and_replay() {
        let memo = format!("{{\"roseId\":\"{ROSE_ID}\"}}");
        let mut failed = parsed_tx(SIG, WALLET, MEMO, &memo);
        failed["meta"]["err"] = serde_json::json!({"InstructionError": [0, "Custom"]});
        assert!(
            verify_tx_result(&failed, SIG, WALLET, WALLET, ROSE_ID)
                .unwrap_err()
                .contains("执行失败")
        );

        let not_memo = parsed_tx(SIG, WALLET, OTHER, &memo);
        assert!(
            verify_tx_result(&not_memo, SIG, WALLET, WALLET, ROSE_ID)
                .unwrap_err()
                .contains("Memo")
        );

        // Valid memo tx, but for a *different* rose (replay attempt).
        let replay = parsed_tx(SIG, WALLET, MEMO, "{\"roseId\":\"another-rose\"}");
        assert!(
            verify_tx_result(&replay, SIG, WALLET, WALLET, ROSE_ID)
                .unwrap_err()
                .contains("不匹配")
        );
    }

    #[test]
    fn classify_rpc_response_handles_found_notfound_and_error() {
        let found = serde_json::json!({"result": {"meta": {"err": null}}});
        assert!(matches!(
            classify_rpc_response(&found),
            FetchOutcome::Found(_)
        ));

        // Explicit null result => not yet finalized / not found.
        let null_res = serde_json::json!({"result": null, "jsonrpc": "2.0"});
        assert!(matches!(
            classify_rpc_response(&null_res),
            FetchOutcome::NotFound
        ));

        // Missing "result" key entirely => treated as not-found (safe retry).
        let no_res = serde_json::json!({"jsonrpc": "2.0"});
        assert!(matches!(
            classify_rpc_response(&no_res),
            FetchOutcome::NotFound
        ));

        let err = serde_json::json!({"error": {"code": -32005, "message": "rate limited"}});
        match classify_rpc_response(&err) {
            FetchOutcome::Retryable(msg) => assert!(msg.contains("rate limited")),
            other => panic!("expected Retryable, got {other:?}"),
        }
    }

    /// Path to the TypeScript half of the memo contract, resolved from the
    /// crate manifest so the test does not depend on the current directory.
    const WEB_ROSE_MEMO_MODULE: &str = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../apps/web/src/lib/rose-memo.ts"
    );

    /// Return the quoted string literal that follows `marker` in the TS source.
    fn ts_quoted_after<'a>(source: &'a str, marker: &str) -> &'a str {
        let start = source
            .find(marker)
            .unwrap_or_else(|| panic!("frontend memo module is missing `{marker}`"))
            + marker.len();
        let rest = &source[start..];
        let end = rest
            .find('"')
            .unwrap_or_else(|| panic!("unterminated string literal after `{marker}`"));
        &rest[..end]
    }

    /// The Rust backend and the web frontend live in separate workspaces, so no
    /// compiler checks that their memo contract agrees. It has already drifted
    /// twice: once a frontend component used the v3 Memo program, and once
    /// `getAddMemoInstruction` silently used its own default program id
    /// (`Memo4c2pN8...`), which this verifier's whitelist rejects. Pin every
    /// shared literal here by reading the frontend module at test time.
    #[test]
    fn frontend_memo_contract_matches_backend() {
        let src = std::fs::read_to_string(WEB_ROSE_MEMO_MODULE).unwrap_or_else(|e| {
            panic!(
                "cannot read {WEB_ROSE_MEMO_MODULE}: {e}. \
                 This contract test needs a full workspace checkout."
            )
        });

        // 1. The program the frontend builds instructions with must be one the
        //    backend accepts — and the canonical one, not the v3 variant.
        let frontend_program = ts_quoted_after(&src, "MEMO_PROGRAM_ADDRESS = \"");
        assert!(
            MEMO_PROGRAM_IDS.contains(&frontend_program),
            "frontend MEMO_PROGRAM_ADDRESS ({frontend_program}) is not in the \
             backend whitelist {MEMO_PROGRAM_IDS:?}"
        );
        assert_eq!(
            frontend_program, MEMO_PROGRAM_IDS[0],
            "frontend must use the canonical SPL Memo program"
        );

        // 2. The instruction builder must be told that id *explicitly*. Its
        //    default (Memo4c2pN8...) is not whitelisted; omitting this config
        //    is exactly the regression this test exists to catch.
        let call_site = src
            .find("getAddMemoInstruction(")
            .expect("frontend no longer builds a memo instruction");
        // Slice by lines (not bytes) so a comment containing non-ASCII text
        // can never land on an invalid UTF-8 boundary.
        let call: String = src[call_site..].lines().take(15).collect::<Vec<_>>().join("\n");
        assert!(
            call.contains("programAddress:"),
            "getAddMemoInstruction must override its default program id"
        );
        assert!(
            call.contains("MEMO_PROGRAM_ADDRESS"),
            "getAddMemoInstruction must use the shared MEMO_PROGRAM_ADDRESS constant"
        );

        // 3. Payload field names and the domain tag.
        assert_eq!(
            ts_quoted_after(&src, &format!("{MEMO_APP_FIELD}: \"")),
            MEMO_APP_TAG,
            "frontend app tag drifted from the backend"
        );
        assert!(
            src.contains(&format!("{MEMO_ROSE_ID_FIELD}: string;")),
            "frontend payload must declare `{MEMO_ROSE_ID_FIELD}`"
        );

        // 4. Behavioural check: a memo shaped like the TS interface must be
        //    accepted by the Rust parser (not just share the same strings).
        let mut payload = serde_json::Map::new();
        payload.insert(
            MEMO_APP_FIELD.to_string(),
            JsonValue::String(MEMO_APP_TAG.to_string()),
        );
        payload.insert(
            MEMO_ROSE_ID_FIELD.to_string(),
            JsonValue::String(ROSE_ID.to_string()),
        );
        let memo = JsonValue::Object(payload).to_string();
        assert!(
            parse_rose_memo(&memo, ROSE_ID).is_ok(),
            "backend parser rejected a frontend-shaped memo: {memo}"
        );
    }
}
