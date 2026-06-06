use serde::{Deserialize, Serialize};

fn synced_status() -> String {
    "synced".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoseItem {
    pub id: String,
    pub color: String,
    pub gratitude: Option<String>,
    pub anxiety: Option<String>,
    pub hope: Option<String>,
    #[serde(default)]
    pub user_id: Option<String>,
    pub nickname: Option<String>,
    pub like_count: u32,
    pub ai_reply: Option<String>,
    #[serde(default)]
    pub is_private: bool,
    pub created_at: String,
    #[serde(default = "synced_status")]
    pub sync_status: String,
}

/// 屏幕环境参数（由前端传入）
#[derive(Debug, Deserialize)]
pub struct ScreenInfo {
    pub width: u32,
    #[allow(dead_code)]
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
    #[allow(dead_code)]
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

    #[allow(dead_code)]
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
                user_id: None,
                nickname: None,
                like_count: 0,
                ai_reply: None,
                is_private: false,
                created_at: "".into(),
                sync_status: "synced".into(),
            },
            RoseItem {
                id: "2".into(),
                color: "white".into(),
                gratitude: None,
                anxiety: None,
                hope: None,
                user_id: None,
                nickname: None,
                like_count: 0,
                ai_reply: None,
                is_private: false,
                created_at: "".into(),
                sync_status: "synced".into(),
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
                user_id: None,
                nickname: None,
                like_count: 0,
                ai_reply: None,
                is_private: false,
                created_at: "".into(),
                sync_status: "synced".into(),
            },
            RoseItem {
                id: "2".into(),
                color: "white".into(),
                gratitude: None,
                anxiety: None,
                hope: None,
                user_id: None,
                nickname: None,
                like_count: 0,
                ai_reply: None,
                is_private: false,
                created_at: "".into(),
                sync_status: "synced".into(),
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

#[cfg(test)]
mod device_tests {
    use super::*;

    /// 模拟真机参数矩阵 —— 不依赖模拟器，Rust 侧跑所有机型
    struct Device {
        name: &'static str,
        width: u32,
        height: u32,
        safe_top: u32,
        safe_bottom: u32,
    }

    fn devices() -> Vec<Device> {
        vec![
            Device {
                name: "iPhone 14 Pro",
                width: 393,
                height: 852,
                safe_top: 54,
                safe_bottom: 34,
            },
            Device {
                name: "iPhone SE",
                width: 375,
                height: 667,
                safe_top: 20,
                safe_bottom: 0,
            },
            Device {
                name: "iPhone 15 Pro Max",
                width: 430,
                height: 932,
                safe_top: 54,
                safe_bottom: 34,
            },
            Device {
                name: "小米 14",
                width: 393,
                height: 852,
                safe_top: 44,
                safe_bottom: 24,
            },
            Device {
                name: "华为 Mate 60 Pro",
                width: 440,
                height: 960,
                safe_top: 48,
                safe_bottom: 28,
            },
            Device {
                name: "OPPO Find N3 (折叠)",
                width: 450,
                height: 1020,
                safe_top: 44,
                safe_bottom: 24,
            },
        ]
    }

    #[test]
    fn test_all_devices_layout() {
        for d in devices() {
            let info = ScreenInfo {
                width: d.width,
                height: d.height,
                safe_area_top: d.safe_top,
                safe_area_bottom: d.safe_bottom,
                is_web: false,
            };
            let layout = GardenLayout::compute(&info);
            // 卡片不能比屏幕宽
            assert!(
                layout.card_width < info.width,
                "{}: card {} >= width {}",
                d.name,
                layout.card_width,
                info.width
            );
            // 列数至少 1
            assert!(layout.columns >= 1, "{}: columns=0", d.name);
            // 顶部偏移必须大于安全区
            assert!(
                layout.offset_top > info.safe_area_top,
                "{}: offset_top {} <= safe_top {}",
                d.name,
                layout.offset_top,
                info.safe_area_top
            );
            // 底部偏移必须大于等于安全区
            assert!(
                layout.offset_bottom >= info.safe_area_bottom,
                "{}: offset_bottom {} < safe_bottom {}",
                d.name,
                layout.offset_bottom,
                info.safe_area_bottom
            );
        }
    }

    #[test]
    fn test_no_device_has_zero_card() {
        for d in devices() {
            let info = ScreenInfo {
                width: d.width,
                height: d.height,
                safe_area_top: d.safe_top,
                safe_area_bottom: d.safe_bottom,
                is_web: false,
            };
            let layout = GardenLayout::compute(&info);
            assert!(
                layout.card_width > 100,
                "{}: card_width too small: {}",
                d.name,
                layout.card_width
            );
        }
    }
}

/// API 响应解析 — Rust 强类型验证后端数据
#[derive(Debug, Deserialize)]
pub struct ApiResponse {
    pub data: Option<serde_json::Value>,
    pub total: Option<u32>,
    #[allow(dead_code)]
    pub page: Option<u32>,
    #[allow(dead_code)]
    pub per_page: Option<u32>,
}

/// 解析花圃列表响应，返回验证后的 RoseItem 数组
pub fn parse_garden_response(json: &str) -> Result<(Vec<RoseItem>, u32), String> {
    let resp: ApiResponse =
        serde_json::from_str(json).map_err(|e| format!("JSON 解析失败: {}", e))?;
    let total = resp.total.unwrap_or(0);
    let items = match resp.data {
        Some(serde_json::Value::Array(arr)) => arr
            .iter()
            .map(|v| serde_json::from_value::<RoseItem>(v.clone()))
            .filter_map(|r| r.ok())
            .collect(),
        _ => Vec::new(),
    };
    Ok((items, total))
}

/// 解析单朵玫瑰响应
pub fn parse_rose_response(json: &str) -> Result<RoseItem, String> {
    serde_json::from_str::<RoseItem>(json).map_err(|e| format!("玫瑰数据解析失败: {}", e))
}

#[cfg(test)]
mod api_tests {
    use super::*;

    #[test]
    fn test_parse_garden_response() {
        let json = r#"{"data":[{"id":"1","color":"red","gratitude":"hello","anxiety":null,"hope":null,"nickname":"alice","like_count":3,"ai_reply":null,"created_at":"2026-06-04"}],"total":1,"page":1,"per_page":20}"#;
        let (items, total) = parse_garden_response(json).unwrap();
        assert_eq!(total, 1);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, "1");
        assert_eq!(items[0].color, "red");
        assert_eq!(items[0].gratitude.as_deref().unwrap(), "hello");
        assert_eq!(items[0].nickname.as_deref().unwrap(), "alice");
        assert_eq!(items[0].like_count, 3);
    }

    #[test]
    fn test_parse_empty_garden() {
        let json = r#"{"data":[],"total":0,"page":1,"per_page":20}"#;
        let (items, total) = parse_garden_response(json).unwrap();
        assert_eq!(total, 0);
        assert_eq!(items.len(), 0);
    }

    #[test]
    fn test_parse_rose_response() {
        let json = r#"{"id":"abc","color":"white","gratitude":"peace","anxiety":null,"hope":null,"nickname":"bob","like_count":5,"ai_reply":"hello world","created_at":"2026-06-04"}"#;
        let rose = parse_rose_response(json).unwrap();
        assert_eq!(rose.id, "abc");
        assert_eq!(rose.ai_reply.unwrap(), "hello world");
    }

    #[test]
    fn test_parse_invalid_json() {
        assert!(parse_garden_response("not json").is_err());
        assert!(parse_rose_response("{broken").is_err());
    }
}
