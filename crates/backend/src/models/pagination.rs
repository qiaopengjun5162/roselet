use serde::{Deserialize, Serialize};

/// 分页查询参数
#[derive(Debug, Deserialize)]
pub struct Pagination {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

impl Pagination {
    pub fn offset(&self) -> i64 {
        let page = self.page.unwrap_or(1).max(1);
        let per_page = self.per_page();
        (page - 1) * per_page
    }

    pub fn per_page(&self) -> i64 {
        self.per_page.unwrap_or(20).clamp(1, 100)
    }
}

/// 分页响应
#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T: Serialize> {
    pub data: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_per_page_default() {
        let p = Pagination {
            page: None,
            per_page: None,
        };
        assert_eq!(p.per_page(), 20);
    }

    #[test]
    fn test_per_page_clamp_min() {
        let p = Pagination {
            page: None,
            per_page: Some(0),
        };
        assert_eq!(p.per_page(), 1);
    }

    #[test]
    fn test_per_page_clamp_max() {
        let p = Pagination {
            page: None,
            per_page: Some(200),
        };
        assert_eq!(p.per_page(), 100);
    }

    #[test]
    fn test_per_page_valid() {
        let p = Pagination {
            page: None,
            per_page: Some(50),
        };
        assert_eq!(p.per_page(), 50);
    }

    #[test]
    fn test_offset_default() {
        let p = Pagination {
            page: None,
            per_page: None,
        };
        assert_eq!(p.offset(), 0);
    }

    #[test]
    fn test_offset_page_1() {
        let p = Pagination {
            page: Some(1),
            per_page: Some(10),
        };
        assert_eq!(p.offset(), 0);
    }

    #[test]
    fn test_offset_page_2() {
        let p = Pagination {
            page: Some(2),
            per_page: Some(10),
        };
        assert_eq!(p.offset(), 10);
    }

    #[test]
    fn test_offset_page_zero_clamped() {
        let p = Pagination {
            page: Some(0),
            per_page: Some(10),
        };
        assert_eq!(p.offset(), 0);
    }

    #[test]
    fn test_offset_negative_page_clamped() {
        let p = Pagination {
            page: Some(-5),
            per_page: Some(10),
        };
        assert_eq!(p.offset(), 0);
    }
}
