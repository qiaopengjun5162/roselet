//! 「一周后回来，看看自己长出了什么」的计算层。
//!
//! 种完反馈上写着「一周后回来」，可如果第 8 天回来看到的还是同一个花圃，
//! 这句承诺就是空的 —— 用户没有理由再回来。这里把「这一周」摊开：
//! 种了几朵、三类各几句、写下过哪些原话。
//!
//! 放在 Rust WASM 而不是页面里，是为了 Web / 小程序用同一套口径
//! （AGENTS.md：跨端可测试逻辑优先放 `crates/recommend`）。

use chrono::{DateTime, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};

/// 承诺里的那个「一周」。
pub const WEEK_DAYS: i64 = 7;
const DAY_MS: i64 = 24 * 60 * 60 * 1000;
const WEEK_MS: i64 = WEEK_DAYS * DAY_MS;

/// 计算只需要玫瑰的时间和三段正文，不依赖后端完整结构。
#[derive(Debug, Deserialize)]
pub struct WeekRose {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub gratitude: Option<String>,
    #[serde(default)]
    pub anxiety: Option<String>,
    #[serde(default)]
    pub hope: Option<String>,
}

#[derive(Debug, Default, PartialEq, Serialize)]
pub struct KindCounts {
    pub gratitude: u32,
    pub anxiety: u32,
    pub hope: u32,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct WeekQuote {
    pub id: String,
    pub kind: String,
    pub text: String,
    pub age_days: i64,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct WeekReview {
    /// 我种过的全部玫瑰数（不只是这一周）。
    pub total: u32,
    /// 最近 7 天种下的玫瑰数。
    pub in_week: u32,
    /// 第一朵种于几天前。
    pub days_since_first: i64,
    /// 还差几天到第 7 天；已到则为 0。
    pub days_until_ready: i64,
    pub ready: bool,
    /// 最近 7 天三类正文各写了几句（一朵玫瑰可同时有三段）。
    pub counts: KindCounts,
    /// 最近 7 天的原话，新→旧；一朵玫瑰有几段就出几条。
    pub quotes: Vec<WeekQuote>,
}

/// 后端 `created_at` 在不同链路下可能是 RFC3339（带 Z 或 +00:00），
/// 也可能是 `sqlx` 直接序列化的无时区字符串 —— 两种都要认。
pub fn parse_created_at(raw: &str) -> Option<DateTime<Utc>> {
    if let Ok(dt) = DateTime::parse_from_rfc3339(raw) {
        return Some(dt.with_timezone(&Utc));
    }
    const NAIVE_FORMATS: [&str; 4] = [
        "%Y-%m-%dT%H:%M:%S%.f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S%.f",
        "%Y-%m-%d %H:%M:%S",
    ];
    NAIVE_FORMATS
        .iter()
        .find_map(|fmt| NaiveDateTime::parse_from_str(raw, fmt).ok())
        .map(|naive| naive.and_utc())
}

/// `now_ms` 由调用方传入（WASM 里不取系统时钟，测试才好写）。
pub fn build_week_review(roses: &[WeekRose], now_ms: i64) -> WeekReview {
    let mut parsed: Vec<(i64, &WeekRose)> = roses
        .iter()
        .filter_map(|rose| {
            parse_created_at(&rose.created_at).map(|dt| (dt.timestamp_millis(), rose))
        })
        .collect();
    // 新 -> 旧；末尾即第一朵。
    parsed.sort_by_key(|entry| std::cmp::Reverse(entry.0));

    let total = roses.len() as u32;
    let mut review = WeekReview {
        total,
        in_week: 0,
        days_since_first: 0,
        days_until_ready: WEEK_DAYS,
        ready: false,
        counts: KindCounts::default(),
        quotes: Vec::new(),
    };

    let Some(&(first_ms, _)) = parsed.last() else {
        // 一条合法时间都没有：不谎称「已到一周」，就按刚种下处理。
        return review;
    };

    // 时钟漂移产生的未来时间按 0 天算，不显示成负数。
    review.days_since_first = (now_ms - first_ms).max(0) / DAY_MS;
    review.days_until_ready = (WEEK_DAYS - review.days_since_first).max(0);
    review.ready = review.days_since_first >= WEEK_DAYS;

    // 第一次回来（第 7~13 天）摊开的是「从第一朵到现在」：用户第 8 天回来时，
    // 若只取最近 7 天，第 1 天种下那朵恰好掉出窗口 —— 承诺兑现的那一刻，
    // 页面反而说「这一周没有新的玫瑰」。第二次以后才按最近 7 天算。
    let window_start = if review.days_since_first < 2 * WEEK_DAYS {
        first_ms
    } else {
        now_ms - WEEK_MS
    };

    for (ms, rose) in &parsed {
        if *ms < window_start {
            continue;
        }
        review.in_week += 1;
        let age_days = (now_ms - *ms).max(0) / DAY_MS;
        let fields = [
            ("gratitude", rose.gratitude.as_deref()),
            ("anxiety", rose.anxiety.as_deref()),
            ("hope", rose.hope.as_deref()),
        ];
        for (kind, text) in fields {
            let Some(text) = text.map(str::trim).filter(|t| !t.is_empty()) else {
                continue;
            };
            match kind {
                "gratitude" => review.counts.gratitude += 1,
                "anxiety" => review.counts.anxiety += 1,
                _ => review.counts.hope += 1,
            }
            review.quotes.push(WeekQuote {
                id: rose.id.clone(),
                kind: kind.to_string(),
                text: text.to_string(),
                age_days,
            });
        }
    }

    review
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ms(iso: &str) -> i64 {
        parse_created_at(iso).expect("date").timestamp_millis()
    }

    fn rose(id: &str, iso: &str, gratitude: Option<&str>, hope: Option<&str>) -> WeekRose {
        WeekRose {
            id: id.into(),
            created_at: iso.into(),
            gratitude: gratitude.map(str::to_string),
            anxiety: None,
            hope: hope.map(str::to_string),
        }
    }

    const NOW: &str = "2026-11-19T00:00:00Z";

    #[test]
    fn empty_garden_is_not_ready() {
        let review = build_week_review(&[], ms(NOW));
        assert_eq!(review.total, 0);
        assert!(!review.ready);
        assert_eq!(review.days_until_ready, WEEK_DAYS);
        assert!(review.quotes.is_empty());
    }

    #[test]
    fn single_rose_counts_down_instead_of_faking_a_recap() {
        let roses = [rose("r1", "2026-11-16T00:00:00Z", Some("谢谢楼下的猫"), None)];
        let review = build_week_review(&roses, ms(NOW));
        assert_eq!(review.total, 1);
        assert_eq!(review.days_since_first, 3);
        assert_eq!(review.days_until_ready, 4);
        assert!(!review.ready);
        assert_eq!(review.in_week, 1);
        assert_eq!(review.counts.gratitude, 1);
        assert_eq!(review.quotes.len(), 1);
    }

    #[test]
    fn seven_days_in_is_ready_and_open() {
        let roses = [
            rose("new", "2026-11-18T00:00:00Z", None, Some("想学陶艺")),
            rose("old", "2026-11-12T00:00:00Z", Some("邻居帮我搬花"), None),
        ];
        let review = build_week_review(&roses, ms(NOW));
        assert!(review.ready);
        assert_eq!(review.days_until_ready, 0);
        assert_eq!(review.days_since_first, 7);
        assert_eq!(review.in_week, 2);
        assert_eq!(review.counts.hope, 1);
        assert_eq!(review.counts.gratitude, 1);
        // 新 -> 旧
        assert_eq!(review.quotes[0].id, "new");
        assert_eq!(review.quotes[1].id, "old");
    }

    #[test]
    fn older_roses_still_count_toward_total_but_not_this_week() {
        let roses = [
            rose("a", "2026-10-01T00:00:00Z", Some("很早的一句"), None),
            rose("b", "2026-11-19T00:00:00Z", None, Some("今天的一句")),
        ];
        let review = build_week_review(&roses, ms(NOW));
        assert_eq!(review.total, 2);
        assert_eq!(review.in_week, 1);
        assert_eq!(review.quotes.len(), 1);
        assert_eq!(review.quotes[0].id, "b");
        assert_eq!(review.days_since_first, 49);
    }

    #[test]
    fn rose_with_three_fields_yields_three_quotes() {
        let roses = [WeekRose {
            id: "r".into(),
            created_at: "2026-11-18T00:00:00Z".into(),
            gratitude: Some("一".into()),
            anxiety: Some("二".into()),
            hope: Some("三".into()),
        }];
        let review = build_week_review(&roses, ms(NOW));
        assert_eq!(review.quotes.len(), 3);
        assert_eq!(review.counts.gratitude, 1);
        assert_eq!(review.counts.anxiety, 1);
        assert_eq!(review.counts.hope, 1);
    }

    #[test]
    fn blank_text_is_not_a_quote() {
        let roses = [rose("r", "2026-11-18T00:00:00Z", Some("   "), None)];
        let review = build_week_review(&roses, ms(NOW));
        assert!(review.quotes.is_empty());
        assert_eq!(review.counts.gratitude, 0);
    }

    #[test]
    fn future_timestamp_clamps_to_zero_days() {
        let roses = [rose("r", "2026-11-25T00:00:00Z", Some("时钟飘了"), None)];
        let review = build_week_review(&roses, ms(NOW));
        assert_eq!(review.days_since_first, 0);
        assert_eq!(review.quotes[0].age_days, 0);
    }

    #[test]
    fn day_eight_still_shows_the_first_week() {
        // 第 0 天种下、第 8 天回来：按「最近 7 天」算正好把那朵挤出去，
        // 承诺兑现的那一刻页面会变成空的。
        let roses = [rose("only", "2026-11-11T00:00:00Z", Some("谢谢楼下的猫"), None)];
        let review = build_week_review(&roses, ms(NOW));
        assert!(review.ready);
        assert_eq!(review.days_since_first, 8);
        assert_eq!(review.in_week, 1);
        assert_eq!(review.quotes.len(), 1);
    }

    #[test]
    fn long_after_the_first_week_only_recent_roses_count() {
        // 第 20 天回来：不再把三周前的玫瑰算进「这一周」。
        let roses = [
            rose("old", "2026-10-30T00:00:00Z", Some("很久以前"), None),
            rose("new", "2026-11-18T00:00:00Z", Some("昨天"), None),
        ];
        let review = build_week_review(&roses, ms(NOW));
        assert_eq!(review.days_since_first, 20);
        assert_eq!(review.total, 2);
        assert_eq!(review.in_week, 1);
        assert_eq!(review.quotes[0].id, "new");
    }

    #[test]
    fn parses_both_rfc3339_and_naive_formats() {
        assert!(parse_created_at("2026-11-19T00:00:00Z").is_some());
        assert!(parse_created_at("2026-11-19T00:00:00+08:00").is_some());
        assert!(parse_created_at("2026-11-19T00:00:00").is_some());
        assert!(parse_created_at("2026-11-19T00:00:00.123456").is_some());
        assert!(parse_created_at("2026-11-19 00:00:00").is_some());
        assert!(parse_created_at("not a date").is_none());
    }

    #[test]
    fn unserializable_dates_are_skipped_not_fatal() {
        let roses = [rose("bad", "??", Some("丢了时间"), None)];
        let review = build_week_review(&roses, ms(NOW));
        assert_eq!(review.total, 1);
        assert!(!review.ready);
        assert!(review.quotes.is_empty());
    }
}
