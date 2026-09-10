"""Validate the real SWE-chat import path against the running API.

This is intentionally a manual validation script, not a CI test. It exercises
the same HTTP requests as the Imports page, with the real OpenRouter mapping
assistant and a Postgres-backed API.

Start the API separately with IA_PROVIDER=openrouter, then run this script
against a local JSONL sample created by prepare_swe_chat.sh.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

SESSION_TARGETS = {
    "external_session_id",
    "agent",
    "model",
    "started_at",
    "ended_at",
}
MODEL_TARGETS = {
    "round_index",
    "model",
    "prompt_tokens",
    "completion_tokens",
    "cache_creation_tokens",
    "latency_ms",
    "is_error",
    "occurred_at",
}
TOOL_TARGETS = {
    "tools_path",
    "tool_name",
    "input_chars",
    "result_chars",
    "wall_latency_ms",
    "internal_latency_ms",
    "is_error",
    "occurred_at",
}
REQUIRED_FIELDS = {
    "external_session_id": "session_id",
    "round_index": "turn_number",
    "tool_name": "tool_name",
}


class ValidationError(RuntimeError):
    """Raised when one validation stage does not meet its contract."""


def _default_file() -> Path:
    candidates = (
        Path("trace/swe-chat/conversations.head.jsonl"),
        Path("trace/swe-chat/conversations.jsonl"),
    )
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def _request(response: httpx.Response, stage: str) -> Any:
    if response.is_error:
        detail = response.text[:1000]
        raise ValidationError(f"{stage} failed with HTTP {response.status_code}: {detail}")
    try:
        return response.json()
    except ValueError as exc:
        raise ValidationError(f"{stage} returned non-JSON content") from exc


def _post_file(
    client: httpx.Client,
    path: Path,
    endpoint: str,
    *,
    data: dict[str, str],
) -> dict[str, Any]:
    with path.open("rb") as handle:
        response = client.post(
            endpoint,
            data=data,
            files={
                "file": (
                    path.name,
                    handle,
                    "application/jsonl" if path.suffix == ".jsonl" else "application/octet-stream",
                )
            },
        )
    return _request(response, endpoint)


def _target_parts(target: str) -> tuple[str | None, str]:
    if "." in target:
        prefix, field = target.split(".", 1)
        return prefix, field
    if target in SESSION_TARGETS:
        return "session", target
    if target in MODEL_TARGETS:
        return "model_call", target
    if target in TOOL_TARGETS:
        return "tool_call", target
    return None, target


def _mapping_from_proposal(proposal: dict[str, Any]) -> dict[str, dict[str, str]]:
    mapping: dict[str, dict[str, str]] = {
        "session": {},
        "model_call": {},
        "tool_call": {},
    }
    for field in proposal.get("fields", []):
        source = str(field.get("source_field", "")).strip()
        target = str(field.get("target_field", "")).strip()
        if not source or not target:
            continue
        section, name = _target_parts(target)
        if section in mapping:
            mapping[section][name] = source
            # A model column is valid for both the session and model-call.
            if section == "model_call" and name == "model":
                mapping["session"][name] = source
    return {section: values for section, values in mapping.items() if values}


def _mapping_value(mapping: dict[str, Any], target: str) -> str | None:
    for section in ("session", "model_call", "tool_call"):
        value = mapping.get(section, {}).get(target)
        if value:
            return str(value)
    return None


def _assert_required_mapping(mapping: dict[str, Any]) -> None:
    missing = [
        f"{target} -> {source}"
        for target, source in REQUIRED_FIELDS.items()
        if _mapping_value(mapping, target) != source
    ]
    if missing:
        raise ValidationError(
            "The AI proposal does not match the documented SWE-chat shape. "
            "Review it and pass --mapping-file with an edited engine mapping. "
            f"Missing or incorrect mappings: {', '.join(missing)}"
        )


def _load_mapping(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValidationError(f"Cannot read mapping file {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ValidationError(f"Mapping file {path} must contain a JSON object")
    return data


def _print_proposal(proposal: dict[str, Any]) -> None:
    print("\nAI proposal")
    print(f"  source_name: {proposal.get('source_name')}")
    print(f"  explanation: {proposal.get('explanation')}")
    for field in proposal.get("fields", []):
        print(
            "  - "
            f"{field.get('source_field')} -> {field.get('target_field')} "
            f"(confidence={field.get('confidence')})"
        )
    ambiguities = proposal.get("ambiguities") or []
    if ambiguities:
        print("  ambiguities:")
        for ambiguity in ambiguities:
            print(f"  - {ambiguity}")


def _find_import(imports: list[dict[str, Any]], import_id: str) -> dict[str, Any]:
    for item in imports:
        if item.get("id") == import_id:
            return item
    raise ValidationError(f"Import {import_id} was not found in GET /imports")


def run(args: argparse.Namespace) -> None:
    path = args.file
    if not path.is_file():
        raise ValidationError(
            f"Input file not found: {path}. Run scripts/prepare_swe_chat.sh first."
        )

    base_url = args.base_url.rstrip("/")
    timeout = httpx.Timeout(args.timeout, connect=10.0)
    with httpx.Client(base_url=base_url, timeout=timeout) as client:
        settings = _request(client.get("/settings"), "GET /settings")
        print(f"API: {base_url}")
        print(f"AI provider: {settings.get('ia_provider')} / {settings.get('ia_model')}")
        if settings.get("ia_provider") != "openrouter":
            raise ValidationError(
                "The API is not using OpenRouter. Start it with "
                "IA_PROVIDER=openrouter and a non-empty OPENROUTER_API_KEY."
            )

        analysis = _post_file(
            client,
            path,
            "/mappings/analyze",
            data={"sample_size": str(args.sample_size)},
        )
        print(
            f"Analyze: {analysis['row_count']} rows, "
            f"{len(analysis['fields'])} fields"
        )
        _print_proposal(analysis["proposal"])

        if args.mapping_file:
            mapping = _load_mapping(args.mapping_file)
            print(f"Using manually reviewed mapping: {args.mapping_file}")
        else:
            mapping = _mapping_from_proposal(analysis["proposal"])
            _assert_required_mapping(mapping)
            print("Using the AI proposal after required-field checks")

        source = _request(
            client.post(
                "/sources",
                json={
                    "name": "swe-chat",
                    "version": args.source_version,
                    "method": "Hugging Face SALT-NLP/SWE-chat conversations extract",
                    "license": "ODC-By dataset terms",
                },
            ),
            "POST /sources",
        )
        source_id = source["id"]
        print(f"Source: {source_id} ({source['name']} {source['version']})")

        apply_data = _post_file(
            client,
            path,
            "/mappings/apply",
            data={
                "source_id": source_id,
                "mapping_json": json.dumps(mapping),
                "preview_rows": str(args.preview_rows),
            },
        )
        if not apply_data.get("is_valid"):
            raise ValidationError(
                "Mapping validation failed: "
                + "; ".join(apply_data.get("errors", []))
            )
        print(f"Apply: valid, {len(apply_data.get('preview') or [])} preview sessions")
        for warning in apply_data.get("warnings", []):
            print(f"  warning: {warning}")

        import_report = _post_file(
            client,
            path,
            "/imports/upload",
            data={
                "source_id": source_id,
                "mapping_json": json.dumps(mapping),
            },
        )
        print(
            "Import: "
            f"status={import_report['status']} "
            f"rows={import_report['rows_read']} "
            f"sessions={import_report['sessions_imported']} "
            f"model_calls={import_report['model_calls_imported']} "
            f"tool_calls={import_report['tool_calls_imported']}"
        )
        if import_report["status"] not in {"ok", "duplicate"}:
            raise ValidationError(f"Import did not succeed: {import_report}")

        effective_source_id = source_id
        if import_report.get("is_duplicate_run"):
            imports = _request(client.get("/imports"), "GET /imports")
            existing = _find_import(imports, str(import_report["import_id"]))
            effective_source_id = existing["source_id"]
            print(f"Existing import detected; checking source {effective_source_id}")

        dashboard = _request(
            client.get("/dashboard", params={"source_id": effective_source_id}),
            "GET /dashboard",
        )
        indicators = dashboard.get("indicators", {})
        agents = indicators.get("sessions_by_agent", [])
        if not agents:
            raise ValidationError("Dashboard filter returned no SWE-chat sessions")
        print(f"Dashboard: {len(agents)} agent groups in source filter")
        print(f"  sessions_by_agent: {json.dumps(agents, default=str)}")

        sessions = _request(
            client.get("/sessions", params={"source_id": effective_source_id}),
            "GET /sessions",
        )
        if not sessions:
            raise ValidationError("Session filter returned no SWE-chat sessions")
        print(f"Sessions: {len(sessions)} returned by source filter")
        print("\nVALIDATION PASSED")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", type=Path, default=_default_file())
    parser.add_argument("--mapping-file", type=Path)
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--sample-size", type=int, default=10)
    parser.add_argument("--preview-rows", type=int, default=10)
    parser.add_argument(
        "--source-version",
        default=f"hf-validation-{datetime.now(UTC):%Y%m%dT%H%M%SZ}",
    )
    parser.add_argument("--timeout", type=float, default=120.0)
    return parser


if __name__ == "__main__":
    try:
        run(_parser().parse_args())
    except (httpx.HTTPError, ValidationError, OSError) as exc:
        print(f"VALIDATION FAILED: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
