from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "db-sentinel"
    app_env: str = "production"
    log_level: str = "INFO"
    api_prefix: str = "/api/v1"

    # Database
    database_url: str = "sqlite+aiosqlite:///./db_sentinel.db"
    database_pool_size: int = 10
    database_max_overflow: int = 20

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    redis_max_connections: int = 50

    # JWT Authentication (REQUIRED - no defaults for security)
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # Encryption (REQUIRED)
    encryption_key: str

    # Admin User
    seed_admin_email: str = "admin@db-sentinel.io"
    seed_admin_password: str

    # Registration
    allow_registration: bool = False

    # AI Providers (optional)
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    ollama_base_url: str | None = None
    ollama_default_model: str = "llama3.1:8b"
    ai_default_provider: str = "ollama"
    ai_prefer_local: bool = True
    ai_cost_limit_per_day: float = 10.0

    # Task Queue
    task_queue_default_timeout: int = 300
    task_queue_max_retries: int = 3
    worker_concurrency: int = 4

    # WebSocket
    ws_heartbeat_interval: int = 30
    ws_max_connections: int = 1000

    # Monitoring
    enable_metrics: bool = True
    metrics_port: int = 9090
    sentry_dsn: str | None = None

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    cors_allow_credentials: bool = True

    @field_validator("jwt_secret", "encryption_key", "seed_admin_password")
    @classmethod
    def _validate_secrets(cls, v: str) -> str:
        if not v or v.startswith("dev-") or v.startswith("your-") or len(v) < 32:
            raise ValueError("Secret must be at least 32 characters and not use default values")
        return v

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @field_validator("app_env")
    @classmethod
    def _validate_env(cls, v: str) -> str:
        if v not in ("development", "staging", "production"):
            raise ValueError("app_env must be development, staging, or production")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
