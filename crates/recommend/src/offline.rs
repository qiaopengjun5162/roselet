use crate::garden::RoseItem;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GardenCache {
    pub roses: Vec<RoseItem>,
    pub total: u32,
    pub page: u32,
    pub filter: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
struct PlantBody {
    color: String,
    gratitude: Option<String>,
    anxiety: Option<String>,
    hope: Option<String>,
    #[serde(default)]
    is_private: bool,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GardenCacheAction {
    Set {
        roses: Vec<RoseItem>,
        total: u32,
        page: u32,
        filter: String,
        updated_at: String,
    },
    OptimisticCreate {
        rose: RoseItem,
        updated_at: String,
    },
    ConfirmCreate {
        temp_id: String,
        rose: RoseItem,
        updated_at: String,
    },
    RejectCreate {
        temp_id: String,
        updated_at: String,
    },
    Upsert {
        rose: RoseItem,
        updated_at: String,
    },
}

impl GardenCache {
    fn empty(updated_at: String) -> Self {
        Self {
            roses: Vec::new(),
            total: 0,
            page: 1,
            filter: String::new(),
            updated_at,
        }
    }

    pub fn apply(mut self, action: GardenCacheAction) -> Self {
        match action {
            GardenCacheAction::Set {
                roses,
                total,
                page,
                filter,
                updated_at,
            } => Self {
                roses: dedupe(roses),
                total,
                page,
                filter,
                updated_at,
            },
            GardenCacheAction::OptimisticCreate { rose, updated_at } => {
                self.updated_at = updated_at;
                if rose.is_private || self.roses.iter().any(|item| item.id == rose.id) {
                    return self;
                }
                self.roses.insert(0, rose);
                self.total = self.total.saturating_add(1);
                self
            }
            GardenCacheAction::ConfirmCreate {
                temp_id,
                mut rose,
                updated_at,
            } => {
                self.updated_at = updated_at;
                rose.sync_status = "synced".into();

                if rose.is_private {
                    self.roses.retain(|item| item.id != temp_id);
                    self.total = self.total.saturating_sub(1);
                    return self;
                }

                if let Some(existing) = self.roses.iter_mut().find(|item| item.id == temp_id) {
                    *existing = rose;
                } else if !self.roses.iter().any(|item| item.id == rose.id) {
                    self.roses.insert(0, rose);
                    self.total = self.total.saturating_add(1);
                }
                self.roses = dedupe(self.roses);
                self
            }
            GardenCacheAction::RejectCreate {
                temp_id,
                updated_at,
            } => {
                self.updated_at = updated_at;
                let before = self.roses.len();
                self.roses.retain(|item| item.id != temp_id);
                if self.roses.len() < before {
                    self.total = self.total.saturating_sub(1);
                }
                self
            }
            GardenCacheAction::Upsert {
                mut rose,
                updated_at,
            } => {
                self.updated_at = updated_at;
                rose.sync_status = "synced".into();

                if rose.is_private {
                    let before = self.roses.len();
                    self.roses.retain(|item| item.id != rose.id);
                    if self.roses.len() < before {
                        self.total = self.total.saturating_sub(1);
                    }
                    return self;
                }

                if let Some(existing) = self.roses.iter_mut().find(|item| item.id == rose.id) {
                    *existing = rose;
                } else {
                    self.roses.insert(0, rose);
                    self.total = self.total.saturating_add(1);
                }
                self
            }
        }
    }
}

pub fn build_optimistic_rose(
    plant_body_json: &str,
    temp_id: &str,
    now_iso: &str,
    nickname: &str,
) -> Result<RoseItem, String> {
    let body: PlantBody =
        serde_json::from_str(plant_body_json).map_err(|e| format!("种花请求解析失败: {}", e))?;
    Ok(RoseItem {
        id: temp_id.to_string(),
        color: body.color,
        gratitude: body.gratitude,
        anxiety: body.anxiety,
        hope: body.hope,
        user_id: None,
        nickname: if nickname.is_empty() {
            None
        } else {
            Some(nickname.to_string())
        },
        like_count: 0,
        ai_reply: None,
        is_private: body.is_private,
        created_at: now_iso.to_string(),
        sync_status: "pending".into(),
    })
}

pub fn apply_cache_action(cache_json: &str, action_json: &str) -> Result<GardenCache, String> {
    let action: GardenCacheAction =
        serde_json::from_str(action_json).map_err(|e| format!("缓存动作解析失败: {}", e))?;
    let cache = if cache_json.trim().is_empty() {
        GardenCache::empty(String::new())
    } else {
        serde_json::from_str(cache_json).unwrap_or_else(|_| GardenCache::empty(String::new()))
    };
    Ok(cache.apply(action))
}

fn dedupe(roses: Vec<RoseItem>) -> Vec<RoseItem> {
    let mut seen = std::collections::HashSet::new();
    let mut unique = Vec::with_capacity(roses.len());
    for rose in roses {
        if seen.insert(rose.id.clone()) {
            unique.push(rose);
        }
    }
    unique
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rose(id: &str, color: &str) -> RoseItem {
        RoseItem {
            id: id.into(),
            color: color.into(),
            gratitude: Some("thanks".into()),
            anxiety: None,
            hope: None,
            user_id: None,
            nickname: Some("alice".into()),
            like_count: 0,
            ai_reply: None,
            is_private: false,
            created_at: "2026-06-06T00:00:00Z".into(),
            sync_status: "synced".into(),
        }
    }

    #[test]
    fn builds_optimistic_rose_from_plant_body() {
        let item = build_optimistic_rose(
            r#"{"color":"red","gratitude":"hi","anxiety":null,"hope":null}"#,
            "temp-1",
            "2026-06-06T00:00:00Z",
            "alice",
        )
        .unwrap();
        assert_eq!(item.id, "temp-1");
        assert_eq!(item.nickname.as_deref(), Some("alice"));
        assert_eq!(item.sync_status, "pending");
    }

    #[test]
    fn optimistic_create_inserts_public_rose_once() {
        let cache = GardenCache::empty("t0".into());
        let cache = cache.apply(GardenCacheAction::OptimisticCreate {
            rose: rose("temp-1", "red"),
            updated_at: "t1".into(),
        });
        let cache = cache.apply(GardenCacheAction::OptimisticCreate {
            rose: rose("temp-1", "red"),
            updated_at: "t2".into(),
        });
        assert_eq!(cache.roses.len(), 1);
        assert_eq!(cache.total, 1);
    }

    #[test]
    fn private_optimistic_create_is_not_added_to_public_cache() {
        let mut private = rose("temp-private", "white");
        private.is_private = true;
        let cache = GardenCache::empty("t0".into()).apply(GardenCacheAction::OptimisticCreate {
            rose: private,
            updated_at: "t1".into(),
        });
        assert!(cache.roses.is_empty());
        assert_eq!(cache.total, 0);
    }

    #[test]
    fn confirm_create_replaces_temp_id() {
        let cache = GardenCache::empty("t0".into()).apply(GardenCacheAction::OptimisticCreate {
            rose: rose("temp-1", "red"),
            updated_at: "t1".into(),
        });
        let cache = cache.apply(GardenCacheAction::ConfirmCreate {
            temp_id: "temp-1".into(),
            rose: rose("real-1", "red"),
            updated_at: "t2".into(),
        });
        assert_eq!(cache.roses.len(), 1);
        assert_eq!(cache.roses[0].id, "real-1");
        assert_eq!(cache.roses[0].sync_status, "synced");
        assert_eq!(cache.total, 1);
    }

    #[test]
    fn reject_create_removes_temp_and_decrements_total() {
        let cache = GardenCache::empty("t0".into()).apply(GardenCacheAction::OptimisticCreate {
            rose: rose("temp-1", "red"),
            updated_at: "t1".into(),
        });
        let cache = cache.apply(GardenCacheAction::RejectCreate {
            temp_id: "temp-1".into(),
            updated_at: "t2".into(),
        });
        assert!(cache.roses.is_empty());
        assert_eq!(cache.total, 0);
    }

    #[test]
    fn apply_cache_action_accepts_empty_cache() {
        let result = apply_cache_action(
            "",
            r#"{"type":"upsert","rose":{"id":"1","color":"yellow","gratitude":null,"anxiety":null,"hope":"soon","nickname":null,"like_count":0,"ai_reply":null,"created_at":"now"},"updated_at":"now"}"#,
        )
        .unwrap();
        assert_eq!(result.roses.len(), 1);
        assert_eq!(result.roses[0].sync_status, "synced");
    }
}
