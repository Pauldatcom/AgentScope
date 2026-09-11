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


def get_settings() -> Settings:
    return Settings()
