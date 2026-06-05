use serde::{Deserialize, Serialize};

/// 来自前端的玫瑰摘要（仅音频参数所需字段）
#[derive(Debug, Deserialize)]
pub struct RoseAudioInput {
    pub color: String,
    pub gratitude: Option<String>,
    pub anxiety: Option<String>,
    pub hope: Option<String>,
    pub like_count: Option<i64>,
}

/// 示波器音频参数（对应 TS 的 RoseSoundParams）
#[derive(Debug, Serialize)]
pub struct RoseSoundParams {
    pub fx: u8,
    pub fy: u8,
    pub waveform: String,
    pub base_freq: f64,
    pub phase: f64,
    pub stroke: String,
    pub glow: String,
}

struct ColorParams {
    freq: f64,
    stroke: &'static str,
    glow: &'static str,
}

fn color_params(color: &str) -> ColorParams {
    match color {
        "white"  => ColorParams { freq: 264.0, stroke: "#e2e8f0", glow: "rgba(226,232,240,0.4)" },
        "yellow" => ColorParams { freq: 198.0, stroke: "#fbbf24", glow: "rgba(251,191,36,0.5)"  },
        _        => ColorParams { freq: 220.0, stroke: "#f472b6", glow: "rgba(244,114,182,0.5)" },
    }
}

fn pick_ratio(rose: &RoseAudioInput) -> (u8, u8) {
    let g = rose.gratitude.as_deref().map(|s| !s.is_empty()).unwrap_or(false);
    let a = rose.anxiety.as_deref().map(|s| !s.is_empty()).unwrap_or(false);
    let h = rose.hope.as_deref().map(|s| !s.is_empty()).unwrap_or(false);
    match (g, a, h) {
        (true, true, true)   => (3, 4),
        (true, false, true)  => (1, 2),
        (true, true, false)  => (2, 3),
        (false, true, true)  => (3, 5),
        (true, false, false) => (1, 1),
        (false, false, true) => (1, 3),
        (false, true, false) => (4, 5),
        _                    => (1, 2),
    }
}

fn pick_phase(rose: &RoseAudioInput) -> f64 {
    let total = rose.gratitude.as_deref().map(|s| s.chars().count()).unwrap_or(0)
              + rose.anxiety.as_deref().map(|s| s.chars().count()).unwrap_or(0)
              + rose.hope.as_deref().map(|s| s.chars().count()).unwrap_or(0);
    (total as f64 / 200.0).min(1.0) * std::f64::consts::PI
}

fn pick_waveform(rose: &RoseAudioInput) -> &'static str {
    match rose.like_count.unwrap_or(0) {
        l if l >= 10 => "sine",
        l if l >= 3  => "triangle",
        _            => "sawtooth",
    }
}

pub fn rose_to_sound_params_internal(rose: &RoseAudioInput) -> RoseSoundParams {
    let c = color_params(&rose.color);
    let (fx, fy) = pick_ratio(rose);
    RoseSoundParams {
        fx,
        fy,
        waveform: pick_waveform(rose).to_string(),
        base_freq: c.freq,
        phase: pick_phase(rose),
        stroke: c.stroke.to_string(),
        glow: c.glow.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::PI;

    fn rose(color: &str, g: Option<&str>, a: Option<&str>, h: Option<&str>, likes: i64) -> RoseAudioInput {
        RoseAudioInput {
            color: color.to_string(),
            gratitude: g.map(|s| s.to_string()),
            anxiety: a.map(|s| s.to_string()),
            hope: h.map(|s| s.to_string()),
            like_count: Some(likes),
        }
    }

    #[test]
    fn test_red_base_freq() {
        let r = rose("red", None, None, None, 0);
        let p = rose_to_sound_params_internal(&r);
        assert_eq!(p.base_freq, 220.0);
        assert!(p.stroke.contains("f472b6"));
    }

    #[test]
    fn test_white_base_freq() {
        let r = rose("white", None, None, None, 0);
        let p = rose_to_sound_params_internal(&r);
        assert_eq!(p.base_freq, 264.0);
    }

    #[test]
    fn test_yellow_base_freq() {
        let r = rose("yellow", None, None, None, 0);
        let p = rose_to_sound_params_internal(&r);
        assert_eq!(p.base_freq, 198.0);
    }

    #[test]
    fn test_unknown_color_falls_back_to_red() {
        let r = rose("purple", None, None, None, 0);
        let p = rose_to_sound_params_internal(&r);
        assert_eq!(p.base_freq, 220.0);
    }

    #[test]
    fn test_ratio_all_three() {
        let r = rose("red", Some("感恩"), Some("焦虑"), Some("期待"), 0);
        let p = rose_to_sound_params_internal(&r);
        assert_eq!((p.fx, p.fy), (3, 4));
    }

    #[test]
    fn test_ratio_gratitude_hope() {
        let r = rose("red", Some("感恩"), None, Some("期待"), 0);
        let p = rose_to_sound_params_internal(&r);
        assert_eq!((p.fx, p.fy), (1, 2));
    }

    #[test]
    fn test_ratio_only_anxiety() {
        let r = rose("red", None, Some("焦虑"), None, 0);
        let p = rose_to_sound_params_internal(&r);
        assert_eq!((p.fx, p.fy), (4, 5));
    }

    #[test]
    fn test_phase_empty_is_zero() {
        let r = rose("red", None, None, None, 0);
        let p = rose_to_sound_params_internal(&r);
        assert_eq!(p.phase, 0.0);
    }

    #[test]
    fn test_phase_long_text_approaches_pi() {
        let long = "a".repeat(400);
        let r = rose("red", Some(&long), None, None, 0);
        let p = rose_to_sound_params_internal(&r);
        assert!((p.phase - PI).abs() < 1e-10);
    }

    #[test]
    fn test_waveform_sine_for_many_likes() {
        let r = rose("red", None, None, None, 10);
        let p = rose_to_sound_params_internal(&r);
        assert_eq!(p.waveform, "sine");
    }

    #[test]
    fn test_waveform_triangle() {
        let r = rose("red", None, None, None, 5);
        let p = rose_to_sound_params_internal(&r);
        assert_eq!(p.waveform, "triangle");
    }

    #[test]
    fn test_waveform_sawtooth_for_zero_likes() {
        let r = rose("red", None, None, None, 0);
        let p = rose_to_sound_params_internal(&r);
        assert_eq!(p.waveform, "sawtooth");
    }
}
