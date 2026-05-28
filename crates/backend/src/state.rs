use sqlx::PgPool;
use tokio::sync::broadcast;

use crate::models::rose::Rose;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub rose_tx: broadcast::Sender<Rose>,
}

impl AppState {
    pub fn new(pool: PgPool) -> Self {
        let (rose_tx, _) = broadcast::channel(100);
        Self { pool, rose_tx }
    }
}
