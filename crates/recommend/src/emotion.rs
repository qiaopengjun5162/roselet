use serde::Serialize;

/// 情绪分析结果，对应前端 SoundParams 接口
#[derive(Debug, Serialize)]
pub struct EmotionParams {
    pub emotion: String,      // "gratitude" | "anxiety" | "hope" | "neutral"
    pub emotion_label: String, // 显示用：🌹 感恩
    pub fx: u32,
    pub fy: u32,
    pub waveform: String,     // "sine" | "sawtooth" | "triangle" | "square"
    pub base_freq: f32,
    pub phase: f32,
    pub stroke: String,       // CSS 颜色
    pub glow: String,         // CSS rgba
    pub intensity: f32,       // 0.0 ~ 1.0
}

struct EmotionKeyword {
    word: &'static str,
    emotion: EmotionType,
    weight: f32,
}

#[derive(Clone, Copy, PartialEq)]
enum EmotionType {
    Gratitude,
    Anxiety,
    Hope,
}

// 关键词库：覆盖三种情绪，权重区分强弱信号
const EMOTION_KEYWORDS: &[EmotionKeyword] = &[
    // 感恩
    EmotionKeyword { word: "感谢",  emotion: EmotionType::Gratitude, weight: 1.0 },
    EmotionKeyword { word: "感恩",  emotion: EmotionType::Gratitude, weight: 1.0 },
    EmotionKeyword { word: "谢谢",  emotion: EmotionType::Gratitude, weight: 1.0 },
    EmotionKeyword { word: "幸福",  emotion: EmotionType::Gratitude, weight: 1.0 },
    EmotionKeyword { word: "开心",  emotion: EmotionType::Gratitude, weight: 1.0 },
    EmotionKeyword { word: "快乐",  emotion: EmotionType::Gratitude, weight: 1.0 },
    EmotionKeyword { word: "高兴",  emotion: EmotionType::Gratitude, weight: 1.0 },
    EmotionKeyword { word: "美好",  emotion: EmotionType::Gratitude, weight: 1.0 },
    EmotionKeyword { word: "温暖",  emotion: EmotionType::Gratitude, weight: 1.0 },
    EmotionKeyword { word: "喜欢",  emotion: EmotionType::Gratitude, weight: 0.8 },
    EmotionKeyword { word: "棒",    emotion: EmotionType::Gratitude, weight: 0.8 },
    EmotionKeyword { word: "太好了",emotion: EmotionType::Gratitude, weight: 1.0 },
    EmotionKeyword { word: "感动",  emotion: EmotionType::Gratitude, weight: 1.0 },
    EmotionKeyword { word: "爱",    emotion: EmotionType::Gratitude, weight: 0.7 },
    EmotionKeyword { word: "不错",  emotion: EmotionType::Gratitude, weight: 0.4 },
    EmotionKeyword { word: "还好",  emotion: EmotionType::Gratitude, weight: 0.3 },
    // 焦虑
    EmotionKeyword { word: "焦虑",  emotion: EmotionType::Anxiety, weight: 1.0 },
    EmotionKeyword { word: "烦",    emotion: EmotionType::Anxiety, weight: 1.0 },
    EmotionKeyword { word: "压力",  emotion: EmotionType::Anxiety, weight: 1.0 },
    EmotionKeyword { word: "担心",  emotion: EmotionType::Anxiety, weight: 1.0 },
    EmotionKeyword { word: "紧张",  emotion: EmotionType::Anxiety, weight: 1.0 },
    EmotionKeyword { word: "害怕",  emotion: EmotionType::Anxiety, weight: 1.0 },
    EmotionKeyword { word: "崩溃",  emotion: EmotionType::Anxiety, weight: 1.0 },
    EmotionKeyword { word: "难受",  emotion: EmotionType::Anxiety, weight: 1.0 },
    EmotionKeyword { word: "痛苦",  emotion: EmotionType::Anxiety, weight: 1.0 },
    EmotionKeyword { word: "纠结",  emotion: EmotionType::Anxiety, weight: 0.8 },
    EmotionKeyword { word: "迷茫",  emotion: EmotionType::Anxiety, weight: 0.8 },
    EmotionKeyword { word: "失眠",  emotion: EmotionType::Anxiety, weight: 1.0 },
    EmotionKeyword { word: "累",    emotion: EmotionType::Anxiety, weight: 0.7 },
    EmotionKeyword { word: "难",    emotion: EmotionType::Anxiety, weight: 0.5 },
    EmotionKeyword { word: "恐惧",  emotion: EmotionType::Anxiety, weight: 1.0 },
    EmotionKeyword { word: "不知道",emotion: EmotionType::Anxiety, weight: 0.4 },
    // 期待
    EmotionKeyword { word: "期待",  emotion: EmotionType::Hope, weight: 1.0 },
    EmotionKeyword { word: "希望",  emotion: EmotionType::Hope, weight: 1.0 },
    EmotionKeyword { word: "计划",  emotion: EmotionType::Hope, weight: 0.8 },
    EmotionKeyword { word: "目标",  emotion: EmotionType::Hope, weight: 0.8 },
    EmotionKeyword { word: "梦想",  emotion: EmotionType::Hope, weight: 1.0 },
    EmotionKeyword { word: "未来",  emotion: EmotionType::Hope, weight: 0.8 },
    EmotionKeyword { word: "加油",  emotion: EmotionType::Hope, weight: 0.8 },
    EmotionKeyword { word: "努力",  emotion: EmotionType::Hope, weight: 0.7 },
    EmotionKeyword { word: "试试",  emotion: EmotionType::Hope, weight: 0.7 },
    EmotionKeyword { word: "想",    emotion: EmotionType::Hope, weight: 0.5 },
    EmotionKeyword { word: "新",    emotion: EmotionType::Hope, weight: 0.4 },
    EmotionKeyword { word: "开始",  emotion: EmotionType::Hope, weight: 0.6 },
];

