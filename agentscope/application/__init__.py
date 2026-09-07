"""Application layer — use cases orchestrating the domain.

Use cases depend on domain ports only; adapters are injected at the API layer.
"""

from .analyze_unknown import AnalyzeUseCase
from .apply_mapping import ApplyMappingUseCase
from .dashboard.queries import DashboardUseCase
from .import_file import ImportReport, ImportUseCase
from .mapping_management import MappingManagementUseCase

__all__ = [
    "ImportUseCase",
    "ImportReport",
    "AnalyzeUseCase",
    "ApplyMappingUseCase",
    "MappingManagementUseCase",
    "DashboardUseCase",
]
