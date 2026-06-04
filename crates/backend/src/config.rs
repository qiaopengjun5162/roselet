use std::env;

pub struct Config {
    pub database_url: String,
    pub port: u16,
    pub jwt_secret: String,
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

        Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://localhost/roselet".to_string()),
            port: env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(3001),
            jwt_secret,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_env_defaults() {
        // Clear env vars to test defaults
        std::env::remove_var("DATABASE_URL");
        std::env::remove_var("PORT");
        std::env::remove_var("JWT_SECRET");

        let config = Config::from_env();
        assert_eq!(config.database_url, "postgres://localhost/roselet");
        assert_eq!(config.port, 3001);
        assert_eq!(config.jwt_secret, "roselet-dev-secret");
    }

    #[test]
    fn test_from_env_custom() {
        std::env::set_var("DATABASE_URL", "postgres://custom/testdb");
        std::env::set_var("PORT", "8080");
        std::env::set_var("JWT_SECRET", "my-secret-key-with-sufficient-length-32bytes");

        let config = Config::from_env();
        assert_eq!(config.database_url, "postgres://custom/testdb");
        assert_eq!(config.port, 8080);
        assert_eq!(
            config.jwt_secret,
            "my-secret-key-with-sufficient-length-32bytes"
        );

        std::env::remove_var("DATABASE_URL");
        std::env::remove_var("PORT");
        std::env::remove_var("JWT_SECRET");
    }
}
