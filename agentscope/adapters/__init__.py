"""Adapters — concrete implementations of domain ports.

Import specific adapters on demand (e.g. `from agentscope.adapters.files
import JsonlReader`). The package __init__ stays lazy so the domain and
application layers can be unit-tested without pandas/SQLAlchemy/httpx.
"""
