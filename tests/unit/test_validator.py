"""Unit tests for the Validator — invalid mappings are refused with an explanation."""

from __future__ import annotations

from agentscope.domain.services import Validator


def test_valid_mapping_passes():
    mapping = {
        "session": {"external_session_id": "session_id"},
        "model_call": {"round_index": "round_id"},
        "tool_call": {"tools_path": "tools"},
    }
    result = Validator().validate(mapping)
    assert result.is_valid
    assert result.errors == []


def test_mapping_missing_session_is_invalid():
    result = Validator().validate({"model_call": {}})
    assert not result.is_valid
    assert any("session" in e for e in result.errors)


def test_mapping_missing_external_session_id_is_invalid():
    result = Validator().validate({"session": {}})
    assert not result.is_valid
    assert any("external_session_id" in e for e in result.errors)


def test_unknown_target_field_produces_warning():
    mapping = {
        "session": {"external_session_id": "id", "bogus": "x"},
        "model_call": {},
        "tool_call": {},
    }
    result = Validator().validate(mapping)
    assert result.is_valid
    assert any("bogus" in w for w in result.warnings)


def test_non_dict_mapping_is_invalid():
    result = Validator().validate("not a dict")  # type: ignore[arg-type]
    assert not result.is_valid


def test_non_dict_model_call_section_is_invalid():
    result = Validator().validate(
        {
            "session": {"external_session_id": "session_id"},
            "model_call": "bad",  # type: ignore[dict-item]
        }
    )
    assert not result.is_valid
    assert any("mapping.model_call must be a dict" in e for e in result.errors)


def test_non_dict_tool_call_section_is_invalid():
    result = Validator().validate(
        {
            "session": {"external_session_id": "session_id"},
            "tool_call": ["bad"],  # type: ignore[dict-item]
        }
    )
    assert not result.is_valid
    assert any("mapping.tool_call must be a dict" in e for e in result.errors)
