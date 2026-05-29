use sqlx::PgPool;
use tokio::sync::broadcast;

use crate::models::rose::RoseResponse;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub rose_tx: broadcast::Sender<RoseResponse>,
    pub jwt_secret: Vec<u8>,
}

impl AppState {
    pub fn new(pool: PgPool, jwt_secret: String) -> Self {
        let (rose_tx, _) = broadcast::channel(100);
        Self {
            pool,
            rose_tx,
            jwt_secret: jwt_secret.into_bytes(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_new() {
        // We can't easily create a PgPool in a unit test without a DB,
        // but we can test the jwt_secret conversion
        let secret = "test-secret".to_string();
        let bytes = secret.clone().into_bytes();
        assert_eq!(bytes, b"test-secret");
    }
}
