use std::env;

pub struct Config {
    pub database_url: String,
    pub port: u16,
    pub jwt_secret: String,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();
        Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://localhost/roselet".to_string()),
            port: env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(3001),
            jwt_secret: env::var("JWT_SECRET").unwrap_or_else(|_| {
                eprintln!("WARNING: JWT_SECRET not set, using insecure default");
                "roselet-dev-secret".to_string()
            }),
        }
    }
}
