"""Test configuration shared by all test layers."""

from __future__ import annotations

import os
from pathlib import Path

os.environ.setdefault("OPENROUTER_API_KEY", "")
os.environ.setdefault("IA_PROVIDER", "fake")
os.environ.setdefault("IA_MODEL", "fake-local")


ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"


def ensure_data_dir() -> Path:
    DATA_DIR.mkdir(exist_ok=True)
    return DATA_DIR
