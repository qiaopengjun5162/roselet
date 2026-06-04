use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoseItem {
    pub id: String,
    pub color: String,
    pub gratitude: Option<String>,
    pub anxiety: Option<String>,
    pub hope: Option<String>,
    pub nickname: Option<String>,
    pub like_count: u32,
    pub ai_reply: Option<String>,
    pub created_at: String,
}

/// 花圃布局计算结果（Rust 驱动前端排版）
#[derive(Debug, Serialize)]
pub struct GardenLayout {
    /// 卡片宽度 (px)
    pub card_width: u32,
    /// 列数
    pub columns: u32,
    /// 卡片间距 (px)
    pub gap: u32,
    /// 水平内边距 (px)
    pub padding_x: u32,
}

impl GardenLayout {
    /// 根据屏幕宽度计算最优布局
    /// screen_width: 可用宽度 (px 或 rpx)
    /// is_web: true = Web 端 (px), false = 小程序 (rpx)
    pub fn compute(screen_width: u32, is_web: bool) -> Self {
        let (columns, gap, padding_x) = if is_web {
            match screen_width {
                w if w < 640 => (1, 12, 16),
                w if w < 1024 => (2, 16, 24),
                _ => (3, 20, 32),
            }
        } else {
            // 小程序 rpx
            match screen_width {
                w if w < 400 => (1, 16, 20),
                _ => (2, 20, 28),
            }
        };
        let total_gap = gap * (columns + 1);
        let card_width = (screen_width - total_gap - padding_x * 2) / columns;
        Self { card_width, columns, gap, padding_x }
    }
}

/// 花园状态管理器——核心逻辑全部在 Rust 侧
pub struct GardenState {
    filter: String,
    roses: Vec<RoseItem>,
}

impl GardenState {
    pub fn new() -> Self {
        Self { filter: String::from("all"), roses: Vec::new() }
    }

    pub fn set_roses(&mut self, roses: Vec<RoseItem>) {
        self.roses = roses;
    }

    pub fn set_filter(&mut self, filter: String) {
        self.filter = filter;
    }

    pub fn get_filter(&self) -> &str {
        &self.filter
    }

    /// Rust 侧过滤——Web 和 小程序调用同一个函数，结果 100% 一致
    pub fn filtered(&self) -> Vec<&RoseItem> {
        if self.filter == "all" || self.filter.is_empty() {
            self.roses.iter().collect()
        } else {
            self.roses.iter().filter(|r| r.color == self.filter).collect()
        }
    }
}

impl Default for GardenState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filter_all() {
        let mut state = GardenState::new();
        state.set_roses(vec![
            RoseItem { id: "1".into(), color: "red".into(), gratitude: None, anxiety: None, hope: None, nickname: None, like_count: 0, ai_reply: None, created_at: "".into() },
            RoseItem { id: "2".into(), color: "white".into(), gratitude: None, anxiety: None, hope: None, nickname: None, like_count: 0, ai_reply: None, created_at: "".into() },
        ]);
        state.set_filter("all".into());
        assert_eq!(state.filtered().len(), 2);
    }

    #[test]
    fn test_filter_red() {
        let mut state = GardenState::new();
        state.set_roses(vec![
            RoseItem { id: "1".into(), color: "red".into(), gratitude: None, anxiety: None, hope: None, nickname: None, like_count: 0, ai_reply: None, created_at: "".into() },
            RoseItem { id: "2".into(), color: "white".into(), gratitude: None, anxiety: None, hope: None, nickname: None, like_count: 0, ai_reply: None, created_at: "".into() },
        ]);
        state.set_filter("red".into());
        assert_eq!(state.filtered().len(), 1);
        assert_eq!(state.filtered()[0].id, "1");
    }

    #[test]
    fn test_filter_empty() {
        let mut state = GardenState::new();
        state.set_roses(vec![]);
        assert_eq!(state.filtered().len(), 0);
    }

    #[test]
    fn test_layout_mobile() {
        let layout = GardenLayout::compute(375, false);
        assert_eq!(layout.columns, 1);
        assert!(layout.card_width > 200);
    }

    #[test]
    fn test_layout_desktop() {
        let layout = GardenLayout::compute(1440, true);
        assert_eq!(layout.columns, 3);
        assert!(layout.card_width > 300);
    }

    #[test]
    fn test_default_state() {
        let state = GardenState::default();
        assert_eq!(state.get_filter(), "all");
        assert_eq!(state.filtered().len(), 0);
    }
}
