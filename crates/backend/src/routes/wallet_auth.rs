//! Sign-In With Solana (SIWS) — wallet login and membership identity.
//!
//! The browser asks for a one-time challenge, signs the exact message with the
//! wallet, and posts the signature back. We verify it against the stored
//! message with ed25519, bind the address to an account, and issue the same
//! JWT the nickname flow uses.
//!
//! Why this is not just "connect and trust the address": a wallet connection
//! happens entirely inside the page, so anything the browser says about its
//! own address is a claim, not proof. A signature over a server-issued nonce
//! is the proof. Membership (`users.wallet_address`) is therefore server state,
//! which is what lets `/private-vault` and the mint endpoints trust it.

use axum::Json;
use axum::extract::State;
use axum::http::HeaderMap;
use chrono::{DateTime, Duration, Utc};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth;
use crate::error::{AppError, is_unique_violation};
use crate::models::user::{AuthResponse, User};
use crate::state::AppState;

/// A login challenge is short-lived: enough to open a wallet popup and sign,
/// short enough that a leaked nonce is not worth much.
const CHALLENGE_TTL_MINUTES: i64 = 5;
/// How long we keep spent/expired challenges before housekeeping deletes them.
const CHALLENGE_RETENTION_HOURS: &str = "24";

#[derive(Debug, Deserialize)]
pub struct ChallengeRequest {
    pub wallet_address: String,
}

#[derive(Debug, Serialize)]
pub struct ChallengeResponse {
    pub nonce: String,
    pub message: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct VerifyRequest {
    pub wallet_address: String,
    pub nonce: String,
    /// base58-encoded ed25519 signature over `message`.
    pub signature: String,
}

fn decode_address(address: &str) -> Result<[u8; 32], AppError> {
    let raw = bs58::decode(address)
        .into_vec()
        .map_err(|_| AppError::BadRequest("钱包地址不是合法的 base58 编码".into()))?;
    raw.try_into()
        .map_err(|_| AppError::BadRequest("钱包地址长度不对（应为 32 字节公钥）".into()))
}

fn verify_signature(address: &str, message: &str, signature: &str) -> Result<(), AppError> {
    let key_bytes = decode_address(address)?;
    let key = VerifyingKey::from_bytes(&key_bytes)
        .map_err(|_| AppError::BadRequest("钱包地址不是合法的 ed25519 公钥".into()))?;

    let raw = bs58::decode(signature)
        .into_vec()
        .map_err(|_| AppError::BadRequest("签名不是合法的 base58 编码".into()))?;
    let sig_bytes: [u8; 64] = raw
        .try_into()
        .map_err(|_| AppError::BadRequest("签名长度不对（应为 64 字节）".into()))?;
    let signature = Signature::from_bytes(&sig_bytes);

    key.verify(message.as_bytes(), &signature)
        .map_err(|_| AppError::Auth("签名校验失败，钱包归属未通过".into()))
}

fn auth_domain() -> String {
    std::env::var("WALLET_AUTH_DOMAIN")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Roselet".to_string())
}

fn build_message(
    domain: &str,
    address: &str,
    nonce: &str,
    issued_at: DateTime<Utc>,
    expires_at: DateTime<Utc>,
) -> String {
    format!(
        "{domain} wants you to sign in with your Solana account:\n\
         {address}\n\n\
         Signing this message proves you own this wallet. It does not create a transaction and costs no fees.\n\n\
         Nonce: {nonce}\n\
         Issued At: {issued_at}\n\
         Expiration Time: {expires_at}",
        issued_at = issued_at.to_rfc3339(),
        expires_at = expires_at.to_rfc3339(),
    )
}

pub async fn create_challenge(
    State(state): State<AppState>,
    Json(input): Json<ChallengeRequest>,
) -> Result<Json<ChallengeResponse>, AppError> {
    let address = input.wallet_address.trim();
    decode_address(address)?;

    let rate_key = format!("wallet-challenge:{address}");
    if !state.rate_limiter.check(&rate_key) {
        return Err(AppError::BadRequest("请求太频繁，请稍后再试".into()));
    }

    // Opportunistic housekeeping; the table stays tiny without a cron job.
    let cutoff =
        Utc::now() - Duration::hours(CHALLENGE_RETENTION_HOURS.parse::<i64>().unwrap_or(24));
    sqlx::query("DELETE FROM wallet_challenges WHERE expires_at < $1")
        .bind(cutoff)
        .execute(&state.pool)
        .await?;

    let nonce = Uuid::new_v4().simple().to_string();
    let issued_at = Utc::now();
    let expires_at = issued_at + Duration::minutes(CHALLENGE_TTL_MINUTES);
    let message = build_message(&auth_domain(), address, &nonce, issued_at, expires_at);

    sqlx::query(
        "INSERT INTO wallet_challenges (nonce, wallet_address, message, expires_at)
         VALUES ($1, $2, $3, $4)",
    )
    .bind(&nonce)
    .bind(address)
    .bind(&message)
    .bind(expires_at)
    .execute(&state.pool)
    .await?;

    Ok(Json(ChallengeResponse {
        nonce,
        message,
        expires_at,
    }))
}

/// Find the active account that owns this wallet, creating one on first login.
async fn login_or_register(pool: &PgPool, address: &str) -> Result<User, AppError> {
    #[derive(sqlx::FromRow)]
    struct WalletUser {
        id: Uuid,
        deleted_at: Option<DateTime<Utc>>,
    }

    if let Some(existing) = sqlx::query_as::<_, WalletUser>(
        "SELECT id, deleted_at FROM users WHERE wallet_address = $1",
    )
    .bind(address)
    .fetch_optional(pool)
    .await?
    {
        match existing.deleted_at {
            None => return fetch_user(pool, existing.id).await,
            Some(deleted_at) if auth::deletion_is_restorable(deleted_at, Utc::now()) => {
                sqlx::query(
                    "UPDATE users
                     SET deleted_at = NULL, deletion_reason = NULL
                     WHERE id = $1",
                )
                .bind(existing.id)
                .execute(pool)
                .await?;
                return fetch_user(pool, existing.id).await;
            }
            // Past the restore window: anonymise the old row (which also
            // clears its wallet binding) and give the wallet a fresh account.
            Some(_) => auth::finalize_deleted_user(pool, existing.id).await?,
        }
    }

    let user = create_wallet_user(pool, address).await?;
    Ok(user)
}

async fn fetch_user(pool: &PgPool, id: Uuid) -> Result<User, AppError> {
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound)
}

