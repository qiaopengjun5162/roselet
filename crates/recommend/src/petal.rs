use serde::Serialize;
use rand::Rng;
use rand::SeedableRng;

#[derive(Debug, Serialize)]
pub struct PetalConfig {
    pub emoji: String,
    pub left: u32,       // 起始水平位置 (%)
    pub size: u32,        // 字号 (px)
    pub duration: f32,    // 动画时长 (s)
    pub delay: f32,       // 延迟启动 (s)
    pub sway: i32,        // 左右摆动幅度 (px)
    pub opacity: f32,     // 透明度
}

const EMOJIS: &[&str] = &["🌸", "🌺", "🌷", "💮", "🏵️", "🌼", "✿", "❀", "🌹", "💐"];

/// Rust 驱动花瓣生成器 —— 相同 seed 产生完全相同的结果
pub fn generate_petals(count: u32, seed: u64) -> Vec<PetalConfig> {
    let mut rng = rand::rngs::StdRng::seed_from_u64(seed);
    (0..count).map(|_| PetalConfig {
        emoji: EMOJIS[rng.gen_range(0..EMOJIS.len())].into(),
        left: rng.gen_range(5..95),
        size: rng.gen_range(14..28),
        duration: rng.gen_range(8.0..16.0),
        delay: rng.gen_range(0.0..8.0),
        sway: rng.gen_range(15..60),
        opacity: rng.gen_range(0.15..0.35),
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_count() {
        let petals = generate_petals(8, 42);
        assert_eq!(petals.len(), 8);
    }

    #[test]
    fn test_same_seed_same_result() {
        let a = generate_petals(4, 123);
        let b = generate_petals(4, 123);
        for i in 0..4 {
            assert_eq!(a[i].left, b[i].left);
            assert_eq!(a[i].emoji, b[i].emoji);
            assert_eq!(a[i].duration, b[i].duration);
        }
    }

    #[test]
    fn test_values_in_range() {
        let petals = generate_petals(20, 999);
        for p in &petals {
            assert!(p.left >= 5 && p.left <= 95);
            assert!(p.size >= 14 && p.size <= 28);
            assert!(p.duration >= 8.0 && p.duration <= 16.0);
            assert!(p.opacity >= 0.15 && p.opacity <= 0.35);
        }
    }
}
