"""Configuration loaded from environment via pydantic-settings.

The model name is NEVER hardcoded — it comes from .env.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="", extra="ignore"
    )

    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    cors_origins: str = "http://localhost:5173"

    database_url: str = (
        "postgresql+psycopg://agentscope:agentscope@localhost:5432/agentscope"
    )

    ia_provider: str = "fake"
    ia_model: str = "openai/gpt-4o-mini"
    ia_model_alt: str = "z-ai/glm-5.2"
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # When true, the Settings UI hides .env-backed values by default.
    mask_env: bool = True
    # Slack/S3 cards are not production-ready. Unset = on in development only.
    enable_integrations: bool | None = None

    def integrations_enabled(self) -> bool:
        if self.enable_integrations is not None:
            return self.enable_integrations
        return self.app_env.strip().lower() in {"development", "dev", "local"}


def get_settings() -> Settings:
    return Settings()
