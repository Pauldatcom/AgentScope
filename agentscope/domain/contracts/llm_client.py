"""LLMClientPort — low-level chat completion port.

Used by `adapters.ia.openrouter.OpenRouterAdapter` and `adapters.ia.fake.FakeAgent`.
The model identifier is NEVER hardcoded: it comes from configuration.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class LLMMessage:
    role: str
    content: str


@dataclass(frozen=True)
class LLMResponse:
    content: str
    model: str
    raw: dict[str, Any] | None = None


class LLMClientPort(ABC):
    """A minimal chat-completion client, configurable by model name."""

    @abstractmethod
    def complete(
        self,
        messages: list[LLMMessage],
        *,
        model: str,
        temperature: float = 0.0,
        max_tokens: int = 2048,
    ) -> LLMResponse:
        """Return the model's completion for `messages`."""
