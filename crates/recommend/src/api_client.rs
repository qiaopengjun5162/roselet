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
        is_private: bool,
        recipient_nickname: Option<&str>,
    ) -> String {
        fn is_false(value: &bool) -> bool {
            !*value
        }

        #[derive(Serialize)]
        struct PlantBody<'a> {
            color: &'a str,
            #[serde(skip_serializing_if = "Option::is_none")]
            gratitude: Option<&'a str>,
            #[serde(skip_serializing_if = "Option::is_none")]
            anxiety: Option<&'a str>,
            #[serde(skip_serializing_if = "Option::is_none")]
            hope: Option<&'a str>,
            #[serde(skip_serializing_if = "is_false")]
            is_private: bool,
            #[serde(skip_serializing_if = "Option::is_none")]
            recipient_nickname: Option<&'a str>,
        }

        serde_json::to_string(&PlantBody {
            color,
            gratitude: gratitude.filter(|v| !v.is_empty()),
            anxiety: anxiety.filter(|v| !v.is_empty()),
            hope: hope.filter(|v| !v.is_empty()),
            is_private,
            recipient_nickname: recipient_nickname.filter(|v| !v.is_empty()),
        })
        .unwrap_or_else(|_| "{\"color\":\"red\"}".to_string())
    }

    /// 计算分页信息
    pub fn compute_pagination(&self, total: u32, page: u32, per_page: u32) -> Pagination {
        let total_pages = if total == 0 {
            1
        } else {
            total.div_ceil(per_page)
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
        let body = client.build_plant_body("red", Some("hi"), None, Some("hope"), false, None);
        assert!(body.contains("\"color\":\"red\""));
        assert!(body.contains("\"gratitude\":\"hi\""));
        assert!(body.contains("\"hope\":\"hope\""));
        assert!(!body.contains("anxiety"));
        assert!(!body.contains("is_private"));
        assert!(!body.contains("recipient_nickname"));
    }

    #[test]
    fn test_build_plant_body_private() {
        let client = ApiClient::default();
        let body = client.build_plant_body("white", Some("secret"), None, None, true, None);
        let value: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(value["color"], "white");
        assert_eq!(value["gratitude"], "secret");
        assert_eq!(value["is_private"], true);
    }

    #[test]
    fn test_build_plant_body_escapes_text() {
        let client = ApiClient::default();
        let body = client.build_plant_body("red", Some("quote\"slash\\"), None, None, false, None);
        let value: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(value["gratitude"], "quote\"slash\\");
    }

    #[test]
    fn test_build_plant_body_with_recipient() {
        let client = ApiClient::default();
        let body = client.build_plant_body("red", Some("感谢"), None, None, false, Some("小红"));
        let value: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(value["recipient_nickname"], "小红");
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