/// A wallet-first account has no nickname yet, so we mint a readable one.
/// Nicknames are globally unique, including soft-deleted accounts, so a
/// collision is retried instead of failing the login.
async fn create_wallet_user(pool: &PgPool, address: &str) -> Result<User, AppError> {
    let prefix: String = address.chars().take(6).collect();
    let base = format!("Solana-{prefix}");

    for attempt in 0..5 {
        let nickname = if attempt == 0 {
            base.clone()
        } else {
            let suffix = Uuid::new_v4().simple().to_string();
            format!("{base}-{}", &suffix[..4])
        };

        match sqlx::query_as::<_, User>(
            "INSERT INTO users (nickname, wallet_address, member_since)
             VALUES ($1, $2, NOW())
             RETURNING *",
        )
        .bind(&nickname)
        .bind(address)
        .fetch_one(pool)
        .await
        {
            Ok(user) => return Ok(user),
            Err(err) if is_unique_violation(&err) => {
                // The wallet may have been bound by a concurrent verify.
                if let Some(existing) = sqlx::query_as::<_, User>(
                    "SELECT * FROM users WHERE wallet_address = $1 AND deleted_at IS NULL",
                )
                .bind(address)
                .fetch_optional(pool)
                .await?
                {
                    return Ok(existing);
                }
                // Otherwise it was the nickname; try another suffix.
                continue;
            }
            Err(err) => return Err(err.into()),
        }
    }

    Err(AppError::BadRequest("生成账号失败，请重试".into()))
}

