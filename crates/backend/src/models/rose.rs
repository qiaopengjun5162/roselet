use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rose {
    pub id: Uuid,
    pub color: String,
    pub gratitude: Option<String>,
    pub anxiety: Option<String>,
    pub hope: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRose {
    pub color: String,
    pub gratitude: Option<String>,
    pub anxiety: Option<String>,
    pub hope: Option<String>,
}
