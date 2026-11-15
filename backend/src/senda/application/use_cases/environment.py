from __future__ import annotations

from senda.application.ports.outbound import EnvironmentRepository
from senda.domain.models.environment import EnvironmentSnapshot
from senda.domain.services.readiness import Readiness, assess


class GetEnvironment:
    def __init__(self, repo: EnvironmentRepository) -> None:
        self._repo = repo

    def execute(self) -> EnvironmentSnapshot:
        return self._repo.get_current()


class AssessReadiness:
    """¿Se puede salir hoy? (GO / CAUTION / NO-GO con cada medición y su fuente)."""

    def __init__(self, repo: EnvironmentRepository) -> None:
        self._repo = repo

    def execute(self) -> Readiness:
        return assess(self._repo.get_current())
