//! Token-2022 NFT references for roses (the "把玫瑰铸成 NFT" path).
//!
//! Unlike `solana_onchain.rs` (memo evidence, verified through a *transaction*),
//! an NFT is verified from **chain state**: we fetch the mint account and check
//! that it really is a 1-of-1 Token-2022 mint whose inline metadata names this
//! rose. That is strictly stronger than a memo — nobody can forge it by sending
//! a transaction that mentions a rose id.
//!
//! Why Token-2022 and not Metaplex: the metadata lives inside the mint account
//! (`MetadataPointer` → self), so there is one account to create instead of
//! four, and no dependency on the Metaplex program. Measured on Devnet, a full
//! rose NFT costs ≈ 0.004 SOL in rent versus ≈ 0.0088 SOL for the Metaplex
//! layout. The rent is a refundable deposit, not a fee.
//!
//! The backend never signs anything: the user's wallet is the mint authority,
//! the metadata update authority, and the fee payer. We only read.
//!
//! Verification is done with `commitment: finalized` — a mint that later gets
//! reorged away must never be stored as a reference.

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
use crate::routes::solana_onchain::normalize_base58;
use crate::state::AppState;

/// The Token-2022 program. Classic SPL Token (`Tokenkeg…`) cannot hold inline
/// metadata, so an NFT posted here must be owned by this program.
const TOKEN_2022_PROGRAM_ID: &str = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

/// Metadata key that binds the on-chain asset to a row in our database.
const ROSE_ID_FIELD: &str = "roseId";

/// Upper bound for the on-chain URI. Token-2022 imposes no hard cap, but a
/// multi-kilobyte URI is a sign of a malformed (or hostile) mint.
const MAX_URI_LEN: usize = 512;

static HTTP_CLIENT: std::sync::LazyLock<reqwest::Client> = std::sync::LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .expect("failed to build Solana RPC HTTP client")
});

/// One `additionalMetadata` entry of a Token-2022 mint.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MetadataField {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Deserialize)]
pub struct RecordSolanaNft {
    /// base58 mint address of the rose NFT.
    pub mint_address: String,
    /// Wallet that signed the mint and holds the metadata update authority.
    pub wallet_address: String,
}

