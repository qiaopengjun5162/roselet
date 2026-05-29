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
