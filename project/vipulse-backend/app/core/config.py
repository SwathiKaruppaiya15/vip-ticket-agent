from typing import List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── Application ───────────────────────────────────────────────────────────
    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "VIPulse AI"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # ── Security ──────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production-use-32-char-minimum!!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    # ── MongoDB ───────────────────────────────────────────────────────────────
    MONGODB_URL: str = "mongodb://localhost:27017/vipulse"
    MONGODB_DB_NAME: str = "vipulse"

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── AI / LLM ──────────────────────────────────────────────────────────────
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama3-70b-8192"

    # ── Notifications ─────────────────────────────────────────────────────────
    DISCORD_WEBHOOK_URL: str = ""
    GMAIL_USER: str = ""
    GMAIL_APP_PASSWORD: str = ""

    # ── Frontend ──────────────────────────────────────────────────────────────
    DASHBOARD_URL: str = "http://localhost:3000"
    TEAM_EMAIL_MAP: str = ""

    # ── Observability (optional — empty string disables Sentry) ──────────────
    SENTRY_DSN: str = ""


def get_settings() -> Settings:
    return Settings()


settings = get_settings()
