use crate::garden::RoseItem;
use serde::{Deserialize, Serialize};

/// 前端 Action —— 纯数据，不携带逻辑
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StoreAction {
    /// 替换全部玫瑰列表
    SetRoses {
        roses: Vec<RoseItem>,
        total: u32,
        page: u32,
    },
    /// 追加玫瑰（分页加载更多）
    AppendRoses { roses: Vec<RoseItem>, page: u32 },
    /// 更改颜色筛选
    SetFilter { filter: String },
    /// 设置加载状态
    SetLoading { loading: bool },
    /// 设置错误信息
    SetError { error: String },
    /// 用户登录
    SetAuth { user_id: String, nickname: String },
    /// 用户登出
    ClearAuth,
    /// 重置整个状态
    Reset,
}

/// 状态快照 —— 前端直接渲染
#[derive(Debug, Serialize)]
pub struct StoreSnapshot {
    /// 用户 ID（认证后）
    pub user_id: Option<String>,
    /// 用户昵称
    pub nickname: Option<String>,
    /// 是否已认证
    pub authenticated: bool,
    /// 当前筛选后的玫瑰
    pub filtered: Vec<RoseItem>,
    /// 筛选器
    pub filter: String,
    /// 当前页码
    pub page: u32,
    /// 总数
    pub total: u32,
    /// 是否还有更多
    pub has_more: bool,
    /// 是否加载中
    pub loading: bool,
    /// 错误信息
    pub error: Option<String>,
}

/// Rust 驱动的状态机 —— 前端只管发 Action，Rust 返回新快照
pub struct Store {
    roses: Vec<RoseItem>,
    filter: String,
    page: u32,
    total: u32,
    loading: bool,
    error: Option<String>,
    user_id: Option<String>,
    nickname: Option<String>,
}

impl Store {
    pub fn new() -> Self {
        Self {
            roses: Vec::new(),
            filter: String::from("all"),
            page: 1,
            total: 0,
            loading: true,
            error: None,
            user_id: None,
            nickname: None,
        }
    }

    /// 处理一个 Action，返回新状态快照
    pub fn dispatch(&mut self, action: StoreAction) -> StoreSnapshot {
        match action {
            StoreAction::SetRoses { roses, total, page } => {
                self.roses = roses;
                self.total = total;
                self.page = page;
                self.loading = false;
                self.error = None;
            }
            StoreAction::AppendRoses { roses, page } => {
                self.roses.extend(roses);
                self.page = page;
                self.loading = false;
            }
            StoreAction::SetFilter { filter } => {
                self.filter = filter;
                self.page = 1;
                self.loading = true;
            }
            StoreAction::SetAuth { user_id, nickname } => {
                self.user_id = Some(user_id);
                self.nickname = Some(nickname);
            }
            StoreAction::ClearAuth => {
                self.user_id = None;
                self.nickname = None;
            }
            StoreAction::SetLoading { loading } => {
                self.loading = loading;
            }
            StoreAction::SetError { error } => {
                self.error = Some(error);
                self.loading = false;
            }
            StoreAction::Reset => {
                *self = Self::new();
            }
        }
        self.snapshot()
    }

    /// 获取当前状态快照
    pub fn snapshot(&self) -> StoreSnapshot {
        let filtered: Vec<RoseItem> = if self.filter == "all" || self.filter.is_empty() {
            self.roses.clone()
        } else {
            self.roses.iter().filter(|r| r.color == self.filter).cloned().collect()
        };

        StoreSnapshot {
            user_id: self.user_id.clone(),
            nickname: self.nickname.clone(),
            authenticated: self.user_id.is_some(),
            filtered,
            filter: self.filter.clone(),
            page: self.page,
            total: self.total,
            has_more: (self.filtered_len() as u32) < self.total,
            loading: self.loading,
            error: self.error.clone(),
        }
    }

    fn filtered_len(&self) -> usize {
        if self.filter == "all" || self.filter.is_empty() {
            self.roses.len()
        } else {
            self.roses.iter().filter(|r| r.color == self.filter).count()
        }
    }
}

impl Default for Store {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_rose(id: &str, color: &str) -> RoseItem {
        RoseItem {
            id: id.into(),
            color: color.into(),
            gratitude: None,
            anxiety: None,
            hope: None,
            nickname: None,
            like_count: 0,
            ai_reply: None,
            user_id: None,
            created_at: String::new(),
            is_private: false,
            sync_status: "synced".into(),
        }
    }

    #[test]
    fn test_set_roses_and_filter() {
        let mut store = Store::new();
        let snap = store.dispatch(StoreAction::SetRoses {
            roses: vec![make_rose("1", "red"), make_rose("2", "white")],
            total: 2,
            page: 1,
        });
        assert_eq!(snap.total, 2);
        assert_eq!(snap.filtered.len(), 2);
        assert!(!snap.has_more);
        assert!(!snap.loading);

        let snap = store.dispatch(StoreAction::SetFilter {
            filter: "red".into(),
        });
        assert_eq!(snap.filtered.len(), 1);
        assert_eq!(snap.filtered[0].color, "red");
        assert!(snap.loading);
    }

    #[test]
    fn test_append_and_pagination() {
        let mut store = Store::new();
        store.dispatch(StoreAction::SetRoses {
            roses: vec![make_rose("1", "red")],
            total: 5,
            page: 1,
        });
        let snap = store.dispatch(StoreAction::AppendRoses {
            roses: vec![make_rose("2", "white"), make_rose("3", "red")],
            page: 2,
        });
        assert_eq!(snap.filtered.len(), 3);
        assert_eq!(snap.page, 2);
        assert!(snap.has_more);
    }

    #[test]
    fn test_error_handling() {
        let mut store = Store::new();
        let snap = store.dispatch(StoreAction::SetError {
            error: "网络错误".into(),
        });
        assert_eq!(snap.error.unwrap(), "网络错误");
        assert!(!snap.loading);
    }

    #[test]
    fn test_reset() {
        let mut store = Store::new();
        store.dispatch(StoreAction::SetRoses {
            roses: vec![make_rose("1", "red")],
            total: 1,
            page: 1,
        });
        let snap = store.dispatch(StoreAction::Reset);
        assert_eq!(snap.total, 0);
        assert!(snap.loading);
    }
}
