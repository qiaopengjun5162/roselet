use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

/// 简易令牌桶限流器 —— 生产环境可替换为 Redis
#[derive(Clone)]
pub struct RateLimiter {
    buckets: Arc<Mutex<HashMap<String, (u32, Instant)>>>,
    max_requests: u32,
    window_secs: u64,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window_secs: u64) -> Self {
        Self {
            buckets: Arc::new(Mutex::new(HashMap::new())),
            max_requests,
            window_secs,
        }
    }

    /// 检查 key 是否超过限制，未超限返回 true
    pub fn check(&self, key: &str) -> bool {
        let mut buckets = self.buckets.lock().unwrap();
        let now = Instant::now();

        let entry = buckets.entry(key.to_string()).or_insert((0, now));
        let (count, reset_time) = entry;

        if now.duration_since(*reset_time).as_secs() > self.window_secs {
            *count = 0;
            *reset_time = now;
        }

        *count += 1;
        *count <= self.max_requests
    }
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new(30, 60)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_allows_within_limit() {
        let limiter = RateLimiter::new(5, 60);
        for _ in 0..5 {
            assert!(limiter.check("test"));
        }
    }

    #[test]
    fn test_blocks_over_limit() {
        let limiter = RateLimiter::new(3, 60);
        assert!(limiter.check("test"));
        assert!(limiter.check("test"));
        assert!(limiter.check("test"));
        assert!(!limiter.check("test"));
    }

    #[test]
    fn test_independent_keys() {
        let limiter = RateLimiter::new(1, 60);
        assert!(limiter.check("user-a"));
        assert!(limiter.check("user-b"));
        assert!(!limiter.check("user-a"));
    }
}
