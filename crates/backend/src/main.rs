use tracing_subscriber::EnvFilter;

use roselet_backend::config::Config;
use roselet_backend::state::AppState;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("roselet=info".parse()?))
        .init();

    let config = Config::from_env();
    let pool = roselet_backend::db::create_pool(&config.database_url).await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    let state = AppState::new(pool, config.jwt_secret);
    let app = roselet_backend::create_app(state);

    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("Roselet backend listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
