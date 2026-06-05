use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SkyParams {
    pub gradient: String,
    pub stars: f64,
    pub nebula: f64,
    pub label: String,
}

const TIME_STAGES: &[(u32, u32, &str, f64, f64, &str)] = &[
    // (from_hour, to_hour, gradient, stars, nebula, label)
    (
        0,
        4,
        "linear-gradient(150deg, #02040d 0%, #050818 50%, #030610 100%)",
        1.0,
        0.22,
        "deep-night",
    ),
    (
        4,
        6,
        "linear-gradient(175deg, #0e0408 0%, #1f0812 25%, #2a1008 50%, #180820 75%, #080614 100%)",
        0.65,
        0.28,
        "dawn",
    ),
    (
        6,
        9,
        "linear-gradient(160deg, #180810 0%, #2a1018 35%, #1a0e24 65%, #0e0a1a 100%)",
        0.25,
        0.20,
        "morning",
    ),
    (
        9,
        12,
        "linear-gradient(150deg, #080c1a 0%, #0e1428 45%, #0a1020 80%, #08100e 100%)",
        0.08,
        0.14,
        "forenoon",
    ),
    (
        12,
        17,
        "linear-gradient(145deg, #060e0c 0%, #0a1410 35%, #0c1018 65%, #080c14 100%)",
        0.0,
        0.10,
        "afternoon",
    ),
    (
        17,
        19,
        "linear-gradient(165deg, #1a0610 0%, #2e0c1c 20%, #3a1020 40%, #1e0c2a 65%, #0c0818 100%)",
        0.35,
        0.32,
        "dusk",
    ),
    (
        19,
        22,
        "linear-gradient(150deg, #0a061c 0%, #160a28 30%, #100820 60%, #08061a 100%)",
        0.75,
        0.24,
        "evening",
    ),
    (
        22,
        24,
        "linear-gradient(150deg, #02040d 0%, #050818 50%, #030610 100%)",
        1.0,
        0.22,
        "night",
    ),
];

pub fn compute_sky_params(hour: u32) -> SkyParams {
    let stage = TIME_STAGES
        .iter()
        .find(|(from, to, ..)| hour >= *from && hour < *to)
        .unwrap_or(&TIME_STAGES[0]);

    SkyParams {
        gradient: stage.2.to_string(),
        stars: stage.3,
        nebula: stage.4,
        label: stage.5.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deep_night() {
        let p = compute_sky_params(2);
        assert_eq!(p.label, "deep-night");
        assert!(p.stars > 0.9);
    }

    #[test]
    fn test_afternoon_no_stars() {
        let p = compute_sky_params(14);
        assert_eq!(p.label, "afternoon");
        assert_eq!(p.stars, 0.0);
    }

    #[test]
    fn test_dusk() {
        let p = compute_sky_params(18);
        assert_eq!(p.label, "dusk");
        assert!(p.nebula > 0.3);
    }

    #[test]
    fn test_boundary_midnight() {
        let p = compute_sky_params(0);
        assert_eq!(p.label, "deep-night");
    }

    #[test]
    fn test_boundary_noon() {
        let p = compute_sky_params(12);
        assert_eq!(p.label, "afternoon");
    }

    #[test]
    fn test_evening() {
        let p = compute_sky_params(20);
        assert_eq!(p.label, "evening");
    }

    #[test]
    fn test_out_of_range() {
        let p = compute_sky_params(25); // beyond 24
        assert_eq!(p.label, "deep-night"); // fallback to first
    }
}
