"""OpenRouterAdapter — calls OpenRouter's chat completion API.

Model name comes from configuration; it is NEVER hardcoded.
Implements both MappingAgentPort (proposes a mapping) and LLMClientPort.
"""

from __future__ import annotations

import json

import httpx

from ....domain.contracts import (
    FieldProfile,
    FileSample,
    LLMClientPort,
    LLMMessage,
    LLMResponse,
    MappingAgentPort,
    MappingProposal,
    ProposalField,
)

SYSTEM_PROMPT = (
    "You are a data mapping assistant. Given a file sample and field "
    "profiles, propose a mapping from the source fields to the target "
    "schema. Respond STRICTLY with JSON of the form: "
    '{"fields":[{"source_field":"x","target_field":"y","confidence":0.9,'
    '"explanation":"..."}],"source_name":"...","explanation":"...",'
    '"ambiguities":["..."]}. '
    "Do not invent target fields not in the schema. Signal ambiguities."
)


class OpenRouterLLMClient(LLMClientPort):
    """Thin httpx wrapper around OpenRouter's /chat/completions."""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = "https://openrouter.ai/api/v1",
        timeout: float = 60.0,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    def complete(
        self,
        messages: list[LLMMessage],
        *,
        model: str,
        temperature: float = 0.0,
        max_tokens: int = 2048,
    ) -> LLMResponse:
        payload = {
            "model": model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=self._timeout) as client:
            r = client.post(
                f"{self._base_url}/chat/completions",
                json=payload,
                headers=headers,
            )
            r.raise_for_status()
            data = r.json()
        return LLMResponse(
            content=data["choices"][0]["message"]["content"],
            model=data.get("model", model),
            raw=data,
        )


class OpenRouterAdapter(MappingAgentPort):
    """MappingAgentPort implementation backed by OpenRouter."""

    def __init__(
        self,
        *,
        client: LLMClientPort,
        model: str,
    ) -> None:
        self._client = client
        self._model = model

    @property
    def model_name(self) -> str:
        return self._model

    def propose(
        self,
        sample: FileSample,
        profiles: list[FieldProfile],
        *,
        target_schema: dict[str, str],
    ) -> MappingProposal:
        schema_desc = "\n".join(f"- {k}: {v}" for k, v in target_schema.items())
        profile_desc = "\n".join(
            f"- {p.name} ({p.inferred_type}, non_null={p.non_null_ratio:.0%}, "
            f"distinct={p.distinct_values}, examples={p.examples})"
            for p in profiles
        )
        sample_desc = json.dumps(sample.rows[:3], default=str)[:4000]

        user = (
            f"Target schema:\n{schema_desc}\n\n"
            f"Field profiles:\n{profile_desc}\n\n"
            f"Sample rows:\n{sample_desc}\n\n"
            "Propose a mapping as JSON. Do not include markdown fences."
        )
        resp = self._client.complete(
            [LLMMessage(role="system", content=SYSTEM_PROMPT), LLMMessage(role="user", content=user)],
            model=self._model,
        )
        return _parse_proposal(resp.content)


def _parse_proposal(content: str) -> MappingProposal:
    text = content.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return MappingProposal(
            fields=[],
            source_name=None,
            explanation="Model returned non-JSON content.",
            ambiguities=["Could not parse model response as JSON."],
        )

    fields = [
        ProposalField(
            source_field=f.get("source_field", ""),
            target_field=f.get("target_field", ""),
            confidence=float(f.get("confidence", 0.0)),
            transform=f.get("transform"),
            explanation=f.get("explanation", ""),
            ambiguity=f.get("ambiguity"),
        )
        for f in data.get("fields", [])
    ]
    return MappingProposal(
        fields=fields,
        source_name=data.get("source_name"),
        explanation=data.get("explanation", ""),
        ambiguities=data.get("ambiguities", []),
    )
