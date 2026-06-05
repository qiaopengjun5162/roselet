use serde::Serialize;

/// Rust 驱动的前端 API 客户端 —— JS 只管调 wx.request/fetch
pub struct ApiClient {
    base_url: String,
}

#[derive(Debug, Serialize)]
pub struct Pagination {
    pub has_more: bool,
    pub next_page: u32,
    pub total_pages: u32,
    pub page: u32,
    pub per_page: u32,
}

impl ApiClient {
    pub fn new(base_url: String) -> Self {
        Self { base_url }
    }

    /// 构造花圃列表请求 URL
    pub fn build_garden_url(&self, page: u32, per_page: u32, color: Option<&str>) -> String {
        let mut url = format!(
            "{}/api/garden?page={}&per_page={}",
            self.base_url, page, per_page
        );
        if let Some(c) = color {
            if !c.is_empty() && c != "all" {
                url.push_str(&format!("&color={}", c));
            }
        }
        url
    }

    /// 构造种花请求体 JSON
    pub fn build_plant_body(
        &self,
        color: &str,
        gratitude: Option<&str>,
        anxiety: Option<&str>,
        hope: Option<&str>,
    ) -> String {
        let mut fields = Vec::new();
        fields.push(format!("\"color\":\"{}\"", color));
        if let Some(g) = gratitude {
            if !g.is_empty() {
                fields.push(format!("\"gratitude\":\"{}\"", g));
            }
        }
        if let Some(a) = anxiety {
            if !a.is_empty() {
                fields.push(format!("\"anxiety\":\"{}\"", a));
            }
        }
        if let Some(h) = hope {
            if !h.is_empty() {
                fields.push(format!("\"hope\":\"{}\"", h));
            }
        }
        format!("{{{}}}", fields.join(","))
    }

    /// 构造注册请求体
    pub fn build_register_body(&self, nickname: &str) -> String {
        format!("{{\"nickname\":\"{}\"}}", nickname)
    }

    /// 计算分页信息
    pub fn compute_pagination(&self, total: u32, page: u32, per_page: u32) -> Pagination {
        let total_pages = if total == 0 {
            1
        } else {
            (total + per_page - 1) / per_page
        };
        Pagination {
            has_more: (page as u64) * (per_page as u64) < total as u64,
            next_page: page + 1,
            total_pages,
            page,
            per_page,
        }
    }
}

impl Default for ApiClient {
    fn default() -> Self {
        Self::new("http://localhost:3001".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_garden_url() {
        let client = ApiClient::default();
        let url = client.build_garden_url(1, 20, None);
        assert_eq!(url, "http://localhost:3001/api/garden?page=1&per_page=20");
    }

    #[test]
    fn test_build_garden_url_with_color() {
        let client = ApiClient::default();
        let url = client.build_garden_url(2, 10, Some("red"));
        assert!(url.contains("&color=red"));
        assert!(url.contains("page=2"));
    }

    #[test]
    fn test_build_garden_url_all_skipped() {
        let client = ApiClient::default();
        let url = client.build_garden_url(1, 20, Some("all"));
        assert!(!url.contains("color"));
    }

    #[test]
    fn test_build_plant_body() {
        let client = ApiClient::default();
        let body = client.build_plant_body("red", Some("hi"), None, Some("hope"));
        assert!(body.contains("\"color\":\"red\""));
        assert!(body.contains("\"gratitude\":\"hi\""));
        assert!(body.contains("\"hope\":\"hope\""));
        assert!(!body.contains("anxiety"));
    }

    #[test]
    fn test_pagination_has_more() {
        let client = ApiClient::default();
        let p = client.compute_pagination(50, 1, 20);
        assert!(p.has_more);
        assert_eq!(p.total_pages, 3);
        assert_eq!(p.next_page, 2);
    }

    #[test]
    fn test_pagination_last_page() {
        let client = ApiClient::default();
        let p = client.compute_pagination(40, 2, 20);
        assert!(!p.has_more);
        assert_eq!(p.total_pages, 2);
    }

    #[test]
    fn test_pagination_empty() {
        let client = ApiClient::default();
        let p = client.compute_pagination(0, 1, 20);
        assert!(!p.has_more);
        assert_eq!(p.total_pages, 1);
    }
}
