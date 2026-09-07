"""Domain services — pure business rules.

These operate only on domain entities and never touch I/O.
They are fully unit-testable without a database, a web server or an AI model.
"""

from .deduplicator import Deduplicator
from .normalizer import Normalizer
from .validator import Validator

__all__ = ["Deduplicator", "Normalizer", "Validator"]
