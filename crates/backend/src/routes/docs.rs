use axum::response::Html;

pub async fn swagger_ui() -> Html<&'static str> {
    Html(include_str!("swagger.html"))
}
