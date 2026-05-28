pub mod auth;
pub mod garden;
pub mod my;
pub mod rose;
pub mod ws;

use std::collections::HashMap;

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::rose::{Rose, RoseResponse};

async fn resolve_nicknames(pool: &PgPool, roses: Vec<Rose>) -> Vec<RoseResponse> {
    let user_ids: Vec<Uuid> = roses.iter().filter_map(|r| r.user_id).collect();

    let nicknames: HashMap<Uuid, String> = if user_ids.is_empty() {
        HashMap::new()
    } else {
        sqlx::query_as::<_, (Uuid, String)>("SELECT id, nickname FROM users WHERE id = ANY($1)")
            .bind(&user_ids)
            .fetch_all(pool)
            .await
            .ok()
            .map(|rows| rows.into_iter().collect())
            .unwrap_or_default()
    };

    roses
        .into_iter()
        .map(|rose| {
            let nickname = rose.user_id.and_then(|uid| nicknames.get(&uid).cloned());
            RoseResponse::from_rose(rose, nickname)
        })
        .collect()
}
