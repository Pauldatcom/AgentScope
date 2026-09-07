"""API package — FastAPI routers + factory."""
from .main import app, create_app, run_cli

__all__ = ["app", "create_app", "run_cli"]
