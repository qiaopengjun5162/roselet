use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ChatMessageContent,
}

#[derive(Debug, Deserialize)]
struct ChatMessageContent {
    content: String,
}

fn build_prompt(
    color: &str,
    gratitude: Option<&str>,
    anxiety: Option<&str>,
    hope: Option<&str>,
) -> String {
    let color_name = match color {
        "red" => "红玫瑰（感恩）",
        "white" => "白玫瑰（纯洁）",
        "yellow" => "黄玫瑰（温暖）",
        _ => "玫瑰",
    };

    let mut parts = Vec::new();
    if let Some(g) = gratitude {
        parts.push(format!("感恩：{}", g));
    }
    if let Some(a) = anxiety {
        parts.push(format!("焦虑：{}", a));
    }
    if let Some(h) = hope {
        parts.push(format!("期待：{}", h));
    }

    format!(
        "用户在社区花圃种下了一朵{}，内容如下：\n{}\n\n请用温暖、真诚的语气回复一段话（50-100字），表达对用户的共鸣和支持。不要重复用户的话，要有新意。用中文回复。",
        color_name,
        parts.join("\n"),
    )
}

pub async fn generate_reply(
    color: &str,
    gratitude: Option<&str>,
    anxiety: Option<&str>,
    hope: Option<&str>,
) -> Option<String> {
    let api_key = std::env::var("OPENAI_API_KEY").ok()?;
    let base_url = std::env::var("OPENAI_BASE_URL")
        .unwrap_or_else(|_| "https://api.openai.com/v1".to_string());
    let model = std::env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-4o-mini".to_string());

    let prompt = build_prompt(color, gratitude, anxiety, hope);

    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/chat/completions", base_url))
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&ChatRequest {
            model,
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: prompt,
            }],
            max_tokens: 200,
        })
        .send()
        .await
        .ok()?;

    let body: ChatResponse = res.json().await.ok()?;
    body.choices.first().map(|c| c.message.content.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_prompt_red_with_gratitude() {
        let prompt = build_prompt("red", Some("感谢家人"), None, None);
        assert!(prompt.contains("红玫瑰（感恩）"));
        assert!(prompt.contains("感恩：感谢家人"));
    }

    #[test]
    fn test_build_prompt_white_with_anxiety() {
        let prompt = build_prompt("white", None, Some("工作压力"), None);
        assert!(prompt.contains("白玫瑰（纯洁）"));
        assert!(prompt.contains("焦虑：工作压力"));
    }

    #[test]
    fn test_build_prompt_yellow_with_hope() {
        let prompt = build_prompt("yellow", None, None, Some("期待旅行"));
        assert!(prompt.contains("黄玫瑰（温暖）"));
        assert!(prompt.contains("期待：期待旅行"));
    }

    #[test]
    fn test_build_prompt_all_fields() {
        let prompt = build_prompt("red", Some("感恩"), Some("焦虑"), Some("期待"));
        assert!(prompt.contains("感恩：感恩"));
        assert!(prompt.contains("焦虑：焦虑"));
        assert!(prompt.contains("期待：期待"));
    }

    #[test]
    fn test_build_prompt_unknown_color() {
        let prompt = build_prompt("blue", Some("test"), None, None);
        assert!(prompt.contains("玫瑰"));
        assert!(!prompt.contains("红玫瑰"));
    }
}
