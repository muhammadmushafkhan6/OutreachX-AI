import os
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus

from pydantic import computed_field
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict

# backend/.env — cwd se independent (uvicorn --reload subprocess ke liye)
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # backend/.env has highest priority (beats Windows DATABASE_URL)
        return init_settings, env_settings, file_secret_settings, dotenv_settings

    app_name: str = "OutreachX AI"
    debug: bool = True
    secret_key: str = "dev-secret-change-in-production"
    access_token_expire_minutes: int = 1440
    algorithm: str = "HS256"

    # Only POSTGRES_* — Windows DATABASE_URL is ignored (was overriding to dealock)
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "postgres"
    postgres_password: str = ""
    postgres_db: str = "dataflow"

    @computed_field
    @property
    def database_url(self) -> str:
        raw_url = os.getenv("DATABASE_URL")
        if raw_url and "dealock" not in raw_url:
            if raw_url.startswith("postgres://"):
                return raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
            if raw_url.startswith("postgresql://"):
                return raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return raw_url

        user = quote_plus(self.postgres_user)
        password = quote_plus(self.postgres_password)
        return (
            f"postgresql+asyncpg://{user}:{password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
    redis_url: str = "redis://localhost:6379/0"

    # AI Config (Gemini / OpenAI)
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-1.5-flash"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4-turbo-preview"
    enable_openai: bool = True

    # Google Maps Providers
    apify_api_token: str | None = None
    google_maps_api_key: str | None = None

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175,http://localhost:3000,http://127.0.0.1:3000"

    scraper_timeout_ms: int = 30000
    scraper_max_retries: int = 3
    contact_crawl_max_pages: int = 5

    exports_dir: str = "exports"

    # Run jobs in-process (Redis/Celery abhi skip)
    sync_jobs: bool = True

    # Scraping / AI — install optional packages first
    enable_scraping: bool = True
    enable_openai: bool = True

    # SMTP / Email Outreach
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True
    smtp_from_email: str | None = None
    smtp_from_name: str | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # Twilio Real Phone Calling
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_phone_number: str | None = None
    twilio_webhook_base_url: str = "https://placeholder.ngrok.io"

    @property
    def twilio_enabled(self) -> bool:
        return bool(self.twilio_account_sid and self.twilio_auth_token and self.twilio_phone_number)


@lru_cache
def get_settings() -> Settings:
    return Settings()