impl RecordSolanaNft {
    fn validate(&self) -> Result<(), String> {
        if normalize_base58(&self.mint_address, 32, 44).is_none() {
            return Err("mint 地址格式不正确（应为 base58）".into());
        }
        if normalize_base58(&self.wallet_address, 32, 44).is_none() {
            return Err("钱包地址格式不正确（应为 base58）".into());
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SolanaNft {
    pub mint_address: String,
    pub wallet_address: String,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub additional_metadata: JsonValue,
    pub minted_at: DateTime<Utc>,
}

/// What a verified mint account tells us. Built by [`verify_mint_value`].
#[derive(Debug, PartialEq, Eq)]
struct VerifiedNft {
    name: String,
    symbol: String,
    uri: String,
    additional: Vec<MetadataField>,
}

pub async fn get_rose_nft(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Option<SolanaNft>>, AppError> {
    let rose = load_rose(&state.pool, id).await?;
    if rose.is_private {
        // Private roses must not leak the existence of an on-chain asset.
        return Err(AppError::NotFound);
    }

    let nft = sqlx::query_as::<_, SolanaNft>(
        "SELECT mint_address, wallet_address, name, symbol, uri, additional_metadata, minted_at
         FROM solana_nft_mints WHERE rose_id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?;
    Ok(Json(nft))
}

pub async fn record_rose_nft(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(input): Json<RecordSolanaNft>,
) -> Result<Json<SolanaNft>, AppError> {
    input.validate().map_err(AppError::BadRequest)?;

    let user_id = auth::require_active_user_id(&state.pool, &headers, &state.jwt_secret).await?;
    let rose = load_rose(&state.pool, id).await?;
    if rose.user_id != Some(user_id) {
        return Err(AppError::Forbidden);
    }
    if rose.is_private {
        return Err(AppError::BadRequest("私密玫瑰不能铸成公开 NFT".into()));
    }

    // The RPC is not optional here: without it we would be storing an
    // unverified claim, which is exactly what this endpoint exists to prevent.
    let rpc_url = state.config.solana_rpc_url.as_deref().ok_or_else(|| {
        AppError::ServiceUnavailable(
            "未配置 SOLANA_RPC_URL，无法校验 NFT；请在服务端配置后重试".into(),
        )
    })?;

    let mint = normalize_base58(&input.mint_address, 32, 44).expect("validated mint");
    let wallet = normalize_base58(&input.wallet_address, 32, 44).expect("validated wallet");

    let existing: Option<Uuid> =
        sqlx::query_scalar("SELECT rose_id FROM solana_nft_mints WHERE rose_id = $1")
            .bind(id)
            .fetch_optional(&state.pool)
            .await?;
    if existing.is_some() {
        return Err(AppError::BadRequest("这朵玫瑰已经铸成 NFT 了".into()));
    }
    let claimed: Option<Uuid> =
        sqlx::query_scalar("SELECT rose_id FROM solana_nft_mints WHERE mint_address = $1")
            .bind(&mint)
            .fetch_optional(&state.pool)
            .await?;
    if claimed.is_some() {
        return Err(AppError::BadRequest("这个 NFT 已被另一朵玫瑰占用".into()));
    }

    let account = fetch_mint_account(rpc_url, &mint).await?;
    let verified = verify_mint_value(&account, &mint, &id.to_string(), &wallet)
        .map_err(AppError::BadRequest)?;
    let additional = serde_json::to_value(&verified.additional)
        .map_err(|e| AppError::Internal(format!("元数据序列化失败: {e}")))?;

    let nft = sqlx::query_as::<_, SolanaNft>(
        "INSERT INTO solana_nft_mints
         (rose_id, mint_address, wallet_address, name, symbol, uri, additional_metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING mint_address, wallet_address, name, symbol, uri, additional_metadata, minted_at",
    )
    .bind(id)
    .bind(&mint)
    .bind(&wallet)
    .bind(&verified.name)
    .bind(&verified.symbol)
    .bind(&verified.uri)
    .bind(additional)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(nft))
}

async fn load_rose(pool: &PgPool, id: Uuid) -> Result<Rose, AppError> {
    sqlx::query_as::<_, Rose>("SELECT * FROM roses WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound)
}

/// How many times we retry a *transport* failure. `null` results are not
/// retried: unlike a transaction, an account that does not exist at finalized
/// commitment does not exist at all.
const RPC_MAX_ATTEMPTS: u32 = 3;

/// Fetch `getAccountInfo` for a mint and return the `value` object (which is
/// `null` when the account does not exist).
///
/// `jsonParsed` is used deliberately instead of decoding the raw account bytes:
/// Token-2022's extension layout contains padding whose placement is an
/// implementation detail of `spl-token-2022`, while the RPC's parser is
/// versioned alongside the program and already returns
/// `extensions[].extension == "tokenMetadata"`.
async fn fetch_mint_account(rpc_url: &str, mint: &str) -> Result<JsonValue, AppError> {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getAccountInfo",
        "params": [mint, {"encoding": "jsonParsed", "commitment": "finalized"}]
    });

    let mut last_error = String::new();
    for attempt in 1..=RPC_MAX_ATTEMPTS {
        let response = HTTP_CLIENT.post(rpc_url).json(&body).send().await;
        let response = match response {
            Ok(r) => r,
            Err(e) => {
                last_error = format!("Solana RPC 请求失败: {e}");
                tracing::warn!(attempt, "{last_error}");
                continue;
            }
        };
        match response.json::<JsonValue>().await {
            Ok(json) => {
                if let Some(err) = json.get("error") {
                    if !err.is_null() {
                        // RPC-level errors are usually rate limits / bad params.
                        last_error = format!("Solana RPC 返回错误: {err}");
                        tracing::warn!(attempt, "{last_error}");
                        continue;
                    }
                }
                return Ok(json
                    .get("result")
                    .and_then(|r| r.get("value"))
                    .cloned()
                    .unwrap_or(JsonValue::Null));
            }
            Err(e) => {
                last_error = format!("Solana RPC 响应解析失败: {e}");
                tracing::warn!(attempt, "{last_error}");
            }
        }
    }
    Err(AppError::Internal(format!(
        "Solana RPC 核验失败（已重试 {RPC_MAX_ATTEMPTS} 次）: {last_error}"
    )))
}

/// Parse one `additionalMetadata` entry.
///
/// The same data shows up in two wire shapes depending on the RPC version:
///
/// * `{"key": "roseId", "value": "…"}` — what the JSON-RPC docs describe;
/// * `["roseId", "…"]` — what Agave `apiVersion 4.4.0` actually returns
///   (verified against a live Devnet mint).
///
/// Accepting both is not defensive noise: the tuple form is the one real
/// clusters emit, and parsing only the documented form silently rejected every
/// legitimate NFT until it was checked against the chain.
fn parse_metadata_field(item: &JsonValue) -> Option<MetadataField> {
    if let (Some(key), Some(value)) = (
        item.get("key").and_then(|v| v.as_str()),
        item.get("value").and_then(|v| v.as_str()),
    ) {
        return Some(MetadataField {
            key: key.to_string(),
            value: value.to_string(),
        });
    }
    let pair = item.as_array()?;
    Some(MetadataField {
        key: pair.first()?.as_str()?.to_string(),
        value: pair.get(1)?.as_str()?.to_string(),
    })
}

/// Decide whether a `getAccountInfo` `value` is a valid rose NFT.
///
/// Every rule below closes a specific way of faking a mint:
///
/// 1. **Token-2022 owner** — classic SPL mints cannot carry metadata, so an
///    NFT claim must be owned by the Token-2022 program.
/// 2. **parsed type `mint`** — guards against pointing at a token *account*.
/// 3. **`decimals == 0` and `supply == 1`** — the definition of a 1-of-1.
/// 4. **`mintAuthority == null`** — supply is frozen; otherwise the creator
///    could inflate it later and it would not be an NFT.
/// 5. **metadata pointer → this mint** — metadata must be self-hosted; a
///    pointer elsewhere could be repointed at different content.
/// 6. **`updateAuthority == wallet`** — proves the claimed wallet actually
///    controls this asset (an on-chain signature we can check without asking
///    the user to prove key ownership).
/// 7. **`additionalMetadata[roseId] == this rose** — binds the asset to the row
///    being updated, so a valid NFT for a different rose cannot be replayed.
fn verify_mint_value(
    value: &JsonValue,
    mint: &str,
    rose_id: &str,
    wallet: &str,
) -> Result<VerifiedNft, String> {
    if value.is_null() {
        return Err("链上查不到这个 mint（可能尚未最终确认，或地址不存在）".into());
    }

    let owner = value.get("owner").and_then(|v| v.as_str()).ok_or("链上账户缺少 owner 字段")?;
    if owner != TOKEN_2022_PROGRAM_ID {
        return Err("该 mint 不属于 Token-2022 程序，不是带内联元数据的 NFT".into());
    }

    let parsed = value
        .pointer("/data/parsed")
        .ok_or("链上账户无法被解析为代币账户（缺少 parsed 数据）")?;
    if parsed.get("type").and_then(|v| v.as_str()) != Some("mint") {
        return Err("该地址不是 mint 账户".into());
    }
    let info = parsed.get("info").ok_or("链上账户缺少 mint 信息")?;

    let decimals = info
        .get("decimals")
        .and_then(|v| v.as_u64())
        .ok_or("链上 mint 缺少 decimals 字段")?;
    if decimals != 0 {
        return Err(format!(
            "该 mint 的 decimals 为 {decimals}，不是 NFT（应为 0）"
        ));
    }

    // `supply` is a string in jsonParsed (u64 may exceed JSON's safe integer).
    let supply = info
        .get("supply")
        .and_then(|v| v.as_str())
        .ok_or("链上 mint 缺少 supply 字段")?;
    if supply != "1" {
        return Err(format!("该 mint 的供应量为 {supply}，不是 1 对 1 的 NFT"));
    }

    let authority_frozen = info.get("mintAuthority").map(|v| v.is_null()).unwrap_or(false);
    if !authority_frozen {
        return Err("该 mint 仍保留增发权限，尚不是不可增发的 NFT".into());
    }

    let extensions = info
        .get("extensions")
        .and_then(|v| v.as_array())
        .ok_or("该 mint 没有任何 Token-2022 扩展，不是带元数据的 NFT")?;

    let find_ext = |name: &str| {
        extensions
            .iter()
            .find(|e| e.get("extension").and_then(|v| v.as_str()) == Some(name))
            .and_then(|e| e.get("state"))
    };

    let pointer = find_ext("metadataPointer").ok_or("该 mint 缺少 metadataPointer 扩展")?;
    match pointer.get("metadataAddress").and_then(|v| v.as_str()) {
        Some(addr) if addr == mint => {}
        Some(addr) => {
            return Err(format!(
                "元数据不在 mint 自身（指向 {addr}），无法从链上核验"
            ));
        }
        None => return Err("metadataPointer 未设置元数据地址".into()),
    }

    let meta = find_ext("tokenMetadata").ok_or("该 mint 未初始化内联元数据（tokenMetadata）")?;

    let update_authority = meta.get("updateAuthority").and_then(|v| v.as_str());
    match update_authority {
        Some(addr) if addr == wallet => {}
        Some(addr) => {
            return Err(format!(
                "该 NFT 的元数据更新权限属于 {addr}，与声明的钱包不一致"
            ));
        }
        // Immutable metadata is a deliberate choice we cannot bind to a wallet
        // from chain state alone, so we refuse rather than guess.
        None => return Err("该 NFT 的元数据已设为不可变，无法据此证明钱包归属".into()),
    }

    let name = meta.get("name").and_then(|v| v.as_str()).unwrap_or_default().to_string();
    let symbol = meta.get("symbol").and_then(|v| v.as_str()).unwrap_or_default().to_string();
    let uri = meta.get("uri").and_then(|v| v.as_str()).unwrap_or_default().to_string();
    if uri.trim().is_empty() {
        return Err("该 NFT 的元数据缺少 uri".into());
    }
    if uri.len() > MAX_URI_LEN {
        return Err(format!("该 NFT 的 uri 过长（超过 {MAX_URI_LEN} 字节）"));
    }

    let additional: Vec<MetadataField> = meta
        .get("additionalMetadata")
        .and_then(|v| v.as_array())
        .map(|items| items.iter().filter_map(parse_metadata_field).collect())
        .unwrap_or_default();

    let bound_rose = additional
        .iter()
        .find(|f| f.key.eq_ignore_ascii_case(ROSE_ID_FIELD))
        .map(|f| f.value.trim().to_ascii_lowercase());
    match bound_rose {
        Some(found) if found == rose_id.to_ascii_lowercase() => {}
        Some(found) => {
            return Err(format!(
                "该 NFT 绑定的是另一朵玫瑰（{found}），与当前玫瑰不匹配"
            ));
        }
        None => {
            return Err(format!(
                "该 NFT 的元数据缺少 {ROSE_ID_FIELD} 字段，无法确认属于这朵玫瑰"
            ));
        }
    }

    Ok(VerifiedNft {
        name,
        symbol,
        uri,
        additional,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const MINT: &str = "BTFpqmQid5y7SdcmB1pttGnMRh117EMNC78HtiRCNASA";
    const WALLET: &str = "HWXxkWBmYzPsz3mT4N32teD2JMHhrcsLRmG3uVx9q4Xf";
    const ROSE_ID: &str = "550e8400-e29b-41d4-a716-446655440000";

    /// Captured verbatim from `getAccountInfo?encoding=jsonParsed` on Devnet for
    /// a real Token-2022 NFT (already burned afterwards, hence supply "0").
    /// Using real RPC output as a fixture keeps the parser honest: if the RPC
    /// shape changes, this test fails before production does.
    fn real_mint_account() -> JsonValue {
        serde_json::json!({
            "data": {
                "parsed": {
                    "info": {
                        "decimals": 0,
                        "extensions": [
                            {
                                "extension": "metadataPointer",
                                "state": {
                                    "authority": WALLET,
                                    "metadataAddress": MINT
                                }
                            },
                            {
                                "extension": "tokenMetadata",
                                "state": {
                                    "additionalMetadata": [],
                                    "mint": MINT,
                                    "name": "Rose #1",
                                    "symbol": "ROSE",
                                    "updateAuthority": WALLET,
                                    "uri": "ipfs://bafyroseletprobe"
                                }
                            }
                        ],
                        "freezeAuthority": null,
                        "isInitialized": true,
                        "mintAuthority": null,
                        "supply": "0"
                    },
                    "type": "mint"
                },
                "program": "spl-token-2022",
                "space": 352
            },
            "executable": false,
            "lamports": 2438400,
            "owner": TOKEN_2022_PROGRAM_ID
        })
    }

    /// The same account as it looks while it is a live 1-of-1 NFT for ROSE_ID.
    /// `additionalMetadata` uses the tuple shape Agave actually returns.
    fn valid_nft() -> JsonValue {
        let mut v = real_mint_account();
        v["data"]["parsed"]["info"]["supply"] = serde_json::json!("1");
        v["data"]["parsed"]["info"]["extensions"][1]["state"]["additionalMetadata"] =
            serde_json::json!([["roseId", ROSE_ID]]);
        v
    }

    #[test]
    fn accepts_a_real_token_2022_rose_nft() {
        let verified =
            verify_mint_value(&valid_nft(), MINT, ROSE_ID, WALLET).expect("should verify");
        assert_eq!(verified.name, "Rose #1");
        assert_eq!(verified.symbol, "ROSE");
        assert_eq!(verified.uri, "ipfs://bafyroseletprobe");
        assert_eq!(
            verified.additional,
            vec![MetadataField {
                key: "roseId".into(),
                value: ROSE_ID.into()
            }]
        );
    }

    #[test]
    fn accepts_uppercase_rose_id_field_case_insensitively() {
        let mut v = valid_nft();
        v["data"]["parsed"]["info"]["extensions"][1]["state"]["additionalMetadata"] =
            serde_json::json!([["ROSEID", ROSE_ID.to_uppercase()]]);
        assert!(verify_mint_value(&v, MINT, ROSE_ID, WALLET).is_ok());
    }

    /// The JSON-RPC docs describe `{key, value}` objects; older/newer nodes may
    /// emit that shape, so both must parse.
    #[test]
    fn accepts_documented_key_value_field_shape() {
        let mut v = valid_nft();
        v["data"]["parsed"]["info"]["extensions"][1]["state"]["additionalMetadata"] =
            serde_json::json!([{"key": "roseId", "value": ROSE_ID}]);
        let verified = verify_mint_value(&v, MINT, ROSE_ID, WALLET).expect("should verify");
        assert_eq!(verified.additional[0].value, ROSE_ID);
    }

    #[test]
    fn rejects_missing_account() {
        let err = verify_mint_value(&JsonValue::Null, MINT, ROSE_ID, WALLET).unwrap_err();
        assert!(err.contains("查不到"));
    }

    #[test]
    fn rejects_classic_spl_token_mint() {
        let mut v = valid_nft();
        v["owner"] = serde_json::json!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
        let err = verify_mint_value(&v, MINT, ROSE_ID, WALLET).unwrap_err();
        assert!(err.contains("Token-2022"));
    }

    #[test]
    fn rejects_token_account_instead_of_mint() {
        let mut v = valid_nft();
        v["data"]["parsed"]["type"] = serde_json::json!("account");
        let err = verify_mint_value(&v, MINT, ROSE_ID, WALLET).unwrap_err();
        assert!(err.contains("不是 mint 账户"));
    }

    #[test]
    fn rejects_divisible_or_multi_supply_tokens() {
        let mut v = valid_nft();
        v["data"]["parsed"]["info"]["decimals"] = serde_json::json!(6);
        assert!(verify_mint_value(&v, MINT, ROSE_ID, WALLET).unwrap_err().contains("decimals"));

        // The captured real account has supply "0" — it is no longer an NFT.
        assert!(
            verify_mint_value(&real_mint_account(), MINT, ROSE_ID, WALLET)
                .unwrap_err()
                .contains("供应量")
        );
    }

    #[test]
    fn rejects_mint_that_can_still_inflate() {
        let mut v = valid_nft();
        v["data"]["parsed"]["info"]["mintAuthority"] = serde_json::json!(WALLET);
        assert!(verify_mint_value(&v, MINT, ROSE_ID, WALLET).unwrap_err().contains("增发权限"));
    }

    #[test]
    fn rejects_metadata_pointing_elsewhere_or_missing() {
        let mut v = valid_nft();
        v["data"]["parsed"]["info"]["extensions"][0]["state"]["metadataAddress"] =
            serde_json::json!("9xQeWvG816bUx9EPfzHqYjpuNcM8sKtVrLdJaB2mZoSw");
        assert!(
            verify_mint_value(&v, MINT, ROSE_ID, WALLET)
                .unwrap_err()
                .contains("元数据不在 mint 自身")
        );

        let mut v = valid_nft();
        v["data"]["parsed"]["info"]["extensions"] = serde_json::json!([]);
        assert!(
            verify_mint_value(&v, MINT, ROSE_ID, WALLET)
                .unwrap_err()
                .contains("metadataPointer")
        );
    }

    #[test]
    fn rejects_wallet_that_does_not_control_the_nft() {
        let mut v = valid_nft();
        v["data"]["parsed"]["info"]["extensions"][1]["state"]["updateAuthority"] =
            serde_json::json!("9xQeWvG816bUx9EPfzHqYjpuNcM8sKtVrLdJaB2mZoSw");
        assert!(verify_mint_value(&v, MINT, ROSE_ID, WALLET).unwrap_err().contains("更新权限"));

        // Immutable metadata cannot prove wallet ownership from chain state.
        let mut v = valid_nft();
        v["data"]["parsed"]["info"]["extensions"][1]["state"]["updateAuthority"] = JsonValue::Null;
        assert!(verify_mint_value(&v, MINT, ROSE_ID, WALLET).unwrap_err().contains("不可变"));
    }

    #[test]
    fn rejects_nft_bound_to_another_rose_or_without_binding() {
        let mut v = valid_nft();
        v["data"]["parsed"]["info"]["extensions"][1]["state"]["additionalMetadata"] =
            serde_json::json!([["roseId", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]]);
        assert!(verify_mint_value(&v, MINT, ROSE_ID, WALLET).unwrap_err().contains("另一朵玫瑰"));

        let mut v = valid_nft();
        v["data"]["parsed"]["info"]["extensions"][1]["state"]["additionalMetadata"] =
            serde_json::json!([]);
        assert!(
            verify_mint_value(&v, MINT, ROSE_ID, WALLET)
                .unwrap_err()
                .contains("缺少 roseId")
        );
    }

    #[test]
    fn rejects_blank_or_oversized_uri() {
        let mut v = valid_nft();
        v["data"]["parsed"]["info"]["extensions"][1]["state"]["uri"] = serde_json::json!("  ");
        assert!(verify_mint_value(&v, MINT, ROSE_ID, WALLET).unwrap_err().contains("uri"));

        let mut v = valid_nft();
        v["data"]["parsed"]["info"]["extensions"][1]["state"]["uri"] =
            serde_json::json!("i".repeat(MAX_URI_LEN + 1));
        assert!(verify_mint_value(&v, MINT, ROSE_ID, WALLET).unwrap_err().contains("过长"));
    }

    #[test]
    fn validates_base58_inputs() {
        let ok = RecordSolanaNft {
            mint_address: MINT.into(),
            wallet_address: WALLET.into(),
        };
        assert!(ok.validate().is_ok());

        let bad = RecordSolanaNft {
            mint_address: "0OIl-not-base58".into(),
            wallet_address: WALLET.into(),
        };
        assert!(bad.validate().is_err());
    }

    /// Live end-to-end check: fetch a real mint over JSON-RPC and run the full
    /// verifier. Ignored by default so `cargo test` never touches the network.
    ///
    /// ```bash
    /// SOLANA_RPC_URL=https://api.devnet.solana.com \
    /// SOLANA_NFT_MINT=<mint> SOLANA_NFT_ROSE_ID=<uuid> SOLANA_NFT_WALLET=<wallet> \
    ///   cargo test -p roselet-backend --lib \
    ///   routes::solana_nft::tests::live_mint_verifies -- --ignored --nocapture
    /// ```
    #[tokio::test]
    #[ignore = "hits a live Solana RPC; set SOLANA_NFT_* env vars to run"]
    async fn live_mint_verifies() {
        let rpc = std::env::var("SOLANA_RPC_URL").expect("SOLANA_RPC_URL");
        let mint = std::env::var("SOLANA_NFT_MINT").expect("SOLANA_NFT_MINT");
        let rose_id = std::env::var("SOLANA_NFT_ROSE_ID").expect("SOLANA_NFT_ROSE_ID");
        let wallet = std::env::var("SOLANA_NFT_WALLET").expect("SOLANA_NFT_WALLET");

        let account = fetch_mint_account(&rpc, &mint).await.expect("RPC fetch should succeed");
        let verified =
            verify_mint_value(&account, &mint, &rose_id, &wallet).expect("real mint should verify");
        assert!(!verified.uri.is_empty());
        assert!(!verified.name.is_empty());
        assert!(
            verified
                .additional
                .iter()
                .any(|f| f.key.eq_ignore_ascii_case(ROSE_ID_FIELD) && f.value == rose_id)
        );
    }
}
