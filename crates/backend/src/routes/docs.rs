use axum::response::Html;

pub async fn swagger_ui() -> Html<&'static str> {
    Html(include_str!("swagger.html"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_swagger_ui_returns_html() {
        let resp = swagger_ui().await;
        let body = resp.0;
        assert!(body.contains("<html"));
        assert!(body.contains("swagger"));
    }
}
