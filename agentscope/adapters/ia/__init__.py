"""IA adapters — FakeAgent and OpenRouter."""
from .fake.agent import FakeAgent
from .openrouter.adapter import OpenRouterAdapter

__all__ = ["FakeAgent", "OpenRouterAdapter"]
