use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct FlowerLanguage {
    pub title: &'static str,
    pub content: &'static str,
    pub keywords: &'static [&'static str],
}

#[derive(Debug, Clone, Serialize)]
pub struct ThemeSuggestion {
    pub title: String,
    pub content: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ColorSuggestion {
    pub color: &'static str,
    pub reason: String,
}

/// 根据关键词类别推荐花语
pub fn recommend_flower_language(
    matched_categories: &[super::keywords::KeywordCategory],
) -> FlowerLanguage {
    use super::keywords::KeywordCategory;

    if matched_categories.contains(&KeywordCategory::Gratitude) {
        FlowerLanguage {
            title: "热烈的爱与感恩",
            content: "红玫瑰代表热烈的爱与深深的感恩。你的心中充满感恩，这朵玫瑰将传递你的温暖。",
            keywords: &["感恩", "感谢", "幸福"],
        }
    } else if matched_categories.contains(&KeywordCategory::Family) {
        FlowerLanguage {
            title: "亲情的温暖",
            content: "白玫瑰象征纯洁的亲情。家人是最温暖的港湾，值得用心守护。",
            keywords: &["家人", "父母", "陪伴"],
        }
    } else if matched_categories.contains(&KeywordCategory::Friendship) {
        FlowerLanguage {
            title: "友谊长存",
            content: "黄玫瑰代表真挚的友情。朋友是人生路上最美的风景。",
            keywords: &["朋友", "友情", "信任"],
        }
    } else if matched_categories.contains(&KeywordCategory::Work) {
        FlowerLanguage {
            title: "奋斗的力量",
            content: "红玫瑰也象征勇气与力量。每一份努力都值得被看见。",
            keywords: &["工作", "努力", "坚持"],
        }
    } else if matched_categories.contains(&KeywordCategory::Growth) {
        FlowerLanguage {
            title: "成长的绽放",
            content: "白玫瑰象征新的开始。每一次成长都是一次美丽的绽放。",
            keywords: &["学习", "成长", "进步"],
        }
    } else if matched_categories.contains(&KeywordCategory::Love) {
        FlowerLanguage {
            title: "爱的告白",
            content: "红玫瑰是爱情的经典象征。真挚的爱值得勇敢表达。",
            keywords: &["爱", "思念", "心动"],
        }
    } else if matched_categories.contains(&KeywordCategory::Health) {
        FlowerLanguage {
            title: "身心的疗愈",
            content: "白玫瑰象征宁静与疗愈。照顾好自己，才能更好地前行。",
            keywords: &["健康", "休息", "运动"],
        }
    } else {
        FlowerLanguage {
            title: "生活的美好",
            content: "每一朵玫瑰都代表生活中一个美好的瞬间。用心感受，处处是风景。",
            keywords: &["生活", "美好", "当下"],
        }
    }
}

/// 推荐未覆盖的主题
pub fn recommend_theme(matched_categories: &[super::keywords::KeywordCategory]) -> ThemeSuggestion {
    use super::keywords::KeywordCategory;

    let all_themes = [
        (KeywordCategory::Family, "家庭", "试试分享与家人的温暖时光"),
        (KeywordCategory::Friendship, "友情", "写写朋友带给你的快乐"),
        (KeywordCategory::Growth, "成长", "记录一下最近学到的新东西"),
        (KeywordCategory::Nature, "自然", "描述一下让你感动的风景"),
        (KeywordCategory::Health, "健康", "分享你的运动或休息心得"),
        (KeywordCategory::Love, "爱情", "说说那些让你心动的瞬间"),
    ];

    for (cat, title, suggestion) in &all_themes {
        if !matched_categories.contains(cat) {
            return ThemeSuggestion {
                title: format!("试试分享{}", title),
                content: suggestion.to_string(),
                category: title.to_string(),
            };
        }
    }

    ThemeSuggestion {
        title: "探索新主题".to_string(),
        content: "你已经覆盖了很多主题，试试从新的角度写写看".to_string(),
        category: "其他".to_string(),
    }
}

/// 基于情绪趋势推荐颜色
pub fn recommend_color(positive_count: usize, negative_count: usize) -> ColorSuggestion {
    let total = positive_count + negative_count;
    if total == 0 {
        return ColorSuggestion {
            color: "red",
            reason: "红玫瑰代表热情，适合开始新的分享".to_string(),
        };
    }

    let positive_ratio = positive_count as f64 / total as f64;

    if positive_ratio > 0.6 {
        ColorSuggestion {
            color: "yellow",
            reason: "你最近心情不错，黄玫瑰代表友谊与快乐".to_string(),
        }
    } else if positive_ratio < 0.4 {
        ColorSuggestion {
            color: "red",
            reason: "红玫瑰代表热情与治愈，愿它带给你力量".to_string(),
        }
    } else {
        ColorSuggestion {
            color: "white",
            reason: "白玫瑰代表宁静与反思，适合沉淀心情".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keywords::KeywordCategory;

    // ── recommend_flower_language ──

    #[test]
    fn test_language_gratitude() {
        let lang = recommend_flower_language(&[KeywordCategory::Gratitude]);
        assert_eq!(lang.title, "热烈的爱与感恩");
        assert!(!lang.content.is_empty());
        assert!(lang.keywords.contains(&"感恩"));
    }

    #[test]
    fn test_language_family() {
        let lang = recommend_flower_language(&[KeywordCategory::Family]);
        assert_eq!(lang.title, "亲情的温暖");
        assert!(!lang.content.is_empty());
    }

    #[test]
    fn test_language_friendship() {
        let lang = recommend_flower_language(&[KeywordCategory::Friendship]);
        assert_eq!(lang.title, "友谊长存");
    }

    #[test]
    fn test_language_work() {
        let lang = recommend_flower_language(&[KeywordCategory::Work]);
        assert_eq!(lang.title, "奋斗的力量");
    }

    #[test]
    fn test_language_growth() {
        let lang = recommend_flower_language(&[KeywordCategory::Growth]);
        assert_eq!(lang.title, "成长的绽放");
    }

    #[test]
    fn test_language_love() {
        let lang = recommend_flower_language(&[KeywordCategory::Love]);
        assert_eq!(lang.title, "爱的告白");
    }

    #[test]
    fn test_language_health() {
        let lang = recommend_flower_language(&[KeywordCategory::Health]);
        assert_eq!(lang.title, "身心的疗愈");
    }

    #[test]
    fn test_language_default() {
        let lang = recommend_flower_language(&[]);
        assert_eq!(lang.title, "生活的美好");
    }

    #[test]
    fn test_language_empty_no_panic() {
        let lang = recommend_flower_language(&[]);
        assert!(!lang.content.is_empty());
        assert!(!lang.keywords.is_empty());
    }

    #[test]
    fn test_language_first_match_wins() {
        // Gratitude 在 if-else 链中优先级最高
        let lang =
            recommend_flower_language(&[KeywordCategory::Gratitude, KeywordCategory::Family]);
        assert_eq!(lang.title, "热烈的爱与感恩");
    }

    #[test]
    fn test_language_second_priority() {
        // Family 是第二优先级（仅次 Gratitude）
        let lang = recommend_flower_language(&[KeywordCategory::Family, KeywordCategory::Love]);
        assert_eq!(lang.title, "亲情的温暖");
    }

    #[test]
    fn test_language_all_structures_non_empty() {
        // 遍历所有 8 个类别，确保所有路径都返回有效数据
        let categories = [
            KeywordCategory::Gratitude,
            KeywordCategory::Family,
            KeywordCategory::Friendship,
            KeywordCategory::Work,
            KeywordCategory::Growth,
            KeywordCategory::Health,
            KeywordCategory::Nature,
            KeywordCategory::Love,
        ];
        for cat in &categories {
            let lang = recommend_flower_language(std::slice::from_ref(cat));
            assert!(!lang.title.is_empty(), "empty title for {:?}", cat);
            assert!(!lang.content.is_empty(), "empty content for {:?}", cat);
            assert!(!lang.keywords.is_empty(), "empty keywords for {:?}", cat);
        }
    }

    // ── recommend_theme ──

    #[test]
    fn test_theme_first_unmatched() {
        // 未匹配任何分类 → 应返回 Family 主题
        let theme = recommend_theme(&[]);
        assert_eq!(theme.title, "试试分享家庭");
        assert_eq!(theme.category, "家庭");
    }

    #[test]
    fn test_theme_skips_matched() {
        // 已覆盖 Family → 应返回 Friendship
        let theme = recommend_theme(&[KeywordCategory::Family]);
        assert_eq!(theme.title, "试试分享友情");
        assert_eq!(theme.category, "友情");
    }

    #[test]
    fn test_theme_all_matched() {
        // 全部 6 个主题都覆盖 → 返回"探索新主题"
        let all = [
            KeywordCategory::Family,
            KeywordCategory::Friendship,
            KeywordCategory::Growth,
            KeywordCategory::Nature,
            KeywordCategory::Health,
            KeywordCategory::Love,
        ];
        let theme = recommend_theme(&all);
        assert_eq!(theme.title, "探索新主题");
        assert_eq!(theme.category, "其他");
    }

    #[test]
    fn test_theme_gratitude_not_in_theme_list() {
        // Gratitude 不在 recommend_theme 的检查范围 → 所有 6 个主题都未匹配 → 返回 Family
        let theme = recommend_theme(&[KeywordCategory::Gratitude, KeywordCategory::Work]);
        assert_eq!(theme.title, "试试分享家庭");
    }

    // ── recommend_color ──

    #[test]
    fn test_color_zero_total() {
        let cs = recommend_color(0, 0);
        assert_eq!(cs.color, "red");
        assert!(!cs.reason.is_empty());
    }

    #[test]
    fn test_color_high_positive() {
        let cs = recommend_color(8, 2);
        assert_eq!(cs.color, "yellow");
    }

    #[test]
    fn test_color_low_positive() {
        let cs = recommend_color(2, 8);
        assert_eq!(cs.color, "red");
    }

    #[test]
    fn test_color_mid_range_lower_bound() {
        let cs = recommend_color(4, 6);
        assert_eq!(cs.color, "white");
    }

    #[test]
    fn test_color_mid_range_upper_bound() {
        let cs = recommend_color(6, 4);
        assert_eq!(cs.color, "white");
    }

    #[test]
    fn test_color_exactly_boundary_0_4() {
        let cs = recommend_color(2, 3);
        assert_eq!(cs.color, "white");
    }

    #[test]
    fn test_color_exactly_boundary_0_6() {
        let cs = recommend_color(3, 2);
        assert_eq!(cs.color, "white");
    }

    #[test]
    fn test_color_just_above_0_6() {
        let cs = recommend_color(7, 4);
        assert_eq!(cs.color, "yellow");
    }

    #[test]
    fn test_color_just_below_0_4() {
        let cs = recommend_color(3, 6);
        assert_eq!(cs.color, "red");
    }

    #[test]
    fn test_color_large_numbers() {
        let cs = recommend_color(1_000_000, 0);
        assert_eq!(cs.color, "yellow");
    }

    #[test]
    fn test_color_large_negative() {
        let cs = recommend_color(0, 1_000_000);
        assert_eq!(cs.color, "red");
    }

    #[test]
    fn test_color_f32_precision_edge() {
        // 3/(3+2) = 0.6 exactly → 不满足 > 0.6 → 走 else → white
        let cs = recommend_color(3, 2);
        assert_eq!(cs.color, "white");
    }

    // ── 结构体 Serde 序列化 ──

    #[test]
    fn test_flower_language_serialization() {
        let lang = FlowerLanguage {
            title: "测试",
            content: "测试内容",
            keywords: &["测试"],
        };
        let json = serde_json::to_string(&lang).unwrap();
        assert!(json.contains("测试"));
        assert!(json.contains("title"));
    }

    #[test]
    fn test_theme_suggestion_serialization() {
        let theme = ThemeSuggestion {
            title: "t".into(),
            content: "c".into(),
            category: "cat".into(),
        };
        let json = serde_json::to_string(&theme).unwrap();
        assert!(json.contains("\"title\":\"t\""));
    }

    #[test]
    fn test_color_suggestion_serialization() {
        let cs = ColorSuggestion {
            color: "red",
            reason: "reason".into(),
        };
        let json = serde_json::to_string(&cs).unwrap();
        assert!(json.contains("\"color\":\"red\""));
    }
}
