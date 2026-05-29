use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum KeywordCategory {
    Gratitude,
    Family,
    Friendship,
    Work,
    Growth,
    Health,
    Nature,
    Love,
}

pub struct KeywordEntry {
    pub word: &'static str,
    pub category: KeywordCategory,
}

pub const KEYWORDS: &[KeywordEntry] = &[
    // 感恩类
    KeywordEntry {
        word: "感恩",
        category: KeywordCategory::Gratitude,
    },
    KeywordEntry {
        word: "感谢",
        category: KeywordCategory::Gratitude,
    },
    KeywordEntry {
        word: "幸福",
        category: KeywordCategory::Gratitude,
    },
    KeywordEntry {
        word: "幸运",
        category: KeywordCategory::Gratitude,
    },
    KeywordEntry {
        word: "知足",
        category: KeywordCategory::Gratitude,
    },
    KeywordEntry {
        word: "珍惜",
        category: KeywordCategory::Gratitude,
    },
    KeywordEntry {
        word: "温暖",
        category: KeywordCategory::Gratitude,
    },
    // 家庭类
    KeywordEntry {
        word: "家人",
        category: KeywordCategory::Family,
    },
    KeywordEntry {
        word: "父母",
        category: KeywordCategory::Family,
    },
    KeywordEntry {
        word: "孩子",
        category: KeywordCategory::Family,
    },
    KeywordEntry {
        word: "家庭",
        category: KeywordCategory::Family,
    },
    KeywordEntry {
        word: "陪伴",
        category: KeywordCategory::Family,
    },
    KeywordEntry {
        word: "亲情",
        category: KeywordCategory::Family,
    },
    // 友情类
    KeywordEntry {
        word: "朋友",
        category: KeywordCategory::Friendship,
    },
    KeywordEntry {
        word: "友情",
        category: KeywordCategory::Friendship,
    },
    KeywordEntry {
        word: "伙伴",
        category: KeywordCategory::Friendship,
    },
    KeywordEntry {
        word: "信任",
        category: KeywordCategory::Friendship,
    },
    KeywordEntry {
        word: "支持",
        category: KeywordCategory::Friendship,
    },
    // 工作类
    KeywordEntry {
        word: "工作",
        category: KeywordCategory::Work,
    },
    KeywordEntry {
        word: "项目",
        category: KeywordCategory::Work,
    },
    KeywordEntry {
        word: "同事",
        category: KeywordCategory::Work,
    },
    KeywordEntry {
        word: "升职",
        category: KeywordCategory::Work,
    },
    KeywordEntry {
        word: "加班",
        category: KeywordCategory::Work,
    },
    KeywordEntry {
        word: "压力",
        category: KeywordCategory::Work,
    },
    KeywordEntry {
        word: "忙碌",
        category: KeywordCategory::Work,
    },
    // 成长类
    KeywordEntry {
        word: "学习",
        category: KeywordCategory::Growth,
    },
    KeywordEntry {
        word: "成长",
        category: KeywordCategory::Growth,
    },
    KeywordEntry {
        word: "进步",
        category: KeywordCategory::Growth,
    },
    KeywordEntry {
        word: "目标",
        category: KeywordCategory::Growth,
    },
    KeywordEntry {
        word: "梦想",
        category: KeywordCategory::Growth,
    },
    KeywordEntry {
        word: "挑战",
        category: KeywordCategory::Growth,
    },
    // 健康类
    KeywordEntry {
        word: "健康",
        category: KeywordCategory::Health,
    },
    KeywordEntry {
        word: "运动",
        category: KeywordCategory::Health,
    },
    KeywordEntry {
        word: "休息",
        category: KeywordCategory::Health,
    },
    KeywordEntry {
        word: "疲惫",
        category: KeywordCategory::Health,
    },
    KeywordEntry {
        word: "失眠",
        category: KeywordCategory::Health,
    },
    // 自然类
    KeywordEntry {
        word: "阳光",
        category: KeywordCategory::Nature,
    },
    KeywordEntry {
        word: "花",
        category: KeywordCategory::Nature,
    },
    KeywordEntry {
        word: "旅行",
        category: KeywordCategory::Nature,
    },
    KeywordEntry {
        word: "风景",
        category: KeywordCategory::Nature,
    },
    KeywordEntry {
        word: "季节",
        category: KeywordCategory::Nature,
    },
    // 爱情类
    KeywordEntry {
        word: "爱",
        category: KeywordCategory::Love,
    },
    KeywordEntry {
        word: "恋人",
        category: KeywordCategory::Love,
    },
    KeywordEntry {
        word: "爱情",
        category: KeywordCategory::Love,
    },
    KeywordEntry {
        word: "心动",
        category: KeywordCategory::Love,
    },
    KeywordEntry {
        word: "思念",
        category: KeywordCategory::Love,
    },
];

/// 从文本中提取匹配的关键词类别
pub fn extract_categories(text: &str) -> Vec<KeywordCategory> {
    KEYWORDS
        .iter()
        .filter(|entry| text.contains(entry.word))
        .map(|entry| entry.category.clone())
        .collect()
}
