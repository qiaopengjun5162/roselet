use rand::Rng;
use serde::Serialize;

const COLORS: &[&str] = &[
    "#f43f5e", "#fb7185", "#e879f9", "#a78bfa", "#38bdf8", "#34d399", "#fbbf24", "#ffffff",
];

#[derive(Debug, Clone, Serialize)]
pub struct FireworkParticle {
    pub id: usize,
    pub x: f64,
    pub y: f64,
    pub color: String,
    pub tx: f64,
    pub ty: f64,
    pub size: f64,
    pub delay: f64,
    pub duration: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct FireworkLaunch {
    pub cx: f64,
    pub cy: f64,
    pub count: usize,
    pub delay_ms: u32,
}

fn random_between(rng: &mut impl Rng, a: f64, b: f64) -> f64 {
    a + rng.gen::<f64>() * (b - a)
}

fn burst_internal(
    rng: &mut impl Rng,
    cx: f64,
    cy: f64,
    count: usize,
    id_offset: usize,
) -> Vec<FireworkParticle> {
    (0..count)
        .map(|i| {
            let angle = (i as f64 / count as f64) * std::f64::consts::PI * 2.0
                + random_between(rng, -0.3, 0.3);
            let dist = random_between(rng, 60.0, 160.0);
            FireworkParticle {
                id: id_offset + i,
                x: cx,
                y: cy,
                color: COLORS[rng.gen_range(0..COLORS.len())].to_string(),
                tx: angle.cos() * dist,
                ty: angle.sin() * dist,
                size: random_between(rng, 4.0, 9.0),
                delay: random_between(rng, 0.0, 0.4),
                duration: random_between(rng, 0.7, 1.2),
            }
        })
        .collect()
}

fn default_launches() -> Vec<FireworkLaunch> {
    vec![
        FireworkLaunch {
            cx: 30.0,
            cy: 30.0,
            count: 18,
            delay_ms: 0,
        },
        FireworkLaunch {
            cx: 70.0,
            cy: 20.0,
            count: 22,
            delay_ms: 300,
        },
        FireworkLaunch {
            cx: 50.0,
            cy: 40.0,
            count: 20,
            delay_ms: 150,
        },
        FireworkLaunch {
            cx: 20.0,
            cy: 55.0,
            count: 16,
            delay_ms: 450,
        },
        FireworkLaunch {
            cx: 80.0,
            cy: 45.0,
            count: 18,
            delay_ms: 600,
        },
    ]
}

pub fn burst_js(cx: f64, cy: f64, count: usize, id_offset: usize) -> Vec<FireworkParticle> {
    burst_internal(&mut rand::thread_rng(), cx, cy, count, id_offset)
}

pub fn burst_all() -> Vec<FireworkParticle> {
    let mut rng = rand::thread_rng();
    let mut id_counter = 0usize;
    let mut all_particles: Vec<FireworkParticle> = Vec::new();

    for launch in &default_launches() {
        let particles = burst_internal(&mut rng, launch.cx, launch.cy, launch.count, id_counter);
        id_counter += launch.count;
        all_particles.extend(particles);
    }

    all_particles
}

pub fn get_launches() -> Vec<FireworkLaunch> {
    default_launches()
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;
    use rand::rngs::StdRng;

    #[test]
    fn test_burst_count() {
        let mut rng = StdRng::seed_from_u64(42);
        let particles = burst_internal(&mut rng, 50.0, 50.0, 10, 0);
        assert_eq!(particles.len(), 10);
    }

    #[test]
    fn test_burst_id_offset() {
        let mut rng = StdRng::seed_from_u64(42);
        let particles = burst_internal(&mut rng, 50.0, 50.0, 5, 100);
        assert_eq!(particles[0].id, 100);
        assert_eq!(particles[4].id, 104);
    }

    #[test]
    fn test_burst_deterministic() {
        let mut rng1 = StdRng::seed_from_u64(42);
        let mut rng2 = StdRng::seed_from_u64(42);
        let p1 = burst_internal(&mut rng1, 50.0, 50.0, 5, 0);
        let p2 = burst_internal(&mut rng2, 50.0, 50.0, 5, 0);
        for i in 0..5 {
            assert_eq!(p1[i].x, p2[i].x);
            assert_eq!(p1[i].y, p2[i].y);
            assert_eq!(p1[i].tx, p2[i].tx);
            assert_eq!(p1[i].ty, p2[i].ty);
        }
    }

    #[test]
    fn test_burst_positions_in_range() {
        let mut rng = StdRng::seed_from_u64(42);
        let particles = burst_internal(&mut rng, 50.0, 50.0, 100, 0);
        for p in &particles {
            // tx/ty should be within [-160, 160] range
            assert!(p.tx >= -160.0 && p.tx <= 160.0, "tx out of range: {}", p.tx);
            assert!(p.ty >= -160.0 && p.ty <= 160.0, "ty out of range: {}", p.ty);
            assert!(
                p.size >= 4.0 && p.size <= 9.0,
                "size out of range: {}",
                p.size
            );
            assert!(
                p.delay >= 0.0 && p.delay <= 0.4,
                "delay out of range: {}",
                p.delay
            );
            assert!(
                p.duration >= 0.7 && p.duration <= 1.2,
                "duration out of range: {}",
                p.duration
            );
        }
    }

    #[test]
    fn test_burst_color_valid() {
        let mut rng = StdRng::seed_from_u64(42);
        let particles = burst_internal(&mut rng, 50.0, 50.0, 20, 0);
        for p in &particles {
            assert!(
                COLORS.contains(&p.color.as_str()),
                "invalid color: {}",
                p.color
            );
        }
    }

    #[test]
    fn test_burst_angle_coverage() {
        let mut rng = StdRng::seed_from_u64(42);
        let particles = burst_internal(&mut rng, 50.0, 50.0, 100, 0);
        // 粒子应覆盖 360 度（四个象限）
        let mut has_pos_x = false;
        let mut has_neg_x = false;
        let mut has_pos_y = false;
        let mut has_neg_y = false;
        for p in &particles {
            if p.tx > 10.0 {
                has_pos_x = true;
            }
            if p.tx < -10.0 {
                has_neg_x = true;
            }
            if p.ty > 10.0 {
                has_pos_y = true;
            }
            if p.ty < -10.0 {
                has_neg_y = true;
            }
        }
        assert!(has_pos_x);
        assert!(has_neg_x);
        assert!(has_pos_y);
        assert!(has_neg_y);
    }

    #[test]
    fn test_default_launches_count() {
        let launches = default_launches();
        assert_eq!(launches.len(), 5);
        assert_eq!(launches[0].delay_ms, 0);
    }

    #[test]
    fn test_burst_empty() {
        let mut rng = StdRng::seed_from_u64(42);
        let particles = burst_internal(&mut rng, 0.0, 0.0, 0, 0);
        assert!(particles.is_empty());
    }

    #[test]
    fn test_serialization() {
        let particle = FireworkParticle {
            id: 1,
            x: 50.0,
            y: 50.0,
            color: "#f43f5e".into(),
            tx: 100.0,
            ty: -50.0,
            size: 6.0,
            delay: 0.2,
            duration: 1.0,
        };
        let json = serde_json::to_string(&particle).unwrap();
        assert!(json.contains("\"id\":1"));
        assert!(json.contains("\"color\":\"#f43f5e\""));
    }
}
