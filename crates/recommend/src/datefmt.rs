use chrono::{Datelike, NaiveDateTime, Utc};
use serde::Serialize;

#[derive(Debug, Serialize)]
#[allow(dead_code)]
pub struct FormattedDate {
    /// "2026年6月4日"
    pub full_cn: String,
    /// "6月4日"
    pub short_cn: String,
    /// "2026-06-04"
    pub iso: String,
    /// "星期四"
    pub weekday_cn: String,
    /// 相对时间: "刚刚", "3分钟前", "2小时前", "3天前"
    pub relative: String,
}

#[allow(dead_code)]
const WEEKDAYS: &[&str] = &["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];

/// Rust 统一日期格式化 —— 跨端一致，消除时区差异
#[allow(dead_code)]
pub fn format_date(iso_str: &str) -> FormattedDate {
    let default = FormattedDate {
        full_cn: String::new(),
        short_cn: String::new(),
        iso: String::new(),
        weekday_cn: String::new(),
        relative: String::new(),
    };

    let dt = if let Ok(dt) = NaiveDateTime::parse_from_str(iso_str, "%Y-%m-%dT%H:%M:%S%.f") {
        dt.and_utc()
    } else if let Ok(dt) = NaiveDateTime::parse_from_str(iso_str, "%Y-%m-%dT%H:%M:%S") {
        dt.and_utc()
    } else {
        return default;
    };

    let now = Utc::now();
    let duration = now.signed_duration_since(dt);
    let mins = duration.num_minutes();
    let hours = duration.num_hours();
    let days = duration.num_days();

    let relative = if mins < 1 {
        "刚刚".into()
    } else if mins < 60 {
        format!("{}分钟前", mins)
    } else if hours < 24 {
        format!("{}小时前", hours)
    } else if days < 7 {
        format!("{}天前", days)
    } else {
        format!("{}月{}日", dt.month(), dt.day())
    };

    FormattedDate {
        full_cn: format!("{}年{}月{}日", dt.year(), dt.month(), dt.day()),
        short_cn: format!("{}月{}日", dt.month(), dt.day()),
        iso: dt.format("%Y-%m-%d").to_string(),
        weekday_cn: WEEKDAYS[dt.weekday().num_days_from_monday() as usize].into(),
        relative,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_recent() {
        let now = Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        let result = format_date(&now);
        assert_eq!(result.relative, "刚刚");
    }

    #[test]
    fn test_format_chinese() {
        let result = format_date("2026-06-04T12:00:00");
        assert_eq!(result.full_cn, "2026年6月4日");
        assert_eq!(result.short_cn, "6月4日");
        assert_eq!(result.iso, "2026-06-04");
        assert_eq!(result.weekday_cn, "星期四");
    }

    #[test]
    fn test_invalid_date() {
        let result = format_date("not a date");
        assert!(result.full_cn.is_empty());
    }
}