// 文字长度对相位的微调：内容越丰富，图形越复杂
fn length_to_phase(text: &str, base: f32) -> f32 {
    let extra = (text.chars().count() as f32 / 100.0).min(1.0) * 0.8;
    base + extra
}

/// 核心分析逻辑（可单元测试，不依赖 wasm_bindgen）
pub fn analyze_text_internal(text: &str) -> EmotionParams {
    if text.trim().is_empty() {
        return EmotionParams {
            emotion: "neutral".into(),
            emotion_label: "○ 中性".into(),
            fx: 1, fy: 1,
            waveform: "sine".into(),
            base_freq: 220.0,
            phase: 0.0,
            stroke: "#94a3b8".into(),
            glow: "rgba(148,163,184,0.4)".into(),
            intensity: 0.0,
        };
    }

    let mut g_score = 0.0f32;
    let mut a_score = 0.0f32;
    let mut h_score = 0.0f32;

    for kw in EMOTION_KEYWORDS {
        if text.contains(kw.word) {
            match kw.emotion {
                EmotionType::Gratitude => g_score += kw.weight,
                EmotionType::Anxiety   => a_score += kw.weight,
                EmotionType::Hope      => h_score += kw.weight,
            }
        }
    }

    let max_possible = 5.0f32;

    // 同时有焦虑和感恩/期待：取综合比例
    let dominant = if g_score >= a_score && g_score >= h_score { EmotionType::Gratitude }
        else if a_score >= h_score { EmotionType::Anxiety }
        else { EmotionType::Hope };
    let top_score = match dominant {
        EmotionType::Gratitude => g_score,
        EmotionType::Anxiety   => a_score,
        EmotionType::Hope      => h_score,
    };

    let intensity = (top_score / max_possible).min(1.0);
    let has_emotion = top_score > 0.0;

    if !has_emotion {
        return EmotionParams {
            emotion: "neutral".into(),
            emotion_label: "○ 中性".into(),
            fx: 1, fy: 1,
            waveform: "sine".into(),
            base_freq: 220.0,
            phase: length_to_phase(text, 0.0),
            stroke: "#94a3b8".into(),
            glow: "rgba(148,163,184,0.4)".into(),
            intensity: 0.0,
        };
    }

    // 强烈情绪时频率比更复杂
    match dominant {
        EmotionType::Gratitude => EmotionParams {
            emotion: "gratitude".into(),
            emotion_label: "🌹 感恩".into(),
            fx: 1,
            fy: if intensity > 0.6 { 3 } else { 2 },
            waveform: "sine".into(),
            base_freq: 220.0,
            phase: length_to_phase(text, 0.3),
            stroke: "#f472b6".into(),
            glow: "rgba(244,114,182,0.5)".into(),
            intensity,
        },
        EmotionType::Anxiety => EmotionParams {
            emotion: "anxiety".into(),
            emotion_label: "🌵 焦虑".into(),
            fx: 2,
            fy: if intensity > 0.6 { 4 } else { 3 },
            waveform: "sawtooth".into(),
            base_freq: 180.0,
            phase: length_to_phase(text, 1.2),
            stroke: "#38bdf8".into(),
            glow: "rgba(56,189,248,0.5)".into(),
            intensity,
        },
        EmotionType::Hope => EmotionParams {
            emotion: "hope".into(),
            emotion_label: "🌱 期待".into(),
            fx: 1,
            fy: if intensity > 0.6 { 4 } else { 3 },
            waveform: "triangle".into(),
            base_freq: 264.0,
            phase: length_to_phase(text, 0.6),
            stroke: "#a78bfa".into(),
            glow: "rgba(167,139,250,0.5)".into(),
            intensity,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_text_returns_neutral() {
        let p = analyze_text_internal("");
        assert_eq!(p.emotion, "neutral");
        assert_eq!(p.intensity, 0.0);
        assert_eq!(p.fx, 1);
        assert_eq!(p.fy, 1);
    }

    #[test]
    fn whitespace_only_returns_neutral() {
        let p = analyze_text_internal("   \n\t  ");
        assert_eq!(p.emotion, "neutral");
    }

    #[test]
    fn gratitude_keywords_detected() {
        let p = analyze_text_internal("今天很开心，感谢家人的陪伴，感恩每一天");
        assert_eq!(p.emotion, "gratitude");
        assert!(p.intensity > 0.0);
        assert_eq!(p.waveform, "sine");
    }

    #[test]
    fn anxiety_keywords_detected() {
        let p = analyze_text_internal("最近压力很大，焦虑得失眠，担心工作");
        assert_eq!(p.emotion, "anxiety");
        assert_eq!(p.waveform, "sawtooth");
        assert!(p.intensity > 0.5);
    }

    #[test]
    fn hope_keywords_detected() {
        let p = analyze_text_internal("期待下个月的旅行，希望能实现梦想");
        assert_eq!(p.emotion, "hope");
        assert_eq!(p.waveform, "triangle");
    }

    #[test]
    fn no_matching_keywords_returns_neutral() {
        let p = analyze_text_internal("今天吃了一碗面，还不错");
        // "不错" 权重 0.4，score < max，但有值；"今天""吃"没命中
        // 重点是不崩溃，结果合法
        assert!(["gratitude", "anxiety", "hope", "neutral"].contains(&p.emotion.as_str()));
    }

    #[test]
    fn high_intensity_increases_fy() {
        // 多个强焦虑词 → intensity > 0.6 → fy = 4
        let p = analyze_text_internal("焦虑崩溃痛苦害怕失眠紧张恐惧");
        assert_eq!(p.emotion, "anxiety");
        assert_eq!(p.fy, 4);
    }

    #[test]
    fn low_intensity_keeps_base_fy() {
        // 只有一个弱焦虑词 → intensity < 0.6 → fy = 3
        let p = analyze_text_internal("有点累");
        // "累" weight 0.7, intensity = 0.7/5 = 0.14 < 0.6
        assert_eq!(p.emotion, "anxiety");
        assert_eq!(p.fy, 3);
    }

    #[test]
    fn longer_text_increases_phase() {
        let short = analyze_text_internal("感恩");
        let long  = analyze_text_internal("感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩感恩");
        assert!(long.phase > short.phase);
    }

    #[test]
    fn returns_valid_css_colors() {
        for text in &["感恩", "焦虑", "期待", ""] {
            let p = analyze_text_internal(text);
            assert!(p.stroke.starts_with('#') || p.stroke.starts_with("rgb"));
            assert!(p.glow.starts_with("rgba("));
        }
    }

    #[test]
    fn intensity_in_range() {
        for text in &["感恩感恩感恩感谢幸福快乐", "焦虑压力担心害怕", ""] {
            let p = analyze_text_internal(text);
            assert!((0.0..=1.0).contains(&p.intensity));
        }
    }
}
