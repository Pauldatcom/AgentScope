"""Settings router — read-only view of the app configuration."""

from __future__ import annotations

from fastapi import APIRouter, Request

from ..schemas import SettingsOut

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
def get_settings(request: Request):
    settings = request.app.state.settings
    return SettingsOut(
        app_env=settings.app_env,
        app_host=settings.app_host,
        app_port=settings.app_port,
        cors_origins=settings.cors_origins,
        ia_provider=settings.ia_provider,
        ia_model=settings.ia_model,
        ia_model_alt=settings.ia_model_alt,
        openrouter_base_url=settings.openrouter_base_url,
        database_url="",  # never expose the connection string
    )
