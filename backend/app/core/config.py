"""Configuración central (pydantic-settings) — se lee de variables de entorno o .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "NOVUS POS"
    version: str = "0.1.0"

    database_url: str = "sqlite:///./novus-pos.db"
    secret_key: str = "dev-secret-change-me-please-0123456789abcdef"
    access_token_expire_minutes: int = 12 * 60

    tax_rate: float = 0.19
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    seed_on_startup: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
