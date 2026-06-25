use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TipContext {
    Home,
    Login,
    Plant,
    Garden,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct Tip {
    pub text: &'static str,
}

const HOME_TIPS: &[&str] = &[
    "这里不是朋友圈，不用表现得很好。种下一点真实就可以。",
    "今天不知道说什么，也可以先去花圃看看别人留下的光。",
    "玫瑰、花苞和尖刺，都是同一颗心的不同天气。",
];

const LOGIN_TIPS: &[&str] = &[
    "可以不设密码，像把钥匙藏在花盆底下；但设了密码，别人就不容易误进你的花圃。",
    "只填昵称也能进入。设置密码后，下次换设备也更容易找回自己的花圃。",
    "如果这个昵称已经被设置过密码，就需要输入密码才能继续使用。",
];

const PLANT_TIPS: &[&str] = &[
    "不知道写哪一栏？只写一栏也可以，一朵花不需要一次说完全部心事。",
    "私密玫瑰不会进入公共花圃，适合那些只想留给自己的小天气。",
    "送给别人时，对方会在自己的花圃里看到这朵特别的玫瑰。",
];

const GARDEN_TIPS: &[&str] = &[
    "花圃里看到的是公开玫瑰；私密玫瑰只留在自己的小角落。",
    "如果一朵玫瑰让你有共鸣，可以轻轻点个赞。",
    "每朵玫瑰都有自己的声音，可以试着听一听。",
];

fn tips_for_context(context: TipContext) -> &'static [&'static str] {
    match context {
        TipContext::Home => HOME_TIPS,
        TipContext::Login => LOGIN_TIPS,
        TipContext::Plant => PLANT_TIPS,
        TipContext::Garden => GARDEN_TIPS,
    }
}

pub fn get_tips_internal(context: TipContext) -> Vec<Tip> {
    tips_for_context(context).iter().copied().map(|text| Tip { text }).collect()
}

pub fn parse_context(value: &str) -> TipContext {
    match value {
        "login" => TipContext::Login,
        "plant" => TipContext::Plant,
        "garden" => TipContext::Garden,
        _ => TipContext::Home,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn login_tips_explain_optional_password() {
        let tips = get_tips_internal(TipContext::Login);

        assert!(tips.iter().any(|tip| tip.text.contains("可以不设密码")));
        assert!(tips.iter().any(|tip| tip.text.contains("设置密码")));
    }

    #[test]
    fn home_tips_keep_roselet_tone() {
        let tips = get_tips_internal(TipContext::Home);

        assert!(tips.iter().any(|tip| tip.text.contains("不用表现得很好")));
    }

    #[test]
    fn unknown_context_falls_back_to_home() {
        assert_eq!(parse_context("missing"), TipContext::Home);
    }
}
