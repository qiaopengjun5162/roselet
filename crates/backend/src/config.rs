use std::env;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub port: u16,
    pub jwt_secret: String,
    pub allowed_origins: Vec<String>,
    pub admin_user_ids: Vec<String>,
    pub private_rose_monthly_limit: i64,
    pub is_production: bool,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();
        let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| {
            eprintln!("WARNING: JWT_SECRET not set, using insecure default");
            "roselet-dev-secret".to_string()
        });

        if jwt_secret.len() < 32 {
            eprintln!("WARNING: JWT_SECRET is too short (< 32 bytes), security risk!");
        }

        let is_production = env::var("NODE_ENV").map(|v| v == "production").unwrap_or(false);

        if is_production && jwt_secret == "roselet-dev-secret" {
            panic!(
                "PRODUCTION SAFETY: JWT_SECRET must be set to a strong random value. Do NOT use the default secret in production."
            );
        }

        let allowed_origins = env::var("ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:3000,http://127.0.0.1:3000".to_string())
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        let admin_user_ids = env::var("ADMIN_USER_IDS")
            .unwrap_or_default()
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        let private_rose_monthly_limit = env::var("PRIVATE_ROSE_MONTHLY_LIMIT")
            .ok()
            .and_then(|value| value.parse::<i64>().ok())
            .filter(|limit| *limit > 0)
            .unwrap_or(crate::routes::rose::DEFAULT_PRIVATE_ROSE_MONTHLY_LIMIT);

        Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://localhost/roselet".to_string()),
            port: env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(3001),
            jwt_secret,
            allowed_origins,
            admin_user_ids,
            private_rose_monthly_limit,
            is_production,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_env_defaults() {
        std::env::remove_var("DATABASE_URL");
        std::env::remove_var("PORT");
        std::env::remove_var("JWT_SECRET");
        std::env::remove_var("NODE_ENV");
        std::env::remove_var("ALLOWED_ORIGINS");
        std::env::remove_var("ADMIN_USER_IDS");
        std::env::remove_var("PRIVATE_ROSE_MONTHLY_LIMIT");

        let config = Config::from_env();
        assert_eq!(config.database_url, "postgres://localhost/roselet");
        assert_eq!(config.port, 3001);
        assert_eq!(config.jwt_secret, "roselet-dev-secret");
        assert!(!config.is_production);
        assert!(config.allowed_origins.contains(&"http://localhost:3000".to_string()));
        assert!(config.admin_user_ids.is_empty());
        assert_eq!(config.private_rose_monthly_limit, 10);
    }

    #[test]
    fn test_from_env_custom() {
        std::env::set_var("DATABASE_URL", "postgres://custom/testdb");
        std::env::set_var("PORT", "8080");
        std::env::set_var("JWT_SECRET", "my-secret-key-with-sufficient-length-32bytes");
        std::env::set_var("ALLOWED_ORIGINS", "https://roselet.example.com");
        std::env::set_var("ADMIN_USER_IDS", " user-1, user-2 ");
        std::env::set_var("PRIVATE_ROSE_MONTHLY_LIMIT", "15");

        let config = Config::from_env();
        assert_eq!(config.database_url, "postgres://custom/testdb");
        assert_eq!(config.port, 8080);
        assert_eq!(
            config.jwt_secret,
            "my-secret-key-with-sufficient-length-32bytes"
        );
        assert_eq!(config.allowed_origins, vec!["https://roselet.example.com"]);
        assert_eq!(config.admin_user_ids, vec!["user-1", "user-2"]);
        assert_eq!(config.private_rose_monthly_limit, 15);

        std::env::remove_var("DATABASE_URL");
        std::env::remove_var("PORT");
        std::env::remove_var("JWT_SECRET");
        std::env::remove_var("ALLOWED_ORIGINS");
        std::env::remove_var("ADMIN_USER_IDS");
        std::env::remove_var("PRIVATE_ROSE_MONTHLY_LIMIT");
    }

    #[test]
    #[should_panic(expected = "JWT_SECRET must be set")]
    fn test_production_rejects_default_jwt() {
        std::env::set_var("NODE_ENV", "production");
        std::env::remove_var("JWT_SECRET");
        let _ = Config::from_env();
        std::env::remove_var("NODE_ENV");
    }
}