/// Bind a wallet to an account that is already signed in.
async fn bind_wallet(pool: &PgPool, user_id: Uuid, address: &str) -> Result<User, AppError> {
    let current = fetch_user(pool, user_id).await?;

    if let Some(existing) = current.wallet_address.as_deref() {
        if existing == address {
            return Ok(current);
        }
        return Err(AppError::BadRequest("这个账号已经绑定了另一个钱包".into()));
    }

    let taken: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM users WHERE wallet_address = $1 AND id <> $2")
            .bind(address)
            .bind(user_id)
            .fetch_optional(pool)
            .await?;
    if taken.is_some() {
        return Err(AppError::BadRequest("这个钱包已经绑定了另一个账号".into()));
    }

    match sqlx::query(
        "UPDATE users
         SET wallet_address = $1, member_since = COALESCE(member_since, NOW())
         WHERE id = $2",
    )
    .bind(address)
    .bind(user_id)
    .execute(pool)
    .await
    {
        Ok(_) => {}
        Err(err) if is_unique_violation(&err) => {
            return Err(AppError::BadRequest("这个钱包已经绑定了另一个账号".into()));
        }
        Err(err) => return Err(err.into()),
    }

    fetch_user(pool, user_id).await
}

pub async fn verify(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<VerifyRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    let address = input.wallet_address.trim();
    decode_address(address)?;

    let rate_key = format!("wallet-verify:{address}");
    if !state.rate_limiter.check(&rate_key) {
        return Err(AppError::BadRequest("请求太频繁，请稍后再试".into()));
    }

    #[derive(sqlx::FromRow)]
    struct Challenge {
        message: String,
        expires_at: DateTime<Utc>,
        consumed_at: Option<DateTime<Utc>>,
    }

    let challenge = sqlx::query_as::<_, Challenge>(
        "SELECT message, expires_at, consumed_at
         FROM wallet_challenges
         WHERE nonce = $1 AND wallet_address = $2",
    )
    .bind(&input.nonce)
    .bind(address)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::BadRequest("登录请求无效，请重新发起".into()))?;

    if challenge.consumed_at.is_some() || challenge.expires_at <= Utc::now() {
        return Err(AppError::BadRequest("登录请求已过期，请重新发起".into()));
    }

    verify_signature(address, &challenge.message, &input.signature)?;

    // Consume only after the signature checks out, so a user whose wallet
    // signed the wrong thing can retry without requesting a new challenge.
    let consumed = sqlx::query_scalar::<_, String>(
        "UPDATE wallet_challenges
         SET consumed_at = NOW()
         WHERE nonce = $1 AND consumed_at IS NULL
         RETURNING nonce",
    )
    .bind(&input.nonce)
    .fetch_optional(&state.pool)
    .await?;
    if consumed.is_none() {
        return Err(AppError::BadRequest("登录请求已使用，请重新发起".into()));
    }

    // Signed in already → this is "bind wallet to my account" (upgrade to
    // member). Otherwise it is wallet login / registration.
    //
    // A request that *carries* a token but fails to resolve must not fall
    // through to registration: an expired access token would silently create a
    // second account for the same person instead of binding their wallet.
    let carries_token = headers.contains_key(axum::http::header::AUTHORIZATION);
    let current_user = auth::get_active_user_id(&state.pool, &headers, &state.jwt_secret).await?;
    if carries_token && current_user.is_none() {
        return Err(AppError::Auth("登录已过期，请重新登录后再绑定钱包".into()));
    }
    let user = match current_user {
        Some(user_id) => bind_wallet(&state.pool, user_id, address).await?,
        None => login_or_register(&state.pool, address).await?,
    };

    let access_token = auth::create_access_token(user.id, &user.nickname, &state.jwt_secret)?;
    let refresh_token = auth::create_refresh_token(&state.pool, user.id).await?;

    Ok(Json(AuthResponse {
        access_token,
        refresh_token,
        user,
    }))
}
