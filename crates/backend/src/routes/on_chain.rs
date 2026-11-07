use axum::Json;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use chrono::{DateTime, Utc};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use sha3::{Digest, Keccak256};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth;
use crate::config::Config;
use crate::error::AppError;
use crate::models::rose::Rose;
use crate::state::AppState;

const BASE_SEPOLIA_CHAIN_ID: i32 = 84532;
const MINT_EVENT_SIGNATURE: &str = "RoseMemorialMinted(uint256,bytes32,address,bytes32,uint8)";

#[derive(Debug, Deserialize)]
pub struct VerifyMint {
    pub tx_hash: String,
    pub wallet_address: String,
    pub message: String,
}

impl VerifyMint {
    fn validate(&self) -> Result<(), String> {
        if normalize_transaction_hash(&self.tx_hash).is_none() {
            return Err("交易哈希格式不正确".into());
        }
        if normalize_address(&self.wallet_address).is_none() {
            return Err("钱包地址格式不正确".into());
        }
        let message = self.message.trim();
        if message.is_empty() || message.chars().count() > 200 {
            return Err("链上纪念语需要在 1 到 200 个字符之间".into());
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct OnChainMint {
    pub chain_id: i32,
    pub contract_address: String,
    pub token_id: String,
    pub tx_hash: String,
    pub wallet_address: String,
    pub on_chain_message: String,
    pub message_hash: String,
    pub minted_at: DateTime<Utc>,
}

#[derive(Deserialize)]
struct RpcResponse<T> {
    result: Option<T>,
}

#[derive(Deserialize)]
struct TransactionReceipt {
    status: Option<String>,
    #[serde(default)]
    logs: Vec<TransactionLog>,
}

#[derive(Deserialize)]
struct TransactionLog {
    address: String,
    topics: Vec<String>,
    data: String,
}

pub async fn get_mint(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<Option<OnChainMint>>, AppError> {
    let rose = load_visible_rose(&state.pool, &headers, &state.config.jwt_secret, id).await?;
    if rose.is_private {
        return Err(AppError::NotFound);
    }

    let mint = sqlx::query_as::<_, OnChainMint>(
        "SELECT chain_id, contract_address, token_id, tx_hash, wallet_address, on_chain_message, message_hash, minted_at
         FROM nft_mints WHERE rose_id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?;
    Ok(Json(mint))
}

pub async fn verify_mint(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(input): Json<VerifyMint>,
) -> Result<Json<OnChainMint>, AppError> {
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
        return Err(AppError::BadRequest("私密玫瑰不能创建链上纪念版".into()));
    }

    let existing: Option<String> =
        sqlx::query_scalar("SELECT tx_hash FROM nft_mints WHERE rose_id = $1")
            .bind(id)
            .fetch_optional(&state.pool)
            .await?;
    if existing.is_some() {
        return Err(AppError::BadRequest("这朵玫瑰已有链上纪念版".into()));
    }

    let tx_hash = normalize_transaction_hash(&input.tx_hash).expect("validated transaction hash");
    let wallet_address =
        normalize_address(&input.wallet_address).expect("validated wallet address");
    let message = input.message.trim();
    let config = ChainConfig::from_config(&state.config)?;
    let token_id =
        verify_transaction(&config, id, &rose.color, &tx_hash, &wallet_address, message).await?;

    let duplicate_tx: Option<Uuid> =
        sqlx::query_scalar("SELECT rose_id FROM nft_mints WHERE tx_hash = $1")
            .bind(&tx_hash)
            .fetch_optional(&state.pool)
            .await?;
    if duplicate_tx.is_some() {
        return Err(AppError::BadRequest("这笔交易已被验证".into()));
    }

    let mint = sqlx::query_as::<_, OnChainMint>(
        "INSERT INTO nft_mints
         (rose_id, chain_id, contract_address, token_id, tx_hash, wallet_address, on_chain_message, message_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING chain_id, contract_address, token_id, tx_hash, wallet_address, on_chain_message, message_hash, minted_at",
    )
    .bind(id)
    .bind(BASE_SEPOLIA_CHAIN_ID)
    .bind(&config.contract_address)
    .bind(token_id)
    .bind(tx_hash)
    .bind(wallet_address)
    .bind(message)
    .bind(message_hash(message))
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

struct ChainConfig {
    rpc_url: String,
    contract_address: String,
}

impl ChainConfig {
    fn from_config(config: &Config) -> Result<Self, AppError> {
        let rpc_url = config
            .base_sepolia_rpc_url
            .clone()
            .ok_or_else(|| AppError::Internal("BASE_SEPOLIA_RPC_URL 未配置".into()))?;
        let contract_address = config
            .rose_memorial_contract_address
            .as_deref()
            .and_then(normalize_address)
            .ok_or_else(|| {
                AppError::Internal("ROSE_MEMORIAL_CONTRACT_ADDRESS 未配置或格式错误".into())
            })?;
        Ok(Self {
            rpc_url,
            contract_address,
        })
    }
}

async fn verify_transaction(
    config: &ChainConfig,
    rose_id: Uuid,
    color: &str,
    tx_hash: &str,
    wallet_address: &str,
    message: &str,
) -> Result<String, AppError> {
    let chain_id: String = rpc_call(&config.rpc_url, "eth_chainId", serde_json::json!([])).await?;
    if !chain_id.eq_ignore_ascii_case("0x14a34") {
        return Err(AppError::Internal(
            "BASE_SEPOLIA_RPC_URL 未指向 Base Sepolia".into(),
        ));
    }

    let receipt: TransactionReceipt =
        rpc_call(&config.rpc_url, "eth_getTransactionReceipt", [tx_hash]).await?;
    if receipt.status.as_deref() != Some("0x1") {
        return Err(AppError::BadRequest("交易尚未成功确认".into()));
    }

    let expected_rose_id = rose_id_to_bytes32(rose_id);
    let expected_message_hash = message_hash(message);
    let expected_color = color_index(color)?;
    let event_topic = hash_text(MINT_EVENT_SIGNATURE);

    receipt
        .logs
        .into_iter()
        .find_map(|log| {
            let matches_event = normalize_address(&log.address).as_deref()
                == Some(&config.contract_address)
                && log.topics.len() == 4
                && log.topics[0].eq_ignore_ascii_case(&event_topic)
                && log.topics[2].eq_ignore_ascii_case(&expected_rose_id)
                && topic_matches_address(&log.topics[3], wallet_address)
                && log.data.len() == 130
                && log.data.is_ascii()
                && log.data[..66].eq_ignore_ascii_case(&expected_message_hash)
                && u8::from_str_radix(&log.data[66..], 16).ok() == Some(expected_color);
            matches_event.then(|| log.topics[1].to_lowercase())
        })
        .ok_or_else(|| AppError::BadRequest("交易不包含匹配的 Roselet 链上纪念版".into()))
}

fn color_index(color: &str) -> Result<u8, AppError> {
    match color {
        "red" => Ok(0),
        "white" => Ok(1),
        "yellow" => Ok(2),
        _ => Err(AppError::Internal("玫瑰颜色数据无效".into())),
    }
}

async fn rpc_call<T: DeserializeOwned, P: Serialize>(
    rpc_url: &str,
    method: &str,
    params: P,
) -> Result<T, AppError> {
    let response = reqwest::Client::new()
        .post(rpc_url)
        .json(&serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        }))
        .send()
        .await
        .map_err(|_| AppError::Internal("无法连接 Base Sepolia RPC".into()))?;
    let body: RpcResponse<T> = response
        .json()
        .await
        .map_err(|_| AppError::Internal("Base Sepolia RPC 返回了无效响应".into()))?;
    body.result.ok_or_else(|| AppError::BadRequest("未找到对应的链上交易".into()))
}

fn normalize_address(value: &str) -> Option<String> {
    let value = value.trim();
    (value.len() == 42
        && value.starts_with("0x")
        && value[2..].bytes().all(|byte| byte.is_ascii_hexdigit()))
    .then(|| value.to_lowercase())
}

fn normalize_transaction_hash(value: &str) -> Option<String> {
    let value = value.trim();
    (value.len() == 66
        && value.starts_with("0x")
        && value[2..].bytes().all(|byte| byte.is_ascii_hexdigit()))
    .then(|| value.to_lowercase())
}

fn rose_id_to_bytes32(id: Uuid) -> String {
    format!("0x{:0>64}", id.simple().to_string())
}

fn hash_text(value: &str) -> String {
    format!("0x{}", hex::encode(Keccak256::digest(value.as_bytes())))
}

fn message_hash(message: &str) -> String {
    hash_text(message)
}

fn topic_matches_address(topic: &str, address: &str) -> bool {
    topic.len() == 66 && topic[26..].eq_ignore_ascii_case(&address[2..])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_evm_identifiers() {
        assert_eq!(
            normalize_address("0xAbCd000000000000000000000000000000000000"),
            Some("0xabcd000000000000000000000000000000000000".into())
        );
        assert!(normalize_address("0x1234").is_none());
        assert!(normalize_transaction_hash("not-a-hash").is_none());
    }

    #[test]
    fn encodes_rose_id_as_bytes32() {
        let id = Uuid::parse_str("a8664541-09d6-4da7-9b78-7f8ca20ba60a").unwrap();
        assert_eq!(
            rose_id_to_bytes32(id),
            "0x00000000000000000000000000000000a866454109d64da79b787f8ca20ba60a"
        );
    }

    #[test]
    fn matches_address_topic() {
        assert!(topic_matches_address(
            "0x000000000000000000000000abcd000000000000000000000000000000000000",
            "0xabcd000000000000000000000000000000000000"
        ));
    }
}
