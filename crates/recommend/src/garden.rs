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

/// 屏幕环境参数（由前端传入）
#[derive(Debug, Deserialize)]
pub struct ScreenInfo {
    pub width: u32,
    pub height: u32,
    pub safe_area_top: u32,
    pub safe_area_bottom: u32,
    pub is_web: bool,
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
    /// 顶部安全偏移 (px) —— 前端应设为 padding-top
    pub offset_top: u32,
    /// 底部安全偏移 (px) —— 前端应设为 padding-bottom
    pub offset_bottom: u32,
}

impl GardenLayout {
    /// 根据屏幕信息和安全区计算最优布局
    pub fn compute(info: &ScreenInfo) -> Self {
        let (columns, gap, padding_x) = if info.is_web {
            match info.width {
                w if w < 640 => (1, 12, 16),
                w if w < 1024 => (2, 16, 24),
                _ => (3, 20, 32),
            }
        } else {
            match info.width {
                w if w < 400 => (1, 16, 20),
                _ => (2, 20, 28),
            }
        };
        let total_gap = gap * (columns + 1);
        let card_width = (info.width - total_gap - padding_x * 2) / columns;

        // 安全区补偿 —— 确保内容不被刘海/HomeBar遮挡
        let offset_top = if info.safe_area_top > 0 {
            info.safe_area_top + 12 // 安全区基础上再加 12px 呼吸空间
        } else {
            16 // 无安全区时默认 16px
        };
        let offset_bottom = if info.safe_area_bottom > 0 {
            info.safe_area_bottom + 8
        } else {
            16
        };

        Self {
            card_width,
            columns,
            gap,
            padding_x,
            offset_top,
            offset_bottom,
        }
    }

    /// 简化接口 — 向后兼容
    pub fn compute_simple(screen_width: u32, is_web: bool) -> Self {
        Self::compute(&ScreenInfo {
            width: screen_width,
            height: 0,
            safe_area_top: 0,
            safe_area_bottom: 0,
            is_web,
        })
    }
}

/// 花园状态管理器——核心逻辑全部在 Rust 侧
pub struct GardenState {
    filter: String,
    roses: Vec<RoseItem>,
}

impl GardenState {
    pub fn new() -> Self {
        Self {
            filter: String::from("all"),
            roses: Vec::new(),
        }
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
            RoseItem {
                id: "1".into(),
                color: "red".into(),
                gratitude: None,
                anxiety: None,
                hope: None,
                nickname: None,
                like_count: 0,
                ai_reply: None,
                created_at: "".into(),
            },
            RoseItem {
                id: "2".into(),
                color: "white".into(),
                gratitude: None,
                anxiety: None,
                hope: None,
                nickname: None,
                like_count: 0,
                ai_reply: None,
                created_at: "".into(),
            },
        ]);
        state.set_filter("all".into());
        assert_eq!(state.filtered().len(), 2);
    }

    #[test]
    fn test_filter_red() {
        let mut state = GardenState::new();
        state.set_roses(vec![
            RoseItem {
                id: "1".into(),
                color: "red".into(),
                gratitude: None,
                anxiety: None,
                hope: None,
                nickname: None,
                like_count: 0,
                ai_reply: None,
                created_at: "".into(),
            },
            RoseItem {
                id: "2".into(),
                color: "white".into(),
                gratitude: None,
                anxiety: None,
                hope: None,
                nickname: None,
                like_count: 0,
                ai_reply: None,
                created_at: "".into(),
            },
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
        let layout = GardenLayout::compute_simple(375, false);
        assert_eq!(layout.columns, 1);
        assert!(layout.card_width > 200);
    }

    #[test]
    fn test_layout_desktop() {
        let layout = GardenLayout::compute_simple(1440, true);
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
